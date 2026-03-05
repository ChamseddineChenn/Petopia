# 🛠️ Petopia Developer Guide - How to Build New Features

This guide shows you how to add new features to Petopia following the established patterns.

---

## 📋 Table of Contents

1. [Add a New Service to Home Screen](#add-a-new-service)
2. [Create a New Redux Slice](#create-redux-slice)
3. [Add a New Tab/Screen](#add-new-tab)
4. [Create Custom Components](#create-components)
5. [Use TanStack Query](#use-query)
6. [Update Styling](#styling-guide)

---

## 🏥 Add a New Service to Home Screen

### Step 1: Update Service Icons

**File:** `src/constants/colors.ts` (or create `src/constants/services.ts`)

```typescript
// Add new icon constant
export const ServiceIcons = {
  vet: '🏥',
  // ... existing ...
  pharmacy: '💊', // ← NEW
};
```

### Step 2: Update Services Array

**File:** `src/components/screens/HomeScreen.tsx`

```tsx
const services: Service[] = [
  { id: '1', icon: ServiceIcons.vet, label: 'Veterinarians' },
  // ... existing services ...
  { id: '9', icon: ServiceIcons.pharmacy, label: 'Pet Pharmacy' }, // ← NEW
];
```

### Step 3: Handle Service Press

```tsx
const handleServicePress = (serviceId: string) => {
  console.log(`Service clicked: ${serviceId}`);
  // Navigate to service detail screen or show modal
  // router.push(`/(tabs)/service-detail?id=${serviceId}`);
};
```

### ✅ Done!

The service will appear in the grid automatically.

---

## 🔐 Create a New Redux Slice

### Step 1: Create Slice File

**File:** `src/store/slices/servicesSlice.ts`

```typescript
import { createSlice } from '@reduxjs/toolkit';

interface Service {
  id: string;
  name: string;
  rating: number;
}

interface ServicesState {
  services: Service[];
  selectedService: Service | null;
  loading: boolean;
}

const initialState: ServicesState = {
  services: [],
  selectedService: null,
  loading: false,
};

const servicesSlice = createSlice({
  name: 'services',
  initialState,
  reducers: {
    setServices: (state, action) => {
      state.services = action.payload;
    },
    setSelectedService: (state, action) => {
      state.selectedService = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
});

export const { setServices, setSelectedService, setLoading } =
  servicesSlice.actions;
export default servicesSlice.reducer;
```

### Step 2: Add to Store

**File:** `src/store/store.ts`

```typescript
import servicesReducer from './slices/servicesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    services: servicesReducer, // ← ADD HERE
  },
});
```

### Step 3: Use in Component

```tsx
import { useAppDispatch, useAppSelector } from '@/hooks/useAppRedux';
import { setServices } from '@/store/slices/servicesSlice';

export const HomeScreen = () => {
  const dispatch = useAppDispatch();
  const services = useAppSelector(state => state.services.services);

  useEffect(() => {
    dispatch(setServices([...]));
  }, []);

  return (
    // Render services
  );
};
```

---

## 📱 Add a New Tab/Screen

### Step 1: Create Screen Component

**File:** `src/components/screens/NewScreen.tsx`

```tsx
import React from 'react';
import { View, Text, ScrollView } from 'react-native';

interface NewScreenProps {
  // Define props here
}

export const NewScreen: React.FC<NewScreenProps> = () => {
  return (
    <View className="flex-1 bg-bg-main">
      <ScrollView className="flex-1">
        <View className="px-lg py-lg">
          <Text className="text-text-primary font-bold text-2xl">New Tab</Text>
        </View>
      </ScrollView>
    </View>
  );
};
```

### Step 2: Create Tab Page

**File:** `app/(tabs)/new-tab.tsx`

```tsx
import React from 'react';
import { NewScreen } from '../../src/components/screens/NewScreen';

export default function NewTabPage() {
  return <NewScreen />;
}
```

### Step 3: Update Tab Navigation

**File:** `app/(tabs)/_layout.tsx`

```tsx
// Add icon component
const NewIcon = ({
  focused,
}: {
  focused: boolean;
  color: string;
  size?: number;
}) => (
  <View className={`items-center justify-center ${focused ? 'scale-110' : ''}`}>
    <Text className="text-xl">{focused ? '✨' : '🌟'}</Text>
  </View>
);

// Add tab in Tabs component
<Tabs.Screen
  name="new-tab"
  options={{
    title: 'New',
    tabBarIcon: NewIcon,
  }}
/>;
```

### ✅ Done!

The new tab appears in the bottom navigation.

---

## 🎨 Create Custom Components

### Create a Reusable Component

**File:** `src/components/common/Badge.tsx`

```tsx
import React from 'react';
import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'accent';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'md',
}) => {
  const variantClasses = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    accent: 'bg-accent',
  };

  const sizeClasses = {
    sm: 'px-md py-sm',
    md: 'px-lg py-md',
  };

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
  };

  return (
    <View
      className={`rounded-full ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      <Text className={`text-white font-semibold ${textClasses[size]}`}>
        {label}
      </Text>
    </View>
  );
};
```

### Use the Component

```tsx
import { Badge } from '@/components/common/Badge';

<Badge label="New" variant="accent" size="sm" />;
```

---

## 🔗 Use TanStack Query

### Fetch Data

```tsx
import { useQuery } from '@tanstack/react-query';

const { data: services, isLoading, error } = useQuery({
  queryKey: ['services'],  // Cache key
  queryFn: async () => {
    const response = await fetch('https://api.petopia.com/services');
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },
});

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error.message} />;

return (
  // Render services
);
```

### Prefetch Data

```tsx
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

const prefetchServices = () => {
  queryClient.prefetchQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await fetch('https://api.petopia.com/services');
      return response.json();
    },
  });
};
```

### Invalidate Cache

```tsx
const queryClient = useQueryClient();

