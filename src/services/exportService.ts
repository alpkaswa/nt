import * as XLSX from 'xlsx';
import { ShiftAssignment, Employee, ScheduleSettings, ShiftStatistics, EmployeeRole } from '../types';
import { getDayNameVN, parseDate } from './scheduler';

export interface EmployeeImportResult {
  success: boolean;
  employees: Employee[];
  totalRowsRead: number;
  matchedHeaders: {
    codeCol?: string;
    nameCol?: string;
    roleCol?: string;
    departmentCol?: string;
    phoneCol?: string;
    emailCol?: string;
    notesCol?: string;
  };
  warnings: string[];
  errors: string[];
  fileName: string;
}

export interface ScheduleImportResult {
  success: boolean;
  shifts: ShiftAssignment[];
  totalDays: number;
  matchedCount: number;
  unmatchedNames: string[];
  warnings: string[];
  errors: string[];
  fileName: string;
}

/**
 * Hàm chuẩn hóa chuỗi tiếng Việt: bỏ dấu, chữ thường, bỏ ký tự đặc biệt
 */
function normalizeHeaderStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Làm sạch số điện thoại từ cell Excel
 */
function cleanPhoneNumber(val: any): string {
  if (val === null || val === undefined) return '0900.000.000';
  let str = String(val).trim().replace(/[^0-9]/g, '');
  if (!str) return '0900.000.000';
  // Nếu là số 9 chữ số (thiếu số 0 đầu do Excel coi là số nguyên)
  if (str.length === 9) {
    str = '0' + str;
  }
  // Định dạng lại theo chuẩn 0xxx.xxx.xxx hoặc 0xxxxxxxxx
  if (str.length === 10) {
    return `${str.slice(0, 4)}.${str.slice(4, 7)}.${str.slice(7)}`;
  }
  return str;
}

