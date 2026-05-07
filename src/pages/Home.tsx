import React, { useEffect, useState, useMemo } from 'react';
import { useGroups } from '../hooks/useGroups';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { 
  Plus, Users, Wallet, ChevronRight, LayoutGrid, Sparkles, 
  Check, X, Bell, Pin, PinOff, GripVertical, Crown, MessageCircle 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { 
  collectionGroup, query, where, getDocs, doc, getDoc, 
  updateDoc, arrayUnion, arrayRemove, deleteDoc, collection, onSnapshot, limit 
} from 'firebase/firestore';
import { formatCurrency, cn } from '../core/utils';
import EmptyState from '../components/ui/EmptyState';
import { GroupCardSkeleton } from '../components/ui/Skeleton';
import { toast } from 'react-hot-toast';
import { handleFirestoreError, OperationType, useAuth } from '../hooks/useAuth';
import { Group } from '../models';

const GroupUnreadBadge = ({ groupId, lastReadAt }: { groupId: string, lastReadAt: any }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fallback if lastReadAt is missing: count messages from the last 7 days
    const fallbackDate = new Date();
    fallbackDate.setDate(fallbackDate.getDate() - 7);
    
    const lastReadDate = lastReadAt?.toDate ? lastReadAt.toDate() : (lastReadAt instanceof Date ? lastReadAt : fallbackDate);

    const q = query(
      collection(db, 'groups', groupId, 'messages'),
      where('createdAt', '>', lastReadDate),
      limit(21)
    );

    const unsub = onSnapshot(q, (snap) => {
      // Filter out messages sent by the current user to avoid self-notifying
      const count = snap.docs.filter(d => d.data().senderId !== auth.currentUser?.uid).length;
      setUnreadCount(count);
    }, (error) => {
      console.warn("Unread count listener error:", error);
    });

    return unsub;
  }, [groupId, lastReadAt]);

  if (unreadCount === 0) return null;

  return (
    <div className="bg-red-500 text-white text-xs font-black min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(239,68,68,0.3)] animate-in zoom-in duration-300 shrink-0">
      {unreadCount >= 20 ? '9+' : unreadCount}
    </div>
  );
};

