import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import {
  verifyEmail,
  resendVerification,
  clearError,
} from '../../store/slices/authSlice';
import { RootState, AppDispatch } from '../../store/store';
import { useRefresh } from '../../hooks/useRefresh';
import { useAlert } from '../ui/CustomAlert';

export const VerificationScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error, pendingVerificationEmail, verificationMessage } =
    useSelector((state: RootState) => state.auth);
  const { refreshControl } = useRefresh();

  const [verificationCode, setVerificationCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const { showAlert } = useAlert();

  // Handle errors
  useEffect(() => {
    if (error) {
      showAlert({
        title: 'Error',
        message: error,
        variant: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {
              dispatch(clearError());
            },
          },
        ],
      });
    }
  }, [error, dispatch, showAlert]);

  const handleVerifyEmail = async () => {
    if (verificationCode.length !== 6) {
      showAlert({
        title: 'Error',
        message: 'Please enter the 6-digit verification code',
        variant: 'warning',
      });
      return;
    }

    dispatch(verifyEmail(verificationCode));
  };

  const handleResendEmail = async () => {
    if (!pendingVerificationEmail) {
      showAlert({
        title: 'Error',
        message: 'Email not found',
        variant: 'warning',
      });
      return;
    }

    setResendLoading(true);
    try {
      await dispatch(resendVerification(pendingVerificationEmail));
      setResendMessage('Verification email sent! Check your inbox.');
      setTimeout(() => setResendMessage(''), 3000);
    } catch (error) {
      console.error('Resend failed:', error);
    } finally {
      setResendLoading(false);
    }
  };

  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    return `${name.substring(0, 2)}***@${domain}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          scrollEnabled={true}
          bounces={true}
        >
          <View className="flex-1 px-6 py-8 justify-center">
            {/* Header */}
            <View className="mb-8 items-center">
              <Text className="text-4xl font-bold text-primary mb-2">✓</Text>
              <Text className="text-2xl font-bold text-text-primary text-center">
                Verify Your Email
              </Text>
            </View>

            {/* Description */}
            <View className="mb-8 bg-blue-50 p-4 rounded-2xl border border-blue-200">
              <Text className="text-base text-text-primary text-center mb-2">
                We've sent a verification email to
              </Text>
              <Text className="text-lg font-semibold text-primary text-center">
                {maskEmail(pendingVerificationEmail || '')}
              </Text>
            </View>

            {/* Instructions */}
            <Text className="text-base text-text-muted mb-6 text-center leading-6">
              Enter the 6-digit verification code from your email below:
            </Text>

            {/* Verification Code Input */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-text-primary mb-3 text-center">
                Verification Code
              </Text>
              <TextInput
                placeholder="000000"
                placeholderTextColor="#BFBFBA"
                value={verificationCode}
                onChangeText={(text) =>
                  setVerificationCode(text.replace(/[^0-9]/g, ''))
                }
                editable={!loading}
                keyboardType="number-pad"
                maxLength={6}
                className="bg-white rounded-2xl px-4 py-4 text-2xl text-text-primary border border-gray-200 shadow-sm text-center font-mono tracking-widest"
              />
            </View>

            {/* Verification Button */}
            <TouchableOpacity
              onPress={handleVerifyEmail}
              disabled={verificationCode.length !== 6 || loading}
              className={`rounded-2xl py-3 mb-4 items-center shadow-md ${
                verificationCode.length !== 6 || loading
                  ? 'bg-gray-300 opacity-60'
                  : 'bg-primary'
              }`}
            >
              <Text className="text-base font-semibold text-white">
                {loading ? 'Verifying...' : 'Verify Email'}
              </Text>
            </TouchableOpacity>

            {/* Resend Message */}
            {resendMessage && (
              <View className="mb-4 bg-green-50 p-3 rounded-lg border border-green-200">
                <Text className="text-sm text-green-700 text-center">
                  {resendMessage}
                </Text>
              </View>
            )}

            {/* Resend Link */}
            <View className="flex-row items-center justify-center mb-6">
              <Text className="text-sm text-text-muted">
                Didn't receive the email?{' '}
              </Text>
              <TouchableOpacity
                onPress={handleResendEmail}
                disabled={resendLoading || loading}
              >
                <Text className="text-sm font-semibold text-primary">
                  {resendLoading ? 'Sending...' : 'Resend'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Help Text */}
            <View className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200 items-center">
              <Text className="text-xs text-yellow-700 text-center">
                💡 Check your spam or promotions folder if you don't see the
                email
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default VerificationScreen;
