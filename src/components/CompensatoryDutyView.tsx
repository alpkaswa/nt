import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  Plus,
  ArrowRight,
  UserCheck,
  CalendarCheck,
  Trash2,
  Check,
  X,
  Filter,
  Search,
} from 'lucide-react';
import {
  CompensatoryDuty,
  CompensatoryStatus,
  Employee,
  ShiftAssignment,
  ScheduleSettings,
  UnavailableDate,
  AppUserRole,
} from '../types';
import {
  formatFullTimestampVN,
  autoScheduleCompensatoryDuty,
  validateManualAssignment,
  getDayNameVN,
  parseDate,
} from '../services/scheduler';

interface CompensatoryDutyViewProps {
  compensatoryDuties: CompensatoryDuty[];
  employees: Employee[];
  shifts: ShiftAssignment[];
  unavailableDates: UnavailableDate[];
  settings: ScheduleSettings;
  currentUserRole: AppUserRole;
  onUpdateDuties: (duties: CompensatoryDuty[]) => void;
  onUpdateShifts: (shifts: ShiftAssignment[]) => void;
  onShowNotification: (title: string, message: string, type: 'success' | 'warning' | 'info') => void;
}

export const CompensatoryDutyView: React.FC<CompensatoryDutyViewProps> = ({
  compensatoryDuties,
  employees,
  shifts,
  unavailableDates,
  settings,
  currentUserRole,
  onUpdateDuties,
  onUpdateShifts,
  onShowNotification,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | CompensatoryStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isManualAssignModalOpen, setIsManualAssignModalOpen] = useState(false);
  const [selectedDutyForManual, setSelectedDutyForManual] = useState<CompensatoryDuty | null>(null);

  // Manual Assign Form state
  const [manualShiftDate, setManualShiftDate] = useState('');
  const [manualPosition, setManualPosition] = useState<'teacher1' | 'teacher2' | 'admin' | 'guard'>('teacher1');

  // New Duty Form Modal
  const [isNewDebtModalOpen, setIsNewDebtModalOpen] = useState(false);
  const [newDebtorId, setNewDebtorId] = useState(employees[0]?.id || '');
  const [newCreditorId, setNewCreditorId] = useState('');
  const [newOriginalDate, setNewOriginalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newReason, setNewReason] = useState('');

  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const canManage = currentUserRole === 'ADMIN' || currentUserRole === 'BGH';

  // Lọc danh sách
  const filteredDuties = useMemo(() => {
    return compensatoryDuties.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const debtor = empMap.get(item.debtorEmployeeId);
        const creditor = item.creditorEmployeeId ? empMap.get(item.creditorEmployeeId) : null;
        return (
          item.originalShiftDate.includes(q) ||
          item.reason.toLowerCase().includes(q) ||
          (debtor && debtor.name.toLowerCase().includes(q)) ||
          (debtor && debtor.code.toLowerCase().includes(q)) ||
          (creditor && creditor.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [compensatoryDuties, statusFilter, searchTerm, empMap]);

  // Thống kê
  const pendingCount = compensatoryDuties.filter((d) => d.status === 'PENDING').length;
  const scheduledCount = compensatoryDuties.filter((d) => d.status === 'SCHEDULED').length;
  const completedCount = compensatoryDuties.filter((d) => d.status === 'COMPLETED').length;
  const coveredCount = compensatoryDuties.filter((d) => d.creditorEmployeeId).length;

  // Xử lý tự động bố trí trực bù cho toàn bộ danh sách đang nợ
  const handleAutoScheduleAllPending = () => {
    const pendingList = compensatoryDuties.filter((d) => d.status === 'PENDING');
    if (pendingList.length === 0) {
      onShowNotification(
        'Thông Báo Trực Bù',
        'Hiện tại không có nhân sự nào đang nợ ca trực bù chờ xếp lịch.',
        'info'
      );
      return;
    }

    let currentShiftsCopy = [...shifts];
    let updatedDutiesCopy = [...compensatoryDuties];
    let successCount = 0;
    const messages: string[] = [];

    for (const duty of pendingList) {
      const res = autoScheduleCompensatoryDuty(
        duty,
        currentShiftsCopy,
        employees,
        unavailableDates,
        settings
      );

      if (res.success) {
        currentShiftsCopy = res.updatedShifts;
        updatedDutiesCopy = updatedDutiesCopy.map((d) => (d.id === duty.id ? res.updatedDuty : d));
        successCount++;
        messages.push(res.message);
      }
    }

    if (successCount > 0) {
      onUpdateShifts(currentShiftsCopy);
      onUpdateDuties(updatedDutiesCopy);
      onShowNotification(
        'Phân Công Trực Bù Tự Động Thành Công',
        `Đã tự động bố trí ca trực bù cho ${successCount}/${pendingList.length} lượt nợ ca. Thời gian ghi nhận chuẩn xác đến từng giây.`,
        'success'
      );
    } else {
      onShowNotification(
        'Chưa Tìm Thấy Ca Trống Phù Hợp',
        'Các ca trực còn lại đã đủ quân số hoặc các ứng viên bị vướng quy định nghỉ 24h giữa 2 ca.',
        'warning'
      );
    }
  };

  // Tự động xếp cho 1 cá nhân
  const handleAutoScheduleSingle = (duty: CompensatoryDuty) => {
    const res = autoScheduleCompensatoryDuty(
      duty,
      shifts,
      employees,
      unavailableDates,
      settings
    );

    if (res.success) {
      onUpdateShifts(res.updatedShifts);
      const updated = compensatoryDuties.map((d) => (d.id === duty.id ? res.updatedDuty : d));
      onUpdateDuties(updated);
      onShowNotification('Phân Công Trực Bù Thành Công', res.message, 'success');
    } else {
      onShowNotification('Không Thể Tự Động Xếp Bù', res.message, 'warning');
    }
  };

  // Xác nhận xếp bù thủ công
  const handleConfirmManualAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDutyForManual || !manualShiftDate) return;

    const debtor = empMap.get(selectedDutyForManual.debtorEmployeeId);
    if (!debtor) return;

    // Kiểm định điều kiện 24h
    const val = validateManualAssignment(
      manualShiftDate,
      manualPosition,
      debtor.id,
      shifts,
      employees,
      unavailableDates,
      settings
    );

    if (!val.isValid) {
      onShowNotification('Không Thể Phân Công Trực Bù', `Vi phạm quy chế: ${val.errors.join('; ')}`, 'warning');
      return;
    }

    // Cập nhật ca trực
    const targetShift = shifts.find((s) => s.date === manualShiftDate);
    if (!targetShift) {
      onShowNotification('Lỗi Phân Công', 'Không tìm thấy ca trực ngày đã chọn.', 'warning');
      return;
    }

    const updatedShift: ShiftAssignment = {
      ...targetShift,
      [manualPosition]: debtor.id,
    };
    const isComplete =
      updatedShift.teacher1Id &&
      updatedShift.teacher2Id &&
      updatedShift.adminId &&
      updatedShift.guardId;
    updatedShift.status = isComplete ? 'COMPLETE' : 'INCOMPLETE';

    const updatedShifts = shifts.map((s) => (s.id === targetShift.id ? updatedShift : s));
    onUpdateShifts(updatedShifts);

    const nowIso = new Date().toISOString();
    const updatedDuties = compensatoryDuties.map((d) =>
      d.id === selectedDutyForManual.id
        ? {
            ...d,
            status: 'SCHEDULED' as CompensatoryStatus,
            compensatedShiftDate: manualShiftDate,
            compensatedRolePosition: manualPosition,
            compensatedAt: nowIso,
            notes: `Ban Giám Hiệu chỉ định trực bù vào ca ngày ${manualShiftDate} (${manualPosition}) ghi nhận lúc ${formatFullTimestampVN(nowIso)}`,
          }
        : d
    );
    onUpdateDuties(updatedDuties);

    setIsManualAssignModalOpen(false);
    onShowNotification(
      'Chỉ Định Trực Bù Thành Công',
      `Đã xếp ${debtor.name} trực bù vào ca ngày ${manualShiftDate} (${manualPosition}) lúc ${formatFullTimestampVN(nowIso)}.`,
      'success'
    );
  };

  // Đánh dấu hoàn thành
  const handleMarkCompleted = (dutyId: string) => {
    const nowIso = new Date().toISOString();
    const updated = compensatoryDuties.map((d) =>
      d.id === dutyId
        ? {
            ...d,
            status: 'COMPLETED' as CompensatoryStatus,
            compensatedAt: d.compensatedAt || nowIso,
            notes: `${d.notes ? `${d.notes} · ` : ''}Đã hoàn thành xác nhận lúc ${formatFullTimestampVN(nowIso)}`,
          }
        : d
    );
    onUpdateDuties(updated);
    onShowNotification(
      'Xác Nhận Hoàn Thành Trực Bù',
      `Đã ghi nhận hoàn tất ca trực bù lúc ${formatFullTimestampVN(nowIso)}.`,
      'success'
    );
  };

  // Xóa bản ghi
  const handleDeleteDuty = (dutyId: string) => {
    if (!confirm('Bạn có chắc muốn xóa bản ghi theo dõi trực bù này?')) return;
    const updated = compensatoryDuties.filter((d) => d.id !== dutyId);
    onUpdateDuties(updated);
  };

  // Tạo nợ ca trực bù thủ công
  const handleCreateManualDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDebtorId || !newOriginalDate || !newReason.trim()) return;

    const nowIso = new Date().toISOString();
    const newDebt: CompensatoryDuty = {
      id: `comp-${Date.now()}`,
      debtorEmployeeId: newDebtorId,
      creditorEmployeeId: newCreditorId || undefined,
      originalShiftDate: newOriginalDate,
      reason: newReason.trim(),
      sourceType: 'MANUAL_DEBT',
      status: 'PENDING',
      createdAt: nowIso,
    };

    onUpdateDuties([newDebt, ...compensatoryDuties]);
    setIsNewDebtModalOpen(false);
    setNewReason('');
    onShowNotification(
      'Ghi Nhận Nghĩa Vụ Trực Bù Mới',
      `Đã tạo bản ghi nợ ca trực bù chính xác lúc ${formatFullTimestampVN(nowIso)}.`,
      'success'
    );
  };

  const getStatusBadge = (status: CompensatoryStatus) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3" />
            <span>Đã hoàn thành</span>
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/40">
            <CalendarCheck className="w-3 h-3" />
            <span>Đã xếp lịch bù</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
            <Clock className="w-3 h-3" />
            <span>Đang nợ ca bù</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner & KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Đang Nợ Ca Trực Bù</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {pendingCount} ca
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Chờ xếp lịch bù</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Đã Xếp Lịch Trực Bù</span>
            <CalendarCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
            {scheduledCount} ca
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Đã có ngày trực bù</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Đã Hoàn Thành Bù</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {completedCount} ca
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Đã thực hiện xong</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Số Ca Đã Trực Thay</span>
            <UserCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
            {coveredCount} ca
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Đồng nghiệp hỗ trợ</div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên giáo viên, mã số, lý do..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Status Segmented Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
            {(
              [
                { id: 'ALL', label: `Tất cả (${compensatoryDuties.length})` },
                { id: 'PENDING', label: `Nợ ca bù (${pendingCount})` },
                { id: 'SCHEDULED', label: `Đã xếp (${scheduledCount})` },
                { id: 'COMPLETED', label: `Đã xong (${completedCount})` },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
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
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNewDebtModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi Nhận Nợ Ca Bù</span>
            </button>

            <button
              onClick={handleAutoScheduleAllPending}
              disabled={pendingCount === 0}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-white rounded-lg text-xs font-bold shadow-xs transition-colors ${
                pendingCount > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tự Động Bố Trí Trực Bù</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Table with Exact Timestamp Tracking */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-48">Nhân sự nợ ca trực bù</th>
                <th className="py-3 px-3 w-44">Ca gốc & Người trực thay</th>
                <th className="py-3 px-3">Lý do phát sinh nợ ca</th>
                <th className="py-3 px-3 w-48 font-mono text-indigo-700 dark:text-indigo-400">
                  Thời điểm ghi nhận (Giờ:Phút:Giây)
                </th>
                <th className="py-3 px-3 w-44">Lịch trực bù được xếp</th>
                <th className="py-3 px-3 w-28 text-center">Trạng thái</th>
                {canManage && <th className="py-3 px-4 w-36 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredDuties.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="text-center py-12 text-slate-400">
                    Không có bản ghi trực bù nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredDuties.map((duty) => {
                  const debtor = empMap.get(duty.debtorEmployeeId);
                  const creditor = duty.creditorEmployeeId
                    ? empMap.get(duty.creditorEmployeeId)
                    : null;

                  return (
                    <tr
                      key={duty.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Debtor */}
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {debtor ? debtor.name : 'Chưa xác định'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {debtor ? `${debtor.code} · ${debtor.department}` : ''}
                        </div>
                      </td>

                      {/* Original Shift & Creditor */}
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {duty.originalShiftDate}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {creditor ? (
                            <span>
                              Được <span className="font-semibold text-slate-700 dark:text-slate-300">{creditor.name}</span> trực thay
                            </span>
                          ) : (
                            <span className="italic">Chưa có người trực thay</span>
                          )}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-2.5 px-3">
                        <div className="text-slate-700 dark:text-slate-300">{duty.reason}</div>
                        {duty.notes && (
                          <div className="text-[10px] text-slate-400 mt-0.5 italic">
                            {duty.notes}
                          </div>
                        )}
                      </td>

                      {/* Exact Created Timestamp: HH:mm:ss DD/MM/YYYY */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-400">
                          <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span>{formatFullTimestampVN(duty.createdAt)}</span>
                        </div>
                      </td>

                      {/* Compensated Shift Schedule */}
                      <td className="py-2.5 px-3">
                        {duty.compensatedShiftDate ? (
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-indigo-500" />
                              <span>{duty.compensatedShiftDate}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({duty.compensatedRolePosition})
                              </span>
                            </div>
                            {duty.compensatedAt && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Ghi nhận: {formatFullTimestampVN(duty.compensatedAt)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Chưa bố trí ca bù</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">{getStatusBadge(duty.status)}</td>

                      {/* Actions */}
                      {canManage && (
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {duty.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleAutoScheduleSingle(duty)}
                                  title="Tự động xếp bù cho nhân sự này"
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors"
                                >
                                  <Sparkles className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedDutyForManual(duty);
                                    setManualShiftDate(shifts.find((s) => s.status !== 'COMPLETE')?.date || '2026-11-10');
                                    setIsManualAssignModalOpen(true);
                                  }}
                                  title="Chỉ định ca trực bù thủ công"
                                  className="p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                >
                                  <Calendar className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {duty.status === 'SCHEDULED' && (
                              <button
                                onClick={() => handleMarkCompleted(duty.id)}
                                title="Đánh dấu đã hoàn thành ca trực bù"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteDuty(duty.id)}
                              title="Xóa bản ghi này"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Compensatory Assignment Modal */}
      {isManualAssignModalOpen && selectedDutyForManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Chỉ Định Ca Trực Bù Thủ Công
              </h3>
              <button
                onClick={() => setIsManualAssignModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmManualAssign} className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Nhân sự nợ ca:</span>{' '}
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {empMap.get(selectedDutyForManual.debtorEmployeeId)?.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Ca gốc bị vắng:</span>{' '}
                  <span className="font-mono font-semibold">{selectedDutyForManual.originalShiftDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">Lý do:</span> {selectedDutyForManual.reason}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn Ngày Trực Bù <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={manualShiftDate}
                  onChange={(e) => setManualShiftDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vị Trí Phân Công Trong Ca Trực Bù <span className="text-rose-500">*</span>
                </label>
                <select
                  value={manualPosition}
                  onChange={(e) =>
                    setManualPosition(e.target.value as 'teacher1' | 'teacher2' | 'admin' | 'guard')
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="teacher1">Giáo viên trực 1</option>
                  <option value="teacher2">Giáo viên trực 2</option>
                  <option value="admin">Ban Giám Hiệu</option>
                  <option value="guard">Bảo vệ</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualAssignModalOpen(false)}
                  className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Xác Nhận & Ghi Nhận Lúc Này
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Manual Debt Modal */}
      {isNewDebtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Ghi Nhận Nghĩa Vụ Trực Bù Mới
              </h3>
              <button
                onClick={() => setIsNewDebtModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualDebt} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Người Nợ Ca Trực Bù <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newDebtorId}
                  onChange={(e) => setNewDebtorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.code}) - {e.department}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Người Đã Trực Thay (Nếu Có)
                </label>
                <select
                  value={newCreditorId}
                  onChange={(e) => setNewCreditorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">-- Không có / BGH chỉ định sau --</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.code}) - {e.department}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ngày Ca Gốc Bị Vắng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={newOriginalDate}
                  onChange={(e) => setNewOriginalDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lý Do Nợ Ca Bù <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nghỉ phép có việc hiếu hỉ, đổi ca đi công tác..."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewDebtModalOpen(false)}
                  className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Lưu & Ghi Nhận Giờ:Phút:Giây
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
