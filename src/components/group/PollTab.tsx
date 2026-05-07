import React, { useEffect, useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  doc, updateDoc, arrayUnion, arrayRemove, deleteDoc 
} from 'firebase/firestore';
import { Poll, PollOption, UserProfile } from '../../models';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, Plus, Clock, Users, Trash2, 
  CheckCircle2, Info, ChevronRight, BarChart
} from 'lucide-react';
import { cn, formatDate } from '../../core/utils';
import { toast } from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';

interface PollTabProps {
  groupId: string;
  canManage: boolean;
  isMember: boolean;
  memberProfiles: UserProfile[];
  onAddPoll: () => void;
}

export default function PollTab({ groupId, canManage, isMember, memberProfiles, onAddPoll }: PollTabProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'groups', groupId, 'polls'), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPolls = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        expiresAt: doc.data().expiresAt?.toDate() || null,
      } as Poll));
      setPolls(fetchedPolls);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `groups/${groupId}/polls`);
    });

    return () => unsubscribe();
  }, [groupId]);

  const handleVote = async (pollId: string, optionId: string) => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    
    setVotingId(`${pollId}-${optionId}`);
    try {
      const poll = polls.find(p => p.id === pollId);
      if (!poll) return;

      const newOptions = (poll.options || []).map(opt => {
        const isVoted = (opt.voterIds || []).includes(userId);
        const isTarget = opt.id === optionId;

        // If user already voted for this option, remove it (toggle)
        if (isTarget && isVoted) {
          return { ...opt, voterIds: opt.voterIds.filter(id => id !== userId) };
        }
        
        // If it's the target and not voted, add it
        if (isTarget && !isVoted) {
          return { ...opt, voterIds: [...opt.voterIds, userId] };
        }

        // If not allowing multiple, remove vote from other options
        if (!poll.allowMultiple && isVoted && !isTarget) {
          return { ...opt, voterIds: opt.voterIds.filter(id => id !== userId) };
        }

        return opt;
      });

      await updateDoc(doc(db, 'groups', groupId, 'polls', pollId), {
        options: newOptions
      });
      
      toast.success('Đã ghi nhận bình chọn');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/polls/${pollId}`);
    } finally {
      setVotingId(null);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!canManage) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa cuộc bình chọn này?')) return;

    try {
      await deleteDoc(doc(db, 'groups', groupId, 'polls', pollId));
      toast.success('Đã xóa cuộc bình chọn');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/polls/${pollId}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-[32px]" />
        <Skeleton className="h-48 rounded-[32px]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {isMember && (
        <button 
          onClick={onAddPoll}
          className="w-full p-6 bg-white dark:bg-slate-900 border border-dashed border-indigo-200 dark:border-slate-800 rounded-[32px] text-indigo-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm transition-all active:scale-[0.95] hover:bg-indigo-50/30"
        >
          <Plus size={18} /> Tạo cuộc bình chọn mới
        </button>
      )}

      {polls.length === 0 ? (
        <EmptyState 
          icon={BarChart3} 
          title="Chưa có bình chọn" 
          message="Khởi tạo cuộc trưng cầu ý kiến thành viên tại đây."
          className="py-20"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {polls.map((poll) => {
            const pollOptions = poll.options || [];
            const totalVotes = pollOptions.reduce((acc, opt) => acc + (opt.voterIds || []).length, 0);
            const userVotedOptionIds = pollOptions
              .filter(opt => (opt.voterIds || []).includes(auth.currentUser?.uid || ''))
              .map(opt => opt.id);

            return (
              <motion.div 
                key={poll.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col h-full text-left"
              >
                <div className="flex justify-between items-start gap-4 mb-8">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-xl italic uppercase tracking-tighter dark:text-white leading-tight">
                      {poll.question}
                    </h4>
                    <div className="flex items-center gap-4 mt-3">
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                         <Users size={14} className="text-indigo-500" /> {totalVotes} VOTES
                       </p>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                         <Clock size={14} /> {formatDate(poll.createdAt)}
                       </p>
                    </div>
                  </div>
                  {canManage && (
                    <button 
                      onClick={() => handleDeletePoll(poll.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-all border border-slate-100 dark:border-slate-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="space-y-4 flex-1">
                  {pollOptions.map((option) => {
                    const isVoted = userVotedOptionIds.includes(option.id);
                    const percentage = totalVotes > 0 ? Math.round(((option.voterIds || []).length / totalVotes) * 100) : 0;
                    const isVoting = votingId === `${poll.id}-${option.id}`;

                    return (
                      <button
                        key={option.id}
                        disabled={isVoting}
                        onClick={() => handleVote(poll.id, option.id)}
                        className={cn(
                          "w-full text-left relative group rounded-2xl p-5 border transition-all overflow-hidden",
                          isVoted 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-500/20" 
                            : "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-transparent hover:border-indigo-200"
                        )}
                      >
                        {/* Progress Bar Background */}
                        {!isVoted && (
                          <div 
                            className="absolute inset-0 bg-indigo-500/10 transition-all duration-1000"
                            style={{ width: `${percentage}%` }}
                          />
                        )}

                        <div className="relative flex justify-between items-center gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all",
                              isVoted ? "bg-white border-white text-indigo-600 shadow-sm" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            )}>
                              {isVoted && <CheckCircle2 size={14} fill="currentColor" />}
                            </div>
                            <span className="font-bold text-sm tracking-tight">{option.text}</span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                             <span className={cn(
                               "text-[10px] font-black uppercase tracking-[0.2em]",
                               isVoted ? "text-indigo-100" : "text-slate-400"
                             )}>
                               {(option.voterIds || []).length} P
                             </span>
                             <span className={cn(
                               "text-sm font-black italic mono",
                               isVoted ? "text-white" : "text-indigo-600"
                             )}>
                               {percentage}%
                             </span>
                          </div>
                        </div>

                        {/* Voter Avatars */}
                        {(option.voterIds || []).length > 0 && (
                          <div className="mt-3 flex items-center gap-2 relative z-10">
                            <div className="flex -space-x-2 overflow-hidden">
                              {(option.voterIds || []).slice(0, 5).map(uid => {
                                const profile = (memberProfiles || []).find(p => p.uid === uid);
                                return (
                                  <div 
                                    key={uid}
                                    className="inline-block h-6 w-6 rounded-lg ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 overflow-hidden"
                                  >
                                    {profile?.photoURL ? (
                                      <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="h-full w-full flex items-center justify-center text-[10px] font-black text-slate-400">
                                        {profile?.displayName?.[0] || '?'}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {option.voterIds.length > 5 && (
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest",
                                isVoted ? "text-white/60" : "text-slate-400"
                              )}>
                                +{option.voterIds.length - 5} MORE
                              </span>
                            )}
                          </div>
                        )}

                        {isVoting && (
                          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                   <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] italic">
                     By {poll.creatorName} {poll.createdBy === auth.currentUser?.uid ? '(YOU)' : ''}
                   </p>
                   {poll.allowMultiple && (
                     <span className="text-[8px] font-black uppercase tracking-[0.3em] text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-800/50">
                       MULTIPLE SELECTION
                     </span>
                   )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
