-- ==============================================================================
-- TRƯỜNG PHỔ THÔNG DÂN TỘC NỘI TRÚ NA RÌ
-- HỆ THỐNG QUẢN LÝ & SẮP XẾP LỊCH TRỰC QUẢN SINH NỘI TRÚ
-- KỊCH BẢN KHỞI TẠO CƠ SỞ DỮ LIỆU SUPABASE POSTGRESQL (SCHEMA & RLS POLICIES)
-- ==============================================================================

-- 1. Kích hoạt tiện ích mở rộng UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Bảng Hồ Sơ Người Dùng (user_profiles) gắn với Supabase Auth
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'BGH', 'TEACHER', 'GUARD')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng Cán Bộ / Giáo Viên / Nhân Viên (employees)
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('TEACHER', 'ADMIN', 'GUARD')),
    department TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng Phân Công Ca Trực (shift_assignments)
CREATE TABLE IF NOT EXISTS public.shift_assignments (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    day_of_week INT NOT NULL,
    start_time TEXT NOT NULL DEFAULT '07:00',
    end_time TEXT NOT NULL DEFAULT '07:00 ngày hôm sau',
    teacher1_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    teacher2_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    admin_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    guard_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'INCOMPLETE' CHECK (status IN ('COMPLETE', 'INCOMPLETE', 'CONFLICT')),
    is_locked BOOLEAN DEFAULT FALSE,
    notes TEXT,
    conflicts JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- 5. Bảng Đăng Ký Nghỉ / Bận (unavailable_dates)
CREATE TABLE IF NOT EXISTS public.unavailable_dates (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by TEXT
);

-- 6. Bảng Yêu Cầu Đổi Ca Trực (shift_change_requests)
CREATE TABLE IF NOT EXISTS public.shift_change_requests (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    target_employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    target_shift_date DATE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Bảng Quản Lý Trực Bù (compensatory_duties)
CREATE TABLE IF NOT EXISTS public.compensatory_duties (
    id TEXT PRIMARY KEY,
    debtor_employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    creditor_employee_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    original_shift_date DATE NOT NULL,
    reason TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('LEAVE_APPROVAL', 'SHIFT_SWAP', 'MANUAL_DEBT')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SCHEDULED', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    compensated_shift_date DATE,
    compensated_role_position TEXT,
    compensated_at TIMESTAMPTZ,
    notes TEXT
);

-- 8. Bảng Lịch Sử Thay Đổi Ca Trực (shift_change_history)
CREATE TABLE IF NOT EXISTS public.shift_change_history (
    id TEXT PRIMARY KEY,
    shift_date DATE NOT NULL,
    role_position TEXT NOT NULL,
    previous_employee_id TEXT,
    new_employee_id TEXT,
    reason TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Bảng Cấu Hình Tham Số Lịch Trực (schedule_settings)
CREATE TABLE IF NOT EXISTS public.schedule_settings (
    id TEXT PRIMARY KEY DEFAULT 'current_settings',
    school_name TEXT NOT NULL DEFAULT 'TRƯỜNG PHỔ THÔNG DÂN TỘC NỘI TRÚ NA RÌ',
    shift_duration_hours INT DEFAULT 24,
    shift_start_time TEXT DEFAULT '07:00',
    shift_end_time TEXT DEFAULT '07:00 ngày hôm sau',
    required_teachers INT DEFAULT 2,
    required_admins INT DEFAULT 1,
    required_guards INT DEFAULT 1,
    disallow_consecutive_days BOOLEAN DEFAULT TRUE,
    respect_approved_unavailabilities BOOLEAN DEFAULT TRUE,
    fair_distribution BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Bảng Nhật Ký Đồng Bộ (sync_logs - Google Sheets & Supabase)
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id TEXT PRIMARY KEY,
    service_type TEXT NOT NULL CHECK (service_type IN ('GOOGLE_SHEETS', 'SUPABASE')),
    action TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'ERROR', 'IN_PROGRESS')),
    records_synced INT DEFAULT 0,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- KÍCH HOẠT SUPABASE REALTIME (Cho phép cập nhật trực tiếp không cần F5)
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'shift_assignments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_assignments;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'employees'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'unavailable_dates'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.unavailable_dates;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'compensatory_duties'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.compensatory_duties;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'sync_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_logs;
    END IF;
END $$;

-- ==============================================================================
-- THIẾT LẬP ROW LEVEL SECURITY (RLS) - BẢO VỆ DỮ LIỆU
-- ==============================================================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unavailable_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensatory_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 1. Chính sách cho phép công khai xem lịch trực và danh sách cán bộ (Public View)
CREATE POLICY "Public Read Shift Assignments" ON public.shift_assignments FOR SELECT USING (true);
CREATE POLICY "Public Read Employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Public Read Settings" ON public.schedule_settings FOR SELECT USING (true);
CREATE POLICY "Public Read Unavailable Dates" ON public.unavailable_dates FOR SELECT USING (true);
CREATE POLICY "Public Read Compensatory" ON public.compensatory_duties FOR SELECT USING (true);
CREATE POLICY "Public Read Sync Logs" ON public.sync_logs FOR SELECT USING (true);
CREATE POLICY "Public Read History" ON public.shift_change_history FOR SELECT USING (true);

-- 2. Thao tác ghi dữ liệu (Anon key hoặc Authenticated user cho môi trường trường học)
CREATE POLICY "Allow All Operations on Shifts" ON public.shift_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Operations on Employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Operations on Unavailable" ON public.unavailable_dates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Operations on Requests" ON public.shift_change_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Operations on Compensatory" ON public.compensatory_duties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Operations on History" ON public.shift_change_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Operations on Settings" ON public.schedule_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Operations on Sync Logs" ON public.sync_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Operations on User Profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);

-- Chỉ mục tối ưu tốc độ truy vấn
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.shift_assignments(date);
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(role);
CREATE INDEX IF NOT EXISTS idx_leaves_date ON public.unavailable_dates(date);
