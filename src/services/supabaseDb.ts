import { SupabaseClientService } from './supabaseClient';
import {
  Employee,
  ShiftAssignment,
  UnavailableDate,
  ShiftChangeRequest,
  CompensatoryDuty,
  ShiftChangeHistory,
  ScheduleSettings,
  SyncLog,
} from '../types';

export class SupabaseDbService {
  /**
   * Chuyển đổi dữ liệu từ PostgreSQL snake_case sang TypeScript camelCase
   */
  private static mapEmployeeFromDb(row: any): Employee {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      role: row.role,
      department: row.department,
      phone: row.phone || '',
      email: row.email || '',
      isActive: row.is_active ?? true,
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapEmployeeToDb(emp: Employee): any {
    return {
      id: emp.id,
      code: emp.code,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      phone: emp.phone,
      email: emp.email,
      is_active: emp.isActive,
      notes: emp.notes,
      updated_at: new Date().toISOString(),
    };
  }

  private static mapShiftFromDb(row: any): ShiftAssignment {
    return {
      id: row.id,
      date: row.date,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      teacher1Id: row.teacher1_id,
      teacher2Id: row.teacher2_id,
      adminId: row.admin_id,
      guardId: row.guard_id,
      status: row.status,
      isLocked: row.is_locked ?? false,
      notes: row.notes || '',
      conflicts: Array.isArray(row.conflicts) ? row.conflicts : [],
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  }

  private static mapShiftToDb(shift: ShiftAssignment): any {
    return {
      id: shift.id,
      date: shift.date,
      day_of_week: shift.dayOfWeek,
      start_time: shift.startTime,
      end_time: shift.endTime,
      teacher1_id: shift.teacher1Id,
      teacher2_id: shift.teacher2Id,
      admin_id: shift.adminId,
      guard_id: shift.guardId,
      status: shift.status,
      is_locked: shift.isLocked,
      notes: shift.notes || '',
      conflicts: shift.conflicts || [],
      updated_at: new Date().toISOString(),
      updated_by: shift.updatedBy || 'System',
    };
  }

  private static mapLeaveFromDb(row: any): UnavailableDate {
    return {
      id: row.id,
      employeeId: row.employee_id,
      date: row.date,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
      reviewedBy: row.reviewed_by,
    };
  }

  private static mapLeaveToDb(leave: UnavailableDate): any {
    return {
      id: leave.id,
      employee_id: leave.employeeId,
      date: leave.date,
      reason: leave.reason,
      status: leave.status,
      created_at: leave.createdAt,
      reviewed_by: leave.reviewedBy,
    };
  }

  private static mapCompensatoryFromDb(row: any): CompensatoryDuty {
    return {
      id: row.id,
      debtorEmployeeId: row.debtor_employee_id,
      creditorEmployeeId: row.creditor_employee_id,
      originalShiftDate: row.original_shift_date,
      reason: row.reason,
      sourceType: row.source_type,
      status: row.status,
      createdAt: row.created_at,
      compensatedShiftDate: row.compensated_shift_date,
      compensatedRolePosition: row.compensated_role_position,
      compensatedAt: row.compensated_at,
      notes: row.notes,
    };
  }

  private static mapCompensatoryToDb(duty: CompensatoryDuty): any {
    return {
      id: duty.id,
      debtor_employee_id: duty.debtorEmployeeId,
      creditor_employee_id: duty.creditorEmployeeId,
      original_shift_date: duty.originalShiftDate,
      reason: duty.reason,
      source_type: duty.sourceType,
      status: duty.status,
      created_at: duty.createdAt,
      compensated_shift_date: duty.compensatedShiftDate,
      compensated_role_position: duty.compensatedRolePosition,
      compensated_at: duty.compensatedAt,
      notes: duty.notes,
    };
  }

  /**
   * Tải danh sách nhân sự từ Supabase
   */
  static async fetchEmployees(): Promise<Employee[] | null> {
    const client = SupabaseClientService.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('employees')
        .select('*')
        .order('code', { ascending: true });

      if (error) {
        console.error('Lỗi lấy danh sách nhân sự từ Supabase:', error);
        return null;
      }

      return data.map(this.mapEmployeeFromDb);
    } catch (e) {
      console.error('Fetch employees exception:', e);
      return null;
    }
  }

  /**
   * Tải danh sách ca trực từ Supabase
   */
  static async fetchShifts(): Promise<ShiftAssignment[] | null> {
    const client = SupabaseClientService.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('shift_assignments')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Lỗi lấy lịch trực từ Supabase:', error);
        return null;
      }

      return data.map(this.mapShiftFromDb);
    } catch (e) {
      console.error('Fetch shifts exception:', e);
      return null;
    }
  }

  /**
   * Tải danh sách đăng ký nghỉ từ Supabase
   */
  static async fetchUnavailableDates(): Promise<UnavailableDate[] | null> {
    const client = SupabaseClientService.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('unavailable_dates')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Lỗi lấy ngày nghỉ từ Supabase:', error);
        return null;
      }

      return data.map(this.mapLeaveFromDb);
    } catch (e) {
      console.error('Fetch leaves exception:', e);
      return null;
    }
  }

  /**
   * Tải danh sách trực bù
   */
  static async fetchCompensatoryDuties(): Promise<CompensatoryDuty[] | null> {
    const client = SupabaseClientService.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('compensatory_duties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return null;
      return data.map(this.mapCompensatoryFromDb);
    } catch {
      return null;
    }
  }

  /**
   * Tải nhật ký đồng bộ
   */
  static async fetchSyncLogs(): Promise<SyncLog[]> {
    const client = SupabaseClientService.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) return [];
      return data.map((r: any) => ({
        id: r.id,
        serviceType: r.service_type,
        action: r.action,
        status: r.status,
        recordsSynced: r.records_synced,
        details: r.details,
        createdAt: r.created_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Cập nhật hoặc thêm mới nhân sự lên Supabase
   */
  static async upsertEmployee(employee: Employee): Promise<boolean> {
    const client = SupabaseClientService.getClient();
    if (!client) return false;

    try {
      const payload = this.mapEmployeeToDb(employee);
      const { error } = await client.from('employees').upsert(payload);
      if (error) {
        console.error('Lỗi lưu nhân sự lên Supabase:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Upsert employee exception:', e);
      return false;
    }
  }

  /**
   * Xóa nhân sự khỏi Supabase
   */
  static async deleteEmployee(employeeId: string): Promise<boolean> {
    const client = SupabaseClientService.getClient();
    if (!client) return false;

    try {
      const { error } = await client.from('employees').delete().eq('id', employeeId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Cập nhật ca trực có kiểm soát xung đột (Optimistic Lock)
   */
  static async updateShiftWithConflictCheck(
    shift: ShiftAssignment,
    currentServerUpdatedAt?: string
  ): Promise<{ success: boolean; conflict?: boolean; currentServerShift?: ShiftAssignment }> {
    const client = SupabaseClientService.getClient();
    if (!client) return { success: false };

    try {
      // 1. Kiểm tra phiên bản mới nhất trên server nếu có timestamp
      if (currentServerUpdatedAt) {
        const { data: latestData } = await client
          .from('shift_assignments')
          .select('*')
          .eq('id', shift.id)
          .single();

        if (latestData && latestData.updated_at && latestData.updated_at !== currentServerUpdatedAt) {
          // Xung đột phát hiện: Ca trực này đã được người khác sửa trước!
          return {
            success: false,
            conflict: true,
            currentServerShift: this.mapShiftFromDb(latestData),
          };
        }
      }

      // 2. Không có xung đột, thực hiện ghi đè an toàn
      const payload = this.mapShiftToDb(shift);
      const { error } = await client.from('shift_assignments').upsert(payload);
      if (error) {
        console.error('Lỗi cập nhật ca trực Supabase:', error);
        return { success: false };
      }

      return { success: true };
    } catch (e) {
      console.error('Update shift exception:', e);
      return { success: false };
    }
  }

  /**
   * Ghi hàng loạt ca trực (khi xếp lịch tự động)
   */
  static async bulkSaveShifts(shifts: ShiftAssignment[]): Promise<boolean> {
    const client = SupabaseClientService.getClient();
    if (!client) return false;

    try {
      const payload = shifts.map(this.mapShiftToDb);
      const { error } = await client.from('shift_assignments').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error('Lỗi bulk upsert shifts Supabase:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Bulk save shifts exception:', e);
      return false;
    }
  }

  /**
   * Lưu nhật ký đồng bộ lên Supabase
   */
  static async logSync(syncLog: SyncLog): Promise<void> {
    const client = SupabaseClientService.getClient();
    if (!client) return;

    try {
      await client.from('sync_logs').insert({
        id: syncLog.id,
        service_type: syncLog.serviceType,
        action: syncLog.action,
        status: syncLog.status,
        records_synced: syncLog.recordsSynced,
        details: syncLog.details,
        created_at: syncLog.createdAt,
      });
    } catch (e) {
      console.error('Lỗi ghi sync_logs lên Supabase:', e);
    }
  }

  /**
   * Đăng ký kênh Supabase Realtime đa người dùng
   */
  static subscribeToRealtime(
    onShiftChange: (payload: any) => void,
    onEmployeeChange: (payload: any) => void,
    onLeaveChange: (payload: any) => void,
    onStatusChange?: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void
  ) {
    const client = SupabaseClientService.getClient();
    if (!client) return () => {};

    const channel = client
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_assignments' },
        (payload) => {
          onShiftChange(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        (payload) => {
          onEmployeeChange(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'unavailable_dates' },
        (payload) => {
          onLeaveChange(payload);
        }
      )
      .subscribe((status) => {
        if (onStatusChange) {
          onStatusChange(status as any);
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }

  /**
   * Chuyển toàn bộ dữ liệu hiện tại từ LocalStorage lên Supabase
   */
  static async migrateAllLocalDataToSupabase(data: {
    employees: Employee[];
    shifts: ShiftAssignment[];
    leaves: UnavailableDate[];
    compensatory: CompensatoryDuty[];
    settings: ScheduleSettings;
  }): Promise<{ success: boolean; message: string; details: any }> {
    const client = SupabaseClientService.getClient();
    if (!client) {
      return {
        success: false,
        message: 'Chưa cấu hình Supabase Client. Vui lòng kiểm tra URL và Anon Key.',
        details: null,
      };
    }

    try {
      // 1. Đồng bộ Nhân sự
      if (data.employees.length > 0) {
        const empPayload = data.employees.map(this.mapEmployeeToDb);
        const { error: empErr } = await client.from('employees').upsert(empPayload);
        if (empErr) throw new Error(`Lỗi đẩy nhân sự: ${empErr.message}`);
      }

      // 2. Đồng bộ Ca trực
      if (data.shifts.length > 0) {
        const shiftPayload = data.shifts.map(this.mapShiftToDb);
        const { error: shiftErr } = await client.from('shift_assignments').upsert(shiftPayload);
        if (shiftErr) throw new Error(`Lỗi đẩy ca trực: ${shiftErr.message}`);
      }

      // 3. Đồng bộ Nghỉ phép
      if (data.leaves.length > 0) {
        const leavePayload = data.leaves.map(this.mapLeaveToDb);
        const { error: leaveErr } = await client.from('unavailable_dates').upsert(leavePayload);
        if (leaveErr) throw new Error(`Lỗi đẩy ngày nghỉ: ${leaveErr.message}`);
      }

      // 4. Đồng bộ Trực bù
      if (data.compensatory.length > 0) {
        const compPayload = data.compensatory.map(this.mapCompensatoryToDb);
        const { error: compErr } = await client.from('compensatory_duties').upsert(compPayload);
        if (compErr) throw new Error(`Lỗi đẩy trực bù: ${compErr.message}`);
      }

      // 5. Ghi log
      await this.logSync({
        id: `sync-supa-${Date.now()}`,
        serviceType: 'SUPABASE',
        action: 'MIGRATE_ALL_LOCAL_TO_SUPABASE',
        status: 'SUCCESS',
        recordsSynced: data.employees.length + data.shifts.length + data.leaves.length,
        details: `Đã di chuyển thành công ${data.employees.length} nhân sự, ${data.shifts.length} ca trực, ${data.leaves.length} đơn nghỉ lên Supabase PostgreSQL.`,
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Di chuyển toàn bộ dữ liệu lên Supabase PostgreSQL thành công!',
        details: {
          employees: data.employees.length,
          shifts: data.shifts.length,
          leaves: data.leaves.length,
        },
      };
    } catch (err: any) {
      console.error('Migration error:', err);
      return {
        success: false,
        message: err?.message || 'Có lỗi khi di chuyển dữ liệu lên Supabase.',
        details: null,
      };
    }
  }
}
