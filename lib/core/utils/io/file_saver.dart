import 'file_saver_io.dart'
    if (dart.library.html) 'file_saver_web.dart'
    as saver;

Future<String> saveBytes(String fileName, String mimeType, List<int> bytes) {
  return saver.saveBytes(fileName, mimeType, bytes);
}
