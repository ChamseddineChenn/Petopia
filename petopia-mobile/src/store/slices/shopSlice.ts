import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { RootState } from '../store';

// ────────────────────────────────────────
// Types
// ────────────────────────────────────────

export interface ShopAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface PetShop {
  _id: string;
  owner: { _id: string; name: string; profileImage?: string } | string;
  shopName: string;
  description: string;
  logo: string | null;
  phone: string;
  email: string;
  address: ShopAddress;
  categories: string[];
  productsCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductAttributes {
  weight?: string;
  size?: string;
  color?: string;
  brand?: string;
  material?: string;
}

export interface Product {
  _id: string;
  shop: { _id: string; shopName: string; logo?: string; owner?: any } | string;
  owner: string;
  title: string;
  description: string;
  category: string;
  price: number;
  compareAtPrice: number | null;
  quantity: number;
  images: string[];
  attributes: ProductAttributes;
  petType: string;
  isActive: boolean;
  soldCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  pages: number;
  total: number;
}

interface ShopState {
  /* my shop */
  myShop: PetShop | null;
  myShopLoading: boolean;

  /* my products */
  myProducts: Product[];
  myProductsLoading: boolean;
  myProductsPagination: Pagination;

  /* browse shops */
  shops: PetShop[];
  shopsLoading: boolean;
  shopsPagination: Pagination;

  /* single shop */
  activeShop: PetShop | null;
  activeShopLoading: boolean;

  /* shop products (when viewing a shop) */
  shopProducts: Product[];
  shopProductsLoading: boolean;
  shopProductsPagination: Pagination;

  /* single product */
  activeProduct: Product | null;
  activeProductLoading: boolean;

  /* browse all products */
  browseProducts: Product[];
  browseProductsLoading: boolean;
  browseProductsPagination: Pagination;

