import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../db';
import toast from 'react-hot-toast';

export default function TransferDebtModal({ isOpen, onClose, onSuccess, fromCustomer }) {
  const [transferAmount, setTransferAmount] = useState('');
  const [targetCustomerPhone, setTargetCustomerPhone] = useState('');
  const [allCustomers, setAllCustomers] = useState([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen && fromCustomer) {
      setTransferAmount(fromCustomer.debt?.toString() || '0');
      db.customers.toArray().then(customers => {
        setAllCustomers(customers.filter(c => c.phone !== fromCustomer.phone));
      });
      setTargetCustomerPhone('');
      setNote('');
    }
  }, [isOpen, fromCustomer]);

  useEffect(() => {
    if (targetCustomerPhone && fromCustomer) {
      const targetCustomer = allCustomers.find(c => c.phone === targetCustomerPhone);
      setNote(`Chuyển nợ sang khách hàng ${targetCustomer?.name || ''}`);
    }
  }, [targetCustomerPhone, allCustomers, fromCustomer]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const formatNumberWithCommas = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = val.toString().replace(/[^0-9]/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('en-US').format(parseInt(clean, 10));
  };

  const handleProcessTransfer = async (e) => {
    e.preventDefault();
    if (!fromCustomer) return;

    if (!targetCustomerPhone) {
      toast.error('Vui lòng chọn khách hàng nhận nợ');
      return;
    }

    const amount = parseFloat(transferAmount.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Số tiền chuyển không hợp lệ');
      return;
    }

    if (amount > (fromCustomer.debt || 0)) {
      toast.error('Số tiền chuyển không thể lớn hơn dư nợ hiện tại');
      return;
    }

    try {
      await db.transaction('rw', db.customers, db.customerTransactions, async () => {
        const newFromDebt = (fromCustomer.debt || 0) - amount;
        await db.customers.update(fromCustomer.phone, { debt: newFromDebt });
        
        await db.customerTransactions.add({
          customerPhone: fromCustomer.phone,
          timestamp: Date.now(),
          type: 'payment',
          amount: amount,
          note: note,
          remainingDebt: newFromDebt
        });

        const targetCustomer = await db.customers.get(targetCustomerPhone);
        const newToDebt = (targetCustomer.debt || 0) + amount;
        await db.customers.update(targetCustomer.phone, { debt: newToDebt });
        
        await db.customerTransactions.add({
          customerPhone: targetCustomer.phone,
          timestamp: Date.now() + 1,
          type: 'debt',
          amount: amount,
          note: `Nhận nợ từ khách hàng ${fromCustomer.name}`,
          remainingDebt: newToDebt
        });
      });

      toast.success(`Đã chuyển ${formatPrice(amount)} thành công`);
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi chuyển nợ');
    }
  };

  if (!isOpen || !fromCustomer) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass-card rounded-3xl w-full max-w-md overflow-hidden transition-colors duration-500 shadow-2xl"
        >
          <div className="px-6 py-4 border-b border-indigo-200/50 dark:border-indigo-800/40 bg-indigo-50/80 dark:bg-indigo-950/40 flex justify-between items-center">
            <h3 className="font-bold text-indigo-950 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="text-indigo-500" size={20} />
              Chuyển Công Nợ
            </h3>
            <button 
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleProcessTransfer} className="p-6 space-y-5">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Người chuyển nợ (Từ)</p>
              <p className="font-bold text-slate-900 dark:text-slate-100">
                {fromCustomer.name}
              </p>
              <p className="text-sm font-semibold text-rose-500 mt-1">Dư nợ: {formatPrice(fromCustomer.debt || 0)}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Người nhận nợ (Đến)</label>
              <select
                required
                value={targetCustomerPhone}
                onChange={(e) => setTargetCustomerPhone(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold"
              >
                <option value="" disabled>-- Chọn khách hàng nhận nợ --</option>
                {allCustomers.map(c => (
                  <option key={c.phone} value={c.phone}>
                    {c.name} {c.phone.startsWith('_vl_') ? '' : `- ${c.phone}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Số tiền chuyển</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={formatNumberWithCommas(transferAmount)}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    const parsed = clean ? parseInt(clean, 10).toString() : '';
                    setTransferAmount(parsed);
                  }}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-mono text-lg"
                  placeholder="Nhập số tiền..."
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">VNĐ</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Ghi chú (Tùy chọn)</label>
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 text-sm"
                placeholder="VD: Chuyển nợ..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all active:scale-[0.96] focus:outline-none"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-[0.96] shadow-lg shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-indigo-600/50 flex justify-center items-center gap-2"
              >
                <ArrowRightLeft size={18} />
                Chuyển Nợ
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
