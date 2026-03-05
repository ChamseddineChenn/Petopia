import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Image } from 'expo-image';
import { Avatar } from '../common/Avatar';
import { ScreenHeader } from '../common/ScreenHeader';
import { AppDispatch } from '../../store/store';
import {
  fetchFollowers,
  fetchFollowing,
} from '../../store/slices/profileSlice';

interface FollowUser {
  _id: string;
  name: string;
  profileImage?: string;
  bio?: string;
}

export const FollowListScreen: React.FC = () => {
  const { userId, type } = useLocalSearchParams<{
    userId: string;
    type: 'followers' | 'following';
  }>();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !type) return;
    setLoading(true);
    const thunk = type === 'followers' ? fetchFollowers : fetchFollowing;
    dispatch(thunk(userId))
      .unwrap()
      .then((data: FollowUser[]) => setUsers(data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [userId, type, dispatch]);

  const renderItem = ({ item }: { item: FollowUser }) => (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3 border-b border-gray-100"
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: '/profile-modal',
          params: { userId: item._id },
        })
      }
    >
      {item.profileImage ? (
        <Image
          source={{ uri: item.profileImage }}
          style={{ width: 48, height: 48, borderRadius: 24 }}
        />
      ) : (
        <Avatar initials={item.name?.[0] || 'U'} size="md" />
      )}
      <View className="ml-3 flex-1">
        <Text className="text-base font-semibold text-text-primary">
          {item.name}
        </Text>
        {item.bio ? (
          <Text className="text-sm text-text-muted mt-0.5" numberOfLines={1}>
            {item.bio}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const title = type === 'followers' ? 'Followers' : 'Following';

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader title={title} onBack={() => router.back()} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DB6AC" />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={users.length === 0 ? { flex: 1 } : {}}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-lg text-text-muted">
                {type === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};
