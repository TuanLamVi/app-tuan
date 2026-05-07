import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Group } from '../models';
import { toast } from 'react-hot-toast';
import { Users, Layout, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export default function CreateGroup() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const groupId = uuidv4();
      const batch = writeBatch(db);

      const newGroup: Group = {
        id: groupId,
        name,
        description,
        ownerId: auth.currentUser.uid,
        deputies: [],
        members: [auth.currentUser.uid],
        totalFund: 0,
        currency: 'VND',
        pendingInvites: [],
        createdAt: new Date(),
      };

      await setDoc(doc(db, 'groups', groupId), newGroup);
      toast.success('Tạo nhóm thành công!');
      navigate(`/group/${groupId}`);
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi tạo nhóm.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-6 mb-12">
        <button 
          onClick={() => navigate(-1)} 
          className="w-12 h-12 flex items-center justify-center bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:scale-110 active:scale-90 transition-all text-gray-900 dark:text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase font-display italic leading-none">Kiến tạo</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">Bắt đầu không gian mới</p>
        </div>
      </header>

      <form onSubmit={handleCreate} className="space-y-8 flex-1">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] ml-1 block">
            Định danh nhóm
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
              <Users className="w-5 h-5 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Dream Team 2024"
              className="w-full bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-[32px] pl-16 pr-6 py-5 focus:outline-none focus:border-blue-500 font-black text-base text-gray-900 dark:text-white transition-all shadow-sm focus:shadow-xl focus:shadow-blue-500/5 placeholder:text-gray-200 dark:placeholder:text-gray-800"
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] ml-1 block">
            Tầm nhìn & Sứ mệnh
          </label>
          <div className="relative group">
            <div className="absolute left-6 top-6 pointer-events-none">
              <Layout className="w-5 h-5 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú về mục tiêu hoặc cam kết chung của nhóm..."
              className="w-full bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-[32px] pl-16 pr-6 py-5 focus:outline-none focus:border-blue-500 font-medium text-sm text-gray-900 dark:text-gray-300 transition-all shadow-sm focus:shadow-xl focus:shadow-blue-500/5 placeholder:text-gray-200 dark:placeholder:text-gray-800 min-h-[160px] resize-none"
            />
          </div>
        </div>

        <div className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[40px] text-white shadow-xl shadow-blue-500/20 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-lg">
              <Users size={24} />
            </div>
            <div>
              <h4 className="font-black text-sm uppercase tracking-widest italic leading-none mb-1.5">Quyền hạn sáng lập</h4>
              <p className="text-[10px] text-blue-100 font-bold uppercase tracking-wider opacity-80">Chỉ mình bạn mới có quyền này</p>
            </div>
          </div>
          
          <p className="text-xs text-blue-50/80 font-medium leading-relaxed italic">
            "Bạn sẽ bắt đầu với tư cách là Chủ sở hữu (Owner). Sau khi nhóm được khởi tạo, bạn có thể thiết lập thêm Đội ngũ quản trị để cùng vận hành không gian này."
          </p>
        </div>

        <div className="flex-1" />

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-950 rounded-[32px] py-6 font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-gray-400 dark:shadow-none hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale italic"
        >
          {loading ? 'Đang khởi tạo...' : 'Kích hoạt không gian'}
        </button>
      </form>
    </div>
  );
}
