import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  AlertTriangle,
  User,
  Send,
  ShieldCheck,
  Check,
  Lock,
} from 'lucide-react';
import {
  ShiftAssignment,
  ShiftChangeRequest,
  Employee,
  AppUserRole,
  AuthUser,
} from '../types';
import { getDayNameVN, parseDate } from '../services/scheduler';

interface ShiftSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: ShiftChangeRequest[];
  shifts: ShiftAssignment[];
  employees: Employee[];
  authUser: AuthUser | null;
  currentUserRole: AppUserRole;
  onCreateSwapRequest: (
    req: Omit<ShiftChangeRequest, 'id' | 'createdAt'>
  ) => Promise<void>;
  onAcceptSwap: (requestId: string) => Promise<{ success: boolean; message: string }>;
  onRejectSwap: (requestId: string) => Promise<void>;
}

export const ShiftSwapModal: React.FC<ShiftSwapModalProps> = ({
  isOpen,
  onClose,
  requests,
  shifts,
  employees,
  authUser,
  currentUserRole,
  onCreateSwapRequest,
  onAcceptSwap,
  onRejectSwap,
}) => {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'create' | 'all'>('incoming');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Form states for creating a new swap request
  const [selectedMyShiftId, setSelectedMyShiftId] = useState<string>('');
  const [selectedTargetShiftId, setSelectedTargetShiftId] = useState<string>('');
  const [swapReason, setSwapReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  // Tìm employee ID tương ứng với tài khoản đăng nhập hiện tại
  const currentEmp = useMemo(() => {
    if (!authUser) return null;
    return employees.find((e) => e.email.toLowerCase() === authUser.email.toLowerCase()) || null;
  }, [authUser, employees]);

  const currentEmpId = currentEmp?.id;

  // Lọc các ca trực của tôi trong tương lai hoặc hiện tại
  const myShifts = useMemo(() => {
    if (!currentEmpId) {
      // Nếu là Admin, có thể chọn bất kỳ ca nào để đại diện
      return shifts.filter((s) => !s.isLocked);
    }
    return shifts.filter((s) => {
      const isMyShift =
        s.teacher1Id === currentEmpId ||
        s.teacher2Id === currentEmpId ||
        s.adminId === currentEmpId ||
        s.guardId === currentEmpId;
      return isMyShift && !s.isLocked;
    });
  }, [shifts, currentEmpId]);

  // Xác định vị trí của tôi trong ca đã chọn
  const myPositionInSelectedShift = useMemo<'teacher1' | 'teacher2' | 'admin' | 'guard' | null>(() => {
    if (!selectedMyShiftId) return null;
    const shift = shifts.find((s) => s.id === selectedMyShiftId);
    if (!shift) return null;
    if (shift.teacher1Id === currentEmpId) return 'teacher1';
    if (shift.teacher2Id === currentEmpId) return 'teacher2';
    if (shift.adminId === currentEmpId) return 'admin';
    if (shift.guardId === currentEmpId) return 'guard';
    return 'teacher1'; // Fallback
  }, [shifts, selectedMyShiftId, currentEmpId]);

  // Lọc các ca trực của đồng nghiệp có cùng vai trò để đổi
  const potentialTargetShifts = useMemo(() => {
    if (!selectedMyShiftId) return [];
    const myShift = shifts.find((s) => s.id === selectedMyShiftId);
    if (!myShift) return [];

    return shifts.filter((s) => {
      if (s.id === myShift.id) return false;
      if (s.isLocked) return false; // Không đổi ca đã khóa

      // Kiểm tra có người cùng vai trò trong ca đó
      if (myPositionInSelectedShift === 'teacher1' || myPositionInSelectedShift === 'teacher2') {
        return (
          (s.teacher1Id && s.teacher1Id !== currentEmpId) ||
          (s.teacher2Id && s.teacher2Id !== currentEmpId)
        );
      }
      if (myPositionInSelectedShift === 'admin') {
        return s.adminId && s.adminId !== currentEmpId;
      }
      if (myPositionInSelectedShift === 'guard') {
        return s.guardId && s.guardId !== currentEmpId;
      }
      return true;
    });
  }, [shifts, selectedMyShiftId, myPositionInSelectedShift, currentEmpId]);

  // Các yêu cầu gửi ĐẾN tôi
  const incomingRequests = useMemo(() => {
    return requests.filter((r) => {
      if (currentUserRole === 'ADMIN') return true;
      return r.targetEmployeeId === currentEmpId;
    });
  }, [requests, currentEmpId, currentUserRole]);

  // Các yêu cầu do TÔI gửi
  const outgoingRequests = useMemo(() => {
    return requests.filter((r) => {
      if (currentUserRole === 'ADMIN') return true;
      return r.requesterId === currentEmpId;
    });
  }, [requests, currentEmpId, currentUserRole]);

  if (!isOpen) return null;

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedMyShiftId || !selectedTargetShiftId) {
      setErrorMsg('Vui lòng chọn cả ca trực của bạn và ca muốn đổi.');
      return;
    }

    if (!swapReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do đổi ca trực.');
      return;
    }

    const myShift = shifts.find((s) => s.id === selectedMyShiftId);
    const targetShift = shifts.find((s) => s.id === selectedTargetShiftId);

    if (!myShift || !targetShift) {
      setErrorMsg('Ca trực không hợp lệ.');
      return;
    }

    // Xác định người đích và vị trí đích
    let targetEmployeeId = '';
    let targetPosition: 'teacher1' | 'teacher2' | 'admin' | 'guard' = 'teacher1';

    if (myPositionInSelectedShift === 'teacher1' || myPositionInSelectedShift === 'teacher2') {
      if (targetShift.teacher1Id && targetShift.teacher1Id !== currentEmpId) {
        targetEmployeeId = targetShift.teacher1Id;
        targetPosition = 'teacher1';
      } else if (targetShift.teacher2Id && targetShift.teacher2Id !== currentEmpId) {
        targetEmployeeId = targetShift.teacher2Id;
        targetPosition = 'teacher2';
      }
    } else if (myPositionInSelectedShift === 'admin' && targetShift.adminId) {
      targetEmployeeId = targetShift.adminId;
      targetPosition = 'admin';
    } else if (myPositionInSelectedShift === 'guard' && targetShift.guardId) {
      targetEmployeeId = targetShift.guardId;
      targetPosition = 'guard';
    }

    if (!targetEmployeeId) {
      setErrorMsg('Không tìm thấy nhân sự phù hợp trong ca trực đích.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateSwapRequest({
        requesterId: currentEmpId || 'ADMIN',
        shiftDate: myShift.date,
        targetEmployeeId,
        targetShiftDate: targetShift.date,
        requesterShiftId: myShift.id,
        targetShiftId: targetShift.id,
        requesterRolePosition: myPositionInSelectedShift || 'teacher1',
        targetRolePosition: targetPosition,
        reason: swapReason.trim(),
        status: 'PENDING',
      });

      setSelectedMyShiftId('');
      setSelectedTargetShiftId('');
      setSwapReason('');
      setActiveTab('outgoing');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo yêu cầu đổi ca.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await onAcceptSwap(requestId);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await onRejectSwap(requestId);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/60">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Quản Lý Hoán Đổi Ca Trực
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đổi ca an toàn tuyệt đối qua Firestore Transaction thời gian thực
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="px-6 pt-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'incoming'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <span>Yêu Cầu Gửi Đến Tôi</span>
            {incomingRequests.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {incomingRequests.filter((r) => r.status === 'PENDING').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('outgoing')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'outgoing'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <span>Đề Nghị Tôi Đã Gửi</span>
            <span className="text-[11px] font-mono text-slate-400">({outgoingRequests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Tạo Đề Nghị Đổi Ca</span>
          </button>

          {currentUserRole === 'ADMIN' && (
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <span>Toàn Bộ ({requests.length})</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: YÊU CẦU GỬI ĐẾN TÔI */}
          {activeTab === 'incoming' && (
            <div className="space-y-3">
              {incomingRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                  <p className="text-xs">Hiện không có đề nghị đổi ca nào gửi đến bạn.</p>
                </div>
              ) : (
                incomingRequests.map((req) => {
                  const requester = empMap.get(req.requesterId);
                  const isPending = req.status === 'PENDING';

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:shadow-xs transition-shadow space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                            {requester?.name.charAt(0) || 'G'}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              {requester?.name || req.requesterId}{' '}
                              <span className="text-[11px] font-normal text-slate-500 font-mono">
                                ({requester?.code})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Đề nghị gửi lúc: {new Date(req.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {req.status === 'APPROVED'
                            ? 'Đã Đồng Ý & Đã Đổi'
                            : req.status === 'REJECTED'
                            ? 'Đã Từ Chối'
                            : 'Đang Chờ Bạn Xác Nhận'}
                        </span>
                      </div>

                      {/* Chi tiết ca muốn đổi */}
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <span className="text-slate-500">Ca bạn sẽ trực thay:</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                            Ngày {req.shiftDate} ({getDayNameVN(parseDate(req.shiftDate).getDay())})
                          </span>
                        </div>
                        {req.targetShiftDate && (
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                            <span className="text-slate-500">Ca đồng nghiệp trực cho bạn:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                              Ngày {req.targetShiftDate} ({getDayNameVN(parseDate(req.targetShiftDate).getDay())})
                            </span>
                          </div>
                        )}
                        <div className="pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 italic">
                          "Lý do: {req.reason}"
                        </div>
                      </div>

                      {/* Nút hành động */}
                      {isPending && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={processingId === req.id}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                          >
                            Từ Chối
                          </button>
                          <button
                            onClick={() => handleAccept(req.id)}
                            disabled={processingId === req.id}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{processingId === req.id ? 'Đang giao dịch...' : 'Đồng Ý Đổi Ca'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: ĐỀ NGHỊ TÔI ĐÃ GỬI */}
          {activeTab === 'outgoing' && (
            <div className="space-y-3">
              {outgoingRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Send className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                  <p className="text-xs">Bạn chưa gửi đề nghị đổi ca nào.</p>
                </div>
              ) : (
                outgoingRequests.map((req) => {
                  const targetEmp = empMap.get(req.targetEmployeeId);

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          Gửi đến:{' '}
                          <span className="text-indigo-600 dark:text-indigo-400">
                            {targetEmp?.name || req.targetEmployeeId}
                          </span>{' '}
                          <span className="text-slate-400 font-mono font-normal">({targetEmp?.code})</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {req.status === 'APPROVED'
                            ? 'Đồng Nghiệp Đã Đồng Ý'
                            : req.status === 'REJECTED'
                            ? 'Đồng Nghiệp Đã Từ Chối'
                            : 'Đang Chờ Phản Hồi'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                        Ca của bạn: {req.shiftDate} ⇄ Ca của họ: {req.targetShiftDate || 'Trực thay'}
                      </div>
                      <div className="text-[11px] text-slate-500 italic">"Lý do: {req.reason}"</div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: TẠO ĐỀ NGHỊ ĐỔI CA */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateRequest} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Chọn ca của tôi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  1. Chọn ca trực của bạn muốn đổi <span className="text-rose-500">*</span>
                </label>
                {myShifts.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">
                    Bạn hiện chưa được phân công ca trực nào còn mở để có thể đổi.
                  </div>
                ) : (
                  <select
                    value={selectedMyShiftId}
                    onChange={(e) => {
                      setSelectedMyShiftId(e.target.value);
                      setSelectedTargetShiftId('');
                    }}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  >
                    <option value="">-- Bấm để chọn ca trực của bạn --</option>
                    {myShifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        Ngày {s.date} ({getDayNameVN(parseDate(s.date).getDay())}) - {s.startTime} đến {s.endTime}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. Chọn ca của đồng nghiệp muốn đổi sang */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  2. Chọn ca trực của đồng nghiệp muốn hoán đổi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedTargetShiftId}
                  onChange={(e) => setSelectedTargetShiftId(e.target.value)}
                  disabled={!selectedMyShiftId || potentialTargetShifts.length === 0}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono disabled:opacity-50"
                >
                  <option value="">
                    {!selectedMyShiftId
                      ? '-- Vui lòng chọn ca của bạn trước --'
                      : potentialTargetShifts.length === 0
                      ? '-- Không có ca đồng nghiệp phù hợp --'
                      : '-- Bấm để chọn ca đồng nghiệp --'}
                  </option>
                  {potentialTargetShifts.map((s) => {
                    const t1 = s.teacher1Id ? empMap.get(s.teacher1Id)?.name : null;
                    const t2 = s.teacher2Id ? empMap.get(s.teacher2Id)?.name : null;
                    return (
                      <option key={s.id} value={s.id}>
                        Ngày {s.date} ({getDayNameVN(parseDate(s.date).getDay())}) - Người trực:{' '}
                        {[t1, t2].filter(Boolean).join(' & ')}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 3. Lý do */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  3. Lý do đổi ca <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  placeholder="Ví dụ: Có tiết dự giờ chuyên đề cụm trường, việc gia đình đột xuất..."
                  rows={2}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Cam kết kiểm tra an toàn */}
              <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-[11px] text-indigo-900 dark:text-indigo-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Cơ Chế Bảo Vệ Toàn Vẹn:</span>
                </div>
                <p>
                  Khi đồng nghiệp bấm Đồng Ý, hệ thống thực thi Firestore Transaction nguyên tử để hoán đổi
                  đồng thời. Nếu 1 trong 2 ca bị khóa hoặc có người khác đổi trước, giao dịch sẽ tự hủy an toàn.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedMyShiftId || !selectedTargetShiftId}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Đang gửi đề nghị...' : 'Gửi Đề Nghị Đổi Ca Trực'}</span>
              </button>
            </form>
          )}

          {/* TAB 4: TOÀN BỘ DANH SÁCH (DÀNH CHO ADMIN) */}
          {activeTab === 'all' && currentUserRole === 'ADMIN' && (
            <div className="space-y-2">
              {requests.map((r) => {
                const reqEmp = empMap.get(r.requesterId);
                const tarEmp = empMap.get(r.targetEmployeeId);
                return (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {reqEmp?.name} ({r.shiftDate}) ⇄ {tarEmp?.name} ({r.targetShiftDate})
                      </div>
                      <div className="text-[11px] text-slate-400">Lý do: {r.reason}</div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
