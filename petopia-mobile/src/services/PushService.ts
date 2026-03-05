/**
 * Push Notification Service
 * =========================
 * Handles FCM token registration and push notification permissions.
 *
 * Uses expo-notifications for cross-platform push support.
 * The FCM token is registered with the backend on auth,
 * and removed on logout.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request push notification permissions and get the Expo push token / FCM token.
 * Returns the token string or null if unavailable.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Must use physical device for push notifications');
    return null;
  }

  try {
    // Check/request permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    // Get the device push token (FCM on Android, APNs on iOS)
    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    const token = tokenResponse.data;

    // Android: create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4DB6AC',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('chat', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: '#4DB6AC',
        sound: 'default',
      });
    }

    console.log('[Push] Token obtained:', token.substring(0, 20) + '...');
    return token;
  } catch (err) {
    console.error('[Push] Failed to get push token:', err);
    return null;
  }
}

/**
 * Register the FCM token with the backend.
 */
export async function registerTokenWithBackend(
  authToken: string,
  fcmToken: string,
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/user/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token: fcmToken,
        device: Platform.OS,
      }),
    });

    const data = await response.json();
    if (data.success) {
      console.log('[Push] Token registered with backend');
    } else {
      console.warn('[Push] Backend registration failed:', data.message);
    }
  } catch (err) {
    console.error('[Push] Failed to register token with backend:', err);
  }
}

/**
 * Remove the FCM token from the backend (call on logout).
 */
export async function unregisterTokenFromBackend(
  authToken: string,
  fcmToken: string,
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/user/fcm-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: fcmToken }),
    });
    console.log('[Push] Token unregistered from backend');
  } catch (err) {
    console.error('[Push] Failed to unregister token:', err);
  }
}

/**
 * Add a listener for notification responses (user tapped notification).
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Add a listener for foreground notifications.
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(handler);
}
