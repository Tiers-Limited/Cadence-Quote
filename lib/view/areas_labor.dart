// ignore_for_file: unused_element, unused_element_parameter

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/widgets/custom_app_bar.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/core/routes/app_routes.dart';

class AreasLaborPage extends StatefulWidget {
  const AreasLaborPage({super.key});
  @override
  State<AreasLaborPage> createState() => _AreasLaborPageState();
}

class _AreasLaborPageState extends State<AreasLaborPage> {
  final rooms = [
    'Living Room',
    'Master Bedroom',
    'Bedroom 2',
    'Bedroom 3',
    'Kitchen',
    'Dining Room',
    'Bathroom',
    'Hallway',
    'Office',
    'Laundry Room',
  ];
  final Set<int> selectedRooms = {0};
  late List<_Item> _items;
  static const List<_Item> _interiorItems = [
    _Item('Walls', 'sq ft', 1),
    _Item('Ceilings', 'sq ft', 3),
    _Item('Trim', 'LF', 1),
    _Item('Doors', 'units', 1),
    _Item('Cabinets', 'units', 1),
    _Item('Drywall Repair', 'hrs', 1),
    _Item('Accent Walls', 'sq ft', 2),
  ];
  static const List<_Item> _exteriorItems = [
    _Item('Exterior Walls', 'sq ft', 1),
    _Item('Exterior Trim', 'LF', 1),
    _Item('Exterior Doors', 'units', 1),
    _Item('Shutters', 'units', 1),
    _Item('Decks & Railings', 'sq ft', 1),
    _Item('Soffit & Fascia', 'LF', 1),
    _Item('Prep Work', 'hrs', 1),
  ];
  Map<int, Map<String, bool>> _roomEnabled = {};

