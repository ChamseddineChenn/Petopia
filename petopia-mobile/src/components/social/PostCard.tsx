import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../common/Avatar';
import { useAlert } from '../ui/CustomAlert';
import { MediaCarousel } from './MediaCarousel';
import type { Post } from '../../store/slices/postSlice';

// ────────────────────────────────────────
// Helpers
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

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

// ────────────────────────────────────────
// Props
// ────────────────────────────────────────
interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onPress?: (postId: string) => void;
  onAuthorPress?: (userId: string) => void;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
}

// ────────────────────────────────────────
// Shared Post Embed
// ────────────────────────────────────────
const SharedPostEmbed: React.FC<{
  post: Post;
  onPress?: (id: string) => void;
}> = ({ post, onPress }) => {
  const authorName = post.author?.name || 'Unknown';
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress?.(post._id)}
      className="border border-gray-200 rounded-xl overflow-hidden mx-4 mb-3"
    >
      {/* Embed header */}
      <View className="flex-row items-center px-3 py-2">
        <Avatar
          initials={authorName[0]}
          source={
            post.author?.profileImage
              ? { uri: post.author.profileImage }
              : undefined
          }
          size="sm"
        />
        <Text
          className="ml-2 text-sm font-semibold text-text-primary"
          numberOfLines={1}
        >
          {authorName}
        </Text>
        <Text className="ml-2 text-xs text-text-muted">
          {getTimeAgo(post.createdAt)}
        </Text>
      </View>

      {/* Text */}
      {post.content ? (
        <Text
          className="px-3 py-2 text-sm text-text-secondary"
          numberOfLines={3}
        >
          {post.content}
        </Text>
      ) : null}

      {/* Media (small) */}
      {post.media && post.media.length > 0 && (
        <MediaCarousel media={post.media} height={180} />
      )}
    </TouchableOpacity>
  );
};

// ────────────────────────────────────────
// PostCard
// ────────────────────────────────────────
export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  onLike,
  onComment,
  onShare,
  onPress,
  onAuthorPress,
  onEdit,
  onDelete,
}) => {
  const authorName = post.author?.name || 'Unknown';
  const petName = post.pet?.name || '';
  const isOwner = currentUserId === post.author?._id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [cardWidth, setCardWidth] = useState(0);
  const { showAlert } = useAlert();

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0 && w !== cardWidth) setCardWidth(w);
    },
    [cardWidth],
  );

  const handleDelete = () => {
    setMenuOpen(false);
    showAlert({
      title: 'Delete Post',
      message: 'Are you sure you want to delete this post?',
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(post._id),
        },
      ],
    });
  };

  return (
    <View
      onLayout={handleLayout}
      className="bg-white mb-2"
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
      }}
    >
      {/* ─── Header ─── */}
      <View className="px-4 py-3 flex-row items-center">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onAuthorPress?.(post.author?._id)}
          className="flex-row items-center flex-1"
        >
          <Avatar
            initials={authorName[0]}
            source={
              post.author?.profileImage
                ? { uri: post.author.profileImage }
                : undefined
            }
            size="md"
          />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-text-primary">
              {authorName}
            </Text>
            <Text className="text-xs text-text-muted mt-0.5">
              {petName ? `${petName} \u2022 ` : ''}
              {getTimeAgo(post.createdAt)}
              {post.location?.name ? ` \u2022 ${post.location.name}` : ''}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 3-dot menu — visible only to post owner */}
        {isOwner && (
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            activeOpacity={0.7}
            className="p-1"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Owner menu modal ─── */}
      <Modal visible={menuOpen} transparent animationType="fade">
        <Pressable
          className="flex-1"
          onPress={() => setMenuOpen(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          <View className="flex-1 justify-end">
            <View className="bg-white rounded-t-3xl px-6 pb-8 pt-4">
              <View className="w-10 h-1 rounded-full bg-gray-300 self-center mb-5" />

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setMenuOpen(false);
                  onEdit?.(post._id);
                }}
                className="flex-row items-center py-3.5"
              >
                <Ionicons name="create-outline" size={22} color="#1F2937" />
                <Text className="ml-3 text-base font-medium text-text-primary">
                  Edit Post
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleDelete}
                className="flex-row items-center py-3.5"
              >
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
                <Text className="ml-3 text-base font-medium text-red-500">
                  Delete Post
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setMenuOpen(false)}
                className="items-center py-3 mt-2"
              >
                <Text className="text-base font-medium text-text-muted">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Content text ─── */}
      {post.content ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPress?.(post._id)}
        >
          <Text className="px-4 pb-3 text-base text-text-primary leading-6">
            {post.content}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* ─── Tags ─── */}
      {post.tags && post.tags.length > 0 && (
        <View className="flex-row flex-wrap px-4 pb-2 gap-1.5">
          {post.tags.map((tag) => (
            <View
              key={tag}
              className="bg-primary-light/15 rounded-full px-2.5 py-0.5"
            >
              <Text className="text-xs font-medium text-primary-dark">
                #{tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ─── Media ─── */}
      {post.media && post.media.length > 0 && cardWidth > 0 && (
        <MediaCarousel
          media={post.media}
          width={cardWidth}
          post={post}
          onLike={onLike}
          onComment={onComment}
        />
      )}

      {/* ─── Shared Post Embed ─── */}
      {post.sharedPost && (
        <SharedPostEmbed post={post.sharedPost} onPress={onPress} />
      )}

      {/* ─── Action bar ─── */}
      <View className="flex-row items-center px-4 py-2.5 border-t border-bg-alt">
        {/* Like */}
        <TouchableOpacity
          onPress={() => onLike?.(post._id)}
          activeOpacity={0.7}
          className="flex-row items-center mr-6"
        >
          <Ionicons
            name={post.isLiked ? 'heart' : 'heart-outline'}
            size={21}
            color={post.isLiked ? '#EF4444' : '#6B7280'}
          />
          {post.likesCount > 0 && (
            <Text className="text-xs text-text-muted font-medium ml-1.5">
              {formatCount(post.likesCount)}
            </Text>
          )}
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity
          onPress={() => onComment?.(post._id)}
          activeOpacity={0.7}
          className="flex-row items-center mr-6"
        >
          <Ionicons name="chatbubble-outline" size={19} color="#6B7280" />
          {post.commentsCount > 0 && (
            <Text className="text-xs text-text-muted font-medium ml-1.5">
              {formatCount(post.commentsCount)}
            </Text>
          )}
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          onPress={() => onShare?.(post._id)}
          activeOpacity={0.7}
          className="flex-row items-center"
        >
          <Ionicons name="repeat-outline" size={20} color="#6B7280" />
          {post.sharesCount > 0 && (
            <Text className="text-xs text-text-muted font-medium ml-1.5">
              {formatCount(post.sharesCount)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
