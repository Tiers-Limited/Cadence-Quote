import 'package:get/get.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/view/export.dart';
import 'package:primechoice/view/project_detail.dart';
import 'package:primechoice/view/forgot_password.dart';
import 'package:primechoice/view/height_capture.dart';
import 'package:primechoice/view/scan.dart';
import 'package:primechoice/view/home.dart';
import 'package:primechoice/view/login.dart';
import 'package:primechoice/view/onboarding.dart';
import 'package:primechoice/view/profile.dart';
import 'package:primechoice/view/register.dart';
import 'package:primechoice/view/splash.dart';
import 'package:primechoice/view/verify_account.dart';

class AppPages {
  static final pages = [
    GetPage(name: AppRoutes.splash, page: () => const Splash()),
    GetPage(name: AppRoutes.onboarding, page: () => const OnboardingPage()),
    GetPage(name: AppRoutes.login, page: () => LoginPage()),
    GetPage(name: AppRoutes.register, page: () => const RegisterPage()),
    GetPage(
      name: AppRoutes.forgotPassword,
      page: () => const ForgotPasswordPage(),
    ),
    GetPage(
      name: AppRoutes.verify,
      page: () => VerifyAccountPage(
        email: Get.arguments?['email'],
        data: Get.arguments?['data'] ?? {},
      ),
    ),
    GetPage(name: AppRoutes.home, page: () => const HomePage()),
    GetPage(
      name: AppRoutes.export,
      page: () => ExportPage(project: Get.arguments?['project'] ?? {}),
    ),
    GetPage(
      name: AppRoutes.projectDetail,
      page: () => ProjectDetailPage(project: Get.arguments?['project'] ?? {}),
    ),
    GetPage(name: AppRoutes.profile, page: () => const ProfilePage()),
    GetPage(
      name: AppRoutes.heightCapture,
      page: () => const HeightCapturePage(),
    ),
    GetPage(name: AppRoutes.scan, page: () => const ScanPage()),
  ];
}
