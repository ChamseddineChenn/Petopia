# ✅ PETOPIA AUTH SYSTEM - SETUP CHECKLIST

## 🎯 Pre-Flight Checks

- [ ] Read TECH_STACK.md (5 min overview)
- [ ] Read AUTH_QUICKSTART.md (quick reference)
- [ ] Have MongoDB installed or accessible
- [ ] Have Node.js 14+ installed
- [ ] Know your machine IP address

---

## 🔧 Backend Setup

### Step 1: Navigate to Backend

```bash
cd petopia-backend
```

- [ ] Directory exists
- [ ] package.json found

### Step 2: Install Dependencies

```bash
npm install
```

- [ ] All packages installed
- [ ] No errors in console

### Step 3: Configure Environment

- [ ] .env file exists
- [ ] PORT=5000
- [ ] MONGODB_URI set correctly
- [ ] JWT_SECRET configured
- [ ] NODE_ENV=development

### Step 4: Start MongoDB

```bash
mongod
```

- [ ] MongoDB running on localhost:27017
- [ ] "waiting for connections on port 27017" message

### Step 5: Start Backend Server

```bash
npm start
```

- [ ] "Server running on port 5000" message
- [ ] No connection errors
- [ ] Ready for requests

---

## 📱 Frontend Setup

### Step 1: Navigate to Mobile App

```bash
cd petopia-mobile
```

- [ ] Directory exists
- [ ] package.json found
- [ ] node_modules installed

### Step 2: Update API Configuration

File: `src/store/slices/authSlice.ts`

- [ ] Find line with `API_BASE_URL`
- [ ] Update IP address to your machine IP
- [ ] Example: `http://192.168.1.205:5000/api`

### Step 3: Start Mobile App

```bash
npm start
```

- [ ] Expo bundler starts
- [ ] Metro bundler running
- [ ] QR code displayed
- [ ] Web URL shown: http://localhost:8082

### Step 4: Choose Platform

- [ ] Press 'w' for web, or
- [ ] Scan QR with Expo Go app on device

---

## 🧪 Feature Testing

### Test 1: User Registration

- [ ] App loads at auth screen
- [ ] Click "Sign Up" tab
- [ ] Enter name (e.g., "John Doe")
- [ ] Enter email (e.g., "john@example.com")
- [ ] Enter password (e.g., "password123")
- [ ] Confirm password matches
- [ ] Click "Create Account"
- [ ] Loading state shows
- [ ] Navigate to home screen ✅
- [ ] Token saved securely ✅

### Test 2: User Login

- [ ] Go to login tab
- [ ] Enter registered email
- [ ] Enter correct password
- [ ] Click "Login"
- [ ] Loading state shows
- [ ] Navigate to home screen ✅

### Test 3: Invalid Credentials

- [ ] Go to login tab
- [ ] Enter wrong password
- [ ] Click "Login"
- [ ] Error alert shows: "Invalid credentials" ✅

### Test 4: Duplicate Email

- [ ] Try to sign up with existing email
- [ ] Error alert shows: "Email already registered" ✅

### Test 5: Password Mismatch

- [ ] Go to sign up
- [ ] Enter different passwords
- [ ] Error message shows: "Passwords do not match" ✅

### Test 6: Session Persistence

- [ ] Close app completely
- [ ] Wait 5 seconds
- [ ] Reopen app
- [ ] Still at home screen (already logged in) ✅
- [ ] No login required ✅

### Test 7: Logout

- [ ] Click Profile tab
- [ ] Find "Log Out" button
- [ ] Click "Log Out"
- [ ] Confirm logout in alert
- [ ] Redirected to auth screen ✅
- [ ] Cannot go back (protected) ✅

### Test 8: Navigation After Logout

- [ ] After logout, at auth screen
- [ ] Click "Login" tab
- [ ] Should be able to log in again ✅

---

## 🔍 Verification Checks

### Backend Verification

- [ ] MongoDB has users collection
- [ ] Users are hashed, not plain text
- [ ] /api/auth/register returns token
- [ ] /api/auth/login returns token
- [ ] /api/auth/me requires Authorization header
- [ ] Invalid token returns 401 error

### Frontend Verification

