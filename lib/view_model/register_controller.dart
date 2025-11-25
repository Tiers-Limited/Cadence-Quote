import 'package:flutter/material.dart';
import 'package:get/get.dart';

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
    Future.delayed(const Duration(seconds: 1), () {
      isLoading.value = false;
    });
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
