import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenHeader } from '../common/ScreenHeader';
import { useAlert } from '../ui/CustomAlert';
import { Button } from '../common/Button';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchMyClinic,
  createVetClinic,
  updateVetClinic,
  WorkingHours,
  ClinicService,
} from '../../store/slices/vetSlice';
import { pickImage, takePhoto, uploadImage } from '../../services/ImageService';

// ========================================
// Constants
// ========================================

const STEPS = ['Basic Info', 'Services', 'Schedule', 'Settings'];

const SERVICE_CATEGORIES = [
  'consultation',
  'vaccination',
  'surgery',
  'dental',
  'grooming',
  'laboratory',
  'imaging',
  'emergency',
  'wellness',
  'deworming',
  'nutrition',
  'behavioral',
  'other',
];

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  consultation: 'Consultation',
  vaccination: 'Vaccination',
  surgery: 'Surgery',
  dental: 'Dental',
  grooming: 'Grooming',
  laboratory: 'Laboratory',
  imaging: 'Imaging',
  emergency: 'Emergency',
  wellness: 'Wellness',
  deworming: 'Deworming',
  nutrition: 'Nutrition',
  behavioral: 'Behavioral',
  other: 'Other',
};

const PET_TYPE_OPTIONS = [
  { value: 'dog', label: 'Dogs', icon: 'dog' },
  { value: 'cat', label: 'Cats', icon: 'cat' },
  { value: 'bird', label: 'Birds', icon: 'bird' },
  { value: 'rabbit', label: 'Rabbits', icon: 'rabbit' },
  { value: 'hamster', label: 'Hamsters', icon: 'rodent' },
  { value: 'turtle', label: 'Turtles', icon: 'turtle' },
  { value: 'fish', label: 'Fish', icon: 'fish' },
];

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DEFAULT_WORKING_HOURS: WorkingHours[] = DAYS_OF_WEEK.map((day) => ({
  day,
  isOpen: day !== 'sunday',
  openTime: '09:00',
  closeTime: '17:00',
  breakStart: '12:00',
  breakEnd: '13:00',
}));

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ========================================
// Time Picker Helper
// ========================================

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(
      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
    );
  }
}

