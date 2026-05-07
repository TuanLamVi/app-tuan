import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, where, getDoc, addDoc, updateDoc, serverTimestamp, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Group, Campaign, Transaction, Announcement, UserProfile } from '../models';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Wallet, Plus, Receipt, Settings, Users, 
  ChevronRight, TrendingUp, TrendingDown, MessageSquare, MessageCircle,
  Flag, UserPlus, Bell, Search, Check, Info, Crown, Shield, UserCheck,
  RefreshCcw, Download, X, CheckCircle2, Camera, BarChart3
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../core/utils';
import { toast } from 'react-hot-toast';
import AnnouncementCard from '../components/group/AnnouncementCard';
import MemberDetailsModal from '../components/group/MemberDetailsModal';
import InviteModal from '../components/group/InviteModal';
import TransactionModal from '../components/group/TransactionModal';
import TransactionCard from '../components/group/TransactionCard';
import CampaignModal from '../components/group/CampaignModal';
import CampaignCard from '../components/group/CampaignCard';
import GroupSettingsModal from '../components/group/GroupSettingsModal';
import TaskTab from '../components/group/TaskTab';
import TaskModal from '../components/group/TaskModal';
import PollTab from '../components/group/PollTab';
import PollModal from '../components/group/PollModal';
import ChatTab from '../components/group/ChatTab';
import EmptyState from '../components/ui/EmptyState';
import Skeleton, { TransactionSkeleton } from '../components/ui/Skeleton';

import { handleFirestoreError, OperationType, useAuth } from '../hooks/useAuth';
import { NotificationService } from '../services/notificationService';
import { exportToCSV } from '../core/utils';

