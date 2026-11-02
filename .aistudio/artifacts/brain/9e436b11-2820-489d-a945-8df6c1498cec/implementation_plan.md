# Nâng Cấp Hệ Thống Quản Lý Lịch Trực Quản Sinh Với Firebase Toàn Diện (Auth, Cloud Firestore & Realtime)

Nâng cấp trực tiếp ứng dụng React/TypeScript hiện có thành hệ thống trực tuyến thời gian thực đa người dùng chạy trên nền tảng Firebase: thay thế lưu trữ cục bộ bằng Cloud Firestore, đồng bộ tức thì bằng Firestore `onSnapshot`, bảo vệ đổi ca an toàn tuyệt đối bằng `runTransaction`, phân quyền chặt chẽ với Firebase Auth & Firestore Security Rules.

### User Review & Critical Decisions

> [!IMPORTANT]
> Dưới đây là các quyết định cốt lõi đã được thống nhất trong Giai đoạn Phỏng vấn (Phase 1):

- **Phương thức tạo và cấp tài khoản nhân viên**: Cán bộ, giáo viên và bảo vệ đăng nhập trực tiếp bằng tài khoản Google (Firebase Google Authentication). Quản trị viên (Admin) quản lý danh sách cán bộ và gán vai trò (`ADMIN`, `BGH`, `TEACHER`, `GUARD`) cho từng tài khoản. Người dùng mới đăng nhập mặc định có vai trò Nhân viên (`TEACHER` hoặc `GUARD`), tuyệt đối không được tự chọn hoặc tự nâng quyền Admin. Email quản trị viên khởi tạo (`dtc245160052@ictu.edu.vn`) được thiết lập quyền Admin ban đầu trong hệ thống.
- **Quy trình hoán đổi ca trực (Shift Swap Workflow)**: Người gửi yêu cầu chọn ca của mình và ca/người muốn đổi. Người được đề nghị nhận thông báo theo thời gian thực và có thể bấm "Chấp nhận" hoặc "Từ chối". Khi người được đề nghị bấm "Chấp nhận", hệ thống lập tức thực thi **Firestore Transaction (`runTransaction`)** để hoán đổi nhân sự nguyên tử (atomic), cập nhật trạng thái yêu cầu sang `APPROVED`, tự động ghi lịch sử thay đổi `shift_change_history` và đồng bộ tức thì đến tất cả thiết bị đang mở ứng dụng. Nếu có ai khác đã đổi ca hoặc dữ liệu bị thay đổi trong lúc chờ, transaction sẽ tự động hủy và thông báo an toàn.

---

### 1. Overview & Core Concept

- **Mục tiêu**: Giữ nguyên toàn bộ giao diện, dữ liệu nghiệp vụ và thuật toán xếp lịch hiện tại của Trường PTDTNT Na Rì (1 ca = 2 Giáo viên + 1 Ban Giám Hiệu + 1 Bảo vệ, ràng buộc cách ly 24 giờ, chống trùng ca, bảo vệ ngày nghỉ phép), đồng thời chuyển đổi lớp lưu trữ và đồng bộ hóa từ LocalStorage sang Google Firebase.
- **Đối tượng sử dụng và phân quyền**:
  - **Quản trị viên (Admin)**: Toàn quyền thêm/sửa/xóa cán bộ giáo viên, chạy thuật toán xếp lịch tự động, mở/khóa ca trực, điều chỉnh thủ công mọi ca trực, quản lý danh sách phân quyền người dùng và cấu hình hệ thống.
  - **Ban Giám Hiệu (BGH)**: Xem toàn bộ lịch trực, duyệt đơn xin nghỉ phép vắng mặt, giám sát các ca trực và yêu cầu đổi ca.
  - **Giáo viên & Cán bộ (Teacher)**: Xem bảng lịch trực chung toàn trường, xem lịch trực cá nhân của mình, nộp đơn xin nghỉ/bận, gửi đề nghị đổi ca cho đồng nghiệp và xác nhận/từ chối các đề nghị đổi ca gửi đến mình.
  - **Bảo vệ (Guard)**: Xem bảng phân công trực ban ngày và ca đêm, kiểm tra lịch trực bảo vệ.
