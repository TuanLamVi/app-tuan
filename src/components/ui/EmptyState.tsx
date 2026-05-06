import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../core/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({ icon: Icon, title, message, action, className }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-[40px] border border-gray-100 shadow-sm",
        className
      )}
    >
      {Icon && (
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 text-gray-300">
          <Icon size={40} strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-xl font-black text-gray-900 mb-2">{title}</h3>
      {message && <p className="text-sm text-gray-400 font-medium max-w-xs">{message}</p>}
      {action && <div className="mt-8">{action}</div>}
    </motion.div>
  );
}
