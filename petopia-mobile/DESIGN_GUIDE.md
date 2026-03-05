# Petopia Frontend - Design System & Component Guide

## 🎨 Design System Overview

Petopia follows a calm, trustworthy, emotionally warm design language optimized for pet care interactions.

### Color Palette

| Role                   | Color          | Hex       | Usage                                     |
| ---------------------- | -------------- | --------- | ----------------------------------------- |
| Primary (Trust & Care) | Soft Teal      | `#4DB6AC` | CTAs, active states, primary highlights   |
| Secondary (Nature)     | Muted Sage     | `#8BC6A8` | Secondary actions, complementary elements |
| Accent (Warmth)        | Soft Peach     | `#F4C7AB` | Engagement prompts, likes, warm touches   |
| Background             | Warm Off-White | `#FAFAF7` | Screen backgrounds                        |
| Text Primary           | Soft Charcoal  | `#2E2E2E` | Main text content                         |
| Text Muted             | Neutral Grey   | `#9CA3AF` | Secondary text, hints                     |

### Design Rules

- **Rounded corners:** `rounded-2xl` for cards, `rounded-lg` for inputs
- **Shadows:** `shadow-sm` only (no heavy shadows)
- **Light mode only** - no dark theme
- **Spacing:** 4px base unit (xs=4, sm=8, md=12, lg=16, xl=20, 2xl=24, 3xl=32, 4xl=40)
- **Typography:** Semibold for headings, medium for labels, regular for body text

---

## 📱 App Structure

### Navigation Hierarchy

```
RootLayout (Redux + Query Client Provider)
├── (tabs) [Bottom Tab Navigation]
│   ├── social.tsx → SocialFeedScreen
│   ├── home.tsx → HomeScreen
│   └── messages.tsx → MessagesScreen
└── modal.tsx [For future modal flows]
```

### Bottom Tabs (3)

| Tab             | Icon    | Screen             | Purpose                                                    |
| --------------- | ------- | ------------------ | ---------------------------------------------------------- |
| 1. **Social**   | 📱 / 📰 | `SocialFeedScreen` | Pet community, photo sharing, tips from vets               |
| 2. **Home**     | ⌂ / 🏠  | `HomeScreen`       | Service hub (vets, sitters, trainers, etc.) + Quick access |
| 3. **Messages** | 💭 / 💬 | `MessagesScreen`   | Conversations with service providers & pet owners          |

---

## 🧩 Component Architecture

### Common Components (`src/components/common/`)

#### Button

```tsx
<Button
  variant="primary" | "secondary" | "accent" | "ghost"
  size="sm" | "md" | "lg"
  onPress={() => {}}
  disabled={false}
>
  Text
</Button>
```

#### Card

```tsx
<Card>
  <CardHeader>Header content</CardHeader>
  <CardBody>Body content</CardBody>
</Card>
```

#### Input

```tsx
<Input
  label="Label"
  placeholder="Placeholder"
  value={value}
  onChangeText={setText}
  error="Error message"
  multiline={false}
  numberOfLines={1}
/>
```

#### Avatar

```tsx
<Avatar
  size="sm" | "md" | "lg"
  initials="JS"
  source={{ uri: "..." }}
/>
```

#### ServiceCard

```tsx
<ServiceCard icon={<Text>🏥</Text>} label="Veterinarians" onPress={() => {}} />
```

### Screen Components (`src/components/screens/`)

#### SocialFeedScreen

- **Props:**
  - `onCreatePost?: () => void` - Creates new post
- **Layout:**
  - Button to create post
  - Feed of `PostCard` components
  - Post shows: avatar, author, pet name, content, image, likes, comments
- **Design:**
  - Card-based layout
  - Accent color for like button
  - Heart emoji for likes, comment emoji for replies

#### HomeScreen

- **Sections:**
  1. **Header** - Greeting, user avatar (tap → profile)
  2. **Services Grid** - 8 services (2-column layout)
     - Vet, Groomer, Sitter, Trainer, Breeder, Hotel, Store, Parks
  3. **Quick Access** - Upcoming appointments, Pet health records
