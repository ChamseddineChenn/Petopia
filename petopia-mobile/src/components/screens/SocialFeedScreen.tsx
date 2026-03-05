import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../common/Avatar';
import { PostCard } from '../social/PostCard';
import { SharePostModal } from '../social/SharePostModal';
import { useRefresh } from '../../hooks/useRefresh';
import {
  fetchFeed,
  toggleLike,
  deletePost,
} from '../../store/slices/postSlice';
import { RootState, AppDispatch } from '../../store/store';
import type { Post } from '../../store/slices/postSlice';

export const SocialFeedScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user } = useSelector((state: RootState) => state.auth);
  const { feed, feedLoading, pagination } = useSelector(
    (state: RootState) => state.posts,
  );

  const loadingMore = useRef(false);
  const [sharePostId, setSharePostId] = useState<string | null>(null);

  /* ── Initial load ── */
  useEffect(() => {
    dispatch(fetchFeed(1));
  }, [dispatch]);

  /* ── Pull-to-refresh ── */
  const handleRefresh = async () => {
    await dispatch(fetchFeed(1));
  };
  const { refreshControl } = useRefresh(handleRefresh);

  /* ── Infinite scroll ── */
  const handleEndReached = useCallback(() => {
    if (
      loadingMore.current ||
      feedLoading ||
      pagination.page >= pagination.pages
    )
      return;
    loadingMore.current = true;
    dispatch(fetchFeed(pagination.page + 1)).finally(() => {
      loadingMore.current = false;
    });
  }, [dispatch, feedLoading, pagination]);

  /* ── Callbacks ── */
  const handleLike = useCallback(
    (postId: string) => dispatch(toggleLike(postId)),
    [dispatch],
  );

  const handleComment = useCallback(
    (postId: string) =>
      router.push({ pathname: '/post-detail', params: { postId } }),
    [router],
  );

  const handleShare = useCallback(
    (postId: string) => setSharePostId(postId),
    [],
  );

  const handlePostPress = useCallback(
    (postId: string) =>
      router.push({ pathname: '/post-detail', params: { postId } }),
    [router],
  );

  const handleAuthorPress = useCallback(
    (userId: string) => {
      if (userId === user?._id) return;
      router.push({ pathname: '/profile-modal', params: { userId } });
    },
    [router, user],
  );

  const handleEdit = useCallback(
    (postId: string) =>
      router.push({ pathname: '/create-post', params: { postId } }),
    [router],
  );

  const handleDelete = useCallback(
    (postId: string) => {
      dispatch(deletePost(postId));
    },
    [dispatch],
  );

  /* ── Renderers ── */
  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        post={item}
        currentUserId={user?._id}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onPress={handlePostPress}
        onAuthorPress={handleAuthorPress}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    ),
    [
      handleLike,
      handleComment,
      handleShare,
      handlePostPress,
      handleAuthorPress,
      handleEdit,
      handleDelete,
      user?._id,
    ],
  );

  const ListHeader = (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push('/create-post')}
      className="bg-white flex-row items-center px-4 py-3 mb-2"
      style={{
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
      }}
    >
      <Avatar
        initials={user?.name?.[0] || '?'}
        source={user?.profileImage ? { uri: user.profileImage } : undefined}
        size="sm"
      />
      <Text className="flex-1 ml-3 text-sm text-text-muted">
        Share a moment...
      </Text>
      <View className="flex-row items-center gap-3">
        <Ionicons name="image-outline" size={20} color="#4DB6AC" />
        <Ionicons name="location-outline" size={20} color="#4DB6AC" />
      </View>
    </TouchableOpacity>
  );

  const ListEmpty = !feedLoading ? (
    <View className="items-center py-20">
      <View
        className="w-16 h-16 rounded-full items-center justify-center mb-4"
        style={{ backgroundColor: '#E0F2F1' }}
      >
        <Ionicons name="newspaper-outline" size={32} color="#4DB6AC" />
      </View>
      <Text className="text-lg font-semibold text-text-primary mb-2">
        No posts yet
      </Text>
      <Text className="text-sm text-text-muted text-center leading-5 px-8">
        Be the first to share a moment! Tap above to create your first post.
      </Text>
    </View>
  ) : null;

  const ListFooter =
    feedLoading && feed.length > 0 ? (
      <View className="py-6 items-center">
        <ActivityIndicator color="#4DB6AC" />
      </View>
    ) : (
      <View className="h-16" />
    );

  return (
    <SafeAreaView className="flex-1 bg-bg-main">
      <FlatList
        data={feed}
        renderItem={renderPost}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingTop: 0 }}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
      />
      <SharePostModal
        visible={sharePostId !== null}
        postId={sharePostId}
        onClose={() => setSharePostId(null)}
      />
    </SafeAreaView>
  );
};
