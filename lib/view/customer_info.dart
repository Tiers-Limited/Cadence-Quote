// ignore_for_file: unused_field

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/widgets/custom_app_bar.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/view_model/profile_controller.dart';
import 'package:primechoice/core/services/quote_service.dart';
import 'package:dropdown_textfield/dropdown_textfield.dart';

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
                const SizedBox(height: 16),
                _Section(
                  title: 'Contact Information',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Label('Name'),
                      const SizedBox(height: 8),
                      Obx(
                        () => SizedBox(
                          height: 34,
                          child: TextFormField(
                            enabled: false,
                            readOnly: true,
                            initialValue: profile.fullName.value,
                            style: const TextStyle(color: Colors.grey),
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
                                  filled: true,
                                  fillColor: Colors.grey.withOpacity(0.1),
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
                            () => SizedBox(
                              height: 34,
                              child: TextFormField(
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
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 7,
                                          ),
                                      filled: true,
                                      fillColor: Colors.grey.withOpacity(0.1),
                                    ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          _Label('Phone Number'),
                          const SizedBox(height: 8),
                          Obx(
                            () => SizedBox(
                              height: 34,
                              child: TextFormField(
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
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 7,
                                          ),
                                      filled: true,
                                      fillColor: Colors.grey.withOpacity(0.1),
                                    ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          _Label('Street Address'),
                          const SizedBox(height: 8),
                          Obx(
                            () => SizedBox(
                              height: 34,
                              child: TextFormField(
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
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 7,
                                          ),
                                      filled: true,
                                      fillColor: Colors.grey.withOpacity(0.1),
                                    ),
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
                  title: 'Select the pricing configuration',
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
  List<Map<String, dynamic>> _schemes = const [];
  String? _value;
  bool _loading = false;
  late final SingleValueDropDownController _controller;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 34,
      child: DropDownTextField(
        controller: _controller,
        dropDownItemCount: 6,
        enableSearch: false,
        clearOption: false,
        isEnabled: !_loading,
        dropDownList: _schemes
            .map(
              (e) => DropDownValueModel(
                name: e['name']?.toString() ?? 'Scheme',
                value: e['id'],
              ),
            )
            .toList(),
        onChanged: (val) {
          if (val is DropDownValueModel) {
            setState(() => _value = val.value?.toString());
          }
        },
        textFieldDecoration: MyTextFormFieldTheme.lightInputDecoration()
            .copyWith(
              hintText: 'Select',
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 4,
              ),
              filled: true,
              fillColor: Colors.white,
            ),
        dropDownIconProperty: IconProperty(
          icon: Icons.arrow_drop_down,
          size: 18,
          color: MyColors.primary,
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _controller = SingleValueDropDownController();
    _fetchSchemes();
  }

  Future<void> _fetchSchemes() async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      final body = await QuoteService.instance.getPricingSchemes();
      final data = (body['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (kDebugMode) {
        debugPrint('Loaded pricing schemes: ${jsonEncode(data)}');
      }
      setState(() {
        _schemes = data;
        _value = null;
        _controller.clearDropDown();
      });
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Failed to load pricing schemes: $e');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}
