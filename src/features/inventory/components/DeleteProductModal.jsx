import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../db';
import toast from 'react-hot-toast';

export default function DeleteProductModal({ isOpen, onClose, productToDelete, onSuccess }) {
  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await db.products.delete(productToDelete.id);
        toast.success("Đã xóa sản phẩm thành công!");
        if (onSuccess) onSuccess();
      } catch (error) {
        console.error("Lỗi xóa sản phẩm:", error);
        toast.error("Gặp lỗi khi xóa sản phẩm.");
      }
    }
  };

  if (!isOpen || !productToDelete) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        role="dialog"
        aria-modal="true"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
        >
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} strokeWidth={2} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Xóa mặt hàng</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Bạn có chắc chắn muốn xóa mặt hàng <strong className="text-slate-900 dark:text-slate-100">{productToDelete.name}</strong> không? Hành động này không thể hoàn tác.
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3 border-t border-slate-100 dark:border-slate-800/50">
            <button 
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={confirmDelete}
              className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-500/30 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            >
              Xác nhận Xóa
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
