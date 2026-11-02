import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  writeBatch,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  Employee,
  ShiftAssignment,
  ShiftChangeRequest,
  ShiftChangeHistory,
  UnavailableDate,
  CompensatoryDuty,
  ScheduleSettings,
  AppUserRole,
  AuthUser,
} from '../types';
import { INITIAL_EMPLOYEES, INITIAL_UNAVAILABLE_DATES, DEFAULT_SETTINGS } from '../data/sampleData';
import { generateAutoSchedule } from './scheduler';

const BOOTSTRAP_ADMIN_EMAIL = 'dtc245160052@ictu.edu.vn';

// Collections names
export const COLLECTIONS = {
  USERS: 'users',
  ADMINS: 'admins',
  EMPLOYEES: 'employees',
  SHIFTS: 'shifts',
  SHIFT_CHANGE_REQUESTS: 'shift_change_requests',
  SHIFT_CHANGE_HISTORY: 'shift_change_history',
  UNAVAILABLE_DATES: 'unavailable_dates',
  COMPENSATORY_DUTIES: 'compensatory_duties',
  SCHEDULE_SETTINGS: 'schedule_settings',
} as const;

// 1. Tự động kiểm tra và Seed dữ liệu trường PTDTNT Na Rì nếu cơ sở dữ liệu mới tinh
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    const employeesSnap = await getDocs(collection(db, COLLECTIONS.EMPLOYEES));
    if (employeesSnap.empty) {
      console.log('Khởi tạo dữ liệu mẫu ban đầu cho Firestore...');
      const batch = writeBatch(db);

      // Thêm nhân sự
      for (const emp of INITIAL_EMPLOYEES) {
        const empRef = doc(db, COLLECTIONS.EMPLOYEES, emp.id);
        batch.set(empRef, { ...emp, updatedAt: new Date().toISOString() });
      }

      // Xếp sẵn lịch mẫu 30 ngày tháng 11/2026
      const scheduleRes = generateAutoSchedule({
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        employees: INITIAL_EMPLOYEES,
        unavailableDates: INITIAL_UNAVAILABLE_DATES,
        existingShifts: [],
        settings: DEFAULT_SETTINGS,
        keepLockedShifts: false,
      });

      // Thêm ca trực
      for (const shift of scheduleRes.shifts) {
        const shiftRef = doc(db, COLLECTIONS.SHIFTS, shift.id);
        batch.set(shiftRef, { ...shift, updatedAt: new Date().toISOString() });
      }

      // Thêm ngày nghỉ
      for (const leave of INITIAL_UNAVAILABLE_DATES) {
        const leaveRef = doc(db, COLLECTIONS.UNAVAILABLE_DATES, leave.id);
        batch.set(leaveRef, leave);
      }

      // Thêm cấu hình
      const settingsRef = doc(db, COLLECTIONS.SCHEDULE_SETTINGS, 'default');
      batch.set(settingsRef, DEFAULT_SETTINGS);

      await batch.commit();
      console.log('Seed dữ liệu Firestore hoàn tất!');
    }
  } catch (error) {
    console.warn('Lỗi khi seed Firestore ban đầu (có thể do quyền hoặc đã tồn tại):', error);
  }
}

