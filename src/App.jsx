import React, { useState, useEffect } from 'react';
import POSScreen from './features/pos/POSScreen';
import InventoryScreen from './features/inventory/InventoryScreen';
import SettingsScreen from './features/settings/SettingsScreen';
import HistoryReportsScreen from './features/history/HistoryReportsScreen';
import CustomersScreen from './features/customers/CustomersScreen';
import RemoteScanner from './features/settings/components/RemoteScanner';
import PromotionsScreen from './features/promotions/PromotionsScreen';
import StaffScreen from './features/staff/StaffScreen';
import { ShoppingCart, Package, Settings, BarChart3, Users, Sun, Moon, Truck, Smartphone, Tag, UserCog, LogOut, Lock } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { db } from './db';
import { restoreBackupData } from './utils/backup';
import AppLogo from './components/AppLogo';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import SyncHost from './features/settings/components/SyncHost';
import { useAuth } from './contexts/AuthContext';
import LockScreen from './components/LockScreen';
import StartShiftModal from './components/StartShiftModal';
import EndShiftModal from './components/EndShiftModal';

const LiquidBackground = () => (
  <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    {/* Dark mode base */}
    <div className="absolute inset-0 bg-slate-50 dark:bg-[#050505] transition-colors duration-700" />
    
    {/* Animated Orbs */}
    <motion.div
      className="absolute -top-40 -left-40 w-96 h-96 bg-purple-400/30 dark:bg-purple-900/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-lighten"
      animate={{
        x: [0, 100, 0],
        y: [0, 50, 0],
        scale: [1, 1.2, 1],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute top-20 right-0 w-[500px] h-[500px] bg-sky-300/30 dark:bg-sky-900/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-lighten"
      animate={{
        x: [0, -100, 0],
        y: [0, 100, 0],
        scale: [1, 1.5, 1],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
    />
    <motion.div
      className="absolute -bottom-40 left-20 w-[600px] h-[600px] bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-lighten"
      animate={{
        x: [0, 150, 0],
        y: [0, -100, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
    />
  </div>
);

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, currentShift, loading: authLoading, logout } = useAuth();
  const [showEndShift, setShowEndShift] = useState(false);
  
  const currentPath = location.pathname;
  let currentTab = 'pos';
  if (currentPath === '/history') currentTab = 'history';
  else if (currentPath === '/inventory') currentTab = 'inventory';
  else if (currentPath === '/promotions') currentTab = 'promotions';
  else if (currentPath === '/customers') currentTab = 'customers';
  else if (currentPath === '/staff') currentTab = 'staff';
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

  if (authLoading) {
    return <div className="h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>;
  }

  if (!currentUser) {
    return (
      <>
        <LockScreen />
        <Toaster position="bottom-center" />
      </>
    );
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-transparent transition-colors duration-500 relative">
      <LiquidBackground />
      <StartShiftModal isOpen={!currentShift && !isAdmin} />
      {showEndShift && <EndShiftModal onClose={() => setShowEndShift(false)} />}
      
      {/* Top Navigation Bar */}
      <header className="glass-card z-20 flex-shrink-0 no-print rounded-3xl mx-4 mt-4 shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-850 dark:text-white font-extrabold text-lg sm:text-xl tracking-tight">
            <div className="p-1.5 glass-panel rounded-xl">
              <AppLogo className="w-6 h-6" />
            </div>
            <span className="hidden sm:inline bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent drop-shadow-sm">EzPOS</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-2">
            {/* Segmented Control for Navigation */}
            <nav className="relative flex glass-panel p-1.5 rounded-2xl">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/')}
                className={`relative flex items-center px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'pos'
                  ? 'text-slate-800 dark:text-white drop-shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                aria-label="Màn hình bán lẻ"
              >
                {currentTab === 'pos' && (
                  <motion.div
                    layoutId="activeTabUnderlay"
                    className="absolute inset-0 bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-white/80 dark:border-white/20 z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <ShoppingCart size={15} />
                  <span className="hidden md:inline">Bán Lẻ</span>
                </span>
              </motion.button>



              {isAdmin && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate('/history')}
                  className={`relative flex items-center px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'history'
                    ? 'text-slate-800 dark:text-white drop-shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  aria-label="Màn hình báo cáo"
                >
                  {currentTab === 'history' && (
                    <motion.div
                      layoutId="activeTabUnderlay"
                      className="absolute inset-0 bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-white/80 dark:border-white/20 z-0"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                    <BarChart3 size={15} />
                    <span className="hidden md:inline">Báo Cáo</span>
                  </span>
                </motion.button>
              )}

              {isAdmin && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/inventory')}
                className={`relative flex items-center px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'inventory'
                  ? 'text-slate-800 dark:text-white drop-shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                aria-label="Màn hình kho hàng"
              >
                {currentTab === 'inventory' && (
                  <motion.div
                    layoutId="activeTabUnderlay"
                    className="absolute inset-0 bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-white/80 dark:border-white/20 z-0"
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
              )}

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/promotions')}
                className={`relative flex items-center px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'promotions'
                  ? 'text-slate-800 dark:text-white drop-shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                aria-label="Màn hình khuyến mãi"
              >
                {currentTab === 'promotions' && (
                  <motion.div
                    layoutId="activeTabUnderlay"
                    className="absolute inset-0 bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-white/80 dark:border-white/20 z-0"
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
                  className={`relative flex items-center px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'customers'
                    ? 'text-slate-800 dark:text-white drop-shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                aria-label="Màn hình công nợ"
              >
                {currentTab === 'customers' && (
                  <motion.div
                      layoutId="activeTabUnderlay"
                      className="absolute inset-0 bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-white/80 dark:border-white/20 z-0"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <Users size={15} />
                  <span className="hidden md:inline">Công Nợ</span>
                </span>
              </motion.button>

              {isAdmin && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate('/staff')}
                  className={`relative flex items-center px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'staff'
                    ? 'text-slate-800 dark:text-white drop-shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  aria-label="Quản lý nhân viên"
                >
                  {currentTab === 'staff' && (
                    <motion.div
                      layoutId="activeTabUnderlay"
                      className="absolute inset-0 bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-white/80 dark:border-white/20 z-0"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                    <UserCog size={15} />
                    <span className="hidden md:inline">Nhân Viên</span>
                  </span>
                </motion.button>
              )}

              {isAdmin && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate('/settings')}
                  className={`relative flex items-center px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors duration-300 focus:outline-none ${currentTab === 'settings'
                    ? 'text-slate-800 dark:text-white drop-shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  aria-label="Màn hình cài đặt"
                >
                  {currentTab === 'settings' && (
                    <motion.div
                      layoutId="activeTabUnderlay"
                      className="absolute inset-0 bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-white/80 dark:border-white/20 z-0"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2 pointer-events-none">
                    <Settings size={15} />
                    <span className="hidden md:inline">Cài Đặt</span>
                  </span>
                </motion.button>
              )}
            </nav>

            {/* Mobile Sync Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSyncHost(true)}
              className="p-2.5 rounded-xl glass-button text-indigo-500 dark:text-indigo-400 focus:outline-none"
              aria-label="Đồng bộ điện thoại"
            >
              <Smartphone size={16} />
            </motion.button>

            {/* Toggle Theme Button */}
            <motion.button
              whileHover={{ scale: 1.05, rotate: 15 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-2.5 rounded-xl glass-button text-slate-600 dark:text-slate-300 focus:outline-none"
              aria-label="Chuyển chế độ tối sáng"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </motion.button>

            {/* End Shift Button */}
            {(currentShift && !isAdmin) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowEndShift(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl glass-button text-amber-600 dark:text-amber-400 font-bold focus:outline-none text-xs sm:text-sm"
              >
                <LogOut size={16} className="hidden sm:block" />
                <span>Giao Ca</span>
              </motion.button>
            )}

            {/* Lock Screen Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (currentShift && !isAdmin) {
                  toast('Ca làm việc vẫn đang mở', { icon: '🔒' });
                }
                logout();
              }}
              className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl glass-button text-slate-600 dark:text-slate-300 focus:outline-none text-xs sm:text-sm font-bold"
              aria-label="Khóa máy"
            >
              <Lock size={16} />
              <span className="hidden sm:block">Khóa Máy</span>
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative no-print">
        <div className={`h-full ${currentTab === 'pos' ? 'block' : 'hidden'}`}>
          <POSScreen key="retail" mode="retail" isActive={currentTab === 'pos'} />
        </div>

        {currentTab === 'history' && isAdmin && <HistoryReportsScreen />}
        {currentTab === 'inventory' && isAdmin && <InventoryScreen />}
        {currentTab === 'promotions' && <PromotionsScreen />}
        {currentTab === 'customers' && <CustomersScreen />}
        {currentTab === 'staff' && isAdmin && <StaffScreen />}
        {currentTab === 'settings' && isAdmin && <SettingsScreen />}
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
