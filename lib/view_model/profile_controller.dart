import 'package:get/get.dart';
import 'package:primechoice/core/utils/local_storage/storage_utility.dart';
import 'package:primechoice/core/services/profile_service.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cloudinary_public/cloudinary_public.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter/foundation.dart';

class ProfileController extends GetxController {
  final fullName = ''.obs;
  final email = ''.obs;
  final address = ''.obs;
  final phone = ''.obs;
  final profilePicture = ''.obs;
  final uploading = false.obs;

  @override
  void onInit() {
    final store = MyLocalStorage.instance();
    fullName.value = store.readData<String>('user_full_name') ?? '';
    email.value = store.readData<String>('user_email') ?? '';
    address.value = store.readData<String>('user_address') ?? '';
    phone.value = store.readData<String>('user_phone') ?? '';
    profilePicture.value = store.readData<String>('user_profile_picture') ?? '';
    super.onInit();
  }

  Future<void> updateName(String name) async {
    final res = await ProfileService.instance.updateProfile(fullName: name);
    final user =
        (res['data'] as Map<String, dynamic>?)?['user']
            as Map<String, dynamic>?;
    if (user != null) {
      fullName.value = (user['fullName'] ?? '').toString();
    }
  }

  Future<void> updateAddress(String value) async {
    final res = await ProfileService.instance.updateProfile(address: value);
    final user =
        (res['data'] as Map<String, dynamic>?)?['user']
            as Map<String, dynamic>?;
    if (user != null) {
      address.value = (user['address'] ?? '').toString();
    }
  }

  Future<void> updatePhone(String value) async {
    final res = await ProfileService.instance.updateProfile(phoneNumber: value);
    final user =
        (res['data'] as Map<String, dynamic>?)?['user']
            as Map<String, dynamic>?;
    if (user != null) {
      phone.value = (user['phoneNumber'] ?? '').toString();
    }
  }

  Future<void> pickAndUploadProfileImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
    );
    if (picked == null) return;
    final cloudName = dotenv.env['CLOUDINARY_CLOUD_NAME'];
    final uploadPreset = dotenv.env['CLOUDINARY_UPLOAD_PRESET'];
    if (cloudName == null ||
        cloudName.isEmpty ||
        uploadPreset == null ||
        uploadPreset.isEmpty) {
      if (kDebugMode) {
        print('Cloudinary configuration missing');
      }
      return;
    }
    uploading.value = true;
    try {
      final cloudinary = CloudinaryPublic(
        cloudName,
        uploadPreset,
        cache: false,
      );
      final response = await cloudinary.uploadFile(
        CloudinaryFile.fromFile(picked.path, folder: 'primechoice/users'),
      );
      final url = response.secureUrl;
      if (url.isEmpty) {
        throw Exception('Upload failed');
      }
      await ProfileService.instance.updateProfile(profilePicture: url);
      profilePicture.value = url;
      final store = MyLocalStorage.instance();
      await store.writeData('user_profile_picture', url);
    } catch (e) {
      if (kDebugMode) {
        print('Cloudinary upload error: $e');
      }
      rethrow;
    } finally {
      uploading.value = false;
    }
  }
}
