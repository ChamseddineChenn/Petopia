import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { RootState, AppDispatch } from '../../store/store';
import { useAlert } from '../ui/CustomAlert';
import { fetchBalance } from '../../store/slices/walletSlice';
import {
  createPaymentIntent,
  checkPaymentStatus,
} from '../../services/paymentService';

const PRESET_AMOUNTS = [5, 10, 25, 50, 100, 250];

/** Stripe processing fee rate (~3.5%) — must match backend STRIPE_FEE_PERCENT */
const STRIPE_FEE_PERCENT = 0.035;

/** Calculate fee-inclusive CAD charge for a given P$ amount */
function calculateCharge(petDollars: number) {
  const grossCAD = petDollars / (1 - STRIPE_FEE_PERCENT);
  const chargeCAD = Math.ceil(grossCAD * 100) / 100;
  const feeCAD = Math.round((chargeCAD - petDollars) * 100) / 100;
  return { chargeUSD: chargeCAD, feeUSD: feeCAD };
}

/** Max status polling attempts (5s total with 1s intervals) */
const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 1000;

export const TopUpScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const { balance } = useSelector((state: RootState) => state.wallet);
  const token = useSelector((state: RootState) => state.auth.token);
  const { showAlert } = useAlert();

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Prevent double-tap
  const processingRef = useRef(false);

  const activeAmount =
    selectedPreset ?? (customAmount ? parseFloat(customAmount) : 0);

  const charge =
    activeAmount > 0
      ? calculateCharge(activeAmount)
      : { chargeUSD: 0, feeUSD: 0 };

  const handlePresetSelect = (amount: number) => {
    setSelectedPreset(amount);
    setCustomAmount('');
  };

  const handleCustomChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted =
      parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    setCustomAmount(formatted);
    setSelectedPreset(null);
  };

  /**
   * Poll the server to confirm the webhook has credited Pet Dollars.
   * Returns true if credited, false if timed out.
   */
  const pollForCredit = useCallback(
    async (paymentIntentId: string): Promise<boolean> => {
      if (!token) return false;
      for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const status = await checkPaymentStatus(token, paymentIntentId);
          if (status.credited) return true;
        } catch {
          // Ignore transient errors during polling
        }
      }
      return false;
    },
    [token],
  );

  /**
   * Full Stripe payment flow:
   * 1. Create PaymentIntent on server → get clientSecret
   * 2. Init PaymentSheet with clientSecret
   * 3. Present PaymentSheet for user to enter card
   * 4. On success → poll server for credit confirmation
   * 5. Refresh balance
   */
  const handleTopUp = useCallback(async () => {
    if (processingRef.current) return;
    if (!activeAmount || activeAmount <= 0) {
      showAlert({
        title: 'Invalid Amount',
        message: 'Please select or enter an amount to top up.',
        variant: 'warning',
      });
      return;
    }
    if (activeAmount < 0.5) {
      showAlert({
        title: 'Minimum Amount',
        message: 'Minimum top-up amount is P$0.50.',
        variant: 'warning',
      });
      return;
    }
    if (activeAmount > 10000) {
      showAlert({
        title: 'Limit Exceeded',
        message: 'Maximum top-up amount is P$10,000 per transaction.',
        variant: 'warning',
      });
      return;
    }
    if (!token) {
      showAlert({
        title: 'Session Expired',
        message: 'Please log in again.',
        variant: 'warning',
      });
      return;
    }

    processingRef.current = true;
    setLoading(true);

    try {
      // Step 1: Create PaymentIntent on our server
      const { clientSecret, paymentIntentId } = await createPaymentIntent(
        token,
        activeAmount,
      );

      // Step 2: Initialize PaymentSheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Petopia',
        // Allow Apple Pay / Google Pay in production
        applePay: undefined,
        googlePay: undefined,
        style: 'automatic',
        defaultBillingDetails: undefined,
      });

      if (initError) {
        showAlert({
          title: 'Payment Error',
          message: initError.message || 'Could not initialize payment.',
          variant: 'error',
        });
        return;
      }

      // Step 3: Present the PaymentSheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          // User cancelled — not an error
          return;
        }
        showAlert({
          title: 'Payment Failed',
          message: presentError.message || 'Payment could not be completed.',
          variant: 'error',
        });
        return;
      }

      // Step 4: Payment succeeded on Stripe side — poll for webhook credit
      const credited = await pollForCredit(paymentIntentId);

      // Step 5: Refresh balance regardless (webhook may have been faster)
      dispatch(fetchBalance());

      if (credited) {
        showAlert({
          title: 'Top Up Successful! 🎉',
          message: `P$${activeAmount.toFixed(2)} has been added to your wallet.`,
          variant: 'success',
          buttons: [{ text: 'OK', onPress: () => router.back() }],
        });
      } else {
        // Payment went through but webhook hasn't fired yet
        showAlert({
          title: 'Payment Processing',
          message:
            'Your payment was successful! Pet Dollars will appear in your wallet shortly.',
          variant: 'info',
          buttons: [{ text: 'OK', onPress: () => router.back() }],
        });
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Something went wrong. Please try again.';
      showAlert({
        title: 'Top Up Failed',
        message,
        variant: 'error',
      });
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  }, [
    activeAmount,
    token,
    initPaymentSheet,
    presentPaymentSheet,
    pollForCredit,
    dispatch,
    router,
    showAlert,
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF7' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            marginLeft: 12,
            fontSize: 18,
            fontWeight: '700',
            color: '#1F2937',
          }}
        >
          Top Up Wallet
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Current balance */}
          <View
            style={{
              backgroundColor: '#E0F2F1',
              borderRadius: 16,
              padding: 20,
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <Text style={{ fontSize: 13, color: '#4DB6AC', fontWeight: '500' }}>
              Current Balance
            </Text>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '800',
                color: '#1F2937',
                marginTop: 4,
              }}
            >
              P${balance.toFixed(2)}
            </Text>
          </View>

          {/* Preset amounts */}
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: '#1F2937',
              marginBottom: 12,
            }}
          >
            Select Amount
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            {PRESET_AMOUNTS.map((amount) => {
              const isActive = selectedPreset === amount;
              return (
                <TouchableOpacity
                  key={amount}
                  onPress={() => handlePresetSelect(amount)}
                  activeOpacity={0.7}
                  style={{
                    width: '31%',
                    backgroundColor: isActive ? '#4DB6AC' : '#fff',
                    borderWidth: 1.5,
                    borderColor: isActive ? '#4DB6AC' : '#E5E7EB',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: isActive ? '#fff' : '#1F2937',
                    }}
                  >
                    P${amount}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom amount */}
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: '#1F2937',
              marginBottom: 10,
            }}
          >
            Or Enter Custom Amount
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderWidth: 1.5,
              borderColor: customAmount ? '#4DB6AC' : '#E5E7EB',
              borderRadius: 14,
              paddingHorizontal: 16,
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: customAmount ? '#4DB6AC' : '#9CA3AF',
                marginRight: 4,
              }}
            >
              P$
            </Text>
            <TextInput
              value={customAmount}
              onChangeText={handleCustomChange}
              placeholder="0.00"
              placeholderTextColor="#D1D5DB"
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                fontSize: 20,
                fontWeight: '700',
                color: '#1F2937',
                paddingVertical: 14,
              }}
            />
            {customAmount.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setCustomAmount('');
                }}
              >
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 24 }}>
            Min: P$0.50 · Max: P$10,000 per transaction
          </Text>

          {/* Summary */}
          {activeAmount > 0 && (
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 14, color: '#6B7280' }}>
                  Top-up amount
                </Text>
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}
                >
                  P${activeAmount.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 14, color: '#6B7280' }}>
                  Processing fee ({(STRIPE_FEE_PERCENT * 100).toFixed(1)}%)
                </Text>
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: '#EF4444' }}
                >
                  +${charge.feeUSD.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: '#F3F4F6',
                  paddingTop: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}
                >
                  You pay (CAD)
                </Text>
                <Text
                  style={{ fontSize: 14, fontWeight: '700', color: '#1F2937' }}
                >
                  ${charge.chargeUSD.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ fontSize: 14, color: '#6B7280' }}>
                  New balance will be
                </Text>
                <Text
                  style={{ fontSize: 14, fontWeight: '700', color: '#4DB6AC' }}
                >
                  P${(balance + activeAmount).toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {/* Stripe badge */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
              marginTop: 8,
            }}
          >
            <Ionicons name="lock-closed" size={12} color="#9CA3AF" />
            <Text style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
              Secured by Stripe
            </Text>
          </View>

          {/* Top-up button */}
          <TouchableOpacity
            onPress={handleTopUp}
            disabled={loading || activeAmount <= 0}
            activeOpacity={0.7}
            style={{
              backgroundColor:
                activeAmount > 0 && !loading ? '#4DB6AC' : '#D1D5DB',
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="wallet-plus"
                  size={22}
                  color="#fff"
                />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: '#fff',
                    marginLeft: 8,
                  }}
                >
                  {activeAmount > 0
                    ? `Pay $${charge.chargeUSD.toFixed(2)} → P$${activeAmount.toFixed(2)}`
                    : 'Select an Amount'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Info note */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              marginTop: 20,
              paddingHorizontal: 4,
            }}
          >
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#9CA3AF"
              style={{ marginTop: 1 }}
            />
            <Text
              style={{
                fontSize: 12,
                color: '#9CA3AF',
                marginLeft: 6,
                flex: 1,
                lineHeight: 18,
              }}
            >
              Pet Dollars (P$) can be used to pay for products at pet shops, vet
              appointments, grooming sessions, and more. Payments are processed
              securely through Stripe. Your card details are never stored on our
              servers.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
