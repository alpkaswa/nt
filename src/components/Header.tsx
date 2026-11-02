import React from 'react';
import {
  UserCheck,
  Moon,
  Sun,
  Clock,
  Bell,
  LogIn,
  LogOut,
  ShieldCheck,
  User,
  Share2,
  FileSpreadsheet,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AppUserRole, AuthUser } from '../types';
import { useRealTimeClock } from '../hooks/useRealTimeClock';

interface HeaderProps {
  currentTab: string;
  currentUserRole: AppUserRole;
  onRoleChange: (role: AppUserRole) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenGmailNotice?: () => void;
  pendingLeavesCount: number;
  authUser: AuthUser | null;
  onOpenGoogleAuth: () => void;
  onLogout: () => void;
  realtimeStatus?: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  onOpenPublicSchedule?: () => void;
  onOpenGoogleSheets?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  currentUserRole,
  onRoleChange,
  isDarkMode,
  onToggleDarkMode,
  pendingLeavesCount,
  authUser,
  onOpenGoogleAuth,
  onLogout,
  realtimeStatus = 'CONNECTED',
  onOpenPublicSchedule,
  onOpenGoogleSheets,
}) => {
  const { formattedTime, formattedDateFull, handoverStatus } = useRealTimeClock();

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Bảng Điều Khiển Tổng Quan';
      case 'schedule':
        return 'Lịch Trực Quản Sinh Toàn Trường';
      case 'auto-schedule':
        return 'Thuật Toán Xếp Lịch Tự Động';
      case 'employees':
        return 'Quản Lý Danh Sách Nhân Sự';
      case 'leaves':
        return 'Quản Lý Lịch Bận & Đăng Ký Nghỉ Phép';
      case 'compensatory':
        return 'Quản Lý Trực Bù & Hoán Đổi Ca';
      case 'statistics':
        return 'Báo Cáo Thống Kê & Cân Bằng Ca Trực';
      case 'export':
        return 'In Ấn & Xuất Lịch Biểu Chuẩn Bộ GD';
      case 'tests':
        return 'Kiểm Thử Toàn Diện Nghiệp Vụ (23 Kịch Bản)';
      case 'public-schedule':
        return 'Lịch Trực Công Khai (Chế Độ Chia Sẻ)';
      case 'google-sheets':
        return 'Đồng Bộ Google Sheets API';
      default:
        return 'Hệ Thống Quản Lý Lịch Trực';
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 no-print transition-colors">
      {/* Breadcrumb & Section Name */}
      <div className="flex items-center gap-3">
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
          Quản lý nội trú <span className="mx-1">/</span>
        </div>
        <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base tracking-tight truncate max-w-[180px] sm:max-w-xs md:max-w-none">
          {getTabTitle(currentTab)}
        </h2>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Firebase Firestore Realtime Status Badge */}
        <div
          title={
            realtimeStatus === 'CONNECTED'
              ? 'Cloud Firestore: Đang đồng bộ thời gian thực onSnapshot'
              : realtimeStatus === 'CONNECTING'
              ? 'Đang kết nối tới Cloud Firestore...'
              : 'Mất kết nối Firestore (Đang dùng bộ nhớ đệm)'
          }
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              realtimeStatus === 'CONNECTED'
                ? 'bg-emerald-500'
                : realtimeStatus === 'CONNECTING'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-[11px] font-semibold">
            {realtimeStatus === 'CONNECTED'
              ? 'Firestore Realtime'
              : realtimeStatus === 'CONNECTING'
              ? 'Đang kết nối'
              : 'Ngoại tuyến'}
          </span>
        </div>

        {/* Nút Xem Lịch Công Khai */}
        {onOpenPublicSchedule && (
          <button
            onClick={onOpenPublicSchedule}
            title="Mở trang lịch trực chung chia sẻ cho giáo viên và phụ huynh"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Lịch Công Khai</span>
          </button>
        )}

        {/* Real-time Clock Banner */}
        <div
          title="Thời gian thực được đồng bộ hóa tự động"
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums border transition-colors ${
            handoverStatus.isHandoverWindow
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 animate-pulse'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/60'
          }`}
        >
          <Clock
            className={`w-3.5 h-3.5 shrink-0 ${
              handoverStatus.isHandoverWindow
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-indigo-600 dark:text-indigo-400'
            }`}
          />
          <span className="font-mono font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {formattedTime}
          </span>
        </div>

        {/* Pending Leaves notification trigger */}
        {pendingLeavesCount > 0 && (
          <div
            title={`${pendingLeavesCount} đơn xin nghỉ/bận đang chờ duyệt`}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-900/60"
          >
            <Bell className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="tabular-nums font-mono">{pendingLeavesCount}</span>
          </div>
        )}

        {/* Google Authentication & Role Profile */}
        {authUser ? (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 pl-2 pr-1.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="relative">
              {authUser.avatarUrl ? (
                <img
                  src={authUser.avatarUrl}
                  alt={authUser.name}
                  className="w-6 h-6 rounded-full bg-slate-200 border border-slate-300 dark:border-slate-600"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {authUser.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex flex-col text-left">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 max-w-[100px] truncate leading-tight">
                {authUser.name}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 max-w-[100px] truncate leading-tight">
                {authUser.email}
              </span>
            </div>

            {/* Role Badge */}
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                currentUserRole === 'ADMIN'
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  : currentUserRole === 'BGH'
                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : currentUserRole === 'GUARD'
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
              }`}
            >
              {currentUserRole === 'ADMIN'
                ? 'ADMIN'
                : currentUserRole === 'BGH'
                ? 'BGH'
                : currentUserRole === 'GUARD'
                ? 'BẢO VỆ'
                : 'GIÁO VIÊN'}
            </span>

            {/* Logout button */}
            <button
              onClick={onLogout}
              title="Đăng xuất"
              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenGoogleAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors"
            title="Đăng nhập tài khoản trường học"
          >
            <User className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Đăng Nhập</span>
          </button>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={onToggleDarkMode}
          title={isDarkMode ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
