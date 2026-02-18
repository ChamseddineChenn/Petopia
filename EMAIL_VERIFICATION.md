# Email Verification System Documentation

## Overview

The Petopia application now includes a secure email verification system using Nodemailer. Users must verify their email address before they can log in, ensuring valid email ownership and reducing spam accounts.

## Features

✅ Secure email verification with tokens  
✅ 24-hour token expiration  
✅ Resend verification email functionality  
✅ Beautiful HTML email templates  
✅ Auto-login after email verification  
✅ Token hashing for security  
✅ Error handling and user feedback

## How It Works

### 1. Registration Flow

```
User Signup → Create User (emailVerified: false) → Generate Verification Token
→ Send Verification Email → Show Verification Screen
```

### 2. Token Generation & Storage

- **Token Generation**: Uses `crypto.randomBytes(32)` to create cryptographically secure tokens
- **Token Storage**: Tokens are hashed with SHA-256 before storage in MongoDB
- **Token Expiry**: Set to 24 hours from generation
- **Security**: Only the hashed token is stored; the unhashed token is sent to user's email

### 3. Email Verification Process

```
User Clicks Link in Email → Frontend Extracts Token
→ POST /api/auth/verify-email with Token → Backend Hashes Token
→ Matches with DB → Marks emailVerified: true → Auto-Login
```

### 4. Backend Endpoints

#### POST /api/auth/register

Creates user and sends verification email.

**Request:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Registration successful! Please check your email to verify your account.",
  "user": {
    "_id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": false
  }
}
```

#### POST /api/auth/verify-email

Verifies email with provided token.

**Request:**

```json
{
  "token": "verification_token_from_email"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Email verified successfully!",
  "token": "jwt_token",
  "user": {
    "_id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": true
  }
}
```

**Response (Error - Invalid/Expired Token):**

```json
{
  "success": false,
  "message": "Invalid or expired verification token"
}
```

#### POST /api/auth/resend-verification

Resends verification email if user didn't receive it.

**Request:**

```json
{
  "email": "john@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Verification email sent"
}
```

#### POST /api/auth/login

Login now requires verified email.

**Response (Unverified Email):**

```json
{
  "success": false,
  "message": "Please verify your email before logging in",
  "emailVerificationRequired": true
}
```

## Setup Instructions

### 1. Gmail Configuration (Recommended for Development)

#### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification

#### Step 2: Generate App Password

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Windows Computer" (or your device)
3. Generate a 16-character password
4. Copy this password

#### Step 3: Update .env

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_16_character_app_password
EMAIL_FROM=noreply@petopia.com
VERIFICATION_TOKEN_EXPIRE=24h
FRONTEND_URL=http://192.168.1.205:8081
```

### 2. Alternative Email Services

#### SendGrid

```env
EMAIL_SERVICE=SendGrid API
EMAIL_USER=apikey
EMAIL_PASSWORD=your_sendgrid_api_key
EMAIL_FROM=noreply@petopia.com
```

#### Mailgun

```env
EMAIL_SERVICE=Mailgun
EMAIL_USER=postmaster@mg.yourdomain.com
EMAIL_PASSWORD=your_mailgun_api_key
EMAIL_FROM=noreply@petopia.com
```

### 3. Update FRONTEND_URL

The `FRONTEND_URL` environment variable is used to generate verification links. Update it to your machine's IP address:

```env
FRONTEND_URL=http://YOUR_MACHINE_IP:8081
```

**Note:** This URL must be accessible from the Expo app. For local development on the same machine, use your local IP address (e.g., 192.168.x.x).

## Security Considerations

### 1. Token Security

- ✅ Tokens are 32 bytes of cryptographic randomness
- ✅ Tokens are hashed with SHA-256 before storage
- ✅ Tokens expire after 24 hours
- ✅ Invalid/expired tokens cannot verify accounts

### 2. Email Headers

```
From: noreply@petopia.com (no-reply address to prevent accidental replies)
Subject: Clear, verified-looking subject
HTML: Professional template with security warnings
```

### 3. Best Practices

- ✅ Never log the unhashed verification token
- ✅ Use HTTPS in production (not HTTP)
- ✅ Store JWT_SECRET securely (environment variable)
- ✅ Rotate JWT_SECRET periodically in production
- ✅ Use environment-specific credentials

### 4. Rate Limiting (Recommended for Production)

Add rate limiting to prevent email flooding:

```javascript
const rateLimit = require('express-rate-limit');

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many verification attempts, please try again later',
});

router.post('/verify-email', verifyLimiter, async (req, res) => {
  // ... existing code
});
```

## Frontend Implementation

### User Registration

1. User fills signup form with name, email, password
2. On submit, Redux calls `register()` thunk
3. If successful, `pendingVerification` flag is set
4. `VerificationScreen` is displayed
5. User receives verification email

### Email Verification

1. User clicks verification link in email (or copies code)
2. If clicking link, token is extracted from URL
3. If copying code, user pastes into input field
4. Redux calls `verifyEmail(token)` thunk
5. On success, user is auto-logged in and redirected to home

### Resend Verification Email

1. If user doesn't receive email, they can click "Resend"
2. Redux calls `resendVerification(email)` thunk
3. New verification email is sent
4. Token is regenerated and stored

## Testing

### Manual Testing

1. **Sign Up**

   ```
   Start app → Sign Up tab → Fill form → Submit
   Expected: Verification screen appears with masked email
   ```

2. **Check Email**

   ```
   Check Gmail/email inbox for verification email
   Expected: Professional HTML email with verification link
   ```

3. **Verify Email**
   - **Option A**: Click link in email (automatically extracts token)
   - **Option B**: Copy code and paste in verification screen

   ```
   Expected: Auto-login and redirect to home screen
   ```