- **Design:**
  - Service cards use emoji icons
  - Primary/secondary cards for quick access
  - Rounded corners throughout

#### MessagesScreen

- **Layout:**
  - Search bar at top
  - Conversation list
    - Avatar, name, role (optional), last message, timestamp
    - Unread badge (accent color)
- **Design:**
  - Card-based conversation items
  - Muted text for secondary info
  - Tap to open chat

---

## 🔧 State Management

### Redux Store (`src/store/`)

**Slices:**

1. **authSlice** - Authentication state

   - `isAuthenticated: boolean`
   - `userId: string | null`
   - `token: string | null`
   - Actions: `setAuth(payload)`, `clearAuth()`

2. **userSlice** - User profile
   - `profile: { id, name, avatar?, email? } | null`
   - Actions: `setUserProfile(payload)`, `clearUserProfile()`

**Usage:**

```tsx
import { useAppDispatch, useAppSelector } from '@/hooks/useAppRedux';

const dispatch = useAppDispatch();
const user = useAppSelector((state) => state.user.profile);
```

### TanStack Query

```tsx
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['services'],
  queryFn: async () => {
    // API call
  },
});
```

---

## 📁 File Structure

```
src/
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Avatar.tsx
│   │   ├── ServiceCard.tsx
│   │   └── LoadingSpinner.tsx
│   ├── screens/
│   │   ├── SocialFeedScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   └── MessagesScreen.tsx
│   └── (future features)
├── constants/
│   ├── colors.ts
│   └── spacing.ts
├── hooks/
│   └── useAppRedux.ts
├── store/
│   ├── store.ts
│   └── slices/
│       ├── authSlice.ts
│       └── userSlice.ts
└── navigation/
    └── TabNavigator.tsx
app/
├── _layout.tsx [Root: Redux + Query Provider]
└── (tabs)/
    ├── _layout.tsx [Bottom Tab Navigation]
    ├── social.tsx
    ├── home.tsx
    └── messages.tsx
```

---

## 🚀 Quick Start

### Installation

```bash
npm install
npm start
```

### Create a New Service

1. Add to `HomeScreen.tsx` services array
2. Create service detail screen in `app/(tabs)/service-name.tsx`
3. Add route to navigation

### Add a New Feature

1. Create component in `src/components/`
2. Import in screen or parent component
3. Use NativeWind classes for styling
4. Add Redux slices if state needed

### Styling Guide

Use **NativeWind** classes (Tailwind for React Native):

```tsx
<View className="flex-1 bg-bg-main px-lg py-xl rounded-2xl shadow-sm">
  <Text className="text-text-primary font-semibold text-lg">Hello</Text>
</View>
```

**Custom colors available:**

- `bg-primary`, `bg-secondary`, `bg-accent`
- `text-primary`, `text-muted`, `text-light`
- `border-border`

---

## ✨ Design Principles

1. **Calm & Friendly** - Soft colors, ample spacing
2. **Trust-focused** - Clear information hierarchy, predictable interactions
3. **Pet-centric** - Celebrate pet photos, stories, connections
4. **Accessible** - High contrast, large touch targets
5. **Scalable** - Component-based, easy to extend

---

## 📊 MVP Scope

This is **Phase 1 - MVP** with 3 core tabs:

- ✅ Social feed
- ✅ Service directory
- ✅ Messaging

**Future phases:**

- Pet profile management
- Service booking flows
- Payment integration
- Real-time notifications
- IoT device integration

---

## 🔗 Dependencies

- **expo** - React Native framework
- **expo-router** - File-based routing
- **react-redux** - State management
- **@reduxjs/toolkit** - Redux utilities
- **@tanstack/react-query** - Data fetching & caching
- **nativewind** - Tailwind CSS for React Native
- **tailwindcss** - Utility-first CSS framework

---

## 📝 Notes

- No backend logic in this MVP - all data is mocked
- Components are functional only
- Styling is **NativeWind classes only** (no StyleSheet)
- Query Client configured with 5min stale time, 10min cache
- Redux used for auth and user state only

---

**Built with ❤️ for Petopia**
