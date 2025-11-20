import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/image_strings.dart';

class OnboardingItem {
  final String title;
  final String subtitle;
  final String imageAsset;
  OnboardingItem({
    required this.title,
    required this.subtitle,
    required this.imageAsset,
  });
}

class OnboardingController extends GetxController {
  final pageController = PageController();
  final currentIndex = 0.obs;

  late final List<OnboardingItem> items;

  @override
  void onInit() {
    items = [
      OnboardingItem(
        title: 'Transform Your Home with Smart Scanning',
        subtitle:
            "Use your phone's camera to capture walls, ceilings, and trims in 3D—no tape measure needed.",
        imageAsset: MyImages.onBoardingImage1,
      ),
      OnboardingItem(
        title: 'Accurate Room Measurements in Seconds',
        subtitle:
            'Scan each room with LIDAR or AR to get exact area, height, and trim calculations with <2% error.',
        imageAsset: MyImages.onBoardingImage2,
      ),
      OnboardingItem(
        title: 'Visualize, Save, and Share Projects',
        subtitle:
            'Review detailed 3D maps, edit room info, and export professional reports to PDF or data formats.',
        imageAsset: MyImages.onBoardingImage3,
      ),
    ];
    super.onInit();
  }

  bool get isFirst => currentIndex.value == 0;
  bool get isLast => currentIndex.value == items.length - 1;

  void next() {
    if (!isLast) {
      pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.ease,
      );
    }
  }

  void back() {
    if (!isFirst) {
      pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.ease,
      );
    }
  }
}
