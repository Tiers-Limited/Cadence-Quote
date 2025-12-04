import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/core/services/auth_service.dart';
import 'package:primechoice/core/utils/local_storage/storage_utility.dart';
import 'package:primechoice/core/utils/popups/loaders.dart';
import 'package:flutter/foundation.dart';

class LoginController extends GetxController {
  final formKey = GlobalKey<FormState>();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final obscure = true.obs;
  final isLoading = false.obs;

  void toggleObscure() => obscure.value = !obscure.value;

  void login() {
    if (!(formKey.currentState?.validate() ?? false)) return;
    isLoading.value = true;
    if (kDebugMode) {
      debugPrint('Login request: email=${emailController.text.trim()}');
    }
    AuthService.instance
        .signin(
          email: emailController.text.trim(),
          password: passwordController.text,
        )
        .then((body) async {
          final msg = body['message'] ?? 'Login successful';
          final data = body['data'] as Map<String, dynamic>;
          final token = data['token'];
          await MyLocalStorage.instance().writeData('auth_token', token);
          final user = data['user'] as Map<String, dynamic>?;
          if (user != null) {
            await MyLocalStorage.instance().writeData(
              'user_full_name',
              (user['fullName'] ?? '').toString(),
            );
            await MyLocalStorage.instance().writeData(
              'user_email',
              (user['email'] ?? '').toString(),
            );
            await MyLocalStorage.instance().writeData(
              'user_address',
              (user['address'] ?? '').toString(),
            );
            await MyLocalStorage.instance().writeData(
              'user_phone',
              (user['phoneNumber'] ?? '').toString(),
            );
            await MyLocalStorage.instance().writeData(
              'user_profile_picture',
              (user['profilePicture'] ?? '').toString(),
            );
          }
          MyLoaders.successSnackBar(title: 'Login', message: msg);
          if (kDebugMode) {
            debugPrint('Login success: $msg');
          }
          Get.toNamed(AppRoutes.home);
        })
        .catchError((e) {
          if (kDebugMode) {
            debugPrint('Login error: ${e.toString()}');
          }
          MyLoaders.errorSnackBar(title: 'Login failed', message: e.toString());
        })
        .whenComplete(() => isLoading.value = false);
  }

  @override
  void onClose() {
    try {
      emailController.dispose();
      passwordController.dispose();
    } catch (_) {}
    super.onClose();
  }
}
