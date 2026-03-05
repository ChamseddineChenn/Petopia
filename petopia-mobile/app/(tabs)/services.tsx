import React from 'react';
import { useRouter } from 'expo-router';
import { ServicesScreen } from '../../src/components/screens/ServicesScreen';

export default function ServicesPage() {
  const router = useRouter();

  const handleServicePress = (serviceId: string) => {
    switch (serviceId) {
      case '1': // Veterinarians
        router.push('/vet-list');
        break;
      case '2': // Groomers
        router.push('/groomer-list');
        break;
      case '7': // Pet Shops
        router.push('/pet-shop-list');
        break;
      default:
        break;
    }
  };

  return <ServicesScreen onServicePress={handleServicePress} />;
}
