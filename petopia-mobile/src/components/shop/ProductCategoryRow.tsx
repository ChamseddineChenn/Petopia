import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductCardSmall, CARD_WIDTH } from './ProductCardSmall';
import type { Product } from '../../store/slices/shopSlice';

interface ProductCategoryRowProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  products: Product[];
  loading?: boolean;
  onProductPress: (productId: string) => void;
  onViewAll: () => void;
}

export const ProductCategoryRow: React.FC<ProductCategoryRowProps> = ({
  title,
  icon,
  products,
  loading = false,
  onProductPress,
  onViewAll,
}) => {
  const renderItem = ({ item }: { item: Product }) => (
    <ProductCardSmall product={item} onPress={onProductPress} />
  );

  const ViewAllButton = () => (
    <TouchableOpacity
      onPress={onViewAll}
      activeOpacity={0.7}
      style={{
        width: CARD_WIDTH,
        marginRight: 10,
        backgroundColor: '#F0FDFA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0F2F1',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#E0F2F1',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Ionicons name="arrow-forward" size={22} color="#00897B" />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#00897B' }}>
        View All
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ marginBottom: 20 }}>
      {/* Section header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon && <Ionicons name={icon} size={18} color="#00897B" />}
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#1F2937' }}>
            {title}
          </Text>
        </View>
        {products.length > 0 && (
          <TouchableOpacity
            onPress={onViewAll}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#00897B' }}>
              See All
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#00897B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Product list */}
      {loading ? (
        <View
          style={{
            height: 200,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color="#4DB6AC" />
        </View>
      ) : products.length === 0 ? (
        <View
          style={{
            height: 100,
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: 16,
            backgroundColor: '#F9FAFB',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#F3F4F6',
          }}
        >
          <Ionicons name="cube-outline" size={24} color="#D1D5DB" />
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6 }}>
            No products yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={products.slice(0, 10)}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 6 }}
          ListFooterComponent={products.length >= 10 ? <ViewAllButton /> : null}
        />
      )}
    </View>
  );
};