- **Giá trị cốt lõi**:
  - Dữ liệu tập trung và nhất quán trên Cloud Firestore, mọi chỉnh sửa xuất hiện ngay lập tức trên các thiết bị khác trong chưa đầy 1 giây mà không cần F5.
  - Không thể xảy ra tình trạng 2 người cùng đổi một ca dẫn đến trùng lặp hoặc mất dữ liệu nhờ cơ chế Firestore `runTransaction`.
  - Phân quyền bảo mật ở tầng cơ sở dữ liệu với Firestore Security Rules, người dùng không thể can thiệp sửa trực tiếp dữ liệu nếu không có quyền hợp lệ.

---

### 2. User Experience & Visual Design

Tuân thủ nghiêm ngặt chuẩn thiết kế Enterprise SaaS Dashboard và triết lý giao diện sạch (Anti-slop):

- **Khung giao diện (Layout)**:
  - Sidebar bên trái chuẩn 260px phân khu rõ ràng: Tổng quan, Lịch trực bàn cờ, Xếp lịch tự động, Cán bộ giáo viên, Đổi ca trực (có badge số lượng yêu cầu cần xử lý), Đăng ký nghỉ & vắng, Trực bù, Báo cáo & Thống kê, và Bộ kiểm thử xác thực.
  - Header 1 dòng duy nhất: Tiêu đề trường học + Breadcrumb định vị ngữ cảnh + Badge trạng thái kết nối Firebase Firestore Realtime (Xanh lá: "Trực Tuyến · Realtime", Vàng: "Đang Đồng Bộ", Đỏ: "Ngoại Tuyến") + Nút Đăng nhập / Hồ sơ tài khoản Google.
  - Bảng lịch trực trực quan: Các ô ca trực hiển thị thông tin 4 vị trí (GV 1, GV 2, BGH, Bảo vệ), biểu tượng ổ khóa đối với các ca đã duyệt khóa, nhãn cảnh báo ca chưa đủ người.
- **Trải nghiệm tương tác đổi ca mới (Shift Swap Interface)**:
  - **Tab Đổi Ca Trực**: Chia thành 2 tab con:
    1. *Yêu cầu gửi đến tôi*: Danh sách các lời mời đổi ca từ đồng nghiệp, hiển thị rõ ngày ca cũ, ngày ca mới muốn đổi, lý do, kèm 2 nút hành động trực tiếp: "Đồng Ý Đổi Ca" (màu xanh lá) và "Từ Chối" (màu xám).
    2. *Yêu cầu tôi đã gửi*: Trạng thái lời mời của tôi (Đang chờ đồng nghiệp xác nhận / Đã chấp thuận / Đã từ chối).
  - **Nút "Gửi Yêu Cầu Đổi Ca"**: Mở Modal tiện lợi, cho phép giáo viên chọn ca mình muốn nhường và chọn đồng nghiệp/ca muốn đổi sang, kèm lý do đổi. Hệ thống kiểm tra ngay xem ngày đổi có trùng lịch hoặc vi phạm quy tắc 24h không trước khi gửi.
- **Trải nghiệm phân quyền & Khóa lịch**:
  - Khi người dùng đăng nhập với vai trò Giáo viên / Bảo vệ: Các nút cấu hình nhạy cảm như "Xếp Lịch Tự Động", "Xóa Dữ Liệu", "Thêm Nhân Sự", "Điều Chỉnh Ca Của Người Khác" sẽ bị ẩn hoặc vô hiệu hóa kèm tooltip giải thích rõ ràng.
  - Ca trực có trạng thái `isLocked = true`: Hiển thị huy hiệu đã khóa, chỉ Admin mới có quyền mở khóa để điều chỉnh.
- **Màu sắc và phông chữ**:
  - Phông chữ: `Plus Jakarta Sans` cho nội dung chính, `JetBrains Mono` / `tabular-nums` cho ngày giờ, mã cán bộ, trạng thái ca.
  - Tỷ lệ màu 60-30-10: Nền Slate sáng `#F8FAFC` / Tối `#0F172A`, thẻ viền mảnh 1px, màu nhấn thương hiệu xanh navy đậm và xanh lá thành công.

---

### 3. Key Product Decisions & Trade-Offs

- **Lựa chọn Firebase SDK v11 Web thay thế hoàn toàn Supabase**:
  - *Phương án*: Sử dụng `firebase/app`, `firebase/auth`, `firebase/firestore`. Cấu hình tự động kết nối qua `firebase-applet-config.json` và hỗ trợ biến môi trường dự phòng (`VITE_FIREBASE_*`).
  - *Lý do*: Đáp ứng chính xác yêu cầu nâng cấp của người dùng, tận dụng cơ chế listener `onSnapshot` thời gian thực cực kỳ ổn định và hỗ trợ offline cache tự động của Firestore.
