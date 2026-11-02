import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  UserCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldAlert,
  BarChart2,
  Users,
  RefreshCw,
  Clock,
  Layers,
} from 'lucide-react';
import {
  Employee,
  ShiftAssignment,
  UnavailableDate,
  ScheduleSettings,
  ShiftChangeHistory,
} from '../types';
import {
  syncScheduleForNewEmployees,
  SyncNewEmployeeResult,
  getDayNameVN,
  parseDate,
} from '../services/scheduler';

interface SyncNewEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  shifts: ShiftAssignment[];
  unavailableDates: UnavailableDate[];
  settings: ScheduleSettings;
  preselectedEmployeeId?: string | null;
  onApplySync: (
    updatedShifts: ShiftAssignment[],
    historyRecords: ShiftChangeHistory[],
    summaryMessage: string
  ) => void;
}

export const SyncNewEmployeeModal: React.FC<SyncNewEmployeeModalProps> = ({
  isOpen,
  onClose,
  employees,
  shifts,
  unavailableDates,
  settings,
  preselectedEmployeeId,
  onApplySync,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Tính số ca hiện tại của từng nhân sự
  const dutyCounts = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach((e) => map.set(e.id, 0));
    shifts.forEach((s) => {
      if (s.teacher1Id) map.set(s.teacher1Id, (map.get(s.teacher1Id) || 0) + 1);
      if (s.teacher2Id) map.set(s.teacher2Id, (map.get(s.teacher2Id) || 0) + 1);
      if (s.adminId) map.set(s.adminId, (map.get(s.adminId) || 0) + 1);
      if (s.guardId) map.set(s.guardId, (map.get(s.guardId) || 0) + 1);
    });
    return map;
  }, [employees, shifts]);

  // Danh sách các nhân sự mới hoặc có số ca ít (0 hoặc 1 ca)
  const zeroDutyEmployees = useMemo(() => {
    return employees.filter((e) => e.isActive && (dutyCounts.get(e.id) || 0) === 0);
  }, [employees, dutyCounts]);

  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>(() => {
    if (preselectedEmployeeId) return [preselectedEmployeeId];
    if (zeroDutyEmployees.length > 0) return zeroDutyEmployees.map((e) => e.id);
    return [];
  });

  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [strategy, setStrategy] = useState<'REBALANCE_FAIR' | 'FILL_EMPTY' | 'RESCHEDULE_FUTURE'>(
    'REBALANCE_FAIR'
  );
  const [previewResult, setPreviewResult] = useState<SyncNewEmployeeResult | null>(null);

  // Cập nhật lại khi preselectedEmployeeId thay đổi
  React.useEffect(() => {
    if (preselectedEmployeeId) {
      setSelectedEmpIds([preselectedEmployeeId]);
    } else if (zeroDutyEmployees.length > 0) {
      setSelectedEmpIds(zeroDutyEmployees.map((e) => e.id));
    }
    setPreviewResult(null);
  }, [preselectedEmployeeId, isOpen, zeroDutyEmployees]);

  if (!isOpen) return null;

  const toggleSelectEmp = (id: string) => {
    setPreviewResult(null);
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllZeroDuty = () => {
    setPreviewResult(null);
    setSelectedEmpIds(zeroDutyEmployees.map((e) => e.id));
  };

  const handleSelectAllActive = () => {
    setPreviewResult(null);
    setSelectedEmpIds(employees.filter((e) => e.isActive).map((e) => e.id));
  };

  const handleCalculatePreview = () => {
    if (selectedEmpIds.length === 0) return;

    const res = syncScheduleForNewEmployees({
      targetEmployeeIds: selectedEmpIds,
      employees,
      currentShifts: shifts,
      unavailableDates,
      settings,
      fromDate,
      strategy,
    });

    setPreviewResult(res);
  };

  const handleConfirmApply = () => {
    if (!previewResult) return;

    const fullHistory: ShiftChangeHistory[] = previewResult.historyRecords.map((r, idx) => ({
      id: `hist-sync-${Date.now()}-${idx}`,
      shiftDate: r.shiftDate,
      rolePosition: r.rolePosition,
      previousEmployeeId: r.previousEmployeeId,
      newEmployeeId: r.newEmployeeId,
      reason: r.reason,
      changedBy: r.changedBy,
      timestamp: r.timestamp,
    }));

    onApplySync(previewResult.updatedShifts, fullHistory, previewResult.summary);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Đồng Bộ Lịch Trực Khi Có Nhân Sự Mới</span>
                {zeroDutyEmployees.length > 0 && (
                  <span className="text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                    {zeroDutyEmployees.length} cán bộ chưa có ca
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tự động rà soát, phân bổ và tái cân bằng ca trực công bằng cho cán bộ, giáo viên mới tiếp nhận.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Chọn nhân sự cần đồng bộ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>1. Chọn nhân sự mới cần xếp lịch trực ({selectedEmpIds.length} đã chọn)</span>
              </label>

              <div className="flex items-center gap-2 text-xs">
                {zeroDutyEmployees.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllZeroDuty}
                    className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Chọn {zeroDutyEmployees.length} người chưa có ca (0 ca)
                  </button>
                )}
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleSelectAllActive}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Chọn tất cả
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewResult(null);
                    setSelectedEmpIds([]);
                  }}
                  className="text-xs font-medium text-slate-500 hover:underline cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            {/* Employee Badges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              {employees
                .filter((e) => e.isActive)
                .map((emp) => {
                  const duty = dutyCounts.get(emp.id) || 0;
                  const isChecked = selectedEmpIds.includes(emp.id);
                  const isZero = duty === 0;

                  return (
                    <label
                      key={emp.id}
                      onClick={() => toggleSelectEmp(emp.id)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-200 shadow-2xs'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by parent label
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 shrink-0"
                        />
                        <div className="truncate">
                          <span className="font-semibold">{emp.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1.5 font-mono">
                            ({emp.code})
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 ml-2">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isZero
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {duty} ca
                        </span>
                      </div>
                    </label>
                  );
                })}
            </div>
          </div>

          {/* Step 2 & 3: Thời điểm và Phương án đồng bộ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Start Date */}
            <div className="space-y-1.5 md:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>2. Bắt đầu từ ngày</span>
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setPreviewResult(null);
                  setFromDate(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Các ca trước ngày này và các ca đã khóa (🔒) sẽ được bảo toàn nguyên vẹn.
              </p>
            </div>

            {/* Sync Strategy */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>3. Chọn phương án điều phối ca trực</span>
              </label>

              <div className="grid grid-cols-1 gap-2">
                {/* Mode 1 */}
                <label
                  onClick={() => {
                    setPreviewResult(null);
                    setStrategy('REBALANCE_FAIR');
                  }}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    strategy === 'REBALANCE_FAIR'
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === 'REBALANCE_FAIR'}
                    onChange={() => {}}
                    className="mt-0.5 text-indigo-600"
                  />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span>Tái cân bằng công bằng & San sẻ ca trực</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-300 dark:border-emerald-800">
                        Khuyến nghị
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      Điền ca trống trước, sau đó chuyển bớt 1-3 ca từ cán bộ đang trực nhiều nhất sang cho nhân sự mới. Đảm bảo số ca chia đều và tuân thủ tuyệt đối quy định nghỉ 24 giờ.
                    </p>
                  </div>
                </label>

                {/* Mode 2 */}
                <label
                  onClick={() => {
                    setPreviewResult(null);
                    setStrategy('FILL_EMPTY');
                  }}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    strategy === 'FILL_EMPTY'
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === 'FILL_EMPTY'}
                    onChange={() => {}}
                    className="mt-0.5 text-indigo-600"
                  />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      Chỉ điền vào các vị trí ca trực còn khuyết / còn trống
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      Giữ nguyên 100% ca trực đã phân công của các cán bộ khác, chỉ bổ sung nhân sự mới vào các ca chưa đủ người.
                    </p>
                  </div>
                </label>

                {/* Mode 3 */}
                <label
                  onClick={() => {
                    setPreviewResult(null);
                    setStrategy('RESCHEDULE_FUTURE');
                  }}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    strategy === 'RESCHEDULE_FUTURE'
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === 'RESCHEDULE_FUTURE'}
                    onChange={() => {}}
                    className="mt-0.5 text-indigo-600"
                  />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      Xếp lại toàn bộ lịch tương lai từ ngày chỉ định
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      Chạy lại thuật toán xếp lịch tự động cho toàn bộ các ngày tiếp theo với đủ nhân sự mới, vẫn giữ nguyên các ca trực đã bấm khóa (🔒).
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Button Xem trước */}
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleCalculatePreview}
              disabled={selectedEmpIds.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Chạy Tính Toán & Xem Trước Kết Quả Phân Bổ</span>
            </button>
          </div>

          {/* Preview Section */}
          {previewResult && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
              {/* Summary Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                  previewResult.totalAssigned > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}
              >
                {previewResult.totalAssigned > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-sm">
                    {previewResult.totalAssigned > 0
                      ? `Phát hiện phương án khả thi: Phân bổ được ${previewResult.totalAssigned} ca trực mới!`
                      : 'Không tìm thấy ca trực trống hoặc điều chuyển hợp lệ.'}
                  </div>
                  <div className="mt-1">{previewResult.summary}</div>
                </div>
              </div>

              {/* Assignment Details Table */}
              {previewResult.details.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Chi tiết các ca trực được đồng bộ cho nhân sự mới ({previewResult.details.length} ca)
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                          <th className="py-2.5 px-3">Ngày trực</th>
                          <th className="py-2.5 px-3">Vị trí</th>
                          <th className="py-2.5 px-3">Nhân sự mới tiếp nhận</th>
                          <th className="py-2.5 px-3">Hình thức phân bổ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {previewResult.details.map((d, idx) => {
                          const dObj = parseDate(d.date);
                          const dateFmt = `${String(dObj.getDate()).padStart(2, '0')}/${String(
                            dObj.getMonth() + 1
                          ).padStart(2, '0')}/${dObj.getFullYear()}`;
                          const dayName = getDayNameVN(d.dayOfWeek);

                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2 px-3 font-mono font-semibold text-slate-800 dark:text-slate-100">
                                {dateFmt}{' '}
                                <span className="font-normal text-slate-500 font-sans">
                                  ({dayName})
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">
                                {d.roleName}
                              </td>
                              <td className="py-2 px-3">
                                <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                  {d.employeeName}
                                </span>{' '}
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({d.employeeCode})
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {d.type === 'FILL_EMPTY' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Lấp đầy ca còn khuyết
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                    <ArrowRight className="w-3 h-3" />
                                    San sẻ từ {d.replacedEmployeeName || 'đồng nghiệp khác'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Workload Comparison */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Biến động số ca trực trong tháng (Trước vs Sau đồng bộ)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {selectedEmpIds.map((id) => {
                    const emp = employees.find((e) => e.id === id);
                    if (!emp) return null;
                    const before = previewResult.workloadBefore[id] || 0;
                    const after = previewResult.workloadAfter[id] || 0;
                    const diff = after - before;

                    return (
                      <div
                        key={id}
                        className="p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/30 text-xs"
                      >
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {emp.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{emp.code}</div>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-indigo-100 dark:border-indigo-900">
                          <span className="text-slate-500">Số ca:</span>
                          <span className="font-mono font-bold">
                            {before} &rarr; <span className="text-indigo-600 dark:text-indigo-400">{after}</span>{' '}
                            {diff > 0 && (
                              <span className="text-emerald-600 text-[10px]">(+{diff})</span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Đóng / Hủy
          </button>

          <button
            type="button"
            onClick={handleConfirmApply}
            disabled={!previewResult || previewResult.totalAssigned === 0}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Xác Nhận & Áp Dụng Lên Bảng Lịch Trực</span>
          </button>
        </div>
      </div>
    </div>
  );
};
