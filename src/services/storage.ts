import { Employee, UnavailableDate, ShiftAssignment, ShiftChangeHistory, ShiftChangeRequest, ScheduleSettings, CompensatoryDuty, AuthUser } from '../types';
import { INITIAL_EMPLOYEES, INITIAL_UNAVAILABLE_DATES, DEFAULT_SETTINGS } from '../data/sampleData';
import { generateAutoSchedule } from './scheduler';

const STORAGE_KEYS = {
  EMPLOYEES: 'boarding_school_employees',
  UNAVAILABLE: 'boarding_school_unavailabilities',
  SHIFTS: 'boarding_school_shifts',
  HISTORY: 'boarding_school_history',
  REQUESTS: 'boarding_school_requests',
  SETTINGS: 'boarding_school_settings',
  COMPENSATORY: 'boarding_school_compensatory',
  INITIALIZED: 'boarding_school_initialized_v2',
  AUTH_USER: 'boarding_school_auth_user',
};

export class StorageService {
  /**
   * Khởi tạo dữ liệu ban đầu nếu chưa từng có trong máy
   */
  static initDatabase() {
    try {
      const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!isInit) {
        this.resetToDefaults();
      }
    } catch (e) {
      console.error('Lỗi khởi tạo LocalStorage:', e);
    }
  }

  static resetToDefaults() {
    const defaultSettings = { ...DEFAULT_SETTINGS };
    const defaultEmployees = [...INITIAL_EMPLOYEES];
    const defaultLeaves = [...INITIAL_UNAVAILABLE_DATES];

    // Xếp sẵn lịch mẫu chuẩn mực cho tháng 11/2026 (30 ngày)
    const scheduleResult = generateAutoSchedule({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      employees: defaultEmployees,
      unavailableDates: defaultLeaves,
      existingShifts: [],
      settings: defaultSettings,
      keepLockedShifts: false,
    });

    const defaultHistory: ShiftChangeHistory[] = [
      {
        id: 'hist-sample-01',
        shiftDate: '2026-11-02',
        rolePosition: 'teacher2',
        previousEmployeeId: 'emp-gv-02',
        newEmployeeId: 'emp-gv-03',
        reason: 'Đổi ca đột xuất có việc gia đình, BGH phê duyệt',
        changedBy: 'Admin (Lê Bá Hùng)',
        timestamp: '2026-11-01T14:20:00Z',
      },
    ];

    const defaultRequests: ShiftChangeRequest[] = [
      {
        id: 'req-sample-01',
        requesterId: 'emp-gv-04',
        shiftDate: '2026-11-15',
        targetEmployeeId: 'emp-gv-05',
        reason: 'Có giờ dạy chuyên đề buổi tối, xin đổi sang ca ngày 17/11',
        status: 'PENDING',
        createdAt: '2026-11-01T08:15:20Z',
      },
    ];

    const defaultCompensatory: CompensatoryDuty[] = [
      {
        id: 'comp-sample-01',
        debtorEmployeeId: 'emp-gv-02',
        creditorEmployeeId: 'emp-gv-03',
        originalShiftDate: '2026-11-02',
        reason: 'Đổi ca đột xuất có việc gia đình ngày 02/11/2026',
        sourceType: 'SHIFT_SWAP',
        status: 'PENDING',
        createdAt: '2026-11-01T14:20:35Z',
      },
      {
        id: 'comp-sample-02',
        debtorEmployeeId: 'emp-gv-01',
        creditorEmployeeId: 'emp-gv-05',
        originalShiftDate: '2026-11-05',
        reason: 'Nghỉ phép đi tập huấn chuyên môn Sở Giáo dục ngày 05/11/2026',
        sourceType: 'LEAVE_APPROVAL',
        status: 'PENDING',
        createdAt: '2026-10-31T09:12:44Z',
      },
    ];

    this.saveSettings(defaultSettings);
    this.saveEmployees(defaultEmployees);
    this.saveUnavailableDates(defaultLeaves);
    this.saveShifts(scheduleResult.shifts);
    this.saveHistory(defaultHistory);
    this.saveRequests(defaultRequests);
    this.saveCompensatoryDuties(defaultCompensatory);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }

  static getEmployees(): Employee[] {
    const raw = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    return raw ? JSON.parse(raw) : INITIAL_EMPLOYEES;
  }

  static saveEmployees(employees: Employee[]) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
  }

  static getUnavailableDates(): UnavailableDate[] {
    const raw = localStorage.getItem(STORAGE_KEYS.UNAVAILABLE);
    return raw ? JSON.parse(raw) : INITIAL_UNAVAILABLE_DATES;
  }

  static saveUnavailableDates(dates: UnavailableDate[]) {
    localStorage.setItem(STORAGE_KEYS.UNAVAILABLE, JSON.stringify(dates));
  }

  static getShifts(): ShiftAssignment[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    return raw ? JSON.parse(raw) : [];
  }

  static saveShifts(shifts: ShiftAssignment[]) {
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
  }

  static getHistory(): ShiftChangeHistory[] {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  }

  static saveHistory(history: ShiftChangeHistory[]) {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }

  static getRequests(): ShiftChangeRequest[] {
    const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
    return raw ? JSON.parse(raw) : [];
  }

  static saveRequests(requests: ShiftChangeRequest[]) {
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
  }

  static getCompensatoryDuties(): CompensatoryDuty[] {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPENSATORY);
    return raw ? JSON.parse(raw) : [];
  }

  static saveCompensatoryDuties(duties: CompensatoryDuty[]) {
    localStorage.setItem(STORAGE_KEYS.COMPENSATORY, JSON.stringify(duties));
  }

  static getSettings(): ScheduleSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.schoolName || parsed.schoolName.includes('TỈNH')) {
        parsed.schoolName = 'TRƯỜNG PHỔ THÔNG DÂN TỘC NỘI TRÚ NA RÌ';
        this.saveSettings(parsed);
      }
      return parsed;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  static saveSettings(settings: ScheduleSettings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  /**
   * Xuất toàn bộ cơ sở dữ liệu thành file JSON sao lưu
   */
  static exportDatabaseJSON(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      schoolName: this.getSettings().schoolName,
      data: {
        employees: this.getEmployees(),
        unavailableDates: this.getUnavailableDates(),
        shifts: this.getShifts(),
        history: this.getHistory(),
        requests: this.getRequests(),
        compensatoryDuties: this.getCompensatoryDuties(),
        settings: this.getSettings(),
      },
    };
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Nhập phục hồi cơ sở dữ liệu từ file JSON
   */
  static importDatabaseJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.data || !Array.isArray(parsed.data.employees)) {
        throw new Error('Định dạng tệp sao lưu không hợp lệ');
      }
      if (parsed.data.employees) this.saveEmployees(parsed.data.employees);
      if (parsed.data.unavailableDates) this.saveUnavailableDates(parsed.data.unavailableDates);
      if (parsed.data.shifts) this.saveShifts(parsed.data.shifts);
      if (parsed.data.history) this.saveHistory(parsed.data.history);
      if (parsed.data.requests) this.saveRequests(parsed.data.requests);
      if (parsed.data.compensatoryDuties) this.saveCompensatoryDuties(parsed.data.compensatoryDuties);
      if (parsed.data.settings) this.saveSettings(parsed.data.settings);
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      return true;
    } catch (e) {
      console.error('Không thể phục hồi dữ liệu từ JSON:', e);
      return false;
    }
  }

  /**
   * Quản lý người dùng đăng nhập hiện tại
   */
  static getAuthUser(): AuthUser | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static saveAuthUser(user: AuthUser) {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
    } catch (e) {
      console.error('Lỗi lưu AuthUser:', e);
    }
  }

  static clearAuthUser() {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } catch (e) {
      console.error('Lỗi xóa AuthUser:', e);
    }
  }
}
