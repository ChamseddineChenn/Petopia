import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchProductDetail,
  clearActiveProduct,
} from '../../store/slices/shopSlice';
import { addToCart } from '../../store/slices/cartSlice';
import { useAlert } from '../ui/CustomAlert';

const { width: SCREEN_W } = Dimensions.get('window');

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  treats: 'Treats',
  toys: 'Toys',
  accessories: 'Accessories',
  grooming: 'Grooming',
  health: 'Health',
  clothing: 'Clothing',
  crates_carriers: 'Crates & Carriers',
  aquarium: 'Aquarium',
  other: 'Other',
};

const PET_TYPE_LABELS: Record<string, string> = {
  all: 'All Pets',
  dog: 'Dogs',
  cat: 'Cats',
  bird: 'Birds',
  fish: 'Fish',
  small_animal: 'Small Animals',
  reptile: 'Reptiles',
};

export const ProductDetailScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { productId } = useLocalSearchParams<{ productId: string }>();

  const { activeProduct, activeProductLoading } = useSelector(
    (state: RootState) => state.shop,
  );
  const { adding } = useSelector((state: RootState) => state.cart);
  const cartItemCount = useSelector(
    (state: RootState) => state.cart.cart.itemCount,
  );

  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (productId) dispatch(fetchProductDetail(productId));
    return () => {
      dispatch(clearActiveProduct());
    };
  }, [dispatch, productId]);

  const handleAddToCart = async () => {
    if (!activeProduct) return;
    try {
      await dispatch(
        addToCart({ productId: activeProduct._id, quantity: qty }),
      ).unwrap();
      showAlert({
        title: 'Added!',
        message: `${activeProduct.title} added to cart.`,
        variant: 'success',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to add to cart',
        variant: 'error',
      });
    }
  };

  if (activeProductLoading || !activeProduct) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#FAFAF7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#4DB6AC" />
      </SafeAreaView>
    );
  }

  const p = activeProduct;
  const images = p.images && p.images.length > 0 ? p.images : [];
  const shopObj = typeof p.shop === 'object' ? p.shop : null;
  const inStock = p.quantity > 0;
  const discount =
    p.compareAtPrice && p.compareAtPrice > p.price
      ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)
      : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF7' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            marginLeft: 12,
            fontSize: 18,
            fontWeight: '700',
            color: '#1F2937',
          }}
          numberOfLines={1}
        >
          Product Details
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/cart' as any)}
          activeOpacity={0.7}
        >
          <View>
            <Ionicons name="cart-outline" size={24} color="#1F2937" />
            {cartItemCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -8,
                  backgroundColor: '#EF4444',
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text
                  style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}
                >
                  {cartItemCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Image carousel */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setImgIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
              }
            >
              {images.map((uri, idx) => (
                <Image
                  key={idx}
                  source={{ uri }}
                  style={{ width: SCREEN_W, height: SCREEN_W * 0.85 }}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  marginTop: 8,
                }}
              >
                {images.map((_, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: imgIdx === idx ? 20 : 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: imgIdx === idx ? '#4DB6AC' : '#D1D5DB',
                      marginHorizontal: 3,
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View
            style={{
              width: '100%',
              height: 260,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
          </View>
        )}

        <View style={{ padding: 16 }}>
          {/* Title + Price */}
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F2937' }}>
            {p.title}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#4DB6AC' }}>
              P${p.price.toFixed(2)}
            </Text>
            {p.compareAtPrice ? (
              <Text
                style={{
                  fontSize: 16,
                  color: '#9CA3AF',
                  marginLeft: 10,
                  textDecorationLine: 'line-through',
                }}
              >
                P${p.compareAtPrice.toFixed(2)}
              </Text>
            ) : null}
            {discount > 0 && (
              <View
                style={{
                  marginLeft: 10,
                  backgroundColor: '#FEF2F2',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: '600', color: '#EF4444' }}
                >
                  -{discount}%
                </Text>
              </View>
            )}
          </View>

          {/* Badges */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 12,
            }}
          >
            <Badge
              icon="pricetag-outline"
              label={CATEGORY_LABELS[p.category] || p.category}
            />
            <Badge
              icon="paw-outline"
              label={PET_TYPE_LABELS[p.petType] || p.petType}
            />
            <Badge
              icon={
                inStock ? 'checkmark-circle-outline' : 'close-circle-outline'
              }
              label={inStock ? `In Stock (${p.quantity})` : 'Out of Stock'}
              color={inStock ? '#059669' : '#EF4444'}
            />
          </View>

          {/* Description */}
          {p.description ? (
            <View style={{ marginTop: 16 }}>
              <Text
                style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}
              >
                Description
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#374151',
                  lineHeight: 22,
                  marginTop: 6,
                }}
              >
                {p.description}
              </Text>
            </View>
          ) : null}

          {/* Attributes */}
          {p.attributes && Object.entries(p.attributes).some(([, v]) => v) && (
            <View style={{ marginTop: 16 }}>
              <Text
                style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}
              >
                Details
              </Text>
              <View
                style={{
                  marginTop: 8,
                  backgroundColor: '#fff',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  padding: 12,
                }}
              >
                {Object.entries(p.attributes)
                  .filter(([, v]) => v)
                  .map(([key, val]) => (
                    <View
                      key={key}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: 6,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F3F4F6',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color: '#6B7280',
                          textTransform: 'capitalize',
                        }}
                      >
                        {key}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '500',
                          color: '#1F2937',
                        }}
                      >
                        {val}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Shop link */}
          {shopObj && (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/pet-shop-detail',
                  params: { shopId: shopObj._id },
                })
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 20,
                padding: 12,
                backgroundColor: '#fff',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              {shopObj.logo ? (
                <Image
                  source={{ uri: shopObj.logo }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: '#E0F2F1',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="storefront" size={18} color="#4DB6AC" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}
                >
                  {shopObj.shopName}
                </Text>
                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                  Visit shop
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar — Add to cart */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Quantity stepper */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            onPress={() => setQty((q) => Math.max(1, q - 1))}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="remove" size={18} color="#4B5563" />
          </TouchableOpacity>
          <Text
            style={{
              width: 30,
              textAlign: 'center',
              fontSize: 15,
              fontWeight: '600',
              color: '#1F2937',
            }}
          >
            {qty}
          </Text>
          <TouchableOpacity
            onPress={() => setQty((q) => Math.min(p.quantity, q + 1))}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={18} color="#4B5563" />
          </TouchableOpacity>
        </View>

        {/* Add button */}
        <TouchableOpacity
          onPress={handleAddToCart}
          disabled={adding || !inStock}
          activeOpacity={0.8}
          style={{
            flex: 1,
            marginLeft: 12,
            backgroundColor: inStock ? '#4DB6AC' : '#D1D5DB',
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
          }}
        >
          {adding ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="cart-outline" size={20} color="#fff" />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: '#fff',
                  marginLeft: 8,
                }}
              >
                {inStock
                  ? `Add to Cart — P$${(p.price * qty).toFixed(2)}`
                  : 'Out of Stock'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ── Badge helper ──
const Badge: React.FC<{
  icon: string;
  label: string;
  color?: string;
}> = ({ icon, label, color = '#4B5563' }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F3F4F6',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
    }}
  >
    <Ionicons name={icon as any} size={14} color={color} />
    <Text style={{ fontSize: 12, color, marginLeft: 4, fontWeight: '500' }}>
      {label}
    </Text>
  </View>
);
