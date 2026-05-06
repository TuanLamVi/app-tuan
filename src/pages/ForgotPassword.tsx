import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'motion/react';
import { ArrowLeft, Phone, Key, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPasswordWithPin } = useAuth();
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPasswordWithPin(identifier, pin, newPassword);
    } catch (error: any) {
      toast.error(error.message || 'Lỗi đặt lại mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold">Khôi phục mật khẩu</h2>
      </header>

      <div className="mb-8 p-4 bg-blue-50 rounded-2xl flex items-start gap-4">
        <ShieldCheck className="w-6 h-6 text-blue-600 flex-shrink-0" />
        <p className="text-sm text-blue-800 leading-relaxed font-medium">
          Vui lòng nhập Email hoặc Số điện thoại và mã PIN 4 số bạn đã thiết lập khi đăng ký để đặt lại mật khẩu.
        </p>
      </div>

      <form onSubmit={handleReset} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider ml-1">Email hoặc Số điện thoại</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              placeholder="email@vidu.com hoặc 09..."
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-medium"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider ml-1">Mã PIN bảo mật</label>
          <div className="relative">
            <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="password"
              placeholder="1234"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={6}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-medium"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider ml-1">Mật khẩu mới</label>
          <input 
            type="password"
            placeholder="••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-medium"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-2xl py-4 font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Đang xác thực...' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
}
