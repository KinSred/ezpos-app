import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Calendar, ChevronRight, BarChart3, Search, ChevronLeft } from 'lucide-react';
import ReportsTab from './components/ReportsTab';
import OrderDetailsDrawer from './components/OrderDetailsDrawer';
import ConvertToDebtModal from './components/ConvertToDebtModal';
import DeleteOrderModal from './components/DeleteOrderModal';
import PrintableReceipt from "../pos/components/PrintableReceipt";
import ReturnOrderModal from './components/ReturnOrderModal';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateReturnRefund, getOrderItemKey, getStockQuantity } from '../../utils/order';

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
  const returnLockRef = useRef(false);
  const [isReturnProcessing, setIsReturnProcessing] = useState(false);

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
  const { allOrders, filteredOrders } = useLiveQuery(
    async () => {
      let all = await db.orders.toArray();
      all.sort((a, b) => b.timestamp - a.timestamp);
      
      let filtered = [...all];
      if (searchPhone) {
        filtered = filtered.filter(o => o.customerPhone && o.customerPhone.includes(searchPhone.trim()));
      }
      if (searchDate) {
        filtered = filtered.filter(o => {
          const d = new Date(o.timestamp);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return dateStr === searchDate;
        });
      }
      return { allOrders: all, filteredOrders: filtered };
    },
    [searchPhone, searchDate]
  ) || { allOrders: [], filteredOrders: [] };


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

  const handleConfirmReturn = async (returnedItems) => {
    if (!orderToReturn || returnLockRef.current) return;
    returnLockRef.current = true;
    setIsReturnProcessing(true);
    try {
      let updatedOrder = null;

      await db.transaction(
        'rw',
        [db.orders, db.products, db.customers, db.customerTransactions],
        async () => {
          const currentOrder = await db.orders.get(orderToReturn.id);
          if (!currentOrder) throw new Error('Hóa đơn không còn tồn tại.');
          if (currentOrder.fullyReturned === true || currentOrder.status === 'returned') {
            throw new Error('Hóa đơn này đã được hoàn toàn bộ.');
          }

          const requestedByIndex = new Map();
          for (const ret of Array.isArray(returnedItems) ? returnedItems : []) {
            const itemIndex = Number(ret?.itemIndex);
            if (!Number.isInteger(itemIndex) || itemIndex < 0) continue;
            const requestedQty = Math.max(0, Number(ret?.returnQty) || 0);
            const itemKey = typeof ret?.itemKey === 'string' ? ret.itemKey : '';
            const productId = ret?.productId;
            const previousRequest = requestedByIndex.get(itemIndex);
            if (previousRequest
              && (previousRequest.itemKey !== itemKey || String(previousRequest.productId) !== String(productId))) {
              throw new Error('Yêu cầu trả hàng chứa dữ liệu sản phẩm không nhất quán.');
            }
            requestedByIndex.set(itemIndex, {
              itemKey,
              productId,
              requestedQty: (previousRequest?.requestedQty || 0) + requestedQty
            });
          }

          const validReturns = [...requestedByIndex.entries()]
            .map(([itemIndex, request]) => {
              const item = currentOrder.items?.[itemIndex];
              const currentItemKey = item ? getOrderItemKey(item, itemIndex) : '';
              if (!item
                || currentItemKey !== request.itemKey
                || String(item.id) !== String(request.productId)) {
                throw new Error('Hóa đơn đã thay đổi. Vui lòng đóng và mở lại màn hình trả hàng.');
              }
              const currentQty = Math.max(0, Number(item?.qty ?? item?.quantity) || 0);
              const returnQty = Math.min(currentQty, request.requestedQty);
              return item && returnQty > 0
                ? { itemIndex, item, returnQty }
                : null;
            })
            .filter(Boolean);

          if (validReturns.length === 0) throw new Error('Không có sản phẩm hợp lệ để trả.');

          if (currentOrder.stockTracked !== false) {
            for (const ret of validReturns) {
              const product = await db.products.get(ret.item.id);
              if (!product) continue;
              const restoreQty = getStockQuantity({ ...ret.item, qty: ret.returnQty }, product);
              await db.products.update(product.id, {
                stock: (Number(product.stock) || 0) + restoreQty
              });
            }
          }

          const updatedItems = currentOrder.items
            .map((item, itemIndex) => {
              const ret = validReturns.find(candidate => candidate.itemIndex === itemIndex);
              if (!ret) return item;
              return { ...item, qty: Math.max(0, (Number(item.qty ?? item.quantity) || 0) - ret.returnQty) };
            })
            .filter(item => (Number(item.qty ?? item.quantity) || 0) > 0);

          const refundQuantities = Object.fromEntries(
            validReturns.map(ret => [getOrderItemKey(ret.item, ret.itemIndex), ret.returnQty])
          );
          const currentTotal = Math.max(0, Number(currentOrder.total) || 0);
          // Always recompute from the current database record. Never trust a stale
          // or client-supplied refund amount when money, debt and points are updated.
          const calculatedRefund = calculateReturnRefund(currentOrder, refundQuantities).refundAmount;
          const safeRefund = Math.min(currentTotal, Math.max(0, calculatedRefund));
          const newTotal = Math.max(0, currentTotal - safeRefund);
          const remainingFactor = currentTotal > 0 ? newTotal / currentTotal : 0;
          const returnedAt = Date.now();
          const isCreditOrder = currentOrder.paymentStatus === 'credit' || currentOrder.paymentMethod === 'credit';

          let pointsRestored = 0;
          let pointsRevoked = 0;
          let customerRemainingDebt = currentOrder.customerRemainingDebt;
          if (currentOrder.customerPhone) {
            const currentCustomer = await db.customers.get(currentOrder.customerPhone);
            if (currentCustomer) {
              const returnedRatio = 1 - remainingFactor;
              pointsRestored = Math.round((Number(currentOrder.pointsUsed) || 0) * returnedRatio);
              pointsRevoked = Math.round((Number(currentOrder.pointsEarned) || 0) * returnedRatio);
              const customerUpdate = {
                points: Math.max(0, (Number(currentCustomer.points) || 0) - pointsRevoked + pointsRestored)
              };

              if (isCreditOrder) {
                const previousDebt = Number(currentCustomer.debt) || 0;
                customerRemainingDebt = Math.max(0, previousDebt - safeRefund);
                customerUpdate.debt = customerRemainingDebt;
                await db.customerTransactions.add({
                  customerPhone: currentOrder.customerPhone,
                  timestamp: returnedAt,
                  type: 'payment',
                  amount: safeRefund,
                  orderId: currentOrder.id,
                  note: `Trả hàng HĐ #${currentOrder.id} (Giảm nợ)`,
                  previousDebt,
                  remainingDebt: customerRemainingDebt
                });
              }

              await db.customers.update(currentOrder.customerPhone, customerUpdate);
            }
          }

          const scaleMoney = field => Math.round((Number(currentOrder[field]) || 0) * remainingFactor);
          const paymentPatch = {};
          if (currentOrder.paymentMethod === 'cash') {
            paymentPatch.cashReceived = newTotal;
            paymentPatch.changeAmount = 0;
          } else if (currentOrder.paymentMethod === 'split') {
            const remainingCash = Math.round((Number(currentOrder.cashReceived) || 0) * remainingFactor);
            paymentPatch.cashReceived = Math.min(newTotal, remainingCash);
            paymentPatch.transferAmount = Math.max(0, newTotal - paymentPatch.cashReceived);
            paymentPatch.changeAmount = 0;
          } else if (currentOrder.paymentMethod === 'vietqr' || currentOrder.paymentMethod === 'transfer') {
            paymentPatch.transferAmount = newTotal;
          }

          await db.orders.update(currentOrder.id, {
            ...paymentPatch,
            items: updatedItems,
            total: newTotal,
            baseTotal: scaleMoney('baseTotal'),
            promoDiscount: scaleMoney('promoDiscount'),
            discount: scaleMoney('discount'),
            totalDiscount: scaleMoney('totalDiscount'),
            pointsDiscount: scaleMoney('pointsDiscount'),
            totalTax: scaleMoney('totalTax'),
            surcharge: scaleMoney('surcharge'),
            pointsUsed: Math.max(0, (Number(currentOrder.pointsUsed) || 0) - pointsRestored),
            pointsEarned: Math.max(0, (Number(currentOrder.pointsEarned) || 0) - pointsRevoked),
            customerRemainingDebt,
            returnedAmount: (Number(currentOrder.returnedAmount) || 0) + safeRefund,
            returnHistory: [
              ...(Array.isArray(currentOrder.returnHistory) ? currentOrder.returnHistory : []),
              {
                timestamp: returnedAt,
                amount: safeRefund,
                items: validReturns.map(ret => ({
                  productId: ret.item.id,
                  name: ret.item.name,
                  qty: ret.returnQty,
                  unit: ret.item.unit
                }))
              }
            ],
            hasReturns: true,
            fullyReturned: updatedItems.length === 0,
            status: updatedItems.length === 0 ? 'returned' : 'partially_returned'
          });

          updatedOrder = await db.orders.get(currentOrder.id);
        }
      );

      setSelectedOrder(updatedOrder);
      toast.success(updatedOrder?.fullyReturned
        ? 'Đã trả toàn bộ hàng và lưu dấu vết hóa đơn.'
        : 'Hoàn tất trả hàng một phần!');

      setShowReturnModal(false);
      setOrderToReturn(null);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Lỗi khi trả hàng.");
    } finally {
      returnLockRef.current = false;
      setIsReturnProcessing(false);
    }
  };

  // --- State Management: Loading State ---
  if (!allOrders) {
    return (
      <div className="h-full bg-transparent flex items-center justify-center transition-colors duration-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-500 dark:border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đang tải lịch sử bán hàng...</span>
        </div>
      </div>
    );
  }

  const totalOrdersCount = filteredOrders.length;

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
          <div className="flex glass-panel p-1.5 rounded-2xl w-fit">
            <motion.button 
              whileTap={{ scale: 0.97 }}
              onClick={() => { setActiveTab('history'); setSelectedOrder(null); }}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeTab === 'history' 
                  ? 'glass-card border border-white/40 dark:border-white/20 shadow-md text-sky-700 dark:text-sky-300' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300'
              }`}
              aria-label="Xem Tab Lịch sử hóa đơn"
            >
              Lịch sử hóa đơn
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.97 }}
              onClick={() => { setActiveTab('reports'); setSelectedOrder(null); }}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeTab === 'reports' 
                  ? 'glass-card border border-white/40 dark:border-white/20 shadow-md text-sky-700 dark:text-sky-300' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300'
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
              <div className="p-4 border-b border-sky-200/40 dark:border-sky-900/30 flex-shrink-0 flex flex-wrap items-center justify-between gap-4 glass-panel rounded-t-3xl border-0">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="SĐT khách hàng..."
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 glass-input rounded-xl text-xs transition-all text-slate-900 dark:text-slate-100 placeholder-slate-400"
                      aria-label="Tìm kiếm theo số điện thoại"
                    />
                  </div>
                  
                  {/* Calendar Toggle Button */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowCalendar(!showCalendar)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all glass-button border focus:outline-none focus:ring-2 focus:ring-sky-500 active:scale-[0.96] ${
                        searchDate 
                          ? 'border-sky-200 dark:border-sky-800' 
                          : 'border-white/20 dark:border-white/10'
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
                  <thead className="text-xs font-bold text-sky-900 dark:text-sky-100 uppercase tracking-wider glass-panel sticky top-0 border-b border-sky-200/50 dark:border-sky-800/30 z-10">
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
                      filteredOrders.map((order) => (
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
                          className={`hover:bg-sky-50/50 dark:hover:bg-sky-950/20 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset border-b border-white/10 dark:border-white/5 ${
                            selectedOrder?.id === order.id ? 'glass-panel' : ''
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
            orders={filteredOrders}
            allOrders={allOrders}
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
              if (isReturnProcessing) return;
              setShowReturnModal(false);
              setOrderToReturn(null);
            }}
            onConfirmReturn={handleConfirmReturn}
            isProcessing={isReturnProcessing}
          />
        )}
      </AnimatePresence>

      <PrintableReceipt order={activePrintOrder} />
    </>
  );
}
