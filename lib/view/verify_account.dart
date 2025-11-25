import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/view_model/verify_account_controller.dart';

class VerifyAccountPage extends StatelessWidget {
  final String email;
  final Map<String, dynamic> data;
  const VerifyAccountPage({
    super.key,
    required this.email,
    this.data = const {},
  });

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(VerifyAccountController(email, data));
    return Scaffold(
      body: Stack(
        children: [
          const CustomBackground(),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      IconButton(
                        onPressed: () => Get.back(),
                        icon: const Icon(Icons.arrow_back),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Verify Account',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.displayMedium,
                  ),
                  const SizedBox(height: 8),
                  RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      style: Theme.of(context).textTheme.bodyMedium,
                      children: [
                        const TextSpan(
                          text:
                              'Verify your account by entering verification code we sent to ',
                        ),
                        TextSpan(
                          text: email,
                          style: const TextStyle(color: MyColors.primary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  Form(
                    key: controller.formKey,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _OtpBox(
                          controller: controller.d1,
                          onChanged: (_) => controller.onOtpChanged(),
                        ),
                        _OtpBox(
                          controller: controller.d2,
                          onChanged: (_) => controller.onOtpChanged(),
                        ),
                        _OtpBox(
                          controller: controller.d3,
                          onChanged: (_) => controller.onOtpChanged(),
                        ),
                        _OtpBox(
                          controller: controller.d4,
                          onChanged: (_) => controller.onOtpChanged(),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Obx(
                    () => controller.isLoading.value
                        ? const Center(
                            child: SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OtpBox extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  const _OtpBox({required this.controller, this.onChanged});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 60,
      child: TextFormField(
        controller: controller,
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        maxLength: 1,
        decoration: MyTextFormFieldTheme.lightInputDecoration(
          hintText: '',
        ).copyWith(counterText: ''),
        validator: (v) {
          if (v == null || v.isEmpty) return ' ';
          if (!RegExp(r'^\d$').hasMatch(v)) return ' ';
          return null;
        },
        onChanged: (v) {
          if (v.isEmpty) {
            FocusScope.of(context).previousFocus();
          } else {
            FocusScope.of(context).nextFocus();
          }
          onChanged?.call(v);
        },
      ),
    );
  }
}