- **Bảo mật và Phân quyền qua Collection `user_profiles` & `admins`**:
  - *Phương án*: Lưu thông tin người dùng trong `users/{uid}` chứa `role: 'ADMIN' | 'BGH' | 'TEACHER' | 'GUARD'` và `email`. Tạo collection bảo mật `admins/{uid}` cho các tài khoản có quyền Admin tối cao.
  - *Lý do*: Firestore Security Rules có thể kiểm tra `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` với tốc độ cao, ngăn chặn 100% việc người dùng tự sửa role trên client để chiếm quyền Admin.
- **Đổi ca an toàn tuyệt đối với `runTransaction`**:
  - *Phương án*: Khi người được yêu cầu bấm "Đồng Ý", một Firestore transaction sẽ đọc đồng thời cả 2 document ca trực liên quan (`shifts/{shiftId1}` và `shifts/{shiftId2}`), xác minh tính hợp lệ (người gửi và người nhận vẫn đang giữ đúng vị trí trong 2 ca, ca chưa bị khóa), sau đó hoán đổi vị trí và cập nhật trạng thái yêu cầu sang `APPROVED` trong cùng một lượt ghi nguyên tử.
  - *Lý do*: Đảm bảo tính toán vẹn dữ liệu chuẩn ACID. Nếu một người khác đã thay đổi ca đó trong cùng khoảnh khắc, transaction sẽ rollback an toàn và báo lỗi thay vì ghi đè sai dữ liệu.
- **Cơ chế Fallback & Offline Resilience**:
  - Khi thiết bị mất mạng, Firestore tự động phục vụ dữ liệu từ bộ nhớ đệm (IndexedDB cache) và hiển thị chỉ báo "Ngoại Tuyến". Khi có mạng trở lại, hệ thống tự động đồng bộ lại mà không làm mất trạng thái của người dùng.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ỨNG DỤNG CLIENT (REACT)                                │
│                                                                                         │
│  ┌──────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────┐  │
│  │   Admin Dashboard    │  │  Giáo Viên / BGH / BV   │  │   Đổi Ca & Trực Bù View    │  │
│  │ (Quản lý, Xếp lịch)  │  │   (Xem lịch, Xin nghỉ)  │  │ (Xác nhận qua Transaction) │  │
│  └──────────┬───────────┘  └───────────┬─────────────┘  └────────────┬───────────────┘  │
│             │                          │                             │                  │
│  ┌──────────▼──────────────────────────▼─────────────────────────────▼───────────────┐  │
│  │                     FirebaseProvider & Firestore Realtime Hooks                   │  │
│  │              (onSnapshot listeners: shifts, employees, requests, history)         │  │
│  └─────────────────────────────────────┬─────────────────────────────────────────────┘  │
└────────────────────────────────────────┼────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  GOOGLE CLOUD FIREBASE                                  │
│                                                                                         │
│  ┌────────────────────────┐  ┌───────────────────────────────────────────────────────┐  │
│  │ Firebase Authentication│  │ Cloud Firestore (Enterprise Mode)                     │  │
│  │ - Google OAuth Sign-in │  │ - /users/{uid} (profile & role)                       │  │
│  │ - User session state   │  │ - /admins/{uid} (admin identity marker)               │  │
│  │ - Token verification   │  │ - /employees/{id} (danh sách cán bộ)                  │  │
│  └────────────────────────┘  │ - /shifts/{id} (ca trực 24h & trạng thái isLocked)     │  │
│                              │ - /shift_change_requests/{id} (yêu cầu đổi ca)        │  │
│  ┌────────────────────────┐  │ - /shift_change_history/{id} (lịch sử hoán đổi)       │  │
│  │ Firestore Security     │  │ - /unavailable_dates/{id} (đơn xin vắng/nghỉ)         │  │
│  │ Rules (ABAC)           │  │ - /compensatory_duties/{id} (nợ & bù ca)              │  │
│  │ - RBAC check           │  │ - /schedule_settings/config (cấu hình thuật toán)     │  │
│  │ - Atomic transactions  │  └───────────────────────────────────────────────────────┘  │
│  └────────────────────────┘                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### A. Data Model Collections & Entities (Blueprint)
1. `users/{userId}`: `email`, `name`, `avatarUrl`, `role` (`ADMIN` | `BGH` | `TEACHER` | `GUARD`), `employeeId`, `createdAt`, `updatedAt`.
2. `admins/{userId}`: `email`, `grantedAt`, `grantedBy`.
3. `employees/{employeeId}`: `code`, `name`, `role` (`TEACHER` | `ADMIN` | `GUARD`), `department`, `phone`, `email`, `isActive`, `notes`, `updatedAt`.
4. `shifts/{shiftId}`: `date` (`YYYY-MM-DD`), `dayOfWeek`, `startTime`, `endTime`, `teacher1Id`, `teacher2Id`, `adminId`, `guardId`, `status` (`COMPLETE` | `INCOMPLETE` | `CONFLICT`), `isLocked` (boolean), `notes`, `conflicts`, `updatedAt`, `updatedBy`.
5. `shift_change_requests/{requestId}`: `requesterId`, `targetEmployeeId`, `requesterShiftId`, `targetShiftId`, `requesterRolePosition`, `targetRolePosition`, `reason`, `status` (`PENDING` | `APPROVED` | `REJECTED` | `CANCELLED`), `createdAt`, `resolvedAt`.
6. `shift_change_history/{historyId}`: `shiftDate`, `rolePosition`, `previousEmployeeId`, `newEmployeeId`, `reason`, `changedBy`, `timestamp`.
7. `unavailable_dates/{id}`: `employeeId`, `date`, `reason`, `status` (`PENDING` | `APPROVED` | `REJECTED`), `createdAt`.
8. `compensatory_duties/{id}`: `debtorEmployeeId`, `creditorEmployeeId`, `originalShiftDate`, `reason`, `sourceType`, `status`, `createdAt`, `compensatedShiftDate`, `compensatedRolePosition`, `compensatedAt`, `notes`.
9. `schedule_settings/{id}`: Cấu hình quy tắc trực trường học (số lượng người mỗi ca, giờ bắt đầu/kết thúc, phân bổ đều, ràng buộc 24 giờ).

