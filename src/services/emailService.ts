import { ShiftAssignment, Employee, ScheduleSettings } from '../types';
import { getDayNameVN, parseDate } from './scheduler';

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

export function buildShiftEmailContent(
  shift: ShiftAssignment,
  recipient: Employee,
  employees: Employee[],
  settings: ScheduleSettings
): EmailPayload {
  const dObj = parseDate(shift.date);
  const dayName = getDayNameVN(shift.dayOfWeek);
  const formattedDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;

  const teacher1 = employees.find((e) => e.id === shift.teacher1Id);
  const teacher2 = employees.find((e) => e.id === shift.teacher2Id);
  const admin = employees.find((e) => e.id === shift.adminId);
  const guard = employees.find((e) => e.id === shift.guardId);

  const subject = `[THÔNG BÁO CA TRỰC NỘI TRÚ] - ${settings.schoolName} - Ngày ${formattedDate} (${dayName})`;

  const body = `Kính gửi: Thầy/Cô/Đồng chí ${recipient.name} (${recipient.department}),

Ban Giám hiệu ${settings.schoolName} trân trọng thông báo lịch phân công ca trực quản sinh nội trú của Thầy/Cô/Đồng chí như sau:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THÔNG TIN CA TRỰC QUẢN SINH (24 GIỜ)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Thời gian bắt đầu: ${shift.startTime} ngày ${formattedDate} (${dayName})
- Thời gian kết thúc: ${shift.endTime}
- Địa điểm: Văn phòng Quản sinh & Khu Ký túc xá học sinh nội trú

DANH SÁCH KÍP TRỰC (04 ĐỒNG CHÍ):
1. Ban Giám hiệu trực: ${admin ? `${admin.name} (SĐT: ${admin.phone})` : 'Chưa phân công'}
2. Giáo viên trực 1: ${teacher1 ? `${teacher1.name} (SĐT: ${teacher1.phone})` : 'Chưa phân công'}
3. Giáo viên trực 2: ${teacher2 ? `${teacher2.name} (SĐT: ${teacher2.phone})` : 'Chưa phân công'}
4. Nhân viên Bảo vệ: ${guard ? `${guard.name} (SĐT: ${guard.phone})` : 'Chưa phân công'}

NHIỆM VỤ TRỌNG TÂM TRONG CA TRỰC:
- 07:00: Nhận bàn giao sổ trực, chìa khóa và kiểm tra quân số từ ca trực trước.
- 11:30 - 13:30: Quản lý giờ ăn trưa và giờ nghỉ trưa tại KTX.
- 17:00 - 18:30: Quản lý giờ ăn tối và sinh hoạt ngoại khóa của học sinh.
- 19:00 - 21:00: Đôn đốc, giám sát học sinh tự học tại các phòng học nội trú.
- 21:30 - 22:00: Điểm danh quân số từng phòng, kiểm tra trật tự trước giờ tắt đèn giới nghiêm.
- 22:00 - 06:00: Phối hợp Bảo vệ tuần tra an ninh, xử lý phát sinh y tế hoặc sự cố đột xuất.
- 06:00 - 07:00: Báo thức, đôn đốc thể dục sáng, vệ sinh phòng ở và ghi nhật ký bàn giao ca.

LƯU Ý QUAN TRỌNG:
- Trong trường hợp phát sinh lý do đột xuất không thể tham gia ca trực, Thầy/Cô/Đồng chí vui lòng gửi yêu cầu đổi ca trên phần mềm quản lý hoặc báo cáo trực tiếp BGH trước ít nhất 24 giờ.
- Số điện thoại hỗ trợ khẩn cấp BGH: ${admin ? admin.phone : '0912.345.678'}.

Trân trọng,
BAN QUẢN LÝ NỘI TRÚ - ${settings.schoolName}`;

  return {
    to: recipient.email,
    subject,
    body,
  };
}

export function openGmailCompose(payload: EmailPayload) {
  const baseUrl = 'https://mail.google.com/mail/?view=cm&fs=1';
  const url = `${baseUrl}&to=${encodeURIComponent(payload.to)}&su=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.body)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openMailto(payload: EmailPayload) {
  const url = `mailto:${encodeURIComponent(payload.to)}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.body)}`;
  window.location.href = url;
}