- [ ] Redux auth state updates on login
- [ ] Token stored in secure storage
- [ ] Token retrieved on app restart
- [ ] Routes protected (can't access without token)
- [ ] Profile shows user name from Redux
- [ ] Logout clears everything

### Database Verification

- [ ] Open MongoDB Compass or mongosh
- [ ] Connect to localhost:27017
- [ ] Check 'petopia' database
- [ ] Check 'users' collection
- [ ] Verify user documents have:
  - [ ] \_id (ObjectId)
  - [ ] name (string)
  - [ ] email (string, lowercase)
  - [ ] password (hashed string, not plain)
  - [ ] createdAt (date)
  - [ ] updatedAt (date)

---

## 🐛 Troubleshooting

### Backend Won't Start

- [ ] Check MongoDB is running: `mongod`
- [ ] Check port 5000 is free
- [ ] Check .env file exists
- [ ] Check MONGODB_URI is correct
- [ ] Check npm dependencies installed

### Mobile App Can't Connect

- [ ] Check backend is running: `npm start` in petopia-backend
- [ ] Check IP address in authSlice.ts
- [ ] Find correct IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- [ ] Make sure mobile device on same network
- [ ] Clear app cache and retry

### Registration Fails

- [ ] Check all fields are filled
- [ ] Check password is at least 6 chars
- [ ] Check passwords match
- [ ] Check email format is valid
- [ ] Check email not already registered in DB

### Login Fails

- [ ] Check email is registered in DB
- [ ] Check password is correct
- [ ] Check caps lock is off
- [ ] Check MongoDB is still running
- [ ] Check backend server still running

### Token Not Saving

- [ ] Check expo-secure-store is installed
- [ ] Restart app
- [ ] Clear app data and reinstall
- [ ] Check StorageService.ts code

### Can't Navigate After Login

- [ ] Check AuthProvider is in \_layout.tsx
- [ ] Check token is actually saved
- [ ] Check Redux state has isAuthenticated=true
- [ ] Restart Metro bundler (Ctrl+C, npm start)

---

## 📊 Final Status Check

### Backend Components

- [ ] server.js - Express server configured
- [ ] User.js - MongoDB schema with hashing
- [ ] auth.js - All endpoints working
- [ ] middleware/auth.js - JWT verification
- [ ] .env - All variables set

### Frontend Components

- [ ] authSlice.ts - Redux state management
- [ ] StorageService.ts - Secure token storage
- [ ] AuthContext.tsx - Route protection
- [ ] AuthScreen.tsx - Login/signup UI
- [ ] ProfileScreen.tsx - Logout functionality
- [ ] \_layout.tsx - AuthProvider integrated

### API Integration

- [ ] POST /api/auth/register working
- [ ] POST /api/auth/login working
- [ ] GET /api/auth/me protected
- [ ] Error handling working
- [ ] Token in Authorization header

### Security

- [ ] Passwords hashed (not plain text)
- [ ] JWT tokens issued with expiry
- [ ] Tokens stored encrypted
- [ ] Routes protected
- [ ] Sensitive errors not exposed

---

## 🚀 Ready to Deploy?

### Before Deployment

- [ ] All tests passing locally
- [ ] No console errors
- [ ] No warnings about dependencies
- [ ] Backend configured for cloud
- [ ] Database backups set up
- [ ] Error logging configured
- [ ] Environment variables set

### Deployment Steps

1. [ ] Deploy backend to cloud (Heroku, AWS, etc.)
2. [ ] Update API_BASE_URL to production URL
3. [ ] Change JWT_SECRET to secure random string
4. [ ] Enable HTTPS
5. [ ] Test all flows again
6. [ ] Monitor for errors

---

## 📚 Reference

| Document                  | Purpose      | Read When          |
| ------------------------- | ------------ | ------------------ |
| TECH_STACK.md             | Overview     | Getting started    |
| AUTH_QUICKSTART.md        | Quick ref    | Need quick answers |
| AUTHENTICATION.md         | Full docs    | Need detailed info |
| IMPLEMENTATION_SUMMARY.md | What changed | Reviewing code     |
| RESOURCE_GUIDE.md         | File guide   | Finding files      |
| This file                 | Checklist    | Setting up         |

---

## 🎓 Learning Path

1. **Day 1**: Read TECH_STACK.md, run backend & app, test basic flow
2. **Day 2**: Review authSlice.ts, understand Redux integration
3. **Day 3**: Review AuthScreen.tsx, understand form handling
4. **Day 4**: Review server-side code (server.js, auth.js routes)
5. **Day 5**: Review StorageService.ts and AuthContext.tsx
6. **Day 6**: Test all features thoroughly
7. **Day 7**: Deploy to production

---

## ✅ Sign-Off

When all checks are complete, your system is:

- ✅ Secure
- ✅ Complete
- ✅ Tested
- ✅ Ready for production
- ✅ Documented
- ✅ Maintainable
- ✅ Extensible

**🎉 YOU'RE DONE!**

---

**Checklist Date**: January 16, 2026
**Status**: Ready to Use
**All Sections**: Complete

Print this page and check off each item as you go!
