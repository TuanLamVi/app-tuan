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
      "bg-white dark:bg-gray-900 rounded-[32px] border p-6 transition-all relative overflow-hidden group",
      isClosed ? "border-gray-100 dark:border-gray-800 opacity-60" : "border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1"
    )}>
      {!isClosed && (
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all" />
      )}
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm",
            isClosed ? "bg-gray-100 text-gray-400" : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
          )}>
            <Flag size={24} />
          </div>
          <div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white font-display tracking-tight leading-tight uppercase italic">{campaign.name}</h4>
            <div className="flex items-center gap-2 mt-1">
               <span className={cn(
                 "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg tracking-widest border",
                 isClosed ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-emerald-50 text-emerald-600 border-emerald-100"
               )}>
                 {isClosed ? 'Đã chốt' : 'Hoạt động'}
               </span>
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{formatDate(campaign.createdAt)}</span>
            </div>
          </div>
        </div>
        
        {isAdmin && !isClosed && (
          <button 
            onClick={handleSettle}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all shadow-sm active:scale-95"
            title="Hoàn tất sự kiện"
          >
            <CheckCircle size={20} />
          </button>
        )}
      </div>

      {campaign.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-2 leading-relaxed italic">"{campaign.description}"</p>
      )}

      <div className="space-y-6 relative z-10">
        <div className="bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-[24px] p-5 flex items-center justify-between border border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-2">
              {isClosed ? 'Số tiền chốt' : 'Số dư hiện tại'}
            </p>
            <p className="text-xl font-black text-gray-900 dark:text-white font-display tabular-nums tracking-tight">
              {formatCurrency(isClosed ? (campaign.settledBalance ?? campaign.balance) : campaign.balance)}
            </p>
          </div>
          <div className="text-right">
             <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-2">Mục tiêu</p>
             <p className="font-bold text-gray-400 dark:text-gray-600 tabular-nums">{campaign.targetAmount ? formatCurrency(campaign.targetAmount) : '--'}</p>
          </div>
        </div>

        {campaign.targetAmount && !isClosed && (
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <div className="flex items-center gap-1.5 text-blue-600">
                <Target size={12} />
                <span>Tiến độ mục tiêu</span>
              </div>
              <span className="text-gray-400 font-display tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner p-0.5">
               <div 
                 className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000 shadow-sm"
                 style={{ width: `${Math.min(progress, 100)}%` }}
               />
            </div>
          </div>
        )}
      </div>

      {isClosed && (
        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 text-gray-400">
           <AlertCircle size={16} />
           <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Sự kiện đã hoàn tất. Số dư đã được quy về quỹ chung.</p>
        </div>
      )}
    </div>
  );
};

export default CampaignCard;
