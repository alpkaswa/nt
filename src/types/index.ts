/**
 * Định nghĩa các kiểu dữ liệu cho Hệ thống Quản lý và Sắp xếp Lịch trực Quản sinh
 */

export type EmployeeRole = 'TEACHER' | 'ADMIN' | 'GUARD';
export type AppUserRole = 'ADMIN' | 'BGH' | 'TEACHER' | 'GUARD';

export interface Employee {
  id: string;
  code: string; // VD: GV01, BGH01, BV01
  name: string;
  role: EmployeeRole;
  department: string;
  phone: string;
  email: string;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface UnavailableDate {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  reason: string;
  status: LeaveStatus;
  createdAt: string;
  reviewedBy?: string;
}

export type ShiftStatus = 'COMPLETE' | 'INCOMPLETE' | 'CONFLICT';

export interface ShiftAssignment {
  id: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0: Chủ nhật, 1: Thứ hai...
  startTime: string; // "07:00"
  endTime: string; // "07:00 ngày hôm sau"
  teacher1Id: string | null;
  teacher2Id: string | null;
  adminId: string | null;
  guardId: string | null;
  status: ShiftStatus;
  isLocked: boolean;
  notes?: string;
  conflicts?: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface ShiftChangeHistory {
  id: string;
  shiftDate: string;
  rolePosition: 'teacher1' | 'teacher2' | 'admin' | 'guard';
  previousEmployeeId: string;
  newEmployeeId: string;
  reason: string;
  changedBy: string;
  timestamp: string;
}

export interface ShiftChangeRequest {
  id: string;
  requesterId: string;
  shiftDate: string;
  targetEmployeeId: string;
  targetShiftDate?: string;
  requesterShiftId?: string;
  targetShiftId?: string;
  requesterRolePosition?: 'teacher1' | 'teacher2' | 'admin' | 'guard';
  targetRolePosition?: 'teacher1' | 'teacher2' | 'admin' | 'guard';
  reason: string;
  status: LeaveStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface ScheduleSettings {
  schoolName: string;
  shiftDurationHours: number;
  shiftStartTime: string;
  shiftEndTime: string;
  requiredTeachers: number;
  requiredAdmins: number;
  requiredGuards: number;
  disallowConsecutiveDays: boolean;
  respectApprovedUnavailabilities: boolean;
  fairDistribution: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type CompensatoryStatus = 'PENDING' | 'SCHEDULED' | 'COMPLETED';

export interface CompensatoryDuty {
  id: string;
  debtorEmployeeId: string; // Người nợ ca trực bù (đã nghỉ hoặc được người khác trực thay)
  creditorEmployeeId?: string; // Người đã trực thay
  originalShiftDate: string; // Ngày ca gốc bị vắng (YYYY-MM-DD)
  reason: string; // Lý do phát sinh nợ ca
  sourceType: 'LEAVE_APPROVAL' | 'SHIFT_SWAP' | 'MANUAL_DEBT';
  status: CompensatoryStatus;
  createdAt: string; // ISO string lưu chính xác giây, phút, giờ, ngày, tháng, năm
  compensatedShiftDate?: string; // Ngày được xếp trực bù (YYYY-MM-DD)
  compensatedRolePosition?: 'teacher1' | 'teacher2' | 'admin' | 'guard';
  compensatedAt?: string; // Thời điểm hoàn thành/xếp bù (ISO string chính xác giây, phút, giờ...)
  notes?: string;
}

export interface ShiftStatistics {
  employeeId: string;
  name: string;
  code: string;
  role: EmployeeRole;
  department: string;
  totalShifts: number;
  weekdayShifts: number;
  weekendShifts: number;
  approvedLeaves: number;
  swapCount: number;
  compensatoryOwed: number; // Số ca nợ trực bù
  compensatoryCompleted: number; // Số ca đã trực bù xong
  shiftsCoveredForOthers: number; // Số ca đã trực thay đồng nghiệp
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: AppUserRole;
  provider: 'firebase' | 'google' | 'guest';
  loginAt: string;
}

export type ConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'OFFLINE';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastPing?: string;
  error?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetNameShifts: string;
  sheetNameEmployees: string;
  accessToken?: string;
  lastSyncedAt?: string;
  isConnected: boolean;
}

export interface SyncLog {
  id: string;
  serviceType: 'GOOGLE_SHEETS' | 'SUPABASE';
  action: string;
  status: 'SUCCESS' | 'ERROR' | 'IN_PROGRESS';
  recordsSynced: number;
  details: string;
  createdAt: string;
}

export interface ShiftImpactPreview {
  employee: Employee;
  targetShifts: {
    shiftId: string;
    date: string;
    dayOfWeek: number;
    position: 'teacher1' | 'teacher2' | 'admin' | 'guard';
  }[];
}


