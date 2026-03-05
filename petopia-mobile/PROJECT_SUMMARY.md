# Petopia Mobile Frontend - MVP Complete ✅

## 🎯 Project Overview

**Petopia** is a comprehensive pet care super-app MVP with 3 core features:

1. **Social Feed** - Pet owners and vets share stories, tips, and photos
2. **Service Hub** - One-stop directory for all pet services (vets, sitters, trainers, etc.)
3. **Messaging** - Direct communication with service providers and pet owners

---

## 📱 What's Built

### Tab Navigation (3 Screens)

#### Tab 1: **Social** (`social.tsx`)

- **Component:** `SocialFeedScreen`
- **Features:**
  - "Share a moment" button (accent color)
  - Post cards showing: avatar, author name, pet name, content, image, likes, comments
  - Like (♥️) and comment (💬) actions
  - Mocked posts from owners and vets
- **Design:** Card-based, friendly spacing, accent color for engagement

#### Tab 2: **Home** (`home.tsx`)

- **Component:** `HomeScreen`
- **Sections:**
  - **Header** - Greeting with user avatar (tappable for profile)
  - **Services Grid** - 8 service cards (2-column layout):
    - 🏥 Veterinarians
    - ✂️ Groomers
    - 🤝 Pet Sitters
    - 🐕‍🦺 Trainers
    - 💕 Breeders
    - 🏨 Pet Hotels
    - 🛒 Pet Stores
    - 🌳 Pet Parks
  - **Quick Access** - Upcoming appointments & pet health records
- **Design:** Emoji icons, soft colors, rounded cards, primary/secondary tinted backgrounds

#### Tab 3: **Messages** (`messages.tsx`)

- **Component:** `MessagesScreen`
- **Features:**
  - Search bar for conversations
  - Conversation list with:
    - Avatar, name, role tag (vet/sitter/owner)
    - Last message preview
    - Timestamp
    - Unread badge (accent color)
  - Mocked conversations with vets, sitters, trainers, other owners
- **Design:** Clean list, secondary info muted, badges for unread

---

## 🧩 Component Library

### Common Components (`src/components/common/`)

| Component          | Props                                                 | Purpose                                      |
| ------------------ | ----------------------------------------------------- | -------------------------------------------- |
| **Button**         | `variant`, `size`, `onPress`, `disabled`              | Primary CTA, secondary, accent, ghost        |
| **Card**           | `children`                                            | Container with soft shadow & rounded corners |
| **Input**          | `label`, `placeholder`, `value`, `error`, `multiline` | Text input with validation                   |
| **Avatar**         | `initials`, `size`, `source`                          | User/pet profile picture or initials         |
| **ServiceCard**    | `icon`, `label`, `onPress`                            | Service directory card                       |
| **LoadingSpinner** | -                                                     | Loading indicator                            |

### Screen Components (`src/components/screens/`)

- **SocialFeedScreen** - Post feed with create button
- **HomeScreen** - Service hub + quick access
- **MessagesScreen** - Conversation list

---

## 🎨 Design System

### Colors (Petopia Palette)

```
Primary (Teal):     #4DB6AC  ← Trust & care
Secondary (Sage):   #8BC6A8  ← Nature
Accent (Peach):     #F4C7AB  ← Warmth & engagement
Background:         #FAFAF7  ← Warm off-white
Text Primary:       #2E2E2E  ← Soft charcoal
Text Muted:         #9CA3AF  ← Neutral grey
```

### Styling Standards

- **All styling via NativeWind** (Tailwind for React Native)
- **Rounded corners:** `rounded-2xl` (cards), `rounded-lg` (inputs)
- **Shadows:** `shadow-sm` only
- **Light mode only** (no dark theme in MVP)
- **Spacing:** 4px base unit (xs, sm, md, lg, xl, 2xl, 3xl, 4xl)

---

## 🔧 Tech Stack

| Layer            | Technology                                |
| ---------------- | ----------------------------------------- |
| Framework        | Expo (React Native)                       |
| Routing          | Expo Router (file-based)                  |
| State Management | Redux Toolkit (auth, user)                |
| Data Fetching    | TanStack Query (with placeholder usage)   |
| Styling          | NativeWind + Tailwind CSS                 |
| UI Components    | Native React Native (no external UI libs) |
| Package Manager  | npm                                       |

### Installed Dependencies

- ✅ `expo` - Framework
- ✅ `expo-router` - File-based routing
- ✅ `@reduxjs/toolkit` - Redux store
- ✅ `react-redux` - React Redux bindings
- ✅ `@tanstack/react-query` - Data fetching & caching
- ✅ `nativewind` - Tailwind CSS for RN
- ✅ `tailwindcss` - Utility CSS framework

