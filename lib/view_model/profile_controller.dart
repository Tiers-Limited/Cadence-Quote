import 'package:get/get.dart';
import 'package:primechoice/core/utils/local_storage/storage_utility.dart';
import 'package:primechoice/core/services/profile_service.dart';

class ProfileController extends GetxController {
  final fullName = ''.obs;
  final email = ''.obs;
  final address = ''.obs;
  final phone = ''.obs;

  @override
  void onInit() {
    final store = MyLocalStorage.instance();
    fullName.value = store.readData<String>('user_full_name') ?? '';
    email.value = store.readData<String>('user_email') ?? '';
    address.value = store.readData<String>('user_address') ?? '';
    phone.value = store.readData<String>('user_phone') ?? '';
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
}
