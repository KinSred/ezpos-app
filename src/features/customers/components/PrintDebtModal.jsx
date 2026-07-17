import React from 'react';
import { Printer, X, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function PrintDebtModal({
  isOpen,
  onClose,
  selectedCustomer,
  isPrintingDebt,
  printDateFrom,
  setPrintDateFrom,
  printDateTo,
  setPrintDateTo,
  handleBatchPrintDebt
}) {
  if (!isOpen || !selectedCustomer) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
        >
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Printer className="text-amber-500" size={20} />
              In Lại Các Đơn Ghi Nợ
            </h3>
            <button 
              onClick={onClose}
              disabled={isPrintingDebt}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleBatchPrintDebt} className="p-6 space-y-5">
            <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-100 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
              Hệ thống sẽ tìm và in lại toàn bộ các hoá đơn mua hàng ghi nợ của khách hàng này trong khoảng thời gian được chọn. Các hoá đơn sẽ được in lần lượt.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative z-20">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar size={12} className="text-amber-500" /> Từ Ngày
                </label>
                <DatePicker 
                  selected={printDateFrom}
                  onChange={(date) => setPrintDateFrom(date)}
                  disabled={isPrintingDebt}
                  dateFormat="dd/MM/yyyy"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all text-sm font-semibold"
                  popperClassName="custom-datepicker-popper"
                  portalId="root"
                />
              </div>
              <div className="relative z-20">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar size={12} className="text-amber-500" /> Đến Ngày
                </label>
                <DatePicker 
                  selected={printDateTo}
                  onChange={(date) => setPrintDateTo(date)}
                  disabled={isPrintingDebt}
                  dateFormat="dd/MM/yyyy"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all text-sm font-semibold"
                  popperClassName="custom-datepicker-popper"
                  portalId="root"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isPrintingDebt}
                onClick={onClose}
                className="flex-1 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isPrintingDebt}
                className="flex-[2] px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2"
              >
                {isPrintingDebt ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Đang In...
                  </>
                ) : (
                  <>
                    <Printer size={16} />
                    Bắt Đầu In
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
