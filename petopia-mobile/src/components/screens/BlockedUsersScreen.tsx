import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Avatar } from '../common/Avatar';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchBlockedUsers,
  unblockUser,
  ChatUser,
} from '../../store/slices/chatSlice';
import { useAlert } from '../ui/CustomAlert';

export const BlockedUsersScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { blockedUsers } = useSelector((state: RootState) => state.chat);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dispatch(fetchBlockedUsers()).finally(() => setLoading(false));
  }, [dispatch]);

  const handleUnblock = (user: ChatUser) => {
    showAlert({
      title: 'Unblock User',
      message: `Unblock ${user.name}? They will be able to message you again.`,
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () => {
            dispatch(unblockUser(user._id));
          },
        },
      ],
    });
  };

  const renderItem = ({ item }: { item: ChatUser }) => (
    <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
      {item.profileImage ? (
        <Image
          source={{ uri: item.profileImage }}
          style={{ width: 44, height: 44, borderRadius: 22 }}
        />
      ) : (
        <Avatar initials={item.name?.[0] || '?'} size="sm" />
      )}
      <Text
        className="flex-1 ml-3 text-base font-medium text-text-primary"
        numberOfLines={1}
      >
        {item.name}
      </Text>
      <TouchableOpacity
        onPress={() => handleUnblock(item)}
        className="px-4 py-2 rounded-lg bg-gray-100"
        activeOpacity={0.7}
      >
        <Text className="text-sm font-semibold text-text-primary">Unblock</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center bg-white px-3 py-3 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-1 mr-2"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-text-primary">
          Blocked Users
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DB6AC" />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="shield-checkmark-outline" size={48} color="#D1D5DB" />
          <Text className="text-base text-text-muted mt-3 text-center">
            You haven&apos;t blocked anyone
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
};
