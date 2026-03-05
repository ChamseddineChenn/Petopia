import React from 'react';
import { View, Text, TextInput } from 'react-native';

interface InputProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  label?: string;
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
}

export const Input: React.FC<InputProps> = ({
  placeholder,
  value,
  onChangeText,
  label,
  error,
  multiline = false,
  numberOfLines = 1,
}) => {
  return (
    <View className="mb-4">
      {label && (
        <Text className="text-text-primary font-semibold mb-2">{label}</Text>
      )}
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={numberOfLines}
        className={`
          bg-white border rounded-xl px-4 py-3 text-text-primary
          ${error ? 'border-error' : 'border-gray-200'}
        `}
        placeholderTextColor="#9CA3AF"
      />
      {error && <Text className="text-error text-sm mt-2">{error}</Text>}
    </View>
  );
};