export class ExportService {
  /**
   * Xuất Bảng Phân công Lịch trực tháng ra file Excel (.xlsx)
   */
  static exportScheduleToExcel(
    shifts: ShiftAssignment[],
    employees: Employee[],
    settings: ScheduleSettings,
    monthYear: string // VD: "11/2026"
  ) {
    const empMap = new Map<string, Employee>();
    employees.forEach((e) => empMap.set(e.id, e));

    const rows = [
      ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
      ['Độc lập - Tự do - Hạnh phúc'],
      ['---------------------------'],
      [settings.schoolName.toUpperCase()],
      [`BẢNG PHÂN CÔNG LỊCH TRỰC QUẢN SINH NỘI TRÚ THÁNG ${monthYear}`],
      [`Ca trực 24 giờ: từ ${settings.shiftStartTime} đến ${settings.shiftEndTime}`],
      [], // Hàng trống
      [
        'STT',
        'Ngày trực',
        'Thứ',
        'Giáo viên trực 1',
        'SĐT GV 1',
        'Giáo viên trực 2',
        'SĐT GV 2',
        'Ban Giám Hiệu',
        'SĐT BGH',
        'Bảo vệ',
        'SĐT Bảo vệ',
        'Trạng thái',
        'Ghi chú',
      ],
    ];

    shifts.forEach((s, idx) => {
      const dObj = parseDate(s.date);
      const dayName = getDayNameVN(s.dayOfWeek);
      const formattedDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;

      const t1 = s.teacher1Id ? empMap.get(s.teacher1Id) : null;
      const t2 = s.teacher2Id ? empMap.get(s.teacher2Id) : null;
      const admin = s.adminId ? empMap.get(s.adminId) : null;
      const guard = s.guardId ? empMap.get(s.guardId) : null;

      let statusText = 'Đã xếp đủ';
      if (s.status === 'INCOMPLETE') statusText = 'Còn thiếu người';
      if (s.status === 'CONFLICT') statusText = 'Xung đột lịch';
      if (s.isLocked) statusText += ' (Đã khóa)';

      rows.push([
        String(idx + 1),
        formattedDate,
        dayName,
        t1 ? t1.name : '(Trống)',
        t1 ? t1.phone : '',
        t2 ? t2.name : '(Trống)',
        t2 ? t2.phone : '',
        admin ? admin.name : '(Trống)',
        admin ? admin.phone : '',
        guard ? guard.name : '(Trống)',
        guard ? guard.phone : '',
        statusText,
        s.notes || '',
      ]);
    });

    // Thêm chân biểu ký duyệt
    rows.push([]);
    rows.push(['', '', '', '', '', '', '', '', '', '', `..., ngày .... tháng .... năm ....`]);
    rows.push(['', 'NGƯỜI LẬP BIỂU', '', '', '', '', '', '', '', 'HIỆU TRƯỞNG PHÊ DUYỆT']);
    rows.push(['', '(Ký và ghi rõ họ tên)', '', '', '', '', '', '', '', '(Ký, đóng dấu và ghi rõ họ tên)']);
    rows.push([]);
    rows.push([]);
    rows.push([]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 14 }, // Ngày trực
      { wch: 12 }, // Thứ
      { wch: 22 }, // GV 1
      { wch: 14 }, // SĐT GV1
      { wch: 22 }, // GV 2
      { wch: 14 }, // SĐT GV2
      { wch: 22 }, // BGH
      { wch: 14 }, // SĐT BGH
      { wch: 20 }, // Bảo vệ
      { wch: 14 }, // SĐT BV
      { wch: 16 }, // Trạng thái
      { wch: 30 }, // Ghi chú
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Lich_Truc_Thang_${monthYear.replace('/', '_')}`);

    const fileName = `Lich_Truc_Quan_Sinh_Thang_${monthYear.replace('/', '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  /**
   * Xuất Bảng Thống kê số ca trực của nhân sự ra Excel
   */
  static exportStatisticsToExcel(stats: ShiftStatistics[], schoolName: string, timeRangeStr: string) {
    const rows = [
      [schoolName.toUpperCase()],
      [`BÁO CÁO THỐNG KÊ SỐ CA TRỰC QUẢN SINH (${timeRangeStr.toUpperCase()})`],
      [],
      [
        'STT',
        'Mã NS',
        'Họ và tên',
        'Chức vụ',
        'Bộ phận',
        'Số ca trực tổng cộng',
        'Số ca ngày thường',
        'Số ca cuối tuần (T7-CN)',
        'Số ngày nghỉ phép đã duyệt',
        'Số lần đổi ca',
        'Số ca nợ trực bù',
        'Số ca đã trực bù',
        'Số ca trực thay đồng nghiệp',
      ],
    ];

    stats.forEach((st, idx) => {
      let roleName = 'Giáo viên';
      if (st.role === 'ADMIN') roleName = 'Ban Giám Hiệu';
      if (st.role === 'GUARD') roleName = 'Bảo vệ';

      rows.push([
        String(idx + 1),
        st.code,
        st.name,
        roleName,
        st.department,
        String(st.totalShifts),
        String(st.weekdayShifts),
        String(st.weekendShifts),
        String(st.approvedLeaves),
        String(st.swapCount),
        String(st.compensatoryOwed || 0),
        String(st.compensatoryCompleted || 0),
        String(st.shiftsCoveredForOthers || 0),
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 10 },
      { wch: 24 },
      { wch: 16 },
      { wch: 26 },
      { wch: 20 },
      { wch: 18 },
      { wch: 22 },
      { wch: 24 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Thong_Ke_Ca_Truc');
    XLSX.writeFile(wb, `Bao_Cao_Thong_Ke_Lich_Truc_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /**
   * Tải về file mẫu Excel chuẩn để người dùng nhập danh sách nhân sự
   */
  static downloadEmployeeTemplate() {
    const templateRows = [
      ['HƯỚNG DẪN: Chức vụ có thể ghi rõ: Giáo viên, Ban Giám Hiệu, Bảo vệ (hoặc TEACHER, ADMIN, GUARD)'],
      ['Mã nhân sự', 'Họ và tên', 'Chức vụ', 'Bộ phận / Tổ chuyên môn', 'Số điện thoại', 'Email liên hệ', 'Ghi chú'],
      ['GV13', 'Nguyễn Thị Minh', 'Giáo viên', 'Tổ Sinh Học', '0912.000.111', 'minh.nguyen@school.edu.vn', 'Cán bộ mới'],
      ['GV14', 'Vũ Quốc Bảo', 'Giáo viên', 'Tổ Lịch Sử', '0913.000.222', 'bao.vu@school.edu.vn', ''],
      ['BGH04', 'Đặng Hồng Sơn', 'Ban Giám Hiệu', 'Ban Giám Hiệu', '0903.000.333', 'son.dang@school.edu.vn', 'Phó Hiệu trưởng'],
      ['BV04', 'Lê Hữu Tùng', 'Bảo vệ', 'Tổ Bảo vệ', '0984.000.444', 'tung.le@school.edu.vn', 'Bảo vệ ca đêm'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateRows);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 26 },
      { wch: 20 },
      { wch: 28 },
      { wch: 18 },
      { wch: 28 },
      { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Nhan_Su');
    XLSX.writeFile(wb, 'Mau_Danh_Sach_Nhan_Su.xlsx');
  }

  /**
   * Đọc và phân tích thông minh file Excel do người dùng tải lên để import danh sách nhân sự.
   * Tự động nhận diện dòng tiêu đề, thứ tự các cột tiếng Việt / tiếng Anh linh hoạt,
   * xử lý chuẩn hóa vai trò (BGH/GV/Bảo vệ), số điện thoại và email.
   */
  static parseEmployeeExcel(file: File): Promise<EmployeeImportResult> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const warnings: string[] = [];
        const errors: string[] = [];
        const importedEmployees: Employee[] = [];
        const matchedHeaders: EmployeeImportResult['matchedHeaders'] = {};

        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer || buffer.byteLength === 0) {
            resolve({
              success: false,
              employees: [],
              totalRowsRead: 0,
              matchedHeaders: {},
              warnings: [],
              errors: ['Tệp rỗng hoặc không thể đọc dữ liệu.'],
              fileName: file.name,
            });
            return;
          }

          const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            resolve({
              success: false,
              employees: [],
              totalRowsRead: 0,
              matchedHeaders: {},
              warnings: [],
              errors: ['Không tìm thấy sheet dữ liệu nào trong tệp Excel.'],
              fileName: file.name,
            });
            return;
          }

          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

          if (!jsonData || jsonData.length === 0) {
            resolve({
              success: false,
              employees: [],
              totalRowsRead: 0,
              matchedHeaders: {},
              warnings: [],
              errors: ['Trang tính không có dữ liệu dòng nào.'],
              fileName: file.name,
            });
            return;
          }

          // 1. Tìm dòng tiêu đề tốt nhất trong 25 dòng đầu
          let bestHeaderRowIdx = -1;
          let bestScore = 0;
          let colMap = {
            name: -1,
            code: -1,
            role: -1,
            dept: -1,
            phone: -1,
            email: -1,
            notes: -1,
            stt: -1,
          };

          const maxSearchRows = Math.min(25, jsonData.length);

          for (let r = 0; r < maxSearchRows; r++) {
            const row = jsonData[r];
            if (!Array.isArray(row) || row.length === 0) continue;

            let score = 0;
            const currentCols = {
              name: -1,
              code: -1,
              role: -1,
              dept: -1,
              phone: -1,
              email: -1,
              notes: -1,
              stt: -1,
            };

            row.forEach((rawCell, cIdx) => {
              const norm = normalizeHeaderStr(rawCell);
              if (!norm) return;

              // STT
              if (
                norm === 'stt' ||
                norm === 'so thu tu' ||
                norm === 'no' ||
                norm === 'idx'
              ) {
                currentCols.stt = cIdx;
                score += 1;
              }
              // Họ và tên
              else if (
                norm.includes('ho va ten') ||
                norm.includes('ho ten') ||
                norm.includes('hovaten') ||
                norm.includes('can bo') ||
                norm.includes('nhan vien') ||
                norm.includes('fullname') ||
                norm.includes('full name') ||
                norm === 'ten' ||
                norm === 'name'
              ) {
                if (currentCols.name === -1) {
                  currentCols.name = cIdx;
                  score += 4;
                }
              }
              // Mã nhân sự
              else if (
                norm.includes('ma nhan su') ||
                norm.includes('ma can bo') ||
                norm.includes('ma giao vien') ||
                norm.includes('ma ns') ||
                norm.includes('ma nv') ||
                norm.includes('ma cb') ||
                norm === 'ma' ||
                norm === 'code' ||
                norm === 'id' ||
                norm === 'emp id' ||
                norm === 'manv' ||
                norm === 'mans'
              ) {
                if (currentCols.code === -1) {
                  currentCols.code = cIdx;
                  score += 3;
                }
              }
              // Chức vụ / Vai trò
              else if (
                norm.includes('chuc vu') ||
                norm.includes('vai tro') ||
                norm.includes('vi tri') ||
                norm.includes('chuc danh') ||
                norm === 'role' ||
                norm === 'position'
              ) {
                if (currentCols.role === -1) {
                  currentCols.role = cIdx;
                  score += 3;
                }
              }
              // Tổ / Bộ phận
              else if (
                norm.includes('bo phan') ||
                norm.includes('to chuyen mon') ||
                norm.includes('to bo mon') ||
                norm.includes('phong ban') ||
                norm.includes('khoa') ||
                norm.includes('department') ||
                norm === 'dept' ||
                norm === 'to' ||
                norm === 'don vi'
              ) {
                if (currentCols.dept === -1) {
                  currentCols.dept = cIdx;
                  score += 2;
                }
              }
              // Điện thoại / SĐT
              else if (
                norm.includes('so dien thoai') ||
                norm.includes('dien thoai') ||
                norm.includes('sdt') ||
                norm === 'phone' ||
                norm === 'mobile' ||
                norm === 'tel' ||
                norm.includes('lien he')
              ) {
                if (currentCols.phone === -1) {
                  currentCols.phone = cIdx;
                  score += 3;
                }
              }
              // Email
              else if (
                norm.includes('email') ||
                norm.includes('e mail') ||
                norm.includes('thu dien tu') ||
                norm === 'mail'
              ) {
                if (currentCols.email === -1) {
                  currentCols.email = cIdx;
                  score += 2;
                }
              }
              // Ghi chú
              else if (
                norm.includes('ghi chu') ||
                norm.includes('chu thich') ||
                norm === 'note' ||
                norm === 'notes'
              ) {
                if (currentCols.notes === -1) {
                  currentCols.notes = cIdx;
                  score += 1;
                }
              }
            });

            // Nếu tìm thấy ít nhất Họ tên hoặc 2 trường nhận diện
            if (score > bestScore) {
              bestScore = score;
              bestHeaderRowIdx = r;
              colMap = currentCols;
            }
          }

          // Fallback nếu không khớp được tiêu đề rõ ràng
          if (bestHeaderRowIdx === -1 || colMap.name === -1) {
            warnings.push('Không nhận diện được tiêu đề cột chuẩn ("Họ và tên"). Hệ thống đang cố gắng tự động suy luận vị trí các cột.');
            bestHeaderRowIdx = 0;

            // Thử đoán các cột: cột 0 = STT/Mã, cột 1 = Tên hoặc ngược lại
            colMap.code = 0;
            colMap.name = 1;
            colMap.role = 2;
            colMap.dept = 3;
            colMap.phone = 4;
            colMap.email = 5;
            colMap.notes = 6;
          }

          // Ghi lại thông tin đối chiếu cột để báo cáo cho người dùng
          const headerRow = jsonData[bestHeaderRowIdx] || [];
          if (colMap.name !== -1) matchedHeaders.nameCol = String(headerRow[colMap.name] || 'Cột ' + (colMap.name + 1));
          if (colMap.code !== -1) matchedHeaders.codeCol = String(headerRow[colMap.code] || 'Cột ' + (colMap.code + 1));
          if (colMap.role !== -1) matchedHeaders.roleCol = String(headerRow[colMap.role] || 'Cột ' + (colMap.role + 1));
          if (colMap.dept !== -1) matchedHeaders.departmentCol = String(headerRow[colMap.dept] || 'Cột ' + (colMap.dept + 1));
          if (colMap.phone !== -1) matchedHeaders.phoneCol = String(headerRow[colMap.phone] || 'Cột ' + (colMap.phone + 1));
          if (colMap.email !== -1) matchedHeaders.emailCol = String(headerRow[colMap.email] || 'Cột ' + (colMap.email + 1));
          if (colMap.notes !== -1) matchedHeaders.notesCol = String(headerRow[colMap.notes] || 'Cột ' + (colMap.notes + 1));

          // 2. Phân tích các hàng dữ liệu sau hàng tiêu đề
          const seenCodes = new Set<string>();
          let autoCodeIndex = 1;

          for (let r = bestHeaderRowIdx + 1; r < jsonData.length; r++) {
            const row = jsonData[r];
            if (!Array.isArray(row) || row.length === 0) continue;

            // Lấy Họ tên
            const rawName = colMap.name !== -1 ? row[colMap.name] : '';
            const name = String(rawName || '').trim();

            // Bỏ qua các hàng trống hoặc dòng tổng cộng/chữ ký
            if (!name || name.length < 2) continue;
            const normName = normalizeHeaderStr(name);
            if (
              normName.includes('cong hoa xa hoi') ||
              normName.includes('doc lap tu do') ||
              normName.includes('nguoi lap bieu') ||
              normName.includes('hieu truong') ||
              normName.includes('tong cong') ||
              normName.includes('bang phan cong')
            ) {
              continue;
            }

            // Lấy Chức vụ / Vai trò
            let rawRole = colMap.role !== -1 ? String(row[colMap.role] || '') : '';
            const normRole = normalizeHeaderStr(rawRole);
            let role: EmployeeRole = 'TEACHER';
            if (
              normRole.includes('admin') ||
              normRole.includes('bgh') ||
              normRole.includes('giam hieu') ||
              normRole.includes('hieu truong') ||
              normRole.includes('pho hieu truong') ||
              normRole.includes('quan ly')
            ) {
              role = 'ADMIN';
            } else if (
              normRole.includes('guard') ||
              normRole.includes('bao ve') ||
              normRole.includes('bv') ||
              normRole.includes('an ninh') ||
              normRole.includes('bao an')
            ) {
              role = 'GUARD';
            }

            // Lấy Mã nhân sự
            let rawCode = colMap.code !== -1 ? String(row[colMap.code] || '').trim() : '';
            // Nếu không có mã hoặc mã là STT số (1, 2, 3...), tạo mã tự động dễ nhìn
            if (!rawCode || /^\d+$/.test(rawCode)) {
              const prefix = role === 'ADMIN' ? 'BGH' : role === 'GUARD' ? 'BV' : 'GV';
              rawCode = `${prefix}${String(autoCodeIndex).padStart(2, '0')}`;
              autoCodeIndex++;
            }
            rawCode = rawCode.toUpperCase();

            // Đảm bảo không trùng mã trong chính file tải lên
            let uniqueCode = rawCode;
            let dupCounter = 1;
            while (seenCodes.has(uniqueCode)) {
              uniqueCode = `${rawCode}_${dupCounter++}`;
            }
            seenCodes.add(uniqueCode);

            // Lấy Bộ phận / Tổ
            const rawDept = colMap.dept !== -1 ? String(row[colMap.dept] || '').trim() : '';
            const department = rawDept || (role === 'ADMIN' ? 'Ban Giám Hiệu' : role === 'GUARD' ? 'Tổ Bảo vệ' : 'Tổ Chuyên môn');

            // Lấy Số điện thoại
            const rawPhone = colMap.phone !== -1 ? row[colMap.phone] : '';
            const phone = cleanPhoneNumber(rawPhone);

            // Lấy Email
            let email = colMap.email !== -1 ? String(row[colMap.email] || '').trim() : '';
            if (!email || !email.includes('@')) {
              const safeEmailUser = normalizeHeaderStr(uniqueCode).replace(/\s+/g, '');
              email = `${safeEmailUser || 'canbo'}@school.edu.vn`;
            }

            // Lấy Ghi chú
            const notes = colMap.notes !== -1 ? String(row[colMap.notes] || '').trim() : '';

            importedEmployees.push({
              id: `emp-excel-${Date.now()}-${r}`,
              code: uniqueCode,
              name,
              role,
              department,
              phone,
              email,
              isActive: true,
              notes,
            });
          }

          if (importedEmployees.length === 0) {
            errors.push('Không tìm thấy danh sách nhân sự hợp lệ trong tệp. Vui lòng kiểm tra lại cấu trúc cột hoặc tải mẫu Excel chuẩn.');
          }

          resolve({
            success: importedEmployees.length > 0,
            employees: importedEmployees,
            totalRowsRead: jsonData.length,
            matchedHeaders,
            warnings,
            errors,
            fileName: file.name,
          });
        } catch (err: any) {
          resolve({
            success: false,
            employees: [],
            totalRowsRead: 0,
            matchedHeaders: {},
            warnings,
            errors: [`Lỗi phân tích file Excel: ${err?.message || 'Tệp không đúng định dạng.'}`],
            fileName: file.name,
          });
        }
      };

      reader.onerror = () => {
        resolve({
          success: false,
          employees: [],
          totalRowsRead: 0,
          matchedHeaders: {},
          warnings: [],
          errors: ['Trình duyệt không thể đọc được nội dung tệp này.'],
          fileName: file.name,
        });
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Đọc và phân tích Bảng phân công lịch trực từ file Excel (hỗ trợ nhập lại lịch đã xuất)
   */
  static parseScheduleExcel(file: File, employees: Employee[]): Promise<ScheduleImportResult> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const warnings: string[] = [];
        const errors: string[] = [];
        const unmatchedNamesSet = new Set<string>();
        const parsedShifts: ShiftAssignment[] = [];

        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer) {
            resolve({
              success: false,
              shifts: [],
              totalDays: 0,
              matchedCount: 0,
              unmatchedNames: [],
              warnings: [],
              errors: ['Tệp rỗng.'],
              fileName: file.name,
            });
            return;
          }

          const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

          // Xây dựng bản đồ tìm kiếm nhân sự theo Tên chuẩn hóa, Mã, hoặc SĐT
          const empNameMap = new Map<string, Employee>();
          const empCodeMap = new Map<string, Employee>();
          const empPhoneMap = new Map<string, Employee>();

          employees.forEach((emp) => {
            empNameMap.set(normalizeHeaderStr(emp.name), emp);
            empCodeMap.set(emp.code.toUpperCase(), emp);
            empPhoneMap.set(emp.phone.replace(/[^0-9]/g, ''), emp);
          });

          const findEmployee = (query: any): Employee | null => {
            if (!query) return null;
            const str = String(query).trim();
            if (!str || str === '(Trống)' || str === 'Trống') return null;

            // Thử tìm theo Mã
            const byCode = empCodeMap.get(str.toUpperCase());
            if (byCode) return byCode;

            // Thử tìm theo Tên chuẩn hóa
            const byName = empNameMap.get(normalizeHeaderStr(str));
            if (byName) return byName;

            // Thử tìm theo Số điện thoại
            const cleanDigits = str.replace(/[^0-9]/g, '');
            if (cleanDigits.length >= 9) {
              const byPhone = empPhoneMap.get(cleanDigits);
              if (byPhone) return byPhone;
            }

            unmatchedNamesSet.add(str);
            return null;
          };

          // Tìm dòng tiêu đề có chứa "Ngày trực" hoặc "Ngày"
          let headerIdx = -1;
          let colDate = -1;
          let colT1 = -1;
          let colT2 = -1;
          let colAdmin = -1;
          let colGuard = -1;
          let colNotes = -1;

          for (let r = 0; r < Math.min(20, jsonData.length); r++) {
            const row = jsonData[r];
            if (!Array.isArray(row)) continue;

            row.forEach((cell, cIdx) => {
              const norm = normalizeHeaderStr(cell);
              if (norm.includes('ngay truc') || norm === 'ngay' || norm === 'date') colDate = cIdx;
              if (norm.includes('giao vien truc 1') || norm.includes('gv 1') || norm.includes('gv1')) colT1 = cIdx;
              if (norm.includes('giao vien truc 2') || norm.includes('gv 2') || norm.includes('gv2')) colT2 = cIdx;
              if (norm.includes('ban giam hieu') || norm.includes('bgh')) colAdmin = cIdx;
              if (norm.includes('bao ve') || norm.includes('bv')) colGuard = cIdx;
              if (norm.includes('ghi chu') || norm.includes('note')) colNotes = cIdx;
            });

            if (colDate !== -1 && (colT1 !== -1 || colAdmin !== -1)) {
              headerIdx = r;
              break;
            }
          }

          if (headerIdx === -1 || colDate === -1) {
            resolve({
              success: false,
              shifts: [],
              totalDays: 0,
              matchedCount: 0,
              unmatchedNames: [],
              warnings: [],
              errors: ['Không tìm thấy bảng lịch trực hợp lệ. Bảng cần có cột "Ngày trực" và các cột nhân sự trực.'],
              fileName: file.name,
            });
            return;
          }

          // Phân tích các ngày trực
          for (let r = headerIdx + 1; r < jsonData.length; r++) {
            const row = jsonData[r];
            if (!Array.isArray(row) || row.length === 0) continue;

            const rawDate = row[colDate];
            if (!rawDate) continue;

            // Xử lý ngày: DD/MM/YYYY hoặc YYYY-MM-DD hoặc Excel date number
            let dateStr = '';
            if (typeof rawDate === 'number') {
              // Chuyển đổi Excel date serial
              const parsedDateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
              dateStr = parsedDateObj.toISOString().slice(0, 10);
            } else {
              const s = String(rawDate).trim();
              if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                dateStr = s;
              } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
                const parts = s.split('/');
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }

            if (!dateStr || isNaN(new Date(dateStr).getTime())) continue;

            const t1 = colT1 !== -1 ? findEmployee(row[colT1]) : null;
            const t2 = colT2 !== -1 ? findEmployee(row[colT2]) : null;
            const admin = colAdmin !== -1 ? findEmployee(row[colAdmin]) : null;
            const guard = colGuard !== -1 ? findEmployee(row[colGuard]) : null;
            const notes = colNotes !== -1 ? String(row[colNotes] || '').trim() : '';

            const dayOfWeek = new Date(dateStr).getDay();
            const isComplete = Boolean(t1 && t2 && admin && guard);

            parsedShifts.push({
              id: `shift-${dateStr}`,
              date: dateStr,
              dayOfWeek,
              startTime: '07:00',
              endTime: '07:00 ngày hôm sau',
              teacher1Id: t1?.id || null,
              teacher2Id: t2?.id || null,
              adminId: admin?.id || null,
              guardId: guard?.id || null,
              status: isComplete ? 'COMPLETE' : 'INCOMPLETE',
              isLocked: false,
              notes,
            });
          }

          resolve({
            success: parsedShifts.length > 0,
            shifts: parsedShifts,
            totalDays: parsedShifts.length,
            matchedCount: parsedShifts.length,
            unmatchedNames: Array.from(unmatchedNamesSet),
            warnings,
            errors,
            fileName: file.name,
          });
        } catch (err: any) {
          resolve({
            success: false,
            shifts: [],
            totalDays: 0,
            matchedCount: 0,
            unmatchedNames: [],
            warnings,
            errors: [`Lỗi phân tích file lịch Excel: ${err?.message || 'Không thể đọc.'}`],
            fileName: file.name,
          });
        }
      };

      reader.onerror = () => {
        resolve({
          success: false,
          shifts: [],
          totalDays: 0,
          matchedCount: 0,
          unmatchedNames: [],
          warnings: [],
          errors: ['Không thể đọc tệp lịch trực.'],
          fileName: file.name,
        });
      };

      reader.readAsArrayBuffer(file);
    });
  }
}