// 2. Đồng bộ User Profile và xác định vai trò (RBAC)
export async function syncUserProfile(firebaseUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<AuthUser> {
  const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
  const adminRef = doc(db, COLLECTIONS.ADMINS, firebaseUser.uid);

  const email = (firebaseUser.email || '').toLowerCase();
  const isBootstrapAdmin = email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  try {
    const userSnap = await getDoc(userRef);

    let role: AppUserRole = 'TEACHER';

    if (isBootstrapAdmin) {
      role = 'ADMIN';
      // Đảm bảo document admin tồn tại
      await setDoc(
        adminRef,
        {
          email,
          grantedAt: new Date().toISOString(),
          grantedBy: 'SYSTEM_BOOTSTRAP',
        },
        { merge: true }
      );
    } else if (userSnap.exists()) {
      const data = userSnap.data();
      role = (data.role as AppUserRole) || 'TEACHER';
    } else {
      // Tìm xem email này có trùng với cán bộ nào trong danh sách nhân sự không
      const empSnap = await getDocs(collection(db, COLLECTIONS.EMPLOYEES));
      const matchedEmp = empSnap.docs
        .map((d) => d.data() as Employee)
        .find((e) => e.email?.toLowerCase() === email);

      if (matchedEmp?.role === 'ADMIN') {
        role = 'BGH';
      } else if (matchedEmp?.role === 'GUARD') {
        role = 'GUARD';
      } else {
        role = 'TEACHER';
      }
    }

    const authUserData: AuthUser = {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || email.split('@')[0] || 'Cán Bộ',
      email,
      avatarUrl: firebaseUser.photoURL || undefined,
      role,
      provider: 'firebase',
      loginAt: new Date().toISOString(),
    };

    // Lưu vào Firestore `users/{uid}`
    await setDoc(
      userRef,
      {
        ...authUserData,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return authUserData;
  } catch (error) {
    console.error('Lỗi syncUserProfile:', error);
    // Trả về đối tượng fallback an toàn
    return {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || 'Người dùng',
      email,
      role: isBootstrapAdmin ? 'ADMIN' : 'TEACHER',
      provider: 'firebase',
      loginAt: new Date().toISOString(),
    };
  }
}

// 3. Quản trị viên cập nhật quyền cho người dùng
export async function updateUserRoleInDb(userId: string, newRole: AppUserRole): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  const adminRef = doc(db, COLLECTIONS.ADMINS, userId);

  try {
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: new Date().toISOString(),
    });

    if (newRole === 'ADMIN') {
      await setDoc(adminRef, {
        grantedAt: new Date().toISOString(),
        grantedBy: 'ADMIN',
      });
    } else {
      try {
        await deleteDoc(adminRef);
      } catch (e) {
        // bỏ qua nếu adminRef chưa tồn tại
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTIONS.USERS}/${userId}`);
  }
}

// 4. Các hàm Đăng Ký Lắng Nghe Realtime (Firestore onSnapshot)

export function subscribeEmployees(
  onData: (employees: Employee[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.EMPLOYEES));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Employee[];
      onData(list);
    },
    (err) => {
      console.error('Lỗi realtime Employees:', err);
      onError?.(err);
    }
  );
}

export function subscribeShifts(
  onData: (shifts: ShiftAssignment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.SHIFTS), orderBy('date', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ShiftAssignment[];
      onData(list);
    },
    (err) => {
      console.error('Lỗi realtime Shifts:', err);
      onError?.(err);
    }
  );
}

export function subscribeShiftChangeRequests(
  onData: (requests: ShiftChangeRequest[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.SHIFT_CHANGE_REQUESTS), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ShiftChangeRequest[];
      onData(list);
    },
    (err) => {
      console.error('Lỗi realtime ShiftChangeRequests:', err);
      onError?.(err);
    }
  );
}

export function subscribeShiftChangeHistory(
  onData: (history: ShiftChangeHistory[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.SHIFT_CHANGE_HISTORY), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ShiftChangeHistory[];
      onData(list);
    },
    (err) => {
      console.error('Lỗi realtime ShiftChangeHistory:', err);
      onError?.(err);
    }
  );
}

export function subscribeUnavailableDates(
  onData: (leaves: UnavailableDate[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.UNAVAILABLE_DATES), orderBy('date', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as UnavailableDate[];
      onData(list);
    },
    (err) => {
      console.error('Lỗi realtime UnavailableDates:', err);
      onError?.(err);
    }
  );
}

export function subscribeCompensatoryDuties(
  onData: (duties: CompensatoryDuty[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.COMPENSATORY_DUTIES), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CompensatoryDuty[];
      onData(list);
    },
    (err) => {
      console.error('Lỗi realtime CompensatoryDuties:', err);
      onError?.(err);
    }
  );
}

export function subscribeScheduleSettings(
  onData: (settings: ScheduleSettings) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const settingsRef = doc(db, COLLECTIONS.SCHEDULE_SETTINGS, 'default');
  return onSnapshot(
    settingsRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onData(docSnap.data() as ScheduleSettings);
      } else {
        onData(DEFAULT_SETTINGS);
      }
    },
    (err) => {
      console.error('Lỗi realtime ScheduleSettings:', err);
      onError?.(err);
    }
  );
}

// 5. THAO TÁC ĐỔI CA BẰNG ATOMIC TRANSACTION (Firestore runTransaction)
/**
 * Thực hiện hoán đổi ca trực an toàn tuyệt đối với Firestore Transaction.
 * Tránh trường hợp 2 người cùng đổi 1 ca hoặc ca bị thay đổi/khóa trong lúc chờ.
 */
export async function executeShiftSwapTransaction(
  requestId: string,
  confirmedByUserName: string
): Promise<{ success: boolean; message: string }> {
  try {
    return await runTransaction(db, async (transaction) => {
      const reqRef = doc(db, COLLECTIONS.SHIFT_CHANGE_REQUESTS, requestId);
      const reqSnap = await transaction.get(reqRef);

      if (!reqSnap.exists()) {
        throw new Error('Yêu cầu đổi ca không tồn tại.');
      }

      const reqData = reqSnap.data() as ShiftChangeRequest;

      if (reqData.status !== 'PENDING') {
        throw new Error(`Yêu cầu đổi ca này đã ở trạng thái: ${reqData.status}, không thể đổi lại.`);
      }

      if (!reqData.requesterShiftId || !reqData.targetShiftId) {
        throw new Error('Yêu cầu đổi ca thiếu thông tin ca trực nguồn hoặc ca trực đích.');
      }

      const shift1Ref = doc(db, COLLECTIONS.SHIFTS, reqData.requesterShiftId);
      const shift2Ref = doc(db, COLLECTIONS.SHIFTS, reqData.targetShiftId);

      const shift1Snap = await transaction.get(shift1Ref);
      const shift2Snap = await transaction.get(shift2Ref);

      if (!shift1Snap.exists() || !shift2Snap.exists()) {
        throw new Error('Một trong hai ca trực cần đổi không còn tồn tại trong hệ thống.');
      }

      const shift1Data = shift1Snap.data() as ShiftAssignment;
      const shift2Data = shift2Snap.data() as ShiftAssignment;

      // Kiểm tra xem ca có bị khóa không
      if (shift1Data.isLocked || shift2Data.isLocked) {
        throw new Error('Không thể đổi ca vì một trong hai ca trực đã được Ban Giám Hiệu KHÓA.');
      }

      const getPositionField = (pos?: string): 'teacher1Id' | 'teacher2Id' | 'adminId' | 'guardId' => {
        if (pos === 'teacher2') return 'teacher2Id';
        if (pos === 'admin') return 'adminId';
        if (pos === 'guard') return 'guardId';
        return 'teacher1Id';
      };

      const pos1Field = getPositionField(reqData.requesterRolePosition);
      const pos2Field = getPositionField(reqData.targetRolePosition);

      // Xác minh người gửi và người nhận vẫn đang nằm trong ca
      if (shift1Data[pos1Field] !== reqData.requesterId) {
        throw new Error('Ca trực nguồn đã bị thay đổi người khác trước đó. Giao dịch bị hủy an toàn.');
      }
      if (shift2Data[pos2Field] !== reqData.targetEmployeeId) {
        throw new Error('Ca trực đích đã bị thay đổi người khác trước đó. Giao dịch bị hủy an toàn.');
      }

      // Hoán đổi nhân sự trong 2 ca trực
      const nowIso = new Date().toISOString();
      transaction.update(shift1Ref, {
        [pos1Field]: reqData.targetEmployeeId,
        updatedAt: nowIso,
        updatedBy: confirmedByUserName,
      });

      transaction.update(shift2Ref, {
        [pos2Field]: reqData.requesterId,
        updatedAt: nowIso,
        updatedBy: confirmedByUserName,
      });

      // Cập nhật trạng thái yêu cầu sang APPROVED
      transaction.update(reqRef, {
        status: 'APPROVED',
        resolvedAt: nowIso,
      });

      // Ghi 2 bản ghi lịch sử thay đổi ca trực (ShiftChangeHistory)
      const hist1Ref = doc(collection(db, COLLECTIONS.SHIFT_CHANGE_HISTORY));
      const hist2Ref = doc(collection(db, COLLECTIONS.SHIFT_CHANGE_HISTORY));

      transaction.set(hist1Ref, {
        shiftDate: shift1Data.date,
        rolePosition: reqData.requesterRolePosition || 'teacher1',
        previousEmployeeId: reqData.requesterId,
        newEmployeeId: reqData.targetEmployeeId,
        reason: `Đổi ca theo thỏa thuận (${reqData.reason})`,
        changedBy: confirmedByUserName,
        timestamp: nowIso,
      });

      transaction.set(hist2Ref, {
        shiftDate: shift2Data.date,
        rolePosition: reqData.targetRolePosition || 'teacher1',
        previousEmployeeId: reqData.targetEmployeeId,
        newEmployeeId: reqData.requesterId,
        reason: `Đổi ca theo thỏa thuận (${reqData.reason})`,
        changedBy: confirmedByUserName,
        timestamp: nowIso,
      });

      return {
        success: true,
        message: `Đã đổi ca thành công giữa ca ngày ${shift1Data.date} và ca ngày ${shift2Data.date}!`,
      };
    });
  } catch (error) {
    console.error('Lỗi Transaction đổi ca:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi không xác định khi thực hiện đổi ca.',
    };
  }
}

// 6. Tạo và Quản lý yêu cầu đổi ca
export async function createShiftChangeRequestInDb(
  req: Omit<ShiftChangeRequest, 'id' | 'createdAt'>
): Promise<string> {
  try {
    const docRef = doc(collection(db, COLLECTIONS.SHIFT_CHANGE_REQUESTS));
    await setDoc(docRef, {
      ...req,
      id: docRef.id,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.SHIFT_CHANGE_REQUESTS);
  }
}

export async function rejectShiftChangeRequestInDb(requestId: string): Promise<void> {
  try {
    const reqRef = doc(db, COLLECTIONS.SHIFT_CHANGE_REQUESTS, requestId);
    await updateDoc(reqRef, {
      status: 'REJECTED',
      resolvedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTIONS.SHIFT_CHANGE_REQUESTS}/${requestId}`);
  }
}

