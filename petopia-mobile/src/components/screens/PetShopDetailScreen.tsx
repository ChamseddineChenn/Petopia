import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchShopDetail,
  fetchShopProducts,
  clearActiveShop,
  Product,
} from '../../store/slices/shopSlice';
import { startConversation } from '../../store/slices/chatSlice';
import { useAlert } from '../ui/CustomAlert';

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

export const PetShopDetailScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();

  const {
    activeShop,
    activeShopLoading,
    shopProducts,
    shopProductsLoading,
    shopProductsPagination,
  } = useSelector((state: RootState) => state.shop);
  const cartItemCount = useSelector(
    (state: RootState) => state.cart.cart.itemCount,
  );
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const loadingMore = useRef(false);

  const isOwner =
    currentUser &&
    activeShop &&
    (typeof activeShop.owner === 'object'
      ? activeShop.owner._id === currentUser._id
      : activeShop.owner === currentUser._id);

  const handleCall = () => {
    if (!activeShop?.phone) {
      showAlert({
        title: 'No phone number',
        message: 'This shop has not listed a phone number.',
        variant: 'warning',
      });
      return;
    }
    Linking.openURL(`tel:${activeShop.phone}`);
  };

  const handleMessage = async () => {
    if (!activeShop) return;
    const ownerId =
      typeof activeShop.owner === 'object'
        ? activeShop.owner._id
        : activeShop.owner;
    try {
      const result = await dispatch(
        startConversation({
          recipientId: ownerId,
          shopId: activeShop._id,
          shopType: 'pet_shop',
        }),
      ).unwrap();
      router.push({
        pathname: '/chat',
        params: {
          conversationId: result._id,
          recipientId: ownerId,
          recipientName: activeShop.shopName,
          recipientImage:
            typeof activeShop.owner === 'object'
              ? activeShop.owner.profileImage || ''
              : '',
        },
      });
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Could not start conversation',
        variant: 'error',
      });
    }
  };

  useEffect(() => {
    if (shopId) {
      dispatch(fetchShopDetail(shopId));
      dispatch(fetchShopProducts({ shopId, page: 1 }));
    }
    return () => {
      dispatch(clearActiveShop());
    };
  }, [dispatch, shopId]);

  const handleFilterCategory = (cat: string | null) => {
    setSelectedCat(cat);
    if (shopId)
      dispatch(
        fetchShopProducts({
          shopId,
          page: 1,
          category: cat || undefined,
        }),
      );
  };

  const handleLoadMore = useCallback(() => {
    if (
      !shopId ||
      loadingMore.current ||
      shopProductsLoading ||
      shopProductsPagination.page >= shopProductsPagination.pages
    )
      return;
    loadingMore.current = true;
    dispatch(
      fetchShopProducts({
        shopId,
        page: shopProductsPagination.page + 1,
        category: selectedCat || undefined,
      }),
    ).finally(() => {
      loadingMore.current = false;
    });
  }, [
    dispatch,
    shopId,
    shopProductsLoading,
    shopProductsPagination,
    selectedCat,
  ]);

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: '/product-detail',
          params: { productId: item._id },
        })
      }
      activeOpacity={0.7}
      style={{
        width: '48%',
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
      }}
    >
      {item.images?.[0] ? (
        <Image
          source={{ uri: item.images[0] }}
          style={{ width: '100%', height: 140 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: '100%',
            height: 140,
            backgroundColor: '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="cube-outline" size={32} color="#D1D5DB" />
        </View>
      )}
      <View style={{ padding: 10 }}>
        <Text
          style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
          {CATEGORY_LABELS[item.category] || item.category}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 6,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#4DB6AC' }}>
            P${item.price.toFixed(2)}
          </Text>
          {item.compareAtPrice ? (
            <Text
              style={{
                fontSize: 12,
                color: '#9CA3AF',
                marginLeft: 6,
                textDecorationLine: 'line-through',
              }}
            >
              P${item.compareAtPrice.toFixed(2)}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  const ShopHeader = () => {
    if (!activeShop) return null;
    const ownerName =
      typeof activeShop.owner === 'object' ? activeShop.owner.name : '';
    return (
      <View style={{ marginBottom: 12 }}>
        {/* Shop info card */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {activeShop.logo ? (
              <Image
                source={{ uri: activeShop.logo }}
                style={{ width: 64, height: 64, borderRadius: 32 }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#E0F2F1',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="storefront" size={28} color="#4DB6AC" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text
                style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}
              >
                {activeShop.shopName}
              </Text>
              {ownerName ? (
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                  by {ownerName}
                </Text>
              ) : null}
              {activeShop.address?.city ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  <Ionicons name="location-outline" size={13} color="#9CA3AF" />
                  <Text
                    style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 2 }}
                  >
                    {[activeShop.address.city, activeShop.address.country]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          {activeShop.description ? (
            <Text
              style={{
                fontSize: 14,
                color: '#374151',
                marginTop: 12,
                lineHeight: 20,
              }}
            >
              {activeShop.description}
            </Text>
          ) : null}
          {/* Contact info */}
          <View
            style={{
              flexDirection: 'row',
              gap: 16,
              marginTop: 12,
              flexWrap: 'wrap',
            }}
          >
            {activeShop.phone ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="call-outline" size={14} color="#6B7280" />
                <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 4 }}>
                  {activeShop.phone}
                </Text>
              </View>
            ) : null}
            {activeShop.email ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="mail-outline" size={14} color="#6B7280" />
                <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 4 }}>
                  {activeShop.email}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Action buttons — Call & Message */}
          {!isOwner && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={handleCall}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#E0F2F1',
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
              >
                <Ionicons name="call" size={18} color="#00897B" />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#00897B',
                    marginLeft: 6,
                  }}
                >
                  Call
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleMessage}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#E0F2F1',
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
              >
                <Ionicons name="chatbubble" size={18} color="#00897B" />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#00897B',
                    marginLeft: 6,
                  }}
                >
                  Message
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Category filter */}
        {activeShop.categories && activeShop.categories.length > 0 && (
          <FlatList
            data={[
              { value: null, label: 'All' },
              ...activeShop.categories.map((c) => ({
                value: c,
                label: CATEGORY_LABELS[c] || c,
              })),
            ]}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.value || 'all'}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleFilterCategory(item.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 18,
                  marginRight: 8,
                  backgroundColor:
                    selectedCat === item.value ? '#4DB6AC' : '#fff',
                  borderWidth: 1,
                  borderColor:
                    selectedCat === item.value ? '#4DB6AC' : '#E5E7EB',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: selectedCat === item.value ? '#fff' : '#4B5563',
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            style={{ marginBottom: 12 }}
          />
        )}

        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: 8,
          }}
        >
          Products ({shopProductsPagination.total})
        </Text>
      </View>
    );
  };

  if (activeShopLoading && !activeShop) {
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
          {activeShop?.shopName || 'Pet Shop'}
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
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: '#fff',
                  }}
                >
                  {cartItemCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={shopProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={{
          justifyContent: 'space-between',
          paddingHorizontal: 16,
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        ListHeaderComponent={<ShopHeader />}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          !shopProductsLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
              <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 12 }}>
                No products in this shop yet
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          shopProductsLoading ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color="#4DB6AC" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};
