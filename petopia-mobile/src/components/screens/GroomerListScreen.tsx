import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../common/ScreenHeader';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchGroomerShops,
  GroomerShop,
} from '../../store/slices/groomerSlice';

const PET_TYPE_ICONS: Record<string, string> = {
  dog: 'dog',
  cat: 'cat',
  bird: 'bird',
  fish: 'fish',
  rabbit: 'rabbit',
  hamster: 'rodent',
  turtle: 'turtle',
  reptile: 'snake',
  exotic: 'paw',
  other: 'paw',
};

const SORT_OPTIONS = [
  { value: 'rating', label: 'Best Rated' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'newest', label: 'Newest' },
];

/** Render a row of stars for a rating */
const StarRating: React.FC<{ rating: number; size?: number }> = ({
  rating,
  size = 14,
}) => {
  const stars = [];
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;

  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<Ionicons key={i} name="star" size={size} color="#F59E0B" />);
    } else if (i === full && half) {
      stars.push(
        <Ionicons key={i} name="star-half" size={size} color="#F59E0B" />,
      );
    } else {
      stars.push(
        <Ionicons key={i} name="star-outline" size={size} color="#D1D5DB" />,
      );
    }
  }

  return <View className="flex-row">{stars}</View>;
};

export const GroomerListScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { shops, loading, pagination } = useSelector(
    (state: RootState) => state.groomers,
  );

  const [sort, setSort] = useState('rating');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadShops = useCallback(
    (page = 1) => {
      dispatch(
        fetchGroomerShops({
          page,
          sort,
          search: searchQuery || undefined,
        }),
      );
    },
    [dispatch, sort, searchQuery],
  );

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(
      fetchGroomerShops({ page: 1, sort, search: searchQuery || undefined }),
    );
    setRefreshing(false);
  }, [dispatch, sort, searchQuery]);

  const handleSearch = () => {
    setSearchQuery(search.trim());
  };

  const navigateToShop = (shopId: string) => {
    router.push({ pathname: '/groomer-shop', params: { shopId } });
  };

  const renderShopCard = (shop: GroomerShop) => (
    <TouchableOpacity
      key={shop._id}
      onPress={() => navigateToShop(shop._id)}
      activeOpacity={0.7}
      className="bg-white rounded-2xl mb-3 border border-bg-alt overflow-hidden"
    >
      {/* Shop Header with photo */}
      <View className="flex-row p-4">
        {/* Logo / Avatar */}
        <View className="mr-3">
          {shop.logo ? (
            <Image
              source={{ uri: shop.logo }}
              style={{ width: 60, height: 60, borderRadius: 12 }}
            />
          ) : (
            <View className="w-[60px] h-[60px] rounded-xl bg-primary-light/20 items-center justify-center">
              <MaterialCommunityIcons
                name="content-cut"
                size={28}
                color="#00897B"
              />
            </View>
          )}
        </View>

        {/* Info */}
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Text
              className="text-base font-bold text-text-primary flex-1 mr-2"
              numberOfLines={1}
            >
              {shop.shopName}
            </Text>
            {shop.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#00897B" />
            )}
          </View>

          {/* Rating */}
          <View className="flex-row items-center mb-1.5">
            <StarRating rating={shop.averageRating} />
            <Text className="text-xs text-text-muted ml-1.5">
              {shop.averageRating.toFixed(1)} ({shop.totalReviews})
            </Text>
          </View>

          {/* Location */}
          <View className="flex-row items-center mb-1">
            <Ionicons name="location-outline" size={13} color="#6B7280" />
            <Text className="text-xs text-text-muted ml-1" numberOfLines={1}>
              {shop.address.city}
              {shop.address.state ? `, ${shop.address.state}` : ''}
            </Text>
          </View>

          {/* Owner name */}
          <Text className="text-xs text-text-muted" numberOfLines={1}>
            {shop.owner.name}
          </Text>
        </View>
      </View>

      {/* Service tags + Badges */}
      <View className="px-4 pb-3">
        <View className="flex-row flex-wrap gap-1.5">
          {shop.mobileGrooming && (
            <View className="bg-blue-50 px-2 py-0.5 rounded-full flex-row items-center">
              <Ionicons name="car-outline" size={10} color="#3B82F6" />
              <Text className="text-[10px] text-blue-600 ml-0.5 font-medium">
                Mobile Grooming
              </Text>
            </View>
          )}
          {shop.pickupDropoff && (
            <View className="bg-purple-50 px-2 py-0.5 rounded-full flex-row items-center">
              <Ionicons
                name="swap-horizontal-outline"
                size={10}
                color="#8B5CF6"
              />
              <Text className="text-[10px] text-purple-600 ml-0.5 font-medium">
                Pickup & Drop-off
              </Text>
            </View>
          )}
          {shop.homeVisitAvailable && (
            <View className="bg-green-50 px-2 py-0.5 rounded-full flex-row items-center">
              <Ionicons name="home-outline" size={10} color="#10B981" />
              <Text className="text-[10px] text-green-600 ml-0.5 font-medium">
                Home Visit
              </Text>
            </View>
          )}
          {/* Accepted pet types (first 4) */}
          {shop.acceptedPetTypes.slice(0, 4).map((type) => (
            <View
              key={type}
              className="bg-gray-100 px-2 py-0.5 rounded-full flex-row items-center"
            >
              <MaterialCommunityIcons
                name={(PET_TYPE_ICONS[type] || 'paw') as any}
                size={10}
                color="#6B7280"
              />
              <Text className="text-[10px] text-text-muted ml-0.5 capitalize">
                {type}
              </Text>
            </View>
          ))}
          {shop.acceptedPetTypes.length > 4 && (
            <View className="bg-gray-100 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] text-text-muted">
                +{shop.acceptedPetTypes.length - 4} more
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader title="Groomers" />

      {/* Search Bar */}
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-3">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            placeholder="Search by name, city..."
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            className="flex-1 px-2 py-3 text-base text-text-primary"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                setSearchQuery('');
              }}
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sort Tabs */}
      <View className="px-4 pb-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setSort(opt.value)}
              className={`px-4 py-2 rounded-full border ${
                sort === opt.value
                  ? 'bg-primary border-primary'
                  : 'bg-white border-gray-200'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  sort === opt.value ? 'text-white' : 'text-text-primary'
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Shop List */}
      {loading && shops.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00897B" size="large" />
        </View>
      ) : shops.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <MaterialCommunityIcons
            name="content-cut"
            size={56}
            color="#D1D5DB"
          />
          <Text className="text-lg text-text-muted mt-3 text-center">
            No grooming shops found
          </Text>
          <Text className="text-sm text-text-muted mt-1 text-center">
            {searchQuery
              ? 'Try a different search term'
              : 'Check back later for new grooming shops'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00897B"
              colors={['#00897B']}
            />
          }
        >
          <Text className="text-xs text-text-muted mb-3">
            {pagination.total} shop{pagination.total !== 1 ? 's' : ''} found
          </Text>
          {shops.map(renderShopCard)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
