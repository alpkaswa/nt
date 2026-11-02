import React, { useState, useMemo, useRef } from 'react';
import {
  Calendar,
  Lock,
  Unlock,
  Mail,
  UserCheck,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowUpDown,
  Phone,
  Sparkles,
  Clock,
  LocateFixed,
  Upload,
  X,
} from 'lucide-react';
import { ShiftAssignment, Employee, AppUserRole } from '../types';
import { getDayNameVN, parseDate } from '../services/scheduler';
import { useRealTimeClock } from '../hooks/useRealTimeClock';
import { formatIsoMonth } from '../services/dateTimeUtils';
import { ExportService } from '../services/exportService';

interface ScheduleTableViewProps {
  shifts: ShiftAssignment[];
  employees: Employee[];
  currentUserRole: AppUserRole;
  onToggleLock: (shiftId: string) => void;
  onOpenSwapModal: (
    shift: ShiftAssignment,
    initialRole?: 'teacher1' | 'teacher2' | 'admin' | 'guard'
  ) => void;
  onOpenGmailNotice: (shift: ShiftAssignment) => void;
  onExportExcel: (month?: string) => void;
  onNavigateAutoSchedule: () => void;
  onImportSchedule?: (newShifts: ShiftAssignment[]) => void;
  onAutoFillShifts?: () => void;
  onOpenSyncModal?: (employeeId?: string) => void;
}

