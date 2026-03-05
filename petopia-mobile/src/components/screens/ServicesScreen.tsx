import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const services = [
  {
    id: '1',
    icon: 'medkit-outline' as const,
    label: 'Veterinarians',
    description: 'Find trusted vets nearby',
  },
  {
    id: '2',
    icon: 'cut-outline' as const,
    label: 'Groomers',
    description: 'Professional pet grooming',
  },
  {
    id: '3',
    icon: 'people-outline' as const,
    label: 'Pet Sitters',
    description: 'Reliable care while away',
  },
  {
    id: '4',
    icon: 'fitness-outline' as const,
    label: 'Trainers',
    description: 'Behaviour & obedience',
  },
  {
    id: '5',
    icon: 'heart-outline' as const,
    label: 'Breeders',
    description: 'Responsible breeders',
  },
  {
    id: '6',
    icon: 'bed-outline' as const,
    label: 'Pet Hotels',
    description: 'Boarding & daycare',
  },
  {
    id: '7',
    icon: 'storefront-outline' as const,
    label: 'Pet Shops',
    description: 'Supplies & accessories',
  },
  {
    id: '8',
    icon: 'leaf-outline' as const,
    label: 'Pet Parks',
    description: 'Parks & play areas',
  },
];

interface ServicesScreenProps {
  onServicePress?: (serviceId: string) => void;
}

export const ServicesScreen: React.FC<ServicesScreenProps> = ({
  onServicePress,
}) => {
  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3 bg-white border-b border-bg-alt">
        <Text className="text-2xl font-bold text-text-primary">Services</Text>
        <Text className="text-sm text-text-muted mt-1">
          Find the best care for your pet
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row flex-wrap justify-between gap-3">
          {services.map((service) => (
            <View key={service.id} className="w-[48%]">
              <TouchableOpacity
                onPress={() => onServicePress?.(service.id)}
                activeOpacity={0.7}
                className="bg-white rounded-2xl p-5 items-center justify-center min-h-[140px] border border-bg-alt"
              >
                <View className="w-14 h-14 rounded-full bg-primary-light/20 items-center justify-center mb-3">
                  <Ionicons name={service.icon} size={26} color="#00897B" />
                </View>
                <Text className="text-sm font-semibold text-text-primary text-center">
                  {service.label}
                </Text>
                <Text className="text-[11px] text-text-muted text-center mt-1">
                  {service.description}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
