import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { RootState, AppDispatch } from '../../store/store';
import { fetchShops, PetShop, Product } from '../../store/slices/shopSlice';
import { ProductCategoryRow } from '../shop/ProductCategoryRow';

// ────────────────────────────────────────
// Types & section configs
// ────────────────────────────────────────
type TabKey = 'products' | 'shops';

interface SectionConfig {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  params: Record<string, string>;
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'trending',
    title: 'Trending',
    icon: 'flame-outline',
    params: { sort: 'popular', limit: '10' },
  },
  {
    key: 'onSale',
    title: 'On Sale',
    icon: 'pricetag-outline',
    params: { onSale: 'true', limit: '10' },
  },
  {
    key: 'newlyAdded',
    title: 'Newly Added',
    icon: 'sparkles-outline',
    params: { limit: '10' },
  },
  {
    key: 'food',
    title: 'Food & Treats',
    icon: 'nutrition-outline',
    params: { category: 'food', limit: '10' },
  },
  {
    key: 'toys',
    title: 'Toys',
    icon: 'game-controller-outline',
    params: { category: 'toys', limit: '10' },
  },
  {
    key: 'accessories',
    title: 'Accessories',
    icon: 'ribbon-outline',
    params: { category: 'accessories', limit: '10' },
  },
  {
    key: 'grooming',
    title: 'Grooming',
    icon: 'cut-outline',
    params: { category: 'grooming', limit: '10' },
  },
  {
    key: 'health',
    title: 'Health & Wellness',
    icon: 'medkit-outline',
    params: { category: 'health', limit: '10' },
  },
];