  @override
  void initState() {
    super.initState();
    final jobType =
        (Get.arguments?['jobType']?.toString().toLowerCase() ?? 'interior');
    _items = jobType == 'exterior' ? _exteriorItems : _interiorItems;
    if (kDebugMode) {
      debugPrint(
        'Areas & Labor jobType=$jobType, items=${_items.map((e) => e.label).toList()}',
      );
    }
    _roomEnabled = {
      for (var i = 0; i < rooms.length; i++)
        i: {for (final it in _items) it.label: false},
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Areas & Labor'),
      body: Stack(
        children: [
          const CustomBackground(),
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Container(
                //   padding: const EdgeInsets.all(12),
                //   decoration: BoxDecoration(
                //     color: MyColors.primary.withOpacity(0.08),
                //     borderRadius: BorderRadius.circular(12),
                //     border: Border.all(
                //       color: MyColors.primary.withOpacity(0.2),
                //     ),
                //   ),
                //   child: const Column(
                //     crossAxisAlignment: CrossAxisAlignment.start,
                //     children: [
                //       Text(
                //         'Step 3: Areas & Labor',
                //         style: TextStyle(
                //           color: MyColors.black,
                //           fontWeight: FontWeight.w700,
                //         ),
                //       ),
                //       SizedBox(height: 6),
                //       Text(
                //         'Select rooms, specify labor categories, and enter measurements. Gallons calculate automatically.',
                //         style: TextStyle(color: Colors.black87),
                //       ),
                //     ],
                //   ),
                // ),
                const SizedBox(height: 16),
                Text(
                  'Select Areas:',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                _RoomChips(
                  rooms: rooms,
                  selected: selectedRooms,
                  onToggle: (i, v) => setState(() {
                    if (v) {
                      selectedRooms.add(i);
                    } else {
                      selectedRooms.remove(i);
                    }
                  }),
                ),

                const SizedBox(height: 16),
                for (final index in selectedRooms)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _Section(
                      title: rooms[index],
                      child: Theme(
                        data: Theme.of(context).copyWith(
                          checkboxTheme: CheckboxThemeData(
                            fillColor: MaterialStateProperty.resolveWith(
                              (states) =>
                                  states.contains(MaterialState.selected)
                                  ? MyColors.primary
                                  : Colors.white,
                            ),
                            checkColor: MaterialStateProperty.all(Colors.white),
                            side: const BorderSide(color: MyColors.primary),
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (final it in _items)
                              Builder(
                                builder: (context) {
                                  final map = _roomEnabled[index] ??= {
                                    for (final e in _items) e.label: false,
                                  };
                                  final enabled = map[it.label] == true;
                                  return _LaborRow(
                                    label: it.label,
                                    unitTag: it.unitTag,
                                    coats: it.coats,
                                    enabled: enabled,
                                    onToggle: (v) =>
                                        setState(() => map[it.label] = v),
                                  );
                                },
                              ),
                          ],
                        ),
                      ),
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
                          onPressed: () => Get.toNamed(AppRoutes.products),
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

class _RoomChips extends StatelessWidget {
  final List<String> rooms;
  final Set<int> selected;
  final void Function(int, bool) onToggle;
  const _RoomChips({
    required this.rooms,
    required this.selected,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (var i = 0; i < rooms.length; i++)
          ChoiceChip(
            label: Text(
              rooms[i],
              style: TextStyle(
                fontSize: 12,
                color: selected.contains(i) ? Colors.white : MyColors.primary,
              ),
            ),
            selected: selected.contains(i),
            selectedColor: MyColors.primary,
            labelPadding: const EdgeInsets.symmetric(
              horizontal: 8,
              vertical: 2,
            ),
            visualDensity: VisualDensity.compact,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            backgroundColor: Colors.white,
            shape: StadiumBorder(side: BorderSide(color: MyColors.primary)),
            onSelected: (v) => onToggle(i, v),
          ),
      ],
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
              const Icon(Icons.lock_outline, color: Colors.redAccent),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _LaborRow extends StatefulWidget {
  final String label;
  final String unitTag;
  final int coats;
  final String? priceHint;
  final bool enabled;
  final ValueChanged<bool> onToggle;
  const _LaborRow({
    required this.label,
    required this.unitTag,
    this.coats = 1,
    this.priceHint,
    required this.enabled,
    required this.onToggle,
  });

  @override
  State<_LaborRow> createState() => _LaborRowState();
}

class _LaborRowState extends State<_LaborRow> {
  bool manualGallons = false;
  final TextEditingController amount = TextEditingController();
  String coatsValue = '1 Coat';
  String gallonsValue = '';

  @override
  void initState() {
    super.initState();
    coatsValue = '${widget.coats} Coat${widget.coats > 1 ? 's' : ''}';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Checkbox(
            value: widget.enabled,
            onChanged: (v) => widget.onToggle(v ?? false),
          ),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.label,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: MyColors.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: MyColors.primary.withOpacity(0.5),
                          ),
                        ),
                        child: Text(
                          widget.unitTag,
                          style: const TextStyle(color: MyColors.primary),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 90,
                    child: TextFormField(
                      controller: amount,
                      enabled: widget.enabled,
                      decoration:
                          MyTextFormFieldTheme.lightInputDecoration(
                            hintText: widget.unitTag,
                          ).copyWith(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 7,
                            ),
                            filled: true,
                            fillColor: Colors.white,
                          ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 110,
                    height: 34,
                    child: DropdownButtonFormField<String>(
                      value: coatsValue,
                      dropdownColor: Colors.white,
                      style: const TextStyle(color: MyColors.primary),
                      items: ['1 Coat', '2 Coats', '3 Coats']
                          .map(
                            (e) => DropdownMenuItem(value: e, child: Text(e)),
                          )
                          .toList(),
                      onChanged: widget.enabled
                          ? (v) => setState(() => coatsValue = v ?? coatsValue)
                          : null,
                      iconEnabledColor: MyColors.primary,
                      iconSize: 18,
                      decoration: MyTextFormFieldTheme.lightInputDecoration()
                          .copyWith(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            filled: true,
                            fillColor: Colors.white,
                          ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (widget.unitTag == 'sq ft') ...[
                    SizedBox(
                      width: 100,
                      child: TextFormField(
                        enabled: widget.enabled && manualGallons,
                        initialValue: manualGallons ? gallonsValue : '',
                        decoration:
                            MyTextFormFieldTheme.lightInputDecoration(
                              hintText: 'Gallons',
                            ).copyWith(
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 7,
                              ),
                              filled: true,
                              fillColor: Colors.white,
                            ),
                        onChanged: (v) => gallonsValue = v,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text('gal'),
                    const SizedBox(width: 12),
                    Row(
                      children: [
                        Checkbox(
                          value: manualGallons,
                          onChanged: widget.enabled
                              ? (v) => setState(
                                  () => manualGallons = v ?? manualGallons,
                                )
                              : null,
                        ),
                        const Text('Manual Gallons'),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddItems extends StatelessWidget {
  final Map<String, bool> enabled;
  final void Function(String, bool) onToggle;
  const _AddItems({required this.enabled, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final remaining = enabled.entries
        .where((e) => e.value == false)
        .map((e) => e.key)
        .toList();
    if (remaining.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Add more items:'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final key in remaining)
              ActionChip(
                label: Text(key),
                labelStyle: const TextStyle(color: MyColors.primary),
                backgroundColor: Colors.white,
                shape: StadiumBorder(side: BorderSide(color: MyColors.primary)),
                onPressed: () => onToggle(key, true),
              ),
          ],
        ),
      ],
    );
  }
}

class _Item {
  final String label;
  final String unitTag;
  final int coats;
  const _Item(this.label, this.unitTag, this.coats);
}
