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
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenHeader } from '../common/ScreenHeader';
import { useAlert } from '../ui/CustomAlert';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchGroomerOwnAppointments,
  updateGroomerAppointmentStatus,
  GroomerAppointment,
} from '../../store/slices/groomerAppointmentSlice';

// ========================================
// Constants
// ========================================

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  pending: {
    label: 'Pending',
    color: '#F59E0B',
    bg: 'bg-yellow-100',
    icon: 'time-outline',
  },
  confirmed: {
    label: 'Confirmed',
    color: '#10B981',
    bg: 'bg-green-100',
    icon: 'checkmark-circle-outline',
  },
  completed: {
    label: 'Completed',
    color: '#8B5CF6',
    bg: 'bg-purple-100',
    icon: 'ribbon-outline',
  },
  cancelled: {
    label: 'Cancelled',
    color: '#EF4444',
    bg: 'bg-red-100',
    icon: 'close-circle-outline',
  },
  'no-show': {
    label: 'No Show',
    color: '#6B7280',
    bg: 'bg-gray-100',
    icon: 'eye-off-outline',
  },
};

const SPECIES_ICONS: Record<string, string> = {
  dog: 'dog',
  cat: 'cat',
  bird: 'bird',
  fish: 'fish',
  rabbit: 'rabbit',
  hamster: 'rodent',
  turtle: 'turtle',
};

type FilterTab = 'pending' | 'confirmed' | 'all' | 'history';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'all', label: 'Today' },
  { key: 'history', label: 'History' },
];

// ========================================
// Component
// ========================================

