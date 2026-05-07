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
        <header className="sticky top-0 z-40 w-full bg-white/70 dark:bg-black/70 backdrop-blur-2xl border-b-2 border-gray-900 dark:border-white/20 flex justify-between items-center px-8 py-6">
          <div className="flex items-center gap-4 group">
            <div className="w-11 h-11 bg-gray-900 dark:bg-white rounded-[14px] flex items-center justify-center transform group-hover:rotate-12 transition-transform shadow-[4px_4px_0px_rgba(37,99,235,1)]">
              <span className="text-white dark:text-gray-900 font-display font-black text-2xl italic leading-none translate-y-[-1px]">M</span>
            </div>
            <h1 className="text-3xl font-display font-black text-gray-900 dark:text-white tracking-tighter uppercase italic leading-none">MyGroups</h1>
          </div>
          <div className="flex items-center gap-5">
            <NavLink to="/profile" className="flex-shrink-0">
              <div className="w-12 h-12 rounded-[16px] p-[2px] bg-gray-900 dark:bg-white shadow-xl active:scale-95 transition-all">
                <div className="w-full h-full rounded-[14px] bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                  <User className="w-6 h-6 text-gray-900 dark:text-white" />
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
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
      <div className="fixed bottom-10 left-0 right-0 z-40 px-8 max-w-lg mx-auto pointer-events-none">
        <nav className="bg-white/95 dark:bg-black/95 backdrop-blur-3xl border-2 border-gray-900 dark:border-white flex justify-between items-center px-4 py-4 rounded-[40px] shadow-[12px_12px_0px_rgba(0,0,0,1)] dark:shadow-[12px_12px_0px_rgba(255,255,255,1)] pointer-events-auto relative">
          <NavItem to="/" icon={<Home className="w-7 h-7" />} label="Home" />
          <NavItem to="/groups" icon={<Users className="w-7 h-7" />} label="Nhóm" />
          
          <div className="relative h-full flex items-center px-1">
            <NavLink to="/create-group">
              {({ isActive }) => (
                <div className={cn(
                  "w-16 h-16 rounded-[22px] flex items-center justify-center border-2 border-gray-900 dark:border-white transition-all duration-500 hover:translate-y-[-4px] active:scale-95 relative z-10 shadow-lg",
                  isActive 
                    ? "bg-blue-600 text-white rotate-45" 
                    : "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                )}>
                  <PlusCircle className={cn("w-10 h-10 transition-transform duration-500", isActive ? "-rotate-45" : "")} />
                </div>
              )}
            </NavLink>
          </div>

          <NavItem to="/profile" icon={<User className="w-7 h-7" />} label="Hồ sơ" />
          <button 
            onClick={() => setIsNotifOpen(true)}
            className="flex flex-col items-center gap-1 px-4 transition-all relative group"
          >
            <div className={cn(
              "text-gray-400 group-hover:text-blue-500 transition-colors",
              unreadCount > 0 && "text-blue-600"
            )}>
              <Bell className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter text-gray-500 font-display italic leading-none">Báo tin</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-6 w-3 h-3 bg-rose-500 rounded-full border-2 border-white dark:border-black animate-pulse" />
            )}
          </button>
        </nav>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactElement, label: string }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => cn(
        "flex flex-col items-center gap-1.5 px-4 py-2 transition-all relative group",
        isActive ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
      )}
    >
      <div className={cn(
        "transition-transform duration-300",
        "group-active:scale-90"
      )}>
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest font-display italic leading-none">{label}</span>
      <AnimatePresence>
        {to === useLocation().pathname && (
          <motion.div 
            layoutId="nav-dot"
            className="absolute -bottom-1 w-1 h-1 bg-current rounded-full"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          />
        )}
      </AnimatePresence>
    </NavLink>
  );
}
