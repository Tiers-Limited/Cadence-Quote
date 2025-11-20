import 'dart:typed_data';
import 'package:pdf/widgets.dart' as pw;

Future<Uint8List> buildProjectPdf(
  String title,
  Map<String, dynamic> project,
) async {
  final doc = pw.Document();
  final entries = project.entries
      .map((e) => MapEntry(e.key.toString(), e.value?.toString() ?? ''))
      .toList();
  doc.addPage(
    pw.Page(
      build: (context) {
        return pw.Padding(
          padding: const pw.EdgeInsets.all(24),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                'Export Project',
                style: pw.TextStyle(
                  fontSize: 20,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 8),
              pw.Text(title, style: pw.TextStyle(fontSize: 16)),
              pw.SizedBox(height: 16),
              pw.Table(
                columnWidths: {
                  0: const pw.FlexColumnWidth(3),
                  1: const pw.FlexColumnWidth(4),
                },
                border: pw.TableBorder.all(width: 0.5),
                children: [
                  for (final e in entries)
                    pw.TableRow(
                      children: [
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text(e.key),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text(e.value),
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ),
        );
      },
    ),
  );
  return Uint8List.fromList(await doc.save());
}
