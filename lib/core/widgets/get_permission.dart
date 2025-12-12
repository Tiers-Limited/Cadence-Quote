import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';

class GetPermission extends StatelessWidget {
  final VoidCallback onRequest;
  const GetPermission({super.key, required this.onRequest});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        const CustomBackground(),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: () => Get.back(closeOverlays: false),
                      icon: const Icon(Icons.arrow_back),
                    ),
                  ],
                ),
                const SizedBox(height: 40),
                Center(
                  child: Container(
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [MyColors.primary, MyColors.secondary],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: MyColors.primary.withOpacity(0.35),
                          blurRadius: 16,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.camera_alt,
                      color: Colors.white,
                      size: 38,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Allow Camera Access',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.displayMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  'Enable your camera to start scanning walls and measure rooms.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 24),
                GradientElevatedButton(
                  onPressed: onRequest,
                  child: const Text(
                    'Grant Access',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
