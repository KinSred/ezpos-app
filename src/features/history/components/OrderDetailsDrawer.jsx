import React from 'react';
import { X, Printer, UserPlus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OrderDetailsDrawer({
  selectedOrder,
  onClose,
  onPrint,
  onConvertToDebt,
  onReturnOrder,
  onDeleteOrder
}) {
  const isFullyReturned = selectedOrder?.fullyReturned === true || selectedOrder?.status === 'returned';
  const paymentMethodLabel = {
    cash: 'Tiền mặt',
    vietqr: 'Chuyển khoản QR',
    transfer: 'Chuyển khoản',
    split: 'Tiền mặt + Chuyển khoản',
    credit: 'Ghi nợ'
  };
  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Không rõ ngày';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Không rõ ngày';
    return date.toLocaleString('vi-VN');
  };

  return (
    <AnimatePresence>
      {selectedOrder && (
        <motion.div 
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full md:w-[360px] bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col flex-shrink-0 transition-colors duration-200"
          role="dialog"
          aria-label={`Chi tiết hóa đơn HD-${selectedOrder.id}`}
        >
          <div className="px-6 py-5 border-b border-sky-200/40 dark:border-sky-900/30 flex items-center justify-between bg-sky-100/30 dark:bg-sky-950/20">
            <h3 className="font-bold text-sm text-sky-950 dark:text-white">Chi Tiết Hóa Đơn</h3>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="Đóng bảng chi tiết"
            >
              <X size={16} />
            </motion.button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            <div className="flex justify-between items-start text-xs border-b border-black/5 dark:border-white/5 pb-4">
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">HD-{selectedOrder.id}</div>
                <div className="text-slate-500 dark:text-slate-400 mt-1">{formatDate(selectedOrder.timestamp)}</div>
                {isFullyReturned && <div className="mt-2 inline-flex rounded-full bg-rose-100 dark:bg-rose-500/20 px-2 py-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">ĐÃ HOÀN TOÀN BỘ</div>}
              </div>
            </div>

            <div className="text-xs space-y-1">
              <div className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">Khách hàng</div>
              {selectedOrder.customerPhone ? (
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedOrder.customerName}</span> ({selectedOrder.customerPhone})
                </div>
              ) : (
                <div className="text-slate-500 dark:text-slate-400 italic">Khách vãng lai</div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">Danh sách món</div>
              <div className="divide-y divide-black/5 dark:divide-white/5 text-xs">
                {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="py-2.5 flex justify-between">
                      <div className="pr-2">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">{item.qty} {item.unit || 'cái'} x {formatPrice(item.price)}</div>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{formatPrice(item.price * item.qty)}</span>
                    </div>
                ))}
                {(selectedOrder.items || []).length === 0 && (
                  <div className="py-4 text-center italic text-slate-500">Không còn sản phẩm chưa hoàn.</div>
                )}
              </div>
            </div>

            <div className="border-t border-black/5 dark:border-white/5 pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Tiền hàng:</span>
                <span>{formatPrice((selectedOrder.items || []).reduce((sum, i) => sum + (i.price * i.qty), 0))}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>Giảm giá chiết khấu:</span>
                  <span>-{formatPrice(selectedOrder.discount)}</span>
                </div>
              )}
              {selectedOrder.surcharge > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Khác:</span>
                  <span>+{formatPrice(selectedOrder.surcharge)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100 border-t border-dotted border-black/10 dark:border-white/10 pt-2">
                <span>TỔNG CỘNG:</span>
                <span>{formatPrice(selectedOrder.total)}</span>
              </div>
            </div>

            <div className="bg-sky-50/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-4 text-xs space-y-1.5 transition-colors duration-200">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Hình thức:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{paymentMethodLabel[selectedOrder.paymentMethod] || 'Khác'}</span>
              </div>
              {selectedOrder.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Khách đưa:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-semibold">{formatPrice(selectedOrder.cashReceived)}</span>
                  </div>
                  <div className="flex justify-between border-t border-black/5 dark:border-white/5 pt-1.5 font-bold">
                    <span className="text-slate-500 dark:text-slate-400">Tiền thừa thối khách:</span>
                    <span className="text-emerald-500">{formatPrice(selectedOrder.changeAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-black/5 dark:border-white/5 flex flex-col gap-3 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onPrint(selectedOrder)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all focus:outline-none"
            >
              <Printer size={14} />
              In hóa đơn
            </motion.button>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              {!isFullyReturned && selectedOrder.paymentStatus !== 'credit' && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onConvertToDebt(selectedOrder)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white border border-indigo-200/50 text-xs font-bold rounded-xl shadow-sm transition-all focus:outline-none"
                >
                  <UserPlus size={14} />
                  Ghi nợ
                </motion.button>
              )}
              {!isFullyReturned && (
                <>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onReturnOrder(selectedOrder)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white border border-amber-200/50 text-xs font-bold rounded-xl shadow-sm transition-all focus:outline-none"
                  >
                    Trả 1 phần
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onDeleteOrder(selectedOrder)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border border-rose-200/50 text-xs font-bold rounded-xl shadow-sm transition-all focus:outline-none"
                  >
                    <Trash2 size={14} />
                    Hủy HĐ
                  </motion.button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
