import React, { useEffect, useState, useRef } from 'react';
import { db, auth } from '../../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, serverTimestamp, limit, doc, deleteDoc, updateDoc, getDoc
} from 'firebase/firestore';
import { ChatMessage, UserProfile } from '../../models';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, User, Trash2, Smile, Image as ImageIcon, 
  MoreVertical, MessageCircle, Clock, Maximize2, Minimize2, X, ThumbsUp, Check
} from 'lucide-react';

const REACTIONS = [
  { emoji: '👍', label: 'Thích' },
  { emoji: '❤️', label: 'Yêu' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Buồn' },
  { emoji: '🔥', label: 'Lửa' }
];

const formatDateSeparator = (date: Date) => {
  const now = new Date();
  const d = new Date(date);
  
  if (d.toDateString() === now.toDateString()) return 'Hôm nay';
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  
  return d.toLocaleDateString('vi-VN', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
};

import { cn, formatDate } from '../../core/utils';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import Skeleton from '../ui/Skeleton';

interface ChatTabProps {
  groupId: string;
  canManage: boolean;
  onClose?: () => void;
}

export default function ChatTab({ groupId, canManage, onClose }: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update last read timestamp when messages are loaded/viewed
  const updateLastRead = async () => {
    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        const lastReadChat = { ...(data.lastReadChat || {}) };
        lastReadChat[groupId] = serverTimestamp();
        await updateDoc(userRef, { lastReadChat });
      }
    } catch (error) {
      console.error("Error updating last read chat:", error);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      updateLastRead();
    }
  }, [groupId, messages.length]);
  const prevMessagesCount = useRef(0);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleReaction = async (msgId: string, emoji: string) => {
    if (!auth.currentUser) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const currentReactions = { ...(msg.reactions || {}) } as Record<string, string[]>;
    const userIds = currentReactions[emoji] || [];
    
    if (userIds.includes(auth.currentUser.uid)) {
      currentReactions[emoji] = userIds.filter(id => id !== auth.currentUser?.uid);
      if (currentReactions[emoji].length === 0) delete currentReactions[emoji];
    } else {
      currentReactions[emoji] = [...userIds, auth.currentUser.uid];
    }

    try {
      await updateDoc(doc(db, 'groups', groupId, 'messages', msgId), {
        reactions: currentReactions
      });
      setShowReactionPicker(null);
      setActiveActionId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/messages/${msgId}`);
    }
  };

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    }
  }, []);

  const startLongPress = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    const pos = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    touchStartPos.current = pos;
    
    longPressTimeout.current = setTimeout(() => {
      setActiveActionId(id);
      if (window.navigator.vibrate) {
        window.navigator.vibrate(40);
      }
    }, 500);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimeout.current) return;
    
    const pos = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    const dist = Math.sqrt(Math.pow(pos.x - touchStartPos.current.x, 2) + Math.pow(pos.y - touchStartPos.current.y, 2));
    
    if (dist > 10) {
      stopLongPress();
    }
  };

  const stopLongPress = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
    touchStartPos.current = null;
  };

  useEffect(() => {
    const q = query(
      collection(db, 'groups', groupId, 'messages'), 
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      } as ChatMessage)).reverse();
      
      // Play sound for incoming new messages if not sent by us
      if (fetchedMessages.length > prevMessagesCount.current && prevMessagesCount.current > 0) {
        const lastMsg = fetchedMessages[fetchedMessages.length - 1];
        if (lastMsg.senderId !== auth.currentUser?.uid) {
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
          if (window.navigator.vibrate) {
            window.navigator.vibrate(50);
          }
        }
      }
      
      setMessages(fetchedMessages);
      prevMessagesCount.current = fetchedMessages.length;
      setLoading(false);
      
      // Auto scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `groups/${groupId}/messages`);
    });

    return () => unsubscribe();
  }, [groupId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newMessage.trim() || isSending) return;

    setIsSending(true);
    const content = newMessage.trim();
    setNewMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await addDoc(collection(db, 'groups', groupId, 'messages'), {
        groupId,
        content,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Thành viên',
        senderPhoto: auth.currentUser.photoURL || null,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/messages`);
      setNewMessage(content); // Restore if failed
      setIsSending(false);
      return;
    }

    try {
      // Update lastMessageAt on the group
      await updateDoc(doc(db, 'groups', groupId), {
        lastMessageAt: serverTimestamp()
      });
    } catch (error) {
      // Not critical if group update fails, but we should know
      console.warn("Could not update lastMessageAt on group:", error);
      // We don't necessarily want to treat this as a full failure for the user
      // since the message was already sent above.
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await deleteDoc(doc(db, 'groups', groupId, 'messages', msgId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/messages/${msgId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[500px] gap-4">
        <Skeleton className="h-12 w-2/3 rounded-2xl" />
        <Skeleton className="h-12 w-1/2 rounded-2xl self-end" />
        <Skeleton className="h-20 w-3/4 rounded-2xl" />
        <Skeleton className="h-12 w-1/3 rounded-2xl self-end" />
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden transition-all duration-300",
      isFullScreen 
        ? "fixed inset-0 z-[60] h-full rounded-0" 
        : "h-[600px] rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm relative"
    )}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <MessageCircle size={20} />
          </div>
          <div>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight leading-none mb-1">Trò chuyện nhóm</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{messages.length} tin nhắn</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-slate-900 dark:hover:text-white group"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Messages list */}
      <div 
        ref={scrollRef}
        onClick={() => activeActionId && setActiveActionId(null)}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-1 no-scrollbar scroll-smooth touch-pan-y"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <MessageCircle size={40} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest italic text-slate-400">Hãy bắt đầu câu chuyện!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const isOwn = message.senderId === auth.currentUser?.uid;
              const prevMessage = messages[index - 1];
              const nextMessage = messages[index + 1];
              
              // Date separator check
              const showDateSeparator = !prevMessage || 
                new Date(message.createdAt).toDateString() !== new Date(prevMessage.createdAt).toDateString();

              // Messenger-style grouping
              const isFirstInGroup = !prevMessage || 
                                    prevMessage.senderId !== message.senderId || 
                                    showDateSeparator ||
                                    (message.createdAt.getTime() - prevMessage.createdAt.getTime() > 300000); // 5 mins

              const isLastInGroup = !nextMessage || 
                                   nextMessage.senderId !== message.senderId || 
                                   (new Date(nextMessage.createdAt).toDateString() !== new Date(message.createdAt).toDateString()) ||
                                   (nextMessage.createdAt.getTime() - message.createdAt.getTime() > 300000);

              const sameDay = nextMessage && (new Date(nextMessage.createdAt).toDateString() === new Date(message.createdAt).toDateString());
              const timeDiff = nextMessage ? (nextMessage.createdAt.getTime() - message.createdAt.getTime()) : 0;
              const isTight = !isLastInGroup && sameDay && timeDiff < 60000;

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-8">
                      <div className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800/50 rounded-full backdrop-blur-sm">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                          {formatDateSeparator(message.createdAt)}
                        </span>
                      </div>
                    </div>
                  )}

                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={cn(
                      "flex gap-2 max-w-[85%] md:max-w-[75%]",
                      isOwn ? "flex-row-reverse self-end ml-auto" : "flex-row self-start mr-auto",
                      isTight ? "mb-0.5" : "mb-3",
                      isFirstInGroup && !showDateSeparator ? "mt-4" : "mt-0"
                    )}
                  >
                    {/* Avatar Column */}
                    <div className="w-8 flex-shrink-0 flex flex-col justify-end pb-1">
                      {!isOwn && isLastInGroup && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shadow-sm border border-white dark:border-slate-700">
                          {message.senderPhoto ? (
                            <img src={message.senderPhoto} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <User size={14} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div 
                      className={cn(
                        "flex flex-col relative group",
                        isOwn ? "items-end" : "items-start"
                      )}
                      onMouseDown={(e) => startLongPress(e, message.id)}
                      onMouseMove={handleMove}
                      onMouseUp={stopLongPress}
                      onMouseLeave={stopLongPress}
                      onTouchStart={(e) => startLongPress(e, message.id)}
                      onTouchMove={handleMove}
                      onTouchEnd={stopLongPress}
                    >
                      {!isOwn && isFirstInGroup && (
                        <span className="text-[10px] font-bold text-slate-400 mb-1 ml-2 tracking-tight">
                          {message.senderName}
                        </span>
                      )}
                      
                      <div className="relative">
                        <div className={cn(
                          "px-4 py-2.5 text-sm font-medium transition-all duration-200 shadow-sm",
                          isOwn 
                            ? "bg-indigo-600 text-white" 
                            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700",
                          // Bubble corners logic
                          isOwn 
                            ? cn(
                                "rounded-[20px]",
                                isFirstInGroup && !isLastInGroup && "rounded-tr-md",
                                !isFirstInGroup && !isLastInGroup && "rounded-r-md",
                                !isFirstInGroup && isLastInGroup && "rounded-br-md"
                              )
                            : cn(
                                "rounded-[20px]",
                                isFirstInGroup && !isLastInGroup && "rounded-tl-md",
                                !isFirstInGroup && !isLastInGroup && "rounded-l-md",
                                !isFirstInGroup && isLastInGroup && "rounded-bl-md"
                              ),
                          activeActionId === message.id && "scale-[1.05] ring-4 ring-indigo-500/20 shadow-xl z-10"
                        )}>
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                          
                          {/* Reactions container */}
                          {message.reactions && Object.keys(message.reactions).length > 0 && (
                            <div className={cn(
                              "absolute -bottom-3 flex items-center gap-1 bg-white dark:bg-slate-700 rounded-full px-1.5 py-0.5 shadow-sm border border-slate-100 dark:border-slate-600 z-10",
                              isOwn ? "right-1" : "left-1"
                            )}>
                              {Object.entries(message.reactions).map(([emoji, uids]) => {
                                const count = (uids as string[]).length;
                                if (count === 0) return null;
                                return (
                                  <span key={emoji} className="flex items-center gap-0.5">
                                    <span className="text-[10px]">{emoji}</span>
                                    {count > 1 && <span className="text-[8px] font-bold text-slate-500 dark:text-slate-300">{count}</span>}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Quick Action Button (Desktop Only) */}
                        <div className={cn(
                          "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center gap-1 p-2",
                          isOwn ? "right-full mr-2" : "left-full ml-2"
                        )}>
                          <button 
                            onClick={() => setActiveActionId(message.id)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                          >
                            <Smile size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Message Context Menu */}
                      <AnimatePresence>
                        {activeActionId === message.id && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={cn(
                              "absolute z-50 bottom-full mb-3 bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl border border-slate-100 dark:border-slate-700 p-2 min-w-[220px]",
                              isOwn ? "right-0" : "left-0"
                            )}
                          >
                            <div className="flex items-center justify-around gap-1 px-1 mb-2">
                              {REACTIONS.map((r) => (
                                <button 
                                  key={r.emoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(message.id, r.emoji);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center text-xl hover:scale-125 transition-transform active:scale-95 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                  {r.emoji}
                                </button>
                              ))}
                            </div>

                            <div className="space-y-1 px-1">
                              {(isOwn || canManage) && (
                                <button 
                                  onClick={() => {
                                    handleDeleteMessage(message.id);
                                    setActiveActionId(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-2xl transition-colors text-left"
                                >
                                  <Trash2 size={16} />
                                  <span className="text-xs font-bold uppercase tracking-tight">Gỡ tin nhắn</span>
                                </button>
                              )}
                              <button 
                                onClick={() => setActiveActionId(null)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 rounded-2xl transition-colors text-left"
                              >
                                <X size={16} />
                                <span className="text-xs font-bold uppercase tracking-tight">Hủy bỏ</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {isLastInGroup && (
                        <div className={cn(
                          "flex items-center gap-1.5 mt-1 animate-in fade-in slide-in-from-top-1",
                          isOwn ? "mr-2 justify-end" : "ml-2 justify-start"
                        )}>
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600 lowercase tracking-tight">
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isOwn && (
                            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full flex items-center justify-center">
                              <Check size={6} className="text-white" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </React.Fragment>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <form 
          onSubmit={handleSendMessage}
          className="max-w-4xl mx-auto"
        >
          <div className="flex items-start gap-2">
            <div className="flex items-center gap-1 mt-1.5 px-1">
              <button type="button" className="p-2 text-slate-400 hover:text-indigo-500 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full">
                <ImageIcon size={20} />
              </button>
              <button type="button" className="p-2 text-slate-400 hover:text-indigo-500 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full">
                <Smile size={20} />
              </button>
            </div>
            
            <div className="flex-1 relative flex items-center group bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 transition-all focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/5">
              <textarea 
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Nhập nội dung tin nhắn..."
                rows={1}
                className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-medium py-3 px-5 dark:text-white resize-none no-scrollbar min-h-[44px] max-h-[120px]"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim() || isSending}
                className={cn(
                  "mr-1 p-2.5 rounded-2xl transition-all duration-300 transform active:scale-90 disabled:opacity-30 disabled:scale-100 disabled:bg-transparent",
                  newMessage.trim() 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 translate-x-0 opacity-100" 
                    : "text-slate-300 translate-x-2 opacity-0"
                )}
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
