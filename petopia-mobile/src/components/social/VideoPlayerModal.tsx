import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StatusBar,
  Text,
  Animated,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ── helpers ── */
const fmt = (s: number) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/* ── types ── */
interface VideoPlayerModalProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  visible,
  uri,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  /* player */
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  /* state */
  const [showUI, setShowUI] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [barW, setBarW] = useState(0);

  const fade = useRef(new Animated.Value(1)).current;
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* poll time */
  useEffect(() => {
    if (!visible) return;
    pollRef.current = setInterval(() => {
      try {
        setCurTime(player.currentTime);
        setDur(player.duration);
      } catch {
        /* player may be disposed */
      }
    }, 250);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [visible, player]);

  /* playing listener */
  useEffect(() => {
    const sub = player.addListener(
      'playingChange',
      (e: { isPlaying: boolean }) => {
        setPlaying(e.isPlaying);
      },
    );
    return () => sub.remove();
  }, [player]);

  /* auto-hide */
  const scheduleHide = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => {
      if (playing) {
        Animated.timing(fade, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowUI(false));
      }
    }, 3500);
  }, [playing, fade]);

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
    onClose();
  };

  const togglePlay = () => {
    if (player.playing) player.pause();
    else player.play();
    revealUI();
  };

  const handleTap = () => {
    if (showUI) {
      Animated.timing(fade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowUI(false));
    } else {
      revealUI();
    }
  };

  const handleSeek = (locX: number) => {
    if (barW <= 0 || !dur) return;
    const ratio = Math.max(0, Math.min(1, locX / barW));
    player.currentTime = ratio * dur;
    setCurTime(ratio * dur);
    revealUI();
  };

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

  const progress = dur > 0 ? curTime / dur : 0;

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
        {/* ── Video ── */}
        <VideoView
          player={player}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="contain"
          nativeControls={false}
        />

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
                    paddingHorizontal: 12,
                    paddingBottom: 16,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                  }}
                >
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
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

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
                        width: 44,
                        height: 44,
                        borderRadius: 22,
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
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={playing ? 'pause' : 'play'}
                        size={32}
                        color="#fff"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* skip forward */}
                  <TouchableOpacity onPress={skipForward} activeOpacity={0.7}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
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
                    backgroundColor: 'rgba(0,0,0,0.45)',
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

                  {/* Progress bar */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={(e) => handleSeek(e.nativeEvent.locationX)}
                    onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
                    style={{ height: 24, justifyContent: 'center' }}
                  >
                    {/* track */}
                    <View
                      style={{
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: 'rgba(255,255,255,0.25)',
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${Math.min(progress * 100, 100)}%` as any,
                          backgroundColor: '#4DB6AC',
                          borderRadius: 1.5,
                        }}
                      />
                    </View>
                    {/* knob */}
                    <View
                      style={{
                        position: 'absolute',
                        left: progress * barW - 7,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
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
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
};
