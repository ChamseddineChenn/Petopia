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

export interface ClinicService {
  _id: string;
  name: string;
  description: string;
  price: number | null;
  duration: number;
  category: string;
}

export interface ClinicPhoto {
  _id?: string;
  url: string;
  caption: string;
}

export interface VetClinic {
  _id: string;
  owner: {
    _id: string;
    name: string;
    profileImage?: string;
    bio?: string;
    location?: string;
  };
  clinicName: string;
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
  photos: ClinicPhoto[];
  services: ClinicService[];
  specializations: string[];
  acceptedPetTypes: string[];
  workingHours: WorkingHours[];
  appointmentDuration: number;
  maxDailyAppointments: number;
  emergencyAvailable: boolean;
  homeVisitAvailable: boolean;
  onlineConsultation: boolean;
  averageRating: number;
  totalReviews: number;
  isVerified: boolean;
  isActive: boolean;
  licenseNumber: string;
  yearsOfExperience: number;
  allowMessages: boolean;
  createdAt: string;
}

interface VetState {
  clinics: VetClinic[];
  currentClinic: VetClinic | null;
  myClinic: VetClinic | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    total: number;
    pages: number;
  };
}

const initialState: VetState = {
  clinics: [],
  currentClinic: null,
  myClinic: null,
  loading: false,
  error: null,
  pagination: { page: 1, total: 0, pages: 0 },
};

// ========================================
// Async Thunks
// ========================================

export const fetchVetClinics = createAsyncThunk(
  'vets/fetchClinics',
  async (
    params: {
      page?: number;
      sort?: string;
      lat?: number;
      lng?: number;
      search?: string;
      petType?: string;
      service?: string;
      emergency?: boolean;
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
      if (params.emergency) queryParams.set('emergency', 'true');

      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `${API_BASE_URL}/vets?${queryParams.toString()}`,
        { headers },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch clinics');
    }
  },
);

export const fetchVetClinicDetail = createAsyncThunk(
  'vets/fetchDetail',
  async (clinicId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/vets/${clinicId}`, { headers });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.clinic;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch clinic');
    }
  },
);

export const createVetClinic = createAsyncThunk(
  'vets/create',
  async (clinicData: Record<string, any>, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/vets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(clinicData),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.clinic;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to create clinic');
    }
  },
);

export const updateVetClinic = createAsyncThunk(
  'vets/update',
  async (
    {
      clinicId,
      data: updates,
    }: { clinicId: string; data: Record<string, any> },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/vets/${clinicId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.clinic;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update clinic');
    }
  },
);

export const fetchMyClinic = createAsyncThunk(
  'vets/fetchMyClinic',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/vets/my/clinic`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.clinic;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch your clinic');
    }
  },
);

// ========================================
// Slice
// ========================================

const vetSlice = createSlice({
  name: 'vets',
  initialState,
  reducers: {
    clearCurrentClinic: (state) => {
      state.currentClinic = null;
    },
    clearVetError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch clinics
      .addCase(fetchVetClinics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVetClinics.fulfilled, (state, action) => {
        state.loading = false;
        state.clinics = action.payload.clinics;
        state.pagination = {
          page: action.payload.pagination.page,
          total: action.payload.pagination.total,
          pages: action.payload.pagination.pages,
        };
      })
      .addCase(fetchVetClinics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch detail
      .addCase(fetchVetClinicDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVetClinicDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.currentClinic = action.payload;
      })
      .addCase(fetchVetClinicDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create
      .addCase(createVetClinic.fulfilled, (state, action) => {
        state.myClinic = action.payload;
        state.clinics.unshift(action.payload);
      })
      // Update
      .addCase(updateVetClinic.fulfilled, (state, action) => {
        state.currentClinic = action.payload;
        state.myClinic = action.payload;
        const idx = state.clinics.findIndex(
          (c) => c._id === action.payload._id,
        );
        if (idx !== -1) state.clinics[idx] = action.payload;
      })
      // My clinic
      .addCase(fetchMyClinic.fulfilled, (state, action) => {
        state.myClinic = action.payload;
      });
  },
});

export const { clearCurrentClinic, clearVetError } = vetSlice.actions;
export default vetSlice.reducer;
