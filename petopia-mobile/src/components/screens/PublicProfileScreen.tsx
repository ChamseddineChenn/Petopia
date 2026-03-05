import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar } from '../common/Avatar';
import { useAlert } from '../ui/CustomAlert';
import { Button } from '../common/Button';
import { PostCard } from '../social/PostCard';
import { SharePostModal } from '../social/SharePostModal';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchPublicProfile,
  followUser,
  unfollowUser,
  clearProfile,
  ProfilePet,
  ProfilePost,
} from '../../store/slices/profileSlice';
import { toggleLike } from '../../store/slices/postSlice';
import { startConversation } from '../../store/slices/chatSlice';
import type { Post } from '../../store/slices/postSlice';

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

const ROLE_LABELS: Record<string, string> = {
  user: 'Pet Owner',
  vet: 'Veterinarian',
  groomer: 'Groomer',
  pet_sitter: 'Pet Sitter',
  pet_shop: 'Pet Shop',
};

export const PublicProfileScreen: React.FC = () => {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();

  const { profile, pets, posts, shop, loading, followLoading } = useSelector(
    (state: RootState) => state.profile,
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const { user: currentUser } = useSelector((state: RootState) => state.auth);

  // Adapt ProfilePost to Post shape for PostCard
  const toPost = (p: ProfilePost): Post =>
    ({
      ...p,
      media: p.media || [],
      tags: p.tags || [],
      sharesCount: p.sharesCount ?? 0,
      isLiked: false,
      updatedAt: p.createdAt,
    }) as unknown as Post;

  const loadProfile = useCallback(() => {
    if (userId) {
      dispatch(fetchPublicProfile(userId));
    }
  }, [userId, dispatch]);

  useEffect(() => {
    loadProfile();
    return () => {
      dispatch(clearProfile());
    };
  }, [loadProfile, dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchPublicProfile(userId!));
    setRefreshing(false);
  };

  const handleFollow = () => {
    if (!userId) return;
    dispatch(followUser(userId));
  };

  const handleUnfollow = () => {
    if (!userId) return;
    showAlert({
      title: 'Unfollow',
      message: `Stop following ${profile?.name}?`,
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: () => dispatch(unfollowUser(userId)),
        },
      ],
    });
  };

  const handleMessage = async () => {
    if (!userId) return;
    try {
      const result = await dispatch(
        startConversation({ recipientId: userId }),
      ).unwrap();
      router.push({
        pathname: '/chat' as any,
        params: {
          conversationId: result._id,
          recipientName: profile?.name || 'User',
          recipientImage: profile?.profileImage || '',
          recipientId: userId,
        },
      });
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Could not start conversation',
        variant: 'error',
      });
    }
  };

  const handleShopPress = () => {
    if (!shop) return;
    if (shop.type === 'vet') {
      router.push({ pathname: '/vet-clinic', params: { clinicId: shop._id } });
    } else if (shop.type === 'groomer') {
      router.push({ pathname: '/groomer-shop', params: { shopId: shop._id } });
    }
  };

  if (loading && !profile) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
        <View className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <Ionicons name="chevron-back" size={24} color="#00897B" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-text-primary">Profile</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#00897B" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
        <View className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <Ionicons name="chevron-back" size={24} color="#00897B" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-text-primary">Profile</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="person-outline" size={64} color="#D1D5DB" />
          <Text className="text-lg text-text-muted mt-4">User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canViewContent =
    !profile.isPrivate || profile.isFollowing || profile.isOwnProfile;

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="chevron-back" size={24} color="#00897B" />
        </TouchableOpacity>
        <Text
          className="text-xl font-bold text-text-primary flex-1"
          numberOfLines={1}
        >
          {profile.name}
        </Text>
        {profile.isPrivate && (
          <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4DB6AC"
          />
        }
      >
        {/* Profile Header Card */}
        <View className="bg-white rounded-2xl mx-4 mt-3 mb-4 p-4 border border-bg-alt">
          <View className="flex-row items-center mb-4">
            {profile.profileImage ? (
              <Image
                source={{ uri: profile.profileImage }}
                style={{ width: 80, height: 80, borderRadius: 40 }}
              />
            ) : (
              <Avatar initials={profile.name?.[0] || 'U'} size="xl" />
            )}
            <View className="flex-1 flex-row justify-around ml-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-primary">
                  {profile.petsCount}
                </Text>
                <Text className="text-sm text-text-muted mt-1">Pets</Text>
              </View>
              <TouchableOpacity
                className="items-center"
                onPress={() =>
                  router.push({
                    pathname: '/follow-list' as any,
                    params: { userId: profile._id, type: 'followers' },
                  })
                }
              >
                <Text className="text-2xl font-bold text-primary">
                  {profile.followersCount}
                </Text>
                <Text className="text-sm text-text-muted mt-1">Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="items-center"
                onPress={() =>
                  router.push({
                    pathname: '/follow-list' as any,
                    params: { userId: profile._id, type: 'following' },
                  })
                }
              >
                <Text className="text-2xl font-bold text-primary">
                  {profile.followingCount}
                </Text>
                <Text className="text-sm text-text-muted mt-1">Following</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text className="text-lg font-bold text-text-primary mb-1">
            {profile.name}
          </Text>

          {/* Role badge */}
          {profile.role && profile.role !== 'user' && (
            <View className="flex-row items-center mb-1">
              <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                <Text className="text-xs font-semibold text-primary">
                  {ROLE_LABELS[profile.role] || profile.role}
                </Text>
              </View>
            </View>
          )}

          <Text className="text-base text-text-muted mb-1">
            {profile.bio || 'No bio yet'}
          </Text>

          {profile.location ? (
            <View className="flex-row items-center mb-2">
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text className="text-sm text-text-muted ml-1">
                {profile.location}
              </Text>
            </View>
          ) : null}

          {/* Follow / Unfollow + Message buttons (only for other users) */}
          {!profile.isOwnProfile && (
            <View className="mt-2 gap-2">
              <View className="flex-row gap-2">
                {/* Follow / Unfollow */}
                <View className="flex-1">
                  {profile.isFollowing ? (
                    <TouchableOpacity
                      onPress={handleUnfollow}
                      disabled={followLoading}
                      className="py-2.5 rounded-xl border border-gray-300 items-center"
                    >
                      <Text className="text-sm font-semibold text-text-primary">
                        {followLoading ? 'Loading...' : 'Following'}
                      </Text>
                    </TouchableOpacity>
                  ) : profile.followRequestStatus === 'pending' ? (
                    <TouchableOpacity
                      onPress={handleUnfollow}
                      disabled={followLoading}
                      className="py-2.5 rounded-xl border border-gray-300 items-center"
                    >
                      <Text className="text-sm font-semibold text-text-muted">
                        {followLoading ? 'Loading...' : 'Requested'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Button onPress={handleFollow} disabled={followLoading}>
                      {followLoading ? 'Loading...' : 'Follow'}
                    </Button>
                  )}
                </View>

                {/* Message */}
                <View className="flex-1">
                  <TouchableOpacity
                    onPress={handleMessage}
                    className="py-2.5 rounded-xl border border-gray-300 items-center flex-row justify-center gap-1.5"
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={16}
                      color="#1F2937"
                    />
                    <Text className="text-sm font-semibold text-text-primary">
                      Message
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Shop/Clinic Banner */}
        {shop && (
          <TouchableOpacity
            onPress={handleShopPress}
            className="bg-white rounded-2xl mx-4 mb-4 p-4 border border-bg-alt flex-row items-center"
            activeOpacity={0.7}
          >
            {shop.logo ? (
              <Image
                source={{ uri: shop.logo }}
                style={{ width: 48, height: 48, borderRadius: 12 }}
              />
            ) : (
              <View className="w-12 h-12 rounded-xl bg-primary/15 items-center justify-center">
                <MaterialCommunityIcons
                  name={
                    shop.type === 'vet' ? 'hospital-building' : 'content-cut'
                  }
                  size={24}
                  color="#00897B"
                />
              </View>
            )}
            <View className="flex-1 ml-3">
              <Text className="text-base font-semibold text-text-primary">
                {shop.clinicName || shop.shopName}
              </Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text className="text-xs text-text-muted ml-1">
                  {shop.averageRating?.toFixed(1) || '0.0'} (
                  {shop.totalReviews || 0} reviews)
                </Text>
              </View>
            </View>
            <View className="bg-primary/10 px-3 py-1.5 rounded-full">
              <Text className="text-xs font-semibold text-primary">
                Visit {shop.type === 'vet' ? 'Clinic' : 'Shop'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Private Profile Lock */}
        {!canViewContent && (
          <View className="mx-4 mb-4 bg-white rounded-2xl p-8 items-center border border-bg-alt">
            <Ionicons name="lock-closed-outline" size={48} color="#D1D5DB" />
            <Text className="text-lg font-semibold text-text-primary mt-4">
              This Account is Private
            </Text>
            <Text className="text-sm text-text-muted mt-2 text-center">
              Follow this account to see their pets and posts.
            </Text>
          </View>
        )}

        {/* Pets Section */}
        {canViewContent && pets.length > 0 && (
          <View className="mx-4 mb-4">
            <Text className="text-lg font-semibold text-text-primary mb-3">
              Pets
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {pets.map((pet: ProfilePet) => (
                <View
                  key={pet._id}
                  className="bg-white rounded-xl p-3 mr-3 items-center border border-bg-alt"
                  style={{ width: 100 }}
                >
                  {pet.profileImage ? (
                    <Image
                      source={{ uri: pet.profileImage }}
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                  ) : (
                    <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
                      <MaterialCommunityIcons
                        name={(SPECIES_ICON[pet.species] || 'paw') as any}
                        size={24}
                        color="#00897B"
                      />
                    </View>
                  )}
                  <Text
                    className="text-sm font-semibold text-text-primary text-center mt-2"
                    numberOfLines={1}
                  >
                    {pet.name}
                  </Text>
                  <Text
                    className="text-xs text-text-muted mt-0.5"
                    numberOfLines={1}
                  >
                    {pet.breed || pet.species}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Posts Section */}
        {canViewContent && (
          <View className="mx-4 mb-4">
            <Text className="text-lg font-semibold text-text-primary mb-3">
              Posts
            </Text>

            {posts.length === 0 ? (
              <View className="bg-white rounded-xl p-6 items-center border border-bg-alt">
                <Text className="text-base text-text-muted">No posts yet</Text>
              </View>
            ) : (
              posts.map((post: ProfilePost) => (
                <PostCard
                  key={post._id}
                  post={toPost(post)}
                  currentUserId={currentUser?._id}
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
                  onAuthorPress={(uid) => {
                    if (uid !== userId) {
                      router.push({
                        pathname: '/profile-modal' as any,
                        params: { userId: uid },
                      });
                    }
                  }}
                />
              ))
            )}
          </View>
        )}

        {/* Member since */}
        {profile.createdAt && (
          <View className="mx-4 mb-4 items-center py-3">
            <Text className="text-xs text-text-muted">
              Member since{' '}
              {new Date(profile.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        )}
      </ScrollView>
      <SharePostModal
        visible={sharePostId !== null}
        postId={sharePostId}
        onClose={() => setSharePostId(null)}
      />
    </SafeAreaView>
  );
};
