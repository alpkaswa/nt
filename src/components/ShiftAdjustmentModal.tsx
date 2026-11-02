import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  User,
  Shield,
  Clock,
  History,
} from 'lucide-react';
import { ShiftAssignment, Employee, UnavailableDate, ScheduleSettings, ShiftChangeHistory, CompensatoryDuty } from '../types';
import { validateManualAssignment, getDayNameVN, parseDate } from '../services/scheduler';

interface ShiftAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftAssignment;
  initialRole?: 'teacher1' | 'teacher2' | 'admin' | 'guard';
  employees: Employee[];
  allShifts: ShiftAssignment[];
  unavailableDates: UnavailableDate[];
  settings: ScheduleSettings;
  onApplyAdjustment: (
    updatedShift: ShiftAssignment,
    historyRecord: Omit<ShiftChangeHistory, 'id' | 'timestamp'>,
    compensatoryDuty?: CompensatoryDuty
  ) => void;
}

export const ShiftAdjustmentModal: React.FC<ShiftAdjustmentModalProps> = ({
  isOpen,
  onClose,
  shift,
  initialRole = 'teacher1',
  employees,
  allShifts,
  unavailableDates,
  settings,
  onApplyAdjustment,
}) => {
  const [selectedPosition, setSelectedPosition] = useState<'teacher1' | 'teacher2' | 'admin' | 'guard'>(
    initialRole
  );
  const [replacementId, setReplacementId] = useState<string>('');
  const [changeReason, setChangeReason] = useState<string>('');
  const [performerName, setPerformerName] = useState<string>('Ban Giám Hiệu');
  const [recordCompensatory, setRecordCompensatory] = useState<boolean>(true);

  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  // Xác định người hiện tại ở vị trí đã chọn
  const currentPersonId = useMemo(() => {
    switch (selectedPosition) {
      case 'teacher1':
        return shift.teacher1Id;
      case 'teacher2':
        return shift.teacher2Id;
      case 'admin':
        return shift.adminId;
      case 'guard':
        return shift.guardId;
    }
  }, [shift, selectedPosition]);

  const currentPerson = currentPersonId ? empMap.get(currentPersonId) : null;

  // Lọc danh sách nhân sự phù hợp với vị trí
  const candidatePool = useMemo(() => {
    if (selectedPosition === 'teacher1' || selectedPosition === 'teacher2') {
      return employees.filter((e) => e.role === 'TEACHER');
    }
    if (selectedPosition === 'admin') {
      return employees.filter((e) => e.role === 'ADMIN');
    }
    return employees.filter((e) => e.role === 'GUARD');
  }, [employees, selectedPosition]);

  // Kiểm định điều kiện khi chọn người thay thế
  const validation = useMemo(() => {
    if (!replacementId) {
      return { isValid: false, errors: ['Vui lòng chọn nhân sự thay thế.'], warnings: [] };
    }

    if (replacementId === currentPersonId) {
      return { isValid: false, errors: ['Nhân sự được chọn trùng với người đang trực.'], warnings: [] };
    }

    // Tạo bản sao danh sách shifts tạm thời để kiểm định
    const tempShifts = allShifts.map((s) => {
      if (s.id === shift.id) {
        return {
          ...s,
          [selectedPosition === 'teacher1'
            ? 'teacher1Id'
            : selectedPosition === 'teacher2'
            ? 'teacher2Id'
            : selectedPosition === 'admin'
            ? 'adminId'
            : 'guardId']: null,
        };
      }
      return s;
    });

    return validateManualAssignment(
      shift.date,
      selectedPosition,
      replacementId,
      tempShifts,
      employees,
      unavailableDates,
      settings
    );
  }, [shift, selectedPosition, replacementId, currentPersonId, allShifts, employees, unavailableDates, settings]);

  if (!isOpen) return null;

  const dObj = parseDate(shift.date);
  const dayName = getDayNameVN(shift.dayOfWeek);
  const formattedDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid || !replacementId) return;

    const updatedShift: ShiftAssignment = {
      ...shift,
      [selectedPosition === 'teacher1'
        ? 'teacher1Id'
        : selectedPosition === 'teacher2'
        ? 'teacher2Id'
        : selectedPosition === 'admin'
        ? 'adminId'
        : 'guardId']: replacementId,
    };

    // Cập nhật trạng thái ca
    const isComplete =
      updatedShift.teacher1Id &&
      updatedShift.teacher2Id &&
      updatedShift.adminId &&
      updatedShift.guardId;

    updatedShift.status = isComplete ? 'COMPLETE' : 'INCOMPLETE';

    let compDuty: CompensatoryDuty | undefined = undefined;
    if (recordCompensatory && currentPersonId && currentPersonId !== 'EMPTY' && currentPersonId !== replacementId) {
      const nowIso = new Date().toISOString();
      const creditor = empMap.get(replacementId);
      compDuty = {
        id: `comp-${Date.now()}`,
        debtorEmployeeId: currentPersonId,
        creditorEmployeeId: replacementId,
        originalShiftDate: shift.date,
        reason: `Đổi ca trực ngày ${shift.date} (${changeReason.trim()}) - Được ${creditor?.name} (${creditor?.code}) trực thay`,
        sourceType: 'SHIFT_SWAP',
        status: 'PENDING',
        createdAt: nowIso,
      };
    }

    onApplyAdjustment(
      updatedShift,
      {
        shiftDate: shift.date,
        rolePosition: selectedPosition,
        previousEmployeeId: currentPersonId || 'EMPTY',
        newEmployeeId: replacementId,
        reason: changeReason.trim() || 'Điều chỉnh nhân sự theo yêu cầu phân công',
        changedBy: performerName.trim() || 'Ban Giám Hiệu',
      },
      compDuty
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs no-print">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                Điều Chỉnh & Đổi Ca Trực Quản Sinh
              </h3>
              <p className="text-xs text-slate-500">
                Ngày {formattedDate} ({dayName}) · 24 giờ liên tục
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Position Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Chọn Vị Trí Cần Thay Đổi
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'teacher1', label: 'Giáo viên 1' },
                  { id: 'teacher2', label: 'Giáo viên 2' },
                  { id: 'admin', label: 'Ban Giám Hiệu' },
                  { id: 'guard', label: 'Bảo vệ' },
                ] as const
              ).map((pos) => (
                <button
                  type="button"
                  key={pos.id}
                  onClick={() => {
                    setSelectedPosition(pos.id);
                    setReplacementId('');
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                    selectedPosition === pos.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current Person Display */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Nhân Sự Đang Trực Hiện Tại:
            </div>
            {currentPerson ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {currentPerson.name} ({currentPerson.code})
                  </div>
                  <div className="text-xs text-slate-500">{currentPerson.department}</div>
                </div>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                  {currentPerson.phone}
                </div>
              </div>
            ) : (
              <div className="text-xs text-rose-500 font-semibold italic">
                (Chưa có nhân sự phân công ở vị trí này)
              </div>
            )}
          </div>

          {/* Select Replacement Candidate */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Chọn Nhân Sự Thay Thế <span className="text-rose-500">*</span>
            </label>
            <select
              value={replacementId}
              onChange={(e) => setReplacementId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- Chọn nhân sự từ danh sách --</option>
              {candidatePool.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.code}) - {candidate.department}
                </option>
              ))}
            </select>
          </div>

          {/* Real-time Validation Box */}
          {replacementId && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                validation.isValid
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {validation.isValid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Hợp lệ theo toàn bộ quy chế ca trực!</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Vi phạm điều kiện bắt buộc - Không thể lưu:</span>
                  </>
                )}
              </div>

              {!validation.isValid && (
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                  {validation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}

              {validation.warnings.length > 0 && (
                <div className="pt-1 text-amber-700 dark:text-amber-400 text-[11px]">
                  {validation.warnings.map((w, i) => (
                    <div key={i}>⚠️ {w}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Change Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Lý Do Thay Đổi / Đổi Ca <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Đổi ca có việc gia đình đột xuất, có xác nhận BGH..."
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Performer */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Người Thực Hiện / Phê Duyệt Thay Đổi
            </label>
            <input
              type="text"
              value={performerName}
              onChange={(e) => setPerformerName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Record Compensatory Duty Checkbox */}
          {currentPerson && currentPersonId !== replacementId && (
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-xl">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordCompensatory}
                  onChange={(e) => setRecordCompensatory(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Ghi nhận nghĩa vụ Trực Bù cho {currentPerson.name}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Hệ thống sẽ lưu vết nợ ca (ghi nhận chính xác giây:phút:giờ) để phân công trực bù sau này.
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={!validation.isValid || !changeReason.trim()}
              className={`px-4 py-2 text-xs font-bold rounded-lg shadow-xs transition-colors ${
                validation.isValid && changeReason.trim()
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              Xác Nhận & Lưu Nhật Ký
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
