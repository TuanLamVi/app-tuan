import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if already installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (!isStandalone) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-24 left-4 right-4 z-[100] md:left-auto md:right-8 md:w-80"
      >
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-blue-500/20">
            <Download size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black uppercase tracking-tight dark:text-white">Cài đặt MyGroup</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">Truy cập nhanh hơn từ màn hình chính</p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleInstall}
              className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Download size={16} />
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
