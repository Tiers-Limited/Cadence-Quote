import 'package:camera/camera.dart';
import 'dart:io' show Platform;
import 'package:arkit_plugin/arkit_plugin.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_theme.dart';
import 'package:primechoice/core/widgets/get_permission.dart';
import 'package:primechoice/view_model/permissions_controller.dart';
import 'package:primechoice/core/routes/app_routes.dart';

class ScanPage extends StatefulWidget {
  const ScanPage({super.key});

  @override
  State<ScanPage> createState() => _ScanPageState();
}

class _ScanPageState extends State<ScanPage> {
  final PermissionsController p = Get.put(PermissionsController());
  CameraController? _cameraController;
  ARKitController? _arkitController;
  bool _initializing = false;
  bool _paused = false;
  String _ceilingType = 'Flat';
  bool _scanCompleted = false;
  bool _isScanning = false;

  final List<ARKitPlaneAnchor> _planes = [];

  double? _wallAreaM2;
  double? _ceilingAreaM2;
  double? _roomHeightM;
  double? _trimLengthM;

  @override
  void initState() {
    super.initState();
    _ensurePermissionThenInit();
  }

  Future<void> _ensurePermissionThenInit() async {
    await p.refreshCamera();
    if (!p.cameraGranted) return;
    if (Platform.isIOS) {
      setState(() => _isScanning = true);
      return;
    }
    await _initCamera();
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
      body: Obx(() {
        if (!p.cameraGranted) {
          return GetPermission(
            onRequest: () async {
              await p.requestCamera();
              await _ensurePermissionThenInit();
            },
          );
        }

        if (_cameraController == null ||
            !_cameraController!.value.isInitialized) {
          return const Center(child: CircularProgressIndicator());
        }

        return Stack(
          children: [
            Positioned.fill(
              child: Platform.isIOS
                  ? ARKitSceneView(
                      enableTapRecognizer: false,
                      onARKitViewCreated: _onARKitViewCreated,
                    )
                  : ColorFiltered(
                      colorFilter: ColorFilter.mode(
                        _paused
                            ? Colors.black.withOpacity(0.3)
                            : Colors.transparent,
                        BlendMode.darken,
                      ),
                      child: CameraPreview(_cameraController!),
                    ),
            ),

            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: Padding(
                padding: const EdgeInsets.only(top: 30),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Row(
                      children: [
                        _BackCircleButton(onTap: _handleBack),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _OverlayPill(text: 'Detecting walls...'),
                        ),
                        if (Platform.isIOS && _isScanning && !_scanCompleted)
                          SizedBox(
                            width: 120,
                            height: 90,
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.85),
                                borderRadius: BorderRadius.circular(12),
                                boxShadow: [
                                  BoxShadow(
                                    color: MyColors.primary.withOpacity(0.2),
                                    blurRadius: 12,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: CustomPaint(
                                painter: _BlueprintPainter(planes: _planes),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 50.0, right: 50.0),
                        child: Text(
                          "Point your device at the wall and slowly move around",
                          style: MyTextTheme.lightTextTheme.headlineMedium,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            Positioned(
              top: 110,
              left: 16,
              child: Padding(
                padding: const EdgeInsets.only(top: 80.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_scanCompleted) ...[
                      _MetricPill(
                        title: 'Wall areas',
                        value: _fmtM2(_wallAreaM2),
                      ),
                      const SizedBox(height: 8),
                      _MetricPill(
                        title: 'Ceiling area',
                        value: _fmtM2(_ceilingAreaM2),
                      ),
                      const SizedBox(height: 8),
                      _MetricPill(
                        title: 'Room Height',
                        value: _fmtM(_roomHeightM),
                      ),
                      const SizedBox(height: 8),
                      _MetricPill(
                        title: 'Trim length',
                        value: _fmtM(_trimLengthM),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(20),
                    topRight: Radius.circular(20),
                  ),
                ),
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: SizedBox(
                            height: 50,
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.red,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              onPressed: _handleBack,
                              child: const Text(
                                'Cancel',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        _PauseButton(
                          paused: _paused,
                          onToggle: () => setState(() => _paused = !_paused),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: SizedBox(
                            height: 50,
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: MyColors.primary,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              onPressed: _finishScan,
                              child: const Text(
                                'Finish Scan',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Ceiling Type',
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                              const SizedBox(height: 8),
                              _CeilingSegmented(
                                selected: _ceilingType,
                                onChanged: (v) =>
                                    setState(() => _ceilingType = v),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                'Manual Height Capture',
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                              const SizedBox(height: 6),
                              Align(
                                alignment: Alignment.centerRight,
                                child: GestureDetector(
                                  onTap: () =>
                                      Get.toNamed(AppRoutes.heightCapture),
                                  child: Container(
                                    width: 52,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      color: MyColors.primary,
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: const Icon(
                                      Icons.toggle_on,
                                      color: Colors.white,
                                      size: 28,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      }),
    );
  }

  void _onARKitViewCreated(ARKitController controller) {
    _arkitController = controller;
    _isScanning = true;
    controller.onAddNodeForAnchor = (anchor) {
      if (anchor is ARKitPlaneAnchor) {
        _planes.add(anchor);
        setState(() {});
      }
    };
    controller.onUpdateNodeForAnchor = (anchor) {
      if (anchor is ARKitPlaneAnchor) {
        final idx = _planes.indexWhere(
          (a) => a.identifier == anchor.identifier,
        );
        if (idx >= 0) {
          _planes[idx] = anchor;
        } else {
          _planes.add(anchor);
        }
        setState(() {});
      }
    };
  }

  void _finishScan() {
    double ceilingArea = 0.0;
    double sumArea = 0.0;
    ARKitPlaneAnchor? largest;
    for (final a in _planes) {
      final e = a.extent;
      final area = (e.x.abs()) * (e.z.abs());
      sumArea += area;
      if (area > ceilingArea) {
        ceilingArea = area;
        largest = a;
      }
    }
    final wallArea = (sumArea - ceilingArea).clamp(0.0, double.infinity);
    double roomHeight = _estimateHeight();
    double trimLen = _estimateTrimLength(largest);

    setState(() {
      _wallAreaM2 = wallArea > 0 ? wallArea : null;
      _ceilingAreaM2 = ceilingArea > 0 ? ceilingArea : null;
      _roomHeightM = roomHeight > 0 ? roomHeight : null;
      _trimLengthM = trimLen > 0 ? trimLen : null;
      _scanCompleted = true;
      _isScanning = false;
    });

    _arkitController?.dispose();
    _stopCamera();
    Get.offNamed(AppRoutes.customerInfo);
  }

  void _stopCamera() {
    try {
      _cameraController?.dispose();
    } catch (_) {}
    _cameraController = null;
  }

  void _handleBack() {
    _stopCamera();
    Get.back();
  }

  double _estimateHeight() {
    if (_planes.isNotEmpty) {
      final avgX =
          _planes.map((a) => a.extent.x.abs()).reduce((a, b) => a + b) /
          _planes.length;
      return avgX;
    }
    return 2.5;
  }

  double _estimateTrimLength(ARKitPlaneAnchor? largest) {
    if (largest != null) {
      return 2 * (largest.extent.x.abs() + largest.extent.z.abs());
    }
    return 0.0;
  }

  String _fmtM2(double? m2) {
    if (m2 == null) return '—';
    return '${m2.toStringAsFixed(2)} m²';
  }

  String _fmtM(double? m) {
    if (m == null) return '—';
    return '${m.toStringAsFixed(2)} m';
  }
}

class _BlueprintPainter extends CustomPainter {
  final List<ARKitPlaneAnchor> planes;
  _BlueprintPainter({required this.planes});
  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()..color = Colors.transparent;
    canvas.drawRect(Offset.zero & size, bg);
    final p = Paint()
      ..color = MyColors.primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    for (final a in planes) {
      final w = a.extent.x.abs();
      final h = a.extent.z.abs();
      final rw = w.clamp(0.5, 10.0) / 10.0 * size.width;
      final rh = h.clamp(0.5, 10.0) / 10.0 * size.height;
      final rect = Rect.fromLTWH(4, 4, rw - 8, rh - 8);
      canvas.drawRect(rect, p);
    }
  }

  @override
  bool shouldRepaint(covariant _BlueprintPainter oldDelegate) {
    return oldDelegate.planes != planes;
  }
}

class _BackCircleButton extends StatelessWidget {
  final VoidCallback onTap;
  const _BackCircleButton({required this.onTap});
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
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
        child: const Icon(Icons.arrow_back, color: Colors.black),
      ),
    );
  }
}

class _OverlayPill extends StatelessWidget {
  final String text;
  const _OverlayPill({required this.text});
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.only(right: 20.0),
          child: Text(
            text,
            style: const TextStyle(
              color: MyColors.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  final String title;
  final String value;
  const _MetricPill({required this.title, required this.value});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 140,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),

      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            MyColors.primary.withOpacity(0.4),
            MyColors.primary.withOpacity(0.2),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: MyColors.primary.withOpacity(0.15),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.black87,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: Colors.black54,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _PauseButton extends StatelessWidget {
  final bool paused;
  final VoidCallback onToggle;
  const _PauseButton({required this.paused, required this.onToggle});
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onToggle,
      borderRadius: BorderRadius.circular(40),
      child: Ink(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: MyColors.primary.withOpacity(0.25),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Center(
          child: Icon(
            paused ? Icons.play_arrow : Icons.pause,
            color: Colors.black87,
          ),
        ),
      ),
    );
  }
}

class _CeilingSegmented extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;
  const _CeilingSegmented({required this.selected, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    Widget tab(String label) {
      final active = label == selected;
      return Expanded(
        child: GestureDetector(
          onTap: () => onChanged(label),
          child: Container(
            height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: active
                  ? const LinearGradient(
                      colors: [MyColors.primary, MyColors.secondary],
                    )
                  : null,
              color: active ? null : Colors.black.withOpacity(0.08),
            ),
            child: Center(
              child: Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.1),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          tab('Flat'),
          const SizedBox(width: 8),
          tab('Tray'),
          const SizedBox(width: 8),
          tab('Vaulted'),
        ],
      ),
    );
  }
}
