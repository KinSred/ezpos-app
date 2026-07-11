import React, { useEffect } from 'react';
import { Layers, X, CornerDownLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DuplicateBarcodeModal({ products, onSelect, onClose, onAddNew }) {
  
  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  // Keyboard Shortcuts: Number keys 1-9 to select, Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else {
        let numStr = e.key;
        if (e.code && e.code.startsWith('Numpad')) {
          numStr = e.code.replace('Numpad', '');
        }
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num >= 1 && num <= products.length) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(products[num - 1]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, onSelect, onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dup-modal-title"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] w-full max-w-xl overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-800/50 transition-colors duration-200"
      >
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-sky-50 dark:bg-sky-950/40">
          <h3 id="dup-modal-title" className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 text-lg">
            <Layers className="text-sky-600 dark:text-sky-400" size={26} strokeWidth={2.5} />
            Mã Vạch Này Bị Trùng
          </h3>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Đóng hộp thoại"
          >
            <X size={18} />
          </motion.button>
        </div>
 
        {/* Content */}
        <div className="p-6 md:p-8 space-y-5">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            Hệ thống phát hiện mã vạch này tương ứng với <strong className="text-rose-600 dark:text-rose-400 text-base">{products.length} sản phẩm</strong> khác nhau. Hãy bấm chọn sản phẩm đúng mà bạn muốn bán:
          </p>
 
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
            {products.map((product, index) => (
              <motion.button
                whileTap={{ scale: 0.96 }}
                key={product.id}
                onClick={() => onSelect(product)}
                className="w-full text-left p-5 bg-white dark:bg-slate-800/80 hover:bg-sky-50 dark:hover:bg-slate-700 border-2 border-slate-200/80 hover:border-sky-300 dark:border-slate-700 dark:hover:border-sky-500 rounded-2xl flex items-center justify-between transition-all group focus:outline-none focus:ring-4 focus:ring-sky-500/30 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                aria-label={`Chọn sản phẩm ${product.name}`}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="font-extrabold text-slate-800 dark:text-slate-100 text-lg group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors truncate">
                    {product.name}
                  </div>
                  <div className="flex gap-4 text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    <span className="flex items-center gap-1.5">
                      Giá: <strong className="text-slate-700 dark:text-slate-200 text-base">{formatPrice(product.price)}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 border-l border-slate-300 dark:border-slate-600 pl-4">
                      Tồn kho: <strong className="text-slate-700 dark:text-slate-200 text-base">{product.stock} {product.unit || 'cái'}</strong>
                    </span>
                  </div>
                </div>
                
                {/* Hotkey Badge / Enter Indicator */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 font-mono bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-xl shadow-inner group-hover:bg-sky-100 group-hover:text-sky-700 group-hover:border-sky-200 dark:group-hover:bg-sky-900/50 dark:group-hover:text-sky-300 transition-colors">
                    Phím [{index + 1}]
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
 
          <div className="pt-3">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={onAddNew}
              className="w-full text-center py-4 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 font-bold rounded-2xl text-sm transition-colors focus:outline-none focus:ring-4 focus:ring-slate-200"
            >
              + Tạo Mới Một Sản Phẩm Khác Dùng Chung Mã Vạch Này
            </motion.button>
          </div>
        </div>
 
        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-200/50 dark:border-slate-800/50 bg-slate-50/80 dark:bg-slate-900/60 text-center text-sm text-slate-500 dark:text-slate-400 flex-shrink-0 font-medium">
          Nhấn phím số tương ứng trên bàn phím để chọn hoặc bấm phím <kbd className="font-bold font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-2 py-1 rounded shadow-sm text-slate-700 dark:text-slate-300 mx-1">ESC</kbd> để hủy.
        </div>
      </motion.div>
    </div>
  );
}
