import React, { useState } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Download,
  Calendar,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { ShiftAssignment, Employee, ScheduleSettings } from '../types';
import { ExportService } from '../services/exportService';
import { getDayNameVN, parseDate } from '../services/scheduler';

interface ExportPrintViewProps {
  shifts: ShiftAssignment[];
  employees: Employee[];
  settings: ScheduleSettings;
}

export const ExportPrintView: React.FC<ExportPrintViewProps> = ({
  shifts,
  employees,
  settings,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().substring(0, 7));
  const [signerTitle] = useState('HIỆU TRƯỞNG');
  const [creatorTitle] = useState('NGƯỜI LẬP BIỂU');

  const empMap = new Map<string, Employee>();
  employees.forEach((e) => empMap.set(e.id, e));

  const monthShifts = shifts.filter((s) => s.date.startsWith(selectedMonth));

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const [y, m] = selectedMonth.split('-');
    ExportService.exportScheduleToExcel(monthShifts, employees, settings, `${m}/${y}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Toolbar (Hidden when printing) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>In Ấn & Xuất Lịch Trực Chuẩn Thể Thức Bộ Giáo Dục</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Mẫu bảng biểu được chuẩn hóa theo thể thức văn bản hành chính trường học, có khối chữ ký
            và số điện thoại liên lạc.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          >
            <option value="2026-11">Tháng 11 / 2026</option>
            <option value="2026-12">Tháng 12 / 2026</option>
          </select>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất File Excel (.xlsx)</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In / Lưu PDF (A4)</span>
          </button>
        </div>
      </div>

      {/* Official Printable Sheet Container */}
      <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-xl border border-slate-200 shadow-md max-w-5xl mx-auto print:p-0 print:border-none print:shadow-none print:max-w-none">
        {/* National Header */}
        <div className="flex justify-between items-start text-center mb-6 border-b pb-4 border-slate-200">
          <div className="w-1/2 text-left">
            <div className="text-xs uppercase font-semibold text-slate-600">SỞ GIÁO DỤC VÀ ĐÀO TẠO</div>
            <div className="text-sm font-bold uppercase tracking-tight text-slate-900 mt-0.5">
              {settings.schoolName}
            </div>
            <div className="text-[11px] text-slate-500 italic mt-1">Số: ..... /KH-THPTNT</div>
          </div>

          <div className="w-1/2 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-900">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div className="text-xs font-semibold text-slate-800 mt-0.5 underline underline-offset-4">
              Độc lập - Tự do - Hạnh phúc
            </div>
            <div className="text-[11px] text-slate-500 italic mt-1.5">
              ..., ngày 01 tháng {selectedMonth.split('-')[1]} năm {selectedMonth.split('-')[0]}
            </div>
          </div>
        </div>

        {/* Document Title */}
        <div className="text-center my-6">
          <h1 className="text-lg font-bold uppercase tracking-wide text-slate-900">
            BẢNG PHÂN CÔNG LỊCH TRỰC QUẢN SINH NỘI TRÚ
          </h1>
          <div className="text-sm font-semibold uppercase text-indigo-900 mt-1">
            THÁNG {selectedMonth.split('-')[1]} NĂM {selectedMonth.split('-')[0]}
          </div>
          <div className="text-xs text-slate-600 italic mt-1">
            (Thời gian mỗi ca trực 24 giờ: từ {settings.shiftStartTime} ngày trực đến{' '}
            {settings.shiftEndTime})
          </div>
        </div>

        {/* Official Table */}
        <div className="overflow-x-auto my-6">
          <table className="w-full text-left border-collapse text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-center text-[11px]">
                <th className="py-2.5 px-2 border-r border-slate-300 w-10">STT</th>
                <th className="py-2.5 px-2 border-r border-slate-300 w-24">Ngày trực</th>
                <th className="py-2.5 px-2 border-r border-slate-300 w-20">Thứ</th>
                <th className="py-2.5 px-3 border-r border-slate-300">Giáo viên trực 1</th>
                <th className="py-2.5 px-3 border-r border-slate-300">Giáo viên trực 2</th>
                <th className="py-2.5 px-3 border-r border-slate-300">Ban Giám Hiệu</th>
                <th className="py-2.5 px-3 border-r border-slate-300">Bảo vệ</th>
                <th className="py-2.5 px-2 border-r border-slate-300 w-20">Trạng thái</th>
                <th className="py-2.5 px-2">Ký nhận</th>
              </tr>
            </thead>
            <tbody>
              {monthShifts.map((shift, idx) => {
                const dObj = parseDate(shift.date);
                const isWeekend = shift.dayOfWeek === 0 || shift.dayOfWeek === 6;
                const dayName = getDayNameVN(shift.dayOfWeek);
                const formattedDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;

                const t1 = shift.teacher1Id ? empMap.get(shift.teacher1Id) : null;
                const t2 = shift.teacher2Id ? empMap.get(shift.teacher2Id) : null;
                const admin = shift.adminId ? empMap.get(shift.adminId) : null;
                const guard = shift.guardId ? empMap.get(shift.guardId) : null;

                return (
                  <tr
                    key={shift.id}
                    className={`border-b border-slate-200 ${isWeekend ? 'bg-slate-50' : ''}`}
                  >
                    <td className="py-2 px-2 text-center border-r border-slate-200 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-semibold">
                      {formattedDate}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-200 font-medium">
                      {dayName}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200">
                      <div className="font-semibold text-slate-800">{t1 ? t1.name : '(Trống)'}</div>
                      {t1 && <div className="text-[10px] text-slate-500 font-mono">{t1.phone}</div>}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200">
                      <div className="font-semibold text-slate-800">{t2 ? t2.name : '(Trống)'}</div>
                      {t2 && <div className="text-[10px] text-slate-500 font-mono">{t2.phone}</div>}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200">
                      <div className="font-semibold text-slate-800">{admin ? admin.name : '(Trống)'}</div>
                      {admin && <div className="text-[10px] text-slate-500 font-mono">{admin.phone}</div>}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200">
                      <div className="font-semibold text-slate-800">{guard ? guard.name : '(Trống)'}</div>
                      {guard && <div className="text-[10px] text-slate-500 font-mono">{guard.phone}</div>}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-200 text-[10px]">
                      {shift.status === 'COMPLETE' ? 'Đã xếp' : 'Thiếu người'}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Duty notes and regulations */}
        <div className="my-6 text-xs text-slate-700 space-y-1.5 border p-3 rounded border-slate-200 bg-slate-50">
          <div className="font-bold uppercase text-[11px] text-slate-800">
            LƯU Ý DÀNH CHO CÁN BỘ, GIÁO VIÊN VÀ NHÂN VIÊN TRỰC:
          </div>
          <div>1. Có mặt tại văn phòng quản sinh trước 07:00 để nhận bàn giao sổ trực và chìa khóa.</div>
          <div>2. Quản lý nghiêm ngặt giờ tự học tối (19:00 - 21:00) và điểm danh trước giờ tắt đèn (22:00).</div>
          <div>3. Đổi ca trực phải báo cáo Ban Giám Hiệu phê duyệt trước ít nhất 24 giờ.</div>
        </div>

        {/* Signature Blocks */}
        <div className="flex justify-between items-start text-center mt-10 pt-6">
          <div className="w-1/2">
            <div className="text-xs font-bold uppercase text-slate-900">{creatorTitle}</div>
            <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</div>
            <div className="h-20"></div>
          </div>

          <div className="w-1/2">
            <div className="text-xs font-bold uppercase text-slate-900">{signerTitle} PHÊ DUYỆT</div>
            <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký, đóng dấu và ghi rõ họ tên)</div>
            <div className="h-20"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
