import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/services/auth_service.dart';
import 'package:primechoice/core/utils/popups/loaders.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/view_model/login_controller.dart';

class ForgotPasswordController extends GetxController {
  final emailController = TextEditingController();
  final otpController = TextEditingController();
  final passwordController = TextEditingController();
  final confirmController = TextEditingController();
  final isLoading = false.obs;
  final step = 1.obs; // 1=email, 2=otp, 3=new password
  final obscure1 = true.obs;
  final obscure2 = true.obs;

  void toggleObscure1() => obscure1.value = !obscure1.value;
  void toggleObscure2() => obscure2.value = !obscure2.value;

  void requestReset() {
    final email = emailController.text.trim();
    if (email.isEmpty) {
      MyLoaders.errorSnackBar(title: 'Error', message: 'Email is required');
      return;
    }
    isLoading.value = true;
    AuthService.instance
        .requestPasswordReset(email: email)
        .then((body) {
          final msg = body['message'] ?? 'Verification code sent';
          MyLoaders.successSnackBar(title: 'Reset', message: msg);
          step.value = 2;
        })
        .catchError((e) {
          MyLoaders.errorSnackBar(title: 'Reset failed', message: e.toString());
        })
        .whenComplete(() => isLoading.value = false);
  }

  void proceedToNewPassword() {
    final code = otpController.text.trim();
    if (code.length != 6) {
      MyLoaders.errorSnackBar(
        title: 'Invalid code',
        message: 'Enter 6-digit code',
      );
      return;
    }
    step.value = 3;
  }

  void submitNewPassword() {
    final email = emailController.text.trim();
    final code = otpController.text.trim();
    final pass = passwordController.text;
    final confirm = confirmController.text;
    if (email.isEmpty || code.length != 6) {
      MyLoaders.errorSnackBar(title: 'Error', message: 'Email or code invalid');
      return;
    }
    // Validate password rules
    String? err;
    if (pass.isEmpty) {
      err = 'Password is required';
    } else if (pass.length < 8 ||
        !RegExp(r'[A-Z]').hasMatch(pass) ||
        !RegExp(r'[a-z]').hasMatch(pass) ||
        !RegExp(r'[0-9]').hasMatch(pass)) {
      err =
          'At least 8 characters including an uppercase letter, a lowercase letter, and a number';
    } else if (pass != confirm) {
      err = 'Passwords do not match';
    }
    if (err != null) {
      MyLoaders.errorSnackBar(title: 'Invalid password', message: err);
      return;
    }

    isLoading.value = true;
    AuthService.instance
        .resetPassword(email: email, code: code, newPassword: pass)
        .then((body) {
          final msg = body['message'] ?? 'Password reset successful';
          MyLoaders.successSnackBar(title: 'Reset', message: msg);
          Get.delete<LoginController>(force: true);
          Get.offAllNamed(AppRoutes.login);
        })
        .catchError((e) {
          MyLoaders.errorSnackBar(title: 'Reset failed', message: e.toString());
        })
        .whenComplete(() => isLoading.value = false);
  }

  @override
  void onClose() {
    emailController.dispose();
    otpController.dispose();
    passwordController.dispose();
    confirmController.dispose();
    super.onClose();
  }
}
