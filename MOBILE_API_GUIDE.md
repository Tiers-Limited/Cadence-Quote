# Mobile API Guide

## Base URL
```
http://localhost:4001/api/v1/mbl/auth
```

## Rate Limits
- **Signup/Resend Code**: 3 requests per hour
- **Login/Verify/Reset**: 5 requests per 15 minutes
- **Password Reset Request**: 3 requests per hour

---

## 1. Sign Up - Request Verification Code

**Endpoint:** `POST /signup`

**Request:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "phoneNumber": "+1234567890",
  "address": "123 Main St, Austin, TX"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Verification code sent to your email. Please check your inbox.",
  "data": {
    "email": "john@example.com",
    "expiresIn": 600
  }
}
```

**Notes:**
- Password must be 8+ characters with uppercase, lowercase, and number
- Verification code expires in 10 minutes

---

## 2. Sign Up - Verify Code

**Endpoint:** `POST /verify-signup`

**Request:**
```json
{
  "email": "john@example.com",
  "code": "123456"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful! Welcome aboard.",
  "data": {
    "user": {
      "id": 1,
      "fullName": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890",
      "address": "123 Main St, Austin, TX",
      "role": "customer",
      "emailVerified": true,
      "tenantId": 1
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Notes:**
- Maximum 5 verification attempts
- Code expires in 10 minutes

---

## 3. Resend Verification Code

**Endpoint:** `POST /resend-signup-code`

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "New verification code sent to your email.",
  "data": {
    "email": "john@example.com",
    "expiresIn": 600
  }
}
```

**Notes:**
- Generates new 6-digit code
- Resets attempt counter

---

## 4. Sign In

**Endpoint:** `POST /signin`

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "fullName": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "emailVerified": true,
      "tenantId": 1,
      "tenant": {
        "id": 1,
        "companyName": "Bobby's Prime Choice Painting",
        "subscriptionPlan": "enterprise"
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 5. Google Sign In

**Endpoint:** `POST /google`

**Request:**
```json
{
  "googleId": "112492022184733928157",
  "email": "john@gmail.com",
  "fullName": "John Doe",
  "photoUrl": "https://lh3.googleusercontent.com/..."
}
```

**Field Requirements:**
- `googleId` (required): Google user ID from Flutter Google Sign In
- `email` (required): User's email address
- `fullName` (optional): User's full name
- `photoUrl` (optional): Profile picture URL

**Response (200 for existing, 201 for new):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "fullName": "John Doe",
      "email": "john@gmail.com",
      "role": "customer",
      "emailVerified": true,
      "profilePicture": "https://lh3.googleusercontent.com/...",
      "tenantId": 1,
      "tenant": {
        "id": 1,
        "companyName": "Bobby's Prime Choice Painting",
        "subscriptionPlan": "enterprise"
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isNewUser": false
  }
}
```

**Notes:**
- Automatically creates account if user doesn't exist

---

## 6. Apple Sign In

**Endpoint:** `POST /apple`

**Request:**
```json
{
  "identityToken": "apple-identity-token",
  "email": "john@privaterelay.appleid.com",
  "fullName": "John Doe"
}
```

**Response (200 for existing, 201 for new):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": 2,
      "fullName": "John Doe",
      "email": "john@privaterelay.appleid.com",
      "role": "customer",
      "emailVerified": true,
      "tenantId": 1,
      "tenant": {
        "id": 1,
        "companyName": "Bobby's Prime Choice Painting",
        "subscriptionPlan": "enterprise"
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isNewUser": true
  }
}
```

**Notes:**
- Full name only provided on first sign-in
- Email may be private relay address

---

## 7. Forgot Password - Request Verification Code

**Endpoint:** `POST /forgot-password`

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "If your email is registered, you will receive a verification code shortly.",
  "data": {
    "email": "john@example.com",
    "expiresIn": 600
  }
}
```

**Notes:**
- Always returns success (security measure)
- Sends 6-digit verification code to email
- Code expires in 10 minutes

---

## 8. Reset Password - Verify Code

**Endpoint:** `POST /reset-password`

**Request:**
```json
{
  "email": "john@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful. You can now login with your new password."
}
```

**Notes:**
- Password must be 8+ characters with uppercase, lowercase, and number
- Maximum 5 verification attempts
- Code expires in 10 minutes

---

## 9. Resend Password Reset Code

**Endpoint:** `POST /resend-reset-code`

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "New verification code sent to your email.",
  "data": {
    "email": "john@example.com",
    "expiresIn": 600
  }
}
```

**Notes:**
- Generates new 6-digit code
- Resets attempt counter

---

## Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Missing required fields"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Your account has been deactivated. Please contact support."
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "An account with this email already exists. Please sign in instead."
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Too many attempts. Please try again later."
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Server error. Please try again later."
}
```

---

**Last Updated:** November 27, 2025