export const ScheduleTableView: React.FC<ScheduleTableViewProps> = ({
  shifts,
  employees,
  currentUserRole,
  onToggleLock,
  onOpenSwapModal,
  onOpenGmailNotice,
  onExportExcel,
  onNavigateAutoSchedule,
  onImportSchedule,
  onAutoFillShifts,
  onOpenSyncModal,
}) => {
  const { now, currentDutyDate, formattedDateFull } = useRealTimeClock();
  const currentMonthStr = formatIsoMonth(now);
  const scheduleFileInputRef = useRef<HTMLInputElement>(null);
  const [scheduleToast, setScheduleToast] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETE' | 'INCOMPLETE' | 'LOCKED'>('ALL');
  const [monthFilter, setMonthFilter] = useState(currentMonthStr);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthStr);
    shifts.forEach((s) => {
      if (s.date && s.date.length >= 7) {
        set.add(s.date.substring(0, 7));
      }
    });
    // Bổ sung các tháng lân cận
    const baseDate = new Date();
    for (let offset = -2; offset <= 3; offset++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
      set.add(formatIsoMonth(d));
    }
    return Array.from(set).sort();
  }, [shifts, currentMonthStr]);

  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  // Tìm danh sách nhân sự đang hoạt động nhưng chưa có ca nào trong tháng
  const zeroDutyEmployees = useMemo(() => {
    const dutyMap = new Map<string, number>();
    employees.forEach((e) => dutyMap.set(e.id, 0));
    shifts.forEach((s) => {
      if (s.teacher1Id) dutyMap.set(s.teacher1Id, (dutyMap.get(s.teacher1Id) || 0) + 1);
      if (s.teacher2Id) dutyMap.set(s.teacher2Id, (dutyMap.get(s.teacher2Id) || 0) + 1);
      if (s.adminId) dutyMap.set(s.adminId, (dutyMap.get(s.adminId) || 0) + 1);
      if (s.guardId) dutyMap.set(s.guardId, (dutyMap.get(s.guardId) || 0) + 1);
    });
    return employees.filter((e) => e.isActive && (dutyMap.get(e.id) || 0) === 0);
  }, [employees, shifts]);

  // Cuộn mượt đến ca trực hôm nay
  const handleScrollToToday = () => {
    // Đảm bảo monthFilter bao gồm tháng của currentDutyDate
    const dutyMonth = currentDutyDate.substring(0, 7);
    if (monthFilter !== dutyMonth) {
      setMonthFilter(dutyMonth);
    }
    setTimeout(() => {
      const el = document.getElementById(`shift-row-${currentDutyDate}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-500');
        setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-500'), 2500);
      }
    }, 100);
  };

  // Lọc danh sách ca trực
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      // Lọc theo tháng
      if (monthFilter && !s.date.startsWith(monthFilter)) {
        return false;
      }

      // Lọc theo trạng thái
      if (statusFilter === 'COMPLETE' && s.status !== 'COMPLETE') return false;
      if (statusFilter === 'INCOMPLETE' && s.status === 'COMPLETE') return false;
      if (statusFilter === 'LOCKED' && !s.isLocked) return false;

      // Tìm kiếm theo tên hoặc SĐT nhân sự
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const t1 = s.teacher1Id ? empMap.get(s.teacher1Id) : null;
        const t2 = s.teacher2Id ? empMap.get(s.teacher2Id) : null;
        const admin = s.adminId ? empMap.get(s.adminId) : null;
        const guard = s.guardId ? empMap.get(s.guardId) : null;

        const matchT1 = t1 && (t1.name.toLowerCase().includes(query) || t1.phone.includes(query));
        const matchT2 = t2 && (t2.name.toLowerCase().includes(query) || t2.phone.includes(query));
        const matchAdmin =
          admin && (admin.name.toLowerCase().includes(query) || admin.phone.includes(query));
        const matchGuard =
          guard && (guard.name.toLowerCase().includes(query) || guard.phone.includes(query));
        const matchDate = s.date.includes(query);

        if (!matchT1 && !matchT2 && !matchAdmin && !matchGuard && !matchDate) {
          return false;
        }
      }

      return true;
    });
  }, [shifts, monthFilter, statusFilter, searchTerm, empMap]);

  const handleScheduleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await ExportService.parseScheduleExcel(file, employees);
      if (res.success && res.shifts.length > 0) {
        if (onImportSchedule) {
          onImportSchedule(res.shifts);
        }
        let msg = `Đã nhập thành công ${res.shifts.length} ngày trực từ tệp Excel!`;
        if (res.unmatchedNames.length > 0) {
          msg += ` (Không tìm thấy thông tin cho: ${res.unmatchedNames.slice(0, 3).join(', ')})`;
        }
        setScheduleToast({
          text: msg,
          type: res.unmatchedNames.length > 0 ? 'warning' : 'success',
        });
        setTimeout(() => setScheduleToast(null), 6000);
      } else {
        setScheduleToast({
          text: res.errors.join(' ') || 'Không tìm thấy dữ liệu ca trực hợp lệ trong tệp Excel.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setScheduleToast({
        text: `Lỗi khi đọc file lịch Excel: ${err?.message || 'Tệp không đúng định dạng'}`,
        type: 'error',
      });
    } finally {
      if (scheduleFileInputRef.current) scheduleFileInputRef.current.value = '';
    }
  };

  const canEdit = currentUserRole === 'ADMIN' || currentUserRole === 'BGH';

  const handleCellClick = (
    shift: ShiftAssignment,
    role: 'teacher1' | 'teacher2' | 'admin' | 'guard'
  ) => {
    if (shift.isLocked) {
      if (!canEdit) {
        setScheduleToast({
          text: `Ca trực ngày ${shift.date} đã được Ban Giám Hiệu khóa duyệt. Cán bộ không có quyền thay đổi ca này.`,
          type: 'error',
        });
        setTimeout(() => setScheduleToast(null), 4000);
        return;
      }

      const confirmUnlock = window.confirm(
        `Ca trực ngày ${shift.date} hiện đang ĐÃ KHÓA. Bạn có muốn mở khóa ca trực này để điều chỉnh nhân sự không?`
      );
      if (!confirmUnlock) return;
      onToggleLock(shift.id);
    }
    onOpenSwapModal(shift, role);
  };

  return (

    <div className="space-y-4">
      {/* Toast Notification Banner */}
      {scheduleToast && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs shadow-xs animate-in slide-in-from-top duration-200 ${
            scheduleToast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : scheduleToast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {scheduleToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : scheduleToast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <span className="font-medium">{scheduleToast.text}</span>
          </div>
          <button
            onClick={() => setScheduleToast(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Banner thông báo nếu có nhân sự mới chưa có ca */}
      {zeroDutyEmployees.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Phát hiện có <strong>{zeroDutyEmployees.length}</strong> nhân sự mới chưa có lịch trực trong tháng ({zeroDutyEmployees.map((e) => e.name).slice(0, 3).join(', ')}{zeroDutyEmployees.length > 3 ? '...' : ''}).
            </span>
          </div>
          {onOpenSyncModal && (
            <button
              onClick={() => onOpenSyncModal()}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer transition-colors shadow-2xs"
            >
              Đồng bộ lịch trực ngay
            </button>
          )}
        </div>
      )}

      {/* Top Filter and Actions Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search & Month Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên giáo viên, BGH, bảo vệ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Month Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="text-xs font-semibold py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {availableMonths.map((mStr) => {
                const [y, m] = mStr.split('-').map(Number);
                const isCur = mStr === currentMonthStr;
                return (
                  <option key={mStr} value={mStr}>
                    Tháng {m < 10 ? `0${m}` : m} / {y} {isCur ? '(Hiện tại)' : ''}
                  </option>
                );
              })}
              <option value="">Toàn bộ tất cả các tháng</option>
            </select>
          </div>

          {/* Button Cuộn Đến Ca Hôm Nay */}
          <button
            onClick={handleScrollToToday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>Đến ca đang trực hôm nay</span>
          </button>

          {/* Segmented Status Filters */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'ALL', label: 'Tất cả' },
                { id: 'COMPLETE', label: 'Đã đủ 4 người' },
                { id: 'INCOMPLETE', label: 'Chưa đủ' },
                { id: 'LOCKED', label: 'Đã khóa' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === item.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onNavigateAutoSchedule}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Mở phân hệ Xếp lịch tự động cho toàn trường"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Xếp Lịch Tự Động</span>
          </button>

          {onOpenSyncModal ? (
            <button
              onClick={() => onOpenSyncModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Đồng bộ lịch trực khi có nhân sự mới, cân bằng tải và lấp đầy ca trống"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Đồng Bộ Nhân Sự Mới</span>
              {zeroDutyEmployees.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full font-bold">
                  {zeroDutyEmployees.length}
                </span>
              )}
            </button>
          ) : onAutoFillShifts && (
            <button
              onClick={onAutoFillShifts}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold transition-colors border border-indigo-200 dark:border-indigo-800 cursor-pointer"
              title="Tự động lấp đầy các vị trí ca trực còn trống trong tháng"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Điền Tự Động Ca Trống</span>
            </button>
          )}

          {onImportSchedule && (
            <>
              <button
                onClick={() => scheduleFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Nhập bảng phân công ca trực từ tệp Excel"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nhập Lịch Excel</span>
              </button>
              <input
                type="file"
                ref={scheduleFileInputRef}
                onChange={handleScheduleFileUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
            </>
          )}

          <button
            onClick={() => onExportExcel(monthFilter)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-36">Ngày trực (24h)</th>
                <th className="py-3 px-3 w-48">Giáo viên trực 1</th>
                <th className="py-3 px-3 w-48">Giáo viên trực 2</th>
                <th className="py-3 px-3 w-44">Ban Giám Hiệu</th>
                <th className="py-3 px-3 w-40">Bảo vệ</th>
                <th className="py-3 px-3 w-28 text-center">Trạng thái</th>
                <th className="py-3 px-3 w-28 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Không tìm thấy ca trực nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredShifts.map((shift) => {
                  const dObj = parseDate(shift.date);
                  const isWeekend = shift.dayOfWeek === 0 || shift.dayOfWeek === 6;
                  const dayName = getDayNameVN(shift.dayOfWeek);
                  const formattedDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}`;
                  const isCurrentDuty = shift.date === currentDutyDate;

                  const t1 = shift.teacher1Id ? empMap.get(shift.teacher1Id) : null;
                  const t2 = shift.teacher2Id ? empMap.get(shift.teacher2Id) : null;
                  const admin = shift.adminId ? empMap.get(shift.adminId) : null;
                  const guard = shift.guardId ? empMap.get(shift.guardId) : null;

                  return (
                    <tr
                      id={`shift-row-${shift.date}`}
                      key={shift.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isCurrentDuty
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 font-medium'
                          : isWeekend
                            ? 'bg-indigo-50/20 dark:bg-indigo-950/10'
                            : ''
                      }`}
                    >
                      {/* Cột Ngày & Thứ */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm tabular-nums">
                            {formattedDate}
                          </span>
                          {isCurrentDuty && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Đang trực
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span
                            className={
                              isWeekend
                                ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                                : ''
                            }
                          >
                            {dayName}
                          </span>
                          {shift.isLocked && (
                            <span title="Ca trực đã khóa bảo vệ">
                              <Lock className="w-3 h-3 text-amber-500" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Giáo viên 1 */}
                      <td className="py-2.5 px-3">
                        {t1 ? (
                          <div
                            onClick={() => handleCellClick(shift, 'teacher1')}
                            className="group p-1.5 rounded-lg border border-transparent hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all"
                            title="Click để đổi nhân sự hoặc điều chỉnh vị trí này"
                          >
                            <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-between">
                              <span className="truncate">{t1.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-1">
                                {t1.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {t1.department}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCellClick(shift, 'teacher1')}
                            className="text-xs text-rose-500 hover:underline font-medium cursor-pointer"
                          >
                            + Phân công GV1
                          </button>
                        )}
                      </td>

                      {/* Giáo viên 2 */}
                      <td className="py-2.5 px-3">
                        {t2 ? (
                          <div
                            onClick={() => handleCellClick(shift, 'teacher2')}
                            className="group p-1.5 rounded-lg border border-transparent hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all"
                            title="Click để đổi nhân sự hoặc điều chỉnh vị trí này"
                          >
                            <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-between">
                              <span className="truncate">{t2.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-1">
                                {t2.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {t2.department}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCellClick(shift, 'teacher2')}
                            className="text-xs text-rose-500 hover:underline font-medium cursor-pointer"
                          >
                            + Phân công GV2
                          </button>
                        )}
                      </td>

                      {/* Ban Giám Hiệu */}
                      <td className="py-2.5 px-3">
                        {admin ? (
                          <div
                            onClick={() => handleCellClick(shift, 'admin')}
                            className="group p-1.5 rounded-lg border border-transparent hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all"
                            title="Click để đổi nhân sự hoặc điều chỉnh vị trí này"
                          >
                            <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-between">
                              <span className="truncate">{admin.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-1">
                                {admin.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {admin.phone}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCellClick(shift, 'admin')}
                            className="text-xs text-rose-500 hover:underline font-medium cursor-pointer"
                          >
                            + Phân công BGH
                          </button>
                        )}
                      </td>

                      {/* Bảo vệ */}
                      <td className="py-2.5 px-3">
                        {guard ? (
                          <div
                            onClick={() => handleCellClick(shift, 'guard')}
                            className="group p-1.5 rounded-lg border border-transparent hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all"
                            title="Click để đổi nhân sự hoặc điều chỉnh vị trí này"
                          >
                            <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-between">
                              <span className="truncate">{guard.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-1">
                                {guard.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {guard.phone}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCellClick(shift, 'guard')}
                            className="text-xs text-rose-500 hover:underline font-medium cursor-pointer"
                          >
                            + Phân công BV
                          </button>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-2.5 px-3 text-center">
                        {shift.status === 'COMPLETE' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/40">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã đủ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/40">
                            <AlertCircle className="w-3 h-3" />
                            <span>Thiếu người</span>
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút gửi Gmail */}
                          <button
                            onClick={() => onOpenGmailNotice(shift)}
                            title="Soạn và gửi thông báo Gmail cho ca trực này"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          {/* Khóa/Mở khóa */}
                          <button
                            onClick={() => onToggleLock(shift.id)}
                            title={shift.isLocked ? 'Mở khóa ca trực' : 'Khóa cố định ca trực'}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              shift.isLocked
                                ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {shift.isLocked ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Unlock className="w-4 h-4" />
                            )}
                          </button>

                          {/* Đổi ca nhanh */}
                          <button
                            onClick={() => onOpenSwapModal(shift)}
                            title="Điều chỉnh hoặc đổi nhân sự ca này"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
