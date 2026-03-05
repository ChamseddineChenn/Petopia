import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenHeader } from '../common/ScreenHeader';
import { RootState } from '../../store/store';
import { API_BASE_URL } from '../../config';
import { useAlert } from '../ui/CustomAlert';

// ========================================
// Types
// ========================================

interface PetInfo {
  _id: string;
  name: string;
  species: string;
  breed: string;
  gender: string;
  dateOfBirth?: string;
  weight?: number;
  profileImage?: string;
  owner: {
    _id: string;
    name: string;
    profileImage?: string;
    email?: string;
    phone?: string;
  };
}

interface HealthRecord {
  _id: string;
  recordType: string;
  title: string;
  description: string;
  date: string;
  veterinarian: { name: string; clinic: string };
  notes: string;
  createdAt: string;
}

// ========================================
// Constants
// ========================================

const RECORD_TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  vaccination: { icon: 'shield-checkmark-outline', color: '#10B981' },
  examination: { icon: 'eye-outline', color: '#3B82F6' },
  surgery: { icon: 'cut-outline', color: '#EF4444' },
  laboratory: { icon: 'flask-outline', color: '#8B5CF6' },
  prescription: { icon: 'medkit-outline', color: '#F59E0B' },
  dental: { icon: 'happy-outline', color: '#EC4899' },
  imaging: { icon: 'scan-outline', color: '#6366F1' },
  emergency: { icon: 'warning-outline', color: '#DC2626' },
  wellness: { icon: 'heart-outline', color: '#14B8A6' },
  deworming: { icon: 'bug-outline', color: '#84CC16' },
  allergy: { icon: 'alert-circle-outline', color: '#F97316' },
  other: { icon: 'document-text-outline', color: '#6B7280' },
};

const RECORD_TYPES = [
  'examination',
  'vaccination',
  'prescription',
  'laboratory',
  'surgery',
  'dental',
  'imaging',
  'emergency',
  'wellness',
  'deworming',
  'allergy',
  'other',
];

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