#### B. Cơ chế Đổi Ca Bằng Firestore Transaction (`runTransaction`)
```typescript
await runTransaction(db, async (transaction) => {
  const reqRef = doc(db, 'shift_change_requests', requestId);
  const reqSnap = await transaction.get(reqRef);
  if (!reqSnap.exists() || reqSnap.data().status !== 'PENDING') {
    throw new Error('Yêu cầu đổi ca không còn ở trạng thái chờ duyệt');
  }
  const shift1Ref = doc(db, 'shifts', reqSnap.data().requesterShiftId);
  const shift2Ref = doc(db, 'shifts', reqSnap.data().targetShiftId);
  const shift1Snap = await transaction.get(shift1Ref);
  const shift2Snap = await transaction.get(shift2Ref);
  
  if (shift1Snap.data().isLocked || shift2Snap.data().isLocked) {
    throw new Error('Một trong hai ca trực đã bị khóa bởi Ban Giám Hiệu');
  }
  
  // Hoán đổi nhân sự trong 2 ca trực
  transaction.update(shift1Ref, { [reqSnap.data().requesterRolePosition]: reqSnap.data().targetEmployeeId, updatedAt: new Date().toISOString() });
  transaction.update(shift2Ref, { [reqSnap.data().targetRolePosition]: reqSnap.data().requesterEmployeeId, updatedAt: new Date().toISOString() });
  transaction.update(reqRef, { status: 'APPROVED', resolvedAt: new Date().toISOString() });
  
  // Ghi lịch sử thay đổi ca
  const historyRef1 = doc(collection(db, 'shift_change_history'));
  const historyRef2 = doc(collection(db, 'shift_change_history'));
  transaction.set(historyRef1, { ...historyData1 });
  transaction.set(historyRef2, { ...historyData2 });
});
```

#### C. Thiết kế Firestore Security Rules Chặt Chẽ
- Tuân thủ 8 trụ cột bảo mật theo tiêu chuẩn Firebase:
  - `isSignedIn()` và `isAdmin()` được thẩm định qua collection `admins/$(request.auth.uid)`.
  - Mọi người dùng đã đăng nhập đều có quyền đọc (`allow read: if isSignedIn();`) đối với `employees`, `shifts`, `schedule_settings`, `unavailable_dates`.
  - Chỉ Admin mới có quyền ghi đè `employees`, `shifts` và `schedule_settings`.
  - Giáo viên có quyền tạo `shift_change_requests` và cập nhật đơn do mình liên quan (người gửi hoặc người nhận khi xác nhận qua transaction).
  - Không cho phép người dùng tự sửa đổi `role` hoặc gán quyền admin cho chính mình.

