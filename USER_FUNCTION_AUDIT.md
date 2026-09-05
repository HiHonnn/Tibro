# Biên bản rà soát chức năng người dùng Tibro

Ngày rà soát: 05/09/2026

Phạm vi của đợt này là Expo client, Supabase schema/RLS và Node.js API mà người
dùng cuối sử dụng. Flutter Admin chưa nằm trong phạm vi nghiệm thu này.

## Kết quả rà soát

| Nhóm chức năng | Trạng thái code | Nội dung đã kiểm tra/sửa |
| --- | --- | --- |
| Khởi động, intro, bảo trì, tài khoản bị cấm | Đạt kiểm tra tĩnh | Điều hướng và kiểm tra phiên từ server; không đăng xuất nhầm khi mạng chập chờn |
| Đăng ký, OTP, đăng nhập, quên mật khẩu, đăng xuất | Đạt kiểm tra tĩnh | OTP có thời hạn/rate limit; đăng ký và reset chạy qua backend; lỗi tạo session không còn bị bỏ qua |
| Hồ sơ và avatar | Đạt kiểm tra tĩnh | Validate dữ liệu; ảnh được chuẩn hóa JPEG và upload bằng `ArrayBuffer` trên React Native |
| Kết bạn, tìm kiếm, chấp nhận, từ chối, thu hồi, hủy bạn | Đạt kiểm tra tĩnh | RLS theo đúng requester/receiver; danh sách và Realtime refresh không giữ callback cũ |
| Bản đồ, chia sẻ vị trí, Radar | Đạt kiểm tra tĩnh | Chỉ một GPS watcher toàn app; trạng thái theo từng user; từ chối quyền có thông báo/thử lại; lọc tọa độ rỗng |
| Lịch sử vị trí | Đạt kiểm tra tĩnh | Quyền riêng tư lưu bằng bảng preference; truy vấn theo múi giờ Việt Nam; RLS chỉ cho bạn bè khi chủ sở hữu cho phép |
| Bump và điểm thân mật | Đạt kiểm tra tĩnh | Khoảng cách, quan hệ bạn bè, giới hạn một lần/ngày và cộng điểm được xác thực nguyên tử trong database |
| Pop emoji và thông báo | Đạt kiểm tra tĩnh | Chỉ bạn bè được gửi; số lượng bị giới hạn; thông báo được trigger tin cậy tạo thay vì client tự ghi |
| Moment, reaction và trả lời Moment | Đã sửa | Upload ảnh đúng kiểu nhị phân, kiểm tra vị trí/caption, dọn file nếu insert lỗi; reaction và thông báo do database xử lý |
| Chat chữ, ảnh, realtime, đã đọc, biệt danh, mute, xóa một chiều | Đạt kiểm tra tĩnh | Bucket ảnh chat riêng; lỗi gửi giữ lại nội dung; preview hội thoại cập nhật bằng trigger; truy vấn không còn nuốt lỗi |
| Báo cáo người dùng | Đạt kiểm tra tĩnh | Validate người bị báo cáo/lý do/mô tả; RLS chỉ cho người gửi tạo report |
| Gọi thoại và gọi video 1-1 | Đã khôi phục | LiveKit/WebRTC; backend cấp token ngắn hạn; gọi đến foreground, nhận/từ chối, timeout, mute, camera, kết thúc và dọn phiên lỗi |

## Bảo vệ cuộc gọi

- Client không giữ LiveKit API secret.
- Backend xác minh Supabase JWT, thành viên cuộc trò chuyện và quan hệ bạn bè.
- Database chỉ cho hai người tham gia đọc phiên gọi; client không được tự ghi
  trạng thái gọi.
- Trigger khóa đồng thời không cho một tài khoản tham gia hai cuộc gọi đang
  `ringing`/`accepted`.
- Token chỉ có quyền vào đúng room và hết hạn sau 10 phút.

## Kiểm tra tự động đã đạt

- `npx tsc --noEmit`: đạt.
- `npx eslint . --no-cache`: đạt, 0 lỗi và 0 cảnh báo.
- `node --check functions/index.js`: đạt.
- Backend health smoke test sau khi nâng Express 5: đạt.
- `npx expo export --platform android`: đạt, bundle đủ 2.080 module.
- `npx expo-doctor`: đạt 21/21 kiểm tra, không phát hiện vấn đề.
- `git diff --check`: đạt.
- `supabase db push --dry-run`: đạt; nhận đúng hai migration mới và chưa thay đổi database.
- `npm audit` backend: 0 lỗ hổng. Client không có mức high/critical; còn cảnh báo moderate gián tiếp trong toolchain Expo và chỉ có phương án `--force` gây breaking change.

## Nghiệm thu thiết bị bắt buộc trước khi quay demo CV

1. Dùng project Supabase portfolio sạch, chạy hai migration mới và deploy Node API.
2. Cấu hình LiveKit server-side rồi tạo Expo Development Build mới; không dùng Expo Go.
3. Dùng hai tài khoản bạn bè trên hai thiết bị thật để thử lần lượt chat chữ, ảnh,
   Moment, reaction, Pop, chia sẻ/tắt vị trí, lịch sử riêng tư và Bump trong phạm vi 50 m.
4. Thử gọi thoại/video hai chiều: nhận, từ chối, không trả lời 45 giây, tắt micro,
   tắt camera, bấm Back và mất mạng giữa cuộc gọi.
5. Kiểm tra cuộc gọi đến khi app đang foreground. Chuông nền khi app bị kill chưa
   được quảng bá là tính năng vì cần push notification và native call integration.
