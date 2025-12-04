import 'package:flutter/material.dart';
import 'package:primechoice/core/utils/constants/colors.dart';

class ShimmerCircle extends StatefulWidget {
  final double size;
  const ShimmerCircle({super.key, this.size = 80});

  @override
  State<ShimmerCircle> createState() => _ShimmerCircleState();
}

class _ShimmerCircleState extends State<ShimmerCircle>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
    _anim = Tween<double>(
      begin: -1,
      end: 1,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, child) {
        final value = _anim.value;
        final begin = Alignment(value, -1);
        final end = Alignment(value, 1);
        return Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: begin,
              end: end,
              colors: [
                MyColors.primary.withOpacity(0.25),
                MyColors.primary.withOpacity(0.8),
                MyColors.secondary.withOpacity(0.25),
              ],
            ),
          ),
        );
      },
    );
  }
}
