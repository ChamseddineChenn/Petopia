import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../common/Avatar';
import { ScreenHeader } from '../common/ScreenHeader';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchFollowRequests,
  respondToFollowRequest,
  fetchFollowers,
  FollowRequest,
} from '../../store/slices/profileSlice';

type Tab = 'requests' | 'followers';

interface FollowUser {
  _id: string;
  name: string;
  profileImage?: string;
  bio?: string;
}

export const FollowManagementScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user } = useSelector((state: RootState) => state.auth);
  const { followRequests } = useSelector((state: RootState) => state.profile);

  const [tab, setTab] = useState<Tab>('followers');
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondedIds, setRespondedIds] = useState<
    Record<string, 'accept' | 'reject'>
  >({});

  const loadData = useCallback(async () => {
    if (!user?._id) return;
    await Promise.all([
      dispatch(fetchFollowers(user._id))
        .unwrap()
        .then(setFollowers)
        .catch(() => {}),
      dispatch(fetchFollowRequests())
        .unwrap()
        .catch(() => {}),
    ]);
  }, [dispatch, user?._id]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleRespond = (requestId: string, action: 'accept' | 'reject') => {
    dispatch(respondToFollowRequest({ requestId, action }));
    setRespondedIds((prev) => ({ ...prev, [requestId]: action }));
  };

  const renderFollower = ({ item }: { item: FollowUser }) => (
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
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: FollowRequest }) => {
    const status = respondedIds[item._id];
    return (
      <TouchableOpacity
        className="flex-row items-center px-4 py-3 border-b border-gray-100"
        activeOpacity={0.7}
        onPress={() =>
          router.push({
            pathname: '/profile-modal',
            params: { userId: item.from._id },
          })
        }
      >
        {item.from.profileImage ? (
          <Image
            source={{ uri: item.from.profileImage }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
          />
        ) : (
          <Avatar initials={item.from.name?.[0] || 'U'} size="md" />
        )}
        <View className="ml-3 flex-1">
          <Text className="text-base font-semibold text-text-primary">
            {item.from.name}
          </Text>
          {item.from.bio ? (
            <Text className="text-sm text-text-muted mt-0.5" numberOfLines={1}>
              {item.from.bio}
            </Text>
          ) : null}

          {!status && (
            <View className="flex-row mt-2 gap-2">
              <TouchableOpacity
                onPress={() => handleRespond(item._id, 'accept')}
                className="bg-primary px-4 py-1.5 rounded-full"
              >
                <Text className="text-white text-xs font-semibold">Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRespond(item._id, 'reject')}
                className="bg-gray-200 px-4 py-1.5 rounded-full"
              >
                <Text className="text-text-primary text-xs font-semibold">
                  Decline
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {status && (
            <Text
              className={
                status === 'accept'
                  ? 'text-xs mt-1.5 font-medium text-primary'
                  : 'text-xs mt-1.5 font-medium text-text-muted'
              }
            >
              {status === 'accept' ? 'Accepted' : 'Declined'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const pendingRequests = (followRequests || []).filter(
    (r) => r.status === 'pending' && !respondedIds[r._id],
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <ScreenHeader title="Manage Followers" onBack={() => router.back()} />

      {/* Tab bar */}
      <View className="flex-row border-b border-gray-200">
        <TouchableOpacity
          className="flex-1 py-3 items-center"
          onPress={() => setTab('followers')}
        >
          <Text
            className={
              tab === 'followers'
                ? 'text-sm font-bold text-primary'
                : 'text-sm font-medium text-text-muted'
            }
          >
            Followers ({followers.length})
          </Text>
          {tab === 'followers' && (
            <View className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 py-3 items-center"
          onPress={() => setTab('requests')}
        >
          <Text
            className={
              tab === 'requests'
                ? 'text-sm font-bold text-primary'
                : 'text-sm font-medium text-text-muted'
            }
          >
            Requests
            {pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}
          </Text>
          {tab === 'requests' && (
            <View className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
          )}
          {pendingRequests.length > 0 && (
            <View className="absolute top-2 right-4 w-2 h-2 rounded-full bg-red-500" />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DB6AC" />
        </View>
      ) : tab === 'followers' ? (
        <FlatList
          data={followers}
          renderItem={renderFollower}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={followers.length === 0 ? { flex: 1 } : {}}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="people-outline" size={56} color="#D1D5DB" />
              <Text className="text-lg text-text-muted mt-4">
                No followers yet
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={followRequests || []}
          renderItem={renderRequest}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={
            (followRequests || []).length === 0 ? { flex: 1 } : {}
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="mail-open-outline" size={56} color="#D1D5DB" />
              <Text className="text-lg text-text-muted mt-4">
                No pending requests
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};
