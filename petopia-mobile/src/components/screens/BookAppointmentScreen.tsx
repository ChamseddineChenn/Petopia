import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { ScreenHeader } from '../common/ScreenHeader';
import { useAlert } from '../ui/CustomAlert';
import { Button } from '../common/Button';
import { Avatar } from '../common/Avatar';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchAvailableSlots,
  bookAppointment,
  clearSlots,
  clearAppointmentError,
  TimeSlot,
} from '../../store/slices/appointmentSlice';
import {
  fetchVetClinicDetail,
  ClinicService,
} from '../../store/slices/vetSlice';
import type { Pet } from '../../store/slices/petSlice';

const PET_SPECIES_ICONS: Record<string, string> = {
  dog: 'dog',
  cat: 'cat',
  bird: 'bird',
  fish: 'fish',
  rabbit: 'rabbit',
  hamster: 'rodent',
  turtle: 'turtle',
  reptile: 'snake',
  exotic: 'paw',
  other: 'paw',
};

const SERVICE_ICONS: Record<string, string> = {
  consultation: 'stethoscope',
  vaccination: 'needle',
  surgery: 'hospital-box',
  dental: 'tooth-outline',
  grooming: 'content-cut',
  laboratory: 'test-tube',
  imaging: 'radioactive',
  emergency: 'ambulance',
  wellness: 'heart-pulse',
  deworming: 'bug-outline',
  nutrition: 'food-apple',
  behavioral: 'head-cog',
  other: 'medical-bag',
};

