import 'package:flutter/material.dart';
import 'package:get/get.dart';

class ForgotPasswordController extends GetxController {
  final emailController = TextEditingController();
  final isLoading = false.obs;

  void resetPassword() {
    if (emailController.text.isEmpty) return;
    isLoading.value = true;
    Future.delayed(const Duration(seconds: 1), () {
      isLoading.value = false;
    });
  }

  @override
  void onClose() {
    emailController.dispose();
    super.onClose();
  }
}
