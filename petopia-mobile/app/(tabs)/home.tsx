import React from 'react';
import { useRouter } from 'expo-router';
import { HomeScreen } from '../../src/components/screens/HomeScreen';

export default function HomeScreenPage() {
  const router = useRouter();

  const handleProfilePress = () => {
    router.push('/profile-modal');
  };

  return <HomeScreen onProfilePress={handleProfilePress} />;
}
