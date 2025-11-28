import 'package:flutter/material.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import '../../constants/sizes.dart';

class MyTextFormFieldTheme {
  MyTextFormFieldTheme._();

  static InputDecorationTheme lightInputDecorationTheme = InputDecorationTheme(
    prefixIconColor: MyColors.primary,
    floatingLabelStyle: const TextStyle(color: MyColors.primary),
    errorMaxLines: 5,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(MySizes.borderRadiusMd),
      borderSide: const BorderSide(width: 1, color: MyColors.primary),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(MySizes.borderRadiusMd),
      borderSide: const BorderSide(width: 1, color: MyColors.primary),
    ),
    disabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(MySizes.borderRadiusMd),
      borderSide: const BorderSide(width: 1, color: MyColors.primary),
    ),
    hintStyle: TextStyle(color: MyColors.grey.withOpacity(0.5)),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(MySizes.borderRadiusMd),
      borderSide: const BorderSide(width: 2, color: MyColors.primary),
    ),
  );

  static InputDecoration lightInputDecoration({
    String? labelText,
    String? hintText,
    Widget? prefixIcon,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      labelText: labelText,
      hintText: hintText,
      prefixIcon: prefixIcon,
      suffixIcon: suffixIcon,
      prefixIconColor: Colors.grey,
      suffixIconColor: Colors.grey,
      floatingLabelStyle: const TextStyle(color: Colors.grey),
      labelStyle: const TextStyle(color: Colors.grey),
      errorMaxLines: 5,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(MySizes.borderRadiusMd),
        borderSide: const BorderSide(width: 1, color: MyColors.primary),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(MySizes.borderRadiusMd),
        borderSide: const BorderSide(width: 1, color: MyColors.primary),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(MySizes.borderRadiusMd),
        borderSide: const BorderSide(width: 1, color: MyColors.primary),
      ),
      hintStyle: const TextStyle(color: Colors.grey),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(MySizes.borderRadiusMd),
        borderSide: const BorderSide(width: 2, color: MyColors.primary),
      ),
    );
  }
}
