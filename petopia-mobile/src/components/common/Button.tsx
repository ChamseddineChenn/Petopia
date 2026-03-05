import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
}) => {
  const variantClasses = {
    primary: 'bg-primary-dark',
    secondary: 'bg-secondary-dark',
    accent: 'bg-accent-dark',
    ghost: 'bg-transparent border border-primary-dark',
  };

  const sizeClasses = {
    sm: 'px-4 py-2',
    md: 'px-6 py-3',
    lg: 'px-8 py-4',
  };

  const textClasses = {
    primary: 'text-white',
    secondary: 'text-white',
    accent: 'text-white',
    ghost: 'text-primary-dark',
  };

  const sizeTextClasses = {
    sm: 'text-sm font-medium',
    md: 'text-base font-semibold',
    lg: 'text-lg font-semibold',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      className={`
        rounded-2xl items-center justify-center
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50' : ''}
      `}
    >
      <Text className={`${textClasses[variant]} ${sizeTextClasses[size]}`}>
        {children}
      </Text>
    </TouchableOpacity>
  );
};
