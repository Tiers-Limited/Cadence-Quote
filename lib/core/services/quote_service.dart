import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:primechoice/core/utils/local_storage/storage_utility.dart';

class QuoteService {
  QuoteService._();
  static final QuoteService instance = QuoteService._();

  String get _baseUrl {
    final mobile = dotenv.env['MOBILE_QUOTE_BASE_URL'];
    final base = dotenv.env['BASE_URL'];
    final resolved = (mobile?.isNotEmpty == true)
        ? mobile!
        : (base?.isNotEmpty == true)
        ? base!
        : 'http://localhost:4001/api/v1/mbl/quote';
    return resolved;
  }

  Uri _uri(String path) {
    final base = _baseUrl.endsWith('/')
        ? _baseUrl.substring(0, _baseUrl.length - 1)
        : _baseUrl;
    final full = '$base/$path';
    if (kDebugMode) debugPrint('URL: $full');
    return Uri.parse(full);
  }

  Map<String, String> _authHeaders() {
    final token = MyLocalStorage.instance()
        .readData<String>('auth_token')
        ?.trim();
    if (token == null || token.isEmpty) {
      throw Exception('Unauthorized: missing token');
    }
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
      'authorization': 'Bearer $token',
    };
  }

  void _logResponse(String path, http.Response res) {
    if (kDebugMode) {
      debugPrint('API $path status=${res.statusCode}');
      debugPrint(res.body);
    }
  }

  Future<Map<String, dynamic>> _handle(http.Response res, String path) async {
    _logResponse(path, res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode == 401 ||
        (body['success'] == false &&
            (body['message']?.toString().toLowerCase().contains('auth') ==
                true))) {
      throw Exception(body['message'] ?? 'Unauthorized');
    }
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        body['success'] == true) {
      return body;
    }
    throw Exception(body['message'] ?? 'Request failed');
  }

  // GET /pricing-schemes
  Future<Map<String, dynamic>> getPricingSchemes() async {
    final res = await http.get(
      _uri('pricing-schemes'),
      headers: _authHeaders(),
    );
    return _handle(res, 'pricing-schemes');
  }

  // GET /brands
  Future<Map<String, dynamic>> getBrands() async {
    final res = await http.get(_uri('brands'), headers: _authHeaders());
    return _handle(res, 'brands');
  }

  // GET /colors-by-brand/:brandId?search=&limit=
  Future<Map<String, dynamic>> getColorsByBrand(
    int brandId, {
    String? search,
    int? limit,
  }) async {
    final uri =
        Uri.parse(
          '${_baseUrl.endsWith('/') ? _baseUrl.substring(0, _baseUrl.length - 1) : _baseUrl}/colors-by-brand/$brandId',
        ).replace(
          queryParameters: {
            if (search != null && search.isNotEmpty) 'search': search,
            if (limit != null) 'limit': '$limit',
          },
        );
    if (kDebugMode) debugPrint('URL: $uri');
    final res = await http.get(uri, headers: _authHeaders());
    return _handle(res, 'colors-by-brand/$brandId');
  }

  // POST /products-for-areas
  Future<Map<String, dynamic>> getProductsForAreas(
    Map<String, dynamic> payload,
  ) async {
    if (kDebugMode)
      debugPrint('REQ /products-for-areas: ${jsonEncode(payload)}');
    final res = await http.post(
      _uri('products-for-areas'),
      headers: _authHeaders(),
      body: jsonEncode(payload),
    );
    return _handle(res, 'products-for-areas');
  }

  // POST /assign-products
  Future<Map<String, dynamic>> assignProducts(
    Map<String, dynamic> payload,
  ) async {
    if (kDebugMode) debugPrint('REQ /assign-products: ${jsonEncode(payload)}');
    final res = await http.post(
      _uri('assign-products'),
      headers: _authHeaders(),
      body: jsonEncode(payload),
    );
    return _handle(res, 'assign-products');
  }

  // POST /calculate-pricing
  Future<Map<String, dynamic>> calculatePricing(
    Map<String, dynamic> payload,
  ) async {
    if (kDebugMode)
      debugPrint('REQ /calculate-pricing: ${jsonEncode(payload)}');
    final res = await http.post(
      _uri('calculate-pricing'),
      headers: _authHeaders(),
      body: jsonEncode(payload),
    );
    return _handle(res, 'calculate-pricing');
  }

  // POST /create-draft
  Future<Map<String, dynamic>> createDraft(Map<String, dynamic> payload) async {
    if (kDebugMode) debugPrint('REQ /create-draft: ${jsonEncode(payload)}');
    final res = await http.post(
      _uri('create-draft'),
      headers: _authHeaders(),
      body: jsonEncode(payload),
    );
    return _handle(res, 'create-draft');
  }

  // POST /request-booking
  Future<Map<String, dynamic>> requestBooking(
    Map<String, dynamic> payload,
  ) async {
    if (kDebugMode) debugPrint('REQ /request-booking: ${jsonEncode(payload)}');
    final res = await http.post(
      _uri('request-booking'),
      headers: _authHeaders(),
      body: jsonEncode(payload),
    );
    return _handle(res, 'request-booking');
  }

  // GET /my-quotes
  Future<Map<String, dynamic>> getMyQuotes() async {
    final res = await http.get(_uri('my-quotes'), headers: _authHeaders());
    return _handle(res, 'my-quotes');
  }

  // GET /:id
  Future<Map<String, dynamic>> getQuote(int id) async {
    final res = await http.get(_uri('$id'), headers: _authHeaders());
    return _handle(res, '$id');
  }

  // POST /:id/accept
  Future<Map<String, dynamic>> acceptQuote(int id) async {
    final res = await http.post(_uri('$id/accept'), headers: _authHeaders());
    return _handle(res, '$id/accept');
  }

  // POST /:id/reject
  Future<Map<String, dynamic>> rejectQuote(int id) async {
    final res = await http.post(_uri('$id/reject'), headers: _authHeaders());
    return _handle(res, '$id/reject');
  }
}
