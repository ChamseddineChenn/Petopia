/**
 * Petopia Design System Theme
 *
 * This theme implements the Petopia color palette and spacing system.
 * Use these values throughout the app for consistent styling.
 */

export const colors = {
  // Primary (Trust & Care) - Teal
  primary: '#4DB6AC',
  primaryLight: '#80CBC4',
  primaryDark: '#00897B',

  // Secondary (Nature) - Sage Green
  secondary: '#8BC6A8',
  secondaryLight: '#A1D6B5',
  secondaryDark: '#6BA89A',

  // Accent (Warmth) - Peach
  accent: '#F4C7AB',
  accentLight: '#FFDBBB',
  accentDark: '#F0AD7D',

  // Backgrounds
  bgMain: '#FAFAF7', // Warm off-white (screen backgrounds)
  bgAlt: '#F5F5F2', // Slightly darker for contrast
  bgCard: '#FFFFFF', // Pure white for cards

  // Text
  textPrimary: '#2E2E2E', // Main text (NOT pure black)
  textMuted: '#9CA3AF', // Secondary/muted text
  textLight: '#BFBFBA', // Placeholder/disabled text

  // Borders
  border: '#E5E5E5',
  borderLight: '#F0F0F0',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const typography = {
  // Font sizes
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,

  // Font weights (as strings for RN)
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
};

export default theme;
