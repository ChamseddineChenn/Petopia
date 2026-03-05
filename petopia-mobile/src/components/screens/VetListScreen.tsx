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
import { fetchVetClinics, VetClinic } from '../../store/slices/vetSlice';

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

export const VetListScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { clinics, loading, pagination } = useSelector(
    (state: RootState) => state.vets,
  );

  const [sort, setSort] = useState('rating');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadClinics = useCallback(
    (page = 1) => {
      dispatch(
        fetchVetClinics({
          page,
          sort,
          search: searchQuery || undefined,
        }),
      );
    },
    [dispatch, sort, searchQuery],
  );

  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(
      fetchVetClinics({ page: 1, sort, search: searchQuery || undefined }),
    );
    setRefreshing(false);
  }, [dispatch, sort, searchQuery]);

  const handleSearch = () => {
    setSearchQuery(search.trim());
  };

  const navigateToClinic = (clinicId: string) => {
    router.push({ pathname: '/vet-clinic', params: { clinicId } });
  };

  const renderClinicCard = (clinic: VetClinic) => (
    <TouchableOpacity
      key={clinic._id}
      onPress={() => navigateToClinic(clinic._id)}
      activeOpacity={0.7}
      className="bg-white rounded-2xl mb-3 border border-bg-alt overflow-hidden"
    >
      {/* Clinic Header with photo */}
      <View className="flex-row p-4">
        {/* Logo / Avatar */}
        <View className="mr-3">
          {clinic.logo ? (
            <Image
              source={{ uri: clinic.logo }}
              style={{ width: 60, height: 60, borderRadius: 12 }}
            />
          ) : (
            <View className="w-[60px] h-[60px] rounded-xl bg-primary-light/20 items-center justify-center">
              <Ionicons name="medkit" size={28} color="#00897B" />
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
              {clinic.clinicName}
            </Text>
            {clinic.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#00897B" />
            )}
          </View>

          {/* Rating */}
          <View className="flex-row items-center mb-1.5">
            <StarRating rating={clinic.averageRating} />
            <Text className="text-xs text-text-muted ml-1.5">
              {clinic.averageRating.toFixed(1)} ({clinic.totalReviews})
            </Text>
          </View>

          {/* Location */}
          <View className="flex-row items-center mb-1">
            <Ionicons name="location-outline" size={13} color="#6B7280" />
            <Text className="text-xs text-text-muted ml-1" numberOfLines={1}>
              {clinic.address.city}
              {clinic.address.state ? `, ${clinic.address.state}` : ''}
            </Text>
          </View>

          {/* Vet name */}
          <Text className="text-xs text-text-muted" numberOfLines={1}>
            Dr. {clinic.owner.name}
          </Text>
        </View>
      </View>

      {/* Service tags + Badges */}
      <View className="px-4 pb-3">
        <View className="flex-row flex-wrap gap-1.5">
          {clinic.emergencyAvailable && (
            <View className="bg-red-50 px-2 py-0.5 rounded-full flex-row items-center">
              <Ionicons name="pulse" size={10} color="#EF4444" />
              <Text className="text-[10px] text-red-600 ml-0.5 font-medium">
                24/7 Emergency
              </Text>
            </View>
          )}
          {clinic.homeVisitAvailable && (
            <View className="bg-blue-50 px-2 py-0.5 rounded-full flex-row items-center">
              <Ionicons name="home-outline" size={10} color="#3B82F6" />
              <Text className="text-[10px] text-blue-600 ml-0.5 font-medium">
                Home Visit
              </Text>
            </View>
          )}
          {/* Accepted pet types (first 4) */}
          {clinic.acceptedPetTypes.slice(0, 4).map((type) => (
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
          {clinic.acceptedPetTypes.length > 4 && (
            <View className="bg-gray-100 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] text-text-muted">
                +{clinic.acceptedPetTypes.length - 4} more
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader title="Veterinarians" />

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

      {/* Clinic List */}
      {loading && clinics.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00897B" size="large" />
        </View>
      ) : clinics.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="medkit-outline" size={56} color="#D1D5DB" />
          <Text className="text-lg text-text-muted mt-3 text-center">
            No veterinary clinics found
          </Text>
          <Text className="text-sm text-text-muted mt-1 text-center">
            {searchQuery
              ? 'Try a different search term'
              : 'Check back later for new clinics'}
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
            {pagination.total} clinic{pagination.total !== 1 ? 's' : ''} found
          </Text>
          {clinics.map(renderClinicCard)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
