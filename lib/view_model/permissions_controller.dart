import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/foundation.dart';

class PermissionsController extends GetxController {
  final cameraStatus = PermissionStatus.denied.obs;
  bool get cameraGranted => cameraStatus.value.isGranted;

  Future<void> requestCamera() async {
    if (kIsWeb) {
      cameraStatus.value = PermissionStatus.granted;
      return;
    }
    final status = await Permission.camera.request();
    cameraStatus.value = status;
  }

  Future<void> refreshCamera() async {
    if (kIsWeb) {
      cameraStatus.value = PermissionStatus.granted;
      return;
    }
    cameraStatus.value = await Permission.camera.status;
  }

  Future<void> openSettings() async {
    if (kIsWeb) {
      await refreshCamera();
      return;
    }
    await openAppSettings();
    await refreshCamera();
  }
}
