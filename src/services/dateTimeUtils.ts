/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Các tiện ích đồng bộ hóa thời gian thực (Real-time Clock & Calendar Utilities)
 * Phục vụ trường nội trú: Chu kỳ trực 24h bắt đầu từ 07:00 sáng đến 07:00 sáng hôm sau
 */

export const DAY_NAMES_VN = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

/**
 * Định dạng ngày dạng DD/MM/YYYY
 */
export function formatDateVN(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Định dạng giờ dạng HH:mm:ss
 */
export function formatTimeVN(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Tên thứ bằng tiếng Việt
 */
export function formatDayOfWeekVN(date: Date): string {
  return DAY_NAMES_VN[date.getDay()];
}

/**
 * Định dạng chuỗi ngày giờ đầy đủ tiếng Việt: "Thứ Hai, 02/11/2026 · 07:15:30"
 */
export function formatFullDateTimeVN(date: Date): string {
  return `${formatDayOfWeekVN(date)}, ${formatDateVN(date)} · ${formatTimeVN(date)}`;
}

/**
 * Chuỗi ISO ngày YYYY-MM-DD
 */
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Chuỗi ISO tháng YYYY-MM
 */
export function formatIsoMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Phân tích chuỗi 'YYYY-MM-DD' thành đối tượng Date
 */
export function parseIsoDate(isoStr: string): Date {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Xác định ngày định danh của ca trực đang diễn ra theo mốc 07:00 sáng
 * Ca trực ngày D: Bắt đầu 07:00:00 ngày D đến 06:59:59 ngày D+1
 * - Nếu thời gian hiện tại < 07:00: Ca đang trực bắt đầu từ 07:00 ngày D-1 (hôm qua)
 * - Nếu thời gian hiện tại >= 07:00: Ca đang trực bắt đầu từ 07:00 ngày D (hôm nay)
 */
export function getDutyShiftDateForTimestamp(now: Date): string {
  const target = new Date(now.getTime());
  if (target.getHours() < 7) {
    target.setDate(target.getDate() - 1);
  }
  return formatIsoDate(target);
}

/**
 * Xác định khoảng thời gian bắt đầu và kết thúc của một ca trực 24h
 */
export function getShiftTimeBounds(shiftDateStr: string): { startTime: Date; endTime: Date } {
  const [y, m, d] = shiftDateStr.split('-').map(Number);
  const startTime = new Date(y, m - 1, d, 7, 0, 0, 0);
  const endTime = new Date(y, m - 1, d + 1, 7, 0, 0, 0);
  return { startTime, endTime };
}

export interface ShiftProgressInfo {
  percent: number;
  elapsedHours: number;
  elapsedMinutes: number;
  remainingHours: number;
  remainingMinutes: number;
  remainingSeconds: number;
  isOngoing: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  statusLabel: string;
}

/**
 * Tính toán tiến độ thời gian thực của ca trực so với mốc hiện tại
 */
export function getShiftProgress(shiftDateStr: string, now: Date): ShiftProgressInfo {
  const { startTime, endTime } = getShiftTimeBounds(shiftDateStr);
  const startMs = startTime.getTime();
  const endMs = endTime.getTime();
  const nowMs = now.getTime();
  const totalDurationMs = 24 * 60 * 60 * 1000;

  if (nowMs < startMs) {
    const diffMs = startMs - nowMs;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      percent: 0,
      elapsedHours: 0,
      elapsedMinutes: 0,
      remainingHours: hours,
      remainingMinutes: mins,
      remainingSeconds: Math.floor((diffMs % (1000 * 60)) / 1000),
      isOngoing: false,
      isUpcoming: true,
      isCompleted: false,
      statusLabel: `Sắp diễn ra (còn ${hours}h ${mins}m)`,
    };
  }

  if (nowMs >= endMs) {
    return {
      percent: 100,
      elapsedHours: 24,
      elapsedMinutes: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingSeconds: 0,
      isOngoing: false,
      isUpcoming: false,
      isCompleted: true,
      statusLabel: 'Đã hoàn thành',
    };
  }

  // Ca đang diễn ra
  const elapsedMs = nowMs - startMs;
  const remainingMs = endMs - nowMs;
  const percent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));

  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const elapsedMinutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const remainingSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  return {
    percent,
    elapsedHours,
    elapsedMinutes,
    remainingHours,
    remainingMinutes,
    remainingSeconds,
    isOngoing: true,
    isUpcoming: false,
    isCompleted: false,
    statusLabel: 'Đang trực',
  };
}

