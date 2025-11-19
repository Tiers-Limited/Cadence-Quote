import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../constants/colors.dart';

/* -- Light & Dark Text Themes -- */
class MyTextTheme {
  MyTextTheme._(); //To avoid creating instances

  /* -- Light Text Theme -- */
  static TextTheme lightTextTheme = TextTheme(
    displayLarge: TextStyle(
      fontSize: 28.0,
      fontWeight: FontWeight.bold,
      fontFamily: GoogleFonts.poppins().fontFamily,
      color: MyColors.textPrimary,
    ),
    displayMedium: TextStyle(
      fontSize: 24.0,
      fontWeight: FontWeight.bold,
      color: MyColors.textPrimary,
      fontFamily: GoogleFonts.poppins().fontFamily,
    ),
    displaySmall: TextStyle(
      fontSize: 24.0,
      fontWeight: FontWeight.normal,
      color: MyColors.textPrimary,
      fontFamily: GoogleFonts.poppins().fontFamily,
    ),
    headlineMedium: TextStyle(
      fontSize: 18.0,
      fontWeight: FontWeight.w600,
      color: MyColors.textPrimary,
      fontFamily: GoogleFonts.poppins().fontFamily,
    ),
    headlineSmall: TextStyle(
      fontSize: 18.0,
      fontWeight: FontWeight.normal,
      color: MyColors.textPrimary,
      fontFamily: GoogleFonts.poppins().fontFamily,
    ),
    titleLarge: TextStyle(
      fontSize: 14.0,
      fontWeight: FontWeight.w600,
      color: MyColors.textPrimary,
    ),
    bodyLarge: TextStyle(fontSize: 14.0, color: MyColors.textPrimary),
    bodyMedium: TextStyle(fontSize: 14.0, color: MyColors.textSecondary),
  );
}
