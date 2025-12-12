import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';

class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final bool showBack;
  final VoidCallback? onBack;
  final Color? backgroundColor;
  final Color? titleColor;
  final Gradient? gradient;
  final List<Widget>? actions;

  const CustomAppBar({
    super.key,
    required this.title,
    this.showBack = true,
    this.onBack,
    this.backgroundColor,
    this.titleColor,
    this.gradient,
    this.actions,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final useGradient =
        gradient ??
        const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [MyColors.primary, MyColors.secondary],
        );
    return AppBar(
      title: Text(title, style: TextStyle(color: titleColor ?? Colors.white)),
      leading: showBack
          ? IconButton(
              onPressed: onBack ?? () => Get.back(closeOverlays: false),
              icon: Icon(Icons.arrow_back, color: titleColor ?? Colors.white),
            )
          : null,
      actions: actions,
      backgroundColor: backgroundColor ?? Colors.transparent,
      elevation: 0,
      flexibleSpace: Container(
        decoration: BoxDecoration(gradient: useGradient),
      ),
    );
  }
}
