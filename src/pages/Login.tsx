import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'motion/react';
import { Users, Shield, TrendingUp, LogIn, Phone, Lock, ChevronRight } from 'lucide-react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function Login() {
  const { user, signInWithGoogle, login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/" />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    
    setLoading(true);
    try {
      await login(identifier, password);
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Sai thông tin đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="flex-1 overflow-y-auto px-6 py-12 flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-10 text-center"
        >
          <div className="inline-block p-4 bg-blue-50 rounded-[32px] mb-6">
            <Users className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">MyGroup</h1>
          <p className="text-gray-500 font-medium">Làm việc nhóm & Quản lý tài chính</p>
        </motion.div>

        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <div className="space-y-4">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text"
                placeholder="Email hoặc Số điện thoại"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-medium"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="password"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-medium"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pr-2">
            <Link to="/forgot-password" title="Quên mật khẩu?" className="text-sm text-gray-400 font-bold hover:text-gray-600 transition-colors">
              Quên mật khẩu?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </form>

        <div className="w-full max-w-sm flex items-center gap-4 my-8">
          <div className="flex-1 h-[1px] bg-gray-100" />
          <span className="text-[10px] uppercase font-bold text-gray-300 tracking-widest">Hoặc đăng nhập với</span>
          <div className="flex-1 h-[1px] bg-gray-100" />
        </div>

        <button
          onClick={signInWithGoogle}
          className="w-full max-w-sm flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-[0.98]"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          <span>Google Account</span>
        </button>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Bạn mới tham gia? <Link to="/register" className="text-blue-600 font-bold underline underline-offset-4">Đăng ký ngay</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

