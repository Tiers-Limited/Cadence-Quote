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

class GradientElevatedButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final double height;
  final double radius;
  final Gradient? gradient;
  final double elevation;

  const GradientElevatedButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.height = 48,
    this.radius = 24,
    this.gradient,
    this.elevation = 8,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: DecoratedBox(
        decoration: (gradient == null)
            ? MyButtonTheme.primaryGradient(radius: radius)
            : BoxDecoration(
                gradient: gradient,
                borderRadius: BorderRadius.circular(radius),
              ),
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(
            elevation: elevation,
            shadowColor: MyColors.primary.withOpacity(0.6),
            backgroundColor: Colors.transparent,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(radius),
            ),
            padding: EdgeInsets.zero,
          ),
          onPressed: onPressed,
          child: child,
        ),
      ),
    );
  }
}
