import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar } from '../common/Avatar';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchConversations,
  acceptMessageRequest,
  deleteConversation,
  ChatConversation,
} from '../../store/slices/chatSlice';
import { useAlert } from '../ui/CustomAlert';

// ========================================
// Helpers
// ========================================

const getTimeAgo = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ========================================
// Request Item
// ========================================

const RequestItem: React.FC<{
  conversation: ChatConversation;
  currentUserId?: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onPress: (conv: ChatConversation) => void;
}> = ({ conversation, currentUserId, onAccept, onDecline, onPress }) => {
  const other =
    conversation.otherParticipant ||
    conversation.participants?.find((p) => p._id !== currentUserId);
  const lastMsg = conversation.lastMessage;

  return (
    <TouchableOpacity
      onPress={() => onPress(conversation)}
      activeOpacity={0.7}
      className="px-4 py-3 border-b border-gray-100 bg-white"
    >
      <View className="flex-row items-center">
        {other?.profileImage ? (
          <Image
            source={{ uri: other.profileImage }}
            style={{ width: 52, height: 52, borderRadius: 26 }}
          />
        ) : (
          <Avatar initials={other?.name?.[0] || '?'} size="md" />
        )}

        <View className="flex-1 ml-3">
          <View className="flex-row justify-between items-center mb-0.5">
            <Text
              className="text-base font-semibold text-text-primary flex-1"
              numberOfLines={1}
            >
              {other?.name || 'User'}
            </Text>
            <Text className="text-xs text-text-muted ml-2">
              {lastMsg
                ? getTimeAgo(lastMsg.createdAt || conversation.updatedAt)
                : getTimeAgo(conversation.createdAt)}
            </Text>
          </View>
          {lastMsg && (
            <Text className="text-sm text-text-muted" numberOfLines={2}>
              {lastMsg.text}
            </Text>
          )}
        </View>
      </View>

      {/* Accept / Decline buttons */}
      <View className="flex-row mt-3 ml-[64px] gap-2">
        <TouchableOpacity
          onPress={() => onAccept(conversation._id)}
          className="flex-1 bg-primary py-2 rounded-lg items-center"
          activeOpacity={0.7}
        >
          <Text className="text-sm font-semibold text-white">Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDecline(conversation._id)}
          className="flex-1 bg-gray-100 py-2 rounded-lg items-center"
          activeOpacity={0.7}
        >
          <Text className="text-sm font-semibold text-text-muted">Decline</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ========================================
// Message Requests Screen
// ========================================

export const MessageRequestsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { requests, loading } = useSelector((state: RootState) => state.chat);
  const { user } = useSelector((state: RootState) => state.auth);
  const [refreshing, setRefreshing] = useState(false);

  const loadRequests = useCallback(() => {
    dispatch(fetchConversations('requests'));
  }, [dispatch]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchConversations('requests'))
      .unwrap()
      .catch(() => {});
    setRefreshing(false);
  }, [dispatch]);

  const handleAccept = (id: string) => {
    dispatch(acceptMessageRequest(id));
  };

  const handleDecline = (id: string) => {
    showAlert({
      title: 'Decline Request',
      message: 'This will delete the conversation. Continue?',
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => dispatch(deleteConversation(id)),
        },
      ],
    });
  };

  const handlePress = (conv: ChatConversation) => {
    const other =
      conv.otherParticipant ||
      conv.participants?.find((p) => p._id !== user?._id);
    router.push({
      pathname: '/chat' as any,
      params: {
        conversationId: conv._id,
        recipientName: other?.name || 'User',
        recipientImage: other?.profileImage || '',
        recipientId: other?._id || '',
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-main">
      {/* Header */}
      <View className="flex-row items-center bg-white px-3 py-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-1 mr-2"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text-primary">
          Message Requests
        </Text>
      </View>

      <Text className="px-4 py-3 text-sm text-text-muted leading-5">
        These are messages from people you don&apos;t follow. Accepting lets
        them message you directly.
      </Text>

      {loading && requests.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DB6AC" />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={({ item }) => (
            <RequestItem
              conversation={item}
              currentUserId={user?._id}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onPress={handlePress}
            />
          )}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={requests.length === 0 ? { flex: 1 } : {}}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8">
              <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
                <Ionicons name="mail-outline" size={32} color="#9CA3AF" />
              </View>
              <Text className="text-lg font-semibold text-text-primary mb-2">
                No message requests
              </Text>
              <Text className="text-sm text-text-muted text-center leading-5">
                When someone who doesn&apos;t follow you sends a message, it
                will appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};
