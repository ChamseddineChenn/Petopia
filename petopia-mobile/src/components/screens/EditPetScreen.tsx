import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '../common/ScreenHeader';
import { Button } from '../common/Button';
import { pickImage, takePhoto, uploadImage } from '../../services/ImageService';
import { updatePet, fetchPets } from '../../store/slices/petSlice';
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

const SPECIES_OPTIONS = [
  'dog',
  'cat',
  'bird',
  'fish',
  'rabbit',
  'hamster',
  'turtle',
  'other',
];

export const EditPetScreen: React.FC = () => {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { pets } = useSelector((state: RootState) => state.pets);
  const { token } = useSelector((state: RootState) => state.auth);
  const pet = pets.find((p) => p._id === petId);
  const { showAlert } = useAlert();

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('dog');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState('unknown');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weight, setWeight] = useState('');
  const [color, setColor] = useState('');
  const [bio, setBio] = useState('');
  const [isNeutered, setIsNeutered] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (pet) {
      setName(pet.name);
      setSpecies(pet.species);
      setBreed(pet.breed || '');
      setGender(pet.gender);
      setDob(pet.dateOfBirth ? new Date(pet.dateOfBirth) : null);
      setWeight(pet.weight ? String(pet.weight) : '');
      setColor(pet.color || '');
      setBio(pet.bio || '');
      setIsNeutered(pet.isNeutered || false);
    }
  }, [pet]);

  const handlePickImage = () => {
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
              if (uri) setImageUri(uri);
            } catch (e: any) {
              showAlert({
                title: 'Error',
                message: e.message,
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
              if (uri) setImageUri(uri);
            } catch (e: any) {
              showAlert({
                title: 'Error',
                message: e.message,
                variant: 'error',
              });
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert({
        title: 'Error',
        message: 'Pet name is required',
        variant: 'warning',
      });
      return;
    }
    if (!petId) return;
    setSaving(true);

    try {
      let profileImage: string | undefined;

      if (imageUri && token) {
        setUploadingPhoto(true);
        try {
          const result = await uploadImage(imageUri, 'petopia/pets', token);
          profileImage = result.url;
        } catch {
          // Continue without new image
        }
        setUploadingPhoto(false);
      }

      const data: Record<string, any> = {
        name: name.trim(),
        species,
        breed: breed.trim(),
        gender,
        isNeutered,
      };

      if (dob) data.dateOfBirth = dob.toISOString();
      if (weight) data.weight = parseFloat(weight);
      if (color.trim()) data.color = color.trim();
      if (bio.trim()) data.bio = bio.trim();
      if (profileImage) data.profileImage = profileImage;

      await dispatch(updatePet({ petId, data })).unwrap();
      dispatch(fetchPets());
      showAlert({
        title: 'Success',
        message: 'Pet updated successfully',
        variant: 'success',
      });
      router.back();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to update pet',
        variant: 'error',
      });
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  };

  if (!pet) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
        <ScreenHeader title="Edit Pet" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted text-base">Pet not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayImage = imageUri || pet.profileImage;

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader title={`Edit ${pet.name}`} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 40,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          bounces={true}
        >
          {/* Photo */}
          <TouchableOpacity
            onPress={handlePickImage}
            className="items-center mb-6"
          >
            <View style={{ position: 'relative', width: 100, height: 100 }}>
              {displayImage ? (
                <Image
                  source={{ uri: displayImage }}
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                />
              ) : (
                <View className="w-[100px] h-[100px] rounded-full bg-primary-light/20 items-center justify-center">
                  <MaterialCommunityIcons
                    name={(SPECIES_ICON[species] || 'paw') as any}
                    size={44}
                    color="#00897B"
                  />
                </View>
              )}
              <View
                style={{ position: 'absolute', bottom: 0, right: 0 }}
                className="bg-primary w-7 h-7 rounded-full items-center justify-center border-2 border-white"
              >
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </View>
            <Text className="text-xs text-primary mt-2">Change Photo</Text>
          </TouchableOpacity>

          {/* Name */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Name *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Pet name"
            placeholderTextColor="#9CA3AF"
            className="bg-white rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
          />

          {/* Species */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Species
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            {SPECIES_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSpecies(s)}
                className={`px-4 py-2 rounded-full mr-2 border flex-row items-center ${
                  species === s
                    ? 'bg-primary border-primary'
                    : 'bg-white border-gray-200'
                }`}
              >
                <MaterialCommunityIcons
                  name={(SPECIES_ICON[s] || 'paw') as any}
                  size={16}
                  color={species === s ? '#FFFFFF' : '#00897B'}
                />
                <Text
                  className={`text-sm font-medium ml-1 capitalize ${
                    species === s ? 'text-white' : 'text-text-primary'
                  }`}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Breed */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Breed
          </Text>
          <TextInput
            value={breed}
            onChangeText={setBreed}
            placeholder="e.g. Golden Retriever"
            placeholderTextColor="#9CA3AF"
            className="bg-white rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
          />

          {/* Gender */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Gender
          </Text>
          <View className="flex-row gap-2 mb-4">
            {[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'unknown', label: 'Unknown' },
            ].map((g) => (
              <TouchableOpacity
                key={g.value}
                onPress={() => setGender(g.value)}
                className={`flex-1 py-2 rounded-xl items-center border ${
                  gender === g.value
                    ? 'bg-primary border-primary'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    gender === g.value ? 'text-white' : 'text-text-primary'
                  }`}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date of Birth */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Date of Birth
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="bg-white rounded-xl px-4 py-3 border border-gray-200 mb-4 flex-row items-center"
          >
            <Ionicons name="calendar-outline" size={18} color="#6B7280" />
            <Text className="text-base text-text-primary ml-2">
              {dob
                ? dob.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Select date'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dob || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(_, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setDob(date);
              }}
            />
          )}

          {/* Weight */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Weight (kg)
          </Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="e.g. 12.5"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            className="bg-white rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
          />

          {/* Color */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Color / Markings
          </Text>
          <TextInput
            value={color}
            onChangeText={setColor}
            placeholder="e.g. Black and Tan"
            placeholderTextColor="#9CA3AF"
            className="bg-white rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
          />

          {/* Neutered */}
          <View className="flex-row items-center justify-between mb-4 bg-white rounded-xl px-4 py-3 border border-gray-200">
            <Text className="text-base text-text-primary">
              Neutered / Spayed
            </Text>
            <Switch
              value={isNeutered}
              onValueChange={setIsNeutered}
              trackColor={{ false: '#D1D5DB', true: '#80CBC4' }}
              thumbColor={isNeutered ? '#00897B' : '#F3F4F6'}
            />
          </View>

          {/* Bio */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Bio
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about your pet..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            className="bg-white rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-6"
            style={{ textAlignVertical: 'top', minHeight: 80 }}
          />

          <Button onPress={handleSave} disabled={saving || !name.trim()}>
            {uploadingPhoto
              ? 'Uploading Photo...'
              : saving
                ? 'Saving...'
                : 'Save Changes'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
