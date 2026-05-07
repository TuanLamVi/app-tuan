import React, { useState } from 'react';
import { UserProfile, Group } from '../../models';
import { auth, db } from '../../lib/firebase';
import { doc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { 
  X, Phone, MapPin, Shield, UserMinus, UserCheck, 
  Crown, ExternalLink, MessageCircle, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { cn } from '../../core/utils';
import { NotificationService } from '../../services/notificationService';

interface MemberDetailsModalProps {
  member: UserProfile;
  group: Group;
  onClose: () => void;
  canManage: boolean;
  isOwner: boolean;
}

export default function MemberDetailsModal({ member, group, onClose, canManage, isOwner }: MemberDetailsModalProps) {
  const currentUser = auth.currentUser;
  const isMemberOwner = member.uid === group.ownerId;
  const isMemberDeputy = group.deputies?.includes(member.uid);
  const isMe = currentUser?.uid === member.uid;
  const [isSubmitting, setIsSubmitting] = useState<'deputy' | 'remove' | 'transfer' | null>(null);

  const handleToggleDeputy = async () => {
    if (!isOwner) return;
    setIsSubmitting('deputy');
    try {
      const groupRef = doc(db, 'groups', group.id);
      if (isMemberDeputy) {
        await updateDoc(groupRef, { deputies: arrayRemove(member.uid) });
        await NotificationService.sendNotification(member.uid, {
          title: 'Thay đổi quyền hạn',
          message: `Bạn đã được gỡ quyền Phó nhóm trong "${group.name}"`,
          type: 'system'
        });
        toast.success('Đã gỡ quyền phó nhóm');
      } else {
        await updateDoc(groupRef, { deputies: arrayUnion(member.uid) });
        await NotificationService.sendNotification(member.uid, {
          title: 'Thăng chức',
          message: `Bạn vừa được bổ nhiệm làm Phó nhóm trong "${group.name}"`,
          type: 'system'
        });
        toast.success('Đã bổ nhiệm phó nhóm');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}`);
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!canManage || isMemberOwner || (isMemberDeputy && !isOwner)) return;
    if (!window.confirm(`Bạn có chắc muốn mời ${member.displayName} ra khỏi nhóm?`)) return;

    setIsSubmitting('remove');
    try {
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, {
        members: arrayRemove(member.uid),
        deputies: arrayRemove(member.uid)
      });
      await NotificationService.sendNotification(member.uid, {
        title: 'Rời nhóm',
        message: `Bạn đã bị mời ra khỏi nhóm "${group.name}"`,
        type: 'system'
      });
      toast.success('Đã xóa thành viên');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}`);
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleTransferOwnership = async () => {
    if (!isOwner || isMe) return;
    if (!window.confirm(`Bạn có chắc muốn nhường chức Trưởng nhóm cho ${member.displayName}? Thành viên này cần xác nhận để hoàn tất.`)) return;

    setIsSubmitting('transfer');
    try {
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, {
        pendingOwner: member.uid
      });
      await NotificationService.sendNotification(member.uid, {
        title: 'Nhường chức Trưởng nhóm',
        message: `Trưởng nhóm "${group.name}" muốn nhường chức cho bạn. Vui lòng xác nhận.`,
        type: 'transfer',
        data: { groupId: group.id }
      });
      toast.success('Đã gửi yêu cầu nhường chức');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}`);
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white dark:bg-gray-900 w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 z-10 transition-colors">
          <X size={18} />
        </button>

        <div className="bg-gradient-to-b from-blue-50/50 dark:from-blue-900/20 to-white dark:to-gray-900 pt-12 pb-8 px-6 text-center">
          <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-[32px] mx-auto mb-4 border-4 border-white dark:border-gray-800 shadow-xl overflow-hidden flex items-center justify-center">
            {member.photoURL ? (
              <img src={member.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-3xl font-black text-blue-200 dark:text-blue-800">{member.displayName?.[0]}</div>
            )}
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">{member.displayName}</h3>
          <div className="flex items-center justify-center gap-1.5">
            {isMemberOwner ? (
               <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase px-1.5 py-1 rounded-lg tracking-wider flex items-center">
                 <Crown size={10} />
               </span>
            ) : isMemberDeputy ? (
               <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider flex items-center gap-1">
                 <Shield size={10} /> Phó nhóm
               </span>
            ) : (
               <span className="bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-[9px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider">Thành viên</span>
            )}
          </div>
        </div>

        <div className="px-8 pb-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                <Mail size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest leading-none mb-1">Email</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{member.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0">
                <Phone size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest leading-none mb-1">Số điện thoại</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{member.phoneNumber || 'Chưa cập nhật'}</p>
              </div>
              {member.phoneNumber && (
                <div className="flex gap-2">
                  <a href={`tel:${member.phoneNumber}`} className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-green-600 dark:text-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/30 transition-colors shadow-sm">
                    <Phone size={16} />
                  </a>
                  <a href={`https://zalo.me/${member.phoneNumber}`} target="_blank" rel="noreferrer" className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 transition-colors shadow-sm">
                    <MessageCircle size={16} />
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-400 flex-shrink-0">
                <MapPin size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest leading-none mb-1">Địa chỉ</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{member.address || 'Chưa cập nhật'}</p>
              </div>
            </div>
          </div>

          {!isMe && canManage && (
            <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={14} className="text-gray-400" />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Quyền hạn Quản trị viên</p>
              </div>
              
              <div className="grid gap-3">
                {isOwner && !isMemberOwner && (
                  <>
                    <button 
                      onClick={handleToggleDeputy}
                      disabled={isSubmitting !== null}
                      className={cn(
                        "w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 border-2",
                        isMemberDeputy 
                          ? "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100" 
                          : "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
                      )}
                    >
                      {isSubmitting === 'deputy' ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          {isMemberDeputy ? <UserMinus size={16} /> : <UserCheck size={16} />}
                          <span>{isMemberDeputy ? 'Gỡ chức vụ Phó nhóm' : 'Thăng cấp thành Phó nhóm'}</span>
                        </>
                      )}
                    </button>

                    <button 
                      onClick={handleTransferOwnership}
                      disabled={isSubmitting !== null}
                      className="w-full py-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 border-2 border-transparent hover:border-orange-100"
                    >
                      {isSubmitting === 'transfer' ? (
                        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Crown size={16} />
                          <span>Chuyển nhượng quyền Trưởng nhóm</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {((isOwner && !isMemberOwner) || (!isMemberOwner && !isMemberDeputy)) && (
                  <button 
                    onClick={handleRemoveMember}
                    disabled={isSubmitting !== null}
                    className="w-full py-4 bg-white dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 border-2 border-red-50 dark:border-red-900/10 hover:border-red-100"
                  >
                    {isSubmitting === 'remove' ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <UserMinus size={16} />
                        <span>Mời rời khỏi nhóm</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
