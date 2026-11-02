import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Employee, UnavailableDate, ScheduleSettings } from '../types';
import { runAllAutomatedTests, TestCaseResult } from '../services/testSuite';

interface TestVerificationViewProps {
  employees: Employee[];
  unavailableDates: UnavailableDate[];
  settings: ScheduleSettings;
}

export const TestVerificationView: React.FC<TestVerificationViewProps> = ({
  employees,
  unavailableDates,
  settings,
}) => {
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set([1, 2, 3]));

  const runTests = async () => {
    setIsRunning(true);
    try {
      const results = await runAllAutomatedTests(employees, unavailableDates, settings);
      setTestResults(results);
    } catch (e) {
      console.error('Lỗi khi chạy kiểm thử:', e);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(testResults.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const passedCount = testResults.filter((t) => t.status === 'PASSED').length;
  const totalCount = testResults.length || 23;

  return (
    <div className="space-y-6">
      {/* Test Banner Summary */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/40 shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Bộ Kiểm Thử Nghiệp Vụ Tự Động ({passedCount}/{totalCount} ĐẠT)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                {passedCount === totalCount ? '100% Hoàn Thành' : `${passedCount}/${totalCount} Đạt`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Hệ thống tự động thực thi và kiểm định 23 kịch bản khắt khe: Supabase Realtime đa thiết bị,
              phân quyền nghiêm ngặt không tự phong Admin, xem trước ảnh hưởng khi thêm nhân sự, bảo vệ lịch khóa,
              chế độ ngoại tuyến tự kết nối lại, đồng bộ Google Sheets v4 chống trùng lặp, cùng toàn bộ ràng buộc 24 giờ.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={expandAll}
            className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Mở rộng tất cả
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Thu gọn
          </button>

          <button
            disabled={isRunning}
            onClick={runTests}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Đang Kiểm Thử...' : 'Chạy Lại 23 Kịch Bản'}</span>
          </button>
        </div>
      </div>


      {/* Test List Accordion Cards */}
      <div className="space-y-3">
        {testResults.map((tc) => {
          const isExpanded = expandedIds.has(tc.id);
          const isPassed = tc.status === 'PASSED';

          return (
            <div
              key={tc.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all"
            >
              <div
                onClick={() => toggleExpand(tc.id)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    {isPassed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        #{String(tc.id).padStart(2, '0')}
                      </span>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                        {tc.title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{tc.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                    {tc.durationMs}ms
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isPassed
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                    }`}
                  >
                    {isPassed ? 'ĐẠT CHUẨN' : 'CHƯA ĐẠT'}
                  </span>
                  <div className="text-slate-400">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Expandable Logs */}
              {isExpanded && (
                <div className="px-5 pb-4 pt-1 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Nhật Ký & Xác Thực Chi Tiết:
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1">
                    {tc.details.map((line, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                        <span className="text-indigo-500 font-bold">›</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
