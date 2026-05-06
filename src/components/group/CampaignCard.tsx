import React from 'react';
import { Campaign, Group } from '../../models';
import { formatCurrency, cn, formatDate } from '../../core/utils';
import { Flag, Trash2, CheckCircle, Target, TrendingUp, AlertCircle } from 'lucide-react';
import { TransactionRepository } from '../../services/transactionService';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';

interface CampaignCardProps {
  campaign: Campaign;
  group: Group;
  isAdmin: boolean;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, group, isAdmin }) => {
  const repository = new TransactionRepository(group.id);
  const isClosed = campaign.status === 'closed';
  const progress = campaign.targetAmount ? (campaign.balance / campaign.targetAmount) * 100 : 0;

  const handleSettle = async () => {
    if (!isAdmin || isClosed) return;
    if (!window.confirm(`Bạn có chắc muốn hoàn tất sự kiện "${campaign.name}"? Sau khi hoàn tất sẽ không thể ghi nhận thêm giao dịch.`)) return;

    try {
      await repository.settleCampaign(campaign.id, campaign.balance);
      toast.success('Đã hoàn tất sự kiện');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}/campaigns/${campaign.id}`);
    }
  };

  return (
    <div className={cn(
      "bg-white rounded-3xl border p-5 transition-all",
      isClosed ? "border-gray-100 opacity-80" : "border-gray-100 shadow-sm hover:shadow-md"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            isClosed ? "bg-gray-100 text-gray-400" : "bg-blue-50 text-blue-600"
          )}>
            <Flag size={20} />
          </div>
          <div>
            <h4 className="font-bold text-gray-900">{campaign.name}</h4>
            <div className="flex items-center gap-2">
               <span className={cn(
                 "text-[8px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider",
                 isClosed ? "bg-gray-100 text-gray-400" : "bg-green-100 text-green-600"
               )}>
                 {isClosed ? 'Đã đóng' : 'Đang hoạt động'}
               </span>
               <span className="text-[10px] text-gray-400 font-bold">{formatDate(campaign.createdAt)}</span>
            </div>
          </div>
        </div>
        
        {isAdmin && !isClosed && (
          <button 
            onClick={handleSettle}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
            title="Hoàn tất sự kiện"
          >
            <CheckCircle size={18} />
          </button>
        )}
      </div>

      {campaign.description && (
        <p className="text-xs text-gray-500 mb-4 line-clamp-2">{campaign.description}</p>
      )}

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">
              {isClosed ? 'Số tiền chốt' : 'Số dư hiện tại'}
            </p>
            <p className="font-black text-gray-900">{formatCurrency(isClosed ? (campaign.settledBalance ?? campaign.balance) : campaign.balance)}</p>
          </div>
          <div className="text-right">
             <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">Mục tiêu</p>
             <p className="font-bold text-gray-400">{campaign.targetAmount ? formatCurrency(campaign.targetAmount) : '--'}</p>
          </div>
        </div>

        {campaign.targetAmount && !isClosed && (
          <div className="space-y-1.5 px-1">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
              <span className="text-blue-600">Tiến độ</span>
              <span className="text-gray-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                 style={{ width: `${Math.min(progress, 100)}%` }}
               />
            </div>
          </div>
        )}
      </div>

      {isClosed && (
        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-gray-400">
           <AlertCircle size={14} />
           <p className="text-[10px] font-bold">Số tiền này hiện đã thuộc về số dư chung của nhóm.</p>
        </div>
      )}
    </div>
  );
};

export default CampaignCard;
