import 'package:flutter/material.dart';
import '../../constants/colors.dart';

class MyButtonTheme {
  static BoxDecoration primaryGradient({double radius = 24}) {
    return BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [MyColors.primary, MyColors.secondary],
      ),
      borderRadius: BorderRadius.circular(radius),
      // boxShadow: [
      //   BoxShadow(
      //     color: MyColors.primary.withOpacity(0.9),
      //     blurRadius: 12,
      //     offset: const Offset(10, 10),
      //     spreadRadius: 1,
      //   ),
      // ],
    );
  }
}
