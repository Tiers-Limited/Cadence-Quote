# Mobile Authentication API Guide

Complete guide for integrating mobile authentication endpoints with request/response formats and examples.

## Base URL

```
Production: https://your-domain.com/api/v1/mbl/auth
Development: http://localhost:4001/api/v1/mbl/auth
```

## Rate Limiting

All endpoints are rate-limited to prevent abuse:

- **Authentication endpoints** (signin, google, apple): 5 requests per 15 minutes
- **Signup**: 3 requests per hour
- **Password reset**: 3 requests per hour

Rate limit headers are included in responses:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Time when limit resets (Unix timestamp)

---

## 1. Sign Up (Email/Password)

Register a new user account under Bobby's tenant.

### Endpoint
```
POST /signup
```

### Request Headers
```json
{
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "fullName": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "phoneNumber": "+1234567890"
}
```

### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fullName` | string | Yes | User's full name (2-100 characters) |
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | Password (min 8 characters, must contain uppercase, lowercase, number, and special character) |
| `phoneNumber` | string | No | Phone number in international format |

### Success Response (201 Created)
```json
{
  "success": true,
  "message": "User registered successfully. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": 123,
      "fullName": "John Doe",
      "email": "john.doe@example.com",
      "phoneNumber": "+1234567890",
      "role": "homeowner",
      "authProvider": "local",
      "emailVerified": false,
      "isActive": true,
      "createdAt": "2025-11-21T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  }
}
```

### Error Responses

**400 Bad Request** - Validation Error
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    }
  ]
}
```

**409 Conflict** - User Already Exists
```json
{
  "success": false,
  "message": "User with this email already exists"
}
```

**429 Too Many Requests** - Rate Limit Exceeded
```json
{
  "success": false,
  "message": "Too many signup attempts. Please try again later."
}
```

---

## 2. Sign In (Email/Password)

Authenticate an existing user with email and password.

### Endpoint
```
POST /signin
```

### Request Headers
```json
{
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `password` | string | Yes | User's password |

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 123,
      "fullName": "John Doe",
      "email": "john.doe@example.com",
      "phoneNumber": "+1234567890",
      "role": "homeowner",
      "authProvider": "local",
      "emailVerified": true,
      "isActive": true,
      "twoFactorEnabled": false,
      "createdAt": "2025-11-21T10:30:00.000Z",
      "lastLoginAt": "2025-11-21T14:45:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  }
}
```

### Error Responses

**401 Unauthorized** - Invalid Credentials
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

**403 Forbidden** - Account Inactive
```json
{
  "success": false,
  "message": "Your account has been deactivated. Please contact support."
}
```

**403 Forbidden** - Email Not Verified (if verification required)
```json
{
  "success": false,
  "message": "Please verify your email address before logging in. Check your inbox for the verification link."
}
```

---

## 3. Google Sign In

Authenticate or register a user using Google OAuth.

### Endpoint
```
POST /google
```

### Request Headers
```json
{
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "idToken": "google_id_token_from_client",
  "email": "john.doe@gmail.com",
  "fullName": "John Doe",
  "googleId": "1234567890",
  "photoUrl": "https://lh3.googleusercontent.com/a/..."
}
```

### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idToken` | string | Yes | Google ID token from client SDK |
| `email` | string | Yes | User's Google email |
| `fullName` | string | Yes | User's full name from Google |
| `googleId` | string | Yes | Unique Google user ID |
| `photoUrl` | string | No | User's Google profile photo URL |

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Google sign-in successful",
  "data": {
    "user": {
      "id": 124,
      "fullName": "John Doe",
      "email": "john.doe@gmail.com",
      "phoneNumber": null,
      "role": "homeowner",
      "authProvider": "google",
      "emailVerified": true,
      "isActive": true,
      "googleId": "1234567890",
      "photoUrl": "https://lh3.googleusercontent.com/a/...",
      "createdAt": "2025-11-21T10:30:00.000Z",
      "lastLoginAt": "2025-11-21T14:45:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d",
    "isNewUser": false
  }
}
```

### Notes
- If user doesn't exist, account is automatically created
- `isNewUser` flag indicates if this is a new registration
- Email is automatically verified for Google users
- Password field is not required/used for Google auth

### Error Responses

**400 Bad Request** - Invalid Token
```json
{
  "success": false,
  "message": "Invalid Google ID token"
}
```

**403 Forbidden** - Account Deactivated
```json
{
  "success": false,
  "message": "Your account has been deactivated. Please contact support."
}
```

---

## 4. Apple Sign In

Authenticate or register a user using Apple Sign In.

### Endpoint
```
POST /apple
```

### Request Headers
```json
{
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "identityToken": "apple_identity_token_from_client",
  "authorizationCode": "apple_authorization_code",
  "email": "john.doe@privaterelay.appleid.com",
  "fullName": "John Doe",
  "appleId": "001234.abcd1234efgh5678.9012"
}
```

### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `identityToken` | string | Yes | Apple identity token from client SDK |
| `authorizationCode` | string | Yes | Apple authorization code |
| `email` | string | Yes | User's Apple email (may be private relay) |
| `fullName` | string | No | User's full name (only provided on first sign-in) |
| `appleId` | string | Yes | Unique Apple user ID |

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Apple sign-in successful",
  "data": {
    "user": {
      "id": 125,
      "fullName": "John Doe",
      "email": "john.doe@privaterelay.appleid.com",
      "phoneNumber": null,
      "role": "homeowner",
      "authProvider": "apple",
      "emailVerified": true,
      "isActive": true,
      "appleId": "001234.abcd1234efgh5678.9012",
      "createdAt": "2025-11-21T10:30:00.000Z",
      "lastLoginAt": "2025-11-21T14:45:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d",
    "isNewUser": true
  }
}
```

