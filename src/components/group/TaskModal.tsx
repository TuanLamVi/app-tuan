import React, { useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, TaskStatus } from '../../models';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, User, Calendar, Type, AlignLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../core/utils';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import { NotificationService } from '../../services/notificationService';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  members: UserProfile[];
  ownerId: string;
}

export default function TaskModal({ isOpen, onClose, groupId, groupName, members, ownerId }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleAssignee = (uid: string) => {
    setSelectedAssigneeIds(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !title || selectedAssigneeIds.length === 0) {
      toast.error('Vui lòng điền đủ thông tin và chọn người phụ trách');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedMembers = members.filter(m => selectedAssigneeIds.includes(m.uid));
      const assigneeNames = selectedMembers.map(m => m.displayName || 'Thành viên');
      
      const taskData = {
        groupId,
        title,
        description,
        assigneeIds: selectedAssigneeIds,
        assigneeNames,
        status: 'pending' as TaskStatus,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'groups', groupId, 'tasks'), taskData);

      // 1. Notify all assignees
      const assigneeNotifications = selectedAssigneeIds.map(uid => 
        NotificationService.sendNotification(uid, {
          title: 'Công việc mới',
          message: `Bạn được giao công việc: "${title}" trong nhóm "${groupName}"`,
          type: 'system',
          category: 'tasks',
          data: { groupId, taskId: docRef.id }
        })
      );
      await Promise.all(assigneeNotifications);

      // 2. Notify the owner if the creator is not the owner
      if (auth.currentUser.uid !== ownerId) {
        await NotificationService.sendNotification(ownerId, {
          title: 'Phân công việc mới',
          message: `${auth.currentUser.displayName || 'Một quản trị viên'} đã giao việc "${title}" cho ${assigneeNames.join(', ')}`,
          type: 'system',
          category: 'tasks',
          data: { groupId, taskId: docRef.id }
        });
      }

      // 3. Notify all other group members about the new task
      const otherGroupMembers = members.filter(m => 
        m.uid !== auth.currentUser?.uid && 
        m.uid !== ownerId && 
        !selectedAssigneeIds.includes(m.uid)
      );
      const memberNotifications = otherGroupMembers.map(m => 
        NotificationService.sendNotification(m.uid, {
          title: 'Công việc mới trong nhóm',
          message: `${auth.currentUser?.displayName || 'Một thành viên'} đã tạo công việc mới: "${title}"`,
          type: 'system',
          category: 'tasks',
          data: { groupId, taskId: docRef.id }
        })
      );
      await Promise.all(memberNotifications);

      toast.success('Đã thêm công việc mới');
      onClose();
      setTitle('');
      setDescription('');
      setSelectedAssigneeIds([]);
      setDueDate('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/tasks`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600">
                    <CheckCircle size={20} />
                  </div>
                  <h2 className="text-xl font-black italic uppercase tracking-tight dark:text-white">Thêm việc mới</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <X className="text-gray-400" size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Tên công việc</label>
                  <div className="relative">
                    <input 
                      type="text"
                      required
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="VD: Chuẩn bị âm thanh, Đón khách..."
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-11 py-4 font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                    />
                    <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Mô tả (không bắt buộc)</label>
                  <div className="relative">
                    <textarea 
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Chi tiết công việc..."
                      rows={3}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-11 py-4 font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 resize-none"
                    />
                    <AlignLeft className="absolute left-4 top-5 text-gray-300" size={18} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Người phụ trách ({selectedAssigneeIds.length})</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-hide">
                    {members.map(member => {
                      const isSelected = selectedAssigneeIds.includes(member.uid);
                      return (
                        <button
                          key={member.uid}
                          type="button"
                          onClick={() => toggleAssignee(member.uid)}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left",
                            isSelected 
                              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-400" 
                              : "bg-gray-50 dark:bg-gray-800 border-transparent hover:border-gray-200"
                          )}
                        >
                          <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                            {member.photoURL ? (
                              <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User size={12} className="m-auto text-gray-400" />
                            )}
                          </div>
                          <span className={cn(
                            "text-xs font-bold truncate",
                            isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-600 dark:text-gray-400"
                          )}>
                            {member.displayName}
                          </span>
                          {isSelected && (
                            <CheckCircle size={14} className="ml-auto text-blue-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Hạn hoàn thành</label>
                  <div className="relative">
                    <input 
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-11 py-4 font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                    />
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    disabled={isSubmitting}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle size={18} />
                        Xác nhận thêm
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
