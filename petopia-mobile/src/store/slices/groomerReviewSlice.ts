import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../config';
import { RootState } from '../store';

// ========================================
// Types
// ========================================

export interface GroomerReview {
  _id: string;
  shop: string;
  user: {
    _id: string;
    name: string;
    profileImage?: string;
  };
  rating: number;
  title: string;
  comment: string;
  visitDate?: string;
  serviceType?: string;
  helpfulCount: number;
  helpfulBy: string[];
  groomerResponse?: {
    comment: string;
    respondedAt: string;
  };
  createdAt: string;
}

interface GroomerReviewState {
  reviews: GroomerReview[];
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    pages: number;
  };
}

const initialState: GroomerReviewState = {
  reviews: [],
  loading: false,
  error: null,
  pagination: { total: 0, page: 1, pages: 1 },
};

// ========================================
// Async Thunks
// ========================================

export const fetchGroomerReviews = createAsyncThunk(
  'groomerReviews/fetch',
  async (
    {
      shopId,
      page = 1,
      sort = 'recent',
    }: { shopId: string; page?: number; sort?: string },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(
        `${API_BASE_URL}/groomer-reviews/${shopId}?page=${page}&sort=${sort}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch reviews');
    }
  },
);

export const createGroomerReview = createAsyncThunk(
  'groomerReviews/create',
  async (
    {
      shopId,
      ...reviewData
    }: {
      shopId: string;
      rating: number;
      title: string;
      comment: string;
      visitDate?: string;
      serviceType?: string;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/groomer-reviews/${shopId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reviewData),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.review;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to create review');
    }
  },
);

export const deleteGroomerReview = createAsyncThunk(
  'groomerReviews/delete',
  async (reviewId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/groomer-reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return reviewId;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to delete review');
    }
  },
);

export const toggleGroomerReviewHelpful = createAsyncThunk(
  'groomerReviews/toggleHelpful',
  async (reviewId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(
        `${API_BASE_URL}/groomer-reviews/${reviewId}/helpful`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.review;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to toggle helpful');
    }
  },
);

// ========================================
// Slice
// ========================================

const groomerReviewSlice = createSlice({
  name: 'groomerReviews',
  initialState,
  reducers: {
    clearGroomerReviews: (state) => {
      state.reviews = [];
      state.pagination = { total: 0, page: 1, pages: 1 };
    },
    clearGroomerReviewError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchGroomerReviews.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchGroomerReviews.fulfilled, (state, action) => {
        state.loading = false;
        state.reviews = action.payload.reviews;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchGroomerReviews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create
      .addCase(createGroomerReview.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createGroomerReview.fulfilled, (state, action) => {
        state.loading = false;
        state.reviews.unshift(action.payload);
      })
      .addCase(createGroomerReview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete
      .addCase(deleteGroomerReview.fulfilled, (state, action) => {
        state.reviews = state.reviews.filter((r) => r._id !== action.payload);
      })
      // Toggle helpful
      .addCase(toggleGroomerReviewHelpful.fulfilled, (state, action) => {
        const idx = state.reviews.findIndex(
          (r) => r._id === action.payload._id,
        );
        if (idx !== -1) state.reviews[idx] = action.payload;
      });
  },
});

export const { clearGroomerReviews, clearGroomerReviewError } =
  groomerReviewSlice.actions;
export default groomerReviewSlice.reducer;
