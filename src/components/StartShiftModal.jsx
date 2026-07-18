import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StartShiftModal({ isOpen }) {
  const { startShift, currentUser, logout } = useAuth();
  const [startingCash, setStartingCash] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startingCash && startingCash !== '0') {
      toast.error("Vui lòng nhập số tiền đầu ca");
      return;
    }

    setLoading(true);
    const shift = await startShift(startingCash.replace(/,/g, ''));
    setLoading(false);

    if (shift) {
      toast.success("Bắt đầu ca thành công!");
    } else {
      toast.error("Lỗi khi mở ca");
    }
  };

  const handleFormatCurrency = (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val) {
      val = parseInt(val).toLocaleString('en-US');
    }
    setStartingCash(val);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="glass-card rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 glass-panel text-indigo-500 dark:text-indigo-400 rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                <Play size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Bắt đầu Ca Làm Việc</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Thu ngân: {currentUser?.name}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tiền mặt có sẵn trong két (Đầu ca)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">VNĐ</span>
                  <input
                    type="text"
                    required
                    value={startingCash}
                    onChange={handleFormatCurrency}
                    className="w-full pl-14 pr-4 py-3 glass-input rounded-xl text-xl font-bold text-slate-800 dark:text-white"
                    placeholder="VD: 1,000,000"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={logout}
                  className="flex-1 py-3.5 px-4 glass-button text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
                >
                  Đăng xuất
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-lg shadow-lg shadow-sky-500/30 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center backdrop-blur-sm border border-white/20"
                >
                  {loading ? 'Đang xử lý...' : 'Mở Ca Bán Hàng'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
