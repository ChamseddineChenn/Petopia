import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { register, login, clearError } from '../../store/slices/authSlice';
import { StorageService } from '../../services/StorageService';
import { RootState, AppDispatch } from '../../store/store';
import VerificationScreen from './VerificationScreen';
import { useRefresh } from '../../hooks/useRefresh';
import { useAlert } from '../ui/CustomAlert';

type AuthMode = 'login' | 'signup';

const ACCOUNT_TYPES = [
  {
    value: 'user',
    label: 'Pet Owner',
    icon: 'paw' as const,
    desc: 'I want to manage my pets, find vets, and connect with the community',
  },
  {
    value: 'vet',
    label: 'Veterinarian',
    icon: 'medkit' as const,
    desc: 'I want to register my clinic, manage appointments, and serve patients',
  },
  {
    value: 'groomer',
    label: 'Groomer',
    icon: 'cut' as const,
    desc: 'I want to set up my grooming shop and manage appointments',
  },
  {
    value: 'pet_shop',
    label: 'Pet Shop',
    icon: 'storefront' as const,
    desc: 'I want to sell pet products, manage my shop, and reach pet owners',
  },
] as const;

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// ==========================================
// Reusable form components
// ==========================================

const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
  optional?: boolean;
}> = ({ label, children, optional }) => (
  <View className="mb-4">
    <View className="flex-row items-center mb-1.5">
      <Text className="text-sm font-semibold text-text-primary">{label}</Text>
      {optional && (
        <Text className="text-xs text-text-muted ml-1">(optional)</Text>
      )}
    </View>
    {children}
  </View>
);

const StyledInput: React.FC<{
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  editable?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: TextInput['props']['keyboardType'];
  autoCapitalize?: TextInput['props']['autoCapitalize'];
  borderError?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}> = ({
  placeholder,
  value,
  onChangeText,
  editable = true,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  borderError,
  icon,
}) => (
  <View className="flex-row items-center">
    {icon && (
      <View className="absolute left-3 z-10">
        <Ionicons name={icon} size={18} color="#9CA3AF" />
      </View>
    )}
    <TextInput
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? 'none'}
      className={`flex-1 bg-white rounded-xl px-4 py-3 text-base text-text-primary border ${
        borderError ? 'border-error' : 'border-gray-200'
      } ${icon ? 'pl-10' : ''}`}
    />
  </View>
);

// ==========================================
// Main AuthScreen
// ==========================================

