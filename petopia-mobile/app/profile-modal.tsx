import { Stack, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ProfileScreen } from '../src/components/screens/ProfileScreen';
import { PublicProfileScreen } from '../src/components/screens/PublicProfileScreen';
import type { RootState } from '../src/store/store';

export default function ProfileModal() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const currentUser = useSelector((state: RootState) => state.auth.user);

  // Show own profile if no userId or if userId matches current user
  const isOwnProfile = !userId || userId === currentUser?._id;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      {isOwnProfile ? <ProfileScreen /> : <PublicProfileScreen />}
    </>
  );
}
