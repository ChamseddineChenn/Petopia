import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar } from '../common/Avatar';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchMessages,
  sendMessage,
  markConversationRead,
  setActiveConversation,
  deleteConversation,
  blockUser,
  ChatMessage,
} from '../../store/slices/chatSlice';
import { getSocket } from '../../services/SocketService';
import { API_BASE_URL } from '../../config';
import { useAlert } from '../ui/CustomAlert';

// ========================================
// Helpers
// ========================================

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDateGroup = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== d.getFullYear() ? 'numeric' : undefined,
  });
};

const isSameDay = (a: string, b: string) => {
  const dA = new Date(a);
  const dB = new Date(b);
  return (
    dA.getFullYear() === dB.getFullYear() &&
    dA.getMonth() === dB.getMonth() &&
    dA.getDate() === dB.getDate()
  );
};

// ========================================
// Status Indicator
// ========================================

const StatusIndicator: React.FC<{ status: 'sent' | 'delivered' | 'seen' }> = ({
  status,
}) => {
  if (status === 'sent') {
    return <Ionicons name="checkmark" size={14} color="#9CA3AF" />;
  }
  if (status === 'delivered') {
    return (
      <View className="flex-row" style={{ marginLeft: -4 }}>
        <Ionicons name="checkmark-done" size={14} color="#9CA3AF" />
      </View>
    );
  }
  // seen
  return (
    <View className="flex-row" style={{ marginLeft: -4 }}>
      <Ionicons name="checkmark-done" size={14} color="#4DB6AC" />
    </View>
  );
};

// ========================================
// Shared Post Detection
// ========================================

const SHARED_POST_REGEX = /\[shared_post:([a-f0-9]{24})\]/i;

const parseSharedPost = (text: string) => {
  const match = text.match(SHARED_POST_REGEX);
  if (!match) return null;
  return match[1]; // postId
};

// ========================================
// Shared Post Card in Chat
// ========================================

