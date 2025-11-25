import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/routes/app_pages.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/elevated_button_theme.dart';
import 'package:primechoice/core/utils/constants/colors.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Prime Choice',
      theme: ThemeData(
        textTheme: MyTextTheme.lightTextTheme,
        inputDecorationTheme: MyTextFormFieldTheme.lightInputDecorationTheme,
        elevatedButtonTheme: MyElevatedButtonTheme.lightElevatedButtonTheme,
        //Cursor colour
        textSelectionTheme: const TextSelectionThemeData(
          cursorColor: MyColors.primary,
          selectionColor: Color(0x80368d9c),
          selectionHandleColor: MyColors.primary,
        ),
        scaffoldBackgroundColor: Colors.white,
      ),
      initialRoute: AppRoutes.splash,
      getPages: AppPages.pages,
    );
  }
}
