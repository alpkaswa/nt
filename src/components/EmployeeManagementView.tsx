import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Phone,
  Mail,
} from 'lucide-react';
import { Employee, EmployeeRole, AppUserRole, ShiftAssignment } from '../types';
import { ExportService, EmployeeImportResult } from '../services/exportService';
import { EmployeeImportModal } from './EmployeeImportModal';
import { Sparkles, RefreshCw } from 'lucide-react';

interface EmployeeManagementViewProps {
  employees: Employee[];
  shifts?: ShiftAssignment[];
  currentUserRole: AppUserRole;
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (empId: string) => void;
  onImportEmployees: (
    imported: Employee[],
    mode?: 'merge_update' | 'add_only' | 'replace_all'
  ) => void;
  onAutoFillShifts?: () => void;
  onOpenSyncModal?: (employeeId?: string) => void;
}

export const EmployeeManagementView: React.FC<EmployeeManagementViewProps> = ({
  employees,
  shifts = [],
  currentUserRole,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onImportEmployees,
  onAutoFillShifts,
  onOpenSyncModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | EmployeeRole>('ALL');
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<EmployeeImportResult | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Employee>>({
    code: '',
    name: '',
    role: 'TEACHER',
    department: 'Tổ Chuyên Môn',
    phone: '',
    email: '',
    isActive: true,
    notes: '',
  });

  const [autoSyncAfterAdd, setAutoSyncAfterAdd] = useState(true);

  // Tính số ca trực hiện tại của mỗi nhân sự trong bảng lịch trực
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

  const zeroDutyEmployees = useMemo(() => {
    return employees.filter((e) => e.isActive && (dutyCounts.get(e.id) || 0) === 0);
  }, [employees, dutyCounts]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (roleFilter !== 'ALL' && emp.role !== roleFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          emp.name.toLowerCase().includes(q) ||
          emp.code.toLowerCase().includes(q) ||
          emp.phone.includes(q) ||
          emp.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, roleFilter, searchTerm]);

  const canManage = currentUserRole === 'ADMIN' || currentUserRole === 'BGH';

  const handleOpenAdd = () => {
    const nextNum = employees.length + 1;
    setFormData({
      code: `GV${String(nextNum).padStart(2, '0')}`,
      name: '',
      role: 'TEACHER',
      department: 'Tổ Chuyên Môn',
      phone: '09',
      email: '',
      isActive: true,
      notes: '',
    });
    setEditingEmp(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setFormData({ ...emp });
    setEditingEmp(emp);
    setIsAddModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.code?.trim()) return;

    if (editingEmp) {
      onUpdateEmployee({
        ...(formData as Employee),
        id: editingEmp.id,
      });
    } else {
      const newEmp: Employee = {
        id: `emp-${Date.now()}`,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        role: formData.role || 'TEACHER',
        department: formData.department?.trim() || 'Tổ Chuyên Môn',
        phone: formData.phone?.trim() || '0900.000.000',
        email: formData.email?.trim() || `${formData.code?.toLowerCase()}@school.edu.vn`,
        isActive: formData.isActive ?? true,
        notes: formData.notes?.trim() || '',
      };
      onAddEmployee(newEmp);
      if (autoSyncAfterAdd && onOpenSyncModal) {
        setTimeout(() => onOpenSyncModal(newEmp.id), 250);
      }
    }

    setIsAddModalOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await ExportService.parseEmployeeExcel(file);
      setImportResult(res);
      setIsImportModalOpen(true);
    } catch (err: any) {
      setToastMessage({
        text: `Lỗi khi đọc file Excel: ${err?.message || 'Tệp không đúng định dạng'}`,
        type: 'error',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = (
    employeesToSave: Employee[],
    mode: 'merge_update' | 'add_only' | 'replace_all',
    summaryMessage: string
  ) => {
    onImportEmployees(employeesToSave, mode);
    setToastMessage({
      text: summaryMessage,
      type: 'success',
    });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === summaryMessage ? null : prev));
    }, 6000);
  };

  const getRoleBadge = (role: EmployeeRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/40">
            Ban Giám Hiệu
          </span>
        );
      case 'GUARD':
        return (
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
            Bảo Vệ
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800/40">
            Giáo Viên
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs shadow-xs animate-in slide-in-from-top duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            )}
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search & Role Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã nhân sự, bộ môn, SĐT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
            {(
              [
                { id: 'ALL', label: `Tất cả (${employees.length})` },
                { id: 'TEACHER', label: `Giáo viên (${employees.filter((e) => e.role === 'TEACHER').length})` },
                { id: 'ADMIN', label: `BGH (${employees.filter((e) => e.role === 'ADMIN').length})` },
                { id: 'GUARD', label: `Bảo vệ (${employees.filter((e) => e.role === 'GUARD').length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  roleFilter === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons: Add, Import, Download Template, Sync to Schedule */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenSyncModal ? (
            <button
              onClick={() => onOpenSyncModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Đồng bộ lịch trực khi có nhân sự mới, cân bằng tải và lấp đầy ca trống"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Đồng Bộ Lịch Trực</span>
              {zeroDutyEmployees.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full font-bold">
                  {zeroDutyEmployees.length}
                </span>
              )}
            </button>
          ) : onAutoFillShifts && (
            <button
              onClick={onAutoFillShifts}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold transition-colors border border-indigo-200 dark:border-indigo-800"
              title="Tự động gán nhân sự vào các ca trực còn trống trong tháng"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Đồng Bộ Vào Lịch Trực</span>
            </button>
          )}

          <button
            onClick={ExportService.downloadEmployeeTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700"
            title="Tải mẫu Excel để chuẩn bị danh sách cán bộ"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải Mẫu Excel</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            title="Nhập danh sách từ file Excel"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Nhập Từ Excel</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Thêm Nhân Sự Mới</span>
          </button>
        </div>
      </div>

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

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-20">Mã NS</th>
                <th className="py-3 px-3">Họ và tên</th>
                <th className="py-3 px-3 w-32">Chức vụ</th>
                <th className="py-3 px-3">Bộ phận / Tổ chuyên môn</th>
                <th className="py-3 px-3 w-32">Số điện thoại</th>
                <th className="py-3 px-3">Email liên hệ</th>
                <th className="py-3 px-3 w-28 text-center">Trạng thái trực</th>
                <th className="py-3 px-4 w-28 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    Không tìm thấy nhân sự phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {emp.code}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{emp.name}</div>
                      {emp.notes && <div className="text-[11px] text-slate-400">{emp.notes}</div>}
                    </td>
                    <td className="py-2.5 px-3">{getRoleBadge(emp.role)}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {emp.department}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                      {emp.phone}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] truncate max-w-[180px]">
                      {emp.email}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          disabled={!canManage}
                          onClick={() =>
                            canManage &&
                            onUpdateEmployee({
                              ...emp,
                              isActive: !emp.isActive,
                            })
                          }
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                            emp.isActive
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40'
                              : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                          }`}
                          title={canManage ? 'Click để bật/tắt tham gia trực' : undefined}
                        >
                          {emp.isActive ? 'Đang trực' : 'Tạm nghỉ'}
                        </button>

                        {emp.isActive && (
                          dutyCounts.get(emp.id) === 0 ? (
                            <button
                              onClick={() => onOpenSyncModal?.(emp.id)}
                              className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800 font-bold flex items-center gap-0.5 cursor-pointer transition-colors"
                              title="Cán bộ chưa có ca trực nào trong tháng. Bấm để đồng bộ phân bổ ca ngay."
                            >
                              <Sparkles className="w-2.5 h-2.5 text-rose-500" />
                              <span>0 ca &bull; Đồng bộ</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono font-medium">
                              {dutyCounts.get(emp.id)} ca trực
                            </span>
                          )
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {emp.isActive && onOpenSyncModal && (
                          <button
                            onClick={() => onOpenSyncModal(emp.id)}
                            title={`Đồng bộ lịch trực cho ${emp.name}`}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          title="Chỉnh sửa thông tin nhân sự"
                          className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(emp.id)}
                          title="Xóa nhân sự"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>Xác Nhận Xóa Nhân Sự</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Bạn có chắc chắn muốn xóa nhân sự này khỏi danh sách? Thao tác này sẽ cập nhật các ca
              trực liên quan thành trạng thái thiếu người.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  onDeleteEmployee(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {editingEmp ? 'Chỉnh Sửa Thông Tin Nhân Sự' : 'Thêm Nhân Sự Mới'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã Nhân Sự <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Chức Vụ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value as EmployeeRole })
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="TEACHER">Giáo Viên</option>
                    <option value="ADMIN">Ban Giám Hiệu</option>
                    <option value="GUARD">Bảo Vệ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Họ Và Tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bộ Phận / Tổ Chuyên Môn
                </label>
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="VD: Tổ Toán - Tin, Tổ Bảo vệ..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số Điện Thoại
                  </label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="VD: 0912.345.678"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="VD: gv01@school.edu.vn"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi Chú
                </label>
                <input
                  type="text"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="VD: Chủ nhiệm lớp 12A1..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive ?? true}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isActiveToggle" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  Kích hoạt tham gia trực quản sinh
                </label>
              </div>

              {!editingEmp && onOpenSyncModal && (
                <div className="flex items-center gap-2 pt-1 p-2 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
                  <input
                    type="checkbox"
                    id="autoSyncScheduleCheckbox"
                    checked={autoSyncAfterAdd}
                    onChange={(e) => setAutoSyncAfterAdd(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="autoSyncScheduleCheckbox" className="text-xs text-indigo-900 dark:text-indigo-200 font-semibold cursor-pointer">
                    Tự động mở Đồng Bộ Lịch Trực cho nhân sự này ngay sau khi thêm
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  {editingEmp ? 'Lưu Thay Đổi' : 'Thêm Nhân Sự'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Excel Import Preview & Confirmation Modal */}
      <EmployeeImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        importResult={importResult}
        existingEmployees={employees}
        onConfirmImport={handleConfirmImport}
      />
    </div>
  );
};
