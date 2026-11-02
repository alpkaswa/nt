import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Users,
  CalendarX2,
  BarChart3,
  Printer,
  CheckCircle2,
  Settings,
  GraduationCap,
  Shield,
  FileSpreadsheet,
  RotateCcw,
  Share2,
  ArrowRightLeft,
} from 'lucide-react';
import { AppUserRole } from '../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentUserRole: AppUserRole;
  pendingLeavesCount: number;
  pendingCompensatoryCount?: number;
  pendingSwapCount?: number;
  conflictsCount: number;
  schoolName: string;
  onOpenSettings: () => void;
  onOpenPublicSchedule?: () => void;
  onOpenGoogleSheets?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentUserRole,
  pendingLeavesCount,
  pendingCompensatoryCount = 0,
  pendingSwapCount = 0,
  conflictsCount,
  schoolName,
  onOpenSettings,
  onOpenPublicSchedule,
  onOpenGoogleSheets,
}) => {
  const isAdminOrBgh = currentUserRole === 'ADMIN' || currentUserRole === 'BGH';

  const navItems = [
    {
      id: 'dashboard',
      label: 'Tổng quan',
      icon: LayoutDashboard,
      badge: conflictsCount > 0 ? `${conflictsCount} ca chú ý` : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'schedule',
      label: 'Bảng Lịch trực',
      icon: CalendarDays,
    },
    {
      id: 'swap',
      label: 'Đổi ca trực (Firebase)',
      icon: ArrowRightLeft,
      badge: pendingSwapCount > 0 ? `${pendingSwapCount} yêu cầu` : undefined,
      badgeColor: 'bg-emerald-500 text-white',
    },
    {
      id: 'public-schedule',
      label: 'Lịch trực Công khai (Link)',
      icon: Share2,
      badge: 'Công khai',
      badgeColor: 'bg-indigo-600 text-white',
    },
    ...(isAdminOrBgh
      ? [
          {
            id: 'auto-schedule',
            label: 'Xếp lịch tự động',
            icon: Calendar,
          },
          {
            id: 'employees',
            label: 'Quản lý Nhân sự',
            icon: Users,
          },
        ]
      : []),
    {
      id: 'leaves',
      label: 'Lịch bận & Nghỉ phép',
      icon: CalendarX2,
      badge: pendingLeavesCount > 0 ? `${pendingLeavesCount} chờ duyệt` : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'compensatory',
      label: 'Trực bù & Nợ ca',
      icon: RotateCcw,
      badge: pendingCompensatoryCount > 0 ? `${pendingCompensatoryCount} nợ bù` : undefined,
      badgeColor: 'bg-amber-600 text-white',
    },
    {
      id: 'statistics',
      label: 'Thống kê & Báo cáo',
      icon: BarChart3,
    },
    {
      id: 'export',
      label: 'In & Xuất lịch biểu',
      icon: Printer,
    },
    {
      id: 'tests',
      label: 'Kiểm thử Realtime & Quyền',
      icon: CheckCircle2,
      badge: 'Firebase',
      badgeColor: 'bg-emerald-600 text-white',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 min-h-screen border-r border-slate-800 select-none no-print">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div className="overflow-hidden">
          <h1 className="font-bold text-sm tracking-tight text-white uppercase truncate leading-tight">
            Quản Sinh Nội Trú
          </h1>
          <p
            className="text-xs text-slate-400 font-medium truncate mt-0.5"
            title={schoolName || 'TRƯỜNG PHỔ THÔNG DÂN TỘC NỘI TRÚ NA RÌ'}
          >
            {schoolName || 'TRƯỜNG PHỔ THÔNG DÂN TỘC NỘI TRÚ NA RÌ'}
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Phân Hệ Chức Năng
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Shift Rules & Settings Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2">
        <div className="px-3 py-2 bg-slate-800/80 rounded-lg text-xs border border-slate-700/60">
          <div className="flex items-center gap-1.5 text-indigo-300 font-semibold mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Quy Chuẩn Ca Trực 24h</span>
          </div>
          <div className="text-[11px] text-slate-400 space-y-0.5">
            <div>• Kíp trực: 04 người / ca</div>
            <div>• 02 GV + 01 BGH + 01 BV</div>
            <div>• Nghỉ tối thiểu 24h giữa 2 ca</div>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Cấu hình & Sao lưu dữ liệu</span>
        </button>
      </div>
    </aside>
  );
};