export const GroomerAppointmentsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { groomerAppointments, loading } = useSelector(
    (state: RootState) => state.groomerAppointments,
  );

  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadAppointments = useCallback(
    (tab: FilterTab) => {
      switch (tab) {
        case 'pending':
          dispatch(fetchGroomerOwnAppointments({ status: 'pending' }));
          break;
        case 'confirmed':
          dispatch(fetchGroomerOwnAppointments({ status: 'confirmed' }));
          break;
        case 'all':
          dispatch(fetchGroomerOwnAppointments({ date: todayStr }));
          break;
        case 'history':
          dispatch(fetchGroomerOwnAppointments({}));
          break;
      }
    },
    [dispatch, todayStr],
  );

  useEffect(() => {
    loadAppointments(activeTab);
  }, [activeTab, loadAppointments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAppointments(activeTab);
    setRefreshing(false);
  }, [loadAppointments, activeTab]);

  // ---- Actions ----

  const handleConfirm = (appointment: GroomerAppointment) => {
    showAlert({
      title: 'Confirm Appointment',
      message: `Confirm grooming appointment for ${appointment.pet?.name || 'pet'} on ${formatDate(appointment.date)} at ${appointment.timeSlot.start}?`,
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await dispatch(
                updateGroomerAppointmentStatus({
                  appointmentId: appointment._id,
                  status: 'confirmed',
                }),
              ).unwrap();
              loadAppointments(activeTab);
            } catch (e: any) {
              showAlert({
                title: 'Error',
                message: e || 'Failed to confirm',
                variant: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const handleCancel = (appointment: GroomerAppointment) => {
    showAlert({
      title: 'Cancel Appointment',
      message: 'Are you sure you want to cancel this appointment?',
      variant: 'confirm',
      buttons: [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Appointment',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(
                updateGroomerAppointmentStatus({
                  appointmentId: appointment._id,
                  status: 'cancelled',
                  cancellationReason: 'Cancelled by groomer',
                }),
              ).unwrap();
              loadAppointments(activeTab);
            } catch (e: any) {
              showAlert({
                title: 'Error',
                message: e || 'Failed to cancel',
                variant: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const handleComplete = (appointment: GroomerAppointment) => {
    showAlert({
      title: 'Complete Appointment',
      message: `Mark grooming for ${appointment.pet?.name || 'pet'} as completed?`,
      variant: 'confirm',
      buttons: [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await dispatch(
                updateGroomerAppointmentStatus({
                  appointmentId: appointment._id,
                  status: 'completed',
                }),
              ).unwrap();
              loadAppointments(activeTab);
            } catch (e: any) {
              showAlert({
                title: 'Error',
                message: e || 'Failed to complete',
                variant: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const handleNoShow = (appointment: GroomerAppointment) => {
    showAlert({
      title: 'Mark No Show',
      message: `Mark ${appointment.user?.name || 'the client'} as a no-show?`,
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'No Show',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(
                updateGroomerAppointmentStatus({
                  appointmentId: appointment._id,
                  status: 'no-show',
                }),
              ).unwrap();
              loadAppointments(activeTab);
            } catch (e: any) {
              showAlert({
                title: 'Error',
                message: e || 'Failed to update',
                variant: 'error',
              });
            }
          },
        },
      ],
    });
  };

  // ---- Helpers ----

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime12 = (time: string) => {
    const [hStr, mStr] = time.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${mStr} ${ampm}`;
  };

  // ---- Render ----

  const renderAppointmentCard = (appt: GroomerAppointment) => {
    const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
    const speciesIcon = SPECIES_ICONS[appt.pet?.species] || 'paw';

    return (
      <View
        key={appt._id}
        className="bg-white rounded-2xl mx-4 mb-3 border border-gray-100 shadow-sm overflow-hidden"
      >
        {/* Status Bar */}
        <View
          className="px-4 py-2 flex-row items-center justify-between"
          style={{ backgroundColor: statusConf.color + '15' }}
        >
          <View className="flex-row items-center">
            <Ionicons
              name={statusConf.icon}
              size={16}
              color={statusConf.color}
            />
            <Text
              className="text-xs font-bold ml-1"
              style={{ color: statusConf.color }}
            >
              {statusConf.label}
            </Text>
          </View>
          <Text className="text-xs text-text-muted">
            {formatDate(appt.date)} • {formatTime12(appt.timeSlot.start)}
          </Text>
        </View>

        {/* Content */}
        <View className="p-4">
          {/* Pet + Owner Row */}
          <View className="flex-row items-center mb-3">
            <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-3">
              <MaterialCommunityIcons
                name={speciesIcon as any}
                size={24}
                color="#00897B"
              />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-text-primary">
                {appt.pet?.name || 'Unknown Pet'}
              </Text>
              <Text className="text-xs text-text-muted">
                {appt.pet?.species
                  ? appt.pet.species.charAt(0).toUpperCase() +
                    appt.pet.species.slice(1)
                  : ''}{' '}
                {appt.pet?.breed ? `• ${appt.pet.breed}` : ''}
              </Text>
            </View>
            {/* Owner avatar */}
            <TouchableOpacity
              className="items-center"
              onPress={() => {
                if (appt.user?._id) {
                  router.push({
                    pathname: '/profile-modal',
                    params: { userId: appt.user._id },
                  });
                }
              }}
            >
              {appt.user?.profileImage ? (
                <Image
                  source={{ uri: appt.user.profileImage }}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                />
              ) : (
                <View className="w-9 h-9 rounded-full bg-gray-200 items-center justify-center">
                  <Ionicons name="person" size={18} color="#6B7280" />
                </View>
              )}
              <Text
                className="text-[10px] text-text-muted mt-0.5"
                numberOfLines={1}
              >
                {appt.user?.name?.split(' ')[0] || 'Owner'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Service */}
          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons
              name="content-cut"
              size={14}
              color="#6B7280"
            />
            <Text className="text-sm text-text-primary ml-1.5 font-medium">
              {appt.service?.name || 'Grooming Service'}
            </Text>
            {appt.service?.price != null && (
              <Text className="text-sm text-primary font-bold ml-auto">
                P${appt.service.price}
              </Text>
            )}
          </View>

          {appt.reason ? (
            <View className="flex-row items-start mb-2">
              <Ionicons
                name="chatbubble-outline"
                size={13}
                color="#6B7280"
                style={{ marginTop: 2 }}
              />
              <Text
                className="text-xs text-text-muted ml-1.5 flex-1"
                numberOfLines={2}
              >
                {appt.reason}
              </Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          {appt.status === 'pending' && (
            <View className="flex-row gap-2 mt-3 pt-3 border-t border-gray-100">
              <TouchableOpacity
                onPress={() => handleConfirm(appt)}
                className="flex-1 bg-green-500 py-2.5 rounded-xl items-center flex-row justify-center"
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text className="text-white font-semibold text-sm ml-1">
                  Confirm
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleCancel(appt)}
                className="flex-1 bg-red-50 py-2.5 rounded-xl items-center flex-row justify-center border border-red-200"
              >
                <Ionicons name="close" size={16} color="#EF4444" />
                <Text className="text-red-500 font-semibold text-sm ml-1">
                  Decline
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {appt.status === 'confirmed' && (
            <View className="flex-row gap-2 mt-3 pt-3 border-t border-gray-100">
              <TouchableOpacity
                onPress={() => handleComplete(appt)}
                className="flex-1 bg-primary py-2.5 rounded-xl items-center flex-row justify-center"
              >
                <Ionicons name="checkmark-done" size={16} color="#fff" />
                <Text className="text-white font-semibold text-sm ml-1">
                  Complete
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleNoShow(appt)}
                className="bg-gray-100 py-2.5 px-3 rounded-xl items-center justify-center"
              >
                <Ionicons name="eye-off-outline" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader
        title="Appointments"
        onBack={() => router.back()}
        rightAction={
          <TouchableOpacity onPress={() => router.push('/groomer-clients')}>
            <Ionicons name="people-outline" size={22} color="#00897B" />
          </TouchableOpacity>
        }
      />

      {/* Filter Tabs */}
      <View className="flex-row px-4 py-2 bg-white border-b border-gray-100">
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 items-center rounded-lg mx-1 ${
              activeTab === tab.key ? 'bg-primary' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                activeTab === tab.key ? 'text-white' : 'text-text-muted'
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && groomerAppointments.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DB6AC" />
          <Text className="text-text-muted mt-3">Loading appointments...</Text>
        </View>
      ) : groomerAppointments.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
          <Text className="text-lg text-text-muted mt-4 text-center">
            No {activeTab === 'all' ? "today's" : activeTab} appointments
          </Text>
          <Text className="text-sm text-text-muted mt-1 text-center">
            {activeTab === 'pending'
              ? 'New booking requests will appear here'
              : activeTab === 'confirmed'
                ? 'Confirmed appointments will appear here'
                : 'Check back later for updates'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingVertical: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4DB6AC"
            />
          }
        >
          {/* Summary stats for today */}
          {activeTab === 'all' && (
            <View className="flex-row px-4 mb-4 gap-3">
              {(['pending', 'confirmed', 'completed'] as const).map((s) => {
                const count = groomerAppointments.filter(
                  (a) => a.status === s,
                ).length;
                const conf = STATUS_CONFIG[s];
                return (
                  <View
                    key={s}
                    className="flex-1 rounded-xl p-3 items-center"
                    style={{ backgroundColor: conf.color + '15' }}
                  >
                    <Text
                      className="text-xl font-bold"
                      style={{ color: conf.color }}
                    >
                      {count}
                    </Text>
                    <Text className="text-[10px] text-text-muted mt-0.5">
                      {conf.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {groomerAppointments.map(renderAppointmentCard)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
