import type { Middleware } from '@reduxjs/toolkit';

/**
 * Middleware that neutralises auth-related thunk rejections
 * when the user is not authenticated (i.e. during/after logout).
 *
 * Instead of swallowing the action (which breaks loading states),
 * we clear the error payload so reducers still flip loading → false
 * but no error message is surfaced to the UI.
 */
const AUTH_ERROR_PATTERNS = [
  'not authorized',
  'not authenticated',
  'access this route',
  'jwt',
];

export const authGuardMiddleware: Middleware =
  (store) => (next) => (action) => {
    // Only intercept rejected async thunk actions
    if (action?.type?.endsWith('/rejected')) {
      const state = store.getState();

      // If user is logged out, neutralise auth-related errors
      if (!state.auth?.isAuthenticated) {
        const payload = action.payload || action.error?.message || '';
        const errorStr =
          typeof payload === 'string' ? payload : JSON.stringify(payload);

        const isAuthError = AUTH_ERROR_PATTERNS.some((pattern) =>
          errorStr.toLowerCase().includes(pattern),
        );

        if (isAuthError) {
          // Clear the error payload so reducers don't store it,
          // but still let the action through so loading flags reset.
          const sanitised = {
            ...action,
            payload: undefined,
            error: { ...action.error, message: '' },
          };
          return next(sanitised);
        }
      }
    }

    return next(action);
  };