#### D. Bộ Kiểm Thử Xác Thực Trực Quan (Test Verification Suite)
Mở rộng giao diện kiểm thử `TestVerificationView.tsx` với 6 bài kiểm tra thực tế:
1. **Kiểm tra 2 tài khoản cùng mở lịch**: Hiển thị mô phỏng 2 phiên làm việc (Admin vs Giáo viên), xác minh cập nhật đồng bộ qua `onSnapshot`.
2. **Kiểm tra Đổi ca tức thì (Realtime Swap)**: Thực hiện đổi ca trên màn hình và xác nhận phía bên kia lập tức cập nhật trong chưa đầy 1 giây.
3. **Kiểm tra Phân quyền (Permission Defense)**: Thử nghiệm tài khoản Giáo viên cố tình ghi đè lịch trực hoặc thêm nhân sự trái phép, kiểm tra lỗi `PERMISSION_DENIED` từ Firestore Rules.
4. **Kiểm tra Transaction chống xung đột đồng thời**: Kích hoạt 2 yêu cầu hoán đổi cùng một ca trực trong cùng tích tắc, kiểm tra 1 bên thành công và bên kia nhận thông báo rollback an toàn.
5. **Kiểm tra Ca trực bị khóa (Locked Shift Protection)**: Cố gắng đổi người ở ca có `isLocked = true` và xác minh hệ thống từ chối.
6. **Kiểm tra Ngoại tuyến & Kết nối lại (Offline/Reconnect)**: Ngắt kết nối mạng mô phỏng, thực hiện đọc cache và phục hồi đồng bộ khi có kết nối trở lại.

---

### Kế hoạch Thực hiện Chi tiết

1. **Bước 1: Cấu hình và Kích hoạt Firebase**:
   - Sử dụng công cụ `show_aistudio_ui` với `ui_type: "firebase_setup"` và RPC `ProvisionFirebase` để thiết lập Firebase Firestore và Authentication.
   - Tạo `firebase-blueprint.json` đầy đủ thực thể và đường dẫn Firestore.
2. **Bước 2: Xây dựng Module Dịch Vụ Firebase Core**:
   - Viết `src/services/firebase.ts`: Khởi tạo Firebase App, Auth, Firestore với cấu hình chuẩn và error handler `handleFirestoreError`.
   - Viết `src/services/firebaseDb.ts`: Toàn bộ các hàm truy vấn, lắng nghe thời gian thực (`onSnapshot`), transaction đổi ca (`executeShiftSwapTransaction`), và seed dữ liệu ban đầu từ trường học sang Firestore nếu database trống.
3. **Bước 3: Nâng cấp Quản lý Trạng thái & Phân quyền trong `App.tsx`**:
   - Tích hợp Auth listener `onAuthStateChanged` theo dõi tài khoản Google và nạp hồ sơ người dùng từ `users/{uid}`.
   - Gắn `onSnapshot` cho toàn bộ danh sách: `employees`, `shifts`, `shift_change_requests`, `shift_change_history`, `unavailable_dates`, `compensatory_duties`.
   - Quản lý trạng thái kết nối mạng thời gian thực và hiển thị Toast thông báo khi có người khác sửa lịch.
4. **Bước 4: Nâng cấp Giao diện Đổi Ca Trực Đa Người Dùng**:
   - Nâng cấp Modal / View đổi ca: Giáo viên thấy các yêu cầu gửi đến mình và có nút "Đồng Ý" / "Từ Chối" xử lý qua transaction.
   - Thêm nút "Khóa / Mở khóa ca trực" dành riêng cho Ban Giám Hiệu và Admin.
5. **Bước 5: Tạo và Triển khai `firestore.rules`**:
   - Soạn thảo quy tắc bảo mật chuẩn ABAC theo 8 trụ cột bảo vệ dữ liệu.
   - Kiểm tra linting và triển khai qua RPC `DeployRules`.
6. **Bước 6: Nâng cấp Bộ Kiểm Thử & Kiểm Tra Build Hoàn Hảo**:
   - Nâng cấp `TestVerificationView.tsx` với 6 kịch bản kiểm thử trực quan.
   - Biên dịch `compile_applet` đảm bảo không có bất kỳ lỗi cú pháp hoặc runtime nào.
