import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StatusBar,
  ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface ImageViewerModalProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  images,
  initialIndex = 0,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Reset index when modal opens with a new initialIndex
  const onShow = useCallback(() => {
    setCurrentIndex(initialIndex);
    if (initialIndex > 0) {
      // Use a brief delay so the FlatList is mounted before scrolling
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 50);
    }
  }, [initialIndex]);

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <View
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000',
        }}
      >
        <Image
          source={{ uri: item }}
          style={{ width: SCREEN_W, height: SCREEN_H }}
          contentFit="contain"
          transition={200}
        />
      </View>
    ),
    [],
  );

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
      onShow={onShow}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Image carousel */}
        <FlatList
          ref={flatListRef}
          data={images}
          renderItem={renderItem}
          keyExtractor={(_, i) => `viewer-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: SCREEN_W,
            offset: SCREEN_W * index,
            index,
          })}
          initialScrollIndex={initialIndex}
          bounces={false}
        />

        {/* Close button */}
        <TouchableOpacity
          onPress={handleClose}
          activeOpacity={0.7}
          style={{
            position: 'absolute',
            top: insets.top + 12,
            left: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Counter badge */}
        {images.length > 1 && (
          <View
            style={{
              position: 'absolute',
              top: insets.top + 16,
              right: 16,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 14,
                fontWeight: '600',
              }}
            >
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        {/* Bottom pagination dots */}
        {images.length > 1 && (
          <View
            style={{
              position: 'absolute',
              bottom: insets.bottom + 32,
              left: 0,
              right: 0,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {images.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === currentIndex ? 8 : 6,
                  height: i === currentIndex ? 8 : 6,
                  borderRadius: i === currentIndex ? 4 : 3,
                  backgroundColor:
                    i === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                  marginHorizontal: 4,
                }}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
};
