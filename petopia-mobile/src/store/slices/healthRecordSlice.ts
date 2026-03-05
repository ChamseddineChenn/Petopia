import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import type { RootState } from '../store';

export interface HealthRecord {
  _id: string;
  pet: string;
  owner: string;
  recordType: string;
  title: string;
  description: string;
  date: string;
  veterinarian: {
    name: string;
    clinic: string;
    phone: string;
    licenseNumber: string;
  };
  vaccination: {
    vaccineName: string;
    manufacturer: string;
    lotNumber: string;
    serialNumber: string;
    dosage: string;
    route: string;
    site: string;
    nextDueDate: string | null;
    isBooster: boolean;
  };
  examination: {
    weight: number | null;
    temperature: number | null;
    heartRate: number | null;
    respiratoryRate: number | null;
    bodyConditionScore: number | null;
    findings: string;
    recommendations: string;
  };
  laboratory: {
    testName: string;
    results: string;
    referenceRange: string;
    isAbnormal: boolean;
  };
  prescription: {
    medicationName: string;
    dosage: string;
    frequency: string;
    duration: string;
    startDate: string | null;
    endDate: string | null;
    refillsRemaining: number;
    instructions: string;
  };
  surgery: {
    procedure: string;
    anesthesia: string;
    duration: string;
    complications: string;
    postOpInstructions: string;
    followUpDate: string | null;
  };
  attachments: {
    url: string;
    publicId: string;
    name: string;
    type: string;
    uploadedAt: string;
  }[];
  notes: string;
  followUpDate: string | null;
  followUpNotes: string;
  cost: {
    amount: number | null;
    currency: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface HealthRecordState {
  records: HealthRecord[];
  selectedRecord: HealthRecord | null;
  loading: boolean;
  error: string | null;
}

const initialState: HealthRecordState = {
  records: [],
  selectedRecord: null,
  loading: false,
  error: null,
};

const getAuthHeader = (getState: () => unknown) => {
  const token = (getState() as RootState).auth.token;
  if (!token) throw new Error('Not authenticated');
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const fetchHealthRecords = createAsyncThunk(
  'healthRecords/fetch',
  async (
    { petId, recordType }: { petId: string; recordType?: string },
    { getState, rejectWithValue },
  ) => {
    try {
      let url = `${API_BASE_URL}/health-records/${petId}`;
      if (recordType) url += `?recordType=${recordType}`;
      const res = await axios.get(url, getAuthHeader(getState));
      return res.data.records;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch health records',
      );
    }
  },
);

export const createHealthRecord = createAsyncThunk(
  'healthRecords/create',
  async (
    { petId, data }: { petId: string; data: Partial<HealthRecord> },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/health-records/${petId}`,
        data,
        getAuthHeader(getState),
      );
      return res.data.record;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to create health record',
      );
    }
  },
);

export const updateHealthRecord = createAsyncThunk(
  'healthRecords/update',
  async (
    {
      petId,
      recordId,
      data,
    }: { petId: string; recordId: string; data: Partial<HealthRecord> },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await axios.put(
        `${API_BASE_URL}/health-records/${petId}/${recordId}`,
        data,
        getAuthHeader(getState),
      );
      return res.data.record;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to update health record',
      );
    }
  },
);

export const deleteHealthRecord = createAsyncThunk(
  'healthRecords/delete',
  async (
    { petId, recordId }: { petId: string; recordId: string },
    { getState, rejectWithValue },
  ) => {
    try {
      await axios.delete(
        `${API_BASE_URL}/health-records/${petId}/${recordId}`,
        getAuthHeader(getState),
      );
      return recordId;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to delete health record',
      );
    }
  },
);

const healthRecordSlice = createSlice({
  name: 'healthRecords',
  initialState,
  reducers: {
    clearHealthRecords: (state) => {
      state.records = [];
      state.selectedRecord = null;
    },
    setSelectedRecord: (state, action) => {
      state.selectedRecord = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHealthRecords.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHealthRecords.fulfilled, (state, action) => {
        state.loading = false;
        state.records = action.payload;
      })
      .addCase(fetchHealthRecords.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder.addCase(createHealthRecord.fulfilled, (state, action) => {
      state.records.unshift(action.payload);
    });

    builder.addCase(updateHealthRecord.fulfilled, (state, action) => {
      const idx = state.records.findIndex((r) => r._id === action.payload._id);
      if (idx !== -1) state.records[idx] = action.payload;
    });

    builder.addCase(deleteHealthRecord.fulfilled, (state, action) => {
      state.records = state.records.filter((r) => r._id !== action.payload);
    });
  },
});

export const { clearHealthRecords, setSelectedRecord } =
  healthRecordSlice.actions;
export default healthRecordSlice.reducer;
