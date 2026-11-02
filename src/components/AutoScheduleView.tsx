import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Lock,
  ShieldAlert,
  Info,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Employee, UnavailableDate, ShiftAssignment, ScheduleSettings } from '../types';
import { generateAutoSchedule, getDayNameVN, parseDate, AutoScheduleResult } from '../services/scheduler';
import { useRealTimeClock } from '../hooks/useRealTimeClock';
import { getScheduleRangePresets } from '../services/dateTimeUtils';

interface AutoScheduleViewProps {
  employees: Employee[];
  unavailableDates: UnavailableDate[];
  currentShifts: ShiftAssignment[];
  settings: ScheduleSettings;
  onSaveSchedule: (newShifts: ShiftAssignment[]) => void;
  onNavigateSchedule: () => void;
}

export const AutoScheduleView: React.FC<AutoScheduleViewProps> = ({
  employees,
  unavailableDates,
  currentShifts,
  settings,
  onSaveSchedule,
  onNavigateSchedule,
}) => {
  const { now, formattedDateFull, defaultScheduleRange } = useRealTimeClock();
  const presets = getScheduleRangePresets(now);

  const [startDate, setStartDate] = useState(defaultScheduleRange.startDate);
  const [endDate, setEndDate] = useState(defaultScheduleRange.endDate);
  const [activePresetId, setActivePresetId] = useState<string>('today-to-end-of-month');

  const [disallowConsecutive, setDisallowConsecutive] = useState(true);
  const [respectLeaves, setRespectLeaves] = useState(true);
  const [fairDistribution, setFairDistribution] = useState(true);
  const [keepLocked, setKeepLocked] = useState(true);

  const [previewResult, setPreviewResult] = useState<AutoScheduleResult | null>(null);
  const [isCalculated, setIsCalculated] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const empMap = new Map<string, Employee>();
  employees.forEach((e) => empMap.set(e.id, e));

  const handleApplyPreset = (preset: (typeof presets)[0]) => {
    setStartDate(preset.startDate);
    setEndDate(preset.endDate);
    setActivePresetId(preset.id);
  };

  const handleRunAutoSchedule = () => {
    setHasSaved(false);
    const customSettings: ScheduleSettings = {
      ...settings,
      disallowConsecutiveDays: disallowConsecutive,
      respectApprovedUnavailabilities: respectLeaves,
      fairDistribution,
    };

    const result = generateAutoSchedule({
      startDate,
      endDate,
      employees,
      unavailableDates,
      existingShifts: currentShifts,
      settings: customSettings,
      keepLockedShifts: keepLocked,
    });

    setPreviewResult(result);
    setIsCalculated(true);
    setTimeout(() => {
      document.getElementById('auto-schedule-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleConfirmSave = () => {
    if (!previewResult) return;
    onSaveSchedule(previewResult.shifts);
    setHasSaved(true);
  };

  // Tính số ngày trong khoảng
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const totalDays =
    !isNaN(startD.getTime()) && !isNaN(endD.getTime())
      ? Math.max(0, Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 0;

  return (
    <div className="space-y-6">
      {/* Real-time sync banner */}
      <div className="bg-indigo-50/80 dark:bg-indigo-950/40 p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">
              Đồng Bộ Thời Gian Thực Tự Động
            </div>
            <div className="text-xs text-indigo-700 dark:text-indigo-300">
              Hôm nay là <span className="font-semibold">{formattedDateFull}</span>. Khoảng thời gian
              xếp lịch đã tự động điều hướng từ ngày hiện tại đến hết tháng.
            </div>
          </div>
        </div>

        <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 tabular-nums self-start md:self-auto">
          Tổng số ca sẽ xếp: {totalDays} ngày
        </div>
      </div>

      {/* Configuration Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            Cấu Hình Tham Số & Quy Tắc Xếp Lịch Tự Động
          </h2>
        </div>

        {/* Quick Range Presets (Buttons) */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Chọn Nhanh Khoảng Thời Gian Theo Thời Gian Thực:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`p-3 text-left rounded-xl border transition-all text-xs flex flex-col justify-between ${
                  activePresetId === preset.id &&
                  startDate === preset.startDate &&
                  endDate === preset.endDate
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between font-semibold mb-1">
                  <span>{preset.label}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                    {preset.badge}
                  </span>
                </div>
                <div className="text-[11px] font-mono opacity-80 tabular-nums">
                  {preset.startDate} → {preset.endDate}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Date Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Ngày Bắt Đầu (Theo ngày thực tế)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePresetId('');
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Ngày Kết Thúc
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePresetId('');
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-end">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full text-xs">
              <span className="text-slate-500 dark:text-slate-400">Khoảng xếp lịch: </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {totalDays} ngày
              </span>
              <span className="text-slate-400 text-[11px] block mt-0.5">
                (Chu kỳ 24h: 07:00 ngày đầu đến 07:00 ngày cuối + 1)
              </span>
            </div>
          </div>
        </div>

        {/* Rules Checklist */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 mb-6">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">
            Nguyên Tắc Bắt Buộc Của Thuật Toán:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={disallowConsecutive}
                onChange={(e) => setDisallowConsecutive(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Không phân công trực hai ngày liên tiếp
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Người trực hôm trước tuyệt đối không trực ngày hôm sau (đảm bảo nghỉ 24h).
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={respectLeaves}
                onChange={(e) => setRespectLeaves(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Tôn trọng lịch bận & ngày nghỉ đã duyệt
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Không xếp người vào những ngày đã được BGH chấp thuận nghỉ phép.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={fairDistribution}
                onChange={(e) => setFairDistribution(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Phân bổ công bằng & cân bằng số ca (Greedy + Heap)
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Ưu tiên người có số ca trực ít hơn và luân phiên ca trực cuối tuần (T7, CN).
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={keepLocked}
                onChange={(e) => setKeepLocked(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Giữ nguyên các ca đã khóa (Lock)
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Không tự ý thay đổi nhân sự tại các ngày đã được BGH chốt và khóa bảo vệ.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Quân số khả dụng: {employees.filter((e) => e.isActive).length} nhân sự
          </div>

          <button
            onClick={handleRunAutoSchedule}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Chạy Thuật Toán Xếp Lịch Tự Động</span>
          </button>
        </div>
      </div>

      {/* Results Preview */}
      {isCalculated && previewResult && (
        <div id="auto-schedule-results" className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          {/* Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                {previewResult.conflicts.length === 0 ? (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Xếp Lịch Thành Công 100% Hợp Lệ
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-md">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Không Đủ Nhân Sự — Có Vị Trí Cần Bổ Sung
                  </span>
                )}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  (Từ {startDate} đến {endDate})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {previewResult.conflicts.length === 0
                  ? `Đã phân công trọn vẹn ${previewResult.totalDays} ca trực (${previewResult.assignedCount} lượt nhân sự) tuân thủ 100% các ràng buộc.`
                  : `Phát hiện ${previewResult.conflicts.length} vị trí chưa tìm được người phù hợp do vướng ngày bận hoặc quy định nghỉ 24h.`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={hasSaved}
                onClick={handleConfirmSave}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs ${
                  hasSaved
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {hasSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{hasSaved ? 'Đã Lưu Lịch Thành Công' : 'Áp Dụng & Lưu Vào Hệ Thống'}</span>
              </button>

              {hasSaved && (
                <button
                  onClick={onNavigateSchedule}
                  className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center gap-1"
                >
                  <span>Xem Bảng Lịch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Missing Shifts / Conflict Report */}
          {previewResult.conflicts.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200 uppercase mb-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Chi Tiết {previewResult.conflicts.length} Vị Trí Cần Bổ Sung Nhân Sự:</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {previewResult.conflicts.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-white/70 dark:bg-slate-900/60 border border-amber-200/50 flex flex-col sm:flex-row sm:items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{m.date}:</span>{' '}
                      <span className="text-rose-600 font-semibold">{m.role}</span> — {m.reason}
                    </div>
                    {m.suggestedReplacements.length > 0 && (
                      <div className="text-[11px] text-slate-500 mt-1 sm:mt-0">
                        Đề xuất thay thế: {m.suggestedReplacements.map((e) => e.name).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Ngày Trực (24h)</th>
                  <th className="py-2.5 px-3">Giáo viên 1</th>
                  <th className="py-2.5 px-3">Giáo viên 2</th>
                  <th className="py-2.5 px-3">BGH</th>
                  <th className="py-2.5 px-3">Bảo vệ</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewResult.shifts
                  .filter((s) => s.date >= startDate && s.date <= endDate)
                  .map((s) => {
                    const dayName = getDayNameVN(s.dayOfWeek);
                    const isWeekend = s.dayOfWeek === 0 || s.dayOfWeek === 6;

                    const t1 = s.teacher1Id ? empMap.get(s.teacher1Id) : null;
                    const t2 = s.teacher2Id ? empMap.get(s.teacher2Id) : null;
                    const admin = s.adminId ? empMap.get(s.adminId) : null;
                    const guard = s.guardId ? empMap.get(s.guardId) : null;

                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          isWeekend ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-100">
                          {s.date} <span className="text-[11px] text-slate-400 font-normal">({dayName})</span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-200">
                          {t1 ? t1.name : <span className="text-rose-500 font-bold">(Thiếu)</span>}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-200">
                          {t2 ? t2.name : <span className="text-rose-500 font-bold">(Thiếu)</span>}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-200">
                          {admin ? admin.name : <span className="text-rose-500 font-bold">(Thiếu)</span>}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-200">
                          {guard ? guard.name : <span className="text-rose-500 font-bold">(Thiếu)</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {s.status === 'COMPLETE' ? (
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                              Đã xếp
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                              Chưa đủ
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
    </div>
  );
};
