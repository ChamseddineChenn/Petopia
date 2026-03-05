import '../global.css';
import { Stack } from 'expo-router';
import React from 'react';
import { Provider } from 'react-redux';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { store } from '../src/store/store';
import { AuthProvider } from '../src/context/AuthContext';
import { StripeProviderWrapper } from '../src/components/StripeProviderWrapper';
import { AlertProvider } from '../src/components/ui/CustomAlert';

// Create a client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

export default function RootLayout() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StripeProviderWrapper>
            <AlertProvider>
              <Stack>
                <Stack.Screen
                  name="auth"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="(tabs)"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="profile-modal"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="settings"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="pet-profile"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="edit-pet"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="edit-profile"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="health-records"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="vet-list"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="vet-clinic"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="book-appointment"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="manage-clinic"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="vet-appointments"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="vet-clients"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="vet-pet-records"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="groomer-list"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="groomer-shop"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="book-grooming"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="manage-groomer-shop"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="groomer-appointments"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="groomer-clients"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="notifications"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="my-appointments"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="follow-management"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="follow-list"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="chat"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="message-requests"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="create-post"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="post-detail"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="manage-pet-shop"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="pet-shop-list"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="view-all-products"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="pet-shop-detail"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="product-detail"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="cart"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="wallet"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="top-up"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="withdraw"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="terms-of-service"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="privacy-policy"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="blocked-users"
                  options={{
                    headerShown: false,
                  }}
                />
              </Stack>
            </AlertProvider>
          </StripeProviderWrapper>
        </AuthProvider>
      </QueryClientProvider>
    </Provider>
  );
}
