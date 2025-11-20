import 'dart:io';

Future<String> saveBytes(
  String fileName,
  String mimeType,
  List<int> bytes,
) async {
  final dir = Directory.systemTemp.path;
  final path = '$dir/$fileName';
  final file = File(path);
  await file.writeAsBytes(bytes, flush: true);
  return path;
}
