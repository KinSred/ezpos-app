import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeftRight, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReturnOrderModal({ order, onClose, onConfirmReturn }) {
  // returnQtyMap: { [cartId]: quantityToReturn }
  const [returnQtyMap, setReturnQtyMap] = useState({});

  const handleQtyChange = (cartId, value, maxQty) => {
    let qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) qty = 0;
    if (qty > maxQty) qty = maxQty;
    
    setReturnQtyMap(prev => ({
      ...prev,
      [cartId]: qty
    }));
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const totalRefundAmount = order.items.reduce((sum, item) => {
    const retQty = returnQtyMap[item.cartId] || 0;
    return sum + (retQty * item.price);
  }, 0);

  // Consider proportional discount refund if there was an order-level discount
  // If order had discount, the effective item price is lower.
  // For simplicity, we can just subtract a proportional amount of the discount, or let the user adjust.
  // Let's just do a simple proportional discount deduction.
  const returnRatio = order.total > 0 && order.items.reduce((sum, item) => sum + item.price * item.qty, 0) > 0 
    ? totalRefundAmount / order.items.reduce((sum, item) => sum + item.price * item.qty, 0)
    : 0;
  
  const effectiveDiscountRefund = (order.discount || 0) * returnRatio;
  const finalRefundAmount = Math.max(0, totalRefundAmount - effectiveDiscountRefund);

  const handleSubmit = () => {
    const returnedItems = [];
    let hasReturns = false;
    
    for (const item of order.items) {
      const retQty = returnQtyMap[item.cartId] || 0;
      if (retQty > 0) hasReturns = true;
      returnedItems.push({
        cartId: item.cartId,
        returnQty: retQty,
      });
    }

    if (!hasReturns) {
      toast.error("Vui lòng chọn số lượng sản phẩm cần trả!");
      return;
    }

    onConfirmReturn(returnedItems, finalRefundAmount);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto no-print">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-800/50"
      >
        <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-rose-50/80 dark:bg-rose-900/20 backdrop-blur-sm">
          <h3 className="font-extrabold text-rose-800 dark:text-rose-100 flex items-center gap-2 text-base">
            <div className="bg-rose-100 dark:bg-rose-500/20 p-1.5 rounded-lg text-rose-600 dark:text-rose-400">
              <ArrowLeftRight size={20} strokeWidth={2.5} />
            </div>
            Trả Hàng Một Phần
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 p-2 rounded-2xl transition-colors"
          >
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="mb-4 bg-amber-50 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/30 flex gap-3">
            <AlertCircle className="text-amber-500 flex-shrink-0" size={20} />
            <div className="text-sm text-amber-700 dark:text-amber-400">
              <span className="font-bold">Lưu ý:</span> Việc trả hàng sẽ tự động cộng lại tồn kho cho các sản phẩm được chọn và tính toán lại doanh thu của hóa đơn <strong>HD-{order.id}</strong>.
            </div>
          </div>

          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.cartId} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{item.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đã mua: <strong>{item.qty}</strong> {item.unit || 'cái'} × {formatPrice(item.price)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SL Trả</label>
                  <input
                    type="number"
                    min="0"
                    max={item.qty}
                    step="any"
                    value={returnQtyMap[item.cartId] || ''}
                    onChange={(e) => handleQtyChange(item.cartId, e.target.value, item.qty)}
                    className="w-20 px-3 py-2 text-center font-black text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>

          {totalRefundAmount > 0 && (
            <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Tổng giá trị hàng trả:</span>
                <span>{formatPrice(totalRefundAmount)}</span>
              </div>
              {effectiveDiscountRefund > 0 && (
                <div className="flex justify-between text-rose-500 font-medium">
                  <span>Trừ chiết khấu tương ứng:</span>
                  <span>-{formatPrice(effectiveDiscountRefund)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200">Tiền cần hoàn khách:</span>
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{formatPrice(finalRefundAmount)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-end gap-3 bg-slate-50/80 dark:bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 shadow-lg shadow-rose-500/30 transition-all"
          >
            <CheckCircle2 size={18} />
            Xác nhận trả hàng
          </button>
        </div>
      </motion.div>
    </div>
  );
}
