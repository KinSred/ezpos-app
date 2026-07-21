import React, { useEffect } from 'react';
import { CheckCircle2, Printer, PlusCircle, X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CheckoutSuccessModal({ order, onClose, onPrint }) {
  useEffect(() => {
    // Accessibility: Listen to ESC/Enter key to close modal
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!order) return null;

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.2)] w-full max-w-sm overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-800/50 transition-colors duration-200"
      >
        
        {/* Header decoration */}
        <div className="flex flex-col items-center pt-8 pb-4 text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-3.5 animate-bounce">
            <CheckCircle2 size={44} strokeWidth={2} />
          </div>
          <h3 id="success-modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Thanh Toán Thành Công!
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 font-semibold">
            Mã hóa đơn: HD-{order.id}
          </p>
        </div>
 
        {/* Invoice Summary */}
        <div className="px-6 py-2 space-y-3.5">
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-4 space-y-2.5 transition-colors duration-200">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Hình thức:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {order.paymentMethod === 'vietqr' ? 'Chuyển khoản QR' : 'Tiền mặt'}
              </span>
            </div>
            
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-800/50 pt-2.5">
              <span>Tổng cộng cần thu:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                {formatPrice(order.total)}
              </span>
            </div>
 
            {order.paymentMethod === 'cash' && (
              <>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-800/50 pt-2.5">
                  <span>Tiền khách đưa:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {formatPrice(order.cashReceived)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl mt-1.5">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Tiền thừa trả khách:</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatPrice(order.changeAmount)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
 
        {/* Buttons Action */}
        <div className="p-6 flex flex-col gap-3">
          <motion.button 
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              onPrint(order);
              onClose();
            }}
            className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="In hóa đơn đơn hàng này"
          >
            <Printer size={18} />
            In Hóa Đơn (Print)
          </motion.button>
 
          <motion.button 
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            className="w-full py-3.5 bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(2,132,199,0.15)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Bắt đầu đơn hàng mới"
          >
            <PlusCircle size={18} />
            Đơn Hàng Mới
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
