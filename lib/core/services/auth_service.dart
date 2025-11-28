import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  String get _baseUrl {
    final mobile = dotenv.env['MOBILE_BASE_URL'];
    final base = dotenv.env['BASE_URL'];
    return (mobile?.isNotEmpty == true)
        ? mobile!
        : (base?.isNotEmpty == true)
        ? base!
        : 'http://localhost:4001/api/v1/mbl/auth';
  }

  Uri _uri(String path) {
    final base = _baseUrl.endsWith('/')
        ? _baseUrl.substring(0, _baseUrl.length - 1)
        : _baseUrl;

    if (kDebugMode) {
      print('URL: $base/$path');
    }

    return Uri.parse('$base/$path');
  }

  void _logResponse(String path, http.Response res) {
    if (kDebugMode) {
      print('API $path status=${res.statusCode}');
      print(res.body);
    }
  }

  Future<Map<String, dynamic>> signup({
    required String fullName,
    required String email,
    required String password,
    String? address,
    String? phoneNumber,
  }) async {
    final res = await http.post(
      _uri('signup'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'fullName': fullName,
        'email': email,
        'password': password,
        if (address != null) 'address': address,
        if (phoneNumber != null) 'phoneNumber': phoneNumber,
      }),
    );
    _logResponse('signup', res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        (body['success'] == true)) {
      return body;
    }
    throw Exception(body['message'] ?? 'Signup failed');
  }

  Future<Map<String, dynamic>> signin({
    required String email,
    required String password,
  }) async {
    final res = await http.post(
      _uri('signin'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    _logResponse('signin', res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        (body['success'] == true)) {
      return body;
    }
    throw Exception(body['message'] ?? 'Login failed');
  }

  Future<Map<String, dynamic>> verifySignup({
    required String email,
    required String code,
  }) async {
    final res = await http.post(
      _uri('verify-signup'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'code': code}),
    );
    _logResponse('verify-signup', res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if ((res.statusCode == 200 || res.statusCode == 201) &&
        (body['success'] == true)) {
      return body;
    }
    throw Exception(body['message'] ?? 'Verification failed');
  }

  Future<Map<String, dynamic>> resendSignupCode({required String email}) async {
    final res = await http.post(
      _uri('resend-signup-code'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email}),
    );
    _logResponse('resend-signup-code', res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        (body['success'] == true)) {
      return body;
    }
    throw Exception(body['message'] ?? 'Resend code failed');
  }

  Future<Map<String, dynamic>> googleAuth({
    required String googleId,
    required String email,
    String? fullName,
    String? photoUrl,
  }) async {
    final res = await http.post(
      _uri('google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'googleId': googleId,
        'email': email,
        if (fullName != null) 'fullName': fullName,
        if (photoUrl != null) 'photoUrl': photoUrl,
      }),
    );
    _logResponse('google', res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if ((res.statusCode == 200 || res.statusCode == 201) &&
        (body['success'] == true)) {
      return body;
    }
    throw Exception(body['message'] ?? 'Google sign-in failed');
  }

  Future<Map<String, dynamic>> appleAuth({
    required String identityToken,
    String? email,
    String? fullName,
  }) async {
    final res = await http.post(
      _uri('apple'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'identityToken': identityToken,
        if (email != null) 'email': email,
        if (fullName != null) 'fullName': fullName,
      }),
    );
    _logResponse('apple', res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if ((res.statusCode == 200 || res.statusCode == 201) &&
        (body['success'] == true)) {
      return body;
    }
    throw Exception(body['message'] ?? 'Apple sign-in failed');
  }

  Future<Map<String, dynamic>> requestPasswordReset({
    required String email,
  }) async {
    final res = await http.post(
      _uri('forgot-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email}),
    );
    _logResponse('forgot-password', res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        (body['success'] == true)) {
      return body;
    }
    throw Exception(body['message'] ?? 'Password reset request failed');
  }

  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    final res = await http.post(
      _uri('reset-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'code': code,
        'newPassword': newPassword,
      }),
    );
    _logResponse('reset-password', res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        (body['success'] == true)) {
      return body;
    }
    throw Exception(body['message'] ?? 'Password reset failed');
  }

  Future<Map<String, dynamic>> resendResetCode({required String email}) async {
    final res = await http.post(
      _uri('resend-reset-code'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email}),
    );
    _logResponse('resend-reset-code', res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        (body['success'] == true)) {
      return body;
    }
    throw Exception(body['message'] ?? 'Resend reset code failed');
  }
}

extension GoogleAuth on AuthService {
  Future<Map<String, dynamic>> pickGoogleAccount() async {
    final googleClientId = dotenv.env['GOOGLE_CLIENT_ID'];
    // final googleServerClientId = dotenv.env['GOOGLE_SERVER_CLIENT_ID'];
    final googleSignIn = GoogleSignIn(
      scopes: ['openid', 'email', 'profile'],
      // serverClientId: googleServerClientId,
      clientId: Platform.isIOS ? googleClientId : null,
    );

    await googleSignIn.signOut(); // force account chooser
    final account = await googleSignIn.signIn();

    if (account == null) throw Exception('Google sign-in cancelled');

    final auth = await account.authentication;

    final map = {
      'fullName': account.displayName,
      'email': account.email,
      'photoUrl': account.photoUrl,
      'googleId': account.id,
      'idToken': auth.idToken,
      'accessToken': auth.accessToken,
      'serverAuthCode': account.serverAuthCode,
    };

    if (kDebugMode) {
      print("full name => ${map['fullName']}");
      print("email => ${map['email']}");
      print("photoUrl => ${map['photoUrl']}");
      print("googleId => ${map['googleId']}");
      print("idToken => ${map['idToken']}");
      print("accessToken => ${map['accessToken']}");
      print("serverAuthCode => ${map['serverAuthCode']}");
    }

    return map;
  }

  Future<Map<String, dynamic>> loginWithGoogle() async {
    final data = await pickGoogleAccount();
    final body = await googleAuth(
      googleId: data['googleId'] as String,
      email: data['email'] as String,
      fullName: data['fullName'] as String?,
      photoUrl: data['photoUrl'] as String?,
    );
    return body;
  }

  Future<Map<String, dynamic>> signupWithGoogle() async {
    final data = await pickGoogleAccount();
    final body = await googleAuth(
      googleId: data['googleId'] as String,
      email: data['email'] as String,
      fullName: data['fullName'] as String?,
      photoUrl: data['photoUrl'] as String?,
    );
    return body;
  }
}
