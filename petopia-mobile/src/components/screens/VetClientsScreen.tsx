import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenHeader } from '../common/ScreenHeader';
import { RootState } from '../../store/store';
import { API_BASE_URL } from '../../config';

// ========================================
// Types
// ========================================

interface ClientPet {
  _id: string;
  name: string;
  species: string;
  breed: string;
  profileImage?: string;
  dateOfBirth?: string;
  weight?: number;
  gender?: string;
}

interface ClientOwner {
  _id: string;
  name: string;
  profileImage?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
}

interface ClientEntry {
  pet: ClientPet;
  owner: ClientOwner;
  clinic: { _id: string; clinicName: string };
  lastAppointment: {
    _id: string;
    date: string;
    service: { name: string; duration: number; price: number | null };
    status: string;
  };
  appointmentCount: number;
}

const SPECIES_ICONS: Record<string, string> = {
  dog: 'dog',
  cat: 'cat',
  bird: 'bird',
  fish: 'fish',
  rabbit: 'rabbit',
  hamster: 'rodent',
  turtle: 'turtle',
};

// ========================================
// Component
// ========================================

export const VetClientsScreen: React.FC = () => {
  const router = useRouter();
  const { token } = useSelector((state: RootState) => state.auth);

  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/appointments/vet/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setClients(data.clients);
      }
    } catch (err) {
      console.error('Fetch clients error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClients();
  };

  const filteredClients = searchQuery.trim()
    ? clients.filter(
        (c) =>
          c.pet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.pet.breed || '').toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : clients;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderClient = ({ item }: { item: ClientEntry }) => {
    const speciesIcon = SPECIES_ICONS[item.pet.species] || 'paw';

    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/vet-pet-records',
            params: { petId: item.pet._id },
          })
        }
        className="bg-white rounded-2xl mx-4 mb-3 border border-gray-100 shadow-sm overflow-hidden"
        activeOpacity={0.7}
      >
        <View className="p-4">
          {/* Pet Info Row */}
          <View className="flex-row items-center mb-3">
            {item.pet.profileImage ? (
              <Image
                source={{ uri: item.pet.profileImage }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
              />
            ) : (
              <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
                <MaterialCommunityIcons
                  name={speciesIcon as any}
                  size={24}
                  color="#00897B"
                />
              </View>
            )}
            <View className="flex-1 ml-3">
              <Text className="text-base font-bold text-text-primary">
                {item.pet.name}
              </Text>
              <Text className="text-xs text-text-muted">
                {item.pet.species.charAt(0).toUpperCase() +
                  item.pet.species.slice(1)}
                {item.pet.breed ? ` • ${item.pet.breed}` : ''}
                {item.pet.gender && item.pet.gender !== 'unknown'
                  ? ` • ${item.pet.gender.charAt(0).toUpperCase() + item.pet.gender.slice(1)}`
                  : ''}
              </Text>
            </View>
            <View className="items-center">
              <View className="bg-primary/10 px-2.5 py-1 rounded-full">
                <Text className="text-xs font-bold text-primary">
                  {item.appointmentCount} visit
                  {item.appointmentCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Owner Row */}
          <TouchableOpacity
            className="flex-row items-center bg-gray-50 rounded-xl p-2.5 mb-2"
            onPress={() =>
              router.push({
                pathname: '/profile-modal',
                params: { userId: item.owner._id },
              })
            }
          >
            {item.owner.profileImage ? (
              <Image
                source={{ uri: item.owner.profileImage }}
                style={{ width: 28, height: 28, borderRadius: 14 }}
              />
            ) : (
              <View className="w-7 h-7 rounded-full bg-gray-200 items-center justify-center">
                <Ionicons name="person" size={14} color="#6B7280" />
              </View>
            )}
            <View className="flex-1 ml-2">
              <Text className="text-sm font-semibold text-text-primary">
                {item.owner.name}
              </Text>
              {item.owner.phone ? (
                <Text className="text-xs text-text-muted">
                  {item.owner.phone}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Last visit */}
          <View className="flex-row items-center pt-2 border-t border-gray-100 mt-1">
            <Ionicons name="time-outline" size={13} color="#9CA3AF" />
            <Text className="text-xs text-text-muted ml-1">
              Last visit: {formatDate(item.lastAppointment.date)} —{' '}
              {item.lastAppointment.service.name}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader title="My Clients" onBack={() => router.back()} />

      {/* Search */}
      <View className="px-4 py-2 bg-white border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3">
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            placeholder="Search by pet or owner name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 py-2.5 text-sm text-text-primary ml-2"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DB6AC" />
          <Text className="text-text-muted mt-3">Loading clients...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClients}
          renderItem={renderClient}
          keyExtractor={(item) => item.pet._id}
          contentContainerStyle={{
            paddingVertical: 12,
            ...(filteredClients.length === 0 ? { flex: 1 } : {}),
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4DB6AC"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons name="people-outline" size={64} color="#D1D5DB" />
              <Text className="text-lg text-text-muted mt-4 text-center">
                No clients yet
              </Text>
              <Text className="text-sm text-text-muted mt-1 text-center">
                Pets from confirmed appointments will appear here
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};
