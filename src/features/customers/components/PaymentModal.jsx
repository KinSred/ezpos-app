import React, { useState, useEffect, useRef } from 'react';
import { DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../db';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';

export default function PaymentModal({ isOpen, onClose, onSuccess, selectedCustomer }) {
  const { currentUser, currentShift } = useAuth();
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const submitLockRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedCustomer) {
      setPaymentAmount(selectedCustomer.debt?.toString() || '0');
      setPaymentMethod('cash');
    }
  }, [selectedCustomer, isOpen]);

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
    if (!selectedCustomer || submitLockRef.current) return;

    const amount = parseFloat(paymentAmount.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await db.transaction('rw', [db.customers, db.customerTransactions, db.shifts], async () => {
        if (!currentShift?.id) throw new Error('Vui lòng mở ca trước khi thu nợ.');
        const liveShift = await db.shifts.get(currentShift.id);
        if (!liveShift || liveShift.status !== 'active') {
          throw new Error('Ca làm việc đã kết thúc. Vui lòng mở ca mới trước khi thu nợ.');
        }

        const currentCustomer = await db.customers.get(selectedCustomer.phone);
        if (!currentCustomer) throw new Error('Khách hàng không còn tồn tại.');

        const previousDebt = Math.max(0, Number(currentCustomer.debt) || 0);
        if (amount > previousDebt) {
          throw new Error(`Số tiền thanh toán không thể vượt quá dư nợ ${formatPrice(previousDebt)}.`);
        }

        const newDebt = previousDebt - amount;
        await db.customers.update(currentCustomer.phone, { debt: newDebt });
        await db.customerTransactions.add({
          customerPhone: currentCustomer.phone,
          timestamp: Date.now(),
          type: 'payment',
          amount,
          note: 'Thanh toán nợ',
          paymentMethod,
          userId: currentUser?.id,
          shiftId: liveShift.id,
          previousDebt,
          remainingDebt: newDebt
        });
      });
      toast.success(`Đã thanh toán ${formatPrice(amount)}`);
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Lỗi khi thanh toán nợ');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
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
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Hình thức thu nợ</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2.5 rounded-xl font-bold border transition-colors ${paymentMethod === 'cash' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  Tiền mặt
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`py-2.5 rounded-xl font-bold border transition-colors ${paymentMethod === 'transfer' ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  Chuyển khoản
                </button>
              </div>
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
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all active:scale-[0.96] shadow-lg shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 disabled:cursor-wait"
              >
                {isSubmitting ? 'Đang xử lý...' : 'Xác Nhận'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
