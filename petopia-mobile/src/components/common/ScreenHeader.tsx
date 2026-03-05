import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBack,
  rightAction,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-bg-alt">
      <TouchableOpacity
        onPress={handleBack}
        className="w-10 h-10 items-center justify-center rounded-full"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color="#1F2937" />
      </TouchableOpacity>
      <Text
        className="text-lg font-bold text-text-primary flex-1 text-center"
        numberOfLines={1}
      >
        {title}
      </Text>
      <View className="min-w-[40px] h-10 items-center justify-center">
        {rightAction || null}
      </View>
    </View>
  );
};
