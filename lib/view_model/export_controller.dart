import 'dart:convert';
import 'dart:io';

import 'package:get/get.dart';
import 'package:primechoice/core/utils/popups/loaders.dart';

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
      final dir = Directory.systemTemp.path;
      final name = (project['title'] ?? 'project').toString().replaceAll(
        ' ',
        '_',
      );
      late String path;
      switch (selected.value) {
        case ExportFormat.json:
          path = '$dir/${name}_${DateTime.now().millisecondsSinceEpoch}.json';
          await File(path).writeAsString(jsonEncode(project));
          break;
        case ExportFormat.ncjson:
          path = '$dir/${name}_${DateTime.now().millisecondsSinceEpoch}.ncjson';
          final nc = {'type': 'ncjson', 'payload': project, 'version': 1};
          await File(path).writeAsString(jsonEncode(nc));
          break;
        case ExportFormat.pdf:
          path = '$dir/${name}_${DateTime.now().millisecondsSinceEpoch}.pdf';
          await File(
            path,
          ).writeAsString('Export Project\n${jsonEncode(project)}');
          break;
      }
      MyLoaders.successSnackBar(title: 'Exported', message: 'Saved to $path');
    } catch (e) {
      MyLoaders.errorSnackBar(title: 'Export failed', message: e.toString());
    } finally {
      isExporting.value = false;
    }
  }
}