export const VetPetRecordsScreen: React.FC = () => {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { token } = useSelector((state: RootState) => state.auth);
  const { user } = useSelector((state: RootState) => state.auth);
  const { showAlert } = useAlert();

  const [pet, setPet] = useState<PetInfo | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New record form
  const [recordType, setRecordType] = useState('examination');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/appointments/vet/pet/${petId}/records`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.success) {
        setPet(data.pet);
        setRecords(data.records);
      } else {
        showAlert({
          title: 'Access Denied',
          message: data.message || 'Cannot access records',
          variant: 'error',
        });
        router.back();
      }
    } catch (err) {
      console.error('Fetch pet records error:', err);
      showAlert({
        title: 'Error',
        message: 'Failed to load pet records',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [petId, token, router, showAlert]);

  useEffect(() => {
    if (petId) fetchData();
  }, [fetchData, petId]);

  const handleAddRecord = async () => {
    if (!title.trim()) {
      showAlert({
        title: 'Error',
        message: 'Title is required',
        variant: 'warning',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/appointments/vet/pet/${petId}/records`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recordType,
            title: title.trim(),
            description: description.trim(),
            notes: notes.trim(),
            date: new Date().toISOString(),
            veterinarian: {
              name: user?.name || '',
              clinic: '',
            },
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setRecords((prev) => [data.record, ...prev]);
        setShowAddRecord(false);
        setTitle('');
        setDescription('');
        setNotes('');
        setRecordType('examination');
        showAlert({
          title: 'Success',
          message: 'Health record added successfully',
          variant: 'success',
        });
      } else {
        showAlert({
          title: 'Error',
          message: data.message || 'Failed to add record',
          variant: 'error',
        });
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to add record',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    if (
      now.getMonth() < birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
    ) {
      years--;
    }
    return years;
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
        <ScreenHeader title="Pet Records" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DB6AC" />
          <Text className="text-text-muted mt-3">Loading records...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const speciesIcon = SPECIES_ICONS[pet?.species || ''] || 'paw';

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader
        title={pet?.name ? `${pet.name}'s Records` : 'Pet Records'}
        onBack={() => router.back()}
        rightAction={
          <TouchableOpacity onPress={() => setShowAddRecord(true)}>
            <Ionicons name="add-circle-outline" size={24} color="#00897B" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pet Info Card */}
        {pet && (
          <View className="bg-white mx-4 mt-3 rounded-2xl p-4 border border-gray-100 shadow-sm">
            <View className="flex-row items-center">
              {pet.profileImage ? (
                <Image
                  source={{ uri: pet.profileImage }}
                  style={{ width: 56, height: 56, borderRadius: 28 }}
                />
              ) : (
                <View className="w-14 h-14 rounded-full bg-primary/10 items-center justify-center">
                  <MaterialCommunityIcons
                    name={speciesIcon as any}
                    size={28}
                    color="#00897B"
                  />
                </View>
              )}
              <View className="flex-1 ml-3">
                <Text className="text-lg font-bold text-text-primary">
                  {pet.name}
                </Text>
                <Text className="text-sm text-text-muted">
                  {pet.species.charAt(0).toUpperCase() + pet.species.slice(1)}
                  {pet.breed ? ` • ${pet.breed}` : ''}
                </Text>
                <View className="flex-row mt-1 gap-3">
                  {pet.gender && pet.gender !== 'unknown' && (
                    <Text className="text-xs text-text-muted">
                      {pet.gender === 'male' ? '♂' : '♀'}{' '}
                      {pet.gender.charAt(0).toUpperCase() + pet.gender.slice(1)}
                    </Text>
                  )}
                  {pet.dateOfBirth && (
                    <Text className="text-xs text-text-muted">
                      {calculateAge(pet.dateOfBirth)} years old
                    </Text>
                  )}
                  {pet.weight && (
                    <Text className="text-xs text-text-muted">
                      {pet.weight} kg
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Owner info */}
            <TouchableOpacity
              className="flex-row items-center bg-gray-50 rounded-xl p-2.5 mt-3"
              onPress={() =>
                router.push({
                  pathname: '/profile-modal',
                  params: { userId: pet.owner._id },
                })
              }
            >
              {pet.owner.profileImage ? (
                <Image
                  source={{ uri: pet.owner.profileImage }}
                  style={{ width: 28, height: 28, borderRadius: 14 }}
                />
              ) : (
                <View className="w-7 h-7 rounded-full bg-gray-200 items-center justify-center">
                  <Ionicons name="person" size={14} color="#6B7280" />
                </View>
              )}
              <View className="flex-1 ml-2">
                <Text className="text-sm font-semibold text-text-primary">
                  Owner: {pet.owner.name}
                </Text>
                {pet.owner.phone && (
                  <Text className="text-xs text-text-muted">
                    {pet.owner.phone}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Records Header */}
        <View className="flex-row items-center justify-between px-4 mt-5 mb-3">
          <Text className="text-base font-bold text-text-primary">
            Health Records ({records.length})
          </Text>
          <TouchableOpacity
            onPress={() => setShowAddRecord(true)}
            className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-full"
          >
            <Ionicons name="add" size={16} color="#00897B" />
            <Text className="text-xs font-semibold text-primary ml-1">
              Add Record
            </Text>
          </TouchableOpacity>
        </View>

        {/* Records List */}
        {records.length === 0 ? (
          <View className="mx-4 bg-white rounded-2xl p-8 items-center border border-gray-100">
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text className="text-base text-text-muted mt-3">
              No health records yet
            </Text>
            <Text className="text-sm text-text-muted mt-1 text-center">
              Add the first medical record for this pet
            </Text>
          </View>
        ) : (
          records.map((record) => {
            const typeInfo =
              RECORD_TYPE_ICONS[record.recordType] || RECORD_TYPE_ICONS.other;
            return (
              <View
                key={record._id}
                className="bg-white mx-4 mb-2.5 rounded-xl p-3.5 border border-gray-100"
              >
                <View className="flex-row items-center mb-2">
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                    style={{ backgroundColor: typeInfo.color + '20' }}
                  >
                    <Ionicons
                      name={typeInfo.icon as any}
                      size={16}
                      color={typeInfo.color}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-text-primary">
                      {record.title}
                    </Text>
                    <Text className="text-[10px] text-text-muted">
                      {record.recordType.charAt(0).toUpperCase() +
                        record.recordType.slice(1)}{' '}
                      • {formatDate(record.date)}
                    </Text>
                  </View>
                </View>
                {record.description ? (
                  <Text
                    className="text-xs text-text-muted mb-1 leading-4"
                    numberOfLines={3}
                  >
                    {record.description}
                  </Text>
                ) : null}
                {record.notes ? (
                  <View className="bg-gray-50 rounded-lg p-2 mt-1">
                    <Text className="text-[10px] text-text-muted font-semibold mb-0.5">
                      Notes:
                    </Text>
                    <Text
                      className="text-xs text-text-primary"
                      numberOfLines={3}
                    >
                      {record.notes}
                    </Text>
                  </View>
                ) : null}
                {record.veterinarian?.name ? (
                  <Text className="text-[10px] text-text-muted mt-1.5">
                    Dr. {record.veterinarian.name}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Record Modal — full-screen so Android keyboard resize works */}
      <Modal visible={showAddRecord} animationType="slide">
        <SafeAreaView className="flex-1 bg-white">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <View className="flex-row justify-between items-center px-6 pt-4 pb-3 border-b border-gray-100">
              <Text className="text-lg font-bold text-text-primary">
                Add Health Record
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddRecord(false)}
                className="p-1"
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 16,
                paddingBottom: 40,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Record Type */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Record Type *
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                {RECORD_TYPES.map((type) => {
                  const info =
                    RECORD_TYPE_ICONS[type] || RECORD_TYPE_ICONS.other;
                  const selected = recordType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setRecordType(type)}
                      className={`px-3 py-2 rounded-full mr-2 border ${
                        selected
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          selected ? 'text-primary' : 'text-text-muted'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Title */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Title *
              </Text>
              <TextInput
                placeholder="e.g. Annual Checkup, Rabies Vaccine"
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
                className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
              />

              {/* Description */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Description
              </Text>
              <TextInput
                placeholder="Detailed findings, measurements, diagnoses..."
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
                style={{ textAlignVertical: 'top', minHeight: 80 }}
              />

              {/* Notes */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Notes / Instructions
              </Text>
              <TextInput
                placeholder="Follow-up instructions, medications prescribed..."
                placeholderTextColor="#9CA3AF"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-6"
                style={{ textAlignVertical: 'top', minHeight: 80 }}
              />

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleAddRecord}
                disabled={submitting}
                className={`py-3.5 rounded-xl items-center mb-4 ${
                  submitting ? 'bg-primary/60' : 'bg-primary'
                }`}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base">
                    Save Record
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};
