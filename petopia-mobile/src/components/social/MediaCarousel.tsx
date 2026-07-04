import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayerModal } from './VideoPlayerModal';
import { ImageViewerModal } from './ImageViewerModal';
import type { MediaItem, Post } from '../../store/slices/postSlice';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MediaCarouselProps {
  media: MediaItem[];
  width?: number;
  height?: number;
  post?: Post | null;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  /** @deprecated — video playback is now built-in */
  onVideoPress?: (item: MediaItem) => void;
}

/**
 * Compute display height from the actual media dimensions.
 * Falls back to 4:5 (portrait-ish) if no dimensions are available.
 * Clamps between 200px and 560px so the feed stays usable.
 */
const computeHeight = (
  media: MediaItem[],
  containerW: number,
  explicit?: number,
): number => {
  if (explicit) return explicit;

  // Use the first media item's real dimensions if available
  const first = media[0];
  if (first?.width && first?.height && first.width > 0 && first.height > 0) {
    const aspect = first.height / first.width; // e.g. 0.5625 for 16:9 landscape
    const h = Math.round(containerW * aspect);
    return Math.max(200, Math.min(h, 560));
  }

  // Fallback: 4:5 ratio (Instagram default)
  return Math.min(Math.round(containerW * (5 / 4)), 560);
};

export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  media,
  width = SCREEN_WIDTH,
  height: explicitHeight,
  post,
  onLike,
  onComment,
  ...rest
}) => {
  // consume legacy prop to prevent ReferenceError
  void rest.onVideoPress;
  const [activeIndex, setActiveIndex] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoThumb, setVideoThumb] = useState<string | null>(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  const height = computeHeight(media, width, explicitHeight);

  // Collect all image URLs for the full-screen viewer
  const imageUrls = media.filter((m) => m.type !== 'video').map((m) => m.url);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  if (!media || media.length === 0) return null;

  const handleVideoPress = (item: MediaItem) => {
    setVideoUri(item.url);
    setVideoThumb(item.thumbnail || null);
  };

  const handleImagePress = (item: MediaItem, carouselIndex: number) => {
    // Find this image's position among the image-only items
    const imageOnlyIndex = media
      .filter((m) => m.type !== 'video')
      .findIndex((m) => m.url === item.url);
    setImageViewerIndex(imageOnlyIndex >= 0 ? imageOnlyIndex : carouselIndex);
    setImageViewerOpen(true);
  };

  // Shared renderer for a single media item
  const renderMediaItem = (item: MediaItem, index: number) => (
    <>
      {item.type === 'video' ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleVideoPress(item)}
          style={{ width, height }}
        >
          <Image
            source={{ uri: item.thumbnail || item.url }}
            style={{ width, height }}
            contentFit="cover"
          />
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
          >
            <View className="w-16 h-16 rounded-full bg-white/90 items-center justify-center">
              <Ionicons name="play" size={30} color="#1F2937" />
            </View>
          </View>
          {item.duration != null && item.duration > 0 && (
            <View
              style={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                {Math.floor(item.duration / 60)}:
                {String(Math.floor(item.duration % 60)).padStart(2, '0')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleImagePress(item, index)}
          style={{ width, height }}
        >
          <Image
            source={{ uri: item.url }}
            style={{ width, height }}
            contentFit="cover"
          />
        </TouchableOpacity>
      )}
    </>
  );

  // Single item — no pagination dots or badge
  if (media.length === 1) {
    return (
      <>
        <View style={{ width, height }}>{renderMediaItem(media[0], 0)}</View>
        <VideoPlayerModal
          visible={videoUri !== null}
          uri={videoUri || ''}
          thumbnail={videoThumb}
          post={post}
          onClose={() => {
            setVideoUri(null);
            setVideoThumb(null);
          }}
          onLike={onLike}
          onComment={onComment}
        />
        <ImageViewerModal
          visible={imageViewerOpen}
          images={imageUrls}
          initialIndex={0}
          onClose={() => setImageViewerOpen(false)}
        />
      </>
    );
  }

  // Carousel with pagination
  const renderItem = ({ item, index }: { item: MediaItem; index: number }) => (
    <View style={{ width, height }}>{renderMediaItem(item, index)}</View>
  );

  return (
    <>
      <View style={{ width, height }}>
        <FlatList
          data={media}
          renderItem={renderItem}
          keyExtractor={(_, i) => `media-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
        />

        {/* Counter badge — positioned over the image */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 8,
            right: 10,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
            {activeIndex + 1}/{media.length}
          </Text>
        </View>
      </View>

      <VideoPlayerModal
        visible={videoUri !== null}
        uri={videoUri || ''}
        thumbnail={videoThumb}
        post={post}
        onClose={() => {
          setVideoUri(null);
          setVideoThumb(null);
        }}
        onLike={onLike}
        onComment={onComment}
      />
      <ImageViewerModal
        visible={imageViewerOpen}
        images={imageUrls}
        initialIndex={imageViewerIndex}
        onClose={() => setImageViewerOpen(false)}
      />
    </>
  );
};
