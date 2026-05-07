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
  const [direction, setDirection] = useState(0);
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

        // THÊM MỚI: Thiết lập tab mặc định khi lần đầu vào nhóm
        if (loading) {
          const defaultTabFromGroup = updatedGroup.default_tab as TabType;
          const isEnabled = updatedGroup.enabled_tabs?.[defaultTabFromGroup as keyof typeof updatedGroup.enabled_tabs] ?? true;
          
          if (defaultTabFromGroup && isEnabled) {
            setActiveTab(defaultTabFromGroup);
          }
        }
        
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

  // SỬA ĐỔI: Lọc tab dựa trên cấu hình enabled_tabs từ Firebase
  const availableTabs: TabType[] = ['news', 'chat', 'members', 'tasks', 'finance', 'polls'].filter(t => {
    // Luôn cho phép news và members nếu là thành viên, 
    // nhưng nếu enabled_tabs có giá trị false thì sẽ bị ẩn
    const isEnabled = group?.enabled_tabs?.[t as keyof typeof group.enabled_tabs] ?? true;
    if (!isEnabled) return false;
    
    // Kiểm tra quyền truy cập bổ sung (ví dụ: chỉ thành viên mới thấy finance, tasks, chat, polls)
    if (t === 'news' || t === 'members') return true;
    return isMember;
  }) as TabType[];

  // THÊM MỚI: Tự động chuyển tab nếu tab hiện tại bị vô hiệu hóa
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

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

  const handleTabChange = (newTab: TabType) => {
    const currentIndex = availableTabs.indexOf(activeTab);
    const newIndex = availableTabs.indexOf(newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
  };

  const onDragEnd = (_e: any, info: any) => {
    const threshold = 40; // Slightly lower threshold for easier swiping
    const velocityThreshold = 200; // Allow swipe on fast flick even if distance is small
    const currentIndex = availableTabs.indexOf(activeTab);
    
    if ((info.offset.x < -threshold || info.velocity.x < -velocityThreshold) && currentIndex < availableTabs.length - 1) {
      handleTabChange(availableTabs[currentIndex + 1]);
    } else if ((info.offset.x > threshold || info.velocity.x > velocityThreshold) && currentIndex > 0) {
      handleTabChange(availableTabs[currentIndex - 1]);
    }
  };

  const tabVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.98
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.98
    }),
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      toast.error('Chưa có giao dịch để xuất');
      return;
    }

    const exportData = transactions.map(tx => {
      const creator = (memberProfiles || []).find(p => p.uid === tx.createdBy);
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
    <div className="bg-slate-50 dark:bg-black min-h-screen pb-24 transition-colors font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Premium Glass Header - Compact */}
      <header className="w-full px-2 sm:px-4 py-2">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50 rounded-2xl px-4 py-2 flex items-center justify-between shadow-lg shadow-slate-200/30 dark:shadow-none">
            <div className="flex items-center gap-3 text-left">
              <button 
                onClick={() => navigate('/')} 
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-100 dark:border-slate-700 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 dark:text-white" />
              </button>
              <div className="min-w-0">
                 <div className="flex items-center gap-1.5">
                   <h1 className="font-black text-lg sm:text-xl uppercase tracking-tighter italic text-slate-900 dark:text-white leading-none truncate max-w-[120px] sm:max-w-none">
                     {group.name}
                   </h1>
                   {isOwner && (
                     <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-indigo-600 rounded-md shadow-lg shadow-indigo-500/20 rotate-12">
                       <Crown size={10} className="text-white fill-white" />
                     </div>
                   )}
                 </div>
                 <div className="flex items-center gap-2 mt-0.5">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                     {group.members?.length || 0} MEMBERS
                   </span>
                 </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex -space-x-1.5 mr-2">
                {memberProfiles.slice(0, 3).map((p, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-sm">
                    {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-slate-400">?</div>}
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all active:scale-95"
              >
                <UserPlus size={16} />
              </button>
              <button 
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 transition-all active:scale-95"
              >
                <Settings size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Dynamic Tab Navigation (Modern Top Tabs) */}
        <div className="z-[35] -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-slate-50/80 dark:bg-black/80 backdrop-blur-md">
          <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/20 dark:border-slate-800/50 shadow-sm">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeTab === tab 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                )}
              >
                {tab === 'news' && 'Bản tin'}
                {tab === 'chat' && 'Trao đổi'}
                {tab === 'members' && 'Thành viên'}
                {tab === 'tasks' && 'Nhiệm vụ'}
                {tab === 'finance' && 'Tài chính'}
                {tab === 'polls' && 'Bình chọn'}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area with Swipe Support */}
        <div className="mt-8 overflow-hidden touch-pan-y">
          {!isMember && activeTab !== 'news' && activeTab !== 'members' ? (
            <div className="py-24 text-center max-w-md mx-auto space-y-8">
              <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-[32px] flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                <Shield size={40} />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-tight">Truy cập giới hạn</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Trở thành thành viên của nhóm để mở khóa các tính năng thảo luận, quản lý công việc và theo dõi tài chính.
                </p>
              </div>
              <button 
                onClick={() => navigate(`/join/${id}`)}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
              >
                Gửi yêu cầu tham gia
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeTab}
                custom={direction}
                variants={tabVariants}
                initial="enter"
                animate="center"
                exit="exit"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={onDragEnd}
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="cursor-default"
              >
                {activeTab === 'news' && (
                  <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {canManage && (
                        <button 
                          onClick={() => setIsAnnoModalOpen(true)}
                          className="p-6 bg-white dark:bg-slate-900 border border-dashed border-indigo-200 dark:border-slate-800 rounded-[32px] text-indigo-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm transition-all active:scale-[0.95] hover:bg-indigo-50/30"
                        >
                          <Plus size={18} /> Đăng thông báo mới
                        </button>
                      )}
                      <button 
                        onClick={() => setIsInviteModalOpen(true)}
                        className={`p-6 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] text-slate-500 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm transition-all active:scale-[0.95] hover:bg-slate-50/50 ${!canManage ? 'sm:col-span-2' : ''}`}
                      >
                        <UserPlus size={18} className="text-indigo-500" /> Mời thêm thành viên
                      </button>
                    </div>

                    {announcements.length === 0 ? (
                      <EmptyState icon={MessageSquare} title="Chưa có bản tin" message="Mọi thông báo quan trọng sẽ xuất hiện tại đây." className="py-20" />
                    ) : (
                      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
                        {announcements.map(anno => (
                          <motion.div key={anno.id} variants={itemVariants}>
                            <AnnouncementCard announcement={anno} groupId={id!} memberProfiles={memberProfiles} isOwnerOrDeputy={canManage} onDelete={handleDeleteAnnouncement} />
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                )}

                {isMember && activeTab === 'chat' && (
                  <ChatTab 
                    groupId={id!} 
                    canManage={canManage} 
                    onClose={() => handleTabChange('news')} 
                  />
                )}

                {isMember && activeTab === 'tasks' && (
                  <div className="max-w-6xl mx-auto space-y-8">
                    {/* Progress Bento Box - Now in Tasks Tab */}
                    <div className="bg-indigo-600 rounded-[40px] p-8 text-white shadow-2xl shadow-indigo-500/20 border border-indigo-500 flex flex-col justify-between relative overflow-hidden text-left">
                      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                      
                      <div>
                        <label className="text-[10px] font-black uppercase text-indigo-100 tracking-[0.3em] mb-4 block">Tiến độ công việc</label>
                        <div className="flex items-center gap-6">
                          <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90">
                              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-indigo-500/30" />
                              <circle cx="48" cy="48" r="40" stroke="white" strokeWidth="8" fill="transparent" 
                                strokeDasharray={2 * Math.PI * 40} 
                                strokeDashoffset={2 * Math.PI * 40 * (1 - 0.75)} 
                                strokeLinecap="round" 
                              />
                            </svg>
                            <span className="absolute text-xl font-mono italic font-black">75%</span>
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter">Sắp hoàn thành</h3>
                            <p className="text-xs text-indigo-100 font-medium leading-relaxed opacity-80">Còn 4 công việc quan trọng cần xử lý trong tuần này.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <TaskTab groupId={id!} groupName={group.name} canManage={canManage} ownerId={group.ownerId} members={memberProfiles} onAddTask={() => setIsTaskModalOpen(true)} />
                  </div>
                )}

                {isMember && activeTab === 'finance' && (
                  <div className="space-y-10 max-w-5xl mx-auto">
                    {/* Fund Bento Box - Now in Finance Tab */}
                    <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-50 dark:border-slate-800 relative overflow-hidden group text-left">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none" />
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-4 block">Quỹ hiện tại</label>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl sm:text-6xl font-black tracking-tighter text-slate-900 dark:text-white font-mono italic">
                              {formatCurrency(group.totalFund || 0).replace('₫', '')}
                            </span>
                            <span className="text-lg font-black text-slate-400">{group.currency || 'VND'}</span>
                          </div>
                        </div>
                        
                        <div className="mt-12 flex flex-wrap gap-4">
                          <button 
                            onClick={() => setIsTransactionModalOpen(true)}
                            className="flex-1 min-w-[140px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:translate-y-[-2px] transition-all active:scale-95 shadow-xl shadow-slate-900/10 dark:shadow-white/10"
                          >
                            <Receipt size={18} /> Ghi giao dịch
                          </button>
                          <button 
                            onClick={handleExportCSV}
                            className="w-14 h-14 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center hover:bg-slate-100 transition-all active:scale-95 border border-slate-100 dark:border-slate-700"
                          >
                            <Download size={20} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Campaigns Overview */}
                    <section className="space-y-4">
                      <div className="flex justify-between items-center px-4">
                        <h3 className="font-black text-lg uppercase italic tracking-tighter text-slate-900 dark:text-white">Chiến dịch & Mục tiêu</h3>
                        {canManage && (
                          <button onClick={() => setIsCampaignModalOpen(true)} className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-800">
                            Tạo mới
                          </button>
                        )}
                      </div>
                      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 px-4 snap-x">
                        {campaigns.length === 0 ? (
                          <div className="w-full bg-slate-100 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] p-12 text-center text-slate-400 text-[10px] uppercase font-black tracking-widest leading-relaxed">Chưa có mục tiêu hành động</div>
                        ) : (
                          campaigns.map(camp => (
                            <div key={camp.id} className="min-w-[300px] snap-center">
                              <CampaignCard campaign={camp} group={group} isAdmin={canManage} />
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    {/* Transaction History */}
                    <section className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-xl border border-slate-100 dark:border-slate-800 text-left">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                        <h3 className="font-black text-xl uppercase italic tracking-tighter text-slate-900 dark:text-white">Lịch sử thu chi</h3>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
                          {(['all', 'income', 'expense'] as const).map(f => (
                            <button key={f} onClick={() => setTxFilter(f)} className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all", txFilter === f ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm" : "text-slate-400")}>
                              {f === 'all' ? 'Tất cả' : f === 'income' ? 'Thu' : 'Chi'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        {transactions.length === 0 ? (
                          <EmptyState icon={Receipt} title="Chưa có giao dịch" message="Mọi khoản thu chi sẽ lưu tại đây." className="py-12" />
                        ) : (
                          <div className="space-y-3">
                            {transactions.map(tx => (
                              <TransactionCard key={tx.id} transaction={tx} group={group} memberProfiles={memberProfiles} campaigns={campaigns} isAdmin={canManage} />
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'polls' && (
                  <div className="max-w-4xl mx-auto">
                    <PollTab 
                      groupId={id!} 
                      canManage={canManage} 
                      isMember={isMember || false} 
                      memberProfiles={memberProfiles} 
                      onAddPoll={() => setIsPollModalOpen(true)} 
                    />
                  </div>
                )}

                {activeTab === 'members' && (
                  <div className="space-y-8 max-w-4xl mx-auto">
                    {/* Requests Panel */}
                    {canManage && requests.length > 0 && (
                      <div className="bg-indigo-600 rounded-[40px] p-8 text-white shadow-2xl shadow-indigo-200 dark:shadow-none text-left">
                        <h4 className="font-black text-lg uppercase italic tracking-tighter mb-6 flex items-center gap-3">
                          <UserCheck size={24} /> Đang chờ duyệt ({requests.length})
                        </h4>
                        <div className="grid gap-3 text-left">
                          {requests.map(req => (
                            <div key={req.id} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/10">
                              <div className="flex items-center gap-4 text-left">
                                <div className="w-10 h-10 bg-white/20 rounded-xl overflow-hidden flex items-center justify-center font-black">
                                  {requestProfiles[req.uid]?.photoURL ? <img src={requestProfiles[req.uid].photoURL} alt="" /> : "?"}
                                </div>
                                <div>
                                  <p className="font-black text-sm">{requestProfiles[req.uid]?.displayName || "User"}</p>
                                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Yêu cầu gia nhập</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleRequestAction(req.id, 'approve', req.type, req.uid)} className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest">Duyệt</button>
                                <button onClick={() => handleRequestAction(req.id, 'reject', req.type, req.uid)} className="px-4 py-2 bg-red-400 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">Từ chối</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search and List */}
                    <div className="space-y-4">
                      <div className="relative group">
                        <input type="text" value={memberSearchTerm} onChange={e => setMemberSearchTerm(e.target.value)} placeholder="Tìm theo tên hoặc SĐT..." className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] pl-14 pr-6 py-5 text-sm font-bold text-slate-900 dark:text-white shadow-xl focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none" />
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                      </div>
                      <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden text-left">
                        {paginatedMembers.map((member, i) => (
                          <button key={member.uid} onClick={() => setSelectedMember(member)} className={cn("w-full px-8 py-6 flex items-center gap-6 text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50", i !== paginatedMembers.length - 1 && "border-b border-slate-50 dark:border-slate-800")}>
                            <div className="w-16 h-16 rounded-[24px] overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm">
                              {member.photoURL ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-400">?</div>}
                            </div>
                            <div className="flex-1">
                              <h5 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">{member.displayName}</h5>
                              <div className="flex items-center gap-2">
                                {group.ownerId === member.uid && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">Owner</span>}
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{member.phoneNumber || 'No Phone'}</p>
                              </div>
                            </div>
                            <ChevronRight size={20} className="text-slate-200" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

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
