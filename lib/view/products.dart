import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/widgets/custom_app_bar.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/core/routes/app_routes.dart';

class ProductsPage extends StatefulWidget {
  const ProductsPage({super.key});
  @override
  State<ProductsPage> createState() => _ProductsPageState();
}

class _ProductsPageState extends State<ProductsPage> {
  String strategy = 'gbb';
  bool allowPerArea = false;
  final List<String> surfaces = const ['Walls', 'Ceilings', 'Trim'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Products'),
      body: Stack(
        children: [
          const CustomBackground(),
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: MyColors.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: MyColors.primary.withOpacity(0.2),
                    ),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Step 4: Product Selection',
                        style: TextStyle(
                          color: MyColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Choose products for each surface type. Offer Good-Better-Best options or a single product recommendation.',
                        style: TextStyle(color: Colors.black87),
                      ),
                    ],
                  ),
                ),

                SizedBox(height: 16),
                _Section(
                  title: 'Product Strategy',
                  child: ListTileTheme(
                    dense: true,
                    minVerticalPadding: 0,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        RadioListTile<String>(
                          value: 'gbb',
                          groupValue: strategy,
                          onChanged: (v) =>
                              setState(() => strategy = v ?? strategy),
                          title: const Text(
                            'Good-Better-Best',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          subtitle: const Text(
                            'Offer 3 tiers for customer to choose from',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.black54,
                            ),
                          ),
                          activeColor: MyColors.primary,
                        ),
                        RadioListTile<String>(
                          value: 'single',
                          groupValue: strategy,
                          onChanged: (v) =>
                              setState(() => strategy = v ?? strategy),
                          title: const Text(
                            'Single Product',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          subtitle: const Text(
                            'Recommend one product per surface',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.black54,
                            ),
                          ),
                          activeColor: MyColors.primary,
                        ),
                        // CheckboxListTile(
                        //   value: allowPerArea,
                        //   onChanged: (v) =>
                        //       setState(() => allowPerArea = v ?? allowPerArea),
                        //   title: const Text(
                        //     'Allow customer to choose different products per area',
                        //     style: TextStyle(
                        //       fontSize: 13,
                        //       fontWeight: FontWeight.bold,
                        //     ),
                        //   ),
                        //   subtitle: const Text(
                        //     'Default: same product for all areas',
                        //     style: TextStyle(
                        //       fontSize: 11,
                        //       color: Colors.black54,
                        //     ),
                        //   ),
                        //   activeColor: MyColors.primary,
                        //   checkboxShape: RoundedRectangleBorder(
                        //     borderRadius: BorderRadius.circular(6),
                        //   ),
                        //   visualDensity: VisualDensity.compact,
                        // ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),
                _Section(
                  title: 'Select Products by Surface Type',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final s in surfaces) ...[
                        Text(s, style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 8),
                        LayoutBuilder(
                          builder: (context, constraints) {
                            return SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: const [
                                  _TierCard(
                                    label: 'GOOD',
                                    price: '\$15/gal',
                                    bg: Color(0xFFE8F1FA),
                                  ),
                                  SizedBox(width: 12),
                                  _TierCard(
                                    label: 'BETTER',
                                    price: '\$20/gal',
                                    bg: Color(0xFFE6F8F4),
                                  ),
                                  SizedBox(width: 12),
                                  _TierCard(
                                    label: 'BEST',
                                    price: '\$25/gal',
                                    bg: Color(0xFFEEF9E6),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 16),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Get.back(),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: Colors.grey.withOpacity(0.08),
                          side: BorderSide(color: Colors.grey.withOpacity(0.3)),
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
                    const SizedBox(width: 12),
                    Expanded(
                      child: DecoratedBox(
                        decoration: MyButtonTheme.primaryGradient(radius: 12),
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            elevation: 8,
                            backgroundColor: Colors.transparent,
                            foregroundColor: Colors.white,
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
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final Widget child;
  const _Section({required this.title, required this.child});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.withOpacity(0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              const Icon(Icons.inventory_2_outlined, color: MyColors.primary),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _TierCard extends StatefulWidget {
  final String label;
  final String price;
  final Color bg;
  const _TierCard({required this.label, required this.price, required this.bg});
  @override
  State<_TierCard> createState() => _TierCardState();
}

class _TierCardState extends State<_TierCard> {
  final finishes = const ['Semi-Gloss', 'Gloss', 'Matte'];
  String finish = 'Semi-Gloss';
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 200,
      padding: const EdgeInsets.symmetric(horizontal: 10.0),
      decoration: BoxDecoration(
        color: widget.bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.withOpacity(0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: MyColors.primary.withOpacity(0.4)),
                ),
                child: Text(
                  widget.label,
                  style: const TextStyle(
                    color: MyColors.primary,
                    fontWeight: FontWeight.w600,
                    fontSize: 11,
                  ),
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: () {},
                style: TextButton.styleFrom(foregroundColor: MyColors.primary),
                child: const Text(
                  'Apply to All',
                  style: TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
          // const SizedBox(height: 6),
          const Text(
            'Benjamin Moore - Sample Product',
            style: TextStyle(
              color: MyColors.primary,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: finish,
            items: finishes
                .map((e) => DropdownMenuItem<String>(value: e, child: Text(e)))
                .toList(),
            onChanged: (v) => setState(() => finish = v ?? finish),
            dropdownColor: Colors.white,
            style: const TextStyle(color: MyColors.primary, fontSize: 12),
            iconEnabledColor: MyColors.primary,
            iconSize: 18,
            decoration: MyTextFormFieldTheme.lightInputDecoration().copyWith(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 4,
              ),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            widget.price,
            style: const TextStyle(color: Colors.black, fontSize: 12),
          ),
          const SizedBox(height: 4),
          const Text(
            'Various Specialty Finishes',
            style: TextStyle(color: Colors.black54, fontSize: 11),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