### Notes
- If user doesn't exist, account is automatically created
- `fullName` may be null on subsequent sign-ins (Apple only provides it once)
- Email is automatically verified for Apple users
- Password field is not required/used for Apple auth
- Apple may use private relay emails

### Error Responses

**400 Bad Request** - Invalid Token
```json
{
  "success": false,
  "message": "Invalid Apple identity token"
}
```

**403 Forbidden** - Account Deactivated
```json
{
  "success": false,
  "message": "Your account has been deactivated. Please contact support."
}
```

---

## 5. Forgot Password

Request a password reset email.

### Endpoint
```
POST /forgot-password
```

### Request Headers
```json
{
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "email": "john.doe@example.com"
}
```

### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent.",
  "data": {
    "email": "john.doe@example.com",
    "resetTokenSent": true
  }
}
```

### Notes
- Response is intentionally vague to prevent email enumeration attacks
- Same response sent whether email exists or not
- Reset token expires after 1 hour
- Reset link format: `https://your-app.com/reset-password?token={resetToken}`
- Email contains reset token that must be used with `/reset-password` endpoint

### Error Responses

**429 Too Many Requests** - Rate Limit Exceeded
```json
{
  "success": false,
  "message": "Too many password reset requests. Please try again later."
}
```

**400 Bad Request** - OAuth User
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```
Note: OAuth users (Google/Apple) cannot reset password as they don't have one, but response is same for security.

---

## 6. Reset Password

Reset password using the token received via email.

### Endpoint
```
POST /reset-password
```

### Request Headers
```json
{
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePassword123!"
}
```

### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | Reset token from email |
| `newPassword` | string | Yes | New password (min 8 characters, must contain uppercase, lowercase, number, and special character) |

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Password reset successful. You can now log in with your new password.",
  "data": {
    "passwordResetAt": "2025-11-21T15:00:00.000Z"
  }
}
```

### Error Responses

**400 Bad Request** - Invalid or Expired Token
```json
{
  "success": false,
  "message": "Invalid or expired reset token. Please request a new password reset."
}
```

**400 Bad Request** - Weak Password
```json
{
  "success": false,
  "message": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
}
```

**403 Forbidden** - OAuth User
```json
{
  "success": false,
  "message": "Cannot reset password for OAuth accounts (Google/Apple). Please use the respective sign-in method."
}
```

---

## 7. Verify Email

Verify user's email address using token sent to their email.

### Endpoint
```
GET /verify-email/:token
```

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | Email verification token from email link |

