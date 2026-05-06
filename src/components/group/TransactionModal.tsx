import React, { useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { 
  X, ArrowUpCircle, ArrowDownCircle, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Campaign, Transaction, Group } from '../../models';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { cn } from '../../core/utils';

import { TransactionRepository } from '../../services/transactionService';

interface TransactionModalProps {
  group: Group;
  campaigns: Campaign[];
  onClose: () => void;
  isAdmin: boolean;
}

export default function TransactionModal({ group, campaigns, onClose, isAdmin }: TransactionModalProps) {
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const repository = new TransactionRepository(group.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !amount || parseFloat(amount) <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    setIsSubmitting(true);
    const numAmount = parseFloat(amount);
    
    try {
      const transactionData = {
        amount: numAmount,
        type,
        category,
        description,
        campaignId: selectedCampaignId || null,
        createdBy: auth.currentUser.uid,
      };

      if (isAdmin) {
        await repository.executeTransaction(transactionData);
        toast.success(type === 'income' ? 'Đã thu tiền thành công' : 'Đã chi tiền thành công');
      } else {
        await repository.createProposal(transactionData);
        toast.success('Đã gửi đề xuất giao dịch cho Quản trị viên');
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}/transactions`);
    } finally {
      setIsSubmitting(false);
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
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl overflow-hidden"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full text-gray-400">
          <X size={18} />
        </button>

        <h3 className="text-xl font-black text-gray-900 mb-6">{isAdmin ? 'Tạo giao dịch' : 'Đề xuất thu/chi'}</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex bg-gray-100 p-1 rounded-2xl">
            <button 
              type="button"
              onClick={() => setType('income')}
              className={cn(
                "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                type === 'income' ? "bg-white text-green-600 shadow-sm" : "text-gray-400"
              )}
            >
              <ArrowUpCircle size={14} /> Thu tiền
            </button>
            <button 
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                type === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-gray-400"
              )}
            >
              <ArrowDownCircle size={14} /> Chi tiền
            </button>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Số tiền ({group.currency || 'VNĐ'})</label>
            <input 
              required
              type="number" 
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-gray-50 border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-blue-500/20 font-black text-lg text-gray-900"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Mục đích / Danh mục</label>
            <input 
              required
              type="text" 
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="VD: Đóng góp hoạt động, Mua đồ dùng..."
              className="w-full bg-gray-50 border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-blue-500/20 font-bold text-gray-900"
            />
          </div>

          {campaigns.length > 0 && (
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Sự kiện liên quan (Tuỳ chọn)</label>
              <select 
                value={selectedCampaignId}
                onChange={e => setSelectedCampaignId(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-blue-500/20 font-bold text-gray-900 appearance-none"
              >
                <option value="">Hoạt động chung của nhóm</option>
                {campaigns.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Ghi chú</label>
            <textarea 
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Chi tiết thêm về giao dịch..."
              className="w-full bg-gray-50 border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-blue-500/20 font-medium text-gray-900 resize-none"
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-xl transition-all disabled:opacity-50",
              type === 'income' ? "bg-green-600 shadow-green-100" : "bg-red-600 shadow-red-100"
            )}
          >
            {isSubmitting ? 'Đang xử lý...' : isAdmin ? 'Xác nhận giao dịch' : 'Gửi đề xuất'}
          </button>

          {!isAdmin && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl text-blue-600">
              <AlertCircle size={14} className="flex-shrink-0" />
              <p className="text-[10px] font-bold">Giao dịch của bạn sẽ được gửi đến Quản trị viên để phê duyệt trước khi cập nhật số dư nhóm.</p>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}
