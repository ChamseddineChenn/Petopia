import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../common/ScreenHeader';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { pickImage, takePhoto, uploadImage } from '../../services/ImageService';
import { updateProfile, fetchProfile } from '../../store/slices/authSlice';
import { RootState, AppDispatch } from '../../store/store';
import { useAlert } from '../ui/CustomAlert';

export const EditProfileScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const { showAlert } = useAlert();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setLocation(user.location || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handlePickImage = () => {
    showAlert({
      title: 'Profile Photo',
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
        message: 'Name is required',
        variant: 'warning',
      });
      return;
    }
    setSaving(true);

    try {
      let profileImageUrl: string | undefined;

      if (imageUri && token) {
        setUploadingPhoto(true);
        try {
          const result = await uploadImage(imageUri, 'petopia/users', token);
          profileImageUrl = result.url;
        } catch {
          // Continue without new image
        }
        setUploadingPhoto(false);
      }

      const data: Record<string, any> = {
        name: name.trim(),
        bio: bio.trim(),
        location: location.trim(),
        phone: phone.trim(),
      };
      if (profileImageUrl) data.profileImage = profileImageUrl;

      await dispatch(updateProfile(data)).unwrap();
      dispatch(fetchProfile());
      showAlert({
        title: 'Success',
        message: 'Profile updated successfully',
        variant: 'success',
      });
      router.back();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to update profile',
        variant: 'error',
      });
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  };

  const displayImage = imageUri || user?.profileImage;

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader title="Edit Profile" />

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
          {/* Profile Photo */}
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
                <Avatar initials={user?.name?.[0] || 'U'} size="xl" />
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
            placeholder="Your name"
            placeholderTextColor="#9CA3AF"
            className="bg-white rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
          />

          {/* Bio */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Bio
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            className="bg-white rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
            style={{ textAlignVertical: 'top', minHeight: 80 }}
          />

          {/* Location */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Location
          </Text>
          <View className="flex-row items-center bg-white rounded-xl border border-gray-200 mb-4">
            <View className="pl-4">
              <Ionicons name="location-outline" size={18} color="#6B7280" />
            </View>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="City, Country"
              placeholderTextColor="#9CA3AF"
              className="flex-1 px-3 py-3 text-base text-text-primary"
            />
          </View>

          {/* Phone */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Phone
          </Text>
          <View className="flex-row items-center bg-white rounded-xl border border-gray-200 mb-4">
            <View className="pl-4">
              <Ionicons name="call-outline" size={18} color="#6B7280" />
            </View>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 234 567 8900"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              className="flex-1 px-3 py-3 text-base text-text-primary"
            />
          </View>

          {/* Email (read-only) */}
          <Text className="text-sm font-semibold text-text-primary mb-2">
            Email
          </Text>
          <View className="flex-row items-center bg-gray-100 rounded-xl border border-gray-200 mb-6">
            <View className="pl-4">
              <Ionicons name="mail-outline" size={18} color="#9CA3AF" />
            </View>
            <Text className="flex-1 px-3 py-3 text-base text-text-muted">
              {user?.email || ''}
            </Text>
          </View>

          <Button onPress={handleSave} disabled={saving || !name.trim()}>
            {uploadingPhoto
              ? 'Uploading Photo...'
              : saving
                ? 'Saving...'
                : 'Save Profile'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
