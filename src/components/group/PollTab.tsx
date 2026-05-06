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

      const newOptions = poll.options.map(opt => {
        const isVoted = opt.voterIds.includes(userId);
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
    <div className="space-y-6">
      {isMember && (
        <button 
          onClick={onAddPoll}
          className="w-full p-4 bg-white dark:bg-gray-900 border border-dashed border-blue-200 dark:border-blue-900/50 rounded-3xl text-blue-600 dark:text-blue-400 font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] hover:bg-blue-50/30"
        >
          <Plus size={18} /> Tạo cuộc bình chọn mới
        </button>
      )}

      {polls.length === 0 ? (
        <EmptyState 
          icon={BarChart3} 
          title="Chưa có bình chọn" 
          message="Khởi tạo cuộc trưng cầu ý kiến thành viên tại đây."
          className="py-12"
        />
      ) : (
        <div className="space-y-6">
          {polls.map((poll) => {
            const totalVotes = poll.options.reduce((acc, opt) => acc + opt.voterIds.length, 0);
            const userVotedOptionIds = poll.options
              .filter(opt => opt.voterIds.includes(auth.currentUser?.uid || ''))
              .map(opt => opt.id);

            return (
              <motion.div 
                key={poll.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 rounded-[32px] p-6 shadow-sm border border-gray-100 dark:border-gray-800 transition-colors"
              >
                <div className="flex justify-between items-start gap-4 mb-6">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-lg italic uppercase tracking-tight dark:text-white leading-tight">
                      {poll.question}
                    </h4>
                    <div className="flex items-center gap-3 mt-2">
                       <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                         <Users size={10} /> {totalVotes} lượt bình chọn
                       </p>
                       <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                         <Clock size={10} /> {formatDate(poll.createdAt)}
                       </p>
                    </div>
                  </div>
                  {canManage && (
                    <button 
                      onClick={() => handleDeletePoll(poll.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {poll.options.map((option) => {
                    const isVoted = userVotedOptionIds.includes(option.id);
                    const percentage = totalVotes > 0 ? Math.round((option.voterIds.length / totalVotes) * 100) : 0;
                    const isVoting = votingId === `${poll.id}-${option.id}`;

                    return (
                      <button
                        key={option.id}
                        disabled={isVoting}
                        onClick={() => handleVote(poll.id, option.id)}
                        className={cn(
                          "w-full text-left relative group rounded-2xl p-4 border transition-all overflow-hidden",
                          isVoted 
                            ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20" 
                            : "bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white border-transparent hover:border-blue-200"
                        )}
                      >
                        {/* Progress Bar Background */}
                        {!isVoted && (
                          <div 
                            className="absolute inset-0 bg-blue-500/10 transition-all duration-1000"
                            style={{ width: `${percentage}%` }}
                          />
                        )}

                        <div className="relative flex justify-between items-center gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all",
                              isVoted ? "bg-white border-white text-blue-600" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                            )}>
                              {isVoted && <CheckCircle2 size={12} fill="currentColor" />}
                            </div>
                            <span className="font-bold text-sm tracking-tight">{option.text}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                             <span className={cn(
                               "text-[10px] font-black uppercase tracking-widest",
                               isVoted ? "text-white/80" : "text-gray-400"
                             )}>
                               {option.voterIds.length} phiếu
                             </span>
                             <span className={cn(
                               "text-xs font-black",
                               isVoted ? "text-white" : "text-blue-600"
                             )}>
                               {percentage}%
                             </span>
                          </div>
                        </div>

                        {/* Voter Avatars */}
                        {option.voterIds.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 relative z-10">
                            <div className="flex -space-x-2 overflow-hidden">
                              {option.voterIds.slice(0, 5).map(uid => {
                                const profile = memberProfiles.find(p => p.uid === uid);
                                return (
                                  <div 
                                    key={uid}
                                    title={profile?.displayName || 'Thành viên'}
                                    className="inline-block h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-900 bg-gray-100 dark:bg-gray-800 overflow-hidden"
                                  >
                                    {profile?.photoURL ? (
                                      <img src={profile.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="h-full w-full flex items-center justify-center text-[8px] font-bold text-gray-500">
                                        {profile?.displayName?.[0] || '?'}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {option.voterIds.length > 5 && (
                              <span className={cn(
                                "text-[8px] font-bold",
                                isVoted ? "text-white/60" : "text-gray-400"
                              )}>
                                +{option.voterIds.length - 5}
                              </span>
                            )}
                          </div>
                        )}

                        {isVoting && (
                          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-800 flex justify-between items-center">
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">
                     Bởi {poll.creatorName} {poll.createdBy === auth.currentUser?.uid && '(Bạn)'}
                   </p>
                   {poll.allowMultiple && (
                     <span className="text-[8px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                       Cho phép chọn nhiều
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
