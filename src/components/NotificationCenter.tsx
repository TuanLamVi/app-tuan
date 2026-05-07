import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Check, Trash2, Calendar, MessageSquare, UserPlus, FileCheck } from 'lucide-react';
import { Notification } from '../models';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';
import { formatDate, cn } from '../core/utils';
import { useNavigate } from 'react-router-dom';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
}

export default function NotificationCenter({ isOpen, onClose, notifications }: NotificationCenterProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleMarkAsRead = async (id: string) => {
    if (!user) return;
    await NotificationService.markAsRead(user.uid, id);
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await NotificationService.markAllAsRead(user.uid);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    await NotificationService.deleteNotification(user.uid, id);
  };

  const handleNotifClick = async (notif: Notification) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif.id);
    }
    
    // Navigation logic based on data
    if (notif.data?.groupId) {
      navigate(`/group/${notif.data.groupId}`);
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'invite': return <UserPlus className="text-amber-600" size={18} />;
      case 'approval': return <FileCheck className="text-emerald-600" size={18} />;
      case 'announcement': return <MessageSquare className="text-indigo-600" size={18} />;
      default: return <Bell className="text-slate-400" size={18} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 z-[70] w-full max-w-sm bg-white dark:bg-slate-950 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <Bell className="text-white" size={18} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Thông báo</h3>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleMarkAllAsRead}
                  className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Đã xem tất cả"
                >
                  <Check size={20} />
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center">
                    <Bell size={28} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-medium">Bạn chưa có thông báo mới</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    className={cn(
                      "p-5 rounded-2xl border transition-all cursor-pointer relative group",
                      notif.isRead 
                        ? "bg-white dark:bg-slate-900 border-slate-50 dark:border-slate-800 opacity-60" 
                        : "bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 shadow-sm"
                    )}
                  >
                    <div className="flex gap-4">
                      <div className="mt-1 w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={cn("text-sm font-bold text-slate-900 dark:text-white leading-tight mb-1", !notif.isRead && "pr-6")}>
                          {notif.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{notif.message}</p>
                        <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <Calendar size={10} />
                          {formatDate(notif.createdAt)}
                        </div>
                      </div>
                      <button 
                        onClick={(e) => handleDelete(notif.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all ml-auto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {!notif.isRead && (
                      <div className="absolute top-6 right-6 w-2 h-2 bg-indigo-600 rounded-full shadow-lg shadow-indigo-500/50" />
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
