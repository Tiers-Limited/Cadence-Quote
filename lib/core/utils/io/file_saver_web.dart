// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

Future<String> saveBytes(
  String fileName,
  String mimeType,
  List<int> bytes,
) async {
  final blob = html.Blob([bytes], mimeType);
  final url = html.Url.createObjectUrlFromBlob(blob);
  final anchor = html.AnchorElement(href: url)
    ..download = fileName
    ..style.display = 'none';
  html.document.body?.append(anchor);
  anchor.click();
  anchor.remove();
  html.Url.revokeObjectUrl(url);
  return 'downloaded:$fileName';
}
