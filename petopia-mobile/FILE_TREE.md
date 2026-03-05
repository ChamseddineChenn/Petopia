# 📋 Petopia Frontend - File Tree & Architecture

```
petopia-mobile/
│
├── 📂 app/                          [Expo Router - File-based routing]
│   ├── _layout.tsx                  🔧 ROOT LAYOUT - Redux + Query Provider setup
│   ├── modal.tsx                    [Future modal flows]
│   └── 📂 (tabs)/                   [Tab-based navigation group]
│       ├── _layout.tsx              🔧 TAB NAVIGATOR - Bottom tabs (Social, Home, Messages)
│       ├── index.tsx                ↔️ Redirect to social.tsx
│       ├── social.tsx               📱 Social Feed Tab
│       ├── home.tsx                 🏠 Service Hub Tab
│       ├── messages.tsx             💬 Messaging Tab
│       ├── pets.tsx                 [Placeholder for future]
│       ├── appointments.tsx         [Placeholder for future]
│       ├── profile.tsx              [Placeholder for future]
│       └── explore.tsx              ↔️ Redirect to messages.tsx
│
├── 📂 src/                          [Source code]
│   │
│   ├── 📂 components/               [React components]
│   │   │
│   │   ├── 📂 common/               [Reusable UI components]
│   │   │   ├── Button.tsx           🔘 Button (4 variants: primary, secondary, accent, ghost)
│   │   │   ├── Card.tsx             📦 Card + CardHeader + CardBody
│   │   │   ├── Input.tsx            ⌨️ Text input with label & error
│   │   │   ├── Avatar.tsx           👤 Avatar (initials or image)
│   │   │   ├── ServiceCard.tsx      🏥 Service directory card
│   │   │   └── LoadingSpinner.tsx   ⏳ Loading indicator
│   │   │
│   │   └── 📂 screens/              [Full-screen components]
│   │       ├── SocialFeedScreen.tsx 📰 Social feed with posts
│   │       ├── HomeScreen.tsx       🏠 Service hub + quick access
│   │       └── MessagesScreen.tsx   💬 Conversation list
│   │
│   ├── 📂 constants/                [Constants & configuration]
│   │   ├── colors.ts                🎨 Petopia color palette
│   │   └── spacing.ts               📏 Spacing scale (4px base)
│   │
│   ├── 📂 hooks/                    [Custom React hooks]
│   │   └── useAppRedux.ts           🔗 useAppDispatch + useAppSelector
│   │
│   └── 📂 store/                    [Redux store]
│       ├── store.ts                 📦 Store configuration
│       └── 📂 slices/               [Redux slices]
│           ├── authSlice.ts         🔐 Auth state (isAuthenticated, userId, token)
│           └── userSlice.ts         👤 User state (profile)
│
├── 📂 assets/                       [Images, icons, fonts]
│   └── 📂 images/
│
├── 📂 components/                   [Legacy - kept for compatibility]
│   └── [Original Expo template files]
│
├── 📂 constants/                    [Legacy - kept for compatibility]
│   └── theme.ts                     [Original theme file]
│
├── 📂 hooks/                        [Legacy - kept for compatibility]
│   └── [Original Expo hooks]
│
├── 📂 node_modules/                 ⚙️ Installed dependencies
│
├── 📂 .expo/                        🔧 Expo configuration
│
├── .gitignore
├── .eslintrc.json
├── app.json                         📱 Expo app configuration
├── babel.config.js                  🔧 Babel + NativeWind setup
├── eslint.config.js
├── expo-env.d.ts
├── package.json                     📦 Dependencies & scripts
├── package-lock.json
├── README.md
├── tsconfig.json                    🔧 TypeScript configuration
├── tailwind.config.js               🎨 Tailwind CSS theme
│
├── DESIGN_GUIDE.md                  📖 Complete design system documentation
├── PROJECT_SUMMARY.md               📋 MVP overview & next steps
└── [other config files]
```

---

## 🎯 Key Files Explained

### Root Layout

**`app/_layout.tsx`**

- Sets up Redux `<Provider>`
- Initializes TanStack Query `<QueryClientProvider>`
- Returns `<Stack>` with tabs group

```tsx
<Provider store={store}>
  <QueryClientProvider client={queryClient}>
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  </QueryClientProvider>
</Provider>
```

### Tab Navigation

