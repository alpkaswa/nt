import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ScheduleTableView } from './components/ScheduleTableView';
import { AutoScheduleView } from './components/AutoScheduleView';
import { EmployeeManagementView } from './components/EmployeeManagementView';
import { UnavailableDatesView } from './components/UnavailableDatesView';
import { StatisticsReportView } from './components/StatisticsReportView';
import { CompensatoryDutyView } from './components/CompensatoryDutyView';
import { ExportPrintView } from './components/ExportPrintView';
import { TestVerificationView } from './components/TestVerificationView';
import { ShiftAdjustmentModal } from './components/ShiftAdjustmentModal';
import { ShiftSwapModal } from './components/ShiftSwapModal';
import { GmailNotificationModal } from './components/GmailNotificationModal';
import { SettingsModal } from './components/SettingsModal';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { SyncNewEmployeeModal } from './components/SyncNewEmployeeModal';
import { PublicScheduleView } from './components/PublicScheduleView';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import {
  Employee,
  UnavailableDate,
  ShiftAssignment,
  ShiftChangeHistory,
  ShiftChangeRequest,
  ScheduleSettings,
  AppUserRole,
  LeaveStatus,
  CompensatoryDuty,
  AuthUser,
} from './types';
import { StorageService } from './services/storage';
import { ExportService } from './services/exportService';
import { auth, signOutUser } from './services/firebase';
import * as FirebaseDb from './services/firebaseDb';
import { onAuthStateChanged } from 'firebase/auth';
import {
  autoSwapShiftOnLeaveApproval,
  autoAssignNewEmployeeToShifts,
  autoFillAllEmptyShifts,
} from './services/scheduler';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function App() {
  // Database states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([]);
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [history, setHistory] = useState<ShiftChangeHistory[]>([]);
  const [requests, setRequests] = useState<ShiftChangeRequest[]>([]);
  const [compensatoryDuties, setCompensatoryDuties] = useState<CompensatoryDuty[]>([]);
  const [settings, setSettings] = useState<ScheduleSettings>(StorageService.getSettings());

  // Realtime & Connectivity State
  const [realtimeStatus, setRealtimeStatus] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const [googleAccessToken, setGoogleAccessToken] = useState<string>('');

  // Auth & UI state
  const isPublicUrl =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('view') === 'public';
  const [currentTab, setCurrentTab] = useState<string>(isPublicUrl ? 'public-schedule' : 'dashboard');
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => StorageService.getAuthUser());
  const [currentUserRole, setCurrentUserRole] = useState<AppUserRole>(
    () => StorageService.getAuthUser()?.role || 'ADMIN'
  );
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isGoogleAuthOpen, setIsGoogleAuthOpen] = useState<boolean>(false);
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState<boolean>(false);
  const [isShiftSwapModalOpen, setIsShiftSwapModalOpen] = useState<boolean>(false);

  // Modal states
  const [adjustingShift, setAdjustingShift] = useState<ShiftAssignment | null>(null);
  const [adjustingRole, setAdjustingRole] = useState<'teacher1' | 'teacher2' | 'admin' | 'guard'>('teacher1');
  const [gmailNoticeShift, setGmailNoticeShift] = useState<ShiftAssignment | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [syncTargetEmployeeId, setSyncTargetEmployeeId] = useState<string | null>(null);
  const [swapToast, setSwapToast] = useState<{
    type: 'success' | 'warning' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // 1. Nạp ban đầu từ LocalStorage đệm và khởi tạo Seed Firestore nếu cần
  const loadInitialData = useCallback(async () => {
    StorageService.initDatabase();

    // Nạp từ bộ nhớ đệm trước để tránh giật giao diện
    setEmployees(StorageService.getEmployees());
    setUnavailableDates(StorageService.getUnavailableDates());
    setShifts(StorageService.getShifts());
    setHistory(StorageService.getHistory());
    setRequests(StorageService.getRequests());
    setCompensatoryDuties(StorageService.getCompensatoryDuties());
    setSettings(StorageService.getSettings());

    const storedAuth = StorageService.getAuthUser();
    if (storedAuth) {
      setAuthUser(storedAuth);
      setCurrentUserRole(storedAuth.role);
    }

    // Tự động kiểm tra và seed dữ liệu lên Firestore nếu DB trống
    await FirebaseDb.seedInitialFirestoreData();
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Theo dõi trạng thái Firebase Authentication thực tế
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await FirebaseDb.syncUserProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          });
          setAuthUser(profile);
          setCurrentUserRole(profile.role);
          StorageService.saveAuthUser(profile);
        } catch (e) {
          console.error('Lỗi sync user profile từ Firebase:', e);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 3. Đăng ký các kênh lắng nghe thời gian thực Cloud Firestore (onSnapshot)
  useEffect(() => {
    setRealtimeStatus('CONNECTING');

    // Lắng nghe Employees
    const unsubEmployees = FirebaseDb.subscribeEmployees(
      (remoteEmps) => {
        if (remoteEmps.length > 0) {
          setEmployees(remoteEmps);
          StorageService.saveEmployees(remoteEmps);
          setRealtimeStatus('CONNECTED');
        }
      },
      () => setRealtimeStatus('DISCONNECTED')
    );

    // Lắng nghe Shifts
    const unsubShifts = FirebaseDb.subscribeShifts(
      (remoteShifts) => {
        if (remoteShifts.length > 0) {
          setShifts(remoteShifts);
          StorageService.saveShifts(remoteShifts);
          setRealtimeStatus('CONNECTED');
        }
      },
      () => setRealtimeStatus('DISCONNECTED')
    );

    // Lắng nghe Yêu cầu đổi ca
    const unsubRequests = FirebaseDb.subscribeShiftChangeRequests(
      (remoteReqs) => {
        setRequests(remoteReqs);
        StorageService.saveRequests(remoteReqs);
      }
    );

    // Lắng nghe Lịch sử thay đổi
    const unsubHistory = FirebaseDb.subscribeShiftChangeHistory(
      (remoteHist) => {
        setHistory(remoteHist);
        StorageService.saveHistory(remoteHist);
      }
    );

    // Lắng nghe Đơn xin nghỉ
    const unsubLeaves = FirebaseDb.subscribeUnavailableDates(
      (remoteLeaves) => {
        if (remoteLeaves.length > 0) {
          setUnavailableDates(remoteLeaves);
          StorageService.saveUnavailableDates(remoteLeaves);
        }
      }
    );

    // Lắng nghe Trực bù
    const unsubComp = FirebaseDb.subscribeCompensatoryDuties(
      (remoteComp) => {
        setCompensatoryDuties(remoteComp);
        StorageService.saveCompensatoryDuties(remoteComp);
      }
    );

    // Lắng nghe Cấu hình
    const unsubSettings = FirebaseDb.subscribeScheduleSettings(
      (remoteSettings) => {
        setSettings(remoteSettings);
        StorageService.saveSettings(remoteSettings);
      }
    );

    return () => {
      unsubEmployees();
      unsubShifts();
      unsubRequests();
      unsubHistory();
      unsubLeaves();
      unsubComp();
      unsubSettings();
    };
  }, []);

  // 4. Lắng nghe sự kiện Online / Offline
  useEffect(() => {
    const handleOnline = () => {
      setRealtimeStatus('CONNECTING');
      setTimeout(() => setRealtimeStatus('CONNECTED'), 500);
      setSwapToast({
        type: 'success',
        title: 'Đã Kết Nối Lại Mạng',
        message: 'Hệ thống đã phục hồi kết nối và tự động đồng bộ Firestore onSnapshot.',
      });
    };

    const handleOffline = () => {
      setRealtimeStatus('DISCONNECTED');
      setSwapToast({
        type: 'warning',
        title: 'Mất Kết Nối Mạng',
        message: 'Ứng dụng chuyển sang chế độ dữ liệu cục bộ an toàn (Firestore Offline Persistence).',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Auth Handlers
  const handleGoogleLoginSuccess = (user: AuthUser, accessToken?: string) => {
    setAuthUser(user);
    setCurrentUserRole(user.role);
    StorageService.saveAuthUser(user);
    if (accessToken) {
      setGoogleAccessToken(accessToken);
    }
    setSwapToast({
      type: 'success',
      title: 'Đăng Nhập Thành Công',
      message: `Chào mừng ${user.name} (${user.email}) với vai trò ${
        user.role === 'ADMIN'
          ? 'Quản Trị Viên (Admin)'
          : user.role === 'BGH'
          ? 'Ban Giám Hiệu (BGH)'
          : user.role === 'GUARD'
          ? 'Bảo Vệ'
          : 'Cán Bộ / Giáo Viên'
      }.`,
    });
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (e) {
      console.warn('Lỗi signOut:', e);
    }
    StorageService.clearAuthUser();
    setAuthUser(null);
    setCurrentUserRole('TEACHER'); // Không tự cấp quyền Admin khi chưa đăng nhập
    setSwapToast({
      type: 'info',
      title: 'Đã Đăng Xuất',
      message: 'Bạn đã đăng xuất tài khoản Firebase thành công.',
    });
  };

  const handleRoleChange = (role: AppUserRole) => {
    // Chỉ admin mới có quyền đổi vai trò
    if (currentUserRole !== 'ADMIN') {
      setSwapToast({
        type: 'warning',
        title: 'Không Có Quyền',
        message: 'Chỉ Quản trị viên mới được phân quyền hệ thống.',
      });
      return;
    }
    setCurrentUserRole(role);
    if (authUser) {
      const updatedUser: AuthUser = { ...authUser, role };
      setAuthUser(updatedUser);
      StorageService.saveAuthUser(updatedUser);
      FirebaseDb.updateUserRoleInDb(authUser.id, role);
    }
  };

  // Handlers for Employees
  const handleAddEmployee = async (emp: Employee) => {
    const updatedEmployees = [...employees, emp];
    setEmployees(updatedEmployees);
    StorageService.saveEmployees(updatedEmployees);
    await FirebaseDb.saveEmployeeInDb(emp);

    setSyncTargetEmployeeId(emp.id);
    setIsSyncModalOpen(true);
  };

  const handleUpdateEmployee = async (emp: Employee) => {
    const updated = employees.map((e) => (e.id === emp.id ? emp : e));
    setEmployees(updated);
    StorageService.saveEmployees(updated);
    await FirebaseDb.saveEmployeeInDb(emp);
  };

  const handleDeleteEmployee = async (empId: string) => {
    const updated = employees.filter((e) => e.id !== empId);
    setEmployees(updated);
    StorageService.saveEmployees(updated);
    await FirebaseDb.deleteEmployeeInDb(empId);

    // Cập nhật các ca có nhân sự này thành trống
    const updatedShifts = shifts.map((s) => {
      let changed = false;
      const sCopy = { ...s };
      if (sCopy.teacher1Id === empId) {
        sCopy.teacher1Id = null;
        changed = true;
      }
      if (sCopy.teacher2Id === empId) {
        sCopy.teacher2Id = null;
        changed = true;
      }
      if (sCopy.adminId === empId) {
        sCopy.adminId = null;
        changed = true;
      }
      if (sCopy.guardId === empId) {
        sCopy.guardId = null;
        changed = true;
      }
      if (changed) {
        sCopy.status = 'INCOMPLETE';
      }
      return sCopy;
    });

    setShifts(updatedShifts);
    StorageService.saveShifts(updatedShifts);
    await FirebaseDb.saveShiftsBatchInDb(updatedShifts);
  };

  const handleImportEmployees = async (
    imported: Employee[],
    mode: 'merge_update' | 'add_only' | 'replace_all' = 'merge_update'
  ) => {
    let updated: Employee[] = [];
    if (mode === 'replace_all') {
      updated = [...imported];
    } else if (mode === 'add_only') {
      const existingCodes = new Set(employees.map((e) => e.code.toUpperCase()));
      const toAdd = imported.filter((e) => !existingCodes.has(e.code.toUpperCase()));
      updated = [...employees, ...toAdd];
    } else {
      const empMap = new Map<string, Employee>();
      employees.forEach((e) => empMap.set(e.code.toUpperCase(), { ...e }));
      imported.forEach((emp) => {
        const key = emp.code.toUpperCase();
        if (empMap.has(key)) {
          const prev = empMap.get(key)!;
          empMap.set(key, {
            ...prev,
            name: emp.name || prev.name,
            role: emp.role || prev.role,
            department: emp.department || prev.department,
            phone: emp.phone || prev.phone,
            email: emp.email || prev.email,
            notes: emp.notes !== undefined ? emp.notes : prev.notes,
          });
        } else {
          empMap.set(key, emp);
        }
      });
      updated = Array.from(empMap.values());
    }

    setEmployees(updated);
    StorageService.saveEmployees(updated);
    await FirebaseDb.saveEmployeesBatchInDb(updated);

    setIsSyncModalOpen(true);
  };

  const handleAutoFillEmptyShifts = async () => {
    const fillRes = autoFillAllEmptyShifts(employees, shifts, unavailableDates, settings);
    if (fillRes.filledCount > 0) {
      setShifts(fillRes.updatedShifts);
      StorageService.saveShifts(fillRes.updatedShifts);
      await FirebaseDb.saveShiftsBatchInDb(fillRes.updatedShifts);
      setSwapToast({
        type: 'success',
        title: 'Đồng Bộ Lịch Trực Thành Công',
        message: `Đã tự động tìm và lấp đầy ${fillRes.filledCount} vị trí ca trực còn trống trong tháng!`,
      });
    } else {
      setSwapToast({
        type: 'info',
        title: 'Lịch Trực Đầy Đủ',
        message: 'Tất cả các ca trực từ hôm nay đã có đủ nhân sự, không có vị trí trống cần điền.',
      });
    }
  };

  const handleOpenSyncModal = (employeeId?: string) => {
    setSyncTargetEmployeeId(employeeId || null);
    setIsSyncModalOpen(true);
  };

  const handleApplySync = async (
    updatedShifts: ShiftAssignment[],
    historyRecords: ShiftChangeHistory[],
    summaryMessage: string
  ) => {
    setShifts(updatedShifts);
    StorageService.saveShifts(updatedShifts);
    await FirebaseDb.saveShiftsBatchInDb(updatedShifts);

    if (historyRecords.length > 0) {
      const updatedHistory = [...historyRecords, ...history];
      setHistory(updatedHistory);
      StorageService.saveHistory(updatedHistory);
      for (const h of historyRecords) {
        await FirebaseDb.recordShiftChangeHistoryInDb(h);
      }
    }

    setSwapToast({
      type: 'success',
      title: 'Đồng Bộ Lịch Trực Thành Công',
      message: summaryMessage,
    });
  };

  // Khóa / Mở Khóa Ca Trực (Lock Protection)
  const handleToggleLock = async (shiftId: string) => {
    const currentShift = shifts.find((s) => s.id === shiftId);
    if (!currentShift) return;

    const newLockState = !currentShift.isLocked;
    await FirebaseDb.toggleLockShiftInDb(shiftId, newLockState);

    setSwapToast({
      type: newLockState ? 'warning' : 'info',
      title: newLockState ? 'Đã Khóa Ca Trực' : 'Đã Mở Khóa Ca Trực',
      message: `Ca trực ngày ${currentShift.date} đã được ${
        newLockState ? 'khóa cố định (Bảo vệ chống sửa đè)' : 'mở khóa cho phép điều chỉnh'
      }.`,
    });
  };

  // Điều chỉnh phân công trong ca trực
  const handleApplyShiftAdjustment = async (
    updatedShift: ShiftAssignment,
    historyRecord: Omit<ShiftChangeHistory, 'id' | 'timestamp'>,
    compensatoryDuty?: CompensatoryDuty
  ) => {
    const currentTarget = shifts.find((s) => s.id === updatedShift.id);
    if (currentTarget && currentTarget.isLocked) {
      setSwapToast({
        type: 'warning',
        title: 'Ca Trực Đã Khóa',
        message: `Không thể điều chỉnh nhân sự vì ca trực ngày ${updatedShift.date} đã được khóa phê duyệt.`,
      });
      return;
    }

    await FirebaseDb.saveShiftInDb(updatedShift);

    if (historyRecord) {
      const historyEntry: ShiftChangeHistory = {
        id: `hist-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...historyRecord,
      };
      await FirebaseDb.recordShiftChangeHistoryInDb(historyEntry);
    }

    if (compensatoryDuty) {
      await FirebaseDb.saveCompensatoryDutyInDb(compensatoryDuty);
    }

    setAdjustingShift(null);
    setSwapToast({
      type: 'success',
      title: 'Đã Cập Nhật Ca Trực',
      message: `Đã lưu phân công mới cho ca trực ngày ${updatedShift.date} lên Firestore.`,
    });
  };

  // Thao tác Đổi Ca Trực An Toàn bằng Transaction
  const handleCreateSwapRequest = async (
    reqData: Omit<ShiftChangeRequest, 'id' | 'createdAt'>
  ): Promise<void> => {
    await FirebaseDb.createShiftChangeRequestInDb(reqData);
    setSwapToast({
      type: 'success',
      title: 'Đã Gửi Đề Nghị Đổi Ca',
      message: 'Đề nghị đổi ca đã được ghi nhận trên Firestore và đang chờ đồng nghiệp phản hồi.',
    });
  };

  const handleAcceptSwapTransaction = async (
    requestId: string
  ): Promise<{ success: boolean; message: string }> => {
    const result = await FirebaseDb.executeShiftSwapTransaction(
      requestId,
      authUser?.name || 'Cán bộ giáo viên'
    );

    setSwapToast({
      type: result.success ? 'success' : 'warning',
      title: result.success ? 'Hoán Đổi Ca Thành Công' : 'Không Thể Đổi Ca',
      message: result.message,
    });

    return result;
  };

  const handleRejectSwapRequest = async (requestId: string): Promise<void> => {
    await FirebaseDb.rejectShiftChangeRequestInDb(requestId);
    setSwapToast({
      type: 'info',
      title: 'Đã Từ Chối Đổi Ca',
      message: 'Đề nghị đổi ca đã được cập nhật trạng thái Từ chối.',
    });
  };

  // Nghỉ phép & Trực bù
  const handleAddLeave = async (leave: UnavailableDate) => {
    await FirebaseDb.saveUnavailableDateInDb(leave);
    setSwapToast({
      type: 'success',
      title: 'Đã Gửi Đăng Ký Nghỉ / Bận',
      message: `Đã tiếp nhận đơn xin vắng của cán bộ vào ngày ${leave.date}. Chờ BGH phê duyệt.`,
    });
  };

  const handleUpdateLeaveStatus = async (leaveId: string, status: LeaveStatus) => {
    const targetLeave = unavailableDates.find((l) => l.id === leaveId);
    if (!targetLeave) return;

    await FirebaseDb.updateUnavailableDateStatusInDb(leaveId, status, authUser?.name);

    if (status === 'APPROVED') {
      const updatedLeaves = unavailableDates.map((l) => (l.id === leaveId ? { ...l, status } : l));
      const swapRes = autoSwapShiftOnLeaveApproval(
        targetLeave,
        shifts,
        employees,
        updatedLeaves,
        settings
      );

      if (swapRes.details.swapped && swapRes.details.newEmployee) {
        await FirebaseDb.saveShiftsBatchInDb(swapRes.updatedShifts);

        if (swapRes.newHistoryRecord) {
          await FirebaseDb.recordShiftChangeHistoryInDb({
            id: `hist-${Date.now()}`,
            ...swapRes.newHistoryRecord,
          });
        }

        if (swapRes.newCompensatoryDuty) {
          await FirebaseDb.saveCompensatoryDutyInDb(swapRes.newCompensatoryDuty);
        }

        setSwapToast({
          type: 'success',
          title: 'Đã Duyệt Đơn & Tự Động Điều Chuyển Trực Thay',
          message: `Đã phân công ${swapRes.details.newEmployee.name} (${swapRes.details.newEmployee.code}) trực thay cho ${swapRes.details.oldEmployee?.name || ''} vào ngày ${targetLeave.date}. Bản ghi nợ trực bù đã được khởi tạo.`,
        });
        return;
      }
    }

    setSwapToast({
      type: status === 'APPROVED' ? 'success' : 'info',
      title: status === 'APPROVED' ? 'Đã Phê Duyệt Nghỉ' : 'Đã Từ Chối Đơn Nghỉ',
      message: `Đơn xin nghỉ ngày ${targetLeave.date} đã chuyển sang trạng thái: ${
        status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'
      }.`,
    });
  };

  const handleDeleteLeave = async (leaveId: string) => {
    await FirebaseDb.deleteUnavailableDateInDb(leaveId);
  };

  const handleUpdateCompensatoryDuties = async (duties: CompensatoryDuty[]) => {
    setCompensatoryDuties(duties);
    StorageService.saveCompensatoryDuties(duties);
    for (const d of duties) {
      await FirebaseDb.saveCompensatoryDutyInDb(d);
    }
  };

  const handleSaveSchedule = async (newShifts: ShiftAssignment[]) => {
    setShifts(newShifts);
    StorageService.saveShifts(newShifts);
    await FirebaseDb.saveShiftsBatchInDb(newShifts);
    setSwapToast({
      type: 'success',
      title: 'Đã Lưu Lịch Trực Toàn Trường',
      message: `Đã lưu và đồng bộ ${newShifts.length} ca trực lên Cloud Firestore Realtime.`,
    });
  };

  const handleSaveSettings = async (newSettings: ScheduleSettings) => {
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);
    await FirebaseDb.saveScheduleSettingsInDb(newSettings);
  };

  const handleResetDefaults = async () => {
    StorageService.resetToDefaults();
    await FirebaseDb.seedInitialFirestoreData();
    loadInitialData();
    setSwapToast({
      type: 'info',
      title: 'Đã Đặt Lại Dữ Liệu Mẫu',
      message: 'Hệ thống đã phục hồi danh sách 18 cán bộ và lịch trực tháng 11/2026 mẫu.',
    });
  };

  const handleExportExcel = (month?: string) => {
    ExportService.exportScheduleToExcel(shifts, employees, settings, month || '11/2026');
  };

  const pendingLeavesCount = unavailableDates.filter((l) => l.status === 'PENDING').length;
  const pendingCompensatoryCount = compensatoryDuties.filter((c) => c.status === 'PENDING').length;
  const pendingSwapCount = requests.filter((r) => r.status === 'PENDING').length;
  const conflictsCount = shifts.filter((s) => s.status === 'CONFLICT').length;

  // Nếu người dùng đang xem trang Public Schedule View (Chia sẻ link xem trực tiếp)
  if (currentTab === 'public-schedule') {
    return (
      <PublicScheduleView
        shifts={shifts}
        employees={employees}
        settings={settings}
        realtimeStatus={realtimeStatus}
        onBackToApp={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('view');
          window.history.replaceState({}, '', url.toString());
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Toast Floating Notification */}
      {swapToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-2xl border shadow-2xl flex items-start gap-3 text-xs animate-in slide-in-from-bottom duration-300 ${
            swapToast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 shadow-emerald-500/10'
              : swapToast.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/90 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 shadow-amber-500/10'
              : 'bg-indigo-50 dark:bg-indigo-950/90 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100 shadow-indigo-500/10'
          }`}
        >
          {swapToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : swapToast.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          )}

          <div className="flex-1">
            <h4 className="font-bold text-sm mb-0.5">{swapToast.title}</h4>
            <p className="leading-relaxed opacity-90">{swapToast.message}</p>
          </div>

          <button
            onClick={() => setSwapToast(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'public-schedule') {
            const url = new URL(window.location.href);
            url.searchParams.set('view', 'public');
            window.history.pushState({}, '', url.toString());
          }
          if (tab === 'swap') {
            setIsShiftSwapModalOpen(true);
            return;
          }
          setCurrentTab(tab);
        }}
        currentUserRole={currentUserRole}
        pendingLeavesCount={pendingLeavesCount}
        pendingCompensatoryCount={pendingCompensatoryCount}
        pendingSwapCount={pendingSwapCount}
        conflictsCount={conflictsCount}
        schoolName={settings.schoolName}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPublicSchedule={() => setCurrentTab('public-schedule')}
        onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          currentUserRole={currentUserRole}
          onRoleChange={handleRoleChange}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          pendingLeavesCount={pendingLeavesCount}
          authUser={authUser}
          onOpenGoogleAuth={() => setIsGoogleAuthOpen(true)}
          onLogout={handleLogout}
          realtimeStatus={realtimeStatus}
          onOpenPublicSchedule={() => setCurrentTab('public-schedule')}
          onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
        />

        {/* View Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 transition-colors">
          <div className="max-w-7xl mx-auto space-y-6">
            {currentTab === 'dashboard' && (
              <DashboardView
                shifts={shifts}
                employees={employees}
                unavailableDates={unavailableDates}
                changeRequests={requests}
                onNavigateTab={(tab: string) => {
                  if (tab === 'swap') {
                    setIsShiftSwapModalOpen(true);
                  } else {
                    setCurrentTab(tab);
                  }
                }}
                onOpenGmailNotice={(shift: ShiftAssignment) => setGmailNoticeShift(shift)}
                onQuickSwap={(shift: ShiftAssignment) => {
                  setAdjustingShift(shift);
                  setAdjustingRole('teacher1');
                }}
              />
            )}

            {currentTab === 'schedule' && (
              <ScheduleTableView
                shifts={shifts}
                employees={employees}
                currentUserRole={currentUserRole}
                onToggleLock={handleToggleLock}
                onOpenSwapModal={(shift, role) => {
                  setAdjustingShift(shift);
                  if (role) setAdjustingRole(role);
                }}
                onOpenGmailNotice={(shift) => setGmailNoticeShift(shift)}
                onExportExcel={handleExportExcel}
                onNavigateAutoSchedule={() => setCurrentTab('auto-schedule')}
                onImportSchedule={handleSaveSchedule}
                onAutoFillShifts={handleAutoFillEmptyShifts}
                onOpenSyncModal={handleOpenSyncModal}
              />
            )}

            {currentTab === 'auto-schedule' && (
              <AutoScheduleView
                employees={employees}
                unavailableDates={unavailableDates}
                currentShifts={shifts}
                settings={settings}
                onSaveSchedule={handleSaveSchedule}
                onNavigateSchedule={() => setCurrentTab('schedule')}
              />
            )}

            {currentTab === 'employees' && (
              <EmployeeManagementView
                employees={employees}
                shifts={shifts}
                currentUserRole={currentUserRole}
                onAddEmployee={handleAddEmployee}
                onUpdateEmployee={handleUpdateEmployee}
                onDeleteEmployee={handleDeleteEmployee}
                onImportEmployees={handleImportEmployees}
                onAutoFillShifts={handleAutoFillEmptyShifts}
                onOpenSyncModal={handleOpenSyncModal}
              />
            )}

            {currentTab === 'leaves' && (
              <UnavailableDatesView
                unavailableDates={unavailableDates}
                employees={employees}
                shifts={shifts}
                currentUserRole={currentUserRole}
                onAddLeave={handleAddLeave}
                onUpdateStatus={handleUpdateLeaveStatus}
                onDeleteLeave={handleDeleteLeave}
              />
            )}

            {currentTab === 'compensatory' && (
              <CompensatoryDutyView
                compensatoryDuties={compensatoryDuties}
                employees={employees}
                shifts={shifts}
                unavailableDates={unavailableDates}
                settings={settings}
                currentUserRole={currentUserRole}
                onUpdateDuties={handleUpdateCompensatoryDuties}
                onUpdateShifts={handleSaveSchedule}
                onShowNotification={(title, message, type) =>
                  setSwapToast({ title, message, type })
                }
              />
            )}

            {currentTab === 'statistics' && (
              <StatisticsReportView
                employees={employees}
                shifts={shifts}
                unavailableDates={unavailableDates}
                history={history}
                settings={settings}
                compensatoryDuties={compensatoryDuties}
                onNavigatePrint={() => setCurrentTab('export')}
              />
            )}

            {currentTab === 'export' && (
              <ExportPrintView shifts={shifts} employees={employees} settings={settings} />
            )}

            {currentTab === 'tests' && (
              <TestVerificationView
                employees={employees}
                unavailableDates={unavailableDates}
                settings={settings}
              />
            )}
          </div>
        </main>
      </div>

      {/* Shift Adjustment Modal (Manual adjustment) */}
      {adjustingShift && (
        <ShiftAdjustmentModal
          isOpen={!!adjustingShift}
          onClose={() => setAdjustingShift(null)}
          shift={adjustingShift}
          initialRole={adjustingRole}
          employees={employees}
          allShifts={shifts}
          unavailableDates={unavailableDates}
          settings={settings}
          onApplyAdjustment={handleApplyShiftAdjustment}
        />
      )}

      {/* Shift Swap Modal (Firestore Atomic Transaction) */}
      <ShiftSwapModal
        isOpen={isShiftSwapModalOpen}
        onClose={() => setIsShiftSwapModalOpen(false)}
        requests={requests}
        shifts={shifts}
        employees={employees}
        authUser={authUser}
        currentUserRole={currentUserRole}
        onCreateSwapRequest={handleCreateSwapRequest}
        onAcceptSwap={handleAcceptSwapTransaction}
        onRejectSwap={handleRejectSwapRequest}
      />

      {gmailNoticeShift && (
        <GmailNotificationModal
          isOpen={!!gmailNoticeShift}
          onClose={() => setGmailNoticeShift(null)}
          shift={gmailNoticeShift}
          employees={employees}
          settings={settings}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          employees={employees}
          shifts={shifts}
          unavailableDates={unavailableDates}
          compensatoryDuties={compensatoryDuties}
          onSaveSettings={handleSaveSettings}
          onResetDefaults={handleResetDefaults}
          onDataReload={loadInitialData}
        />
      )}

      {/* Google Authentication Modal */}
      <GoogleAuthModal
        isOpen={isGoogleAuthOpen}
        onClose={() => setIsGoogleAuthOpen(false)}
        onLoginSuccess={handleGoogleLoginSuccess}
        currentUser={authUser}
        employees={employees}
      />

      {/* Sync New Employee Duty Schedule Modal (Impact Preview) */}
      {isSyncModalOpen && (
        <SyncNewEmployeeModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          employees={employees}
          shifts={shifts}
          unavailableDates={unavailableDates}
          settings={settings}
          preselectedEmployeeId={syncTargetEmployeeId}
          onApplySync={handleApplySync}
        />
      )}

      {/* Google Sheets Sync Modal */}
      {isGoogleSheetsOpen && (
        <GoogleSheetsSyncModal
          isOpen={isGoogleSheetsOpen}
          onClose={() => setIsGoogleSheetsOpen(false)}
          shifts={shifts}
          employees={employees}
          initialAccessToken={googleAccessToken}
          onSyncComplete={(msg) => {
            setSwapToast({
              type: 'success',
              title: 'Đồng Bộ Google Sheets Thành Công',
              message: msg,
            });
          }}
        />
      )}
    </div>
  );
}
