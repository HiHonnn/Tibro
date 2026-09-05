# Tibro Admin

Dashboard quản trị của Tibro. Ứng dụng chỉ sử dụng Supabase publishable/anon key;
mọi quyền quản trị phải được bảo vệ bằng RLS hoặc backend API.

## Run

```bash
flutter pub get
flutter run -d chrome --dart-define-from-file=../.env
```

File `.env` dùng chung với ứng dụng Tibro và phải có
`EXPO_PUBLIC_SUPABASE_URL` cùng `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Development

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://docs.flutter.dev/cookbook)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
