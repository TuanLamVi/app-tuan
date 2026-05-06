import React, { useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Plus, ListTodo, BarChart3, HelpCircle, 
  Settings2, Trash2, GripVertical 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import Modal from '../ui/Modal';

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

export default function PollModal({ isOpen, onClose, groupId, groupName }: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddOption = () => {
    if (options.length >= 10) {
      toast.error('Tối đa 10 phương án lựa chọn');
      return;
    }
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast.error('Tối thiểu cần 2 phương án lựa chọn');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (value: string, index: number) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (!question.trim()) {
      toast.error('Vui lòng nhập câu hỏi');
      return;
    }

    const validOptions = options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      toast.error('Vui lòng nhập ít nhất 2 phương án lựa chọn');
      return;
    }

    setIsSubmitting(true);
    try {
      const pollData = {
        question: question.trim(),
        groupId,
        createdBy: auth.currentUser.uid,
        creatorName: auth.currentUser.displayName || 'Thành viên',
        allowMultiple,
        options: validOptions.map((text, idx) => ({
          id: `opt-${Date.now()}-${idx}`,
          text: text.trim(),
          voterIds: []
        })),
        createdAt: serverTimestamp(),
        expiresAt: null,
      };

      await addDoc(collection(db, 'groups', groupId, 'polls'), pollData);
      
      toast.success('Đã tạo cuộc bình chọn!');
      onClose();
      // Reset form
      setQuestion('');
      setOptions(['', '']);
      setAllowMultiple(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/polls`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Tạo cuộc bình chọn"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-[24px] flex items-center justify-center text-blue-600">
            <BarChart3 size={32} />
          </div>
          <p className="text-xs text-gray-500 font-medium leading-relaxed">
            Thu thập ý kiến từ các thành viên trong nhóm <b>{groupName}</b>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">Câu hỏi bình chọn</label>
            <div className="relative">
              <input 
                autoFocus
                required
                type="text" 
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="VD: Chúng ta nên đi du lịch ở đâu?"
                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-4 py-4 pl-12 font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
              />
              <HelpCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>

          <div>
             <div className="flex justify-between items-center mb-2 px-1">
               <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Các phương án lựa chọn</label>
               <span className="text-[10px] font-bold text-gray-400">{options.length}/10</span>
             </div>
             <div className="space-y-3">
               {options.map((option, idx) => (
                 <div key={idx} className="flex gap-2">
                   <div className="flex-1 relative">
                     <input 
                       required
                       type="text" 
                       value={option}
                       onChange={e => handleOptionChange(e.target.value, idx)}
                       placeholder={`Lựa chọn ${idx + 1}`}
                       className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-4 py-3 pl-10 font-medium text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                     />
                     <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                       <GripVertical size={14} />
                     </div>
                   </div>
                   {options.length > 2 && (
                     <button 
                       type="button"
                       onClick={() => handleRemoveOption(idx)}
                       className="p-3 text-gray-300 hover:text-red-500 transition-colors"
                     >
                       <Trash2 size={18} />
                     </button>
                   )}
                 </div>
               ))}
               <button 
                 type="button"
                 onClick={handleAddOption}
                 className="w-full py-3 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-blue-600 rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border-2 border-dashed border-transparent hover:border-blue-100 transition-all"
               >
                 <Plus size={14} /> Thêm phương án
               </button>
             </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600">
                <Settings2 size={16} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Cho phép chọn nhiều phương án</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={allowMultiple}
                onChange={e => setAllowMultiple(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <button 
            type="button"
            onClick={onClose}
            className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest"
          >
            Hủy
          </button>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Tạo ngay</>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
