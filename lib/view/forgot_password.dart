import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/view_model/forgot_password_controller.dart';

class ForgotPasswordPage extends StatelessWidget {
  const ForgotPasswordPage({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(ForgotPasswordController());
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
                    'Forgot Password',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.displayMedium,
                  ),
                  const SizedBox(height: 8),
                  Obx(() {
                    final s = controller.step.value;
                    final text = s == 1
                        ? 'Please enter your email below to receive your password reset code.'
                        : s == 2
                        ? 'Enter the 6-digit code sent to your email.'
                        : 'Enter your new password.';
                    return Text(
                      text,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    );
                  }),
                  const SizedBox(height: 28),
                  Obx(() {
                    if (controller.step.value != 1)
                      return const SizedBox.shrink();
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Email address',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: controller.emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: MyTextFormFieldTheme.lightInputDecoration(
                            hintText: 'example123@gmail.com',
                            prefixIcon: const Icon(
                              Icons.email_outlined,
                              color: MyColors.primary,
                            ),
                          ),
                        ),
                      ],
                    );
                  }),
                  const SizedBox(height: 24),
                  Obx(() {
                    final s = controller.step.value;
                    if (s == 2) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 8),
                          Text(
                            'Verification code',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: controller.otpController,
                            maxLength: 6,
                            keyboardType: TextInputType.number,
                            decoration:
                                MyTextFormFieldTheme.lightInputDecoration(
                                  hintText: '123456',
                                  prefixIcon: const Icon(
                                    Icons.confirmation_number_outlined,
                                    color: MyColors.primary,
                                  ),
                                ).copyWith(counterText: ''),
                          ),
                        ],
                      );
                    }
                    if (s == 3) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'New Password',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 8),
                          Obx(
                            () => TextFormField(
                              controller: controller.passwordController,
                              obscureText: controller.obscure1.value,
                              decoration:
                                  MyTextFormFieldTheme.lightInputDecoration(
                                    hintText: '••••••••',
                                    prefixIcon: const Icon(
                                      Icons.lock_outline,
                                      color: MyColors.primary,
                                    ),
                                    suffixIcon: IconButton(
                                      icon: Icon(
                                        controller.obscure1.value
                                            ? Icons.visibility_off
                                            : Icons.visibility,
                                        color: MyColors.primary,
                                      ),
                                      onPressed: controller.toggleObscure1,
                                    ),
                                  ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Confirm Password',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 8),
                          Obx(
                            () => TextFormField(
                              controller: controller.confirmController,
                              obscureText: controller.obscure2.value,
                              decoration:
                                  MyTextFormFieldTheme.lightInputDecoration(
                                    hintText: '••••••••',
                                    prefixIcon: const Icon(
                                      Icons.lock_outline,
                                      color: MyColors.primary,
                                    ),
                                    suffixIcon: IconButton(
                                      icon: Icon(
                                        controller.obscure2.value
                                            ? Icons.visibility_off
                                            : Icons.visibility,
                                        color: MyColors.primary,
                                      ),
                                      onPressed: controller.toggleObscure2,
                                    ),
                                  ),
                            ),
                          ),
                        ],
                      );
                    }
                    return const SizedBox.shrink();
                  }),
                  const SizedBox(height: 24),
                  Obx(
                    () => GradientElevatedButton(
                      onPressed: controller.isLoading.value
                          ? null
                          : () {
                              if (controller.step.value == 1) {
                                controller.requestReset();
                              } else if (controller.step.value == 2) {
                                controller.proceedToNewPassword();
                              } else {
                                controller.submitNewPassword();
                              }
                            },
                      child: controller.isLoading.value
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            )
                          : Text(
                              controller.step.value == 1
                                  ? 'Reset Password'
                                  : controller.step.value == 2
                                  ? 'Verify Code'
                                  : 'Submit New Password',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
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