const handleCreateService = async () => {
  // Make request...

  // Refetch services
  queryClient.invalidateQueries({ queryKey: ['services'] });
};
```

---

## 🎨 Styling Guide

### Use NativeWind Classes

```tsx
// DO THIS ✅
<View className="flex-1 bg-primary px-lg py-xl rounded-2xl shadow-sm">
  <Text className="text-white font-semibold text-lg">
    Hello
  </Text>
</View>

// DON'T DO THIS ❌
<View style={styles.container}>
  <Text style={styles.text}>Hello</Text>
</View>
```

### Common Classes

| Category       | Examples                                                |
| -------------- | ------------------------------------------------------- |
| **Layout**     | `flex-1`, `flex-row`, `items-center`, `justify-between` |
| **Spacing**    | `px-lg`, `py-xl`, `mb-md`, `mt-sm`, `gap-lg`            |
| **Colors**     | `bg-primary`, `text-text-primary`, `border-border`      |
| **Sizing**     | `w-full`, `h-12`, `w-1/2`, `aspect-square`              |
| **Rounding**   | `rounded-lg`, `rounded-2xl`, `rounded-full`             |
| **Shadows**    | `shadow-sm`, `shadow-md`, `shadow-lg`                   |
| **Typography** | `font-bold`, `font-semibold`, `text-lg`, `text-xs`      |
| **Display**    | `opacity-50`, `absolute`, `relative`, `z-10`            |

### Color Variables

```tsx
// Available colors
bg - primary; // #4DB6AC
bg - secondary; // #8BC6A8
bg - accent; // #F4C7AB
bg - bg - main; // #FAFAF7
bg - bg - alt; // #F5F5F2

text - text - primary; // #2E2E2E
text - text - muted; // #9CA3AF
text - text - light; // #BFBFBA

border - border; // #E5E5E0
```

### Opacity & Backgrounds

```tsx
// Tinted backgrounds
<View className="bg-primary/5">   {/* 5% opacity */}
  <Text>Soft primary background</Text>
</View>

<View className="bg-accent/10">  {/* 10% opacity */}
  <Text>Very light accent</Text>
</View>
```

---

## 🧪 Testing Your Changes

### Check TypeScript

```bash
npx tsc --noEmit
```

### Check ESLint

```bash
npm run lint
```

### Start Dev Server

```bash
npm start
```

Press `s` (Android), `i` (iOS), or `w` (web) to open app.

---

## 📚 Common Patterns

### Loading State

```tsx
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

if (isLoading) return <LoadingSpinner />;
```

### Error Handling

```tsx
import { useAppDispatch } from '@/hooks/useAppRedux';

const dispatch = useAppDispatch();

if (error) {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-error">Something went wrong</Text>
    </View>
  );
}
```

### Modal/Navigation

```tsx
import { useRouter } from 'expo-router';

const router = useRouter();

const handlePress = () => {
  router.push({
    pathname: '/service-detail',
    params: { id: '123' },
  });
};
```

---

## 🚀 Best Practices

1. **Use Components** - Break UI into small, reusable pieces
2. **Use Hooks** - `useQuery`, `useAppDispatch`, `useAppSelector`
3. **Use NativeWind** - No StyleSheet.create()
4. **Type Everything** - Full TypeScript support
5. **Keep it Simple** - MVP first, optimize later
6. **Mock Data First** - Get UI right, then add API
7. **Test as You Go** - Run `npm start` frequently
8. **Follow Patterns** - Match existing code style

---

## 🔗 File Quick Links

```
Add Service?        → src/components/screens/HomeScreen.tsx
New Redux State?    → src/store/slices/newSlice.ts
New Screen?         → src/components/screens/NewScreen.tsx
New Component?      → src/components/common/NewComponent.tsx
New Tab?            → app/(tabs)/new-tab.tsx
Update Colors?      → src/constants/colors.ts
Update Theme?       → tailwind.config.js
```

---

## ❓ FAQ

**Q: How do I add authentication?**
A: Redux `authSlice` is ready. Dispatch `setAuth({ userId, token })` on login.

**Q: How do I fetch from an API?**
A: Use `useQuery()` from TanStack Query. Replace mock data with API endpoint.

**Q: How do I style my component?**
A: Use NativeWind classes in the `className` prop. No inline styles or StyleSheet!

**Q: How do I add a new tab?**
A: Create screen in `src/components/screens/`, tab page in `app/(tabs)/`, update `_layout.tsx`.

**Q: How do I navigate between screens?**
A: Use `useRouter()` from `expo-router`. Example: `router.push('/service-detail?id=123')`

---

**Happy Building! 🚀**
