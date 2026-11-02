# Kế Hoạch Sửa Lỗi Toàn Bộ Nút Bấm, Tự Động Gán Nhân Sự Vào Bảng Lịch & Đăng Nhập Google (Admin / User)

## 1. Bối cảnh & Vấn đề Cần Khắc Phục

1. **Nhân sự mới thêm không xuất hiện ở bảng lịch trực**:
   - Khi thêm mới hoặc nhập từ Excel trong *Quản Lý Nhân Sự*, nhân sự chỉ được lưu vào danh sách cán bộ `employees` mà không được gán vào các ca trực đang trống của tháng. Bảng lịch biểu chỉ hiển thị những người đã được xếp lịch trước đó.
   - **Giải pháp**: Bổ sung hàm tự động tìm và điền nhân sự mới vào các ca trực còn thiếu/trống (`teacher1Id`, `teacher2Id`, `adminId`, `guardId`) phù hợp với chức vụ từ ngày hiện tại đến hết tháng. Thêm nút "Tự Động Gán Nhân Sự Vào Ca Trống" trên giao diện để quản trị viên có thể đồng bộ tức thì.

2. **Các nút bấm không phản hồi khi click**:
   - Nút *Thêm mới* và *Nhập Excel* trong Quản lý nhân sự, nút *Phê duyệt* và *Từ chối* trong Quản lý nghỉ phép, nút *Chạy xếp lịch tự động*, nút *Bộ lọc ngày tháng* và thanh điều hướng bị chặn hoặc không hiển thị phản hồi khi vai trò người dùng bị khóa hoặc chưa kích hoạt đúng sự kiện.
   - **Giải pháp**: Rà soát và sửa toàn diện tất cả các sự kiện `onClick`, `onSubmit`, `onChange`, trạng thái `disabled`, `pointer-events`, và bổ sung phản hồi trực quan (toast notification, dialog xác nhận, hiệu ứng click) cho toàn bộ 100% nút bấm trên tất cả các trang.

3. **Tính năng đăng nhập Google riêng cho Admin và User (Giáo viên)**:
   - Hiện hệ thống chỉ có thanh chọn vai trò đơn giản, chưa có cơ chế đăng nhập Google thực tế.
   - **Giải pháp**: Tích hợp module đăng nhập Google (`GoogleAuthModal` / Google Identity SSO), cho phép người dùng đăng nhập bằng tài khoản Google (hỗ trợ `nghiahoag0@gmail.com` hoặc bất kỳ email Google nào), lựa chọn vai trò **Quản trị viên (Admin)** hoặc **Cán bộ / Giáo viên (User)**, hiển thị thông tin Avatar, Email, Họ tên và phân quyền tương ứng trên toàn hệ thống.

---

## 2. Kế Hoạch Thay Đổi Chi Tiết (Proposed Changes)

### A. Phân quyền & Đăng nhập Google riêng cho Admin và User
- **Tạo component `src/components/GoogleAuthModal.tsx`**:
  - Giao diện đăng nhập chuẩn Google Branding với biểu tượng G-Logo.
  - Cho phép người dùng đăng nhập tài khoản Google (tự động nhận diện `nghiahoag0@gmail.com` hoặc nhập email Google cá nhân).
  - Cho phép lựa chọn vai trò rõ ràng:
    - **Quản Trị Viên (Admin)**: Toàn quyền xếp lịch, thêm/sửa/xóa nhân sự, duyệt nghỉ phép, xuất file và cấu hình hệ thống.
    - **Cán Bộ / Giáo Viên (User / Teacher)**: Xem lịch cá nhân, theo dõi ca trực hôm nay, gửi đơn xin nghỉ/bận, yêu cầu đổi ca trực và xem trực bù.
  - Lưu trữ trạng thái phiên đăng nhập vào `LocalStorage` (tự động khôi phục khi tải lại trang).
- **Cập nhật `src/components/Header.tsx`**:
  - Thêm thẻ thông tin tài khoản Google: Avatar, Tên người dùng, Email, Badge vai trò (Admin / User).
  - Nút Đăng nhập / Đăng xuất / Chuyển nhanh vai trò thuận tiện.
  - Hiển thị thông báo quyền hạn rõ ràng thay vì ẩn âm thầm các nút bấm.

### B. Tự động đồng bộ & gán nhân sự mới vào bảng lịch trực
- **Cập nhật `src/services/scheduler.ts`**:
  - Viết hàm `autoAssignNewEmployeeToShifts(employee, shifts, unavailableDates, settings, fromDate)`:
    - Quét các ca trực từ ngày hiện tại (`fromDate`) đến hết tháng.
    - Tìm các vị trí còn trống hoặc chưa hoàn thiện (ví dụ thiếu Giáo viên 1, Giáo viên 2, BGH trực hoặc Bảo vệ).
    - Kiểm tra điều kiện: không trùng ngày nghỉ phép đã duyệt, không trực 2 ngày liên tiếp, ưu tiên ca còn thiếu.
    - Điền nhân sự vào ca và cập nhật trạng thái `COMPLETE` cho ca trực.
