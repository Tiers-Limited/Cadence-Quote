import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/services/auth_service.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_theme.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/view_model/register_controller.dart';
import 'package:primechoice/core/utils/local_storage/storage_utility.dart';
import 'package:primechoice/core/utils/popups/loaders.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(RegisterController());
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
                  const SizedBox(height: 16),
                  Text(
                    'Register',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.displayMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Please enter your credentials to proceed',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 28),
                  Form(
                    key: controller.formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Full Name',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: controller.nameController,
                          textInputAction: TextInputAction.next,
                          decoration: MyTextFormFieldTheme.lightInputDecoration(
                            hintText: 'John Doe',
                            prefixIcon: const Icon(
                              Icons.person_outline,
                              color: MyColors.primary,
                            ),
                          ),
                          validator: (v) {
                            if (v == null || v.trim().isEmpty)
                              return 'Required';
                            return null;
                          },
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Address',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: controller.addressController,
                          keyboardType: TextInputType.streetAddress,
                          textInputAction: TextInputAction.next,
                          maxLines: 1,
                          decoration: MyTextFormFieldTheme.lightInputDecoration(
                            hintText: '123 Main St, City, Country',
                            prefixIcon: const Icon(
                              Icons.location_on_outlined,
                              color: MyColors.primary,
                            ),
                          ),
                          validator: (v) =>
                              (v == null || v.isEmpty) ? 'Required' : null,
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Email address',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: controller.emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          decoration: MyTextFormFieldTheme.lightInputDecoration(
                            hintText: 'example123@gmail.com',
                            prefixIcon: const Icon(
                              Icons.email_outlined,
                              color: MyColors.primary,
                            ),
                          ),
                          validator: (v) {
                            if (v == null || v.isEmpty) return 'Required';
                            final email = v.trim();
                            final re = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
                            if (!re.hasMatch(email))
                              return 'Invalid email format';
                            return null;
                          },
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Password',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Obx(
                          () => TextFormField(
                            controller: controller.passwordController,
                            obscureText: controller.obscure1.value,
                            textInputAction: TextInputAction.next,
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
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'Required';
                              final p = v;
                              if (p.length < 8 ||
                                  !RegExp(r'[A-Z]').hasMatch(p) ||
                                  !RegExp(r'[a-z]').hasMatch(p) ||
                                  !RegExp(r'[0-9]').hasMatch(p))
                                return 'At least 8 characters including an uppercase letter, a lowercase letter, and a number';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(height: 20),
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
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'Required';
                              if (controller.passwordController.text != v)
                                return 'Passwords do not match';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(height: 16),
                        Obx(
                          () => GradientElevatedButton(
                            onPressed: controller.isLoading.value
                                ? null
                                : controller.register,
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
                                : const Text(
                                    'Register',
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
                      Text('Or Register with'),
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
                              .signupWithGoogle();
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
                            }
                            MyLoaders.successSnackBar(
                              title: 'Signup',
                              message: body['message'] ?? 'Account created',
                            );
                            Get.offAllNamed(AppRoutes.home);
                          } else {
                            MyLoaders.errorSnackBar(
                              title: 'Signup failed',
                              message: 'Token missing',
                            );
                          }
                        } catch (e) {
                          MyLoaders.errorSnackBar(
                            title: 'Google sign-up failed',
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
                                  style: TextStyle(color: MyColors.white),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text("Already have an account? "),
                      GestureDetector(
                        onTap: () {
                          Get.toNamed(AppRoutes.login);
                        },
                        child: Text(
                          'LogIn!',
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
