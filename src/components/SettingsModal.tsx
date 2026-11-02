import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Settings,
  Download,
  Upload,
  RotateCcw,
  Save,
  Check,
  AlertTriangle,
  Clock,
  School,
  Database,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Flame,
} from 'lucide-react';
import { ScheduleSettings, Employee, ShiftAssignment, UnavailableDate, CompensatoryDuty } from '../types';
import { StorageService } from '../services/storage';
import { testConnection } from '../services/firebase';
import * as FirebaseDb from '../services/firebaseDb';
import firebaseConfig from '../../firebase-applet-config.json';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ScheduleSettings;
  employees: Employee[];
  shifts: ShiftAssignment[];
  unavailableDates: UnavailableDate[];
  compensatoryDuties: CompensatoryDuty[];
  onSaveSettings: (settings: ScheduleSettings) => void;
  onResetDefaults: () => void;
  onDataReload: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  employees,
  shifts,
  unavailableDates,
  compensatoryDuties,
  onSaveSettings,
  onResetDefaults,
  onDataReload,
}) => {
  const [activeTab, setActiveTab] = useState<'DATABASE' | 'SCHEDULE' | 'BACKUP'>('DATABASE');
  const [formData, setFormData] = useState<ScheduleSettings>({ ...settings });
  const [isSaved, setIsSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Firebase testing states
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [firebaseTestRes, setFirebaseTestRes] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...settings });
      setFirebaseTestRes(null);
      setStatusMessage(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmitSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Kiểm tra kết nối Firestore
  const handleTestFirebase = async () => {
    setIsTestingFirebase(true);
    setFirebaseTestRes(null);

    const isConnected = await testConnection();
    setIsTestingFirebase(false);

    if (isConnected) {
      setFirebaseTestRes({
        success: true,
        message: 'Kết nối Cloud Firestore thành công! Trực tuyến và sẵn sàng đồng bộ thời gian thực.',
      });
    } else {
      setFirebaseTestRes({
        success: false,
        message: 'Không thể kết nối tới Cloud Firestore. Vui lòng kiểm tra kết nối mạng.',
      });
    }
  };

  // Đồng bộ lại toàn bộ dữ liệu mẫu lên Firestore
  const handleSyncToFirestore = async () => {
    setIsSyncing(true);
    try {
      await FirebaseDb.saveEmployeesBatchInDb(employees);
      await FirebaseDb.saveShiftsBatchInDb(shifts);
      await FirebaseDb.saveScheduleSettingsInDb(settings);

      setFirebaseTestRes({
        success: true,
        message: `Đã đồng bộ thành công ${employees.length} cán bộ và ${shifts.length} ca trực lên Cloud Firestore!`,
      });
      onDataReload();
    } catch (e: any) {
      setFirebaseTestRes({
        success: false,
        message: `Lỗi đồng bộ lên Firestore: ${e.message}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Sao lưu JSON
  const handleExportBackup = () => {
    const jsonStr = StorageService.exportDatabaseJSON();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `LICH_TRUC_NA_RI_BACKUP_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setStatusMessage({
      type: 'success',
      text: 'Đã xuất file sao lưu dữ liệu toàn diện thành công.',
    });
  };

  // Phục hồi JSON
  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const success = StorageService.importDatabaseJSON(content);

        if (success) {
          await FirebaseDb.saveEmployeesBatchInDb(StorageService.getEmployees());
          await FirebaseDb.saveShiftsBatchInDb(StorageService.getShifts());
          setStatusMessage({
            type: 'success',
            text: 'Đã khôi phục và đồng bộ dữ liệu lên Firestore thành công!',
          });
          onDataReload();
        } else {
          setStatusMessage({
            type: 'error',
            text: 'File sao lưu không đúng định dạng chuẩn.',
          });
        }
      } catch (err) {
        setStatusMessage({
          type: 'error',
          text: 'Lỗi khi đọc file JSON. Vui lòng kiểm tra lại.',
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-200/60 dark:border-orange-800/60">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Cài Đặt Hệ Thống & Firebase
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quản lý cơ sở dữ liệu Cloud Firestore, tham số xếp lịch và sao lưu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="px-6 pt-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            onClick={() => setActiveTab('DATABASE')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'DATABASE'
                ? 'border-orange-600 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Cloud Firestore</span>
          </button>

          <button
            onClick={() => setActiveTab('SCHEDULE')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'SCHEDULE'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Quy Tắc Xếp Lịch</span>
          </button>

          <button
            onClick={() => setActiveTab('BACKUP')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'BACKUP'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Sao Lưu Dữ Liệu</span>
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: CLOUD FIRESTORE */}
          {activeTab === 'DATABASE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Google Cloud Firestore Realtime
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    Đã Kích Hoạt
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium">Project ID:</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                      {firebaseConfig.projectId}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium">Database ID:</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate" title={firebaseConfig.firestoreDatabaseId}>
                      {firebaseConfig.firestoreDatabaseId}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Cơ sở dữ liệu đang hoạt động ở chế độ thời gian thực onSnapshot. Khi bất kỳ ai thay đổi lịch hoặc đổi ca,
                  mọi người dùng khác đều nhìn thấy dữ liệu mới mà không cần tải lại trang.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleTestFirebase}
                  disabled={isTestingFirebase}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingFirebase ? 'animate-spin' : ''}`} />
                  <span>{isTestingFirebase ? 'Đang kiểm tra...' : 'Kiểm Tra Kết Nối Firestore'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncToFirestore}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng Bộ Dữ Liệu Lên Firestore'}</span>
                </button>
              </div>

              {firebaseTestRes && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    firebaseTestRes.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {firebaseTestRes.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{firebaseTestRes.message}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUY TẮC XẾP LỊCH */}
          {activeTab === 'SCHEDULE' && (
            <form onSubmit={handleSubmitSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên trường học
                </label>
                <input
                  type="text"
                  value={formData.schoolName}
                  onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Giờ bắt đầu ca trực
                  </label>
                  <input
                    type="time"
                    value={formData.shiftStartTime}
                    onChange={(e) => setFormData({ ...formData, shiftStartTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Thời lượng ca trực (Giờ)
                  </label>
                  <input
                    type="number"
                    value={formData.shiftDurationHours}
                    onChange={(e) => setFormData({ ...formData, shiftDurationHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số Giáo Viên / Ca
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={formData.requiredTeachers}
                    onChange={(e) => setFormData({ ...formData, requiredTeachers: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số BGH / Ca
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={formData.requiredAdmins}
                    onChange={(e) => setFormData({ ...formData, requiredAdmins: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số Bảo Vệ / Ca
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={formData.requiredGuards}
                    onChange={(e) => setFormData({ ...formData, requiredGuards: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaved ? 'Đã Lưu Cài Đặt!' : 'Lưu Thay Đổi'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: SAO LƯU */}
          {activeTab === 'BACKUP' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-indigo-500" />
                  <span>Xuất File Sao Lưu Toàn Diện (JSON)</span>
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Tải về bản sao lưu đầy đủ bao gồm danh sách cán bộ, lịch trực 24h, đơn xin nghỉ phép và lịch sử hoán đổi ca.
                </p>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Tải File Sao Lưu Về Máy
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-emerald-500" />
                  <span>Phục Hồi Dữ Liệu Từ File</span>
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Chọn file JSON đã lưu để phục hồi lại lịch trực và tự động đồng bộ lên Firebase.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportBackup}
                  accept=".json"
                  className="text-xs text-slate-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                {!showResetConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Đặt lại dữ liệu mẫu của trường PTDTNT Na Rì</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2">
                    <p className="text-xs text-rose-800 dark:text-rose-300 font-bold">
                      Bạn có chắc muốn đặt lại toàn bộ dữ liệu mẫu (18 cán bộ và lịch tháng 11/2026)?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onResetDefaults();
                          setShowResetConfirm(false);
                        }}
                        className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Xác Nhận Đặt Lại
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(false)}
                        className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
