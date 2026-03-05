import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../common/ScreenHeader';
import { useAlert } from '../ui/CustomAlert';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchMyAppointments,
  updateAppointmentStatus,
  Appointment,
} from '../../store/slices/appointmentSlice';
import {
  fetchMyGroomerAppointments,
  updateGroomerAppointmentStatus,
  GroomerAppointment,
} from '../../store/slices/groomerAppointmentSlice';

type CombinedAppointment = {
  type: 'vet' | 'groomer';
  data: Appointment | GroomerAppointment;
};

const STATUS_CONFIG: Record<string, { label: string; icon: string }> = {
  pending: { label: 'Pending', icon: 'time-outline' },
  confirmed: { label: 'Confirmed', icon: 'checkmark-circle-outline' },
  cancelled: { label: 'Cancelled', icon: 'close-circle-outline' },
  completed: { label: 'Completed', icon: 'checkmark-done-outline' },
  'no-show': { label: 'No Show', icon: 'eye-off-outline' },
};

type TabKey = 'upcoming' | 'past';

export const MyAppointmentsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  const { appointments: vetAppts, loading: vetLoading } = useSelector(
    (state: RootState) => state.appointments,
  );
  const { appointments: groomerAppts, loading: groomerLoading } = useSelector(
    (state: RootState) => state.groomerAppointments,
  );

  const loading = vetLoading || groomerLoading;

  const loadData = useCallback(() => {
    dispatch(fetchMyAppointments({}));
    dispatch(fetchMyGroomerAppointments({}));
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchMyAppointments({})),
      dispatch(fetchMyGroomerAppointments({})),
    ]);
    setRefreshing(false);
  }, [dispatch]);

  // Combine and sort appointments
  const allAppointments: CombinedAppointment[] = [
    ...vetAppts.map((a) => ({ type: 'vet' as const, data: a })),
    ...groomerAppts.map((a) => ({ type: 'groomer' as const, data: a })),
  ].sort((a, b) => {
    const dateA = a.data.date ? new Date(a.data.date).getTime() : 0;
    const dateB = b.data.date ? new Date(b.data.date).getTime() : 0;
    return dateB - dateA;
  });

  const now = new Date();
  const upcomingStatuses = ['pending', 'confirmed'];
  const pastStatuses = ['completed', 'cancelled', 'no-show'];

  const upcoming = allAppointments.filter((a) =>
    upcomingStatuses.includes(a.data.status),
  );
  const past = allAppointments.filter((a) =>
    pastStatuses.includes(a.data.status),
  );

  const displayed = activeTab === 'upcoming' ? upcoming : past;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const renderAppointmentCard = (item: CombinedAppointment, index: number) => {
    const appt = item.data;
    const statusCfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
    const isVet = item.type === 'vet';
    const vetAppt = isVet ? (appt as Appointment) : null;
    const groomerAppt = !isVet ? (appt as GroomerAppointment) : null;

    const providerName = isVet
      ? vetAppt?.clinic?.clinicName
      : groomerAppt?.shop?.shopName;
    const providerCity = isVet
      ? vetAppt?.clinic?.address?.city
      : groomerAppt?.shop?.address?.city;
    const providerLogo = isVet
      ? vetAppt?.clinic?.logo
      : groomerAppt?.shop?.logo;
    const petName = appt.pet?.name || 'Unknown Pet';
    const petSpecies = appt.pet?.species || '';
    const serviceName =
      appt.service && typeof appt.service === 'object'
        ? appt.service.name
        : (appt as any).serviceName || 'Appointment';

    return (
      <TouchableOpacity
        key={appt._id}
        activeOpacity={0.8}
        className="bg-white rounded-2xl border border-bg-alt mx-4 mb-3 overflow-hidden"
        onPress={() => {
          // Could navigate to detail in the future
        }}
      >
        {/* Top color strip */}
        <View
          className={`h-1 ${
            appt.status === 'confirmed'
              ? 'bg-blue-400'
              : appt.status === 'pending'
                ? 'bg-amber-400'
                : appt.status === 'completed'
                  ? 'bg-green-400'
                  : appt.status === 'cancelled'
                    ? 'bg-red-400'
                    : 'bg-gray-300'
          }`}
        />

        <View className="p-4">
          {/* Header: Type badge + Status */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View
                className={`px-2.5 py-1 rounded-full flex-row items-center ${
                  isVet ? 'bg-blue-50' : 'bg-purple-50'
                }`}
              >
                {isVet ? (
                  <Ionicons name="medkit" size={12} color="#3B82F6" />
                ) : (
                  <MaterialCommunityIcons
                    name="content-cut"
                    size={12}
                    color="#8B5CF6"
                  />
                )}
                <Text
                  className={`text-[11px] font-semibold ml-1 ${
                    isVet ? 'text-blue-600' : 'text-purple-600'
                  }`}
                >
                  {isVet ? 'Vet' : 'Grooming'}
                </Text>
              </View>
              {isToday(appt.date) && (
                <View className="bg-primary/10 px-2 py-0.5 rounded-full ml-2">
                  <Text className="text-[10px] font-bold text-primary">
                    TODAY
                  </Text>
                </View>
              )}
            </View>
            <View
              className={`px-2.5 py-1 rounded-full ${
                appt.status === 'pending'
                  ? 'bg-amber-50'
                  : appt.status === 'confirmed'
                    ? 'bg-blue-50'
                    : appt.status === 'cancelled'
                      ? 'bg-red-50'
                      : appt.status === 'completed'
                        ? 'bg-green-50'
                        : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-[11px] font-semibold ${
                  appt.status === 'pending'
                    ? 'text-amber-700'
                    : appt.status === 'confirmed'
                      ? 'text-blue-700'
                      : appt.status === 'cancelled'
                        ? 'text-red-700'
                        : appt.status === 'completed'
                          ? 'text-green-700'
                          : 'text-gray-700'
                }`}
              >
                {statusCfg.label}
              </Text>
            </View>
          </View>

          {/* Provider info */}
          <View className="flex-row items-center mb-3">
            {providerLogo ? (
              <Image
                source={{ uri: providerLogo }}
                style={{ width: 40, height: 40, borderRadius: 10 }}
              />
            ) : (
              <View className="w-10 h-10 rounded-[10px] bg-primary-light/20 items-center justify-center">
                {isVet ? (
                  <Ionicons name="medkit" size={18} color="#00897B" />
                ) : (
                  <MaterialCommunityIcons
                    name="content-cut"
                    size={18}
                    color="#00897B"
                  />
                )}
              </View>
            )}
            <View className="flex-1 ml-3">
              <Text
                className="text-sm font-bold text-text-primary"
                numberOfLines={1}
              >
                {providerName || 'Unknown'}
              </Text>
              {providerCity && (
                <Text className="text-xs text-text-muted">{providerCity}</Text>
              )}
            </View>
          </View>

          {/* Details row */}
          <View className="bg-bg-main/60 rounded-xl p-3">
            <View className="flex-row items-center mb-2">
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-text-secondary ml-2 font-medium">
                {formatDate(appt.date)}
              </Text>
              <View className="w-1 h-1 rounded-full bg-gray-300 mx-2" />
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-text-secondary ml-1 font-medium">
                {appt.timeSlot?.start} – {appt.timeSlot?.end}
              </Text>
            </View>

            <View className="flex-row items-center mb-2">
              <Ionicons name="paw-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-text-secondary ml-2">
                {petName}
                {petSpecies ? ` (${petSpecies})` : ''}
              </Text>
            </View>

            {serviceName && (
              <View className="flex-row items-center">
                <MaterialCommunityIcons
                  name={isVet ? 'stethoscope' : 'shower-head'}
                  size={14}
                  color="#6B7280"
                />
                <Text
                  className="text-xs text-text-secondary ml-2"
                  numberOfLines={1}
                >
                  {serviceName}
                </Text>
              </View>
            )}
          </View>

          {/* Cancel action for upcoming pending appointments */}
          {activeTab === 'upcoming' && appt.status === 'pending' && (
            <TouchableOpacity
              onPress={() =>
                showAlert({
                  title: 'Cancel Appointment',
                  message: `Are you sure you want to cancel this appointment at ${providerName}? Your reserved P$ will be refunded.`,
                  variant: 'confirm',
                  buttons: [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Yes, Cancel',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          if (item.type === 'vet') {
                            await dispatch(
                              updateAppointmentStatus({
                                appointmentId: appt._id,
                                status: 'cancelled',
                                cancellationReason: 'Cancelled by pet owner',
                              }),
                            ).unwrap();
                          } else {
                            await dispatch(
                              updateGroomerAppointmentStatus({
                                appointmentId: appt._id,
                                status: 'cancelled',
                                cancellationReason: 'Cancelled by pet owner',
                              }),
                            ).unwrap();
                          }
                          showAlert({
                            title: 'Cancelled',
                            message:
                              'Your appointment has been cancelled and your P$ have been refunded.',
                            variant: 'success',
                          });
                          loadData();
                        } catch (err: any) {
                          showAlert({
                            title: 'Error',
                            message:
                              err?.message || 'Failed to cancel appointment',
                            variant: 'error',
                          });
                        }
                      },
                    },
                  ],
                })
              }
              className="mt-3 py-2.5 rounded-xl border border-red-200 bg-red-50 items-center"
            >
              <Text className="text-xs font-semibold text-red-600">
                Cancel Appointment
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader title="My Appointments" />

      {/* Tabs */}
      <View className="flex-row mx-4 mt-2 mb-3 bg-gray-100 rounded-xl p-1">
        {(['upcoming', 'past'] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              activeTab === tab ? 'bg-white shadow-sm' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                activeTab === tab ? 'text-primary-dark' : 'text-text-muted'
              }`}
            >
              {tab === 'upcoming' ? 'Upcoming' : 'Past'}
            </Text>
            {tab === 'upcoming' && upcoming.length > 0 && (
              <View className="absolute -top-1 -right-1 bg-primary rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                <Text className="text-[10px] font-bold text-white">
                  {upcoming.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00897B" size="large" />
          <Text className="text-sm text-text-muted mt-3">
            Loading appointments…
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 4 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00897B"
              colors={['#00897B']}
            />
          }
        >
          {displayed.length === 0 ? (
            <View className="items-center justify-center py-20 px-8">
              <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
                <Ionicons
                  name={
                    activeTab === 'upcoming'
                      ? 'calendar-outline'
                      : 'archive-outline'
                  }
                  size={36}
                  color="#D1D5DB"
                />
              </View>
              <Text className="text-base font-semibold text-text-primary mb-1">
                {activeTab === 'upcoming'
                  ? 'No upcoming appointments'
                  : 'No past appointments'}
              </Text>
              <Text className="text-sm text-text-muted text-center">
                {activeTab === 'upcoming'
                  ? 'Book a vet or grooming appointment to see it here.'
                  : 'Your completed and cancelled appointments will appear here.'}
              </Text>
              {activeTab === 'upcoming' && (
                <View className="flex-row gap-3 mt-6">
                  <TouchableOpacity
                    onPress={() => router.push('/vet-list')}
                    className="bg-primary/10 px-4 py-2.5 rounded-xl flex-row items-center"
                  >
                    <Ionicons name="medkit-outline" size={16} color="#00897B" />
                    <Text className="text-sm font-semibold text-primary ml-2">
                      Find a Vet
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push('/groomer-list')}
                    className="bg-purple-50 px-4 py-2.5 rounded-xl flex-row items-center"
                  >
                    <MaterialCommunityIcons
                      name="content-cut"
                      size={16}
                      color="#8B5CF6"
                    />
                    <Text className="text-sm font-semibold text-purple-600 ml-2">
                      Find a Groomer
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            displayed.map((item, index) => renderAppointmentCard(item, index))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
