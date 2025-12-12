import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/widgets/custom_app_bar.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/utils/theme/widget_themes/button_theme.dart';
import 'package:primechoice/core/routes/app_routes.dart';
import 'package:primechoice/core/widgets/job_type_card.dart';

class JobTypePage extends StatefulWidget {
  const JobTypePage({super.key});

  @override
  State<JobTypePage> createState() => _JobTypePageState();
}

class _JobTypePageState extends State<JobTypePage> {
  String _selected = 'interior';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Job Type'),
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
                //         'Step 2: Job Type',
                //         style: TextStyle(
                //           color: MyColors.primary,
                //           fontWeight: FontWeight.w700,
                //         ),
                //       ),
                //       SizedBox(height: 6),
                //       Text(
                //         'Select the primary category of work. This determines which areas, materials, and processes are available.',
                //         style: TextStyle(color: Colors.black87),
                //       ),
                //     ],
                //   ),
                // ),
                const SizedBox(height: 16),
                Text(
                  'What type of painting project is this?',
                  textAlign: TextAlign.left,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 16),
                Column(
                  children: [
                    JobTypeCard(
                      title: 'Interior Painting',
                      subtitle: 'Walls, Ceilings, Trim, Doors, Cabinets',
                      icon: Icons.maps_home_work_rounded,
                      includes: const [
                        'Wall preparation & painting',
                        'Ceiling work',
                        'Trim & door painting',
                        'Cabinet refinishing',
                        'Drywall repairs',
                      ],
                      selected: _selected == 'interior',
                      onTap: () => setState(() => _selected = 'interior'),
                    ),
                    const SizedBox(height: 12),
                    JobTypeCard(
                      title: 'Exterior Painting',
                      subtitle: 'Siding, Trim, Windows, Doors, Decks',
                      icon: Icons.extension_sharp,
                      includes: const [
                        'Siding preparation & coating',
                        'Pressure washing / softwash',
                        'Exterior trim system',
                        'Window & door painting',
                        'Deck & fence staining',
                      ],
                      selected: _selected == 'exterior',
                      onTap: () => setState(() => _selected = 'exterior'),
                    ),
                  ],
                ),

                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 48,
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            backgroundColor: MyColors.primary.withOpacity(0.08),
                            side: BorderSide(
                              color: MyColors.primary.withOpacity(0.3),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: () => Get.back(),
                          child: const Text(
                            'Previous',
                            style: TextStyle(
                              color: MyColors.black,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 48,
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
                            onPressed: () {
                              Get.toNamed(
                                AppRoutes.areasLabor,
                                arguments: {'jobType': _selected},
                              );
                            },
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
              ],
            ),
          ),
        ],
      ),
    );
  }
}
