import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '../common/ScreenHeader';
import { Button } from '../common/Button';
import {
  fetchHealthRecords,
  createHealthRecord,
  deleteHealthRecord,
  HealthRecord,
} from '../../store/slices/healthRecordSlice';
import { RootState, AppDispatch } from '../../store/store';
import { useAlert } from '../ui/CustomAlert';

const RECORD_TYPES = [
  { value: 'all', label: 'All', icon: 'clipboard-list' },
  { value: 'vaccination', label: 'Vaccination', icon: 'needle' },
  { value: 'examination', label: 'Exam', icon: 'stethoscope' },
  { value: 'surgery', label: 'Surgery', icon: 'hospital-box' },
  { value: 'laboratory', label: 'Lab', icon: 'test-tube' },
  { value: 'prescription', label: 'Rx', icon: 'pill' },
  { value: 'dental', label: 'Dental', icon: 'tooth-outline' },
  { value: 'deworming', label: 'Deworm', icon: 'bug-outline' },
  { value: 'wellness', label: 'Wellness', icon: 'heart-pulse' },
  { value: 'emergency', label: 'Emergency', icon: 'ambulance' },
] as const;

const RECORD_ICON: Record<string, string> = {
  vaccination: 'needle',
  examination: 'stethoscope',
  surgery: 'hospital-box',
  laboratory: 'test-tube',
  prescription: 'pill',
  dental: 'tooth-outline',
  imaging: 'radioactive',
  emergency: 'ambulance',
  wellness: 'heart-pulse',
  deworming: 'bug-outline',
  allergy: 'alert-circle-outline',
  other: 'file-document-outline',
};

