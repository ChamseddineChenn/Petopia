import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '../common/ScreenHeader';
import { Button } from '../common/Button';
import { Avatar } from '../common/Avatar';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchVetClinicDetail,
  clearCurrentClinic,
  ClinicPhoto,
  ClinicService,
  WorkingHours,
} from '../../store/slices/vetSlice';
import { fetchReviews, createReview } from '../../store/slices/reviewSlice';
import type { Review } from '../../store/slices/reviewSlice';
import { API_BASE_URL } from '../../config';
import { startConversation } from '../../store/slices/chatSlice';
import { useAlert } from '../ui/CustomAlert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
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

/** Star rating display */
const StarRating: React.FC<{ rating: number; size?: number }> = ({
  rating,
  size = 16,
}) => {
  const stars = [];
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<Ionicons key={i} name="star" size={size} color="#F59E0B" />);
    } else if (i === full && half) {
      stars.push(
        <Ionicons key={i} name="star-half" size={size} color="#F59E0B" />,
      );
    } else {
      stars.push(
        <Ionicons key={i} name="star-outline" size={size} color="#D1D5DB" />,
      );
    }
  }
  return <View className="flex-row">{stars}</View>;
};

export const VetClinicDetailScreen: React.FC = () => {
  const { clinicId } = useLocalSearchParams<{ clinicId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { currentClinic: clinic, loading } = useSelector(
    (state: RootState) => state.vets,
  );
  const { reviews, ratingDistribution } = useSelector(
    (state: RootState) => state.reviews,
  );
  const { user, token } = useSelector((state: RootState) => state.auth);

  const [activeTab, setActiveTab] = useState<
    'about' | 'services' | 'reviews' | 'hours'
  >('about');
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [canReviewData, setCanReviewData] = useState<{
    canReview: boolean;
    hasReviewed: boolean;
    hasCompletedService: boolean;
    isOwner: boolean;
  } | null>(null);

  const checkCanReview = useCallback(async () => {
    if (!clinicId || !user) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/reviews/${clinicId}/can-review`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (data.success) setCanReviewData(data);
    } catch {}
  }, [clinicId, user, token]);

  useEffect(() => {
    if (clinicId) {
      dispatch(fetchVetClinicDetail(clinicId));
      dispatch(fetchReviews({ clinicId }));
      checkCanReview();
    }
    return () => {
      dispatch(clearCurrentClinic());
    };
  }, [clinicId, dispatch]);

  if (loading || !clinic) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
        <ScreenHeader title="Veterinary Clinic" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00897B" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = user?._id === clinic.owner._id;

  const handleCall = () => {
    Linking.openURL(`tel:${clinic.phone}`);
  };

  const handleBookAppointment = () => {
    router.push({
      pathname: '/book-appointment',
      params: { clinicId: clinic._id },
    });
  };

  const handleViewVetProfile = () => {
    // Navigate to vet's user profile
    router.push({
      pathname: '/profile-modal',
      params: { userId: clinic.owner._id },
    });
  };

  const openPhoto = (index: number) => {
    setPhotoIndex(index);
    setShowPhotoViewer(true);
  };

  // ====== TABS CONTENT ======

  const renderAbout = () => (
    <View className="px-4 pt-4">
      {/* Description */}
      {clinic.description ? (
        <View className="mb-5">
          <Text className="text-sm font-semibold text-text-primary mb-2">
            About
          </Text>
          <Text className="text-sm text-text-secondary leading-5">
            {clinic.description}
          </Text>
        </View>
      ) : null}

      {/* Specialists / Experience */}
      <View className="bg-white rounded-xl p-4 mb-4 border border-bg-alt">
        <View className="flex-row items-center mb-3">
          <View className="w-10 h-10 rounded-full bg-primary-light/20 items-center justify-center mr-3">
            {clinic.owner.profileImage ? (
              <Image
                source={{ uri: clinic.owner.profileImage }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            ) : (
              <Avatar initials={clinic.owner.name[0]} size="sm" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text-primary">
              Dr. {clinic.owner.name}
            </Text>
            {clinic.yearsOfExperience > 0 && (
              <Text className="text-xs text-text-muted">
                {clinic.yearsOfExperience} years of experience
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleViewVetProfile}
            className="bg-primary-light/20 px-3 py-1.5 rounded-full"
          >
            <Text className="text-xs text-primary-dark font-medium">
              View Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* Specializations */}
        {clinic.specializations.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mt-2">
            {clinic.specializations.map((spec, i) => (
              <View key={i} className="bg-gray-100 px-2.5 py-1 rounded-full">
                <Text className="text-xs text-text-secondary">{spec}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* License */}
      {clinic.licenseNumber ? (
        <View className="flex-row items-center mb-4 px-1">
          <Ionicons name="document-text-outline" size={14} color="#6B7280" />
          <Text className="text-xs text-text-muted ml-1.5">
            License: {clinic.licenseNumber}
          </Text>
        </View>
      ) : null}

      {/* Contact Info */}
      <View className="bg-white rounded-xl p-4 mb-4 border border-bg-alt">
        <Text className="text-sm font-semibold text-text-primary mb-3">
          Contact
        </Text>

        <TouchableOpacity
          onPress={handleCall}
          className="flex-row items-center mb-2.5"
        >
          <Ionicons name="call-outline" size={16} color="#00897B" />
          <Text className="text-sm text-primary ml-2">{clinic.phone}</Text>
        </TouchableOpacity>

        {clinic.email ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${clinic.email}`)}
            className="flex-row items-center mb-2.5"
          >
            <Ionicons name="mail-outline" size={16} color="#00897B" />
            <Text className="text-sm text-primary ml-2">{clinic.email}</Text>
          </TouchableOpacity>
        ) : null}

        {clinic.website ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(clinic.website)}
            className="flex-row items-center mb-2.5"
          >
            <Ionicons name="globe-outline" size={16} color="#00897B" />
            <Text className="text-sm text-primary ml-2" numberOfLines={1}>
              {clinic.website}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View className="flex-row items-center">
          <Ionicons name="location-outline" size={16} color="#6B7280" />
          <Text className="text-sm text-text-secondary ml-2 flex-1">
            {[
              clinic.address.street,
              clinic.address.city,
              clinic.address.state,
              clinic.address.country,
            ]
              .filter(Boolean)
              .join(', ')}
          </Text>
        </View>
      </View>

      {/* Capabilities Badges */}
      <View className="flex-row flex-wrap gap-2 mb-4">
        {clinic.emergencyAvailable && (
          <View className="bg-red-50 px-3 py-2 rounded-xl flex-row items-center border border-red-100">
            <Ionicons name="pulse" size={14} color="#EF4444" />
            <Text className="text-xs text-red-700 ml-1.5 font-medium">
              24/7 Emergency
            </Text>
          </View>
        )}
        {clinic.homeVisitAvailable && (
          <View className="bg-blue-50 px-3 py-2 rounded-xl flex-row items-center border border-blue-100">
            <Ionicons name="home-outline" size={14} color="#3B82F6" />
            <Text className="text-xs text-blue-700 ml-1.5 font-medium">
              Home Visit
            </Text>
          </View>
        )}
        {clinic.onlineConsultation && (
          <View className="bg-purple-50 px-3 py-2 rounded-xl flex-row items-center border border-purple-100">
            <Ionicons name="videocam-outline" size={14} color="#8B5CF6" />
            <Text className="text-xs text-purple-700 ml-1.5 font-medium">
              Online Consultation
            </Text>
          </View>
        )}
      </View>

      {/* Accepted Pets */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-text-primary mb-2">
          We Treat
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {clinic.acceptedPetTypes.map((type) => (
            <View
              key={type}
              className="bg-white px-3 py-2 rounded-xl flex-row items-center border border-bg-alt"
            >
              <MaterialCommunityIcons
                name={
                  ({
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
                  }[type] || 'paw') as any
                }
                size={16}
                color="#00897B"
              />
              <Text className="text-xs text-text-primary ml-1.5 capitalize font-medium">
                {type}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderServices = () => (
    <View className="px-4 pt-4">
      {clinic.services.length === 0 ? (
        <View className="items-center py-8">
          <MaterialCommunityIcons
            name="medical-bag"
            size={40}
            color="#D1D5DB"
          />
          <Text className="text-sm text-text-muted mt-2">
            No services listed yet
          </Text>
        </View>
      ) : (
        clinic.services.map((service: ClinicService) => (
          <View
            key={service._id}
            className="bg-white rounded-xl p-4 mb-3 border border-bg-alt"
          >
            <View className="flex-row items-start">
              <View className="w-9 h-9 rounded-full bg-primary-light/20 items-center justify-center mr-3 mt-0.5">
                <MaterialCommunityIcons
                  name={
                    (SERVICE_ICONS[service.category] || 'medical-bag') as any
                  }
                  size={18}
                  color="#00897B"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text-primary">
                  {service.name}
                </Text>
                <Text className="text-xs text-text-muted capitalize mt-0.5">
                  {service.category} · {service.duration} min
                </Text>
                {service.description ? (
                  <Text className="text-xs text-text-secondary mt-1">
                    {service.description}
                  </Text>
                ) : null}
              </View>
              {service.price !== null && (
                <Text className="text-sm font-bold text-primary">
                  P${service.price}
                </Text>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderReviews = () => {
    const total = clinic.totalReviews;
    return (
      <View className="px-4 pt-4">
        {/* Rating Summary */}
        <View className="bg-white rounded-xl p-4 mb-4 border border-bg-alt">
          <View className="flex-row items-center mb-3">
            <Text className="text-4xl font-bold text-text-primary mr-3">
              {clinic.averageRating.toFixed(1)}
            </Text>
            <View>
              <StarRating rating={clinic.averageRating} size={18} />
              <Text className="text-xs text-text-muted mt-1">
                {total} review{total !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Rating Distribution Bars */}
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingDistribution[star] || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <View key={star} className="flex-row items-center mb-1">
                <Text className="text-xs text-text-muted w-3">{star}</Text>
                <Ionicons name="star" size={10} color="#F59E0B" />
                <View className="flex-1 h-2 bg-gray-100 rounded-full mx-2">
                  <View
                    className="h-2 bg-amber-400 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </View>
                <Text className="text-xs text-text-muted w-6 text-right">
                  {count}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Review List */}
        {reviews.length === 0 ? (
          <View className="items-center py-6">
            <Ionicons name="chatbubbles-outline" size={40} color="#D1D5DB" />
            <Text className="text-sm text-text-muted mt-2">
              No reviews yet — be the first!
            </Text>
          </View>
        ) : (
          reviews.slice(0, 10).map((review: Review) => (
            <View
              key={review._id}
              className="bg-white rounded-xl p-4 mb-3 border border-bg-alt"
            >
              {/* User row */}
              <View className="flex-row items-center mb-2">
                {review.user.profileImage ? (
                  <Image
                    source={{ uri: review.user.profileImage }}
                    style={{ width: 32, height: 32, borderRadius: 16 }}
                  />
                ) : (
                  <Avatar initials={review.user.name[0]} size="sm" />
                )}
                <View className="flex-1 ml-2">
                  <Text className="text-sm font-semibold text-text-primary">
                    {review.user.name}
                  </Text>
                  <Text className="text-xs text-text-muted">
                    {new Date(review.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <StarRating rating={review.rating} size={12} />
              </View>

              {/* Title */}
              {review.title ? (
                <Text className="text-sm font-semibold text-text-primary mb-1">
                  {review.title}
                </Text>
              ) : null}

              {/* Comment */}
              <Text className="text-sm text-text-secondary leading-5">
                {review.comment}
              </Text>

              {/* Vet response */}
              {review.response?.text && (
                <View className="bg-gray-50 rounded-lg p-3 mt-2">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="chatbox" size={12} color="#00897B" />
                    <Text className="text-xs font-semibold text-primary ml-1">
                      Clinic Response
                    </Text>
                  </View>
                  <Text className="text-xs text-text-secondary">
                    {review.response.text}
                  </Text>
                </View>
              )}

              {/* Helpful */}
              <View className="flex-row items-center mt-2">
                <TouchableOpacity className="flex-row items-center">
                  <Ionicons
                    name="thumbs-up-outline"
                    size={14}
                    color="#6B7280"
                  />
                  <Text className="text-xs text-text-muted ml-1">
                    Helpful ({review.helpfulCount})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Write review button or status */}
        {!isOwner && canReviewData && (
          <View className="mt-2 mb-4">
            {canReviewData.canReview ? (
              <Button onPress={() => setShowReviewModal(true)}>
                Write a Review
              </Button>
            ) : canReviewData.hasReviewed ? (
              <View className="bg-green-50 rounded-xl p-4 flex-row items-center">
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                <Text className="text-sm text-green-700 ml-2 flex-1">
                  You've already reviewed this clinic
                </Text>
              </View>
            ) : !canReviewData.hasCompletedService ? (
              <View className="bg-amber-50 rounded-xl p-4 flex-row items-center">
                <Ionicons name="information-circle" size={20} color="#D97706" />
                <Text className="text-sm text-amber-700 ml-2 flex-1">
                  Complete an appointment to leave a review
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      showAlert({
        title: 'Rating Required',
        message: 'Please select a star rating.',
        variant: 'warning',
      });
      return;
    }
    if (!reviewComment.trim()) {
      showAlert({
        title: 'Comment Required',
        message: 'Please write a comment.',
        variant: 'warning',
      });
      return;
    }
    setSubmittingReview(true);
    try {
      await dispatch(
        createReview({
          clinicId: clinicId!,
          reviewData: {
            rating: reviewRating,
            title: reviewTitle.trim() || undefined,
            comment: reviewComment.trim(),
          },
        }),
      ).unwrap();
      setShowReviewModal(false);
      setReviewRating(0);
      setReviewTitle('');
      setReviewComment('');
      dispatch(fetchReviews({ clinicId: clinicId! }));
      dispatch(fetchVetClinicDetail(clinicId!));
      checkCanReview();
      showAlert({
        title: 'Thank You!',
        message: 'Your review has been submitted.',
        variant: 'success',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to submit review',
        variant: 'error',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderHours = () => (
    <View className="px-4 pt-4">
      <View className="bg-white rounded-xl p-4 border border-bg-alt">
        {clinic.workingHours.map((wh: WorkingHours) => {
          const today =
            [
              'sunday',
              'monday',
              'tuesday',
              'wednesday',
              'thursday',
              'friday',
              'saturday',
            ][new Date().getDay()] === wh.day;

          return (
            <View
              key={wh.day}
              className={`flex-row items-center justify-between py-2.5 ${
                today ? 'bg-primary-light/10 -mx-2 px-2 rounded-lg' : ''
              }`}
            >
              <Text
                className={`text-sm font-medium w-12 ${
                  today ? 'text-primary-dark font-bold' : 'text-text-primary'
                }`}
              >
                {DAY_LABELS[wh.day]}
              </Text>
              {wh.isOpen ? (
                <View className="flex-row items-center">
                  <Text className="text-sm text-text-secondary">
                    {wh.openTime} — {wh.closeTime}
                  </Text>
                  {wh.breakStart && wh.breakEnd && (
                    <Text className="text-xs text-text-muted ml-2">
                      (Break: {wh.breakStart}–{wh.breakEnd})
                    </Text>
                  )}
                </View>
              ) : (
                <Text className="text-sm text-red-500 font-medium">Closed</Text>
              )}
              {today && (
                <View className="bg-primary px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] text-white font-bold">
                    TODAY
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Text className="text-xs text-text-muted text-center mt-3">
        Appointment duration: {clinic.appointmentDuration} minutes
      </Text>
    </View>
  );

  const TABS = [
    { key: 'about', label: 'About' },
    { key: 'services', label: 'Services' },
    { key: 'reviews', label: `Reviews (${clinic.totalReviews})` },
    { key: 'hours', label: 'Hours' },
  ] as const;

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader
        title={clinic.clinicName}
        rightAction={
          isOwner ? (
            <TouchableOpacity onPress={() => router.push('/manage-clinic')}>
              <Ionicons name="create-outline" size={22} color="#00897B" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Photo Gallery */}
        {clinic.photos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {clinic.photos.map((photo: ClinicPhoto, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => openPhoto(idx)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: photo.url }}
                    style={{ width: SCREEN_WIDTH, height: 220 }}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View className="absolute bottom-7 right-3 bg-black/50 px-2 py-1 rounded-full">
              <Text className="text-xs text-white font-medium">
                {clinic.photos.length} photo
                {clinic.photos.length > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        ) : (
          <View className="h-[140px] bg-primary-light/20 items-center justify-center">
            <Ionicons name="medkit-outline" size={48} color="#4DB6AC" />
          </View>
        )}

        {/* Clinic Header Card */}
        <View className="px-4 -mt-4">
          <View className="bg-white rounded-2xl p-4 border border-bg-alt">
            <View className="flex-row items-center mb-2">
              <Text className="text-xl font-bold text-text-primary flex-1 mr-2">
                {clinic.clinicName}
              </Text>
              {clinic.isVerified && (
                <Ionicons name="checkmark-circle" size={20} color="#00897B" />
              )}
            </View>

            <View className="flex-row items-center mb-2">
              <StarRating rating={clinic.averageRating} size={16} />
              <Text className="text-sm text-text-muted ml-2">
                {clinic.averageRating.toFixed(1)} ({clinic.totalReviews}{' '}
                reviews)
              </Text>
            </View>

            <View className="flex-row items-center mb-3">
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text className="text-sm text-text-muted ml-1">
                {clinic.address.city}
                {clinic.address.state ? `, ${clinic.address.state}` : ''}
              </Text>
            </View>

            {/* Owner notice */}
            {isOwner && (
              <View className="bg-primary/10 rounded-xl p-3 mb-3 flex-row items-center">
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#00897B"
                />
                <Text className="text-xs text-primary-dark ml-2 flex-1 leading-4">
                  This is your clinic. Booking and messaging buttons are visible
                  to pet owners who visit this page.
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View className="flex-row gap-2">
              {!isOwner && (
                <View className="flex-1">
                  <Button onPress={handleBookAppointment}>
                    Book Appointment
                  </Button>
                </View>
              )}
              <TouchableOpacity
                onPress={handleCall}
                className="w-12 h-12 rounded-xl bg-primary-light/20 items-center justify-center"
              >
                <Ionicons name="call" size={20} color="#00897B" />
              </TouchableOpacity>
              {clinic.allowMessages && !isOwner && (
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const result = await dispatch(
                        startConversation({
                          recipientId: clinic.owner._id,
                          shopId: clinic._id,
                          shopType: 'clinic',
                        }),
                      ).unwrap();
                      router.push({
                        pathname: '/chat',
                        params: {
                          conversationId: result._id,
                          recipientId: clinic.owner._id,
                          recipientName: clinic.clinicName,
                          recipientImage: clinic.owner.profileImage || '',
                        },
                      });
                    } catch (err: any) {
                      showAlert({
                        title: 'Error',
                        message: err || 'Could not start conversation',
                        variant: 'error',
                      });
                    }
                  }}
                  className="w-12 h-12 rounded-xl bg-primary-light/20 items-center justify-center"
                >
                  <Ionicons name="chatbubble" size={20} color="#00897B" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Tab Bar */}
        <View className="mt-4 border-b border-bg-alt">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className={`pb-3 mr-6 ${
                  activeTab === tab.key ? 'border-b-2 border-primary' : ''
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    activeTab === tab.key ? 'text-primary' : 'text-text-muted'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        {activeTab === 'about' && renderAbout()}
        {activeTab === 'services' && renderServices()}
        {activeTab === 'reviews' && renderReviews()}
        {activeTab === 'hours' && renderHours()}
      </ScrollView>

      {/* Full-screen Photo Viewer */}
      <Modal visible={showPhotoViewer} animationType="fade" transparent>
        <View className="flex-1 bg-black">
          <SafeAreaView className="flex-1" edges={['top']}>
            <TouchableOpacity
              onPress={() => setShowPhotoViewer(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 items-center justify-center"
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <FlatList
              data={clinic.photos}
              horizontal
              pagingEnabled
              initialScrollIndex={photoIndex}
              showsHorizontalScrollIndicator={false}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              renderItem={({ item }) => (
                <View
                  style={{ width: SCREEN_WIDTH }}
                  className="flex-1 items-center justify-center"
                >
                  <Image
                    source={{ uri: item.url }}
                    style={{ width: SCREEN_WIDTH, height: '100%' }}
                    contentFit="contain"
                  />
                  {item.caption ? (
                    <View className="absolute bottom-8 left-4 right-4 bg-black/50 rounded-lg px-3 py-2">
                      <Text className="text-white text-sm text-center">
                        {item.caption}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
              keyExtractor={(_, index) => index.toString()}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReviewModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl max-h-[85%]">
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
                  <Text className="text-lg font-bold text-text-primary">
                    Write a Review
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowReviewModal(false)}
                    className="w-8 h-8 items-center justify-center rounded-full bg-gray-100"
                  >
                    <Ionicons name="close" size={18} color="#374151" />
                  </TouchableOpacity>
                </View>

                {/* Star Rating */}
                <View className="px-5 pb-4">
                  <Text className="text-sm font-medium text-text-secondary mb-2">
                    Your Rating
                  </Text>
                  <View className="flex-row gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setReviewRating(star)}
                        className="p-1"
                      >
                        <Ionicons
                          name={star <= reviewRating ? 'star' : 'star-outline'}
                          size={32}
                          color={star <= reviewRating ? '#F59E0B' : '#D1D5DB'}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Title */}
                <View className="px-5 pb-4">
                  <Text className="text-sm font-medium text-text-secondary mb-2">
                    Title (optional)
                  </Text>
                  <TextInput
                    value={reviewTitle}
                    onChangeText={setReviewTitle}
                    placeholder="Sum up your experience"
                    placeholderTextColor="#9CA3AF"
                    maxLength={100}
                    className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-text-primary border border-bg-alt"
                  />
                </View>

                {/* Comment */}
                <View className="px-5 pb-4">
                  <Text className="text-sm font-medium text-text-secondary mb-2">
                    Your Review
                  </Text>
                  <TextInput
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    placeholder="Tell others about your experience..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    maxLength={1000}
                    textAlignVertical="top"
                    className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-text-primary border border-bg-alt min-h-[100px]"
                  />
                </View>

                {/* Submit */}
                <View className="px-5 pb-8">
                  <Button
                    onPress={handleSubmitReview}
                    disabled={submittingReview}
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};
