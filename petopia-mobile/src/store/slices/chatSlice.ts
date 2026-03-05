import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../config';
import { RootState } from '../store';

// ========================================
// Types
// ========================================

export interface ChatUser {
  _id: string;
  name: string;
  profileImage?: string;
  bio?: string;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: ChatUser | string;
  text: string;
  status: 'sent' | 'delivered' | 'seen';
  deliveredAt?: string;
  seenAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatConversation {
  _id: string;
  participants: ChatUser[];
  lastMessage?: ChatMessage | null;
  otherParticipant?: ChatUser;
  unread: number;
  isRequest?: boolean;
  shopContext?: {
    shopId: string;
    shopType: 'clinic' | 'groomer_shop';
    shopName: string;
    shopOwnerId?: string;
  } | null;
  updatedAt: string;
  createdAt: string;
}

interface ChatState {
  conversations: ChatConversation[];
  requests: ChatConversation[];
  activeMessages: ChatMessage[];
  activeConversationId: string | null;
  blockedUsers: ChatUser[];
  loading: boolean;
  messagesLoading: boolean;
  sendingMessage: boolean;
  totalUnread: number;
  requestCount: number;
  hasMoreMessages: boolean;
  error: string | null;
}

const initialState: ChatState = {
  conversations: [],
  requests: [],
  activeMessages: [],
  activeConversationId: null,
  blockedUsers: [],
  loading: false,
  messagesLoading: false,
  sendingMessage: false,
  totalUnread: 0,
  requestCount: 0,
  hasMoreMessages: true,
  error: null,
};

// ========================================
// Helpers
// ========================================

const getToken = (getState: () => unknown) =>
  (getState() as RootState).auth.token;

const fetchWithAuth = async (
  url: string,
  token: string | null,
  options: RequestInit = {},
) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Request failed');
  return data;
};