// ────────────────────────────────────────
// Component
// ────────────────────────────────────────
export const PetShopListScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  // ── Redux state ──
  const { shops, shopsLoading, shopsPagination } = useSelector(
    (state: RootState) => state.shop,
  );
  const token = useSelector((state: RootState) => state.auth.token);
  const cartItemCount = useSelector(
    (state: RootState) => state.cart.cart.itemCount,
  );

  // ── Local state ──
  const [activeTab, setActiveTab] = useState<TabKey>('products');

  // Shops tab
  const [shopSearch, setShopSearch] = useState('');
  const shopLoadingMore = useRef(false);

  // Products tab — section data
  const [sectionData, setSectionData] = useState<
    Record<string, { products: Product[]; loading: boolean }>
  >(() => {
    const init: Record<string, { products: Product[]; loading: boolean }> = {};
    SECTIONS.forEach((s) => {
      init[s.key] = { products: [], loading: true };
    });
    return init;
  });
  const [refreshing, setRefreshing] = useState(false);

  // Products search
  const [productSearch, setProductSearch] = useState('');

  // Products filters
  const [selectedPetType, setSelectedPetType] = useState('');
  const [selectedSort, setSelectedSort] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    selectedPetType !== '' ||
    selectedSort !== '' ||
    minPrice !== '' ||
    maxPrice !== '';

  // ── Fetch a single section ──
  const fetchSection = useCallback(
    async (
      section: SectionConfig,
      filterOverrides?: {
        petType?: string;
        sort?: string;
        minPrice?: string;
        maxPrice?: string;
      },
    ) => {
      if (!token) return;
      try {
        setSectionData((prev) => ({
          ...prev,
          [section.key]: { ...prev[section.key], loading: true },
        }));
        const qs = new URLSearchParams(section.params);

        // Apply global filters
        const pt = filterOverrides?.petType ?? selectedPetType;
        const srt = filterOverrides?.sort ?? selectedSort;
        const mnp = filterOverrides?.minPrice ?? minPrice;
        const mxp = filterOverrides?.maxPrice ?? maxPrice;

        if (pt) qs.set('petType', pt);
        // Only override sort if the section doesn't have its own sort
        if (srt && !section.params.sort) qs.set('sort', srt);
        if (mnp) qs.set('minPrice', mnp);
        if (mxp) qs.set('maxPrice', mxp);

        const res = await axios.get(
          `${API_BASE_URL}/shops/products/browse/all?${qs}`,
          { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 },
        );
        setSectionData((prev) => ({
          ...prev,
          [section.key]: {
            products: res.data.products || [],
            loading: false,
          },
        }));
      } catch {
        setSectionData((prev) => ({
          ...prev,
          [section.key]: { ...prev[section.key], loading: false },
        }));
      }
    },
    [token, selectedPetType, selectedSort, minPrice, maxPrice],
  );

  // ── Load all sections ──
  const loadAllSections = useCallback(
    (filterOverrides?: {
      petType?: string;
      sort?: string;
      minPrice?: string;
      maxPrice?: string;
    }) => {
      SECTIONS.forEach((s) => fetchSection(s, filterOverrides));
    },
    [fetchSection],
  );

  // ── Initial load ──
  useEffect(() => {
    dispatch(fetchShops({ page: 1 }));
    loadAllSections();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pull to refresh ──
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllSections();
    setTimeout(() => setRefreshing(false), 1200);
  }, [loadAllSections]);

  // ── Navigate to product ──
  const handleProductPress = useCallback(
    (productId: string) => {
      router.push({
        pathname: '/product-detail',
        params: { productId },
      } as any);
    },
    [router],
  );

  // ── Navigate to "View All" for a section ──
  const handleViewAll = useCallback(
    (section: SectionConfig) => {
      const navParams: Record<string, string> = {
        title: section.title,
        ...section.params,
      };
      if (selectedPetType) navParams.petType = selectedPetType;
      if (minPrice) navParams.minPrice = minPrice;
      if (maxPrice) navParams.maxPrice = maxPrice;
      router.push({
        pathname: '/view-all-products',
        params: navParams,
      } as any);
    },
    [router, selectedPetType, minPrice, maxPrice],
  );

  // ── Navigate to search results ──
  const handleProductSearch = useCallback(() => {
    if (!productSearch.trim()) return;
    const navParams: Record<string, string> = {
      title: `"${productSearch.trim()}"`,
      search: productSearch.trim(),
    };
    if (selectedPetType) navParams.petType = selectedPetType;
    if (selectedSort) navParams.sort = selectedSort;
    if (minPrice) navParams.minPrice = minPrice;
    if (maxPrice) navParams.maxPrice = maxPrice;
    router.push({
      pathname: '/view-all-products',
      params: navParams,
    } as any);
  }, [
    router,
    productSearch,
    selectedPetType,
    selectedSort,
    minPrice,
    maxPrice,
  ]);

  // ── Navigate to browse all (with full filters) ──
  const handleBrowseAll = useCallback(() => {
    const navParams: Record<string, string> = { title: 'All Products' };
    if (selectedPetType) navParams.petType = selectedPetType;
    if (selectedSort) navParams.sort = selectedSort;
    if (minPrice) navParams.minPrice = minPrice;
    if (maxPrice) navParams.maxPrice = maxPrice;
    router.push({
      pathname: '/view-all-products',
      params: navParams,
    } as any);
  }, [router, selectedPetType, selectedSort, minPrice, maxPrice]);

  // ── Filter handlers ──
  const handlePetTypeChange = (pt: string) => {
    setSelectedPetType(pt);
    loadAllSections({ petType: pt });
  };

  const handleSortChange = (sort: string) => {
    setSelectedSort(sort);
    loadAllSections({ sort });
  };

  const handleApplyPrice = () => {
    loadAllSections();
  };

  const handleClearFilters = () => {
    setSelectedPetType('');
    setSelectedSort('');
    setMinPrice('');
    setMaxPrice('');
    loadAllSections({ petType: '', sort: '', minPrice: '', maxPrice: '' });
  };

  // ── Shops: search + load more ──
  const handleShopSearch = useCallback(() => {
    dispatch(fetchShops({ page: 1, search: shopSearch.trim() || undefined }));
  }, [dispatch, shopSearch]);

  const handleShopLoadMore = useCallback(() => {
    if (
      shopLoadingMore.current ||
      shopsLoading ||
      shopsPagination.page >= shopsPagination.pages
    )
      return;
    shopLoadingMore.current = true;
    dispatch(
      fetchShops({
        page: shopsPagination.page + 1,
        search: shopSearch.trim() || undefined,
      }),
    ).finally(() => {
      shopLoadingMore.current = false;
    });
  }, [dispatch, shopsLoading, shopsPagination, shopSearch]);

  // ── Renderers ──
  const renderShop = ({ item }: { item: PetShop }) => {
    const ownerName = typeof item.owner === 'object' ? item.owner.name : '';
    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/pet-shop-detail',
            params: { shopId: item._id },
          })
        }
        activeOpacity={0.7}
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          overflow: 'hidden',
        }}
      >
        <View style={{ flexDirection: 'row', padding: 14 }}>
          {item.logo ? (
            <Image
              source={{ uri: item.logo }}
              style={{ width: 60, height: 60, borderRadius: 30 }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#E0F2F1',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="storefront-outline" size={26} color="#4DB6AC" />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
            <Text
              style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}
              numberOfLines={1}
            >
              {item.shopName}
            </Text>
            {ownerName ? (
              <Text
                style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}
                numberOfLines={1}
              >
                by {ownerName}
              </Text>
            ) : null}
            {item.address?.city ? (
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
                  numberOfLines={1}
                >
                  {[item.address.city, item.address.country]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>
              {item.productsCount || 0} items
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#D1D5DB"
              style={{ alignSelf: 'flex-end', marginTop: 4 }}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Shops tab search bar ──
  const ShopsSearchBar = () => (
    <View style={{ marginBottom: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#fff',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          paddingHorizontal: 12,
          alignItems: 'center',
        }}
      >
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          value={shopSearch}
          onChangeText={setShopSearch}
          onSubmitEditing={handleShopSearch}
          placeholder="Search shops..."
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          style={{
            flex: 1,
            paddingVertical: 10,
            marginLeft: 8,
            fontSize: 15,
            color: '#1F2937',
          }}
        />
        {shopSearch.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setShopSearch('');
              dispatch(fetchShops({ page: 1 }));
            }}
          >
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ── Check if all sections are still loading (initial) ──
  const allSectionsLoading = SECTIONS.every((s) => sectionData[s.key]?.loading);

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
        >
          Pet Shop
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

      {/* Tab bar */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        {(['products', 'shops'] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab ? '#4DB6AC' : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: activeTab === tab ? '#4DB6AC' : '#9CA3AF',
              }}
            >
              {tab === 'products' ? 'Products' : 'Shops'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Products tab */}
      {activeTab === 'products' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4DB6AC"
              colors={['#4DB6AC']}
            />
          }
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          {/* Search bar + Filters */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 6,
            }}
          >
            {/* Search */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#fff',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                paddingHorizontal: 12,
                alignItems: 'center',
              }}
            >
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              <TextInput
                value={productSearch}
                onChangeText={setProductSearch}
                onSubmitEditing={handleProductSearch}
                placeholder="Search products..."
                placeholderTextColor="#9CA3AF"
                returnKeyType="search"
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  marginLeft: 8,
                  fontSize: 15,
                  color: '#1F2937',
                }}
              />
              {productSearch.length > 0 && (
                <TouchableOpacity onPress={() => setProductSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter toggle row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 10,
                gap: 8,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowFilters(!showFilters)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: showFilters ? '#4DB6AC' : '#fff',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: showFilters ? '#4DB6AC' : '#E5E7EB',
                }}
              >
                <Ionicons
                  name="options-outline"
                  size={15}
                  color={showFilters ? '#fff' : '#4B5563'}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: showFilters ? '#fff' : '#4B5563',
                    marginLeft: 4,
                  }}
                >
                  Filters
                </Text>
              </TouchableOpacity>

              {hasActiveFilters && (
                <TouchableOpacity onPress={handleClearFilters}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: '#EF4444',
                      fontWeight: '500',
                    }}
                  >
                    Clear all
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleBrowseAll}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginLeft: 'auto',
                  backgroundColor: '#F0FDFA',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: '#E0F2F1',
                }}
              >
                <Ionicons name="grid-outline" size={14} color="#00897B" />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: '#00897B',
                    marginLeft: 4,
                  }}
                >
                  Browse All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Expanded filters */}
            {showFilters && (
              <View style={{ marginTop: 12 }}>
                {/* Pet Type */}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: '#6B7280',
                    marginBottom: 6,
                  }}
                >
                  Animal Type
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 12 }}
                >
                  {[
                    { value: '', label: 'All' },
                    { value: 'dog', label: '🐕 Dog' },
                    { value: 'cat', label: '🐈 Cat' },
                    { value: 'bird', label: '🐦 Bird' },
                    { value: 'fish', label: '🐟 Fish' },
                    { value: 'small_animal', label: '🐹 Small Animal' },
                    { value: 'reptile', label: '🦎 Reptile' },
                  ].map((pt) => (
                    <TouchableOpacity
                      key={pt.value || 'all-pet'}
                      onPress={() => handlePetTypeChange(pt.value)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        marginRight: 8,
                        backgroundColor:
                          selectedPetType === pt.value ? '#4DB6AC' : '#fff',
                        borderWidth: 1,
                        borderColor:
                          selectedPetType === pt.value ? '#4DB6AC' : '#E5E7EB',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '500',
                          color:
                            selectedPetType === pt.value ? '#fff' : '#4B5563',
                        }}
                      >
                        {pt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Sort */}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: '#6B7280',
                    marginBottom: 6,
                  }}
                >
                  Sort By
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 12 }}
                >
                  {[
                    { value: '', label: 'Default' },
                    { value: 'price_asc', label: 'Price: Low → High' },
                    { value: 'price_desc', label: 'Price: High → Low' },
                    { value: 'popular', label: 'Most Popular' },
                  ].map((s) => (
                    <TouchableOpacity
                      key={s.value || 'default-sort'}
                      onPress={() => handleSortChange(s.value)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        marginRight: 8,
                        backgroundColor:
                          selectedSort === s.value ? '#4DB6AC' : '#fff',
                        borderWidth: 1,
                        borderColor:
                          selectedSort === s.value ? '#4DB6AC' : '#E5E7EB',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '500',
                          color: selectedSort === s.value ? '#fff' : '#4B5563',
                        }}
                      >
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Price Range */}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: '#6B7280',
                    marginBottom: 6,
                  }}
                >
                  Price Range (P$)
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#fff',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Min</Text>
                    <TextInput
                      value={minPrice}
                      onChangeText={setMinPrice}
                      onSubmitEditing={handleApplyPrice}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#D1D5DB"
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        marginLeft: 6,
                        fontSize: 14,
                        color: '#1F2937',
                      }}
                    />
                  </View>
                  <Text style={{ fontSize: 13, color: '#9CA3AF' }}>–</Text>
                  <View
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#fff',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Max</Text>
                    <TextInput
                      value={maxPrice}
                      onChangeText={setMaxPrice}
                      onSubmitEditing={handleApplyPrice}
                      keyboardType="numeric"
                      placeholder="∞"
                      placeholderTextColor="#D1D5DB"
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        marginLeft: 6,
                        fontSize: 14,
                        color: '#1F2937',
                      }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleApplyPrice}
                    style={{
                      backgroundColor: '#4DB6AC',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: '#fff',
                      }}
                    >
                      Apply
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Initial full-page loader */}
          {allSectionsLoading && (
            <View
              style={{
                paddingTop: 60,
                alignItems: 'center',
              }}
            >
              <ActivityIndicator size="large" color="#4DB6AC" />
              <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 12 }}>
                Loading products...
              </Text>
            </View>
          )}

          {/* Category rows */}
          {!allSectionsLoading &&
            SECTIONS.map((section) => (
              <ProductCategoryRow
                key={section.key}
                title={section.title}
                icon={section.icon}
                products={sectionData[section.key]?.products || []}
                loading={sectionData[section.key]?.loading || false}
                onProductPress={handleProductPress}
                onViewAll={() => handleViewAll(section)}
              />
            ))}

          {/* Empty state when no sections have data */}
          {!allSectionsLoading &&
            SECTIONS.every(
              (s) => (sectionData[s.key]?.products.length || 0) === 0,
            ) && (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
                <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 12 }}>
                  No products available yet
                </Text>
              </View>
            )}
        </ScrollView>
      )}

      {/* Shops tab */}
      {activeTab === 'shops' && (
        <FlatList
          data={shops}
          renderItem={renderShop}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          ListHeaderComponent={<ShopsSearchBar />}
          showsVerticalScrollIndicator={false}
          onEndReached={handleShopLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            !shopsLoading ? (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Ionicons name="storefront-outline" size={48} color="#D1D5DB" />
                <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 12 }}>
                  No pet shops found
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            shopsLoading ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator color="#4DB6AC" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};
