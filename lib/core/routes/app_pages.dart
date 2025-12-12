import 'package:get/get.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/view/export.dart';
import 'package:primechoice/view/project_detail.dart';
import 'package:primechoice/view/forgot_password.dart';
import 'package:primechoice/view/height_capture.dart';
import 'package:primechoice/view/scan.dart';
import 'package:primechoice/view/home.dart';
import 'package:primechoice/view/login.dart';
import 'package:primechoice/view_model/login_controller.dart';
import 'package:primechoice/view/onboarding.dart';
import 'package:primechoice/view/profile.dart';
import 'package:primechoice/view/register.dart';
import 'package:primechoice/view/splash.dart';
import 'package:primechoice/view/verify_account.dart';
import 'package:primechoice/view_model/profile_controller.dart';
import 'package:primechoice/view/job_type.dart';
import 'package:primechoice/view/customer_info.dart';
import 'package:primechoice/view/areas_labor.dart';
import 'package:primechoice/view/products.dart';

class AppPages {
  static final pages = [
    GetPage(name: AppRoutes.splash, page: () => const Splash()),
    GetPage(name: AppRoutes.onboarding, page: () => const OnboardingPage()),
    GetPage(
      name: AppRoutes.login,
      page: () => LoginPage(),
      binding: BindingsBuilder(() {
        Get.create<LoginController>(() => LoginController());
      }),
    ),
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
    GetPage(
      name: AppRoutes.profile,
      page: () => const ProfilePage(),
      binding: BindingsBuilder(() {
        Get.lazyPut(() => ProfileController(), fenix: true);
      }),
    ),
    GetPage(
      name: AppRoutes.heightCapture,
      page: () => const HeightCapturePage(),
    ),
    GetPage(name: AppRoutes.scan, page: () => const ScanPage()),
    GetPage(name: AppRoutes.jobType, page: () => const JobTypePage()),
    GetPage(name: AppRoutes.customerInfo, page: () => const CustomerInfoPage()),
    GetPage(name: AppRoutes.areasLabor, page: () => const AreasLaborPage()),
    GetPage(name: AppRoutes.products, page: () => const ProductsPage()),
  ];
}
