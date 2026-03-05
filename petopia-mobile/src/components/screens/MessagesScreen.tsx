import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
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
  fetchUnreadCounts,
  markAllConversationsRead,
  searchFollowing,
  startConversation,
  ChatConversation,
  ChatUser,
} from '../../store/slices/chatSlice';

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
// Conversation Item (smart display)
// ========================================

const ConversationItem: React.FC<{
  conversation: ChatConversation;
  currentUserId?: string;
  onPress: (conv: ChatConversation) => void;
}> = ({ conversation, currentUserId, onPress }) => {
  const other =
    conversation.otherParticipant ||
    conversation.participants?.find((p) => p._id !== currentUserId);
  const lastMsg = conversation.lastMessage;

  // Smart display logic for shop conversations
  const shopCtx = conversation.shopContext;
  const isShopConversation = !!shopCtx?.shopName;
  const isShopOwner =
    isShopConversation && shopCtx?.shopOwnerId === currentUserId;

  // Shop owner sees the customer name; customer sees the shop name
  let displayName: string;
  let showShopIcon = false;
  let avatarImage: string | undefined;

  if (isShopConversation && isShopOwner) {
    // Shop/clinic owner → show customer's name + profile image
    displayName = other?.name || 'Customer';
    avatarImage = other?.profileImage;
  } else if (isShopConversation) {
    // Customer → show shop/clinic name + icon
    displayName = shopCtx!.shopName;
    showShopIcon = true;
    avatarImage = undefined;
  } else {
    displayName = other?.name || 'User';
    avatarImage = other?.profileImage;
  }

  const displayInitial = displayName?.[0] || '?';

  let preview = 'Start a conversation';
  if (lastMsg) {
    const isMine =
      typeof lastMsg.sender === 'string'
        ? lastMsg.sender === currentUserId
        : lastMsg.sender?._id === currentUserId;
    preview = isMine ? `You: ${lastMsg.text}` : lastMsg.text;
  }

  // Subtitle line for shop conversations
  const subtitle = isShopConversation
    ? isShopOwner
      ? `via ${shopCtx!.shopName}`
      : undefined
    : undefined;

  return (
    <TouchableOpacity
      onPress={() => onPress(conversation)}
      activeOpacity={0.7}
      className="flex-row items-center px-4 py-3 border-b border-gray-100 bg-white"
    >
      {showShopIcon ? (
        <View
          className="items-center justify-center bg-primary-light/20"
          style={{ width: 52, height: 52, borderRadius: 26 }}
        >
          <Ionicons
            name={shopCtx?.shopType === 'clinic' ? 'medkit' : 'cut'}
            size={24}
            color="#00897B"
          />
        </View>
      ) : avatarImage ? (
        <Image
          source={{ uri: avatarImage }}
          style={{ width: 52, height: 52, borderRadius: 26 }}
        />
      ) : (
        <Avatar initials={displayInitial} size="md" />
      )}

      <View className="flex-1 ml-3">
        <View className="flex-row justify-between items-center mb-0.5">
          <View className="flex-1">
            <Text
              className={
                conversation.unread > 0
                  ? 'text-base font-bold text-text-primary'
                  : 'text-base font-semibold text-text-primary'
              }
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {subtitle && (
              <Text className="text-xs text-text-muted" numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          <Text className="text-xs text-text-muted ml-2">
            {lastMsg
              ? getTimeAgo(lastMsg.createdAt || conversation.updatedAt)
              : ''}
          </Text>
        </View>
        <Text
          className={
            conversation.unread > 0
              ? 'text-sm text-text-primary font-medium'
              : 'text-sm text-text-muted'
          }
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>

      {conversation.unread > 0 && (
        <View className="ml-2 bg-primary rounded-full min-w-[22px] h-[22px] items-center justify-center px-1.5">
          <Text className="text-xs font-bold text-white">
            {conversation.unread > 99 ? '99+' : conversation.unread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ========================================
// Tab types
// ========================================

type TabKey = 'messages' | 'requests' | 'services';

const getServiceTabLabel = (role?: string) => {
  switch (role) {
    case 'vet':
      return 'Clinic Messages';
    case 'groomer':
      return 'Shop Messages';
    default:
      return 'Service Providers';
  }
};

// ========================================
// Messages Screen (Conversations List)
// ========================================

export const MessagesScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { conversations, requests, loading, requestCount, totalUnread } =
    useSelector((state: RootState) => state.chat);
  const { user } = useSelector((state: RootState) => state.auth);
  const [activeTab, setActiveTab] = useState<TabKey>('messages');
  const [refreshing, setRefreshing] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [searching, setSearching] = useState(false);

  // Filter conversations into personal vs service
  const personalConversations = useMemo(
    () => conversations.filter((c) => !c.shopContext?.shopId),
    [conversations],
  );

  const serviceConversations = useMemo(
    () => conversations.filter((c) => !!c.shopContext?.shopId),
    [conversations],
  );

  // Compute badge counts per tab
  const personalUnread = useMemo(
    () => personalConversations.reduce((sum, c) => sum + (c.unread || 0), 0),
    [personalConversations],
  );
  const serviceUnread = useMemo(
    () => serviceConversations.reduce((sum, c) => sum + (c.unread || 0), 0),
    [serviceConversations],
  );

  // Active list based on tab
  const activeList = useMemo(() => {
    switch (activeTab) {
      case 'messages':
        return personalConversations;
      case 'requests':
        return requests;
      case 'services':
        return serviceConversations;
    }
  }, [activeTab, personalConversations, requests, serviceConversations]);

  const loadData = useCallback(() => {
    dispatch(fetchConversations('direct'));
    dispatch(fetchConversations('requests'));
    dispatch(fetchUnreadCounts());
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchConversations('direct'))
        .unwrap()
        .catch(() => {}),
      dispatch(fetchConversations('requests'))
        .unwrap()
        .catch(() => {}),
      dispatch(fetchUnreadCounts())
        .unwrap()
        .catch(() => {}),
    ]);
    setRefreshing(false);
  }, [dispatch]);

  const handleConversationPress = (conv: ChatConversation) => {
    const other =
      conv.otherParticipant ||
      conv.participants?.find((p) => p._id !== user?._id);
    const shopCtx = conv.shopContext;
    const isShop = !!shopCtx?.shopName;
    const isOwner = isShop && shopCtx?.shopOwnerId === user?._id;

    // Shop owner sees customer name; customer sees shop name
    const name = isShop
      ? isOwner
        ? other?.name || 'Customer'
        : shopCtx!.shopName
      : other?.name || 'User';
    const image = isShop && !isOwner ? '' : other?.profileImage || '';

    router.push({
      pathname: '/chat' as any,
      params: {
        conversationId: conv._id,
        recipientName: name,
        recipientImage: image,
        recipientId: other?._id || '',
        shopId: shopCtx?.shopId || '',
        shopType: shopCtx?.shopType || '',
        shopOwnerId: shopCtx?.shopOwnerId || '',
        shopName: shopCtx?.shopName || '',
      },
    });
  };

  const handleMarkAllRead = () => {
    dispatch(markAllConversationsRead()).then(() => {
      dispatch(fetchUnreadCounts());
    });
  };

  // Search following users for new message composer
  const handleSearch = useCallback(
    async (q: string) => {
      setSearchQuery(q);
      if (!q.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const result = await dispatch(searchFollowing(q)).unwrap();
        setSearchResults(result);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    },
    [dispatch],
  );

  const handleSelectUser = async (selectedUser: ChatUser) => {
    setShowComposer(false);
    setSearchQuery('');
    setSearchResults([]);
    try {
      const result = await dispatch(
        startConversation({ recipientId: selectedUser._id }),
      ).unwrap();
      router.push({
        pathname: '/chat' as any,
        params: {
          conversationId: result._id,
          recipientName: selectedUser.name,
          recipientImage: selectedUser.profileImage || '',
          recipientId: selectedUser._id,
        },
      });
    } catch {
      // fallback — ignore
    }
  };

  const renderItem = ({ item }: { item: ChatConversation }) => (
    <ConversationItem
      conversation={item}
      currentUserId={user?._id}
      onPress={handleConversationPress}
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-main">
      {/* Header */}
      <View className="bg-white px-4 py-4 border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-text-primary">Messages</Text>
          <View className="flex-row items-center gap-3">
            {totalUnread > 0 && (
              <TouchableOpacity
                onPress={handleMarkAllRead}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={22}
                  color="#4DB6AC"
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                setShowComposer(true);
                setSearchQuery('');
                setSearchResults([]);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={22} color="#1F2937" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tab Bar */}
      <View className="flex-row bg-white border-b border-gray-100">
        {/* Messages tab */}
        <TouchableOpacity
          onPress={() => setActiveTab('messages')}
          className="flex-1 items-center py-3"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <Text
              className={
                activeTab === 'messages'
                  ? 'text-sm font-bold text-primary'
                  : 'text-sm font-medium text-text-muted'
              }
            >
              Messages
            </Text>
            {personalUnread > 0 && (
              <View className="ml-1.5 bg-primary rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                <Text className="text-[10px] font-bold text-white">
                  {personalUnread > 99 ? '99+' : personalUnread}
                </Text>
              </View>
            )}
          </View>
          {activeTab === 'messages' && (
            <View className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-full" />
          )}
        </TouchableOpacity>

        {/* Requests tab */}
        <TouchableOpacity
          onPress={() => setActiveTab('requests')}
          className="flex-1 items-center py-3"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <Text
              className={
                activeTab === 'requests'
                  ? 'text-sm font-bold text-primary'
                  : 'text-sm font-medium text-text-muted'
              }
            >
              Requests
            </Text>
            {(requests.length > 0 || requestCount > 0) && (
              <View className="ml-1.5 bg-orange-400 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                <Text className="text-[10px] font-bold text-white">
                  {requests.length || requestCount}
                </Text>
              </View>
            )}
          </View>
          {activeTab === 'requests' && (
            <View className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-full" />
          )}
        </TouchableOpacity>

        {/* Services tab */}
        <TouchableOpacity
          onPress={() => setActiveTab('services')}
          className="flex-1 items-center py-3"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <Text
              className={
                activeTab === 'services'
                  ? 'text-sm font-bold text-primary'
                  : 'text-sm font-medium text-text-muted'
              }
              numberOfLines={1}
            >
              {getServiceTabLabel(user?.role)}
            </Text>
            {serviceUnread > 0 && (
              <View className="ml-1.5 bg-primary rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                <Text className="text-[10px] font-bold text-white">
                  {serviceUnread > 99 ? '99+' : serviceUnread}
                </Text>
              </View>
            )}
          </View>
          {activeTab === 'services' && (
            <View className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-full" />
          )}
        </TouchableOpacity>
      </View>

      {/* Conversations list */}
      {loading && activeList.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DB6AC" />
        </View>
      ) : (
        <FlatList
          data={activeList}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={activeList.length === 0 ? { flex: 1 } : {}}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8">
              <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
                <Ionicons
                  name={
                    activeTab === 'requests'
                      ? 'mail-outline'
                      : activeTab === 'services'
                        ? 'storefront-outline'
                        : 'chatbubbles-outline'
                  }
                  size={32}
                  color="#4DB6AC"
                />
              </View>
              <Text className="text-lg font-semibold text-text-primary mb-2">
                {activeTab === 'requests'
                  ? 'No message requests'
                  : activeTab === 'services'
                    ? 'No service conversations'
                    : 'No conversations yet'}
              </Text>
              <Text className="text-sm text-text-muted text-center leading-5">
                {activeTab === 'requests'
                  ? "Message requests from people you don't follow will appear here."
                  : activeTab === 'services'
                    ? 'Conversations with clinics and shops will appear here.'
                    : "Visit someone's profile and tap the message button to start chatting!"}
              </Text>
            </View>
          }
        />
      )}

      {/* New Message Composer Modal */}
      <Modal
        visible={showComposer}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-bg-main">
          <View className="flex-row items-center bg-white px-3 py-3 border-b border-gray-100">
            <TouchableOpacity
              onPress={() => {
                setShowComposer(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="p-1 mr-2"
            >
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-text-primary">
              New Message
            </Text>
          </View>
          <View className="px-4 py-3 bg-white border-b border-gray-100">
            <View className="flex-row items-center bg-gray-50 rounded-xl px-3">
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                className="flex-1 py-2.5 px-2 text-[15px] text-text-primary"
                placeholder="Search people you follow..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {searching ? (
            <View className="items-center py-8">
              <ActivityIndicator size="small" color="#4DB6AC" />
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelectUser(item)}
                  className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100"
                  activeOpacity={0.7}
                >
                  {item.profileImage ? (
                    <Image
                      source={{ uri: item.profileImage }}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                    />
                  ) : (
                    <Avatar initials={item.name?.[0] || '?'} size="sm" />
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold text-text-primary">
                      {item.name}
                    </Text>
                    {item.bio ? (
                      <Text
                        className="text-sm text-text-muted mt-0.5"
                        numberOfLines={1}
                      >
                        {item.bio}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                searchQuery.length > 0 ? (
                  <View className="items-center py-8">
                    <Text className="text-sm text-text-muted">
                      No results found
                    </Text>
                  </View>
                ) : (
                  <View className="items-center py-8 px-8">
                    <Text className="text-sm text-text-muted text-center">
                      Search for people you follow to start a conversation
                    </Text>
                  </View>
                )
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};
