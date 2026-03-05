import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { RootState } from '../store';

// ────────────────────────────────────────
// Types
// ────────────────────────────────────────

export interface CartItem {
  _id: string;
  product: {
    _id: string;
    title: string;
    price: number;
    images: string[];
    isActive: boolean;
    quantity: number;
  };
  shop: {
    _id: string;
    shopName: string;
    logo?: string;
  };
  quantity: number;
  priceAtAdd: number;
}

export interface Cart {
  _id?: string;
  items: CartItem[];
  total: number;
  itemCount: number;
}

interface CartState {
  cart: Cart;
  loading: boolean;
  adding: boolean;
  error: string | null;
}

const initialState: CartState = {
  cart: { items: [], total: 0, itemCount: 0 },
  loading: false,
  adding: false,
  error: null,
};

// ────────────────────────────────────────
// Helpers
// ────────────────────────────────────────
const api = axios.create({ timeout: 15000 });

const getAuthHeader = (getState: () => unknown) => {
  const token = (getState() as RootState).auth.token;
  if (!token) throw new Error('Not authenticated');
  return { headers: { Authorization: `Bearer ${token}` } };
};

const errMsg = (error: any, fallback: string): string => {
  if (error.code === 'ECONNABORTED') return 'Request timed out.';
  if (error.code === 'ERR_NETWORK') return 'Unable to reach the server.';
  return error.response?.data?.message || fallback;
};

// ────────────────────────────────────────
// Thunks
// ────────────────────────────────────────

export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async (_, { getState, rejectWithValue }) => {
    try {
      const res = await api.get(
        `${API_BASE_URL}/cart`,
        getAuthHeader(getState),
      );
      return res.data.cart as Cart;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to fetch cart'));
    }
  },
);

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async (
    { productId, quantity = 1 }: { productId: string; quantity?: number },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await api.post(
        `${API_BASE_URL}/cart/add`,
        { productId, quantity },
        getAuthHeader(getState),
      );
      return res.data.cart as Cart;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to add to cart'));
    }
  },
);

export const updateCartItem = createAsyncThunk(
  'cart/updateCartItem',
  async (
    { productId, quantity }: { productId: string; quantity: number },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await api.put(
        `${API_BASE_URL}/cart/update`,
        { productId, quantity },
        getAuthHeader(getState),
      );
      return res.data.cart as Cart;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to update cart'));
    }
  },
);

export const removeFromCart = createAsyncThunk(
  'cart/removeFromCart',
  async (productId: string, { getState, rejectWithValue }) => {
    try {
      const res = await api.delete(
        `${API_BASE_URL}/cart/remove/${productId}`,
        getAuthHeader(getState),
      );
      return res.data.cart as Cart;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to remove from cart'));
    }
  },
);

export const clearCart = createAsyncThunk(
  'cart/clearCart',
  async (_, { getState, rejectWithValue }) => {
    try {
      const res = await api.delete(
        `${API_BASE_URL}/cart/clear`,
        getAuthHeader(getState),
      );
      return res.data.cart as Cart;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to clear cart'));
    }
  },
);

export const checkout = createAsyncThunk(
  'cart/checkout',
  async (_, { getState, rejectWithValue }) => {
    try {
      const res = await api.post(
        `${API_BASE_URL}/cart/checkout`,
        {},
        getAuthHeader(getState),
      );
      return res.data as {
        success: boolean;
        message: string;
        total: number;
        balance: number;
        cart: Cart;
      };
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Checkout failed'));
    }
  },
);

// ────────────────────────────────────────
// Slice
// ────────────────────────────────────────

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    clearCartError(state) {
      state.error = null;
    },
    resetCart(state) {
      state.cart = { items: [], total: 0, itemCount: 0 };
    },
  },
  extraReducers: (builder) => {
    /* fetch */
    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    /* add */
    builder
      .addCase(addToCart.pending, (state) => {
        state.adding = true;
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.adding = false;
        state.cart = action.payload;
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.adding = false;
        state.error = action.payload as string;
      });

    /* update */
    builder.addCase(updateCartItem.fulfilled, (state, action) => {
      state.cart = action.payload;
    });

    /* remove */
    builder.addCase(removeFromCart.fulfilled, (state, action) => {
      state.cart = action.payload;
    });

    /* clear */
    builder.addCase(clearCart.fulfilled, (state, action) => {
      state.cart = action.payload;
    });

    /* checkout */
    builder
      .addCase(checkout.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkout.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload.cart;
      })
      .addCase(checkout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCartError, resetCart } = cartSlice.actions;
export default cartSlice.reducer;
