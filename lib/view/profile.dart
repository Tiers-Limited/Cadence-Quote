import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import 'package:primechoice/core/utils/constants/image_strings.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/local_storage/storage_utility.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/core/services/profile_service.dart';
import 'package:primechoice/core/widgets/profile_image_shimmer.dart';
import 'package:primechoice/view_model/profile_controller.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final profile = Get.put(ProfileController());
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          Text(
            'Edit Profile',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displayMedium,
          ),
          const SizedBox(height: 16),
          Center(
            child: Column(
              children: [
                const AvatarWithCamera(),
                const SizedBox(height: 8),
                Obx(
                  () => Text(
                    profile.fullName.value.isNotEmpty
                        ? profile.fullName.value
                        : 'Your Name',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                const SizedBox(height: 4),
                Obx(
                  () => Text(
                    profile.email.value.isNotEmpty
                        ? profile.email.value
                        : 'Email not set',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _ProfileTile(
            icon: Iconsax.user,
            title: 'Name',
            color: Colors.black,
            onTap: () async {
              final body = await _showEditFieldDialog(
                context,
                title: 'Update Name',
                hint: 'John Doe',
                initial: profile.fullName.value,
                onSubmit: (val) =>
                    ProfileService.instance.updateProfile(fullName: val),
              );
              if (body == null) return;
              if (body['error'] != null) {
                Get.snackbar(
                  'Profile',
                  body['error'].toString(),
                  snackPosition: SnackPosition.TOP,
                  backgroundColor: Colors.red.shade50,
                );
                return;
              }
              await profile.updateName(
                (body['data']?['user']?['fullName'] ?? '').toString(),
              );
              final msg = body['message'] ?? 'Name updated successfully';
              Get.snackbar('Profile', msg, snackPosition: SnackPosition.TOP);
            },
          ),
          // const SizedBox(height: 12),
          // const _ProfileTile(
          //   icon: Iconsax.sms,
          //   title: 'Email',
          //   color: Colors.black,
          // ),
          const SizedBox(height: 12),
          _ProfileTile(
            icon: Iconsax.location,
            title: 'Address',
            color: Colors.black,
            onTap: () async {
              final body = await _showEditFieldDialog(
                context,
                title: 'Update Address',
                hint: '123 Main St, City',
                initial: profile.address.value,
                maxLines: 3,
                onSubmit: (val) =>
                    ProfileService.instance.updateProfile(address: val),
              );
              if (body == null) return;
              if (body['error'] != null) {
                Get.snackbar(
                  'Profile',
                  body['error'].toString(),
                  snackPosition: SnackPosition.TOP,
                  backgroundColor: Colors.red.shade50,
                );
                return;
              }
              await profile.updateAddress(
                (body['data']?['user']?['address'] ?? '').toString(),
              );
              final msg = body['message'] ?? 'Address updated successfully';
              Get.snackbar('Profile', msg, snackPosition: SnackPosition.TOP);
            },
          ),
          const SizedBox(height: 12),
          _ProfileTile(
            icon: Icons.checklist_outlined,
            title: 'Proposals',
            color: Colors.black,
            onTap: () {
              Get.toNamed(AppRoutes.proposalsList);
            },
          ),
          const SizedBox(height: 12),

          _ProfileTile(
            icon: Iconsax.call,
            title: 'Phone',
            color: Colors.black,
            onTap: () async {
              final body = await _showEditFieldDialog(
                context,
                title: 'Update Phone',
                hint: '+1234567890',
                initial: profile.phone.value,
                keyboardType: TextInputType.phone,
                onSubmit: (val) =>
                    ProfileService.instance.updateProfile(phoneNumber: val),
              );
              if (body == null) return;
              if (body['error'] != null) {
                Get.snackbar(
                  'Profile',
                  body['error'].toString(),
                  snackPosition: SnackPosition.TOP,
                  backgroundColor: Colors.red.shade50,
                );
                return;
              }
              await profile.updatePhone(
                (body['data']?['user']?['phoneNumber'] ?? '').toString(),
              );
              final msg =
                  body['message'] ?? 'Phone number updated successfully';
              Get.snackbar('Profile', msg, snackPosition: SnackPosition.TOP);
            },
          ),
          const SizedBox(height: 12),

          _ProfileTile(
            icon: Iconsax.logout,
            title: 'Logout',
            color: Colors.red,
            onTap: () async {
              final ok = await _showLogoutConfirmDialog(context);
              if (!ok) return;
              final storage = MyLocalStorage.instance();
              await storage.removeData('auth_token');
              Get.offAllNamed(AppRoutes.login);
            },
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class AvatarWithCamera extends StatelessWidget {
  const AvatarWithCamera({super.key});

  @override
  Widget build(BuildContext context) {
    final profile = Get.find<ProfileController>();
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 90,
          height: 90,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [
                MyColors.primaryBackground.withOpacity(0.3),
                MyColors.buttonPrimary.withOpacity(0.3),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: MyColors.primary.withOpacity(0.25),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
        ),
        Positioned(
          left: 5,
          top: 5,
          child: Obx(() {
            final url = profile.profilePicture.value;
            if (profile.uploading.value) {
              return ShimmerCircle(size: 80);
            }
            if (url.isEmpty) {
              return const CircleAvatar(
                radius: 40,
                backgroundImage: AssetImage(MyImages.user),
              );
            }
            return ClipOval(
              child: SizedBox(
                width: 80,
                height: 80,
                child: Image.network(
                  url,
                  fit: BoxFit.cover,
                  loadingBuilder: (ctx, child, progress) {
                    if (progress == null) return child;
                    return const ShimmerCircle(size: 80);
                  },
                  errorBuilder: (ctx, err, stack) {
                    return const CircleAvatar(
                      radius: 40,
                      backgroundImage: AssetImage(MyImages.user),
                    );
                  },
                ),
              ),
            );
          }),
        ),
        Positioned(
          right: -2,
          bottom: -2,
          child: InkWell(
            onTap: profile.pickAndUploadProfileImage,
            borderRadius: BorderRadius.circular(14),
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: MyColors.primary,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.15),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.camera_alt,
                color: Colors.white,
                size: 16,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ProfileTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color color;
  final VoidCallback? onTap;
  const _ProfileTile({
    required this.icon,
    required this.title,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Icon(icon, color: color.withOpacity(0.6)),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  color: color.withOpacity(0.8),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}

Future<bool> _showLogoutConfirmDialog(BuildContext context) async {
  return await showDialog<bool>(
        context: context,
        barrierDismissible: true,
        builder: (ctx) {
          return Dialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: Container(
              // padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      vertical: 12,
                      horizontal: 12,
                    ),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [MyColors.primary, MyColors.secondary],
                      ),
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(12),
                        topRight: Radius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Confirm Logout',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                    child: Column(
                      children: [
                        Text(
                          'Are you sure you want to log out?',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  side: BorderSide(
                                    color: Colors.grey.withOpacity(0.4),
                                  ),
                                  backgroundColor: Colors.grey.withOpacity(0.1),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                ),
                                onPressed: () => Navigator.of(ctx).pop(false),
                                child: const Text(
                                  'Cancel',
                                  style: TextStyle(
                                    color: Colors.black,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: GradientElevatedButton(
                                onPressed: () => Navigator.of(ctx).pop(true),
                                radius: 8,
                                child: const Text(
                                  'Logout',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ) ??
      false;
}

Future<Map<String, dynamic>?> _showEditFieldDialog(
  BuildContext context, {
  required String title,
  required String hint,
  String initial = '',
  int maxLines = 1,
  TextInputType keyboardType = TextInputType.text,
  Future<Map<String, dynamic>> Function(String value)? onSubmit,
}) async {
  final controller = TextEditingController(text: initial);
  bool isLoading = false;
  final result = await showDialog<Map<String, dynamic>?>(
    context: context,
    barrierDismissible: true,
    builder: (ctx) {
      return StatefulBuilder(
        builder: (context, setState) {
          return Dialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: Container(
              padding: EdgeInsets.zero,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      vertical: 12,
                      horizontal: 12,
                    ),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [MyColors.primary, MyColors.secondary],
                      ),
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(12),
                        topRight: Radius.circular(12),
                      ),
                    ),
                    child: Text(
                      title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: TextFormField(
                      controller: controller,
                      maxLines: maxLines,
                      keyboardType: keyboardType,
                      decoration: InputDecoration(
                        hintText: hint,
                        hintStyle: const TextStyle(
                          color: Colors.grey,
                          fontWeight: FontWeight.w600,
                        ),
                        border: const OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(
                                color: Colors.grey.withOpacity(0.4),
                              ),
                              backgroundColor: Colors.grey.withOpacity(0.1),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            onPressed: isLoading
                                ? null
                                : () => Navigator.of(ctx).pop(null),
                            child: const Text(
                              'Cancel',
                              style: TextStyle(
                                color: Colors.black,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: GradientElevatedButton(
                            onPressed: isLoading
                                ? null
                                : () async {
                                    if (onSubmit == null) {
                                      Navigator.of(
                                        ctx,
                                      ).pop({'value': controller.text.trim()});
                                      return;
                                    }
                                    setState(() => isLoading = true);
                                    final navigator = Navigator.of(ctx);
                                    Map<String, dynamic> result;
                                    try {
                                      final body = await onSubmit(
                                        controller.text.trim(),
                                      );
                                      result = body;
                                    } catch (e) {
                                      result = {'error': e.toString()};
                                    }
                                    navigator.pop(result);
                                  },
                            radius: 8,
                            child: isLoading
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
                                    'Update',
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
                ],
              ),
            ),
          );
        },
      );
    },
  );
  controller.dispose();
  return result;
}
