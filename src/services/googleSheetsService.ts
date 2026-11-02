import { GoogleSheetsConfig, SyncLog, ShiftAssignment, Employee } from '../types';
import { SupabaseDbService } from './supabaseDb';

const SHEETS_CONFIG_KEY = 'boarding_school_google_sheets_config';

export class GoogleSheetsService {
  /**
   * Lấy cấu hình Google Sheets hiện tại
   */
  static getConfig(): GoogleSheetsConfig {
    try {
      const stored = localStorage.getItem(SHEETS_CONFIG_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return {
      spreadsheetId: '',
      sheetNameShifts: 'Lịch Trực Quản Sinh',
      sheetNameEmployees: 'Danh Sách Cán Bộ',
      isConnected: false,
    };
  }

  /**
   * Lưu cấu hình Google Sheets
   */
  static saveConfig(config: GoogleSheetsConfig) {
    localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(config));
  }

  /**
   * Trích xuất ID Spreadsheet từ đường link Google Sheets đầy đủ (nếu người dùng dán link)
   */
  static extractSpreadsheetId(input: string): string {
    const trimmed = input.trim();
    // Khớp mẫu: https://docs.google.com/spreadsheets/d/{spreadsheetId}/edit...
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  }

  /**
   * Kiểm tra kết nối thực tế tới Google Sheets API bằng Access Token
   */
  static async testConnection(
    spreadsheetIdInput: string,
    accessToken?: string
  ): Promise<{ success: boolean; title?: string; message: string; sheets?: string[] }> {
    const spreadsheetId = this.extractSpreadsheetId(spreadsheetIdInput);
    if (!spreadsheetId) {
      return {
        success: false,
        message: 'Vui lòng nhập Google Spreadsheet ID hoặc đường link bảng tính.',
      };
    }

    if (!accessToken) {
      return {
        success: false,
        message: 'Chưa có Token xác thực Google OAuth. Vui lòng kết nối tài khoản Google có quyền truy cập Google Sheets.',
      };
    }

    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        let errorDetail = `Mã lỗi HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson?.error?.message) {
            errorDetail = errJson.error.message;
          }
        } catch {
          // ignore
        }

        if (res.status === 401 || res.status === 403) {
          return {
            success: false,
            message: `Quyền truy cập bị từ chối (${errorDetail}). Hãy kiểm tra xem tài khoản đã cấp quyền Google Sheets chưa hoặc thêm quyền chỉnh sửa bảng tính.`,
          };
        } else if (res.status === 404) {
          return {
            success: false,
            message: `Không tìm thấy bảng tính với ID "${spreadsheetId}". Hãy kiểm tra lại link bảng tính Google Sheets.`,
          };
        }

        return {
          success: false,
          message: `Lỗi kết nối Google Sheets: ${errorDetail}`,
        };
      }

      const data = await res.json();
      const sheetTitles = data.sheets?.map((s: any) => s.properties?.title) || [];
      const spreadsheetTitle = data.properties?.title || 'Google Spreadsheet';

      // Lưu trạng thái thành công
      const curConfig = this.getConfig();
      this.saveConfig({
        ...curConfig,
        spreadsheetId,
        accessToken,
        isConnected: true,
      });

      return {
        success: true,
        title: spreadsheetTitle,
        sheets: sheetTitles,
        message: `Kết nối thành công tới bảng tính: "${spreadsheetTitle}" (${sheetTitles.length} trang tính).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Lỗi gửi yêu cầu tới Google Sheets API: ${err?.message || 'Kiểm tra kết nối mạng'}`,
      };
    }
  }

  /**
   * Tạo Sheet mới nếu chưa tồn tại trong Spreadsheet
   */
  private static async ensureSheetExists(
    spreadsheetId: string,
    sheetName: string,
    accessToken: string
  ): Promise<void> {
    try {
      const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!getRes.ok) return;

      const data = await getRes.json();
      const exists = data.sheets?.some((s: any) => s.properties?.title === sheetName);
      if (exists) return;

      // Tạo sheet mới qua batchUpdate
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                  gridProperties: { rowCount: 100, columnCount: 20 },
                },
              },
            },
          ],
        }),
      });
    } catch {
      // ignore
    }
  }

  /**
   * Đồng bộ toàn bộ lịch trực sang Google Sheets (Ghi đè chống trùng lặp)
   */
  static async syncShiftsToGoogleSheets(
    spreadsheetIdInput: string,
    accessToken: string,
    shifts: ShiftAssignment[],
    employees: Employee[]
  ): Promise<{ success: boolean; message: string; rowCount: number }> {
    const spreadsheetId = this.extractSpreadsheetId(spreadsheetIdInput);
    const config = this.getConfig();
    const sheetName = config.sheetNameShifts || 'Lịch Trực Quản Sinh';

    if (!spreadsheetId || !accessToken) {
      return {
        success: false,
        message: 'Thiếu Spreadsheet ID hoặc mã truy cập Google OAuth.',
        rowCount: 0,
      };
    }

    try {
      // 1. Đảm bảo sheet tồn tại
      await this.ensureSheetExists(spreadsheetId, sheetName, accessToken);

      // 2. Tạo bản đồ tra cứu tên nhân sự
      const empMap = new Map<string, Employee>();
      employees.forEach((e) => empMap.set(e.id, e));

      const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

      // 3. Chuẩn bị header và các dòng dữ liệu
      const headerRow = [
        'STT',
        'Ngày Trực',
        'Thứ Trong Tuần',
        'Thời Gian Ca Trực',
        'Giáo Viên Trực 1',
        'Mã GV 1',
        'Giáo Viên Trực 2',
        'Mã GV 2',
        'BGH Trực Chỉ Đạo',
        'Mã BGH',
        'Bảo Vệ Ca Trực',
        'Mã BV',
        'Trạng Thái Ca',
        'Khóa Ca',
        'Ghi Chú',
        'Thời Điểm Cập Nhật',
      ];

      const dataRows = shifts.map((shift, idx) => {
        const gv1 = shift.teacher1Id ? empMap.get(shift.teacher1Id) : null;
        const gv2 = shift.teacher2Id ? empMap.get(shift.teacher2Id) : null;
        const bgh = shift.adminId ? empMap.get(shift.adminId) : null;
        const bv = shift.guardId ? empMap.get(shift.guardId) : null;

        const statusLabel =
          shift.status === 'COMPLETE'
            ? 'Đủ người'
            : shift.status === 'CONFLICT'
            ? 'Xung đột'
            : 'Chưa đủ người';

        return [
          idx + 1,
          shift.date,
          dayNames[shift.dayOfWeek] || `Thứ ${shift.dayOfWeek + 1}`,
          `${shift.startTime} - ${shift.endTime}`,
          gv1 ? gv1.name : '(Trống)',
          gv1 ? gv1.code : '',
          gv2 ? gv2.name : '(Trống)',
          gv2 ? gv2.code : '',
          bgh ? bgh.name : '(Trống)',
          bgh ? bgh.code : '',
          bv ? bv.name : '(Trống)',
          bv ? bv.code : '',
          statusLabel,
          shift.isLocked ? 'ĐÃ KHÓA' : 'MỞ',
          shift.notes || '',
          new Date().toLocaleString('vi-VN'),
        ];
      });

      const values = [headerRow, ...dataRows];

      // 4. Xóa vùng dữ liệu cũ trước khi ghi đè để không bao giờ bị trùng dòng
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(
          sheetName
        )}'!A1:P200:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // 5. Cập nhật dữ liệu mới
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(
          sheetName
        )}'!A1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: `'${sheetName}'!A1`,
            majorDimension: 'ROWS',
            values,
          }),
        }
      );

      if (!updateRes.ok) {
        const errJson = await updateRes.json();
        throw new Error(errJson?.error?.message || `Lỗi HTTP ${updateRes.status}`);
      }

      // Lưu nhật ký
      const syncLog: SyncLog = {
        id: `sync-sh-${Date.now()}`,
        serviceType: 'GOOGLE_SHEETS',
        action: 'EXPORT_SHIFTS',
        status: 'SUCCESS',
        recordsSynced: shifts.length,
        details: `Đã đồng bộ thành công ${shifts.length} ca trực vào trang tính "${sheetName}".`,
        createdAt: new Date().toISOString(),
      };
      await SupabaseDbService.logSync(syncLog);

      this.saveConfig({
        ...config,
        lastSyncedAt: new Date().toISOString(),
      });

      return {
        success: true,
        message: `Đồng bộ thành công ${shifts.length} ca trực vào Google Sheets (Trang tính "${sheetName}").`,
        rowCount: shifts.length,
      };
    } catch (err: any) {
      const syncLog: SyncLog = {
        id: `sync-err-${Date.now()}`,
        serviceType: 'GOOGLE_SHEETS',
        action: 'EXPORT_SHIFTS',
        status: 'ERROR',
        recordsSynced: 0,
        details: `Thất bại: ${err?.message || 'Lỗi không xác định'}`,
        createdAt: new Date().toISOString(),
      };
      await SupabaseDbService.logSync(syncLog);

      return {
        success: false,
        message: `Lỗi đồng bộ Google Sheets: ${err?.message || 'Vui lòng kiểm tra quyền truy cập'}`,
        rowCount: 0,
      };
    }
  }

  /**
   * Đồng bộ danh sách cán bộ sang Google Sheets
   */
  static async syncEmployeesToGoogleSheets(
    spreadsheetIdInput: string,
    accessToken: string,
    employees: Employee[]
  ): Promise<{ success: boolean; message: string; rowCount: number }> {
    const spreadsheetId = this.extractSpreadsheetId(spreadsheetIdInput);
    const config = this.getConfig();
    const sheetName = config.sheetNameEmployees || 'Danh Sách Cán Bộ';

    if (!spreadsheetId || !accessToken) {
      return {
        success: false,
        message: 'Thiếu Spreadsheet ID hoặc mã truy cập Google OAuth.',
        rowCount: 0,
      };
    }

    try {
      await this.ensureSheetExists(spreadsheetId, sheetName, accessToken);

      const headerRow = [
        'STT',
        'Mã Nhân Sự',
        'Họ Và Tên',
        'Chức Vụ / Vai Trò',
        'Tổ / Bộ Môn',
        'Số Điện Thoại',
        'Email',
        'Trạng Thái Hoạt Động',
        'Ghi Chú',
        'Thời Điểm Cập Nhật',
      ];

      const dataRows = employees.map((emp, idx) => {
        const roleLabel =
          emp.role === 'ADMIN' ? 'Ban Giám Hiệu' : emp.role === 'GUARD' ? 'Bảo Vệ' : 'Giáo Viên';
        return [
          idx + 1,
          emp.code,
          emp.name,
          roleLabel,
          emp.department,
          emp.phone,
          emp.email,
          emp.isActive ? 'Đang công tác' : 'Tạm nghỉ',
          emp.notes || '',
          new Date().toLocaleString('vi-VN'),
        ];
      });

      const values = [headerRow, ...dataRows];

      // Xóa dải ô cũ
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(
          sheetName
        )}'!A1:J200:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Ghi mới
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(
          sheetName
        )}'!A1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: `'${sheetName}'!A1`,
            majorDimension: 'ROWS',
            values,
          }),
        }
      );

      if (!updateRes.ok) {
        const errJson = await updateRes.json();
        throw new Error(errJson?.error?.message || `Lỗi HTTP ${updateRes.status}`);
      }

      const syncLog: SyncLog = {
        id: `sync-emp-${Date.now()}`,
        serviceType: 'GOOGLE_SHEETS',
        action: 'EXPORT_EMPLOYEES',
        status: 'SUCCESS',
        recordsSynced: employees.length,
        details: `Đã đồng bộ thành công ${employees.length} cán bộ vào trang tính "${sheetName}".`,
        createdAt: new Date().toISOString(),
      };
      await SupabaseDbService.logSync(syncLog);

      return {
        success: true,
        message: `Đồng bộ thành công ${employees.length} cán bộ vào trang tính "${sheetName}".`,
        rowCount: employees.length,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Lỗi đồng bộ danh sách cán bộ: ${err?.message}`,
        rowCount: 0,
      };
    }
  }
}
