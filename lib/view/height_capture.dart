import 'package:camera/camera.dart';
import 'dart:io' show Platform;
import 'package:arkit_plugin/arkit_plugin.dart';
import 'package:vector_math/vector_math_64.dart' as vmath;
import 'package:flutter/rendering.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/view_model/permissions_controller.dart';
import 'dart:math' as math;

class HeightCapturePage extends StatefulWidget {
  const HeightCapturePage({super.key});

  @override
  State<HeightCapturePage> createState() => _HeightCapturePageState();
}

class _HeightCapturePageState extends State<HeightCapturePage> {
  final p = Get.put(PermissionsController());
  CameraController? _cameraController;
  bool _initializing = false;
  ARKitController? _arkitController; // iOS ARKit controller

  // Manual placement state
  Offset? _dragPos; // live pin while long-pressing
  Offset? _floorPin; // saved pin 1
  Offset? _ceilingPin; // saved pin 2

  // AR world positions + computed distance
  vmath.Vector3? _floorWorld;
  vmath.Vector3? _ceilingWorld;
  double? _distanceMeters;

  @override
  void initState() {
    super.initState();
    _ensurePermissionThenInit();
  }

  Future<void> _ensurePermissionThenInit() async {
    await p.refreshCamera();
    if (!p.cameraGranted) return;
    // On iOS, ARKit provides the camera feed; no need to init Camera plugin.
    if (!Platform.isIOS) {
      await _initCamera();
    }
  }

  Future<void> _initCamera() async {
    if (_initializing) return;
    setState(() => _initializing = true);
    try {
      final cameras = await availableCameras();
      final back = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      _cameraController = CameraController(
        back,
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await _cameraController!.initialize();
    } catch (_) {
      // Ignore errors for now; UI will show permission/help content
    } finally {
      if (mounted) setState(() => _initializing = false);
    }
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _arkitController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Camera preview (fills screen)
          Positioned.fill(
            child: Obx(() {
              if (!p.cameraGranted) {
                return _PermissionView(
                  onRequest: () async {
                    await p.requestCamera();
                    await _ensurePermissionThenInit();
                  },
                  onSettings: p.openSettings,
                );
              }
              // On iOS, show ARKit scene view; otherwise, show CameraPreview
              if (Platform.isIOS) {
                return ARKitSceneView(
                  enableTapRecognizer: false,
                  onARKitViewCreated: _onARKitViewCreated,
                );
              }
              if (_cameraController == null ||
                  !_cameraController!.value.isInitialized) {
                return const Center(child: CircularProgressIndicator());
              }
              return CameraPreview(_cameraController!);
            }),
          ),

          // Gesture layer to capture long press and paint pins/line
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onLongPressStart: (details) {
                setState(() => _dragPos = details.localPosition);
              },
              onLongPressMoveUpdate: (details) {
                setState(() => _dragPos = details.localPosition);
              },
              onLongPressEnd: (details) async {
                // Persist the 2D pin (floor first, then ceiling)
                Offset? toSave = _dragPos;
                vmath.Vector3? worldPoint;

                // For iOS AR: perform a hit test at normalized screen coords to get world position
                if (Platform.isIOS &&
                    _arkitController != null &&
                    toSave != null) {
                  final box = context.findRenderObject() as RenderBox?;
                  final size = box?.size;
                  if (size != null && size.width > 0 && size.height > 0) {
                    final x = (toSave.dx / size.width).clamp(0.0, 1.0);
                    final y = (toSave.dy / size.height).clamp(0.0, 1.0);
                    final results = await _arkitController!.performHitTest(
                      x: x,
                      y: y,
                    );
                    if (results.isNotEmpty) {
                      final m = results.first.worldTransform;
                      final t = m.getTranslation();
                      worldPoint = vmath.Vector3(t.x, t.y, t.z);
                    }
                  }
                }

                setState(() {
                  if (_floorPin == null) {
                    _floorPin = toSave;
                    _floorWorld = worldPoint ?? _floorWorld;
                  } else if (_ceilingPin == null) {
                    _ceilingPin = toSave;
                    _ceilingWorld = worldPoint ?? _ceilingWorld;
                  } else {
                    // If both exist, allow adjusting last pin
                    _ceilingPin = toSave;
                    _ceilingWorld = worldPoint ?? _ceilingWorld;
                  }
                  _dragPos = null;

                  if (_floorWorld != null && _ceilingWorld != null) {
                    _distanceMeters = (_floorWorld! - _ceilingWorld!).length;
                  }
                });
              },
              child: CustomPaint(
                painter: _PinPainter(
                  dragPos: _dragPos,
                  floor: _floorPin,
                  ceiling: _ceilingPin,
                ),
              ),
            ),
          ),

