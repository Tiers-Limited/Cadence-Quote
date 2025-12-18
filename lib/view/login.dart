import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_theme.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/view_model/login_controller.dart';
import 'package:primechoice/core/services/auth_service.dart';
import 'package:primechoice/core/utils/popups/loaders.dart';
import 'package:primechoice/core/utils/local_storage/storage_utility.dart';

class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = Get.isRegistered<LoginController>()
        ? Get.find<LoginController>()
        : Get.put(LoginController());
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
                  const SizedBox(height: 30),
                  Text(
                    'Welcome',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: GoogleFonts.poppins().fontFamily,
                      fontSize: 30.0,
                      color: MyColors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Hello there, sign in to continue!',
                    textAlign: TextAlign.center,
                    style: MyTextTheme.lightTextTheme.bodyMedium,
                  ),
                  const SizedBox(height: 28),
                  Form(
                    key: controller.formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Email address',
                          style: MyTextTheme.lightTextTheme.headlineMedium,
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
                          validator: (v) =>
                              (v == null || v.isEmpty) ? 'Required' : null,
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Password',
                          style: MyTextTheme.lightTextTheme.headlineMedium,
                        ),
                        const SizedBox(height: 8),
                        Obx(
                          () => TextFormField(
                            controller: controller.passwordController,
                            obscureText: controller.obscure.value,
                            decoration:
                                MyTextFormFieldTheme.lightInputDecoration(
                                  hintText: '••••••••',
                                  prefixIcon: const Icon(
                                    Icons.lock_outline,
                                    color: MyColors.primary,
                                  ),
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      controller.obscure.value
                                          ? Icons.visibility_off
                                          : Icons.visibility,
                                      color: MyColors.primary,
                                    ),
                                    onPressed: controller.toggleObscure,
                                  ),
                                ),
                            validator: (v) =>
                                (v == null || v.isEmpty) ? 'Required' : null,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () {
                              Get.toNamed(AppRoutes.forgotPassword);
                            },
                            child: const Text(
                              'Forgot Password?',
                              style: TextStyle(color: MyColors.primary),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Obx(
                          () => GradientElevatedButton(
                            onPressed: controller.isLoading.value
                                ? null
                                : controller.login,
                            child: controller.isLoading.value
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                        MyColors.primary,
                                      ),
                                    ),
                                  )
                                : const Text(
                                    'Login',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: const [
                      Expanded(child: Divider()),
                      SizedBox(width: 8),
                      Text('Or Login with'),
                      SizedBox(width: 8),
                      Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        backgroundColor: Colors.grey.withOpacity(0.1),
                        side: BorderSide(color: Colors.grey.withOpacity(0.3)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.zero,
                        ),
                      ),
                      onPressed: () async {
                        try {
                          final body = await AuthService.instance
                              .loginWithGoogle();
                          final data = body['data'] as Map<String, dynamic>?;
                          final token = data?['token'] as String?;
                          if (token != null && token.isNotEmpty) {
                            await MyLocalStorage.instance().writeData(
                              'auth_token',
                              token,
                            );
                            final user = data?['user'] as Map<String, dynamic>?;
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
                            MyLoaders.successSnackBar(
                              title: 'Login',
                              message: body['message'] ?? 'Login successful',
                            );
                            Get.offAllNamed(AppRoutes.home);
                          } else {
                            MyLoaders.errorSnackBar(
                              title: 'Login failed',
                              message: 'Token missing',
                            );
                          }
                        } catch (e) {
                          MyLoaders.errorSnackBar(
                            title: 'Google sign-in failed',
                            message: e.toString(),
                          );
                        }
                      },
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CircleAvatar(
                            radius: 12,
                            backgroundColor: Colors.transparent,
                            backgroundImage: AssetImage(
                              'assets/images/google-logo.png',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Center(
                              child: Padding(
                                padding: const EdgeInsets.only(right: 12.0),
                                child: Text(
                                  "Connect with Google",
                                  style: MyTextTheme.lightTextTheme.titleLarge!,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(0),
                        ),
                      ),
                      onPressed: () {},
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.apple, color: Colors.white, size: 24),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Center(
                              child: Padding(
                                padding: const EdgeInsets.only(right: 12.0),
                                child: Text(
                                  "Connect with Apple",
                                  style: MyTextTheme.lightTextTheme.titleLarge!
                                      .copyWith(color: MyColors.white),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text("Don't have an account? "),
                      GestureDetector(
                        onTap: () {
                          Get.toNamed(AppRoutes.register);
                        },
                        child: Text(
                          'Register!',
                          style: MyTextTheme.lightTextTheme.titleLarge,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
