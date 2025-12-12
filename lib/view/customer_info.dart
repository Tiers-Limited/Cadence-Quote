import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/widgets/custom_app_bar.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/view_model/profile_controller.dart';

class CustomerInfoPage extends StatelessWidget {
  const CustomerInfoPage({super.key});

  @override
  Widget build(BuildContext context) {
    final profile = Get.isRegistered<ProfileController>()
        ? Get.find<ProfileController>()
        : Get.put(ProfileController());

    return Scaffold(
      appBar: const CustomAppBar(title: 'Customer Information'),
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
                        'Step 1: Customer Information',
                        style: TextStyle(
                          color: MyColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        'All information will be saved to the client profile and used in proposals and job orders.',
                        style: TextStyle(color: Colors.black87),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),
                _Section(
                  title: 'Contact Information',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Label('Customer Name'),
                      const SizedBox(height: 8),
                      Obx(
                        () => TextFormField(
                          readOnly: true,
                          initialValue: profile.fullName.value,
                          decoration:
                              MyTextFormFieldTheme.lightInputDecoration(
                                prefixIcon: const Icon(
                                  Icons.person_outline,
                                  color: MyColors.primary,
                                ),
                              ).copyWith(
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 7,
                                ),
                              ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _Label('Email Address'),
                          const SizedBox(height: 8),
                          Obx(
                            () => TextFormField(
                              enabled: false,
                              readOnly: true,
                              initialValue: profile.email.value,
                              style: const TextStyle(color: Colors.grey),
                              decoration:
                                  MyTextFormFieldTheme.lightInputDecoration(
                                    prefixIcon: const Icon(
                                      Icons.email_outlined,
                                      color: MyColors.primary,
                                    ),
                                  ).copyWith(
                                    isDense: true,
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 7,
                                    ),
                                    filled: true,
                                    fillColor: Colors.grey.withOpacity(0.1),
                                  ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          _Label('Phone Number'),
                          const SizedBox(height: 8),
                          Obx(
                            () => TextFormField(
                              enabled: false,
                              readOnly: true,
                              initialValue: profile.phone.value,
                              style: const TextStyle(color: Colors.grey),
                              decoration:
                                  MyTextFormFieldTheme.lightInputDecoration(
                                    prefixIcon: const Icon(
                                      Icons.phone_outlined,
                                      color: MyColors.primary,
                                    ),
                                  ).copyWith(
                                    isDense: true,
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 7,
                                    ),
                                    filled: true,
                                    fillColor: Colors.grey.withOpacity(0.1),
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),
                _Section(
                  title: 'Property Address',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Label('Street Address'),
                      const SizedBox(height: 8),
                      Obx(
                        () => TextFormField(
                          enabled: false,
                          readOnly: true,
                          initialValue: profile.address.value,
                          style: const TextStyle(color: Colors.grey),
                          decoration:
                              MyTextFormFieldTheme.lightInputDecoration(
                                prefixIcon: const Icon(
                                  Icons.location_on_outlined,
                                  color: MyColors.primary,
                                ),
                              ).copyWith(
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 7,
                                ),
                                filled: true,
                                fillColor: Colors.grey.withOpacity(0.1),
                              ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _Label('City'),
                                const SizedBox(height: 8),
                                TextFormField(
                                  decoration:
                                      MyTextFormFieldTheme.lightInputDecoration(
                                        hintText: 'City',
                                      ).copyWith(
                                        isDense: true,
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 7,
                                            ),
                                      ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _Label('State'),
                                const SizedBox(height: 8),
                                TextFormField(
                                  decoration:
                                      MyTextFormFieldTheme.lightInputDecoration(
                                        hintText: 'State',
                                      ).copyWith(
                                        isDense: true,
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 7,
                                            ),
                                      ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _Label('ZIP Code'),
                                const SizedBox(height: 8),
                                TextFormField(
                                  keyboardType: TextInputType.number,
                                  decoration:
                                      MyTextFormFieldTheme.lightInputDecoration(
                                        hintText: 'ZIP',
                                      ).copyWith(
                                        isDense: true,
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 7,
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

                const SizedBox(height: 16),
                _Section(
                  title: 'Pricing Configuration',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Label('Pricing Scheme'),
                      const SizedBox(height: 8),
                      _PricingDropdown(),
                      const SizedBox(height: 6),
                      const Text(
                        'This determines how pricing is calculated for this quote',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),
                Align(
                  alignment: Alignment.centerRight,
                  child: SizedBox(
                    height: 48,
                    width: 160,
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
                        onPressed: () => Get.toNamed(AppRoutes.jobType),
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
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);
  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: MyColors.primary,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

class _PricingDropdown extends StatefulWidget {
  @override
  State<_PricingDropdown> createState() => _PricingDropdownState();
}

class _PricingDropdownState extends State<_PricingDropdown> {
  final items = const ['Turnkey - SQFT TURNKEY', 'Hourly', 'Fixed Bid'];
  String value = 'Turnkey - SQFT TURNKEY';
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 34,
      child: DropdownButtonFormField<String>(
        value: value,
        dropdownColor: Colors.white,
        style: const TextStyle(color: MyColors.primary),
        items: items
            .map(
              (e) => DropdownMenuItem<String>(
                value: e,
                child: Text(e, style: const TextStyle(color: MyColors.primary)),
              ),
            )
            .toList(),
        onChanged: (v) => setState(() => value = v ?? value),
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
    );
  }
}