4. **Test Resend**

   ```
   If email not received → Click "Resend"
   Expected: New verification email sent
   ```

5. **Test Login Restriction**
   ```
   Try logging in with unverified email
   Expected: Error message "Please verify your email before logging in"
   ```

### Automated Testing (Example with Jest)

```javascript
describe('Email Verification', () => {
  it('should send verification email on signup', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.emailVerified).toBe(false);
  });

  it('should verify email with valid token', async () => {
    // Create user
    const user = await User.create({
      name: 'Test',
      email: 'test@example.com',
      password: 'password123',
    });

    // Generate token
    const token = user.generateVerificationToken();
    await user.save();

    // Verify
    const response = await request(app)
      .post('/api/auth/verify-email')
      .send({ token });

    expect(response.status).toBe(200);
    expect(response.body.user.emailVerified).toBe(true);
  });

  it('should reject invalid token', async () => {
    const response = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'invalid_token' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid');
  });
});
```

## Troubleshooting

### Email Not Sending

**Problem**: "Failed to send verification email"

**Solutions**:

1. Check `.env` file has correct email credentials
2. For Gmail: Verify App Password is correct (16 characters)
3. Verify Gmail 2-FA is enabled
4. Check email service is not blocking SMTP
5. Look at server logs for detailed error

### Verification Link Not Working

**Problem**: "Invalid or expired verification token"

**Solutions**:

1. Check token hasn't expired (24-hour limit)
2. Verify frontend-URL in `.env` is correct
3. Check token isn't corrupted during transmission
4. Try resending verification email

### User Stuck on Verification Screen

**Problem**: User verified email but still on verification screen

**Solutions**:

1. Check `emailVerified` field in MongoDB for user
2. Verify token was properly hashed and stored
3. Check Redux state for `isAuthenticated` flag
4. Review browser console for API errors

### Email Marked as Spam

**Problem**: Verification email goes to spam folder

**Solutions**:

1. Use professional email domain (not noreply@example.com)
2. Add SPF/DKIM records to domain DNS
3. Include proper headers in email template
4. Use SendGrid/Mailgun for better deliverability

## Production Deployment

### Pre-Deployment Checklist

- [ ] Email credentials configured in production `.env`
- [ ] FRONTEND_URL points to production domain
- [ ] HTTPS enabled for all endpoints
- [ ] Email service provider supports your email volume
- [ ] SMS backup verification option available (optional)
- [ ] Rate limiting enabled on verification endpoints
- [ ] Error logging configured
- [ ] Database backups enabled
- [ ] CORS configured for production domain

### Environment Variables (Production)

```env
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/petopia
JWT_SECRET=very_long_random_string_minimum_32_characters
JWT_EXPIRE=7d
NODE_ENV=production

EMAIL_SERVICE=gmail
EMAIL_USER=noreply@petopia.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@petopia.com
VERIFICATION_TOKEN_EXPIRE=24h
FRONTEND_URL=https://petopia.com
```

### Scaling Considerations

1. **Email Queue**: For high volume, use a queue system (Bull, Kue)
2. **Template Caching**: Cache email templates
3. **Rate Limiting**: Stricter limits in production
4. **Monitoring**: Set up email delivery monitoring
5. **Backup Service**: Have fallback email provider

## API Reference Summary

| Endpoint                        | Method | Purpose                                  | Auth Required |
| ------------------------------- | ------ | ---------------------------------------- | ------------- |
| `/api/auth/register`            | POST   | Create account & send verification email | No            |
| `/api/auth/verify-email`        | POST   | Verify email with token                  | No            |
| `/api/auth/resend-verification` | POST   | Resend verification email                | No            |
| `/api/auth/login`               | POST   | Login (requires verified email)          | No            |
| `/api/auth/me`                  | GET    | Get current user                         | Yes           |

## File Structure

```
petopia-backend/
├── services/
│   └── emailService.js          # Email sending logic
├── routes/
│   └── auth.js                  # Updated with verification endpoints
├── models/
│   └── User.js                  # Updated with emailVerified fields
├── middleware/
│   └── auth.js                  # JWT middleware
└── .env                         # Email configuration

petopia-mobile/
├── src/
│   ├── store/slices/
│   │   └── authSlice.ts         # Updated with verify/resend thunks
│   ├── components/screens/
│   │   ├── AuthScreen.tsx       # Shows verification screen when pending
│   │   └── VerificationScreen.tsx # Email verification UI
│   ├── context/
│   │   └── AuthContext.tsx      # Auth state management
│   └── services/
│       └── StorageService.ts    # Secure token storage
```

## Next Steps

1. ✅ Email verification is implemented
2. 📧 Configure email credentials in `.env`
3. 🧪 Test the complete flow locally
4. 🔒 Add password reset functionality (similar pattern)
5. 📱 Add SMS verification as backup (optional)
6. 🌐 Deploy to production
7. 📊 Monitor email delivery and user drop-off

## FAQ

**Q: Can users skip email verification?**  
A: No, email verification is mandatory before login.

**Q: How long is the verification token valid?**  
A: 24 hours. Users can request resend if it expires.

**Q: What if user uses wrong email?**  
A: They should create new account with correct email.

**Q: Is the verification process secure?**  
A: Yes - tokens are cryptographically secure, hashed in DB, and time-limited.

**Q: Can we customize the email template?**  
A: Yes, modify `/services/emailService.js` HTML templates.

**Q: What if email service goes down?**  
A: Set up alerting and have manual verification override for support team.

## Support

For issues or questions:

1. Check server logs: `npm run dev`
2. Check browser DevTools console
3. Verify `.env` configuration
4. Test with different email providers
5. Review email service provider status page
