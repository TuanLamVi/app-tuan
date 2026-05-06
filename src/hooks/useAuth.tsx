import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { UserProfile } from '../models';
import { normalizePhoneNumber } from '../core/utils';
import { toast } from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  register: (data: any) => Promise<void>;
  login: (identifier: string, pass: string) => Promise<void>;
  resetPasswordWithPin: (identifier: string, pin: string, newPass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check/Create profile for Google users
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Thành viên',
        photoURL: user.photoURL || undefined,
        createdAt: new Date(),
      };
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    }
  };

  const register = async (data: any) => {
    const { identifier, password, displayName, address, pin } = data;
    if (!identifier || !password || !displayName) {
      throw new Error('Vui lòng điền đầy đủ các thông tin bắt buộc.');
    }

    let emailToUse = identifier;
    let phoneNumber = '';

    // Check if identifier is an email or phone
    const isEmail = identifier.includes('@');
    if (!isEmail) {
      const normalizedPhone = normalizePhoneNumber(identifier);
      emailToUse = `${normalizedPhone.replace('+', '')}@mygroup.app`;
      phoneNumber = normalizedPhone;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailToUse, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName });

      const newProfile: UserProfile = {
        uid: user.uid,
        email: isEmail ? identifier : emailToUse,
        displayName,
        phoneNumber: phoneNumber || '',
        address: address || '',
        pin: pin || '0000', 
        createdAt: new Date(),
      };

      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
      toast.success('Đăng ký thành công!');
    } catch (error: any) {
      console.error("Registration Error:", error.code, error.message);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Email hoặc tài khoản này đã được sử dụng.');
      }
      throw new Error('Lỗi đăng ký: ' + error.message);
    }
  };

  const login = async (identifier: string, pass: string) => {
    if (!identifier || !pass) {
      throw new Error('Vui lòng nhập tài khoản và mật khẩu.');
    }

    let emailToUse = identifier;
    if (!identifier.includes('@')) {
      const normalizedPhone = normalizePhoneNumber(identifier);
      emailToUse = `${normalizedPhone.replace('+', '')}@mygroup.app`;
    }

    try {
      await signInWithEmailAndPassword(auth, emailToUse, pass);
      toast.success('Đăng nhập thành công!');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
      }
      throw new Error('Lỗi đăng nhập: ' + error.message);
    }
  };

  const resetPasswordWithPin = async (identifier: string, pin: string, newPass: string) => {
    let q;
    if (identifier.includes('@')) {
      q = query(collection(db, 'users'), where('email', '==', identifier));
    } else {
      const normalizedPhone = normalizePhoneNumber(identifier);
      q = query(collection(db, 'users'), where('phoneNumber', '==', normalizedPhone));
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error('Không tìm thấy tài khoản.');
    
    const userProfile = snapshot.docs[0].data() as UserProfile;
    if (userProfile.pin !== pin) throw new Error('Mã PIN không chính xác.');

    toast.error('Tính năng đặt lại mật khẩu yêu cầu cấu hình máy chủ. Vui lòng liên hệ Admin.');
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, 
      signInWithGoogle, register, login, resetPasswordWithPin,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
