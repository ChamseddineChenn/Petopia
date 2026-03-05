import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface ServiceCardProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  icon,
  label,
  onPress,
}) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 items-center justify-center"
        style={{ minHeight: 140 }}
      >
        <View className="mb-3">{icon}</View>
        <Text className="text-gray-900 font-semibold text-center text-sm">
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