type TabType = 'news' | 'finance' | 'members' | 'tasks' | 'polls' | 'chat';

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('news');
  const [group, setGroup] = useState<Group | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestProfiles, setRequestProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [annoLimit, setAnnoLimit] = useState(10);
  const [hasMoreAnnos, setHasMoreAnnos] = useState(true);

  const [isAnnoModalOpen, setIsAnnoModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [newCoverURL, setNewCoverURL] = useState('');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const MEMBERS_PER_PAGE = 10;

  useEffect(() => {
    setMemberPage(1);
  }, [memberSearchTerm]);

  const [txLimit, setTxLimit] = useState(10);
  const [hasMoreTx, setHasMoreTx] = useState(true);
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [txUserFilter, setTxUserFilter] = useState<string>('all');

  const [newAnno, setNewAnno] = useState({ title: '', content: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const memberUidsRef = React.useRef<string[]>([]);

  const isOwner = auth.currentUser?.uid === group?.ownerId;
  const isDeputy = group?.deputies?.includes(auth.currentUser?.uid || '');
  const isMember = group && (group.members.includes(auth.currentUser?.uid || '') || group.ownerId === auth.currentUser?.uid);
  const canManage = isOwner || isDeputy;

  useEffect(() => {
    if (!id) return;

    const groupSub = onSnapshot(doc(db, 'groups', id), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const updatedGroup = {
          ...data,
          id: docSnapshot.id,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Group;
        setGroup(updatedGroup);
        
        // Only fetch if members list actually changed
        const currentUids = updatedGroup.members || [];
        if (JSON.stringify(currentUids) !== JSON.stringify(memberUidsRef.current)) {
          fetchMemberProfiles(currentUids);
          memberUidsRef.current = currentUids;
        }
      } else {
        toast.error('Không tìm thấy nhóm');
        navigate('/');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `groups/${id}`);
    });

    const campaignsSub = onSnapshot(collection(db, 'groups', id, 'campaigns'), (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date()
      } as Campaign)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `groups/${id}/campaigns`);
    });

    const txQueryBase = collection(db, 'groups', id, 'transactions');
    const txConstraints: any[] = [orderBy('createdAt', 'desc'), limit(txLimit)];
    
    if (txFilter !== 'all') {
      txConstraints.unshift(where('type', '==', txFilter));
    }
    if (txUserFilter !== 'all') {
      txConstraints.unshift(where('createdBy', '==', txUserFilter));
    }

    const txSub = onSnapshot(
      query(txQueryBase, ...txConstraints),
      (snapshot) => {
        const fetchedTx = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate() || new Date()
        } as Transaction));
        setTransactions(fetchedTx);
        setHasMoreTx(snapshot.docs.length === txLimit);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `groups/${id}/transactions`);
      }
    );

    const annoSub = onSnapshot(
      query(collection(db, 'groups', id, 'announcements'), orderBy('createdAt', 'desc'), limit(annoLimit)),
      (snapshot) => {
        const fetchedAnnos = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate() || new Date()
        } as Announcement));
        setAnnouncements(fetchedAnnos);
        setHasMoreAnnos(snapshot.docs.length === annoLimit);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `groups/${id}/announcements`);
      }
    );

    const reqSub = canManage ? onSnapshot(collection(db, 'groups', id, 'requests'), (snapshot) => {
      const allReqs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((r: any) => r.status === 'pending' || r.status === 'invited');
      setRequests(allReqs);
      
      // Fetch profiles for requests
      allReqs.forEach(async (req: any) => {
        if (req.uid && !requestProfiles[req.uid]) {
          const uDoc = await getDoc(doc(db, 'users', req.uid));
          if (uDoc.exists()) {
            setRequestProfiles(prev => ({ ...prev, [req.uid]: uDoc.data() as UserProfile }));
          }
        }
      });
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, `groups/${id}/requests`);
    }) : () => {};

    return () => {
      groupSub();
      campaignsSub();
      txSub();
      annoSub();
      reqSub();
    };
  }, [id, navigate, annoLimit, canManage, txLimit, txFilter, txUserFilter]);

  const fetchMemberProfiles = async (uids: string[]) => {
    if (!uids.length) {
      setMemberProfiles([]);
      return;
    }
    try {
      const profilePromises = uids.map(uid => getDoc(doc(db, 'users', uid)));
      const snapshots = await Promise.all(profilePromises);
      const profiles = snapshots
        .filter(snap => snap.exists())
        .map(snap => snap.data() as UserProfile);
      setMemberProfiles(profiles);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !auth.currentUser) return;
    if (!newAnno.title || !newAnno.content) {
      toast.error('Vui lòng nhập đầy đủ tiêu đề và nội dung');
      return;
    }

    setIsSubmitting(true);
    try {
      const annoData = {
        title: newAnno.title,
        content: newAnno.content,
        createdBy: auth.currentUser.uid,
        groupId: id,
        reactions: {},
        comments: [],
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'groups', id, 'announcements'), annoData);
      
      // Update group's lastAnnoId
      await updateDoc(doc(db, 'groups', id), {
        lastAnnoId: docRef.id
      });

      // Notify members (limit to avoid too many writes, or just owner if large group?
      // Instruction says members. I'll notify members excluding creator)
      const otherMembers = group?.members.filter(uid => uid !== auth.currentUser?.uid) || [];
      const notifications = otherMembers.map(uid => 
        NotificationService.sendNotification(uid, {
          title: 'Thông báo mới',
          message: `Nhóm "${group?.name}" có bản tin mới: ${annoData.title}`,
          type: 'announcement',
          category: 'announcements',
          data: { groupId: id, annoId: docRef.id }
        })
      );
      await Promise.all(notifications);

      toast.success('Đã đăng thông báo!');
      setIsAnnoModalOpen(false);
      setNewAnno({ title: '', content: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${id}/announcements`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (annoId: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'groups', id, 'announcements', annoId));
      toast.success('Đã xóa bản tin');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${id}/announcements/${annoId}`);
    }
  };

  const handleAcceptTransfer = async () => {
    if (!id || !auth.currentUser || group.pendingOwner !== auth.currentUser.uid) return;
    try {
      const groupRef = doc(db, 'groups', id);
      await updateDoc(groupRef, {
        ownerId: auth.currentUser.uid,
        pendingOwner: null
      });
      toast.success('Bạn hiện là Trưởng nhóm mới!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${id}`);
    }
  };

  const filteredMembers = memberProfiles.filter(m => 
    m.displayName.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
    m.phoneNumber?.includes(memberSearchTerm) ||
    m.email.toLowerCase().includes(memberSearchTerm.toLowerCase())
  );

  const paginatedMembers = filteredMembers.slice(0, memberPage * MEMBERS_PER_PAGE);

  const filteredTransactions = transactions;

  if (loading || !group) {
    return (
      <div className="p-4 space-y-6 bg-gray-50 min-h-screen">
        <Skeleton className="h-40 rounded-[40px]" />
        <div className="grid grid-cols-2 gap-4">
           <Skeleton className="h-24 rounded-3xl" />
           <Skeleton className="h-24 rounded-3xl" />
        </div>
        <div className="space-y-4 pt-8">
           <TransactionSkeleton />
           <TransactionSkeleton />
           <TransactionSkeleton />
        </div>
      </div>
    );
  }

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject', type: string, memberUid?: string, identifier?: string) => {
    if (!id) return;
    try {
      const reqRef = doc(db, 'groups', id, 'requests', requestId);
      if (action === 'approve') {
        if (type === 'invite' && memberUid) {
          // If it's an invite, admin approval means it's now sent to the user
          await updateDoc(reqRef, { status: 'invited' });
          
          await NotificationService.sendNotification(memberUid, {
            title: 'Mời vào nhóm',
            message: `Admin đã duyệt yêu cầu mời bạn vào nhóm "${group?.name}"`,
            type: 'invite',
            data: { groupId: id }
          });
          toast.success('Đã duyệt yêu cầu mời');
        } else if (memberUid) {
          // If it's a join request, admin approval adds them directly
          await updateDoc(doc(db, 'groups', id), {
            members: arrayUnion(memberUid)
          });
          
          await NotificationService.sendNotification(memberUid, {
            title: 'Yêu cầu tham gia nhóm',
            message: `Yêu cầu tham gia nhóm "${group?.name}" của bạn đã được chấp nhận!`,
            type: 'approval',
            data: { groupId: id }
          });
          await updateDoc(reqRef, { status: 'approved' });
          toast.success('Đã duyệt thành viên');
        } else if (identifier) {
          await updateDoc(doc(db, 'groups', id), {
            pendingInvites: arrayUnion(identifier)
          });
          await updateDoc(reqRef, { status: 'approved' });
          toast.success('Đã duyệt liên kết mời');
        }
      } else {
        await updateDoc(reqRef, { status: 'rejected' });
        
        if (memberUid) {
          await NotificationService.sendNotification(memberUid, {
            title: 'Yêu cầu tham gia nhóm',
            message: `Yêu cầu tham gia nhóm "${group?.name}" của bạn đã bị từ chối.`,
            type: 'approval',
            data: { groupId: id }
          });
        }

        toast.success('Đã từ chối');
      }
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, `groups/${id}/requests`);
    }
  };

  const isPendingOwner = group?.pendingOwner === auth.currentUser?.uid;

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      toast.error('Chưa có giao dịch để xuất');
      return;
    }

    const exportData = transactions.map(tx => {
      const creator = memberProfiles.find(p => p.uid === tx.createdBy);
      return {
        'Ngày': formatDate(tx.createdAt),
        'Loại': tx.type === 'income' ? 'Thu' : 'Chi',
        'Số tiền': tx.amount,
        'Nội dung': tx.category,
        'Người tạo': creator?.displayName || tx.createdBy,
        'Trạng thái': tx.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt',
        'Ghi chú': tx.description || ''
      };
    });

    exportToCSV(exportData, `GiaoDich_${group.name}_${new Date().toISOString().split('T')[0]}`);
    toast.success('Đã tải xuống tệp CSV');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // onSnapshot handles data, so we just simulate a refresh feeling
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Đã cập nhật dữ liệu mới nhất', { icon: '🔄' });
    }, 1000);
  };

  const handleUpdateCover = async () => {
    if (!id || !newCoverURL.trim()) return;
    try {
      await updateDoc(doc(db, 'groups', id), {
        coverImage: newCoverURL.trim()
      });
      toast.success('Đã cập nhật ảnh bìa');
      setIsEditingCover(false);
      setNewCoverURL('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${id}`);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-950 min-h-screen pb-24 transition-colors">
      {/* Group Cover Image */}
      <div className="relative h-48 sm:h-64 w-full bg-blue-600 overflow-hidden">
        {group.coverImage ? (
          <img 
            src={group.coverImage} 
            alt={group.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
            <Users size={64} className="text-white/20" />
          </div>
        )}
        
        {/* Update Cover Button */}
        {canManage && (
          <button 
            onClick={() => {
              setIsEditingCover(true);
              setNewCoverURL(group.coverImage || '');
            }}
            className="absolute bottom-4 right-4 p-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg active:scale-95"
          >
            <Camera size={20} />
          </button>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Cover Edit Modal/Input (Simple inline overlay) */}
      <AnimatePresence>
        {isEditingCover && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[40px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Cập nhật ảnh bìa</h3>
                <button onClick={() => setIsEditingCover(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                  <X className="text-gray-400" size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">URL Ảnh bìa</label>
                  <input 
                    type="text"
                    value={newCoverURL}
                    onChange={e => setNewCoverURL(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-4 py-4 font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                
                {newCoverURL && (
                  <div className="h-32 w-full rounded-2xl overflow-hidden border-2 border-dashed border-gray-100 dark:border-gray-800">
                    <img src={newCoverURL} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Invalid+URL'} />
                  </div>
                )}

                <button 
                  onClick={handleUpdateCover}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                >
                  Lưu thay đổi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Ownership Banner */}
      <AnimatePresence>
        {isPendingOwner && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="bg-orange-500 text-white overflow-hidden"
          >
            <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <Crown size={20} className="flex-shrink-0" />
                <p className="text-sm font-bold">Bạn đã được đề nghị làm Trưởng nhóm mới.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleAcceptTransfer}
                  className="bg-white text-orange-600 px-4 py-1.5 rounded-full text-xs font-black uppercase flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Check size={14} /> Chấp nhận
                </button>
                <button 
                   onClick={async () => {
                     await updateDoc(doc(db, 'groups', id!), { pendingOwner: null });
                     toast.success('Đã từ chối');
                   }}
                   className="bg-orange-600 text-white border border-orange-400 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm active:scale-95 transition-all"
                >
                  Từ chối
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Sticky Header */}
      <div className="bg-white dark:bg-gray-900 px-4 pt-10 pb-4 rounded-b-[40px] shadow-sm sticky top-0 z-30 border-b border-gray-100 dark:border-gray-800 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft className="w-6 h-6 dark:text-white" />
            </button>
            <div className="min-w-0">
               <div className="flex items-center gap-2">
                 <h1 className="font-black text-xl italic uppercase tracking-tighter truncate dark:text-white" style={{ color: '#f7a24d', width: '301.25px' }}>{group.name}</h1>
                 {isOwner ? (
                   <div className="flex-shrink-0 flex items-center bg-amber-50 dark:bg-amber-900/30 px-1.5 py-1 rounded-full border border-amber-100 dark:border-amber-800 shadow-sm">
                     <Crown size={7} className="text-amber-500 fill-amber-500" />

                   </div>
                 ) : isDeputy ? (
                   <span className="flex-shrink-0 text-[8px] font-black uppercase text-blue-600 tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">Phó nhóm</span>
                 ) : null}
               </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleRefresh}
              className={cn(
                "p-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all",
                isRefreshing && "animate-spin text-blue-600"
              )}
            >
              <RefreshCcw size={18} />
            </button>
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
        
        {/* Tab Selection */}
      <div className="px-4 mt-6">
        <div className="flex bg-gray-50 dark:bg-gray-800/50 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory" id="tab-container">
          <TabNavItem active={activeTab === 'news'} onClick={() => setActiveTab('news')} icon={<MessageSquare size={16} />} label="Bản tin" />
          {isMember && (
             <TabNavItem 
               active={activeTab === 'chat'} 
               onClick={() => setActiveTab('chat')} 
               icon={<MessageCircle size={16} />} 
               label="Trò chuyện" 
               badgeCount={id && profile ? <ChatTabBadge groupId={id} lastReadAt={profile?.lastReadChat?.[id]} /> : 0}
             />
          )}
          <TabNavItem active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={<Users size={16} />} label="Thành viên" />
          {isMember && (
            <>
              <TabNavItem active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<CheckCircle2 size={16} />} label="Công việc" />
              <TabNavItem active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} icon={<Wallet size={16} />} label="Tài chính" />
              <TabNavItem active={activeTab === 'polls'} onClick={() => setActiveTab('polls')} icon={<BarChart3 size={16} />} label="Bình chọn" />
            </>
          )}
        </div>

        {/* Pagination Dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {[0, 1, 2].map((i) => (
            <div 
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                ((activeTab === 'news' || activeTab === 'chat' || activeTab === 'members') && i === 0) ||
                ((activeTab === 'tasks' || activeTab === 'finance') && i === 1) ||
                (activeTab === 'polls' && i === 2)
                  ? "w-6 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm shadow-blue-500/20" 
                  : "w-1.5 bg-gray-200 dark:bg-gray-700"
              )}
            />
          ))}
        </div>
      </div>
      </div>

      <div className="p-4">
        {!isMember && activeTab !== 'news' && activeTab !== 'members' && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto text-blue-600">
              <Shield size={32} />
            </div>
            <h3 className="text-lg font-black uppercase italic tracking-tight dark:text-white">Nội dung giới hạn</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[240px] mx-auto leading-relaxed">
              Bạn cần tham gia nhóm này để có thể xem thảo luận, công việc và tài chính.
            </p>
            <button 
              onClick={() => navigate(`/join/${id}`)}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
            >
              Tham gia ngay
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'news' && (
            <motion.div key="news" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              {canManage && (
                <button 
                  onClick={() => setIsAnnoModalOpen(true)}
                  className="w-full p-4 bg-white border border-dashed border-blue-200 rounded-3xl text-blue-600 font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] hover:bg-blue-50/30"
                >
                  <Plus size={18} /> Đăng thông báo mới
                </button>
              )}
              {announcements.length === 0 ? (
                <EmptyState 
                  icon={MessageSquare}
                  title="Chưa có bản tin"
                  message="Mọi thông báo quan trọng sẽ xuất hiện tại đây."
                  className="py-12"
                />
              ) : (
                <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">
                  {announcements.map(anno => (
                    <motion.div key={anno.id} variants={itemVariants}>
                      <AnnouncementCard 
                        announcement={anno} 
                        groupId={id!} 
                        memberProfiles={memberProfiles}
                        isOwnerOrDeputy={canManage}
                        onDelete={handleDeleteAnnouncement}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
              {hasMoreAnnos && announcements.length >= annoLimit && (
                <button 
                  onClick={() => setAnnoLimit(prev => prev + 10)}
                  className="w-full py-3 text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:text-blue-600 transition-colors"
                >
                  Xem thêm bản tin
                </button>
              )}
            </motion.div>
          )}

          {isMember && activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ChatTab groupId={id!} canManage={canManage} />
            </motion.div>
          )}

          {isMember && activeTab === 'tasks' && (
            <motion.div key="tasks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <TaskTab 
                groupId={id!}
                groupName={group.name}
                canManage={canManage}
                ownerId={group.ownerId}
                members={memberProfiles}
                onAddTask={() => setIsTaskModalOpen(true)}
              />
            </motion.div>
          )}

          {isMember && activeTab === 'polls' && (
            <motion.div key="polls" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PollTab 
                groupId={id!}
                canManage={canManage}
                isMember={isMember}
                memberProfiles={memberProfiles}
                onAddPoll={() => setIsPollModalOpen(true)}
              />
            </motion.div>
          )}

          {isMember && activeTab === 'finance' && (
            <motion.div key="finance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="bg-gray-900 rounded-3xl p-6 text-white shadow-xl shadow-gray-200">
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Số dư hiện tại</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-black">{formatCurrency(group.totalFund)}</h2>
                  <span className="text-xs text-gray-400 font-bold uppercase">{group.currency}</span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleExportCSV}
                    className="bg-white/10 hover:bg-white/20 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Xuất CSV
                  </button>
                  <button 
                    onClick={() => setIsTransactionModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                  >
                    <Plus size={14} /> Giao dịch
                  </button>
                </div>
              </div>

              {/* Campaigns/Events Section Integrated into Finance */}
              <section className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-black text-sm uppercase italic tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                     <Flag size={18} className="text-orange-500" />
                     Sự kiện & Mục tiêu
                  </h3>
                  {canManage && (
                    <button 
                      onClick={() => setIsCampaignModalOpen(true)}
                      className="text-blue-600 text-[10px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-800"
                    >
                      Tạo mới
                    </button>
                  )}
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x">
                  {campaigns.length === 0 ? (
                    <div className="w-full bg-orange-50/50 dark:bg-orange-900/10 border border-dashed border-orange-100 dark:border-orange-800/30 rounded-3xl p-6 text-center">
                      <p className="text-xs text-orange-600/60 dark:text-orange-400/60 font-bold">Chưa có mục tiêu hay sự kiện nào</p>
                    </div>
                  ) : (
                    campaigns.map(camp => (
                      <div key={camp.id} className="min-w-[280px] snap-center">
                        <CampaignCard 
                          campaign={camp} 
                          group={group} 
                          isAdmin={canManage} 
                        />
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-4 px-1">
                  <h3 className="font-black text-sm uppercase italic tracking-tight text-gray-900 dark:text-white">Lịch sử thu chi</h3>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select 
                      value={txUserFilter}
                      onChange={e => setTxUserFilter(e.target.value)}
                      className="bg-gray-100 dark:bg-gray-800 dark:text-gray-200 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border-none focus:ring-0 appearance-none shadow-sm"
                    >
                      <option value="all">Mọi người</option>
                      {memberProfiles.map(p => (
                        <option key={p.uid} value={p.uid}>{p.displayName}</option>
                      ))}
                    </select>
                    
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg shadow-inner">
                      {(['all', 'income', 'expense'] as const).map(f => (
                        <button 
                          key={f}
                          onClick={() => setTxFilter(f)}
                          className={cn(
                            "px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all",
                            txFilter === f ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400"
                          )}
                        >
                          {f === 'all' ? 'Tất cả' : f === 'income' ? 'Thu' : 'Chi'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {filteredTransactions.length === 0 ? (
                    <EmptyState 
                      icon={Receipt}
                      title="Chưa có giao dịch"
                      message="Bắt đầu ghi lại các khoản thu chi của nhóm."
                      className="py-12"
                    />
                  ) : (
                    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
                      {filteredTransactions.map(tx => (
                        <motion.div key={tx.id} variants={itemVariants}>
                          <TransactionCard 
                            transaction={tx} 
                            group={group} 
                            memberProfiles={memberProfiles}
                            campaigns={campaigns}
                            isAdmin={canManage}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>

                {hasMoreTx && (
                   <button 
                    onClick={() => {
                      setTxLimit(prev => prev + 10);
                    }}
                    className="w-full mt-4 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {loading && transactions.length > 0 ? (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <RefreshCcw size={14} />
                        Xem thêm giao dịch
                      </>
                    )}
                  </button>
                )}
              </section>
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div key="members" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              {canManage && requests.length > 0 && (
                <div className="bg-blue-600 rounded-[32px] p-6 text-white shadow-xl shadow-blue-100 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <UserCheck size={20} />
                    <h4 className="font-black text-sm uppercase tracking-wider">Yêu cầu & Lời mời ({requests.length})</h4>
                  </div>
                  <div className="space-y-3">
                    {requests.map(req => {
                      const profile = requestProfiles[req.uid];
                      const isInvited = req.status === 'invited';
                      return (
                        <div key={req.id} className="bg-white/10 rounded-2xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold overflow-hidden text-xs">
                              {profile?.photoURL ? <img src={profile.photoURL} alt="" referrerPolicy="no-referrer" /> : (profile?.displayName?.[0] || req.inviteeIdentifier?.[0] || '?')}
                            </div>
                            <div>
                              <p className="text-xs font-bold">{profile?.displayName || req.inviteeIdentifier || 'Đang tải...'}</p>
                              <p className="text-[8px] opacity-60 font-medium uppercase tracking-wider">
                                {isInvited ? 'Chờ người dùng chấp nhận' : 'Chờ Admin duyệt'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!isInvited && (
                              <button 
                                onClick={() => handleRequestAction(req.id, 'approve', req.type, req.uid, req.inviteeIdentifier)}
                                className="px-3 py-1.5 bg-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest"
                              >
                                Duyệt
                              </button>
                            )}
                            <button 
                              onClick={() => handleRequestAction(req.id, 'reject', req.type, req.uid)}
                              className="px-3 py-1.5 bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                            >
                              {isInvited ? 'Hủy lời mời' : 'Từ chối'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="w-full p-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-3xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-gray-200 dark:shadow-none active:scale-[0.98] transition-transform"
              >
                <UserPlus size={18} /> Mời thành viên mới
              </button>

              <div className="relative">
                <input 
                  type="text" 
                  value={memberSearchTerm}
                  onChange={e => setMemberSearchTerm(e.target.value)}
                  placeholder="Tìm thành viên, SĐT..."
                  className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/10 font-bold text-gray-900 dark:text-white shadow-sm transition-colors"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm transition-colors">
                <div className="bg-gray-50/50 dark:bg-gray-700/50 px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest">
                   <span>Danh sách ({filteredMembers.length})</span>
                </div>
                {paginatedMembers.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center gap-2">
                    <Info className="text-gray-200 dark:text-gray-700" size={32} />
                    <p className="text-gray-400 dark:text-gray-500 text-xs font-bold">Không tìm thấy thành viên phù hợp</p>
                  </div>
                ) : (
                  <motion.div variants={containerVariants} initial="hidden" animate="show">
                    {paginatedMembers.map((member, i) => (
                      <motion.button 
                        key={member.uid} 
                        variants={itemVariants}
                        onClick={() => setSelectedMember(member)}
                        className={cn(
                          "w-full p-4 flex items-center gap-4 text-left transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/50", 
                          i !== paginatedMembers.length - 1 && "border-b border-gray-50 dark:border-gray-700"
                        )}
                      >
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm transition-colors">
                          {member.photoURL ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="text-blue-600 dark:text-blue-400 font-black">{member.displayName?.[0]}</div>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <h5 className="font-bold text-sm text-gray-900 dark:text-white">{member.displayName}</h5>
                            {group.ownerId === member.uid && <Crown size={12} className="text-orange-500" />}
                            {group.deputies?.includes(member.uid) && <Shield size={12} className="text-blue-500" />}
                          </div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                            {member.phoneNumber || 'Chưa có SĐT'}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-gray-200 dark:text-gray-700" />
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </div>

              {paginatedMembers.length < filteredMembers.length && (
                <button 
                  onClick={() => setMemberPage(prev => prev + 1)}
                  className="w-full py-3 text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:text-blue-600 transition-colors"
                >
                  Xem thêm thành viên
                </button>
              )}

              {/* Pending Invites Section */}
              {group.pendingInvites && group.pendingInvites.length > 0 && (
                <div className="mt-8 space-y-3">
                  <p className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest px-1">Đã mời nhưng chưa tham gia ({group.pendingInvites.length})</p>
                  <div className="space-y-2">
                    {group.pendingInvites.map((identifier) => (
                      <div key={identifier} className="bg-white dark:bg-gray-900 px-4 py-3 rounded-2xl flex items-center justify-between border border-dashed border-gray-200 dark:border-gray-800 shadow-sm transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 font-black">
                            {identifier[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{identifier}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium italic">Chờ người dùng tham gia...</p>
                          </div>
                        </div>
                        {canManage && (
                          <button 
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'groups', id!), {
                                  pendingInvites: arrayRemove(identifier)
                                });
                                toast.success('Đã hủy lời mời');
                              } catch (error) {
                                handleFirestoreError(error, OperationType.WRITE, `groups/${id}`);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Fab for Finance */}
      {activeTab === 'finance' && (
        <button 
          className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-[20px] shadow-xl shadow-blue-100 flex items-center justify-center active:scale-90 transition-all z-40"
          onClick={() => setIsTransactionModalOpen(true)}
        >
          <Plus size={32} />
        </button>
      )}

      <AnimatePresence>
        {isTaskModalOpen && (
          <TaskModal 
            isOpen={isTaskModalOpen}
            onClose={() => setIsTaskModalOpen(false)}
            groupId={id!}
            groupName={group.name}
            members={memberProfiles}
            ownerId={group.ownerId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPollModalOpen && (
          <PollModal
            isOpen={isPollModalOpen}
            onClose={() => setIsPollModalOpen(false)}
            groupId={id!}
            groupName={group.name}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsModalOpen && (
          <GroupSettingsModal 
            group={group} 
            isOwner={isOwner} 
            onClose={() => setIsSettingsModalOpen(false)} 
          />
        )}
      </AnimatePresence>

      {/* Announcement Modal */}
      <AnimatePresence>
        {isAnnoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAnnoModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black text-gray-900 mb-6">Thông báo mới</h3>
              <form onSubmit={handleAddAnnouncement} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Tiêu đề</label>
                  <input 
                    autoFocus
                    required
                    type="text" 
                    value={newAnno.title}
                    onChange={e => setNewAnno(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="VD: Thông báo họp tháng 10"
                    className="w-full bg-gray-50 border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-blue-500/20 font-bold text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Nội dung</label>
                  <textarea 
                    required
                    rows={4}
                    value={newAnno.content}
                    onChange={e => setNewAnno(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Nhập nội dung chi tiết..."
                    className="w-full bg-gray-50 border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-blue-500/20 font-medium text-gray-900 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAnnoModalOpen(false)}
                    className="bg-gray-100 text-gray-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
                  >
                    {isSubmitting ? 'Đang đăng...' : 'Đăng ngay'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTransactionModalOpen && (
          <TransactionModal 
            group={group} 
            campaigns={campaigns} 
            onClose={() => setIsTransactionModalOpen(false)} 
            isAdmin={canManage}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCampaignModalOpen && (
          <CampaignModal 
            group={group} 
            onClose={() => setIsCampaignModalOpen(false)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isInviteModalOpen && (
          <InviteModal 
            group={group} 
            onClose={() => setIsInviteModalOpen(false)} 
            isAdmin={canManage} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMember && (
          <MemberDetailsModal 
            member={selectedMember} 
            group={group} 
            onClose={() => setSelectedMember(null)}
            canManage={canManage}
            isOwner={isOwner}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TabNavItem({ active, icon, label, onClick, badgeCount }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void, badgeCount?: any }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex-shrink-0 min-w-[22%] sm:flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all snap-center relative",
        active ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50"
      )}
    >
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest truncate w-full text-center px-1">{label}</span>
      {badgeCount && (
        <div className="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-gray-800">
           {badgeCount}
        </div>
      )}
    </button>
  );
}

const ChatTabBadge = ({ groupId, lastReadAt }: { groupId: string, lastReadAt: any }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!groupId) return;
    
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
  return unreadCount >= 20 ? '9+' : unreadCount;
};
