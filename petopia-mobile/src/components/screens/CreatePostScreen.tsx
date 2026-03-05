import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Avatar } from '../common/Avatar';
import { useAlert } from '../ui/CustomAlert';
import { Button } from '../common/Button';
import { createPost, uploadPostMedia } from '../../store/slices/postSlice';
import { fetchPets } from '../../store/slices/petSlice';
import { RootState, AppDispatch } from '../../store/store';
import type { MediaItem } from '../../store/slices/postSlice';

const MAX_MEDIA = 10;

interface LocalMedia {
  uri: string;
  type: 'image' | 'video';
  fileName?: string;
}

export const CreatePostScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const { pets } = useSelector((state: RootState) => state.pets);
  const { showAlert } = useAlert();

  const [content, setContent] = useState('');
  const [localMedia, setLocalMedia] = useState<LocalMedia[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(fetchPets());
  }, [dispatch]);

  /* ── Media picker ── */
  const pickMedia = async () => {
    if (localMedia.length >= MAX_MEDIA) {
      showAlert({
        title: 'Limit reached',
        message: `You can add up to ${MAX_MEDIA} items.`,
        variant: 'warning',
      });
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert({
        title: 'Permission needed',
        message: 'Gallery access is required.',
        variant: 'warning',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - localMedia.length,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const newItems: LocalMedia[] = result.assets.map((a) => ({
      uri: a.uri,
      type: (a.type === 'video' ? 'video' : 'image') as 'image' | 'video',
      fileName: a.fileName || undefined,
    }));

    setLocalMedia((prev) => [...prev, ...newItems].slice(0, MAX_MEDIA));
  };

  const takePhoto = async () => {
    if (localMedia.length >= MAX_MEDIA) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert({
        title: 'Permission needed',
        message: 'Camera access is required.',
        variant: 'warning',
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    setLocalMedia((prev) => [
      ...prev,
      {
        uri: result.assets[0].uri,
        type: 'image' as const,
        fileName: result.assets[0].fileName || undefined,
      },
    ]);
  };

  const removeMedia = (index: number) => {
    setLocalMedia((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── Tags ── */
  const addTag = () => {
    const trimmed = tagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!content.trim() && localMedia.length === 0) {
      showAlert({
        title: 'Empty post',
        message: 'Write something or add media.',
        variant: 'warning',
      });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload media if any
      let uploadedMedia: MediaItem[] = [];
      if (localMedia.length > 0 && token) {
        const files = localMedia.map((m) => ({
          uri: m.uri,
          type: m.type,
          fileName: m.fileName,
        }));
        uploadedMedia = await uploadPostMedia(files, token);
      }

      // 2. Create post
      await dispatch(
        createPost({
          content: content.trim(),
          media: uploadedMedia,
          tags: tags.length > 0 ? tags : undefined,
          petId: selectedPetId || undefined,
        }),
      ).unwrap();

      router.back();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err?.message || err || 'Failed to create post',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canPost = content.trim().length > 0 || localMedia.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-bg-main">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ─── Header ─── */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-bg-alt bg-white">
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="close" size={26} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-text-primary">New Post</Text>
          <Button
            size="sm"
            onPress={handleSubmit}
            disabled={submitting || !canPost}
          >
            {submitting ? 'Posting…' : 'Post'}
          </Button>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* ─── Compose card: author + text ─── */}
          <View
            className="mx-4 mt-4 bg-white rounded-2xl"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
              elevation: 1,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <View className="flex-row items-center px-4 pt-4 pb-2">
              <Avatar
                initials={user?.name?.[0] || '?'}
                source={
                  user?.profileImage ? { uri: user.profileImage } : undefined
                }
                size="md"
              />
              <Text className="ml-3 text-base font-semibold text-text-primary">
                {user?.name || 'You'}
              </Text>
            </View>

            <TextInput
              placeholder="What's on your mind?"
              placeholderTextColor="#9CA3AF"
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              className="px-4 py-2 text-base text-text-primary min-h-[120px] leading-6"
              maxLength={2000}
            />
          </View>

          {/* ─── Media preview card ─── */}
          {localMedia.length > 0 && (
            <View
              className="mx-4 mt-3 bg-white rounded-2xl py-3"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 3,
                elevation: 1,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              <Text className="text-xs font-semibold text-text-muted uppercase tracking-wide px-4 mb-2">
                Media
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                }}
              >
                {localMedia.map((m, i) => (
                  <View key={i} className="mr-2 relative">
                    <Image
                      source={{ uri: m.uri }}
                      style={{ width: 100, height: 100, borderRadius: 12 }}
                      contentFit="cover"
                    />
                    {m.type === 'video' && (
                      <View className="absolute inset-0 items-center justify-center">
                        <Ionicons name="play-circle" size={28} color="white" />
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => removeMedia(i)}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 items-center justify-center"
                    >
                      <Ionicons name="close" size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ─── Tags card ─── */}
          <View
            className="mx-4 mt-3 bg-white rounded-2xl px-4 py-3"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
              elevation: 1,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            {tags.length > 0 && (
              <View className="flex-row flex-wrap mb-2 gap-2">
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => removeTag(tag)}
                    className="flex-row items-center bg-primary-light/15 rounded-full px-3 py-1"
                  >
                    <Text className="text-xs font-medium text-primary-dark">
                      #{tag}
                    </Text>
                    <Ionicons
                      name="close-circle"
                      size={14}
                      color="#00897B"
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View className="flex-row items-center">
              <Ionicons name="pricetag-outline" size={18} color="#6B7280" />
              <TextInput
                placeholder="Add tag and press enter"
                placeholderTextColor="#9CA3AF"
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                returnKeyType="done"
                className="flex-1 ml-2 text-sm text-text-primary py-1"
                maxLength={30}
              />
            </View>
          </View>

          {/* ─── Pet tagging card ─── */}
          {pets.length > 0 && (
            <View
              className="mx-4 mt-3 bg-white rounded-2xl px-4 py-3"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 3,
                elevation: 1,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              <Text className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Tag a pet
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {pets.map((pet: any) => (
                  <TouchableOpacity
                    key={pet._id}
                    onPress={() =>
                      setSelectedPetId(
                        selectedPetId === pet._id ? null : pet._id,
                      )
                    }
                    className={
                      selectedPetId === pet._id
                        ? 'px-4 py-2 rounded-full mr-2 border bg-primary border-primary'
                        : 'px-4 py-2 rounded-full mr-2 border bg-white border-gray-200'
                    }
                  >
                    <Text
                      className={
                        selectedPetId === pet._id
                          ? 'text-sm font-medium text-white'
                          : 'text-sm font-medium text-text-primary'
                      }
                    >
                      {pet.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ─── Action bar card ─── */}
          <View
            className="mx-4 mt-3 bg-white rounded-2xl flex-row items-center px-4 py-4 gap-4"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
              elevation: 1,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <TouchableOpacity
              onPress={pickMedia}
              activeOpacity={0.7}
              className="flex-row items-center"
            >
              <Ionicons name="image-outline" size={24} color="#4DB6AC" />
              <Text className="text-sm text-primary-dark font-medium ml-1.5">
                Gallery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={takePhoto}
              activeOpacity={0.7}
              className="flex-row items-center"
            >
              <Ionicons name="camera-outline" size={24} color="#4DB6AC" />
              <Text className="text-sm text-primary-dark font-medium ml-1.5">
                Camera
              </Text>
            </TouchableOpacity>

            {localMedia.length > 0 && (
              <Text className="text-xs text-text-muted ml-auto">
                {localMedia.length}/{MAX_MEDIA}
              </Text>
            )}
          </View>
        </ScrollView>

        {/* ─── Submitting overlay ─── */}
        {submitting && (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
          >
            <ActivityIndicator size="large" color="#4DB6AC" />
            <Text className="text-sm text-text-muted mt-3">
              Uploading & posting…
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
