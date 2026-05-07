import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, PlusCircle, User, Users, Bell } from 'lucide-react';
import { cn } from '../core/utils';
import { useNotifications } from '../hooks/useNotifications';
import NotificationCenter from './NotificationCenter';
import { motion, AnimatePresence } from 'motion/react';

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
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30">
      {/* Header */}
      {!isGroupDetail && (
        <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex justify-between items-center px-4 sm:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-900 dark:bg-indigo-600 rounded-lg flex items-center justify-center transform group-hover:scale-105 transition-all shadow-lg">
              <span className="text-white font-bold text-lg sm:text-xl leading-none">M</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">MyGroups</h1>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <NavLink to="/profile" className="flex-shrink-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full p-[2px] bg-slate-100 dark:bg-slate-800 shadow-sm active:scale-95 transition-all border border-slate-200 dark:border-slate-700">
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </NavLink>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={cn("flex-1 pb-36 max-w-lg mx-auto w-full", isGroupDetail && "pt-0")}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>

      <NotificationCenter 
        isOpen={isNotifOpen} 
        onClose={() => setIsNotifOpen(false)} 
        notifications={notifications} 
      />

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-6 md:bottom-10 left-0 right-0 z-40 px-4 sm:px-8 max-w-lg mx-auto pointer-events-none">
        <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 flex justify-around items-center px-4 h-[64px] rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-none pointer-events-auto relative">
          <NavItem to="/" icon={<Home className="w-5 h-5 md:w-6 md:h-6" />} label="Home" />
          <NavItem to="/profile" icon={<User className="w-5 h-5 md:w-6 md:h-6" />} label="Hồ sơ" />
          <button 
            onClick={() => setIsNotifOpen(true)}
            className="flex flex-col items-center gap-1.5 px-4 transition-all relative group h-full justify-center"
          >
            <div className={cn(
              "text-slate-400 group-hover:text-indigo-600 transition-colors",
              unreadCount > 0 && "text-indigo-600",
              isShaking && "animate-bounce"
            )}>
              <Bell className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 leading-none">Báo tin</span>
            {unreadCount > 0 && (
              <span className="absolute top-3 right-5 md:right-7 w-2.5 h-2.5 md:w-3 md:h-3 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
            )}
          </button>
        </nav>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactElement, label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <NavLink 
      to={to} 
      className={cn(
        "flex flex-col items-center gap-1.5 px-4 h-full justify-center transition-all relative group",
        isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
      )}
    >
      <div className={cn(
        "transition-transform duration-300",
        "group-active:scale-90"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-bold leading-none">{label}</span>
      {isActive && (
        <motion.div 
          layoutId="nav-line"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full mx-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </NavLink>
  );
}
