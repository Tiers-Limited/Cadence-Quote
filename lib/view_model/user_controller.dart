import 'package:get/get.dart';

class UserController extends GetxController {
  final address = ''.obs;

  void setAddress(String value) => address.value = value;
}

