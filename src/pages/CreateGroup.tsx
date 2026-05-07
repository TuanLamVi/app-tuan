import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Group } from '../models';
import { toast } from 'react-hot-toast';
import { Users, Layout, Image as ImageIcon, ArrowLeft, Check } from 'lucide-react';
import { motion } from 'motion/react';

export default function CreateGroup() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [defaultTab, setDefaultTab] = useState('news');
  const [enabledTabs, setEnabledTabs] = useState({
    news: true,
    chat: true,
    members: true,
    tasks: true,
    finance: true,
    polls: true
  });
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const groupId = uuidv4();

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
        enabled_tabs: enabledTabs,
        default_tab: defaultTab, // THÊM MỚI
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
          className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-500 transition-all text-slate-900 dark:text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">Kiến tạo</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Bắt đầu không gian mới</p>
        </div>
      </header>

      <form onSubmit={handleCreate} className="space-y-8 flex-1">
        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] ml-1 block">
            Định danh nhóm
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
              <Users className="w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Dream Team 2024"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] pl-16 pr-6 py-5 focus:outline-none focus:border-indigo-500 font-bold text-base text-slate-900 dark:text-white transition-all shadow-sm focus:shadow-xl focus:shadow-indigo-500/5 placeholder:text-slate-300 dark:placeholder:text-slate-700"
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] ml-1 block">
            Tầm nhìn & Sứ mệnh
          </label>
          <div className="relative group">
            <div className="absolute left-6 top-6 pointer-events-none">
              <Layout className="w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú về mục tiêu hoặc cam kết chung của nhóm..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] pl-16 pr-6 py-5 focus:outline-none focus:border-indigo-500 font-medium text-sm text-slate-900 dark:text-slate-300 transition-all shadow-sm focus:shadow-xl focus:shadow-indigo-500/5 placeholder:text-slate-300 dark:placeholder:text-slate-700 min-h-[140px] resize-none"
            />
          </div>
        </div>

        {/* THÊM MỚI: Tùy chỉnh Tab làm việc */}
        <div className="space-y-4">
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] ml-1 block">
            Tab mặc định khi vào nhóm
          </label>
          <div className="grid grid-cols-2 gap-3">
             {[
               { id: 'news', label: 'Bản tin' },
               { id: 'chat', label: 'Trao đổi' },
               { id: 'members', label: 'Thành viên' },
               { id: 'tasks', label: 'Nhiệm vụ' },
               { id: 'finance', label: 'Tài chính' },
               { id: 'polls', label: 'Bình chọn' }
             ].map(tab => (
               <button
                 key={tab.id}
                 type="button"
                 onClick={() => setDefaultTab(tab.id)}
                 disabled={!enabledTabs[tab.id as keyof typeof enabledTabs]}
                 className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                   defaultTab === tab.id
                     ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                     : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800 disabled:opacity-30'
                 }`}
               >
                 <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
                 {defaultTab === tab.id && <Check size={14} />}
               </button>
             ))}
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] ml-1 block">
            Tính năng hoạt động
          </label>
          <div className="grid grid-cols-2 gap-3">
            <FeatureToggle 
              label="Bản tin" 
              active={enabledTabs.news} 
              onChange={(val) => {
                setEnabledTabs(prev => ({ ...prev, news: val }));
                if (!val && defaultTab === 'news') setDefaultTab('members');
              }} 
            />
            <FeatureToggle 
              label="Trao đổi" 
              active={enabledTabs.chat} 
              onChange={(val) => {
                setEnabledTabs(prev => ({ ...prev, chat: val }));
                if (!val && defaultTab === 'chat') setDefaultTab('news');
              }} 
            />
            <FeatureToggle 
              label="Thành viên" 
              active={enabledTabs.members} 
              onChange={(val) => {
                setEnabledTabs(prev => ({ ...prev, members: val }));
                if (!val && defaultTab === 'members') setDefaultTab('news');
              }} 
            />
            <FeatureToggle 
              label="Nhiệm vụ" 
              active={enabledTabs.tasks} 
              onChange={(val) => {
                setEnabledTabs(prev => ({ ...prev, tasks: val }));
                if (!val && defaultTab === 'tasks') setDefaultTab('news');
              }} 
            />
            <FeatureToggle 
              label="Tài chính" 
              active={enabledTabs.finance} 
              onChange={(val) => {
                setEnabledTabs(prev => ({ ...prev, finance: val }));
                if (!val && defaultTab === 'finance') setDefaultTab('news');
              }} 
            />
            <FeatureToggle 
              label="Bình chọn" 
              active={enabledTabs.polls} 
              onChange={(val) => {
                setEnabledTabs(prev => ({ ...prev, polls: val }));
                if (!val && defaultTab === 'polls') setDefaultTab('news');
              }} 
            />
          </div>
        </div>

        <div className="p-8 bg-slate-900 dark:bg-slate-800 rounded-[32px] text-white shadow-xl shadow-slate-200 dark:shadow-none flex flex-col gap-6 relative overflow-hidden border border-slate-800 dark:border-slate-700">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-indigo-400 border border-white/10 shadow-lg">
              <Users size={24} />
            </div>
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest leading-none mb-1.5">Quyền hạn sáng lập</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chỉ mình bạn mới có quyền này</p>
            </div>
          </div>
          
          <p className="text-sm text-slate-400 font-medium leading-relaxed italic relative z-10">
            "Bạn sẽ bắt đầu với tư cách là Chủ sở hữu (Owner). Sau khi nhóm được khởi tạo, bạn có thể thiết lập thêm Đội ngũ quản trị để cùng vận hành không gian này."
          </p>
        </div>

        <div className="flex-1" />

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-indigo-600 text-white rounded-[24px] py-6 font-bold uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 hover:translate-y-[-2px] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
        >
          {loading ? 'Đang khởi tạo...' : 'Kích hoạt không gian'}
        </button>
      </form>
    </div>
  );
}

// THÊM MỚI: Component hỗ trợ chọn tính năng
function FeatureToggle({ label, active, onChange }: { label: string; active: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
        active 
          ? 'bg-indigo-50/50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-400 dark:text-indigo-300 shadow-lg shadow-indigo-500/10' 
          : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 shadow-sm'
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      <div className={`w-10 h-5 rounded-full relative transition-colors ${active ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`}>
        <motion.div
          animate={{ x: active ? 22 : 2 }}
          initial={false}
          className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
        />
      </div>
    </button>
  );
}
