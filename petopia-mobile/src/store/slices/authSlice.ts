import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

// Axios instance with timeout so requests never hang forever
const api = axios.create({
  timeout: 15000, // 15 seconds max
});

// Friendly error message from axios errors
const getErrorMessage = (error: any, fallback: string): string => {
  if (error.code === 'ECONNABORTED')
    return 'Request timed out. Please check your connection and try again.';
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error')
    return 'Unable to reach the server. Please check your internet connection.';
  return error.response?.data?.message || fallback;
};

// Helper to get auth header from state — throws when logged out
const getAuthHeader = (getState: () => any) => {
  const token = getState().auth.token;
  if (!token) throw new Error('Not authenticated');
  return { headers: { Authorization: `Bearer ${token}` } };
};

// Async thunks
export const register = createAsyncThunk(
  'auth/register',
  async (
    credentials: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
      role?: 'user' | 'vet' | 'groomer' | 'pet_sitter' | 'pet_shop';
      phone?: string;
      gender?: string;
      dateOfBirth?: string;
      country?: string;
      city?: string;
      termsAccepted?: boolean;
    },
    { rejectWithValue },
  ) => {
    try {
      const response = await api.post(
        `${API_BASE_URL}/auth/register`,
        credentials,
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error, 'Registration failed'));
    }
  },
);

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async (token: string, { rejectWithValue }) => {
    try {
      const response = await api.post(`${API_BASE_URL}/auth/verify-email`, {
        token,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        getErrorMessage(error, 'Email verification failed'),
      );
    }
  },
);

export const resendVerification = createAsyncThunk(
  'auth/resendVerification',
  async (email: string, { rejectWithValue }) => {
    try {
      const response = await api.post(
        `${API_BASE_URL}/auth/resend-verification`,
        { email },
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        getErrorMessage(error, 'Failed to resend verification email'),
      );
    }
  },
);

export const login = createAsyncThunk(
  'auth/login',
  async (
    credentials: { email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await api.post(
        `${API_BASE_URL}/auth/login`,
        credentials,
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error, 'Login failed'));
    }
  },
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (token: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data.user;
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch user'));
    }
  },
);

export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { getState, rejectWithValue }) => {
    const token = (getState() as any).auth.token;
    if (!token) return rejectWithValue('Not authenticated');
    try {
      const res = await api.get(
        `${API_BASE_URL}/user/profile`,
        getAuthHeader(getState),
      );
      return res.data.user;
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch profile'));
    }
  },
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (
    data: {
      name?: string;
      bio?: string;
      location?: string;
      phone?: string;
      profileImage?: string;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await api.put(
        `${API_BASE_URL}/user/profile`,
        data,
        getAuthHeader(getState),
      );
      return res.data.user;
    } catch (error: any) {
      return rejectWithValue(
        getErrorMessage(error, 'Failed to update profile'),
      );
    }
  },
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (
    data: { currentPassword: string; newPassword: string },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await api.put(
        `${API_BASE_URL}/user/change-password`,
        data,
        getAuthHeader(getState),
      );
      return res.data.message;
    } catch (error: any) {
      return rejectWithValue(
        getErrorMessage(error, 'Failed to change password'),
      );
    }
  },
);

export const deleteAccount = createAsyncThunk(
  'auth/deleteAccount',
  async (password: string, { getState, rejectWithValue }) => {
    try {
      const res = await api.delete(`${API_BASE_URL}/user/account`, {
        ...getAuthHeader(getState),
        data: { password },
      });
      return res.data;
    } catch (error: any) {
      return rejectWithValue(
        getErrorMessage(error, 'Failed to delete account'),
      );
    }
  },
);

interface User {
  _id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  role?: 'user' | 'vet' | 'groomer' | 'pet_sitter' | 'pet_shop';
  profileImage?: string;
  bio?: string;
  gender?: string;
  dateOfBirth?: string;
  location?: string;
  country?: string;
  city?: string;
  phone?: string;
  isPrivate?: boolean;
  petsCount?: number;
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  petDollars?: number;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  pendingVerification: boolean;
  pendingVerificationEmail: string | null;
  verificationMessage: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  pendingVerification: false,
  pendingVerificationEmail: null,
  verificationMessage: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.pendingVerification = false;
      state.pendingVerificationEmail = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearVerificationMessage: (state) => {
      state.verificationMessage = null;
    },
    setToken: (state, action) => {
      state.token = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Register
    builder
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingVerification = true;
        state.pendingVerificationEmail = action.payload.user?.email || null;
        state.verificationMessage = action.payload.message;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Verify Email
    builder
      .addCase(verifyEmail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.pendingVerification = false;
        state.pendingVerificationEmail = null;
        state.verificationMessage = action.payload.message;
        state.error = null;
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Resend Verification
    builder
      .addCase(resendVerification.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resendVerification.fulfilled, (state, action) => {
        state.loading = false;
        state.verificationMessage = action.payload.message;
        state.error = null;
      })
      .addCase(resendVerification.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Login
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Get Current User
    builder
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.token = null;
      });

    // Fetch Profile (with stats)
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Update Profile
    builder
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        if (state.user) {
          state.user = { ...state.user, ...action.payload };
        }
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Change Password
    builder.addCase(changePassword.rejected, (state, action) => {
      state.error = action.payload as string;
    });

    // Delete Account
    builder.addCase(deleteAccount.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    });
  },
});

export const { logout, clearError, clearVerificationMessage, setToken } =
  authSlice.actions;
export default authSlice.reducer;
