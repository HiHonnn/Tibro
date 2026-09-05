<div align="center">
  <img src="assets/images/icon.png" width="120" alt="Tibro Logo" />
  <h1>📍 TIBRO ECOSYSTEM</h1>
  <p><b>Hệ sinh thái Mạng Xã Hội Bản Đồ Định Vị & Kết Nối Giao Tiếp Tức Thì</b></p>
  
  [![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-1B1F23?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
  [![Flutter](https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white)](https://flutter.dev/)
  [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
</div>

<br/>

Dự án này bao gồm 2 ứng dụng: **Tibro (Dành cho Người dùng)** viết bằng React Native/Expo và **Tibro Admin Panel (Dành cho Quản trị viên)** viết bằng Flutter.

---

# 📱 PHẦN 1: TIBRO APP (CLIENT)

## 📖 Giới thiệu (Overview)

**Tibro** (tiền thân là Bump) là một ứng dụng mạng xã hội đột phá, lấy định vị không gian (Location-based) làm cốt lõi. Phá vỡ đi lối mòn của các nền tảng mạng xã hội truyền thống – nơi người dùng lướt bảng tin (newsfeed) một cách thụ động, Tibro biến bản đồ thế giới thực thành một sân chơi tương tác sống động. Ứng dụng giúp bạn thu hẹp khoảng cách địa lý, kết nối những người dùng từ thế giới số ra ngoài đời thực thông qua các tương tác thú vị ngay trên nền tảng bản đồ số.

## 🚀 Tính năng nổi bật (Key Features)

### 🗺️ 1. Bản đồ & Vị trí (Real-time Location & History)
- **Chia sẻ vị trí thời gian thực**: Cập nhật tọa độ GPS liên tục, hiển thị Avatar người dùng mượt mà trên bản đồ.
- **Radar tìm kiếm (Nearby Radar)**: Tính khoảng cách trong PostgreSQL qua RPC có giới hạn bán kính, không tải toàn bộ vị trí người dùng về client.
- **Lịch sử lộ trình (Timeline History)**: Tự động gom cụm (clustering) các điểm dừng chân thành từng Phiên (Session) để vẽ lại lộ trình di chuyển của bản thân và bạn bè trong 24 giờ.
- **Chế độ Ẩn danh (Ghost Mode)**: Tôn trọng quyền riêng tư tuyệt đối, cho phép ẩn vị trí chỉ bằng 1 chạm.

### 💬 2. Tương tác đa phương tiện & Liên lạc
- **Cơn mưa Emoji (Pop Rain)**: Cơ chế "Bắn Pop" vật lý tạo ra cơn mưa biểu tượng cảm xúc tràn ngập màn hình của đối phương, hỗ trợ hiệu ứng đồ họa gia tốc qua `reanimated`.
- **Khoảnh khắc (Moments 24h)**: Đăng ảnh check-in đính kèm tọa độ trực tiếp lên bản đồ; bản đồ chỉ hiển thị các khoảnh khắc trong 24 giờ gần nhất.
- **Chat Real-time**: Nhắn tin 1-1 tốc độ cao, hỗ trợ chia sẻ ảnh thông qua WebSockets.
- **Gọi Thoại & Video (A/V Call)**: Gọi 1-1 bằng LiveKit/WebRTC, có màn hình cuộc gọi đến, chấp nhận/từ chối, timeout và ngắt kết nối. Token phòng ngắn hạn do backend cấp sau khi kiểm tra JWT và quan hệ cuộc trò chuyện.

### 🔥 3. Hệ thống Tình bạn (Intimacy System)
- Hệ thống theo dõi mức độ tương tác (nhắn tin, react moment) để tăng điểm thân mật.
- Tự động thăng cấp danh hiệu: *🌱 Người quen ➡️ 🌿 Bạn bè ➡️ 🔥 Bạn thân ➡️ 👑 Tri kỷ*.
- Cơ chế **"Bump" (Chạm mặt)**: Khuyến khích ra ngoài gặp gỡ. Khi đứng cạnh nhau ngoài đời thực, thực hiện thao tác "Bump" trên app để nhận lượng lớn điểm thân mật (Giới hạn 1 lần/ngày để chống spam).

### 🛠️ 4. Quản trị & Bảo vệ (Admin & Security)
- **Xác thực**: Supabase Auth kết hợp OTP qua Node.js service; secret chỉ tồn tại ở môi trường server.
- **Phân quyền RLS**: Mọi luồng dữ liệu đều được bảo vệ bằng Row Level Security (RLS) của PostgreSQL.

---

## ⚙️ Cấu trúc Công nghệ (Tech Stack)

### Frontend (User App)
- **Framework**: [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/) (Managed Workflow)
- **Routing**: [Expo Router](https://docs.expo.dev/routing/introduction/) (File-based routing)
- **UI & Styling**: [NativeWind](https://www.nativewind.dev/) (TailwindCSS cho React Native), Glassmorphism UI
- **Animations**: `react-native-reanimated`, `react-native-maps`
- **Video/Voice**: LiveKit/WebRTC; signaling trong Supabase Realtime và token cấp từ Node.js API

### Backend & Cơ sở dữ liệu (BaaS)
- **Core Database**: [Supabase](https://supabase.com/) (PostgreSQL 15)
- **Real-time**: Supabase Channels / WebSockets
- **Storage**: Supabase Storage Bucket (Lưu Avatar, Ảnh Chat, Moments)
- **Security**: PostgreSQL Row Level Security (RLS) Policies

### Microservices (Custom Backend)
- **Node.js (Express)**: Server xử lý OTP, giới hạn request, trạng thái cuộc gọi và cấp LiveKit token.
- **Mailer**: Nodemailer tích hợp Google SMTP.
- **Hosting**: Render / Vercel.

---

## 📁 Cấu trúc thư mục lõi (Architecture)

```text
Tibro_App/
├── app/                  # Tầng Giao diện & Điều hướng (File-based Routing)
│   ├── (tabs)/           # Cụm màn hình chính: Map, Chat, Friends, Profile
│   ├── chat/             # Màn hình chi tiết cuộc hội thoại
│   ├── history/          # Giao diện xem lại Lịch sử di chuyển (Timeline)
│   ├── radar.tsx         # Màn hình Radar quét người lạ xung quanh
│   └── maintenance.tsx   # Màn hình chặn truy cập (Bảo trì hệ thống)
├── components/           # Tầng UI Module (Modal, BottomSheet, CustomMarker)
├── services/             # Tầng Logic & Gọi API (Service-Oriented)
│   ├── authService.ts    # Đăng nhập, session, storage
│   ├── locationService.ts# Lấy GPS ngầm, xử lý clustering điểm dừng chân
│   ├── nearbyService.ts  # Gọi RPC tìm người dùng gần mà không lộ dữ liệu vị trí
│   ├── intimacyService.ts# Xử lý quy tắc cộng điểm, Bump giới hạn 1 lần/ngày
│   └── momentService.ts  # Logic nén ảnh client-side & Upload Storage
├── utils/                # Hàm tiện ích dùng chung
└── styles/               # Chứa file theme, color palette (Dark mode)
```

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy (Tibro Client)

### 1. Yêu cầu hệ thống
- **Node.js** (v18.0.0 trở lên)
- **Expo CLI** (`npm install -g expo-cli`)
- Android Studio/Xcode hoặc EAS để tạo **Expo Development Build**. WebRTC không chạy trong Expo Go.

### 2. Cài đặt các gói phụ thuộc (Dependencies)
Clone kho lưu trữ về máy và tiến hành cài đặt thư viện:
```bash
git clone <repository_url>
cd Tibro_App
npm install
```

### 3. Cấu hình database local

```powershell
npx.cmd supabase start
npx.cmd supabase db reset
```

### 4. Cấu hình Biến môi trường (Environment Variables)
Sao chép `.env.example` thành `.env`, sau đó điền các giá trị của môi trường cần chạy:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
EXPO_PUBLIC_API_URL=http://localhost:3000
GOOGLE_MAPS_API_KEY=your_restricted_google_maps_key
```

Backend dùng `functions/.env` và cần thêm ba biến chỉ tồn tại phía server:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
```

### 5. Khởi chạy ứng dụng (Development)
```bash
npm start
```
Tạo Development Build lần đầu bằng `npx expo run:android` hoặc `npx expo run:ios`.

---
<br/>

# 🛡️ PHẦN 2: TIBRO ADMIN PANEL

## 📖 Giới thiệu (Overview)

**Tibro Admin Panel** là ứng dụng dành riêng cho cấp quản lý, được xây dựng bằng **Flutter**. Nó cung cấp một giao diện bảng điều khiển (Dashboard) trực quan giúp các quản trị viên dễ dàng theo dõi, kiểm duyệt nội dung, xử lý vi phạm và can thiệp trực tiếp vào trạng thái hoạt động của mạng xã hội Tibro (Client App).

Ứng dụng Admin dùng Supabase Auth để đăng nhập. Quyền admin phải được xác thực bằng RLS hoặc backend; service role key không được đóng gói trong Flutter app.

---

## 🚀 Tính năng cốt lõi (Core Features)

### 👥 1. Quản lý Người dùng (User Management)
- Hiển thị danh sách toàn bộ người dùng đang hoạt động trong hệ thống.
- Xem chi tiết thông tin cá nhân (Tên, Email, Ngày tham gia, Cấp độ điểm thân mật...).
- **Cấm tài khoản (Ban User)**: Khóa tài khoản vĩnh viễn với chỉ 1 click. Lập tức chặn quyền truy cập của người dùng đó trên Client App.

### 🚩 2. Quản lý Báo cáo vi phạm (Report Handling)
- Tiếp nhận và thống kê các đơn tố cáo từ người dùng (Hành vi không phù hợp, Spam, Lừa đảo...).
- Cung cấp giao diện để Admin xem xét chi tiết (Người tố cáo, Người bị tố cáo, Lý do).
- Phê duyệt (Approve) hoặc Từ chối (Reject) báo cáo, kèm theo khả năng cấm tài khoản trực tiếp từ màn hình duyệt report.

### 📢 3. Thông báo Hệ thống (System Announcements)
- Đăng tải các thông báo sự kiện, cảnh báo, hoặc cập nhật phiên bản.
- Nội dung thông báo sẽ lập tức hiển thị dạng Banner trên màn hình của toàn bộ thiết bị đang cài đặt ứng dụng Tibro.

### 🛠️ 4. Điều hành Hệ thống (Maintenance Mode)
- **Công tắc Bảo trì Khẩn cấp**: Khả năng bật/tắt chế độ bảo trì (Maintenance) thông qua việc can thiệp vào bảng `system_config` của CSDL.
- Khi được kích hoạt, toàn bộ ứng dụng Tibro của người dùng sẽ lập tức bị gián đoạn, tự động chuyển hướng ra màn hình chờ bảo trì.

---

## ⚙️ Cấu trúc Công nghệ (Tech Stack)

- **Framework**: [Flutter](https://flutter.dev/) (SDK >= 3.0.0)
- **Ngôn ngữ**: [Dart](https://dart.dev/)
- **State Management**: Provider / SetState
- **Database & Auth**: Giao tiếp với PostgreSQL thông qua thư viện `supabase_flutter`.
- **Admin Privileges**: JWT của admin kết hợp RLS; các thao tác đặc quyền sẽ được chuyển sang backend API.

---

## 📂 Cấu trúc thư mục lõi (Folder Structure)

```text
bump_admin/
├── lib/
│   ├── main.dart             # Entry point & Cấu hình Supabase Client
│   ├── screens/              # Các màn hình chính của Admin
│   │   ├── login_screen.dart     # Màn hình đăng nhập dành riêng cho Admin
│   │   ├── dashboard_screen.dart # Giao diện bảng điều khiển trung tâm
│   │   └── ...
│   ├── widgets/              # Các component UI tái sử dụng
│   ├── services/             # Lớp giao tiếp gọi API Admin
│   └── utils/                # Hàm tiện ích xử lý ngày tháng, format text
├── pubspec.yaml              # Quản lý dependencies (supabase_flutter, http...)
└── README.md
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy ứng dụng (Admin Panel)

### 1. Yêu cầu hệ thống
- Tải và cài đặt **Flutter SDK**.
- Có sẵn máy ảo (Android Emulator / iOS Simulator) hoặc trình duyệt Chrome (nếu build Web).

### 2. Cài đặt thư viện
```bash
cd tibro_admin
flutter pub get
```

### 3. Cấu hình Supabase
Truyền URL và publishable/anon key khi chạy. Không sử dụng service role key trong app:
```bash
flutter run -d chrome \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your_publishable_key
```

### 4. Chạy ứng dụng
```bash
flutter run -d chrome  # Chạy trên trình duyệt Web
flutter run -d macos   # Chạy trên MacOS app
```

---
## 📚 Tài liệu Hệ thống (Documentation)
Các biểu đồ Use Case và Sequence Diagram hiện có trong `Diagrams.puml`. Schema database sẽ được quản lý bằng Supabase migrations trong thư mục `supabase/`.

<br/>
<div align="center">
  <i>Hệ sinh thái Tibro Project. Phát triển bởi nhóm sinh viên. Copyright © 2026.</i>
</div>
