import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../common/Avatar';
import { useAlert } from '../ui/CustomAlert';
import { PostCard } from '../social/PostCard';
import { SharePostModal } from '../social/SharePostModal';
import {
  fetchPostDetail,
  fetchComments,
  addComment,
  toggleLike,
  toggleCommentLike,
  deleteComment,
  deletePost,
  clearComments,
} from '../../store/slices/postSlice';
import { RootState, AppDispatch } from '../../store/store';
import type { Comment } from '../../store/slices/postSlice';

// ────────────────────────────────────────
// Time-ago helper
// ────────────────────────────────────────
const getTimeAgo = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ────────────────────────────────────────
// CommentItem
// ────────────────────────────────────────
interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onLike: (commentId: string) => void;
  onReply: (commentId: string, authorName: string) => void;
  onDelete: (commentId: string) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  onLike,
  onReply,
  onDelete,
}) => {
  const authorName = comment.author?.name || 'Unknown';
  const isOwn = currentUserId === comment.author?._id;

  return (
    <View className="flex-row px-4 py-3">
      <Avatar
        initials={authorName[0]}
        source={
          comment.author?.profileImage
            ? { uri: comment.author.profileImage }
            : undefined
        }
        size="sm"
      />
      <View className="flex-1 ml-3">
        <View
          className="rounded-xl px-3 py-2"
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
        >
          <Text className="text-sm font-semibold" style={{ color: '#1F2937' }}>
            {authorName}
          </Text>
          <Text
            className="text-sm mt-0.5 leading-5"
            style={{ color: '#374151' }}
          >
            {comment.content}
          </Text>
        </View>

        {/* Comment actions */}
        <View className="flex-row items-center mt-1.5 gap-4 pl-1">
          <Text className="text-xs" style={{ color: '#6B7280' }}>
            {getTimeAgo(comment.createdAt)}
          </Text>

          <TouchableOpacity
            onPress={() => onLike(comment._id)}
            className="flex-row items-center"
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: comment.isLiked ? '#EF4444' : '#4B5563' }}
            >
              Like
            </Text>
            {comment.likesCount > 0 && (
              <Text className="text-xs ml-1" style={{ color: '#6B7280' }}>
                {comment.likesCount}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onReply(comment._id, authorName)}>
            <Text
              className="text-xs font-semibold"
              style={{ color: '#4B5563' }}
            >
              Reply
            </Text>
          </TouchableOpacity>

          {isOwn && (
            <TouchableOpacity onPress={() => onDelete(comment._id)}>
              <Text
                className="text-xs font-semibold"
                style={{ color: '#EF4444' }}
              >
                Delete
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// ────────────────────────────────────────
// PostDetailScreen
// ────────────────────────────────────────
export const PostDetailScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { showAlert } = useAlert();

  const { user } = useSelector((state: RootState) => state.auth);
  const { activePost, comments, commentsLoading, commentsPagination } =
    useSelector((state: RootState) => state.posts);

  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{
    commentId: string;
    authorName: string;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const loadingMore = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  /* ── Keyboard tracking ── */
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  /* ── Load post + comments ── */
  useEffect(() => {
    if (postId) {
      dispatch(fetchPostDetail(postId));
      dispatch(clearComments());
      dispatch(fetchComments({ postId, page: 1 }));
    }
  }, [dispatch, postId]);

  /* ── Infinite scroll for comments ── */
  const handleLoadMore = useCallback(() => {
    if (
      !postId ||
      loadingMore.current ||
      commentsLoading ||
      commentsPagination.page >= commentsPagination.pages
    )
      return;
    loadingMore.current = true;
    dispatch(
      fetchComments({ postId, page: commentsPagination.page + 1 }),
    ).finally(() => {
      loadingMore.current = false;
    });
  }, [dispatch, postId, commentsLoading, commentsPagination]);

  /* ── Comment actions ── */
  const handleLikeComment = useCallback(
    (commentId: string) => dispatch(toggleCommentLike(commentId)),
    [dispatch],
  );

  const handleReply = useCallback((commentId: string, authorName: string) => {
    setReplyTo({ commentId, authorName });
    inputRef.current?.focus();
  }, []);

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      if (!postId) return;
      showAlert({
        title: 'Delete comment',
        message: 'Are you sure?',
        variant: 'confirm',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => dispatch(deleteComment({ commentId, postId })),
          },
        ],
      });
    },
    [dispatch, postId, showAlert],
  );

  const handleSendComment = async () => {
    if (!commentText.trim() || !postId) return;
    setSending(true);
    try {
      await dispatch(
        addComment({
          postId,
          content: commentText.trim(),
          parentCommentId: replyTo?.commentId,
        }),
      ).unwrap();
      setCommentText('');
      setReplyTo(null);
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to add comment',
        variant: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  /* ── Post actions ── */
  const handleLike = useCallback(
    (id: string) => dispatch(toggleLike(id)),
    [dispatch],
  );

  const handleShare = useCallback((id: string) => setSharePostId(id), []);

  const handleAuthorPress = useCallback(
    (userId: string) => {
      if (userId === user?._id) return;
      router.push({ pathname: '/profile-modal', params: { userId } });
    },
    [router, user],
  );

  const handleEditPost = useCallback(
    (id: string) =>
      router.push({ pathname: '/create-post', params: { postId: id } }),
    [router],
  );

  const handleDeletePost = useCallback(
    (id: string) => {
      dispatch(deletePost(id)).then(() => router.back());
    },
    [dispatch, router],
  );

  /* ── Render ── */
  const renderComment = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentItem
        comment={item}
        currentUserId={user?._id}
        onLike={handleLikeComment}
        onReply={handleReply}
        onDelete={handleDeleteComment}
      />
    ),
    [user?._id, handleLikeComment, handleReply, handleDeleteComment],
  );

  const ListHeader = activePost ? (
    <View>
      <PostCard
        post={activePost}
        currentUserId={user?._id}
        onLike={handleLike}
        onShare={handleShare}
        onAuthorPress={handleAuthorPress}
        onEdit={handleEditPost}
        onDelete={handleDeletePost}
      />
      <View
        className="px-4 py-3"
        style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
      >
        <Text className="text-sm font-bold" style={{ color: '#1F2937' }}>
          Comments ({activePost.commentsCount})
        </Text>
      </View>
    </View>
  ) : null;

  const ListEmpty = !commentsLoading ? (
    <View className="items-center py-10">
      <Text className="text-sm" style={{ color: '#6B7280' }}>
        No comments yet. Be the first!
      </Text>
    </View>
  ) : null;

  const ListFooter =
    commentsLoading && comments.length > 0 ? (
      <View className="py-4 items-center">
        <ActivityIndicator color="#4DB6AC" />
      </View>
    ) : (
      <View className="h-4" />
    );

  if (!activePost && !commentsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main items-center justify-center">
        <ActivityIndicator size="large" color="#4DB6AC" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-bg-main"
      edges={['top', 'left', 'right']}
    >
      <View className="flex-1">
        {/* ─── Header ─── */}
        <View className="flex-row items-center px-4 py-3 border-b border-bg-alt bg-white">
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="flex-1 ml-3 text-lg font-bold text-text-primary">
            Post
          </Text>
        </View>

        {/* ─── Comments list (with post header) ─── */}
        <FlatList
          ref={flatListRef}
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          ListFooterComponent={ListFooter}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        />

        {/* ─── Reply indicator ─── */}
        {replyTo && (
          <View
            className="flex-row items-center px-4 py-2"
            style={{
              backgroundColor: '#F3F4F6',
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
            }}
          >
            <Text className="text-xs flex-1" style={{ color: '#6B7280' }}>
              Replying to{' '}
              <Text className="font-semibold" style={{ color: '#00897B' }}>
                {replyTo.authorName}
              </Text>
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Comment input ─── */}
        <View
          className="flex-row items-end px-4 py-2"
          style={{
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
          }}
        >
          <Avatar
            initials={user?.name?.[0] || '?'}
            source={user?.profileImage ? { uri: user.profileImage } : undefined}
            size="sm"
          />
          <TextInput
            ref={inputRef}
            placeholder="Write a comment..."
            placeholderTextColor="#9CA3AF"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            className="flex-1 mx-3 rounded-2xl px-4 py-2 text-sm max-h-24"
            style={{ backgroundColor: '#F3F4F6', color: '#1F2937' }}
          />
          <TouchableOpacity
            onPress={handleSendComment}
            disabled={sending || !commentText.trim()}
            activeOpacity={0.7}
            className="pb-1"
          >
            <Ionicons
              name="send"
              size={22}
              color={commentText.trim() ? '#4DB6AC' : '#D1D5DB'}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom spacer – accounts for keyboard or home-indicator */}
        <View
          style={{
            height: keyboardHeight > 0 ? keyboardHeight : insets.bottom,
          }}
        />
      </View>
      <SharePostModal
        visible={sharePostId !== null}
        postId={sharePostId}
        onClose={() => setSharePostId(null)}
      />
    </SafeAreaView>
  );
};
