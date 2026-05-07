import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Task, TaskStatus, UserProfile } from '../../models';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { 
  CheckCircle2, Clock, Play, AlertCircle, 
  Calendar, Plus, Filter, 
  Search, MessageSquare, Flag
} from 'lucide-react';
import { cn, formatDate } from '../../core/utils';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import EmptyState from '../ui/EmptyState';
import { toast } from 'react-hot-toast';
import { NotificationService } from '../../services/notificationService';
import TaskDetailModal from './TaskDetailModal';

interface TaskTabProps {
  groupId: string;
  groupName: string;
  canManage: boolean;
  onAddTask: () => void;
  ownerId: string;
  members: UserProfile[];
}

const PRIORITY_CONFIG = {
  low: { label: 'THẤP', color: 'emerald', icon: Flag },
  medium: { label: 'TRUNG BÌNH', color: 'blue', icon: Flag },
  high: { label: 'CAO', color: 'orange', icon: Flag },
  urgent: { label: 'KHẨN CẤP', color: 'red', icon: Flag },
};

const STATUS_CONFIG = {
  pending: { label: 'CHỜ', icon: Clock, color: 'slate' },
  doing: { label: 'ĐANG LÀM', icon: Play, color: 'indigo' },
  done: { label: 'HOÀN THÀNH', icon: CheckCircle2, color: 'emerald' },
};