/**
 * Kiểm tra xem hiện tại có đang trong khung giờ bàn giao ca trực 07:00 sáng hay không
 * Khung giao ban chuẩn: 06:45:00 - 07:15:00 hàng ngày
 */
export function getHandoverStatus(now: Date): {
  isHandoverWindow: boolean;
  isApproaching: boolean;
  minutesToHandover: number;
  outgoingDutyDate: string;
  incomingDutyDate: string;
} {
  const h = now.getHours();
  const m = now.getMinutes();

  // Khung giờ giao ban chính thức 06:45 - 07:15
  const isHandoverWindow = (h === 6 && m >= 45) || (h === 7 && m <= 15);
  // Khung giờ sắp giao ban 06:00 - 06:44
  const isApproaching = h === 6 && m < 45;

  let minutesToHandover = 0;
  if (h < 7) {
    minutesToHandover = (6 - h) * 60 + (60 - m);
  } else {
    // Đã qua 07:00 hôm nay, tính đến 07:00 ngày mai
    minutesToHandover = (23 - h + 7) * 60 + (60 - m);
  }

  // Ca chuẩn bị bàn giao (ca cũ) và ca mới nhận nhiệm vụ
  const outgoingDutyDate = getDutyShiftDateForTimestamp(
    h < 7 ? now : new Date(now.getTime() - 24 * 60 * 60 * 1000)
  );
  const incomingDutyDate = formatIsoDate(
    h < 7 ? now : new Date(now.getTime() + (h >= 7 ? 0 : 24 * 60 * 60 * 1000))
  );

  return {
    isHandoverWindow,
    isApproaching,
    minutesToHandover,
    outgoingDutyDate,
    incomingDutyDate,
  };
}

/**
 * Khoảng ngày mặc định cho bộ lập lịch tự động:
 * Bắt đầu: Ngày hiện tại (theo thời gian thực)
 * Kết thúc: Ngày cuối cùng của tháng hiện tại
 */
export function getDefaultScheduleRange(now: Date): { startDate: string; endDate: string } {
  const startDate = formatIsoDate(now);
  const year = now.getFullYear();
  const month = now.getMonth();
  // Ngày cuối cùng của tháng: ngày 0 của tháng kế tiếp
  const lastDate = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

  return { startDate, endDate };
}

/**
 * Các thiết lập nhanh cho việc chọn khoảng thời gian xếp lịch
 */
export function getScheduleRangePresets(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth();

  const todayStr = formatIsoDate(now);
  const lastDayThisMonth = new Date(year, month + 1, 0).getDate();
  const endThisMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayThisMonth).padStart(2, '0')}`;

  // Trọn tháng này
  const startThisMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;

  // 30 ngày tiếp theo
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysLaterStr = formatIsoDate(thirtyDaysLater);

  // Trọn tháng kế tiếp
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonthNum = month === 11 ? 1 : month + 2;
  const lastDayNextMonth = new Date(nextMonthYear, nextMonthNum, 0).getDate();
  const startNextMonthStr = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-01`;
  const endNextMonthStr = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-${String(lastDayNextMonth).padStart(2, '0')}`;

  return [
    {
      id: 'today-to-end-of-month',
      label: 'Hôm nay đến hết tháng này',
      badge: 'Khuyên dùng',
      startDate: todayStr,
      endDate: endThisMonthStr,
    },
    {
      id: 'full-current-month',
      label: `Trọn vẹn tháng ${month + 1}/${year}`,
      badge: `${lastDayThisMonth} ngày`,
      startDate: startThisMonthStr,
      endDate: endThisMonthStr,
    },
    {
      id: 'next-30-days',
      label: '30 ngày tiếp theo',
      badge: '30 ngày',
      startDate: todayStr,
      endDate: thirtyDaysLaterStr,
    },
    {
      id: 'full-next-month',
      label: `Trọn vẹn tháng sau (${nextMonthNum}/${nextMonthYear})`,
      badge: `${lastDayNextMonth} ngày`,
      startDate: startNextMonthStr,
      endDate: endNextMonthStr,
    },
  ];
}
