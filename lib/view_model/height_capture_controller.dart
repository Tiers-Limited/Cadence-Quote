import 'package:get/get.dart';
import 'package:vector_math/vector_math_64.dart' as vmath;

class HeightCaptureController extends GetxController {
  vmath.Vector3? floorWorld;
  vmath.Vector3? ceilingWorld;

  double? get heightMetersAr {
    if (floorWorld == null || ceilingWorld == null) return null;
    return (floorWorld!.y - ceilingWorld!.y).abs();
  }

  void reset() {
    floorWorld = null;
    ceilingWorld = null;
  }
}
