import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { RootState } from '../../store/store';
import type { Product } from '../../store/slices/shopSlice';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 10;
const PADDING = 16;
const NUM_COLUMNS = 2;
const CARD_WIDTH =
  (SCREEN_WIDTH - PADDING * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const ITEMS_PER_PAGE = 20;

const CATEGORY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'food', label: 'Food' },
  { value: 'treats', label: 'Treats' },
  { value: 'toys', label: 'Toys' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'health', label: 'Health' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'crates_carriers', label: 'Crates & Carriers' },
  { value: 'aquarium', label: 'Aquarium' },
  { value: 'other', label: 'Other' },
];

const PET_TYPE_OPTIONS = [
  { value: '', label: 'All Pets' },
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'bird', label: 'Bird' },
  { value: 'fish', label: 'Fish' },
  { value: 'small_animal', label: 'Small Animal' },
  { value: 'reptile', label: 'Reptile' },
];

const SORT_OPTIONS = [
  { value: '', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'popular', label: 'Most Popular' },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.filter((c) => c.value).map((c) => [c.value, c.label]),
);

export const ViewAllProductsScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title?: string;
    sort?: string;
    category?: string;
    petType?: string;
    onSale?: string;
    search?: string;
    limit?: string;
    minPrice?: string;
    maxPrice?: string;
  }>();

  const token = useSelector((state: RootState) => state.auth.token);
  const cartItemCount = useSelector(
    (state: RootState) => state.cart.cart.itemCount,
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // ── Filter state (initialized from route params) ──
  const [searchText, setSearchText] = useState(params.search || '');
  const [selectedCategory, setSelectedCategory] = useState(
    params.category || '',
  );
  const [selectedPetType, setSelectedPetType] = useState(params.petType || '');
  const [selectedSort, setSelectedSort] = useState(params.sort || '');
  const [minPrice, setMinPrice] = useState(params.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(params.maxPrice || '');
  const [showFilters, setShowFilters] = useState(false);
  const isOnSale = params.onSale === 'true';

  const hasActiveFilters =
    selectedCategory !== (params.category || '') ||
    selectedPetType !== (params.petType || '') ||
    selectedSort !== (params.sort || '') ||
    searchText.trim() !== (params.search || '') ||
    minPrice !== (params.minPrice || '') ||
    maxPrice !== (params.maxPrice || '');

  const fetchProducts = useCallback(
    async (
      page: number,
      overrides?: {
        category?: string;
        petType?: string;
        sort?: string;
        search?: string;
        minPrice?: string;
        maxPrice?: string;
      },
    ) => {
      if (!token) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set('page', String(page));
        qs.set('limit', String(ITEMS_PER_PAGE));

        const cat = overrides?.category ?? selectedCategory;
        const pt = overrides?.petType ?? selectedPetType;
        const srt = overrides?.sort ?? selectedSort;
        const srch = overrides?.search ?? searchText;
        const mnp = overrides?.minPrice ?? minPrice;
        const mxp = overrides?.maxPrice ?? maxPrice;

        if (srt) qs.set('sort', srt);
        if (cat) qs.set('category', cat);
        if (pt) qs.set('petType', pt);
        if (isOnSale) qs.set('onSale', 'true');
        if (srch.trim()) qs.set('search', srch.trim());
        if (mnp) qs.set('minPrice', mnp);
        if (mxp) qs.set('maxPrice', mxp);

        const res = await axios.get(
          `${API_BASE_URL}/shops/products/browse/all?${qs}`,
          { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 },
        );

        setProducts(res.data.products || []);
        setCurrentPage(res.data.page || 1);
        setTotalPages(res.data.pages || 1);
        setTotalCount(res.data.total || 0);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [
      token,
      selectedCategory,
      selectedPetType,
      selectedSort,
      searchText,
      isOnSale,
      minPrice,
      maxPrice,
    ],
  );

  useEffect(() => {
    fetchProducts(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goToPage = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages || page === currentPage) return;
      fetchProducts(page);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    [fetchProducts, totalPages, currentPage],
  );

  // ── Filter handlers ──
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    fetchProducts(1, { category: cat });
  };

  const handlePetTypeChange = (pt: string) => {
    setSelectedPetType(pt);
    fetchProducts(1, { petType: pt });
  };

  const handleSortChange = (sort: string) => {
    setSelectedSort(sort);
    fetchProducts(1, { sort });
  };

  const handleSearch = () => {
    fetchProducts(1);
  };

  const handleApplyPrice = () => {
    fetchProducts(1);
  };

  const handleClearFilters = () => {
    setSelectedCategory(params.category || '');
    setSelectedPetType(params.petType || '');
    setSelectedSort(params.sort || '');
    setSearchText(params.search || '');
    setMinPrice(params.minPrice || '');
    setMaxPrice(params.maxPrice || '');
    fetchProducts(1, {
      category: params.category || '',
      petType: params.petType || '',
      sort: params.sort || '',
      search: params.search || '',
      minPrice: params.minPrice || '',
      maxPrice: params.maxPrice || '',
    });
  };

  // ── Pagination controls ──
  const PaginationBar = () => {
    if (totalPages <= 1) return null;

    // Build page numbers to display (max 5 around current page)
    const pages: number[] = [];
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);
    if (end - start < 4) {
      if (start === 1) end = Math.min(totalPages, start + 4);
      else start = Math.max(1, end - 4);
    }
    for (let i = start; i <= end; i++) pages.push(i);

    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 16,
          gap: 6,
        }}
      >
        {/* Prev */}
        <TouchableOpacity
          onPress={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: currentPage <= 1 ? '#F3F4F6' : '#fff',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={currentPage <= 1 ? '#D1D5DB' : '#4B5563'}
          />
        </TouchableOpacity>

        {/* Page numbers */}
        {pages.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => goToPage(p)}
            style={{
              minWidth: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: p === currentPage ? '#00897B' : '#fff',
              borderWidth: 1,
              borderColor: p === currentPage ? '#00897B' : '#E5E7EB',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: p === currentPage ? '#fff' : '#4B5563',
              }}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Next */}
        <TouchableOpacity
          onPress={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: currentPage >= totalPages ? '#F3F4F6' : '#fff',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={currentPage >= totalPages ? '#D1D5DB' : '#4B5563'}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // ── Product card ──
  const renderProduct = ({ item }: { item: Product }) => {
    const shopName = typeof item.shop === 'object' ? item.shop.shopName : '';
    const hasDiscount =
      item.compareAtPrice != null && item.compareAtPrice > item.price;
    const discountPct = hasDiscount
      ? Math.round(
          ((item.compareAtPrice! - item.price) / item.compareAtPrice!) * 100,
        )
      : 0;

    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/product-detail',
            params: { productId: item._id },
          } as any)
        }
        activeOpacity={0.7}
        style={{
          width: CARD_WIDTH,
          backgroundColor: '#fff',
          borderRadius: 12,
          marginBottom: CARD_GAP,
          borderWidth: 1,
          borderColor: '#F3F4F6',
          overflow: 'hidden',
        }}
      >
        <View style={{ width: '100%', height: CARD_WIDTH }}>
          {item.images?.[0] ? (
            <Image
              source={{ uri: item.images[0] }}
              style={{ width: '100%', height: '100%' }}
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
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                -{discountPct}%
              </Text>
            </View>
          )}
        </View>

        <View style={{ padding: 10 }}>
          <Text
            style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 2,
            }}
          >
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
              {CATEGORY_LABELS[item.category] || item.category}
            </Text>
            {shopName ? (
              <Text
                style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}
                numberOfLines={1}
              >
                · {shopName}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 6,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#00897B' }}>
              P${item.price.toFixed(2)}
            </Text>
            {hasDiscount && (
              <Text
                style={{
                  fontSize: 11,
                  color: '#9CA3AF',
                  marginLeft: 6,
                  textDecorationLine: 'line-through',
                }}
              >
                P${item.compareAtPrice!.toFixed(2)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const screenTitle = params.title || 'Products';

  // ── Filter bar component ──
  const FilterBar = () => (
    <View style={{ paddingBottom: 8 }}>
      {/* Search */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#fff',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          paddingHorizontal: 12,
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
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
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchText('');
              fetchProducts(1, { search: '' });
            }}
          >
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter toggle + count */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: showFilters ? 10 : 0,
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
            size={16}
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
          <TouchableOpacity
            onPress={handleClearFilters}
            style={{ marginLeft: 10 }}
          >
            <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '500' }}>
              Clear all
            </Text>
          </TouchableOpacity>
        )}

        <Text style={{ marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' }}>
          {totalCount} product{totalCount !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Expanded filters */}
      {showFilters && (
        <View>
          {/* Category */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: 6,
            }}
          >
            Category
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
          >
            {CATEGORY_OPTIONS.map((cat) => (
              <TouchableOpacity
                key={cat.value || 'all-cat'}
                onPress={() => handleCategoryChange(cat.value)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  marginRight: 8,
                  backgroundColor:
                    selectedCategory === cat.value ? '#4DB6AC' : '#fff',
                  borderWidth: 1,
                  borderColor:
                    selectedCategory === cat.value ? '#4DB6AC' : '#E5E7EB',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: selectedCategory === cat.value ? '#fff' : '#4B5563',
                  }}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Pet Type */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: 6,
            }}
          >
            Pet Type
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
          >
            {PET_TYPE_OPTIONS.map((pt) => (
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
                    color: selectedPetType === pt.value ? '#fff' : '#4B5563',
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
            {SORT_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s.value || 'all-sort'}
                onPress={() => handleSortChange(s.value)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  marginRight: 8,
                  backgroundColor:
                    selectedSort === s.value ? '#4DB6AC' : '#fff',
                  borderWidth: 1,
                  borderColor: selectedSort === s.value ? '#4DB6AC' : '#E5E7EB',
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
              marginBottom: 4,
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
  );

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
            fontSize: 17,
            fontWeight: '700',
            color: '#1F2937',
          }}
          numberOfLines={1}
        >
          {screenTitle}
        </Text>

        {/* Product count */}
        {!loading && (
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginRight: 12 }}>
            {totalCount} item{totalCount !== 1 ? 's' : ''}
          </Text>
        )}

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

      {/* Content */}
      {loading && products.length === 0 ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="large" color="#4DB6AC" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item._id}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={{
            justifyContent: 'space-between',
          }}
          contentContainerStyle={{
            padding: PADDING,
            paddingBottom: 20,
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<FilterBar />}
          ListEmptyComponent={
            !loading ? (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
                <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 12 }}>
                  No products found
                </Text>
                {hasActiveFilters && (
                  <TouchableOpacity
                    onPress={handleClearFilters}
                    style={{ marginTop: 12 }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: '#4DB6AC',
                        fontWeight: '500',
                      }}
                    >
                      Clear filters
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
          ListFooterComponent={
            loading ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator color="#4DB6AC" />
              </View>
            ) : (
              <PaginationBar />
            )
          }
        />
      )}
    </SafeAreaView>
  );
};
