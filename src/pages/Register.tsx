import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'motion/react';
import { ArrowLeft, User, Phone, MapPin, Lock, Key, Check } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function Register() {
  const [formData, setFormData] = useState({
    displayName: '',
    identifier: '',
    address: '',
    password: '',
    confirmPassword: '',
    pin: '',
  });
  const [loading, setLoading] = useState(false);
  const { register, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleRegister = async () => {
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (error) {
      // Error handled in useAuth
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return toast.error('Mật khẩu xác nhận không khớp.');
    }
    if (formData.pin.length < 4) {
      return toast.error('Mã PIN phải có ít nhất 4 số.');
    }

    setLoading(true);
    try {
      await register(formData);
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra khi đăng ký.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold">Tham gia MyGroup</h2>
      </header>

      <motion.form 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleRegister} 
        className="space-y-4 flex-1 pb-10"
      >
        <Input 
          icon={<User className="w-5 h-5 text-gray-400" />}
          label="Họ và tên"
          name="displayName"
          placeholder="Nguyễn Văn A"
          value={formData.displayName}
          onChange={handleChange}
          required
        />

        <Input 
          icon={<Phone className="w-5 h-5 text-gray-400" />}
          label="Email hoặc Số điện thoại (Để đăng nhập)"
          name="identifier"
          placeholder="email@vidu.com hoặc 09..."
          value={formData.identifier}
          onChange={handleChange}
          required
        />

        <Input 
          icon={<MapPin className="w-5 h-5 text-gray-400" />}
          label="Địa chỉ"
          name="address"
          placeholder="Hà Nội, Việt Nam"
          value={formData.address}
          onChange={handleChange}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input 
            icon={<Lock className="w-5 h-5 text-gray-400" />}
            label="Mật khẩu"
            name="password"
            type="password"
            placeholder="••••••"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <Input 
            icon={<Check className="w-5 h-5 text-gray-400" />}
            label="Xác nhận"
            name="confirmPassword"
            type="password"
            placeholder="••••••"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>

        <Input 
          icon={<Key className="w-5 h-5 text-gray-400" />}
          label="Mã PIN (Dùng để xác thực giao dịch)"
          name="pin"
          type="number"
          placeholder="1234"
          value={formData.pin}
          onChange={handleChange}
          maxLength={6}
          required
        />

        <div className="pt-8 flex flex-col gap-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-2xl py-4 font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : 'Đăng ký ngay'}
          </button>

          <div className="flex items-center gap-4 my-2">
            <div className="flex-1 h-[1px] bg-gray-100" />
            <span className="text-[10px] uppercase font-bold text-gray-300 tracking-widest">Hoặc</span>
            <div className="flex-1 h-[1px] bg-gray-100" />
          </div>

          <button
            type="button"
            onClick={handleGoogleRegister}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-[0.98]"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            <span>Đăng ký nhanh bằng Google</span>
          </button>
          
          <p className="text-center text-sm text-gray-500">
            Bạn đã có tài khoản? <Link to="/login" className="text-blue-600 font-bold">Đăng nhập</Link>
          </p>
        </div>
      </motion.form>
    </div>
  );
}

function Input({ icon, label, ...props }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider ml-1">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-blue-500">
          {icon}
        </div>
        <input
          {...props}
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-medium"
        />
      </div>
    </div>
  );
}
