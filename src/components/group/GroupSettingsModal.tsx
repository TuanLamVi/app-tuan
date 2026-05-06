import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Trash2, ShieldAlert } from 'lucide-react';
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
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        name: name.trim(),
        coverImage: coverImage.trim() || null,
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
        className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Cài đặt nhóm</h3>
            <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-400">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Tên nhóm</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-4 py-4 font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Ảnh bìa (URL)</label>
              <input 
                type="text" 
                value={coverImage}
                onChange={e => setCoverImage(e.target.value)}
                placeholder="https://..."
                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-4 py-4 font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
              />
              {coverImage && (
                <div className="mt-3 relative h-24 w-full rounded-2xl overflow-hidden border-2 border-dashed border-gray-100 dark:border-gray-800">
                  <img 
                    src={coverImage} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Invalid+Image+URL';
                    }}
                  />
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg">
                    <p className="text-[8px] font-black text-white uppercase tracking-widest">Xem trước</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl">
              <div>
                <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Cần phê duyệt</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Yêu cầu Admin duyệt khi có người nhấn link tham gia</p>
              </div>
              <button 
                onClick={() => setRequireApproval(!requireApproval)}
                className={`w-12 h-6 rounded-full transition-colors relative ${requireApproval ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
              >
                <motion.div 
                  animate={{ x: requireApproval ? 26 : 2 }}
                  className="w-5 h-5 bg-white rounded-full absolute top-0.5"
                />
              </button>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 block">Thông báo đẩy</label>
               
               <div className="space-y-2">
                 <NotificationToggle 
                   label="Bản tin mới" 
                   description="Thông báo khi có thông báo mới từ Admin" 
                   enabled={notifyAnnouncements} 
                   onChange={setNotifyAnnouncements} 
                 />
                 <NotificationToggle 
                   label="Tài chính" 
                   description="Thông báo các biến động số dư và giao dịch" 
                   enabled={notifyFinance} 
                   onChange={setNotifyFinance} 
                 />
                 <NotificationToggle 
                   label="Công việc" 
                   description="Thông báo khi có task mới hoặc thay đổi trạng thái" 
                   enabled={notifyTasks} 
                   onChange={setNotifyTasks} 
                 />
               </div>
            </div>

            {isOwner && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
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
                      Hành động này không thể hoàn tác. Bạn chắc chắn chứ?
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleDeleteGroup}
                        className="flex-1 bg-red-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                        Xác nhận xóa
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 bg-white dark:bg-gray-800 text-gray-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-100 dark:border-gray-700"
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

        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-white dark:bg-gray-800 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            Đóng
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-50 active:scale-95 transition-transform"
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
    <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
      <div className="flex-1 pr-4">
        <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight">{label}</p>
        <p className="text-[9px] text-gray-400 leading-tight">{description}</p>
      </div>
      <button 
        onClick={() => onChange(!enabled)}
        className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
      >
        <motion.div 
          animate={{ x: enabled ? 22 : 2 }}
          className="w-4 h-4 bg-white rounded-full absolute top-0.5"
        />
      </button>
    </div>
  );
}
