import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Avatar } from '../common/Avatar';
import { ScreenHeader } from '../common/ScreenHeader';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  AppNotification,
} from '../../store/slices/notificationSlice';
import { respondToFollowRequest } from '../../store/slices/profileSlice';

const NOTIF_ICONS: Record<string, { name: any; color: string; bg: string }> = {
  appointment_booked: {
    name: 'calendar-outline',
    color: '#3B82F6',
    bg: 'bg-blue-100',
  },
  appointment_confirmed: {
    name: 'checkmark-circle-outline',
    color: '#10B981',
    bg: 'bg-green-100',
  },
  appointment_cancelled: {
    name: 'close-circle-outline',
    color: '#EF4444',
    bg: 'bg-red-100',
  },
  appointment_completed: {
    name: 'ribbon-outline',
    color: '#8B5CF6',
    bg: 'bg-purple-100',
  },
  appointment_reminder: {
    name: 'alarm-outline',
    color: '#F59E0B',
    bg: 'bg-yellow-100',
  },
  new_follower: {
    name: 'person-add-outline',
    color: '#00897B',
    bg: 'bg-teal-100',
  },
  follow_request: {
    name: 'person-add-outline',
    color: '#3B82F6',
    bg: 'bg-blue-100',
  },
  follow_request_accepted: {
    name: 'checkmark-circle-outline',
    color: '#10B981',
    bg: 'bg-green-100',
  },
};

const getTimeAgo = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const NotificationsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { notifications, loading, unreadCount } = useSelector(
    (state: RootState) => state.notifications,
  );
  const { user } = useSelector((state: RootState) => state.auth);

  // Track which follow requests have been responded to (locally)
  const [respondedRequests, setRespondedRequests] = useState<
    Record<string, 'accept' | 'reject'>
  >({});

  useEffect(() => {
    dispatch(fetchNotifications({}));
  }, [dispatch]);

  const handlePress = useCallback(
    (notif: AppNotification) => {
      if (!notif.read) {
        dispatch(markNotificationRead(notif._id));
      }

      // Follow-related notifications → navigate to profile
      if (
        notif.type === 'new_follower' ||
        notif.type === 'follow_request' ||
        notif.type === 'follow_request_accepted'
      ) {
        const userId = notif.data?.userId || notif.sender?._id;
        if (userId) {
          router.push({ pathname: '/profile-modal', params: { userId } });
        }
        return;
      }

      // Navigate based on notification type
      if (notif.data?.appointmentId) {
        if (
          notif.type === 'appointment_booked' ||
          notif.type === 'appointment_confirmed' ||
          notif.type === 'appointment_cancelled' ||
          notif.type === 'appointment_completed'
        ) {
          // Provider roles → their management screens
          if (user?.role === 'groomer') {
            router.push('/groomer-appointments');
          } else if (user?.role === 'vet') {
            router.push('/vet-appointments');
          } else {
            // Regular user/client → their appointments view
            router.push('/my-appointments');
          }
        }
      }
    },
    [dispatch, router, user],
  );

  const handleFollowResponse = useCallback(
    (notif: AppNotification, action: 'accept' | 'reject') => {
      const requestId = notif.data?.followRequestId;
      if (!requestId) return;
      dispatch(respondToFollowRequest({ requestId, action }));
      setRespondedRequests((prev) => ({ ...prev, [notif._id]: action }));
      if (!notif.read) {
        dispatch(markNotificationRead(notif._id));
      }
    },
    [dispatch],
  );

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead());
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const iconInfo = NOTIF_ICONS[item.type] || NOTIF_ICONS.appointment_booked;
    const isFollowType =
      item.type === 'new_follower' ||
      item.type === 'follow_request' ||
      item.type === 'follow_request_accepted';
    const senderImage = item.sender?.profileImage;
    const responseStatus = respondedRequests[item._id];

    return (
      <TouchableOpacity
        onPress={() => handlePress(item)}
        className={
          !item.read
            ? 'flex-row px-4 py-3.5 border-b border-gray-100 bg-primary/5'
            : 'flex-row px-4 py-3.5 border-b border-gray-100 bg-white'
        }
        activeOpacity={0.7}
      >
        {/* Avatar for follow-type, icon for others */}
        {isFollowType && senderImage ? (
          <Image
            source={{ uri: senderImage }}
            className="w-10 h-10 rounded-full mr-3"
          />
        ) : (
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${iconInfo.bg}`}
          >
            <Ionicons name={iconInfo.name} size={20} color={iconInfo.color} />
          </View>
        )}

        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text
              className={
                !item.read
                  ? 'text-sm font-bold text-text-primary flex-1'
                  : 'text-sm font-semibold text-text-primary flex-1'
              }
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text className="text-xs text-text-muted ml-2">
              {getTimeAgo(item.createdAt)}
            </Text>
          </View>

          <Text
            className="text-sm text-text-muted mt-0.5 leading-5"
            numberOfLines={2}
          >
            {item.body}
          </Text>

          {/* Accept / Reject buttons for follow requests */}
          {item.type === 'follow_request' && !responseStatus && (
            <View className="flex-row mt-2 gap-2">
              <TouchableOpacity
                onPress={() => handleFollowResponse(item, 'accept')}
                className="bg-primary px-4 py-1.5 rounded-full"
              >
                <Text className="text-white text-xs font-semibold">Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleFollowResponse(item, 'reject')}
                className="bg-gray-200 px-4 py-1.5 rounded-full"
              >
                <Text className="text-text-primary text-xs font-semibold">
                  Decline
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Show status after responding */}
          {item.type === 'follow_request' && responseStatus && (
            <Text
              className={
                responseStatus === 'accept'
                  ? 'text-xs mt-1.5 font-medium text-primary'
                  : 'text-xs mt-1.5 font-medium text-text-muted'
              }
            >
              {responseStatus === 'accept' ? 'Accepted' : 'Declined'}
            </Text>
          )}

          {!item.read && (
            <View className="absolute right-0 top-1/2 w-2.5 h-2.5 rounded-full bg-primary" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
      <Text className="text-lg text-text-muted mt-4">No notifications yet</Text>
      <Text className="text-sm text-text-muted mt-1">
        You'll see updates about appointments and followers here
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader
        title="Notifications"
        onBack={() => router.back()}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text className="text-primary font-semibold text-sm">
                Mark all read
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading && notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DB6AC" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={notifications.length === 0 ? { flex: 1 } : {}}
        />
      )}
    </SafeAreaView>
  );
};