  error: string | null;
}

const emptyPagination: Pagination = { page: 1, pages: 1, total: 0 };

const initialState: ShopState = {
  myShop: null,
  myShopLoading: false,
  myProducts: [],
  myProductsLoading: false,
  myProductsPagination: { ...emptyPagination },
  shops: [],
  shopsLoading: false,
  shopsPagination: { ...emptyPagination },
  activeShop: null,
  activeShopLoading: false,
  shopProducts: [],
  shopProductsLoading: false,
  shopProductsPagination: { ...emptyPagination },
  activeProduct: null,
  activeProductLoading: false,
  browseProducts: [],
  browseProductsLoading: false,
  browseProductsPagination: { ...emptyPagination },
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
// Thunks — Shop CRUD
// ────────────────────────────────────────

export const fetchMyShop = createAsyncThunk(
  'shop/fetchMyShop',
  async (_, { getState, rejectWithValue }) => {
    try {
      const res = await api.get(
        `${API_BASE_URL}/shops/mine`,
        getAuthHeader(getState),
      );
      return res.data.shop; // may be null
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to fetch shop'));
    }
  },
);

export const createOrUpdateShop = createAsyncThunk(
  'shop/createOrUpdateShop',
  async (
    data: {
      shopName?: string;
      description?: string;
      logo?: string;
      phone?: string;
      email?: string;
      address?: ShopAddress;
      categories?: string[];
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await api.post(
        `${API_BASE_URL}/shops`,
        data,
        getAuthHeader(getState),
      );
      return res.data.shop;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to save shop'));
    }
  },
);

export const deleteMyShop = createAsyncThunk(
  'shop/deleteMyShop',
  async (_, { getState, rejectWithValue }) => {
    try {
      await api.delete(`${API_BASE_URL}/shops`, getAuthHeader(getState));
      return true;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to delete shop'));
    }
  },
);

// ────────────────────────────────────────
// Thunks — Browse shops
// ────────────────────────────────────────

export const fetchShops = createAsyncThunk(
  'shop/fetchShops',
  async (
    params: {
      page?: number;
      search?: string;
      category?: string;
      city?: string;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const qs = new URLSearchParams();
      if (params.page) qs.set('page', String(params.page));
      if (params.search) qs.set('search', params.search);
      if (params.category) qs.set('category', params.category);
      if (params.city) qs.set('city', params.city);
      const res = await api.get(
        `${API_BASE_URL}/shops?${qs}`,
        getAuthHeader(getState),
      );
      return res.data;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to fetch shops'));
    }
  },
);

export const fetchShopDetail = createAsyncThunk(
  'shop/fetchShopDetail',
  async (shopId: string, { getState, rejectWithValue }) => {
    try {
      const res = await api.get(
        `${API_BASE_URL}/shops/${shopId}`,
        getAuthHeader(getState),
      );
      return res.data.shop;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to fetch shop'));
    }
  },
);

// ────────────────────────────────────────
// Thunks — Product CRUD
// ────────────────────────────────────────

export const createProduct = createAsyncThunk(
  'shop/createProduct',
  async (
    data: {
      title: string;
      description?: string;
      category: string;
      price: number;
      compareAtPrice?: number;
      quantity: number;
      images?: string[];
      attributes?: ProductAttributes;
      petType?: string;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await api.post(
        `${API_BASE_URL}/shops/products`,
        data,
        getAuthHeader(getState),
      );
      return res.data.product;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to create product'));
    }
  },
);

export const updateProduct = createAsyncThunk(
  'shop/updateProduct',
  async (
    {
      productId,
      ...data
    }: {
      productId: string;
      title?: string;
      description?: string;
      category?: string;
      price?: number;
      compareAtPrice?: number | null;
      quantity?: number;
      images?: string[];
      attributes?: ProductAttributes;
      petType?: string;
      isActive?: boolean;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const res = await api.put(
        `${API_BASE_URL}/shops/products/${productId}`,
        data,
        getAuthHeader(getState),
      );
      return res.data.product;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to update product'));
    }
  },
);

export const deleteProduct = createAsyncThunk(
  'shop/deleteProduct',
  async (productId: string, { getState, rejectWithValue }) => {
    try {
      await api.delete(
        `${API_BASE_URL}/shops/products/${productId}`,
        getAuthHeader(getState),
      );
      return productId;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to delete product'));
    }
  },
);

export const fetchMyProducts = createAsyncThunk(
  'shop/fetchMyProducts',
  async (
    params: { page?: number; category?: string },
    { getState, rejectWithValue },
  ) => {
    try {
      const qs = new URLSearchParams();
      if (params.page) qs.set('page', String(params.page));
      if (params.category) qs.set('category', params.category);
      const res = await api.get(
        `${API_BASE_URL}/shops/products/mine?${qs}`,
        getAuthHeader(getState),
      );
      return res.data;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to fetch products'));
    }
  },
);

export const fetchShopProducts = createAsyncThunk(
  'shop/fetchShopProducts',
  async (
    params: {
      shopId: string;
      page?: number;
      category?: string;
      search?: string;
      sort?: string;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const qs = new URLSearchParams();
      if (params.page) qs.set('page', String(params.page));
      if (params.category) qs.set('category', params.category);
      if (params.search) qs.set('search', params.search);
      if (params.sort) qs.set('sort', params.sort);
      const res = await api.get(
        `${API_BASE_URL}/shops/${params.shopId}/products?${qs}`,
        getAuthHeader(getState),
      );
      return res.data;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to fetch products'));
    }
  },
);

export const fetchProductDetail = createAsyncThunk(
  'shop/fetchProductDetail',
  async (productId: string, { getState, rejectWithValue }) => {
    try {
      const res = await api.get(
        `${API_BASE_URL}/shops/products/${productId}`,
        getAuthHeader(getState),
      );
      return res.data.product;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to fetch product'));
    }
  },
);

export const fetchBrowseProducts = createAsyncThunk(
  'shop/fetchBrowseProducts',
  async (
    params: {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      sort?: string;
      petType?: string;
      onSale?: boolean;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const qs = new URLSearchParams();
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.category) qs.set('category', params.category);
      if (params.search) qs.set('search', params.search);
      if (params.sort) qs.set('sort', params.sort);
      if (params.petType) qs.set('petType', params.petType);
      if (params.onSale) qs.set('onSale', 'true');
      const res = await api.get(
        `${API_BASE_URL}/shops/products/browse/all?${qs}`,
        getAuthHeader(getState),
      );
      return res.data;
    } catch (e: any) {
      return rejectWithValue(errMsg(e, 'Failed to browse products'));
    }
  },
);

// ────────────────────────────────────────
// Slice
// ────────────────────────────────────────

const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    clearShopError(state) {
      state.error = null;
    },
    clearActiveProduct(state) {
      state.activeProduct = null;
    },
    clearActiveShop(state) {
      state.activeShop = null;
      state.shopProducts = [];
      state.shopProductsPagination = { ...emptyPagination };
    },
    clearBrowseProducts(state) {
      state.browseProducts = [];
      state.browseProductsPagination = { ...emptyPagination };
    },
  },
  extraReducers: (builder) => {
    /* ── my shop ── */
    builder
      .addCase(fetchMyShop.pending, (state) => {
        state.myShopLoading = true;
      })
      .addCase(fetchMyShop.fulfilled, (state, action) => {
        state.myShopLoading = false;
        state.myShop = action.payload;
      })
      .addCase(fetchMyShop.rejected, (state, action) => {
        state.myShopLoading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(createOrUpdateShop.fulfilled, (state, action) => {
        state.myShop = action.payload;
      })
      .addCase(createOrUpdateShop.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    builder.addCase(deleteMyShop.fulfilled, (state) => {
      state.myShop = null;
      state.myProducts = [];
    });

    /* ── browse shops ── */
    builder
      .addCase(fetchShops.pending, (state) => {
        state.shopsLoading = true;
      })
      .addCase(fetchShops.fulfilled, (state, action) => {
        state.shopsLoading = false;
        const { shops, page, pages, total } = action.payload;
        if (page === 1) {
          state.shops = shops;
        } else {
          state.shops = [...state.shops, ...shops];
        }
        state.shopsPagination = { page, pages, total };
      })
      .addCase(fetchShops.rejected, (state, action) => {
        state.shopsLoading = false;
        state.error = action.payload as string;
      });

    /* ── shop detail ── */
    builder
      .addCase(fetchShopDetail.pending, (state) => {
        state.activeShopLoading = true;
      })
      .addCase(fetchShopDetail.fulfilled, (state, action) => {
        state.activeShopLoading = false;
        state.activeShop = action.payload;
      })
      .addCase(fetchShopDetail.rejected, (state, action) => {
        state.activeShopLoading = false;
        state.error = action.payload as string;
      });

    /* ── my products ── */
    builder
      .addCase(fetchMyProducts.pending, (state) => {
        state.myProductsLoading = true;
      })
      .addCase(fetchMyProducts.fulfilled, (state, action) => {
        state.myProductsLoading = false;
        const { products, page, pages, total } = action.payload;
        if (page === 1) {
          state.myProducts = products;
        } else {
          state.myProducts = [...state.myProducts, ...products];
        }
        state.myProductsPagination = { page, pages, total };
      })
      .addCase(fetchMyProducts.rejected, (state, action) => {
        state.myProductsLoading = false;
        state.error = action.payload as string;
      });

    /* ── product CRUD ── */
    builder.addCase(createProduct.fulfilled, (state, action) => {
      state.myProducts = [action.payload, ...state.myProducts];
      if (state.myShop) {
        state.myShop.productsCount = (state.myShop.productsCount || 0) + 1;
      }
    });
    builder.addCase(updateProduct.fulfilled, (state, action) => {
      const idx = state.myProducts.findIndex(
        (p) => p._id === action.payload._id,
      );
      if (idx >= 0) state.myProducts[idx] = action.payload;
      if (state.activeProduct?._id === action.payload._id) {
        state.activeProduct = action.payload;
      }
    });
    builder.addCase(deleteProduct.fulfilled, (state, action) => {
      state.myProducts = state.myProducts.filter(
        (p) => p._id !== action.payload,
      );
      if (state.myShop) {
        state.myShop.productsCount = Math.max(
          0,
          (state.myShop.productsCount || 1) - 1,
        );
      }
    });

    /* ── shop products ── */
    builder
      .addCase(fetchShopProducts.pending, (state) => {
        state.shopProductsLoading = true;
      })
      .addCase(fetchShopProducts.fulfilled, (state, action) => {
        state.shopProductsLoading = false;
        const { products, page, pages, total } = action.payload;
        if (page === 1) {
          state.shopProducts = products;
        } else {
          state.shopProducts = [...state.shopProducts, ...products];
        }
        state.shopProductsPagination = { page, pages, total };
      })
      .addCase(fetchShopProducts.rejected, (state, action) => {
        state.shopProductsLoading = false;
        state.error = action.payload as string;
      });

    /* ── product detail ── */
    builder
      .addCase(fetchProductDetail.pending, (state) => {
        state.activeProductLoading = true;
      })
      .addCase(fetchProductDetail.fulfilled, (state, action) => {
        state.activeProductLoading = false;
        state.activeProduct = action.payload;
      })
      .addCase(fetchProductDetail.rejected, (state, action) => {
        state.activeProductLoading = false;
        state.error = action.payload as string;
      });

    /* ── browse products ── */
    builder
      .addCase(fetchBrowseProducts.pending, (state) => {
        state.browseProductsLoading = true;
      })
      .addCase(fetchBrowseProducts.fulfilled, (state, action) => {
        state.browseProductsLoading = false;
        const { products, page, pages, total } = action.payload;
        if (page === 1) {
          state.browseProducts = products;
        } else {
          state.browseProducts = [...state.browseProducts, ...products];
        }
        state.browseProductsPagination = { page, pages, total };
      })
      .addCase(fetchBrowseProducts.rejected, (state, action) => {
        state.browseProductsLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearShopError,
  clearActiveProduct,
  clearActiveShop,
  clearBrowseProducts,
} = shopSlice.actions;
export default shopSlice.reducer;
