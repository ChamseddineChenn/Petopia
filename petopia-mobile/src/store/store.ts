import { combineReducers, configureStore } from '@reduxjs/toolkit';
import type { Action } from '@reduxjs/toolkit';
import { authGuardMiddleware } from './middleware/authGuard';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import petReducer from './slices/petSlice';
import postReducer from './slices/postSlice';
import healthRecordReducer from './slices/healthRecordSlice';
import vetReducer from './slices/vetSlice';
import reviewReducer from './slices/reviewSlice';
import appointmentReducer from './slices/appointmentSlice';
import notificationReducer from './slices/notificationSlice';
import groomerReducer from './slices/groomerSlice';
import groomerAppointmentReducer from './slices/groomerAppointmentSlice';
import groomerReviewReducer from './slices/groomerReviewSlice';
import profileReducer from './slices/profileSlice';
import chatReducer from './slices/chatSlice';
import shopReducer from './slices/shopSlice';
import cartReducer from './slices/cartSlice';
import walletReducer from './slices/walletSlice';

// Combine all reducers into one
const appReducer = combineReducers({
  auth: authReducer,
  user: userReducer,
  pets: petReducer,
  posts: postReducer,
  healthRecords: healthRecordReducer,
  vets: vetReducer,
  reviews: reviewReducer,
  appointments: appointmentReducer,
  notifications: notificationReducer,
  groomers: groomerReducer,
  groomerAppointments: groomerAppointmentReducer,
  groomerReviews: groomerReviewReducer,
  profile: profileReducer,
  chat: chatReducer,
  shop: shopReducer,
  cart: cartReducer,
  wallet: walletReducer,
});

// Root reducer that wipes ALL state on logout → every slice resets to initialState
type AppState = ReturnType<typeof appReducer>;
const rootReducer = (state: AppState | undefined, action: Action) => {
  if (action.type === 'auth/logout') {
    // Passing undefined resets every slice to its initialState
    return appReducer(undefined, action);
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(authGuardMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
