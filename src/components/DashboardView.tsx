import React, { useState, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  CalendarCheck,
  AlertTriangle,
  Clock,
  Mail,
  ArrowRight,
  Sparkles,
  Phone,
  CheckCircle,
  FileText,
  UserPlus,
  CheckSquare,
  Square,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { Employee, ShiftAssignment, UnavailableDate, ShiftChangeRequest } from '../types';
import { getDayNameVN, parseDate } from '../services/scheduler';
import { useRealTimeClock } from '../hooks/useRealTimeClock';
import {
  getShiftProgress,
  formatIsoDate,
  formatIsoMonth,
  formatDateVN,
} from '../services/dateTimeUtils';

interface DashboardViewProps {
  employees: Employee[];
  shifts: ShiftAssignment[];
  unavailableDates: UnavailableDate[];
  changeRequests: ShiftChangeRequest[];
  onNavigateTab: (tab: string) => void;
  onOpenGmailNotice: (shift: ShiftAssignment) => void;
  onQuickSwap: (shift: ShiftAssignment) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  employees,
  shifts,
  unavailableDates,
  changeRequests,
  onNavigateTab,
  onOpenGmailNotice,
  onQuickSwap,
}) => {
  const { now, formattedTime, formattedDateFull, currentDutyDate, handoverStatus } =
    useRealTimeClock();

  // State quản lý biên bản kiểm tra bàn giao 07:00
  const [showHandoverProtocol, setShowHandoverProtocol] = useState<boolean>(
    handoverStatus.isHandoverWindow
  );
  const [handoverChecks, setHandoverChecks] = useState<Record<string, boolean>>({
    studentsCount: true,
    dormKeys: true,
    logBook: false,
    signature: false,
  });
  const [handoverDone, setHandoverDone] = useState<boolean>(false);

  const teacherCount = employees.filter((e) => e.role === 'TEACHER' && e.isActive).length;
  const adminCount = employees.filter((e) => e.role === 'ADMIN' && e.isActive).length;
  const guardCount = employees.filter((e) => e.role === 'GUARD' && e.isActive).length;

  const realCurrentMonthStr = formatIsoMonth(now);
  const [selectedMonth, setSelectedMonth] = useState<string>(realCurrentMonthStr);

  // Phân tích năm và tháng đang được chọn
  const [selectedYear, selectedMonthNum] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return [y || now.getFullYear(), m || now.getMonth() + 1];
  }, [selectedMonth, now]);

  const isCurrentMonth = selectedMonth === realCurrentMonthStr;

  // Danh sách các tháng có dữ liệu hoặc lân cận tháng hiện tại
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(realCurrentMonthStr);
    shifts.forEach((s) => {
      if (s.date && s.date.length >= 7) {
        set.add(s.date.substring(0, 7));
      }
    });
    // Bổ sung các tháng lân cận để chuyển đổi dễ dàng
    const baseDate = new Date();
    for (let offset = -2; offset <= 3; offset++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
      set.add(formatIsoMonth(d));
    }
    return Array.from(set).sort();
  }, [shifts, realCurrentMonthStr]);

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(formatIsoMonth(prevDate));
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(formatIsoMonth(nextDate));
  };

  const currentMonthShifts = shifts.filter((s) => s.date.startsWith(selectedMonth));
  const totalShiftsInMonth = currentMonthShifts.length;
  const completeShiftsCount = currentMonthShifts.filter((s) => s.status === 'COMPLETE').length;
  const incompleteShiftsCount = currentMonthShifts.filter(
    (s) => s.status === 'INCOMPLETE' || s.status === 'CONFLICT'
  ).length;

  const pendingLeaves = unavailableDates.filter((u) => u.status === 'PENDING');
  const pendingRequests = changeRequests.filter((r) => r.status === 'PENDING');

  // Lịch trực ca đang diễn ra theo mốc 07:00
  const todayShift = shifts.find((s) => s.date === currentDutyDate);

  // Lịch trực ca kế tiếp (ngày tiếp theo)
  const [curY, curM, curD] = currentDutyDate.split('-').map(Number);
  const nextDayObj = new Date(curY, curM - 1, curD + 1);
  const nextDutyDate = formatIsoDate(nextDayObj);
  const tomorrowShift = shifts.find((s) => s.date === nextDutyDate);

  const empMap = new Map<string, Employee>();
  employees.forEach((e) => empMap.set(e.id, e));

  const toggleHandoverCheck = (key: string) => {
    setHandoverChecks((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allHandoverChecked = Object.values(handoverChecks).every(Boolean);

  const renderShiftCard = (
    shift: ShiftAssignment | undefined,
    title: string,
    isCurrentDuty = false
  ) => {
    if (!shift) {
      return (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 text-center text-slate-500 py-10">
          <div className="font-semibold text-sm mb-1">{title}</div>
          <p className="text-xs text-slate-400 mb-3">Chưa có dữ liệu phân công cho ngày này.</p>
          <button
            onClick={() => onNavigateTab('auto-schedule')}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
          >
            Mở bộ xếp lịch tự động
          </button>
        </div>
      );
    }

    const t1 = shift.teacher1Id ? empMap.get(shift.teacher1Id) : null;
    const t2 = shift.teacher2Id ? empMap.get(shift.teacher2Id) : null;
    const admin = shift.adminId ? empMap.get(shift.adminId) : null;
    const guard = shift.guardId ? empMap.get(shift.guardId) : null;

    const dObj = parseDate(shift.date);
    const dayStr = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
    const dayName = getDayNameVN(shift.dayOfWeek);

    const progress = getShiftProgress(shift.date, now);

    return (
      <div
        className={`bg-white dark:bg-slate-900 rounded-xl p-5 border transition-all ${
          isCurrentDuty
            ? 'border-indigo-400 dark:border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
            : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                isCurrentDuty
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {isCurrentDuty && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
              {isCurrentDuty ? 'CA ĐANG DIỄN RA' : title}
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {dayName}, {dayStr}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="font-mono tabular-nums">07:00 - 07:00 hôm sau (24h)</span>
          </div>
        </div>

        {/* Real-time Shift Progress Bar (for ongoing shift) */}
        {isCurrentDuty && progress.isOngoing && (
          <div className="mb-4 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-lg border border-indigo-100 dark:border-indigo-900/60">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Tiến độ ca 24h:
              </span>
              <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                {progress.elapsedHours}h {progress.elapsedMinutes}m / 24h ({progress.percent}%)
              </span>
            </div>

            <div className="w-full bg-indigo-200/60 dark:bg-indigo-900/60 rounded-full h-2 overflow-hidden mb-2">
              <div
                className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress.percent}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span>Đã trực: {progress.elapsedHours} tiếng</span>
              <span className="font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                Còn lại: {progress.remainingHours}h {progress.remainingMinutes}m{' '}
                {progress.remainingSeconds}s đến giao ban 07:00
              </span>
            </div>
          </div>
        )}

        {/* 4 Nhân sự trong ca */}
        <div className="space-y-3">
          {/* Ban giám hiệu */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                1. BAN GIÁM HIỆU TRỰC (01 người)
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {admin ? admin.name : <span className="text-rose-500">Chưa phân công</span>}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {admin ? admin.department : ''}
              </div>
            </div>
            {admin && (
              <a
                href={`tel:${admin.phone}`}
                className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 hover:text-indigo-600 transition-colors"
              >
                <Phone className="w-3 h-3 text-indigo-500" />
                <span className="font-mono tabular-nums">{admin.phone}</span>
              </a>
            )}
          </div>

          {/* Giáo viên 1 & Giáo viên 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                2. GIÁO VIÊN TRỰC 1
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {t1 ? t1.name : <span className="text-rose-500">Chưa phân công</span>}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t1 ? `${t1.department} · ${t1.phone}` : ''}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                3. GIÁO VIÊN TRỰC 2
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {t2 ? t2.name : <span className="text-rose-500">Chưa phân công</span>}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t2 ? `${t2.department} · ${t2.phone}` : ''}
              </div>
            </div>
          </div>

          {/* Bảo vệ */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                4. NHÂN VIÊN BẢO VỆ (01 người)
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {guard ? guard.name : <span className="text-rose-500">Chưa phân công</span>}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {guard ? guard.department : ''}
              </div>
            </div>
            {guard && (
              <a
                href={`tel:${guard.phone}`}
                className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 hover:text-emerald-600 transition-colors"
              >
                <Phone className="w-3 h-3 text-emerald-500" />
                <span className="font-mono tabular-nums">{guard.phone}</span>
              </a>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={() => onQuickSwap(shift)}
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Đổi nhân sự ca này
          </button>

          <button
            onClick={() => onOpenGmailNotice(shift)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Gửi thông báo Gmail</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Real-time Handover Notification Banner (07:00 AM) */}
      <div
        className={`rounded-2xl p-5 border transition-all ${
          handoverStatus.isHandoverWindow
            ? 'bg-amber-500 text-white shadow-lg border-amber-600 ring-4 ring-amber-400/30'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                handoverStatus.isHandoverWindow
                  ? 'bg-white/20 text-white'
                  : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
              }`}
            >
              <Clock className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    handoverStatus.isHandoverWindow
                      ? 'bg-white text-amber-900 font-extrabold'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {handoverStatus.isHandoverWindow
                    ? 'ĐANG TRONG GIỜ BÀN GIAO CA (07:00)'
                    : 'QUY TRÌNH BÀN GIAO CA TRỰC 07:00'}
                </span>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    handoverStatus.isHandoverWindow
                      ? 'text-white/90'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Giờ thực tế: {formattedTime}
                </span>
              </div>
              <h3
                className={`text-base font-bold tracking-tight mt-1 ${
                  handoverStatus.isHandoverWindow
                    ? 'text-white'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                Chuyển Giao Nhiệm Vụ Quản Sinh Nội Trú — 07:00 Sáng Hàng Ngày
              </h3>
              <p
                className={`text-xs mt-0.5 max-w-2xl ${
                  handoverStatus.isHandoverWindow
                    ? 'text-white/90'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Kíp trực bàn giao (04 người kết thúc ca 24h) tiến hành kiểm tra sĩ số học sinh nội
                trú, kiểm đếm tài sản, bàn giao chìa khóa và sổ nhật ký cho kíp trực tiếp nhận mới.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowHandoverProtocol((v) => !v)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors ${
                handoverStatus.isHandoverWindow
                  ? 'bg-white text-amber-950 hover:bg-amber-50 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
              }`}
            >
              <span>{showHandoverProtocol ? 'Thu gọn biên bản' : 'Mở biên bản bàn giao'}</span>
              {showHandoverProtocol ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Handover Protocol & Checklist */}
        {showHandoverProtocol && (
          <div className="mt-5 pt-4 border-t border-amber-400/40 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Checklist */}
            <div className="bg-white/10 dark:bg-slate-800/80 p-4 rounded-xl backdrop-blur-sm border border-white/20 dark:border-slate-700 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <CheckCircle className="w-4 h-4" />
                <span>4 Bước Kiểm Tra Bắt Buộc Khi Bàn Giao Ca</span>
              </div>

              <div
                onClick={() => toggleHandoverCheck('studentsCount')}
                className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {handoverChecks.studentsCount ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 opacity-70 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-semibold">1. Điểm danh sĩ số học sinh nội trú</div>
                  <div className="text-[11px] opacity-80">
                    Xác nhận đủ số lượng học sinh tại các phòng; ghi rõ danh sách ốm hoặc có phép.
                  </div>
                </div>
              </div>

              <div
                onClick={() => toggleHandoverCheck('dormKeys')}
                className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {handoverChecks.dormKeys ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 opacity-70 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-semibold">2. Bàn giao chìa khóa & thiết bị an ninh</div>
                  <div className="text-[11px] opacity-80">
                    Chìa khóa cổng trường, khóa phòng quản sinh, bộ đàm liên lạc, đèn pin bảo vệ.
                  </div>
                </div>
              </div>

              <div
                onClick={() => toggleHandoverCheck('logBook')}
                className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {handoverChecks.logBook ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 opacity-70 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-semibold">3. Kiểm tra sổ nhật ký trực đêm</div>
                  <div className="text-[11px] opacity-80">
                    Bàn giao các ghi chép về tình hình an ninh trật tự, y tế phát sinh trong đêm.
                  </div>
                </div>
              </div>

              <div
                onClick={() => toggleHandoverCheck('signature')}
                className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {handoverChecks.signature ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 opacity-70 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-semibold">4. Ký biên bản bàn giao giữa 2 kíp trực</div>
                  <div className="text-[11px] opacity-80">
                    Đại diện Ban Giám Hiệu, Giáo viên và Bảo vệ 2 bên ký xác nhận hoàn tất.
                  </div>
                </div>
              </div>
            </div>

            {/* Outgoing & Incoming teams preview */}
            <div className="bg-white/10 dark:bg-slate-800/80 p-4 rounded-xl backdrop-blur-sm border border-white/20 dark:border-slate-700 flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide mb-3">
                  Đối Soát 2 Kíp Trực Bàn Giao
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2 rounded bg-black/10 dark:bg-slate-900/50">
                    <span className="font-bold text-amber-200 dark:text-amber-300">
                      Kíp Bàn Giao (Hết ca):
                    </span>{' '}
                    {todayShift ? (
                      <span>
                        BGH: {empMap.get(todayShift.adminId || '')?.name || '—'} · GV:{' '}
                        {empMap.get(todayShift.teacher1Id || '')?.name || '—'},{' '}
                        {empMap.get(todayShift.teacher2Id || '')?.name || '—'} · BV:{' '}
                        {empMap.get(todayShift.guardId || '')?.name || '—'}
                      </span>
                    ) : (
                      <span>Chưa có phân công</span>
                    )}
                  </div>

                  <div className="p-2 rounded bg-black/10 dark:bg-slate-900/50">
                    <span className="font-bold text-emerald-200 dark:text-emerald-300">
                      Kíp Tiếp Nhận (Nhận ca mới):
                    </span>{' '}
                    {tomorrowShift ? (
                      <span>
                        BGH: {empMap.get(tomorrowShift.adminId || '')?.name || '—'} · GV:{' '}
                        {empMap.get(tomorrowShift.teacher1Id || '')?.name || '—'},{' '}
                        {empMap.get(tomorrowShift.teacher2Id || '')?.name || '—'} · BV:{' '}
                        {empMap.get(tomorrowShift.guardId || '')?.name || '—'}
                      </span>
                    ) : (
                      <span>Chưa có phân công</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/20 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs opacity-90">
                  {allHandoverChecked
                    ? 'Đã đủ 4/4 điều kiện bàn giao'
                    : 'Cần tick đủ 4 điều kiện trên'}
                </span>
                <button
                  disabled={!allHandoverChecked || handoverDone}
                  onClick={() => setHandoverDone(true)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-xs ${
                    handoverDone
                      ? 'bg-emerald-600 text-white cursor-default'
                      : allHandoverChecked
                        ? 'bg-white text-indigo-900 hover:bg-indigo-50 font-bold'
                        : 'bg-white/30 text-white/60 cursor-not-allowed'
                  }`}
                >
                  {handoverDone ? '✓ Đã Lưu Biên Bản Bàn Giao' : 'Xác Nhận Đã Bàn Giao Ca'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-indigo-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hệ Thống Phân Công Lịch Trực Quản Sinh Nội Trú</span>
          </div>

          {/* Tiêu đề H2 tự động thay đổi theo tháng hiện tại hoặc tháng đang chọn */}
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 flex-wrap">
            <span>Điều hành Lịch trực Tháng {selectedMonthNum} / {selectedYear}</span>
            {isCurrentMonth ? (
              <span className="text-[11px] font-semibold bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Tháng hiện tại
              </span>
            ) : (
              <span className="text-[11px] font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                Tháng đã chọn
              </span>
            )}
          </h2>

          {/* Bộ điều khiển tự đổi và chọn theo từng tháng */}
          <div className="flex items-center gap-2 mt-2.5 mb-2">
            <div className="inline-flex items-center bg-white/10 backdrop-blur-xs rounded-lg p-0.5 border border-white/20 text-xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Xem tháng trước"
                className="p-1 hover:bg-white/20 rounded transition-colors text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white font-semibold px-2 py-0.5 text-xs focus:outline-none cursor-pointer [&>option]:text-slate-900 [&>option]:bg-white"
              >
                {availableMonths.map((mStr) => {
                  const [y, m] = mStr.split('-').map(Number);
                  const isCur = mStr === realCurrentMonthStr;
                  return (
                    <option key={mStr} value={mStr}>
                      Tháng {m < 10 ? `0${m}` : m} / {y} {isCur ? '★ (Hiện tại)' : ''}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={handleNextMonth}
                title="Xem tháng tiếp theo"
                className="p-1 hover:bg-white/20 rounded transition-colors text-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth(realCurrentMonthStr)}
                className="text-[11px] font-semibold px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors border border-white/20 cursor-pointer"
              >
                Về tháng hiện tại
              </button>
            )}
          </div>

          <p className="text-indigo-200/80 text-xs mt-1 max-w-xl">
            Tự động tối ưu hóa kíp trực 24 giờ, đảm bảo 02 Giáo viên, 01 Ban Giám hiệu, 01 Bảo vệ
            mỗi ngày; chống trực liên tiếp và cân bằng số ca tuyệt đối.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigateTab('auto-schedule')}
            className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tự Động Xếp Lịch</span>
          </button>
          <button
            onClick={() => onNavigateTab('export')}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>In / Xuất Lịch</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Giáo Viên</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums mt-1">
            {teacherCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">2 người / ca</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ban Giám Hiệu</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums mt-1">
            {adminCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">1 người / ca</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nhân Viên Bảo Vệ</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums mt-1">
            {guardCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">1 người / ca</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng Ca Trong Tháng</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums mt-1">
            {totalShiftsInMonth}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Tháng {selectedMonthNum}/{selectedYear}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Đã Phân Công Đủ</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {completeShiftsCount}
          </div>
          <div className="text-[11px] text-emerald-500 mt-1">Đủ 4 người / ca</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">Cần Xử Lý / Thiếu</div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-1">
            {incompleteShiftsCount}
          </div>
          <div className="text-[11px] text-rose-500 mt-1">Cần điều chỉnh</div>
        </div>
      </div>

      {/* Two Column Grid: Shift Cards (Today & Tomorrow) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ongoing / Today's Shift */}
        <div>{renderShiftCard(todayShift, 'Lịch Trực Ca Hôm Nay', true)}</div>

        {/* Tomorrow's Shift */}
        <div>{renderShiftCard(tomorrowShift, 'Lịch Trực Ca Kế Tiếp', false)}</div>
      </div>

      {/* Pending Items & Quick Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Leave Requests */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Đơn Xin Nghỉ Phép / Lịch Bận Cần Duyệt ({pendingLeaves.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('leaves')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {pendingLeaves.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              Không có đơn xin nghỉ phép nào đang chờ duyệt.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingLeaves.slice(0, 3).map((leave) => {
                const emp = empMap.get(leave.employeeId);
                return (
                  <div
                    key={leave.id}
                    className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {emp?.name} ({emp?.code})
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Ngày:{' '}
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          {leave.date}
                        </span>{' '}
                        · {leave.reason}
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigateTab('leaves')}
                      className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      Duyệt ngay
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Audit / Quick Rules Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Quy Tắc An Toàn Ca Trực Đang Kích Hoạt
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('tests')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Xem 12 Test cases</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Thời lượng ca 24 tiếng liên tục:
                </span>{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  Từ 07:00 sáng hôm nay đến 07:00 sáng hôm sau.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Chống trực 2 ngày liên tiếp:
                </span>{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  Bắt buộc giãn cách tối thiểu 24 tiếng sau khi kết thúc ca trực.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Định mức quân số bắt buộc:
                </span>{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  Chính xác 02 Giáo viên + 01 Ban Giám Hiệu + 01 Bảo vệ (04 người/ca).
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
