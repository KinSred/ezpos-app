import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function QuickEditModal({ config, onClose }) {
  const [value, setValue] = useState(config.currentValue);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (config.type !== 'number') {
        inputRef.current.select();
      }
    }
  }, [config]);

  const handleSubmit = (e) => {
    e.preventDefault();
    let finalValue = value;
    if (config.type === 'number') {
      const numVal = parseFloat(value);
      if (isNaN(numVal)) {
        toast.error("Vui lòng nhập số hợp lệ.");
        return;
      }
      finalValue = numVal;
      // Auto multiply shorthand for price fields
      const priceFields = ['price', 'creditPrice', 'midPrice', 'midCreditPrice', 'wholesalePrice', 'wholesaleCreditPrice'];
      if (priceFields.includes(config.fieldName) && finalValue > 0 && finalValue < 1000) {
        finalValue = finalValue * 1000;
      }
    } else {
      finalValue = String(value).trim();
    }
    config.onSave(finalValue);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Helper live preview for Vietnam Dong (VND) price field
  const priceFields = ['price', 'creditPrice', 'midPrice', 'midCreditPrice', 'wholesalePrice', 'wholesaleCreditPrice'];
  const showVndMultiplierHelper = priceFields.includes(config.fieldName) && Number(value) > 0 && Number(value) < 1000;

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
        className="glass-card rounded-3xl w-full max-w-sm overflow-hidden flex flex-col transition-colors duration-500"
      >
        <div className="px-6 py-5 border-b border-sky-200/50 dark:border-sky-800/40 flex items-center justify-between bg-sky-100/50 dark:bg-sky-950/40">
          <h3 className="font-bold text-sky-950 dark:text-white text-base">
            Cập nhật {config.fieldLabel}
          </h3>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-full transition-colors focus:outline-none"
            aria-label="Đóng"
          >
            <X size={18} />
          </motion.button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Nhập giá trị mới
            </label>
            <input 
              ref={inputRef}
              type={config.type}
              required
              step={config.fieldName === 'unit' ? undefined : 'any'}
              min={config.type === 'number' ? "0" : undefined}
              value={value}
              onChange={(e) => {
                if (config.type === 'number' && e.target.value.includes('-')) return;
                setValue(e.target.value);
              }}
              className="w-full px-4 py-2.5 bg-sky-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 transition-all font-semibold"
            />
            {showVndMultiplierHelper && (
              <p className="mt-2 text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/5 dark:bg-sky-500/10 p-2 rounded-xl border border-sky-500/10">
                👉 Nhập nhầm giá thấp? Tự động nhảy thành: <strong className="font-bold text-sm underline">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) * 1000)}</strong>
              </p>
            )}
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
              className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-2xl text-sm shadow-[0_4px_12px_rgba(14,165,233,0.15)] transition-all focus:outline-none"
            >
              Lưu thay đổi
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
