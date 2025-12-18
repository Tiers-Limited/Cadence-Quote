import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'dart:convert';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/widgets/custom_app_bar.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/routes/app_routes.dart';

class ProposalsPage extends StatefulWidget {
  const ProposalsPage({super.key});

  @override
  State<ProposalsPage> createState() => _ProposalsPageState();
}

class _ProposalsPageState extends State<ProposalsPage> {
  bool _loading = true;
  List<Map<String, String>> _pdfs = const [];

  @override
  void initState() {
    super.initState();
    _loadPdfs();
  }

  Future<void> _loadPdfs() async {
    try {
      final manifestJson = await rootBundle.loadString('AssetManifest.json');
      final Map<String, dynamic> manifest = json.decode(manifestJson);
      final paths =
          manifest.keys
              .where(
                (k) =>
                    k.startsWith('assets/pdfs/') &&
                    k.toLowerCase().endsWith('.pdf'),
              )
              .toList()
            ..sort();
      setState(() {
        _pdfs = paths
            .map((p) => {'path': p, 'name': p.split('/').last})
            .toList();
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      Get.snackbar('Error', 'Failed to load PDFs from assets');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'My Proposals'),
      body: Stack(
        children: [
          const CustomBackground(),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_pdfs.isEmpty)
            const Center(
              child: Text(
                'No PDFs found',
                style: TextStyle(color: Colors.grey, fontSize: 16),
              ),
            )
          else
            ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _pdfs.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final item = _pdfs[index];
                return _PdfTile(item: item);
              },
            ),
        ],
      ),
    );
  }
}

class _PdfTile extends StatelessWidget {
  final Map<String, String> item;
  const _PdfTile({required this.item});

  @override
  Widget build(BuildContext context) {
    final name = item['name'] ?? '';
    final path = item['path'] ?? '';

    return InkWell(
      onTap: () {
        Get.toNamed(
          AppRoutes.proposalDetail,
          arguments: {'assetPath': path, 'title': name},
        );
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.withOpacity(0.3)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: MyColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.description_outlined,
                color: MyColors.primary,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
