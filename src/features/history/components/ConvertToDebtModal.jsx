import React, { useState } from 'react';
import { UserPlus, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../db';
import toast from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';

export default function ConvertToDebtModal({ isOpen, onClose, onSuccess, selectedOrder }) {
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomerForDebt, setSelectedCustomerForDebt] = useState(null);
  
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || 
    c.phone.includes(customerSearchTerm)
  );

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const handleConvertToDebt = async () => {
    if (!selectedCustomerForDebt || !selectedOrder) return;
    
    try {
      const orderId = selectedOrder.id;
      const customerPhone = selectedCustomerForDebt.phone;

      await db.transaction('rw', [db.orders, db.customers, db.customerTransactions], async () => {
        const order = await db.orders.get(orderId);
        const customer = await db.customers.get(customerPhone);
        if (!order) throw new Error('Hóa đơn không còn tồn tại.');
        if (!customer) throw new Error('Khách hàng không còn tồn tại.');
        if (order.paymentStatus === 'credit' || order.paymentMethod === 'credit') {
          throw new Error('Hóa đơn này đã là đơn ghi nợ.');
        }
        if (order.fullyReturned === true || order.status === 'returned' || (Number(order.total) || 0) <= 0) {
          throw new Error('Không thể chuyển một hóa đơn đã hoàn toàn bộ sang ghi nợ.');
        }
        const hasLoyaltyEffects = (Number(order.pointsUsed) || 0) > 0
          || (Number(order.pointsEarned) || 0) > 0;
        if (hasLoyaltyEffects && order.customerPhone !== customer.phone) {
          throw new Error('Hóa đơn có sử dụng hoặc tích điểm nên chỉ có thể ghi nợ cho khách hàng ban đầu.');
        }

        const previousDebt = Number(customer.debt) || 0;
        const amount = Number(order.total) || 0;
        const newDebt = previousDebt + amount;

        await db.orders.update(order.id, {
          paymentStatus: 'credit',
          paymentMethod: 'credit',
          customerPhone: customer.phone,
          customerName: customer.name,
          customerPreviousDebt: previousDebt,
          customerRemainingDebt: newDebt,
          cashReceived: 0,
          transferAmount: 0,
          changeAmount: 0,
        });
        await db.customers.update(customer.phone, { debt: newDebt });
        await db.customerTransactions.add({
          customerPhone: customer.phone,
          timestamp: Date.now(),
          type: 'debt',
          amount,
          previousDebt,
          remainingDebt: newDebt,
          orderId: order.id,
          note: `Chuyển hóa đơn #${order.id} sang ghi nợ`
        });
      });
      
      toast.success("Đã chuyển hóa đơn sang ghi nợ thành công!");
      
      // Đóng modal và báo thành công (gửi lại selectedOrder được update)
      setSelectedCustomerForDebt(null);
      setCustomerSearchTerm('');
      
      const updatedOrder = await db.orders.get(orderId);
      onSuccess(updatedOrder);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Lỗi khi chuyển sang ghi nợ.");
    }
  };

  const handleClose = () => {
    setSelectedCustomerForDebt(null);
    setCustomerSearchTerm('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
        role="dialog"
        aria-modal="true"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]"
        >
          <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserPlus className="text-indigo-500" size={20} />
              Chuyển Sang Ghi Nợ
            </h3>
            <button 
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="p-5 overflow-y-auto flex-1 bg-white dark:bg-slate-950/30">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Chọn khách hàng để đưa hóa đơn <strong className="text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 rounded">HD-{selectedOrder?.id}</strong> trị giá <strong className="text-rose-600 dark:text-rose-400 font-black">{selectedOrder && formatPrice(selectedOrder.total)}</strong> vào sổ nợ.
            </p>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Tìm tên hoặc SĐT khách hàng..."
                value={customerSearchTerm}
                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 dark:text-white"
              />
            </div>

            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  Không tìm thấy khách hàng.
                </div>
              ) : (
                filteredCustomers.map(cust => (
                  <div 
                    key={cust.phone}
                    onClick={() => setSelectedCustomerForDebt(cust)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center justify-between group ${selectedCustomerForDebt?.phone === cust.phone ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
                  >
                    <div>
                      <div className={`font-bold text-sm ${selectedCustomerForDebt?.phone === cust.phone ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-100'}`}>{cust.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cust.phone}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Dư Nợ Hiện Tại</div>
                      <div className={`font-extrabold text-sm ${cust.debt > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>{formatPrice(cust.debt || 0)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 dark:bg-slate-900/80 flex gap-3 border-t border-slate-100 dark:border-slate-800/80">
            <button 
              onClick={handleClose}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 dark:text-slate-350 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={handleConvertToDebt}
              disabled={!selectedCustomerForDebt}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-all focus:outline-none ${!selectedCustomerForDebt ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/30'}`}
            >
              Xác nhận Ghi Nợ
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
