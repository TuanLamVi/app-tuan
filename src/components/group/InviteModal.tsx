import React, { useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, serverTimestamp, addDoc, setDoc } from 'firebase/firestore';
import { Search, UserPlus, X, Mail, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Group } from '../../models';
import { toast } from 'react-hot-toast';
import { cn } from '../../core/utils';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';

import { NotificationService } from '../../services/notificationService';

interface InviteModalProps {
  group: Group;
  onClose: () => void;
  isAdmin: boolean;
}

export default function InviteModal({ group, onClose, isAdmin }: InviteModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term || searching) return;

    setSearching(true);
    try {
      let targetUser: UserProfile | null = null;
      
      // Try searching by email
      const qEmail = query(collection(db, 'users'), where('email', '==', term.toLowerCase()));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        targetUser = snapEmail.docs[0].data() as UserProfile;
      } else {
        // Try searching by phone number with normalization
        let phoneTerm = term;
        if (phoneTerm.startsWith('0') && phoneTerm.length >= 10) {
          phoneTerm = '+84' + phoneTerm.substring(1);
        }

        const qPhone = query(collection(db, 'users'), where('phoneNumber', 'in', [term, phoneTerm]));
        const snapPhone = await getDocs(qPhone);
        if (!snapPhone.empty) {
          targetUser = snapPhone.docs[0].data() as UserProfile;
        }
      }

      const groupRef = doc(db, 'groups', group.id);

      if (targetUser) {
        // User exists in system
        if (group.members.includes(targetUser.uid)) {
          toast.error('Người này đã là thành viên');
          setSearching(false);
          return;
        }

        setIsSubmitting(targetUser.uid);
        
        if (isAdmin) {
          try {
            await setDoc(doc(db, 'groups', group.id, 'requests', targetUser.uid), {
              uid: targetUser.uid,
              groupId: group.id,
              type: 'invite',
              status: 'invited', // Directly invited by admin, no approval needed
              invitedBy: auth.currentUser?.uid || group.ownerId,
              createdAt: serverTimestamp()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `groups/${group.id}/requests`);
            return;
          }
          
          await NotificationService.sendNotification(targetUser.uid, {
            title: 'Mời vào nhóm',
            message: `Bạn được mời tham gia nhóm "${group.name}"`,
            type: 'invite',
            data: { groupId: group.id }
          });

          toast.success(`Đã gửi lời mời tới ${targetUser.displayName}`);
        } else {
          try {
            await setDoc(doc(db, 'groups', group.id, 'requests', targetUser.uid), {
              uid: targetUser.uid,
              groupId: group.id,
              type: 'invite',
              status: 'pending',
              invitedBy: auth.currentUser?.uid || group.ownerId,
              createdAt: serverTimestamp()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `groups/${group.id}/requests`);
            return;
          }
          
          await NotificationService.sendNotification(group.ownerId, {
            title: 'Yêu cầu mời thành viên',
            message: `${auth.currentUser?.displayName || 'Thành viên'} muốn mời ${targetUser.displayName} vào nhóm "${group.name}".`,
            type: 'invite',
            data: { groupId: group.id }
          });

          toast.success('Đã gửi yêu cầu mời thành viên. Chờ Admin duyệt.');
        }
      } else {
        // User NOT found - add to pendingInvites (record the invite)
        setIsSubmitting('pending');
        if (isAdmin) {
          try {
            await updateDoc(groupRef, {
              pendingInvites: arrayUnion(term)
            });
          } catch (err) {
             handleFirestoreError(err, OperationType.WRITE, `groups/${group.id}`);
             return;
          }
          toast.success(`Đã lưu lời mời cho ${term}. Khi người này đăng ký sẽ được vào nhóm.`);
        } else {
          try {
            await addDoc(collection(db, 'groups', group.id, 'requests'), {
              inviteeIdentifier: term,
              groupId: group.id,
              type: 'invite',
              status: 'pending',
              invitedBy: auth.currentUser?.uid || group.ownerId,
              createdAt: serverTimestamp()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `groups/${group.id}/requests`);
            return;
          }
          toast.success('Yêu cầu mời người mới đã được gửi tới Admin');
        }
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi không xác định khi thực hiện mời');
    } finally {
      setSearching(false);
      setIsSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 100 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 100 }}
        className="relative bg-white dark:bg-gray-900 w-full max-w-sm rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="overflow-y-auto p-6 md:p-8 no-scrollbar">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 z-10">
            <X size={18} />
          </button>

          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 pr-8">Mời thành viên</h3>
          <p className="text-xs text-gray-400 mb-6 font-medium">Nhập Email hoặc SĐT người dùng để mời.</p>
          
          <form onSubmit={handleSendInvite} className="space-y-4 mb-8">
          <div className="relative">
            <input 
              autoFocus
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Email hoặc Số điện thoại..."
              className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-gray-900 dark:text-white shadow-inner"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>
          <button 
            type="submit"
            disabled={searching || isSubmitting !== null || !searchTerm.trim()}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {searching || isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus size={16} />
                <span>Gửi lời mời</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest mb-3 text-center">Hoặc mời bằng liên kết</p>
          <button 
            onClick={() => {
              const url = window.location.origin + '/join/' + group.id;
              navigator.clipboard.writeText(url);
              toast.success('Đã sao chép liên kết mời!');
            }}
            className="w-full py-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest border border-dashed border-gray-200 dark:border-gray-700 transition-all"
          >
            <CheckCircle2 size={16} /> Sao chép link mời
          </button>
        </div>
        </div>
      </motion.div>
    </div>
  );
}
