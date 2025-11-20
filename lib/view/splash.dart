import 'package:flutter/material.dart';
import 'package:primechoice/core/utils/constants/image_strings.dart';
import 'package:primechoice/core/utils/device/device_utility.dart';
import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/view_model/permissions_controller.dart';

class Splash extends StatefulWidget {
  const Splash({super.key});

  @override
  State<Splash> createState() => _SplashState();
}

class _SplashState extends State<Splash> {
  @override
  void initState() {
    super.initState();
    _initFlow();
  }

  Future<void> _initFlow() async {
    final p = Get.put(PermissionsController());

    /// 3 sec wait (optional — splash animation)
    await Future.delayed(const Duration(seconds: 3));

    /// Now request permission and wait for result
    final status = await Permission.camera.request();
    await p.refreshCamera();

    /// After permission result, navigate
    if (!mounted) return;

    Get.offAllNamed(AppRoutes.onboarding);
  }

  @override
  Widget build(BuildContext context) {
    final width = MyDeviceUtils.getScreenWidth(context);
    return Scaffold(
      body: Stack(
        children: [
          const CustomBackground(),
          Center(
            child: Image.asset(
              MyImages.splashImage,
              width: width * 0.7,
              fit: BoxFit.contain,
            ),
          ),
        ],
      ),
    );
  }
}
