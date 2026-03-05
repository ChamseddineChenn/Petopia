/**
 * StripeProviderWrapper
 *
 * Fetches the Stripe publishable key from the backend on mount
 * and wraps children with StripeProvider once the key is available.
 *
 * SECURITY: The publishable key is never hardcoded in the client bundle.
 * It is fetched over an authenticated API call from our server.
 */

import React, { useEffect, useState } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { fetchPublishableKey } from '../services/paymentService';

interface Props {
  children: React.ReactNode;
}

export const StripeProviderWrapper: React.FC<Props> = ({ children }) => {
  const token = useSelector((state: RootState) => state.auth.token);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadKey = async () => {
      if (!token) {
        setPublishableKey(null);
        return;
      }
      try {
        const key = await fetchPublishableKey(token);
        if (!cancelled && key && key.startsWith('pk_')) {
          setPublishableKey(key);
        }
      } catch {
        // Stripe features won't work until key loads — non-fatal
        // Will retry on next mount / login
      }
    };

    loadKey();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Render children always — StripeProvider wraps only when key available
  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <StripeProvider
      publishableKey={publishableKey}
      // merchantIdentifier is needed for Apple Pay (add when going to production)
      // merchantIdentifier="merchant.com.petopia"
    >
      {children}
    </StripeProvider>
  );
};
