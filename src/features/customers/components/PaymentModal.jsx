import React, { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../db';
import toast from 'react-hot-toast';

export default function PaymentModal({ isOpen, onClose, onSuccess, selectedCustomer }) {
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    if (selectedCustomer) {
      setPaymentAmount(selectedCustomer.debt?.toString() || '0');
    }
  }, [selectedCustomer]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const formatNumberWithCommas = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = val.toString().replace(/[^0-9]/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('en-US').format(parseInt(clean, 10));
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amount = parseFloat(paymentAmount.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }

    try {
      const newDebt = (selectedCustomer.debt || 0) - amount;
      await db.customers.update(selectedCustomer.phone, { debt: newDebt });
      await db.customerTransactions.add({
        customerPhone: selectedCustomer.phone,
        timestamp: Date.now(),
        type: 'payment',
        amount: amount,
        note: 'Thanh toán nợ',
        remainingDebt: newDebt
      });
      toast.success(`Đã thanh toán ${formatPrice(amount)}`);
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi thanh toán nợ');
    }
  };

  if (!isOpen || !selectedCustomer) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass-card rounded-3xl w-full max-w-md overflow-hidden transition-colors duration-500"
        >
          <div className="px-6 py-4 border-b border-sky-200/50 dark:border-sky-800/40 bg-sky-100/50 dark:bg-sky-950/40 flex justify-between items-center">
            <h3 className="font-bold text-sky-950 dark:text-white flex items-center gap-2">
              <DollarSign className="text-emerald-500" size={20} />
              Thanh Toán Nợ
            </h3>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400"
            >
              <DollarSign size={16} className="rotate-45" />
            </button>
          </div>

          <form onSubmit={handleProcessPayment} className="p-6 space-y-5">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Khách hàng</p>
              <p className="font-bold text-slate-900 dark:text-slate-100">
                {selectedCustomer.name}
                {!selectedCustomer.phone.startsWith('_vl_') && ` - ${selectedCustomer.phone}`}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Nợ hiện tại</p>
              <p className="font-bold text-rose-500 text-xl">{formatPrice(selectedCustomer.debt || 0)}</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Số tiền thanh toán</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={formatNumberWithCommas(paymentAmount)}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    const parsed = clean ? parseInt(clean, 10).toString() : '';
                    setPaymentAmount(parsed);
                  }}
                  className="w-full px-4 py-3 bg-sky-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-mono text-lg"
                  placeholder="Nhập số tiền..."
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">VNĐ</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-white/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all active:scale-[0.96] focus:outline-none focus:ring-2 focus:ring-slate-500/50"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all active:scale-[0.96] shadow-lg shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                Xác Nhận
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
