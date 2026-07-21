import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../db';
import toast from 'react-hot-toast';

export default function AddCustomerModal({ isOpen, onClose, onSuccess }) {
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newDebt, setNewDebt] = useState('');

  const formatNumberWithCommas = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = val.toString().replace(/[^0-9]/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('en-US').format(parseInt(clean, 10));
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    let finalPhone = newPhone.trim();
    const name = newName.trim();
    const debt = parseFloat(newDebt.replace(/[^0-9]/g, '')) || 0;

    if (!name) {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }

    if (!finalPhone) {
      finalPhone = `_vl_${Date.now()}`;
    }

    try {
      const allCustomers = await db.customers.toArray();
      const existingName = allCustomers.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (existingName) {
        toast.error('Tên khách hàng đã tồn tại! Không cho phép trùng tên.');
        return;
      }

      const existingPhone = await db.customers.get(finalPhone);
      if (existingPhone) {
        toast.error('Số điện thoại này đã được đăng ký!');
        return;
      }

      await db.customers.add({
        phone: finalPhone,
        name,
        debt,
        points: 0,
        specialPrices: {}
      });

      toast.success(`Đã thêm khách hàng ${name} thành công!`);
      setNewPhone('');
      setNewName('');
      setNewDebt('');
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi thêm khách hàng');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass-card rounded-3xl w-full max-w-md overflow-hidden transition-colors duration-500 bg-white/90 dark:bg-slate-900/90 shadow-2xl border border-slate-200/50 dark:border-slate-800/40"
        >
          <div className="px-6 py-4 border-b border-sky-200/50 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-950/40 flex justify-between items-center">
            <h3 className="font-bold text-sky-950 dark:text-white flex items-center gap-2">
              <UserPlus className="text-sky-500" size={20} />
              Thêm Khách Hàng Mới
            </h3>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleAddCustomer} className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Tên Khách Hàng *</label>
              <input 
                type="text" 
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold"
                placeholder="VD: Nguyễn Văn A..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Số Điện Thoại (Không bắt buộc)</label>
              <input 
                type="text" 
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold"
                placeholder="VD: 0987..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider mb-2">Dư Nợ Ban Đầu (VNĐ)</label>
              <div className="relative">
                <input 
                  type="text"
                  value={formatNumberWithCommas(newDebt)}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    const parsed = clean ? parseInt(clean, 10).toString() : '';
                    setNewDebt(parsed);
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold font-mono"
                  placeholder="VD: 0 hoặc bỏ trống..."
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-xs">VNĐ</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-white/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-sky-500 text-white rounded-xl font-bold hover:bg-sky-600 transition-colors shadow-lg shadow-sky-500/20"
              >
                Lưu
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
