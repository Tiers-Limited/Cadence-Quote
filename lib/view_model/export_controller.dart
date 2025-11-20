import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/popups/loaders.dart';
import 'package:primechoice/core/utils/io/file_saver.dart';
import 'package:primechoice/core/utils/pdf/pdf_builder.dart';

enum ExportFormat { pdf, json, ncjson }

class ExportController extends GetxController {
  final Map<String, dynamic> project;
  ExportController(this.project);

  final selected = ExportFormat.pdf.obs;
  final isExporting = false.obs;

  void select(ExportFormat f) => selected.value = f;

  Future<void> export() async {
    isExporting.value = true;
    try {
      final name = (project['title'] ?? 'project').toString().replaceAll(
        ' ',
        '_',
      );
      final ts = DateTime.now().millisecondsSinceEpoch;
      late String savedTo;
      switch (selected.value) {
        case ExportFormat.json:
          final bytes = utf8.encode(jsonEncode(project));
          savedTo = await saveBytes(
            '${name}_$ts.json',
            'application/json',
            bytes,
          );
          break;
        case ExportFormat.ncjson:
          final nc = {'type': 'ncjson', 'payload': project, 'version': 1};
          final bytes = utf8.encode(jsonEncode(nc));
          savedTo = await saveBytes(
            '${name}_$ts.ncjson',
            'application/json',
            bytes,
          );
          break;
        case ExportFormat.pdf:
          final bytes = await buildProjectPdf(name, project);
          savedTo = await saveBytes(
            '${name}_$ts.pdf',
            'application/pdf',
            bytes,
          );
          break;
      }
      MyLoaders.successSnackBar(
        title: 'Exported',
        message: 'Saved to $savedTo',
      );
      if (kDebugMode) {
        print('Exported to $savedTo');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Export failed: $e');
      }
      MyLoaders.errorSnackBar(title: 'Export failed', message: e.toString());
    } finally {
      isExporting.value = false;
    }
  }
}
