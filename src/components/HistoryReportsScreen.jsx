import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Calendar, DollarSign, ShoppingBag, Printer, ChevronRight, TrendingUp, BarChart3, Percent, Search, X, ChevronLeft, Trash2 } from 'lucide-react';
import PrintableReceipt from './PrintableReceipt';
import ReturnOrderModal from './ReturnOrderModal';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

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

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      // 1. Revert product stock
      for (const item of orderToDelete.items) {
        const prod = await db.products.get(item.id);
        if (prod) {
          const qty = parseFloat(item.qty) || 0;
          const mode = item.sellMode || (item.isWholesale ? 'wholesale' : 'base');
          let conversion = 1;
          if (mode === 'wholesale') conversion = prod.wholesaleConversionRate || 1;
          if (mode === 'mid') conversion = prod.midConversionRate || 1;
          
          const restoreQty = qty * conversion;
          await db.products.update(item.id, {
            stock: (prod.stock || 0) + restoreQty
          });
        }
      }

      // 2. Revert customer debt if it's a credit order
      if (orderToDelete.customerPhone && (orderToDelete.paymentStatus === 'credit' || orderToDelete.paymentMethod === 'credit')) {
        const customer = await db.customers.get(orderToDelete.customerPhone);
        if (customer) {
          const newDebt = Math.max(0, (customer.debt || 0) - orderToDelete.total);
          await db.customers.update(orderToDelete.customerPhone, { debt: newDebt });

          await db.customerTransactions.add({
            customerPhone: orderToDelete.customerPhone,
            timestamp: Date.now(),
            type: 'payment', // acts as a reduction in debt
            amount: orderToDelete.total,
            note: `Hủy đơn hàng #${orderToDelete.id} (Hoàn nợ)`,
            remainingDebt: newDebt
          });
        }
      }

      // 3. Delete order
      await db.orders.delete(orderToDelete.id);
      toast.success("Đã xóa hóa đơn và hoàn lại tồn kho thành công!");
      setSelectedOrder(null);
      setOrderToDelete(null);
    } catch (error) {
      console.error("Lỗi khi xóa hóa đơn:", error);
      toast.error("Gặp lỗi khi xóa hóa đơn.");
    }
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

  // --- Reports calculations ---
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const totalOrdersCount = orders.length;
  const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;
  const totalDiscounts = orders.reduce((sum, o) => sum + (o.discount || 0), 0);

  // Top products calculation
  const getTopProducts = () => {
    const productCounts = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const key = item.name;
        if (!productCounts[key]) {
          productCounts[key] = { name: item.name, qty: 0, revenue: 0, unit: item.unit };
        }
        productCounts[key].qty += item.qty;
        productCounts[key].revenue += item.qty * item.price;
      });
    });
    return Object.values(productCounts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  };

  // This Month vs Last Month chart calculation
  const getChartData = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const lastMonthDate = new Date(currentYear, currentMonth, 0);
    const daysInLastMonth = lastMonthDate.getDate();
    const maxDays = Math.max(daysInCurrentMonth, daysInLastMonth);

    const chartData = Array.from({ length: maxDays }, (_, i) => ({
      day: i + 1,
      thisMonth: 0,
      lastMonth: 0,
    }));

    if (orders) {
      orders.forEach(order => {
        const orderDate = new Date(order.timestamp);
        const year = orderDate.getFullYear();
        const month = orderDate.getMonth();
        const day = orderDate.getDate();

        if (year === currentYear && month === currentMonth) {
          chartData[day - 1].thisMonth += order.total;
        } else if (
          (currentMonth > 0 && year === currentYear && month === currentMonth - 1) ||
          (currentMonth === 0 && year === currentYear - 1 && month === 11)
        ) {
          chartData[day - 1].lastMonth += order.total;
        }
      });
    }

    return chartData;
  };

  const getPaymentMethodData = () => {
    let tm = 0;
    let ck = 0;
    let qr = 0;
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    if (orders) {
      orders.forEach(order => {
        const orderDate = new Date(order.timestamp);
        if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
          const pm = order.paymentMethod || 'cash';
          if (pm === 'cash') tm += order.total;
          else if (pm === 'transfer') ck += order.total;
          else if (pm === 'qr') qr += order.total;
        }
      });
    }

    return [
      { name: 'TM', value: tm, color: '#10B981' },
      { name: 'CK', value: ck, color: '#0EA5E9' },
      { name: 'QR', value: qr, color: '#A855F7' },
    ].filter(d => d.value > 0);
  };

  const topProducts = getTopProducts();
  const chartData = getChartData();

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
                      onClick={() => setSelectedOrder(null)}
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
                        {selectedOrder.items.map((item, idx) => (
                           <div key={idx} className="py-2.5 flex justify-between">
                             <div className="pr-2">
                               <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                               <div className="text-slate-500 dark:text-slate-400 mt-0.5">{item.qty} {item.unit || 'cái'} x {formatPrice(item.price)}</div>
                             </div>
                             <span className="font-bold text-slate-900 dark:text-slate-100">{formatPrice(item.price * item.qty)}</span>
                           </div>
                        ))}
                      </div>
                    </div>
 
                    <div className="border-t border-black/5 dark:border-white/5 pt-4 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Tiền hàng:</span>
                        <span>{formatPrice(selectedOrder.items.reduce((sum, i) => sum + (i.price * i.qty), 0))}</span>
                      </div>
                      {selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                          <span>Giảm giá chiết khấu:</span>
                          <span>-{formatPrice(selectedOrder.discount)}</span>
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
                        <span className="font-bold text-slate-900 dark:text-slate-100">{selectedOrder.paymentMethod === 'vietqr' ? 'Chuyển khoản QR' : 'Tiền mặt'}</span>
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
                  
                  {/* Sticky Footer với nút In hóa đơn và Xóa hóa đơn */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row gap-3 flex-shrink-0">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handlePrint(selectedOrder)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all focus:outline-none"
                    >
                      <Printer size={14} />
                      In hóa đơn
                    </motion.button>
                    <div className="flex flex-1 gap-2">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setOrderToReturn(selectedOrder); setShowReturnModal(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white border border-amber-200/50 text-xs font-bold rounded-xl shadow-sm transition-all focus:outline-none"
                      >
                        Trả một phần
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setOrderToDelete(selectedOrder)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border border-rose-200/50 text-xs font-bold rounded-xl shadow-sm transition-all focus:outline-none"
                      >
                        <Trash2 size={14} />
                        Hủy HĐ
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* BÁO CÁO DOANH SỐ TAB */
          <div className="flex-1 overflow-y-auto space-y-6 pr-1 min-h-0 py-2">
            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-shrink-0">
              
              <div className="glass-card rounded-3xl p-5 transition-all duration-300 hover:shadow-md flex items-center justify-between group border border-slate-200/40 dark:border-slate-800/40">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                    Tổng doanh thu
                  </div>
                  <div className="text-xl font-extrabold text-slate-850 dark:text-white tracking-tight truncate">{formatPrice(totalRevenue)}</div>
                </div>
                <div className="w-12 h-12 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                  <DollarSign size={22} strokeWidth={2.5} />
                </div>
              </div>

              <div className="glass-card rounded-3xl p-5 transition-all duration-300 hover:shadow-md flex items-center justify-between group border border-slate-200/40 dark:border-slate-800/40">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                    Tổng đơn hàng
                  </div>
                  <div className="text-xl font-extrabold text-slate-855 dark:text-white tracking-tight truncate">{totalOrdersCount} đơn</div>
                </div>
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                  <ShoppingBag size={20} strokeWidth={2.5} />
                </div>
              </div>

              <div className="glass-card rounded-3xl p-5 transition-all duration-300 hover:shadow-md flex items-center justify-between group border border-slate-200/40 dark:border-slate-800/40">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                    Giá trị TB đơn
                  </div>
                  <div className="text-xl font-extrabold text-slate-855 dark:text-white tracking-tight truncate">{formatPrice(avgOrderValue)}</div>
                </div>
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                  <TrendingUp size={20} strokeWidth={2.5} />
                </div>
              </div>

              <div className="glass-card rounded-3xl p-5 transition-all duration-300 hover:shadow-md flex items-center justify-between group border border-slate-200/40 dark:border-slate-800/40">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                    Tổng chiết khấu
                  </div>
                  <div className="text-xl font-extrabold text-slate-855 dark:text-white tracking-tight truncate">{formatPrice(totalDiscounts)}</div>
                </div>
                <div className="w-12 h-12 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                  <Percent size={18} strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* Chart Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              
              {/* Daily Sales Chart */}
              <div className="lg:col-span-2 glass-card rounded-3xl p-6 flex flex-col justify-between transition-colors duration-500 border border-slate-200/40 dark:border-slate-800/40 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest">Biểu đồ DOANH THU (SO VỚI THÁNG TRƯỚC)</h3>
                </div>

                <div className="flex-1 min-h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={chartData} 
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      onClick={(data) => {
                        if (data && data.activeLabel) {
                          const day = data.activeLabel;
                          const today = new Date();
                          const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          setSearchDate(dateStr);
                          setActiveTab('history');
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" strokeOpacity={0.4} className="dark:stroke-slate-800/40" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} tickMargin={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} tickFormatter={(val) => val === 0 ? '0' : `${val/1000}k`} tickMargin={10} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', color: '#0F172A', backdropFilter: 'blur(12px)', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}
                        itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                        labelStyle={{ fontWeight: 'black', color: '#64748B', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        formatter={(value) => formatPrice(value)}
                        labelFormatter={(label) => `Ngày ${label}`}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B', paddingTop: '15px' }} />
                      <Line type="monotone" dataKey="thisMonth" name="Tháng này" stroke="url(#paintGrad)" strokeWidth={4.5} dot={false} activeDot={{ r: 6, fill: '#0EA5E9', stroke: '#FFFFFF', strokeWidth: 3 }} />
                      <Line type="monotone" dataKey="lastMonth" name="Tháng trước" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 5" dot={false} opacity={0.6} />
                      <defs>
                        <linearGradient id="paintGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#06B6D4" />
                          <stop offset="100%" stopColor="#6366F1" />
                        </linearGradient>
                      </defs>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Methods Donut */}
              <div className="glass-card rounded-3xl p-6 flex flex-col items-center justify-between transition-colors duration-500 border border-slate-200/40 dark:border-slate-800/40 shadow-sm">
                <div className="mb-2 w-full text-center">
                  <h3 className="text-xs font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest">PHƯƠNG THỨC THANH TOÁN</h3>
                </div>

                <div className="flex-1 w-full min-h-[220px] relative flex flex-col justify-center pb-6">
                  {getPaymentMethodData().length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getPaymentMethodData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={88}
                            paddingAngle={4}
                            dataKey="value"
                            stroke="none"
                          >
                            {getPaymentMethodData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value) => formatPrice(value)}
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', color: '#0F172A', backdropFilter: 'blur(12px)', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}
                            itemStyle={{ fontWeight: 'bold', color: '#0F172A', fontSize: '12px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute bottom-0 w-full flex justify-center gap-4">
                        {getPaymentMethodData().map(d => (
                          <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-slate-650 dark:text-slate-400 font-bold uppercase tracking-wider">
                            <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: d.color }}></div>
                            {d.name === 'TM' ? 'Tiền mặt' : d.name === 'CK' ? 'Chuyển khoản' : 'QR code'}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-xs text-slate-400 dark:text-slate-500 h-full flex items-center justify-center">Chưa có dữ liệu giao dịch.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Products Leaderboard */}
            <div className="glass-card rounded-3xl p-6 flex flex-col transition-colors duration-500 mt-6">
              <div>
                <h3 className="text-base font-bold text-sky-950 dark:text-white mb-1">Sản phẩm bán chạy nhất</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Xếp hạng sản phẩm theo số lượng bán ra.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 divide-y sm:divide-y-0 sm:divide-x divide-black/5 dark:divide-white/5">
                {topProducts.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 py-4 w-full">Chưa có dữ liệu bán hàng.</div>
                ) : (
                  topProducts.map((product, idx) => (
                    <div key={product.id} className="flex-1 flex flex-col items-center pt-3 sm:pt-0 sm:px-4 first:pt-0 first:px-0 first:pl-0 last:pr-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-2 ${
                        idx === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                        idx === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400' :
                        idx === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' :
                        'bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                      }`}>
                        #{idx + 1}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm text-center line-clamp-1 mb-1" title={product.name}>{product.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Đã bán: <strong className="text-sky-600 dark:text-sky-400">{product.qty}</strong></span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {orderToDelete && (
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
                  onClick={() => setOrderToDelete(null)}
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
        )}
      </AnimatePresence>

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
