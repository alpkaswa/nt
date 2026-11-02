import { Employee, UnavailableDate, ShiftAssignment, ScheduleSettings, ValidationResult, CompensatoryDuty } from '../types';

/**
 * Định dạng thời gian chính xác đến từng giây, phút, giờ, ngày, tháng, năm
 * Ví dụ: "14:35:28 ngày 01/11/2026"
 */
export function formatFullTimestampVN(isoStr?: string | Date): string {
  if (!isoStr) return '';
  const d = typeof isoStr === 'string' ? new Date(isoStr) : isoStr;
  if (isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${minutes}:${seconds} ngày ${day}/${month}/${year}`;
}

/**
 * Tiện ích hỗ trợ ngày tháng
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getOffsetDate(dateStr: string, offsetDays: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + offsetDays);
  return formatDate(d);
}

export function getDayNameVN(dayIndex: number): string {
  const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return names[dayIndex] || '';
}

/**
 * Kiểm tra xem nhân sự có đăng ký bận đã được duyệt vào ngày cụ thể không
 */
export function isEmployeeUnavailable(
  employeeId: string,
  dateStr: string,
  unavailableDates: UnavailableDate[]
): boolean {
  return unavailableDates.some(
    (u) => u.employeeId === employeeId && u.date === dateStr && u.status === 'APPROVED'
  );
}

/**
 * Kiểm tra xem nhân sự có đang trực vào ngày cụ thể không
 */
export function isEmployeeOnDutyOnDate(
  employeeId: string,
  dateStr: string,
  shifts: ShiftAssignment[]
): boolean {
  const shift = shifts.find((s) => s.date === dateStr);
  if (!shift) return false;
  return (
    shift.teacher1Id === employeeId ||
    shift.teacher2Id === employeeId ||
    shift.adminId === employeeId ||
    shift.guardId === employeeId
  );
}

/**
 * Xác thực việc gán nhân sự vào ca trực thủ công
 */
export function validateManualAssignment(
  targetDate: string,
  roleField: 'teacher1' | 'teacher2' | 'admin' | 'guard',
  employeeId: string | null,
  allShifts: ShiftAssignment[],
  employees: Employee[],
  unavailableDates: UnavailableDate[],
  settings: ScheduleSettings
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!employeeId) {
    return { isValid: true, errors: [], warnings: ['Vị trí này hiện đang để trống.'] };
  }

  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) {
    return { isValid: false, errors: ['Không tìm thấy thông tin nhân sự trong hệ thống.'], warnings: [] };
  }

  if (!employee.isActive) {
    errors.push(`Nhân sự ${employee.name} hiện đang ở trạng thái tạm ngừng tham gia trực.`);
  }

  // 1. Kiểm tra vai trò phù hợp
  if (roleField === 'teacher1' || roleField === 'teacher2') {
    if (employee.role !== 'TEACHER') {
      errors.push(`Vị trí Giáo viên trực yêu cầu chức vụ là Giáo viên, ${employee.name} là ${employee.role}.`);
    }
  } else if (roleField === 'admin') {
    if (employee.role !== 'ADMIN') {
      errors.push(`Vị trí BGH yêu cầu chức vụ Ban Giám Hiệu, ${employee.name} là ${employee.role}.`);
    }
  } else if (roleField === 'guard') {
    if (employee.role !== 'GUARD') {
      errors.push(`Vị trí Bảo vệ yêu cầu nhân viên Bảo vệ, ${employee.name} là ${employee.role}.`);
    }
  }

  // 2. Kiểm tra trùng người trong cùng ca
  const currentShift = allShifts.find((s) => s.date === targetDate);
  if (currentShift) {
    if (roleField !== 'teacher1' && currentShift.teacher1Id === employeeId) {
      errors.push(`${employee.name} đã được phân công vị trí Giáo viên 1 trong ca này.`);
    }
    if (roleField !== 'teacher2' && currentShift.teacher2Id === employeeId) {
      errors.push(`${employee.name} đã được phân công vị trí Giáo viên 2 trong ca này.`);
    }
    if (roleField !== 'admin' && currentShift.adminId === employeeId) {
      errors.push(`${employee.name} đã được phân công vị trí Ban Giám Hiệu trong ca này.`);
    }
    if (roleField !== 'guard' && currentShift.guardId === employeeId) {
      errors.push(`${employee.name} đã được phân công vị trí Bảo vệ trong ca này.`);
    }
  }

  // 3. Kiểm tra ngày bận đã duyệt
  if (settings.respectApprovedUnavailabilities) {
    if (isEmployeeUnavailable(employeeId, targetDate, unavailableDates)) {
      errors.push(`${employee.name} đã đăng ký nghỉ phép/bận đã duyệt vào ngày ${targetDate}.`);
    }
  }

  // 4. Kiểm tra trực 2 ngày liên tiếp
  if (settings.disallowConsecutiveDays) {
    const prevDate = getOffsetDate(targetDate, -1);
    const nextDate = getOffsetDate(targetDate, 1);

    if (isEmployeeOnDutyOnDate(employeeId, prevDate, allShifts)) {
      errors.push(`Quy định nghỉ: ${employee.name} vừa trực ca ngày hôm trước (${prevDate}), không được trực 2 ngày liên tiếp.`);
    }
    if (isEmployeeOnDutyOnDate(employeeId, nextDate, allShifts)) {
      errors.push(`Quy định nghỉ: ${employee.name} đã có lịch trực ngày hôm sau (${nextDate}), không được trực 2 ngày liên tiếp.`);
    }
  }

  // 5. Cảnh báo cân bằng số ca
  const totalAssigned = allShifts.reduce((acc, s) => {
    let count = 0;
    if (s.teacher1Id === employeeId) count++;
    if (s.teacher2Id === employeeId) count++;
    if (s.adminId === employeeId) count++;
    if (s.guardId === employeeId) count++;
    return acc + count;
  }, 0);

  const peerEmployees = employees.filter((e) => e.role === employee.role && e.isActive);
  const avgShifts = allShifts.length > 0 ? (allShifts.length * (employee.role === 'TEACHER' ? 2 : 1)) / peerEmployees.length : 0;
  if (totalAssigned > avgShifts + 2) {
    warnings.push(`Cảnh báo cân bằng: ${employee.name} hiện đã có ${totalAssigned} ca trực (cao hơn trung bình ${avgShifts.toFixed(1)}).`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export interface AutoScheduleOptions {
  startDate: string;
  endDate: string;
  employees: Employee[];
  unavailableDates: UnavailableDate[];
  existingShifts: ShiftAssignment[];
  settings: ScheduleSettings;
  keepLockedShifts: boolean;
}

export interface AutoScheduleResult {
  shifts: ShiftAssignment[];
  conflicts: Array<{
    date: string;
    role: string;
    reason: string;
    candidatesAvailable: number;
    suggestedReplacements: Employee[];
  }>;
  totalDays: number;
  assignedCount: number;
  stats: Record<string, number>;
}

/**
 * Thuật toán xếp lịch tự động thông minh (Greedy Fair Distribution + Constraint Backtracking)
 */
export function generateAutoSchedule(options: AutoScheduleOptions): AutoScheduleResult {
  const {
    startDate,
    endDate,
    employees,
    unavailableDates,
    existingShifts,
    settings,
    keepLockedShifts,
  } = options;

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (start > end) {
    return {
      shifts: existingShifts,
      conflicts: [{
        date: startDate,
        role: 'Toàn bộ',
        reason: 'Ngày bắt đầu không được lớn hơn ngày kết thúc',
        candidatesAvailable: 0,
        suggestedReplacements: [],
      }],
      totalDays: 0,
      assignedCount: 0,
      stats: {},
    };
  }

  // Danh sách các ngày cần xếp lịch
  const dateList: string[] = [];
  const curr = new Date(start);
  while (curr <= end) {
    dateList.push(formatDate(curr));
    curr.setDate(curr.getDate() + 1);
  }

  // Khởi tạo bảng đếm số ca trực của từng nhân sự
  const shiftCountMap = new Map<string, number>();
  const lastAssignedDateMap = new Map<string, string>();
  employees.forEach((e) => shiftCountMap.set(e.id, 0));

  // Tách nhân sự theo chức vụ (chỉ lấy người đang active)
  const activeTeachers = employees.filter((e) => e.role === 'TEACHER' && e.isActive);
  const activeAdmins = employees.filter((e) => e.role === 'ADMIN' && e.isActive);
  const activeGuards = employees.filter((e) => e.role === 'GUARD' && e.isActive);

  // Tạo map các ca hiện có để giữ lại nếu bị khóa
  const existingMap = new Map<string, ShiftAssignment>();
  existingShifts.forEach((s) => existingMap.set(s.date, s));

  // Điểm danh các ca đã khóa trước để cập nhật số lượng ca đã giao
  if (keepLockedShifts) {
    for (const d of dateList) {
      const exist = existingMap.get(d);
      if (exist && exist.isLocked) {
        [exist.teacher1Id, exist.teacher2Id, exist.adminId, exist.guardId].forEach((empId) => {
          if (empId) {
            shiftCountMap.set(empId, (shiftCountMap.get(empId) || 0) + 1);
            lastAssignedDateMap.set(empId, d);
          }
        });
      }
    }
  }

  const generatedShifts: ShiftAssignment[] = [];
  const conflicts: AutoScheduleResult['conflicts'] = [];

  // Hàm chọn ứng viên tối ưu nhất cho một vị trí
  function pickBestCandidate(
    pool: Employee[],
    dateStr: string,
    alreadyAssignedToday: Set<string>,
    tempSchedule: ShiftAssignment[]
  ): { chosen: Employee | null; conflictReason?: string; suggestions: Employee[] } {
    const prevDate = getOffsetDate(dateStr, -1);
    const nextDate = getOffsetDate(dateStr, 1);

    // Lọc các ứng viên thỏa mãn điều kiện cứng
    const validCandidates: Employee[] = [];
    const suggestions: Employee[] = [];

    for (const candidate of pool) {
      // 1. Không trùng trong cùng ca
      if (alreadyAssignedToday.has(candidate.id)) {
        continue;
      }

      // 2. Không bận/nghỉ phép đã duyệt
      if (settings.respectApprovedUnavailabilities && isEmployeeUnavailable(candidate.id, dateStr, unavailableDates)) {
        continue;
      }

      // 3. Không trực 2 ngày liên tiếp (hôm qua hoặc hôm nay)
      let workedYesterday = false;
      if (settings.disallowConsecutiveDays) {
        // Kiểm tra ca hôm qua trong tempSchedule hoặc ca đã khóa
        workedYesterday = isEmployeeOnDutyOnDate(candidate.id, prevDate, tempSchedule);
        if (!workedYesterday) {
          const lockedYesterday = existingMap.get(prevDate);
          if (lockedYesterday && lockedYesterday.isLocked) {
            workedYesterday = isEmployeeOnDutyOnDate(candidate.id, prevDate, [lockedYesterday]);
          }
        }
      }

      let workedTomorrow = false;
      if (settings.disallowConsecutiveDays) {
        // Kiểm tra ca hôm sau (nếu đã có lịch khóa ngày mai)
        const lockedTomorrow = existingMap.get(nextDate);
        if (lockedTomorrow && lockedTomorrow.isLocked) {
          workedTomorrow = isEmployeeOnDutyOnDate(candidate.id, nextDate, [lockedTomorrow]);
        }
      }

      if (workedYesterday || workedTomorrow) {
        // Lưu vào gợi ý dự phòng (khi thiếu người)
        suggestions.push(candidate);
        continue;
      }

      validCandidates.push(candidate);
    }

    if (validCandidates.length === 0) {
      return {
        chosen: null,
        conflictReason: 'Tất cả nhân sự trong nhóm đều đang trực ngày kề bên hoặc có lịch bận đã duyệt.',
        suggestions,
      };
    }

    // Sắp xếp ưu tiên:
    // 1. Số ca trực đã giao ít nhất (Greedy fairness)
    // 2. Thời gian kể từ lần trực gần nhất xa nhất (giãn cách ngày trực)
    validCandidates.sort((a, b) => {
      const countA = shiftCountMap.get(a.id) || 0;
      const countB = shiftCountMap.get(b.id) || 0;
      if (countA !== countB) {
        return countA - countB;
      }

      // Nếu số ca bằng nhau, ưu tiên người có ngày trực gần nhất xa hơn
      const lastA = lastAssignedDateMap.get(a.id);
      const lastB = lastAssignedDateMap.get(b.id);
      if (!lastA) return -1;
      if (!lastB) return 1;
      return lastA.localeCompare(lastB);
    });

    const chosen = validCandidates[0];
    return { chosen, suggestions: validCandidates.slice(1) };
  }

  // Duyệt qua từng ngày để xếp lịch
  for (const dateStr of dateList) {
    const dObj = parseDate(dateStr);
    const dayOfWeek = dObj.getDay();

    // Nếu ca đã khóa và chọn giữ lại
    const existing = existingMap.get(dateStr);
    if (keepLockedShifts && existing && existing.isLocked) {
      generatedShifts.push(existing);
      continue;
    }

    const assignedToday = new Set<string>();
    let teacher1Id: string | null = null;
    let teacher2Id: string | null = null;
    let adminId: string | null = null;
    let guardId: string | null = null;
    const dayConflicts: string[] = [];

    // 1. Phân công BGH (1 người)
    const adminPick = pickBestCandidate(activeAdmins, dateStr, assignedToday, generatedShifts);
    if (adminPick.chosen) {
      adminId = adminPick.chosen.id;
      assignedToday.add(adminId);
      shiftCountMap.set(adminId, (shiftCountMap.get(adminId) || 0) + 1);
      lastAssignedDateMap.set(adminId, dateStr);
    } else {
      dayConflicts.push('Thiếu BGH trực ca');
      conflicts.push({
        date: dateStr,
        role: 'Ban Giám Hiệu',
        reason: adminPick.conflictReason || 'Không có BGH hợp lệ',
        candidatesAvailable: 0,
        suggestedReplacements: adminPick.suggestions,
      });
    }

    // 2. Phân công Bảo vệ (1 người)
    const guardPick = pickBestCandidate(activeGuards, dateStr, assignedToday, generatedShifts);
    if (guardPick.chosen) {
      guardId = guardPick.chosen.id;
      assignedToday.add(guardId);
      shiftCountMap.set(guardId, (shiftCountMap.get(guardId) || 0) + 1);
      lastAssignedDateMap.set(guardId, dateStr);
    } else {
      dayConflicts.push('Thiếu Bảo vệ trực ca');
      conflicts.push({
        date: dateStr,
        role: 'Bảo vệ',
        reason: guardPick.conflictReason || 'Không có Bảo vệ hợp lệ',
        candidatesAvailable: 0,
        suggestedReplacements: guardPick.suggestions,
      });
    }

    // 3. Phân công Giáo viên 1 (1 người)
    const t1Pick = pickBestCandidate(activeTeachers, dateStr, assignedToday, generatedShifts);
    if (t1Pick.chosen) {
      teacher1Id = t1Pick.chosen.id;
      assignedToday.add(teacher1Id);
      shiftCountMap.set(teacher1Id, (shiftCountMap.get(teacher1Id) || 0) + 1);
      lastAssignedDateMap.set(teacher1Id, dateStr);
    } else {
      dayConflicts.push('Thiếu Giáo viên 1');
      conflicts.push({
        date: dateStr,
        role: 'Giáo viên 1',
        reason: t1Pick.conflictReason || 'Không có Giáo viên hợp lệ',
        candidatesAvailable: 0,
        suggestedReplacements: t1Pick.suggestions,
      });
    }

    // 4. Phân công Giáo viên 2 (1 người)
    const t2Pick = pickBestCandidate(activeTeachers, dateStr, assignedToday, generatedShifts);
    if (t2Pick.chosen) {
      teacher2Id = t2Pick.chosen.id;
      assignedToday.add(teacher2Id);
      shiftCountMap.set(teacher2Id, (shiftCountMap.get(teacher2Id) || 0) + 1);
      lastAssignedDateMap.set(teacher2Id, dateStr);
    } else {
      dayConflicts.push('Thiếu Giáo viên 2');
      conflicts.push({
        date: dateStr,
        role: 'Giáo viên 2',
        reason: t2Pick.conflictReason || 'Không còn Giáo viên thứ 2 hợp lệ',
        candidatesAvailable: 0,
        suggestedReplacements: t2Pick.suggestions,
      });
    }

    const isComplete = teacher1Id && teacher2Id && adminId && guardId;

    const newShift: ShiftAssignment = {
      id: existing ? existing.id : `shift-${dateStr}`,
      date: dateStr,
      dayOfWeek,
      startTime: settings.shiftStartTime,
      endTime: settings.shiftEndTime,
      teacher1Id,
      teacher2Id,
      adminId,
      guardId,
      status: isComplete ? 'COMPLETE' : dayConflicts.length > 0 ? 'CONFLICT' : 'INCOMPLETE',
      isLocked: false,
      notes: dayConflicts.length > 0 ? dayConflicts.join('; ') : 'Phân công tự động thành công',
      conflicts: dayConflicts.length > 0 ? dayConflicts : undefined,
    };

    generatedShifts.push(newShift);
  }

  // Hợp nhất các ca bên ngoài khoảng ngày xếp nếu có
  const fullShifts: ShiftAssignment[] = [];
  const assignedDates = new Set(dateList);

  existingShifts.forEach((s) => {
    if (!assignedDates.has(s.date)) {
      fullShifts.push(s);
    }
  });

  fullShifts.push(...generatedShifts);
  fullShifts.sort((a, b) => a.date.localeCompare(b.date));

  const statsObj: Record<string, number> = {};
  shiftCountMap.forEach((v, k) => {
    statsObj[k] = v;
  });

  return {
    shifts: fullShifts,
    conflicts,
    totalDays: dateList.length,
    assignedCount: generatedShifts.filter((s) => s.status === 'COMPLETE').length,
    stats: statsObj,
  };
}

/**
 * Tính toán số liệu thống kê chi tiết cho từng nhân sự
 */
export function calculateStatistics(
  employees: Employee[],
  shifts: ShiftAssignment[],
  unavailableDates: UnavailableDate[],
  history: Array<{ previousEmployeeId: string; newEmployeeId: string }>,
  compensatoryDuties: CompensatoryDuty[] = []
) {
  return employees.map((emp) => {
    let totalShifts = 0;
    let weekdayShifts = 0;
    let weekendShifts = 0;

    shifts.forEach((s) => {
      const isOnDuty =
        s.teacher1Id === emp.id ||
        s.teacher2Id === emp.id ||
        s.adminId === emp.id ||
        s.guardId === emp.id;

      if (isOnDuty) {
        totalShifts++;
        if (s.dayOfWeek === 0 || s.dayOfWeek === 6) {
          weekendShifts++;
        } else {
          weekdayShifts++;
        }
      }
    });

    const approvedLeaves = unavailableDates.filter(
      (u) => u.employeeId === emp.id && u.status === 'APPROVED'
    ).length;

    const swapCount = history.filter(
      (h) => h.previousEmployeeId === emp.id || h.newEmployeeId === emp.id
    ).length;

    const compensatoryOwed = compensatoryDuties.filter(
      (c) => c.debtorEmployeeId === emp.id && c.status === 'PENDING'
    ).length;

    const compensatoryCompleted = compensatoryDuties.filter(
      (c) => c.debtorEmployeeId === emp.id && (c.status === 'COMPLETED' || c.status === 'SCHEDULED')
    ).length;

    const shiftsCoveredForOthers = compensatoryDuties.filter(
      (c) => c.creditorEmployeeId === emp.id
    ).length;

    return {
      employeeId: emp.id,
      name: emp.name,
      code: emp.code,
      role: emp.role,
      department: emp.department,
      phone: emp.phone,
      totalShifts,
      weekdayShifts,
      weekendShifts,
      approvedLeaves,
      swapCount,
      compensatoryOwed,
      compensatoryCompleted,
      shiftsCoveredForOthers,
    };
  });
}

export interface AutoSwapLeaveResult {
  updatedShifts: ShiftAssignment[];
  newHistoryRecord?: {
    shiftDate: string;
    rolePosition: 'teacher1' | 'teacher2' | 'admin' | 'guard';
    previousEmployeeId: string;
    newEmployeeId: string;
    reason: string;
    changedBy: string;
    timestamp: string;
  };
  newCompensatoryDuty?: CompensatoryDuty;
  details: {
    swapped: boolean;
    date: string;
    rolePosition?: 'teacher1' | 'teacher2' | 'admin' | 'guard';
    oldEmployee?: Employee;
    newEmployee?: Employee;
    message: string;
  };
}

/**
 * Tự động tìm nhân sự thay thế tối ưu nhất khi một đơn nghỉ phép được phê duyệt
 */
export function autoSwapShiftOnLeaveApproval(
  leave: UnavailableDate,
  shifts: ShiftAssignment[],
  employees: Employee[],
  unavailableDates: UnavailableDate[],
  settings: ScheduleSettings
): AutoSwapLeaveResult {
  const targetDate = leave.date;
  const targetEmpId = leave.employeeId;
  const oldEmployee = employees.find((e) => e.id === targetEmpId);

  // 1. Kiểm tra xem người này có đang được phân công trực vào ngày xin nghỉ không
  const targetShiftIndex = shifts.findIndex((s) => s.date === targetDate);
  if (targetShiftIndex === -1) {
    return {
      updatedShifts: shifts,
      details: {
        swapped: false,
        date: targetDate,
        oldEmployee,
        message: `Không tìm thấy ca trực ngày ${targetDate} trong hệ thống.`,
      },
    };
  }

  const shift = shifts[targetShiftIndex];
  let position: 'teacher1' | 'teacher2' | 'admin' | 'guard' | null = null;

  if (shift.teacher1Id === targetEmpId) position = 'teacher1';
  else if (shift.teacher2Id === targetEmpId) position = 'teacher2';
  else if (shift.adminId === targetEmpId) position = 'admin';
  else if (shift.guardId === targetEmpId) position = 'guard';

  if (!position) {
    return {
      updatedShifts: shifts,
      details: {
        swapped: false,
        date: targetDate,
        oldEmployee,
        message: `Nhân sự ${oldEmployee?.name} không có lịch trực vào ngày ${targetDate}.`,
      },
    };
  }

  // 2. Xác định vai trò cần thay thế
  const requiredRole: Employee['role'] =
    position === 'admin' ? 'ADMIN' : position === 'guard' ? 'GUARD' : 'TEACHER';

  // 3. Chuẩn bị danh sách ngày bận bao gồm đơn này với trạng thái APPROVED
  const effectiveLeaves = unavailableDates.map((u) =>
    u.id === leave.id ? { ...u, status: 'APPROVED' as const } : u
  );
  if (!effectiveLeaves.some((u) => u.id === leave.id)) {
    effectiveLeaves.push({ ...leave, status: 'APPROVED' as const });
  }

  // Tạo shift tạm thời với vị trí này để trống
  const tempShifts = shifts.map((s) => {
    if (s.date === targetDate) {
      const copy = { ...s };
      if (position === 'teacher1') copy.teacher1Id = null;
      if (position === 'teacher2') copy.teacher2Id = null;
      if (position === 'admin') copy.adminId = null;
      if (position === 'guard') copy.guardId = null;
      return copy;
    }
    return s;
  });

  // 4. Lọc các ứng viên tiềm năng có cùng vai trò
  const candidatePool = employees.filter(
    (e) => e.role === requiredRole && e.isActive && e.id !== targetEmpId
  );

  // 5. Kiểm tra ứng viên nào thỏa mãn 100% quy tắc phân công
  const validCandidates: Employee[] = [];
  for (const candidate of candidatePool) {
    const val = validateManualAssignment(
      targetDate,
      position,
      candidate.id,
      tempShifts,
      employees,
      effectiveLeaves,
      settings
    );

    if (val.isValid) {
      validCandidates.push(candidate);
    }
  }

  // 6. Nếu tìm thấy ứng viên hợp lệ, sắp xếp theo độ công bằng (ít ca nhất)
  if (validCandidates.length > 0) {
    // Đếm số ca của từng ứng viên
    const countMap = new Map<string, number>();
    validCandidates.forEach((c) => {
      let count = 0;
      shifts.forEach((s) => {
        if (s.teacher1Id === c.id) count++;
        if (s.teacher2Id === c.id) count++;
        if (s.adminId === c.id) count++;
        if (s.guardId === c.id) count++;
      });
      countMap.set(c.id, count);
    });

    validCandidates.sort((a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0));
    const chosen = validCandidates[0];

    // Cập nhật ca trực
    const updatedShift: ShiftAssignment = {
      ...shift,
      [position === 'teacher1'
        ? 'teacher1Id'
        : position === 'teacher2'
        ? 'teacher2Id'
        : position === 'admin'
        ? 'adminId'
        : 'guardId']: chosen.id,
    };

    const isComplete =
      updatedShift.teacher1Id &&
      updatedShift.teacher2Id &&
      updatedShift.adminId &&
      updatedShift.guardId;

    updatedShift.status = isComplete ? 'COMPLETE' : 'INCOMPLETE';

    const updatedShifts = [...shifts];
    updatedShifts[targetShiftIndex] = updatedShift;

    const nowIso = new Date().toISOString();
    const newHistoryRecord = {
      shiftDate: targetDate,
      rolePosition: position,
      previousEmployeeId: targetEmpId,
      newEmployeeId: chosen.id,
      reason: `Tự động thay ca do ${oldEmployee?.name} được duyệt nghỉ phép (${leave.reason})`,
      changedBy: 'Hệ thống tự động (Duyệt lịch bận)',
      timestamp: nowIso,
    };

    // Ghi nhận nghĩa vụ trực bù chính xác đến từng giây
    const newCompensatoryDuty: CompensatoryDuty = {
      id: `comp-${Date.now()}`,
      debtorEmployeeId: targetEmpId,
      creditorEmployeeId: chosen.id,
      originalShiftDate: targetDate,
      reason: `Nghỉ phép ca ngày ${targetDate} (${leave.reason}) - Được ${chosen.name} (${chosen.code}) trực thay`,
      sourceType: 'LEAVE_APPROVAL',
      status: 'PENDING',
      createdAt: nowIso,
    };

    return {
      updatedShifts,
      newHistoryRecord,
      newCompensatoryDuty,
      details: {
        swapped: true,
        date: targetDate,
        rolePosition: position,
        oldEmployee,
        newEmployee: chosen,
        message: `Đã tự động thay thế ${oldEmployee?.name} bằng ${chosen.name} (${chosen.code}) vào ca ngày ${targetDate} lúc ${formatFullTimestampVN(nowIso)}. Đã ghi nhận nghĩa vụ trực bù cho ${oldEmployee?.name}.`,
      },
    };
  }

  // 7. Nếu không có ai hợp lệ, chuyển vị trí đó thành null và cảnh báo thiếu người
  const updatedShift: ShiftAssignment = {
    ...shift,
    [position === 'teacher1'
      ? 'teacher1Id'
      : position === 'teacher2'
      ? 'teacher2Id'
      : position === 'admin'
      ? 'adminId'
      : 'guardId']: null,
    status: 'INCOMPLETE',
    notes: `Khuyết ${position} do ${oldEmployee?.name} nghỉ phép và không có nhân sự thay thế hợp lệ.`,
  };

  const updatedShifts = [...shifts];
  updatedShifts[targetShiftIndex] = updatedShift;

  return {
    updatedShifts,
    details: {
      swapped: false,
      date: targetDate,
      rolePosition: position,
      oldEmployee,
      message: `Đã duyệt nghỉ phép cho ${oldEmployee?.name}. Tuy nhiên không có nhân sự nào đủ điều kiện thay thế tự động (do vướng quy định nghỉ 24h hoặc trùng lịch bận). Ca ngày ${targetDate} đã được để trống để BGH điều phối thủ công.`,
    },
  };
}

/**
 * Tự động tìm ca khuyết hoặc ca trống phù hợp trong tháng để bố trí trực bù
 */
export function autoScheduleCompensatoryDuty(
  duty: CompensatoryDuty,
  shifts: ShiftAssignment[],
  employees: Employee[],
  unavailableDates: UnavailableDate[],
  settings: ScheduleSettings
): {
  updatedShifts: ShiftAssignment[];
  updatedDuty: CompensatoryDuty;
  success: boolean;
  message: string;
} {
  const debtor = employees.find((e) => e.id === duty.debtorEmployeeId);
  if (!debtor || !debtor.isActive) {
    return {
      updatedShifts: shifts,
      updatedDuty: duty,
      success: false,
      message: 'Nhân sự nợ ca trực bù không khả dụng hoặc đã tạm ngừng tham gia trực.',
    };
  }

  const role = debtor.role;

  // 1. Tìm các ca chưa đủ người (INCOMPLETE hoặc CONFLICT) diễn ra sau ngày gốc
  const candidateShifts = shifts.filter((s) => s.date > duty.originalShiftDate && !s.isLocked);

  for (const shift of candidateShifts) {
    let targetPos: 'teacher1' | 'teacher2' | 'admin' | 'guard' | null = null;
    if (role === 'TEACHER') {
      if (!shift.teacher1Id) targetPos = 'teacher1';
      else if (!shift.teacher2Id) targetPos = 'teacher2';
    } else if (role === 'ADMIN' && !shift.adminId) {
      targetPos = 'admin';
    } else if (role === 'GUARD' && !shift.guardId) {
      targetPos = 'guard';
    }

    if (!targetPos) continue;

    // Kiểm tra tính hợp lệ: không trực 2 ngày liên tiếp, không trùng ngày bận
    const val = validateManualAssignment(
      shift.date,
      targetPos,
      debtor.id,
      shifts,
      employees,
      unavailableDates,
      settings
    );

    if (val.isValid) {
      const updatedShift: ShiftAssignment = {
        ...shift,
        [targetPos]: debtor.id,
      };
      const isComplete =
        updatedShift.teacher1Id &&
        updatedShift.teacher2Id &&
        updatedShift.adminId &&
        updatedShift.guardId;
      updatedShift.status = isComplete ? 'COMPLETE' : 'INCOMPLETE';

      const updatedShifts = shifts.map((s) => (s.id === shift.id ? updatedShift : s));
      const nowIso = new Date().toISOString();

      const updatedDuty: CompensatoryDuty = {
        ...duty,
        status: 'SCHEDULED',
        compensatedShiftDate: shift.date,
        compensatedRolePosition: targetPos,
        compensatedAt: nowIso,
        notes: `Đã tự động bố trí trực bù vào ca ngày ${shift.date} (${targetPos}) ghi nhận lúc ${formatFullTimestampVN(nowIso)}`,
      };

      return {
        updatedShifts,
        updatedDuty,
        success: true,
        message: `Đã phân công trực bù thành công cho ${debtor.name} (${debtor.code}) vào ca ngày ${shift.date} ghi nhận lúc ${formatFullTimestampVN(nowIso)}.`,
      };
    }
  }

  return {
    updatedShifts: shifts,
    updatedDuty: duty,
    success: false,
    message: `Không tìm thấy ca trực trống phù hợp thỏa mãn quy định nghỉ 24h để xếp bù cho ${debtor.name}. Vui lòng tạo thêm ca hoặc điều chỉnh thủ công.`,
  };
}

/**
 * Tự động gán nhân sự mới vào các ca trực còn trống phù hợp với chức vụ
 * Giúp nhân sự vừa thêm xuất hiện ngay lập tức trên bảng lịch trực
 */
export function autoAssignNewEmployeeToShifts(
  employee: Employee,
  currentShifts: ShiftAssignment[],
  unavailableDates: UnavailableDate[],
  settings: ScheduleSettings,
  fromDate?: string
): {
  updatedShifts: ShiftAssignment[];
  assignedCount: number;
  assignedDates: string[];
} {
  if (!employee.isActive) {
    return { updatedShifts: currentShifts, assignedCount: 0, assignedDates: [] };
  }

  const todayStr = fromDate || new Date().toISOString().split('T')[0];
  let updatedShifts = [...currentShifts];
  const assignedDates: string[] = [];
  let assignedCount = 0;

  // Sắp xếp ca trực theo ngày tăng dần từ ngày hiện tại
  const targetShifts = updatedShifts
    .filter((s) => s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const shift of targetShifts) {
    // Không gán vào ca đã bị khóa
    if (shift.isLocked) continue;

    // Xác định các vị trí còn trống tương ứng với vai trò của nhân sự
    let candidatePositions: ('teacher1' | 'teacher2' | 'admin' | 'guard')[] = [];

    if (employee.role === 'TEACHER') {
      if (!shift.teacher1Id) candidatePositions.push('teacher1');
      if (!shift.teacher2Id && shift.teacher1Id !== employee.id) candidatePositions.push('teacher2');
    } else if (employee.role === 'ADMIN') {
      if (!shift.adminId) candidatePositions.push('admin');
    } else if (employee.role === 'GUARD') {
      if (!shift.guardId) candidatePositions.push('guard');
    }

    if (candidatePositions.length === 0) continue;

    for (const pos of candidatePositions) {
      // Xác thực điều kiện
      const val = validateManualAssignment(
        shift.date,
        pos,
        employee.id,
        updatedShifts,
        [employee],
        unavailableDates,
        settings
      );

      if (val.isValid) {
        // Thực hiện gán
        const targetIndex = updatedShifts.findIndex((s) => s.id === shift.id);
        if (targetIndex !== -1) {
          const shiftToUpdate = { ...updatedShifts[targetIndex] };
          if (pos === 'teacher1') shiftToUpdate.teacher1Id = employee.id;
          else if (pos === 'teacher2') shiftToUpdate.teacher2Id = employee.id;
          else if (pos === 'admin') shiftToUpdate.adminId = employee.id;
          else if (pos === 'guard') shiftToUpdate.guardId = employee.id;

          const isComplete = Boolean(
            shiftToUpdate.teacher1Id &&
              shiftToUpdate.teacher2Id &&
              shiftToUpdate.adminId &&
              shiftToUpdate.guardId
          );
          shiftToUpdate.status = isComplete ? 'COMPLETE' : 'INCOMPLETE';

          updatedShifts[targetIndex] = shiftToUpdate;
          assignedCount++;
          if (!assignedDates.includes(shift.date)) {
            assignedDates.push(shift.date);
          }
        }
        break; // Mỗi ca chỉ gán nhân sự này 1 lần
      }
    }
  }

  return { updatedShifts, assignedCount, assignedDates };
}

/**
 * Tự động quét và điền toàn bộ các vị trí còn trống trong bảng lịch trực
 * bằng danh sách nhân sự hiện có theo nguyên tắc công bằng
 */
export function autoFillAllEmptyShifts(
  employees: Employee[],
  currentShifts: ShiftAssignment[],
  unavailableDates: UnavailableDate[],
  settings: ScheduleSettings,
  fromDate?: string
): {
  updatedShifts: ShiftAssignment[];
  filledCount: number;
} {
  const todayStr = fromDate || new Date().toISOString().split('T')[0];
  let updatedShifts = [...currentShifts];
  let filledCount = 0;

  const activeTeachers = employees.filter((e) => e.role === 'TEACHER' && e.isActive);
  const activeAdmins = employees.filter((e) => e.role === 'ADMIN' && e.isActive);
  const activeGuards = employees.filter((e) => e.role === 'GUARD' && e.isActive);

  // Hàm đếm số ca hiện tại của 1 nhân viên trong updatedShifts
  const countDuty = (empId: string) => {
    return updatedShifts.filter(
      (s) =>
        s.teacher1Id === empId ||
        s.teacher2Id === empId ||
        s.adminId === empId ||
        s.guardId === empId
    ).length;
  };

  for (let i = 0; i < updatedShifts.length; i++) {
    const shift = updatedShifts[i];
    if (shift.date < todayStr || shift.isLocked) continue;

    const modified = { ...shift };
    let hasChanged = false;

    // Vị trí Giáo viên 1
    if (!modified.teacher1Id && activeTeachers.length > 0) {
      const sorted = [...activeTeachers].sort((a, b) => countDuty(a.id) - countDuty(b.id));
      for (const t of sorted) {
        if (t.id === modified.teacher2Id) continue;
        const val = validateManualAssignment(
          shift.date,
          'teacher1',
          t.id,
          updatedShifts,
          employees,
          unavailableDates,
          settings
        );
        if (val.isValid) {
          modified.teacher1Id = t.id;
          hasChanged = true;
          filledCount++;
          break;
        }
      }
    }

    // Vị trí Giáo viên 2
    if (!modified.teacher2Id && activeTeachers.length > 0) {
      const sorted = [...activeTeachers].sort((a, b) => countDuty(a.id) - countDuty(b.id));
      for (const t of sorted) {
        if (t.id === modified.teacher1Id) continue;
        const val = validateManualAssignment(
          shift.date,
          'teacher2',
          t.id,
          updatedShifts,
          employees,
          unavailableDates,
          settings
        );
        if (val.isValid) {
          modified.teacher2Id = t.id;
          hasChanged = true;
          filledCount++;
          break;
        }
      }
    }

    // Vị trí Ban Giám Hiệu
    if (!modified.adminId && activeAdmins.length > 0) {
      const sorted = [...activeAdmins].sort((a, b) => countDuty(a.id) - countDuty(b.id));
      for (const a of sorted) {
        const val = validateManualAssignment(
          shift.date,
          'admin',
          a.id,
          updatedShifts,
          employees,
          unavailableDates,
          settings
        );
        if (val.isValid) {
          modified.adminId = a.id;
          hasChanged = true;
          filledCount++;
          break;
        }
      }
    }

    // Vị trí Bảo vệ
    if (!modified.guardId && activeGuards.length > 0) {
      const sorted = [...activeGuards].sort((a, b) => countDuty(a.id) - countDuty(b.id));
      for (const g of sorted) {
        const val = validateManualAssignment(
          shift.date,
          'guard',
          g.id,
          updatedShifts,
          employees,
          unavailableDates,
          settings
        );
        if (val.isValid) {
          modified.guardId = g.id;
          hasChanged = true;
          filledCount++;
          break;
        }
      }
    }

    if (hasChanged) {
      const isComplete = Boolean(
        modified.teacher1Id && modified.teacher2Id && modified.adminId && modified.guardId
      );
      modified.status = isComplete ? 'COMPLETE' : 'INCOMPLETE';
      updatedShifts[i] = modified;
    }
  }

  return { updatedShifts, filledCount };
}

export interface SyncNewEmployeeOptions {
  targetEmployeeIds: string[];
  employees: Employee[];
  currentShifts: ShiftAssignment[];
  unavailableDates: UnavailableDate[];
  settings: ScheduleSettings;
  fromDate?: string;
  strategy: 'REBALANCE_FAIR' | 'FILL_EMPTY' | 'RESCHEDULE_FUTURE';
  maxShiftsPerEmployee?: number;
}

export interface SyncAssignmentDetail {
  date: string;
  dayOfWeek: number;
  rolePosition: 'teacher1' | 'teacher2' | 'admin' | 'guard';
  roleName: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  replacedEmployeeId?: string;
  replacedEmployeeName?: string;
  type: 'FILL_EMPTY' | 'REBALANCE' | 'RESCHEDULE';
}

export interface SyncNewEmployeeResult {
  updatedShifts: ShiftAssignment[];
  totalAssigned: number;
  details: SyncAssignmentDetail[];
  historyRecords: Array<{
    shiftDate: string;
    rolePosition: 'teacher1' | 'teacher2' | 'admin' | 'guard';
    previousEmployeeId: string;
    newEmployeeId: string;
    reason: string;
    changedBy: string;
    timestamp: string;
  }>;
  workloadBefore: Record<string, number>;
  workloadAfter: Record<string, number>;
  summary: string;
}

/**
 * Thuật toán Đồng Bộ Lịch Trực Khi Có Nhân Sự Mới
 * Hỗ trợ 3 chiến lược:
 * 1. REBALANCE_FAIR (Khuyến nghị): Cân bằng tải, san sẻ bớt ca từ cán bộ đang trực nhiều sang cán bộ mới.
 * 2. FILL_EMPTY: Chỉ lấp đầy các ca trực còn khuyết/trống.
 * 3. RESCHEDULE_FUTURE: Tái sắp xếp toàn diện lịch tương lai từ ngày chỉ định có tính đến nhân sự mới.
 */
export function syncScheduleForNewEmployees(options: SyncNewEmployeeOptions): SyncNewEmployeeResult {
  const {
    targetEmployeeIds,
    employees,
    currentShifts,
    unavailableDates,
    settings,
    fromDate,
    strategy,
    maxShiftsPerEmployee,
  } = options;

  const todayStr = fromDate || new Date().toISOString().split('T')[0];
  const empMap = new Map<string, Employee>();
  employees.forEach((e) => empMap.set(e.id, e));

  const targetEmps = targetEmployeeIds
    .map((id) => empMap.get(id))
    .filter((e): e is Employee => Boolean(e && e.isActive));

  const countAllDuties = (shiftsList: ShiftAssignment[]) => {
    const map: Record<string, number> = {};
    employees.forEach((e) => {
      map[e.id] = 0;
    });
    shiftsList.forEach((s) => {
      if (s.teacher1Id) map[s.teacher1Id] = (map[s.teacher1Id] || 0) + 1;
      if (s.teacher2Id) map[s.teacher2Id] = (map[s.teacher2Id] || 0) + 1;
      if (s.adminId) map[s.adminId] = (map[s.adminId] || 0) + 1;
      if (s.guardId) map[s.guardId] = (map[s.guardId] || 0) + 1;
    });
    return map;
  };

  const workloadBefore = countAllDuties(currentShifts);
  let updatedShifts = currentShifts.map((s) => ({ ...s }));
  const details: SyncAssignmentDetail[] = [];
  const historyRecords: SyncNewEmployeeResult['historyRecords'] = [];
  const nowIso = new Date().toISOString();

  const getRoleLabel = (pos: 'teacher1' | 'teacher2' | 'admin' | 'guard') => {
    if (pos === 'admin') return 'Ban Giám Hiệu';
    if (pos === 'guard') return 'Bảo vệ';
    return 'Giáo viên trực';
  };

  if (targetEmps.length === 0) {
    return {
      updatedShifts: currentShifts,
      totalAssigned: 0,
      details: [],
      historyRecords: [],
      workloadBefore,
      workloadAfter: workloadBefore,
      summary: 'Không có nhân sự mới nào được chọn hoặc nhân sự đã bị ngừng kích hoạt.',
    };
  }

  // --- CHIẾN LƯỢC 3: RESCHEDULE_FUTURE (Xếp lại toàn bộ tương lai) ---
  if (strategy === 'RESCHEDULE_FUTURE') {
    // Tìm ngày kết thúc của lịch hiện có
    const sortedDates = updatedShifts.map((s) => s.date).sort();
    const endDate = sortedDates[sortedDates.length - 1] || todayStr;

    // Lọc các ca trước ngày todayStr hoặc các ca đã khóa
    const pastShifts = updatedShifts.filter((s) => s.date < todayStr);

    const autoRes = generateAutoSchedule({
      startDate: todayStr,
      endDate: endDate,
      employees,
      unavailableDates,
      existingShifts: updatedShifts,
      settings,
      keepLockedShifts: true,
    });

    const combinedShifts = [...pastShifts, ...autoRes.shifts].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Ghi nhận các ca được gán cho nhân sự mới
    combinedShifts.forEach((s) => {
      if (s.date >= todayStr && !s.isLocked) {
        const orig = currentShifts.find((old) => old.date === s.date);
        (['teacher1', 'teacher2', 'admin', 'guard'] as const).forEach((pos) => {
          const field = `${pos}Id` as keyof ShiftAssignment;
          const newId = s[field] as string | null;
          const oldId = orig ? (orig[field] as string | null) : null;

          if (newId && targetEmployeeIds.includes(newId) && newId !== oldId) {
            const emp = empMap.get(newId)!;
            const replaced = oldId ? empMap.get(oldId) : undefined;
            details.push({
              date: s.date,
              dayOfWeek: s.dayOfWeek,
              rolePosition: pos,
              roleName: getRoleLabel(pos),
              employeeId: emp.id,
              employeeName: emp.name,
              employeeCode: emp.code,
              replacedEmployeeId: replaced?.id,
              replacedEmployeeName: replaced?.name,
              type: 'RESCHEDULE',
            });

            if (oldId && oldId !== newId) {
              historyRecords.push({
                shiftDate: s.date,
                rolePosition: pos,
                previousEmployeeId: oldId,
                newEmployeeId: newId,
                reason: `Đồng bộ tái sắp xếp lịch trực tương lai cho nhân sự mới ${emp.name} (${emp.code})`,
                changedBy: 'Hệ thống tự động đồng bộ',
                timestamp: nowIso,
              });
            }
          }
        });
      }
    });

    const workloadAfter = countAllDuties(combinedShifts);
    return {
      updatedShifts: combinedShifts,
      totalAssigned: details.length,
      details,
      historyRecords,
      workloadBefore,
      workloadAfter,
      summary: `Đã tái sắp xếp lịch trực từ ngày ${todayStr} đến ${endDate}. Phân bổ thành công ${details.length} ca trực cho nhân sự mới.`,
    };
  }

  // --- BƯỚC 1: LẤP ĐẦY CÁC CA TRỐNG TRƯỚC (Cho cả REBALANCE_FAIR & FILL_EMPTY) ---
  for (const emp of targetEmps) {
    const futureShifts = updatedShifts
      .filter((s) => s.date >= todayStr && !s.isLocked)
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const shift of futureShifts) {
      let candidatePositions: ('teacher1' | 'teacher2' | 'admin' | 'guard')[] = [];
      if (emp.role === 'TEACHER') {
        if (!shift.teacher1Id) candidatePositions.push('teacher1');
        if (!shift.teacher2Id && shift.teacher1Id !== emp.id) candidatePositions.push('teacher2');
      } else if (emp.role === 'ADMIN') {
        if (!shift.adminId) candidatePositions.push('admin');
      } else if (emp.role === 'GUARD') {
        if (!shift.guardId) candidatePositions.push('guard');
      }

      if (candidatePositions.length === 0) continue;

      for (const pos of candidatePositions) {
        const val = validateManualAssignment(
          shift.date,
          pos,
          emp.id,
          updatedShifts,
          [emp],
          unavailableDates,
          settings
        );

        if (val.isValid) {
          const sIdx = updatedShifts.findIndex((s) => s.id === shift.id);
          if (sIdx !== -1) {
            const shiftToUp = { ...updatedShifts[sIdx] };
            if (pos === 'teacher1') shiftToUp.teacher1Id = emp.id;
            else if (pos === 'teacher2') shiftToUp.teacher2Id = emp.id;
            else if (pos === 'admin') shiftToUp.adminId = emp.id;
            else if (pos === 'guard') shiftToUp.guardId = emp.id;

            const isComplete = Boolean(
              shiftToUp.teacher1Id && shiftToUp.teacher2Id && shiftToUp.adminId && shiftToUp.guardId
            );
            shiftToUp.status = isComplete ? 'COMPLETE' : 'INCOMPLETE';
            updatedShifts[sIdx] = shiftToUp;

            details.push({
              date: shift.date,
              dayOfWeek: shift.dayOfWeek,
              rolePosition: pos,
              roleName: getRoleLabel(pos),
              employeeId: emp.id,
              employeeName: emp.name,
              employeeCode: emp.code,
              type: 'FILL_EMPTY',
            });

            historyRecords.push({
              shiftDate: shift.date,
              rolePosition: pos,
              previousEmployeeId: '',
              newEmployeeId: emp.id,
              reason: `Đồng bộ phân công nhân sự mới ${emp.name} (${emp.code}) vào vị trí ca trực còn khuyết`,
              changedBy: 'Hệ thống tự động đồng bộ',
              timestamp: nowIso,
            });
          }
          break; // Đã gán vào ca này, chuyển sang ca tiếp theo
        }
      }
    }
  }

  // --- BƯỚC 2: TÁI CÂN BẰNG TẢI (CHỈ ÁP DỤNG CHO CHIẾN LƯỢC REBALANCE_FAIR) ---
  if (strategy === 'REBALANCE_FAIR') {
    for (const emp of targetEmps) {
      // Đếm số ca hiện tại của nhân viên trong updatedShifts
      const getEmpCount = (empId: string) =>
        updatedShifts.filter(
          (s) =>
            s.teacher1Id === empId ||
            s.teacher2Id === empId ||
            s.adminId === empId ||
            s.guardId === empId
        ).length;

      // Tính tổng số ca cần phân bổ của chức vụ này trong tháng
      const peers = employees.filter((e) => e.role === emp.role && e.isActive);
      const totalRoleDutySlots = updatedShifts.reduce((acc, s) => {
        let cnt = 0;
        if (emp.role === 'TEACHER') {
          if (s.teacher1Id) cnt++;
          if (s.teacher2Id) cnt++;
        } else if (emp.role === 'ADMIN') {
          if (s.adminId) cnt++;
        } else if (emp.role === 'GUARD') {
          if (s.guardId) cnt++;
        }
        return acc + cnt;
      }, 0);

      const fairAverage = peers.length > 0 ? Math.floor(totalRoleDutySlots / peers.length) : 0;
      let targetShiftsGoal = Math.max(1, fairAverage);
      if (maxShiftsPerEmployee && maxShiftsPerEmployee > 0) {
        targetShiftsGoal = Math.min(targetShiftsGoal, maxShiftsPerEmployee);
      }

      let currentCount = getEmpCount(emp.id);

      // Tìm các ca có thể điều chuyển từ đồng nghiệp đang có số ca cao nhất
      let attempts = 0;
      while (currentCount < targetShiftsGoal && attempts < 50) {
        attempts++;

        // Tìm các ca từ fromDate chưa khóa
        const candidateShifts = updatedShifts
          .filter((s) => s.date >= todayStr && !s.isLocked)
          .sort((a, b) => a.date.localeCompare(b.date));

        let bestShiftIdx = -1;
        let bestPos: 'teacher1' | 'teacher2' | 'admin' | 'guard' = 'teacher1';
        let bestReplacedId: string | null = null;
        let maxDonorDuty = -1;

        for (let i = 0; i < candidateShifts.length; i++) {
          const s = candidateShifts[i];
          const sIdx = updatedShifts.findIndex((us) => us.id === s.id);

          const positionsToCheck: ('teacher1' | 'teacher2' | 'admin' | 'guard')[] = [];
          if (emp.role === 'TEACHER') {
            if (s.teacher1Id && s.teacher1Id !== emp.id) positionsToCheck.push('teacher1');
            if (s.teacher2Id && s.teacher2Id !== emp.id) positionsToCheck.push('teacher2');
          } else if (emp.role === 'ADMIN') {
            if (s.adminId && s.adminId !== emp.id) positionsToCheck.push('admin');
          } else if (emp.role === 'GUARD') {
            if (s.guardId && s.guardId !== emp.id) positionsToCheck.push('guard');
          }

          for (const pos of positionsToCheck) {
            const donorId =
              pos === 'teacher1'
                ? s.teacher1Id
                : pos === 'teacher2'
                ? s.teacher2Id
                : pos === 'admin'
                ? s.adminId
                : s.guardId;

            if (!donorId || donorId === emp.id) continue;

            const donorCount = getEmpCount(donorId);
            // Chỉ lấy ca từ người có nhiều hơn người mới ít nhất 2 ca
            if (donorCount <= currentCount + 1) continue;

            // Kiểm tra điều kiện gán người mới vào vị trí này
            const testShifts = updatedShifts.map((item, idx) => {
              if (idx === sIdx) {
                const copy = { ...item };
                if (pos === 'teacher1') copy.teacher1Id = null;
                else if (pos === 'teacher2') copy.teacher2Id = null;
                else if (pos === 'admin') copy.adminId = null;
                else if (pos === 'guard') copy.guardId = null;
                return copy;
              }
              return item;
            });

            const val = validateManualAssignment(
              s.date,
              pos,
              emp.id,
              testShifts,
              employees,
              unavailableDates,
              settings
            );

            if (val.isValid && donorCount > maxDonorDuty) {
              maxDonorDuty = donorCount;
              bestShiftIdx = sIdx;
              bestPos = pos;
              bestReplacedId = donorId;
            }
          }
        }

        if (bestShiftIdx !== -1 && bestReplacedId) {
          // Thực hiện điều chuyển
          const shiftToModify = { ...updatedShifts[bestShiftIdx] };
          if (bestPos === 'teacher1') shiftToModify.teacher1Id = emp.id;
          else if (bestPos === 'teacher2') shiftToModify.teacher2Id = emp.id;
          else if (bestPos === 'admin') shiftToModify.adminId = emp.id;
          else if (bestPos === 'guard') shiftToModify.guardId = emp.id;

          updatedShifts[bestShiftIdx] = shiftToModify;
          currentCount++;

          const donorEmp = empMap.get(bestReplacedId);
          details.push({
            date: shiftToModify.date,
            dayOfWeek: shiftToModify.dayOfWeek,
            rolePosition: bestPos,
            roleName: getRoleLabel(bestPos),
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.code,
            replacedEmployeeId: donorEmp?.id,
            replacedEmployeeName: donorEmp?.name,
            type: 'REBALANCE',
          });

          historyRecords.push({
            shiftDate: shiftToModify.date,
            rolePosition: bestPos,
            previousEmployeeId: bestReplacedId,
            newEmployeeId: emp.id,
            reason: `Đồng bộ nhân sự mới: Điều chuyển san sẻ tải trực từ ${donorEmp?.name || bestReplacedId} (${donorEmp?.code || ''}) sang ${emp.name} (${emp.code})`,
            changedBy: 'Hệ thống tự động cân bằng tải',
            timestamp: nowIso,
          });
        } else {
          // Không còn ca nào thỏa mãn ràng buộc để chuyển
          break;
        }
      }
    }
  }

  const workloadAfter = countAllDuties(updatedShifts);
  const totalAssigned = details.length;

  let summary = '';
  if (totalAssigned === 0) {
    summary = `Tất cả các ca trực từ ngày ${todayStr} đã kín và tối ưu, hoặc ràng buộc 24 giờ / lịch bận không cho phép phân bổ thêm ca mới.`;
  } else {
    summary = `Đồng bộ thành công ${totalAssigned} ca trực cho ${targetEmps.length} nhân sự mới (${targetEmps.map((e) => e.name).join(', ')}).`;
  }

  return {
    updatedShifts,
    totalAssigned,
    details,
    historyRecords,
    workloadBefore,
    workloadAfter,
    summary,
  };
}


