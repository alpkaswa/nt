import React, { useState, useMemo } from 'react';
import {
  CalendarX2,
  Plus,
  Check,
  X,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { UnavailableDate, Employee, AppUserRole, LeaveStatus, ShiftAssignment } from '../types';
import { isEmployeeOnDutyOnDate } from '../services/scheduler';
import { Sparkles } from 'lucide-react';

interface UnavailableDatesViewProps {
  unavailableDates: UnavailableDate[];
  employees: Employee[];
  shifts?: ShiftAssignment[];
  currentUserRole: AppUserRole;
  onAddLeave: (leave: UnavailableDate) => void;
  onUpdateStatus: (leaveId: string, status: LeaveStatus) => void;
  onDeleteLeave: (leaveId: string) => void;
}

export const UnavailableDatesView: React.FC<UnavailableDatesViewProps> = ({
  unavailableDates,
  employees,
  shifts = [],
  currentUserRole,
  onAddLeave,
  onUpdateStatus,
  onDeleteLeave,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LeaveStatus>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoApproveImmediately, setAutoApproveImmediately] = useState(false);

  // Form state
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const [leaveDate, setLeaveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('');

  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const canApprove = currentUserRole === 'ADMIN' || currentUserRole === 'BGH';

  const filteredLeaves = useMemo(() => {
    return unavailableDates.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const emp = empMap.get(item.employeeId);
        return (
          item.date.includes(q) ||
          item.reason.toLowerCase().includes(q) ||
          (emp && emp.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [unavailableDates, statusFilter, searchTerm, empMap]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !leaveDate || !leaveReason.trim()) return;

    // QUAN TRỌNG: Mặc định tất cả đơn đăng ký phải là PENDING (Chờ duyệt).
    // Không được tự động duyệt khi chưa được sự cho phép hoặc thao tác phê duyệt của BGH!
    const isDirectApproved = Boolean(canApprove && autoApproveImmediately);

    const newLeave: UnavailableDate = {
      id: `leave-${Date.now()}`,
      employeeId: selectedEmpId,
      date: leaveDate,
      reason: leaveReason.trim(),
      status: isDirectApproved ? 'APPROVED' : 'PENDING',
      createdAt: new Date().toISOString(),
    };

    onAddLeave(newLeave);
    setIsModalOpen(false);
    setLeaveReason('');
    setAutoApproveImmediately(false);
  };

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3" />
            <span>Đã duyệt</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800/40">
            <XCircle className="w-3 h-3" />
            <span>Từ chối</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
            <Clock className="w-3 h-3" />
            <span>Chờ duyệt</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Auto-swap feature banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-950/40 dark:to-sky-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 dark:text-indigo-200">
          <span className="font-bold">Cơ chế Tự Động Thay Ca Khi Phê Duyệt Lịch Bận:</span>{' '}
          Khi Ban Giám Hiệu phê duyệt đơn nghỉ phép, nếu cán bộ/giáo viên đó đang có lịch trực trong
          ngày, hệ thống sẽ <strong>tự động tìm nhân sự thay thế tối ưu</strong> (cùng chức vụ, không
          trực 2 ngày liên tiếp, số ca ít nhất) và cập nhật thẳng vào lịch trực mà không cần thao tác thủ công.
        </div>
      </div>

      {/* Top Filter and Actions Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo ngày hoặc tên nhân sự..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
            {(
              [
                { id: 'ALL', label: 'Tất cả' },
                { id: 'PENDING', label: 'Chờ duyệt' },
                { id: 'APPROVED', label: 'Đã duyệt' },
                { id: 'REJECTED', label: 'Từ chối' },
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

        {/* Register Button */}
        <button
          onClick={() => {
            setAutoApproveImmediately(false);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Đăng Ký Ngày Bận / Nghỉ Phép</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-32">Ngày bận</th>
                <th className="py-3 px-3">Họ và tên nhân sự</th>
                <th className="py-3 px-3 w-32">Chức vụ</th>
                <th className="py-3 px-3">Lý do vắng mặt / không thể trực</th>
                <th className="py-3 px-3 w-28 text-center">Trạng thái</th>
                <th className="py-3 px-4 w-36 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Không có đơn xin nghỉ phép nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => {
                  const emp = empMap.get(leave.employeeId);
                  return (
                    <tr
                      key={leave.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {leave.date}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{emp ? emp.name : 'Nhân sự không xác định'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {emp ? `${emp.code} · ${emp.department}` : ''}
                        </div>
                        {isEmployeeOnDutyOnDate(leave.employeeId, leave.date, shifts) && (
                          <div className="mt-1">
                            {leave.status === 'PENDING' ? (
                              <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/40">
                                ⚡ Có ca trực ngày này · Tự động đổi ca khi duyệt
                              </span>
                            ) : leave.status === 'APPROVED' ? (
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                ✓ Đã tự động thay thế nhân sự
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {emp?.role === 'ADMIN'
                          ? 'Ban Giám Hiệu'
                          : emp?.role === 'GUARD'
                          ? 'Bảo Vệ'
                          : 'Giáo Viên'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {leave.reason}
                      </td>
                      <td className="py-2.5 px-3 text-center">{getStatusBadge(leave.status)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canApprove ? (
                            leave.status === 'PENDING' ? (
                              <>
                                <button
                                  onClick={() => onUpdateStatus(leave.id, 'APPROVED')}
                                  title="Phê duyệt đơn nghỉ và tự động thay ca trực"
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors cursor-pointer"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => onUpdateStatus(leave.id, 'REJECTED')}
                                  title="Từ chối đơn nghỉ"
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => onUpdateStatus(leave.id, leave.status === 'APPROVED' ? 'REJECTED' : 'APPROVED')}
                                title={leave.status === 'APPROVED' ? 'Chuyển sang từ chối' : 'Phê duyệt lại đơn nghỉ'}
                                className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              >
                                {leave.status === 'APPROVED' ? 'Hủy duyệt' : 'Duyệt lại'}
                              </button>
                            )
                          ) : (
                            leave.status === 'PENDING' ? (
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-1 rounded border border-amber-200 dark:border-amber-800/40">
                                Chờ BGH duyệt
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400 italic">
                                Chỉ xem
                              </span>
                            )
                          )}

                          <button
                            onClick={() => onDeleteLeave(leave.id)}
                            title="Xóa đơn đăng ký"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Đăng Ký Ngày Bận / Nghỉ Phép Mới
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn Nhân Sự <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  Ngày Bận / Không Thể Trực <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lý Do Nghỉ / Bận <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="VD: Đi công tác tập huấn chuyên môn, có việc hiếu hỉ, khám chữa bệnh..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Notice that leave starts as PENDING */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Trạng thái ban đầu: Chờ Ban Giám Hiệu phê duyệt</div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                    Đơn đăng ký mới sẽ không tự động thay đổi lịch trực cho đến khi Ban Giám Hiệu xem xét và bấm nút Phê duyệt (dấu tích xanh) trên danh sách.
                  </div>
                </div>
              </div>

              {canApprove && (
                <label className="flex items-center gap-2 cursor-pointer pt-1 px-1 select-none">
                  <input
                    type="checkbox"
                    checked={autoApproveImmediately}
                    onChange={(e) => setAutoApproveImmediately(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Phê duyệt ngay lập tức (Chỉ khi Ban Giám Hiệu trực tiếp chỉ định)
                  </span>
                </label>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs cursor-pointer"
                >
                  {canApprove && autoApproveImmediately ? 'Lưu & Phê Duyệt Ngay' : 'Gửi Đơn Đăng Ký (Chờ BGH Duyệt)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
