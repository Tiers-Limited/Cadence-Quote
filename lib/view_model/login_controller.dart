import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/core/services/auth_service.dart';
import 'package:primechoice/core/utils/local_storage/storage_utility.dart';
import 'package:primechoice/core/utils/popups/loaders.dart';

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
    AuthService.instance
        .signin(
          email: emailController.text.trim(),
          password: passwordController.text,
        )
        .then((data) async {
          final token = data['token'];
          await MyLocalStorage.instance().writeData('auth_token', token);
          MyLoaders.successSnackBar(title: 'Login successful');
          Get.toNamed(AppRoutes.home);
        })
        .catchError((e) {
          MyLoaders.errorSnackBar(title: 'Login failed', message: e.toString());
        })
        .whenComplete(() => isLoading.value = false);
  }

  @override
  void onClose() {
    emailController.dispose();
    passwordController.dispose();
    super.onClose();
  }
}
