# Petopia Authentication System

This is a complete, production-ready authentication system for the Petopia mobile app with a secure backend.

## Architecture

### Backend (petopia-backend/)

- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **API**: RESTful endpoints

### Frontend (petopia-mobile/)

- **State Management**: Redux Toolkit
- **API Calls**: Axios
- **Secure Storage**: expo-secure-store
- **Auth Guard**: AuthProvider Context with route protection

---

## Backend Setup

### Prerequisites

- Node.js (v14+)
- MongoDB (local or cloud instance)

### Installation

1. Navigate to backend directory:

```bash
cd petopia-backend
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables in `.env`:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/petopia
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_to_something_secure_and_long
JWT_EXPIRE=7d
NODE_ENV=development
```

4. Start MongoDB (if running locally):

```bash
mongod
```

5. Start the server:

```bash
npm start
```

Server will run on `http://localhost:5000`

---

## Backend API Endpoints

### Register a New User

**POST** `/api/auth/register`

Request body:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "confirmPassword": "securePassword123"
}
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2025-01-16T10:30:00.000Z"
  }
}
```

### Login

**POST** `/api/auth/login`

Request body:

```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

Response: Same as register

### Get Current User

**GET** `/api/auth/me`

Headers:

```
Authorization: Bearer {token}
```

Response:

```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

## Frontend Setup

### 1. Redux Auth Slice

Located in: `src/store/slices/authSlice.ts`

**State Structure**:

```typescript
{
  user: User | null; // Currently authenticated user
  token: string | null; // JWT token
  loading: boolean; // Loading state
  error: string | null; // Error messages
  isAuthenticated: boolean; // Auth flag
}
```

**Available Actions**:

- `register(credentials)` - Register new user
- `login(credentials)` - Login existing user
- `getCurrentUser(token)` - Fetch current user data
- `logout()` - Logout and clear state
- `clearError()` - Clear error messages
- `setToken(token)` - Set token in state

### 2. Secure Token Storage

Located in: `src/services/StorageService.ts`

Stores sensitive tokens using `expo-secure-store`:

```typescript
// Save token after authentication
await StorageService.saveToken(token);

// Retrieve token on app startup
const token = await StorageService.getToken();

// Clear on logout
await StorageService.clear();
```

### 3. Auth Guard & Route Protection

Located in: `src/context/AuthContext.tsx`

The `AuthProvider` wraps your entire app and:

- Restores tokens from secure storage on startup
- Redirects unauthenticated users to `/auth`
- Redirects authenticated users away from `/auth`
- Shows loading screen while checking auth state

Usage in root layout (`app/_layout.tsx`):

```tsx
<Provider store={store}>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{/* Your app navigation */}</AuthProvider>
  </QueryClientProvider>
</Provider>
```

### 4. Authentication Screen

Located in: `src/components/screens/AuthScreen.tsx`

Features:

- Toggle between Login and Sign Up modes
- Form validation
- Loading states
- Error handling with alerts
- Redux integration for state management
- Automatic token storage after successful auth
- Automatic navigation to home screen

### 5. Logout in Profile

Located in: `src/components/screens/ProfileScreen.tsx`

The profile screen includes a logout button that:

- Clears secure storage
- Clears Redux state
- Redirects to auth screen

---

## Configuration

### Update Backend URL

The backend API URL is configured in `authSlice.ts`:

```typescript
const API_BASE_URL = 'http://192.168.1.205:5000/api';
```

**Important**: Change `192.168.1.205` to your actual machine IP address or server URL for production.

To find your IP:

- Windows: `ipconfig` command
- Mac/Linux: `ifconfig` command

---

## Security Features

✅ **Password Hashing**: Passwords are hashed with bcryptjs (10 salt rounds)
✅ **JWT Tokens**: Secure token-based authentication
✅ **Secure Storage**: Tokens stored in device secure storage
✅ **CORS Protection**: Backend configured with CORS
✅ **Input Validation**: All endpoints validate required fields
✅ **Error Handling**: Sensitive errors are not exposed to client

---

## Testing the Authentication Flow

### 1. Start Backend

```bash
cd petopia-backend
npm start
```

### 2. Update API URL

If needed, update the backend IP in `src/store/slices/authSlice.ts`

### 3. Start Mobile App

```bash
cd petopia-mobile
npm start
```

### 4. Test Registration

- Open app and go to Sign Up tab
- Fill in all fields
- Click "Create Account"
- Should navigate to home screen
- Token should be saved securely

### 5. Test Login

- Clear app data to simulate fresh install (or restart)
- Go to Login tab
- Enter registered email and password
- Should automatically navigate to home screen
- Token should be restored from secure storage

### 6. Test Logout

- Navigate to Profile tab
- Click "Log Out"
- Confirm logout
- Should be redirected to Auth screen

---

## Production Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` in `.env` to a long, random string
- [ ] Update `API_BASE_URL` to your production server
- [ ] Enable HTTPS for all API calls
- [ ] Set `NODE_ENV=production` in backend `.env`
- [ ] Configure MongoDB with proper authentication
- [ ] Set up proper CORS origins
- [ ] Enable rate limiting on auth endpoints
- [ ] Set up monitoring and logging
- [ ] Use environment variables for all sensitive data
- [ ] Test all auth flows in production

---

## Troubleshooting

### "Cannot connect to backend"

- Check that backend is running: `npm start`
- Verify IP address in `authSlice.ts`
- Check firewall settings

### "Invalid token"

- Clear app data and re-register
- Check token expiration in `.env` (JWT_EXPIRE)
- Verify JWT_SECRET matches between backend and stored tokens

### "Password validation error"

- Ensure passwords match in sign up
- Password must be at least 6 characters
- Check for whitespace in inputs

### "Email already registered"

- Use a different email for new account
- Verify MongoDB connection

---

## API Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common status codes:

- `400` - Bad request (validation error)
- `401` - Unauthorized (invalid credentials)
- `500` - Server error

---

## Extending the Auth System

### Add Password Reset

1. Create `/api/auth/forgot-password` endpoint
2. Send reset email with token
3. Create `/api/auth/reset-password` endpoint
4. Update frontend with forgot password screen

### Add Email Verification

1. Add `emailVerified` field to User model
2. Send verification email on registration
3. Create `/api/auth/verify-email` endpoint
4. Prevent login until email is verified

### Add Refresh Tokens

1. Add refresh token to User model
2. Create `/api/auth/refresh` endpoint
3. Automatically refresh expired tokens
4. Implement token rotation for security

### Add Social Login

1. Integrate OAuth providers (Google, Apple, Facebook)
2. Create social login endpoints
3. Update AuthScreen with social login buttons

---

## Support

For issues or questions, contact the development team.

Last updated: January 16, 2026
