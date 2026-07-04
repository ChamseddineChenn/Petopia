import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StatusBar,
  Text,
  Animated,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Post } from '../../store/slices/postSlice';

/* ── helpers ── */
const fmt = (s: number) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

/** Inject Cloudinary quality transformation into a video URL. */
const applyQuality = (url: string, quality: string): string => {
  if (quality === 'auto') return url;
  // Cloudinary pattern: .../upload/v123/file.mp4 → .../upload/q_XX/v123/file.mp4
  const match = url.match(/(\/upload\/)(v\d+\/)/);
  if (match) {
    return url.replace(match[0], `${match[1]}q_${quality}/${match[2]}`);
  }
  return url;
};

const QUALITY_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: '1080p', value: '100' },
  { label: '720p', value: '80' },
  { label: '480p', value: '60' },
  { label: '360p', value: '40' },
] as const;

/* ── types ── */
export interface VideoPlayerModalProps {
  visible: boolean;
  uri: string;
  thumbnail?: string | null;
  post?: Post | null;
  onClose: () => void;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  visible,
  uri,
  thumbnail,
  post,
  onClose,
  onLike,
  onComment,
}) => {
  const insets = useSafeAreaInsets();

  /* quality */
  const [quality, setQuality] = useState<string>('auto');
  const [showQuality, setShowQuality] = useState(false);
  const effectiveUri = applyQuality(uri, quality);

  /* player */
  const player = useVideoPlayer(effectiveUri, (p) => {
    p.loop = true;
    p.play();
  });

  /* state */
  const [showUI, setShowUI] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [barW, setBarW] = useState(0);
  const [muted, setMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  /* double-tap like */
  const lastTapRef = useRef(0);
  const heartAnim = useRef(new Animated.Value(0)).current;
  const [showHeart, setShowHeart] = useState(false);

  const fade = useRef(new Animated.Value(1)).current;
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* reset state when modal opens/closes */
  useEffect(() => {
    if (visible) {
      setBuffering(true);
      setShowUI(true);
      fade.setValue(1);
      setCurTime(0);
      setDur(0);
      setShowQuality(false);
    }
  }, [visible, fade]);

  /* poll time */
  useEffect(() => {
    if (!visible) return;
    pollRef.current = setInterval(() => {
      try {
        const ct = player.currentTime;
        const d = player.duration;
        if (!isSeeking) setCurTime(ct);
        setDur(d);
        if (d > 0 && ct > 0) setBuffering(false);
      } catch {
        /* player may be disposed */
      }
    }, 250);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [visible, player, isSeeking]);

  /* playing listener */
  useEffect(() => {
    const sub = player.addListener(
      'playingChange',
      (e: { isPlaying: boolean }) => {
        setPlaying(e.isPlaying);
        if (e.isPlaying) setBuffering(false);
      },
    );
    return () => sub.remove();
  }, [player]);

  /* auto-hide controls */
  const scheduleHide = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => {
      if (playing && !showQuality) {
        Animated.timing(fade, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowUI(false));
      }
    }, 4000);
  }, [playing, fade, showQuality]);

  useEffect(() => {
    if (showUI) scheduleHide();
    return () => {
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [showUI, scheduleHide]);

  /* helpers */
  const revealUI = useCallback(() => {
    setShowUI(true);
    fade.setValue(1);
    scheduleHide();
  }, [fade, scheduleHide]);

  const handleClose = () => {
    player.pause();
    setShowQuality(false);
    onClose();
  };

  const togglePlay = () => {
    if (player.playing) player.pause();
    else player.play();
    revealUI();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    player.muted = next;
    revealUI();
  };

  /* double-tap to like */
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300 && post) {
      // Double tap → like
      if (!post.isLiked) onLike?.(post._id);
      triggerHeartAnimation();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    // Single tap — toggle UI (delayed to distinguish from double)
    setTimeout(() => {
      if (Date.now() - lastTapRef.current >= 280) {
        if (showQuality) {
          setShowQuality(false);
          return;
        }
        if (showUI) {
          Animated.timing(fade, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => setShowUI(false));
        } else {
          revealUI();
        }
      }
    }, 300);
  };

  const triggerHeartAnimation = () => {
    setShowHeart(true);
    heartAnim.setValue(0);
    Animated.sequence([
      Animated.spring(heartAnim, {
        toValue: 1,
        friction: 3,
        tension: 150,
        useNativeDriver: true,
      }),
      Animated.timing(heartAnim, {
        toValue: 0,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowHeart(false));
  };

  const handleSeek = (locX: number) => {
    if (barW <= 0 || !dur) return;
    const ratio = Math.max(0, Math.min(1, locX / barW));
    player.currentTime = ratio * dur;
    setCurTime(ratio * dur);
    revealUI();
  };

  /* Seek bar pan responder for smooth scrubbing */
  const seekPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setIsSeeking(true);
        handleSeek(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => {
        handleSeek(e.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        setIsSeeking(false);
        revealUI();
      },
    }),
  ).current;

  const skipBack = () => {
    const t = Math.max(0, player.currentTime - 10);
    player.currentTime = t;
    setCurTime(t);
    revealUI();
  };

  const skipForward = () => {
    const t = Math.min(dur, player.currentTime + 10);
    player.currentTime = t;
    setCurTime(t);
    revealUI();
  };

  const handleQualityChange = (val: string) => {
    const wasPlaying = player.playing;
    const savedTime = player.currentTime;
    setQuality(val);
    setShowQuality(false);
    setBuffering(true);
    // Player will recreate with new URI on next render
    setTimeout(() => {
      try {
        player.currentTime = savedTime;
        if (wasPlaying) player.play();
      } catch {
        /* ignore */
      }
    }, 500);
    revealUI();
  };

  const progress = dur > 0 ? curTime / dur : 0;
  const activeQualityLabel =
    QUALITY_OPTIONS.find((q) => q.value === quality)?.label ?? 'Auto';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* ── Poster thumbnail while buffering ── */}
        {buffering && thumbnail && (
          <Image
            source={{ uri: thumbnail }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            contentFit="contain"
          />
        )}

        {/* ── Video ── */}
        <VideoView
          player={player}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          contentFit="contain"
          nativeControls={false}
        />

        {/* ── Buffering spinner ── */}
        {buffering && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            pointerEvents="none"
          >
            <ActivityIndicator size="large" color="#4DB6AC" />
          </View>
        )}

        {/* ── Double-tap heart animation ── */}
        {showHeart && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: heartAnim,
              transform: [
                {
                  scale: heartAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1.2],
                  }),
                },
              ],
            }}
          >
            <Ionicons name="heart" size={100} color="#EF4444" />
          </Animated.View>
        )}

        {/* ── Tap overlay ── */}
        <TouchableWithoutFeedback onPress={handleTap}>
          <View style={{ flex: 1 }}>
            {showUI && (
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: fade,
                }}
              >
                {/* ── Top bar ── */}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    paddingTop: insets.top + 8,
                    paddingHorizontal: 16,
                    paddingBottom: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(0,0,0,0.45)',
                  }}
                >
                  {/* Back button */}
                  <TouchableOpacity
                    onPress={handleClose}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                  </TouchableOpacity>

                  {/* Author info */}
                  {post?.author && (
                    <View
                      style={{
                        flex: 1,
                        marginLeft: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      {post.author.profileImage ? (
                        <Image
                          source={{ uri: post.author.profileImage }}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            borderWidth: 1.5,
                            borderColor: 'rgba(255,255,255,0.4)',
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{
                              color: '#fff',
                              fontSize: 14,
                              fontWeight: '600',
                            }}
                          >
                            {post.author.name?.[0] || '?'}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: '600',
                          marginLeft: 8,
                        }}
                        numberOfLines={1}
                      >
                        {post.author.name}
                      </Text>
                    </View>
                  )}

                  {/* Mute button */}
                  <TouchableOpacity
                    onPress={toggleMute}
                    activeOpacity={0.7}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={muted ? 'volume-mute' : 'volume-high'}
                      size={20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>

                {/* ── Right side action buttons (Instagram-style) ── */}
                {post && (
                  <View
                    style={{
                      position: 'absolute',
                      right: 12,
                      bottom: 140,
                      alignItems: 'center',
                      gap: 20,
                    }}
                  >
                    {/* Like */}
                    <TouchableOpacity
                      onPress={() => onLike?.(post._id)}
                      activeOpacity={0.7}
                      style={{ alignItems: 'center' }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name={post.isLiked ? 'heart' : 'heart-outline'}
                          size={26}
                          color={post.isLiked ? '#EF4444' : '#fff'}
                        />
                      </View>
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: '600',
                          marginTop: 4,
                        }}
                      >
                        {formatCount(post.likesCount)}
                      </Text>
                    </TouchableOpacity>

                    {/* Comments */}
                    <TouchableOpacity
                      onPress={() => {
                        handleClose();
                        setTimeout(() => onComment?.(post._id), 300);
                      }}
                      activeOpacity={0.7}
                      style={{ alignItems: 'center' }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={24}
                          color="#fff"
                        />
                      </View>
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: '600',
                          marginTop: 4,
                        }}
                      >
                        {formatCount(post.commentsCount)}
                      </Text>
                    </TouchableOpacity>

                    {/* Quality */}
                    <TouchableOpacity
                      onPress={() => setShowQuality(!showQuality)}
                      activeOpacity={0.7}
                      style={{ alignItems: 'center' }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: showQuality
                            ? 'rgba(77,182,172,0.6)'
                            : 'rgba(0,0,0,0.4)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name="settings-sharp"
                          size={22}
                          color="#fff"
                        />
                      </View>
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: '600',
                          marginTop: 4,
                        }}
                      >
                        {activeQualityLabel}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ── Quality picker popup ── */}
                {showQuality && (
                  <View
                    style={{
                      position: 'absolute',
                      right: 68,
                      bottom: 160,
                      backgroundColor: 'rgba(20,20,20,0.92)',
                      borderRadius: 14,
                      paddingVertical: 6,
                      minWidth: 130,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.4,
                      shadowRadius: 8,
                      elevation: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 11,
                        fontWeight: '600',
                        paddingHorizontal: 16,
                        paddingVertical: 6,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Quality
                    </Text>
                    {QUALITY_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => handleQualityChange(opt.value)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          backgroundColor:
                            quality === opt.value
                              ? 'rgba(77,182,172,0.2)'
                              : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            color: quality === opt.value ? '#4DB6AC' : '#fff',
                            fontSize: 14,
                            fontWeight: quality === opt.value ? '700' : '400',
                            flex: 1,
                          }}
                        >
                          {opt.label}
                        </Text>
                        {quality === opt.value && (
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color="#4DB6AC"
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* ── Center controls ── */}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 48,
                  }}
                  pointerEvents="box-none"
                >
                  {/* skip back */}
                  <TouchableOpacity onPress={skipBack} activeOpacity={0.7}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="play-back" size={22} color="#fff" />
                    </View>
                  </TouchableOpacity>

                  {/* play / pause */}
                  <TouchableOpacity onPress={togglePlay} activeOpacity={0.7}>
                    <View
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: 34,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={playing ? 'pause' : 'play'}
                        size={34}
                        color="#fff"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* skip forward */}
                  <TouchableOpacity onPress={skipForward} activeOpacity={0.7}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="play-forward" size={22} color="#fff" />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* ── Bottom bar ── */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    paddingBottom: insets.bottom + 12,
                    paddingHorizontal: 16,
                    paddingTop: 20,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                  }}
                >
                  {/* Time row */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: '#fff',
                        fontSize: 12,
                        fontVariant: ['tabular-nums'],
                        fontWeight: '500',
                      }}
                    >
                      {fmt(curTime)}
                    </Text>
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: 12,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {fmt(dur)}
                    </Text>
                  </View>

                  {/* Scrubbing progress bar */}
                  <View
                    onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
                    style={{ height: 28, justifyContent: 'center' }}
                    {...seekPan.panHandlers}
                  >
                    {/* track bg */}
                    <View
                      style={{
                        height: isSeeking ? 5 : 3,
                        borderRadius: 2.5,
                        backgroundColor: 'rgba(255,255,255,0.25)',
                      }}
                    >
                      {/* filled */}
                      <View
                        style={{
                          height: '100%',
                          width: `${Math.min(progress * 100, 100)}%` as any,
                          backgroundColor: '#4DB6AC',
                          borderRadius: 2.5,
                        }}
                      />
                    </View>
                    {/* knob */}
                    <View
                      style={{
                        position: 'absolute',
                        left: Math.max(0, progress * barW - 8),
                        width: isSeeking ? 18 : 14,
                        height: isSeeking ? 18 : 14,
                        borderRadius: isSeeking ? 9 : 7,
                        backgroundColor: '#4DB6AC',
                        borderWidth: 2,
                        borderColor: '#fff',
                        elevation: 3,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.3,
                        shadowRadius: 2,
                      }}
                    />
                  </View>
                </View>
              </Animated.View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
};
