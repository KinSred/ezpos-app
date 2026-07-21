import React, { useState, useEffect, useRef } from 'react';
import { ScanLine, Search, X, Package, Barcode, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../db';
import { removeAccents } from '../../../utils/string';
import { useLiveQuery } from 'dexie-react-hooks';

export default function ScannerColumn({ onScan, onSelectProduct, onAddProduct, isActive = true, showShortcuts }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const onScanRef = useRef(onScan);
  
  const performanceMode = useLiveQuery(async () => {
    const perfMode = await db.settings.get('performanceMode');
    return perfMode && perfMode.value === 'true';
  }, []) || false;

  // Keep ref updated without triggering re-renders
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Search logic
  useEffect(() => {
    const searchProducts = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      const searchTokens = removeAccents(searchQuery.toLowerCase().trim()).split(/\s+/);
      try {
        const matched = await db.products
          .filter(p => {
            const pName = removeAccents(p.name.toLowerCase());
            const pBarcode = p.barcode.toLowerCase();
            return searchTokens.every(token => pName.includes(token) || pBarcode.includes(token));
          })
          .limit(15)
          .toArray();
        setSearchResults(matched);
      } catch (err) {
        console.error("Search products error:", err);
      }
    };
    searchProducts();
  }, [searchQuery]);

  // Global listener for Barcode Scanner Gun (USB/Bluetooth)
  useEffect(() => {
    if (!isActive) return;
    let barcodeKeys = '';

    const handleGlobalKeyDown = (e) => {
      // If typing inside an input/textarea, ignore to avoid conflict
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Enter') {
        if (barcodeKeys.length >= 4) {
          onScanRef.current(barcodeKeys);
          e.preventDefault();
        }
        barcodeKeys = '';
      } else if (e.key.length === 1) {
        barcodeKeys += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isActive]);

  return (
    <div 
      className="flex flex-col h-full bg-transparent transition-colors duration-500"
      aria-label="Cột máy quét mã vạch và tìm kiếm"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between flex-shrink-0 glass-panel">
        <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
          <div className="glass-card text-sky-500 p-1.5 rounded-xl shadow-sm border border-sky-500/20">
            <ScanLine size={18} strokeWidth={2.5} />
          </div>
          Tìm Kiếm & Quét Mã
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={onAddProduct}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-button text-sky-600 dark:text-sky-400 transition-all text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/50 active:scale-[0.96] border border-sky-500/20"
            aria-label="Thêm mới sản phẩm"
          >
            <Package size={14} />
            Thêm
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-4 border-b border-white/10 flex-shrink-0">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="text-slate-400 group-focus-within:text-sky-500 transition-colors" size={18} />
          </div>
          <AnimatePresence>
            {showShortcuts && (
              <motion.div initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.8}} className="absolute inset-y-0 right-12 flex items-center pointer-events-none z-10">
                <span className="text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded shadow-sm normal-case font-bold tracking-normal flex items-center gap-1">
                  <Command size={10} />/Ctrl + F
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <input 
            id="scanner-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.length >= 4) {
                e.preventDefault();
                onScanRef.current(e.target.value);
                setSearchQuery('');
                e.target.blur();
              }
            }}
            className="w-full pl-12 pr-12 py-4 glass-input rounded-2xl text-lg font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-500/70 placeholder:text-sm placeholder:font-normal focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 shadow-sm transition-all"
            placeholder="Tìm tên hoặc mã vạch sản phẩm..."
            aria-label="Tìm kiếm sản phẩm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 glass-button p-1 rounded-full transition-all active:scale-[0.96] focus:outline-none border border-white/10"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Area */}
      {!searchQuery ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
          {/* Animated Background Radar Rings */}
          {!performanceMode && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50 dark:opacity-30">
              <motion.div 
                animate={{ scale: [0.8, 1.8, 2.4], opacity: [0.6, 0.2, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                className="absolute w-36 h-36 rounded-full border-2 border-dashed border-sky-400/40"
              />
              <motion.div 
                animate={{ scale: [0.8, 2.2, 2.8], opacity: [0.4, 0.1, 0] }}
                transition={{ duration: 2.5, delay: 0.8, repeat: Infinity, ease: "easeOut" }}
                className="absolute w-36 h-36 rounded-full border border-sky-350/20"
              />
              <motion.div 
                animate={{ scale: [0.6, 1.3, 1.9], opacity: [0.5, 0.15, 0] }}
                transition={{ duration: 2.5, delay: 1.6, repeat: Infinity, ease: "easeOut" }}
                className="absolute w-36 h-36 rounded-full border-2 border-indigo-400/30"
              />
            </div>
          )}

          <motion.div
            className="relative z-10 w-32 h-32 mb-6 rounded-[2.25rem] glass-card shadow-lg flex flex-col items-center justify-center cursor-pointer group overflow-hidden"
            onClick={() => document.querySelector('input[placeholder*="Tìm tên"]').focus()}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 rounded-[2.25rem] group-hover:opacity-100 transition-opacity"></div>
            <div className="relative p-4 flex flex-col items-center justify-center">
              <motion.div
                className="relative"
                animate={{ y: [-3, 3, -3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Barcode size={52} className="text-sky-500 dark:text-sky-400 mb-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" strokeWidth={1.5} />
                
                {/* Horizontal glowing laser line */}
                <motion.div 
                  className="absolute left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_8px_#22d3ee,0_0_15px_#06b6d4]"
                  animate={{ top: ['5%', '95%', '5%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </motion.div>
              
              <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden relative">
                <motion.div 
                  animate={{ x: [-20, 20, -20] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-y-0 w-4 bg-sky-500 rounded-full shadow-[0_0_6px_rgba(14,165,233,0.8)]"
                />
              </div>
            </div>
          </motion.div>
          
          <h3 className="relative z-10 text-lg font-extrabold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
            Sẵn Sàng Quét Mã
          </h3>
          
          <p className="relative z-10 text-slate-500 dark:text-slate-400 text-xs max-w-[240px] leading-relaxed font-medium">
            Dùng máy quét cầm tay quét vào mã vạch để thêm nhanh, hoặc tìm tên sản phẩm ở ô tìm kiếm.
          </p>
        </div>
      ) : searchResults.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-2 flex items-center justify-between">
            <span>Kết quả tìm kiếm</span>
            <span className="glass-panel text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md text-xs font-black">{searchResults.length}</span>
          </div>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } },
              hidden: {}
            }}
            className="space-y-2.5"
          >
            {searchResults.map((product) => (
              <motion.button
                variants={{
                  hidden: { opacity: 0, y: 8, scale: 0.97 },
                  visible: { opacity: 1, y: 0, scale: 1 }
                }}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                key={product.id}
                onClick={() => {
                  onSelectProduct(product);
                  setSearchQuery('');
                }}
                className="w-full text-left p-4 glass-card hover:border-sky-500/50 rounded-2xl shadow-sm hover:shadow-md flex items-center justify-between transition-all group focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="font-extrabold text-slate-850 dark:text-slate-100 text-base truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {product.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 font-medium">
                    <span className="text-sky-600 dark:text-sky-400 font-extrabold text-sm flex-shrink-0">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-wider truncate">
                      {product.barcode}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 glass-button text-xs font-black text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl shadow-sm group-hover:bg-sky-500 group-hover:border-sky-500 group-hover:text-white dark:group-hover:bg-sky-500 dark:group-hover:border-sky-500 dark:group-hover:text-white transition-all flex-shrink-0">
                  Thêm
                </div>
              </motion.button>
            ))}
          </motion.div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="w-20 h-20 glass-card rounded-full flex items-center justify-center mb-4">
            <Package size={32} className="text-slate-400 dark:text-slate-500" />
          </div>
          <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100 mb-1.5">Không tìm thấy sản phẩm</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px] leading-relaxed">Không có mặt hàng nào khớp với "{searchQuery}". Hãy thử thêm mới sản phẩm.</p>
        </motion.div>
      )}
    </div>
  );
}