export const HealthRecordsScreen: React.FC = () => {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { records, loading } = useSelector(
    (state: RootState) => state.healthRecords,
  );
  const { pets } = useSelector((state: RootState) => state.pets);
  const pet = pets.find((p) => p._id === petId);
  const { showAlert } = useAlert();

  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetail, setShowDetail] = useState<HealthRecord | null>(null);

  // Add record form state
  const [recordType, setRecordType] = useState('vaccination');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [vetName, setVetName] = useState('');
  const [vetClinic, setVetClinic] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);

  // Vaccination-specific
  const [vaccineName, setVaccineName] = useState('');
  const [nextDueDate, setNextDueDate] = useState<Date | null>(null);
  const [showNextDuePicker, setShowNextDuePicker] = useState(false);

  // Cost
  const [costAmount, setCostAmount] = useState('');

  const formScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (petId) {
      dispatch(fetchHealthRecords({ petId }));
    }
  }, [petId, dispatch]);

  const filteredRecords = useMemo(() => {
    const sorted = [...records].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    if (filter === 'all') return sorted;
    return sorted.filter((r) => r.recordType === filter);
  }, [records, filter]);

  const resetForm = () => {
    setRecordType('vaccination');
    setTitle('');
    setDescription('');
    setDate(new Date());
    setVetName('');
    setVetClinic('');
    setNotes('');
    setVaccineName('');
    setNextDueDate(null);
    setCostAmount('');
  };

  const handleAddRecord = async () => {
    if (!title.trim()) {
      showAlert({
        title: 'Error',
        message: 'Please enter a title',
        variant: 'warning',
      });
      return;
    }
    if (!petId) return;
    setAdding(true);

    try {
      const data: any = {
        recordType,
        title: title.trim(),
        description: description.trim(),
        date: date.toISOString(),
        notes: notes.trim(),
      };

      if (vetName.trim() || vetClinic.trim()) {
        data.veterinarian = {
          name: vetName.trim(),
          clinic: vetClinic.trim(),
        };
      }

      if (costAmount) {
        data.cost = { amount: parseFloat(costAmount), currency: 'USD' };
      }

      // Vaccination fields
      if (recordType === 'vaccination') {
        data.vaccination = {
          vaccineName: vaccineName.trim() || title.trim(),
          nextDueDate: nextDueDate ? nextDueDate.toISOString() : null,
        };
      }

      await dispatch(createHealthRecord({ petId, data })).unwrap();
      setShowAddModal(false);
      resetForm();
      dispatch(fetchHealthRecords({ petId }));
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to add record',
        variant: 'error',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRecord = (recordId: string) => {
    if (!petId) return;
    showAlert({
      title: 'Delete Record',
      message: 'Are you sure you want to delete this record?',
      variant: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await dispatch(deleteHealthRecord({ petId, recordId })).unwrap();
              setShowDetail(null);
            } catch (err: any) {
              showAlert({
                title: 'Error',
                message: err || 'Failed to delete',
                variant: 'error',
              });
            }
          },
          style: 'destructive',
        },
      ],
    });
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader
        title={pet ? `${pet.name}'s Records` : 'Health Records'}
        rightAction={
          <TouchableOpacity onPress={() => setShowAddModal(true)}>
            <Ionicons name="add-circle-outline" size={24} color="#00897B" />
          </TouchableOpacity>
        }
      />

      {/* Filter Tabs */}
      <View className="bg-white border-b border-bg-alt">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        >
          {RECORD_TYPES.map((rt) => (
            <TouchableOpacity
              key={rt.value}
              onPress={() => setFilter(rt.value)}
              className={`px-3 py-2 rounded-full mr-2 flex-row items-center ${
                filter === rt.value ? 'bg-primary' : 'bg-gray-100'
              }`}
            >
              <MaterialCommunityIcons
                name={rt.icon as any}
                size={14}
                color={filter === rt.value ? '#FFFFFF' : '#6B7280'}
              />
              <Text
                className={`text-xs font-medium ml-1 ${
                  filter === rt.value ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {rt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Records List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00897B" size="large" />
        </View>
      ) : filteredRecords.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <MaterialCommunityIcons
            name="clipboard-text-outline"
            size={56}
            color="#D1D5DB"
          />
          <Text className="text-lg text-text-muted mt-3 text-center">
            No health records yet
          </Text>
          <Text className="text-sm text-text-muted mt-1 text-center">
            Tap + to add your pet's first health record
          </Text>
          <View className="mt-4 w-48">
            <Button onPress={() => setShowAddModal(true)}>Add Record</Button>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {filteredRecords.map((rec) => (
            <TouchableOpacity
              key={rec._id}
              onPress={() => setShowDetail(rec)}
              className="bg-white rounded-xl p-4 mb-3 border border-bg-alt"
            >
              <View className="flex-row items-start">
                <View className="w-10 h-10 rounded-full bg-primary-light/20 items-center justify-center mr-3 mt-0.5">
                  <MaterialCommunityIcons
                    name={
                      (RECORD_ICON[rec.recordType] ||
                        'file-document-outline') as any
                    }
                    size={20}
                    color="#00897B"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-text-primary">
                    {rec.title}
                  </Text>
                  <Text className="text-xs text-text-muted capitalize mt-0.5">
                    {rec.recordType} · {formatDate(rec.date)}
                  </Text>
                  {rec.description ? (
                    <Text
                      className="text-sm text-text-secondary mt-1"
                      numberOfLines={2}
                    >
                      {rec.description}
                    </Text>
                  ) : null}
                  {rec.veterinarian?.name ? (
                    <View className="flex-row items-center mt-1.5">
                      <Ionicons
                        name="medkit-outline"
                        size={12}
                        color="#6B7280"
                      />
                      <Text className="text-xs text-text-muted ml-1">
                        Dr. {rec.veterinarian.name}
                        {rec.veterinarian.clinic
                          ? ` · ${rec.veterinarian.clinic}`
                          : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {rec.cost?.amount ? (
                  <Text className="text-sm font-medium text-text-secondary">
                    ${rec.cost.amount}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Record Detail Modal */}
      <Modal visible={!!showDetail} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[85%]">
            <ScrollView bounces={false} contentContainerStyle={{ padding: 24 }}>
              {showDetail && (
                <>
                  <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center mb-1">
                        <View className="w-8 h-8 rounded-full bg-primary-light/20 items-center justify-center mr-2">
                          <MaterialCommunityIcons
                            name={
                              (RECORD_ICON[showDetail.recordType] ||
                                'file-document-outline') as any
                            }
                            size={16}
                            color="#00897B"
                          />
                        </View>
                        <Text className="text-xs text-primary font-medium uppercase">
                          {showDetail.recordType}
                        </Text>
                      </View>
                      <Text className="text-xl font-bold text-text-primary">
                        {showDetail.title}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowDetail(null)}>
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row items-center mb-4">
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color="#6B7280"
                    />
                    <Text className="text-sm text-text-secondary ml-2">
                      {formatDate(showDetail.date)}
                    </Text>
                  </View>

                  {showDetail.description ? (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold text-text-primary mb-1">
                        Description
                      </Text>
                      <Text className="text-base text-text-secondary leading-6">
                        {showDetail.description}
                      </Text>
                    </View>
                  ) : null}

                  {showDetail.veterinarian?.name ? (
                    <View className="bg-gray-50 rounded-xl p-3 mb-4">
                      <Text className="text-sm font-semibold text-text-primary mb-1">
                        Veterinarian
                      </Text>
                      <Text className="text-sm text-text-secondary">
                        Dr. {showDetail.veterinarian.name}
                      </Text>
                      {showDetail.veterinarian.clinic ? (
                        <Text className="text-sm text-text-muted">
                          {showDetail.veterinarian.clinic}
                        </Text>
                      ) : null}
                      {showDetail.veterinarian.phone ? (
                        <Text className="text-sm text-text-muted">
                          {showDetail.veterinarian.phone}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Vaccination details */}
                  {showDetail.recordType === 'vaccination' &&
                  showDetail.vaccination ? (
                    <View className="bg-teal-50 rounded-xl p-3 mb-4">
                      <Text className="text-sm font-semibold text-text-primary mb-2">
                        Vaccination Details
                      </Text>
                      {showDetail.vaccination.vaccineName ? (
                        <DetailRow
                          label="Vaccine"
                          value={showDetail.vaccination.vaccineName}
                        />
                      ) : null}
                      {showDetail.vaccination.manufacturer ? (
                        <DetailRow
                          label="Manufacturer"
                          value={showDetail.vaccination.manufacturer}
                        />
                      ) : null}
                      {showDetail.vaccination.lotNumber ? (
                        <DetailRow
                          label="Lot #"
                          value={showDetail.vaccination.lotNumber}
                        />
                      ) : null}
                      {showDetail.vaccination.dosage ? (
                        <DetailRow
                          label="Dosage"
                          value={showDetail.vaccination.dosage}
                        />
                      ) : null}
                      {showDetail.vaccination.nextDueDate ? (
                        <DetailRow
                          label="Next Due"
                          value={formatDate(showDetail.vaccination.nextDueDate)}
                        />
                      ) : null}
                    </View>
                  ) : null}

                  {/* Examination details */}
                  {showDetail.recordType === 'examination' &&
                  showDetail.examination ? (
                    <View className="bg-blue-50 rounded-xl p-3 mb-4">
                      <Text className="text-sm font-semibold text-text-primary mb-2">
                        Examination Vitals
                      </Text>
                      {showDetail.examination.weight ? (
                        <DetailRow
                          label="Weight"
                          value={`${showDetail.examination.weight} kg`}
                        />
                      ) : null}
                      {showDetail.examination.temperature ? (
                        <DetailRow
                          label="Temp"
                          value={`${showDetail.examination.temperature}°C`}
                        />
                      ) : null}
                      {showDetail.examination.heartRate ? (
                        <DetailRow
                          label="Heart Rate"
                          value={`${showDetail.examination.heartRate} bpm`}
                        />
                      ) : null}
                      {showDetail.examination.findings ? (
                        <View className="mt-1">
                          <Text className="text-xs text-text-muted">
                            Findings
                          </Text>
                          <Text className="text-sm text-text-secondary">
                            {showDetail.examination.findings}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {showDetail.notes ? (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold text-text-primary mb-1">
                        Notes
                      </Text>
                      <Text className="text-sm text-text-secondary leading-5">
                        {showDetail.notes}
                      </Text>
                    </View>
                  ) : null}

                  {showDetail.cost?.amount ? (
                    <View className="flex-row items-center mb-4">
                      <Ionicons name="cash-outline" size={16} color="#6B7280" />
                      <Text className="text-sm text-text-secondary ml-2">
                        Cost: ${showDetail.cost.amount}{' '}
                        {showDetail.cost.currency}
                      </Text>
                    </View>
                  ) : null}

                  {showDetail.followUpDate ? (
                    <View className="bg-amber-50 rounded-xl p-3 mb-4">
                      <View className="flex-row items-center">
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color="#F59E0B"
                        />
                        <Text className="text-sm text-amber-700 ml-2">
                          Follow-up: {formatDate(showDetail.followUpDate)}
                        </Text>
                      </View>
                      {showDetail.followUpNotes ? (
                        <Text className="text-sm text-amber-600 mt-1">
                          {showDetail.followUpNotes}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <TouchableOpacity
                    onPress={() => handleDeleteRecord(showDetail._id)}
                    className="flex-row items-center justify-center py-3 mt-2"
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    <Text className="text-error font-medium ml-2">
                      Delete Record
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Record Modal — full-screen so Android keyboard resize works */}
      <Modal visible={showAddModal} animationType="slide">
        <SafeAreaView className="flex-1 bg-white">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <View className="flex-row justify-between items-center px-6 pt-4 pb-3 border-b border-gray-100">
              <Text className="text-xl font-bold text-text-primary">
                New Health Record
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="p-1"
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={formScrollRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 16,
                paddingBottom: 40,
              }}
            >
              {/* Record Type */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Type *
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                {RECORD_TYPES.filter((rt) => rt.value !== 'all').map((rt) => (
                  <TouchableOpacity
                    key={rt.value}
                    onPress={() => setRecordType(rt.value)}
                    className={`px-3 py-2 rounded-full mr-2 flex-row items-center border ${
                      recordType === rt.value
                        ? 'bg-primary border-primary'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <MaterialCommunityIcons
                      name={rt.icon as any}
                      size={14}
                      color={recordType === rt.value ? '#FFFFFF' : '#00897B'}
                    />
                    <Text
                      className={`text-xs font-medium ml-1 ${
                        recordType === rt.value
                          ? 'text-white'
                          : 'text-text-primary'
                      }`}
                    >
                      {rt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Title */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Title *
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={
                  recordType === 'vaccination'
                    ? 'e.g. Rabies Vaccination'
                    : recordType === 'examination'
                      ? 'e.g. Annual Checkup'
                      : 'Record title'
                }
                placeholderTextColor="#9CA3AF"
                className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
              />

              {/* Date */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Date *
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 mb-4 flex-row items-center"
              >
                <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                <Text className="text-base text-text-primary ml-2">
                  {date.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
              {Platform.OS === 'ios' && showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_, d) => {
                    setShowDatePicker(false);
                    if (d) setDate(d);
                  }}
                />
              )}

              {/* Description */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the record..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={2}
                className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
                style={{ textAlignVertical: 'top', minHeight: 60 }}
              />

              {/* Vaccination-specific fields */}
              {recordType === 'vaccination' && (
                <>
                  <Text className="text-sm font-semibold text-text-primary mb-2">
                    Vaccine Name
                  </Text>
                  <TextInput
                    value={vaccineName}
                    onChangeText={setVaccineName}
                    placeholder="e.g. DHLPP, Rabies"
                    placeholderTextColor="#9CA3AF"
                    className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
                  />

                  <Text className="text-sm font-semibold text-text-primary mb-2">
                    Next Due Date
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowNextDuePicker(true)}
                    className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 mb-4 flex-row items-center"
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#6B7280"
                    />
                    <Text className="text-base text-text-primary ml-2">
                      {nextDueDate
                        ? nextDueDate.toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Select next due date'}
                    </Text>
                  </TouchableOpacity>
                  {Platform.OS === 'ios' && showNextDuePicker && (
                    <DateTimePicker
                      value={nextDueDate || new Date()}
                      mode="date"
                      display="spinner"
                      minimumDate={new Date()}
                      onChange={(_, d) => {
                        setShowNextDuePicker(false);
                        if (d) setNextDueDate(d);
                      }}
                    />
                  )}
                </>
              )}

              {/* Veterinarian */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Veterinarian
              </Text>
              <TextInput
                value={vetName}
                onChangeText={setVetName}
                placeholder="Vet's name"
                placeholderTextColor="#9CA3AF"
                className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-3"
              />
              <TextInput
                value={vetClinic}
                onChangeText={setVetClinic}
                placeholder="Clinic name"
                placeholderTextColor="#9CA3AF"
                className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
              />

              {/* Cost */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Cost ($)
              </Text>
              <TextInput
                value={costAmount}
                onChangeText={setCostAmount}
                placeholder="e.g. 75.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
              />

              {/* Notes */}
              <Text className="text-sm font-semibold text-text-primary mb-2">
                Notes
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={2}
                className="bg-gray-50 rounded-xl px-4 py-3 text-base text-text-primary border border-gray-200 mb-4"
                style={{ textAlignVertical: 'top', minHeight: 60 }}
              />

              <Button
                onPress={handleAddRecord}
                disabled={adding || !title.trim()}
              >
                {adding ? 'Adding...' : 'Add Record'}
              </Button>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Android DateTimePickers rendered outside Modals */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(_, d) => {
            setShowDatePicker(false);
            if (d) setDate(d);
          }}
        />
      )}
      {Platform.OS === 'android' && showNextDuePicker && (
        <DateTimePicker
          value={nextDueDate || new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, d) => {
            setShowNextDuePicker(false);
            if (d) setNextDueDate(d);
          }}
        />
      )}
    </SafeAreaView>
  );
};

/** Small helper component for detail rows */
const DetailRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <View className="flex-row justify-between py-0.5">
    <Text className="text-xs text-text-muted">{label}</Text>
    <Text className="text-sm text-text-primary font-medium">{value}</Text>
  </View>
);