          // Back button (top-left)
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 12,
            child: _BackButton(),
          ),

          // Reset pins (top-right)
          if (_floorPin != null || _ceilingPin != null)
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              right: 12,
              child: _ResetButton(
                onReset: () {
                  setState(() {
                    _floorPin = null;
                    _ceilingPin = null;
                    _dragPos = null;
                    _floorWorld = null;
                    _ceilingWorld = null;
                    _distanceMeters = null;
                  });
                },
              ),
            ),

          // Distance label near the midpoint of pins (shown when available)
          if (_floorPin != null &&
              _ceilingPin != null &&
              _distanceMeters != null)
            Positioned(
              left:
                  math.min(_floorPin!.dx, _ceilingPin!.dx) +
                  (math.max(_floorPin!.dx, _ceilingPin!.dx) -
                          math.min(_floorPin!.dx, _ceilingPin!.dx)) /
                      2 -
                  40,
              top:
                  math.min(_floorPin!.dy, _ceilingPin!.dy) +
                  (math.max(_floorPin!.dy, _ceilingPin!.dy) -
                          math.min(_floorPin!.dy, _ceilingPin!.dy)) /
                      2 -
                  12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.6),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  "${_distanceMeters!.toStringAsFixed(2)} m",
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),

          // Gradient info container overlay (bottom center)
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: _OverlayInstruction(
              text: _floorPin == null
                  ? 'Long press to place FLOOR pin'
                  : (_ceilingPin == null
                        ? 'Long press to place CEILING pin'
                        : 'Pins placed. Long press to adjust or Reset'),
            ),
          ),
        ],
      ),
    );
  }

  void _onARKitViewCreated(ARKitController controller) {
    _arkitController = controller;
  }
}

class _BackButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => Get.back(),
      borderRadius: BorderRadius.circular(24),
      child: Ink(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [MyColors.primary, MyColors.primary.withOpacity(0.7)],
          ),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: MyColors.primary.withOpacity(0.35),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: const Icon(Icons.arrow_back, color: Colors.white),
      ),
    );
  }
}

class _OverlayInstruction extends StatelessWidget {
  final String text;
  // ignore: unused_element_parameter
  const _OverlayInstruction({super.key, required this.text});
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [MyColors.primary, MyColors.primary.withOpacity(0.6)],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: MyColors.primary.withOpacity(0.35),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Center(
        child: Text(
          text,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _ResetButton extends StatelessWidget {
  final VoidCallback onReset;
  const _ResetButton({required this.onReset});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onReset,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.4),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.refresh, color: Colors.white, size: 18),
            SizedBox(width: 6),
            Text('Reset', style: TextStyle(color: Colors.white)),
          ],
        ),
      ),
    );
  }
}

class _PinPainter extends CustomPainter {
  final Offset? dragPos;
  final Offset? floor;
  final Offset? ceiling;

  _PinPainter({this.dragPos, this.floor, this.ceiling});

  @override
  void paint(Canvas canvas, Size size) {
    // Draw dashed line between saved pins
    if (floor != null && ceiling != null) {
      final linePaint = Paint()
        ..color = Colors.black
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke;
      _drawDashedLine(canvas, floor!, ceiling!, linePaint);
    }

    final pinPaint = Paint()..color = const Color(0xFFE94D3B); // red pin color

    // Saved pins
    if (floor != null) _drawPin(canvas, floor!, pinPaint);
    if (ceiling != null) _drawPin(canvas, ceiling!, pinPaint);

    // Live pin while long-pressing (only if one of the pins is still missing)
    if (dragPos != null && (floor == null || ceiling == null)) {
      _drawPin(canvas, dragPos!, pinPaint);
    }
  }

  void _drawPin(Canvas canvas, Offset at, Paint paint) {
    canvas.drawCircle(at, 10, paint);
    // Optional: small white stroke for better visibility
    final border = Paint()
      ..color = Colors.white
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(at, 10, border);
  }

  void _drawDashedLine(Canvas canvas, Offset p1, Offset p2, Paint paint) {
    const double dashLength = 8;
    const double dashGap = 6;
    final total = (p2 - p1).distance;
    if (total == 0) return;
    final dir = (p2 - p1) / total; // unit vector
    double covered = 0;
    while (covered < total) {
      final start = p1 + dir * covered;
      final end = p1 + dir * math.min(covered + dashLength, total);
      canvas.drawLine(start, end, paint);
      covered += dashLength + dashGap;
    }
  }

  @override
  bool shouldRepaint(_PinPainter oldDelegate) {
    return oldDelegate.dragPos != dragPos ||
        oldDelegate.floor != floor ||
        oldDelegate.ceiling != ceiling;
  }
}

class _PermissionView extends StatelessWidget {
  final VoidCallback onRequest;
  final Future<void> Function() onSettings;
  const _PermissionView({required this.onRequest, required this.onSettings});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.black),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      MyColors.primary,
                      MyColors.primary.withOpacity(0.7),
                    ],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: MyColors.primary.withOpacity(0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.camera_alt,
                  color: Colors.white,
                  size: 36,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Camera Access Needed',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Allow camera to capture height with live preview.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: GradientElevatedButton(
                      onPressed: onRequest,
                      child: const Text(
                        'Allow Camera',
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.white.withOpacity(0.6)),
                      ),
                      onPressed: onSettings,
                      child: const Text(
                        'Open Settings',
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
