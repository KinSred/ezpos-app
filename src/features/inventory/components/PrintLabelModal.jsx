import React, { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function PrintLabelModal({ product, onClose, onPrint }) {
  const [quantity, setQuantity] = useState(1);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = parseInt(quantity, 10);
    if (isNaN(q) || q <= 0) {
      toast.error("Vui lòng nhập số lượng hợp lệ (> 0)");
      return;
    }
    onPrint(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="glass-card rounded-3xl w-full max-w-sm overflow-hidden flex flex-col transition-colors duration-500 bg-white dark:bg-slate-900"
      >
        <div className="px-6 py-5 border-b border-sky-200/50 dark:border-sky-800/40 flex items-center justify-between bg-sky-100/50 dark:bg-sky-950/40">
          <h3 className="font-bold text-sky-950 dark:text-white text-base flex items-center gap-2">
            <Printer size={18} /> In tem mã vạch
          </h3>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-full transition-colors focus:outline-none"
          >
            <X size={18} />
          </motion.button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              Sản phẩm: <strong className="text-slate-900 dark:text-white">{product.name}</strong><br/>
              Mã vạch: <span className="font-mono text-xs">{product.barcode}</span>
            </div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Số lượng tem cần in
            </label>
            <input 
              ref={inputRef}
              type="number"
              required
              min="1"
              max="200"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2.5 bg-sky-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 transition-all font-semibold"
            />
          </div>

          <div className="mt-4 pt-4 border-t border-sky-200/40 dark:border-sky-900/30 flex justify-end gap-3">
            <motion.button 
              whileTap={{ scale: 0.97 }}
              type="button" 
              onClick={onClose}
              className="px-5 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold rounded-2xl text-sm transition-all focus:outline-none"
            >
              Hủy
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.97 }}
              type="submit" 
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-2xl text-sm shadow-[0_4px_12px_rgba(99,102,241,0.2)] transition-all focus:outline-none flex items-center gap-2"
            >
              <Printer size={16} />
              In ngay
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
