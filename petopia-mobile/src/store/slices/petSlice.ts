import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import type { RootState } from '../store';

export interface Pet {
  _id: string;
  owner: string;
  name: string;
  species: string;
  breed?: string;
  gender: string;
  dateOfBirth?: string;
  weight?: number;
  color?: string;
  profileImage?: string;
  bio?: string;
  isNeutered?: boolean;
  vaccinations?: { name: string; date: string; nextDue?: string }[];
  medicalNotes?: string;
  age?: number;
  createdAt: string;
  updatedAt: string;
}

interface PetState {
  pets: Pet[];
  selectedPet: Pet | null;
  loading: boolean;
  error: string | null;
}

const initialState: PetState = {
  pets: [],
  selectedPet: null,
  loading: false,
  error: null,
};

const getAuthHeader = (getState: () => unknown) => {
  const token = (getState() as RootState).auth.token;
  if (!token) throw new Error('Not authenticated');
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const fetchPets = createAsyncThunk(
  'pets/fetchPets',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as RootState;
    if (!state.auth.token) return rejectWithValue('Not authenticated');
    try {
      const res = await axios.get(
        `${API_BASE_URL}/pets`,
        getAuthHeader(getState),
      );
      return res.data.pets;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch pets',
      );
    }
  },
);

export const addPet = createAsyncThunk(
  'pets/addPet',
  async (
    petData: {
      name: string;
      species: string;
      breed?: string;
      gender?: string;
      dateOfBirth?: string;
      weight?: number;
      color?: string;
      bio?: string;
      isNeutered?: boolean;
      profileImage?: string;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/pets`,
        petData,
        getAuthHeader(getState),
      );
      return res.data.pet;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to add pet',
      );
    }
  },
);

export const updatePet = createAsyncThunk(
  'pets/updatePet',
  async (
    { petId, data }: { petId: string; data: Partial<Pet> },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await axios.put(
        `${API_BASE_URL}/pets/${petId}`,
        data,
        getAuthHeader(getState),
      );
      return res.data.pet;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to update pet',
      );
    }
  },
);

export const deletePet = createAsyncThunk(
  'pets/deletePet',
  async (petId: string, { getState, rejectWithValue }) => {
    try {
      await axios.delete(
        `${API_BASE_URL}/pets/${petId}`,
        getAuthHeader(getState),
      );
      return petId;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to delete pet',
      );
    }
  },
);

const petSlice = createSlice({
  name: 'pets',
  initialState,
  reducers: {
    clearPetError: (state) => {
      state.error = null;
    },
    setSelectedPet: (state, action) => {
      state.selectedPet = action.payload;
    },
    clearPets: (state) => {
      state.pets = [];
      state.selectedPet = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch
    builder
      .addCase(fetchPets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPets.fulfilled, (state, action) => {
        state.loading = false;
        state.pets = action.payload;
      })
      .addCase(fetchPets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Add
    builder
      .addCase(addPet.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addPet.fulfilled, (state, action) => {
        state.loading = false;
        state.pets.push(action.payload);
      })
      .addCase(addPet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Update
    builder.addCase(updatePet.fulfilled, (state, action) => {
      const idx = state.pets.findIndex((p) => p._id === action.payload._id);
      if (idx !== -1) state.pets[idx] = action.payload;
      if (state.selectedPet?._id === action.payload._id) {
        state.selectedPet = action.payload;
      }
    });

    // Delete
    builder.addCase(deletePet.fulfilled, (state, action) => {
      state.pets = state.pets.filter((p) => p._id !== action.payload);
      if (state.selectedPet?._id === action.payload) {
        state.selectedPet = null;
      }
    });
  },
});

export const { clearPetError, setSelectedPet, clearPets } = petSlice.actions;
export default petSlice.reducer;
