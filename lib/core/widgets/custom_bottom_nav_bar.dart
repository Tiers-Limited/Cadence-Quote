import 'package:flutter/material.dart';
import 'package:primechoice/core/utils/constants/colors.dart';

class CustomBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<BottomNavigationBarItem> items;
  final Color? backgroundColor;
  final Color? selectedItemColor;
  final Color? unselectedItemColor;
  final Gradient? gradient;

  const CustomBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
    this.backgroundColor,
    this.selectedItemColor,
    this.unselectedItemColor,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    final useGradient =
        gradient ??
        const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [MyColors.primary, MyColors.secondary],
        );
    return Container(
      decoration: BoxDecoration(gradient: useGradient),
      child: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: onTap,
        items: items,
        backgroundColor: Colors.transparent,
        selectedItemColor: selectedItemColor ?? Colors.white,
        unselectedItemColor: unselectedItemColor ?? Colors.white70,
        elevation: 0,
      ),
    );
  }
}
