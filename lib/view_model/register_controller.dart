import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/services/auth_service.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/core/utils/popups/loaders.dart';
import 'package:flutter/foundation.dart';

class RegisterController extends GetxController {
  final formKey = GlobalKey<FormState>();
  final nameController = TextEditingController();
  final emailController = TextEditingController();
  final addressController = TextEditingController();
  final passwordController = TextEditingController();
  final confirmController = TextEditingController();

  final obscure1 = true.obs;
  final obscure2 = true.obs;
  final isLoading = false.obs;

  void toggleObscure1() => obscure1.value = !obscure1.value;
  void toggleObscure2() => obscure2.value = !obscure2.value;

  void register() {
    if (!(formKey.currentState?.validate() ?? false)) return;
    isLoading.value = true;
    if (kDebugMode) {
      debugPrint(
        'Signup request: fullName=${nameController.text.trim()} email=${emailController.text.trim()}',
      );
    }
    AuthService.instance
        .signup(
          fullName: nameController.text.trim(),
          email: emailController.text.trim(),
          password: passwordController.text,
          address: addressController.text.trim(),
        )
        .then((body) async {
          final msg = body['message'] ?? 'Verification code sent';
          if (kDebugMode) {
            debugPrint('Signup success: $msg');
          }
          MyLoaders.successSnackBar(title: 'Signup', message: msg);
          Get.toNamed(
            AppRoutes.verify,
            arguments: {
              'email': emailController.text.trim(),
              'data': body['data'] ?? {},
            },
          );
        })
        .catchError((e) {
          if (kDebugMode) {
            debugPrint('Signup error: ${e.toString()}');
          }
          MyLoaders.errorSnackBar(
            title: 'Registration failed',
            message: e.toString(),
          );
        })
        .whenComplete(() => isLoading.value = false);
  }

  @override
  void onClose() {
    nameController.dispose();
    emailController.dispose();
    addressController.dispose();
    passwordController.dispose();
    confirmController.dispose();
    super.onClose();
  }
}
