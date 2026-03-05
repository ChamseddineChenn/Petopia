import React from 'react';
import { View } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <View
      className={`
        bg-white rounded-2xl p-4 shadow-sm border border-gray-100
        ${className}
      `}
    >
      {children}
    </View>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = '',
}) => (
  <View className={`pb-3 border-b border-gray-100 ${className}`}>
    {children}
  </View>
);

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({
  children,
  className = '',
}) => <View className={`py-3 ${className}`}>{children}</View>;
