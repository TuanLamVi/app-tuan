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
    <div className="p-4 flex flex-col min-h-screen">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold">Tạo nhóm mới</h2>
      </header>

      <form onSubmit={handleCreate} className="space-y-6 flex-1">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-gray-400 tracking-wider ml-1">
            Tên nhóm
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Nhóm Phượt 2024"
            className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-gray-400 tracking-wider ml-1">
            Mô tả
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ghi chú về nhóm của bạn..."
            className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium min-h-[120px]"
          />
        </div>

        <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100/50 flex items-start gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-blue-900 text-sm">Chỉ bạn mới thấy</h4>
            <p className="text-blue-700/70 text-xs mt-1">
              Bạn sẽ là người sáng lập (Owner). Bạn có thể mời thêm Admin sau khi tạo nhóm.
            </p>
          </div>
        </div>

        <div className="flex-1" />

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-blue-600 text-white rounded-2xl py-4 font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
        >
          {loading ? 'Đang tạo...' : 'Xác nhận tạo nhóm'}
        </button>
      </form>
    </div>
  );
}
