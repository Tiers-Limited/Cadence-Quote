import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import 'package:primechoice/core/utils/constants/image_strings.dart';
import 'package:primechoice/core/utils/constants/colors.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          Text(
            'Edit Profile',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displayMedium,
          ),
          const SizedBox(height: 16),
          Center(
            child: Column(
              children: [
                const AvatarWithCamera(),
                const SizedBox(height: 8),
                Text(
                  'Abrar Haider',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  'abrarhaider987@gmail.com',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const _ProfileTile(
            icon: Iconsax.user,
            title: 'Name',
            color: Colors.black,
          ),
          const SizedBox(height: 12),
          const _ProfileTile(
            icon: Iconsax.sms,
            title: 'Email',
            color: Colors.black,
          ),
          const SizedBox(height: 12),
          _ProfileTile(
            icon: Iconsax.location,
            title: 'Address',
            color: Colors.black,
            onTap: () {},
          ),
          const SizedBox(height: 12),
          _ProfileTile(
            icon: Iconsax.logout,
            title: 'Logout',
            color: Colors.red,
            onTap: () {},
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class AvatarWithCamera extends StatelessWidget {
  const AvatarWithCamera({super.key});

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 90,
          height: 90,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [
                MyColors.primaryBackground.withOpacity(0.3),
                MyColors.buttonPrimary.withOpacity(0.3),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: MyColors.primary.withOpacity(0.25),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
        ),
        const Positioned(
          left: 5,
          top: 5,
          child: CircleAvatar(
            radius: 40,
            backgroundImage: AssetImage(MyImages.user),
          ),
        ),
        Positioned(
          right: -2,
          bottom: -2,
          child: Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: MyColors.primary,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.camera_alt, color: Colors.white, size: 16),
          ),
        ),
      ],
    );
  }
}

class _ProfileTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color color;
  final VoidCallback? onTap;
  const _ProfileTile({
    required this.icon,
    required this.title,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.15)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Icon(icon, color: color.withOpacity(0.6)),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  color: color.withOpacity(0.6),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}
