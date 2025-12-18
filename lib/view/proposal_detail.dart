import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import 'package:primechoice/core/services/quote_service.dart';
import 'package:primechoice/core/widgets/custom_app_bar.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';

class ProposalDetailPage extends StatefulWidget {
  const ProposalDetailPage({super.key});

  @override
  State<ProposalDetailPage> createState() => _ProposalDetailPageState();
}

class _ProposalDetailPageState extends State<ProposalDetailPage> {
  int? _id;
  bool _loading = true;
  Map<String, dynamic> _quote = {};
  final GlobalKey<SfPdfViewerState> _pdfViewerKey = GlobalKey();
  String? _assetPath;
  String? _title;

  @override
  void initState() {
    super.initState();
    _id = Get.arguments?['id'];
    _assetPath = Get.arguments?['assetPath'];
    _title = Get.arguments?['title'];
    if (_assetPath != null) {
      _loading = false;
      setState(() {});
    } else if (_id != null) {
      _fetchQuote();
    } else {
      Get.back();
    }
  }

  Future<void> _fetchQuote() async {
    try {
      final res = await QuoteService.instance.getQuote(_id!);
      setState(() {
        _quote = res['data'] ?? {};
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        Get.snackbar('Error', 'Failed to load proposal details');
      }
    }
  }

  Future<void> _updateStatus(bool accepted) async {
    try {
      if (accepted) {
        await QuoteService.instance.acceptQuote(_id!);
        Get.snackbar(
          'Success',
          'Proposal accepted successfully',
          backgroundColor: Colors.green.shade50,
        );
      } else {
        await QuoteService.instance.rejectQuote(_id!);
        Get.snackbar(
          'Success',
          'Proposal rejected',
          backgroundColor: Colors.red.shade50,
        );
      }
      _fetchQuote(); // Refresh status
    } catch (e) {
      Get.snackbar('Error', 'Failed to update status: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final pdfUrl =
        _quote['pdfUrl']?.toString() ?? _quote['pdf_url']?.toString();

    return Scaffold(
      backgroundColor: MyColors.grey,
      appBar: CustomAppBar(title: _title ?? 'Proposal #${_id ?? ''}'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: _assetPath != null
                      ? SfPdfViewer.asset(_assetPath!, key: _pdfViewerKey)
                      : (pdfUrl != null && pdfUrl.isNotEmpty
                            ? SfPdfViewer.network(pdfUrl, key: _pdfViewerKey)
                            : const Center(
                                child: Text('No PDF document available'),
                              )),
                ),
                if (_assetPath == null)
                  _buildBottomBar()
                else
                  _buildAssetBottomBar(),
              ],
            ),
    );
  }

  Widget _buildAssetBottomBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: GradientElevatedButton(
              onPressed: () => Get.back(),
              radius: 12,
              elevation: 0,
              gradient: const LinearGradient(colors: [Colors.red, Colors.red]),
              child: const Text(
                'Reject',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: GradientElevatedButton(
              onPressed: () => Get.back(),
              radius: 12,
              elevation: 0,
              gradient: const LinearGradient(
                colors: [Colors.green, Colors.green],
              ),
              child: const Text(
                'Accept',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    final status = _quote['status']?.toString().toUpperCase();
    if (status == 'ACCEPTED' || status == 'REJECTED') {
      return Container(
        padding: const EdgeInsets.all(16),
        color: Colors.white,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              status == 'ACCEPTED' ? Icons.check_circle : Icons.cancel,
              color: status == 'ACCEPTED' ? Colors.green : Colors.red,
            ),
            const SizedBox(width: 8),
            Text(
              'This proposal has been $status',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: GradientElevatedButton(
              onPressed: () => _updateStatus(false),
              elevation: 0,
              child: const Text('Reject'),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: GradientElevatedButton(
              onPressed: () => _updateStatus(true),
              elevation: 0,
              child: const Text(
                'Accept',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