// 7. Thao tác Ca Trực (Shifts)
export async function saveShiftInDb(shift: ShiftAssignment): Promise<void> {
  try {
    const shiftRef = doc(db, COLLECTIONS.SHIFTS, shift.id);
    await setDoc(
      shiftRef,
      {
        ...shift,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.SHIFTS}/${shift.id}`);
  }
}

export async function saveShiftsBatchInDb(shifts: ShiftAssignment[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    for (const shift of shifts) {
      const shiftRef = doc(db, COLLECTIONS.SHIFTS, shift.id);
      batch.set(
        shiftRef,
        {
          ...shift,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.SHIFTS);
  }
}

export async function toggleLockShiftInDb(shiftId: string, isLocked: boolean): Promise<void> {
  try {
    const shiftRef = doc(db, COLLECTIONS.SHIFTS, shiftId);
    await updateDoc(shiftRef, {
      isLocked,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTIONS.SHIFTS}/${shiftId}`);
  }
}

// 8. Thao tác Cán Bộ (Employees)
export async function saveEmployeeInDb(emp: Employee): Promise<void> {
  try {
    const empRef = doc(db, COLLECTIONS.EMPLOYEES, emp.id);
    await setDoc(
      empRef,
      {
        ...emp,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.EMPLOYEES}/${emp.id}`);
  }
}

export async function saveEmployeesBatchInDb(employees: Employee[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    for (const emp of employees) {
      const empRef = doc(db, COLLECTIONS.EMPLOYEES, emp.id);
      batch.set(
        empRef,
        {
          ...emp,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.EMPLOYEES);
  }
}

export async function deleteEmployeeInDb(empId: string): Promise<void> {
  try {
    const empRef = doc(db, COLLECTIONS.EMPLOYEES, empId);
    await deleteDoc(empRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.EMPLOYEES}/${empId}`);
  }
}

