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

export interface Appointment {
  _id: string;
  clinic: {
    _id: string;
    clinicName: string;
    phone: string;
    address: { street: string; city: string; state: string };
    logo?: string;
  };
  vet: {
    _id: string;
    name: string;
    profileImage?: string;
  };
  user: {
    _id: string;
    name: string;
    profileImage?: string;
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
  cancelledBy: 'user' | 'vet' | null;
  cancellationReason: string;
  createdAt: string;
}

interface AppointmentState {
  appointments: Appointment[];
  vetAppointments: Appointment[];
  availableSlots: TimeSlot[];
  loading: boolean;
  slotsLoading: boolean;
  error: string | null;
}

const initialState: AppointmentState = {
  appointments: [],
  vetAppointments: [],
  availableSlots: [],
  loading: false,
  slotsLoading: false,
  error: null,
};

// ========================================
// Async Thunks
// ========================================

export const fetchAvailableSlots = createAsyncThunk(
  'appointments/fetchSlots',
  async (
    { clinicId, date }: { clinicId: string; date: string },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      const res = await fetch(
        `${API_BASE_URL}/appointments/slots/${clinicId}?date=${date}`,
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

export const bookAppointment = createAsyncThunk(
  'appointments/book',
  async (
    appointmentData: {
      clinicId: string;
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
      const res = await fetch(`${API_BASE_URL}/appointments`, {
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

export const fetchMyAppointments = createAsyncThunk(
  'appointments/fetchMine',
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
        `${API_BASE_URL}/appointments/my?${queryParams.toString()}`,
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

export const fetchVetAppointments = createAsyncThunk(
  'appointments/fetchVet',
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
        `${API_BASE_URL}/appointments/vet?${queryParams.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.appointments;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch vet appointments');
    }
  },
);

export const updateAppointmentStatus = createAsyncThunk(
  'appointments/updateStatus',
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
        `${API_BASE_URL}/appointments/${appointmentId}/status`,
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

const appointmentSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: {
    clearSlots: (state) => {
      state.availableSlots = [];
    },
    clearAppointmentError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Slots
      .addCase(fetchAvailableSlots.pending, (state) => {
        state.slotsLoading = true;
      })
      .addCase(fetchAvailableSlots.fulfilled, (state, action) => {
        state.slotsLoading = false;
        state.availableSlots = action.payload;
      })
      .addCase(fetchAvailableSlots.rejected, (state, action) => {
        state.slotsLoading = false;
        state.error = action.payload as string;
      })
      // Book
      .addCase(bookAppointment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bookAppointment.fulfilled, (state, action) => {
        state.loading = false;
        state.appointments.unshift(action.payload);
      })
      .addCase(bookAppointment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // My appointments
      .addCase(fetchMyAppointments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMyAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.appointments = action.payload;
      })
      .addCase(fetchMyAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Vet appointments
      .addCase(fetchVetAppointments.fulfilled, (state, action) => {
        state.vetAppointments = action.payload;
      })
      // Update status
      .addCase(updateAppointmentStatus.fulfilled, (state, action) => {
        const update = (list: Appointment[]) => {
          const idx = list.findIndex((a) => a._id === action.payload._id);
          if (idx !== -1) list[idx] = action.payload;
        };
        update(state.appointments);
        update(state.vetAppointments);
      });
  },
});

export const { clearSlots, clearAppointmentError } = appointmentSlice.actions;
export default appointmentSlice.reducer;
