/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary (Trust & Care)
        primary: {
          DEFAULT: '#4DB6AC',
          light: '#80CBC4',
          dark: '#00897B',
        },
        // Secondary (Nature)
        secondary: {
          DEFAULT: '#8BC6A8',
          light: '#A1D6B5',
          dark: '#6BA89A',
        },
        // Accent (Warmth)
        accent: {
          DEFAULT: '#F4C7AB',
          light: '#FFDBBB',
          dark: '#F0AD7D',
        },
        // Custom backgrounds
        'bg-main': '#FAFAF7',
        'bg-alt': '#F5F5F2',
        'bg-card': '#FFFFFF',
        // Text colors
        'text-primary': '#1F2937',
        'text-secondary': '#4B5563',
        'text-muted': '#6B7280',
        'text-light': '#9CA3AF',
        // Status colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      fontSize: {
        xs: '10px',
        sm: '12px',
        base: '14px',
        md: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  },
  plugins: [],
};
