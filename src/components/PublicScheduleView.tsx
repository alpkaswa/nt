import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Printer,
  Share2,
  Clock,
  ShieldCheck,
  UserCheck,
  Shield,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  CalendarDays,
  List,
  Grid3X3,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Info,
} from 'lucide-react';
import { ShiftAssignment, Employee, ScheduleSettings } from '../types';
import { getDayNameVN } from '../services/scheduler';

interface PublicScheduleViewProps {
  shifts: ShiftAssignment[];
  employees: Employee[];
  settings: ScheduleSettings;
  realtimeStatus?: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  onBackToApp?: () => void;
}

export const PublicScheduleView: React.FC<PublicScheduleViewProps> = ({
  shifts,
  employees,
  settings,
  realtimeStatus = 'CONNECTED',
  onBackToApp,
}) => {
  // Bản đồ tra cứu nhân sự
  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  // Danh sách các tháng có ca trực
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    shifts.forEach((s) => {
      if (s.date && s.date.length >= 7) {
        set.add(s.date.substring(0, 7)); // YYYY-MM
      }
    });
    const arr = Array.from(set).sort();
    return arr.length > 0 ? arr : ['2026-11'];
  }, [shifts]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const nowMonth = new Date().toISOString().substring(0, 7);
    return availableMonths.includes(nowMonth) ? nowMonth : availableMonths[0] || '2026-11';
  });

  const [searchEmployee, setSearchEmployee] = useState('');
  const [roleGroupFilter, setRoleGroupFilter] = useState<'ALL' | 'TEACHER' | 'ADMIN' | 'GUARD'>('ALL');
  const [dayTypeFilter, setDayTypeFilter] = useState<'ALL' | 'WEEKDAY' | 'WEEKEND' | 'TODAY'>('ALL');
  const [viewMode, setViewMode] = useState<'CARD' | 'TABLE'>('CARD');
  const [isCopied, setIsCopied] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Lọc danh sách ca trực
  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      // 1. Lọc theo tháng
      if (!shift.date.startsWith(selectedMonth)) return false;

      // 2. Lọc theo loại ngày
      if (dayTypeFilter === 'TODAY' && shift.date !== todayStr) return false;
      if (dayTypeFilter === 'WEEKEND' && shift.dayOfWeek !== 0 && shift.dayOfWeek !== 6) return false;
      if (dayTypeFilter === 'WEEKDAY' && (shift.dayOfWeek === 0 || shift.dayOfWeek === 6)) return false;

      // 3. Lọc theo nhóm vai trò
      if (roleGroupFilter === 'TEACHER') {
        const hasTeacher = Boolean(shift.teacher1Id || shift.teacher2Id);
        if (!hasTeacher) return false;
      } else if (roleGroupFilter === 'ADMIN') {
        if (!shift.adminId) return false;
      } else if (roleGroupFilter === 'GUARD') {
        if (!shift.guardId) return false;
      }

      // 4. Lọc theo từ khóa tìm kiếm cán bộ
      if (searchEmployee.trim()) {
        const q = searchEmployee.toLowerCase();
        const gv1 = shift.teacher1Id ? empMap.get(shift.teacher1Id) : null;
        const gv2 = shift.teacher2Id ? empMap.get(shift.teacher2Id) : null;
        const bgh = shift.adminId ? empMap.get(shift.adminId) : null;
        const bv = shift.guardId ? empMap.get(shift.guardId) : null;

        const matchGv1 = gv1 && (gv1.name.toLowerCase().includes(q) || gv1.code.toLowerCase().includes(q));
        const matchGv2 = gv2 && (gv2.name.toLowerCase().includes(q) || gv2.code.toLowerCase().includes(q));
        const matchBgh = bgh && (bgh.name.toLowerCase().includes(q) || bgh.code.toLowerCase().includes(q));
        const matchBv = bv && (bv.name.toLowerCase().includes(q) || bv.code.toLowerCase().includes(q));

        if (!matchGv1 && !matchGv2 && !matchBgh && !matchBv) return false;
      }

      return true;
    });
  }, [shifts, selectedMonth, dayTypeFilter, roleGroupFilter, searchEmployee, todayStr, empMap]);

  // Sao chép link chia sẻ
  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'public');
    navigator.clipboard.writeText(url.toString());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Format tháng hiển thị tiếng Việt
  const formatMonthLabel = (mStr: string) => {
    const [y, m] = mStr.split('-');
    return `Tháng ${parseInt(m, 10)} / ${y}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* 1. Header Trang Lịch Trực Chung */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs px-4 sm:px-6 py-3 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-600/20 shrink-0">
              NR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
                  LỊCH TRỰC CÔNG KHAI
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Chế độ xem trực tuyến</span>
              </div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                {settings.schoolName || 'TRƯỜNG PHỔ THÔNG DÂN TỘC NỘI TRÚ NA RÌ'}
              </h1>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
            {/* Realtime Status Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  realtimeStatus === 'CONNECTED'
                    ? 'bg-emerald-500'
                    : realtimeStatus === 'CONNECTING'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <span className="text-[11px] font-medium">
                {realtimeStatus === 'CONNECTED'
                  ? 'Realtime Trực Tuyến'
                  : realtimeStatus === 'CONNECTING'
                  ? 'Đang Kết Nối...'
                  : 'Ngoại Tuyến'}
              </span>
            </div>

            {/* Nút Sao Chép Link */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
              title="Sao chép đường dẫn chia sẻ lịch trực"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Đã sao chép' : 'Sao chép link'}</span>
            </button>

            {/* Nút In */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Lịch Trực</span>
            </button>

            {/* Nút Quay lại Trang Quản Trị nếu mở trong app */}
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                <span>Vào trang quản trị</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Tiêu Đề Dành Riêng Cho Bản In (Chỉ hiển thị khi bấm Print) */}
      <div className="hidden print-only p-6 text-center">
        <h2 className="text-sm uppercase tracking-wider font-semibold">SỞ GIÁO DỤC VÀ ĐÀO TẠO BẮC KẠN</h2>
        <h1 className="text-lg font-bold uppercase">{settings.schoolName}</h1>
        <h3 className="text-base font-extrabold uppercase mt-2">
          BẢNG PHÂN CÔNG LỊCH TRỰC QUẢN SINH NỘI TRÚ - {formatMonthLabel(selectedMonth).toUpperCase()}
        </h3>
        <p className="text-xs italic text-slate-600 mt-1">
          Thời gian ca trực: 24/24 giờ (Từ 07:00 sáng hôm trước đến 07:00 sáng hôm sau)
        </p>
      </div>

      {/* 3. Thanh Lọc & Tìm Kiếm Đa Năng */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 space-y-3 no-print">
        {/* Banner Lưu Ý Dành Cho Giáo Viên / Phụ Huynh */}
        <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 rounded-xl flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              Lịch trực được đồng bộ trực tuyến thời gian thực từ hệ thống nhà trường. Mọi điều chỉnh từ Ban Giám Hiệu
              sẽ hiển thị ngay tại trang này.
            </span>
          </div>
          <span className="hidden md:inline font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Tổng cộng: {filteredShifts.length} ca trực
          </span>
        </div>

        {/* Khối Bộ Lọc */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* 1. Chọn Tháng */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Tháng Trực
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Lọc Loại Ngày */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Thời Gian
              </label>
              <select
                value={dayTypeFilter}
                onChange={(e) => setDayTypeFilter(e.target.value as any)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Toàn bộ tháng ({filteredShifts.length} ngày)</option>
                <option value="TODAY">Chỉ hôm nay ({todayStr})</option>
                <option value="WEEKDAY">Các ngày trong tuần (Thứ 2 - Thứ 6)</option>
                <option value="WEEKEND">Ngày cuối tuần (Thứ 7 & Chủ Nhật)</option>
              </select>
            </div>

            {/* 3. Lọc Nhóm Vị Trí */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Nhóm Nhiệm Vụ
              </label>
              <select
                value={roleGroupFilter}
                onChange={(e) => setRoleGroupFilter(e.target.value as any)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả vị trí trực</option>
                <option value="TEACHER">Chỉ xem Giáo Viên Quản Sinh (GV1, GV2)</option>
                <option value="ADMIN">Chỉ xem Ban Giám Hiệu Trực Chỉ Đạo</option>
                <option value="GUARD">Chỉ xem Nhân Viên Bảo Vệ</option>
              </select>
            </div>

            {/* 4. Tìm kiếm Cán bộ */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Tìm Cán Bộ / Giáo Viên
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  placeholder="Nhập họ tên hoặc mã cán bộ..."
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Chế độ hiển thị: Dạng Thẻ / Dạng Bảng */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Đang hiển thị{' '}
              <strong className="text-slate-900 dark:text-white font-mono tabular-nums">
                {filteredShifts.length}
              </strong>{' '}
              ca trực trong {formatMonthLabel(selectedMonth)}
            </span>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode('CARD')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'CARD'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Dạng Thẻ Ngày (Mobile)</span>
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'TABLE'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span>Dạng Bảng Lưới</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Nội Dung Danh Sách Ca Trực */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-12 flex-1">
        {filteredShifts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center my-6">
            <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Không tìm thấy ca trực phù hợp</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Thử thay đổi bộ lọc tìm kiếm hoặc chọn tháng khác để xem lịch trực của nhà trường.
            </p>
          </div>
        ) : viewMode === 'CARD' ? (
          /* ========================================================
             DẠNG THẺ (CARD VIEW) - Tối ưu di động, hiển thị rõ ràng từng ca
             ======================================================== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShifts.map((shift) => {
              const isToday = shift.date === todayStr;
              const isWeekend = shift.dayOfWeek === 0 || shift.dayOfWeek === 6;
              const gv1 = shift.teacher1Id ? empMap.get(shift.teacher1Id) : null;
              const gv2 = shift.teacher2Id ? empMap.get(shift.teacher2Id) : null;
              const bgh = shift.adminId ? empMap.get(shift.adminId) : null;
              const bv = shift.guardId ? empMap.get(shift.guardId) : null;

              return (
                <div
                  key={shift.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all ${
                    isToday
                      ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                  } p-4 flex flex-col justify-between`}
                >
                  {/* Ngày & Trạng thái */}
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-base text-slate-900 dark:text-white">
                            {getDayNameVN(shift.dayOfWeek)}
                          </span>
                          {isToday && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-indigo-600 text-white">
                              Hôm Nay
                            </span>
                          )}
                          {isWeekend && !isToday && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                              Cuối Tuần
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                          Ngày {shift.date}
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            shift.status === 'COMPLETE'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {shift.status === 'COMPLETE' ? 'Đủ 4 Người' : 'Chưa Đủ Người'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          <span>24h (07h - 07h)</span>
                        </div>
                      </div>
                    </div>

                    {/* Danh sách 4 vị trí phân công */}
                    <div className="py-3 space-y-2">
                      {/* 1. Giáo Viên 1 */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                            GV1
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {gv1 ? gv1.name : <span className="text-rose-500 italic">(Chưa phân công)</span>}
                            </div>
                            {gv1 && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                {gv1.code} · {gv1.department}
                              </div>
                            )}
                          </div>
                        </div>
                        {gv1?.phone && (
                          <a
                            href={`tel:${gv1.phone}`}
                            className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {gv1.phone}
                          </a>
                        )}
                      </div>

                      {/* 2. Giáo Viên 2 */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                            GV2
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {gv2 ? gv2.name : <span className="text-rose-500 italic">(Chưa phân công)</span>}
                            </div>
                            {gv2 && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                {gv2.code} · {gv2.department}
                              </div>
                            )}
                          </div>
                        </div>
                        {gv2?.phone && (
                          <a
                            href={`tel:${gv2.phone}`}
                            className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {gv2.phone}
                          </a>
                        )}
                      </div>

                      {/* 3. Ban Giám Hiệu Trực Chỉ Đạo */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            BGH
                          </div>
                          <div>
                            <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                              {bgh ? bgh.name : <span className="text-rose-500 italic">(Chưa phân công)</span>}
                            </div>
                            {bgh && (
                              <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono">
                                {bgh.code} · Ban Giám Hiệu
                              </div>
                            )}
                          </div>
                        </div>
                        {bgh?.phone && (
                          <a
                            href={`tel:${bgh.phone}`}
                            className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {bgh.phone}
                          </a>
                        )}
                      </div>

                      {/* 4. Bảo Vệ Ca Trực */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            BV
                          </div>
                          <div>
                            <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                              {bv ? bv.name : <span className="text-rose-500 italic">(Chưa phân công)</span>}
                            </div>
                            {bv && (
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                                {bv.code} · Bảo Vệ
                              </div>
                            )}
                          </div>
                        </div>
                        {bv?.phone && (
                          <a
                            href={`tel:${bv.phone}`}
                            className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            {bv.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Thẻ */}
                  {shift.notes && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 italic">
                      Ghi chú: {shift.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ========================================================
             DẠNG BẢNG LƯỚI (TABLE VIEW) - Phù hợp màn hình rộng và in ấn
             ======================================================== */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 text-center w-12">STT</th>
                    <th className="py-3 px-3 w-36">Ngày Trực</th>
                    <th className="py-3 px-4">Giáo Viên 1 (GV1)</th>
                    <th className="py-3 px-4">Giáo Viên 2 (GV2)</th>
                    <th className="py-3 px-4">Ban Giám Hiệu (BGH)</th>
                    <th className="py-3 px-4">Bảo Vệ (BV)</th>
                    <th className="py-3 px-3 text-center w-28">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredShifts.map((shift, idx) => {
                    const isToday = shift.date === todayStr;
                    const isWeekend = shift.dayOfWeek === 0 || shift.dayOfWeek === 6;
                    const gv1 = shift.teacher1Id ? empMap.get(shift.teacher1Id) : null;
                    const gv2 = shift.teacher2Id ? empMap.get(shift.teacher2Id) : null;
                    const bgh = shift.adminId ? empMap.get(shift.adminId) : null;
                    const bv = shift.guardId ? empMap.get(shift.guardId) : null;

                    return (
                      <tr
                        key={shift.id}
                        className={`transition-colors ${
                          isToday
                            ? 'bg-indigo-50/60 dark:bg-indigo-950/40 font-medium'
                            : isWeekend
                            ? 'bg-amber-50/30 dark:bg-amber-950/10'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-mono tabular-nums">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{getDayNameVN(shift.dayOfWeek)}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-indigo-600 text-white">
                                NAY
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums">{shift.date}</div>
                        </td>
                        <td className="py-3 px-4">
                          {gv1 ? (
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">{gv1.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {gv1.code} · {gv1.phone}
                              </div>
                            </div>
                          ) : (
                            <span className="text-rose-500 italic text-[11px]">(Chưa có)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {gv2 ? (
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">{gv2.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {gv2.code} · {gv2.phone}
                              </div>
                            </div>
                          ) : (
                            <span className="text-rose-500 italic text-[11px]">(Chưa có)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {bgh ? (
                            <div>
                              <div className="font-bold text-indigo-900 dark:text-indigo-200">{bgh.name}</div>
                              <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono">
                                {bgh.code} · {bgh.phone}
                              </div>
                            </div>
                          ) : (
                            <span className="text-rose-500 italic text-[11px]">(Chưa có)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {bv ? (
                            <div>
                              <div className="font-bold text-emerald-900 dark:text-emerald-200">{bv.name}</div>
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                                {bv.code} · {bv.phone}
                              </div>
                            </div>
                          ) : (
                            <span className="text-rose-500 italic text-[11px]">(Chưa có)</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              shift.status === 'COMPLETE'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {shift.status === 'COMPLETE' ? 'Đủ 4 người' : 'Chưa đủ'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 5. Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-4 sm:px-6 text-center text-xs text-slate-500 dark:text-slate-400 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Hệ thống Quản lý & Sắp xếp Lịch trực Quản sinh Nội trú · {settings.schoolName}</span>
          <span className="font-mono text-[11px]">Đồng bộ dữ liệu Supabase PostgreSQL & Google Sheets</span>
        </div>
      </footer>
    </div>
  );
};
