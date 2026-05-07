import React, { useState } from 'react';
import { Announcement, Comment, UserProfile } from '../../models';
import { auth, db } from '../../lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { MessageSquare, ThumbsUp, Send, MoreHorizontal, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '../../core/utils';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';

interface AnnouncementCardProps {
  key?: React.Key;
  announcement: Announcement;
  groupId: string;
  memberProfiles: UserProfile[];
  isOwnerOrDeputy: boolean;
  onDelete?: (id: string) => void;
}

const REACTIONS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '🥰', label: 'Care' },
  { emoji: '😆', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
];

const formatTimestamp = (date: any) => {
  if (!date) return '';
  const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
  return formatDistanceToNow(d, { addSuffix: true, locale: vi });
};

export default function AnnouncementCard({ 
  announcement, 
  groupId, 
  memberProfiles, 
  isOwnerOrDeputy,
  onDelete 
}: AnnouncementCardProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [activeCommentReactionId, setActiveCommentReactionId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const creator = (memberProfiles || []).find(p => p.uid === announcement.createdBy);
  const currentUser = auth.currentUser;

  const handleReaction = async (emoji: string) => {
    if (!currentUser) return;
    setShowReactions(false);

    const currentReactions = announcement.reactions || {};
    const userAlreadyReacted = Object.entries(currentReactions).find(([_, uids]) => (uids as string[] || []).includes(currentUser.uid));

    try {
      const docRef = doc(db, 'groups', groupId, 'announcements', announcement.id);
      
      const newReactions = { ...currentReactions };

      // Remove existing reaction if it's the same emoji (toggle off)
      if (userAlreadyReacted) {
        const [oldEmoji, uids] = userAlreadyReacted;
        newReactions[oldEmoji] = (uids as string[]).filter(id => id !== currentUser.uid);
        if (newReactions[oldEmoji].length === 0) delete newReactions[oldEmoji];
        
        // If clicking same emoji, just remove and stop
        if (oldEmoji === emoji) {
          await updateDoc(docRef, { reactions: newReactions });
          return;
        }
      }

      // Add new reaction
      if (!newReactions[emoji]) newReactions[emoji] = [];
      const emojiList = [...(newReactions[emoji] as string[])];
      emojiList.push(currentUser.uid);
      newReactions[emoji] = emojiList;

      await updateDoc(docRef, { reactions: newReactions });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/announcements/${announcement.id}`);
    }
  };

  const handleCommentReaction = async (commentId: string, emoji: string) => {
    if (!currentUser) return;

    const currentComments = [...(announcement.comments || [])];
    const commentIndex = currentComments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;

    const comment = { ...currentComments[commentIndex] };
    const reactions = { ...(comment.reactions || {}) };
    
    const userAlreadyReacted = Object.entries(reactions).find(([_, uids]) => (uids as string[] || []).includes(currentUser.uid));

    if (userAlreadyReacted) {
      const [oldEmoji, uids] = userAlreadyReacted;
      reactions[oldEmoji] = (uids as string[]).filter(id => id !== currentUser.uid);
      if (reactions[oldEmoji].length === 0) delete reactions[oldEmoji];
      
      if (oldEmoji !== emoji) {
        if (!reactions[emoji]) reactions[emoji] = [];
        reactions[emoji] = [...reactions[emoji], currentUser.uid];
      }
    } else {
      if (!reactions[emoji]) reactions[emoji] = [];
      reactions[emoji] = [...reactions[emoji], currentUser.uid];
    }

    comment.reactions = reactions;
    currentComments[commentIndex] = comment;

    try {
      const docRef = doc(db, 'groups', groupId, 'announcements', announcement.id);
      await updateDoc(docRef, { comments: currentComments });
      setActiveCommentReactionId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/announcements/${announcement.id}`);
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

      const path = `groups/${groupId}/announcements/${announcement.id}`;
      const docRef = doc(db, path);
      await updateDoc(docRef, {
        comments: arrayUnion(newComment)
      });
      setCommentText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/announcements/${announcement.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa bản tin này?')) return;
    onDelete?.(announcement.id);
  };

  const userReaction = currentUser ? Object.entries(announcement.reactions || {}).find(([_, uids]) => (uids as string[] || []).includes(currentUser.uid))?.[0] : null;
  const totalReactions = Object.values(announcement.reactions || {}).reduce((acc, curr) => acc + (curr as string[] || []).length, 0);

    const isNew = announcement.createdAt && (new Date().getTime() - announcement.createdAt.getTime() < 24 * 60 * 60 * 1000);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-4 relative transition-all hover:shadow-md">
      {isNew && (
        <div className="absolute top-6 right-6 z-10">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-full shadow-lg shadow-red-500/20">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-white text-[8px] font-black uppercase tracking-tight">Mới</span>
          </div>
        </div>
      )}
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div 
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-4 cursor-pointer group"
          >
            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
              {creator?.photoURL ? (
                <img src={creator.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl">
                  {creator?.displayName?.charAt(0) || 'A'}
                </div>
              )}
            </div>
            <div>
              <h5 className="text-base font-black text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors font-display tracking-tight">{creator?.displayName || 'Người quản lý'}</h5>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest leading-none mt-1">
                {formatTimestamp(announcement.createdAt)}
              </p>
            </div>
          </div>
          {isOwnerOrDeputy && (
            <button 
              onClick={handleDelete} 
              className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {/* Content - Click to toggle comments */}
        <div 
          onClick={() => setShowComments(!showComments)}
          className="cursor-pointer group mb-6"
        >
          <h4 className="text-xl font-black text-gray-900 dark:text-white mb-3 leading-tight font-display tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {announcement.title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{announcement.content}</p>
        </div>

        {/* Stats & Interactivity */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-50 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className="relative group/react">
              <button 
                onMouseEnter={() => setShowReactions(true)}
                onClick={() => userReaction ? handleReaction(userReaction) : handleReaction('👍')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
                  userReaction 
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" 
                    : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                <span className="text-lg leading-none">{userReaction || <ThumbsUp size={14} />}</span>
                <span>{totalReactions || 'Tương tác'}</span>
              </button>

              <AnimatePresence>
                {showReactions && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10 }}
                    onMouseLeave={() => setShowReactions(false)}
                    className="absolute bottom-full left-0 mb-3 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 p-2 flex gap-2 z-40"
                  >
                    {REACTIONS.map((r) => (
                      <button 
                        key={r.emoji}
                        onClick={() => handleReaction(r.emoji)}
                        className="w-10 h-10 flex items-center justify-center text-2xl hover:scale-125 transition-transform active:scale-95 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-2xl"
                      >
                        {r.emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => setShowComments(!showComments)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
                (announcement.comments?.length || 0) > 0
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <MessageSquare size={14} />
              <span>{announcement.comments?.length || 0}</span>
            </button>
          </div>
          
          {totalReactions > 0 && (
            <div className="flex -space-x-1.5 overflow-hidden">
               {Object.keys(announcement.reactions || {}).slice(0, 3).map(emoji => (
                 <div key={emoji} className="w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] shadow-sm">
                   {emoji}
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-50 dark:border-gray-800"
          >
            <div className="bg-gray-50/50 dark:bg-gray-800/30 p-5">
              <div className="space-y-4 mb-4">
                {announcement.comments?.map(comment => {
              const commentUserReaction = currentUser ? Object.entries(comment.reactions || {}).find(([_, uids]) => (uids as string[] || []).includes(currentUser.uid))?.[0] : null;
              const commentTotalReactions = Object.values(comment.reactions || {}).reduce((acc, curr) => acc + (curr as string[] || []).length, 0);

              return (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 bg-white dark:bg-gray-700 rounded-lg flex-shrink-0 border border-gray-100 dark:border-gray-600 shadow-sm overflow-hidden flex items-center justify-center">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 capitalize">{comment.userName?.charAt(0)}</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="relative inline-block max-w-full text-left">
                      <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm inline-block w-full">
                        <h6 className="text-[10px] font-black text-gray-900 dark:text-white mb-0.5">{comment.userName}</h6>
                        <p className="text-xs text-gray-600 dark:text-gray-200 leading-relaxed break-words">{comment.content}</p>
                      </div>
                      
                      {commentTotalReactions > 0 && (
                        <div className="absolute -bottom-2 -right-2 flex items-center gap-0.5 px-1">
                          {Object.keys(comment.reactions || {}).map(emoji => (
                            <span key={emoji} className="text-[10px]">{emoji}</span>
                          ))}
                          {commentTotalReactions > 1 && <span className="text-[8px] font-black text-gray-400 dark:text-gray-500 ml-0.5">{commentTotalReactions}</span>}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 ml-1 relative">
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-tight">
                        {formatTimestamp(comment.createdAt)}
                      </p>
                      
                      <div className="relative">
                        <button 
                          onMouseEnter={() => setActiveCommentReactionId(comment.id)}
                          onClick={() => handleCommentReaction(comment.id, commentUserReaction || '❤️')}
                          className={cn(
                            "transition-all duration-300 flex items-center",
                            commentUserReaction 
                              ? "opacity-100 scale-110 grayscale-0" 
                              : "opacity-20 grayscale hover:opacity-60 hover:grayscale-0"
                          )}
                        >
                          <span className="text-[10px]">{commentUserReaction || '❤️'}</span>
                        </button>

                        <AnimatePresence>
                          {activeCommentReactionId === comment.id && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.8 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10 }}
                              onMouseLeave={() => setActiveCommentReactionId(null)}
                              className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-100 dark:border-gray-700 flex p-1 gap-1 z-40 transform origin-bottom-left"
                            >
                              {REACTIONS.map((r) => (
                                <button 
                                  key={r.emoji}
                                  onClick={() => handleCommentReaction(comment.id, r.emoji)}
                                  className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-90"
                                >
                                  {r.emoji}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleAddComment} className="relative">
            <input 
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Viết bình luận..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl pl-4 pr-12 py-3 text-xs focus:ring-0 focus:outline-none font-medium text-gray-900 dark:text-white shadow-sm transition-all"
            />
            <button 
              type="submit"
              disabled={!commentText.trim() || isSubmitting}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 dark:text-blue-400 disabled:text-gray-300 dark:disabled:text-gray-600 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>
);
}
