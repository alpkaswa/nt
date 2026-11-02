import React, { useState } from 'react';
import { X, ShieldCheck, UserCheck, AlertCircle, Sparkles, Lock, LogIn } from 'lucide-react';
import { AppUserRole, AuthUser, Employee } from '../types';
import { signInWithGoogle } from '../services/firebase';
import { syncUserProfile } from '../services/firebaseDb';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser, accessToken?: string) => void;
  currentUser?: AuthUser | null;
  employees?: Employee[];
}

const BOOTSTRAP_ADMIN_EMAIL = 'dtc245160052@ictu.edu.vn';

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser,
  employees = [],
}) => {
  const [email, setEmail] = useState(currentUser?.email || BOOTSTRAP_ADMIN_EMAIL);
  const [name, setName] = useState(currentUser?.name || 'Quản Trị Viên');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Xác định vai trò từ cơ sở dữ liệu
  const resolveRoleFromDb = (targetEmail: string): { role: AppUserRole; reason: string } => {
    const cleanEmail = targetEmail.trim().toLowerCase();

    // 1. Quản trị viên khởi tạo theo yêu cầu
    if (cleanEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      return {
        role: 'ADMIN',
        reason: 'Quản Trị Viên (Admin) khởi tạo hệ thống - Toàn quyền quản trị',
      };
    }

    // 2. Tra cứu danh sách nhân sự
    const matchedEmp = employees.find(
      (e) => e.email.toLowerCase() === cleanEmail || e.code.toLowerCase() === cleanEmail.split('@')[0]
    );

    if (matchedEmp) {
      if (matchedEmp.role === 'ADMIN') {
        return {
          role: 'BGH',
          reason: `Khớp hồ sơ: ${matchedEmp.name} (${matchedEmp.code}) - Ban Giám Hiệu nhà trường`,
        };
      }
      if (matchedEmp.role === 'GUARD') {
        return {
          role: 'GUARD',
          reason: `Khớp hồ sơ: ${matchedEmp.name} (${matchedEmp.code}) - Nhân viên Bảo vệ`,
        };
      }
      return {
        role: 'TEACHER',
        reason: `Khớp hồ sơ: ${matchedEmp.name} (${matchedEmp.code}) - Cán bộ Giáo viên`,
      };
    }

    return {
      role: 'TEACHER',
      reason: 'Tài khoản Giáo viên / Cán bộ nhà trường (Xem lịch & gửi yêu cầu đổi ca)',
    };
  };

  const detectedRoleInfo = resolveRoleFromDb(email);

  // Đăng nhập trực tiếp bằng Google Popup (Firebase Authentication)
  const handleRealGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const firebaseUser = await signInWithGoogle();
      // Đồng bộ profile và lấy role an toàn từ Firestore
      const userProfile = await syncUserProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      });

      onLoginSuccess(userProfile);
      onClose();
    } catch (err: any) {
      console.error('Firebase Auth Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.');
      } else {
        setError(err.message || 'Không thể đăng nhập bằng tài khoản Google. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Đăng nhập qua chọn tài khoản cán bộ nhanh (Dành cho kiểm thử giao diện & thiết bị phụ)
  const handleSimulatedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập email hợp lệ');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const mockUid = `fb-user-${encodeURIComponent(email.replace(/[@.]/g, '-'))}`;
      const userProfile = await syncUserProfile({
        uid: mockUid,
        email: email.trim().toLowerCase(),
        displayName: name.trim() || email.split('@')[0],
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      });

      onLoginSuccess(userProfile);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi đăng nhập');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Firebase Authentication
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đăng nhập tài khoản trường học & Phân quyền Firestore
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

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Action: Official Sign in with Google Popup */}
          <button
            type="button"
            onClick={handleRealGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-700 shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{isLoading ? 'Đang kết nối Firebase...' : 'Đăng Nhập Bằng Google (Popup)'}</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="shrink-0 mx-3 text-[11px] text-slate-400 font-medium">
              Hoặc chọn tài khoản cán bộ nhanh
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          {/* Quick select test accounts */}
          <form onSubmit={handleSimulatedSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email cán bộ / quản trị viên
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />

              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-slate-400">Chọn nhanh:</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(BOOTSTRAP_ADMIN_EMAIL);
                    setName('Admin Hoàng Nghĩa');
                  }}
                  className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Admin (dtc245160052)
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('bgh01@school.edu.vn');
                    setName('Đỗ Thị Mai (BGH)');
                  }}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  BGH (Mai)
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('gv01@school.edu.vn');
                    setName('Nguyễn Văn An (GV)');
                  }}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Giáo Viên (An)
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('bv01@school.edu.vn');
                    setName('Vũ Văn Dũng (Bảo vệ)');
                  }}
                  className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Bảo Vệ (Dũng)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên hiển thị
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Quyền Hạn Nhận Diện:</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    detectedRoleInfo.role === 'ADMIN'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : detectedRoleInfo.role === 'BGH'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : detectedRoleInfo.role === 'GUARD'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {detectedRoleInfo.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                {detectedRoleInfo.reason}.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Vào Ứng Dụng Với Vai Trò Này
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
