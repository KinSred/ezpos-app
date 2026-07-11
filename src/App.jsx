import React, { useState, useEffect } from 'react';
import POSScreen from './components/POSScreen';
import InventoryScreen from './components/InventoryScreen';
import SettingsScreen from './components/SettingsScreen';
import HistoryReportsScreen from './components/HistoryReportsScreen';
import CustomersScreen from './components/CustomersScreen';
import RemoteScanner from './components/RemoteScanner';
import PromotionsScreen from './components/PromotionsScreen';
import { ShoppingCart, Package, Settings, BarChart3, Users, Sun, Moon, Truck, Smartphone, Tag } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { db } from './db';
import { restoreBackupData } from './utils/backup';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import SyncHost from './components/SyncHost';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const currentPath = location.pathname;
  let currentTab = 'pos';
  if (currentPath === '/wholesale') currentTab = 'wholesale';
  else if (currentPath === '/history') currentTab = 'history';
  else if (currentPath === '/inventory') currentTab = 'inventory';
  else if (currentPath === '/promotions') currentTab = 'promotions';
  else if (currentPath === '/customers') currentTab = 'customers';
  else if (currentPath === '/settings') currentTab = 'settings';

  // Theme state
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [showSyncHost, setShowSyncHost] = useState(false);

  const lowStockCount = useLiveQuery(async () => {
    const hideStock = await db.settings.get('hideStock');
    if (hideStock && hideStock.value === 'true') return 0;
    const allProducts = await db.products.toArray();
    return allProducts.filter(p => p.stock <= (p.lowStockAlert !== undefined ? p.lowStockAlert : 5)).length;
  }) || 0;

  // Apply theme to body class list
  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Automatic recovery check on mount
  useEffect(() => {
    const checkAndRecover = async () => {
      try {
        const prodCount = await db.products.count();
        const localBackup = localStorage.getItem('pos_local_backup');
        if (prodCount === 0 && localBackup) {
          if (window.confirm("Phát hiện dữ liệu trống. Bạn có muốn tự động phục hồi lại dữ liệu bán hàng gần nhất lưu trên trình duyệt này không?")) {
            const data = JSON.parse(localBackup);
            await restoreBackupData(data);
            toast.success("Đã phục hồi dữ liệu tự động!");
            setTimeout(() => window.location.reload(), 1000);
          }
        }
      } catch (err) {
        console.error("Lỗi tự động kiểm tra sao lưu:", err);
      }
    };
    checkAndRecover();
  }, []);

  // Simple routing for remote scanner
  if (currentPath === '/remote') {
    return (
      <>
        <RemoteScanner />
        <Toaster position="bottom-center" />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-transparent transition-colors duration-500">
      {/* Top Navigation Bar */}
      <header className="glass-card z-20 flex-shrink-0 no-print rounded-2xl mx-4 mt-4 border border-slate-200/30 dark:border-slate-800/30 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-none">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-850 dark:text-white font-extrabold text-lg sm:text-xl tracking-tight">
            <div className="bg-gradient-to-tr from-indigo-500 to-sky-500 text-white p-2.5 rounded-xl shadow-md shadow-indigo-500/20">
              <ShoppingCart size={18} />
            </div>
            <span className="hidden sm:inline bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">Tạp Hóa Hồng Ngọc</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-2">
            {/* Segmented Control for Navigation */}
            <nav className="relative flex bg-slate-100/80 dark:bg-slate-950/40 p-1 rounded-xl shadow-inner border border-slate-200/30 dark:border-slate-800/30">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/')}
                className={`relative flex items-center px-3 sm:px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'pos'
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                aria-label="Màn hình bán lẻ"
              >
                {currentTab === 'pos' && (
                  <motion.div
                    layoutId="activeTabUnderlay"
                    className="absolute inset-0 bg-gradient-to-r from-sky-500 to-blue-600 rounded-lg shadow-md shadow-sky-500/20 z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <ShoppingCart size={15} />
                  <span className="hidden md:inline">Bán Lẻ</span>
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/wholesale')}
                className={`relative flex items-center px-3 sm:px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'wholesale'
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                aria-label="Màn hình giao sỉ"
              >
                {currentTab === 'wholesale' && (
                  <motion.div
                    layoutId="activeTabUnderlay"
                    className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg shadow-md shadow-amber-500/20 z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <Truck size={15} />
                  <span className="hidden md:inline">Giao Sỉ</span>
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/history')}
                className={`relative flex items-center px-3 sm:px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'history'
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                aria-label="Màn hình báo cáo"
              >
                {currentTab === 'history' && (
                  <motion.div
                    layoutId="activeTabUnderlay"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-md shadow-indigo-500/20 z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <BarChart3 size={15} />
                  <span className="hidden md:inline">Báo Cáo</span>
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/inventory')}
                className={`relative flex items-center px-3 sm:px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'inventory'
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                aria-label="Màn hình kho hàng"
              >
                {currentTab === 'inventory' && (
                  <motion.div
                    layoutId="activeTabUnderlay"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg shadow-md shadow-emerald-500/20 z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <div className="relative flex items-center justify-center">
                    <Package size={15} />
                    {lowStockCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </div>
                  <span className="hidden md:inline">Kho Hàng</span>
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/promotions')}
                className={`relative flex items-center px-3 sm:px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'promotions'
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                aria-label="Màn hình khuyến mãi"
              >
                {currentTab === 'promotions' && (
                  <motion.div
                    layoutId="activeTabUnderlay"
                    className="absolute inset-0 bg-gradient-to-r from-rose-500 to-pink-600 rounded-lg shadow-md shadow-rose-500/20 z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <Tag size={15} />
                  <span className="hidden md:inline">Khuyến Mãi</span>
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/customers')}
                className={`relative flex items-center px-3 sm:px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'customers'
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                aria-label="Màn hình công nợ"
              >
                {currentTab === 'customers' && (
                  <motion.div
                    layoutId="activeTabUnderlay"
                    className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-600 rounded-lg shadow-md shadow-violet-500/20 z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <Users size={15} />
                  <span className="hidden md:inline">Công Nợ</span>
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/settings')}
                className={`relative flex items-center px-3 sm:px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'settings'
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                aria-label="Màn hình cài đặt"
              >
                {currentTab === 'settings' && (
                  <motion.div
                    layoutId="activeTabUnderlay"
                    className="absolute inset-0 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg shadow-md shadow-slate-600/20 z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <Settings size={15} />
                  <span className="hidden md:inline">Cài Đặt</span>
                </span>
              </motion.button>
            </nav>

            {/* Mobile Sync Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSyncHost(true)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 hover:dark:bg-slate-800 text-indigo-500 hover:text-indigo-650 dark:text-indigo-400 dark:hover:text-indigo-300 transition-all duration-300 focus:outline-none border border-slate-200/50 dark:border-slate-800/50 shadow-sm"
              aria-label="Đồng bộ điện thoại"
            >
              <Smartphone size={16} />
            </motion.button>

            {/* Toggle Theme Button */}
            <motion.button
              whileHover={{ scale: 1.05, rotate: 15 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 hover:dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all duration-300 focus:outline-none border border-slate-200/50 dark:border-slate-800/50 shadow-sm"
              aria-label="Chuyển chế độ tối sáng"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative no-print">
        <div className={`h-full ${currentTab === 'pos' ? 'block' : 'hidden'}`}>
          <POSScreen key="retail" mode="retail" isActive={currentTab === 'pos'} />
        </div>
        <div className={`h-full ${currentTab === 'wholesale' ? 'block' : 'hidden'}`}>
          <POSScreen key="wholesale" mode="wholesale" isActive={currentTab === 'wholesale'} />
        </div>
        {currentTab === 'history' && <HistoryReportsScreen />}
        {currentTab === 'inventory' && <InventoryScreen />}
        {currentTab === 'promotions' && <PromotionsScreen />}
        {currentTab === 'customers' && <CustomersScreen />}
        {currentTab === 'settings' && <SettingsScreen />}
      </main>

      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 1500,
          style: {
            fontSize: '13px',
            padding: '10px 18px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.9)',
            color: '#1e293b',
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.05)',
            fontWeight: 'bold',
            backdropFilter: 'blur(8px)'
          }
        }}
        maxToasts={1}
      />
      <SyncHost showModal={showSyncHost} onClose={() => setShowSyncHost(false)} />
    </div>
  );
}

export default App;