const formatTime12 = (time: string) => {
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${ampm}`;
};

// ========================================
// Sub Components
// ========================================

interface ServiceFormData {
  name: string;
  description: string;
  price: string;
  duration: string;
  category: string;
}

const EMPTY_SERVICE: ServiceFormData = {
  name: '',
  description: '',
  price: '',
  duration: '30',
  category: 'consultation',
};

// ========================================
// ManageClinicScreen
// ========================================

export const ManageClinicScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();

  const { myClinic, loading, error } = useSelector(
    (state: RootState) => state.vets,
  );
  const { user, token } = useSelector((state: RootState) => state.auth);

  const isEditing = !!myClinic;

  // Multi-step form state
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // === Step 1: Basic Info ===
  const [clinicName, setClinicName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateField, setStateField] = useState('');
  const [country, setCountry] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');

  // === Photos ===
  const [photoUris, setPhotoUris] = useState<
    { uri: string; uploaded?: boolean; url?: string }[]
  >([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // === Step 2: Services ===
  const [services, setServices] = useState<ServiceFormData[]>([]);
  const [showAddService, setShowAddService] = useState(false);
  const [editingServiceIdx, setEditingServiceIdx] = useState<number | null>(
    null,
  );
  const [serviceForm, setServiceForm] = useState<ServiceFormData>({
    ...EMPTY_SERVICE,
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // === Step 3: Schedule ===
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([
    ...DEFAULT_WORKING_HOURS,
  ]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{
    dayIdx: number;
    field: 'openTime' | 'closeTime' | 'breakStart' | 'breakEnd';
  } | null>(null);
  const [appointmentDuration, setAppointmentDuration] = useState('30');
  const [maxDailyAppointments, setMaxDailyAppointments] = useState('20');

  // === Step 4: Settings ===
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [homeVisitAvailable, setHomeVisitAvailable] = useState(false);
  const [onlineConsultation, setOnlineConsultation] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [acceptedPetTypes, setAcceptedPetTypes] = useState<string[]>([
    'dog',
    'cat',
    'bird',
    'rabbit',
    'hamster',
    'turtle',
  ]);

  // ========================================
  // Load existing clinic data
  // ========================================

  useEffect(() => {
    dispatch(fetchMyClinic()).finally(() => setInitialLoading(false));
  }, [dispatch]);

  useEffect(() => {
    if (myClinic) {
      setClinicName(myClinic.clinicName || '');
      setDescription(myClinic.description || '');
      setPhone(myClinic.phone || '');
      setEmail(myClinic.email || '');
      setWebsite(myClinic.website || '');
      setStreet(myClinic.address?.street || '');
      setCity(myClinic.address?.city || '');
      setStateField(myClinic.address?.state || '');
      setCountry(myClinic.address?.country || '');
      setZipCode(myClinic.address?.zipCode || '');
      setLicenseNumber(myClinic.licenseNumber || '');
      setYearsOfExperience(
        myClinic.yearsOfExperience ? String(myClinic.yearsOfExperience) : '',
      );
      setServices(
        myClinic.services.map((s) => ({
          name: s.name,
          description: s.description || '',
          price: s.price != null ? String(s.price) : '',
          duration: String(s.duration || 30),
          category: s.category || 'consultation',
        })),
      );
      if (myClinic.workingHours?.length > 0) {
        setWorkingHours(myClinic.workingHours);
      }
      setAppointmentDuration(String(myClinic.appointmentDuration || 30));
      setMaxDailyAppointments(String(myClinic.maxDailyAppointments || 20));
      setEmergencyAvailable(myClinic.emergencyAvailable || false);
      setHomeVisitAvailable(myClinic.homeVisitAvailable || false);
      setOnlineConsultation(myClinic.onlineConsultation || false);
      setAllowMessages(myClinic.allowMessages ?? true);
      setAcceptedPetTypes(
        myClinic.acceptedPetTypes?.length > 0
          ? myClinic.acceptedPetTypes
          : ['dog', 'cat', 'bird', 'rabbit', 'hamster', 'turtle'],
      );
      // Load existing photos
      if (myClinic.photos?.length > 0) {
        setPhotoUris(
          myClinic.photos.map((p) => ({
            uri: p.url,
            uploaded: true,
            url: p.url,
          })),
        );
      }
    }
  }, [myClinic]);

  // ========================================
  // Validation
  // ========================================

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!clinicName.trim()) return 'Clinic name is required';
      if (!phone.trim()) return 'Phone number is required';
      if (!city.trim()) return 'City is required';
    }
    return null;
  };

  // ========================================
  // Navigation
  // ========================================

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      showAlert({ title: 'Missing info', message: err, variant: 'warning' });
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
    else router.back();
  };

  // ========================================
  // Photo Helpers
  // ========================================

  const handlePickPhoto = () => {
    showAlert({
      title: 'Add Photo',
      message: 'Choose a source',
      variant: 'info',
      buttons: [
        {
          text: 'Camera',
          onPress: async () => {
            try {
              const uri = await takePhoto();
              if (uri) setPhotoUris((prev) => [...prev, { uri }]);
            } catch (e: any) {
              showAlert({
                title: 'Error',
                message: e.message || 'Could not take photo',
                variant: 'error',
              });
            }
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            try {
              const uri = await pickImage();
              if (uri) setPhotoUris((prev) => [...prev, { uri }]);
            } catch (e: any) {
              showAlert({
                title: 'Error',
                message: e.message || 'Could not pick image',
                variant: 'error',
              });
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadNewPhotos = async (): Promise<
    { url: string; caption: string }[]
  > => {
    const uploaded: { url: string; caption: string }[] = [];
    for (const photo of photoUris) {
      if (photo.uploaded && photo.url) {
        uploaded.push({ url: photo.url, caption: '' });
      } else {
        const result = await uploadImage(
          photo.uri,
          'petopia/clinics',
          token || '',
        );
        uploaded.push({ url: result.url, caption: '' });
      }
    }
    return uploaded;
  };

  // ========================================
  // Submit
  // ========================================

  const buildClinicData = () => {
    const data: Record<string, any> = {
      clinicName: clinicName.trim(),
      description: description.trim(),
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
      address: {
        street: street.trim(),
        city: city.trim(),
        state: stateField.trim(),
        country: country.trim(),
        zipCode: zipCode.trim(),
      },
      services: services.map((s) => ({
        name: s.name.trim(),
        description: s.description.trim(),
        price: s.price ? parseFloat(s.price) : null,
        duration: parseInt(s.duration, 10) || 30,
        category: s.category,
      })),
      workingHours,
      appointmentDuration: parseInt(appointmentDuration, 10) || 30,
      maxDailyAppointments: parseInt(maxDailyAppointments, 10) || 20,
      emergencyAvailable,
      homeVisitAvailable,
      onlineConsultation,
      allowMessages,
      acceptedPetTypes,
      licenseNumber: licenseNumber.trim(),
      yearsOfExperience: yearsOfExperience
        ? parseInt(yearsOfExperience, 10)
        : 0,
    };
    return data;
  };

  const handleSubmit = async () => {
    const err = validateStep(0);
    if (err) {
      setStep(0);
      showAlert({ title: 'Missing info', message: err, variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      // Upload any new photos first
      let photos: { url: string; caption: string }[] = [];
      if (photoUris.length > 0) {
        setUploadingPhotos(true);
        try {
          photos = await uploadNewPhotos();
        } finally {
          setUploadingPhotos(false);
        }
      }

      const clinicData = { ...buildClinicData(), photos };

      if (isEditing && myClinic) {
        await dispatch(
          updateVetClinic({ clinicId: myClinic._id, data: clinicData }),
        ).unwrap();
        showAlert({
          title: 'Success',
          message: 'Clinic updated successfully!',
          variant: 'success',
        });
      } else {
        await dispatch(createVetClinic(clinicData)).unwrap();
        showAlert({
          title: 'Success',
          message: 'Clinic created successfully!',
          variant: 'success',
        });
      }
      router.back();
    } catch (e: any) {
      showAlert({
        title: 'Error',
        message: e || 'Failed to save clinic',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ========================================
  // Service Helpers
  // ========================================

  const handleSaveService = () => {
    if (!serviceForm.name.trim()) {
      showAlert({
        title: 'Error',
        message: 'Service name is required',
        variant: 'error',
      });
      return;
    }
    const priceNum = parseFloat(serviceForm.price);
    if (!serviceForm.price.trim() || isNaN(priceNum) || priceNum <= 0) {
      showAlert({
        title: 'Error',
        message: 'Please enter a valid price greater than 0',
        variant: 'error',
      });
      return;
    }
    if (editingServiceIdx !== null) {
      const updated = [...services];
      updated[editingServiceIdx] = { ...serviceForm };
      setServices(updated);
    } else {
      setServices([...services, { ...serviceForm }]);
    }
    setServiceForm({ ...EMPTY_SERVICE });
    setEditingServiceIdx(null);
    setShowAddService(false);
  };

  const handleEditService = (idx: number) => {
    setServiceForm({ ...services[idx] });
    setEditingServiceIdx(idx);
    setShowAddService(true);
  };

  const handleDeleteService = (idx: number) => {
    showAlert({
      title: 'Delete Service',
      message: 'Remove this service?',
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updated = services.filter((_, i) => i !== idx);
            setServices(updated);
          },
        },
      ],
    });
  };

  // ========================================
  // Working Hours Helpers
  // ========================================

  const toggleDayOpen = (dayIdx: number) => {
    const updated = [...workingHours];
    updated[dayIdx] = { ...updated[dayIdx], isOpen: !updated[dayIdx].isOpen };
    setWorkingHours(updated);
  };

  const openTimePicker = (
    dayIdx: number,
    field: 'openTime' | 'closeTime' | 'breakStart' | 'breakEnd',
  ) => {
    setTimePickerTarget({ dayIdx, field });
    setShowTimePicker(true);
  };

  const selectTime = (time: string) => {
    if (!timePickerTarget) return;
    const updated = [...workingHours];
    updated[timePickerTarget.dayIdx] = {
      ...updated[timePickerTarget.dayIdx],
      [timePickerTarget.field]: time,
    };
    setWorkingHours(updated);
    setShowTimePicker(false);
    setTimePickerTarget(null);
  };

  const togglePetType = (petType: string) => {
    setAcceptedPetTypes((prev) =>
      prev.includes(petType)
        ? prev.filter((t) => t !== petType)
        : [...prev, petType],
    );
  };

  // ========================================
  // Render Loading
  // ========================================

  if (initialLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
        <ScreenHeader title="My Clinic" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DB6AC" />
          <Text className="text-text-muted mt-3">Loading clinic data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ========================================
  // Render
  // ========================================

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader
        title={isEditing ? 'Edit Clinic' : 'Create Clinic'}
        onBack={goBack}
        rightAction={
          step === STEPS.length - 1 ? (
            <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color="#00897B" />
              ) : (
                <Text className="text-primary font-bold text-base">
                  {isEditing ? 'Save' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Step Indicators */}
      <View className="flex-row px-5 py-3 bg-white border-b border-bg-alt">
        {STEPS.map((label, i) => (
          <TouchableOpacity
            key={label}
            onPress={() => {
              if (i < step) setStep(i);
              else if (i === step + 1) goNext();
            }}
            className="flex-1 items-center"
          >
            <View
              className={`w-8 h-8 rounded-full items-center justify-center mb-1 ${
                i === step
                  ? 'bg-primary'
                  : i < step
                    ? 'bg-primary-dark'
                    : 'bg-gray-200'
              }`}
            >
              {i < step ? (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              ) : (
                <Text
                  className={`text-sm font-bold ${
                    i === step ? 'text-white' : 'text-text-muted'
                  }`}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text
              className={`text-xs ${
                i === step
                  ? 'text-primary font-semibold'
                  : i < step
                    ? 'text-primary-dark font-medium'
                    : 'text-text-muted'
              }`}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          {step === 0 && renderBasicInfo()}
          {step === 1 && renderServices()}
          {step === 2 && renderSchedule()}
          {step === 3 && renderSettings()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Buttons */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-bg-alt px-5 py-4 pb-8">
        <View className="flex-row gap-3">
          {step > 0 && (
            <TouchableOpacity
              onPress={goBack}
              className="flex-1 py-3.5 rounded-xl items-center border border-gray-200"
            >
              <Text className="text-base font-semibold text-text-primary">
                Back
              </Text>
            </TouchableOpacity>
          )}
          {step < STEPS.length - 1 ? (
            <TouchableOpacity
              onPress={goNext}
              className="flex-1 bg-primary py-3.5 rounded-xl items-center"
            >
              <Text className="text-base font-semibold text-white">Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              className={`flex-1 py-3.5 rounded-xl items-center ${
                submitting ? 'bg-primary/60' : 'bg-primary'
              }`}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  {isEditing ? 'Save Changes' : 'Create Clinic'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Service Form Modal */}
      {renderServiceModal()}

      {/* Category Picker Modal */}
      {renderCategoryPicker()}

      {/* Time Picker Modal */}
      {renderTimePicker()}
    </SafeAreaView>
  );

  // ========================================
  // Step 1: Basic Info
  // ========================================

  function renderBasicInfo() {
    return (
      <View>
        {/* Header Card */}
        <View className="bg-primary/10 rounded-2xl p-4 mb-5 flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
            <MaterialCommunityIcons
              name="hospital-building"
              size={22}
              color="#00897B"
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-primary-dark">
              {isEditing ? 'Update your clinic details' : 'Set up your clinic'}
            </Text>
            <Text className="text-xs text-text-muted mt-0.5">
              Fields marked with * are required
            </Text>
          </View>
        </View>

        {/* Clinic Photos */}
        <View className="flex-row items-center mb-3">
          <Ionicons name="camera-outline" size={18} color="#00897B" />
          <Text className="text-base font-bold text-text-primary ml-1">
            Photos
          </Text>
          <Text className="text-xs text-text-muted ml-2">(up to 10)</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-5"
          contentContainerStyle={{ gap: 10, paddingTop: 10, paddingRight: 10 }}
        >
          {photoUris.map((photo, idx) => (
            <View key={idx} className="relative">
              <Image
                source={{ uri: photo.uri }}
                style={{ width: 90, height: 90, borderRadius: 12 }}
                contentFit="cover"
              />
              <TouchableOpacity
                onPress={() => handleRemovePhoto(idx)}
                className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 items-center justify-center"
                style={{ elevation: 2 }}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}

          {photoUris.length < 10 && (
            <TouchableOpacity
              onPress={handlePickPhoto}
              className="w-[90px] h-[90px] rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 items-center justify-center"
            >
              <Ionicons name="add-circle-outline" size={28} color="#4DB6AC" />
              <Text className="text-[10px] text-primary mt-1">Add Photo</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {uploadingPhotos && (
          <View className="flex-row items-center mb-4">
            <ActivityIndicator size="small" color="#4DB6AC" />
            <Text className="text-xs text-text-muted ml-2">
              Uploading photos...
            </Text>
          </View>
        )}

        {/* Clinic Name */}
        <Text className="text-sm font-semibold text-text-primary mb-2">
          Clinic Name *
        </Text>
        <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 mb-4">
          <Ionicons name="business-outline" size={18} color="#6B7280" />
          <TextInput
            placeholder="e.g. Happy Paws Vet Clinic"
            placeholderTextColor="#9CA3AF"
            value={clinicName}
            onChangeText={setClinicName}
            className="flex-1 py-3 text-base text-text-primary ml-2"
          />
        </View>

        {/* Description */}
        <Text className="text-sm font-semibold text-text-primary mb-2">
          Description
        </Text>
        <TextInput
          placeholder="Tell pet owners about your clinic, specialties, and philosophy..."
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
          style={{ textAlignVertical: 'top', minHeight: 100 }}
        />

        {/* Phone */}
        <Text className="text-sm font-semibold text-text-primary mb-2">
          Phone *
        </Text>
        <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 mb-4">
          <Ionicons name="call-outline" size={18} color="#6B7280" />
          <TextInput
            placeholder="Clinic phone number"
            placeholderTextColor="#9CA3AF"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            className="flex-1 py-3 text-base text-text-primary ml-2"
          />
        </View>

        {/* Email */}
        <Text className="text-sm font-semibold text-text-primary mb-2">
          Email
        </Text>
        <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 mb-4">
          <Ionicons name="mail-outline" size={18} color="#6B7280" />
          <TextInput
            placeholder="clinic@example.com"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            className="flex-1 py-3 text-base text-text-primary ml-2"
          />
        </View>

        {/* Website */}
        <Text className="text-sm font-semibold text-text-primary mb-2">
          Website
        </Text>
        <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 mb-4">
          <Ionicons name="globe-outline" size={18} color="#6B7280" />
          <TextInput
            placeholder="www.example.com"
            placeholderTextColor="#9CA3AF"
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            className="flex-1 py-3 text-base text-text-primary ml-2"
          />
        </View>

        {/* Address Section */}
        <View className="flex-row items-center mb-3 mt-2">
          <Ionicons name="location-outline" size={18} color="#00897B" />
          <Text className="text-base font-bold text-text-primary ml-1">
            Address
          </Text>
        </View>

        <TextInput
          placeholder="Street address"
          placeholderTextColor="#9CA3AF"
          value={street}
          onChangeText={setStreet}
          className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-3"
        />
        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <TextInput
              placeholder="City *"
              placeholderTextColor="#9CA3AF"
              value={city}
              onChangeText={setCity}
              className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200"
            />
          </View>
          <View className="flex-1">
            <TextInput
              placeholder="State"
              placeholderTextColor="#9CA3AF"
              value={stateField}
              onChangeText={setStateField}
              className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200"
            />
          </View>
        </View>
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <TextInput
              placeholder="Country"
              placeholderTextColor="#9CA3AF"
              value={country}
              onChangeText={setCountry}
              className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200"
            />
          </View>
          <View className="flex-1">
            <TextInput
              placeholder="Zip Code"
              placeholderTextColor="#9CA3AF"
              value={zipCode}
              onChangeText={setZipCode}
              className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200"
            />
          </View>
        </View>

        {/* Professional Info */}
        <View className="flex-row items-center mb-3 mt-2">
          <MaterialCommunityIcons
            name="certificate-outline"
            size={18}
            color="#00897B"
          />
          <Text className="text-base font-bold text-text-primary ml-1">
            Professional Info
          </Text>
        </View>

        <Text className="text-sm font-semibold text-text-primary mb-2">
          License Number
        </Text>
        <TextInput
          placeholder="Veterinary license number"
          placeholderTextColor="#9CA3AF"
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
        />

        <Text className="text-sm font-semibold text-text-primary mb-2">
          Years of Experience
        </Text>
        <TextInput
          placeholder="e.g. 5"
          placeholderTextColor="#9CA3AF"
          value={yearsOfExperience}
          onChangeText={setYearsOfExperience}
          keyboardType="number-pad"
          className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
        />
      </View>
    );
  }

  // ========================================
  // Step 2: Services
  // ========================================

  function renderServices() {
    return (
      <View>
        <View className="bg-primary/10 rounded-2xl p-4 mb-5 flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
            <Ionicons name="medkit-outline" size={22} color="#00897B" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-primary-dark">
              Add your services
            </Text>
            <Text className="text-xs text-text-muted mt-0.5">
              List the services your clinic offers
            </Text>
          </View>
        </View>

        {services.length === 0 ? (
          <View className="bg-white rounded-xl p-6 items-center border border-dashed border-gray-300 mb-4">
            <MaterialCommunityIcons
              name="stethoscope"
              size={36}
              color="#9CA3AF"
            />
            <Text className="text-base text-text-muted mt-2">
              No services added yet
            </Text>
            <Text className="text-xs text-text-muted mt-1 text-center">
              Tap the button below to add your first service
            </Text>
          </View>
        ) : (
          services.map((service, idx) => (
            <View
              key={idx}
              className="bg-white rounded-xl p-4 mb-3 border border-bg-alt"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-base font-semibold text-text-primary">
                    {service.name}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                      <Text className="text-xs text-primary font-medium">
                        {SERVICE_CATEGORY_LABELS[service.category] ||
                          service.category}
                      </Text>
                    </View>
                    {service.price ? (
                      <Text className="text-sm text-text-muted ml-2">
                        P${service.price}
                      </Text>
                    ) : null}
                    <Text className="text-sm text-text-muted ml-2">
                      · {service.duration} min
                    </Text>
                  </View>
                  {service.description ? (
                    <Text
                      className="text-xs text-text-muted mt-1"
                      numberOfLines={2}
                    >
                      {service.description}
                    </Text>
                  ) : null}
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={() => handleEditService(idx)}>
                    <Ionicons name="create-outline" size={20} color="#4DB6AC" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteService(idx)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity
          onPress={() => {
            setServiceForm({ ...EMPTY_SERVICE });
            setEditingServiceIdx(null);
            setShowAddService(true);
          }}
          className="bg-primary/10 border border-primary/30 rounded-xl p-4 items-center flex-row justify-center mt-1"
        >
          <Ionicons name="add-circle-outline" size={20} color="#00897B" />
          <Text className="text-primary font-semibold ml-2">Add Service</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ========================================
  // Step 3: Schedule
  // ========================================

  function renderSchedule() {
    return (
      <View>
        <View className="bg-primary/10 rounded-2xl p-4 mb-5 flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
            <Ionicons name="time-outline" size={22} color="#00897B" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-primary-dark">
              Working hours
            </Text>
            <Text className="text-xs text-text-muted mt-0.5">
              Set your clinic's operating schedule
            </Text>
          </View>
        </View>

        {workingHours.map((wh, idx) => (
          <View
            key={wh.day}
            className="bg-white rounded-xl p-4 mb-2 border border-bg-alt"
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-semibold text-text-primary">
                {capitalize(wh.day)}
              </Text>
              <Switch
                value={wh.isOpen}
                onValueChange={() => toggleDayOpen(idx)}
                trackColor={{ false: '#D1D5DB', true: '#80CBC4' }}
                thumbColor={wh.isOpen ? '#00897B' : '#F3F4F6'}
              />
            </View>

            {wh.isOpen && (
              <View>
                {/* Working hours row */}
                <View className="flex-row items-center gap-2 mb-2">
                  <TouchableOpacity
                    onPress={() => openTimePicker(idx, 'openTime')}
                    className="flex-1 bg-gray-50 rounded-lg px-3 py-2 items-center border border-gray-200"
                  >
                    <Text className="text-xs text-text-muted mb-0.5">Open</Text>
                    <Text className="text-sm font-medium text-text-primary">
                      {formatTime12(wh.openTime)}
                    </Text>
                  </TouchableOpacity>
                  <Ionicons name="arrow-forward" size={14} color="#9CA3AF" />
                  <TouchableOpacity
                    onPress={() => openTimePicker(idx, 'closeTime')}
                    className="flex-1 bg-gray-50 rounded-lg px-3 py-2 items-center border border-gray-200"
                  >
                    <Text className="text-xs text-text-muted mb-0.5">
                      Close
                    </Text>
                    <Text className="text-sm font-medium text-text-primary">
                      {formatTime12(wh.closeTime)}
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* Break row */}
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => openTimePicker(idx, 'breakStart')}
                    className="flex-1 bg-gray-50 rounded-lg px-3 py-2 items-center border border-gray-200"
                  >
                    <Text className="text-xs text-text-muted mb-0.5">
                      Break Start
                    </Text>
                    <Text className="text-sm font-medium text-text-primary">
                      {wh.breakStart ? formatTime12(wh.breakStart) : '—'}
                    </Text>
                  </TouchableOpacity>
                  <Ionicons name="arrow-forward" size={14} color="#9CA3AF" />
                  <TouchableOpacity
                    onPress={() => openTimePicker(idx, 'breakEnd')}
                    className="flex-1 bg-gray-50 rounded-lg px-3 py-2 items-center border border-gray-200"
                  >
                    <Text className="text-xs text-text-muted mb-0.5">
                      Break End
                    </Text>
                    <Text className="text-sm font-medium text-text-primary">
                      {wh.breakEnd ? formatTime12(wh.breakEnd) : '—'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}

        {/* Appointment Settings */}
        <View className="flex-row items-center mb-3 mt-5">
          <Ionicons name="calendar-outline" size={18} color="#00897B" />
          <Text className="text-base font-bold text-text-primary ml-1">
            Appointment Settings
          </Text>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text-primary mb-2">
              Duration (min)
            </Text>
            <TextInput
              value={appointmentDuration}
              onChangeText={setAppointmentDuration}
              keyboardType="number-pad"
              className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200"
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text-primary mb-2">
              Max Daily
            </Text>
            <TextInput
              value={maxDailyAppointments}
              onChangeText={setMaxDailyAppointments}
              keyboardType="number-pad"
              className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200"
            />
          </View>
        </View>
      </View>
    );
  }

  // ========================================
  // Step 4: Settings
  // ========================================

  function renderSettings() {
    return (
      <View>
        <View className="bg-primary/10 rounded-2xl p-4 mb-5 flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
            <Ionicons name="settings-outline" size={22} color="#00897B" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-primary-dark">
              Clinic settings
            </Text>
            <Text className="text-xs text-text-muted mt-0.5">
              Configure capabilities and preferences
            </Text>
          </View>
        </View>

        {/* Capabilities */}
        <Text className="text-base font-bold text-text-primary mb-3">
          Capabilities
        </Text>

        <View className="bg-white rounded-xl border border-bg-alt overflow-hidden mb-5">
          {[
            {
              label: 'Emergency Services',
              desc: 'Available for emergency cases',
              icon: 'alert-circle-outline' as const,
              value: emergencyAvailable,
              onToggle: setEmergencyAvailable,
            },
            {
              label: 'Home Visits',
              desc: 'Offer at-home veterinary services',
              icon: 'home-outline' as const,
              value: homeVisitAvailable,
              onToggle: setHomeVisitAvailable,
            },
            {
              label: 'Online Consultation',
              desc: 'Provide virtual appointments',
              icon: 'videocam-outline' as const,
              value: onlineConsultation,
              onToggle: setOnlineConsultation,
            },
            {
              label: 'Allow Messages',
              desc: 'Let pet owners message you',
              icon: 'chatbubble-outline' as const,
              value: allowMessages,
              onToggle: setAllowMessages,
            },
          ].map((item, idx) => (
            <View
              key={item.label}
              className={`flex-row items-center px-4 py-3 ${
                idx > 0 ? 'border-t border-bg-alt' : ''
              }`}
            >
              <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center mr-3">
                <Ionicons name={item.icon} size={18} color="#00897B" />
              </View>
              <View className="flex-1 mr-3">
                <Text className="text-sm font-semibold text-text-primary">
                  {item.label}
                </Text>
                <Text className="text-xs text-text-muted">{item.desc}</Text>
              </View>
              <Switch
                value={item.value}
                onValueChange={item.onToggle}
                trackColor={{ false: '#D1D5DB', true: '#80CBC4' }}
                thumbColor={item.value ? '#00897B' : '#F3F4F6'}
              />
            </View>
          ))}
        </View>

        {/* Accepted Pet Types */}
        <Text className="text-base font-bold text-text-primary mb-3">
          Accepted Pet Types
        </Text>

        <View className="flex-row flex-wrap gap-2 mb-5">
          {PET_TYPE_OPTIONS.map((opt) => {
            const selected = acceptedPetTypes.includes(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => togglePetType(opt.value)}
                className={`flex-row items-center px-4 py-2.5 rounded-full border ${
                  selected
                    ? 'bg-primary border-primary'
                    : 'bg-white border-gray-200'
                }`}
              >
                <MaterialCommunityIcons
                  name={opt.icon as any}
                  size={16}
                  color={selected ? '#FFFFFF' : '#00897B'}
                />
                <Text
                  className={`text-sm font-medium ml-1.5 ${
                    selected ? 'text-white' : 'text-text-primary'
                  }`}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Review Summary */}
        {isEditing && myClinic && (
          <View className="bg-white rounded-xl p-4 border border-bg-alt">
            <Text className="text-base font-bold text-text-primary mb-2">
              Clinic Stats
            </Text>
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className="text-2xl font-bold text-primary">
                  {myClinic.averageRating?.toFixed(1) || '0.0'}
                </Text>
                <Text className="text-xs text-text-muted">Rating</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-primary">
                  {myClinic.totalReviews || 0}
                </Text>
                <Text className="text-xs text-text-muted">Reviews</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-primary">
                  {myClinic.services?.length || 0}
                </Text>
                <Text className="text-xs text-text-muted">Services</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ========================================
  // Service Modal
  // ========================================

  function renderServiceModal() {
    return (
      <Modal visible={showAddService} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <ScrollView
              bounces
              keyboardShouldPersistTaps="handled"
              scrollEnabled
              style={{ maxHeight: 550 }}
            >
              <View className="bg-white rounded-t-3xl p-6">
                <View className="flex-row justify-between items-center mb-5">
                  <Text className="text-xl font-bold text-text-primary">
                    {editingServiceIdx !== null
                      ? 'Edit Service'
                      : 'Add Service'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowAddService(false)}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Service Name */}
                <Text className="text-sm font-semibold text-text-primary mb-2">
                  Name *
                </Text>
                <TextInput
                  placeholder="e.g. General Checkup"
                  placeholderTextColor="#9CA3AF"
                  value={serviceForm.name}
                  onChangeText={(v) =>
                    setServiceForm({ ...serviceForm, name: v })
                  }
                  className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
                />

                {/* Category */}
                <Text className="text-sm font-semibold text-text-primary mb-2">
                  Category
                </Text>
                <TouchableOpacity
                  onPress={() => setShowCategoryPicker(true)}
                  className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 mb-4 flex-row items-center justify-between"
                >
                  <Text className="text-base text-text-primary">
                    {SERVICE_CATEGORY_LABELS[serviceForm.category] ||
                      serviceForm.category}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#6B7280" />
                </TouchableOpacity>

                {/* Price & Duration */}
                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-text-primary mb-2">
                      Price (P$) <Text className="text-red-500">*</Text>
                    </Text>
                    <TextInput
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      value={serviceForm.price}
                      onChangeText={(v) =>
                        setServiceForm({ ...serviceForm, price: v })
                      }
                      keyboardType="decimal-pad"
                      className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-text-primary mb-2">
                      Duration (min)
                    </Text>
                    <TextInput
                      placeholder="30"
                      placeholderTextColor="#9CA3AF"
                      value={serviceForm.duration}
                      onChangeText={(v) =>
                        setServiceForm({ ...serviceForm, duration: v })
                      }
                      keyboardType="number-pad"
                      className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200"
                    />
                  </View>
                </View>

                {/* Description */}
                <Text className="text-sm font-semibold text-text-primary mb-2">
                  Description
                </Text>
                <TextInput
                  placeholder="Brief description of this service..."
                  placeholderTextColor="#9CA3AF"
                  value={serviceForm.description}
                  onChangeText={(v) =>
                    setServiceForm({ ...serviceForm, description: v })
                  }
                  multiline
                  numberOfLines={3}
                  className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-5"
                  style={{ textAlignVertical: 'top', minHeight: 80 }}
                />

                <Button onPress={handleSaveService}>
                  {editingServiceIdx !== null
                    ? 'Update Service'
                    : 'Add Service'}
                </Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  // ========================================
  // Category Picker Modal
  // ========================================

  function renderCategoryPicker() {
    return (
      <Modal visible={showCategoryPicker} animationType="fade" transparent>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
          className="flex-1 bg-black/50 justify-center px-8"
        >
          <View className="bg-white rounded-2xl py-2 max-h-[400px]">
            <Text className="text-lg font-bold text-text-primary px-4 py-3 border-b border-bg-alt">
              Select Category
            </Text>
            <ScrollView>
              {SERVICE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    setServiceForm({ ...serviceForm, category: cat });
                    setShowCategoryPicker(false);
                  }}
                  className={`px-4 py-3 border-b border-bg-alt flex-row items-center justify-between ${
                    serviceForm.category === cat ? 'bg-primary/10' : ''
                  }`}
                >
                  <Text
                    className={`text-base ${
                      serviceForm.category === cat
                        ? 'text-primary font-semibold'
                        : 'text-text-primary'
                    }`}
                  >
                    {SERVICE_CATEGORY_LABELS[cat]}
                  </Text>
                  {serviceForm.category === cat && (
                    <Ionicons name="checkmark" size={20} color="#00897B" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }

  // ========================================
  // Time Picker Modal
  // ========================================

  function renderTimePicker() {
    const currentTime = timePickerTarget
      ? workingHours[timePickerTarget.dayIdx]?.[timePickerTarget.field] || ''
      : '';

    return (
      <Modal visible={showTimePicker} animationType="fade" transparent>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setShowTimePicker(false);
            setTimePickerTarget(null);
          }}
          className="flex-1 bg-black/50 justify-center px-8"
        >
          <View className="bg-white rounded-2xl py-2 max-h-[400px]">
            <Text className="text-lg font-bold text-text-primary px-4 py-3 border-b border-bg-alt">
              Select Time
            </Text>
            <ScrollView>
              {TIME_OPTIONS.map((time) => (
                <TouchableOpacity
                  key={time}
                  onPress={() => selectTime(time)}
                  className={`px-4 py-3 border-b border-bg-alt flex-row items-center justify-between ${
                    currentTime === time ? 'bg-primary/10' : ''
                  }`}
                >
                  <Text
                    className={`text-base ${
                      currentTime === time
                        ? 'text-primary font-semibold'
                        : 'text-text-primary'
                    }`}
                  >
                    {formatTime12(time)}
                  </Text>
                  {currentTime === time && (
                    <Ionicons name="checkmark" size={20} color="#00897B" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }
};
