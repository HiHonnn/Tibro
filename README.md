<div align="center">
  <img src="assets/images/icon.png" width="120" alt="Tibro logo" />
  <h1>Tibro</h1>
  <p><strong>Location-based social networking platform built with React Native, Flutter, Node.js and Supabase.</strong></p>

  [![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)
  [![Flutter](https://img.shields.io/badge/Flutter-02569B?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev/)
  [![Supabase](https://img.shields.io/badge/Supabase-181818?style=flat-square&logo=supabase&logoColor=3ECF8E)](https://supabase.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
</div>

## Giới thiệu

Tibro là nền tảng mạng xã hội lấy bản đồ và vị trí làm trung tâm. Người dùng có thể kết nối bạn bè, chia sẻ vị trí theo thời gian thực, xem lại lịch sử di chuyển, đăng khoảnh khắc lên bản đồ và trò chuyện trực tiếp.

Repository gồm hai ứng dụng và một backend:

- **Tibro Mobile** — React Native, Expo và TypeScript.
- **Tibro Admin** — Flutter dashboard dành cho quản trị viên.
- **Tibro API** — Express service xử lý OTP, đăng ký, khôi phục mật khẩu và các tác vụ cần quyền server.

> **Trạng thái:** dự án portfolio đang trong giai đoạn hoàn thiện và kiểm thử thiết bị. Voice/video calling là tính năng thử nghiệm, chưa nằm trong phạm vi tính năng ổn định được giới thiệu trong CV.

## Tính năng chính

### Bản đồ và vị trí

- Chia sẻ vị trí thời gian thực với bạn bè.
- Radar tìm người dùng gần đó bằng PostgreSQL RPC có giới hạn bán kính.
- Lịch sử vị trí và timeline trong 24 giờ.
- Ghost Mode để tắt chia sẻ vị trí.
- Kiểm tra khoảng cách và giới hạn thao tác Bump ở tầng database.

### Kết nối xã hội

- Gửi, chấp nhận, từ chối và hủy kết bạn.
- Chat 1-1 theo thời gian thực, hỗ trợ gửi ảnh và trạng thái đã đọc.
- Biệt danh, mute cuộc trò chuyện và xóa hội thoại một chiều.
- Hệ thống điểm thân mật dựa trên tương tác.
- Pop Rain — gửi hiệu ứng emoji thời gian thực cho bạn bè.

### Moments

- Đăng ảnh kèm vị trí lên bản đồ.
- Moment tự hết hiệu lực sau 24 giờ.
- Reaction và thông báo theo thời gian thực.
- Ảnh được chuẩn hóa trước khi upload lên Supabase Storage.

### Xác thực và bảo mật

- Supabase Auth kết hợp luồng OTP qua Express API.
- Đăng ký và khôi phục mật khẩu có rate limiting.
- Row Level Security cho dữ liệu người dùng, bạn bè, tin nhắn và vị trí.
- Các thao tác tính điểm và kiểm tra khoảng cách chạy trong trusted database functions.
- Service-role key chỉ được sử dụng trong backend environment.

### Admin Panel

- Dashboard thống kê người dùng và báo cáo.
- Xem chi tiết và khóa tài khoản vi phạm.
- Duyệt hoặc từ chối báo cáo.
- Quản lý thông báo toàn hệ thống.
- Bật/tắt Maintenance Mode.
- Quyền quản trị được xác minh bằng JWT và RLS; admin app không chứa service-role key.

## Kiến trúc

```text
Tibro Mobile (Expo / React Native)
        │
        ├── Supabase Auth
        ├── PostgreSQL + RLS + RPC
        ├── Supabase Realtime
        ├── Supabase Storage
        └── Tibro API (Express)
                  ├── OTP email
                  ├── Registration
                  └── Password recovery

Tibro Admin (Flutter)
        └── Supabase Auth + admin RLS policies
```

Schema, policies, functions và seed data được quản lý bằng Supabase migrations để có thể dựng lại môi trường từ đầu.

## Công nghệ sử dụng

| Thành phần | Công nghệ |
| --- | --- |
| Mobile | React Native, Expo Router, TypeScript |
| Styling | NativeWind, React Native StyleSheet |
| Maps & location | React Native Maps, Expo Location |
| Realtime | Supabase Realtime |
| Database | PostgreSQL, Supabase, Row Level Security |
| Storage | Supabase Storage |
| Backend | Node.js, Express, Nodemailer |
| Admin | Flutter, Dart, Supabase Flutter |
| Experimental calling | LiveKit, WebRTC |

## Cấu trúc repository

```text
Tibro/
├── app/                 # Expo Router screens
├── components/          # Shared React Native UI
├── hooks/               # Session, profile and location providers
├── services/            # Client data-access layer
├── styles/              # Theme and map styles
├── utils/               # Storage and image utilities
├── functions/           # Express API
├── supabase/             # Migrations, config and seed data
├── bump_admin/           # Flutter Admin Panel
└── Diagrams.puml         # Use-case and sequence diagrams
```

## Cài đặt Tibro Mobile

### Yêu cầu

- Node.js 18 trở lên.
- npm.
- Android Studio, Xcode hoặc EAS nếu cần native development build.
- Docker Desktop nếu chạy Supabase local.

### Clone và cài dependency

```bash
git clone https://github.com/HiHonnn/Tibro.git
cd Tibro
npm ci
```

### Cấu hình môi trường

Sao chép `.env.example` thành `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
GOOGLE_MAPS_API_KEY=your-restricted-google-maps-key
```

Khi chạy trên điện thoại thật, `EXPO_PUBLIC_API_URL` phải dùng địa chỉ IPv4 trong mạng LAN của máy chạy backend thay vì `localhost`.

### Chạy database local

```powershell
npx.cmd supabase start
npx.cmd supabase db reset
npx.cmd supabase db lint --local --level warning
```

### Chạy ứng dụng

```bash
npm start
```

Tạo development build khi cần:

```bash
npx expo run:android
# hoặc
npx expo run:ios
```

## Chạy Tibro API

```bash
cd functions
npm ci
```

Sao chép `functions/.env.example` thành `functions/.env` và cấu hình:

```env
GMAIL_USER=your-smtp-account@example.com
GMAIL_APP_PASSWORD=your-app-password
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-key
OTP_SECRET=generate-a-long-random-secret
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

Khởi chạy API:

```bash
npm start
```

Không đặt `SUPABASE_SERVICE_ROLE_KEY`, SMTP password hoặc server secret trong Expo/Flutter source hay biến `EXPO_PUBLIC_*`.

## Chạy Tibro Admin

```bash
cd bump_admin
flutter pub get
flutter run -d chrome \
  --dart-define=SUPABASE_URL=https://your-project-ref.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Tài khoản phải có bản ghi tương ứng trong bảng `public.admins` và được RLS cho phép truy cập dữ liệu quản trị.

## Kiểm tra chất lượng

```bash
# TypeScript + ESLint
npm run check

# Backend syntax
npm --prefix functions run check

# Flutter static analysis
cd bump_admin
flutter analyze
```

Trước khi release cần kiểm thử các luồng đăng ký, OTP, kết bạn, chat, Moments, chia sẻ vị trí, quyền riêng tư và Admin Panel bằng tài khoản demo.

## Roadmap

- Ổn định voice/video calling bằng LiveKit/WebRTC.
- Push notification và xử lý cuộc gọi khi ứng dụng chạy nền.
- Unit test cho authentication và database functions.
- Integration test cho chat và location privacy.
- CI cho TypeScript, ESLint, backend và Flutter.
- Hoàn thiện bộ ảnh/video demo cho portfolio.

## Tài liệu bổ sung

- [`Diagrams.puml`](Diagrams.puml) — use-case và sequence diagrams.
- [`USER_FUNCTION_AUDIT.md`](USER_FUNCTION_AUDIT.md) — phạm vi kiểm tra chức năng.
- [`RECOVERY.md`](RECOVERY.md) — hướng dẫn dựng môi trường portfolio sạch.

---

<div align="center">
  <sub>Student portfolio project · Tibro © 2026</sub>
</div>
