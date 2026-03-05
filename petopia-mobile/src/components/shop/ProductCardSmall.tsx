import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '../../store/slices/shopSlice';

interface ProductCardSmallProps {
  product: Product;
  onPress: (productId: string) => void;
}

const CARD_WIDTH = 150;
const IMAGE_HEIGHT = 150;

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  treats: 'Treats',
  toys: 'Toys',
  accessories: 'Accessories',
  grooming: 'Grooming',
  health: 'Health',
  clothing: 'Clothing',
  crates_carriers: 'Crates',
  aquarium: 'Aquarium',
  other: 'Other',
};

export const ProductCardSmall: React.FC<ProductCardSmallProps> = ({
  product,
  onPress,
}) => {
  const shopName =
    typeof product.shop === 'object' ? product.shop.shopName : '';
  const hasDiscount =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(
        ((product.compareAtPrice! - product.price) / product.compareAtPrice!) *
          100,
      )
    : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(product._id)}
      style={{
        width: CARD_WIDTH,
        marginRight: 10,
        backgroundColor: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F3F4F6',
      }}
    >
      {/* Image */}
      <View style={{ width: CARD_WIDTH, height: IMAGE_HEIGHT }}>
        {product.images?.[0] ? (
          <Image
            source={{ uri: product.images[0] }}
            style={{ width: CARD_WIDTH, height: IMAGE_HEIGHT }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="cube-outline" size={32} color="#D1D5DB" />
          </View>
        )}

        {/* Sale badge */}
        {hasDiscount && (
          <View
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              backgroundColor: '#EF4444',
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}
            >
              -{discountPct}%
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ padding: 8 }}>
        <Text
          style={{ fontSize: 13, fontWeight: '600', color: '#1F2937' }}
          numberOfLines={2}
        >
          {product.title}
        </Text>

        {shopName ? (
          <Text
            style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}
            numberOfLines={1}
          >
            {shopName}
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 4,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#00897B' }}>
            P${product.price.toFixed(2)}
          </Text>
          {hasDiscount && (
            <Text
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                textDecorationLine: 'line-through',
              }}
            >
              P${product.compareAtPrice!.toFixed(2)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export { CARD_WIDTH };
