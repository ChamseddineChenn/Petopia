import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSegments, useRouter } from 'expo-router';
import { setToken } from '../store/slices/authSlice';
import { StorageService } from '../services/StorageService';
import { RootState, AppDispatch } from '../store/store';
import { View, ActivityIndicator } from 'react-native';
import { connectSocket, disconnectSocket } from '../services/SocketService';
import {
  registerForPushNotifications,
  registerTokenWithBackend,
  unregisterTokenFromBackend,
} from '../services/PushService';
import { addRealtimeNotification } from '../store/slices/notificationSlice';
import {
  addRealtimeMessage,
  updateMessageStatus,
  markActiveMessagesSeen,
  fetchConversations,
  fetchUnreadCounts,
} from '../store/slices/chatSlice';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, token } = useSelector(
    (state: RootState) => state.auth,
  );
  const [isLoading, setIsLoading] = useState(true);
  const socketConnected = useRef(false);
  const pushTokenRef = useRef<string | null>(null);

  // Check if route is public (auth screen + legal pages accessible without login)
  const isPublicRoute =
    segments[0] === 'auth' ||
    segments[0] === 'terms-of-service' ||
    segments[0] === 'privacy-policy';

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        // Try to restore token from storage
        const savedToken = await StorageService.getToken();
        if (savedToken) {
          dispatch(setToken(savedToken));
        }
      } catch (e) {
        // Ignore errors during token restoration
        console.error('Failed to restore token:', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, [dispatch]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace('/auth');
    } else if (isAuthenticated && segments[0] === 'auth') {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, isLoading, isPublicRoute, router]);

  // Connect/disconnect WebSocket based on auth state
  useEffect(() => {
    if (isAuthenticated && token && !socketConnected.current) {
      const socket = connectSocket(token);
      socketConnected.current = true;

      // Register for push notifications (FCM/APNs)
      registerForPushNotifications().then((pushToken) => {
        if (pushToken && token) {
          pushTokenRef.current = pushToken;
          registerTokenWithBackend(token, pushToken);
        }
      });

      // Listen for real-time notifications
      socket.on('notification', (notif: any) => {
        dispatch(addRealtimeNotification(notif));
      });

      // ---- Chat real-time events ----

      // New incoming message
      socket.on('new_message', (data: any) => {
        const convId = data.conversationId || data.conversation?._id || '';
        dispatch(
          addRealtimeMessage({
            message: data.message,
            conversationId: convId,
          }),
        );
        // Refresh unread counts
        dispatch(fetchUnreadCounts());
      });

      // Message status update (delivered/seen) — individual or bulk
      socket.on('message_status', (data: any) => {
        dispatch(
          updateMessageStatus({
            messageId: data.messageId,
            conversationId: data.conversationId,
            status: data.status,
            deliveredAt: data.deliveredAt,
            seenAt: data.seenAt,
            bulk: data.bulk,
          }),
        );
      });

      // Other user has seen messages in a conversation
      socket.on('messages_seen', (data: any) => {
        dispatch(
          markActiveMessagesSeen({
            conversationId: data.conversationId,
            seenAt: data.seenAt,
          }),
        );
      });

      // Real-time unread count sync (from hybrid delivery controller)
      socket.on('unread_count_update', (data: any) => {
        dispatch(fetchUnreadCounts());
      });

      // Message request accepted
      socket.on('request_accepted', () => {
        dispatch(fetchConversations('direct'));
        dispatch(fetchConversations('requests'));
      });
    } else if (!isAuthenticated && socketConnected.current) {
      // Unregister push token on logout
      if (pushTokenRef.current && token) {
        unregisterTokenFromBackend(token, pushTokenRef.current);
        pushTokenRef.current = null;
      }
      disconnectSocket();
      socketConnected.current = false;
    }

    return () => {
      // Cleanup on unmount
      if (socketConnected.current) {
        disconnectSocket();
        socketConnected.current = false;
      }
    };
  }, [isAuthenticated, token, dispatch]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-main">
        <ActivityIndicator size="large" color="#4DB6AC" />
      </View>
    );
  }

  return <>{children}</>;
}
