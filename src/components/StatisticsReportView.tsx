import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  TrendingUp,
  Scale,
  Award,
} from 'lucide-react';
import { Employee, ShiftAssignment, UnavailableDate, ShiftChangeHistory, ScheduleSettings, CompensatoryDuty } from '../types';
import { calculateStatistics } from '../services/scheduler';
import { ExportService } from '../services/exportService';

interface StatisticsReportViewProps {
  employees: Employee[];
  shifts: ShiftAssignment[];
  unavailableDates: UnavailableDate[];
  history: ShiftChangeHistory[];
  settings: ScheduleSettings;
  compensatoryDuties?: CompensatoryDuty[];
  onNavigatePrint: () => void;
}

export const StatisticsReportView: React.FC<StatisticsReportViewProps> = ({
  employees,
  shifts,
  unavailableDates,
  history,
  settings,
  compensatoryDuties = [],
  onNavigatePrint,
}) => {
  const [timeRange, setTimeRange] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'TEACHER' | 'ADMIN' | 'GUARD'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Tính toán số liệu thống kê
  const rawStats = useMemo(() => {
    return calculateStatistics(employees, shifts, unavailableDates, history, compensatoryDuties);
  }, [employees, shifts, unavailableDates, history, compensatoryDuties]);

  // Lọc
  const filteredStats = useMemo(() => {
    return rawStats.filter((st) => {
      if (roleFilter !== 'ALL' && st.role !== roleFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          st.name.toLowerCase().includes(q) ||
          st.code.toLowerCase().includes(q) ||
          st.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rawStats, roleFilter, searchTerm]);

  // Phân tích độ công bằng cho Giáo viên
  const teacherStats = rawStats.filter((st) => st.role === 'TEACHER');
  const teacherCounts = teacherStats.map((st) => st.totalShifts);
  const minTeacherShifts = teacherCounts.length > 0 ? Math.min(...teacherCounts) : 0;
  const maxTeacherShifts = teacherCounts.length > 0 ? Math.max(...teacherCounts) : 0;
  const avgTeacherShifts =
    teacherCounts.length > 0
      ? (teacherCounts.reduce((a, b) => a + b, 0) / teacherCounts.length).toFixed(1)
      : '0';
  const diffTeacherShifts = maxTeacherShifts - minTeacherShifts;

  const handleExportExcel = () => {
    const curDate = new Date();
    const curM = curDate.getMonth() + 1;
    const curY = curDate.getFullYear();
    const rangeLabel =
      timeRange === 'MONTH'
        ? `Tháng ${curM}/${curY}`
        : timeRange === 'QUARTER'
          ? `Quý ${Math.ceil(curM / 3)}/${curY}`
          : `Năm học ${curY}-${curY + 1}`;
    ExportService.exportStatisticsToExcel(filteredStats, settings.schoolName, rangeLabel);
  };

  return (
    <div className="space-y-6">
      {/* Top Fairness Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Độ Lệch Ca Trực (GV)</span>
            <Scale className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
            {diffTeacherShifts} ca
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            {diffTeacherShifts <= 2 ? '✓ Rất cân bằng và công bằng' : '⚠️ Cần điều chỉnh phân bổ'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Trung Bình Ca / Giáo Viên</span>
            <TrendingUp className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
            {avgTeacherShifts} ca
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Định mức phân bổ 24h</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Ít Nhất / Nhiều Nhất (GV)</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
            {minTeacherShifts} - {maxTeacherShifts} ca
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Khoảng dao động an toàn</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Tổng Số Lượt Đổi Ca</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
            {history.length} lượt
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Có lưu nhật ký kiểm toán</div>
        </div>
      </div>

      {/* Visual Distribution Chart Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">
          Biểu Đồ So Sánh Số Ca Trực Tương Đối Giữa Các Giáo Viên (Cân Bằng)
        </h3>

        <div className="space-y-2.5">
          {teacherStats.map((t) => {
            const maxVal = Math.max(...teacherCounts, 1);
            const percentage = Math.round((t.totalShifts / maxVal) * 100);

            return (
              <div key={t.employeeId} className="flex items-center gap-3 text-xs">
                <div className="w-32 font-medium text-slate-800 dark:text-slate-200 truncate">
                  {t.name}
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-16 text-right font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                  {t.totalShifts} ca
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã nhân sự..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </div>

          {/* Time range switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
            {(
              [
                { id: 'MONTH', label: 'Theo Tháng' },
                { id: 'QUARTER', label: 'Theo Quý' },
                { id: 'YEAR', label: 'Cả Năm' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setTimeRange(item.id)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  timeRange === item.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
            {(
              [
                { id: 'ALL', label: 'Tất cả' },
                { id: 'TEACHER', label: 'Giáo viên' },
                { id: 'ADMIN', label: 'BGH' },
                { id: 'GUARD', label: 'Bảo vệ' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setRoleFilter(item.id)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  roleFilter === item.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onNavigatePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In Báo Cáo</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Báo Cáo Excel</span>
          </button>
        </div>
      </div>

      {/* Main Stats Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-16">Mã NS</th>
                <th className="py-3 px-3">Họ và tên</th>
                <th className="py-3 px-3 w-28">Chức vụ</th>
                <th className="py-3 px-3">Tổ / Bộ phận</th>
                <th className="py-3 px-3 w-28 text-center font-bold text-indigo-700 dark:text-indigo-400">
                  Tổng ca trực
                </th>
                <th className="py-3 px-3 w-28 text-center">Ca ngày thường</th>
                <th className="py-3 px-3 w-28 text-center">Ca cuối tuần</th>
                <th className="py-3 px-3 w-28 text-center">Ngày nghỉ phép</th>
                <th className="py-3 px-3 w-24 text-center">Số lần đổi</th>
                <th className="py-3 px-3 w-24 text-center text-rose-600 dark:text-rose-400">Nợ trực bù</th>
                <th className="py-3 px-3 w-24 text-center text-emerald-600 dark:text-emerald-400">Đã bù</th>
                <th className="py-3 px-3 w-24 text-center text-sky-600 dark:text-sky-400">Trực thay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStats.map((st) => (
                <tr
                  key={st.employeeId}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {st.code}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">
                    {st.name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    {st.role === 'ADMIN'
                      ? 'Ban Giám Hiệu'
                      : st.role === 'GUARD'
                      ? 'Bảo Vệ'
                      : 'Giáo Viên'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{st.department}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400 font-mono text-sm tabular-nums">
                    {st.totalShifts}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {st.weekdayShifts}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {st.weekendShifts}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {st.approvedLeaves}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {st.swapCount}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                    {st.compensatoryOwed && st.compensatoryOwed > 0 ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        {st.compensatoryOwed} ca
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                    {st.compensatoryCompleted && st.compensatoryCompleted > 0 ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {st.compensatoryCompleted} ca
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                    {st.shiftsCoveredForOthers && st.shiftsCoveredForOthers > 0 ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        {st.shiftsCoveredForOthers} ca
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
