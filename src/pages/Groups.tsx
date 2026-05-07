import React from 'react';
import { useGroups } from '../hooks/useGroups';
import { motion } from 'motion/react';
import { Users, Search, Plus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Groups() {
  const { groups, loading } = useGroups();

  return (
    <div className="p-6 space-y-10 animate-in fade-in slide-in-from-bottom-12 duration-1000">
      <header className="flex justify-between items-end px-2">
        <div className="space-y-2">
          <h2 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter font-display italic uppercase leading-none">VŨ TRỤ</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.4em]">Khám phá các không gian của bạn</p>
        </div>
        <Link to="/create-group" className="w-14 h-14 flex items-center justify-center bg-gray-900 dark:bg-white text-white dark:text-gray-950 rounded-[18px] shadow-[4px_4px_0px_rgba(37,99,235,1)] active:scale-90 transition-all border-2 border-gray-900 dark:border-white">
          <Plus size={28} />
        </Link>
      </header>

      <div className="relative group">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
        </div>
        <input 
          type="text" 
          placeholder="Tìm kiếm hành tinh..." 
          className="w-full bg-white dark:bg-black border-2 border-gray-900 dark:border-white rounded-[24px] pl-16 pr-6 py-5 focus:outline-none focus:ring-4 focus:ring-blue-500/20 font-black text-sm text-gray-900 dark:text-white transition-all shadow-[8px_8px_0px_rgba(0,0,0,0.05)] dark:shadow-[8px_8px_0px_rgba(255,255,255,0.05)] placeholder:text-gray-400 dark:placeholder:text-gray-700 uppercase tracking-widest italic"
        />
      </div>

      <div className="space-y-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
             <div className="w-14 h-14 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin" />
             <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Đang khởi tạo...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="py-20 text-center space-y-6">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-[40px] mx-auto flex items-center justify-center rotate-6">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-700" />
            </div>
            <div className="space-y-4">
              <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic font-display">KHÔNG CÓ TÍN HIỆU</h4>
              <p className="text-[10px] text-gray-400 font-bold max-w-[200px] mx-auto leading-relaxed uppercase tracking-widest">Bắt đầu bằng cách tạo một không gian mới cho nhóm của bạn.</p>
              <Link to="/create-group" className="inline-flex h-12 px-8 items-center justify-center bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/30">Tạo ngay</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-8">
            {groups.map(group => (
              <Link 
                key={group.id} 
                to={`/group/${group.id}`}
                className="group bg-white dark:bg-gray-900 p-8 rounded-[40px] flex items-center gap-8 border-2 border-gray-900 dark:border-white shadow-[10px_10px_0px_rgba(0,0,0,1)] dark:shadow-[10px_10px_0px_rgba(255,255,255,1)] hover:translate-y-[-6px] hover:translate-x-[-2px] hover:shadow-[16px_16px_0px_rgba(37,99,235,0.4)] transition-all duration-300"
              >
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-3xl flex items-center justify-center text-blue-600 overflow-hidden border-2 border-gray-900 dark:border-white shadow-xl rotate-[-3deg] group-hover:rotate-0 transition-transform duration-500">
                  {group.coverImage ? (
                    <img src={group.coverImage} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <Users size={32} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-gray-900 dark:text-white text-2xl font-display truncate uppercase italic tracking-tighter leading-none mb-3">{group.name}</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <Users className="w-3 h-3 text-gray-900 dark:text-white" />
                      <p className="text-[9px] text-gray-900 dark:text-white font-black uppercase tracking-widest">{group.members?.length || 0} MV</p>
                    </div>
                  </div>
                </div>
                <div className="w-12 h-12 flex items-center justify-center bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-[14px] group-hover:bg-blue-600 group-hover:text-white transition-all">
                   <ChevronRight size={24} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
