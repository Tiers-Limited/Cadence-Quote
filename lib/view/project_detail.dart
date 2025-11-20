import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/core/widgets/custom_app_bar.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/routes/app_routes.dart';

class ProjectDetailPage extends StatelessWidget {
  final Map<String, dynamic> project;
  const ProjectDetailPage({super.key, required this.project});

  @override
  Widget build(BuildContext context) {
    final title = project['title'] ?? 'Project Name';
    return Scaffold(
      appBar: CustomAppBar(title: title),
      body: Stack(
        children: [
          const CustomBackground(),
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.all(12),
                    child: Image.asset(
                      project['image'] ?? 'assets/images/logo.png',
                      height: 260,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: MyColors.primary.withOpacity(0.08),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              project['title'] ?? 'Room 1 (Living Room)',
                              style: TextStyle(
                                fontSize: 14.0,
                                fontWeight: FontWeight.bold,
                                fontFamily: GoogleFonts.poppins().fontFamily,
                                color: MyColors.primary,
                              ),
                            ),
                          ),
                          const Icon(Icons.keyboard_arrow_down),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _InfoTile(label: 'Label', value: 'Bedroom'),
                      const SizedBox(height: 8),
                      _InfoTile(label: 'Walls', value: '24 m²'),
                      const SizedBox(height: 8),
                      _InfoTile(label: 'Ceiling', value: '--'),
                      const SizedBox(height: 8),
                      _InfoTile(label: 'Trim', value: '8 m'),
                      const SizedBox(height: 8),
                      _InfoTile(label: 'Height', value: '2.72 m'),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: GradientElevatedButton(
                              onPressed: () {
                                Get.toNamed(
                                  AppRoutes.export,
                                  arguments: {'project': project},
                                );
                              },
                              radius: 12,
                              child: const Text(
                                'Export',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: GradientElevatedButton(
                              radius: 12,
                              gradient: const LinearGradient(
                                colors: [Colors.black87, Colors.black],
                              ),
                              onPressed: () {},
                              child: const Text(
                                'Save Project',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final String label;
  final String value;
  const _InfoTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: MyColors.buttonPrimary.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14.0,
                fontWeight: FontWeight.bold,
                fontFamily: GoogleFonts.poppins().fontFamily,
                color: MyColors.black,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14.0,
              fontWeight: FontWeight.bold,
              fontFamily: GoogleFonts.poppins().fontFamily,
              color: MyColors.black.withOpacity(0.7),
            ),
          ),
        ],
      ),
    );
  }
}
