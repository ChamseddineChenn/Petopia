import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { RootState } from '../../src/store/store';

/**
 * Petopia Tab Navigation
 *
 * Design System Colors:
 * - Primary (Active): #00897B (Dark Teal)
 * - Muted (Inactive): #9CA3AF (Gray)
 * - Background: #FFFFFF (White)
 * - Border: #F5F5F2
 *
 * Icons: Ionicons from @expo/vector-icons (ships with Expo)
 * - Minimalistic outline style, single color
 * - Active: filled variant, dark teal
 * - Inactive: outline variant, muted gray
 */

const colors = {
  active: '#00897B',
  inactive: '#9CA3AF',
  background: '#FFFFFF',
  border: '#F5F5F2',
};

export default function TabLayout() {
  const totalUnread = useSelector((state: RootState) => state.chat.totalUnread);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.active,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {/* TAB 1: Social Feed */}
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper-outline" size={22} color={color} />
          ),
        }}
      />

      {/* TAB 2: Services */}
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={22} color={color} />
          ),
        }}
      />

      {/* TAB 3: Home */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={22} color={color} />
          ),
        }}
      />

      {/* TAB 4: Messages */}
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={22} color={color} />
          ),
          tabBarBadge:
            totalUnread > 0
              ? totalUnread > 99
                ? '99+'
                : totalUnread
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
          },
        }}
      />
    </Tabs>
  );
}