### Example Request
```
GET /verify-email/abc123def456ghi789
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Email verified successfully. You can now log in.",
  "data": {
    "emailVerified": true,
    "verifiedAt": "2025-11-21T15:30:00.000Z"
  }
}
```

### Error Responses

**400 Bad Request** - Invalid or Expired Token
```json
{
  "success": false,
  "message": "Invalid or expired verification token. Please request a new verification email."
}
```

**400 Bad Request** - Already Verified
```json
{
  "success": false,
  "message": "Email already verified. You can log in to your account."
}
```

### Notes
- Verification links are typically embedded in email as: `https://your-app.com/verify-email?token={verificationToken}`
- Token expires after 24 hours
- Once verified, user can log in normally

---

## Common Response Fields

All API responses follow this structure:

```typescript
interface ApiResponse<T> {
  success: boolean;           // Operation success status
  message: string;            // Human-readable message
  data?: T;                   // Response data (if successful)
  errors?: ValidationError[]; // Validation errors (if applicable)
}

interface ValidationError {
  field: string;    // Field name that failed validation
  message: string;  // Error message
}
```

---

## Authentication Token Usage

After successful authentication, use the JWT token in subsequent API requests:

### Request Headers
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "Content-Type": "application/json"
}
```

### Token Details
- **Type**: JWT (JSON Web Token)
- **Expiration**: 7 days
- **Storage**: Store securely in device keychain/secure storage
- **Refresh**: Implement token refresh logic before expiration

### Token Payload Example
```json
{
  "id": 123,
  "email": "john.doe@example.com",
  "role": "homeowner",
  "tenantId": 1,
  "iat": 1700574000,
  "exp": 1701178800
}
```

---

## Error Codes Summary

| Status Code | Description | Common Causes |
|-------------|-------------|---------------|
| 200 | OK | Successful request |
| 201 | Created | Successful signup |
| 400 | Bad Request | Invalid input, validation errors |
| 401 | Unauthorized | Invalid credentials, missing/invalid token |
| 403 | Forbidden | Account deactivated, email not verified |
| 404 | Not Found | Resource not found |
| 409 | Conflict | User already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Integration Examples

### React Native Example (Sign In)

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const signIn = async (email, password) => {
  try {
    const response = await fetch('https://api.example.com/api/v1/mbl/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    // Store token securely
    await AsyncStorage.setItem('authToken', data.data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.data.user));

    return data.data;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};
```

### Flutter Example (Google Sign In)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

Future<Map<String, dynamic>> googleSignIn(String idToken, String email, String fullName, String googleId) async {
  final storage = FlutterSecureStorage();
  
  try {
    final response = await http.post(
      Uri.parse('https://api.example.com/api/v1/mbl/auth/google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'idToken': idToken,
        'email': email,
        'fullName': fullName,
        'googleId': googleId,
      }),
    );

    final data = jsonDecode(response.body);

    if (!data['success']) {
      throw Exception(data['message']);
    }

    // Store token securely
    await storage.write(key: 'authToken', value: data['data']['token']);
    await storage.write(key: 'user', value: jsonEncode(data['data']['user']));

    return data['data'];
  } catch (error) {
    print('Google sign in error: $error');
    rethrow;
  }
}
```

---

## Security Best Practices

1. **Token Storage**: 
   - iOS: Use Keychain
   - Android: Use EncryptedSharedPreferences or Keystore
   - React Native: Use react-native-keychain or @react-native-async-storage/async-storage with encryption

2. **HTTPS Only**: Always use HTTPS in production

3. **Token Refresh**: Implement token refresh before expiration

4. **Logout**: Clear all stored credentials on logout

5. **Biometric Auth**: Implement biometric authentication for better UX

6. **Error Handling**: Never expose sensitive information in error messages

7. **Rate Limiting**: Respect rate limits and implement exponential backoff

---

## Testing Credentials (Development Only)

For testing purposes in development environment:

```json
{
  "email": "test@example.com",
  "password": "Test123!@#"
}
```

**⚠️ WARNING**: Never use test credentials in production!

---

## Support

For issues or questions:
- Email: support@cadence.com
- Documentation: https://docs.cadence.com
- API Status: https://status.cadence.com

---

**Last Updated**: November 21, 2025
**API Version**: v1.0