const SharedPostCard: React.FC<{
  postId: string;
  isMine: boolean;
  onPress: (id: string) => void;
}> = ({ postId, isMine, onPress }) => {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/posts/${postId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && data.success) setPost(data.post);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [postId, token]);

  if (loading) {
    return (
      <View
        style={{
          width: 220,
          padding: 16,
          borderRadius: 12,
          backgroundColor: '#F9FAFB',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="small" color="#4DB6AC" />
      </View>
    );
  }

  if (!post) {
    return (
      <View
        style={{
          width: 220,
          padding: 12,
          borderRadius: 12,
          backgroundColor: '#F9FAFB',
        }}
      >
        <Text
          style={{
            fontSize: 13,
            color: '#9CA3AF',
            textAlign: 'center',
          }}
        >
          Post unavailable
        </Text>
      </View>
    );
  }

  const authorName = post.author?.name || 'Unknown';
  const firstImage = post.media?.[0]?.url;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(postId)}
      style={{
        width: 240,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
      }}
    >
      {firstImage && (
        <Image
          source={{ uri: firstImage }}
          style={{ width: '100%', height: 130 }}
          contentFit="cover"
        />
      )}
      <View style={{ padding: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          {post.author?.profileImage ? (
            <Image
              source={{ uri: post.author.profileImage }}
              style={{ width: 20, height: 20, borderRadius: 10 }}
            />
          ) : (
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#4DB6AC',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                {authorName[0]}
              </Text>
            </View>
          )}
          <Text
            numberOfLines={1}
            style={{
              marginLeft: 6,
              fontSize: 12,
              fontWeight: '600',
              color: '#1F2937',
              flex: 1,
            }}
          >
            {authorName}
          </Text>
        </View>
        {post.content ? (
          <Text
            numberOfLines={2}
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: '#374151',
            }}
          >
            {post.content}
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 6,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="heart" size={12} color="#EF4444" />
            <Text
              style={{
                fontSize: 11,
                marginLeft: 3,
                color: '#6B7280',
              }}
            >
              {post.likesCount || 0}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="chatbubble-outline" size={11} color="#6B7280" />
            <Text
              style={{
                fontSize: 11,
                marginLeft: 3,
                color: '#6B7280',
              }}
            >
              {post.commentsCount || 0}
            </Text>
          </View>
        </View>
      </View>
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingVertical: 6,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: '#4DB6AC',
          }}
        >
          View Post
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ========================================
// Message Bubble
// ========================================

const MessageBubble: React.FC<{
  message: ChatMessage;
  isMine: boolean;
  showTail: boolean;
}> = ({ message, isMine, showTail }) => {
  const router = useRouter();
  const sharedPostId = parseSharedPost(message.text);

  // Strip the shared post tag and the "Shared a post with you" preamble
  const cleanText = sharedPostId
    ? message.text
        .replace(SHARED_POST_REGEX, '')
        .replace(/Shared a post with you\s*/i, '')
        .trim()
    : message.text;

  return (
    <View
      className={isMine ? 'items-end mb-0.5 px-3' : 'items-start mb-0.5 px-3'}
      style={showTail ? { marginBottom: 6 } : {}}
    >
      {sharedPostId ? (
        /* Shared Post bubble */
        <View style={{ maxWidth: '82%' }}>
          {cleanText ? (
            <View
              className={
                isMine
                  ? 'bg-primary rounded-2xl rounded-br-sm px-3.5 py-2 mb-1.5'
                  : 'bg-white rounded-2xl rounded-bl-sm px-3.5 py-2 mb-1.5 border border-gray-100'
              }
            >
              <Text
                className={
                  isMine
                    ? 'text-[15px] text-white leading-5'
                    : 'text-[15px] text-text-primary leading-5'
                }
              >
                {cleanText}
              </Text>
            </View>
          ) : null}
          <SharedPostCard
            postId={sharedPostId}
            isMine={isMine}
            onPress={(id) =>
              router.push({
                pathname: '/post-detail' as any,
                params: { postId: id },
              })
            }
          />
        </View>
      ) : (
        /* Normal text bubble */
        <View
          className={
            isMine
              ? 'bg-primary rounded-2xl rounded-br-sm px-3.5 py-2 max-w-[78%]'
              : 'bg-white rounded-2xl rounded-bl-sm px-3.5 py-2 max-w-[78%] border border-gray-100'
          }
        >
          <Text
            className={
              isMine
                ? 'text-[15px] text-white leading-5'
                : 'text-[15px] text-text-primary leading-5'
            }
          >
            {message.text}
          </Text>
        </View>
      )}
      {/* Timestamp + status */}
      <View
        className={
          isMine
            ? 'flex-row items-center mt-1 gap-1'
            : 'flex-row items-center mt-1'
        }
      >
        <Text className="text-[10px] text-text-muted">
          {formatTime(message.createdAt)}
        </Text>
        {isMine && <StatusIndicator status={message.status} />}
      </View>
    </View>
  );
};

// ========================================
// Chat Screen
// ========================================

export const ChatScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{
    conversationId: string;
    recipientName: string;
    recipientImage: string;
    recipientId: string;
    shopId: string;
    shopType: string;
    shopOwnerId: string;
    shopName: string;
  }>();

  const {
    conversationId,
    recipientName,
    recipientImage,
    recipientId,
    shopId,
    shopType,
    shopOwnerId,
    shopName,
  } = params;

  const { activeMessages, messagesLoading, sendingMessage, hasMoreMessages } =
    useSelector((state: RootState) => state.chat);
  const { user } = useSelector((state: RootState) => state.auth);
  const currentUserId = user?._id;
  const insets = useSafeAreaInsets();

  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Find conversation to get shop context
  const conversation = useSelector(
    (state: RootState) =>
      state.chat.conversations.find((c) => c._id === conversationId) ||
      state.chat.requests.find((c) => c._id === conversationId),
  );
  // Derive shop context from route params or conversation
  const isShopChat = !!(shopId || conversation?.shopContext?.shopId);
  const resolvedShopType = shopType || conversation?.shopContext?.shopType;
  const resolvedShopId = shopId || conversation?.shopContext?.shopId;
  const resolvedShopOwnerId =
    shopOwnerId || conversation?.shopContext?.shopOwnerId;
  const resolvedShopName = shopName || conversation?.shopContext?.shopName;
  const isShopOwner = isShopChat && resolvedShopOwnerId === currentUserId;
  const shopLabel = resolvedShopName || null;

  // Join conversation room on mount
  useEffect(() => {
    if (!conversationId) return;

    dispatch(setActiveConversation(conversationId));
    dispatch(fetchMessages({ conversationId }));
    dispatch(markConversationRead(conversationId));

    const socket = getSocket();
    socket?.emit('join_conversation', conversationId);

    // Listen for typing
    const handleTyping = (data: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (
        data.conversationId === conversationId &&
        data.userId !== currentUserId
      ) {
        setIsTyping(data.isTyping);
      }
    };
    socket?.on('user_typing', handleTyping);

    return () => {
      socket?.off('user_typing', handleTyping);
      socket?.emit('leave_conversation', conversationId);
      dispatch(setActiveConversation(null));
    };
  }, [conversationId, dispatch, currentUserId]);

  // Emit typing events
  const handleTextChange = (value: string) => {
    setText(value);
    const socket = getSocket();
    if (!socket || !conversationId) return;

    socket.emit('typing', { conversationId, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { conversationId, isTyping: false });
    }, 2000);
  };

  // Send message
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !conversationId || sendingMessage) return;

    dispatch(sendMessage({ conversationId, text: trimmed }));
    setText('');

    // Stop typing
    const socket = getSocket();
    socket?.emit('typing', { conversationId, isTyping: false });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  // Load older messages
  const handleLoadMore = () => {
    if (messagesLoading || !hasMoreMessages || activeMessages.length === 0)
      return;
    const oldest = activeMessages[0];
    dispatch(
      fetchMessages({ conversationId: conversationId!, before: oldest._id }),
    );
  };

  // Delete conversation handler
  const handleDeleteChat = useCallback(() => {
    showAlert({
      title: 'Delete Chat',
      message:
        'This will permanently delete this conversation and all its messages.',
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!conversationId) return;
            try {
              await dispatch(deleteConversation(conversationId)).unwrap();
              router.back();
            } catch (err: any) {
              showAlert({
                title: 'Error',
                message: err || 'Failed to delete conversation',
                variant: 'error',
              });
            }
          },
        },
      ],
    });
  }, [conversationId, dispatch, router, showAlert]);

  // Block user handler
  const handleBlockUser = useCallback(() => {
    showAlert({
      title: 'Block User',
      message: `Block ${recipientName || 'this user'}? This will also delete the conversation. They won't be able to message you.`,
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (!recipientId) return;
            try {
              await dispatch(blockUser(recipientId)).unwrap();
              router.back();
            } catch (err: any) {
              showAlert({
                title: 'Error',
                message: err || 'Failed to block user',
                variant: 'error',
              });
            }
          },
        },
      ],
    });
  }, [recipientId, recipientName, dispatch, router, showAlert]);

  // Show options menu
  const handleShowOptions = useCallback(() => {
    showAlert({
      title: 'Options',
      variant: 'info',
      buttons: [
        {
          text: 'Delete Chat',
          style: 'destructive',
          onPress: handleDeleteChat,
        },
        { text: 'Block User', style: 'destructive', onPress: handleBlockUser },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  }, [handleDeleteChat, handleBlockUser, showAlert]);

  // Mark as read when NEW messages arrive while the chat is open
  // (skip the initial load — the mount useEffect already handles that)
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (
      conversationId &&
      activeMessages.length > prevMsgCountRef.current &&
      prevMsgCountRef.current > 0
    ) {
      dispatch(markConversationRead(conversationId));
    }
    prevMsgCountRef.current = activeMessages.length;
  }, [activeMessages.length, conversationId, dispatch]);

  // Build list items with date separators
  const listData: (
    | { type: 'message'; data: ChatMessage }
    | { type: 'date'; date: string }
  )[] = [];
  for (let i = 0; i < activeMessages.length; i++) {
    const msg = activeMessages[i];
    if (i === 0 || !isSameDay(activeMessages[i - 1].createdAt, msg.createdAt)) {
      listData.push({ type: 'date', date: msg.createdAt });
    }
    listData.push({ type: 'message', data: msg });
  }

  const renderItem = ({
    item,
    index,
  }: {
    item: (typeof listData)[0];
    index: number;
  }) => {
    if (item.type === 'date') {
      return (
        <View className="items-center my-3">
          <View className="bg-gray-100 rounded-full px-3 py-1">
            <Text className="text-xs text-text-muted font-medium">
              {formatDateGroup(item.date)}
            </Text>
          </View>
        </View>
      );
    }

    const msg = item.data;
    const senderId =
      typeof msg.sender === 'string' ? msg.sender : msg.sender?._id;
    const isMine = senderId === currentUserId;

    // Show tail if next message is from different sender or is a date separator
    const nextItem = listData[index + 1];
    let showTail = true;
    if (nextItem && nextItem.type === 'message') {
      const nextSenderId =
        typeof nextItem.data.sender === 'string'
          ? nextItem.data.sender
          : nextItem.data.sender?._id;
      showTail = nextSenderId !== senderId;
    }

    return <MessageBubble message={msg} isMine={isMine} showTail={showTail} />;
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center bg-white px-3 py-3 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-1 mr-2"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#1F2937" />
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center flex-1"
          onPress={() => {
            if (isShopChat && !isShopOwner && resolvedShopId) {
              // Customer taps header → navigate to shop/clinic page
              if (resolvedShopType === 'clinic') {
                router.push({
                  pathname: '/vet-clinic' as any,
                  params: { clinicId: resolvedShopId },
                });
              } else {
                router.push({
                  pathname: '/groomer-shop' as any,
                  params: { shopId: resolvedShopId },
                });
              }
            } else if (recipientId) {
              // Shop owner or regular chat → navigate to user profile
              router.push({
                pathname: '/profile-modal' as any,
                params: { userId: recipientId },
              });
            }
          }}
          activeOpacity={0.7}
        >
          {recipientImage ? (
            <Image
              source={{ uri: recipientImage }}
              style={{ width: 38, height: 38, borderRadius: 19 }}
            />
          ) : shopLabel ? (
            <View
              className="items-center justify-center bg-primary-light/20"
              style={{ width: 38, height: 38, borderRadius: 19 }}
            >
              <Ionicons
                name={
                  conversation?.shopContext?.shopType === 'clinic'
                    ? 'medkit'
                    : 'cut'
                }
                size={18}
                color="#00897B"
              />
            </View>
          ) : (
            <Avatar initials={recipientName?.[0] || '?'} size="sm" />
          )}
          <View className="ml-2.5 flex-1">
            <Text
              className="text-base font-semibold text-text-primary"
              numberOfLines={1}
            >
              {recipientName || 'User'}
            </Text>
            {isTyping && (
              <Text className="text-xs text-primary font-medium">
                typing...
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Options menu */}
        <TouchableOpacity
          onPress={handleShowOptions}
          className="p-2"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Messages + Input */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {messagesLoading && activeMessages.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#4DB6AC" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={listData}
            renderItem={renderItem}
            keyExtractor={(item, idx) =>
              item.type === 'date' ? `date-${idx}` : item.data._id
            }
            contentContainerStyle={{
              paddingVertical: 8,
              flexGrow: 1,
              justifyContent: listData.length === 0 ? 'center' : 'flex-end',
            }}
            onStartReached={handleLoadMore}
            onStartReachedThreshold={0.3}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListHeaderComponent={
              messagesLoading && activeMessages.length > 0 ? (
                <View className="items-center py-3">
                  <ActivityIndicator size="small" color="#4DB6AC" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View className="items-center justify-center px-8">
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={48}
                  color="#D1D5DB"
                />
                <Text className="text-sm text-text-muted mt-3 text-center">
                  No messages yet. Say hello!
                </Text>
              </View>
            }
            inverted={false}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input area */}
        <View
          className="bg-white border-t border-gray-100 px-3 py-2"
          style={{ paddingBottom: Math.max(insets.bottom, 8) }}
        >
          <View className="flex-row items-end">
            <TextInput
              className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 text-[15px] text-text-primary max-h-[100px]"
              placeholder="Message..."
              placeholderTextColor="#9CA3AF"
              value={text}
              onChangeText={handleTextChange}
              multiline
              textAlignVertical="center"
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim() || sendingMessage}
              className="ml-2 mb-0.5"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View
                className={
                  text.trim()
                    ? 'w-9 h-9 rounded-full bg-primary items-center justify-center'
                    : 'w-9 h-9 rounded-full bg-gray-200 items-center justify-center'
                }
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={text.trim() ? '#FFFFFF' : '#9CA3AF'}
                  style={{ marginLeft: 2 }}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
