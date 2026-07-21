import React from 'react';
import { Tag, X, Receipt, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HistoryModal({ isOpen, onClose, selectedCustomer, customerHistory, loadingHistory, onOpenPrintDebt }) {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Không rõ ngày';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Không rõ ngày';
    return date.toLocaleString('vi-VN');
  };

  if (!isOpen || !selectedCustomer) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative border border-amber-200/50 dark:border-slate-800 bg-[#fdfaf2] dark:bg-slate-950"
        >
          {/* Spiral Notebook Rings at the top */}
          <div className="absolute top-0 left-0 right-0 flex justify-center gap-4 -mt-3.5 z-20 pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-2.5 h-6 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 rounded-full border border-slate-300 shadow-sm" />
                <div className="w-1.5 h-1.5 bg-slate-900 rounded-full -mt-1.5" />
              </div>
            ))}
          </div>

          {/* Notebook Header */}
          <div className="px-6 pt-7 pb-5 border-b border-amber-200/40 dark:border-slate-800 bg-[#faf6eb]/90 dark:bg-slate-900/90 flex justify-between items-start shrink-0 relative z-10 pl-12 pr-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-widest mb-1">
                <Tag size={12} />
                Sổ công nợ chi tiết (Sổ tay)
              </div>
              <h3 className="font-extrabold text-2xl text-slate-900 dark:text-white tracking-tight">
                {selectedCustomer.name}
              </h3>
              {!selectedCustomer.phone.startsWith('_vl_') && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">SĐT: {selectedCustomer.phone}</p>
              )}
            </div>
            
            <div className="text-right flex flex-col items-end mr-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Dư nợ hiện tại:</span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 px-3 py-1 rounded-2xl shadow-sm font-mono">
                {formatPrice(selectedCustomer.debt || 0)}
              </span>
              
              {(selectedCustomer.debt || 0) > 0 && (
                <button
                  onClick={onOpenPrintDebt}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-800/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors active:scale-95"
                >
                  <Printer size={12} />
                  In Các Đơn Nợ
                </button>
              )}
            </div>

            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors -mt-1"
            >
              <X size={22} />
            </button>
          </div>

          {/* Lined Paper Notebook Content */}
          <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar bg-[#fdfaf2] dark:bg-slate-950 pl-12">
            {/* Lined paper margin line decorator */}
            <div className="absolute left-9 top-0 bottom-0 border-l-2 border-rose-300/40" />

            {loadingHistory ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              </div>
            ) : customerHistory.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
                <Receipt size={40} className="opacity-20 text-amber-700" />
                Sổ nợ trống. Chưa có lịch sử giao dịch nợ nào.
              </div>
            ) : (
              <div className="space-y-6">
                {customerHistory.map((tx, idx) => {
                  const isDebt = tx.type === 'debt';
                  return (
                    <div key={tx.id || idx} className="relative group flex justify-between items-start pb-4 border-b border-amber-100/50 dark:border-slate-800/40">
                      {/* Chronological bullet marker */}
                      <div className={`absolute -left-[16px] top-1.5 w-3 h-3 rounded-full border-2 border-[#fdfaf2] dark:border-slate-950 shadow-sm ${
                        isDebt ? 'bg-rose-500' : 'bg-emerald-500'
                      }`} />

                      <div className="flex-1 pr-6">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold font-mono tracking-wider block mb-1">
                          {formatDate(tx.timestamp)}
                        </span>
                        
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                          {tx.note}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-base font-black font-mono block ${
                          isDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {isDebt ? '+' : '-'}{formatPrice(tx.amount)}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-455 font-bold font-mono mt-1 bg-amber-50 dark:bg-slate-900 border border-amber-100 dark:border-slate-850 px-1.5 py-0.5 rounded-lg inline-block">
                          Nợ: {formatPrice(tx.remainingDebt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
