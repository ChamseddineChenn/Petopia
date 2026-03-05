import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { Avatar } from '../common/Avatar';
import { useAlert } from '../ui/CustomAlert';
import { sharePost } from '../../store/slices/postSlice';
import {
  searchFollowing,
  startConversation,
  sendMessage,
} from '../../store/slices/chatSlice';
import { AppDispatch } from '../../store/store';

interface SharePostModalProps {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
}

interface FollowingUser {
  _id: string;
  name: string;
  profileImage?: string;
}

export const SharePostModal: React.FC<SharePostModalProps> = ({
  visible,
  postId,
  onClose,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { height: windowHeight } = useWindowDimensions();

  const [view, setView] = useState<'options' | 'compose' | 'users'>('options');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<FollowingUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null); // userId being sent to
  const [shareCaption, setShareCaption] = useState('');
  const [sharing, setSharing] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setView('options');
      setQuery('');
      setUsers([]);
      setSearching(false);
      setSending(null);
      setShareCaption('');
      setSharing(false);
    }
  }, [visible]);

  // Search users as they type
  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounce.current) clearTimeout(debounce.current);
      if (!text.trim()) {
        setUsers([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      debounce.current = setTimeout(async () => {
        try {
          const result = await dispatch(searchFollowing(text.trim())).unwrap();
          setUsers(result || []);
        } catch {
          setUsers([]);
        } finally {
          setSearching(false);
        }
      }, 400);
    },
    [dispatch],
  );

  // Share to feed (quote-repost) with optional caption
  const handleShareToFeed = async () => {
    if (!postId) return;
    setSharing(true);
    try {
      await dispatch(
        sharePost({
          postId,
          content: shareCaption.trim() || undefined,
        }),
      ).unwrap();
      showAlert({
        title: 'Shared!',
        message: 'Post shared to your feed.',
        variant: 'success',
      });
      onClose();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to share',
        variant: 'error',
      });
    } finally {
      setSharing(false);
    }
  };

  // Send to user as a message
  const handleSendToUser = async (recipient: FollowingUser) => {
    if (!postId) return;
    setSending(recipient._id);
    try {
      // 1. Start or get conversation
      const conversation = await dispatch(
        startConversation({ recipientId: recipient._id }),
      ).unwrap();

      // 2. Send post as message with a special format
      const postLink = `[shared_post:${postId}]`;
      const messageText = `Shared a post with you ${postLink}`;
      await dispatch(
        sendMessage({ conversationId: conversation._id, text: messageText }),
      ).unwrap();

      showAlert({
        title: 'Sent!',
        message: `Post sent to ${recipient.name}.`,
        variant: 'success',
      });
      onClose();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to send',
        variant: 'error',
      });
    } finally {
      setSending(null);
    }
  };

  const renderUser = ({ item }: { item: FollowingUser }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => handleSendToUser(item)}
      disabled={sending !== null}
      className="flex-row items-center px-5 py-3.5"
    >
      <Avatar
        initials={item.name?.[0] || '?'}
        source={item.profileImage ? { uri: item.profileImage } : undefined}
        size="md"
      />
      <Text
        className="flex-1 ml-3 text-base font-medium text-text-primary"
        numberOfLines={2}
      >
        {item.name}
      </Text>
      {sending === item._id ? (
        <ActivityIndicator size="small" color="#4DB6AC" />
      ) : (
        <Ionicons name="send-outline" size={20} color="#4DB6AC" />
      )}
    </TouchableOpacity>
  );

  // Sheet takes ~65% of screen in user-picker/compose mode, auto in options mode
  const sheetHeight =
    view === 'users' || view === 'compose' ? windowHeight * 0.65 : undefined;
  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable onPress={() => {}}>
              <View
                style={{
                  backgroundColor: '#fff',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingTop: 16,
                  paddingBottom: bottomPadding,
                  ...(sheetHeight ? { height: sheetHeight } : {}),
                }}
              >
                {/* Handle bar */}
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#D1D5DB',
                    alignSelf: 'center',
                    marginBottom: 16,
                  }}
                />

                {view === 'options' ? (
                  /* ─── Options view ─── */
                  <View className="px-6">
                    <Text className="text-lg font-bold text-text-primary mb-5">
                      Share Post
                    </Text>

                    {/* Share to feed */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setView('compose')}
                      className="flex-row items-center py-3.5"
                    >
                      <View className="w-10 h-10 rounded-full bg-primary-light/20 items-center justify-center">
                        <Ionicons
                          name="repeat-outline"
                          size={22}
                          color="#4DB6AC"
                        />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-base font-medium text-text-primary">
                          Share to your feed
                        </Text>
                        <Text className="text-xs text-text-muted mt-0.5">
                          Repost this to your profile
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>

                    {/* Send as message */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setView('users')}
                      className="flex-row items-center py-3.5"
                    >
                      <View className="w-10 h-10 rounded-full bg-accent-light/30 items-center justify-center">
                        <Ionicons
                          name="paper-plane-outline"
                          size={20}
                          color="#E49B6D"
                        />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-base font-medium text-text-primary">
                          Send as a message
                        </Text>
                        <Text className="text-xs text-text-muted mt-0.5">
                          Send this post to someone
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>

                    {/* Cancel */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={onClose}
                      className="items-center py-3 mt-3"
                    >
                      <Text className="text-base font-medium text-text-muted">
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : view === 'compose' ? (
                  /* ─── Compose view (share to feed with caption) ─── */
                  <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-4 mb-3">
                      <View className="flex-row items-center">
                        <TouchableOpacity
                          onPress={() => {
                            Keyboard.dismiss();
                            setView('options');
                          }}
                          activeOpacity={0.7}
                          className="p-1 mr-2"
                        >
                          <Ionicons
                            name="arrow-back"
                            size={22}
                            color="#1F2937"
                          />
                        </TouchableOpacity>
                        <Text className="text-lg font-bold text-text-primary">
                          Share to Feed
                        </Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleShareToFeed}
                        disabled={sharing}
                        style={{
                          backgroundColor: sharing ? '#9CA3AF' : '#4DB6AC',
                          borderRadius: 20,
                          paddingHorizontal: 20,
                          paddingVertical: 8,
                        }}
                      >
                        {sharing ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text
                            style={{
                              color: '#fff',
                              fontWeight: '600',
                              fontSize: 14,
                            }}
                          >
                            Share
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Caption input */}
                    <View className="px-4 mb-3">
                      <TextInput
                        placeholder="Add your thoughts... (optional)"
                        placeholderTextColor="#9CA3AF"
                        value={shareCaption}
                        onChangeText={setShareCaption}
                        multiline
                        maxLength={500}
                        autoFocus
                        style={{
                          minHeight: 80,
                          maxHeight: 140,
                          textAlignVertical: 'top',
                          fontSize: 15,
                          lineHeight: 22,
                          color: '#1F2937',
                          backgroundColor: '#F9FAFB',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          paddingHorizontal: 14,
                          paddingTop: 12,
                          paddingBottom: 12,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#9CA3AF',
                          textAlign: 'right',
                          marginTop: 4,
                        }}
                      >
                        {shareCaption.length}/500
                      </Text>
                    </View>

                    {/* Preview of what the shared post looks like */}
                    <View className="px-4">
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          borderRadius: 12,
                          padding: 12,
                          backgroundColor: '#F9FAFB',
                        }}
                      >
                        <View className="flex-row items-center mb-1">
                          <Ionicons
                            name="repeat-outline"
                            size={14}
                            color="#4DB6AC"
                          />
                          <Text
                            style={{
                              marginLeft: 6,
                              fontSize: 12,
                              color: '#6B7280',
                            }}
                          >
                            Original post will appear here
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 12,
                            color: '#9CA3AF',
                            marginTop: 2,
                          }}
                        >
                          Your description will be shown above the shared post
                          on your feed.
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  /* ─── User picker view ─── */
                  <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View className="flex-row items-center px-4 mb-3">
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          setView('options');
                        }}
                        activeOpacity={0.7}
                        className="p-1 mr-2"
                      >
                        <Ionicons name="arrow-back" size={22} color="#1F2937" />
                      </TouchableOpacity>
                      <Text className="text-lg font-bold text-text-primary">
                        Send to...
                      </Text>
                    </View>

                    {/* Search input */}
                    <View className="mx-4 mb-3 flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3">
                      <Ionicons
                        name="search-outline"
                        size={18}
                        color="#9CA3AF"
                      />
                      <TextInput
                        placeholder="Search people you follow"
                        placeholderTextColor="#9CA3AF"
                        value={query}
                        onChangeText={handleSearch}
                        autoFocus
                        returnKeyType="search"
                        className="flex-1 ml-2 py-2.5 text-sm text-text-primary"
                      />
                      {query.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                          <Ionicons
                            name="close-circle"
                            size={18}
                            color="#9CA3AF"
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Results */}
                    {searching ? (
                      <View className="items-center py-8">
                        <ActivityIndicator color="#4DB6AC" />
                      </View>
                    ) : users.length === 0 && query.trim().length > 0 ? (
                      <View className="items-center py-8">
                        <Text className="text-sm text-text-muted">
                          No users found
                        </Text>
                      </View>
                    ) : query.trim().length === 0 ? (
                      <View
                        style={{
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name="people-outline"
                          size={32}
                          color="#D1D5DB"
                        />
                        <Text className="text-sm text-text-muted mt-2">
                          Search for someone to send this post to
                        </Text>
                      </View>
                    ) : (
                      <FlatList
                        data={users}
                        renderItem={renderUser}
                        keyExtractor={(item) => item._id}
                        keyboardShouldPersistTaps="handled"
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 8 }}
                      />
                    )}
                  </View>
                )}
              </View>
            </Pressable>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};
