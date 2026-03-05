import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Avatar } from '../common/Avatar';
import { useRefresh } from '../../hooks/useRefresh';
import { RootState, AppDispatch } from '../../store/store';
import { fetchProfile } from '../../store/slices/authSlice';
import { fetchPets } from '../../store/slices/petSlice';
import { fetchUnreadCount } from '../../store/slices/notificationSlice';
import { fetchBalance } from '../../store/slices/walletSlice';
import { useAlert } from '../ui/CustomAlert';

const SPECIES_ICON: Record<string, { name: string; component: 'mci' | 'ion' }> =
  {
    dog: { name: 'dog', component: 'mci' },
    cat: { name: 'cat', component: 'mci' },
    bird: { name: 'bird', component: 'mci' },
    fish: { name: 'fish', component: 'mci' },
    rabbit: { name: 'rabbit', component: 'mci' },
    hamster: { name: 'rodent', component: 'mci' },
    turtle: { name: 'turtle', component: 'mci' },
    other: { name: 'paw', component: 'mci' },
  };

const SpeciesIcon: React.FC<{
  species: string;
  size?: number;
  color?: string;
}> = ({ species, size = 24, color = '#00897B' }) => {
  const iconInfo = SPECIES_ICON[species] || SPECIES_ICON.other;
  return (
    <MaterialCommunityIcons
      name={iconInfo.name as any}
      size={size}
      color={color}
    />
  );
};

