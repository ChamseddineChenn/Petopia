import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Linking,
  Animated,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import { RootState, AppDispatch } from '../../store/store';
import { fetchBalance } from '../../store/slices/walletSlice';
import { API_BASE_URL } from '../../config';
import { useAlert } from '../ui/CustomAlert';

const api = axios.create({ timeout: 30000 });
const getAuthHeader = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

interface PayoutStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requiresAction: boolean;
  externalAccount: {
    type: string;
    bankName?: string;
    brand?: string;
    last4: string;
    currency?: string;
  } | null;
  instantAvailable: boolean;
  balance: number;
}

const PRESET_AMOUNTS = [25, 50, 100, 250, 500];

// ─── Tutorial steps ──────────────────────────────────────
const TUTORIAL_STEPS = [
  {
    icon: 'shield-checkmark-outline' as const,
    iconColor: '#6366F1',
    iconBg: '#EEF2FF',
    title: 'Secure Setup via Stripe',
    description:
      'Petopia uses Stripe to handle payouts. Your banking details are never stored on our servers — everything is encrypted and managed by Stripe.',
  },
  {
    icon: 'card-outline' as const,
    iconColor: '#10B981',
    iconBg: '#ECFDF5',
    title: 'Link Your Bank or Debit Card',
    description:
      'You\u2019ll be redirected to a secure Stripe page to enter your Canadian bank account (institution, transit & account numbers) or debit card.',
  },
  {
    icon: 'flash-outline' as const,
    iconColor: '#F59E0B',
    iconBg: '#FFFBEB',
    title: 'Choose How to Get Paid',
    description:
      'Standard payouts are FREE and arrive in 2 business days via bank transfer. Instant payouts to your debit card arrive in minutes with a small 1% fee (min $0.50).',
  },
  {
    icon: 'wallet-outline' as const,
    iconColor: '#3B82F6',
    iconBg: '#EFF6FF',
    title: 'Withdraw Anytime',
    description:
      'Once connected, you can withdraw your Pet Dollar earnings as real CAD anytime. Minimum withdrawal is P$5. Your balance updates instantly.',
  },
];

