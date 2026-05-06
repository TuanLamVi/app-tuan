import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Users, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../core/utils';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step < 2) {
        setStep(prev => prev + 1);
      } else {
        onFinish();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [step, onFinish]);

  const items = [
    { icon: <Users size={40} />, title: "Quản lý nhóm", color: "text-blue-500", bg: "bg-blue-50" },
    { icon: <ShieldCheck size={40} />, title: "Minh bạch tài chính", color: "text-green-500", bg: "bg-green-50" },
    { icon: <Zap size={40} />, title: "Tốc độ & Hiệu quả", color: "text-orange-500", bg: "bg-orange-50" },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, y: -20 }}
          className="flex flex-col items-center gap-6"
        >
          <div className={cn("w-24 h-24 rounded-[40px] flex items-center justify-center shadow-2xl shadow-gray-100", items[step].bg, items[step].color)}>
            {items[step].icon}
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight italic uppercase">
            {items[step].title}
          </h1>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-12 flex gap-2">
        {items.map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              i === step ? "w-8 bg-blue-600" : "w-1.5 bg-gray-100"
            )} 
          />
        ))}
      </div>
    </div>
  );
}
