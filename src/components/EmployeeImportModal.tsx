import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Users,
  Search,
  RefreshCw,
  PlusCircle,
  UserCheck,
} from 'lucide-react';
import { Employee } from '../types';
import { EmployeeImportResult, ExportService } from '../services/exportService';

interface EmployeeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importResult: EmployeeImportResult | null;
  existingEmployees: Employee[];
  onConfirmImport: (
    employeesToSave: Employee[],
    mode: 'merge_update' | 'add_only' | 'replace_all',
    summaryMessage: string
  ) => void;
}

export const EmployeeImportModal: React.FC<EmployeeImportModalProps> = ({
  isOpen,
  onClose,
  importResult,
  existingEmployees,
  onConfirmImport,
}) => {
  const [importMode, setImportMode] = useState<'merge_update' | 'add_only' | 'replace_all'>('merge_update');
  const [searchPreview, setSearchPreview] = useState('');

  if (!isOpen || !importResult) return null;

  const existingCodeSet = new Set(existingEmployees.map((e) => e.code.toUpperCase()));

  // Phân loại các cán bộ đọc được từ Excel
  const newEmployees: Employee[] = [];
  const existingMatchedEmployees: Employee[] = [];

  importResult.employees.forEach((emp) => {
    if (existingCodeSet.has(emp.code.toUpperCase())) {
      existingMatchedEmployees.push(emp);
    } else {
      newEmployees.push(emp);
    }
  });

  // Tính toán danh sách cuối cùng theo chế độ người dùng chọn
  let finalEmployeesToImport: Employee[] = [];
  if (importMode === 'merge_update') {
    // Cập nhật người cũ + thêm người mới
    const updatedMap = new Map<string, Employee>();
    existingEmployees.forEach((e) => updatedMap.set(e.code.toUpperCase(), { ...e }));
    
    // Áp dụng đè các trường từ file excel
    importResult.employees.forEach((importedEmp) => {
      const codeKey = importedEmp.code.toUpperCase();
      if (updatedMap.has(codeKey)) {
        const existing = updatedMap.get(codeKey)!;
        updatedMap.set(codeKey, {
          ...existing,
          name: importedEmp.name || existing.name,
          role: importedEmp.role || existing.role,
          department: importedEmp.department || existing.department,
          phone: importedEmp.phone || existing.phone,
          email: importedEmp.email || existing.email,
          notes: importedEmp.notes || existing.notes,
        });
      } else {
        updatedMap.set(codeKey, importedEmp);
      }
    });
    finalEmployeesToImport = Array.from(updatedMap.values());
  } else if (importMode === 'add_only') {
    // Chỉ thêm các mã chưa từng có
    finalEmployeesToImport = [...existingEmployees, ...newEmployees];
  } else if (importMode === 'replace_all') {
    // Thay thế toàn bộ
    finalEmployeesToImport = [...importResult.employees];
  }

  const handleConfirm = () => {
    let summary = '';
    if (importMode === 'merge_update') {
      summary = `Đã nhập thành công: Cập nhật ${existingMatchedEmployees.length} cán bộ cũ và thêm mới ${newEmployees.length} cán bộ.`;
    } else if (importMode === 'add_only') {
      summary = `Đã thêm mới ${newEmployees.length} cán bộ từ tệp Excel (bỏ qua ${existingMatchedEmployees.length} cán bộ đã có mã).`;
    } else {
      summary = `Đã thay thế toàn bộ danh sách bằng ${importResult.employees.length} cán bộ từ tệp Excel.`;
    }
    onConfirmImport(finalEmployeesToImport, importMode, summary);
    onClose();
  };

  const filteredPreviewList = importResult.employees.filter((emp) => {
    if (!searchPreview.trim()) return true;
    const q = searchPreview.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.code.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q) ||
      emp.phone.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Nhập Dữ Liệu Nhân Sự Từ Excel</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                  {importResult.fileName}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kiểm tra thông tin đã phân tích và chọn cách đồng bộ danh sách cán bộ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Warnings & Errors */}
          {importResult.errors.length > 0 && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-2">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Có vấn đề khi đọc tệp:</span>
              </div>
              <ul className="list-disc list-inside text-xs text-rose-600 dark:text-rose-400 space-y-1">
                {importResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
              <div className="pt-2">
                <button
                  onClick={ExportService.downloadEmployeeTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Mẫu Excel Chuẩn Để So Sánh</span>
                </button>
              </div>
            </div>
          )}

          {importResult.warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Lưu ý khi đối chiếu cột:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                {importResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-black text-slate-800 dark:text-slate-100">
                  {importResult.employees.length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tổng nhân sự đọc được
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                  {newEmployees.length}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Cán bộ mới (mã chưa có)
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/30 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-black text-indigo-700 dark:text-indigo-300">
                  {existingMatchedEmployees.length}
                </div>
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400">
                  Trùng mã đã có (có thể cập nhật)
                </div>
              </div>
            </div>
          </div>

          {/* Import Mode Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Chọn phương thức nhập dữ liệu
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setImportMode('merge_update')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  importMode === 'merge_update'
                    ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      importMode === 'merge_update'
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-slate-400'
                    }`}
                  >
                    {importMode === 'merge_update' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span>Cập nhật & Thêm mới</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Cập nhật thông tin cho {existingMatchedEmployees.length} cán bộ trùng mã và thêm mới {newEmployees.length} cán bộ.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('add_only')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  importMode === 'add_only'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      importMode === 'add_only'
                        ? 'border-emerald-600 bg-emerald-600'
                        : 'border-slate-400'
                    }`}
                  >
                    {importMode === 'add_only' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span>Chỉ thêm cán bộ mới</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Chỉ thêm {newEmployees.length} cán bộ mới chưa có mã, giữ nguyên thông tin cán bộ hiện tại.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('replace_all')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  importMode === 'replace_all'
                    ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      importMode === 'replace_all'
                        ? 'border-rose-600 bg-rose-600'
                        : 'border-slate-400'
                    }`}
                  >
                    {importMode === 'replace_all' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span>Thay thế toàn bộ</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Xóa toàn bộ danh sách hiện tại và sử dụng đúng {importResult.employees.length} cán bộ từ tệp này.
                </p>
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Xem trước danh sách đọc từ Excel ({filteredPreviewList.length}/{importResult.employees.length})
              </label>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Lọc cán bộ trong bảng xem trước..."
                  value={searchPreview}
                  onChange={(e) => setSearchPreview(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2 px-3 w-12 text-center">STT</th>
                    <th className="py-2 px-3 w-20">Mã NS</th>
                    <th className="py-2 px-3">Họ và tên</th>
                    <th className="py-2 px-3 w-24">Chức vụ</th>
                    <th className="py-2 px-3">Tổ / Bộ phận</th>
                    <th className="py-2 px-3 w-28">Số điện thoại</th>
                    <th className="py-2 px-3 w-32">Email</th>
                    <th className="py-2 px-3 w-24 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPreviewList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        Không có cán bộ nào phù hợp với bộ lọc tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    filteredPreviewList.map((emp, idx) => {
                      const isExisting = existingCodeSet.has(emp.code.toUpperCase());
                      return (
                        <tr
                          key={emp.id || idx}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {emp.code}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-100">
                            {emp.name}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                emp.role === 'ADMIN'
                                  ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                  : emp.role === 'GUARD'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                              }`}
                            >
                              {emp.role === 'ADMIN'
                                ? 'BGH'
                                : emp.role === 'GUARD'
                                ? 'Bảo vệ'
                                : 'Giáo viên'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                            {emp.department}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                            {emp.phone}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500 truncate max-w-[140px]">
                            {emp.email}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {isExisting ? (
                              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                                Trùng mã
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                                Mới
                              </span>
                            )}
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

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Hủy Bỏ
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={ExportService.downloadEmployeeTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Mẫu Excel</span>
            </button>

            <button
              disabled={importResult.employees.length === 0}
              onClick={handleConfirm}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Xác Nhận Nhập ({importMode === 'replace_all' ? importResult.employees.length : importMode === 'add_only' ? newEmployees.length : importResult.employees.length} Cán Bộ)
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
