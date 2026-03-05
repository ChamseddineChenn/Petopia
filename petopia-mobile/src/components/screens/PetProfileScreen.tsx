import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '../common/ScreenHeader';
import { Button } from '../common/Button';
import { pickImage, takePhoto, uploadImage } from '../../services/ImageService';
import { fetchPets, updatePet } from '../../store/slices/petSlice';
import { fetchHealthRecords } from '../../store/slices/healthRecordSlice';
import { RootState, AppDispatch } from '../../store/store';
import { useAlert } from '../ui/CustomAlert';

const SPECIES_ICON: Record<string, string> = {
  dog: 'dog',
  cat: 'cat',
  bird: 'bird',
  fish: 'fish',
  rabbit: 'rabbit',
  hamster: 'rodent',
  turtle: 'turtle',
  other: 'paw',
};

export const PetProfileScreen: React.FC = () => {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { pets } = useSelector((state: RootState) => state.pets);
  const { token } = useSelector((state: RootState) => state.auth);
  const { records, loading: recordsLoading } = useSelector(
    (state: RootState) => state.healthRecords,
  );
  const { showAlert } = useAlert();

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const pet = pets.find((p) => p._id === petId);

  useEffect(() => {
    if (petId) {
      dispatch(fetchHealthRecords({ petId }));
    }
  }, [petId, dispatch]);

  const handleChangePhoto = useCallback(() => {
    showAlert({
      title: 'Pet Photo',
      message: 'Choose a source',
      variant: 'info',
      buttons: [
        {
          text: 'Camera',
          onPress: async () => {
            try {
              const uri = await takePhoto();
              if (uri && token && petId) {
                setUploadingPhoto(true);
                const result = await uploadImage(uri, 'petopia/pets', token);
                await dispatch(
                  updatePet({ petId, data: { profileImage: result.url } }),
                ).unwrap();
                dispatch(fetchPets());
                setUploadingPhoto(false);
              }
            } catch (e: any) {
              setUploadingPhoto(false);
              showAlert({
                title: 'Error',
                message: e.message || 'Failed to update photo',
                variant: 'error',
              });
            }
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            try {
              const uri = await pickImage();
              if (uri && token && petId) {
                setUploadingPhoto(true);
                const result = await uploadImage(uri, 'petopia/pets', token);
                await dispatch(
                  updatePet({ petId, data: { profileImage: result.url } }),
                ).unwrap();
                dispatch(fetchPets());
                setUploadingPhoto(false);
              }
            } catch (e: any) {
              setUploadingPhoto(false);
              showAlert({
                title: 'Error',
                message: e.message || 'Failed to update photo',
                variant: 'error',
              });
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  }, [token, petId, dispatch]);

  const getAge = (dob?: string) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    if (years > 0) {
      return months < 0 ? `${years - 1}y ${months + 12}m` : `${years}y`;
    }
    return months <= 0 ? 'Less than a month' : `${months}m`;
  };

  if (!pet) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
        <ScreenHeader title="Pet Profile" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted text-base">Pet not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const upcomingVaccinations = records.filter(
    (r) =>
      r.recordType === 'vaccination' &&
      r.vaccination?.nextDueDate &&
      new Date(r.vaccination.nextDueDate) > new Date(),
  );

  const recentRecords = [...records]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader
        title={pet.name}
        rightAction={
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: '/edit-pet', params: { petId } })
            }
          >
            <Ionicons name="create-outline" size={22} color="#00897B" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View className="items-center mt-4 mb-5">
          <TouchableOpacity
            onPress={handleChangePhoto}
            disabled={uploadingPhoto}
          >
            {pet.profileImage ? (
              <Image
                source={{ uri: pet.profileImage }}
                style={{ width: 120, height: 120, borderRadius: 60 }}
              />
            ) : (
              <View className="w-[120px] h-[120px] rounded-full bg-primary-light/20 items-center justify-center">
                <MaterialCommunityIcons
                  name={(SPECIES_ICON[pet.species] || 'paw') as any}
                  size={52}
                  color="#00897B"
                />
              </View>
            )}
            {uploadingPhoto ? (
              <View
                className="absolute inset-0 items-center justify-center bg-black/30 rounded-full"
                style={{ width: 120, height: 120 }}
              >
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <View className="absolute bottom-0 right-0 bg-primary w-8 h-8 rounded-full items-center justify-center border-2 border-white">
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-text-primary mt-3">
            {pet.name}
          </Text>
          <Text className="text-base text-text-muted capitalize">
            {pet.breed ? `${pet.breed} · ` : ''}
            {pet.species}
          </Text>
        </View>

        {/* Quick Info Cards */}
        <View className="flex-row flex-wrap gap-2 mb-5">
          {pet.gender && pet.gender !== 'unknown' && (
            <View className="bg-white rounded-xl px-4 py-3 border border-bg-alt flex-row items-center">
              <Ionicons
                name={pet.gender === 'male' ? 'male' : 'female'}
                size={18}
                color="#00897B"
              />
              <Text className="text-sm text-text-primary ml-2 capitalize">
                {pet.gender}
              </Text>
            </View>
          )}
          {pet.dateOfBirth && (
            <View className="bg-white rounded-xl px-4 py-3 border border-bg-alt flex-row items-center">
              <Ionicons name="calendar-outline" size={18} color="#00897B" />
              <Text className="text-sm text-text-primary ml-2">
                {getAge(pet.dateOfBirth)}
              </Text>
            </View>
          )}
          {pet.weight && (
            <View className="bg-white rounded-xl px-4 py-3 border border-bg-alt flex-row items-center">
              <MaterialCommunityIcons name="weight" size={18} color="#00897B" />
              <Text className="text-sm text-text-primary ml-2">
                {pet.weight} kg
              </Text>
            </View>
          )}
          {pet.color && (
            <View className="bg-white rounded-xl px-4 py-3 border border-bg-alt flex-row items-center">
              <Ionicons
                name="color-palette-outline"
                size={18}
                color="#00897B"
              />
              <Text className="text-sm text-text-primary ml-2">
                {pet.color}
              </Text>
            </View>
          )}
          {pet.isNeutered != null && (
            <View className="bg-white rounded-xl px-4 py-3 border border-bg-alt flex-row items-center">
              <MaterialCommunityIcons
                name="check-decagram"
                size={18}
                color={pet.isNeutered ? '#00897B' : '#9CA3AF'}
              />
              <Text className="text-sm text-text-primary ml-2">
                {pet.isNeutered ? 'Neutered' : 'Not Neutered'}
              </Text>
            </View>
          )}
        </View>

        {/* Bio */}
        {pet.bio ? (
          <View className="bg-white rounded-xl p-4 mb-5 border border-bg-alt">
            <Text className="text-sm font-semibold text-text-primary mb-2">
              About
            </Text>
            <Text className="text-base text-text-secondary leading-6">
              {pet.bio}
            </Text>
          </View>
        ) : null}

        {/* Upcoming Vaccinations */}
        {upcomingVaccinations.length > 0 && (
          <View className="bg-amber-50 rounded-xl p-4 mb-5 border border-amber-200">
            <View className="flex-row items-center mb-2">
              <Ionicons name="alert-circle" size={18} color="#F59E0B" />
              <Text className="text-sm font-semibold text-amber-800 ml-2">
                Upcoming Vaccinations
              </Text>
            </View>
            {upcomingVaccinations.slice(0, 3).map((rec) => (
              <View key={rec._id} className="flex-row justify-between py-1">
                <Text className="text-sm text-amber-700">
                  {rec.vaccination?.vaccineName || rec.title}
                </Text>
                <Text className="text-xs text-amber-600">
                  {rec.vaccination?.nextDueDate
                    ? new Date(rec.vaccination.nextDueDate).toLocaleDateString()
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Health Records Summary */}
        <View className="bg-white rounded-xl p-4 mb-5 border border-bg-alt">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-text-primary">
              Health Records
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/health-records',
                  params: { petId },
                })
              }
            >
              <Text className="text-sm text-primary font-semibold">
                View All
              </Text>
            </TouchableOpacity>
          </View>

          {recordsLoading ? (
            <ActivityIndicator color="#00897B" />
          ) : recentRecords.length === 0 ? (
            <Text className="text-sm text-text-muted text-center py-4">
              No health records yet
            </Text>
          ) : (
            recentRecords.map((rec) => (
              <View
                key={rec._id}
                className="flex-row items-center py-3 border-b border-bg-alt last:border-b-0"
              >
                <View className="w-8 h-8 rounded-full bg-primary-light/20 items-center justify-center mr-3">
                  <MaterialCommunityIcons
                    name={
                      rec.recordType === 'vaccination'
                        ? 'needle'
                        : rec.recordType === 'examination'
                          ? 'stethoscope'
                          : rec.recordType === 'surgery'
                            ? 'hospital-box'
                            : 'file-document-outline'
                    }
                    size={16}
                    color="#00897B"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-text-primary">
                    {rec.title}
                  </Text>
                  <Text className="text-xs text-text-muted capitalize">
                    {rec.recordType} · {new Date(rec.date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))
          )}

          <Button
            onPress={() =>
              router.push({
                pathname: '/health-records',
                params: { petId },
              })
            }
          >
            <View className="flex-row items-center justify-center">
              <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-1">
                Add Health Record
              </Text>
            </View>
          </Button>
        </View>

        {/* Actions */}
        <View className="flex-row gap-3 mb-5">
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: '/edit-pet', params: { petId } })
            }
            className="flex-1 bg-white rounded-xl p-4 items-center border border-bg-alt"
          >
            <Ionicons name="create-outline" size={24} color="#00897B" />
            <Text className="text-sm text-text-primary mt-1">Edit Info</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/health-records',
                params: { petId },
              })
            }
            className="flex-1 bg-white rounded-xl p-4 items-center border border-bg-alt"
          >
            <MaterialCommunityIcons
              name="medical-bag"
              size={24}
              color="#00897B"
            />
            <Text className="text-sm text-text-primary mt-1">
              Health Records
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
