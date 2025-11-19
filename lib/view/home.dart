import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import 'package:get/get.dart';
import 'package:primechoice/core/utils/constants/colors.dart';
import 'package:primechoice/core/utils/constants/image_strings.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_field_theme.dart';
import 'package:primechoice/core/utils/theme/widget_themes/text_theme.dart';
import 'package:primechoice/core/widgets/custom_background.dart';
import 'package:primechoice/core/widgets/custom_bottom_nav_bar.dart';
import 'package:primechoice/core/routes/app_routes.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const CustomBackground(),
          SafeArea(
            child: _index == 0
                ? _HomeTab()
                : _ProfileTab(onBack: () => setState(() => _index = 0)),
          ),
        ],
      ),
      bottomNavigationBar: CustomBottomNavBar(
        currentIndex: _index,
        onTap: (i) {
          if (i == 1) {
            Get.toNamed(AppRoutes.profile);
          } else {
            setState(() => _index = i);
          }
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Iconsax.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Iconsax.user), label: 'Profile'),
        ],
      ),
    );
  }
}

class _HomeTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset(
                MyImages.homeImage,
                width: width * 0.35,
                fit: BoxFit.cover,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Hi, Alex',
                style: MyTextTheme.lightTextTheme.headlineMedium,
              ),
              const Icon(Icons.cloud_sync_rounded, color: Colors.grey),
            ],
          ),
          const SizedBox(height: 12),
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () {
                Get.toNamed(AppRoutes.heightCapture);
              },
              child: Ink(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [MyColors.primary, MyColors.secondary],
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const SizedBox(
                  height: 48,
                  child: Center(
                    child: Text(
                      'Start New Scan',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Center(
            child: Text(
              'Scan rooms to create a project plan.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            decoration: MyTextFormFieldTheme.lightInputDecoration(
              hintText: 'Search projects...',
              prefixIcon: const Icon(
                Iconsax.search_normal_1,
                color: MyColors.primary,
              ),
            ),
          ),
          const SizedBox(height: 16),
          _ProjectCard(
            title: 'Living Room',
            date: 'Oct 12, 2023',
            rooms: '3 rooms',
            imageAsset: 'assets/images/logo.png',
            onTap: () {
              Get.toNamed(
                AppRoutes.export,
                arguments: {
                  'project': {
                    'title': 'Living Room',
                    'date': 'Oct 12, 2023',
                    'rooms': 3,
                    'image': 'assets/images/logo.png',
                  },
                },
              );
            },
          ),
          const SizedBox(height: 12),
          _ProjectCard(
            title: 'Kitchen',
            date: 'Dec 12, 2023',
            rooms: '3 rooms',
            imageAsset: 'assets/images/logo.png',
            onTap: () {
              Get.toNamed(
                AppRoutes.export,
                arguments: {
                  'project': {
                    'title': 'Kitchen',
                    'date': 'Dec 12, 2023',
                    'rooms': 3,
                    'image': 'assets/images/logo.png',
                  },
                },
              );
            },
          ),
          const SizedBox(height: 24),
          Column(
            children: [
              const Icon(Iconsax.brush, size: 36, color: MyColors.primary),
              const SizedBox(height: 8),
              Text(
                'No projects yet',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              Text(
                'Start your first scan to plan and paint your home.',
                textAlign: TextAlign.center,
                style: MyTextTheme.lightTextTheme.bodyMedium,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProfileTab extends StatelessWidget {
  final VoidCallback onBack;
  const _ProfileTab({required this.onBack});
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back)),
              const Spacer(),
            ],
          ),
          Text(
            'Edit Profile',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displayMedium,
          ),
          const SizedBox(height: 16),
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundImage: const AssetImage(MyImages.user),
                ),
                const SizedBox(height: 8),
                Text('Ana Dua', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(
                  'ana@gmail.com',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          TextFormField(
            decoration: MyTextFormFieldTheme.lightInputDecoration(
              labelText: 'Name',
              prefixIcon: const Icon(Iconsax.user, color: MyColors.primary),
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            decoration: MyTextFormFieldTheme.lightInputDecoration(
              labelText: 'Email',
              prefixIcon: const Icon(Iconsax.sms, color: MyColors.primary),
            ),
          ),
          const SizedBox(height: 24),
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {},
              child: Ink(
                decoration: BoxDecoration(
                  color: Colors.red,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const SizedBox(
                  height: 48,
                  child: Center(
                    child: Text(
                      'Logout',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _ProjectCard extends StatelessWidget {
  final String title;
  final String date;
  final String rooms;
  final String imageAsset;
  final VoidCallback? onTap;
  const _ProjectCard({
    required this.title,
    required this.date,
    required this.rooms,
    required this.imageAsset,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: [MyColors.primary, MyColors.secondary],
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(12),
                  bottomLeft: Radius.circular(12),
                ),
                child: Image.asset(
                  imageAsset,
                  width: 90,
                  height: 80,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(date, style: const TextStyle(color: Colors.white70)),
                    const SizedBox(height: 4),
                    Text(
                      rooms,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const Padding(
                padding: EdgeInsets.all(12.0),
                child: Icon(Icons.cloud_upload_outlined, color: Colors.white),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
