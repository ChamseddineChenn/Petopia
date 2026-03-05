import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../config';
import { RootState } from '../store';

// ========================================
// Types
// ========================================

export interface NotificationData {
  appointmentId?: string;
  clinicId?: string;
  shopId?: string;
  petId?: string;
  followRequestId?: string;
  userId?: string;
}

export interface AppNotification {
  _id: string;
  recipient: string;
  sender: {
    _id: string;
    name: string;
    profileImage?: string;
  } | null;
  type:
    | 'appointment_booked'
    | 'appointment_confirmed'
    | 'appointment_cancelled'
    | 'appointment_completed'
    | 'appointment_reminder'
    | 'new_follower'
    | 'follow_request'
    | 'follow_request_accepted';
  title: string;
  body: string;
  data: NotificationData;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

// ========================================
// Async Thunks
// ========================================

export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async (
    params: { page?: number; unreadOnly?: boolean } = {},
    { getState, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const token = state.auth.token;
    if (!token) return rejectWithValue('Not authenticated');
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set('page', String(params.page));
      if (params.unreadOnly) queryParams.set('unreadOnly', 'true');

      const res = await fetch(
        `${API_BASE_URL}/notifications?${queryParams.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return {
        notifications: data.notifications as AppNotification[],
        unreadCount: data.unreadCount as number,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch notifications');
    }
  },
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/unreadCount',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const token = state.auth.token;
    if (!token) return rejectWithValue('Not authenticated');
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.count as number;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch unread count');
    }
  },
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (notificationId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(
        `${API_BASE_URL}/notifications/${notificationId}/read`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return notificationId;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to mark notification read');
    }
  },
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return true;
    } catch (err: any) {
      return rejectWithValue(
        err.message || 'Failed to mark all notifications read',
      );
    }
  },
);

// ========================================
// Slice
// ========================================

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Called when a real-time notification arrives via WebSocket
    addRealtimeNotification: (
      state,
      action: PayloadAction<AppNotification>,
    ) => {
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const notif = state.notifications.find((n) => n._id === action.payload);
        if (notif && !notif.read) {
          notif.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.notifications.forEach((n) => {
          n.read = true;
        });
        state.unreadCount = 0;
      });
  },
});

export const { addRealtimeNotification, clearNotifications } =
  notificationSlice.actions;
export default notificationSlice.reducer;
