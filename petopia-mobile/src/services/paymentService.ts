/**
 * Payment Service — Stripe integration API calls
 *
 * SECURITY NOTES:
 * - The publishable key is fetched from the server, never hardcoded
 * - Payment confirmation happens server-side via webhooks only
 * - Client never sees or handles sensitive card data (Stripe Elements handles that)
 * - All requests require JWT authentication
 */

import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({ timeout: 15000 });

// ── Types ──

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  petDollarAmount: number;
}

export interface PaymentStatusResponse {
  status: string;
  credited: boolean;
  amount: number;
  petDollarAmount: number;
}

export interface PaymentConfigResponse {
  publishableKey: string;
}

// ── Helpers ──

const authHeader = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

// ── API Calls ──

/**
 * Fetch the Stripe publishable key from our server.
 * This avoids hardcoding any keys in the client bundle.
 */
export const fetchPublishableKey = async (token: string): Promise<string> => {
  const res = await api.get<PaymentConfigResponse>(
    `${API_BASE_URL}/payments/config`,
    authHeader(token),
  );
  return res.data.publishableKey;
};

/**
 * Create a PaymentIntent on the server.
 * Returns the client secret needed to confirm the payment via Stripe SDK.
 */
export const createPaymentIntent = async (
  token: string,
  petDollarAmount: number,
): Promise<CreatePaymentIntentResponse> => {
  const res = await api.post<CreatePaymentIntentResponse>(
    `${API_BASE_URL}/payments/create-intent`,
    { amount: petDollarAmount },
    authHeader(token),
  );
  return res.data;
};

/**
 * Poll payment status (fallback if webhook hasn't fired yet).
 * Used to confirm that Pet Dollars have been credited.
 */
export const checkPaymentStatus = async (
  token: string,
  paymentIntentId: string,
): Promise<PaymentStatusResponse> => {
  const res = await api.get<PaymentStatusResponse>(
    `${API_BASE_URL}/payments/status/${encodeURIComponent(paymentIntentId)}`,
    authHeader(token),
  );
  return res.data;
};
