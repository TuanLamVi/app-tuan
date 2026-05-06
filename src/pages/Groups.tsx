import React from 'react';
import { useGroups } from '../hooks/useGroups';
import { motion } from 'motion/react';
import { Users, Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Groups() {
  const { groups, loading } = useGroups();

  return (
    <div className="p-4 space-y-6">
      <header className="flex justify-between items-center px-1">
        <h2 className="text-2xl font-black">Nhóm của bạn</h2>
        <Link to="/create-group" className="p-2 bg-gray-100 rounded-xl text-gray-900">
          <Plus size={20} />
        </Link>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          placeholder="Tìm kiếm nhóm..." 
          className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/10 font-medium"
        />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Đang tải...</div>
        ) : groups.length === 0 ? (
          <div className="p-10 text-center text-gray-400 italic">Bạn chưa gia nhập nhóm nào.</div>
        ) : (
          groups.map(group => (
            <Link 
              key={group.id} 
              to={`/group/${group.id}`}
              className="bg-white p-4 rounded-3xl flex items-center gap-4 border border-gray-50 shadow-sm"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                <Users size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900">{group.name}</h4>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{group.members?.length || 0} thành viên</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
