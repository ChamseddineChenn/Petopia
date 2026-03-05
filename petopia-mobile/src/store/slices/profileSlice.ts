import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../config';
import { RootState } from '../store';

// ========================================
// Types
// ========================================

export interface PublicProfile {
  _id: string;
  name: string;
  profileImage?: string;
  bio?: string;
  role?: 'user' | 'vet' | 'groomer' | 'pet_sitter';
  isPrivate: boolean;
  petsCount: number;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followRequestStatus: 'pending' | null;
  isOwnProfile: boolean;
  location?: string;
  city?: string;
  country?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  createdAt?: string;
}

export interface ProfilePet {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  profileImage?: string;
  gender?: string;
  dateOfBirth?: string;
}

export interface ProfilePostMedia {
  url: string;
  publicId: string;
  type: 'image' | 'video';
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  thumbnail?: string | null;
}

export interface ProfilePost {
  _id: string;
  content: string;
  image?: string | null;
  media?: ProfilePostMedia[];
  tags?: string[];
  pet?: { _id: string; name: string; species: string } | null;
  author?: { _id: string; name: string; profileImage?: string };
  sharedPost?: ProfilePost | null;
  likes?: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  createdAt: string;
}

export interface ProfileShop {
  type: 'vet' | 'groomer';
  _id: string;
  clinicName?: string;
  shopName?: string;
  logo?: string;
  averageRating?: number;
  totalReviews?: number;
  isActive?: boolean;
}

export interface FollowRequest {
  _id: string;
  from: {
    _id: string;
    name: string;
    profileImage?: string;
    bio?: string;
  };
  status: 'pending';
  createdAt: string;
}

interface ProfileState {
  profile: PublicProfile | null;
  pets: ProfilePet[];
  posts: ProfilePost[];
  shop: ProfileShop | null;
  followRequests: FollowRequest[];
  loading: boolean;
  followLoading: boolean;
  error: string | null;
  privacy: {
    isPrivate: boolean;
    showLocation: boolean;
    showEmail: boolean;
  } | null;
  privacyLoading: boolean;
}

const initialState: ProfileState = {
  profile: null,
  pets: [],
  posts: [],
  shop: null,
  followRequests: [],
  loading: false,
  followLoading: false,
  error: null,
  privacy: null,
  privacyLoading: false,
};

// ========================================
// Helpers
// ========================================

const getToken = (getState: () => unknown) =>
  (getState() as RootState).auth.token;

// ========================================
// Async Thunks
// ========================================

export const fetchPublicProfile = createAsyncThunk(
  'profile/fetchPublic',
  async (userId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const res = await fetch(`${API_BASE_URL}/user/${userId}/public`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch profile');
    }
  },
);

export const followUser = createAsyncThunk(
  'profile/follow',
  async (userId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const res = await fetch(`${API_BASE_URL}/user/${userId}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to follow user');
    }
  },
);

export const unfollowUser = createAsyncThunk(
  'profile/unfollow',
  async (userId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const res = await fetch(`${API_BASE_URL}/user/${userId}/follow`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to unfollow user');
    }
  },
);

export const fetchFollowRequests = createAsyncThunk(
  'profile/fetchFollowRequests',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const res = await fetch(`${API_BASE_URL}/user/follow-requests/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.requests;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch follow requests');
    }
  },
);

export const respondToFollowRequest = createAsyncThunk(
  'profile/respondFollowRequest',
  async (
    { requestId, action }: { requestId: string; action: 'accept' | 'reject' },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      const res = await fetch(
        `${API_BASE_URL}/user/follow-requests/${requestId}/${action}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return { requestId, action };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to respond to request');
    }
  },
);

export const fetchPrivacySettings = createAsyncThunk(
  'profile/fetchPrivacy',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const res = await fetch(`${API_BASE_URL}/user/privacy`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.privacy;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch privacy settings');
    }
  },
);

export const updatePrivacySettings = createAsyncThunk(
  'profile/updatePrivacy',
  async (
    settings: {
      isPrivate?: boolean;
      showLocation?: boolean;
      showEmail?: boolean;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      const res = await fetch(`${API_BASE_URL}/user/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.privacy;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update privacy');
    }
  },
);

export const fetchFollowers = createAsyncThunk(
  'profile/fetchFollowers',
  async (userId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const res = await fetch(`${API_BASE_URL}/user/${userId}/followers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.users;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch followers');
    }
  },
);

export const fetchFollowing = createAsyncThunk(
  'profile/fetchFollowing',
  async (userId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const res = await fetch(`${API_BASE_URL}/user/${userId}/following`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.users;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch following');
    }
  },
);

// ========================================
// Slice
// ========================================

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    clearProfile: (state) => {
      state.profile = null;
      state.pets = [];
      state.posts = [];
      state.shop = null;
      state.error = null;
    },
    clearProfileError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch public profile
    builder
      .addCase(fetchPublicProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPublicProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload.profile;
        state.pets = action.payload.pets || [];
        state.posts = action.payload.posts || [];
        state.shop = action.payload.shop || null;
      })
      .addCase(fetchPublicProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Follow
    builder
      .addCase(followUser.pending, (state) => {
        state.followLoading = true;
      })
      .addCase(followUser.fulfilled, (state, action) => {
        state.followLoading = false;
        if (state.profile) {
          if (action.payload.status === 'following') {
            state.profile.isFollowing = true;
            state.profile.followRequestStatus = null;
            state.profile.followersCount =
              action.payload.followersCount ?? state.profile.followersCount + 1;
          } else if (action.payload.status === 'requested') {
            state.profile.followRequestStatus = 'pending';
          }
        }
      })
      .addCase(followUser.rejected, (state) => {
        state.followLoading = false;
      });

    // Unfollow
    builder
      .addCase(unfollowUser.pending, (state) => {
        state.followLoading = true;
      })
      .addCase(unfollowUser.fulfilled, (state, action) => {
        state.followLoading = false;
        if (state.profile) {
          state.profile.isFollowing = false;
          state.profile.followRequestStatus = null;
          state.profile.followersCount =
            action.payload.followersCount ?? state.profile.followersCount - 1;
        }
      })
      .addCase(unfollowUser.rejected, (state) => {
        state.followLoading = false;
      });

    // Follow requests
    builder
      .addCase(fetchFollowRequests.fulfilled, (state, action) => {
        state.followRequests = action.payload;
      })
      .addCase(respondToFollowRequest.fulfilled, (state, action) => {
        state.followRequests = state.followRequests.filter(
          (r) => r._id !== action.payload.requestId,
        );
      });

    // Privacy
    builder
      .addCase(fetchPrivacySettings.pending, (state) => {
        state.privacyLoading = true;
      })
      .addCase(fetchPrivacySettings.fulfilled, (state, action) => {
        state.privacyLoading = false;
        state.privacy = action.payload;
      })
      .addCase(fetchPrivacySettings.rejected, (state) => {
        state.privacyLoading = false;
      })
      .addCase(updatePrivacySettings.fulfilled, (state, action) => {
        state.privacy = action.payload;
      });
  },
});

export const { clearProfile, clearProfileError } = profileSlice.actions;
export default profileSlice.reducer;
