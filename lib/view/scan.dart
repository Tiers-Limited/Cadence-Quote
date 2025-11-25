import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_theme.dart';
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
  bool _initializing = false;
  bool _paused = false;
  String _ceilingType = 'Flat';

  @override
  void initState() {
    super.initState();
    _ensurePermissionThenInit();
  }

  Future<void> _ensurePermissionThenInit() async {
    await p.refreshCamera();
    if (!p.cameraGranted) return;
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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
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
              if (_cameraController == null ||
                  !_cameraController!.value.isInitialized) {
                return const Center(child: CircularProgressIndicator());
              }
              return ColorFiltered(
                colorFilter: ColorFilter.mode(
                  _paused ? Colors.black.withOpacity(0.3) : Colors.transparent,
                  BlendMode.darken,
                ),
                child: CameraPreview(_cameraController!),
              );
            }),
          ),

          // Top bar
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
                      _BackCircleButton(onTap: () => Get.back()),
                      const SizedBox(width: 12),
                      Expanded(child: _OverlayPill(text: 'Detecting walls...')),
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

          // Left metrics
          Positioned(
            top: 110,
            left: 16,
            child: Padding(
              padding: const EdgeInsets.only(top: 80.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  _MetricPill(title: 'Wall areas', value: '25.4 m²'),
                  SizedBox(height: 8),
                  _MetricPill(title: 'Ceiling area', value: '25.4 m²'),
                  SizedBox(height: 8),
                  _MetricPill(title: 'Room Height', value: '2.54 m'),
                  SizedBox(height: 8),
                  _MetricPill(title: 'Trim length', value: '25.4 m'),
                ],
              ),
            ),
          ),

          // Bottom controls panel
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
                            onPressed: () => Get.back(),
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
                            onPressed: () {},
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
      ),
    );
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
                'Please grant camera permission to start scanning.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ElevatedButton(
                    onPressed: onRequest,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: MyColors.primary,
                    ),
                    child: const Text(
                      'Grant Access',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: onSettings,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                    ),
                    child: const Text(
                      'Open Settings',
                      style: TextStyle(color: Colors.black87),
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
