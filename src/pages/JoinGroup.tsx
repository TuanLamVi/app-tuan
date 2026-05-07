import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc, collection, serverTimestamp, query, where, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { Group, UserProfile } from '../models';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';
import { Users, Shield, Crown, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../core/utils';
import { NotificationService } from '../services/notificationService';

export default function JoinGroup() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'groups', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setGroup({ id: snap.id, ...snap.data() } as Group);
        } else {
          toast.error('Không tìm thấy nhóm này');
        }
      } catch (error) {
        toast.error('Lỗi khi tải thông tin nhóm');
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [id]);

  const handleJoin = async () => {
    if (!user || !group || !id) {
       navigate('/login');
       return;
    }

    if (group.members.includes(user.uid)) {
      toast.success('Bạn đã là thành viên của nhóm này');
      navigate(`/group/${id}`);
      return;
    }

    setIsJoining(true);
    try {
      const isApprovalRequired = group.settings?.requireApproval !== false;
      const isPreInvitedByString = (user.email && group.pendingInvites?.includes(user.email)) || 
                           (user.phoneNumber && group.pendingInvites?.includes(user.phoneNumber));
      
      // Check for invitation request for this specific logged in user
      const reqQuery = query(collection(db, 'groups', id!,'requests'), where('uid', '==', user.uid), where('status', '==', 'invited'));
      const reqSnap = await getDocs(reqQuery);
      const isPreInvitedByUser = !reqSnap.empty;

      const isPreInvited = isPreInvitedByString || isPreInvitedByUser;

      if (!isApprovalRequired || isPreInvited) {
        // Direct join
        const groupRef = doc(db, 'groups', id!);
        const removeList = [user.email, user.phoneNumber].filter(Boolean) as string[];
        await updateDoc(groupRef, {
          members: arrayUnion(user.uid),
          ...(isPreInvitedByString && removeList.length > 0 ? { pendingInvites: arrayRemove(...removeList) } : {})
        });
        
        // Delete invitation request if it exists
        if (isPreInvitedByUser) {
          reqSnap.forEach(async (d) => {
            await deleteDoc(d.ref);
          });
        }

        toast.success('Đã tham gia nhóm thành công!');
        navigate(`/group/${id}`);
        return;
      }
      
      // Send a join request instead of joining directly
      const requestRef = doc(db, 'groups', id!, 'requests', user.uid);
      // Check if already requested
      const existingReqSnap = await getDoc(requestRef);
      
      if (existingReqSnap.exists() && (existingReqSnap.data() as any).status === 'pending') {
        toast.error('Bạn đã gửi yêu cầu tham gia rồi');
        return;
      }

      await setDoc(requestRef, {
        uid: user.uid,
        groupId: id,
        type: 'join',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      // Notify owner
      await NotificationService.sendNotification(group.ownerId, {
        title: 'Yêu cầu tham gia mới',
        message: `Người dùng ${user.displayName || 'mới'} muốn tham gia nhóm "${group.name}".`,
        type: 'invite',
        data: { groupId: id }
      });

      toast.success('Đã gửi yêu cầu tham gia! Chờ Admin duyệt.');
      setIsJoining(false); // keep it disabled or navigate away
    } catch (error) {
      toast.error('Lỗi khi gửi yêu cầu tham gia');
    } finally {
      setIsJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-6 text-center">
        <XCircle className="text-red-500 mb-4" size={64} />
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Không tìm thấy nhóm</h2>
        <p className="text-gray-500 mb-8">Liên kết có thể đã hết hạn hoặc không tồn tại.</p>
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-blue-600 font-bold"
        >
          <ArrowLeft size={18} /> Quay lại trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-[40px] p-8 shadow-2xl text-center"
      >
        <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-[32px] mx-auto mb-6 flex items-center justify-center text-blue-600 dark:text-blue-400 border-4 border-white dark:border-gray-800 shadow-xl overflow-hidden font-black text-3xl">
           {group.name?.[0]}
        </div>

        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{group.name}</h2>
        <p className="text-gray-500 text-sm mb-6 line-clamp-2">{group.description || 'Tham gia cùng chúng tôi để quản lý thu chi hiệu quả hơn!'}</p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-3xl">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Thành viên</p>
            <p className="font-black text-gray-900 dark:text-white flex items-center justify-center gap-1.5">
              <Users size={14} className="text-blue-500" />
              {group.members?.length || 0}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-3xl">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Số dư</p>
            <p className="font-black text-green-600">
              {formatCurrency(group.balance || 0)}
            </p>
          </div>
        </div>

        {user ? (
          <button 
            onClick={handleJoin}
            disabled={isJoining}
            className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-transform disabled:opacity-50"
          >
            {isJoining ? 'Đang xử lý...' : (group.members.includes(user.uid) ? 'Vào nhóm ngay' : 'Tham gia nhóm')}
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Vui lòng đăng nhập để tham gia nhóm</p>
            <button 
              onClick={() => navigate('/login', { state: { from: `/join/${id}` } })}
              className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-transform"
            >
              Đăng nhập ngay
            </button>
          </div>
        )}

        <button 
          onClick={() => navigate('/')}
          className="mt-6 text-gray-400 hover:text-gray-600 text-[10px] font-black uppercase tracking-widest transition-colors"
        >
          Để sau
        </button>
      </motion.div>
    </div>
  );
}
