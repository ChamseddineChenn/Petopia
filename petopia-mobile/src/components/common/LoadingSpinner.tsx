import React from 'react';
import { ActivityIndicator, View } from 'react-native';

export const LoadingSpinner: React.FC = () => (
  <View className="flex-1 items-center justify-center">
    <ActivityIndicator size="large" color="#4DB6AC" />
  </View>
);
