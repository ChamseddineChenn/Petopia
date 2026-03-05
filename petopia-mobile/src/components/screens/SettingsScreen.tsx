import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import {
  updateProfile,
  changePassword,
  deleteAccount,
  logout,
} from '../../store/slices/authSlice';
import {
  fetchPrivacySettings,
  updatePrivacySettings,
} from '../../store/slices/profileSlice';
import { StorageService } from '../../services/StorageService';
import { RootState, AppDispatch } from '../../store/store';
import { useAlert } from '../ui/CustomAlert';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const api = axios.create({ timeout: 15000 });
const getAuthHeader = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

type SettingsSection =
  | 'main'
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'help'
  | 'about';

export const SettingsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ section?: string }>();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const { privacy } = useSelector((state: RootState) => state.profile);

  const [activeSection, setActiveSection] = useState<SettingsSection>('main');

  // Edit Profile state
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete Account state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Notification preferences (synced with backend — CASL compliance)
  const [pushEnabled, setPushEnabled] = useState(true);
  const [likesNotif, setLikesNotif] = useState(true);
  const [commentsNotif, setCommentsNotif] = useState(true);
  const [followNotif, setFollowNotif] = useState(true);
  const [messagesNotif, setMessagesNotif] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  // Privacy settings (synced with backend)
  const [profilePublic, setProfilePublic] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => {
    dispatch(fetchPrivacySettings());
    // Load notification preferences from backend (CASL compliance)
    loadNotificationPreferences();
  }, [dispatch]);

  const loadNotificationPreferences = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get(
        `${API_BASE_URL}/user/notification-preferences`,
        getAuthHeader(token),
      );
      if (res.data?.success && res.data.notificationPreferences) {
        const prefs = res.data.notificationPreferences;
        setPushEnabled(prefs.pushEnabled ?? true);
        setLikesNotif(prefs.likesEnabled ?? true);
        setCommentsNotif(prefs.commentsEnabled ?? true);
        setFollowNotif(prefs.followsEnabled ?? true);
        setMessagesNotif(prefs.messagesEnabled ?? true);
      }
    } catch (err) {
      // Silently fail — use defaults
    }
  }, [token]);

  const syncNotificationPreference = useCallback(
    async (updates: Record<string, boolean>) => {
      setNotifLoading(true);
      try {
        await api.put(
          `${API_BASE_URL}/user/notification-preferences`,
          updates,
          token ? getAuthHeader(token) : {},
        );
      } catch (err) {
        showAlert({
          title: 'Error',
          message: 'Failed to save notification preference',
          variant: 'error',
        });
      } finally {
        setNotifLoading(false);
      }
    },
    [showAlert],
  );

  const handleExportData = useCallback(async () => {
    setExportingData(true);
    try {
      const res = await api.get(
        `${API_BASE_URL}/user/export-data`,
        token ? getAuthHeader(token) : {},
      );
      if (res.data?.success) {
        showAlert({
          title: 'Data Export Ready',
          message:
            'Your data export has been generated successfully. The data includes all personal information Petopia holds about you, in compliance with PIPEDA.',
          variant: 'success',
        });
      }
    } catch (err: any) {
      showAlert({
        title: 'Export Failed',
        message:
          err?.response?.data?.message ||
          'Failed to export data. Please try again later.',
        variant: 'error',
      });
    } finally {
      setExportingData(false);
    }
  }, [showAlert]);

  useEffect(() => {
    if (privacy) {
      setProfilePublic(!privacy.isPrivate);
      setShowLocation(privacy.showLocation);
      setShowEmail(privacy.showEmail);
    }
  }, [privacy]);

  const handlePrivacyToggle = (field: string, value: boolean) => {
    const updates: Record<string, boolean> = {};
    if (field === 'profilePublic') {
      setProfilePublic(value);
      updates.isPrivate = !value;
    } else if (field === 'showLocation') {
      setShowLocation(value);
      updates.showLocation = value;
    } else if (field === 'showEmail') {
      setShowEmail(value);
      updates.showEmail = value;
    }
    dispatch(updatePrivacySettings(updates));
  };

  useEffect(() => {
    if (params.section) {
      setActiveSection(params.section as SettingsSection);
    }
  }, [params.section]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setLocation(user.location || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showAlert({
        title: 'Error',
        message: 'Name is required',
        variant: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      await dispatch(
        updateProfile({
          name: name.trim(),
          bio: bio.trim(),
          location: location.trim(),
          phone: phone.trim(),
        }),
      ).unwrap();
      showAlert({
        title: 'Success',
        message: 'Profile updated successfully',
        variant: 'success',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to update profile',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showAlert({
        title: 'Error',
        message: 'Please fill in all password fields',
        variant: 'warning',
      });
      return;
    }
    if (newPassword.length < 8) {
      showAlert({
        title: 'Error',
        message: 'New password must be at least 8 characters',
        variant: 'warning',
      });
      return;
    }
    if (
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      showAlert({
        title: 'Error',
        message: 'Password must include uppercase, lowercase, and a number',
        variant: 'warning',
      });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showAlert({
        title: 'Error',
        message: 'New passwords do not match',
        variant: 'warning',
      });
      return;
    }
    setChangingPassword(true);
    try {
      await dispatch(changePassword({ currentPassword, newPassword })).unwrap();
      showAlert({
        title: 'Success',
        message: 'Password changed successfully',
        variant: 'success',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to change password',
        variant: 'error',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    showAlert({
      title: 'Delete Account',
      message:
        'This action is permanent and cannot be undone. All your data, pets, and posts will be deleted.',
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            if (!deletePassword) {
              showAlert({
                title: 'Error',
                message: 'Please enter your password to confirm',
                variant: 'warning',
              });
              return;
            }
            showAlert({
              title: 'Final Confirmation',
              message: 'Are you absolutely sure? This cannot be undone.',
              variant: 'confirm',
              buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await dispatch(deleteAccount(deletePassword)).unwrap();
                      await StorageService.clear();
                      dispatch(logout());
                      router.replace('/auth');
                    } catch (err: any) {
                      showAlert({
                        title: 'Error',
                        message: err || 'Failed to delete account',
                        variant: 'error',
                      });
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            });
          },
        },
      ],
    });
  };

  const goBack = () => {
    if (activeSection === 'main') {
      router.back();
    } else {
      setActiveSection('main');
    }
  };

  const renderHeader = (title: string) => (
    <View className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt">
      <TouchableOpacity onPress={goBack} className="mr-3 p-1">
        <Ionicons name="chevron-back" size={24} color="#00897B" />
      </TouchableOpacity>
      <Text className="text-xl font-bold text-text-primary flex-1">
        {title}
      </Text>
    </View>
  );

  const renderMenuItem = (
    icon: string,
    label: string,
    section: SettingsSection,
    description?: string,
  ) => (
    <TouchableOpacity
      key={section}
      onPress={() => setActiveSection(section)}
      className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt"
      activeOpacity={0.7}
    >
      <View className="w-8 items-center mr-3">
        <Ionicons name={icon as any} size={20} color="#00897B" />
      </View>
      <View className="flex-1">
        <Text className="text-base text-text-primary font-medium">{label}</Text>
        {description ? (
          <Text className="text-xs text-text-muted mt-1">{description}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderToggle = (
    label: string,
    description: string,
    value: boolean,
    onValueChange: (v: boolean) => void,
  ) => (
    <View className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt">
      <View className="flex-1 mr-4">
        <Text className="text-base text-text-primary font-medium">{label}</Text>
        <Text className="text-xs text-text-muted mt-1">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D1D5DB', true: '#80CBC4' }}
        thumbColor={value ? '#00897B' : '#9CA3AF'}
      />
    </View>
  );

  const renderMainMenu = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* Profile Preview */}
      <View className="bg-white px-4 py-5 mb-2 items-center border-b border-bg-alt">
        <Avatar
          initials={user?.name?.[0] || 'U'}
          source={user?.profileImage ? { uri: user.profileImage } : undefined}
          size="xl"
        />
        <Text className="text-lg font-bold text-text-primary mt-3">
          {user?.name || 'User'}
        </Text>
        <Text className="text-sm text-text-muted mt-1">{user?.email}</Text>
      </View>

      {/* Menu Items */}
      <View className="mt-2">
        {renderMenuItem(
          'person-outline',
          'Account Settings',
          'account',
          'Edit profile, change password',
        )}
        {renderMenuItem(
          'shield-outline',
          'Privacy & Security',
          'privacy',
          'Profile visibility, data sharing',
        )}
        {renderMenuItem(
          'notifications-outline',
          'Notifications',
          'notifications',
          'Push notifications, alerts',
        )}
        {renderMenuItem(
          'help-circle-outline',
          'Help & Support',
          'help',
          'FAQ, contact us',
        )}
        {renderMenuItem(
          'information-circle-outline',
          'About',
          'about',
          'Version, terms, licenses',
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity
        onPress={() => {
          showAlert({
            title: 'Logout',
            message: 'Are you sure you want to logout?',
            variant: 'confirm',
            buttons: [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                  // Dispatch logout first — sets isAuthenticated=false,
                  // AuthContext will auto-redirect to /auth
                  dispatch(logout());
                  await StorageService.clear();
                },
              },
            ],
          });
        }}
        className="flex-row items-center mx-4 my-6 px-4 py-4 bg-white rounded-xl"
        activeOpacity={0.7}
      >
        <View className="w-8 items-center mr-3">
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        </View>
        <Text className="flex-1 text-base text-error font-medium">Log Out</Text>
      </TouchableOpacity>

      <View className="h-8" />
    </ScrollView>
  );

  const renderAccountSettings = () => (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Edit Profile Section */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            Edit Profile
          </Text>
        </View>

        <View className="bg-white px-4 py-3 border-b border-bg-alt">
          <Text className="text-xs font-semibold text-text-muted mb-1">
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#9CA3AF"
            className="text-base text-text-primary py-2 border-b border-gray-200"
          />
        </View>

        <View className="bg-white px-4 py-3 border-b border-bg-alt">
          <Text className="text-xs font-semibold text-text-muted mb-1">
            Bio
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            className="text-base text-text-primary py-2 border-b border-gray-200"
            textAlignVertical="top"
          />
        </View>

        <View className="bg-white px-4 py-3 border-b border-bg-alt">
          <Text className="text-xs font-semibold text-text-muted mb-1">
            Location
          </Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="City, Country"
            placeholderTextColor="#9CA3AF"
            className="text-base text-text-primary py-2 border-b border-gray-200"
          />
        </View>

        <View className="bg-white px-4 py-3 border-b border-bg-alt">
          <Text className="text-xs font-semibold text-text-muted mb-1">
            Phone
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            className="text-base text-text-primary py-2 border-b border-gray-200"
          />
        </View>

        <View className="bg-white px-4 py-3 mb-1 border-b border-bg-alt">
          <Text className="text-xs text-text-muted mb-1">Email</Text>
          <Text className="text-base text-text-muted py-2">{user?.email}</Text>
        </View>

        <View className="px-4 mt-3">
          <Button onPress={handleSaveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </View>

        {/* Change Password Section */}
        <View className="px-4 pt-8 pb-2">
          <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            Change Password
          </Text>
        </View>

        <View className="bg-white px-4 py-3 border-b border-bg-alt">
          <Text className="text-xs font-semibold text-text-muted mb-1">
            Current Password
          </Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            className="text-base text-text-primary py-2 border-b border-gray-200"
          />
        </View>

        <View className="bg-white px-4 py-3 border-b border-bg-alt">
          <Text className="text-xs font-semibold text-text-muted mb-1">
            New Password
          </Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            className="text-base text-text-primary py-2 border-b border-gray-200"
          />
        </View>

        <View className="bg-white px-4 py-3 border-b border-bg-alt">
          <Text className="text-xs font-semibold text-text-muted mb-1">
            Confirm New Password
          </Text>
          <TextInput
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder="Confirm new password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            className="text-base text-text-primary py-2 border-b border-gray-200"
          />
        </View>

        <View className="px-4 mt-3">
          <Button onPress={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? 'Changing...' : 'Change Password'}
          </Button>
        </View>

        {/* Danger Zone */}
        <View className="px-4 pt-8 pb-2">
          <Text className="text-sm font-semibold text-error uppercase tracking-wide mb-3">
            Danger Zone
          </Text>
        </View>

        <View className="bg-white px-4 py-3 border-b border-bg-alt">
          <Text className="text-xs font-semibold text-text-muted mb-1">
            Confirm Password
          </Text>
          <TextInput
            value={deletePassword}
            onChangeText={setDeletePassword}
            placeholder="Enter password to delete account"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            className="text-base text-text-primary py-2 border-b border-gray-200"
          />
        </View>

        <View className="px-4 mt-3">
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={deleting}
            className={`rounded-xl py-3 items-center flex-row justify-center ${deleting ? 'bg-red-300 opacity-70' : 'bg-red-500'}`}
            activeOpacity={0.7}
          >
            {deleting && (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
                className="mr-2"
              />
            )}
            <Text className="text-base font-semibold text-white">
              {deleting ? 'Deleting Account...' : 'Delete Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderNotifications = () => (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="px-4 pt-4 pb-2">
        <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1">
          General
        </Text>
      </View>

      {renderToggle(
        'Push Notifications',
        'Receive push notifications on your device',
        pushEnabled,
        (v) => {
          setPushEnabled(v);
          syncNotificationPreference({ pushEnabled: v });
        },
      )}

      <View className="px-4 pt-6 pb-2">
        <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1">
          Activity
        </Text>
      </View>

      {renderToggle(
        'Likes',
        'When someone likes your post',
        likesNotif,
        (v) => {
          setLikesNotif(v);
          if (v && !pushEnabled) setPushEnabled(true);
          syncNotificationPreference({
            likesEnabled: v,
            ...(v && !pushEnabled ? { pushEnabled: true } : {}),
          });
        },
      )}
      {renderToggle(
        'Comments',
        'When someone comments on your post',
        commentsNotif,
        (v) => {
          setCommentsNotif(v);
          if (v && !pushEnabled) setPushEnabled(true);
          syncNotificationPreference({
            commentsEnabled: v,
            ...(v && !pushEnabled ? { pushEnabled: true } : {}),
          });
        },
      )}
      {renderToggle(
        'New Followers',
        'When someone follows you',
        followNotif,
        (v) => {
          setFollowNotif(v);
          if (v && !pushEnabled) setPushEnabled(true);
          syncNotificationPreference({
            followsEnabled: v,
            ...(v && !pushEnabled ? { pushEnabled: true } : {}),
          });
        },
      )}
      {renderToggle(
        'Messages',
        'When you receive a new message',
        messagesNotif,
        (v) => {
          setMessagesNotif(v);
          if (v && !pushEnabled) setPushEnabled(true);
          syncNotificationPreference({
            messagesEnabled: v,
            ...(v && !pushEnabled ? { pushEnabled: true } : {}),
          });
        },
      )}

      {notifLoading && (
        <View className="items-center py-2">
          <ActivityIndicator size="small" color="#00897B" />
        </View>
      )}

      <View className="px-4 pt-4">
        <Text className="text-xs text-text-muted leading-4">
          Your notification preferences are saved securely and respected across
          all your devices, in compliance with Canada's Anti-Spam Legislation
          (CASL).
        </Text>
      </View>
    </ScrollView>
  );

  const renderPrivacy = () => (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="px-4 pt-4 pb-2">
        <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1">
          Profile Visibility
        </Text>
      </View>

      {renderToggle(
        'Public Profile',
        'Allow others to find and view your profile',
        profilePublic,
        (v) => handlePrivacyToggle('profilePublic', v),
      )}
      {renderToggle(
        'Show Location',
        'Display your location on your profile',
        showLocation,
        (v) => handlePrivacyToggle('showLocation', v),
      )}
      {renderToggle(
        'Show Email',
        'Display your email on your profile',
        showEmail,
        (v) => handlePrivacyToggle('showEmail', v),
      )}

      <View className="px-4 pt-6 pb-2">
        <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1">
          Data & Permissions
        </Text>
      </View>

      <TouchableOpacity
        className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt"
        activeOpacity={0.7}
        disabled={exportingData}
        onPress={() =>
          showAlert({
            title: 'Export Your Data',
            message:
              'This will generate a complete copy of all personal data Petopia holds about you (PIPEDA right of access). This may take a moment.',
            variant: 'confirm',
            buttons: [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Export', onPress: handleExportData },
            ],
          })
        }
      >
        <View className="flex-1">
          <Text className="text-base text-text-primary font-medium">
            Export My Data
          </Text>
          <Text className="text-xs text-text-muted mt-1">
            {exportingData
              ? 'Generating export...'
              : 'Download a copy of your data (PIPEDA)'}
          </Text>
        </View>
        {exportingData ? (
          <ActivityIndicator size="small" color="#00897B" />
        ) : (
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt"
        activeOpacity={0.7}
        onPress={() => router.push('/blocked-users' as any)}
      >
        <View className="flex-1">
          <Text className="text-base text-text-primary font-medium">
            Blocked Users
          </Text>
          <Text className="text-xs text-text-muted mt-1">
            Manage blocked accounts
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </ScrollView>
  );

  const renderHelp = () => (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="px-4 pt-4 pb-2">
        <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1">
          Support
        </Text>
      </View>

      <TouchableOpacity
        className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt"
        activeOpacity={0.7}
        onPress={() =>
          showAlert({
            title: 'Contact Support',
            message:
              'Email us at support@petopia.app for any questions or issues.',
            variant: 'info',
          })
        }
      >
        <View className="w-8 items-center mr-3">
          <Ionicons name="mail-outline" size={20} color="#00897B" />
        </View>
        <View className="flex-1">
          <Text className="text-base text-text-primary font-medium">
            Contact Us
          </Text>
          <Text className="text-xs text-text-muted mt-1">
            support@petopia.app
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <TouchableOpacity
        className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt"
        activeOpacity={0.7}
        onPress={() =>
          showAlert({
            title: 'Report a Bug',
            message: "Send details to bugs@petopia.app and we'll look into it.",
            variant: 'info',
          })
        }
      >
        <View className="w-8 items-center mr-3">
          <Ionicons name="bug-outline" size={20} color="#00897B" />
        </View>
        <View className="flex-1">
          <Text className="text-base text-text-primary font-medium">
            Report a Bug
          </Text>
          <Text className="text-xs text-text-muted mt-1">
            Help us improve Petopia
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <View className="px-4 pt-6 pb-2">
        <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1">
          FAQ
        </Text>
      </View>

      {[
        {
          q: 'How do I add a pet?',
          a: 'Go to your Profile tab and tap "+ Add Pet" in the My Pets section.',
        },
        {
          q: 'How do I change my password?',
          a: 'Go to Settings > Account Settings and scroll to the Change Password section.',
        },
        {
          q: 'Can I delete my account?',
          a: 'Yes, go to Settings > Account Settings and scroll to the Danger Zone at the bottom.',
        },
        {
          q: 'How do I create a post?',
          a: 'Go to the Social tab and tap "Share a moment" at the top.',
        },
      ].map((faq, idx) => (
        <TouchableOpacity
          key={idx}
          className="px-4 py-4 bg-white border-b border-bg-alt"
          activeOpacity={0.7}
          onPress={() =>
            showAlert({ title: faq.q, message: faq.a, variant: 'info' })
          }
        >
          <Text className="text-base text-text-primary font-medium">
            {faq.q}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderAbout = () => (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* App Info */}
      <View className="items-center py-8 bg-white border-b border-bg-alt">
        <View className="w-20 h-20 rounded-2xl bg-primary items-center justify-center mb-3">
          <MaterialCommunityIcons name="paw" size={40} color="#FFFFFF" />
        </View>
        <Text className="text-2xl font-bold text-text-primary">Petopia</Text>
        <Text className="text-sm text-text-muted mt-1">
          Version 1.0.0 (Build 1)
        </Text>
      </View>

      <View className="px-4 py-4">
        <Text className="text-sm text-text-muted text-center leading-5">
          Petopia is your all-in-one pet care companion. Manage your pets,
          connect with other pet owners, and access pet care services all in one
          place.
        </Text>
      </View>

      <View className="px-4 pt-2 pb-2">
        <Text className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1">
          Legal
        </Text>
      </View>

      {[
        {
          label: 'Terms of Service',
          icon: 'document-text-outline',
          route: '/terms-of-service',
        },
        {
          label: 'Privacy Policy',
          icon: 'shield-checkmark-outline',
          route: '/privacy-policy',
        },
        {
          label: 'Open Source Licenses',
          icon: 'code-slash-outline',
          route: null, // Coming soon
        },
      ].map((item) => (
        <TouchableOpacity
          key={item.label}
          className="flex-row items-center px-4 py-4 bg-white border-b border-bg-alt"
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel={item.label}
          onPress={() => {
            if (item.route) {
              router.push(item.route as any);
            } else {
              showAlert({
                title: item.label,
                message: 'This will be available in a future update.',
                variant: 'info',
              });
            }
          }}
        >
          <View className="w-8 items-center mr-3">
            <Ionicons name={item.icon as any} size={20} color="#00897B" />
          </View>
          <Text className="flex-1 text-base text-text-primary font-medium">
            {item.label}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      ))}

      <View className="items-center py-6">
        <Text className="text-xs text-text-muted">
          Made with care by Petopia Team
        </Text>
        <Text className="text-xs text-text-muted mt-1">
          {'\u00A9'} {new Date().getFullYear()} Petopia. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );

  const sectionTitles: Record<SettingsSection, string> = {
    main: 'Settings',
    account: 'Account Settings',
    privacy: 'Privacy & Security',
    notifications: 'Notifications',
    help: 'Help & Support',
    about: 'About',
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return renderAccountSettings();
      case 'notifications':
        return renderNotifications();
      case 'privacy':
        return renderPrivacy();
      case 'help':
        return renderHelp();
      case 'about':
        return renderAbout();
      default:
        return renderMainMenu();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      {renderHeader(sectionTitles[activeSection])}
      {renderContent()}
    </SafeAreaView>
  );
};
