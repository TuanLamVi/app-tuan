import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { X, Flag, Calendar, AlignLeft, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { Group } from '../../models';
import { TransactionRepository } from '../../services/transactionService';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { cn } from '../../core/utils';

interface CampaignModalProps {
  group: Group;
  onClose: () => void;
}

export default function CampaignModal({ group, onClose }: CampaignModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const repository = new TransactionRepository(group.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên chiến dịch');
      return;
    }

    setIsSubmitting(true);
    try {
      await repository.createCampaign({
        name,
        description,
        targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
      });
      toast.success('Đã tạo sự kiện mới');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}/campaigns`);
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
        className="relative bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full text-gray-400">
          <X size={18} />
        </button>

        <div className="mb-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Flag size={24} />
          </div>
          <h3 className="text-xl font-black text-gray-900">Tạo sự kiện mới</h3>
          <p className="text-xs text-gray-400 font-medium">Quản lý ngân sách riêng cho các hoạt động cụ thể</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Tên sự kiện / Chiến dịch</label>
            <div className="relative">
              <input 
                autoFocus
                required
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="VD: Picnic hè 2024, Từ thiện..."
                className="w-full bg-gray-50 border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-blue-500/20 font-bold text-gray-900"
              />
              <Flag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Mô tả chi tiết</label>
            <div className="relative">
              <textarea 
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Kế hoạch thực hiện..."
                className="w-full bg-gray-50 border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-blue-500/20 font-medium text-gray-900 resize-none"
              />
              <AlignLeft className="absolute left-4 top-6 text-gray-300" size={18} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Mục tiêu (không bắt buộc)</label>
            <div className="relative">
              <input 
                type="number" 
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-gray-50 border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-blue-500/20 font-black text-gray-900"
              />
              <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Đang tạo...' : 'Xác nhận tạo sự kiện'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
