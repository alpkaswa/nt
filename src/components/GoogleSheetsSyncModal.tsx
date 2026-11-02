import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Send,
  Database,
  Users,
  Calendar,
  History,
  Key,
} from 'lucide-react';
import { GoogleSheetsConfig, SyncLog, ShiftAssignment, Employee } from '../types';
import { GoogleSheetsService } from '../services/googleSheetsService';
import { SupabaseDbService } from '../services/supabaseDb';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  shifts: ShiftAssignment[];
  employees: Employee[];
  initialAccessToken?: string;
  onSyncComplete?: (message: string) => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  shifts,
  employees,
  initialAccessToken,
  onSyncComplete,
}) => {
  const [config, setConfig] = useState<GoogleSheetsConfig>(GoogleSheetsService.getConfig());
  const [spreadsheetInput, setSpreadsheetInput] = useState(config.spreadsheetId || '');
  const [accessToken, setAccessToken] = useState(config.accessToken || initialAccessToken || '');
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingShifts, setIsSyncingShifts] = useState(false);
  const [isSyncingEmployees, setIsSyncingEmployees] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; title?: string } | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Nạp nhật ký đồng bộ
  const loadLogs = async () => {
    const logs = await SupabaseDbService.fetchSyncLogs();
    setSyncLogs(logs.filter((l) => l.serviceType === 'GOOGLE_SHEETS'));
  };

  useEffect(() => {
    if (isOpen) {
      const cur = GoogleSheetsService.getConfig();
      setConfig(cur);
      setSpreadsheetInput(cur.spreadsheetId || '');
      if (initialAccessToken && !cur.accessToken) {
        setAccessToken(initialAccessToken);
      } else {
        setAccessToken(cur.accessToken || '');
      }
      setTestResult(null);
      loadLogs();
    }
  }, [isOpen, initialAccessToken]);

  if (!isOpen) return null;

  // Xử lý kiểm tra kết nối thực tế
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const res = await GoogleSheetsService.testConnection(spreadsheetInput, accessToken);
    setIsTesting(false);
    setTestResult(res);

    if (res.success) {
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        spreadsheetId: GoogleSheetsService.extractSpreadsheetId(spreadsheetInput),
        accessToken,
        isConnected: true,
      };
      setConfig(updatedConfig);
      GoogleSheetsService.saveConfig(updatedConfig);
    }
  };

  // Đồng bộ lịch trực sang Google Sheets
  const handleSyncShifts = async () => {
    if (!spreadsheetInput.trim() || !accessToken.trim()) {
      setTestResult({
        success: false,
        message: 'Vui lòng nhập đầy đủ Spreadsheet ID và Google Access Token.',
      });
      return;
    }

    setIsSyncingShifts(true);
    const res = await GoogleSheetsService.syncShiftsToGoogleSheets(
      spreadsheetInput,
      accessToken,
      shifts,
      employees
    );
    setIsSyncingShifts(false);

    setTestResult({
      success: res.success,
      message: res.message,
    });

    await loadLogs();

    if (res.success && onSyncComplete) {
      onSyncComplete(res.message);
    }
  };

  // Đồng bộ danh sách cán bộ sang Google Sheets
  const handleSyncEmployees = async () => {
    if (!spreadsheetInput.trim() || !accessToken.trim()) {
      setTestResult({
        success: false,
        message: 'Vui lòng nhập đầy đủ Spreadsheet ID và Google Access Token.',
      });
      return;
    }

    setIsSyncingEmployees(true);
    const res = await GoogleSheetsService.syncEmployeesToGoogleSheets(
      spreadsheetInput,
      accessToken,
      employees
    );
    setIsSyncingEmployees(false);

    setTestResult({
      success: res.success,
      message: res.message,
    });

    await loadLogs();

    if (res.success && onSyncComplete) {
      onSyncComplete(res.message);
    }
  };

  const cleanSpreadsheetId = GoogleSheetsService.extractSpreadsheetId(spreadsheetInput);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Đồng Bộ Google Sheets API Thực Tế
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kết nối Google Sheets v4 · Đồng bộ lịch trực và nhân sự không trùng lặp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Thông báo kết quả kiểm tra / đồng bộ */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold">{testResult.success ? 'Thao Tác Thành Công' : 'Có Lỗi Xảy Ra'}</div>
                <div className="mt-0.5 leading-relaxed">{testResult.message}</div>
              </div>
            </div>
          )}

          {/* Form cấu hình kết nối */}
          <div className="space-y-4">
            {/* Input 1: Spreadsheet ID hoặc URL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Google Spreadsheet ID hoặc Đường Link Bảng Tính <span className="text-rose-500">*</span>
                </label>
                {cleanSpreadsheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${cleanSpreadsheetId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                  >
                    <span>Mở bảng tính Google</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <input
                type="text"
                value={spreadsheetInput}
                onChange={(e) => setSpreadsheetInput(e.target.value)}
                placeholder="Dán URL bảng tính hoặc ID: ví dụ 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Mẹo: Bạn có thể dán toàn bộ đường link trình duyệt của file Google Sheets vào đây.
              </p>
            </div>

            {/* Input 2: Google Access Token */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mã Truy Cập Google OAuth Access Token (Scope: spreadsheets) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="ya29.a0AfH6SM..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Token được tự động cấp khi bạn đăng nhập tài khoản Google của trường hoặc cấu hình qua Google Cloud Console.
              </p>
            </div>
          </div>

          {/* Hàng nút bấm Hành Động */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              {/* Nút Kiểm Tra Kết Nối */}
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Đang kiểm tra API...' : 'Kiểm Tra Kết Nối Thực Tế'}</span>
              </button>

              {/* Nút Đồng Bộ Lịch Trực */}
              <button
                type="button"
                onClick={handleSyncShifts}
                disabled={isSyncingShifts}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition-colors disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{isSyncingShifts ? 'Đang xuất lịch...' : `Xuất Lịch Trực (${shifts.length} Ca)`}</span>
              </button>

              {/* Nút Đồng Bộ Cán Bộ */}
              <button
                type="button"
                onClick={handleSyncEmployees}
                disabled={isSyncingEmployees}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-600/20 transition-colors disabled:opacity-50"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{isSyncingEmployees ? 'Đang xuất cán bộ...' : `Xuất Cán Bộ (${employees.length} Người)`}</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                Cơ chế tự động Clear & Update chính xác dải ô — hoàn toàn không tạo bản ghi trùng lặp khi đồng bộ nhiều lần.
              </span>
            </div>
          </div>

          {/* Nhật Ký Đồng Bộ (Sync Logs) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <History className="w-4 h-4 text-slate-500" />
                <span>Nhật Ký Đồng Bộ Google Sheets Gần Đây</span>
              </div>
              <button
                type="button"
                onClick={loadLogs}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Làm mới
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {syncLogs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">Chưa có nhật ký đồng bộ nào được ghi nhận.</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {syncLogs.map((log) => (
                    <div key={log.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {log.action === 'EXPORT_SHIFTS' ? 'Xuất Lịch Trực' : 'Xuất Danh Sách Cán Bộ'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            ({log.recordsSynced} dòng)
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">{log.details}</div>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {config.lastSyncedAt ? (
              <span>Lần đồng bộ gần nhất: {new Date(config.lastSyncedAt).toLocaleString('vi-VN')}</span>
            ) : (
              <span>Chưa thực hiện đồng bộ</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
