import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../config';
import { RootState } from '../store';

// ========================================
// Types
// ========================================

export interface Review {
  _id: string;
  clinic: string;
  user: {
    _id: string;
    name: string;
    profileImage?: string;
  };
  rating: number;
  title: string;
  comment: string;
  photos: string[];
  response: {
    text: string | null;
    respondedAt: string | null;
  };
  pet?: {
    _id: string;
    name: string;
    species: string;
  };
  visitedFor: string;
  helpfulCount: number;
  helpfulVotes: string[];
  createdAt: string;
}

interface ReviewState {
  reviews: Review[];
  ratingDistribution: Record<number, number>;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    total: number;
    pages: number;
  };
}

const initialState: ReviewState = {
  reviews: [],
  ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  loading: false,
  error: null,
  pagination: { page: 1, total: 0, pages: 0 },
};

// ========================================
// Async Thunks
// ========================================

export const fetchReviews = createAsyncThunk(
  'reviews/fetch',
  async (
    {
      clinicId,
      page = 1,
      sort = 'newest',
    }: { clinicId: string; page?: number; sort?: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/reviews/${clinicId}?page=${page}&sort=${sort}`,
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch reviews');
    }
  },
);

export const createReview = createAsyncThunk(
  'reviews/create',
  async (
    {
      clinicId,
      reviewData,
    }: {
      clinicId: string;
      reviewData: {
        rating: number;
        title?: string;
        comment: string;
        photos?: string[];
        pet?: string;
        visitedFor?: string;
      };
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/reviews/${clinicId}`, {
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

export const deleteReview = createAsyncThunk(
  'reviews/delete',
  async (reviewId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/reviews/${reviewId}`, {
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

export const toggleHelpful = createAsyncThunk(
  'reviews/toggleHelpful',
  async (reviewId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return {
        reviewId,
        helpfulCount: data.helpfulCount,
        isHelpful: data.isHelpful,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to toggle helpful');
    }
  },
);

// ========================================
// Slice
// ========================================

const reviewSlice = createSlice({
  name: 'reviews',
  initialState,
  reducers: {
    clearReviews: (state) => {
      state.reviews = [];
      state.ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReviews.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReviews.fulfilled, (state, action) => {
        state.loading = false;
        state.reviews = action.payload.reviews;
        state.ratingDistribution = action.payload.ratingDistribution;
        state.pagination = {
          page: action.payload.pagination.page,
          total: action.payload.pagination.total,
          pages: action.payload.pagination.pages,
        };
      })
      .addCase(fetchReviews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createReview.fulfilled, (state, action) => {
        state.reviews.unshift(action.payload);
      })
      .addCase(deleteReview.fulfilled, (state, action) => {
        state.reviews = state.reviews.filter((r) => r._id !== action.payload);
      })
      .addCase(toggleHelpful.fulfilled, (state, action) => {
        const review = state.reviews.find(
          (r) => r._id === action.payload.reviewId,
        );
        if (review) {
          review.helpfulCount = action.payload.helpfulCount;
        }
      });
  },
});

export const { clearReviews } = reviewSlice.actions;
export default reviewSlice.reducer;
