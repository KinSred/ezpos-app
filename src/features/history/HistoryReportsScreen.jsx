import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Calendar, DollarSign, ShoppingBag, Printer, ChevronRight, TrendingUp, BarChart3, Percent, Search, X, ChevronLeft, Trash2, UserPlus } from 'lucide-react';
import ReportsTab from './components/ReportsTab';
import OrderDetailsDrawer from './components/OrderDetailsDrawer';
import ConvertToDebtModal from './components/ConvertToDebtModal';
import DeleteOrderModal from './components/DeleteOrderModal';
import PrintableReceipt from "../pos/components/PrintableReceipt";
import ReturnOrderModal from './components/ReturnOrderModal';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function HistoryReportsScreen() {
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'reports'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activePrintOrder, setActivePrintOrder] = useState(null);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  
  // Return order states
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [orderToReturn, setOrderToReturn] = useState(null);

  // Convert to debt states
  const [showConvertToDebtModal, setShowConvertToDebtModal] = useState(false);

  // Calendar logic
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => setCalendarDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(currentYear, currentMonth + 1, 1));

  // Sync calendar view with selected date
  useEffect(() => {
    if (searchDate) {
      const [y, m] = searchDate.split('-');
      if (y && m) {
        setCalendarDate(new Date(parseInt(y), parseInt(m) - 1, 1));
      }
    }
  }, [searchDate]);

  // Fetch orders from Dexie
  const orders = useLiveQuery(
    async () => {
      let allOrders = await db.orders.reverse().toArray();
      if (searchPhone) {
        allOrders = allOrders.filter(o => o.customerPhone && o.customerPhone.includes(searchPhone.trim()));
      }
      if (searchDate) {
        allOrders = allOrders.filter(o => {
          const d = new Date(o.timestamp);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return dateStr === searchDate;
        });
      }
      return allOrders;
    },
    [searchPhone, searchDate]
  );


  // Accessibility (A11y): Close details drawer on ESC key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setSelectedOrder(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Không rõ ngày';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Không rõ ngày';
    return date.toLocaleString('vi-VN');
  };

  const handlePrint = (order) => {
    setActivePrintOrder(order);
    setTimeout(() => {
      window.print();
      setActivePrintOrder(null);
    }, 500);
  };

  const handleConfirmReturn = async (returnedItems, refundAmount) => {
    if (!orderToReturn) return;
    try {
      // 1. Revert stock for returned items
      for (const retItem of returnedItems) {
        if (retItem.returnQty > 0) {
          const originalItem = orderToReturn.items.find(i => i.cartId === retItem.cartId);
          if (originalItem) {
            const prod = await db.products.get(originalItem.id);
            if (prod) {
              const mode = originalItem.sellMode || (originalItem.isWholesale ? 'wholesale' : 'base');
              let conversion = 1;
              if (mode === 'wholesale') conversion = prod.wholesaleConversionRate || 1;
              if (mode === 'mid') conversion = prod.midConversionRate || 1;
              const restoreQty = retItem.returnQty * conversion;
              await db.products.update(originalItem.id, {
                stock: (prod.stock || 0) + restoreQty
              });
            }
          }
        }
      }

      // 2. Reduce customer debt if credit order
      if (orderToReturn.customerPhone && (orderToReturn.paymentStatus === 'credit' || orderToReturn.paymentMethod === 'credit')) {
        const customer = await db.customers.get(orderToReturn.customerPhone);
        if (customer) {
          const newDebt = Math.max(0, (customer.debt || 0) - refundAmount);
          await db.customers.update(orderToReturn.customerPhone, { debt: newDebt });
          await db.customerTransactions.add({
            customerPhone: orderToReturn.customerPhone,
            timestamp: Date.now(),
            type: 'payment',
            amount: refundAmount,
            note: `Trả hàng một phần HĐ #${orderToReturn.id} (Giảm nợ)`,
            remainingDebt: newDebt
          });
        }
      }

      // 3. Update order in database (modify items, total, cashReceived)
      const updatedItems = orderToReturn.items.map(item => {
        const ret = returnedItems.find(r => r.cartId === item.cartId);
        if (ret && ret.returnQty > 0) {
          return { ...item, qty: item.qty - ret.returnQty };
        }
        return item;
      }).filter(item => item.qty > 0);

      if (updatedItems.length === 0) {
        // All items returned -> delete order
        await db.orders.delete(orderToReturn.id);
        toast.success("Đã trả toàn bộ hàng. Hóa đơn bị hủy.");
        setSelectedOrder(null);
      } else {
        const newTotal = Math.max(0, orderToReturn.total - refundAmount);
        
        let newCashReceived = orderToReturn.cashReceived;
        let newTransferAmount = orderToReturn.transferAmount;
        let newChangeAmount = orderToReturn.changeAmount;

        // If split payment, adjust proportionally or just deduct from transfer first, then cash
        // For simplicity, just deduct from total received
        if (orderToReturn.paymentMethod === 'split') {
           // We just store the new total, the cash/transfer split might be inaccurate now. 
           // In a real system, you'd specify how the refund is given.
        } else if (orderToReturn.paymentMethod === 'cash') {
           newCashReceived = Math.max(0, (newCashReceived || orderToReturn.total) - refundAmount);
        } else {
           newTransferAmount = Math.max(0, (newTransferAmount || orderToReturn.total) - refundAmount);
        }

        await db.orders.update(orderToReturn.id, {
          items: updatedItems,
          total: newTotal,
          cashReceived: newCashReceived,
          transferAmount: newTransferAmount,
          changeAmount: newChangeAmount,
          hasReturns: true
        });
        
        // Update selected order in state so UI reflects immediately
        const updatedOrder = await db.orders.get(orderToReturn.id);
        setSelectedOrder(updatedOrder);
        toast.success("Hoàn tất trả hàng một phần!");
      }

      setShowReturnModal(false);
      setOrderToReturn(null);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi trả hàng.");
    }
  };

  // --- State Management: Loading State ---
  if (orders === undefined) {
    return (
      <div className="h-full bg-transparent flex items-center justify-center transition-colors duration-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-500 dark:border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đang tải lịch sử bán hàng...</span>
        </div>
      </div>
    );
  }

  const totalOrdersCount = orders.length;

  return (
    <>
      <div className="h-full bg-transparent p-6 flex flex-col overflow-hidden no-print transition-colors duration-200" aria-label="Báo cáo và Lịch sử đơn hàng">
        
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-sky-950 dark:text-white tracking-tight flex items-center gap-3">
              <BarChart3 className="text-sky-600 dark:text-cyan-400" size={32} />
              Lịch Sử & Báo Cáo
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Xem lại các hóa đơn đã bán và theo dõi báo cáo doanh thu cửa hàng.</p>
          </div>

          {/* Segmented control for tabs */}
          <div className="flex bg-sky-100/60 dark:bg-sky-950/40 p-1 rounded-xl w-fit border border-sky-200/40 dark:border-sky-800/30">
            <motion.button 
              whileTap={{ scale: 0.97 }}
              onClick={() => { setActiveTab('history'); setSelectedOrder(null); }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeTab === 'history' 
                  ? 'bg-sky-600 dark:bg-sky-500 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-white/40 dark:hover:bg-white/5'
              }`}
              aria-label="Xem Tab Lịch sử hóa đơn"
            >
              Lịch sử hóa đơn
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.97 }}
              onClick={() => { setActiveTab('reports'); setSelectedOrder(null); }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeTab === 'reports' 
                  ? 'bg-sky-600 dark:bg-sky-500 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-white/40 dark:hover:bg-white/5'
              }`}
              aria-label="Xem Tab Báo cáo doanh số"
            >
              Báo cáo doanh số
            </motion.button>
          </div>
        </div>

        {/* Tab contents */}
        {activeTab === 'history' ? (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
            
            {/* Lịch sử hóa đơn table panel */}
            <div className="flex-1 glass-card rounded-3xl overflow-hidden flex flex-col min-h-0 transition-colors duration-500">
              
              {/* Search bar */}
              <div className="p-4 border-b border-sky-200/40 dark:border-sky-900/30 flex-shrink-0 flex flex-wrap items-center justify-between gap-4 bg-sky-100/30 dark:bg-sky-950/20">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="SĐT khách hàng..."
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 dark:focus:border-sky-400 transition-all text-slate-900 dark:text-slate-100 placeholder-slate-400"
                      aria-label="Tìm kiếm theo số điện thoại"
                    />
                  </div>
                  
                  {/* Calendar Toggle Button */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowCalendar(!showCalendar)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border focus:outline-none focus:ring-2 focus:ring-sky-500 active:scale-[0.96] ${
                        searchDate 
                          ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800' 
                          : 'bg-white/60 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900'
                      }`}
                      aria-label="Mở lịch chọn ngày"
                    >
                      <Calendar size={14} />
                      {searchDate ? searchDate.split('-').reverse().join('/') : 'Lọc ngày'}
                    </button>

                    <AnimatePresence>
                      {showCalendar && (
                        <>
                          {/* Backdrop overlay for mobile to close when clicked outside */}
                          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setShowCalendar(false)}></div>
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 z-50 w-[300px] bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col"
                          >
                            <div className="flex items-center justify-between mb-6">
                              <motion.button 
                                whileTap={{ scale: 0.9 }}
                                onClick={prevMonth} 
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 hover:text-sky-600 transition-colors focus:outline-none"
                                aria-label="Tháng trước"
                              >
                                <ChevronLeft size={18} />
                              </motion.button>
                              <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                Tháng {currentMonth + 1}, {currentYear}
                              </div>
                              <motion.button 
                                whileTap={{ scale: 0.9 }}
                                onClick={nextMonth} 
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 hover:text-sky-600 transition-colors focus:outline-none"
                                aria-label="Tháng sau"
                              >
                                <ChevronRight size={18} />
                              </motion.button>
                            </div>
                            
                            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-2">
                              <div>CN</div><div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div>
                            </div>
                            
                            <div className="grid grid-cols-7 gap-1 text-sm">
                              {Array.from({ length: firstDay }).map((_, i) => (
                                <div key={`empty-${i}`} className="p-2.5"></div>
                              ))}
                              {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const isSelected = searchDate === dateStr;
                                const isToday = new Date().toDateString() === new Date(currentYear, currentMonth, day).toDateString();
                                
                                return (
                                  <motion.button 
                                    whileTap={{ scale: 0.9 }}
                                    key={day}
                                    onClick={() => {
                                      setSearchDate(isSelected ? '' : dateStr);
                                      setShowCalendar(false);
                                    }}
                                    className={`p-2 rounded-full flex items-center justify-center transition-all focus:outline-none text-xs h-9 w-9 mx-auto ${
                                      isSelected 
                                        ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/30' 
                                        : isToday
                                          ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold'
                                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    {day}
                                  </motion.button>
                                );
                              })}
                            </div>
                            
                            {searchDate && (
                              <button 
                                onClick={() => {
                                  setSearchDate('');
                                  setShowCalendar(false);
                                }}
                                className="mt-4 py-2.5 w-full rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all active:scale-[0.96] focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                              >
                                Bỏ lọc ngày
                              </button>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 sm:mt-0">Tổng số: <strong>{totalOrdersCount}</strong> hóa đơn</span>
              </div>

              {/* Scrollable table wrapper */}
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                  <thead className="text-xs font-bold text-sky-900 dark:text-sky-100 uppercase tracking-wider bg-sky-100/80 dark:bg-sky-950/80 backdrop-blur-sm sticky top-0 border-b border-sky-200/50 dark:border-sky-800/30 z-10">
                    <tr>
                      <th className="px-6 py-4">Mã HĐ</th>
                      <th className="px-6 py-4">Thời gian</th>
                      <th className="px-6 py-4">Khách hàng</th>
                      <th className="px-6 py-4 text-center">Thanh toán</th>
                      <th className="px-6 py-4 text-right">Chiết khấu</th>
                      <th className="px-6 py-4 text-right">Tổng tiền</th>
                      <th className="px-6 py-4 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalOrdersCount === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-16 text-slate-500 dark:text-slate-400">
                          Không có hóa đơn nào được tìm thấy.
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr 
                          key={order.id} 
                          onClick={() => setSelectedOrder(order)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedOrder(order);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-haspopup="dialog"
                          aria-expanded={selectedOrder?.id === order.id}
                          className={`hover:bg-sky-50/50 dark:hover:bg-sky-950/20 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset ${
                            selectedOrder?.id === order.id ? 'bg-sky-500/10 dark:bg-sky-500/10' : ''
                          }`}
                        >
                          <td className="px-6 py-4 font-mono font-bold text-xs text-slate-900 dark:text-slate-100">HD-{order.id}</td>
                          <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">{formatDate(order.timestamp)}</td>
                          <td className="px-6 py-4 text-xs text-slate-900 dark:text-slate-100">
                            {order.customerPhone ? (
                              <div>
                                <span className="font-semibold block">{order.customerName}</span>
                                <span className="text-slate-500 dark:text-slate-400 font-mono">{order.customerPhone}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400 italic">Khách vãng lai</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              order.paymentMethod === 'vietqr' 
                                ? 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400' 
                                : 'bg-[#FF9500]/10 text-[#FF9500]'
                            }`}>
                              {order.paymentMethod === 'vietqr' ? 'Chuyển khoản' : 'Tiền mặt'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-xs text-slate-500 dark:text-slate-400">
                            {order.discount > 0 ? `-${formatPrice(order.discount)}` : '—'}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-slate-100">{formatPrice(order.total)}</td>
                          <td className="px-6 py-4 text-center text-slate-500 dark:text-slate-400">
                            <ChevronRight size={16} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
 
            {/* Hóa đơn chi tiết drawer bên phải */}
            <OrderDetailsDrawer
              selectedOrder={selectedOrder}
              onClose={() => setSelectedOrder(null)}
              onPrint={handlePrint}
              onConvertToDebt={() => setShowConvertToDebtModal(true)}
              onReturnOrder={(order) => { setOrderToReturn(order); setShowReturnModal(true); }}
              onDeleteOrder={(order) => setOrderToDelete(order)}
            />
          </div>
        ) : (
          /* BÁO CÁO DOANH SỐ TAB */
          <ReportsTab 
            orders={orders}
            setSearchDate={setSearchDate}
            setActiveTab={setActiveTab}
          />
        )}
      </div>

      <DeleteOrderModal 
        isOpen={!!orderToDelete} 
        onClose={() => setOrderToDelete(null)} 
        onSuccess={() => { setSelectedOrder(null); setOrderToDelete(null); }}
        orderToDelete={orderToDelete}
      />

      <ConvertToDebtModal 
        isOpen={showConvertToDebtModal} 
        onClose={() => setShowConvertToDebtModal(false)} 
        onSuccess={(updatedOrder) => { setShowConvertToDebtModal(false); setSelectedOrder(updatedOrder); }}
        selectedOrder={selectedOrder}
      />

      <AnimatePresence>
        {showReturnModal && orderToReturn && (
          <ReturnOrderModal
            order={orderToReturn}
            onClose={() => {
              setShowReturnModal(false);
              setOrderToReturn(null);
            }}
            onConfirmReturn={handleConfirmReturn}
          />
        )}
      </AnimatePresence>

      <PrintableReceipt order={activePrintOrder} />
    </>
  );
}
