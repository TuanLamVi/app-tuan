import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Trash2 } from 'lucide-react';
import { Group } from '../../models';
import { db } from '../../lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface GroupSettingsModalProps {
  group: Group;
  onClose: () => void;
  isOwner: boolean;
}

export default function GroupSettingsModal({ group, onClose, isOwner }: GroupSettingsModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState(group.name);
  const [coverImage, setCoverImage] = useState(group.coverImage || '');
  const [requireApproval, setRequireApproval] = useState(group.settings?.requireApproval ?? true);
  const [notifyAnnouncements, setNotifyAnnouncements] = useState(group.settings?.notifications?.announcements ?? true);
  const [notifyFinance, setNotifyFinance] = useState(group.settings?.notifications?.finance ?? true);
  const [notifyTasks, setNotifyTasks] = useState(group.settings?.notifications?.tasks ?? true);
  const [defaultTab, setDefaultTab] = useState(group.default_tab || 'news');
  const [enabledTabs, setEnabledTabs] = useState(group.enabled_tabs ?? {
    news: true,
    chat: true,
    members: true,
    tasks: true,
    finance: true,
    polls: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        name: name.trim(),
        coverImage: coverImage.trim() || null,
        enabled_tabs: enabledTabs,
        default_tab: defaultTab, // THÊM MỚI
        settings: {
          requireApproval,
          notifications: {
            announcements: notifyAnnouncements,
            finance: notifyFinance,
            tasks: notifyTasks
          }
        }
      });
      toast.success('Đã cập nhật thông tin nhóm');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!isOwner) return;
    try {
      await deleteDoc(doc(db, 'groups', group.id));
      toast.success('Đã xóa nhóm');
      navigate('/');
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, `groups/${group.id}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800"
      >
        <div className="overflow-y-auto p-6 md:p-8 no-scrollbar">
          <div className="flex justify-between items-center mb-8 pr-8">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Cài đặt nhóm</h3>
            <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 z-10 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1 mb-2 block">Tên nhóm</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-4 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1 mb-2 block">Ảnh bìa (URL)</label>
              <input 
                type="text" 
                value={coverImage}
                onChange={e => setCoverImage(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-4 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20"
              />
              {coverImage && (
                <div className="mt-3 relative h-24 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img 
                    src={coverImage} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Invalid+Image+URL';
                    }}
                  />
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg">
                    <p className="text-[8px] font-bold text-white uppercase tracking-widest">Xem trước</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-indigo-50/10 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">Cần phê duyệt</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Duyệt thành viên mới</p>
              </div>
              <button 
                onClick={() => setRequireApproval(!requireApproval)}
                className={`w-10 h-5 rounded-full transition-colors relative ${requireApproval ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <motion.div 
                  animate={{ x: requireApproval ? 22 : 2 }}
                  className="w-3 h-3 bg-white rounded-full absolute top-1 shadow-sm"
                />
              </button>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1 block">Thông báo đẩy</label>
               
               <div className="space-y-2">
                 <NotificationToggle 
                   label="Bản tin mới" 
                   description="Thông báo Admin" 
                   enabled={notifyAnnouncements} 
                   onChange={setNotifyAnnouncements} 
                 />
                 <NotificationToggle 
                   label="Tài chính" 
                   description="Số dư & biến động" 
                   enabled={notifyFinance} 
                   onChange={setNotifyFinance} 
                 />
                 <NotificationToggle 
                   label="Công việc" 
                   description="Cập nhật nhiệm vụ" 
                   enabled={notifyTasks} 
                   onChange={setNotifyTasks} 
                 />
               </div>
            </div>

            {/* Quản lý tính năng/Tab */}
            {isOwner && (
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1 block">Tab mặc định (Ưu tiên)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'news', label: 'Bản tin' },
                    { id: 'chat', label: 'Trao đổi' },
                    { id: 'members', label: 'Thành viên' },
                    { id: 'tasks', label: 'Nhiệm vụ' },
                    { id: 'finance', label: 'Tài chính' },
                    { id: 'polls', label: 'Bình chọn' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setDefaultTab(tab.id)}
                      disabled={!enabledTabs[tab.id as keyof typeof enabledTabs]}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        defaultTab === tab.id
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800 disabled:opacity-30'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-tight">{tab.label}</span>
                      {defaultTab === tab.id && <Check size={12} />}
                    </button>
                  ))}
                </div>

                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1 block pt-2">Tính năng hoạt động</label>
                <div className="grid grid-cols-2 gap-2">
                  <NotificationToggle 
                    label="Bản tin" 
                    description="" 
                    enabled={enabledTabs.news} 
                    onChange={(val) => {
                      setEnabledTabs(prev => ({ ...prev, news: val }));
                      if (!val && defaultTab === 'news') setDefaultTab('members');
                    }} 
                  />
                  <NotificationToggle 
                    label="Trao đổi" 
                    description="" 
                    enabled={enabledTabs.chat} 
                    onChange={(val) => {
                      setEnabledTabs(prev => ({ ...prev, chat: val }));
                      if (!val && defaultTab === 'chat') setDefaultTab('news');
                    }} 
                  />
                  <NotificationToggle 
                    label="Thành viên" 
                    description="" 
                    enabled={enabledTabs.members} 
                    onChange={(val) => {
                      setEnabledTabs(prev => ({ ...prev, members: val }));
                      if (!val && defaultTab === 'members') setDefaultTab('news');
                    }} 
                  />
                  <NotificationToggle 
                    label="Nhiệm vụ" 
                    description="" 
                    enabled={enabledTabs.tasks} 
                    onChange={(val) => {
                      setEnabledTabs(prev => ({ ...prev, tasks: val }));
                      if (!val && defaultTab === 'tasks') setDefaultTab('news');
                    }} 
                  />
                  <NotificationToggle 
                    label="Tài chính" 
                    description="" 
                    enabled={enabledTabs.finance} 
                    onChange={(val) => {
                      setEnabledTabs(prev => ({ ...prev, finance: val }));
                      if (!val && defaultTab === 'finance') setDefaultTab('news');
                    }} 
                  />
                  <NotificationToggle 
                    label="Bình chọn" 
                    description="" 
                    enabled={enabledTabs.polls} 
                    onChange={(val) => {
                      setEnabledTabs(prev => ({ ...prev, polls: val }));
                      if (!val && defaultTab === 'polls') setDefaultTab('news');
                    }} 
                  />
                </div>
              </div>
            )}

            {isOwner && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                {!showDeleteConfirm ? (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-colors"
                  >
                    <Trash2 size={16} /> Giải tán nhóm
                  </button>
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2">
                    <p className="text-red-600 dark:text-red-400 text-xs font-bold text-center mb-4">
                      Giải tán nhóm? Bạn không thể hoàn tác.
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleDeleteGroup}
                        className="flex-1 bg-red-600 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                      >
                        Xác nhận
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 bg-white dark:bg-slate-800 text-slate-500 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-slate-100 dark:border-slate-700"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 flex gap-3 shrink-0 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-500 rounded-2xl font-bold uppercase text-[10px] tracking-widest border border-slate-100 dark:border-slate-700 shadow-sm"
          >
            Đóng
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-500/20 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {isSaving ? 'Đang lưu...' : (
              <div className="flex items-center justify-center gap-2">
                <Check size={16} /> Lưu thay đổi
              </div>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function NotificationToggle({ label, description, enabled, onChange }: { 
  label: string; 
  description: string; 
  enabled: boolean; 
  onChange: (val: boolean) => void;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
      enabled 
        ? 'bg-indigo-50/10 border-indigo-500/20 shadow-sm shadow-indigo-500/5' 
        : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
    }`}>
      <div className="flex-1 pr-2 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-tight truncate ${enabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>{label}</p>
        {description && <p className="text-[8px] text-slate-400 truncate tracking-tight">{description}</p>}
      </div>
      <button 
        onClick={() => onChange(!enabled)}
        className={`w-9 h-4 rounded-full transition-colors relative shrink-0 ${enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <motion.div 
          animate={{ x: enabled ? 22 : 2 }}
          className="w-2.5 h-2.5 bg-white rounded-full absolute top-0.5 shadow-sm"
        />
      </button>
    </div>
  );
}
