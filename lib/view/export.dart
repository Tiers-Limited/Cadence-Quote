import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/widgets/custom_app_bar.dart';
import 'package:primechoice/view_model/export_controller.dart';

class ExportPage extends StatelessWidget {
  final Map<String, dynamic> project;
  const ExportPage({super.key, required this.project});

  @override
  Widget build(BuildContext context) {
    final c = Get.put(ExportController(project));
    return Scaffold(
      appBar: const CustomAppBar(title: 'Export Project'),
      body: Stack(
        children: [
          const CustomBackground(),
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Obx(
                  () => _FormatTabs(
                    selected: c.selected.value,
                    onSelect: c.select,
                  ),
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.asset(
                    project['image'] ?? 'assets/images/cards/card3.jpg',
                    height: 230,
                    width: 230,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  project['title'] ?? 'Room 1 (Living Room)',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  'Walls: 24m²\nCeiling: 26m²\nTrim: 8m\nHeight: 2.75m',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  child: Text(
                    project.toString(),
                    style: const TextStyle(fontFamily: 'monospace'),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Obx(
                        () => Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: c.isExporting.value ? null : c.export,
                            child: Ink(
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                  colors: [
                                    MyColors.primary,
                                    MyColors.secondary,
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: SizedBox(
                                height: 48,
                                child: Center(
                                  child: c.isExporting.value
                                      ? const SizedBox(
                                          height: 20,
                                          width: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            valueColor:
                                                AlwaysStoppedAnimation<Color>(
                                                  Colors.white,
                                                ),
                                          ),
                                        )
                                      : const Text(
                                          'Export',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => Get.back(),
                          child: Ink(
                            decoration: BoxDecoration(
                              color: Colors.red,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const SizedBox(
                              height: 48,
                              child: Center(
                                child: Text(
                                  'Cancel',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
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
    );
  }
}

class _FormatTabs extends StatelessWidget {
  final ExportFormat selected;
  final void Function(ExportFormat) onSelect;
  const _FormatTabs({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    Widget tab(String label, ExportFormat format) {
      final active = selected == format;
      return Expanded(
        child: GestureDetector(
          onTap: () => onSelect(format),
          child: Container(
            height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: active
                  ? const LinearGradient(
                      colors: [MyColors.primary, MyColors.secondary],
                    )
                  : null,
              color: active ? null : Colors.black.withOpacity(0.2),
            ),
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  color: active ? Colors.white : Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.1),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          tab('PDF', ExportFormat.pdf),
          const SizedBox(width: 8),
          tab('JSON', ExportFormat.json),
          const SizedBox(width: 8),
          tab('NCJSON', ExportFormat.ncjson),
        ],
      ),
    );
  }
}
