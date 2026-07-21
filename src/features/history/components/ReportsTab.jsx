import React from 'react';
import { DollarSign, ShoppingBag, TrendingUp, Percent } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

export default function ReportsTab({ orders, allOrders, setSearchDate, setActiveTab }) {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const today = new Date();
  const todayRevenue = (allOrders || []).reduce((sum, o) => {
    const d = new Date(o.timestamp);
    if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
      return sum + o.total;
    }
    return sum;
  }, 0);

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const totalOrdersCount = orders.length;
  const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

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
      { name: 'Tiền mặt', value: tm, color: '#10B981' },
      { name: 'Chuyển khoản', value: ck, color: '#0EA5E9' },
      { name: 'QR Code', value: qr, color: '#A855F7' },
    ].filter(d => d.value > 0);
  };

  const topProducts = getTopProducts();
  const chartData = getChartData();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3.5 rounded-2xl border border-white/20 dark:border-white/10 shadow-xl text-xs space-y-1.5">
          <p className="font-extrabold text-slate-500 dark:text-slate-400">{`Ngày ${label}`}</p>
          {payload.map((pld) => (
            <div key={pld.name} className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color || pld.stroke }} />
              <span>{pld.name}: {formatPrice(pld.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="glass-card p-3 rounded-2xl border border-white/20 dark:border-white/10 shadow-xl text-xs font-bold text-slate-800 dark:text-white">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.payload.color }} />
            <span>{data.name}: {formatPrice(data.value)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-1 min-h-0 py-2">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-shrink-0">
        
        <div className="glass-card-glow rounded-3xl p-5 flex items-center justify-between group border border-slate-200/40 dark:border-slate-800/40">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              Doanh thu hôm nay
            </div>
            <div className="text-xl font-extrabold text-slate-850 dark:text-white tracking-tight truncate">{formatPrice(todayRevenue)}</div>
          </div>
          <div className="w-12 h-12 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
            <DollarSign size={22} strokeWidth={2.5} />
          </div>
        </div>

        <div className="glass-card-glow rounded-3xl p-5 flex items-center justify-between group border border-slate-200/40 dark:border-slate-800/40">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              Tổng doanh thu
            </div>
            <div className="text-xl font-extrabold text-slate-850 dark:text-white tracking-tight truncate">{formatPrice(totalRevenue)}</div>
          </div>
          <div className="w-12 h-12 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
            <DollarSign size={22} strokeWidth={2.5} />
          </div>
        </div>

        <div className="glass-card-glow rounded-3xl p-5 flex items-center justify-between group border border-slate-200/40 dark:border-slate-800/40">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              Tổng đơn hàng
            </div>
            <div className="text-xl font-extrabold text-slate-855 dark:text-white tracking-tight truncate">{totalOrdersCount} đơn</div>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
            <ShoppingBag size={20} strokeWidth={2.5} />
          </div>
        </div>

        <div className="glass-card-glow rounded-3xl p-5 flex items-center justify-between group border border-slate-200/40 dark:border-slate-800/40">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              Giá trị TB đơn
            </div>
            <div className="text-xl font-extrabold text-slate-855 dark:text-white tracking-tight truncate">{formatPrice(avgOrderValue)}</div>
          </div>
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
            <TrendingUp size={20} strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Daily Sales Chart */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 flex flex-col justify-between transition-colors duration-500 border border-slate-200/40 dark:border-slate-800/40 shadow-xs">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest">Biểu đồ DOANH THU THÁNG NÀY</h3>
          </div>

          <div className="flex-1 min-h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
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
                <defs>
                  <linearGradient id="colorThisMonth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" strokeOpacity={0.3} className="dark:stroke-slate-800/30" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} tickMargin={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} tickFormatter={(val) => val === 0 ? '0' : `${val/1000}k`} tickMargin={10} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B', paddingTop: '15px' }} />
                <Area type="monotone" dataKey="thisMonth" name="Tháng này" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#colorThisMonth)" activeDot={{ r: 6, fill: '#38bdf8', stroke: '#FFFFFF', strokeWidth: 3 }} />
                <Area type="monotone" dataKey="lastMonth" name="Tháng trước" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" fill="none" opacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Donut */}
        <div className="glass-card rounded-3xl p-6 flex flex-col items-center justify-between transition-colors duration-500 border border-slate-200/40 dark:border-slate-800/40 shadow-xs">
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
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {getPaymentMethodData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute bottom-0 w-full flex justify-center gap-4">
                  {getPaymentMethodData().map(d => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-slate-650 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <div className="w-2.5 h-2.5 rounded-full shadow-xs" style={{ backgroundColor: d.color }}></div>
                      {d.name}
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
          <h3 className="text-base font-bold text-sky-955 dark:text-white mb-1">Sản phẩm bán chạy nhất</h3>
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
                  idx === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-450' :
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
  );
}