- **Cập nhật `src/App.tsx` & `src/components/EmployeeManagementView.tsx`**:
  - Khi thêm 1 nhân sự mới $\rightarrow$ tự động kích hoạt gán vào các ca trống tương ứng và cập nhật bảng `shifts` ngay lập tức.
  - Khi nhập danh sách nhân sự từ Excel $\rightarrow$ hỏi người dùng hoặc tự động gán toàn bộ nhân sự mới vào các ca trực còn thiếu.
  - Thêm nút **"Đồng Bộ Lịch Trực"** trong bảng nhân sự để chủ động bổ sung vào lịch bất kỳ lúc nào.

### C. Rà soát & Sửa toàn diện tất cả các nút bấm trên hệ thống
- **Quản lý nhân sự (`EmployeeManagementView.tsx`)**:
  - Sửa nút **"Thêm Nhân Sự Mới"**: đảm bảo modal mở mượt mà, form submit không bị nghẽn, mã nhân sự tự sinh chính xác.
  - Sửa nút **"Nhập Từ Excel"**: kiểm tra `fileInputRef`, xử lý chọn lại file cùng tên, mở modal xem trước và xác nhận nhập dữ liệu với 3 chế độ.
  - Sửa nút **"Tải Mẫu Excel"**: tải file mẫu XLSX chuẩn 100% cột nghiệp vụ.
  - Sửa nút **Chỉnh sửa / Xóa**: bổ sung dialog xác nhận, cập nhật tức thì vào bảng.
- **Bảng lịch trực (`ScheduleTableView.tsx`)**:
  - Sửa nút **"Xếp Lịch Tự Động"**: chuyển hướng ngay sang trang thuật toán với đầy đủ tham số đã chọn.
  - Sửa nút **"Nhập Lịch Excel"**: đảm bảo tệp lịch biểu tải lên được phân tích và cập nhật ngay vào bảng.
  - Sửa nút **"Đến Hôm Nay"** & **Bộ lọc tháng**: nhảy đúng dòng ca trực thực tế, chuyển tháng mượt mà.
  - Sửa click vào từng ô ca trực để mở modal đổi ca trực (`ShiftAdjustmentModal`).
- **Lịch bận & Nghỉ phép (`UnavailableDatesView.tsx`)**:
  - Sửa nút **"Phê duyệt"** (Dấu tích xanh) và **"Từ chối"** (Dấu X đỏ): hoạt động cho mọi cấp quản lý, có tooltip và toast thông báo ngay sau khi click.
  - Sửa nút **"Đăng Ký Ngày Bận"**: mở popup form đăng ký nhanh chóng.
- **Xếp lịch tự động (`AutoScheduleView.tsx`)**:
  - Sửa 4 nút chọn nhanh khoảng thời gian (Từ hôm nay đến hết tháng, Toàn bộ tháng này, 7 ngày tới, 14 ngày tới).
  - Sửa nút **"Chạy Thuật Toán Xếp Lịch"** và **"Lưu Lịch Vào Hệ Thống"**: hiển thị trạng thái đang tính toán, thông báo lưu thành công và điều hướng về bảng lịch trực.
- **Sidebar & Header**:
  - Đảm bảo tất cả các mục menu điều hướng chuyển tab tức thì, không bị chặn bởi vai trò (nếu là User sẽ hiển thị ở chế độ xem có thông báo quyền hạn thay vì ẩn hoàn toàn menu).

---

## 3. Kế Hoạch Kiểm Thử & Xác Minh (Verification Plan)

### A. Kiểm thử Tự động (Automated Test Suite)
- Bổ sung **Test 15**: Kiểm thử tính năng tự động gán nhân sự mới vào các ca trực còn trống từ ngày hiện tại.
- Bổ sung **Test 16**: Kiểm thử tính năng phân quyền đăng nhập Google (Admin vs User), đảm bảo tài khoản Admin có quyền sửa/xóa/xếp lịch, tài khoản User có quyền xem và đăng ký cá nhân.
- Cập nhật trang `TestVerificationView.tsx` lên 15/15 kịch bản tự động kiểm thử xanh 100%.

### B. Kiểm thử Thủ công (Manual Browser Verification)
1. Thử đăng nhập Google với tài khoản `nghiahoag0@gmail.com` $\rightarrow$ chọn vai trò Admin $\rightarrow$ kiểm tra Header hiển thị thông tin và quyền hạn đầy đủ.
2. Thêm một nhân viên mới "Nguyễn Văn Test (GV)" $\rightarrow$ kiểm tra Bảng Lịch Trực xem ca trực còn trống của ngày hôm nay/ngày mai đã được gán nhân viên này hay chưa.
3. Thử tải file Excel mẫu $\rightarrow$ bấm nút "Nhập Từ Excel" $\rightarrow$ chọn file $\rightarrow$ xác nhận nhập $\rightarrow$ kiểm tra bảng nhân sự và lịch trực cập nhật.
4. Bấm nút "Phê duyệt" đơn nghỉ phép trong trang Lịch bận $\rightarrow$ kiểm tra tự động hoán đổi ca và ghi nhận vào Trực bù.
5. Bấm nút "Xếp lịch tự động" $\rightarrow$ chọn khoảng thời gian $\rightarrow$ bấm "Chạy Xếp Lịch" $\rightarrow$ bấm "Lưu Lịch" $\rightarrow$ quay lại Bảng lịch trực xác nhận dữ liệu đã được ghi đè chính xác.
6. Chạy `compile_applet` và `lint_applet` để đảm bảo 0 lỗi biên dịch.
