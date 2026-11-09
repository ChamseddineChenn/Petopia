# Petopia

Petopia is a pet-care application with a React Native mobile client and an Express API. The codebase brings together pet profiles, social features, service discovery, appointment workflows, messaging, shopping, and payment-related functionality.

This repository is an active development project. The feature list below describes the modules and route groups present in the source code. It should not be read as a claim that every integration is deployed or that the application has completed a regulatory certification process.

## Repository structure

| Directory | Purpose | Main technologies |
| --- | --- | --- |
| `petopia-mobile/` | iOS, Android, and web client using Expo | React Native, Expo, TypeScript |
| `petopia-backend/` | REST API, real-time communication, and integrations | Node.js, Express, MongoDB |

## Mobile application

The mobile client uses Expo Router for navigation and includes screens and flows for:

- User authentication and account management
- Pet profiles and pet information
- Social feed, posts, and post details
- Veterinary clinic discovery and appointment booking
- Groomer discovery, shop information, and grooming appointments
- Pet shops, product browsing, and cart
- Direct messaging and conversation screens
- Health records
- Notifications
- Wallet, top-up, and withdrawal screens
- Service-provider management screens for clinics, groomer shops, and pet shops

The client uses Redux Toolkit for application state, TanStack Query for data access, NativeWind for styling, and Expo Secure Store for secure local storage.

## Backend modules

The Express API currently mounts route groups for:

- Authentication and user accounts
- Pets and social posts
- User profiles and uploads
- Veterinary clinics, reviews, and appointments
- Groomers, grooming reviews, and grooming appointments
- Pet shops and shopping cart
- Health records
- Chat and notifications
- Wallet, payments, and payouts

The backend uses MongoDB and Mongoose for persistence. Socket.IO provides real-time communication. The project also includes integrations for Stripe, Cloudinary, Firebase Admin, and email delivery.

## Technology

**Mobile**
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

**Backend**
- Node.js
- Express 4
- MongoDB and Mongoose
- Socket.IO
- JWT authentication
- bcryptjs
- Stripe
- Cloudinary
- Firebase Admin
- Helmet
- express-rate-limit
- express-mongo-sanitize
- hpp

## Local development

The backend and mobile client run as separate applications.

### 1. Backend API

```bash
cd petopia-backend
npm install
```

Create a local `.env` file in `petopia-backend/` with at least:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

Other integrations require their own provider credentials. Configure Stripe, Cloudinary, Firebase messaging, and email settings according to the integration code before using those features.

Start the API:

```bash
npm run dev
```

The server listens on port `5000` by default. Its health endpoint is `/health`.

### 2. Mobile application

```bash
cd petopia-mobile
npm install
```

Before starting the app, check `src/config.ts`. The current `API_BASE_URL` is built from a local network IP address. Replace that host with the address of the machine running the backend, or with the correct API host for your environment.

Start Expo:

```bash
npm start
```

The package also provides `npm run android`, `npm run ios`, `npm run web`, and `npm run lint`.

## Configuration and deployment

The backend refuses to start if `JWT_SECRET` or `MONGODB_URI` is missing. Keep provider credentials in the backend environment and never place server-side secrets in the mobile application.

The repository includes a Firebase client configuration file for the mobile project. Configure the matching Firebase project and backend messaging credentials when enabling push notifications.

## Development notes

The mobile client and backend are developed together. When changing API routes or response shapes, update the corresponding mobile service and screen code. Test authentication, booking, messaging, uploads, and payment flows against a development environment before deploying.
