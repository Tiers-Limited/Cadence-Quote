import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/core/services/auth_service.dart';
import 'package:primechoice/core/utils/local_storage/storage_utility.dart';
import 'package:primechoice/core/utils/popups/loaders.dart';

class VerifyAccountController extends GetxController {
  final String email;
  final Map<String, dynamic> data;
  VerifyAccountController(this.email, this.data);

  final formKey = GlobalKey<FormState>();
  final d1 = TextEditingController();
  final d2 = TextEditingController();
  final d3 = TextEditingController();
  final d4 = TextEditingController();
  final d5 = TextEditingController();
  final d6 = TextEditingController();
  final isLoading = false.obs;

  String get code =>
      '${d1.text}${d2.text}${d3.text}${d4.text}${d5.text}${d6.text}';

  void verify() {
    if (!(formKey.currentState?.validate() ?? false)) return;
    isLoading.value = true;
    if (kDebugMode) {
      debugPrint('Verify request: email=$email code=$code');
    }
    AuthService.instance
        .verifySignup(email: email, code: code)
        .then((body) async {
          final msg = body['message'] ?? 'Registration successful';
          final data = body['data'] as Map<String, dynamic>?;
          final token = data?['token'];
          if (token != null) {
            await MyLocalStorage.instance().writeData('auth_token', token);
          }
          MyLoaders.successSnackBar(title: 'Verified', message: msg);
          if (kDebugMode) {
            debugPrint('Verify success: $msg');
          }
          navigateToHome();
        })
        .catchError((e) {
          if (kDebugMode) {
            debugPrint('Verify error: ${e.toString()}');
          }
          MyLoaders.errorSnackBar(
            title: 'Verification failed',
            message: e.toString(),
          );
        })
        .whenComplete(() => isLoading.value = false);
  }

  void navigateToHome() {
    Get.offAllNamed(AppRoutes.home);
  }

  void onOtpChanged() {
    final codeText = code;
    if (codeText.length != 6) return;
    verify();
    if (kDebugMode) {
      print('Verification code entered: $codeText');
      print('User data => $data');
    }
  }

  @override
  void onClose() {
    d1.dispose();
    d2.dispose();
    d3.dispose();
    d4.dispose();
    d5.dispose();
    d6.dispose();
    super.onClose();
  }
}
