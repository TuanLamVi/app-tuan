import React, { useState, useMemo } from 'react';
import { Transaction, UserProfile, Group, Campaign, Comment } from '../../models';
import { auth, db } from '../../lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { 
  ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle2, 
  XCircle, Trash2, Tag, User, ThumbsUp, MessageSquare, Send
} from 'lucide-react';
import { formatCurrency, cn, formatDate } from '../../core/utils';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { TransactionRepository } from '../../services/transactionService';

import { NotificationService } from '../../services/notificationService';

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

interface TransactionCardProps {
  transaction: Transaction;
  group: Group;
  memberProfiles: UserProfile[];
  campaigns: Campaign[];
  isAdmin: boolean;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({ transaction, group, memberProfiles, campaigns, isAdmin }) => {
  const [showReactions, setShowReactions] = useState(false);
  const [activeCommentReactionId, setActiveCommentReactionId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const creator = memberProfiles.find(p => p.uid === transaction.createdBy);
  const campaign = campaigns.find(c => c.id === transaction.campaignId);
  const isPending = transaction.status === 'pending';
  
  const repository = useMemo(() => new TransactionRepository(group.id), [group.id]);
  const docRef = doc(db, 'groups', group.id, 'transactions', transaction.id);
  const currentUser = auth.currentUser;

  const handleReaction = async (emoji: string) => {
    if (!currentUser) return;
    setShowReactions(false);

    const currentReactions = transaction.reactions || {};
    const userAlreadyReacted = Object.entries(currentReactions).find(([_, uids]) => (uids as string[]).includes(currentUser.uid));

    try {
      const newReactions = { ...currentReactions };
      if (userAlreadyReacted) {
        const [oldEmoji, uids] = userAlreadyReacted;
        newReactions[oldEmoji] = (uids as string[]).filter(id => id !== currentUser.uid);
        if (newReactions[oldEmoji].length === 0) delete newReactions[oldEmoji];
        if (oldEmoji === emoji) {
          await updateDoc(docRef, { reactions: newReactions });
          return;
        }
      }
      if (!newReactions[emoji]) newReactions[emoji] = [];
      newReactions[emoji] = [...(newReactions[emoji] as string[]), currentUser.uid];
      await updateDoc(docRef, { reactions: newReactions });
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}/transactions/${transaction.id}`);
    }
  };

  const handleCommentReaction = async (commentId: string, emoji: string) => {
    if (!currentUser) return;
    const currentComments = [...(transaction.comments || [])];
    const commentIndex = currentComments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;

    const comment = { ...currentComments[commentIndex] };
    const reactions = { ...(comment.reactions || {}) };
    const userAlreadyReacted = Object.entries(reactions).find(([_, uids]) => (uids as string[]).includes(currentUser.uid));

    if (userAlreadyReacted) {
      const [oldEmoji, uids] = userAlreadyReacted;
      reactions[oldEmoji] = (uids as string[]).filter(id => id !== currentUser.uid);
      if (reactions[oldEmoji].length === 0) delete reactions[oldEmoji];
      if (oldEmoji !== emoji) {
        reactions[emoji] = [...(reactions[emoji] || []), currentUser.uid];
      }
    } else {
      reactions[emoji] = [...(reactions[emoji] || []), currentUser.uid];
    }

    comment.reactions = reactions;
    currentComments[commentIndex] = comment;
    try {
      await updateDoc(docRef, { comments: currentComments });
      setActiveCommentReactionId(null);
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}/transactions/${transaction.id}`);
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
      await updateDoc(docRef, {
        comments: arrayUnion(newComment)
      });
      setCommentText('');
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}/transactions/${transaction.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const userReaction = currentUser ? Object.entries(transaction.reactions || {}).find(([_, uids]) => (uids as string[]).includes(currentUser.uid))?.[0] : null;
  const totalReactions = (Object.values(transaction.reactions || {}) as string[][]).reduce((acc: number, curr: string[]) => acc + curr.length, 0);

  const handleApprove = async () => {
    if (!isAdmin) {
      toast.error('Bạn không có quyền thực hiện hành động này');
      return;
    }
    try {
      await toast.promise(
        repository.approveProposal(transaction.id, transaction),
        {
          loading: 'Đang phê duyệt...',
          success: 'Đã duyệt giao dịch',
          error: 'Lỗi khi phê duyệt'
        }
      );
      
      await NotificationService.sendNotification(transaction.createdBy, {
        title: 'Giao dịch được duyệt',
        message: `Giao dịch "${transaction.category}" của bạn trong nhóm "${group.name}" đã được phê duyệt.`,
        type: 'approval',
        category: 'finance',
        data: { groupId: group.id, transactionId: transaction.id }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}/transactions/${transaction.id}`);
    }
  };

  const handleReject = async () => {
    if (!isAdmin) return;
    try {
      await repository.rejectProposal(transaction.id);

      await NotificationService.sendNotification(transaction.createdBy, {
        title: 'Giao dịch bị từ chối',
        message: `Giao dịch "${transaction.category}" của bạn trong nhóm "${group.name}" đã bị từ chối.`,
        type: 'approval',
        category: 'finance',
        data: { groupId: group.id, transactionId: transaction.id }
      });

      toast.success('Đã từ chối giao dịch');
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}/transactions/${transaction.id}`);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) return;
    if (!window.confirm('Xóa giao dịch này? (Lưu ý: Hành động này KHÔNG hoàn lại số dư đã thay đổi)')) return;
    try {
      await repository.deleteTransaction(transaction.id);
      toast.success('Đã xóa giao dịch');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${group.id}/transactions/${transaction.id}`);
    }
  };

  return (
    <div className={cn(
      "bg-white dark:bg-gray-800 rounded-3xl border p-4 flex gap-4 transition-all hover:bg-gray-50/50 dark:hover:bg-gray-700/50",
      isPending ? "border-orange-100 dark:border-orange-900/30" : "border-gray-100 dark:border-gray-700 shadow-sm"
    )}>
      <div 
        onClick={() => setShowComments(!showComments)}
        className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-transform active:scale-95",
          transaction.type === 'income' ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
        )}
      >
        {transaction.type === 'income' ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
      </div>

      <div className="flex-1 min-w-0">
        <div 
          onClick={() => setShowComments(!showComments)}
          className="cursor-pointer group/content"
        >
          <div className="flex justify-between items-start mb-1">
            <h5 className="font-bold text-gray-900 dark:text-white truncate pr-2 group-hover/content:text-blue-600 transition-colors">{transaction.category}</h5>
            <span className={cn(
              "font-black text-sm",
              transaction.type === 'income' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {campaign && (
              <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider">
                <Tag size={10} /> {campaign.name}
              </span>
            )}
            {isPending && (
               <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider flex items-center gap-1">
                 <Clock size={10} /> Đang chờ duyệt
               </span>
            )}
            {transaction.status === 'rejected' && (
               <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider">Từ chối</span>
            )}
          </div>

          {transaction.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">
              {transaction.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <div 
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-5 h-5 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
               {creator?.photoURL ? <img src={creator.photoURL} alt="" referrerPolicy="no-referrer" /> : <User size={10} className="text-gray-400 dark:text-gray-500" />}
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">{creator?.displayName || 'Thành viên'}</span>
            <span className="w-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">{formatDate(transaction.createdAt)}</span>
          </div>
          
          <div className="flex items-center gap-1">
            {isAdmin && isPending ? (
              <div className="flex gap-2">
                <button 
                  onClick={handleReject}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="Từ chối"
                >
                  <XCircle size={18} />
                </button>
                <button 
                  onClick={handleApprove}
                  className="p-1.5 text-green-600 hover:scale-110 active:scale-95 transition-all"
                  title="Duyệt"
                >
                  <CheckCircle2 size={18} />
                </button>
              </div>
            ) : isAdmin && (
              <button onClick={handleDelete} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Social Bar */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
           <div className="relative">
              <button 
                onMouseEnter={() => setShowReactions(true)}
                onClick={() => userReaction ? handleReaction(userReaction) : handleReaction('👍')}
                className={cn(
                  "flex items-center gap-1.5 transition-all",
                  userReaction ? "text-blue-600 dark:text-blue-400" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <span className="text-sm">{userReaction || <ThumbsUp size={14} />}</span>
                {totalReactions > 0 && <span className="text-[10px] font-black">{totalReactions}</span>}
              </button>

              <AnimatePresence>
                {showReactions && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10 }}
                    onMouseLeave={() => setShowReactions(false)}
                    className="absolute bottom-full left-0 mb-2 bg-white rounded-full shadow-xl border border-gray-100 flex p-1 gap-1 z-40"
                  >
                    {REACTIONS.map((r) => (
                      <button 
                        key={r.emoji}
                        onClick={() => handleReaction(r.emoji)}
                        className="w-8 h-8 flex items-center justify-center text-xl hover:scale-125 transition-transform active:scale-90"
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
               "flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-all",
               (transaction.comments?.length || 0) > 0 && "text-blue-600 dark:text-blue-400"
             )}
           >
             <MessageSquare size={14} />
             {(transaction.comments?.length || 0) > 0 && <span className="text-[10px] font-black">{transaction.comments?.length}</span>}
           </button>
        </div>

        {/* Comments Section */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-3 pb-2">
                {transaction.comments?.map(comment => {
                  const commentUserReaction = currentUser ? Object.entries(comment.reactions || {}).find(([_, uids]) => (uids as string[]).includes(currentUser.uid))?.[0] : null;
                  const commentTotalReactions = (Object.values(comment.reactions || {}) as string[][]).reduce((acc: number, curr: string[]) => acc + curr.length, 0);

                  return (
                    <div key={comment.id} className="flex gap-2">
                      <div className="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center text-[8px] font-black text-gray-400">
                        {comment.userName?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="relative inline-block max-w-full">
                          <div className="bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-2xl rounded-tl-none text-[11px] text-gray-700 dark:text-gray-200">
                            <span className="font-black mr-1">{comment.userName}</span>
                            {comment.content}
                          </div>
                          {commentTotalReactions > 0 && (
                            <div className="absolute -bottom-1.5 -right-1.5 flex items-center gap-0.5">
                               {Object.keys(comment.reactions || {}).map(emoji => (
                                 <span key={emoji} className="text-[10px]">{emoji}</span>
                               ))}
                               {commentTotalReactions > 1 && <span className="text-[8px] font-black text-gray-400">{commentTotalReactions}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 ml-1">
                           <span className="text-[8px] text-gray-400 font-bold uppercase">{formatTimestamp(comment.createdAt)}</span>
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
                                      className="w-6 h-6 flex items-center justify-center text-sm hover:scale-125 transition-transform active:scale-90"
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
                
                <form onSubmit={handleAddComment} className="relative mt-2">
                  <input 
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Bình luận..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl pl-3 pr-8 py-2 text-[11px] focus:ring-0 focus:outline-none font-medium text-gray-900 dark:text-white"
                  />
                  <button 
                    type="submit"
                    disabled={!commentText.trim() || isSubmitting}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-blue-600 dark:text-blue-400 disabled:text-gray-300 transition-colors"
                  >
                    <Send size={12} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TransactionCard;
