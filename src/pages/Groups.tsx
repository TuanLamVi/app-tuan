import React from 'react';
import { useGroups } from '../hooks/useGroups';
import { motion } from 'motion/react';
import { Users, Search, Plus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Groups() {
  const { groups, loading } = useGroups();

  return (
    <div className="p-4 md:p-8 space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <header className="flex justify-between items-end px-2">
        <div className="space-y-1">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Vũ trụ nhóm</h2>
          <p className="text-xs text-slate-500 font-medium tracking-wide">Quản trị tất cả không gian làm việc của bạn</p>
        </div>
        <Link to="/create-group" className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
          <Plus size={24} />
        </Link>
      </header>

      <div className="relative group/search">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-slate-400 group-focus-within/search:text-indigo-600 transition-colors" />
        </div>
        <input 
          type="text" 
          placeholder="Tìm kiếm nhóm..." 
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-medium text-slate-900 dark:text-white transition-all shadow-sm placeholder:text-slate-400"
        />
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
             <div className="w-12 h-12 border-3 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
             <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Đang khởi tạo...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="py-20 text-center space-y-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl mx-auto flex items-center justify-center shadow-sm">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">Không có dữ liệu</h4>
              <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">Hãy bắt đầu bằng cách tạo không gian nhóm đầu tiên của bạn.</p>
              <Link to="/create-group" className="inline-flex h-11 px-8 items-center justify-center bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 mt-4 transition-transform active:scale-95">Tạo ngay</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {groups.map(group => (
              <Link 
                key={group.id} 
                to={`/group/${group.id}`}
                className="group bg-white dark:bg-slate-900 p-6 rounded-2xl flex items-center gap-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
              >
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner group-hover:scale-105 transition-transform duration-500 shrink-0">
                  {group.coverImage ? (
                    <img src={group.coverImage} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <Users size={24} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 dark:text-white text-lg truncate group-hover:text-indigo-600 transition-colors mb-1">{group.name}</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Users size={14} />
                      <p className="text-[11px] font-bold uppercase tracking-tight">{group.members?.length || 0} thành viên</p>
                    </div>
                  </div>
                </div>
                <div className="w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:translate-x-1">
                   <ChevronRight size={20} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