export default function TaskTab({ groupId, groupName, canManage, onAddTask, ownerId, members }: TaskTabProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDueDate, setFilterDueDate] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'groups', groupId, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dueDate: doc.data().dueDate?.toDate() || null,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        comments: (doc.data().comments || []).map((c: any) => ({
          ...c,
          createdAt: c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt)
        }))
      } as Task));
      setTasks(fetchedTasks);
      
      if (selectedTask) {
        const updated = (fetchedTasks || []).find(t => t.id === selectedTask.id);
        if (updated) setSelectedTask(updated);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `groups/${groupId}/tasks`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId, selectedTask?.id]);

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    const isOwner = auth.currentUser?.uid === ownerId;
    const isAssignee = auth.currentUser?.uid && (task.assigneeIds || []).includes(auth.currentUser.uid);
    
    if (!isOwner && !isAssignee) {
      toast.error('Bạn không có quyền cập nhật công việc này');
      return;
    }
    
    if (task.status === newStatus) return;

    try {
      await updateDoc(doc(db, 'groups', groupId, 'tasks', task.id), {
        status: newStatus
      });
      
      const statusText = newStatus === 'done' ? 'hoàn thành' : newStatus === 'doing' ? 'bắt đầu' : 'tạm dừng';
      const changerName = auth.currentUser.displayName || 'Thành viên';

      if (!isOwner) {
        await NotificationService.sendNotification(ownerId, {
          title: 'Cập nhật công việc',
          message: `${changerName} đã thay đổi trạng thái "${task.title}" sang ${statusText}`,
          category: 'tasks',
          data: { groupId, taskId: task.id }
        });
      }

      const otherAssignees = (task.assigneeIds || []).filter(id => id !== auth.currentUser?.uid);
      await Promise.all(otherAssignees.map(id => 
        NotificationService.sendNotification(id, {
          title: 'Cập nhật công việc nhóm',
          message: `${changerName} đã ${statusText} công việc chung: "${task.title}"`,
          category: 'tasks',
          data: { groupId, taskId: task.id }
        })
      ));

      toast.success('Đã cập nhật trạng thái');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/tasks/${task.id}`);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAssignee = filterAssignee === 'all' || (task.assigneeIds || []).includes(filterAssignee);
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      
      let matchesDueDate = true;
      if (filterDueDate !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dDate = task.dueDate ? new Date(task.dueDate) : null;
        
        if (filterDueDate === 'today') {
          matchesDueDate = !!dDate && dDate.toDateString() === today.toDateString();
        } else if (filterDueDate === 'week') {
          const nextWeek = new Date(today);
          nextWeek.setDate(today.getDate() + 7);
          matchesDueDate = !!dDate && dDate >= today && dDate <= nextWeek;
        } else if (filterDueDate === 'overdue') {
          matchesDueDate = !!dDate && dDate < today && task.status !== 'done';
        }
      }
      
      return matchesSearch && matchesAssignee && matchesPriority && matchesDueDate;
    });
  }, [tasks, searchQuery, filterAssignee, filterPriority, filterDueDate]);

  const onDragStart = (e: React.DragEvent, task: Task) => {
    const isAssignee = auth.currentUser?.uid && (task.assigneeIds || []).includes(auth.currentUser.uid);
    const isOwner = auth.currentUser?.uid === ownerId;
    if (!isAssignee && !isOwner) {
      e.preventDefault();
      return;
    }
    setDraggedTaskId(task.id);
    e.dataTransfer.setData('taskId', task.id);
  };

  const onDrop = (e: React.DragEvent, status: TaskStatus) => {
    setDragOverStatus(null);
    setDraggedTaskId(null);
    const taskId = e.dataTransfer.getData('taskId');
    const task = (tasks || []).find(t => t.id === taskId);
    if (task && task.status !== status) {
      handleStatusChange(task, status);
    }
  };

  const uniqueAssignees = useMemo(() => {
    const map = new Map();
    tasks.forEach(t => {
      (t.assigneeIds || []).forEach((id, idx) => {
        if (!map.has(id)) map.set(id, (t.assigneeNames || [])[idx]);
      });
    });
    return Array.from(map.entries());
  }, [tasks]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-4">
            <div className="h-14 bg-slate-100 dark:bg-slate-900 rounded-[28px] animate-pulse" />
            <div className="h-40 bg-slate-50 dark:bg-slate-900 rounded-[32px] animate-pulse" />
            <div className="h-40 bg-slate-50 dark:bg-slate-900 rounded-[32px] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10 flex flex-col min-h-[700px]">
      {/* Filter Bar */}
      <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-[32px] border border-white/20 dark:border-slate-800/50 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl">
            <Filter size={14} className="opacity-70" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Bộ lọc</span>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
            <input 
              type="text"
              placeholder="TÌM KIẾM NHANH..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-[18px] text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 transition-all w-full sm:w-64 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select 
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[18px] text-[10px] font-black uppercase tracking-widest shadow-sm appearance-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer min-w-[140px] outline-none"
            >
              <option value="all">ĐỘ ƯU TIÊN</option>
              <option value="urgent">KHẨN CẤP</option>
              <option value="high">CAO</option>
              <option value="medium">TRUNG BÌNH</option>
              <option value="low">THẤP</option>
            </select>

            <select 
              value={filterDueDate}
              onChange={(e) => setFilterDueDate(e.target.value)}
              className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[18px] text-[10px] font-black uppercase tracking-widest shadow-sm appearance-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer min-w-[140px] outline-none"
            >
               <option value="all">THỜI HẠN</option>
               <option value="today">HÔM NAY</option>
               <option value="week">TUẦN NÀY</option>
               <option value="overdue">QUÁ HẠN</option>
            </select>
          </div>
        </div>

        {canManage && (
          <button 
            onClick={onAddTask}
            className="w-full lg:w-auto px-8 py-4 bg-indigo-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <Plus size={20} /> Tạo Công Việc Mới
          </button>
        )}
      </div>

      {/* Board View */}
      <div className="flex-1 overflow-x-auto pb-12 scrollbar-hide -mx-4 lg:mx-0 px-4 lg:px-0">
        <div className="flex flex-nowrap lg:grid lg:grid-cols-3 gap-8 min-w-[1000px] lg:min-w-0 h-full">
          {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((status) => {
            const config = STATUS_CONFIG[status];
            const columnTasks = filteredTasks.filter(t => t.status === status);
            const isOver = dragOverStatus === status;

            return (
              <div 
                key={status}
                className="w-[330px] lg:w-auto h-full flex flex-col gap-6"
                onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={(e) => onDrop(e, status)}
              >
                {/* Column Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between p-5 bg-white dark:bg-slate-900 border border-slate-50 dark:border-slate-800 rounded-[28px] shadow-xl shadow-slate-200/40 dark:shadow-none text-left">
                  <div className="flex items-center gap-4">
                     <div className={cn(
                       "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                       status === 'pending' ? "bg-slate-100 text-slate-500" :
                       status === 'doing' ? "bg-indigo-100 text-indigo-600 animate-pulse" :
                       "bg-emerald-100 text-emerald-600"
                     )}>
                       <config.icon size={20} />
                     </div>
                     <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white italic">
                       {status === 'pending' ? 'CHỜ XỬ LÝ' : status === 'doing' ? 'ĐANG LÀM' : 'HOÀN THÀNH'}
                     </h3>
                  </div>
                  <div className="h-8 min-w-[32px] px-3 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-[11px] font-black text-slate-400 border border-slate-100 dark:border-slate-800">
                    {columnTasks.length}
                  </div>
                </div>

                {/* Task List */}
                <div className={cn(
                  "flex-1 flex flex-col gap-6 p-4 rounded-[40px] transition-all duration-500 min-h-[500px]",
                  isOver ? "bg-indigo-50/50 dark:bg-indigo-900/10 ring-4 ring-indigo-500/20 ring-inset scale-[1.02]" : "bg-slate-50 dark:bg-slate-900/10"
                )}>
                  <LayoutGroup id={status}>
                    <AnimatePresence mode="popLayout">
                      {columnTasks.map((task) => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          members={members} 
                          ownerId={ownerId}
                          isDragging={draggedTaskId === task.id}
                          onDragStart={(e) => onDragStart(e, task)}
                          onClick={() => setSelectedTask(task)}
                        />
                      ))}
                    </AnimatePresence>
                  </LayoutGroup>

                  {columnTasks.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] opacity-20 grayscale p-10 text-center">
                       <Plus size={32} className="text-slate-300 mb-4" />
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Trống</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetailModal 
            task={selectedTask}
            groupId={groupId}
            isOpen={true}
            onClose={() => setSelectedTask(null)}
            members={members}
            ownerId={ownerId}
            onDelete={() => setSelectedTask(null)}
            canManage={canManage}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface TaskCardProps {
  key?: React.Key;
  task: Task;
  members: UserProfile[];
  ownerId: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
}

function TaskCard({ task, members, ownerId, isDragging, onDragStart, onClick }: TaskCardProps) {
  const isAssignee = auth.currentUser?.uid && (task.assigneeIds || []).includes(auth.currentUser.uid);
  const isOwner = auth.currentUser?.uid === ownerId;
  const canDrag = isAssignee || isOwner;
  const isOverdue = task.dueDate && task.status !== 'done' && task.dueDate < new Date();
  
  const priority = task.priority || 'medium';
  const prConfig = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG];

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ 
        opacity: isDragging ? 0.4 : 1, 
        y: 0, 
        scale: 1,
        rotate: isDragging ? 3 : 0, 
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -10, rotate: 2 }}
      whileTap={{ scale: 0.95, rotate: -2, zIndex: 50 }}
      draggable={canDrag}
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col p-8 bg-white dark:bg-slate-900 rounded-[36px] border-2 transition-all cursor-pointer shadow-sm select-none h-full min-h-[220px] text-left",
        isOverdue 
          ? "border-red-200 dark:border-red-900/50 bg-red-50/10" 
          : "border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30 shadow-slate-200/50 dark:shadow-none",
        isDragging && "shadow-2xl shadow-indigo-500/40 ring-4 ring-indigo-500/20",
        task.status === 'done' && "opacity-75 grayscale-[0.3]"
      )}
    >
      <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors rounded-[36px] pointer-events-none" />

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className={cn(
          "px-4 py-1.5 rounded-full flex items-center gap-2",
          prConfig.color === 'emerald' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
          prConfig.color === 'blue' ? "bg-blue-50 text-blue-600 border border-blue-100" :
          prConfig.color === 'orange' ? "bg-orange-50 text-orange-600 border border-orange-100" :
          "bg-red-50 text-red-600 border border-red-100 animate-pulse"
        )}>
          <prConfig.icon size={12} className={priority === 'urgent' || priority === 'high' ? 'fill-current' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">{prConfig.label}</span>
        </div>
        
        {isOverdue && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">HẾT HẠN</span>
          </div>
        )}
      </div>

      <div className="space-y-3 mb-8 relative z-10">
        <h4 className={cn(
          "text-lg font-black italic uppercase tracking-tighter leading-tight dark:text-white transition-colors group-hover:text-indigo-600",
          task.status === 'done' && "line-through text-slate-400"
        )}>
          {task.title}
        </h4>
        {task.description && (
          <p className="text-[12px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-bold">
            {task.description}
          </p>
        )}
      </div>

      <div className="mt-auto pt-6 border-t border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            {(task.assigneeIds || []).slice(0, 3).map((id, idx) => {
               const p = (members || []).find(m => m.uid === id);
               return (
                  <div key={id} className="w-10 h-10 rounded-[16px] border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all">
                    {p?.photoURL ? (
                      <img src={p.photoURL} alt="" title={task.assigneeNames?.[idx]} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400 italic uppercase">
                        {task.assigneeNames?.[idx]?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
               );
            })}
            {(task.assigneeIds || []).length > 3 && (
              <div className="w-10 h-10 rounded-[16px] border-2 border-white dark:border-slate-900 bg-slate-900 text-white flex items-center justify-center text-[10px] font-black italic shadow-lg">
                +{(task.assigneeIds || []).length - 3}
              </div>
            )}
          </div>
          
          {(task.comments?.length || 0) > 0 && (
             <div className="flex items-center gap-2 text-slate-300 group-hover:text-indigo-400 transition-colors">
                <MessageSquare size={16} />
                <span className="text-[12px] font-black italic">{task.comments?.length}</span>
             </div>
          )}
        </div>

        {task.dueDate && (
           <div className={cn(
             "px-4 py-2 rounded-2xl flex items-center gap-2",
             isOverdue ? "bg-red-50 text-red-600" : "bg-slate-50 dark:bg-slate-800 text-slate-400"
           )}>
              <Calendar size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.1em] italic">{formatDate(task.dueDate)}</span>
           </div>
        )}
      </div>

      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}
