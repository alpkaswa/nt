import React, { useState, useMemo } from 'react';
import {
  X,
  Mail,
  Send,
  ExternalLink,
  Copy,
  Check,
  User,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ShiftAssignment, Employee, ScheduleSettings } from '../types';
import { buildShiftEmailContent, openGmailCompose, openMailto } from '../services/emailService';
import { getDayNameVN, parseDate } from '../services/scheduler';

interface GmailNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftAssignment;
  employees: Employee[];
  settings: ScheduleSettings;
}

export const GmailNotificationModal: React.FC<GmailNotificationModalProps> = ({
  isOpen,
  onClose,
  shift,
  employees,
  settings,
}) => {
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  // Danh sách các nhân sự được gán trong ca trực
  const assignedPersonnel = useMemo(() => {
    const list: Array<{ roleName: string; emp: Employee | undefined }> = [
      { roleName: 'Giáo viên 1', emp: shift.teacher1Id ? empMap.get(shift.teacher1Id) : undefined },
      { roleName: 'Giáo viên 2', emp: shift.teacher2Id ? empMap.get(shift.teacher2Id) : undefined },
      { roleName: 'Ban Giám Hiệu', emp: shift.adminId ? empMap.get(shift.adminId) : undefined },
      { roleName: 'Bảo vệ', emp: shift.guardId ? empMap.get(shift.guardId) : undefined },
    ];
    return list.filter((item) => item.emp !== undefined) as Array<{
      roleName: string;
      emp: Employee;
    }>;
  }, [shift, empMap]);

  // Chọn mặc định người đầu tiên
  const currentRecipient = useMemo(() => {
    if (selectedRecipientId) {
      return empMap.get(selectedRecipientId) || assignedPersonnel[0]?.emp;
    }
    return assignedPersonnel[0]?.emp;
  }, [selectedRecipientId, empMap, assignedPersonnel]);

  const emailPayload = useMemo(() => {
    if (!currentRecipient) return null;
    return buildShiftEmailContent(shift, currentRecipient, employees, settings);
  }, [shift, currentRecipient, employees, settings]);

  if (!isOpen) return null;

  const dObj = parseDate(shift.date);
  const dayName = getDayNameVN(shift.dayOfWeek);
  const formattedDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;

  const handleCopyBody = () => {
    if (!emailPayload) return;
    navigator.clipboard.writeText(`Tiêu đề: ${emailPayload.subject}\n\n${emailPayload.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenGmail = () => {
    if (!emailPayload) return;
    openGmailCompose(emailPayload);
  };

  const handleOpenMailto = () => {
    if (!emailPayload) return;
    openMailto(emailPayload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs no-print">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                Thông Báo Ca Trực Quản Sinh Qua Gmail
              </h3>
              <p className="text-xs text-slate-500">
                Ca trực ngày {formattedDate} ({dayName}) · 24 giờ liên tục
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
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Select Recipient */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Gửi Thông Báo Đến Nhân Sự:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {assignedPersonnel.map(({ roleName, emp }) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedRecipientId(emp.id)}
                  className={`p-2 rounded-lg text-left border transition-all ${
                    currentRecipient?.id === emp.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase truncate">{roleName}</div>
                  <div className="text-xs font-bold truncate mt-0.5">{emp.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{emp.email}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Email Preview */}
          {emailPayload ? (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Người nhận:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {emailPayload.to}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-slate-500 shrink-0">Tiêu đề:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-right">
                    {emailPayload.subject}
                  </span>
                </div>
              </div>

              {/* Message Body View */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nội dung soạn sẵn:
                  </label>
                  <button
                    onClick={handleCopyBody}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600">Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép thư</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-sans text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto">
                  {emailPayload.body}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400">
              Chưa có nhân sự nào được phân công trong ca này để gửi thông báo.
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-[11px] text-slate-500">
            Hệ thống hỗ trợ kích hoạt trực tiếp giao diện Gmail soạn thư chính thức.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenMailto}
              disabled={!emailPayload}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Mở Ứng Dụng Email (mailto)
            </button>

            <button
              type="button"
              onClick={handleOpenGmail}
              disabled={!emailPayload}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở Soạn Thư Trên Gmail</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
