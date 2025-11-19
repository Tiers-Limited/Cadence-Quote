import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/routes/app_routes.dart';

class VerifyAccountController extends GetxController {
  final String email;
  VerifyAccountController(this.email);

  final formKey = GlobalKey<FormState>();
  final d1 = TextEditingController();
  final d2 = TextEditingController();
  final d3 = TextEditingController();
  final d4 = TextEditingController();
  final isLoading = false.obs;

  String get code => '${d1.text}${d2.text}${d3.text}${d4.text}';

  void verify() {
    if (!(formKey.currentState?.validate() ?? false)) return;
    isLoading.value = true;
    Future.delayed(const Duration(seconds: 1), () {
      isLoading.value = false;
      navigateToHome();
    });
  }

  void navigateToHome() {
    Get.offAllNamed(AppRoutes.home);
  }

  @override
  void onClose() {
    d1.dispose();
    d2.dispose();
    d3.dispose();
    d4.dispose();
    super.onClose();
  }
}
