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
    <div className="bg-red-500 text-white text-[10px] font-black min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-lg shadow-red-200 animate-in zoom-in ring-2 ring-white dark:ring-gray-900 z-20">
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
    <div className="p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Dynamic Hero Section */}
      <section className="relative overflow-hidden bg-gray-900 rounded-[40px] p-8 text-white shadow-2xl shadow-gray-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
             <div className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center">
               <Sparkles size={16} className="text-blue-400" />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Quản lý nhóm</span>
          </div>
          
          <h2 className="text-3xl font-black mb-6 tracking-tight italic uppercase">MyGroups</h2>
          
          <Link 
            to="/create-group"
            className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-900/20"
          >
            <Plus className="w-4 h-4" />
            Tạo nhóm mới
          </Link>
        </div>
      </section>
      
      {/* Invitations Section */}
      <AnimatePresence>
        {invitations.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 px-4">
              <Bell className="text-orange-500" size={18} />
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Lời mời mới ({invitations.length})</h3>
            </div>
            <div className="space-y-3">
              {invitations.map((inv) => {
                const group = invitingGroups[inv.groupId];
                return (
                  <motion.div 
                    key={inv.id}
                    layout
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-orange-50/50 border border-orange-100 rounded-[32px] p-5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-orange-500 shadow-sm flex-shrink-0">
                        {group?.coverImage ? (
                          <img src={group.coverImage} className="w-full h-full object-cover rounded-2xl" alt="" />
                        ) : (
                          <Users size={24} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-500 mb-0.5">Lời mời vào nhóm</p>
                        <h4 className="font-black text-gray-900 truncate tracking-tight">{group?.name || 'Đang tải...'}</h4>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => handleInvitation(inv, 'decline')}
                        className="p-3 bg-white text-gray-400 hover:text-red-500 rounded-2xl shadow-sm transition-colors"
                       >
                         <X size={18} />
                       </button>
                       <button 
                        onClick={() => handleInvitation(inv, 'accept')}
                        className="p-3 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95"
                       >
                         <Check size={18} />
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
      <section>
        <div className="flex justify-between items-end mb-6 px-4">
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Nhóm của bạn</h3>
            <p className="text-xs text-gray-400 font-medium">{orderedGroups.length} nhóm đang hoạt động</p>
          </div>
          <Link to="/groups" className="text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline">Tất cả</Link>
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
            className="grid gap-4"
          >
            {orderedGroups.map((group) => {
              const isPinned = profile?.pinnedGroupIds?.includes(group.id);
              return (
                <Reorder.Item
                  key={group.id}
                  value={group}
                  onDragEnd={saveOrder}
                  className="relative touch-none"
                >
                  <Link 
                    to={`/group/${group.id}`}
                    className={cn(
                      "group bg-white p-6 rounded-[32px] flex items-center gap-5 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-100 transition-all active:scale-[0.98]",
                      isPinned && "border-blue-100 bg-blue-50/10 shadow-blue-50"
                    )}
                  >
                    <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
                      <button 
                        onClick={(e) => handlePinGroup(group.id, e)}
                        className={cn(
                          "p-2 rounded-full transition-all",
                          isPinned ? "text-blue-600 bg-blue-50" : "text-gray-300 hover:text-gray-400 hover:bg-gray-50"
                        )}
                      >
                        {isPinned ? <Pin size={16} fill="currentColor" /> : <Pin size={16} />}
                      </button>
                      <div className="p-2 text-gray-200 cursor-grab active:cursor-grabbing">
                        <GripVertical size={16} />
                      </div>
                    </div>

                    <div className="w-20 h-20 bg-gray-50 rounded-[24px] flex-shrink-0 flex items-center justify-center overflow-hidden border-4 border-white shadow-inner group-hover:scale-110 transition-transform">
                      {group.coverImage ? (
                        <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-10 h-10 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-4 text-left">
                      <div className="flex items-center gap-2 mb-1">
                         <h4 className="font-black text-gray-900 text-lg truncate tracking-tight">{group.name}</h4>
                         {group.lastAnnoId && (
                           <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                         )}
                         {isPinned && <Pin size={10} className="text-blue-500 fill-blue-500" />}
                         {group.ownerId === auth.currentUser?.uid && (
                           <div className="flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 w-5 h-5 rounded-full border border-amber-100 dark:border-amber-800 shadow-sm">
                             <Crown size={10} className="text-amber-500 fill-amber-500" />
                           </div>
                         )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-blue-50 rounded-lg flex items-center justify-center">
                          <Users className="w-3 h-3 text-blue-600" />
                        </div>
                        <span className="text-sm font-black text-gray-500">
                           {group.members?.length || 0} thành viên
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <GroupUnreadBadge groupId={group.id} lastReadAt={profile?.lastReadChat?.[group.id]} />
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <ChevronRight className="w-6 h-6" />
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
