import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, PlusCircle, User, Users, Bell } from 'lucide-react';
import { cn } from '../core/utils';
import { useNotifications } from '../hooks/useNotifications';
import NotificationCenter from './NotificationCenter';
import { motion } from 'motion/react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { notifications, unreadCount } = useNotifications();
  const location = useLocation();
  const isGroupDetail = location.pathname.startsWith('/group/');
  const prevCountRef = useRef(unreadCount);

  // Trigger bell shake animation, sound and vibration when unread count increases
  const [isShaking, setIsShaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    }
  }, []);

  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setIsShaking(true);
      
      // Play sound
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log('Audio play blocked:', e));
      }

      // Vibrate
      if (window.navigator.vibrate) {
        window.navigator.vibrate([100, 50, 100]);
      }

      const timer = setTimeout(() => setIsShaking(false), 800);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      {!isGroupDetail && (
        <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 flex justify-between items-center px-4 py-3">
          <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic">MyGroups</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <motion.div
                animate={isShaking ? { 
                  rotate: [0, -20, 20, -20, 20, -10, 10, 0],
                  scale: [1, 1.2, 1.2, 1.2, 1] 
                } : { rotate: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                <Bell size={20} className={cn(unreadCount > 0 && "text-blue-600 dark:text-blue-400 fill-blue-600/10")} />
              </motion.div>
              {unreadCount > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  key={unreadCount}
                  className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-sm"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
            </button>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center border border-white dark:border-gray-800 shadow-sm overflow-hidden">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={cn("flex-1 pb-24 max-w-lg mx-auto w-full", isGroupDetail && "pt-0")}>
        {children}
      </main>

      <NotificationCenter 
        isOpen={isNotifOpen} 
        onClose={() => setIsNotifOpen(false)} 
        notifications={notifications} 
      />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 flex justify-around items-center px-6 py-3 max-w-lg mx-auto">
        <NavItem to="/" icon={<Home className="w-6 h-6" />} label="Trang chủ" />
        <NavItem to="/groups" icon={<Users className="w-6 h-6" />} label="Nhóm" />
        <NavItem to="/create-group" icon={<PlusCircle className="w-6 h-6" />} label="Tạo nhóm" />
        <NavItem to="/profile" icon={<User className="w-6 h-6" />} label="Tôi" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactElement, label: string }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => cn(
        "flex flex-col items-center gap-1 transition-colors",
        isActive ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
      )}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </NavLink>
  );
}
