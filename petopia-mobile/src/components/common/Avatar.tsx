import React from 'react';
import { View, Text, Image } from 'react-native';

interface AvatarProps {
  source?: { uri: string };
  initials?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: { container: 'w-8 h-8', text: 'text-xs' },
  md: { container: 'w-12 h-12', text: 'text-sm' },
  lg: { container: 'w-16 h-16', text: 'text-lg' },
  xl: { container: 'w-20 h-20', text: 'text-xl' },
};

export const Avatar: React.FC<AvatarProps> = ({
  source,
  initials = 'P',
  size = 'md',
}) => {
  const { container, text } = sizeMap[size];

  if (source) {
    return <Image source={source} className={`${container} rounded-full`} />;
  }

  return (
    <View
      className={`${container} rounded-full bg-primary-light items-center justify-center`}
    >
      <Text className={`${text} font-bold text-primary-dark`}>{initials}</Text>
    </View>
  );
};
