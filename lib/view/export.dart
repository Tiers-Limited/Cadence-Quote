import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
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
                _JsonPreview(
                  data: {
                    'project': project['title'] ?? 'Room 1 (Living Room)',
                    'walls': '24m²',
                    'ceiling': '26m²',
                    'height': '2.72m',
                    'trim': '8m',
                  },
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Obx(
                        () => GradientElevatedButton(
                          onPressed: c.isExporting.value ? null : c.export,
                          radius: 12,
                          child: c.isExporting.value
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
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
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 48,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red,
                          ),
                          onPressed: () => Get.back(),
                          child: const Text(
                            'Cancel',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
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

class _JsonPreview extends StatelessWidget {
  final Map<String, String> data;
  const _JsonPreview({required this.data});

  @override
  Widget build(BuildContext context) {
    final entries = data.entries.toList();
    final children = <TextSpan>[
      TextSpan(
        text: '{\n',
        style: const TextStyle(fontFamily: 'monospace', color: Colors.grey),
      ),
    ];
    for (var i = 0; i < entries.length; i++) {
      final e = entries[i];
      final comma = i == entries.length - 1 ? '' : ',';
      children.addAll([
        TextSpan(
          text: '  "${e.key}": ',
          style: const TextStyle(fontFamily: 'monospace', color: Colors.red),
        ),
        TextSpan(
          text: '"${e.value}"',
          style: const TextStyle(
            fontFamily: 'monospace',
            color: MyColors.primary,
          ),
        ),
        TextSpan(
          text: '$comma\n',
          style: const TextStyle(fontFamily: 'monospace'),
        ),
      ]);
    }
    children.add(
      const TextSpan(
        text: '}',
        style: TextStyle(fontFamily: 'monospace', color: Colors.grey),
      ),
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: MyColors.primary.withOpacity(0.12),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: RichText(text: TextSpan(children: children)),
    );
  }
}
