import React, { useState } from 'react';
import { Task, UserProfile, Comment, TaskStatus } from '../../models';
import { auth, db } from '../../lib/firebase';
import { doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { 
  X, Calendar, MessageSquare, Send, 
  Trash2, Clock, Play, CheckCircle2, AlertCircle, Flag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../../core/utils';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

interface TaskDetailModalProps {
  task: Task;
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
  members: UserProfile[];
  ownerId: string;
  onDelete?: (taskId: string) => void;
  canManage?: boolean;
}

const PRIORITY_CONFIG = {
  low: { label: 'THẤP', color: 'emerald', icon: Flag },
  medium: { label: 'TRUNG BÌNH', color: 'blue', icon: Flag },
  high: { label: 'CAO', color: 'orange', icon: Flag },
  urgent: { label: 'KHẨN CẤP', color: 'red', icon: Flag },
};

const formatTimestamp = (date: any) => {
  if (!date) return '';
  const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
  return formatDistanceToNow(d, { addSuffix: true, locale: vi });
};

export default function TaskDetailModal({ 
  task, 
  groupId, 
  isOpen, 
  onClose, 
  members, 
  ownerId,
  onDelete,
  canManage
}: TaskDetailModalProps) {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const currentUser = auth.currentUser;
  const isOwner = currentUser?.uid === ownerId;
  const isAssignee = task.assigneeIds?.includes(currentUser?.uid || '');
  const canModify = isOwner || isAssignee || canManage;

  const handleUpdateStatus = async (newStatus: TaskStatus) => {
    if (!currentUser || isUpdatingStatus) return;
    if (task.status === newStatus) return;

    setIsUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'groups', groupId, 'tasks', task.id), {
        status: newStatus
      });
      toast.success('Đã cập nhật trạng thái');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/tasks/${task.id}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newComment: Comment = {
        id: Math.random().toString(36).substring(7),
        uid: currentUser.uid,
        content: commentText.trim(),
        userName: currentUser.displayName || 'Thành viên',
        reactions: {},
        createdAt: new Date(),
      };

      await updateDoc(doc(db, 'groups', groupId, 'tasks', task.id), {
        comments: arrayUnion(newComment)
      });
      setCommentText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/tasks/${task.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa công việc này?')) return;
    
    try {
      await deleteDoc(doc(db, 'groups', groupId, 'tasks', task.id));
      toast.success('Đã xóa công việc');
      onClose();
      onDelete?.(task.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/tasks/${task.id}`);
    }
  };

  if (!isOpen) return null;

  const statusConfig = {
    pending: { label: 'CHỜ XỬ LÝ', icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800' },
    doing: { label: 'ĐANG LÀM', icon: Play, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    done: { label: 'HOÀN THÀNH', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 40 }}
          className="relative w-full max-w-4xl bg-white dark:bg-slate-950 rounded-[48px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[90vh] border border-white/10"
        >
          {/* Header Area */}
          <div className="relative p-10 pb-8 border-b border-slate-50 dark:border-slate-800 text-left">
            <div className="flex justify-between items-start mb-8">
              <div className="flex flex-wrap gap-3">
                <div className={cn(
                  "px-5 py-2 rounded-2xl flex items-center gap-3 shadow-sm border",
                  statusConfig[task.status].bg,
                  task.status === 'pending' ? 'border-slate-200 dark:border-slate-800' :
                  task.status === 'doing' ? 'border-indigo-100 dark:border-indigo-900/30' :
                  'border-emerald-100 dark:border-emerald-900/30'
                )}>
                  {React.createElement(statusConfig[task.status].icon, { size: 16, className: statusConfig[task.status].color })}
                  <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", statusConfig[task.status].color)}>
                    {statusConfig[task.status].label}
                  </span>
                </div>
                
                {task.priority && (
                  <div className={cn(
                    "px-5 py-2 rounded-2xl flex items-center gap-3 shadow-sm border",
                    PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG].color === 'emerald' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                    PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG].color === 'blue' ? "bg-blue-50 text-blue-600 border-blue-100" :
                    PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG].color === 'orange' ? "bg-orange-50 text-orange-600 border-orange-100" :
                    "bg-red-50 text-red-600 border-red-100 animate-pulse"
                  )}>
                    <Flag size={16} className={task.priority === 'urgent' || task.priority === 'high' ? 'fill-current' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                      {PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG].label}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {(isOwner || currentUser?.uid === task.createdBy || canManage) && (
                  <button 
                    onClick={handleDelete}
                    className="w-12 h-12 flex items-center justify-center bg-red-50 dark:bg-red-900/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-100 dark:border-red-900/20"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
                <button 
                  onClick={onClose}
                  className="w-12 h-12 flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-all border border-slate-100 dark:border-slate-800"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-[1.1] uppercase italic mb-4">
              {task.title}
            </h1>
            <div className="flex items-center gap-4 text-xs text-slate-400 font-bold uppercase tracking-widest">
              <span>ĐƯỢC TẠO BỞI <span className="text-indigo-600 dark:text-indigo-400">Thành viên nhóm</span></span>
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              <span>{formatTimestamp(task.createdAt)}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide bg-slate-50/50 dark:bg-slate-900/20">
            <div className="p-10 space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 text-left">
                {/* Left Column */}
                <div className="lg:col-span-8 space-y-10">
                  <section className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-1 rounded-full bg-indigo-600" />
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">
                        Mô tả & Chi tiết
                      </h4>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-10 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm leading-relaxed">
                      {task.description ? (
                        <p className="text-lg text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium">
                          {task.description}
                        </p>
                      ) : (
                        <p className="text-lg text-slate-400 italic font-medium">Không có mô tả cho công việc này.</p>
                      )}
                    </div>
                  </section>

                  {/* Discussion Section */}
                  <section className="space-y-8">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                        <div className="w-10 h-1 rounded-full bg-indigo-600" />
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">
                          Thảo luận ({task.comments?.length || 0})
                        </h4>
                      </div>
                    </div>

                    <div className="space-y-8">
                      {task.comments?.map((comment) => (
                        <div key={comment.id} className="flex gap-6 group">
                          <div className="w-14 h-14 rounded-[20px] bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center text-slate-400 font-black text-lg overflow-hidden shrink-0 border border-slate-50 dark:border-slate-700">
                            {(members || []).find(m => m.uid === comment.uid)?.photoURL ? (
                              <img src={(members || []).find(m => m.uid === comment.uid)?.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              comment.userName?.charAt(0) || '?'
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex justify-between items-center px-1">
                              <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest italic">{comment.userName}</span>
                              <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{formatTimestamp(comment.createdAt)}</span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] rounded-tl-none border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50 group-hover:shadow-lg">
                              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed break-words font-medium">{comment.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {(!task.comments || task.comments.length === 0) && (
                        <div className="bg-white dark:bg-slate-900 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800 py-16 text-center opacity-40">
                          <MessageSquare size={40} className="mx-auto mb-6 text-slate-300" />
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 italic">Chưa có thảo luận nào</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right Column: Controls */}
                <div className="lg:col-span-4 space-y-10">
                  {/* Status Grid */}
                  <section className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-600" />
                      Trạng thái
                    </h4>
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-[32px] border border-slate-100 dark:border-slate-800 flex flex-col gap-2 shadow-sm">
                      {(['pending', 'doing', 'done'] as TaskStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => handleUpdateStatus(status)}
                          disabled={isUpdatingStatus || !canModify}
                          className={cn(
                            "flex items-center gap-4 px-6 py-4 rounded-[20px] transition-all relative overflow-hidden group border",
                            task.status === status 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-600/20" 
                              : "text-slate-500 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80"
                          )}
                        >
                          {React.createElement(statusConfig[status].icon, { 
                            size: 18, 
                            className: task.status === status ? "text-white" : "text-slate-400 group-hover:text-indigo-400" 
                          })}
                          <span className="text-[11px] font-black uppercase tracking-widest italic">
                            {statusConfig[status].label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Assignees Bento */}
                  <section className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-emerald-500" />
                       Người thực hiện
                    </h4>
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                      <div className="flex -space-x-3">
                        {(task.assigneeIds || []).map((id, idx) => {
                          const profile = (members || []).find(m => m.uid === id);
                          return (
                            <div 
                              key={id} 
                              className="w-12 h-12 rounded-2xl border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shadow-xl hover:scale-110 transition-transform relative z-10"
                            >
                              {profile?.photoURL ? (
                                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-black text-slate-400 uppercase">{(task.assigneeNames || [])[idx]?.charAt(0)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="grid gap-2">
                        {(task.assigneeNames || []).map((name, i) => (
                           <div key={i} className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest italic bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                             {name}
                           </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Deadline Bento */}
                  <section className="space-y-6">
                     <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-orange-500" />
                       Thời hạn
                    </h4>
                    <div className="bg-indigo-600 p-8 rounded-[40px] shadow-2xl shadow-indigo-600/20 flex flex-col items-center text-center gap-4 text-white">
                      <div className="w-16 h-16 rounded-[24px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/20">
                        <Calendar size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xl font-black uppercase tracking-tighter italic">
                          {task.dueDate ? formatDate(task.dueDate) : 'VÔ THỜI HẠN'}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                          {task.dueDate && task.dueDate < new Date() && task.status !== 'done' ? 'QUÁ HẠN NGHIÊM TRỌNG' : 'HẠN HOÀN THÀNH MỤC TIÊU'}
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>

          {/* Comment Composer */}
          <div className="p-10 bg-white dark:bg-slate-950 border-t border-slate-50 dark:border-slate-800">
            <form onSubmit={handleAddComment} className="relative group">
              <input 
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="NHẬP TIN NHẮN HOẶC CẬP NHẬT..."
                className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent rounded-[32px] pl-8 pr-20 py-6 text-sm font-bold focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500/20 dark:text-white outline-none transition-all placeholder:text-slate-400 tracking-tight"
              />
              <button 
                type="submit"
                disabled={!commentText.trim() || isSubmitting}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-90 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white rounded-[24px] flex items-center justify-center transition-all shadow-xl shadow-indigo-600/20"
              >
                {isSubmitting ? (
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={24} />
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
