import 'package:flutter/material.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/constants/image_strings.dart';

class CustomBackground extends StatelessWidget {
  final Widget? child;
  final Color backgroundColor;
  final Color circleColor;
  final double topDiameter;
  final double bottomDiameter;
  final double intensity;
  final double topOffset;
  final double bottomOffset;

  const CustomBackground({
    super.key,
    this.child,
    this.backgroundColor = MyColors.lightBackground,
    this.circleColor = MyColors.primary,
    this.topDiameter = 220,
    this.bottomDiameter = 220,
    this.intensity = 0.5,
    this.topOffset = 0,
    this.bottomOffset = 0,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: Container(
        decoration: BoxDecoration(
          image: DecorationImage(
            image: AssetImage(MyImages.backgroundImage),
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
          ),
        ),
      ),
    );
  }
}