export default function Home() {
  const { groups: rawGroups, loading: groupsLoading } = useGroups();
  const { profile, loading: authLoading } = useAuth();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [invitingGroups, setInvitingGroups] = useState<Record<string, any>>({});
  const [orderedGroups, setOrderedGroups] = useState<Group[]>([]);

  const loading = groupsLoading || authLoading;

  // Process and sort groups based on pins and manual order
  useEffect(() => {
    if (rawGroups.length > 0) {
      const pinnedIds = profile?.pinnedGroupIds || [];
      const manualOrder = profile?.groupOrder || [];

      const sorted = [...rawGroups].sort((a, b) => {
        const aPinned = pinnedIds.includes(a.id);
        const bPinned = pinnedIds.includes(b.id);

        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        // If both same pin status, use manual order or fallback to createdAt
        const aIdx = manualOrder.indexOf(a.id);
        const bIdx = manualOrder.indexOf(b.id);

        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;

        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      setOrderedGroups(sorted);
    } else {
      setOrderedGroups([]);
    }
  }, [rawGroups, profile?.pinnedGroupIds, profile?.groupOrder]);

  useEffect(() => {
    if (!auth.currentUser || loading) return;
    const user = auth.currentUser;

    // 1. Real-time invitations from requests subcollection
    const qInvitations = query(
      collectionGroup(db, 'requests'), 
      where('uid', '==', user.uid),
      where('status', '==', 'invited')
    );

    const unsubInvitations = onSnapshot(qInvitations, async (snap) => {
      try {
        const invs = snap.docs.map(d => ({ id: d.id, ...d.data(), ref: d.ref }));
        
        // 2. Groups where user's email/phone is in pendingInvites
        const pendingEmailInvs: any[] = [];
        if (user.email) {
          try {
            const qEmail = query(collection(db, 'groups'), where('pendingInvites', 'array-contains', user.email));
            const snapEmail = await getDocs(qEmail);
            snapEmail.docs.forEach(d => {
              const data = d.data();
              if (!data.members?.includes(user.uid)) {
                pendingEmailInvs.push({
                  id: `pending-${d.id}`,
                  groupId: d.id,
                  type: 'pendingInvite',
                  identifier: user.email,
                  isPendingInvite: true
                });
              }
            });
          } catch (e) {
            console.warn('Could not fetch email invitations:', e);
          }
        }
        
        if (user.phoneNumber) {
          try {
             const qPhone = query(collection(db, 'groups'), where('pendingInvites', 'array-contains', user.phoneNumber));
             const snapPhone = await getDocs(qPhone);
             snapPhone.docs.forEach(d => {
               const data = d.data();
               if (!data.members?.includes(user.uid) && !pendingEmailInvs.some(p => p.groupId === d.id)) {
                 pendingEmailInvs.push({
                   id: `pending-phone-${d.id}`,
                   groupId: d.id,
                   type: 'pendingInvite',
                   identifier: user.phoneNumber,
                   isPendingInvite: true
                 });
               }
             });
          } catch (e) {
            console.warn('Could not fetch phone invitations:', e);
          }
        }

        const combinedInvs = [...invs, ...pendingEmailInvs];
        setInvitations(combinedInvs);

        // Fetch group details
        for (const inv of combinedInvs) {
          if (!invitingGroups[inv.groupId]) {
            const gSnap = await getDoc(doc(db, 'groups', inv.groupId));
            if (gSnap.exists()) {
              setInvitingGroups(prev => ({ ...prev, [inv.groupId]: gSnap.data() }));
            }
          }
        }
      } catch (err) {
        console.error('Error processing invitations snapshot:', err);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'collectionGroup/requests');
    });

    return () => unsubInvitations();
  }, [loading]);

  const handleInvitation = async (inv: any, action: 'accept' | 'decline') => {
    try {
      if (action === 'accept') {
        const groupRef = doc(db, 'groups', inv.groupId);
        await updateDoc(groupRef, {
          members: arrayUnion(auth.currentUser?.uid),
          ...(inv.isPendingInvite ? { pendingInvites: arrayRemove(inv.identifier) } : {})
        });
        toast.success(`Đã tham gia nhóm ${invitingGroups[inv.groupId]?.name}`);
      } else if (inv.isPendingInvite) {
        const groupRef = doc(db, 'groups', inv.groupId);
        await updateDoc(groupRef, {
          pendingInvites: arrayRemove(inv.identifier)
        });
      }
      if (!inv.isPendingInvite) {
        await deleteDoc(inv.ref);
      }
      setInvitations(prev => prev.filter(i => i.id !== inv.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${inv.groupId}`);
    }
  };

  const handlePinGroup = async (groupId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!auth.currentUser) return;

    const isPinned = profile?.pinnedGroupIds?.includes(groupId);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        pinnedGroupIds: isPinned ? arrayRemove(groupId) : arrayUnion(groupId)
      });
      toast.success(isPinned ? 'Đã bỏ ghim nhóm' : 'Đã ghim nhóm lên đầu');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-48 bg-gray-100 rounded-[40px] animate-pulse" />
        <div className="space-y-4">
          <GroupCardSkeleton />
          <GroupCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10 md:space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-1000 overflow-x-hidden">
      {/* Corporate Dashboard Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 dark:bg-black rounded-3xl md:rounded-[40px] p-6 sm:p-10 md:p-14 text-white shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-800">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-none" />
        
        <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center text-left">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
              <Sparkles size={14} className="text-amber-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Executive Workspace</span>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">
                Quản lý nhóm <br />
                <span className="text-indigo-400">chuyên nghiệp.</span>
              </h2>
              <p className="text-slate-400 text-sm md:text-lg max-w-md leading-relaxed">
                Nâng tầm quản trị nhóm, minh bạch tài chính và thắt chặt kết nối cộng đồng của bạn.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3 pt-4">
              <Link 
                to="/create-group"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 sm:gap-3 bg-white text-slate-900 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all hover:bg-slate-100 hover:translate-y-[-2px] active:scale-95 shadow-xl shadow-white/10"
              >
                <Plus size={16} />
                Tạo nhóm mới
              </Link>
              <button 
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 sm:gap-3 bg-slate-800 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest border border-slate-700 transition-all hover:bg-slate-700"
              >
                <LayoutGrid size={16} />
                Khám phá
              </button>
            </div>
          </div>

          <div className="hidden md:grid grid-cols-2 gap-4">
            <div className="space-y-4 translate-y-6">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
                <Users className="text-indigo-400 mb-4" />
                <div className="text-2xl font-bold">12.5k</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">Active Members</div>
              </div>
              <div className="bg-indigo-500 p-6 rounded-2xl shadow-lg shadow-indigo-500/20">
                <Wallet className="text-white mb-4" />
                <div className="text-2xl font-bold">98%</div>
                <div className="text-[10px] text-indigo-100 uppercase tracking-widest">Financial Clarity</div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
                <Sparkles className="text-amber-400 mb-4" />
                <div className="text-2xl font-bold">4.9/5</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">Safety Rating</div>
              </div>
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <Check className="text-emerald-400 mb-4" />
                <div className="text-2xl font-bold">Zero</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">Shadow Debts</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Invitations Section - Professional Toast Style */}
      <AnimatePresence>
        {invitations.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 px-2">
              <div className="w-2 h-8 bg-amber-500 rounded-full" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Lời mời chờ xử lý</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {invitations.map((inv) => {
                const group = invitingGroups[inv.groupId];
                return (
                  <motion.div 
                    key={inv.id}
                    layout
                    className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shrink-0">
                        {group?.coverImage ? (
                          <img src={group.coverImage} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <Users size={18} className="m-auto mt-2.5 sm:mt-3.5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">{group?.name || 'Nhóm đang tải...'}</h4>
                        <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate tracking-tight">Từ: {inv.inviterEmail || 'Thành viên'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 sm:gap-3">
                      <button 
                        onClick={() => handleInvitation(inv, 'accept')}
                        className="flex-1 bg-indigo-600 text-white py-2.5 sm:py-3 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hover:bg-indigo-700 transition-colors"
                      >
                        Chấp nhận
                      </button>
                      <button 
                        onClick={() => handleInvitation(inv, 'decline')}
                        className="px-3 sm:px-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <X size={16} sm:size={18} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Featured Groups Section */}
      <section className="space-y-8">
        <div className="flex justify-between items-end px-2">
          <div className="space-y-1">
            <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Danh sách nhóm</h3>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Bạn đang tham gia {orderedGroups.length} nhóm hoạt động</p>
          </div>
          <Link to="/groups" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
            Xem tất cả <ChevronRight size={14} />
          </Link>
        </div>

        {orderedGroups.length === 0 ? (
          <EmptyState 
            icon={Users} 
            title="Sẵn sàng quản lý nhóm?" 
            message="Bắt đầu bằng cách tạo một nhóm hoặc tham gia nhóm có sẵn."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {orderedGroups.map((group) => {
              const isPinned = profile?.pinnedGroupIds?.includes(group.id) || false;
              return (
                <div key={group.id} className="relative group/item">
                  <Link 
                    to={`/group/${group.id}`}
                    className={cn(
                      "group block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-xl transition-all duration-300 relative",
                      isPinned && "border-indigo-200 dark:border-indigo-900 bg-indigo-50/10"
                    )}
                  >
                    <div className="flex items-center gap-3 sm:gap-5 relative z-10">
                      <div className="relative shrink-0">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner group-hover:scale-105 transition-transform duration-500">
                          {group.coverImage ? (
                            <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-7 h-7 sm:w-8 sm:h-8 m-auto mt-3 sm:mt-4 md:mt-6 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>
                        {group.ownerId === auth.currentUser?.uid && (
                          <div className="absolute -top-1 -right-1 bg-amber-400 w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center shadow-lg">
                            <Crown size={10} sm:size={12} className="text-amber-900" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 pr-8 sm:pr-0">
                        <div className="flex items-center gap-2 mb-1 sm:mb-2">
                           <h4 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg truncate group-hover:text-indigo-600 transition-colors">
                             {group.name}
                           </h4>
                           <GroupUnreadBadge groupId={group.id} lastReadAt={profile?.lastReadChat?.[group.id]} />
                        </div>
                        
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="flex items-center gap-1 sm:gap-1.5 text-slate-500">
                            <Users size={12} sm:size={14} />
                            <span className="text-[10px] sm:text-[11px] font-semibold">{group.members?.length || 0} thành viên</span>
                          </div>
                          
                          <div className="flex -space-x-1.5 sm:-space-x-2">
                             {[1, 2, 3].map(i => (
                               <div key={i} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700" />
                             ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="hidden sm:block">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                          <ChevronRight size={20} />
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  {/* Pin Button moved slightly for professional card interaction */}
                  <button
                    onClick={(e) => handlePinGroup(group.id, e)}
                    className={cn(
                      "absolute top-3 sm:top-4 right-3 sm:right-4 z-20 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-all active:scale-75",
                      isPinned 
                        ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" 
                        : "text-slate-300 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <PinOff size={14} sm:size={16} className={cn(!isPinned && "hidden")} />
                    <Pin size={14} sm:size={16} className={cn(isPinned && "hidden")} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
