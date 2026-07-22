import React from 'react';
import { Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../db';
import toast from 'react-hot-toast';
import { getStockQuantity } from '../../../utils/order';

export default function DeleteOrderModal({ isOpen, onClose, onSuccess, orderToDelete }) {
  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      await db.transaction(
        'rw',
        [db.orders, db.products, db.customers, db.customerTransactions],
        async () => {
          const currentOrder = await db.orders.get(orderToDelete.id);
          if (!currentOrder) throw new Error('Hóa đơn không còn tồn tại.');
          if (currentOrder.fullyReturned === true || currentOrder.status === 'returned') {
            throw new Error('Hóa đơn đã hoàn toàn bộ được giữ lại để đối soát và không thể hủy lần nữa.');
          }

          if (currentOrder.stockTracked !== false) {
            for (const item of currentOrder.items || []) {
              const product = await db.products.get(item.id);
              if (!product) continue;
              await db.products.update(product.id, {
                stock: (Number(product.stock) || 0) + getStockQuantity(item, product)
              });
            }
          }

          if (currentOrder.customerPhone) {
            const customer = await db.customers.get(currentOrder.customerPhone);
            if (customer) {
              const customerUpdate = {
                points: Math.max(
                  0,
                  (Number(customer.points) || 0)
                    - (Number(currentOrder.pointsEarned) || 0)
                    + (Number(currentOrder.pointsUsed) || 0)
                )
              };

              if (currentOrder.paymentStatus === 'credit' || currentOrder.paymentMethod === 'credit') {
                const previousDebt = Number(customer.debt) || 0;
                const newDebt = Math.max(0, previousDebt - (Number(currentOrder.total) || 0));
                customerUpdate.debt = newDebt;
                await db.customerTransactions.add({
                  customerPhone: currentOrder.customerPhone,
                  timestamp: Date.now(),
                  type: 'payment',
                  amount: Number(currentOrder.total) || 0,
                  orderId: currentOrder.id,
                  note: `Hủy đơn hàng #${currentOrder.id} (Hoàn nợ)`,
                  previousDebt,
                  remainingDebt: newDebt
                });
              }

              await db.customers.update(currentOrder.customerPhone, customerUpdate);
            }
          }

          await db.orders.delete(currentOrder.id);
        }
      );
      toast.success("Đã xóa hóa đơn và hoàn lại tồn kho thành công!");
      onSuccess();
    } catch (error) {
      console.error("Lỗi khi xóa hóa đơn:", error);
      toast.error(error?.message || "Gặp lỗi khi xóa hóa đơn.");
    }
  };

  if (!isOpen || !orderToDelete) return null;

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
              <Trash2 size={32} strokeWidth={2} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Xóa hóa đơn</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Bạn có chắc muốn xóa hóa đơn <strong className="text-slate-900 dark:text-slate-100">HD-{orderToDelete.id}</strong>? 
              Hệ thống sẽ cộng lại số lượng sản phẩm vào kho và trừ nợ tương ứng cho khách hàng. Hành động này không thể hoàn tác.
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3 border-t border-slate-100 dark:border-slate-800/50">
            <button 
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl font-bold text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={confirmDeleteOrder}
              className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/30 focus:outline-none"
            >
              Xác nhận Xóa
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
