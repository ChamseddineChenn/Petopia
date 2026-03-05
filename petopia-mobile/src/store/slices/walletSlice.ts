import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const api = axios.create({ timeout: 15000 });

const getErrorMessage = (error: any, fallback: string): string => {
  if (error.code === 'ECONNABORTED')
    return 'Request timed out. Please check your connection and try again.';
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error')
    return 'Unable to reach the server. Please check your internet connection.';
  return error.response?.data?.message || fallback;
};

const getAuthHeader = (getState: () => any) => {
  const token = getState().auth.token;
  if (!token) throw new Error('Not authenticated');
  return { headers: { Authorization: `Bearer ${token}` } };
};

// ── Types ──

export interface WalletTransaction {
  _id: string;
  user: string;
  type:
    | 'top_up'
    | 'purchase'
    | 'refund'
    | 'reward'
    | 'transfer_in'
    | 'transfer_out'
    | 'commission'
    | 'reservation'
    | 'withdrawal';
  amount: number;
  balanceAfter: number;
  description: string;
  reference?: {
    entityType?: string;
    entityId?: string;
    shopId?: string;
    items?: {
      productId: string;
      title: string;
      quantity: number;
      price: number;
    }[];
  };
  stripeDetails?: {
    paymentIntentId?: string;
    chargeId?: string;
    payerName?: string;
    payerEmail?: string;
    paymentMethodType?: string;
    cardBrand?: string;
    cardLast4?: string;
    cardExpMonth?: number;
    cardExpYear?: number;
    cardCountry?: string;
    cardFunding?: string;
    amountCharged?: number;
    currency?: string;
    stripeFee?: number;
    receiptUrl?: string;
    receiptEmail?: string;
    riskLevel?: string;
    riskScore?: number;
    stripeStatus?: string;
    stripePaidAt?: string;
  };
  commission?: {
    rate?: number;
    platformAmount?: number;
    sellerAmount?: number;
    sellerId?: string;
  };
  status: 'completed' | 'pending' | 'failed' | 'reversed';
  createdAt: string;
  updatedAt: string;
}

interface WalletState {
  balance: number;
  transactions: WalletTransaction[];
  loading: boolean;
  topUpLoading: boolean;
  error: string | null;
  pagination: { page: number; pages: number; total: number };
}

const initialState: WalletState = {
  balance: 0,
  transactions: [],
  loading: false,
  topUpLoading: false,
  error: null,
  pagination: { page: 1, pages: 1, total: 0 },
};

// ── Thunks ──

export const fetchWallet = createAsyncThunk(
  'wallet/fetchWallet',
  async (params: { page?: number } = {}, { getState, rejectWithValue }) => {
    try {
      const page = params.page || 1;
      const res = await api.get(
        `${API_BASE_URL}/wallet?page=${page}`,
        getAuthHeader(getState),
      );
      return { ...res.data, page };
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch wallet'));
    }
  },
);

export const fetchBalance = createAsyncThunk(
  'wallet/fetchBalance',
  async (_, { getState, rejectWithValue }) => {
    const token = (getState() as any).auth.token;
    if (!token) return rejectWithValue('Not authenticated');
    try {
      const res = await api.get(
        `${API_BASE_URL}/wallet/balance`,
        getAuthHeader(getState),
      );
      return res.data.balance;
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch balance'));
    }
  },
);

/**
 * @deprecated Direct top-up is disabled. Use Stripe payment flow via paymentService.ts.
 * Kept for backwards compatibility — will return a 410 from server.
 */
export const topUp = createAsyncThunk(
  'wallet/topUp',
  async (amount: number, { getState, rejectWithValue }) => {
    try {
      const res = await api.post(
        `${API_BASE_URL}/wallet/top-up`,
        { amount },
        getAuthHeader(getState),
      );
      return res.data;
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error, 'Top-up failed'));
    }
  },
);

// ── Slice ──

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    clearWalletError(state) {
      state.error = null;
    },
    setBalance(state, action: PayloadAction<number>) {
      state.balance = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchWallet
      .addCase(fetchWallet.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.loading = false;
        state.balance = action.payload.balance;
        if (action.payload.page === 1) {
          state.transactions = action.payload.transactions;
        } else {
          state.transactions = [
            ...state.transactions,
            ...action.payload.transactions,
          ];
        }
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // fetchBalance
      .addCase(fetchBalance.fulfilled, (state, action) => {
        state.balance = action.payload;
      })

      // topUp
      .addCase(topUp.pending, (state) => {
        state.topUpLoading = true;
        state.error = null;
      })
      .addCase(topUp.fulfilled, (state, action) => {
        state.topUpLoading = false;
        state.balance = action.payload.balance;
        // Prepend the new transaction
        if (action.payload.transaction) {
          state.transactions = [
            action.payload.transaction,
            ...state.transactions,
          ];
          state.pagination.total += 1;
        }
      })
      .addCase(topUp.rejected, (state, action) => {
        state.topUpLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearWalletError, setBalance } = walletSlice.actions;
export default walletSlice.reducer;
