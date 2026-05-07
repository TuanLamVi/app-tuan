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
  MoreVertical, MessageCircle, Clock, Maximize2, Minimize2, X, ThumbsUp
} from 'lucide-react';

const REACTIONS = [
  { emoji: '👍', label: 'Thích' },
  { emoji: '❤️', label: 'Yêu' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Buồn' },
  { emoji: '🔥', label: 'Lửa' }
];
import { cn, formatDate } from '../../core/utils';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import Skeleton from '../ui/Skeleton';

interface ChatTabProps {
  groupId: string;
  canManage: boolean;
}

export default function ChatTab({ groupId, canManage }: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
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
      "flex flex-col bg-white dark:bg-gray-900 overflow-hidden transition-all duration-300",
      isFullScreen 
        ? "fixed inset-0 z-[60] h-full rounded-0" 
        : "h-[600px] rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm relative"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
            <MessageCircle size={20} />
          </div>
          <div>
            <p className="text-sm font-black uppercase italic tracking-tight dark:text-white">Trò chuyện nhóm</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{messages.length} tin nhắn</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-500"
            title={isFullScreen ? "Thu nhỏ" : "Phóng to"}
          >
            {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          {isFullScreen && (
            <button 
              onClick={() => setIsFullScreen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <X size={20} className="dark:text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Messages list */}
      <div 
        ref={scrollRef}
        onClick={() => activeActionId && setActiveActionId(null)}
        className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar scroll-smooth touch-pan-y"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <MessageCircle size={32} />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest italic">Hãy bắt đầu câu chuyện!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const isOwn = message.senderId === auth.currentUser?.uid;
              const prevMessage = messages[index - 1];
              const nextMessage = messages[index + 1];
              
              // A message is first in a group if:
              // 1. It's the first message ever
              // 2. Different sender from previous
              // 3. Same sender but > 1 minute gap
              const isFirstInGroup = !prevMessage || 
                                    prevMessage.senderId !== message.senderId || 
                                    (message.createdAt.getTime() - prevMessage.createdAt.getTime() > 60000);

              // A message is last in a group if:
              // 1. It's the last message ever
              // 2. Different sender for next
              // 3. Same sender but > 1 minute gap
              const isLastInGroup = !nextMessage || 
                                   nextMessage.senderId !== message.senderId || 
                                   (nextMessage.createdAt.getTime() - message.createdAt.getTime() > 60000);

              return (
                <motion.div 
                  key={message.id}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={cn(
                    "flex gap-3 max-w-[90%]",
                    isOwn ? "flex-row-reverse self-end" : "flex-row self-start",
                    !isFirstInGroup ? "-mt-2" : "mt-2"
                  )}
                >
                  {/* Avatar */}
                  {!isOwn && isFirstInGroup ? (
                    <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 mt-1">
                      {message.senderPhoto ? (
                        <img src={message.senderPhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <User size={14} />
                        </div>
                      )}
                    </div>
                  ) : (
                    !isOwn && <div className="w-8 flex-shrink-0" />
                  )}

                  <div 
                    className={cn(
                      "flex flex-col relative",
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
                      <span className="text-[10px] font-black uppercase text-gray-500 mb-1 ml-1 tracking-tight">
                        {message.senderName}
                      </span>
                    )}
                    
                    <div className={cn(
                      "relative group px-4 py-2.5 rounded-2xl text-sm font-medium transition-all shadow-sm",
                      isOwn 
                        ? cn("bg-blue-600 text-white", isFirstInGroup ? "rounded-tr-none" : "rounded-tr-2xl") 
                        : cn("bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700", isFirstInGroup ? "rounded-tl-none" : "rounded-tl-2xl"),
                      activeActionId === message.id && "scale-[1.02] ring-2 ring-blue-500/20 shadow-lg z-10"
                    )}>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                      
                      {/* Floating Quick Reaction (Outside Bubble) */}
                      <div className={cn(
                        "absolute -bottom-2 -right-1 flex items-center gap-1 z-10 transition-all",
                        activeActionId === message.id && "scale-110"
                      )}>
                        {/* Heart Quick React */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReaction(message.id, '❤️');
                          }}
                          className={cn(
                            "transition-all duration-300 flex items-center",
                            message.reactions?.['❤️']?.includes(auth.currentUser?.uid || '')
                              ? "opacity-100 scale-110 grayscale-0" 
                              : "opacity-20 grayscale hover:opacity-60 hover:grayscale-0"
                          )}
                        >
                          <span className="text-[10px]">❤️</span>
                          {message.reactions?.['❤️']?.length > 0 && (
                            <span className="text-[8px] font-black tabular-nums ml-0.5 text-gray-400 dark:text-gray-500">
                              {message.reactions['❤️'].length}
                            </span>
                          )}
                        </button>

                        {/* Other active reactions */}
                        {message.reactions && Object.entries(message.reactions).map(([emoji, uids]) => {
                          const count = (uids as string[]).length;
                          if (emoji === '❤️' || count === 0) return null;
                          const hasReacted = (uids as string[]).includes(auth.currentUser?.uid || '');
                          
                          return (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReaction(message.id, emoji);
                              }}
                              className={cn(
                                "flex items-center gap-0.5 transition-all duration-300",
                                hasReacted ? "opacity-100" : "opacity-80"
                              )}
                            >
                              <span className="text-[10px]">{emoji}</span>
                              <span className="text-[8px] font-black tabular-nums text-gray-500 dark:text-gray-400">
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      
                      {(isOwn || canManage) && (
                        <button 
                          onClick={() => handleDeleteMessage(message.id)}
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex",
                            isOwn ? "-left-10" : "-right-10"
                          )}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}

                      {/* Long press action menu */}
                      <AnimatePresence>
                        {activeActionId === message.id && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={cn(
                              "absolute z-50 bottom-full mb-2 bg-white dark:bg-gray-800 rounded-[24px] shadow-2xl border border-gray-100 dark:border-gray-700 p-2 min-w-[200px]",
                              isOwn ? "right-0" : "left-0"
                            )}
                          >
                            {/* Reactions Picker */}
                            <div className="flex items-center gap-1 border-b border-gray-100 dark:border-gray-700 pb-2 mb-1 px-1">
                              {REACTIONS.map((r) => (
                                <button 
                                  key={r.emoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(message.id, r.emoji);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-95 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700"
                                  title={r.label}
                                >
                                  {r.emoji}
                                </button>
                              ))}
                            </div>

                            <div className="flex flex-col gap-1">
                              {(isOwn || canManage) && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMessage(message.id);
                                    setActiveActionId(null);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-xl transition-colors"
                                >
                                  <Trash2 size={14} />
                                  <span className="text-[10px] font-black uppercase tracking-tight">Thu hồi tin nhắn</span>
                                </button>
                              )}
                              
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionId(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 rounded-xl transition-colors"
                              >
                                <X size={14} />
                                <span className="text-[10px] font-black uppercase tracking-tight">Hủy</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {isLastInGroup && (
                      <span className={cn(
                        "text-[8px] font-bold text-gray-400 mt-1 flex items-center gap-1",
                        isOwn ? "mr-1" : "ml-1"
                      )}>
                        <Clock size={8} /> {formatDate(message.createdAt)}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Input area */}
      <form 
        onSubmit={handleSendMessage}
        className={cn(
          "p-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 transition-all",
          isFullScreen && "pb-[env(safe-area-inset-bottom,16px)]"
        )}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-2 bg-white dark:bg-gray-900 rounded-2xl p-2 pl-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <textarea 
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              // Auto-expand height
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder="Nhập tin nhắn..."
            rows={1}
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none shadow-none text-sm font-medium py-2 dark:text-white resize-none no-scrollbar min-h-[40px] max-h-[150px]"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className={cn(
              "p-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50",
              newMessage.trim() ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
            )}
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
