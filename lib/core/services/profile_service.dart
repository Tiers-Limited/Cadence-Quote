import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:primechoice/core/utils/local_storage/storage_utility.dart';

class ProfileService {
  ProfileService._();
  static final ProfileService instance = ProfileService._();

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

  Future<Map<String, dynamic>> updateProfile({
    String? fullName,
    String? address,
    String? phoneNumber,
    String? profilePicture,
  }) async {
    final token = MyLocalStorage.instance().readData<String>('auth_token');
    if (token == null || token.isEmpty) {
      throw Exception('Unauthorized: missing token');
    }
    if (kDebugMode) {
      print('Auth token present for profile update');
    }
    final payload = <String, dynamic>{
      if (fullName != null) 'fullName': fullName,
      if (address != null) 'address': address,
      if (phoneNumber != null) 'phoneNumber': phoneNumber,
      if (profilePicture != null) 'profilePicture': profilePicture,
    };
    final res = await http.put(
      _uri('profile'),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ${token.trim()}',
        'authorization': 'Bearer ${token.trim()}',
      },
      body: jsonEncode(payload),
    );
    _logResponse('profile', res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode == 401) {
      throw Exception(body['message'] ?? 'Unauthorized');
    }
    if ((body['success'] == false) &&
        (body['message']?.toString().toLowerCase().contains('auth') == true)) {
      throw Exception(body['message'] ?? 'Unauthorized');
    }
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        (body['success'] == true)) {
      final user =
          (body['data'] as Map<String, dynamic>?)?['user']
              as Map<String, dynamic>?;
      if (user != null) {
        final storage = MyLocalStorage.instance();
        storage.writeData(
          'user_full_name',
          (user['fullName'] ?? '').toString(),
        );
        storage.writeData('user_email', (user['email'] ?? '').toString());
        storage.writeData('user_address', (user['address'] ?? '').toString());
        storage.writeData('user_phone', (user['phoneNumber'] ?? '').toString());
        storage.writeData(
          'user_profile_picture',
          (user['profilePicture'] ?? '').toString(),
        );
      }
      return body;
    }
    throw Exception(body['message'] ?? 'Profile update failed');
  }
}