// 9. Thao tác Đơn Xin Nghỉ / Vắng (Unavailable Dates)
export async function saveUnavailableDateInDb(leave: UnavailableDate): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.UNAVAILABLE_DATES, leave.id);
    await setDoc(docRef, leave, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.UNAVAILABLE_DATES}/${leave.id}`);
  }
}

export async function updateUnavailableDateStatusInDb(
  leaveId: string,
  status: 'PENDING' | 'APPROVED' | 'REJECTED',
  reviewedBy?: string
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.UNAVAILABLE_DATES, leaveId);
    await updateDoc(docRef, {
      status,
      reviewedBy: reviewedBy || 'BGH',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTIONS.UNAVAILABLE_DATES}/${leaveId}`);
  }
}

export async function deleteUnavailableDateInDb(leaveId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.UNAVAILABLE_DATES, leaveId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.UNAVAILABLE_DATES}/${leaveId}`);
  }
}

// 10. Thao tác Trực Bù (Compensatory Duty)
export async function saveCompensatoryDutyInDb(duty: CompensatoryDuty): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.COMPENSATORY_DUTIES, duty.id);
    await setDoc(docRef, duty, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.COMPENSATORY_DUTIES}/${duty.id}`);
  }
}

// 11. Thao tác Lịch Sử Thay Đổi Ca Trực (Shift Change History)
export async function recordShiftChangeHistoryInDb(history: ShiftChangeHistory): Promise<void> {
  try {
    const docRef = doc(collection(db, COLLECTIONS.SHIFT_CHANGE_HISTORY));
    await setDoc(docRef, {
      ...history,
      id: docRef.id,
      timestamp: history.timestamp || new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.SHIFT_CHANGE_HISTORY);
  }
}

// 12. Thao tác Cấu Hình Xếp Lịch (Schedule Settings)
export async function saveScheduleSettingsInDb(settings: ScheduleSettings): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.SCHEDULE_SETTINGS, 'default');
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.SCHEDULE_SETTINGS}/default`);
  }
}