interface HomeScreenProps {
  onProfilePress?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onProfilePress }) => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user } = useSelector((state: RootState) => state.auth);
  const { pets } = useSelector((state: RootState) => state.pets);
  const { unreadCount } = useSelector(
    (state: RootState) => state.notifications,
  );
  const walletBalance = useSelector((state: RootState) => state.wallet.balance);
  const { showAlert } = useAlert();

  const [showPetPicker, setShowPetPicker] = useState(false);

  const navigateToPetProfile = (petId: string) => {
    router.push({ pathname: '/pet-profile', params: { petId } });
  };

  const navigateToHealthRecords = () => {
    if (pets.length === 0) {
      showAlert({
        title: 'No Pets',
        message: 'Add a pet first to view health records.',
        variant: 'warning',
      });
      return;
    }
    if (pets.length === 1) {
      router.push({
        pathname: '/health-records',
        params: { petId: pets[0]._id },
      });
      return;
    }
    // Multiple pets — show styled picker
    setShowPetPicker(true);
  };

  const handleRefreshData = async () => {
    await Promise.all([
      dispatch(fetchProfile()),
      dispatch(fetchPets()),
      dispatch(fetchUnreadCount()),
      dispatch(fetchBalance()),
    ]);
  };

  const { refreshControl } = useRefresh(handleRefreshData);

  useEffect(() => {
    dispatch(fetchProfile());
    dispatch(fetchPets());
    dispatch(fetchUnreadCount());
    dispatch(fetchBalance());
  }, [dispatch]);

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        scrollEnabled={true}
        bounces={true}
      >
        {/* Header */}
        <View className="bg-white px-5 py-6 border-b border-bg-alt">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1">
              <Text className="text-sm text-text-muted font-medium mb-1">
                Welcome back,
              </Text>
              <Text className="text-3xl font-bold text-text-primary">
                {firstName}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => router.push('/notifications')}
                className="relative"
              >
                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color="#1F2937"
                />
                {unreadCount > 0 && (
                  <View className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                    <Text className="text-white text-[10px] font-bold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={onProfilePress}>
                <Avatar
                  initials={user?.name?.[0] || 'U'}
                  source={
                    user?.profileImage ? { uri: user.profileImage } : undefined
                  }
                  size="lg"
                />
              </TouchableOpacity>
            </View>
          </View>
          <Text className="text-base text-text-secondary font-medium">
            What would you like to do today?
          </Text>
        </View>

        {/* Pet Dollar Wallet Card */}
        <View className="px-5 pt-5">
          <TouchableOpacity
            onPress={() => router.push('/wallet' as any)}
            activeOpacity={0.7}
            className="rounded-2xl overflow-hidden"
          >
            <View className="bg-[#4DB6AC] px-5 py-4 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3">
                  <MaterialCommunityIcons
                    name="wallet"
                    size={22}
                    color="#fff"
                  />
                </View>
                <View>
                  <Text className="text-xs text-white/70 font-medium">
                    Pet Dollar Balance
                  </Text>
                  <Text className="text-xl font-extrabold text-white">
                    P${walletBalance.toFixed(2)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/top-up' as any)}
                activeOpacity={0.7}
                className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center"
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text className="text-xs font-semibold text-white ml-0.5">
                  Top Up
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>

        {/* My Pets Quick View */}
        {pets.length > 0 && (
          <View className="px-5 pt-6">
            <Text className="text-lg font-bold text-text-primary mb-3">
              My Pets
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {pets.map((pet) => (
                <TouchableOpacity
                  key={pet._id}
                  onPress={() => navigateToPetProfile(pet._id)}
                  activeOpacity={0.7}
                  className="bg-white rounded-2xl p-4 mr-3 items-center border border-bg-alt"
                  style={{ width: 100 }}
                >
                  <View className="w-12 h-12 rounded-full bg-primary-light/30 items-center justify-center mb-2">
                    <SpeciesIcon
                      species={pet.species}
                      size={24}
                      color="#00897B"
                    />
                  </View>
                  <Text
                    className="text-sm font-semibold text-text-primary text-center"
                    numberOfLines={1}
                  >
                    {pet.name}
                  </Text>
                  <Text
                    className="text-xs text-text-muted mt-1"
                    numberOfLines={1}
                  >
                    {pet.breed || pet.species}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* My Appointments — visible to all users (clients) */}
        {user?.role !== 'vet' && user?.role !== 'groomer' && (
          <View className="px-5 pt-6">
            <TouchableOpacity
              onPress={() => router.push('/my-appointments')}
              activeOpacity={0.7}
              className="bg-blue-50 rounded-2xl p-5 border border-blue-100 flex-row items-center"
            >
              <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-4">
                <Ionicons name="calendar-outline" size={24} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-text-primary">
                  My Appointments
                </Text>
                <Text className="text-xs text-text-muted mt-1">
                  View your upcoming vet & grooming visits
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        )}

        {/* Vet Dashboard — visible only for vet users */}
        {user?.role === 'vet' && (
          <View className="px-5 pt-6">
            <Text className="text-lg font-bold text-text-primary mb-3">
              Vet Dashboard
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/manage-clinic')}
              activeOpacity={0.7}
              className="bg-primary/10 rounded-2xl p-5 border border-primary/20 flex-row items-center"
            >
              <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-4">
                <MaterialCommunityIcons
                  name="hospital-building"
                  size={24}
                  color="#00897B"
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-primary-dark">
                  My Clinic
                </Text>
                <Text className="text-xs text-text-muted mt-1">
                  Manage your clinic, services & schedule
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#00897B" />
            </TouchableOpacity>

            {/* Appointments & Clients row */}
            <View className="flex-row gap-3 mt-3">
              <TouchableOpacity
                onPress={() => router.push('/vet-appointments')}
                activeOpacity={0.7}
                className="flex-1 bg-white rounded-2xl p-4 border border-bg-alt items-center"
              >
                <View className="w-11 h-11 rounded-full bg-blue-100 items-center justify-center mb-2">
                  <Ionicons name="calendar-outline" size={22} color="#3B82F6" />
                </View>
                <Text className="text-sm font-bold text-text-primary">
                  Appointments
                </Text>
                <Text className="text-[11px] text-text-muted mt-0.5">
                  Confirm & manage
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/vet-clients')}
                activeOpacity={0.7}
                className="flex-1 bg-white rounded-2xl p-4 border border-bg-alt items-center"
              >
                <View className="w-11 h-11 rounded-full bg-green-100 items-center justify-center mb-2">
                  <Ionicons name="people-outline" size={22} color="#10B981" />
                </View>
                <Text className="text-sm font-bold text-text-primary">
                  My Clients
                </Text>
                <Text className="text-[11px] text-text-muted mt-0.5">
                  Pets & records
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Groomer Dashboard — visible only for groomer users */}
        {user?.role === 'groomer' && (
          <View className="px-5 pt-6">
            <Text className="text-lg font-bold text-text-primary mb-3">
              Groomer Dashboard
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/manage-groomer-shop')}
              activeOpacity={0.7}
              className="bg-primary/10 rounded-2xl p-5 border border-primary/20 flex-row items-center"
            >
              <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-4">
                <MaterialCommunityIcons
                  name="content-cut"
                  size={24}
                  color="#00897B"
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-primary-dark">
                  My Shop
                </Text>
                <Text className="text-xs text-text-muted mt-1">
                  Manage your shop, services & schedule
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#00897B" />
            </TouchableOpacity>

            {/* Appointments & Clients row */}
            <View className="flex-row gap-3 mt-3">
              <TouchableOpacity
                onPress={() => router.push('/groomer-appointments')}
                activeOpacity={0.7}
                className="flex-1 bg-white rounded-2xl p-4 border border-bg-alt items-center"
              >
                <View className="w-11 h-11 rounded-full bg-blue-100 items-center justify-center mb-2">
                  <Ionicons name="calendar-outline" size={22} color="#3B82F6" />
                </View>
                <Text className="text-sm font-bold text-text-primary">
                  Appointments
                </Text>
                <Text className="text-[11px] text-text-muted mt-0.5">
                  Confirm & manage
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/groomer-clients')}
                activeOpacity={0.7}
                className="flex-1 bg-white rounded-2xl p-4 border border-bg-alt items-center"
              >
                <View className="w-11 h-11 rounded-full bg-green-100 items-center justify-center mb-2">
                  <Ionicons name="people-outline" size={22} color="#10B981" />
                </View>
                <Text className="text-sm font-bold text-text-primary">
                  My Clients
                </Text>
                <Text className="text-[11px] text-text-muted mt-0.5">
                  View & manage
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Pet Shop Dashboard — visible only for pet_shop users */}
        {user?.role === 'pet_shop' && (
          <View className="px-5 pt-6">
            <Text className="text-lg font-bold text-text-primary mb-3">
              Pet Shop Dashboard
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/manage-pet-shop')}
              activeOpacity={0.7}
              className="bg-primary/10 rounded-2xl p-5 border border-primary/20 flex-row items-center"
            >
              <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-4">
                <Ionicons name="storefront" size={24} color="#00897B" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-primary-dark">
                  My Pet Shop
                </Text>
                <Text className="text-xs text-text-muted mt-1">
                  Manage your shop, products & inventory
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#00897B" />
            </TouchableOpacity>

            {/* Browse Shops & Cart row */}
            <View className="flex-row gap-3 mt-3">
              <TouchableOpacity
                onPress={() => router.push('/pet-shop-list')}
                activeOpacity={0.7}
                className="flex-1 bg-white rounded-2xl p-4 border border-bg-alt items-center"
              >
                <View className="w-11 h-11 rounded-full bg-blue-100 items-center justify-center mb-2">
                  <Ionicons name="search-outline" size={22} color="#3B82F6" />
                </View>
                <Text className="text-sm font-bold text-text-primary">
                  Browse Shops
                </Text>
                <Text className="text-[11px] text-text-muted mt-0.5">
                  Discover pet shops
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/cart')}
                activeOpacity={0.7}
                className="flex-1 bg-white rounded-2xl p-4 border border-bg-alt items-center"
              >
                <View className="w-11 h-11 rounded-full bg-green-100 items-center justify-center mb-2">
                  <Ionicons name="cart-outline" size={22} color="#10B981" />
                </View>
                <Text className="text-sm font-bold text-text-primary">
                  My Cart
                </Text>
                <Text className="text-[11px] text-text-muted mt-0.5">
                  View & checkout
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick Access */}
        <View className="px-5 pt-6">
          <Text className="text-lg font-bold text-text-primary mb-4">
            Quick Access
          </Text>
          <TouchableOpacity
            onPress={navigateToHealthRecords}
            activeOpacity={0.7}
            className="bg-white rounded-2xl p-5 mb-3 border border-bg-alt flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-primary-light/20 items-center justify-center mr-3">
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#00897B"
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary">
                  Pet Health Records
                </Text>
                <Text className="text-xs text-text-muted mt-1">
                  {pets.length > 0
                    ? `${pets.length} pet${pets.length !== 1 ? 's' : ''} registered`
                    : 'Add a pet to get started'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Pet Picker Modal for Health Records */}
      <Modal
        visible={showPetPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPetPicker(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowPetPicker(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            className="bg-white rounded-t-3xl pt-4 pb-8 px-5"
          >
            {/* Handle bar */}
            <View className="w-10 h-1 rounded-full bg-gray-300 self-center mb-4" />

            {/* Title */}
            <View className="flex-row items-center mb-1">
              <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center mr-3">
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#00897B"
                />
              </View>
              <View>
                <Text className="text-lg font-bold text-text-primary">
                  Select a Pet
                </Text>
                <Text className="text-xs text-text-muted">
                  View health records for
                </Text>
              </View>
            </View>

            {/* Pet List */}
            <View className="mt-4">
              {pets.map((pet, index) => {
                const speciesInfo =
                  SPECIES_ICON[pet.species] || SPECIES_ICON.other;
                return (
                  <TouchableOpacity
                    key={pet._id}
                    onPress={() => {
                      setShowPetPicker(false);
                      router.push({
                        pathname: '/health-records',
                        params: { petId: pet._id },
                      });
                    }}
                    activeOpacity={0.7}
                    className={`flex-row items-center p-3.5 rounded-2xl ${
                      index < pets.length - 1 ? 'mb-2' : ''
                    } bg-bg-main border border-bg-alt`}
                  >
                    {/* Pet Avatar */}
                    {pet.profileImage ? (
                      <Image
                        source={{ uri: pet.profileImage }}
                        style={{ width: 48, height: 48, borderRadius: 24 }}
                      />
                    ) : (
                      <View className="w-12 h-12 rounded-full bg-primary-light/20 items-center justify-center">
                        <MaterialCommunityIcons
                          name={speciesInfo.name as any}
                          size={24}
                          color="#00897B"
                        />
                      </View>
                    )}
                    {/* Pet Info */}
                    <View className="flex-1 ml-3">
                      <Text className="text-base font-semibold text-text-primary">
                        {pet.name}
                      </Text>
                      <Text className="text-xs text-text-muted mt-0.5">
                        {pet.species
                          ? pet.species.charAt(0).toUpperCase() +
                            pet.species.slice(1)
                          : ''}
                        {pet.breed ? ` · ${pet.breed}` : ''}
                        {pet.age ? ` · ${pet.age}y` : ''}
                      </Text>
                    </View>
                    {/* Arrow */}
                    <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="#00897B"
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Cancel */}
            <TouchableOpacity
              onPress={() => setShowPetPicker(false)}
              className="mt-4 py-3 rounded-xl bg-gray-100 items-center"
            >
              <Text className="text-sm font-semibold text-text-muted">
                Cancel
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};
