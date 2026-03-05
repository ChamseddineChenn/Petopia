import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { ScreenHeader } from '../common/ScreenHeader';
import { PostCard } from '../social/PostCard';
import { SharePostModal } from '../social/SharePostModal';
import { fetchProfile } from '../../store/slices/authSlice';
import { fetchPets, addPet, deletePet } from '../../store/slices/petSlice';
import {
  fetchMyPosts,
  toggleLike,
  deletePost,
} from '../../store/slices/postSlice';
import { pickImage, takePhoto, uploadImage } from '../../services/ImageService';
import { RootState, AppDispatch } from '../../store/store';
import { useRouter } from 'expo-router';
import { useRefresh } from '../../hooks/useRefresh';
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
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'bird', label: 'Bird' },
  { value: 'fish', label: 'Fish' },
  { value: 'rabbit', label: 'Rabbit' },
  { value: 'hamster', label: 'Hamster' },
  { value: 'turtle', label: 'Turtle' },
  { value: 'other', label: 'Other' },
];

export const ProfileScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const { pets } = useSelector((state: RootState) => state.pets);
  const { myPosts } = useSelector((state: RootState) => state.posts);
  const { showAlert } = useAlert();

  const [showAddPet, setShowAddPet] = useState(false);
  const [addingPet, setAddingPet] = useState(false);

  // Basic pet fields
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState('dog');
  const [petBreed, setPetBreed] = useState('');
  const [petGender, setPetGender] = useState('unknown');

  // Extended pet fields
  const [petDob, setPetDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [petWeight, setPetWeight] = useState('');
  const [petColor, setPetColor] = useState('');
  const [petBio, setPetBio] = useState('');
  const [petNeutered, setPetNeutered] = useState(false);
  const [petImageUri, setPetImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Multi-step form: 1 = basic, 2 = details
  const [formStep, setFormStep] = useState(1);

  // Share post modal
  const [sharePostId, setSharePostId] = useState<string | null>(null);

  const handleRefreshData = async () => {
    await Promise.all([
      dispatch(fetchProfile()),
      dispatch(fetchPets()),
      dispatch(fetchMyPosts()),
    ]);
  };

  const { refreshControl } = useRefresh(handleRefreshData);

  useEffect(() => {
    dispatch(fetchProfile());
    dispatch(fetchPets());
    dispatch(fetchMyPosts());
  }, [dispatch]);

  const resetPetForm = () => {
    setPetName('');
    setPetSpecies('dog');
    setPetBreed('');
    setPetGender('unknown');
    setPetDob(null);
    setPetWeight('');
    setPetColor('');
    setPetBio('');
    setPetNeutered(false);
    setPetImageUri(null);
    setFormStep(1);
  };

  const handlePickPetImage = () => {
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
              if (uri) setPetImageUri(uri);
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
              if (uri) setPetImageUri(uri);
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

  const handleAddPet = async () => {
    if (!petName.trim()) {
      showAlert({
        title: 'Error',
        message: 'Please enter a pet name',
        variant: 'warning',
      });
      return;
    }
    setAddingPet(true);
    try {
      let profileImageUrl: string | undefined;

      if (petImageUri && token) {
        setUploadingImage(true);
        try {
          const result = await uploadImage(petImageUri, 'petopia/pets', token);
          profileImageUrl = result.url;
        } catch {
          // Continue without image
        }
        setUploadingImage(false);
      }

      await dispatch(
        addPet({
          name: petName.trim(),
          species: petSpecies,
          breed: petBreed.trim(),
          gender: petGender,
          dateOfBirth: petDob ? petDob.toISOString() : undefined,
          weight: petWeight ? parseFloat(petWeight) : undefined,
          color: petColor.trim() || undefined,
          bio: petBio.trim() || undefined,
          isNeutered: petNeutered,
          profileImage: profileImageUrl,
        }),
      ).unwrap();
      setShowAddPet(false);
      resetPetForm();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to add pet',
        variant: 'error',
      });
    } finally {
      setAddingPet(false);
      setUploadingImage(false);
    }
  };

  const handleDeletePet = (petId: string, petName: string) => {
    showAlert({
      title: 'Delete Pet',
      message: `Remove ${petName} from your profile?`,
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => dispatch(deletePet(petId)),
          style: 'destructive',
        },
      ],
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const navigateToPetProfile = (petId: string) => {
    router.push({ pathname: '/pet-profile', params: { petId } });
  };

  const navigateToEditProfile = () => {
    router.push('/edit-profile');
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader
        title="Profile"
        rightAction={
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="settings-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        scrollEnabled={true}
        bounces={true}
      >
        {/* Profile Header */}
        <View className="bg-white rounded-2xl p-4 mt-3 mb-5 border border-bg-alt">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity onPress={navigateToEditProfile}>
              {user?.profileImage ? (
                <Image
                  source={{ uri: user.profileImage }}
                  style={{ width: 80, height: 80, borderRadius: 40 }}
                />
              ) : (
                <Avatar initials={user?.name?.[0] || 'U'} size="xl" />
              )}
              <View className="absolute bottom-0 right-0 bg-primary w-6 h-6 rounded-full items-center justify-center border-2 border-white">
                <Ionicons name="camera" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <View className="flex-1 flex-row justify-around ml-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-primary">
                  {user?.petsCount ?? pets.length}
                </Text>
                <Text className="text-sm text-text-muted mt-1">Pets</Text>
              </View>
              <TouchableOpacity
                className="items-center"
                onPress={() =>
                  router.push({
                    pathname: '/follow-list',
                    params: { userId: user?._id, type: 'followers' },
                  })
                }
              >
                <Text className="text-2xl font-bold text-primary">
                  {user?.followersCount ?? 0}
                </Text>
                <Text className="text-sm text-text-muted mt-1">Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="items-center"
                onPress={() =>
                  router.push({
                    pathname: '/follow-list',
                    params: { userId: user?._id, type: 'following' },
                  })
                }
              >
                <Text className="text-2xl font-bold text-primary">
                  {user?.followingCount ?? 0}
                </Text>
                <Text className="text-sm text-text-muted mt-1">Following</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text className="text-lg font-bold text-text-primary mb-1">
            {user?.name || 'User'}
          </Text>
          <Text className="text-base text-text-muted mb-1">
            {user?.bio || 'No bio yet'}
          </Text>
          {user?.location ? (
            <View className="flex-row items-center mb-3">
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text className="text-sm text-text-muted ml-1">
                {user.location}
              </Text>
            </View>
          ) : null}

          <Button onPress={navigateToEditProfile}>Edit Profile</Button>
          <TouchableOpacity
            className="flex-row items-center justify-center mt-2 py-2"
            onPress={() => router.push('/follow-management')}
          >
            <Ionicons name="people-outline" size={16} color="#4DB6AC" />
            <Text className="text-primary font-semibold text-sm ml-1">
              Manage Followers
            </Text>
          </TouchableOpacity>
        </View>

        {/* My Pets Section */}
        <View className="mb-5">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-text-primary">
              My Pets
            </Text>
            <TouchableOpacity onPress={() => setShowAddPet(true)}>
              <Text className="text-sm text-primary font-semibold">
                + Add Pet
              </Text>
            </TouchableOpacity>
          </View>

          {pets.length === 0 ? (
            <TouchableOpacity
              onPress={() => setShowAddPet(true)}
              className="bg-white rounded-xl p-6 items-center border border-dashed border-gray-300"
            >
              <View className="w-14 h-14 rounded-full bg-primary-light/20 items-center justify-center mb-2">
                <MaterialCommunityIcons name="paw" size={28} color="#4DB6AC" />
              </View>
              <Text className="text-base text-text-muted">
                Add your first pet
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {pets.map((pet) => (
                <TouchableOpacity
                  key={pet._id}
                  onPress={() => navigateToPetProfile(pet._id)}
                  onLongPress={() => handleDeletePet(pet._id, pet.name)}
                  className="w-[31%] bg-white rounded-xl p-3 items-center mb-1 border border-bg-alt"
                >
                  {pet.profileImage ? (
                    <Image
                      source={{ uri: pet.profileImage }}
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                  ) : (
                    <View className="w-12 h-12 rounded-full bg-primary-light/20 items-center justify-center">
                      <MaterialCommunityIcons
                        name={(SPECIES_ICON[pet.species] || 'paw') as any}
                        size={24}
                        color="#00897B"
                      />
                    </View>
                  )}
                  <Text
                    className="text-base font-semibold text-text-primary text-center mt-2"
                    numberOfLines={1}
                  >
                    {pet.name}
                  </Text>
                  <Text
                    className="text-xs text-text-muted mt-1 text-center"
                    numberOfLines={1}
                  >
                    {pet.breed || pet.species}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* My Clinic Section — Vet Only */}
        {user?.role === 'vet' && (
          <View className="mb-5">
            <Text className="text-lg font-semibold text-text-primary mb-3">
              My Clinic
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/manage-clinic')}
              className="bg-white rounded-2xl p-5 border border-bg-alt flex-row items-center"
            >
              <View className="w-12 h-12 rounded-full bg-primary/15 items-center justify-center mr-4">
                <MaterialCommunityIcons
                  name="hospital-building"
                  size={24}
                  color="#00897B"
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary">
                  Manage My Clinic
                </Text>
                <Text className="text-xs text-text-muted mt-1">
                  Create or edit your veterinary clinic profile
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* My Shop Section — Groomer Only */}
        {user?.role === 'groomer' && (
          <View className="mb-5">
            <Text className="text-lg font-semibold text-text-primary mb-3">
              My Shop
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/manage-groomer-shop')}
              className="bg-white rounded-2xl p-5 border border-bg-alt flex-row items-center"
            >
              <View className="w-12 h-12 rounded-full bg-primary/15 items-center justify-center mr-4">
                <MaterialCommunityIcons
                  name="content-cut"
                  size={24}
                  color="#00897B"
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary">
                  Manage My Shop
                </Text>
                <Text className="text-xs text-text-muted mt-1">
                  Create or edit your grooming shop profile
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* My Posts Section */}
        <View className="mb-5">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-text-primary">
              My Posts
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/create-post' as any,
                })
              }
            >
              <Text className="text-sm text-primary font-semibold">
                + New Post
              </Text>
            </TouchableOpacity>
          </View>

          {myPosts.length === 0 ? (
            <View className="bg-white rounded-xl p-6 items-center border border-gray-200">
              <Text className="text-base text-text-muted">No posts yet</Text>
              <Text className="text-sm text-text-muted mt-1">
                Share a moment on the Social tab!
              </Text>
            </View>
          ) : (
            myPosts.slice(0, 5).map((post) => (
              <PostCard
                key={post._id}
                post={post}
                currentUserId={user?._id}
                onLike={(id) => dispatch(toggleLike(id))}
                onComment={(id) =>
                  router.push({
                    pathname: '/post-detail' as any,
                    params: { postId: id },
                  })
                }
                onShare={(id) => setSharePostId(id)}
                onPress={(id) =>
                  router.push({
                    pathname: '/post-detail' as any,
                    params: { postId: id },
                  })
                }
                onAuthorPress={() => {}}
                onEdit={(id) =>
                  router.push({
                    pathname: '/create-post' as any,
                    params: { postId: id },
                  })
                }
                onDelete={(id) => dispatch(deletePost(id))}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Pet Modal — Multi-step */}
      <Modal visible={showAddPet} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <ScrollView
              bounces={true}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={true}
              style={{ maxHeight: 600 }}
            >
              <View className="bg-white rounded-t-3xl p-6">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-xl font-bold text-text-primary">
                    Add a Pet {formStep === 2 ? '— Details' : ''}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddPet(false);
                      resetPetForm();
                    }}
                  >
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Step indicators */}
                <View className="flex-row items-center mb-5">
                  <View
                    className={`flex-1 h-1 rounded-full mr-1 ${
                      formStep >= 1 ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  />
                  <View
                    className={`flex-1 h-1 rounded-full ml-1 ${
                      formStep >= 2 ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  />
                </View>

                {formStep === 1 ? (
                  <>
                    {/* Pet Photo */}
                    <TouchableOpacity
                      onPress={handlePickPetImage}
                      className="items-center mb-4"
                    >
                      {petImageUri ? (
                        <Image
                          source={{ uri: petImageUri }}
                          style={{ width: 80, height: 80, borderRadius: 40 }}
                        />
                      ) : (
                        <View className="w-20 h-20 rounded-full bg-primary-light/20 items-center justify-center">
                          <Ionicons
                            name="camera-outline"
                            size={28}
                            color="#00897B"
                          />
                        </View>
                      )}
                      <Text className="text-xs text-primary mt-1">
                        Add Photo
                      </Text>
                    </TouchableOpacity>

                    <Text className="text-sm font-semibold text-text-primary mb-2">
                      Name *
                    </Text>
                    <TextInput
                      placeholder="Pet name"
                      placeholderTextColor="#9CA3AF"
                      value={petName}
                      onChangeText={setPetName}
                      className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
                    />

                    <Text className="text-sm font-semibold text-text-primary mb-2">
                      Species *
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="mb-4"
                    >
                      {SPECIES_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setPetSpecies(opt.value)}
                          className={`px-4 py-2 rounded-full mr-2 border flex-row items-center ${
                            petSpecies === opt.value
                              ? 'bg-primary border-primary'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <MaterialCommunityIcons
                            name={(SPECIES_ICON[opt.value] || 'paw') as any}
                            size={16}
                            color={
                              petSpecies === opt.value ? '#FFFFFF' : '#00897B'
                            }
                          />
                          <Text
                            className={`text-sm font-medium ml-1 ${
                              petSpecies === opt.value
                                ? 'text-white'
                                : 'text-text-primary'
                            }`}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text className="text-sm font-semibold text-text-primary mb-2">
                      Breed
                    </Text>
                    <TextInput
                      placeholder="e.g. Golden Retriever"
                      placeholderTextColor="#9CA3AF"
                      value={petBreed}
                      onChangeText={setPetBreed}
                      className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
                    />

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
                          onPress={() => setPetGender(g.value)}
                          className={`flex-1 py-2 rounded-xl items-center border ${
                            petGender === g.value
                              ? 'bg-primary border-primary'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <Text
                            className={`text-sm font-medium ${
                              petGender === g.value
                                ? 'text-white'
                                : 'text-text-primary'
                            }`}
                          >
                            {g.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Button
                      onPress={() => setFormStep(2)}
                      disabled={!petName.trim()}
                    >
                      Next: More Details
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Date of Birth */}
                    <Text className="text-sm font-semibold text-text-primary mb-2">
                      Date of Birth
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(true)}
                      className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 mb-4 flex-row items-center"
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color="#6B7280"
                      />
                      <Text className="text-base text-text-primary ml-2">
                        {petDob
                          ? petDob.toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Select date'}
                      </Text>
                    </TouchableOpacity>
                    {Platform.OS === 'ios' && showDatePicker && (
                      <DateTimePicker
                        value={petDob || new Date()}
                        mode="date"
                        display="spinner"
                        maximumDate={new Date()}
                        onChange={(_, date) => {
                          setShowDatePicker(false);
                          if (date) setPetDob(date);
                        }}
                      />
                    )}

                    {/* Weight */}
                    <Text className="text-sm font-semibold text-text-primary mb-2">
                      Weight (kg)
                    </Text>
                    <TextInput
                      placeholder="e.g. 12.5"
                      placeholderTextColor="#9CA3AF"
                      value={petWeight}
                      onChangeText={setPetWeight}
                      keyboardType="decimal-pad"
                      className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
                    />

                    {/* Color */}
                    <Text className="text-sm font-semibold text-text-primary mb-2">
                      Color / Markings
                    </Text>
                    <TextInput
                      placeholder="e.g. Black and Tan"
                      placeholderTextColor="#9CA3AF"
                      value={petColor}
                      onChangeText={setPetColor}
                      className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
                    />

                    {/* Neutered */}
                    <View className="flex-row items-center justify-between mb-4 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                      <Text className="text-base text-text-primary">
                        Neutered / Spayed
                      </Text>
                      <Switch
                        value={petNeutered}
                        onValueChange={setPetNeutered}
                        trackColor={{ false: '#D1D5DB', true: '#80CBC4' }}
                        thumbColor={petNeutered ? '#00897B' : '#F3F4F6'}
                      />
                    </View>

                    {/* Bio */}
                    <Text className="text-sm font-semibold text-text-primary mb-2">
                      Bio
                    </Text>
                    <TextInput
                      placeholder="Tell us about your pet..."
                      placeholderTextColor="#9CA3AF"
                      value={petBio}
                      onChangeText={setPetBio}
                      multiline
                      numberOfLines={3}
                      className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
                      style={{ textAlignVertical: 'top', minHeight: 80 }}
                    />

                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => setFormStep(1)}
                        className="flex-1 py-3 rounded-xl items-center border border-gray-200"
                      >
                        <Text className="text-base font-semibold text-text-primary">
                          Back
                        </Text>
                      </TouchableOpacity>
                      <View className="flex-1">
                        <Button
                          onPress={handleAddPet}
                          disabled={addingPet || !petName.trim()}
                        >
                          {uploadingImage
                            ? 'Uploading...'
                            : addingPet
                              ? 'Adding...'
                              : 'Add Pet'}
                        </Button>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* Android DateTimePicker rendered outside Modal to avoid dialog conflicts */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={petDob || new Date()}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(_, date) => {
            setShowDatePicker(false);
            if (date) setPetDob(date);
          }}
        />
      )}
      <SharePostModal
        visible={sharePostId !== null}
        postId={sharePostId}
        onClose={() => setSharePostId(null)}
      />
    </SafeAreaView>
  );
};
