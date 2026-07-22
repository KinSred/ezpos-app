import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Delete, User, ArrowLeft, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import AppLogo from './AppLogo';

export default function LockScreen() {
  const { login, changeRequiredPin } = useAuth();
  const users = useLiveQuery(() => db.users.filter(u => u.isActive).toArray());
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresPinChange, setRequiresPinChange] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleNumberClick = (num) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (pin.length < 4 || !selectedUser) return;
    
    setLoading(true);
    const result = await login(selectedUser.username, pin);
    setLoading(false);
    
    if (result.requiresPinChange) {
      setRequiresPinChange(true);
      toast('Hãy đổi mã PIN mặc định trước khi tiếp tục.');
    } else if (!result.success) {
      toast.error(result.error);
      setPin(''); // Reset on failure
    } else {
      toast.success(`Xin chào, ${result.user.name}`);
    }
  };

  const resetSelection = () => {
    setSelectedUser(null);
    setPin('');
    setNewPin('');
    setConfirmPin('');
    setRequiresPinChange(false);
  };

  const handleRequiredPinChange = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(newPin)) {
      toast.error('Mã PIN mới phải gồm đúng 4 chữ số');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('Hai mã PIN mới chưa khớp');
      return;
    }

    setLoading(true);
    const result = await changeRequiredPin(selectedUser.username, pin, newPin);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setRequiresPinChange(false);
    setPin('');
    setNewPin('');
    setConfirmPin('');
    toast.success(`Đã đổi PIN. Xin chào, ${result.user.name}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-700">
      {/* Animated Orbs */}
      <motion.div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-400/30 dark:bg-purple-900/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-lighten" animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sky-300/30 dark:bg-sky-900/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-lighten" animate={{ x: [0, -100, 0], y: [0, 100, 0], scale: [1, 1.5, 1] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
      <motion.div className="absolute -bottom-40 left-20 w-[600px] h-[600px] bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-lighten" animate={{ x: [0, 150, 0], y: [0, -100, 0], scale: [1, 1.1, 1] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }} />

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center justify-center p-3 mb-4">
          <AppLogo className="w-16 h-16 drop-shadow-md" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">EzPOS</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Hệ thống quản lý bán hàng</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-8 rounded-[2rem] shadow-2xl w-full max-w-sm relative z-10"
      >
        <AnimatePresence mode="wait">
          {!selectedUser ? (
            <motion.div
              key="user-select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-lg font-bold text-center text-slate-700 dark:text-slate-300 mb-6">Chọn Tài Khoản Đăng Nhập</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {users?.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl glass-button text-left focus:outline-none"
                  >
                    <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                      <User size={20} />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-slate-800 dark:text-white">{user.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">@{user.username}</div>
                    </div>
                  </button>
                ))}
                {users?.length === 0 && (
                  <div className="text-center text-sm text-slate-500 py-4">Đang tải tài khoản...</div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="pin-enter"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                <button 
                  onClick={resetSelection}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="text-left flex-1">
                  <div className="font-bold text-slate-800 dark:text-white">{selectedUser.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Vui lòng nhập mã PIN</div>
                </div>
              </div>

              <div className="flex justify-center gap-4 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${i < pin.length ? 'bg-indigo-500 scale-110 shadow-sm shadow-indigo-500/50' : 'bg-slate-200 dark:bg-slate-700'}`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num.toString())}
                    className="h-16 rounded-2xl glass-button text-2xl font-bold text-slate-800 dark:text-white transition-colors active:scale-95"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleDelete}
                  className="h-16 rounded-2xl glass-button text-rose-500 flex items-center justify-center transition-colors active:scale-95"
                >
                  <Delete size={24} />
                </button>
                <button
                  onClick={() => handleNumberClick('0')}
                  className="h-16 rounded-2xl glass-button text-2xl font-bold text-slate-800 dark:text-white transition-colors active:scale-95"
                >
                  0
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={pin.length < 4 || loading}
                  className={`h-16 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
                    pin.length >= 4 
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30' 
                      : 'glass-button text-slate-400 opacity-50 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <LogIn size={24} />
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {requiresPinChange && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleRequiredPinChange} className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <div className="text-center">
              <ShieldCheck className="mx-auto text-amber-500 mb-3" size={38} />
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Đổi PIN mặc định</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Tài khoản quản trị phải chọn mã PIN riêng trước lần sử dụng đầu tiên.
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="PIN mới (4 số)"
                className="w-full px-4 py-3 glass-input rounded-xl text-center tracking-[0.5em] font-mono text-lg"
                autoFocus
              />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={4}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Nhập lại PIN mới"
                className="w-full px-4 py-3 glass-input rounded-xl text-center tracking-[0.5em] font-mono text-lg"
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={resetSelection} disabled={loading} className="flex-1 px-4 py-3 glass-button rounded-xl font-bold">
                Quay lại
              </button>
              <button type="submit" disabled={loading || newPin.length !== 4 || confirmPin.length !== 4} className="flex-1 px-4 py-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50">
                {loading ? 'Đang lưu...' : 'Đổi PIN'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
