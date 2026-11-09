# Petopia Mobile

This folder contains the Petopia mobile client, built with React Native and Expo.

## Main technologies

- React Native 0.81
- Expo SDK 54
- Expo Router
- TypeScript
- NativeWind
- Redux Toolkit
- TanStack Query
- Axios
- Socket.IO client
- Stripe React Native
- Expo Secure Store
- Expo Notifications

## Application areas

The mobile app includes navigation and screens for pet profiles, social posts, service discovery, veterinary and grooming appointments, messaging, health records, shops, cart, notifications, and wallet-related flows.

## Local development

```bash
npm install
npm start
```

Before launching the app, open `src/config.ts` and update the API host in `API_BASE_URL`. The current source uses a local network IP address, which must point to the machine running the backend.

Useful commands:

```bash
npm run android
npm run ios
npm run web
npm run lint
```

The API is maintained in the sibling `petopia-backend/` directory. See the [repository README](../README.md) for backend setup, environment variables, and the complete architecture.