const DAY_NAME_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export const BookAppointmentScreen: React.FC = () => {
  const { clinicId } = useLocalSearchParams<{ clinicId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const scrollViewRef = useRef<ScrollView>(null);

  const { currentClinic: clinic } = useSelector(
    (state: RootState) => state.vets,
  );
  const { availableSlots, slotsLoading, loading, error } = useSelector(
    (state: RootState) => state.appointments,
  );
  const { pets } = useSelector((state: RootState) => state.pets);

  // ====== Form State ======
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedServiceIdx, setSelectedServiceIdx] = useState<number | null>(
    null,
  );
  const [reason, setReason] = useState('');
  const [step, setStep] = useState(1); // 1: date+slot, 2: pet+service, 3: confirm

  // ====== Scroll to end when keyboard shows on step 2 ======
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (step === 2) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });
    return () => sub.remove();
  }, [step]);

  // ====== Load clinic if not already in state ======
  useEffect(() => {
    if (clinicId && (!clinic || clinic._id !== clinicId)) {
      dispatch(fetchVetClinicDetail(clinicId));
    }
    return () => {
      dispatch(clearSlots());
      dispatch(clearAppointmentError());
    };
  }, [clinicId, dispatch]);

  // ====== Helper: format date as YYYY-MM-DD in local timezone ======
  const toLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // ====== Load slots when date changes ======
  useEffect(() => {
    if (clinicId) {
      const dateStr = toLocalDateStr(selectedDate);
      dispatch(fetchAvailableSlots({ clinicId, date: dateStr }));
      setSelectedSlot(null);
    }
  }, [clinicId, selectedDate, dispatch]);

  // ====== Auto-select pet if only one ======
  useEffect(() => {
    if (pets.length === 1) setSelectedPetId(pets[0]._id);
  }, [pets]);

  const todayStr = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const selectedDateStr = useMemo(
    () => toLocalDateStr(selectedDate),
    [selectedDate],
  );

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const selectedService =
    selectedServiceIdx !== null ? clinic?.services[selectedServiceIdx] : null;
  const selectedPet = pets.find((p) => p._id === selectedPetId);

  // ====== Date picker helpers ======
  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  const nextWeekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }, []);

  // ====== Book ======
  const handleBook = async () => {
    if (!selectedSlot || !selectedPetId || !clinic) return;

    const serviceName = selectedService
      ? selectedService.name
      : 'General Consultation';

    try {
      const result = await dispatch(
        bookAppointment({
          clinicId: clinic._id,
          petId: selectedPetId,
          date: selectedDateStr,
          timeSlot: { start: selectedSlot.start, end: selectedSlot.end },
          serviceName,
          reason: reason.trim() || undefined,
        }),
      ).unwrap();

      showAlert({
        title: 'Appointment Booked!',
        message: `Your appointment at ${clinic.clinicName} on ${formatDate(selectedDate)} at ${selectedSlot.start} has been requested. You'll be notified when the vet confirms.`,
        variant: 'success',
        buttons: [{ text: 'OK', onPress: () => router.back() }],
      });
    } catch (err: any) {
      showAlert({
        title: 'Booking Failed',
        message: err || 'Something went wrong',
        variant: 'error',
      });
    }
  };

  // ====== Validation ======
  const canProceedStep1 = selectedSlot !== null;
  const canProceedStep2 = selectedPetId !== null;
  const canBook = canProceedStep1 && canProceedStep2;

  if (!clinic) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
        <ScreenHeader title="Book Appointment" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00897B" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader title="Book Appointment" />

      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Clinic Info Banner */}
          <View className="mx-4 mt-3 mb-4 bg-white rounded-xl p-3 flex-row items-center border border-bg-alt">
            {clinic.logo ? (
              <Image
                source={{ uri: clinic.logo }}
                style={{ width: 44, height: 44, borderRadius: 10 }}
              />
            ) : (
              <View className="w-11 h-11 rounded-[10px] bg-primary-light/20 items-center justify-center">
                <Ionicons name="medkit" size={20} color="#00897B" />
              </View>
            )}
            <View className="flex-1 ml-3">
              <Text
                className="text-sm font-bold text-text-primary"
                numberOfLines={1}
              >
                {clinic.clinicName}
              </Text>
              <Text className="text-xs text-text-muted">
                {clinic.address.city} · {clinic.appointmentDuration} min slots
              </Text>
            </View>
          </View>

          {/* Step Indicator */}
          <View className="flex-row items-center justify-center mb-4 px-8">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <TouchableOpacity
                  onPress={() => {
                    if (s < step) setStep(s);
                  }}
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    step >= s ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  {step > s ? (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  ) : (
                    <Text
                      className={`text-sm font-bold ${
                        step >= s ? 'text-white' : 'text-text-muted'
                      }`}
                    >
                      {s}
                    </Text>
                  )}
                </TouchableOpacity>
                {s < 3 && (
                  <View
                    className={`flex-1 h-0.5 mx-2 ${
                      step > s ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </View>
          <Text className="text-center text-xs text-text-muted mb-4">
            {step === 1
              ? 'Select Date & Time'
              : step === 2
                ? 'Select Pet & Service'
                : 'Confirm Booking'}
          </Text>

          {/* ====== STEP 1: Date & Time ====== */}
          {step === 1 && (
            <View className="px-4">
              {/* Quick Date Selector */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Choose a Date
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                {nextWeekDays.map((d) => {
                  const isSelected = toLocalDateStr(d) === selectedDateStr;
                  const isToday =
                    toLocalDateStr(d) === toLocalDateStr(todayStr);
                  // Check if this day is a closed day
                  const dayName = DAY_NAME_MAP[d.getDay()];
                  const daySchedule = clinic?.workingHours?.find(
                    (wh: any) => wh.day === dayName,
                  );
                  const isClosed = daySchedule ? !daySchedule.isOpen : false;
                  return (
                    <TouchableOpacity
                      key={d.toISOString()}
                      onPress={() => !isClosed && setSelectedDate(d)}
                      disabled={isClosed}
                      className={`w-[60px] h-[72px] rounded-xl items-center justify-center mr-2 border ${
                        isClosed
                          ? 'bg-gray-100 border-gray-200 opacity-50'
                          : isSelected
                            ? 'bg-primary border-primary'
                            : 'bg-white border-bg-alt'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-medium ${
                          isClosed
                            ? 'text-gray-400'
                            : isSelected
                              ? 'text-white'
                              : 'text-text-muted'
                        }`}
                      >
                        {isToday
                          ? 'Today'
                          : d.toLocaleDateString('en-US', { weekday: 'short' })}
                      </Text>
                      <Text
                        className={`text-lg font-bold ${
                          isClosed
                            ? 'text-gray-400'
                            : isSelected
                              ? 'text-white'
                              : 'text-text-primary'
                        }`}
                      >
                        {d.getDate()}
                      </Text>
                      <Text
                        className={`text-[10px] ${
                          isClosed
                            ? 'text-gray-400'
                            : isSelected
                              ? 'text-white/80'
                              : 'text-text-muted'
                        }`}
                      >
                        {isClosed
                          ? 'Closed'
                          : d.toLocaleDateString('en-US', { month: 'short' })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time Slots */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Available Times
              </Text>

              {slotsLoading ? (
                <View className="items-center py-8">
                  <ActivityIndicator color="#00897B" />
                  <Text className="text-xs text-text-muted mt-2">
                    Loading available slots…
                  </Text>
                </View>
              ) : availableSlots.length === 0 ? (
                <View className="items-center py-8">
                  <Ionicons name="calendar-outline" size={36} color="#D1D5DB" />
                  <Text className="text-sm text-text-muted mt-2">
                    No available slots on this day
                  </Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot?.start === slot.start;
                    const isAvailable = slot.available !== false;
                    return (
                      <TouchableOpacity
                        key={slot.start}
                        onPress={() => isAvailable && setSelectedSlot(slot)}
                        disabled={!isAvailable}
                        className={`px-4 py-2.5 rounded-xl border ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : isAvailable
                              ? 'bg-white border-bg-alt'
                              : 'bg-gray-100 border-gray-200'
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            isSelected
                              ? 'text-white'
                              : isAvailable
                                ? 'text-text-primary'
                                : 'text-text-muted line-through'
                          }`}
                        >
                          {slot.start}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View className="mt-4">
                <Button onPress={() => setStep(2)} disabled={!canProceedStep1}>
                  Continue
                </Button>
              </View>
            </View>
          )}

          {/* ====== STEP 2: Pet & Service ====== */}
          {step === 2 && (
            <View className="px-4">
              {/* Pet Selector */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Select Your Pet
              </Text>
              {pets.length === 0 ? (
                <View className="items-center py-6 bg-white rounded-xl border border-bg-alt">
                  <Ionicons name="paw-outline" size={32} color="#D1D5DB" />
                  <Text className="text-sm text-text-muted mt-2">
                    No pets found. Add a pet first.
                  </Text>
                </View>
              ) : (
                <View className="mb-4">
                  {pets.map((pet: Pet) => {
                    const isSelected = selectedPetId === pet._id;
                    return (
                      <TouchableOpacity
                        key={pet._id}
                        onPress={() => setSelectedPetId(pet._id)}
                        activeOpacity={0.7}
                        className={`flex-row items-center p-3.5 rounded-2xl mb-2 border-2 ${
                          isSelected
                            ? 'bg-primary/5 border-primary'
                            : 'bg-white border-transparent'
                        }`}
                        style={
                          !isSelected ? { borderColor: '#E5E7EB' } : undefined
                        }
                      >
                        {/* Pet Image */}
                        {pet.profileImage ? (
                          <Image
                            source={{ uri: pet.profileImage }}
                            style={{ width: 52, height: 52, borderRadius: 16 }}
                          />
                        ) : (
                          <View className="w-[52px] h-[52px] rounded-2xl bg-primary-light/15 items-center justify-center">
                            <MaterialCommunityIcons
                              name={
                                (PET_SPECIES_ICONS[
                                  pet.species?.toLowerCase()
                                ] || 'paw') as any
                              }
                              size={24}
                              color="#00897B"
                            />
                          </View>
                        )}

                        {/* Pet Info */}
                        <View className="flex-1 ml-3">
                          <Text
                            className={`text-sm font-bold ${
                              isSelected
                                ? 'text-primary-dark'
                                : 'text-text-primary'
                            }`}
                            numberOfLines={1}
                          >
                            {pet.name}
                          </Text>
                          <Text
                            className="text-xs text-text-muted mt-0.5"
                            numberOfLines={1}
                          >
                            {pet.breed
                              ? `${pet.breed} · ${pet.species}`
                              : pet.species}
                            {pet.age ? ` · ${pet.age}` : ''}
                          </Text>
                        </View>

                        {/* Selection indicator */}
                        <View
                          className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-gray-300'
                          }`}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color="#FFF" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Service Selector */}
              {clinic.services.length > 0 && (
                <>
                  <Text className="text-sm font-semibold text-text-primary mb-2">
                    Select a Service (Optional)
                  </Text>
                  {clinic.services.map(
                    (service: ClinicService, idx: number) => {
                      const isSelected = selectedServiceIdx === idx;
                      return (
                        <TouchableOpacity
                          key={service._id || idx}
                          onPress={() =>
                            setSelectedServiceIdx(isSelected ? null : idx)
                          }
                          className={`flex-row items-center p-3 rounded-xl mb-2 border ${
                            isSelected
                              ? 'bg-primary/10 border-primary'
                              : 'bg-white border-bg-alt'
                          }`}
                        >
                          <View className="w-8 h-8 rounded-full bg-primary-light/20 items-center justify-center mr-3">
                            <MaterialCommunityIcons
                              name={
                                (SERVICE_ICONS[service.category] ||
                                  'medical-bag') as any
                              }
                              size={16}
                              color="#00897B"
                            />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-medium text-text-primary">
                              {service.name}
                            </Text>
                            <Text className="text-xs text-text-muted">
                              {service.duration} min
                              {service.price != null && ` · P$${service.price}`}
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color="#00897B"
                            />
                          )}
                        </TouchableOpacity>
                      );
                    },
                  )}
                </>
              )}

              {/* Reason */}
              <Text className="text-sm font-semibold text-text-primary mt-4 mb-2">
                Reason for Visit (Optional)
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Annual check-up, vaccination…"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                className="bg-white border border-bg-alt rounded-xl p-3 text-sm text-text-primary min-h-[80px]"
                textAlignVertical="top"
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
              />

              <View className="flex-row gap-3 mt-6">
                <TouchableOpacity
                  onPress={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 items-center"
                >
                  <Text className="text-sm font-semibold text-text-muted">
                    Back
                  </Text>
                </TouchableOpacity>
                <View className="flex-1">
                  <Button
                    onPress={() => setStep(3)}
                    disabled={!canProceedStep2}
                  >
                    Review
                  </Button>
                </View>
              </View>
            </View>
          )}

          {/* ====== STEP 3: Confirm ====== */}
          {step === 3 && (
            <View className="px-4">
              <View className="bg-white rounded-2xl p-5 border border-bg-alt">
                <Text className="text-base font-bold text-text-primary mb-4 text-center">
                  Booking Summary
                </Text>

                {/* Date & Time */}
                <View className="flex-row items-center mb-3">
                  <Ionicons name="calendar-outline" size={18} color="#00897B" />
                  <View className="ml-3">
                    <Text className="text-sm font-semibold text-text-primary">
                      {formatDate(selectedDate)}
                    </Text>
                    <Text className="text-xs text-text-muted">
                      {selectedSlot?.start} – {selectedSlot?.end}
                    </Text>
                  </View>
                </View>

                {/* Clinic */}
                <View className="flex-row items-center mb-3">
                  <Ionicons name="medkit-outline" size={18} color="#00897B" />
                  <View className="ml-3">
                    <Text className="text-sm font-semibold text-text-primary">
                      {clinic.clinicName}
                    </Text>
                    <Text className="text-xs text-text-muted">
                      {clinic.address.city}
                      {clinic.address.state ? `, ${clinic.address.state}` : ''}
                    </Text>
                  </View>
                </View>

                {/* Pet */}
                {selectedPet && (
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="paw-outline" size={18} color="#00897B" />
                    <View className="ml-3">
                      <Text className="text-sm font-semibold text-text-primary">
                        {selectedPet.name}
                      </Text>
                      <Text className="text-xs text-text-muted capitalize">
                        {selectedPet.species}
                        {selectedPet.breed ? ` · ${selectedPet.breed}` : ''}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Service */}
                <View className="flex-row items-center mb-3">
                  <MaterialCommunityIcons
                    name="medical-bag"
                    size={18}
                    color="#00897B"
                  />
                  <View className="ml-3">
                    <Text className="text-sm font-semibold text-text-primary">
                      {selectedService
                        ? selectedService.name
                        : 'General Consultation'}
                    </Text>
                    {selectedService && (
                      <Text className="text-xs text-text-muted">
                        {selectedService.duration} min
                        {selectedService.price != null &&
                          ` · P$${selectedService.price}`}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Reason */}
                {reason.trim() !== '' && (
                  <View className="flex-row items-start mb-3">
                    <Ionicons
                      name="chatbubble-outline"
                      size={18}
                      color="#00897B"
                    />
                    <Text className="text-sm text-text-secondary ml-3 flex-1">
                      {reason}
                    </Text>
                  </View>
                )}

                {/* Divider */}
                <View className="h-[1px] bg-bg-alt my-3" />

                {/* Price */}
                {selectedService?.price != null && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-text-muted">
                      Estimated Cost
                    </Text>
                    <Text className="text-lg font-bold text-primary">
                      P${selectedService.price}
                    </Text>
                  </View>
                )}
              </View>

              <View className="bg-amber-50 rounded-xl p-3 flex-row items-center mt-4 border border-amber-100">
                <Ionicons name="information-circle" size={18} color="#D97706" />
                <Text className="text-xs text-amber-800 ml-2 flex-1">
                  Your appointment will be in "Pending" status until the vet
                  confirms it.
                </Text>
              </View>

              <View className="flex-row gap-3 mt-6">
                <TouchableOpacity
                  onPress={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 items-center"
                >
                  <Text className="text-sm font-semibold text-text-muted">
                    Back
                  </Text>
                </TouchableOpacity>
                <View className="flex-1">
                  <Button onPress={handleBook} disabled={loading}>
                    {loading ? 'Booking…' : 'Confirm Booking'}
                  </Button>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Android date picker rendered outside ScrollView */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          minimumDate={todayStr}
          onChange={onDateChange}
        />
      )}
    </SafeAreaView>
  );
};
