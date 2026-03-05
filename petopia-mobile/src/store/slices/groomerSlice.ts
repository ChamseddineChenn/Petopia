import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../config';
import { RootState } from '../store';

// ========================================
// Types
// ========================================

export interface WorkingHours {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart: string | null;
  breakEnd: string | null;
}

export interface ShopService {
  _id: string;
  name: string;
  description: string;
  price: number | null;
  duration: number;
  category: string;
}

export interface ShopPhoto {
  _id?: string;
  url: string;
  caption: string;
}

export interface GroomerShop {
  _id: string;
  owner: {
    _id: string;
    name: string;
    profileImage?: string;
    bio?: string;
    location?: string;
  };
  shopName: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  location: {
    type: string;
    coordinates: [number, number];
  };
  logo: string | null;
  photos: ShopPhoto[];
  services: ShopService[];
  specializations: string[];
  acceptedPetTypes: string[];
  workingHours: WorkingHours[];
  appointmentDuration: number;
  maxDailyAppointments: number;
  mobileGrooming: boolean;
  homeVisitAvailable: boolean;
  pickupDropoff: boolean;
  averageRating: number;
  totalReviews: number;
  isVerified: boolean;
  isActive: boolean;
  allowMessages: boolean;
  createdAt: string;
}

interface GroomerState {
  shops: GroomerShop[];
  currentShop: GroomerShop | null;
  myShop: GroomerShop | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    total: number;
    pages: number;
  };
}

const initialState: GroomerState = {
  shops: [],
  currentShop: null,
  myShop: null,
  loading: false,
  error: null,
  pagination: { page: 1, total: 0, pages: 0 },
};

// ========================================
// Async Thunks
// ========================================

export const fetchGroomerShops = createAsyncThunk(
  'groomers/fetchShops',
  async (
    params: {
      page?: number;
      sort?: string;
      lat?: number;
      lng?: number;
      search?: string;
      petType?: string;
      service?: string;
      mobile?: boolean;
    } = {},
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;

      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set('page', String(params.page));
      if (params.sort) queryParams.set('sort', params.sort);
      if (params.lat) queryParams.set('lat', String(params.lat));
      if (params.lng) queryParams.set('lng', String(params.lng));
      if (params.search) queryParams.set('search', params.search);
      if (params.petType) queryParams.set('petType', params.petType);
      if (params.service) queryParams.set('service', params.service);
      if (params.mobile) queryParams.set('mobile', 'true');

      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `${API_BASE_URL}/groomers?${queryParams.toString()}`,
        { headers },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch groomer shops');
    }
  },
);

export const fetchGroomerShopDetail = createAsyncThunk(
  'groomers/fetchDetail',
  async (shopId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/groomers/${shopId}`, {
        headers,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.shop;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch shop');
    }
  },
);

export const createGroomerShop = createAsyncThunk(
  'groomers/create',
  async (shopData: Record<string, any>, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/groomers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(shopData),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.shop;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to create groomer shop');
    }
  },
);

export const updateGroomerShop = createAsyncThunk(
  'groomers/update',
  async (
    { shopId, data: updates }: { shopId: string; data: Record<string, any> },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/groomers/${shopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.shop;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update groomer shop');
    }
  },
);

export const fetchMyShop = createAsyncThunk(
  'groomers/fetchMyShop',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/groomers/my/shop`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.shop;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch your shop');
    }
  },
);

// ========================================
// Slice
// ========================================

const groomerSlice = createSlice({
  name: 'groomers',
  initialState,
  reducers: {
    clearCurrentShop: (state) => {
      state.currentShop = null;
    },
    clearGroomerError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch shops
      .addCase(fetchGroomerShops.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGroomerShops.fulfilled, (state, action) => {
        state.loading = false;
        state.shops = action.payload.shops;
        state.pagination = {
          page: action.payload.pagination.page,
          total: action.payload.pagination.total,
          pages: action.payload.pagination.pages,
        };
      })
      .addCase(fetchGroomerShops.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch detail
      .addCase(fetchGroomerShopDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGroomerShopDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.currentShop = action.payload;
      })
      .addCase(fetchGroomerShopDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create
      .addCase(createGroomerShop.fulfilled, (state, action) => {
        state.myShop = action.payload;
        state.shops.unshift(action.payload);
      })
      // Update
      .addCase(updateGroomerShop.fulfilled, (state, action) => {
        state.currentShop = action.payload;
        state.myShop = action.payload;
        const idx = state.shops.findIndex((s) => s._id === action.payload._id);
        if (idx !== -1) state.shops[idx] = action.payload;
      })
      // My shop
      .addCase(fetchMyShop.fulfilled, (state, action) => {
        state.myShop = action.payload;
      });
  },
});

export const { clearCurrentShop, clearGroomerError } = groomerSlice.actions;
export default groomerSlice.reducer;
