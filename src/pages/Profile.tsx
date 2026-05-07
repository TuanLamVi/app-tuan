import React, { useState, useEffect } from 'react';
import { useAuth, handleFirestoreError, OperationType } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, LogOut, Settings, Bell, Shield, 
  HelpCircle, ChevronRight, Moon, Sun, 
  Camera, Check, Edit2, X, Lock, Mail,
  Phone, MapPin, Sparkles, MessageSquare,
  ChevronLeft, Plus
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { cn } from '../core/utils';
import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { PushNotificationService } from '../services/pushNotificationService';

export default function Profile() {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useDarkMode();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(profile?.displayName || '');
  const [newPhone, setNewPhone] = useState(profile?.phoneNumber || '');
  const [newAddress, setNewAddress] = useState(profile?.address || '');
  const [newPhotoURL, setNewPhotoURL] = useState(profile?.photoURL || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);

  // Password change state
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  
  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notifSettings, setNotifSettings] = useState({
    system: profile?.notificationSettings?.system ?? true,
    news: profile?.notificationSettings?.news ?? true
  });

  useEffect(() => {
    if (profile?.notificationSettings) {
      setNotifSettings({
        system: profile.notificationSettings.system,
        news: profile.notificationSettings.news
      });
    }
  }, [profile]);

  const handleUpdateNotificationSettings = async (settings: { system: boolean, news: boolean }) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        notificationSettings: settings
      });
      toast.success('Đã cập nhật cài đặt thông báo');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
    }
  };

  // Help state
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0) {
        setNotifications([
          { id: '1', title: 'Chào mừng!', message: 'Chào mừng bạn đến với MyGroups.', createdAt: new Date() },
          { id: '2', title: 'Mẹo nhỏ', message: 'Hãy tạo nhóm đầu tiên của bạn để quản lý nhóm cùng bạn bè.', createdAt: new Date() }
        ]);
      } else {
        setNotifications(data);
      }
    });

    return () => unsub();
  }, []);

  const handleUpdateProfile = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const updates: any = {
        displayName: newName,
        phoneNumber: newPhone,
        address: newAddress,
        photoURL: newPhotoURL
      };

      if (newName !== profile?.displayName || newPhotoURL !== profile?.photoURL) {
        await updateProfile(auth.currentUser, { 
          displayName: newName,
          photoURL: newPhotoURL 
        });
      }
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);
      
      setIsEditing(false);
      toast.success('Đã cập nhật thông tin cá nhân');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const defaultAvatars = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Bubba',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Caleb',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Daisy',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper'
  ];

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
        toast.error('Mật khẩu xác nhận không khớp');
        return;
    }
    if (passwords.new.length < 6) {
        toast.error('Mật khẩu phải có ít nhất 6 ký tự');
        return;
    }

    setIsSaving(true);
    try {
        if (auth.currentUser) {
            await updatePassword(auth.currentUser, passwords.new);
            setIsChangingPass(false);
            setPasswords({ old: '', new: '', confirm: '' });
            toast.success('Đổi mật khẩu thành công');
        }
    } catch (error: any) {
        if (error.code === 'auth/requires-recent-login') {
            toast.error('Hành động này yêu cầu đăng nhập lại để xác thực.');
            logout();
        } else {
            toast.error('Lỗi khi đổi mật khẩu: ' + error.message);
        }
    } finally {
        setIsSaving(false);
    }
  };

  const menuItems = [
    { 
      icon: <Bell className="text-orange-500" />, 
      label: 'Thông báo', 
      sub: 'Tin nhắn & lời mời',
      onClick: () => setShowNotifications(true)
    },
    { 
      icon: <Settings className="text-purple-500" />, 
      label: 'Cài đặt thông báo', 
      sub: 'Tùy chỉnh nội dung nhận',
      onClick: () => setShowNotificationSettings(true)
    },
    { 
      icon: <Lock className="text-green-500" />, 
      label: 'Bảo mật', 
      sub: 'Đổi mật khẩu',
      onClick: () => setIsChangingPass(true)
    },
    { 
      icon: theme === 'light' ? <Moon className="text-indigo-500" /> : <Sun className="text-yellow-500" />, 
      label: 'Giao diện', 
      sub: theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng',
      onClick: toggleTheme,
      right: (
        <div className={cn(
          "w-10 h-5 rounded-full relative transition-colors duration-300",
          theme === 'dark' ? "bg-indigo-600" : "bg-gray-200"
        )}>
          <div className={cn(
            "absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300",
            theme === 'dark' ? "translate-x-6" : "translate-x-1"
          )} />
        </div>
      )
    },
    { 
      icon: <HelpCircle className="text-blue-500" />, 
      label: 'Hỗ trợ', 
      sub: 'Trung tâm trợ giúp',
      onClick: () => setShowHelp(true)
    },
  ];

  const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
    <AnimatePresence>
        {isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                />
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{title}</h3>
                        <button onClick={onClose} className="p-2 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-400">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="p-6 max-h-[70vh] overflow-y-auto">
                        {children}
                    </div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
  );

  return (
    <div className="p-4 pb-24 space-y-6 max-w-md mx-auto">
      <header className="py-12 flex flex-col items-center relative">
        <div className="relative group">
          <div className="w-32 h-32 bg-gray-50 dark:bg-gray-800 rounded-[44px] flex items-center justify-center mb-6 border-4 border-white dark:border-gray-950 shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden transition-all group-hover:scale-105 group-active:scale-95 cursor-pointer rotate-2">
            {newPhotoURL || profile?.photoURL ? (
              <img 
                src={newPhotoURL || profile?.photoURL} 
                alt={profile?.displayName} 
                className="w-full h-full object-cover -rotate-2" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-14 h-14 text-blue-600 dark:text-blue-400 -rotate-2" />
            )}
            <div 
              onClick={() => setIsEditing(true)}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-[40px]"
            >
              <Camera className="text-white" size={28} />
            </div>
          </div>
          {isEditing && (
            <motion.div 
              initial={{ scale: 0, rotate: -45 }} 
              animate={{ scale: 1, rotate: 0 }}
              className="absolute -bottom-1 -right-1 w-10 h-10 bg-blue-600 rounded-2xl border-4 border-white dark:border-gray-950 flex items-center justify-center shadow-xl z-10"
            >
              <Sparkles size={16} className="text-white" />
            </motion.div>
          )}
        </div>

        {isEditing ? (
          <div className="flex flex-col items-center gap-6 w-full animate-in fade-in zoom-in duration-300 px-4">
            <div className="w-full space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-3 block">Phong cách đại diện</label>
                <div className="flex gap-3 pb-4 overflow-x-auto no-scrollbar scroll-smooth">
                    {defaultAvatars.map((url, i) => (
                        <button 
                            key={i}
                            onClick={() => setNewPhotoURL(url)}
                            className={cn(
                                "w-14 h-14 rounded-2xl flex-shrink-0 border-4 transition-all overflow-hidden shadow-sm",
                                newPhotoURL === url ? "border-blue-600 scale-110 shadow-blue-500/20" : "border-transparent opacity-40 hover:opacity-100"
                            )}
                        >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
                <div className="relative mt-2">
                    <input 
                        type="text"
                        value={newPhotoURL}
                        onChange={e => setNewPhotoURL(e.target.value)}
                        placeholder="Hoặc dán URL ảnh tại đây..."
                        className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-800 rounded-3xl px-6 py-4 font-bold text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                    />
                    <Camera className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                </div>
              </div>
              
              <div className="grid gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 block text-left">Họ và tên</label>
                  <div className="relative">
                      <input 
                          type="text"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-800 rounded-3xl px-6 py-4 font-black text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                      />
                      <User className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 block text-left">Số điện thoại</label>
                  <div className="relative">
                      <input 
                          type="tel"
                          value={newPhone}
                          onChange={e => setNewPhone(e.target.value)}
                          placeholder="VD: 0912345678"
                          className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-800 rounded-3xl px-6 py-4 font-black text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                      />
                      <Phone className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 block text-left">Địa chỉ liên hệ</label>
                  <div className="relative">
                      <input 
                          type="text"
                          value={newAddress}
                          onChange={e => setNewAddress(e.target.value)}
                          placeholder="Nhập địa chỉ của bạn"
                          className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-800 rounded-3xl px-6 py-4 font-black text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                      />
                      <MapPin className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 w-full mt-4">
              <button 
                onClick={() => setShowConfirmSave(true)}
                disabled={isSaving}
                className="flex-[2] py-5 bg-blue-600 text-white rounded-[28px] font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
              <button 
                onClick={() => {
                    setIsEditing(false);
                    setNewName(profile?.displayName || '');
                    setNewPhotoURL(profile?.photoURL || '');
                    setNewPhone(profile?.phoneNumber || '');
                    setNewAddress(profile?.address || '');
                }}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-[28px] font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all"
              >
                Thoát
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center animate-in fade-in slide-in-from-top-4 duration-500 px-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter font-display uppercase italic">{profile?.displayName || 'Tài khoản'}</h2>
              <button 
                onClick={() => setIsEditing(true)} 
                className="w-8 h-8 flex items-center justify-center bg-blue-50 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400 hover:scale-110 active:rotate-12 transition-all shadow-sm"
              >
                <Edit2 size={14} />
              </button>
            </div>
            <div className="inline-flex items-center gap-2.5 px-5 py-2 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full border border-gray-100 dark:border-gray-700 shadow-inner">
                <Mail size={12} className="text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300 text-[11px] font-black uppercase tracking-widest leading-none">{profile?.email}</span>
            </div>
          </div>
        )}
      </header>

      <section className="bg-white dark:bg-gray-900 rounded-[48px] overflow-hidden border border-gray-100 dark:border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.03)] space-y-px">
        {menuItems.map((item, index) => (
          <button 
            key={index}
            onClick={item.onClick}
            className={cn(
              "w-full flex items-center gap-5 p-7 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-all text-left group border-b border-gray-50 dark:border-gray-800 last:border-b-0",
            )}
          >
            <div className="w-12 h-12 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-2xl group-hover:bg-white dark:group-hover:bg-gray-700 shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shrink-0">
              {item.icon}
            </div>
            <div className="flex-1">
              <h4 className="font-black text-gray-900 dark:text-white text-[13px] tracking-tight font-display uppercase italic">{item.label}</h4>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1 opacity-70">{item.sub}</p>
            </div>
            {item.right || <ChevronRight className="w-5 h-5 text-gray-200 dark:text-gray-700 group-hover:translate-x-1 transition-transform" />}
          </button>
        ))}
      </section>

      <button 
        onClick={logout}
        className="w-full flex items-center justify-center gap-4 p-7 bg-rose-50/80 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-[48px] font-black uppercase text-[11px] tracking-[0.2em] border border-rose-100 dark:border-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-all shadow-sm active:scale-[0.98]"
      >
        <LogOut size={18} className="translate-y-[-1px]" />
        <span>Đăng xuất ngay</span>
      </button>

      <p className="text-center text-[10px] text-gray-300 dark:text-gray-700 font-bold uppercase tracking-[0.3em] py-8">
        MyGroups Smart Manager © 2026
      </p>

      {/* Change Password Modal */}
      <Modal isOpen={isChangingPass} onClose={() => setIsChangingPass(false)} title="Đổi mật khẩu">
         <div className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium leading-relaxed">
                Đảm bảo mật khẩu mới của bạn có ít nhất 6 ký tự để bảo mật tài khoản.
            </p>
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Mật khẩu mới</label>
                    <input 
                        type="password"
                        value={passwords.new}
                        onChange={e => setPasswords({...passwords, new: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-3xl px-6 py-4 font-bold text-sm focus:outline-none transition-all dark:text-white"
                        placeholder="••••••"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Xác nhận mật khẩu</label>
                    <input 
                        type="password"
                        value={passwords.confirm}
                        onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-3xl px-6 py-4 font-bold text-sm focus:outline-none transition-all dark:text-white"
                        placeholder="••••••"
                    />
                </div>
            </div>
            <button 
                onClick={handleChangePassword}
                disabled={isSaving}
                className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all mt-6 disabled:opacity-50"
            >
                {isSaving ? 'Đang cập nhật...' : 'Xác nhận thay đổi'}
            </button>
         </div>
      </Modal>

      {/* Notifications Modal */}
      <Modal isOpen={showNotifications} onClose={() => setShowNotifications(false)} title="Thông báo mới">
        <div className="space-y-4">
            {notifications.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full mx-auto flex items-center justify-center">
                        <Bell className="text-gray-300" size={32} />
                    </div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Không có thông báo mới</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notif) => (
                        <div key={notif.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700/50 group hover:shadow-lg hover:shadow-gray-100/50 transition-all cursor-default relative overflow-hidden">
                             <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50" />
                             
                             <h5 className="font-black text-gray-900 dark:text-white text-sm mb-1 pr-4">{notif.title}</h5>
                             <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{notif.message}</p>
                             <div className="mt-4 flex items-center gap-2 text-[9px] text-gray-400 uppercase font-black tracking-widest opacity-60">
                                <Sparkles size={10} />
                                <span>Mới cập nhật</span>
                             </div>
                        </div>
                    ))}
                    <button className="w-full py-4 text-blue-600 text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 rounded-2xl transition-colors">
                        Đánh dấu tất cả đã đọc
                    </button>
                </div>
            )}
        </div>
      </Modal>

      {/* Help Center Modal */}
      <Modal isOpen={showHelp} onClose={() => setShowHelp(false)} title="Trung tâm trợ giúp">
         <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-[36px] text-white shadow-xl shadow-blue-500/20">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white/20 rounded-xl">
                        <MessageSquare size={20} />
                    </div>
                    <h5 className="font-black text-sm uppercase tracking-widest leading-none">Liên hệ trực tiếp</h5>
                </div>
                <p className="text-[11px] text-blue-100 font-bold uppercase tracking-wider mb-6 opacity-80">Đội ngũ của chúng tôi luôn sẵn sàng 24/7</p>
                <a href="mailto:support@mygroup.app" className="bg-white text-blue-600 block text-center py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform">Gửi email hỗ trợ</a>
            </div>

            <div className="space-y-4">
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Câu hỏi thường gặp</h5>
                <div className="space-y-2">
                    {[
                        { q: 'Làm thế nào để tạo nhóm?', a: 'Tại màn hình chính, nhấn vào nút "Tạo nhóm mới" và điền thông tin.' },
                        { q: 'Làm thế nào để bắt đầu quản lý nhóm?', a: 'Tạo nhóm mới và mời các thành viên tham gia để cùng theo dõi hoạt động.' },
                        { q: 'Có thể mời thành viên bằng cách nào?', a: 'Sử dụng QR Code hoặc gửi link mời trong phần Cài đặt nhóm.' },
                        { q: 'Làm thế nào để xuất báo cáo?', a: 'Chỉ có Trưởng nhóm và Phó nhóm mới có quyền xuất báo cáo hoạt động nhóm.' }
                    ].map((faq, i) => (
                        <details key={i} className="group bg-gray-50 dark:bg-gray-800 rounded-[24px] border border-transparent hover:border-gray-100 transition-all">
                            <summary className="list-none p-5 flex items-center justify-between cursor-pointer font-bold text-sm text-gray-800 dark:text-gray-200">
                                <span>{faq.q}</span>
                                <Plus size={16} className="text-gray-400 group-open:rotate-45 transition-transform" />
                            </summary>
                            <div className="px-5 pb-5 pt-0 text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed animate-in slide-in-from-top-2 duration-300">
                                {faq.a}
                            </div>
                        </details>
                    ))}
                </div>
            </div>
         </div>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal isOpen={showNotificationSettings} onClose={() => setShowNotificationSettings(false)} title="Tùy chỉnh thông báo">
        <div className="space-y-6">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
            Chọn loại thông báo bạn muốn nhận để luôn cập nhật những gì quan trọng nhất.
          </p>
          
          <div className="space-y-4">
            <NotificationToggle 
              label="Thông báo hệ thống"
              description="Các cập nhật về bảo mật, tài khoản và lời mời tham gia nhóm."
              enabled={notifSettings.system}
              onChange={(val) => {
                const newS = { ...notifSettings, system: val };
                setNotifSettings(newS);
                handleUpdateNotificationSettings(newS);
              }}
            />
            
            <NotificationToggle 
              label="Thông báo cộng đồng"
              description="Các thông báo mới từ các nhóm bạn đang tham gia."
              enabled={notifSettings.news}
              onChange={(val) => {
                const newS = { ...notifSettings, news: val };
                setNotifSettings(newS);
                handleUpdateNotificationSettings(newS);
              }}
            />
            
            <NotificationToggle 
              label="Thông báo đẩy (Push)"
              description="Nhận thông báo ngay cả khi không mở ứng dụng (Yêu cầu quyền trình duyệt)."
              enabled={Notification.permission === 'granted'}
              onChange={async () => {
                const res = await PushNotificationService.requestPermission(auth.currentUser?.uid || '');
                if (res) {
                  toast.success('Đã kích hoạt thông báo đẩy!');
                }
              }}
            />
          </div>
          
          <div className="pt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/20">
            <div className="flex gap-3">
              <Sparkles className="text-blue-600 mt-1 shrink-0" size={16} />
              <p className="text-[10px] text-blue-700 dark:text-blue-400 font-bold leading-relaxed">
                Mẹo: Tắt các thông báo không cần thiết sẽ giúp bạn tập trung hơn vào công việc quan trọng.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <Modal 
        isOpen={showConfirmSave} 
        onClose={() => setShowConfirmSave(false)} 
        title="Xác nhận thay đổi"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-[24px] flex items-center justify-center text-blue-600">
              <Sparkles size={32} />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
              Bạn có chắc chắn muốn lưu các thay đổi này cho thông tin cá nhân của mình không?
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => {
                setShowConfirmSave(false);
                handleUpdateProfile();
              }}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
            >
              Đồng ý, lưu thay đổi
            </button>
            <button 
              onClick={() => setShowConfirmSave(false)}
              className="w-full py-4 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-2xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all"
            >
              Xem lại
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function NotificationToggle({ label, description, enabled, onChange }: { label: string, description: string, enabled: boolean, onChange: (val: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-[28px] border border-transparent hover:border-gray-100 transition-all">
      <div className="flex-1">
        <h4 className="font-black text-gray-900 dark:text-white text-xs tracking-tight">{label}</h4>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1 leading-tight">{description}</p>
      </div>
      <button 
        onClick={() => onChange(!enabled)}
        className={cn(
          "w-12 h-6 rounded-full relative transition-colors duration-300 shrink-0",
          enabled ? "bg-blue-600 shadow-md shadow-blue-500/20" : "bg-gray-200 dark:bg-gray-700"
        )}
      >
        <div className={cn(
          "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300",
          enabled ? "translate-x-7" : "translate-x-1"
        )} />
      </button>
    </div>
  );
}