export const AuthScreen: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error, isAuthenticated, token, user, pendingVerification } =
    useSelector((state: RootState) => state.auth);
  const { refreshControl } = useRefresh();
  const { showAlert } = useAlert();

  const [mode, setMode] = useState<AuthMode>('login');

  // Sign-up multi-step state
  const [signUpStep, setSignUpStep] = useState(1); // 1: account type, 2: credentials, 3: personal info

  // Step 1 – Account type
  const [accountType, setAccountType] = useState<
    'user' | 'vet' | 'groomer' | 'pet_shop'
  >('user');

  // Step 2 – Credentials
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 3 – Personal info
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  // Terms & Privacy consent
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Handle successful authentication
  useEffect(() => {
    if (isAuthenticated && token && user) {
      StorageService.saveToken(token);
      StorageService.saveUser(user);
      setTimeout(() => {
        router.push('/(tabs)/home');
      }, 500);
    }
  }, [isAuthenticated, token, user, router]);

  // Handle errors
  useEffect(() => {
    if (error) {
      showAlert({
        title: 'Authentication Error',
        message: error,
        variant: 'error',
        buttons: [{ text: 'OK', onPress: () => dispatch(clearError()) }],
      });
    }
  }, [error, dispatch, showAlert]);

  // ==========================================
  // Form validation
  // ==========================================

  const passwordsMatch = confirmPassword === password;
  const passwordStrong =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);

  const isStep2Valid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    passwordStrong &&
    passwordsMatch;

  const isLoginValid = email.trim().length > 0 && password.length > 0;

  // ==========================================
  // Handlers
  // ==========================================

  const handleLogin = () => {
    if (!email || !password) {
      showAlert({
        title: 'Error',
        message: 'Please fill in all fields',
        variant: 'warning',
      });
      return;
    }
    dispatch(login({ email, password }));
  };

  const handleSignUp = () => {
    if (!termsAccepted) {
      showAlert({
        title: 'Terms Required',
        message:
          'You must accept the Terms of Service and Privacy Policy to create an account.',
        variant: 'warning',
      });
      return;
    }
    dispatch(
      register({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        role: accountType,
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : undefined,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        termsAccepted: true,
      }),
    );
  };

  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setDateOfBirth(date);
  };

  const formatDOB = (d: Date) =>
    d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const resetSignUpForm = () => {
    setSignUpStep(1);
    setAccountType('user');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPhone('');
    setGender('');
    setDateOfBirth(null);
    setCountry('');
    setCity('');
    setTermsAccepted(false);
  };

  // Show verification screen if pending verification
  if (pendingVerification) {
    return <VerificationScreen />;
  }

  // ==========================================
  // RENDER: Login
  // ==========================================

  const renderLogin = () => (
    <View className="flex-1 px-5 py-4">
      {/* Logo */}
      <View className="mt-2 mb-6 items-center">
        <Image
          source={require('../../../assets/images/Petopia Logo.png')}
          className="w-[280px] h-[280px]"
        />
      </View>

      <Text className="text-3xl font-bold text-primary mb-1 text-center">
        Welcome Back
      </Text>
      <Text className="text-base text-text-muted mb-6 text-center">
        Login to your account
      </Text>

      <FormField label="Email">
        <StyledInput
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          editable={!loading}
          icon="mail-outline"
        />
      </FormField>

      <FormField label="Password">
        <View className="flex-row items-center">
          <View className="absolute left-3 z-10">
            <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
          </View>
          <TextInput
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
            className="flex-1 bg-white rounded-xl pl-10 pr-12 py-3 text-base text-text-primary border border-gray-200"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="absolute right-3"
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        </View>
      </FormField>

      <TouchableOpacity
        onPress={handleLogin}
        disabled={!isLoginValid || loading}
        className={`rounded-xl py-3.5 mt-3 mb-4 items-center ${
          !isLoginValid || loading
            ? 'bg-gray-300 opacity-60'
            : 'bg-primary-dark'
        }`}
      >
        <Text className="text-base font-semibold text-white">
          {loading ? 'Logging in…' : 'Login'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity className="items-center mb-4">
        <Text className="text-sm font-semibold text-primary-dark">
          Forgot Password?
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ==========================================
  // RENDER: Sign-up Step 1 — Account Type
  // ==========================================

  const renderSignUpStep1 = () => (
    <View className="flex-1 px-5 py-4">
      <View className="mt-2 mb-4 items-center">
        <Image
          source={require('../../../assets/images/Petopia Logo.png')}
          className="w-[180px] h-[180px]"
        />
      </View>

      <Text className="text-2xl font-bold text-primary mb-1 text-center">
        Join Petopia
      </Text>
      <Text className="text-base text-text-muted mb-6 text-center">
        What type of account would you like?
      </Text>

      {ACCOUNT_TYPES.map((type) => {
        const selected = accountType === type.value;
        return (
          <TouchableOpacity
            key={type.value}
            onPress={() =>
              setAccountType(
                type.value as 'user' | 'vet' | 'groomer' | 'pet_shop',
              )
            }
            className={`flex-row items-center p-4 rounded-2xl mb-3 border-2 ${
              selected
                ? 'bg-primary/10 border-primary'
                : 'bg-white border-gray-200'
            }`}
          >
            <View
              className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${
                selected ? 'bg-primary' : 'bg-gray-100'
              }`}
            >
              <Ionicons
                name={type.icon}
                size={22}
                color={selected ? '#FFFFFF' : '#6B7280'}
              />
            </View>
            <View className="flex-1">
              <Text
                className={`text-base font-bold ${
                  selected ? 'text-primary-dark' : 'text-text-primary'
                }`}
              >
                {type.label}
              </Text>
              <Text className="text-xs text-text-muted mt-0.5 leading-4">
                {type.desc}
              </Text>
            </View>
            <View
              className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                selected ? 'border-primary bg-primary' : 'border-gray-300'
              }`}
            >
              {selected && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <Text className="text-xs text-text-muted text-center mt-2 mb-4 px-4 leading-4">
        You can always switch your account type later from Settings.{'\n'}
        Pet sitter accounts will be available soon!
      </Text>

      {/* Scroll hint when many types */}
      <View className="h-1" />

      <TouchableOpacity
        onPress={() => setSignUpStep(2)}
        className="rounded-xl py-3.5 mt-2 items-center bg-primary-dark"
      >
        <Text className="text-base font-semibold text-white">Continue</Text>
      </TouchableOpacity>
    </View>
  );

  // ==========================================
  // RENDER: Sign-up Step 2 — Credentials
  // ==========================================

  const renderSignUpStep2 = () => (
    <View className="flex-1 px-5 py-4">
      {/* Step header */}
      <View className="flex-row items-center mb-5">
        <TouchableOpacity
          onPress={() => setSignUpStep(1)}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center mr-3"
        >
          <Ionicons name="arrow-back" size={18} color="#1F2937" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-text-primary">
            Create Your Account
          </Text>
          <Text className="text-xs text-text-muted">
            Step 2 of 3 — Credentials
          </Text>
        </View>
        {/* Step indicator */}
        <View className="flex-row gap-1.5">
          <View className="w-2.5 h-2.5 rounded-full bg-primary" />
          <View className="w-2.5 h-2.5 rounded-full bg-primary" />
          <View className="w-2.5 h-2.5 rounded-full bg-gray-200" />
        </View>
      </View>

      <FormField label="Full Name">
        <StyledInput
          placeholder="John Doe"
          value={name}
          onChangeText={setName}
          editable={!loading}
          autoCapitalize="words"
          icon="person-outline"
        />
      </FormField>

      <FormField label="Email Address">
        <StyledInput
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          editable={!loading}
          icon="mail-outline"
        />
      </FormField>

      <FormField label="Password">
        <View className="flex-row items-center">
          <View className="absolute left-3 z-10">
            <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
          </View>
          <TextInput
            placeholder="Min. 6 characters"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
            className="flex-1 bg-white rounded-xl pl-10 pr-12 py-3 text-base text-text-primary border border-gray-200"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="absolute right-3"
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        </View>
        {password.length > 0 && !passwordStrong && (
          <Text className="text-xs text-error mt-1">
            Password must be at least 6 characters
          </Text>
        )}
      </FormField>

      <FormField label="Confirm Password">
        <View className="flex-row items-center">
          <View className="absolute left-3 z-10">
            <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
          </View>
          <TextInput
            placeholder="Re-enter your password"
            placeholderTextColor="#9CA3AF"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            editable={!loading}
            className={`flex-1 bg-white rounded-xl pl-10 pr-12 py-3 text-base text-text-primary border ${
              !passwordsMatch && confirmPassword.length > 0
                ? 'border-error'
                : 'border-gray-200'
            }`}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3"
          >
            <Ionicons
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        </View>
        {!passwordsMatch && confirmPassword.length > 0 && (
          <Text className="text-xs text-error mt-1">
            Passwords do not match
          </Text>
        )}
      </FormField>

      <TouchableOpacity
        onPress={() => setSignUpStep(3)}
        disabled={!isStep2Valid}
        className={`rounded-xl py-3.5 mt-3 items-center ${
          !isStep2Valid ? 'bg-gray-300 opacity-60' : 'bg-primary-dark'
        }`}
      >
        <Text className="text-base font-semibold text-white">Continue</Text>
      </TouchableOpacity>
    </View>
  );

  // ==========================================
  // RENDER: Sign-up Step 3 — Personal Info
  // ==========================================

  const renderSignUpStep3 = () => (
    <View className="flex-1 px-5 py-4">
      {/* Step header */}
      <View className="flex-row items-center mb-5">
        <TouchableOpacity
          onPress={() => setSignUpStep(2)}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center mr-3"
        >
          <Ionicons name="arrow-back" size={18} color="#1F2937" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-text-primary">
            Personal Information
          </Text>
          <Text className="text-xs text-text-muted">
            Step 3 of 3 — Almost done!
          </Text>
        </View>
        <View className="flex-row gap-1.5">
          <View className="w-2.5 h-2.5 rounded-full bg-primary" />
          <View className="w-2.5 h-2.5 rounded-full bg-primary" />
          <View className="w-2.5 h-2.5 rounded-full bg-primary" />
        </View>
      </View>

      <Text className="text-xs text-text-muted mb-4 leading-4">
        All fields below are optional. You can always fill them in later from
        your profile settings.
      </Text>

      {/* Phone */}
      <FormField label="Phone Number" optional>
        <StyledInput
          placeholder="+1 (555) 000-0000"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!loading}
          icon="call-outline"
        />
      </FormField>

      {/* Gender Dropdown */}
      <FormField label="Gender" optional>
        <TouchableOpacity
          onPress={() => setShowGenderPicker(true)}
          className="bg-white rounded-xl px-4 py-3 border border-gray-200 flex-row items-center"
        >
          <Ionicons
            name="person-outline"
            size={18}
            color="#9CA3AF"
            style={{ marginRight: 8 }}
          />
          <Text
            className={`flex-1 text-base ${
              gender ? 'text-text-primary' : 'text-gray-400'
            }`}
          >
            {gender
              ? GENDER_OPTIONS.find((g) => g.value === gender)?.label
              : 'Select gender'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </FormField>

      {/* Date of Birth */}
      <FormField label="Date of Birth" optional>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="bg-white rounded-xl px-4 py-3 border border-gray-200 flex-row items-center"
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color="#9CA3AF"
            style={{ marginRight: 8 }}
          />
          <Text
            className={`flex-1 text-base ${
              dateOfBirth ? 'text-text-primary' : 'text-gray-400'
            }`}
          >
            {dateOfBirth ? formatDOB(dateOfBirth) : 'Select date of birth'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </FormField>

      {/* Country & City */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <FormField label="Country" optional>
            <StyledInput
              placeholder="e.g. Lebanon"
              value={country}
              onChangeText={setCountry}
              autoCapitalize="words"
              editable={!loading}
              icon="globe-outline"
            />
          </FormField>
        </View>
        <View className="flex-1">
          <FormField label="City" optional>
            <StyledInput
              placeholder="e.g. Beirut"
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
              editable={!loading}
              icon="location-outline"
            />
          </FormField>
        </View>
      </View>

      {/* Sign-up Summary chip */}
      <View className="bg-primary/10 rounded-xl p-3 flex-row items-center mb-4">
        <Ionicons name="information-circle-outline" size={18} color="#00897B" />
        <Text className="text-xs text-primary-dark ml-2 flex-1 leading-4">
          Signing up as{' '}
          <Text className="font-bold">
            {ACCOUNT_TYPES.find((t) => t.value === accountType)?.label}
          </Text>
          {accountType === 'vet'
            ? '. You can set up your clinic after verifying your email.'
            : accountType === 'groomer'
              ? '. You can set up your grooming shop after verifying your email.'
              : accountType === 'pet_shop'
                ? '. You can set up your pet shop after verifying your email.'
                : '.'}
        </Text>
      </View>

      {/* Terms & Privacy consent checkbox */}
      <TouchableOpacity
        onPress={() => setTermsAccepted(!termsAccepted)}
        className="flex-row items-start mb-4"
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: termsAccepted }}
        accessibilityLabel="Accept Terms of Service and Privacy Policy"
      >
        <View
          className={`w-5 h-5 rounded border-2 items-center justify-center mt-0.5 mr-2.5 ${
            termsAccepted
              ? 'bg-primary border-primary'
              : 'bg-white border-gray-300'
          }`}
        >
          {termsAccepted && (
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          )}
        </View>
        <Text className="flex-1 text-xs text-text-secondary leading-4">
          I agree to the{' '}
          <Text
            className="text-primary font-semibold underline"
            onPress={() => router.push('/terms-of-service' as any)}
          >
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text
            className="text-primary font-semibold underline"
            onPress={() => router.push('/privacy-policy' as any)}
          >
            Privacy Policy
          </Text>
          . I understand how my data will be collected and used in accordance
          with Canadian privacy law (PIPEDA).
        </Text>
      </TouchableOpacity>

      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={handleSignUp}
          disabled={loading || !termsAccepted}
          className={`flex-1 rounded-xl py-3.5 items-center ${
            loading || !termsAccepted
              ? 'bg-gray-300 opacity-60'
              : 'bg-primary-dark'
          }`}
        >
          <Text className="text-base font-semibold text-white">
            {loading ? 'Creating Account…' : 'Create Account'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleSignUp}
        disabled={loading || !termsAccepted}
        className="items-center mt-3"
      >
        <Text className="text-xs text-text-muted underline">
          Skip for now & create account
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <KeyboardAvoidingView
        behavior="padding"
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
          {mode === 'login' && renderLogin()}
          {mode === 'signup' && signUpStep === 1 && renderSignUpStep1()}
          {mode === 'signup' && signUpStep === 2 && renderSignUpStep2()}
          {mode === 'signup' && signUpStep === 3 && renderSignUpStep3()}

          {/* Mode Toggle — always visible */}
          <View className="px-5 pb-6">
            <View className="flex-row bg-white rounded-2xl p-1.5 border border-gray-200">
              <TouchableOpacity
                onPress={() => {
                  setMode('login');
                  resetSignUpForm();
                  dispatch(clearError());
                }}
                className={`flex-1 py-3 rounded-xl items-center ${
                  mode === 'login' ? 'bg-primary-dark' : ''
                }`}
              >
                <Text
                  className={`text-base font-semibold ${
                    mode === 'login' ? 'text-white' : 'text-text-muted'
                  }`}
                >
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setMode('signup');
                  setPassword('');
                  setConfirmPassword('');
                  dispatch(clearError());
                }}
                className={`flex-1 py-3 rounded-xl items-center ${
                  mode === 'signup' ? 'bg-primary-dark' : ''
                }`}
              >
                <Text
                  className={`text-base font-semibold ${
                    mode === 'signup' ? 'text-white' : 'text-text-muted'
                  }`}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Gender Picker Modal */}
      <Modal visible={showGenderPicker} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowGenderPicker(false)}
          className="flex-1 bg-black/40 justify-end"
        >
          <View className="bg-white rounded-t-3xl p-5">
            <Text className="text-lg font-bold text-text-primary mb-4">
              Select Gender
            </Text>
            {GENDER_OPTIONS.map((g) => (
              <TouchableOpacity
                key={g.value}
                onPress={() => {
                  setGender(g.value);
                  setShowGenderPicker(false);
                }}
                className={`flex-row items-center py-3.5 px-4 rounded-xl mb-2 ${
                  gender === g.value ? 'bg-primary/10' : 'bg-gray-50'
                }`}
              >
                <Text
                  className={`flex-1 text-base ${
                    gender === g.value
                      ? 'text-primary-dark font-semibold'
                      : 'text-text-primary'
                  }`}
                >
                  {g.label}
                </Text>
                {gender === g.value && (
                  <Ionicons name="checkmark-circle" size={20} color="#00897B" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setShowGenderPicker(false)}
              className="py-3 items-center mt-2"
            >
              <Text className="text-sm text-text-muted font-semibold">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date Picker — Android renders outside, iOS uses modal with spinner */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={dateOfBirth || new Date(2000, 0, 1)}
          mode="date"
          maximumDate={new Date()}
          minimumDate={new Date(1920, 0, 1)}
          onChange={onDateChange}
        />
      )}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
            className="flex-1 bg-black/40 justify-end"
          >
            <View className="bg-white rounded-t-3xl p-5">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-lg font-bold text-text-primary">
                  Date of Birth
                </Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text className="text-sm font-semibold text-primary-dark">
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateOfBirth || new Date(2000, 0, 1)}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                minimumDate={new Date(1920, 0, 1)}
                onChange={onDateChange}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
};
