import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../config';
import { RootState } from '../store';

// ========================================
// Types
// ========================================

export interface TimeSlot {
  start: string;
  end: string;
  available?: boolean;
}

export interface GroomerAppointment {
  _id: string;
  shop: {
    _id: string;
    shopName: string;
    phone: string;
    address: { street: string; city: string; state: string };
    logo?: string;
  };
  groomer: {
    _id: string;
    name: string;
    profileImage?: string;
  };
  user: {
    _id: string;
    name: string;
    profileImage?: string;
    phone?: string;
  };
  pet: {
    _id: string;
    name: string;
    species: string;
    breed?: string;
    profileImage?: string;
  };
  date: string;
  timeSlot: TimeSlot;
  service: {
    name: string;
    duration: number;
    price: number | null;
  };
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  reason: string;
  notes: string;
  cancelledBy: 'user' | 'groomer' | null;
  cancellationReason: string;
  createdAt: string;
}

interface GroomerAppointmentState {
  appointments: GroomerAppointment[];
  groomerAppointments: GroomerAppointment[];
  availableSlots: TimeSlot[];
  loading: boolean;
  slotsLoading: boolean;
  error: string | null;
}

const initialState: GroomerAppointmentState = {
  appointments: [],
  groomerAppointments: [],
  availableSlots: [],
  loading: false,
  slotsLoading: false,
  error: null,
};

// ========================================
// Async Thunks
// ========================================

export const fetchGroomerAvailableSlots = createAsyncThunk(
  'groomerAppointments/fetchSlots',
  async (
    { shopId, date }: { shopId: string; date: string },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(
        `${API_BASE_URL}/groomer-appointments/slots/${shopId}?date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.slots;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch slots');
    }
  },
);

export const bookGroomerAppointment = createAsyncThunk(
  'groomerAppointments/book',
  async (
    appointmentData: {
      shopId: string;
      petId: string;
      date: string;
      timeSlot: { start: string; end: string };
      serviceName: string;
      reason?: string;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(`${API_BASE_URL}/groomer-appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(appointmentData),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.appointment;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to book appointment');
    }
  },
);

export const fetchMyGroomerAppointments = createAsyncThunk(
  'groomerAppointments/fetchMine',
  async (
    params: { upcoming?: boolean; status?: string } = {},
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const queryParams = new URLSearchParams();
      if (params.upcoming) queryParams.set('upcoming', 'true');
      if (params.status) queryParams.set('status', params.status);

      const res = await fetch(
        `${API_BASE_URL}/groomer-appointments/my?${queryParams.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.appointments;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch appointments');
    }
  },
);

export const fetchGroomerOwnAppointments = createAsyncThunk(
  'groomerAppointments/fetchGroomer',
  async (
    params: { date?: string; status?: string } = {},
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const queryParams = new URLSearchParams();
      if (params.date) queryParams.set('date', params.date);
      if (params.status) queryParams.set('status', params.status);

      const res = await fetch(
        `${API_BASE_URL}/groomer-appointments/groomer?${queryParams.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.appointments;
    } catch (err: any) {
      return rejectWithValue(
        err.message || 'Failed to fetch groomer appointments',
      );
    }
  },
);

export const updateGroomerAppointmentStatus = createAsyncThunk(
  'groomerAppointments/updateStatus',
  async (
    {
      appointmentId,
      status,
      cancellationReason,
      notes,
    }: {
      appointmentId: string;
      status: string;
      cancellationReason?: string;
      notes?: string;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(
        `${API_BASE_URL}/groomer-appointments/${appointmentId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status, cancellationReason, notes }),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.appointment;
    } catch (err: any) {
      return rejectWithValue(
        err.message || 'Failed to update appointment status',
      );
    }
  },
);

// ========================================
// Slice
// ========================================

const groomerAppointmentSlice = createSlice({
  name: 'groomerAppointments',
  initialState,
  reducers: {
    clearGroomerSlots: (state) => {
      state.availableSlots = [];
    },
    clearGroomerAppointmentError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Slots
      .addCase(fetchGroomerAvailableSlots.pending, (state) => {
        state.slotsLoading = true;
      })
      .addCase(fetchGroomerAvailableSlots.fulfilled, (state, action) => {
        state.slotsLoading = false;
        state.availableSlots = action.payload;
      })
      .addCase(fetchGroomerAvailableSlots.rejected, (state, action) => {
        state.slotsLoading = false;
        state.error = action.payload as string;
      })
      // Book
      .addCase(bookGroomerAppointment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bookGroomerAppointment.fulfilled, (state, action) => {
        state.loading = false;
        state.appointments.unshift(action.payload);
      })
      .addCase(bookGroomerAppointment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // My appointments
      .addCase(fetchMyGroomerAppointments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMyGroomerAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.appointments = action.payload;
      })
      .addCase(fetchMyGroomerAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Groomer appointments
      .addCase(fetchGroomerOwnAppointments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchGroomerOwnAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.groomerAppointments = action.payload;
      })
      .addCase(fetchGroomerOwnAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update status
      .addCase(updateGroomerAppointmentStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        const idx = state.groomerAppointments.findIndex(
          (a) => a._id === updated._id,
        );
        if (idx !== -1) state.groomerAppointments[idx] = updated;
        const idx2 = state.appointments.findIndex((a) => a._id === updated._id);
        if (idx2 !== -1) state.appointments[idx2] = updated;
      });
  },
});

export const { clearGroomerSlots, clearGroomerAppointmentError } =
  groomerAppointmentSlice.actions;
export default groomerAppointmentSlice.reducer;
