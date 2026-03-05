import { useState } from 'react';
import { RefreshControl } from 'react-native';

/**
 * Custom hook for managing pull-to-refresh functionality
 * @param onRefresh - Async function called when user pulls to refresh
 * @returns RefreshControl component and refresh state
 */
export const useRefresh = (
  onRefresh?: () => Promise<void>
) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      // Default 500ms delay to show refresh animation
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      colors={['#4DB6AC']} // Primary color
      progressBackgroundColor="#ffffff"
      tintColor="#4DB6AC"
    />
  );

  return { refreshControl, refreshing, handleRefresh };
};
