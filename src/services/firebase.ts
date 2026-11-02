import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Khởi tạo Firebase App
export const app = initializeApp(firebaseConfig);

// Khởi tạo Firestore với đúng Database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Khởi tạo Firebase Authentication
export const auth = getAuth(app);

// Cấu hình Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Kiểm tra kết nối Firestore khi khởi động
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network disconnected.');
      return false;
    }
    // Lỗi permission hoặc document not found là bình thường với document test
    return true;
  }
}

// Chạy test connection khi nạp module
testConnection();

// Đăng nhập bằng Google Popup
export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Lỗi đăng nhập Google Firebase:', error);
    throw error;
  }
}

// Đăng xuất
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Lỗi đăng xuất Firebase:', error);
    throw error;
  }
}

// Hỗ trợ mô phỏng ngắt mạng / kết nối lại để kiểm thử
export async function toggleNetworkSimulation(enable: boolean): Promise<void> {
  if (enable) {
    await enableNetwork(db);
  } else {
    await disableNetwork(db);
  }
}
