# HƯỚNG DẪN TRIỂN KHAI & CẤU HÌNH HỆ THỐNG LỊCH TRỰC NỘI TRÚ
**TRƯỜNG PHỔ THÔNG DÂN TỘC NỘI TRÚ NA RÌ**

Hệ thống quản lý và sắp xếp lịch trực quản sinh nội trú đa người dùng thời gian thực, tích hợp cơ sở dữ liệu Supabase PostgreSQL, đồng bộ Google Sheets API v4 và phân quyền bảo mật RLS.

---

## 1. Cấu Hình Cơ Sở Dữ Liệu Supabase PostgreSQL & Realtime

### Bước 1.1: Tạo Project trên Supabase
1. Truy cập [https://supabase.com](https://supabase.com) và đăng nhập / tạo tài khoản.
2. Bấm **New Project**, đặt tên (ví dụ: `PTDTNT-NaRi-DutyRoster`) và thiết lập Database Password.
3. Chọn khu vực máy chủ gần nhất: `Southeast Asia (Singapore)`.

### Bước 1.2: Chạy Kịch Bản SQL Khởi Tạo Database
1. Mở menu **SQL Editor** trong thanh bên trái của Supabase Dashboard.
2. Bấm **New Query**, mở tệp `supabase-schema.sql` trong mã nguồn dự án, sao chép toàn bộ nội dung và dán vào ô truy vấn.
3. Bấm nút **Run** (chạy).
   - Hệ thống sẽ tự động tạo các bảng: `employees`, `shift_assignments`, `unavailable_dates`, `shift_change_requests`, `compensatory_duties`, `shift_change_history`, `schedule_settings`, `sync_logs`, `user_profiles`.
   - Tự động kích hoạt **Supabase Realtime** cho các bảng dữ liệu.
   - Thiết lập các chính sách bảo mật **Row Level Security (RLS)** cho phép người xem công khai đọc lịch và chặn sửa đổi trái phép.

### Bước 1.3: Lấy Thông Tin Kết Nối
1. Trong Supabase Dashboard, vào **Project Settings** > **API**.
2. Sao chép 2 giá trị:
   - **Project URL**: ví dụ `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public key**: chuỗi mã JWT public.

### Bước 1.4: Cấu Hình Vào Ứng Dụng
- **Cách 1 (Giao diện)**: Mở ứng dụng, vào góc dưới bên trái menu chọn **Cấu hình & Sao lưu dữ liệu** > Tab **Supabase PostgreSQL**, dán URL & Key rồi bấm **Kiểm Tra Kết Nối (Ping DB)** > bấm **Chuyển Toàn Bộ Dữ Liệu Lên Supabase**.
- **Cách 2 (Biến môi trường)**: Điền vào file `.env` hoặc cấu hình Environment Variables trên máy chủ:
  ```env
  VITE_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
  VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  ```

---

## 2. Cấu Hình Tích Hợp Google Sheets API v4

### Bước 2.1: Chuẩn Bị Bảng Tính Google Sheets
1. Mở Google Drive của trường, tạo một bảng tính mới: ví dụ `LỊCH TRỰC QUẢN SINH NỘI TRÚ - NĂM HỌC 2026-2027`.
2. Lấy **Spreadsheet ID** từ thanh địa chỉ trình duyệt:
   - Đường dẫn có dạng: `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`**`/edit`
   - Phần in đậm chính là Spreadsheet ID cần sao chép.

### Bước 2.2: Đồng Bộ Dữ Liệu Thực Tế
1. Trên thanh Header hoặc Sidebar, bấm nút **Google Sheets** hoặc vào menu **Đồng bộ Google Sheets**.
2. Dán Spreadsheet ID vào ô cấu hình.
3. Nhập Google OAuth Access Token (hoặc cấp quyền khi đăng nhập tài khoản Google).
4. Bấm **Kiểm Tra Kết Nối Thực Tế**: Hệ thống sẽ gọi API Google Sheets để xác nhận tên bảng tính và danh sách trang tính (không giả lập kết nối thành công nếu chưa cấu hình đúng).
5. Bấm **Xuất Lịch Trực** hoặc **Xuất Cán Bộ**:
   - Hệ thống áp dụng cơ chế Clear & Update dải ô chính xác: hoàn toàn không bao giờ tạo bản ghi trùng lặp khi đồng bộ nhiều lần.
   - Tự động ghi nhật ký đồng bộ vào bảng `sync_logs`.

---

## 3. Trang Lịch Trực Công Khai Dành Cho Giáo Viên & Phụ Huynh

- Đường link truy cập trực tiếp: `https://[ten-mien-cua-truong]/?view=public`
- **Tính năng nổi bật**:
  - Truy cập ngay mà không cần tài khoản hay mật khẩu.
  - Chế độ chỉ đọc (Read-Only), tuyệt đối không thể chỉnh sửa hay can thiệp vào dữ liệu lịch trực.
  - Bộ lọc đa năng: Theo tháng, theo ngày (Hôm nay, ngày trong tuần, cuối tuần), theo chức vụ (GV1, GV2, BGH, Bảo vệ), tìm kiếm theo họ tên giáo viên.
  - Chuyển đổi linh hoạt giữa Dạng Thẻ Ngày (cực kỳ tối ưu trên điện thoại di động) và Dạng Bảng Lưới (cho máy tính).
  - Tích hợp nút in ấn PDF trực tiếp theo chuẩn biểu mẫu hành chính của nhà trường.
  - Kết nối Realtime: Tự động cập nhật tức thì khi Ban Giám Hiệu thay đổi ca trực trên máy tính của trường.

---

## 4. Hướng Dẫn Triển Khai Lên Vercel / Nền Tảng Đám Mây

### Cách 1: Triển Khai Nhanh Qua Vercel
1. Đẩy mã nguồn lên kho lưu trữ GitHub của bạn.
2. Đăng nhập [https://vercel.com](https://vercel.com), bấm **Add New...** > **Project** và chọn kho lưu trữ.
3. Trong phần **Environment Variables**, thêm các biến:
   - `VITE_SUPABASE_URL`: URL dự án Supabase của bạn.
   - `VITE_SUPABASE_ANON_KEY`: Khóa Anon Key của Supabase.
   - `VITE_GOOGLE_SHEETS_SPREADSHEET_ID`: (Tùy chọn) ID Google Sheets.
4. Bấm **Deploy**. Vercel sẽ tự động chạy `npm run build` và cung cấp tên miền HTTPS bảo mật.

### Cách 2: Triển Khai Qua Cloud Run / Docker
- Lệnh build: `npm run build`
- Lệnh chạy: `npm run preview` hoặc phục vụ thư mục `dist` qua Nginx / Cloud Storage.

---

## 5. Kết Quả Kiểm Thử Hệ Thống (23 Kịch Bản Nghiệp Vụ)

Ứng dụng tích hợp bộ kiểm thử tự động toàn diện tại tab **Kiểm thử 23 Kịch bản**, bao gồm:
1. Xếp đủ 30 ca liên tục trong tháng.
2. Kiểm soát ràng buộc 24 giờ (không phân công 2 ngày liên tiếp).
3. Tôn trọng lịch bận & ngày nghỉ phép đã được BGH duyệt.
4. Xếp đủ kíp trực 4 người: 2 Giáo viên + 1 BGH + 1 Bảo vệ.
5. Luân phiên công bằng ca trực cuối tuần (Thứ 7, Chủ Nhật).
6. Tự động tìm người trực thay và phát sinh nợ ca trực bù.
7. Xếp bù ca nợ khi đồng nghiệp vắng có ngày rảnh.
8. Soạn thảo thông báo Gmail nhắc ca trực tự động.
9. Đồng bộ hóa thời gian thực 24h & cửa sổ giao ban 07:00 sáng.
10. Tự động nhận diện cột linh hoạt khi nhập file Excel.
11. Khóa và bảo vệ ca trực chống xếp đè.
12. Đăng ký nghỉ & tự động hoán đổi ca trực.
13. Thống kê chi tiết số ca thường, cuối tuần và nợ bù.
14. Xuất khẩu lịch biểu chuẩn biểu mẫu Bộ Giáo Dục & Đào Tạo.
15. Tự động điền nhân sự mới vào các ca còn trống.
16. Đăng nhập Google & phân quyền tài khoản riêng biệt.
17. Hai tài khoản cùng mở xem một lịch & kênh Supabase Realtime broadcast.
18. Đồng bộ trực tiếp dữ liệu trên nhiều thiết bị & chống xung đột ghi đè.
19. Phân quyền nghiêm ngặt (Admin, BGH, GV, BV - không cho tự phong quyền).
20. Thêm nhân sự mới & xem trước ảnh hưởng (Impact Preview) trước khi áp dụng.
21. Bảo vệ lịch trực đã khóa (Lock Protection) không bị thuật toán ghi đè.
22. Chế độ mất mạng (Offline fallback) & tự động kết nối lại khi có mạng.
23. Đồng bộ Google Sheets API v4 thực tế & chống trùng lặp bản ghi.
