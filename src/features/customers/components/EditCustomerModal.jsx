import React, { useState, useEffect } from 'react';
import { Edit2, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../db';
import toast from 'react-hot-toast';

export default function EditCustomerModal({ isOpen, onClose, onSuccess, customerToEdit }) {
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDebt, setEditDebt] = useState('');

  useEffect(() => {
    if (customerToEdit) {
      setEditName(customerToEdit.name);
      setEditPhone(customerToEdit.phone);
      setEditDebt(customerToEdit.debt ? customerToEdit.debt.toString() : '0');
    }
  }, [customerToEdit, isOpen]);

  const formatNumberWithCommas = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = val.toString().replace(/[^0-9]/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('en-US').format(parseInt(clean, 10));
  };

  const handleEditCustomerSubmit = async (e) => {
    e.preventDefault();
    const name = editName.trim();
    let phone = editPhone.trim();
    const debt = parseFloat(editDebt.replace(/[^0-9]/g, '')) || 0;
    
    if (!name) {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }
    if (!phone) {
      phone = customerToEdit.phone; // fallback to original if empty
    }

    try {
      // 1. Check unique name
      const allCustomers = await db.customers.toArray();
      const existingName = allCustomers.find(c => c.name.toLowerCase() === name.toLowerCase() && c.phone !== customerToEdit.phone);
      if (existingName) {
        toast.error('Tên khách hàng đã tồn tại! Không cho phép trùng tên.');
        return;
      }

      if (phone !== customerToEdit.phone) {
        const existingPhone = await db.customers.get(phone);
        if (existingPhone) {
          toast.error('Số điện thoại này đã được sử dụng bởi khách hàng khác!');
          return;
        }
      }

      await db.transaction('rw', [db.customers, db.orders, db.customerTransactions], async () => {
        const oldData = await db.customers.get(customerToEdit.phone);
        if (!oldData) throw new Error('Khách hàng không còn tồn tại.');
        const previousDebt = Number(oldData.debt) || 0;

        if (phone !== customerToEdit.phone) {
          await db.customers.add({ ...oldData, phone, name, debt });
          await db.orders.where('customerPhone').equals(customerToEdit.phone).modify({ customerPhone: phone });
          await db.customerTransactions.where('customerPhone').equals(customerToEdit.phone).modify({ customerPhone: phone });
          await db.customers.delete(customerToEdit.phone);
        } else {
          await db.customers.update(customerToEdit.phone, { name, debt });
        }

        if (debt !== previousDebt) {
          await db.customerTransactions.add({
            customerPhone: phone,
            timestamp: Date.now(),
            type: debt > previousDebt ? 'debt' : 'payment',
            amount: Math.abs(debt - previousDebt),
            note: 'Điều chỉnh công nợ thủ công',
            previousDebt,
            remainingDebt: debt
          });
        }
      });

      toast.success('Đã cập nhật thông tin khách hàng!');
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Lỗi khi cập nhật khách hàng');
    }
  };

  if (!isOpen || !customerToEdit) return null;

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
              <Edit2 className="text-sky-500" size={20} />
              Chỉnh Sửa Khách Hàng
            </h3>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleEditCustomerSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Tên Khách Hàng *</label>
              <input 
                type="text" 
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold"
                placeholder="VD: Nguyễn Văn A..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Số Điện Thoại</label>
              <input 
                type="text" 
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold"
              />
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 font-bold flex items-center gap-1">
                <Info size={10} /> Đổi SĐT sẽ cập nhật toàn bộ lịch sử đơn hàng sang số mới.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider mb-2">Dư Nợ Hiện Tại (VNĐ)</label>
              <div className="relative">
                <input 
                  type="text"
                  value={formatNumberWithCommas(editDebt)}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    const parsed = clean ? parseInt(clean, 10).toString() : '';
                    setEditDebt(parsed);
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold font-mono"
                  placeholder="VD: 0..."
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
                Lưu Thay Đổi
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
