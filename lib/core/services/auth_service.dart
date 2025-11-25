import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  String get _baseUrl =>
      dotenv.env['BASE_URL'] ?? 'http://localhost:4001/api/v1/mbl/auth';

  Uri _uri(String path) {
    final base = _baseUrl.endsWith('/')
        ? _baseUrl.substring(0, _baseUrl.length - 1)
        : _baseUrl;
    return Uri.parse('$base/$path');
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
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        (data['success'] == true)) {
      return data['data'] as Map<String, dynamic>;
    }
    throw Exception(data['message'] ?? 'Signup failed');
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
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        (data['success'] == true)) {
      return data['data'] as Map<String, dynamic>;
    }
    throw Exception(data['message'] ?? 'Login failed');
  }
}

extension GoogleAuth on AuthService {
  Future<Map<String, dynamic>> pickGoogleAccount() async {
    final googleClientId = dotenv.env['GOOGLE_CLIENT_ID'];
    final googleSignIn = GoogleSignIn(
      scopes: ['email', 'profile'],
      clientId: Platform.isIOS ? googleClientId : null,
    );

    await googleSignIn.signOut(); // force account chooser
    final account = await googleSignIn.signIn();

    if (account == null) throw Exception('Google sign-in cancelled');

    final auth = await account.authentication;

    // if (kDebugMode) {
    //   print("ID TOKEN => ${auth.idToken}");
    //   print("ACCESS TOKEN => ${auth.accessToken}");
    // }

    final map = {
      'fullName': account.displayName,
      'email': account.email,
      'photoUrl': account.photoUrl,
      'googleId': account.id,
      'idToken': auth.idToken,
    };

    if (kDebugMode) {
      print("full name => ${map['fullName']}");
      print("email => ${map['email']}");
      print("photoUrl => ${map['photoUrl']}");
      print("googleId => ${map['googleId']}");
      print("idToken => ${map['idToken']}");
    }

    return map;
  }

  Future<Map<String, dynamic>> loginWithGoogle() async {
    final data = await pickGoogleAccount();
    return data;
  }

  Future<Map<String, dynamic>> signupWithGoogle() async {
    final data = await pickGoogleAccount();
    return data;
  }
}