---

## 📁 Project Structure

```
petopia-mobile/
├── app/
│   ├── _layout.tsx          ← Root: Redux + Query Provider
│   └── (tabs)/
│       ├── _layout.tsx      ← Bottom tab navigation
│       ├── index.tsx        → Social (social.tsx)
│       ├── social.tsx       ← NEW: Social feed
│       ├── home.tsx         ← NEW: Service hub
│       ├── messages.tsx     ← NEW: Messaging
│       └── explore.tsx      → Messages (explore.tsx)
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── ServiceCard.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   └── screens/
│   │       ├── SocialFeedScreen.tsx
│   │       ├── HomeScreen.tsx
│   │       └── MessagesScreen.tsx
│   ├── constants/
│   │   ├── colors.ts        ← Petopia color palette
│   │   └── spacing.ts       ← Spacing scale
│   ├── hooks/
│   │   └── useAppRedux.ts   ← useAppDispatch, useAppSelector
│   └── store/
│       ├── store.ts         ← Redux store setup
│       └── slices/
│           ├── authSlice.ts ← Auth state (isAuthenticated, userId, token)
│           └── userSlice.ts ← User state (profile)
├── babel.config.js          ← NativeWind setup
├── tailwind.config.js       ← Tailwind theme
├── tsconfig.json            ← TypeScript config
├── package.json
├── DESIGN_GUIDE.md          ← Complete design documentation
└── [other config files]
```

---

## 🚀 Quick Start

### 1. Install & Start

```bash
# Dependencies are already installed
npm start

# Press 's' for Android, 'i' for iOS, 'w' for web
```

### 2. Build a New Service

Example: Add a new service to the grid

```tsx
// In HomeScreen.tsx
const services: Service[] = [
  // ... existing services ...
  { id: '9', icon: '🐾', label: 'New Service' },
];

// Define handler
const handleServicePress = (serviceId: string) => {
  // Navigate to service detail screen
};
```

### 3. Add Redux State

```tsx
// Create new slice: src/store/slices/servicesSlice.ts
const servicesSlice = createSlice({
  name: 'services',
  initialState: { services: [] },
  reducers: {
    /* ... */
  },
});

// Add to store
export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    services: servicesReducer, // ← Add here
  },
});
```

### 4. Fetch Data with Query

```tsx
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['services'],
  queryFn: async () => {
    const response = await fetch('/api/services');
    return response.json();
  },
});
```

---

## ✨ Design Highlights

### Calm, Trustworthy, Warm

- **Soft teal** (#4DB6AC) for trust & care
- **Muted sage** (#8BC6A8) for natural, organic feel
- **Soft peach** (#F4C7AB) for warmth & engagement
- **Rounded corners** everywhere (friendly, approachable)
- **Ample spacing** (not cramped, breathing room)
- **Soft shadows only** (no harsh contrasts)

### Pet-Centric

- **Photo-sharing in social** (celebrate pet moments)
- **Emoji icons** for services (fun, accessible)
- **Community focus** (owners connect with owners)
- **Professional trust** (vets, trainers share expertise)

---

## 🔐 State Management

### Redux (Auth & User)

```tsx
// Get auth state
const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

// Dispatch auth action
const dispatch = useAppDispatch();
dispatch(setAuth({ userId: 'user1', token: 'token123' }));

// Get user profile
const user = useAppSelector((state) => state.user.profile);
```

### Query Client (Data Fetching)

```tsx
// Already configured in root _layout.tsx
// 5-minute stale time, 10-minute cache
// Ready to use with useQuery()
```

---

## 📝 Notes

- **No backend logic** - All data is mocked for MVP
- **Functional components only** - No class components
- **NativeWind classes only** - No StyleSheet.create()
- **TypeScript** - Full type safety
- **Mobile-first** - Responsive, touch-friendly
- **Scalable** - Component-based, easy to extend

---

## 🎓 Next Steps (Future Phases)

### Phase 2

- Pet profile creation & health records
- Service booking flows
- Payments integration

### Phase 3

- Real-time messaging (WebSocket)
- GPS tracking for pet sitters
- IoT device integration

### Phase 4

- Push notifications
- Social features (friends, blocking)
- Analytics & insights

---

## 📖 Documentation

See **DESIGN_GUIDE.md** for:

- Complete color palette
- Component API reference
- Styling guide
- File structure explanation
- Redux/Query examples

---

**Built with ❤️ for Petopia**
**Status: MVP Complete ✅**
**Ready to build: Phase 2**