export const WithdrawScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { token } = useSelector((state: RootState) => state.auth);
  const { balance } = useSelector((state: RootState) => state.wallet);

  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'standard' | 'instant'>('standard');

  // Tutorial state
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const parsedAmount = parseFloat(amount) || 0;
  const instantFee =
    method === 'instant'
      ? Math.max(Math.round(parsedAmount * 0.01 * 100) / 100, 0.5)
      : 0;
  const netAmount =
    method === 'instant'
      ? Math.round((parsedAmount - instantFee) * 100) / 100
      : parsedAmount;

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const { data } = await api.get(
        `${API_BASE_URL}/payouts/status`,
        getAuthHeader(token),
      );
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
    dispatch(fetchBalance());
  }, [fetchStatus, dispatch]);

  // Re-fetch status when user returns from Stripe browser
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchStatus();
      }
    });
    return () => subscription.remove();
  }, [fetchStatus]);

  const animateToStep = (nextStep: number) => {
    const direction = nextStep > tutorialStep ? -1 : 1;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: direction * 40,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTutorialStep(nextStep);
      slideAnim.setValue(-direction * 40);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleOnboard = async () => {
    if (!token) return;
    try {
      setOnboarding(true);
      const { data } = await api.post(
        `${API_BASE_URL}/payouts/onboard`,
        {},
        getAuthHeader(token),
      );

      // If backend says onboarding is already complete, just refresh status
      if (data.alreadyComplete) {
        await fetchStatus();
        if (data.payoutsEnabled) {
          showAlert({
            title: 'All Set!',
            message:
              'Your account is fully verified and ready for withdrawals.',
            variant: 'success',
          });
        } else {
          showAlert({
            title: 'Almost There',
            message:
              'Your details have been submitted. Stripe is reviewing your account — this usually takes just a few minutes.',
            variant: 'info',
          });
        }
        return;
      }

      if (data.url) {
        await Linking.openURL(data.url);
        // AppState listener will auto-refresh when user returns
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || '';
      // Friendlier error for Stripe Connect not enabled
      const friendlyMsg = msg.includes('create new accounts')
        ? 'Stripe Connect is not yet enabled for this platform. The app owner needs to activate Stripe Connect in their Stripe Dashboard to enable payouts.'
        : msg || 'Could not start bank setup. Try again.';
      showAlert({
        title: 'Setup Failed',
        message: friendlyMsg,
        variant: 'error',
      });
    } finally {
      setOnboarding(false);
    }
  };

  const handleWithdraw = async () => {
    if (!token) return;
    if (parsedAmount < 5) {
      showAlert({
        title: 'Minimum Amount',
        message: 'Minimum withdrawal is P$5.00',
        variant: 'warning',
      });
      return;
    }
    if (parsedAmount > balance) {
      showAlert({
        title: 'Insufficient Balance',
        message: `You only have P$${balance.toFixed(2)} available.`,
        variant: 'error',
      });
      return;
    }

    showAlert({
      title: 'Confirm Withdrawal',
      message:
        method === 'instant'
          ? `Withdraw P$${parsedAmount.toFixed(2)} instantly?\n\nFee: P$${instantFee.toFixed(2)}\nYou'll receive: $${netAmount.toFixed(2)} CAD`
          : `Withdraw P$${parsedAmount.toFixed(2)} to your bank account?\n\nNo fees — arrives in 2 business days.\nYou'll receive: $${netAmount.toFixed(2)} CAD`,
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async () => {
            try {
              setWithdrawing(true);
              const { data } = await api.post(
                `${API_BASE_URL}/payouts/withdraw`,
                { amount: parsedAmount, method },
                getAuthHeader(token),
              );
              dispatch(fetchBalance());
              setAmount('');
              showAlert({
                title: 'Withdrawal Successful',
                message: data.message,
                variant: 'success',
                autoDismiss: 4000,
              });
            } catch (err: any) {
              showAlert({
                title: 'Withdrawal Failed',
                message:
                  err.response?.data?.message ||
                  'Something went wrong. Please try again.',
                variant: 'error',
              });
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ],
    });
  };

  const handleDashboard = async () => {
    if (!token) return;
    try {
      const { data } = await api.get(
        `${API_BASE_URL}/payouts/dashboard`,
        getAuthHeader(token),
      );
      if (data.url) {
        await Linking.openURL(data.url);
      }
    } catch {
      showAlert({
        title: 'Error',
        message: 'Could not open dashboard.',
        variant: 'error',
      });
    }
  };

  const handleAddDebitCard = async () => {
    if (!token) return;

    // In test mode, use the dev endpoint to add a test debit card directly
    // (Stripe Express dashboard doesn't support debit card management in test mode)
    const isTestMode =
      API_BASE_URL.includes('localhost') || API_BASE_URL.includes('192.168');

    if (isTestMode) {
      showAlert({
        title: 'Add Test Payout Account',
        message:
          'Since you are in test mode, a Stripe test bank account will be linked automatically to enable payouts.\n\nIn production, users will add their real debit card or bank account through the Stripe Dashboard.',
        variant: 'info',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Test Account',
            onPress: async () => {
              try {
                const { data } = await api.post(
                  `${API_BASE_URL}/payouts/dev-add-debit-card`,
                  {},
                  getAuthHeader(token),
                );
                if (data.success) {
                  showAlert({
                    title: 'Payout Account Linked',
                    message:
                      data.message || 'Test bank account added successfully!',
                    variant: 'success',
                  });
                  // Refresh status to pick up the new account
                  fetchStatus();
                }
              } catch (err: any) {
                showAlert({
                  title: 'Error',
                  message:
                    err?.response?.data?.message ||
                    'Failed to add test payout account.',
                  variant: 'error',
                });
              }
            },
          },
        ],
      });
      return;
    }

    // Production: redirect to Stripe Express Dashboard
    showAlert({
      title: 'Add Debit Card',
      message:
        "You'll be redirected to your Stripe Dashboard.\n\n" +
        '1. Look for the "Payouts" or "Bank accounts and scheduling" section\n' +
        '2. Tap "Add bank account or debit card"\n' +
        '3. Select "Debit card" and enter your Visa or Mastercard debit card\n\n' +
        'Once saved, come back to Petopia and instant payouts will be unlocked!',
      variant: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Dashboard',
          onPress: async () => {
            try {
              const { data } = await api.get(
                `${API_BASE_URL}/payouts/dashboard`,
                getAuthHeader(token),
              );
              if (data.url) {
                await Linking.openURL(data.url);
              }
            } catch {
              showAlert({
                title: 'Error',
                message: 'Could not open Stripe Dashboard. Please try again.',
                variant: 'error',
              });
            }
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: '#FAFAF7' }}
        edges={['top']}
      >
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="large" color="#4DB6AC" />
          <Text style={{ marginTop: 12, color: '#9CA3AF', fontSize: 14 }}>
            Checking payout status…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Not connected yet ──
  if (!status?.connected || !status?.payoutsEnabled) {
    const isVerifying = status?.connected && !status?.payoutsEnabled;
    const currentStep = TUTORIAL_STEPS[tutorialStep];
    const isLastStep = tutorialStep === TUTORIAL_STEPS.length - 1;

    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: '#FAFAF7' }}
        edges={['top']}
      >
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
            Withdraw Funds
          </Text>
          {showTutorial && (
            <TouchableOpacity
              onPress={() => setShowTutorial(false)}
              activeOpacity={0.7}
            >
              <Text
                style={{ fontSize: 13, fontWeight: '600', color: '#6366F1' }}
              >
                Skip
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {showTutorial ? (
          /* ── Tutorial carousel ── */
          <View style={{ flex: 1, justifyContent: 'space-between' }}>
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                paddingHorizontal: 32,
              }}
            >
              <Animated.View
                style={{
                  alignItems: 'center',
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                }}
              >
                {/* Step icon */}
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: currentStep.iconBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 24,
                  }}
                >
                  <Ionicons
                    name={currentStep.icon}
                    size={40}
                    color={currentStep.iconColor}
                  />
                </View>

                {/* Step counter */}
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: '#9CA3AF',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}
                </Text>

                {/* Step title */}
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: '#1F2937',
                    textAlign: 'center',
                    marginBottom: 12,
                  }}
                >
                  {currentStep.title}
                </Text>

                {/* Step description */}
                <Text
                  style={{
                    fontSize: 14,
                    color: '#6B7280',
                    textAlign: 'center',
                    lineHeight: 22,
                    paddingHorizontal: 8,
                  }}
                >
                  {currentStep.description}
                </Text>
              </Animated.View>
            </View>

            {/* Bottom controls */}
            <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
              {/* Progress dots */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  marginBottom: 24,
                }}
              >
                {TUTORIAL_STEPS.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => animateToStep(i)}
                    activeOpacity={0.7}
                    style={{
                      width: i === tutorialStep ? 24 : 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
                        i === tutorialStep ? '#6366F1' : '#D1D5DB',
                      marginHorizontal: 4,
                    }}
                  />
                ))}
              </View>

              {/* Navigation buttons */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {tutorialStep > 0 && (
                  <TouchableOpacity
                    onPress={() => animateToStep(tutorialStep - 1)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      backgroundColor: '#F3F4F6',
                      paddingVertical: 14,
                      borderRadius: 14,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: '#6B7280',
                      }}
                    >
                      Back
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={
                    isLastStep
                      ? () => setShowTutorial(false)
                      : () => animateToStep(tutorialStep + 1)
                  }
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: '#6366F1',
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: '#fff',
                    }}
                  >
                    {isLastStep ? 'Get Started' : 'Next'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* ── Setup / verification screen ── */
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: isVerifying ? '#FFFBEB' : '#EEF2FF',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <MaterialCommunityIcons
                name={isVerifying ? 'clock-outline' : 'bank-outline'}
                size={40}
                color={isVerifying ? '#F59E0B' : '#6366F1'}
              />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: '#1F2937',
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              {isVerifying ? 'Verification Pending' : 'Connect Your Bank'}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: '#6B7280',
                textAlign: 'center',
                lineHeight: 22,
                marginBottom: 24,
              }}
            >
              {isVerifying
                ? status?.requiresAction
                  ? 'Stripe needs a bit more information to finish verifying your account. Tap below to complete the remaining steps.'
                  : 'Your details have been submitted! Stripe is reviewing your account — this usually takes just a few minutes. Tap below to refresh.'
                : 'You\u2019ll be redirected to Stripe\u2019s secure page to link your bank account or debit card. It only takes a couple of minutes.'}
            </Text>

            {/* Main action button */}
            <TouchableOpacity
              onPress={
                isVerifying && !status?.requiresAction
                  ? fetchStatus
                  : handleOnboard
              }
              disabled={onboarding}
              activeOpacity={0.7}
              style={{
                backgroundColor:
                  isVerifying && !status?.requiresAction
                    ? '#10B981'
                    : '#6366F1',
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 28,
                flexDirection: 'row',
                alignItems: 'center',
                opacity: onboarding ? 0.6 : 1,
                marginBottom: 16,
              }}
            >
              {onboarding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons
                    name={
                      isVerifying
                        ? status?.requiresAction
                          ? 'document-text-outline'
                          : 'refresh-outline'
                        : 'shield-checkmark-outline'
                    }
                    size={20}
                    color="#fff"
                  />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: '#fff',
                      marginLeft: 8,
                    }}
                  >
                    {isVerifying
                      ? status?.requiresAction
                        ? 'Complete Remaining Steps'
                        : 'Refresh Status'
                      : 'Connect Bank Account'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Review tutorial link */}
            <TouchableOpacity
              onPress={() => {
                setTutorialStep(0);
                setShowTutorial(true);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: '#6366F1',
                  fontWeight: '500',
                }}
              >
                Review the tutorial
              </Text>
            </TouchableOpacity>

            {/* DEV ONLY: Force-verify for testing */}
            {isVerifying && __DEV__ && (
              <TouchableOpacity
                onPress={async () => {
                  if (!token) return;
                  try {
                    setOnboarding(true);
                    const { data } = await api.post(
                      `${API_BASE_URL}/payouts/dev-verify`,
                      {},
                      getAuthHeader(token),
                    );
                    if (data.payoutsEnabled) {
                      showAlert({
                        title: 'Verified!',
                        message:
                          'Account force-verified for testing. Payouts enabled!',
                        variant: 'success',
                      });
                    } else {
                      showAlert({
                        title: 'Partially Verified',
                        message: `Details submitted. Remaining: ${(data.remainingRequirements || []).join(', ') || 'none — may take a moment'}`,
                        variant: 'info',
                      });
                    }
                    await fetchStatus();
                  } catch (err: any) {
                    showAlert({
                      title: 'Dev Verify Failed',
                      message:
                        err.response?.data?.message ||
                        err.message ||
                        'Unknown error',
                      variant: 'error',
                    });
                  } finally {
                    setOnboarding(false);
                  }
                }}
                activeOpacity={0.7}
                style={{ marginTop: 12 }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: '#EF4444',
                    fontWeight: '600',
                  }}
                >
                  ⚡ Force Verify (Dev Only)
                </Text>
              </TouchableOpacity>
            )}

            <Text
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                textAlign: 'center',
                marginTop: 20,
                paddingHorizontal: 20,
              }}
            >
              Secured by Stripe. Petopia never sees your bank details.
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ── Connected & payouts enabled — show withdraw form ──
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#FAFAF7' }}
      edges={['top']}
    >
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
          Withdraw Funds
        </Text>
        <TouchableOpacity onPress={handleDashboard} activeOpacity={0.7}>
          <Ionicons name="open-outline" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Balance card */}
        <View
          style={{
            backgroundColor: '#6366F1',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.7)',
              fontWeight: '500',
            }}
          >
            Available to Withdraw
          </Text>
          <Text
            style={{
              fontSize: 32,
              fontWeight: '800',
              color: '#fff',
              marginTop: 4,
              letterSpacing: -0.5,
            }}
          >
            P${balance.toFixed(2)}
          </Text>

          {/* Connected account info */}
          {status.externalAccount && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 12,
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                alignSelf: 'flex-start',
              }}
            >
              <Ionicons
                name={
                  status.externalAccount.type === 'bank_account'
                    ? 'business-outline'
                    : 'card-outline'
                }
                size={14}
                color="#fff"
              />
              <Text
                style={{
                  fontSize: 12,
                  color: '#fff',
                  fontWeight: '500',
                  marginLeft: 6,
                }}
              >
                {status.externalAccount.type === 'bank_account'
                  ? `${status.externalAccount.bankName || 'Bank'} ••••${status.externalAccount.last4}`
                  : `${status.externalAccount.brand || 'Card'} ••••${status.externalAccount.last4}`}
              </Text>
            </View>
          )}
        </View>

        {/* Amount input */}
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: 8,
          }}
        >
          Withdrawal Amount
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: parsedAmount > balance ? '#EF4444' : '#E5E7EB',
            paddingHorizontal: 16,
            height: 56,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: '#6B7280',
              marginRight: 4,
            }}
          >
            P$
          </Text>
          <TextInput
            style={{
              flex: 1,
              fontSize: 22,
              fontWeight: '700',
              color: '#1F2937',
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#D1D5DB"
            value={amount}
            onChangeText={setAmount}
          />
          {parsedAmount > 0 && (
            <TouchableOpacity onPress={() => setAmount('')}>
              <Ionicons name="close-circle" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          )}
        </View>

        {/* Preset amounts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
        >
          {PRESET_AMOUNTS.map((preset) => (
            <TouchableOpacity
              key={preset}
              onPress={() => setAmount(preset.toString())}
              activeOpacity={0.7}
              style={{
                backgroundColor: parsedAmount === preset ? '#6366F1' : '#fff',
                borderWidth: 1,
                borderColor: parsedAmount === preset ? '#6366F1' : '#E5E7EB',
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 8,
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: parsedAmount === preset ? '#fff' : '#4B5563',
                }}
              >
                P${preset}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setAmount(balance.toFixed(2))}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#F3F4F6',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280' }}>
              Max
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Payout method */}
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: 10,
          }}
        >
          Payout Method
        </Text>

        {/* Standard */}
        <TouchableOpacity
          onPress={() => setMethod('standard')}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: method === 'standard' ? '#6366F1' : '#E5E7EB',
            padding: 16,
            marginBottom: 10,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: method === 'standard' ? '#EEF2FF' : '#F9FAFB',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons
              name="card-outline"
              size={20}
              color={method === 'standard' ? '#6366F1' : '#9CA3AF'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
              Standard
            </Text>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              Free — 2 business days
            </Text>
          </View>
          <View
            style={{
              backgroundColor:
                method === 'standard' ? '#ECFDF5' : 'transparent',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: method === 'standard' ? '#10B981' : 'transparent',
              }}
            >
              FREE
            </Text>
          </View>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: method === 'standard' ? '#6366F1' : '#D1D5DB',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 10,
            }}
          >
            {method === 'standard' && (
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#6366F1',
                }}
              />
            )}
          </View>
        </TouchableOpacity>

        {/* Instant */}
        <TouchableOpacity
          onPress={() => {
            if (!status?.instantAvailable) {
              showAlert({
                title: 'Debit Card Required',
                message:
                  'Instant payouts need a debit card linked to your Stripe account. Tap "Add Debit Card" below to open your Stripe Dashboard and add one.',
                variant: 'info',
              });
              return;
            }
            setMethod('instant');
          }}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: !status?.instantAvailable
              ? '#E5E7EB'
              : method === 'instant'
                ? '#6366F1'
                : '#E5E7EB',
            padding: 16,
            marginBottom: 10,
            opacity: status?.instantAvailable ? 1 : 0.5,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: method === 'instant' ? '#FFFBEB' : '#F9FAFB',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons
              name="flash"
              size={20}
              color={method === 'instant' ? '#F59E0B' : '#9CA3AF'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
              Instant
            </Text>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              {status?.instantAvailable
                ? 'To debit card — arrives in minutes'
                : 'Requires a debit card — not set up'}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: method === 'instant' ? '#FFFBEB' : 'transparent',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: method === 'instant' ? '#F59E0B' : 'transparent',
              }}
            >
              1% FEE
            </Text>
          </View>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: method === 'instant' ? '#6366F1' : '#D1D5DB',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 10,
            }}
          >
            {method === 'instant' && (
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#6366F1',
                }}
              />
            )}
          </View>
        </TouchableOpacity>

        {/* Add Debit Card banner — shown when connected but no debit card */}
        {!status?.instantAvailable && (
          <TouchableOpacity
            onPress={handleAddDebitCard}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFBEB',
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: '#FDE68A',
              borderStyle: 'dashed',
              padding: 14,
              marginBottom: 20,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#FEF3C7',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="card-outline" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 13, fontWeight: '600', color: '#92400E' }}
              >
                Add Debit Card for Instant Payouts
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: '#B45309',
                  marginTop: 2,
                  lineHeight: 16,
                }}
              >
                Tap to open your Stripe Dashboard and add a debit card. Once
                linked, instant withdrawals arrive in minutes.
              </Text>
            </View>
            <Ionicons
              name="open-outline"
              size={18}
              color="#F59E0B"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        )}

        {/* Summary */}
        {parsedAmount >= 5 && (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 14,
              padding: 16,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#F3F4F6',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: '#6B7280',
                marginBottom: 10,
              }}
            >
              Summary
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <Text style={{ fontSize: 13, color: '#6B7280' }}>
                Withdrawal Amount
              </Text>
              <Text
                style={{ fontSize: 13, fontWeight: '600', color: '#1F2937' }}
              >
                P${parsedAmount.toFixed(2)}
              </Text>
            </View>
            {method === 'instant' && (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <Text style={{ fontSize: 13, color: '#EF4444' }}>
                  Instant Fee (1%)
                </Text>
                <Text
                  style={{ fontSize: 13, fontWeight: '600', color: '#EF4444' }}
                >
                  -P${instantFee.toFixed(2)}
                </Text>
              </View>
            )}
            <View
              style={{
                height: 1,
                backgroundColor: '#F3F4F6',
                marginVertical: 8,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: '#1F2937' }}
              >
                You&apos;ll Receive
              </Text>
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: '#10B981' }}
              >
                ${netAmount.toFixed(2)} CAD
              </Text>
            </View>
            <Text
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                marginTop: 6,
                textAlign: 'right',
              }}
            >
              {method === 'instant'
                ? 'Arrives in minutes'
                : 'Arrives in 2 business days'}
            </Text>
          </View>
        )}

        {/* Withdraw button */}
        <TouchableOpacity
          onPress={handleWithdraw}
          disabled={withdrawing || parsedAmount < 5 || parsedAmount > balance}
          activeOpacity={0.7}
          style={{
            backgroundColor:
              parsedAmount >= 5 && parsedAmount <= balance
                ? '#6366F1'
                : '#D1D5DB',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            marginBottom: 16,
          }}
        >
          {withdrawing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="arrow-up-circle" size={20} color="#fff" />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#fff',
                  marginLeft: 8,
                }}
              >
                Withdraw P${parsedAmount >= 5 ? parsedAmount.toFixed(2) : '—'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Footer info */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <Ionicons name="shield-checkmark-outline" size={14} color="#9CA3AF" />
          <Text
            style={{
              fontSize: 11,
              color: '#9CA3AF',
              marginLeft: 4,
            }}
          >
            Secured by Stripe • Manage account
          </Text>
          <TouchableOpacity onPress={handleDashboard} activeOpacity={0.7}>
            <Text
              style={{
                fontSize: 11,
                color: '#6366F1',
                fontWeight: '600',
                marginLeft: 4,
              }}
            >
              here
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
