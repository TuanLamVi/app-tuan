import React, { useEffect, useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Task, TaskStatus, UserProfile } from '../../models';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, Clock, Play, AlertCircle, 
  User, Calendar, Plus, ChevronRight, Check,
  Filter, ArrowUpDown, Search
} from 'lucide-react';
import { cn, formatDate } from '../../core/utils';
import { handleFirestoreError, OperationType } from '../../hooks/useAuth';
import EmptyState from '../ui/EmptyState';
import { toast } from 'react-hot-toast';
import { NotificationService } from '../../services/notificationService';

interface TaskTabProps {
  groupId: string;
  groupName: string;
  canManage: boolean;
  onAddTask: () => void;
  ownerId: string;
  members: UserProfile[];
}

export default function TaskTab({ groupId, groupName, canManage, onAddTask, ownerId, members }: TaskTabProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterDueDate, setFilterDueDate] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'status' | 'dueDate' | 'createdAt'>('createdAt');

  useEffect(() => {
    const q = query(collection(db, 'groups', groupId, 'tasks'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        dueDate: doc.data().dueDate?.toDate() || null
      } as Task)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `groups/${groupId}/tasks`);
      setLoading(false);
    });

    return unsub;
  }, [groupId]);

  const handleUpdateStatus = async (task: Task, newStatus: TaskStatus) => {
    if (!auth.currentUser) return;
    const isAssignee = task.assigneeId === auth.currentUser.uid;
    const isOwner = ownerId === auth.currentUser.uid;
    
    if (!isAssignee && !isOwner) {
      toast.error('Bạn không có quyền cập nhật công việc này');
      return;
    }
    
    if (task.status === newStatus) return;

    setUpdatingId(task.id);
    try {
      await updateDoc(doc(db, 'groups', groupId, 'tasks', task.id), {
        status: newStatus
      });

      const statusText = newStatus === 'doing' ? 'bắt đầu làm' : 
                         newStatus === 'done' ? 'hoàn thành' : 'hoàn tác về chờ';
      
      const changerName = isAssignee ? task.assigneeName : 'Trưởng nhóm';

      // Notify owner if changer is not owner
      if (!isOwner) {
        await NotificationService.sendNotification(ownerId, {
          title: 'Cập nhật công việc',
          message: `${changerName} đã ${statusText} công việc: "${task.title}"`,
          type: 'system',
          category: 'tasks',
          data: { groupId, taskId: task.id }
        });
      }

      // Notify assignee if changer is not assignee
      if (!isAssignee) {
        await NotificationService.sendNotification(task.assigneeId, {
          title: 'Cập nhật công việc',
          message: `Trưởng nhóm đã ${statusText} công việc của bạn: "${task.title}"`,
          type: 'system',
          category: 'tasks',
          data: { groupId, taskId: task.id }
        });
      }

      // Notify all members if task is completed
      if (newStatus === 'done') {
        const otherMembers = members.filter(m => m.uid !== auth.currentUser?.uid && m.uid !== ownerId && m.uid !== task.assigneeId);
        const memberNotifications = otherMembers.map(m => 
          NotificationService.sendNotification(m.uid, {
            title: 'Công việc hoàn thành',
            message: `${task.assigneeName} đã hoàn thành công việc: "${task.title}"`,
            type: 'system',
            category: 'tasks',
            data: { groupId, taskId: task.id }
          })
        );
        await Promise.all(memberNotifications);
      }

      toast.success(
        newStatus === 'doing' ? 'Đã bắt đầu thực hiện' : 
        newStatus === 'done' ? 'Chúc mừng! Đã hoàn thành công việc' : 
        'Đã chuyển về danh sách chờ'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/tasks/${task.id}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const onDragStart = (e: React.DragEvent, task: Task) => {
    const isAssignee = auth.currentUser?.uid === task.assigneeId;
    const isOwner = auth.currentUser?.uid === ownerId;
    
    if (!isAssignee && !isOwner) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== status) {
      handleUpdateStatus(task, status);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse" />
        ))}
      </div>
    );
  }

  const columns: { status: TaskStatus; label: string; color: string; icon: any }[] = [
    { status: 'pending', label: 'Chờ làm', color: 'gray', icon: Clock },
    { status: 'doing', label: 'Đang làm', color: 'amber', icon: Play },
    { status: 'done', label: 'Hoàn thành', color: 'emerald', icon: CheckCircle2 },
  ];

  const uniqueAssignees = Array.from(new Map(tasks.map(t => [t.assigneeId, t.assigneeName])).entries());

  const filteredTasks = tasks.filter(task => {
    const matchesAssignee = filterAssignee === 'all' || task.assigneeId === filterAssignee;
    
    let matchesDueDate = true;
    if (filterDueDate !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      
      if (filterDueDate === 'today') {
        matchesDueDate = !!dueDate && dueDate.toDateString() === today.toDateString();
      } else if (filterDueDate === 'week') {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        matchesDueDate = !!dueDate && dueDate >= today && dueDate <= nextWeek;
      } else if (filterDueDate === 'overdue') {
        matchesDueDate = !!dueDate && dueDate < today && task.status !== 'done';
      }
    }
    
    return matchesAssignee && matchesDueDate;
  }).sort((a, b) => {
    if (sortBy === 'dueDate') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    }
    if (sortBy === 'status') {
      const order: Record<TaskStatus, number> = { 'pending': 0, 'doing': 1, 'done': 2 };
      return order[a.status] - order[b.status];
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="space-y-6">
      {canManage && (
        <button 
          onClick={onAddTask}
          className="w-full p-4 bg-white dark:bg-gray-900 border border-dashed border-blue-200 dark:border-blue-900/50 rounded-3xl text-blue-600 dark:text-blue-400 font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] hover:bg-blue-50/30"
        >
          <Plus size={18} /> Thêm việc mới
        </button>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-[28px] border border-gray-100 dark:border-gray-800">
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select 
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border-none rounded-xl text-[10px] font-black uppercase tracking-tight appearance-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">Tất cả người giao</option>
                {uniqueAssignees.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select 
                value={filterDueDate}
                onChange={(e) => setFilterDueDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border-none rounded-xl text-[10px] font-black uppercase tracking-tight appearance-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">Mọi thời hạn</option>
                <option value="today">Hôm nay</option>
                <option value="week">Tuần này</option>
                <option value="overdue">Quá hạn</option>
              </select>
            </div>
            <div className="relative hidden lg:block">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border-none rounded-xl text-[10px] font-black uppercase tracking-tight appearance-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="createdAt">Mới nhất</option>
                <option value="dueDate">Hạn chót</option>
                <option value="status">Trạng thái</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState 
          icon={CheckCircle2}
          title="Chưa có công việc"
          message="Phân công công việc cho thành viên để cùng chung tay xây dựng nhóm."
          className="py-12"
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {columns.map((column) => (
            <div 
              key={column.status}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, column.status)}
              className="w-full lg:flex-1 min-h-[200px] flex flex-col gap-4"
            >
              <div className={cn(
                "flex items-center justify-between px-4 py-2 rounded-2xl",
                column.color === 'gray' ? "bg-gray-100 text-gray-500" :
                column.color === 'amber' ? "bg-amber-100/50 text-amber-600" :
                "bg-emerald-100/50 text-emerald-600"
              )}>
                <div className="flex items-center gap-2">
                  <column.icon size={14} className={column.status === 'doing' ? "animate-pulse" : ""} />
                  <span className="text-[10px] font-black uppercase tracking-tight">{column.label}</span>
                </div>
                <span className="text-[10px] font-bold opacity-60">
                  {filteredTasks.filter(t => t.status === column.status).length}
                </span>
              </div>

              <div className="space-y-4">
                {filteredTasks.filter(t => t.status === column.status).map((task) => {
                  const isAssignee = auth.currentUser?.uid === task.assigneeId;
                  const isOwner = auth.currentUser?.uid === ownerId;
                  const canDrag = isAssignee || isOwner;
                  const isOverdue = task.dueDate && task.status !== 'done' && task.dueDate < new Date();

                  return (
                    <motion.div 
                      key={task.id}
                      layout
                      draggable={canDrag}
                      onDragStart={(e) => onDragStart(e, task)}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "bg-white dark:bg-gray-900 rounded-[28px] p-4 shadow-sm border-2 transition-all cursor-default",
                        canDrag ? "cursor-grab active:cursor-grabbing hover:border-blue-200" : "",
                        task.status === 'done' ? "border-emerald-500/10 opacity-80" : 
                        task.status === 'doing' ? "border-amber-500/10 shadow-amber-500/5" : 
                        "border-transparent"
                      )}
                    >
                      <div className="mb-3">
                        <h4 className={cn(
                          "font-black text-sm italic uppercase tracking-tight line-clamp-1 dark:text-white flex items-center gap-2",
                          task.status === 'done' && "line-through text-gray-400"
                        )}>
                          {task.title}
                          {isOverdue && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" title="Quá hạn" />
                          )}
                        </h4>
                        {task.description && (
                          <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-tight">{task.description}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <User size={10} className="text-gray-300" />
                          <p className="text-[9px] font-bold dark:text-gray-400">{task.assigneeName} {isAssignee && '(Bạn)'}</p>
                        </div>
                        {task.dueDate && (
                          <div className={cn(
                            "flex items-center gap-2",
                            isOverdue ? "text-red-500" : "text-gray-400"
                          )}>
                            <Calendar size={10} />
                            <p className="text-[9px] font-bold">
                              {formatDate(task.dueDate)}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {filteredTasks.filter(t => t.status === column.status).length === 0 && (
                  <div className="h-20 rounded-[28px] border-2 border-dashed border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-300">
                    <p className="text-[10px] font-bold uppercase tracking-widest">Trống</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
