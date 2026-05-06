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
      case 'invite': return <UserPlus className="text-orange-500" size={18} />;
      case 'approval': return <FileCheck className="text-green-500" size={18} />;
      case 'announcement': return <MessageSquare className="text-blue-500" size={18} />;
      default: return <Bell className="text-gray-500" size={18} />;
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
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 z-[70] w-full max-w-sm bg-white shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <Bell className="text-gray-900" size={20} />
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Thông báo</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleMarkAllAsRead}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Đã xem tất cả"
                >
                  <Check size={20} />
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                    <Bell size={32} />
                  </div>
                  <p className="text-sm font-medium">Bạn chưa có thông báo nào</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    className={cn(
                      "p-4 rounded-3xl border transition-all cursor-pointer relative group",
                      notif.isRead 
                        ? "bg-white border-gray-50 opacity-60" 
                        : "bg-blue-50/30 border-blue-100 shadow-sm"
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="mt-1">{getIcon(notif.type)}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className={cn("text-sm font-bold text-gray-900 leading-tight", !notif.isRead && "pr-6")}>
                          {notif.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.message}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                          <Calendar size={10} />
                          {formatDate(notif.createdAt)}
                        </div>
                      </div>
                      <button 
                        onClick={(e) => handleDelete(notif.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {!notif.isRead && (
                      <div className="absolute top-4 right-4 w-2 h-2 bg-blue-600 rounded-full" />
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
