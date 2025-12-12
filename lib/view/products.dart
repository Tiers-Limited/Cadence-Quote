import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/widgets/custom_app_bar.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/core/services/quote_service.dart';
import 'package:dropdown_textfield/dropdown_textfield.dart';

class ProductsPage extends StatefulWidget {
  const ProductsPage({super.key});

  @override
  State<ProductsPage> createState() => _ProductsPageState();
}

class _ProductsPageState extends State<ProductsPage>
    with SingleTickerProviderStateMixin {
  String strategy = 'gbb'; // 'gbb' or 'single'
  final List<String> surfaces = const ['Walls', 'Ceilings', 'Trim'];

  // Brand & Color data
  List<Map<String, dynamic>> brands = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> colors = <Map<String, dynamic>>[];
  int? selectedBrandId;

  bool loadingBrands = false;
  bool loadingColors = false;

  late final SingleValueDropDownController brandController;
  late final AnimationController _shimmerCtrl;
  late final Animation<double> _shimmerAnim;

  @override
  void initState() {
    super.initState();
    brandController = SingleValueDropDownController();

    _shimmerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();

    _shimmerAnim = Tween<double>(
      begin: -1.0,
      end: 2.0,
    ).animate(CurvedAnimation(parent: _shimmerCtrl, curve: Curves.easeInOut));

    _fetchBrands();
  }

  Future<void> _fetchBrands() async {
    if (loadingBrands) return;
    setState(() => loadingBrands = true);

    try {
      final body = await QuoteService.instance.getBrands();
      final List data = (body['data'] as List?) ?? [];

      if (mounted) {
        setState(() {
          brands = data.cast<Map<String, dynamic>>();
          selectedBrandId = null;
          brandController.clearDropDown();
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Failed to load brands: $e');
      Get.snackbar('Error', 'Could not load brands');
    } finally {
      if (mounted) setState(() => loadingBrands = false);
    }
  }

  Future<void> _fetchColors(int brandId) async {
    setState(() {
      loadingColors = true;
      colors.clear();
    });

    try {
      final body = await QuoteService.instance.getColorsByBrand(
        brandId,
        limit: 50,
      );
      final List list =
          (body['data'] as Map<String, dynamic>?)?['colors'] ?? [];

      if (mounted) {
        setState(() {
          colors = list.cast<Map<String, dynamic>>();
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Failed to load colors: $e');
      Get.snackbar('Error', 'Could not load colors');
    } finally {
      if (mounted) setState(() => loadingColors = false);
    }
  }

  Widget _shimmerPlaceholder({double? width, double height = 16}) {
    return AnimatedBuilder(
      animation: _shimmerAnim,
      builder: (context, _) {
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            gradient: LinearGradient(
              begin: Alignment(_shimmerAnim.value, 0),
              end: const Alignment(1, 0),
              colors: [
                Colors.grey.shade200,
                Colors.grey.shade300,
                Colors.grey.shade200,
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Products'),
      body: Stack(
        children: [
          const CustomBackground(),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Product Strategy ─────────────────────────────────────
                  _Section(
                    title: 'Product Strategy',
                    child: Column(
                      children: [
                        RadioListTile<String>(
                          value: 'gbb',
                          groupValue: strategy,
                          activeColor: MyColors.primary,
                          title: const Text(
                            'Good – Better – Best',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: const Text('Offer 3 tiers per surface'),
                          onChanged: (v) => setState(() => strategy = v!),
                        ),
                        RadioListTile<String>(
                          value: 'single',
                          groupValue: strategy,
                          activeColor: MyColors.primary,
                          title: const Text(
                            'Single Product',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: const Text(
                            'One recommendation per surface',
                          ),
                          onChanged: (v) => setState(() => strategy = v!),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // ── Products by Surface ───────────────────────────────────
                  _Section(
                    title: 'Select Products by Surface Type',
                    child: Column(
                      children: surfaces.map((surface) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                surface,
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              const SizedBox(height: 12),
                              SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Row(
                                  children: [
                                    _TierCard(
                                      tier: 'GOOD',
                                      price: '\$15/gal',
                                      color: const Color(0xFFE8F1FA),
                                    ),
                                    const SizedBox(width: 12),
                                    _TierCard(
                                      tier: 'BETTER',
                                      price: '\$22/gal',
                                      color: const Color(0xFFE6F8E6),
                                    ),
                                    const SizedBox(width: 12),
                                    _TierCard(
                                      tier: 'BEST',
                                      price: '\$28/gal',
                                      color: const Color(0xFFFFF3E0),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // ── Brand & Colors ───────────────────────────────────────
                  _Section(
                    title: 'Brand & Colors',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        DropDownTextField(
                          key: const ValueKey('brand_dropdown'),
                          controller: brandController,
                          enableSearch: true,
                          searchDecoration: const InputDecoration(
                            hintText: 'Search brand...',
                          ),
                          dropDownItemCount: 8,
                          isEnabled: !loadingBrands,
                          clearOption: true,
                          textFieldDecoration:
                              MyTextFormFieldTheme.lightInputDecoration()
                                  .copyWith(
                                    hintText: loadingBrands
                                        ? 'Loading...'
                                        : 'Select Brand',
                                    filled: true,
                                    fillColor: Colors.white,
                                    isDense: true,
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 10,
                                    ),
                                  ),
                          dropDownList: brands
                              .map(
                                (e) => DropDownValueModel(
                                  name: e['name']?.toString() ?? 'Unknown',
                                  value: e['id'],
                                ),
                              )
                              .toList(),
                          onChanged: (val) {
                            if (val is DropDownValueModel &&
                                val.value != null) {
                              final id = val.value is int
                                  ? val.value as int
                                  : int.tryParse(val.value.toString());
                              setState(() => selectedBrandId = id);
                              if (id != null) _fetchColors(id);
                            }
                          },
                        ),

                        if (selectedBrandId != null) ...[
                          const SizedBox(height: 16),
                          SizedBox(
                            height: 110,
                            child: loadingColors
                                ? ListView.separated(
                                    scrollDirection: Axis.horizontal,
                                    itemCount: 8,
                                    separatorBuilder: (context, _) =>
                                        const SizedBox(width: 10),
                                    itemBuilder: (context, _) {
                                      return Container(
                                        width: 160,
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                          border: Border.all(
                                            color: Colors.grey.shade300,
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            ClipRRect(
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                              child: _shimmerPlaceholder(
                                                width: 44,
                                                height: 44,
                                              ),
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  _shimmerPlaceholder(
                                                    width: 100,
                                                    height: 14,
                                                  ),
                                                  const SizedBox(height: 8),
                                                  _shimmerPlaceholder(
                                                    width: 70,
                                                    height: 12,
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    },
                                  )
                                : colors.isEmpty
                                ? const Center(child: Text('No colors found'))
                                : ListView.separated(
                                    scrollDirection: Axis.horizontal,
                                    itemCount: colors.length,
                                    separatorBuilder: (context, _) =>
                                        const SizedBox(width: 10),
                                    itemBuilder: (context, i) {
                                      final c = colors[i];
                                      return _ColorCard(colorData: c);
                                    },
                                  ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 32),

                  // ── Navigation Buttons ───────────────────────────────────
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Get.back(),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: Colors.grey.withOpacity(0.08),
                            side: BorderSide(
                              color: Colors.grey.withOpacity(0.3),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Previous',
                            style: TextStyle(
                              color: Colors.black,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: DecoratedBox(
                          decoration: MyButtonTheme.primaryGradient(radius: 12),
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            onPressed: () => Get.toNamed(AppRoutes.export),
                            child: const Text(
                              'Next',
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

                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _shimmerCtrl.dispose();
    brandController.dispose();
    super.dispose();
  }
}

// ── Reusable Section ─────────────────────────────────────────────────────
class _Section extends StatelessWidget {
  final String title;
  final Widget child;

  const _Section({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              Icon(Icons.inventory_2_outlined, color: MyColors.primary),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

// ── Tier Card (Good / Better / Best) ─────────────────────────────────────
class _TierCard extends StatefulWidget {
  final String tier;
  final String price;
  final Color color;

  const _TierCard({
    required this.tier,
    required this.price,
    required this.color,
  });

  @override
  State<_TierCard> createState() => _TierCardState();
}

class _TierCardState extends State<_TierCard> {
  final List<String> finishes = [
    'Flat',
    'Eggshell',
    'Satin',
    'Semi-Gloss',
    'Gloss',
  ];
  String selectedFinish = 'Satin';

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: widget.color,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: MyColors.primary),
                ),
                child: Text(
                  widget.tier,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: MyColors.primary,
                    fontSize: 12,
                  ),
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: () {},
                child: const Text(
                  'Apply to All',
                  style: TextStyle(fontSize: 11),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Benjamin Moore – Regal Select',
            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: selectedFinish,
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 10,
                vertical: 8,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide.none,
              ),
            ),
            items: finishes
                .map((f) => DropdownMenuItem(value: f, child: Text(f)))
                .toList(),
            onChanged: (v) => setState(() => selectedFinish = v!),
          ),
          const SizedBox(height: 8),
          Text(
            widget.price,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          const Text(
            'Various specialty finishes available',
            style: TextStyle(fontSize: 11, color: Colors.black54),
          ),
        ],
      ),
    );
  }
}

// ── Color Card ─────────────────────────────────────────────────────────────
class _ColorCard extends StatelessWidget {
  final Map<String, dynamic> colorData;

  const _ColorCard({required this.colorData});

  @override
  Widget build(BuildContext context) {
    final String name = colorData['name'] ?? 'Unknown';
    final String code = colorData['code'] ?? '';
    final Color swatch = _parseHex(colorData['hexValue']?.toString());

    return Container(
      width: 160,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: swatch,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade400),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                if (code.isNotEmpty)
                  Text(
                    code,
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Helper used in _ColorCard
Color _parseHex(String? hex) {
  if (hex == null || hex.isEmpty) return Colors.grey.shade400;
  final clean = hex.replaceAll('#', '');
  final val = int.tryParse(clean, radix: 16);
  return val != null ? Color(0xFF000000 | val) : Colors.grey.shade400;
}