**`app/(tabs)/_layout.tsx`**

- Configures `<Tabs>` navigation
- 3 tabs: Social, Home, Messages
- Emoji icons for each tab
- Teal (#4DB6AC) active color

```tsx
<Tabs>
  <Tabs.Screen name="social" ... />
  <Tabs.Screen name="home" ... />
  <Tabs.Screen name="messages" ... />
</Tabs>
```

### Screen Pages

- **`app/(tabs)/social.tsx`** → Renders `<SocialFeedScreen />`
- **`app/(tabs)/home.tsx`** → Renders `<HomeScreen />`
- **`app/(tabs)/messages.tsx`** → Renders `<MessagesScreen />`

### Redux Store

**`src/store/store.ts`**

```tsx
const store = configureStore({
  reducer: {
    auth: authReducer, // Login state
    user: userReducer, // User profile
  },
});
```

### Color System

**`src/constants/colors.ts`**

- Primary: #4DB6AC (Teal - Trust)
- Secondary: #8BC6A8 (Sage - Nature)
- Accent: #F4C7AB (Peach - Warmth)
- Text: #2E2E2E (Soft charcoal)
- Muted: #9CA3AF (Neutral grey)

---

## 🔄 Data Flow

```
User Interaction
       ↓
Component (social.tsx, home.tsx, messages.tsx)
       ↓
dispatch(authSlice.action) → Redux Store
       ↓
useQuery({ queryKey, queryFn }) → TanStack Query (backend call)
       ↓
Render with updated state/data
```

---

## 📦 Dependency Tree

```
petopia-mobile/
├── expo                    [Framework]
├── expo-router             [File-based routing]
├── react-native
├── react
├── @reduxjs/toolkit        [State management]
├── react-redux             [React bindings]
├── @tanstack/react-query   [Data fetching]
├── nativewind              [Tailwind for RN]
├── tailwindcss             [Utility CSS]
└── TypeScript              [Type safety]
```

---

## 🚀 Component Usage Examples

### Using a Button

```tsx
<Button variant="primary" size="md" onPress={() => console.log('Pressed')}>
  Click Me
</Button>
```

### Using Redux

```tsx
const dispatch = useAppDispatch();
const user = useAppSelector((state) => state.user.profile);

dispatch(setUserProfile({ id: '1', name: 'Sarah' }));
```

### Using Query

```tsx
const { data: services, isLoading } = useQuery({
  queryKey: ['services'],
  queryFn: async () => fetch('/api/services').then((r) => r.json()),
});
```

### Using NativeWind

```tsx
<View className="flex-1 bg-bg-main px-lg py-xl rounded-2xl shadow-sm">
  <Text className="text-text-primary font-semibold text-lg">Hello</Text>
</View>
```

---

## ✅ Checklist

- ✅ Petopia color palette implemented
- ✅ 3-tab navigation (Social, Home, Messages)
- ✅ Redux store (Auth, User)
- ✅ TanStack Query setup
- ✅ NativeWind + Tailwind configured
- ✅ Reusable components (Button, Card, Input, Avatar, ServiceCard)
- ✅ 3 full screen components (Social, Home, Messages)
- ✅ Mock data for all screens
- ✅ TypeScript errors fixed ✅
- ✅ Project compiles without errors

---

## 🎓 File Locations for Quick Reference

| What          | Where                                         |
| ------------- | --------------------------------------------- |
| Colors        | `src/constants/colors.ts`                     |
| Spacing       | `src/constants/spacing.ts`                    |
| Buttons       | `src/components/common/Button.tsx`            |
| Social feed   | `src/components/screens/SocialFeedScreen.tsx` |
| Service hub   | `src/components/screens/HomeScreen.tsx`       |
| Messages      | `src/components/screens/MessagesScreen.tsx`   |
| Redux auth    | `src/store/slices/authSlice.ts`               |
| Redux user    | `src/store/slices/userSlice.ts`               |
| Store config  | `src/store/store.ts`                          |
| Root layout   | `app/_layout.tsx`                             |
| Tab layout    | `app/(tabs)/_layout.tsx`                      |
| Social page   | `app/(tabs)/social.tsx`                       |
| Home page     | `app/(tabs)/home.tsx`                         |
| Messages page | `app/(tabs)/messages.tsx`                     |

---

**Status: MVP Complete ✅ | Ready for Phase 2**