// ========================================
// Thunks
// ========================================

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (
    type: 'direct' | 'requests' = 'direct',
    { getState, rejectWithValue },
  ) => {
    const token = getToken(getState);
    if (!token) return rejectWithValue('Not authenticated');
    try {
      const data = await fetchWithAuth(
        `${API_BASE_URL}/chat/conversations?type=${type}`,
        token,
      );
      return { type, conversations: data.conversations };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (
    { conversationId, before }: { conversationId: string; before?: string },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      const url = before
        ? `${API_BASE_URL}/chat/conversations/${conversationId}/messages?before=${before}&limit=30`
        : `${API_BASE_URL}/chat/conversations/${conversationId}/messages?limit=30`;
      const data = await fetchWithAuth(url, token);
      return { messages: data.messages, isLoadMore: !!before };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (
    { conversationId, text }: { conversationId: string; text: string },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/chat/conversations/${conversationId}/messages`,
        token,
        { method: 'POST', body: JSON.stringify({ text }) },
      );
      return data.message;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const startConversation = createAsyncThunk(
  'chat/startConversation',
  async (
    {
      recipientId,
      text,
      shopId,
      shopType,
    }: {
      recipientId: string;
      text?: string;
      shopId?: string;
      shopType?: 'clinic' | 'groomer_shop' | 'pet_shop';
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      const body: Record<string, any> = { recipientId };
      if (text) body.text = text;
      if (shopId) body.shopId = shopId;
      if (shopType) body.shopType = shopType;
      const data = await fetchWithAuth(
        `${API_BASE_URL}/chat/conversations`,
        token,
        { method: 'POST', body: JSON.stringify(body) },
      );
      return data.conversation;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const markConversationRead = createAsyncThunk(
  'chat/markRead',
  async (conversationId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      await fetchWithAuth(
        `${API_BASE_URL}/chat/conversations/${conversationId}/read`,
        token,
        { method: 'PUT' },
      );
      return conversationId;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const acceptMessageRequest = createAsyncThunk(
  'chat/acceptRequest',
  async (conversationId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      await fetchWithAuth(
        `${API_BASE_URL}/chat/conversations/${conversationId}/accept`,
        token,
        { method: 'PUT' },
      );
      return conversationId;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const deleteConversation = createAsyncThunk(
  'chat/deleteConversation',
  async (conversationId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      await fetchWithAuth(
        `${API_BASE_URL}/chat/conversations/${conversationId}`,
        token,
        { method: 'DELETE' },
      );
      return conversationId;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const fetchUnreadCounts = createAsyncThunk(
  'chat/fetchUnreadCounts',
  async (_, { getState, rejectWithValue }) => {
    const token = getToken(getState);
    if (!token) return rejectWithValue('Not authenticated');
    try {
      const data = await fetchWithAuth(
        `${API_BASE_URL}/chat/unread-count`,
        token,
      );
      return { totalUnread: data.totalUnread, requestCount: data.requestCount };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const markAllConversationsRead = createAsyncThunk(
  'chat/markAllRead',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      await fetchWithAuth(`${API_BASE_URL}/chat/mark-all-read`, token, {
        method: 'PUT',
      });
      return true;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const searchFollowing = createAsyncThunk(
  'chat/searchFollowing',
  async (query: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/chat/search-following?q=${encodeURIComponent(query)}`,
        token,
      );
      return data.users as ChatUser[];
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const blockUser = createAsyncThunk(
  'chat/blockUser',
  async (userId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      await fetchWithAuth(`${API_BASE_URL}/chat/block/${userId}`, token, {
        method: 'POST',
      });
      return userId;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const unblockUser = createAsyncThunk(
  'chat/unblockUser',
  async (userId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      await fetchWithAuth(`${API_BASE_URL}/chat/block/${userId}`, token, {
        method: 'DELETE',
      });
      return userId;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const fetchBlockedUsers = createAsyncThunk(
  'chat/fetchBlockedUsers',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/chat/blocked-users`,
        token,
      );
      return data.users as ChatUser[];
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

// ========================================
// Slice
// ========================================

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveConversation: (state, action: PayloadAction<string | null>) => {
      state.activeConversationId = action.payload;
      state.activeMessages = [];
      state.hasMoreMessages = true;
    },

    clearChat: (state) => {
      return initialState;
    },

    // Real-time: new incoming message
    addRealtimeMessage: (
      state,
      action: PayloadAction<{ message: ChatMessage; conversationId?: string }>,
    ) => {
      const { message, conversationId } = action.payload;
      const convId =
        conversationId ||
        (typeof message.conversation === 'string' ? message.conversation : '');

      // Add to active messages if viewing this conversation
      if (state.activeConversationId === convId) {
        const exists = state.activeMessages.some((m) => m._id === message._id);
        if (!exists) {
          state.activeMessages.push(message);
        }
      }

      // Update conversation in list
      const convIndex = state.conversations.findIndex((c) => c._id === convId);
      if (convIndex >= 0) {
        const conv = state.conversations[convIndex];
        conv.lastMessage = message;
        conv.updatedAt = message.createdAt;
        // Increment unread only if not viewing this conversation
        if (state.activeConversationId !== convId) {
          conv.unread = (conv.unread || 0) + 1;
          state.totalUnread += 1;
        }
        // Move to top
        state.conversations.splice(convIndex, 1);
        state.conversations.unshift(conv);
      }
    },

    // Real-time: message status updates (delivered/seen)
    updateMessageStatus: (
      state,
      action: PayloadAction<{
        messageId?: string;
        conversationId?: string;
        status: 'delivered' | 'seen';
        deliveredAt?: string;
        seenAt?: string;
        bulk?: boolean;
      }>,
    ) => {
      const { messageId, conversationId, status, deliveredAt, seenAt, bulk } =
        action.payload;

      if (bulk && conversationId) {
        // Bulk update all messages in a conversation
        state.activeMessages.forEach((msg) => {
          if (
            (typeof msg.conversation === 'string' ? msg.conversation : '') ===
              conversationId &&
            msg.status !== 'seen'
          ) {
            msg.status = status;
            if (deliveredAt) msg.deliveredAt = deliveredAt;
            if (seenAt) msg.seenAt = seenAt;
          }
        });
      } else if (messageId) {
        const msgIndex = state.activeMessages.findIndex(
          (m) => m._id === messageId,
        );
        if (msgIndex >= 0) {
          state.activeMessages[msgIndex].status = status;
          if (deliveredAt)
            state.activeMessages[msgIndex].deliveredAt = deliveredAt;
          if (seenAt) state.activeMessages[msgIndex].seenAt = seenAt;
        }
      }
    },

    // Real-time: messages in active conversation seen by other user
    markActiveMessagesSeen: (
      state,
      action: PayloadAction<{ conversationId: string; seenAt: string }>,
    ) => {
      const { conversationId, seenAt } = action.payload;
      if (state.activeConversationId === conversationId) {
        state.activeMessages.forEach((msg) => {
          if (msg.status !== 'seen') {
            msg.status = 'seen';
            msg.seenAt = seenAt;
          }
        });
      }
    },

    // Real-time: typing indicator (handled in UI component, not stored)
  },
  extraReducers: (builder) => {
    builder
      // Fetch conversations
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.type === 'direct') {
          state.conversations = action.payload.conversations;
        } else {
          state.requests = action.payload.conversations;
        }
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch messages
      .addCase(fetchMessages.pending, (state) => {
        state.messagesLoading = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.messagesLoading = false;
        const { messages, isLoadMore } = action.payload;
        if (isLoadMore) {
          state.activeMessages = [...messages, ...state.activeMessages];
        } else {
          state.activeMessages = messages;
        }
        state.hasMoreMessages = messages.length >= 30;
      })
      .addCase(fetchMessages.rejected, (state) => {
        state.messagesLoading = false;
      })
      // Send message
      .addCase(sendMessage.pending, (state) => {
        state.sendingMessage = true;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sendingMessage = false;
        const message = action.payload;
        // Add to active messages
        const exists = state.activeMessages.some((m) => m._id === message._id);
        if (!exists) {
          state.activeMessages.push(message);
        }
        // Update the conversation's last message
        const convIndex = state.conversations.findIndex(
          (c) => c._id === state.activeConversationId,
        );
        if (convIndex >= 0) {
          state.conversations[convIndex].lastMessage = message;
          state.conversations[convIndex].updatedAt = message.createdAt;
          // Move to top
          const conv = state.conversations.splice(convIndex, 1)[0];
          state.conversations.unshift(conv);
        }
      })
      .addCase(sendMessage.rejected, (state) => {
        state.sendingMessage = false;
      })
      // Start conversation
      .addCase(startConversation.fulfilled, (state, action) => {
        const conv = action.payload;
        const exists = state.conversations.some((c) => c._id === conv._id);
        if (!exists) {
          state.conversations.unshift(conv);
        }
      })
      // Mark read
      .addCase(markConversationRead.fulfilled, (state, action) => {
        const convId = action.payload;
        const conv = state.conversations.find((c) => c._id === convId);
        if (conv) {
          state.totalUnread = Math.max(0, state.totalUnread - conv.unread);
          conv.unread = 0;
        }
      })
      // Accept request
      .addCase(acceptMessageRequest.fulfilled, (state, action) => {
        const convId = action.payload;
        const reqIdx = state.requests.findIndex((c) => c._id === convId);
        if (reqIdx >= 0) {
          const conv = state.requests.splice(reqIdx, 1)[0];
          conv.isRequest = false;
          state.conversations.unshift(conv);
          state.requestCount = Math.max(0, state.requestCount - 1);
        }
      })
      // Delete conversation
      .addCase(deleteConversation.fulfilled, (state, action) => {
        const convId = action.payload;
        state.conversations = state.conversations.filter(
          (c) => c._id !== convId,
        );
        state.requests = state.requests.filter((c) => c._id !== convId);
      })
      // Unread counts
      .addCase(fetchUnreadCounts.fulfilled, (state, action) => {
        state.totalUnread = action.payload.totalUnread;
        state.requestCount = action.payload.requestCount;
      })
      // Mark all read
      .addCase(markAllConversationsRead.fulfilled, (state) => {
        state.conversations.forEach((c) => {
          c.unread = 0;
        });
        state.totalUnread = 0;
      })
      // Block user — remove their conversation from the list
      .addCase(blockUser.fulfilled, (state, action) => {
        const blockedUserId = action.payload;
        state.conversations = state.conversations.filter((c) => {
          const other =
            c.otherParticipant ||
            c.participants?.find((p) => p._id !== blockedUserId);
          return other?._id !== blockedUserId;
        });
        state.requests = state.requests.filter((c) => {
          const other =
            c.otherParticipant ||
            c.participants?.find((p) => p._id !== blockedUserId);
          return other?._id !== blockedUserId;
        });
      })
      // Fetch blocked users
      .addCase(fetchBlockedUsers.fulfilled, (state, action) => {
        state.blockedUsers = action.payload;
      })
      // Unblock user — remove from blocked list
      .addCase(unblockUser.fulfilled, (state, action) => {
        state.blockedUsers = state.blockedUsers.filter(
          (u) => u._id !== action.payload,
        );
      });
  },
});

export const {
  setActiveConversation,
  clearChat,
  addRealtimeMessage,
  updateMessageStatus,
  markActiveMessagesSeen,
} = chatSlice.actions;

export default chatSlice.reducer;
