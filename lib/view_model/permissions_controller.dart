import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';

class PermissionsController extends GetxController {
  final cameraStatus = PermissionStatus.denied.obs;
  bool get cameraGranted => cameraStatus.value.isGranted;

  Future<void> requestCamera() async {
    final status = await Permission.camera.request();
    cameraStatus.value = status;
  }

  Future<void> refreshCamera() async {
    cameraStatus.value = await Permission.camera.status;
  }

  Future<void> openSettings() async {
    await openAppSettings();
    await refreshCamera();
  }
}