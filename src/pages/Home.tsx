import React, { useEffect, useState, useMemo } from 'react';
import { useGroups } from '../hooks/useGroups';
import { motion, AnimatePresence, Reorder } from 'motion/react';
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
    <div className="bg-red-500 text-white text-[10px] font-black min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(239,68,68,0.3)] animate-in zoom-in duration-300 shrink-0">
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

  const onReorder = (newOrder: Group[]) => {
    setOrderedGroups(newOrder);
  };

  const saveOrder = async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        groupOrder: orderedGroups.map(g => g.id)
      });
    } catch (err) {
      console.error('Failed to save group order:', err);
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
    <div className="p-6 space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-1000">
      {/* Hyper-Modern Hero Section */}
      <section className="relative overflow-hidden bg-white dark:bg-black rounded-[48px] p-10 text-gray-900 dark:text-white border-2 border-gray-900 dark:border-white shadow-[12px_12px_0px_rgba(0,0,0,1)] dark:shadow-[12px_12px_0px_rgba(255,255,255,1)]">
        <div className="absolute top-[-10%] right-[-10%] w-[250px] h-[250px] bg-blue-500 rounded-full blur-[80px] opacity-10 animate-pulse" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-12">
             <div className="flex flex-col">
               <span className="text-[12px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400 leading-none">Smart Hub</span>
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Ready for action</span>
             </div>
             <div className="w-12 h-12 bg-gray-900 dark:bg-white rounded-2xl flex items-center justify-center rotate-3 hover:rotate-0 transition-transform">
               <Sparkles size={24} className="text-white dark:text-gray-900" />
             </div>
          </div>
          
          <div className="space-y-4 mb-12">
            <h2 className="text-6xl font-black tracking-tighter italic uppercase font-display leading-[0.85] animate-in slide-in-from-left duration-700">KẾT NỐI</h2>
            <div className="flex items-center gap-4">
              <div className="h-2 w-16 bg-blue-600 rounded-full" />
              <h2 className="text-6xl font-black tracking-tighter italic uppercase font-display leading-[0.85] text-blue-600 dark:text-blue-400">NHÓM</h2>
            </div>
            <h2 className="text-6xl font-black tracking-tighter italic uppercase font-display leading-[0.85] animate-in slide-in-from-left duration-1000 delay-200">BẠN BÈ.</h2>
          </div>
          
          <div className="flex gap-4">
            <Link 
              to="/create-group"
              className="group/btn flex-[2] flex items-center justify-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-950 px-8 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:translate-y-[-4px] active:scale-95 shadow-xl"
            >
              <Plus className="w-5 h-5 group-hover/btn:rotate-90 transition-transform duration-500" />
              Bắt đầu ngay
            </Link>
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-[24px] flex items-center justify-center hover:bg-blue-600 dark:hover:bg-blue-500 group transition-all cursor-pointer active:scale-90">
              <LayoutGrid size={28} className="text-gray-900 dark:text-white group-hover:text-white transition-colors" />
            </div>
          </div>
        </div>
      </section>
      
      {/* Invitations Section */}
      <AnimatePresence>
        {invitations.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center text-orange-600 group-hover:rotate-12 transition-transform">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter font-display italic">Mời gia nhập</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Chưa xử lý ({invitations.length})</p>
                </div>
              </div>
            </div>
            <div className="flex overflow-x-auto gap-6 py-4 no-scrollbar px-2 -mx-2">
              {invitations.map((inv) => {
                const group = invitingGroups[inv.groupId];
                return (
                  <motion.div 
                    key={inv.id}
                    layout
                    className="flex-shrink-0 w-[300px] bg-white dark:bg-gray-900 border-2 border-gray-900 dark:border-white rounded-[32px] p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_rgba(255,255,255,1)] relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-3">
                       <div className="w-3 h-3 bg-orange-500 rounded-full animate-ping" />
                    </div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-orange-500 overflow-hidden shadow-inner shrink-0 rotate-3">
                        {group?.coverImage ? (
                          <img src={group.coverImage} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <Users size={24} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-gray-900 dark:text-white truncate text-base font-display uppercase italic tracking-tighter leading-tight">{group?.name || '...'}</h4>
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">Từ {inv.inviterEmail?.split('@')[0]}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleInvitation(inv, 'accept')}
                        className="flex-[3] bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-500/20"
                      >
                        Chấp nhận
                      </button>
                      <button 
                        onClick={() => handleInvitation(inv, 'decline')}
                        className="flex-1 bg-gray-50 dark:bg-gray-800 text-gray-400 py-4 rounded-2xl text-[10px] font-black uppercase transition-all hover:bg-rose-50 hover:text-rose-600"
                      >
                        <X size={18} className="mx-auto" />
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
      <section className="space-y-10">
        <div className="flex justify-between items-end px-2">
          <div className="space-y-2">
            <h3 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter font-display italic uppercase leading-none">NHÓM CỦA TÔI</h3>
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.4em]">SPACE EXPLORER</span>
               <div className="h-px w-12 bg-gray-200 dark:bg-gray-800" />
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">{orderedGroups.length} Active</p>
            </div>
          </div>
          <Link to="/groups" className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-2xl group transition-all active:scale-90 shadow-sm border-2 border-gray-900 dark:border-white">
             <ChevronRight className="w-6 h-6 text-gray-900 dark:text-white group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {orderedGroups.length === 0 ? (
          <EmptyState 
            icon={Users} 
            title="Sẵn sàng quản lý nhóm?" 
            message="Bắt đầu bằng cách tạo một nhóm hoặc tham gia nhóm có sẵn."
          />
        ) : (
          <Reorder.Group 
            axis="y" 
            values={orderedGroups} 
            onReorder={onReorder}
            className="space-y-8"
          >
            {orderedGroups.map((group) => {
              const isPinned = profile?.pinnedGroupIds?.includes(group.id);
              return (
                <Reorder.Item
                  key={group.id}
                  value={group}
                  onDragEnd={saveOrder}
                  className="relative touch-none"
                  whileDrag={{ scale: 1.02, zIndex: 50 }}
                >
                  <div className="absolute top-6 right-6 z-20">
                    <button
                      onClick={(e) => handlePinGroup(group.id, e)}
                      className={cn(
                        "w-10 h-10 flex items-center justify-center transition-all active:scale-75",
                        isPinned 
                          ? "text-blue-600" 
                          : "text-gray-400 hover:text-blue-600"
                      )}
                    >
                      <Pin size={24} className={cn(isPinned && "fill-blue-600")} />
                    </button>
                  </div>
                  
                  <Link 
                    to={`/group/${group.id}`}
                    className={cn(
                      "group block bg-white dark:bg-gray-900 border-2 border-gray-900 dark:border-white rounded-[40px] p-8 shadow-[10px_10px_0px_rgba(0,0,0,1)] dark:shadow-[10px_10px_0px_rgba(255,255,255,1)] hover:translate-y-[-6px] hover:translate-x-[-2px] hover:shadow-[16px_16px_0px_rgba(0,0,0,1)] dark:hover:shadow-[16px_16px_0px_rgba(255,255,255,1)] transition-all duration-300 relative overflow-hidden",
                      isPinned && "ring-2 ring-blue-500 ring-offset-4 dark:ring-offset-black"
                    )}
                  >
                    <div className="flex items-center gap-6 relative z-10">
                      <div className="flex flex-col items-center gap-1 text-gray-300 dark:text-gray-700">
                         <GripVertical size={20} />
                      </div>
                      
                      <div className="relative group/avatar">
                        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-3xl flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-gray-900 dark:border-white shadow-xl group-hover:rotate-3 transition-transform duration-500">
                          {group.coverImage ? (
                            <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                          ) : (
                            <Users className="w-10 h-10 text-gray-300 dark:text-gray-700" />
                          )}
                        </div>
                        {group.ownerId === auth.currentUser?.uid && (
                          <div className="absolute -top-2 -right-2 flex items-center justify-center bg-amber-400 w-8 h-8 rounded-2xl border-2 border-gray-900 dark:border-white shadow-lg rotate-12">
                            <Crown size={16} className="text-gray-900 fill-gray-900" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-3 mb-4">
                           <h4 className="font-black text-gray-900 dark:text-white text-2xl truncate tracking-tight font-display uppercase italic leading-none">{group.name}</h4>
                           <GroupUnreadBadge groupId={group.id} lastReadAt={profile?.lastReadChat?.[group.id]} />
                           {group.lastAnnoId && (
                             <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping" />
                           )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-gray-900 dark:border-white shadow-sm">
                            <Users className="w-3.5 h-3.5 text-gray-900 dark:text-white" />
                            <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest">
                               {group.members?.length || 0} MV
                            </span>
                          </div>
                          
                          {/* Pin badge removed as indicated by user */}
                          
                          <div className="flex items-center gap-2 ml-auto">
                             <div className="flex -space-x-1.5">
                               {[1, 2, 3].map(i => (
                                 <div key={i} className="w-6 h-6 rounded-lg border-2 border-gray-900 dark:border-white bg-gray-200 dark:bg-gray-700" />
                               ))}
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        )}
      </section>
    </div>
  );
}
