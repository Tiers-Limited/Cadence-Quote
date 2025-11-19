import 'package:ar_flutter_plugin/widgets/ar_view.dart';
import 'package:ar_flutter_plugin/managers/ar_session_manager.dart';
import 'package:ar_flutter_plugin/managers/ar_object_manager.dart';
import 'package:ar_flutter_plugin/managers/ar_anchor_manager.dart';
import 'package:ar_flutter_plugin/managers/ar_location_manager.dart';
import 'package:ar_flutter_plugin/models/ar_hittest_result.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:vector_math/vector_math_64.dart' as vmath;

import '../view_model/height_capture_controller.dart';
import '../view_model/permissions_controller.dart';

class HeightCapturePage extends StatelessWidget {
  HeightCapturePage({super.key});
  final c = Get.put(HeightCaptureController());
  final p = Get.put(PermissionsController());

  @override
  Widget build(BuildContext context) {
    final imgW = MediaQuery.of(context).size.width;
    final imgH = MediaQuery.of(context).size.height * 0.65;

    return Scaffold(
      body: Column(
        children: [
          SizedBox(
            width: imgW,
            height: imgH,
            child: Obx(() {
              if (!p.cameraGranted) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Camera permission required',
                        style: TextStyle(color: Colors.white),
                      ),
                      const SizedBox(height: 10),
                      ElevatedButton(
                        onPressed: () async {
                          final status = await Permission.camera.request();
                          p.cameraStatus.value = status;
                        },
                        child: const Text("Allow Camera"),
                      ),
                    ],
                  ),
                );
              }

              return _ARMeasureView(controller: c);
            }),
          ),

          const SizedBox(height: 12),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: InkWell(
              onTap: () => c.reset(),
              child: Ink(
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.blue,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Center(
                  child: Text(
                    "Tap FLOOR then CEILING",
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ARMeasureView extends StatefulWidget {
  final HeightCaptureController controller;

  const _ARMeasureView({required this.controller});

  @override
  State<_ARMeasureView> createState() => _ARMeasureViewState();
}

class _ARMeasureViewState extends State<_ARMeasureView> {
  ARSessionManager? arSessionManager;
  ARObjectManager? arObjectManager;
  ARAnchorManager? arAnchorManager;

  double? heightMeters;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ARView(
          onARViewCreated: _onARViewCreated, // UPDATED
        ),

        // Center dashed line and pins matching reference design
        Positioned.fill(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final centerX = constraints.maxWidth / 2;
              return Stack(
                children: [
                  Positioned(
                    left: centerX - 1,
                    top: 16,
                    child: _DashedLine(height: constraints.maxHeight - 32),
                  ),
                  if (widget.controller.ceilingWorld != null)
                    Positioned(
                      left: centerX - 10,
                      top: 24,
                      child: const _Pin(),
                    ),
                  if (widget.controller.floorWorld != null)
                    Positioned(
                      left: centerX - 10,
                      bottom: 24,
                      child: const _Pin(),
                    ),
                ],
              );
            },
          ),
        ),

        if (heightMeters != null)
          Positioned(
            bottom: 25,
            right: 25,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.65),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                "${heightMeters!.toStringAsFixed(2)} m",
                style: const TextStyle(color: Colors.white, fontSize: 18),
              ),
            ),
          ),
      ],
    );
  }

  void _onARViewCreated(
    ARSessionManager sessionManager,
    ARObjectManager objectManager,
    ARAnchorManager anchorManager,
    ARLocationManager locationManager,
  ) async {
    arSessionManager = sessionManager;
    arObjectManager = objectManager;
    arAnchorManager = anchorManager;

    await arSessionManager!.onInitialize(
      showPlanes: true,
      showFeaturePoints: false,
      handleTaps: true,
    );

    await arObjectManager!.onInitialize();

    arSessionManager!.onPlaneOrPointTap = _onPlaneTap;
  }

  Future<void> _onPlaneTap(List<ARHitTestResult> hits) async {
    if (hits.isEmpty) return;
    final hit = hits.first;

    final pos = vmath.Vector3(
      hit.worldTransform.storage[12],
      hit.worldTransform.storage[13],
      hit.worldTransform.storage[14],
    );

    final c = widget.controller;

    if (c.floorWorld == null) {
      c.floorWorld = pos;
    } else {
      c.ceilingWorld ??= pos;
      c.ceilingWorld = pos;
    }

    setState(() {
      heightMeters = c.heightMetersAr;
    });
  }

  @override
  void dispose() {
    arSessionManager?.dispose();
    super.dispose();
  }
}

class _Pin extends StatelessWidget {
  const _Pin();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 20,
      height: 20,
      decoration: const BoxDecoration(
        color: Colors.red,
        shape: BoxShape.circle,
      ),
    );
  }
}

class _DashedLine extends StatelessWidget {
  final double height;
  const _DashedLine({required this.height});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(size: Size(2, height), painter: _DashedLinePainter());
  }
}

class _DashedLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..strokeWidth = 2;
    const dashHeight = 8;
    const dashSpace = 6;
    double y = 0;
    while (y < size.height) {
      canvas.drawLine(
        const Offset(1, 0) + Offset(0, y),
        const Offset(1, 0) + Offset(0, y + dashHeight),
        paint,
      );
      y += dashHeight + dashSpace;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
