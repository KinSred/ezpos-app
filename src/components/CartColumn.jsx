import React, { useState } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, X, PackageOpen, Package, Receipt, Gift, CheckSquare, Edit2, Command, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CartColumn({ 
  items, 
  onUpdateQty, 
  onSetQty,
  onRemove, 
  onClear,
  onSetSellMode,
  isCredit,
  getAppliedPrice,
  getEffectiveTaxRate,
  totalAmount,
  totalTaxAmount,
  finalAmount,
  discount,
  discountType,
  onCheckout,
  activePromotions = [],
  onUpdateCustomPrice,
  cartTabs = [],
  activeTabId = null,
  onAddTab,
  onRemoveTab,
  onSwitchTab,
  showShortcuts
}) {
  const [editingCartId, setEditingCartId] = useState(null);
  const [editPriceVal, setEditPriceVal] = useState('');

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const formatNumberWithCommas = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = val.toString().replace(/[^0-9]/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('en-US').format(parseInt(clean, 10));
  };

  const adjustPriceShorthand = (priceStr) => {
    if (!priceStr) return '';
    const clean = priceStr.replace(/[^0-9]/g, '');
    const val = parseInt(clean, 10);
    if (isNaN(val)) return '';
    return val.toString();
  };

  const handleSaveCustomPrice = (cartId, valueStr) => {
    if (valueStr === '') {
      onUpdateCustomPrice(cartId, '');
    } else {
      const clean = valueStr.replace(/[^0-9]/g, '');
      const adjusted = adjustPriceShorthand(clean);
      onUpdateCustomPrice(cartId, adjusted);
    }
    setEditingCartId(null);
  };

  const [isCompact, setIsCompact] = useState(() => localStorage.getItem('compactMode') === 'true');
  const toggleCompact = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('compactMode', newVal.toString());
  };

  const handleToggleAllWholesale = () => {
    if (items.length > 0) {
      const allWholesale = items.every(item => item.sellMode === 'wholesale' || (!item.sellMode && item.isWholesale));
      const newMode = allWholesale ? 'base' : 'wholesale';
      items.forEach(item => {
        if (item.wholesaleUnit) {
          onSetSellMode(item.cartId, newMode);
        }
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent relative transition-colors duration-500">
      <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur z-10 sticky top-0 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
            <ShoppingCart size={20} className="text-sky-600 dark:text-sky-400" />
            Giỏ Hàng
          </h2>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCompact}
              className={`text-[10px] font-bold px-2 py-1.5 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/50 active:scale-[0.95] ${isCompact ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title="Giao diện thu gọn"
              aria-label="Giao diện thu gọn"
            >
              Thu gọn
            </button>
            {items.length > 0 && (
              <>
                <button
                  onClick={handleToggleAllWholesale}
                  className="relative text-[10px] font-bold px-2 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 active:scale-[0.95]"
                  title="Chuyển toàn bộ sang Giá Sỉ (F10)"
                  aria-label="Chuyển toàn bộ sang Giá Sỉ"
                >
                  <AnimatePresence>
                    {showShortcuts && (
                      <motion.span initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.8}} className="absolute -top-6 right-0 text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded shadow-sm font-bold flex items-center gap-1 whitespace-nowrap z-50">
                        <Command size={10} />/Ctrl + D
                      </motion.span>
                    )}
                  </AnimatePresence>
                  Sỉ toàn đơn (F10)
                </button>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={onClear}
                  className="text-xs text-rose-600 hover:text-white dark:text-rose-400 font-semibold flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-rose-600 dark:hover:bg-rose-500 transition-all focus:outline-none"
                  title="Xóa toàn bộ giỏ hàng (trong tab này)"
                  aria-label="Xóa toàn bộ giỏ hàng"
                >
                  <X size={14} />
                </motion.button>
              </>
            )}
          </div>
        </div>

        {/* Tabs Row */}
        {cartTabs && cartTabs.length > 0 && (
          <div className="relative">
            <AnimatePresence>
              {showShortcuts && (
                <motion.span initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.8}} className="absolute -top-6 right-0 text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded shadow-sm font-bold flex items-center gap-1 whitespace-nowrap z-50">
                  <Command size={10} />/Ctrl + T
                </motion.span>
              )}
            </AnimatePresence>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {cartTabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const hasItems = tab.items && tab.items.length > 0;
                return (
                  <div 
                    key={tab.id}
                    className={`flex items-center rounded-xl transition-all border flex-shrink-0 cursor-pointer ${
                      isActive 
                        ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-400 font-bold shadow-sm' 
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => onSwitchTab(tab.id)}
                  >
                    <div className="px-3 py-1.5 text-xs flex items-center gap-1.5">
                      {tab.name}
                      {hasItems && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-sky-500 animate-pulse' : 'bg-slate-400'}`}></span>
                      )}
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTab(tab.id);
                      }}
                      className={`p-1.5 rounded-r-xl transition-all hover:text-rose-500 active:scale-90 ${isActive ? 'hover:bg-sky-100 dark:hover:bg-sky-500/20' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                      title="Đóng đơn này"
                      aria-label={`Đóng đơn ${tab.name}`}
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                );
              })}
              <button 
                onClick={onAddTab}
                className="flex items-center justify-center min-w-[28px] h-[28px] rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:text-sky-500 hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors flex-shrink-0"
                title="Thêm đơn hàng mới"
                aria-label="Thêm đơn hàng mới"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-transparent transition-colors duration-500">
        {items.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 p-8 text-center gap-4"
          >
            <div className="w-20 h-20 bg-sky-100/50 dark:bg-sky-950/30 rounded-full flex items-center justify-center border border-sky-200/20 dark:border-sky-800/20">
              <PackageOpen size={36} className="text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">Giỏ hàng trống</p>
              <p className="text-xs max-w-[200px] mx-auto leading-relaxed">Vui lòng quét mã vạch sản phẩm để thêm vào giỏ.</p>
            </div>
          </motion.div>
        ) : (
          <div className={`flex flex-col ${isCompact ? 'gap-1.5' : 'gap-3'}`}>
            <AnimatePresence>
              {items.map((item, index) => {
                const appliedPrice = getAppliedPrice(item);
                const sellMode = item.sellMode || (item.isWholesale ? 'wholesale' : 'base');
                const isWholesale = sellMode === 'wholesale';
                const isMid = sellMode === 'mid';
                const isBase = sellMode === 'base';
                
                 let activeDiscountTier = null;
                 let originalPrice = appliedPrice;
                 if (isCredit) {
                   originalPrice = isWholesale ? (item.wholesaleCreditPrice || item.wholesalePrice || item.price) : isMid ? (item.midCreditPrice || item.midPrice || item.price) : (item.creditPrice || item.price);
                 } else {
                   originalPrice = isWholesale ? (item.wholesalePrice || item.price) : isMid ? (item.midPrice || item.price) : item.price;
                 }

                 if (isBase && item.quantityDiscounts && item.quantityDiscounts.length > 0) {
                   const qtyVal = parseFloat(item.qty) || 0;
                   const sortedTiers = [...item.quantityDiscounts].sort((a, b) => b.minQty - a.minQty);
                   activeDiscountTier = sortedTiers.find(tier => qtyVal >= tier.minQty);
                 }
                
                let conversionRate = 1;
                if (isWholesale) conversionRate = item.wholesaleConversionRate || 1;
                if (isMid) conversionRate = item.midConversionRate || 1;
                const isWarningStock = item.stock !== undefined && (item.qty * conversionRate) > item.stock;

                let bgClass = 'bg-white/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 hover:shadow-sm';
                if (isWholesale) bgClass = 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-500/20';
                if (isMid) bgClass = 'bg-sky-500/5 dark:bg-sky-500/5 border-sky-500/20';

                let textClass = 'text-slate-800 dark:text-slate-100';
                if (isWholesale) textClass = 'text-amber-700 dark:text-amber-400';
                if (isMid) textClass = 'text-sky-600 dark:text-sky-400';

                let unitLabel = item.unit || 'cái';
                if (isWholesale) unitLabel = item.wholesaleUnit;
                if (isMid) unitLabel = item.midUnit;



                let qtyControlsBg = 'bg-white/60 dark:bg-slate-950/60 border-slate-200/50 dark:border-slate-850/50';
                if (isWholesale) qtyControlsBg = 'bg-amber-100/50 dark:bg-amber-500/10 border-amber-500/20';
                if (isMid) qtyControlsBg = 'bg-sky-500/5 dark:bg-sky-500/10 border-sky-500/20';

                let qtyBtnClass = 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800';
                if (isWholesale) qtyBtnClass = 'text-amber-700 dark:text-amber-400 hover:bg-amber-200/50 dark:hover:bg-amber-500/20';
                if (isMid) qtyBtnClass = 'text-sky-600 dark:text-sky-400 hover:bg-sky-600/10 dark:hover:bg-sky-400/20';

                return (
                  <motion.div 
                    layout="position"
                    key={item.uiKey || item.cartId} 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: -20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`flex flex-col ${isCompact ? 'gap-2 p-3' : 'gap-3 p-4'} rounded-2xl border-2 transition-all group ${bgClass} border-slate-200 dark:border-slate-700/80 shadow-sm`}
                  >
                    {/* Row 1: Name & Delete */}
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <h4 className={`font-black ${isCompact ? 'text-base' : 'text-lg'} leading-tight ${textClass}`}>
                          {isWholesale && <Package size={isCompact ? 16 : 18} className="text-amber-500 inline-block mr-1.5 align-text-bottom" />}
                          {isMid && <PackageOpen size={isCompact ? 16 : 18} className="text-sky-600 dark:text-sky-400 inline-block mr-1.5 align-text-bottom" />}
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-slate-500 font-mono tracking-wide ${isCompact ? 'text-xs' : 'text-sm'}`}>
                            {item.barcode}
                          </span>
                          {isWarningStock && (
                            <span className="text-xs text-rose-600 bg-rose-100 dark:bg-rose-500/20 px-2 py-0.5 rounded font-bold animate-pulse border border-rose-200">
                              Tồn: {item.stock} {item.unit || 'cái'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onRemove(item.cartId)}
                        className="text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-500 p-2 rounded-xl transition-colors focus:outline-none flex-shrink-0 border border-rose-100 flex items-center gap-1.5"
                        title="Xóa sản phẩm này"
                        aria-label="Xóa sản phẩm này"
                      >
                        <Trash2 size={isCompact ? 16 : 18} strokeWidth={2.5} />
                        {!isCompact && <span className="font-bold text-xs hidden sm:inline uppercase">Xóa</span>}
                      </motion.button>
                    </div>

                    {/* Row 2: Sell Mode & Unit Price */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {(item.wholesaleUnit || item.midUnit) ? (
                        <div className="flex bg-slate-100/80 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200/40 dark:border-slate-800/40 relative z-0">
                          <button
                            onClick={() => onSetSellMode(item.cartId, 'base')}
                            className={`relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors duration-200 focus:outline-none ${isBase ? 'text-slate-900 dark:text-white font-extrabold' : 'text-slate-500 dark:text-slate-400'}`}
                          >
                            {isBase && (
                              <motion.div
                                layoutId={`activeSellMode-${item.cartId}`}
                                className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm z-0"
                                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                              />
                            )}
                            <span className="relative z-10">
                              {item.unit ? item.unit.charAt(0).toUpperCase() + item.unit.slice(1) : 'Lẻ'}
                            </span>
                          </button>
                          {item.midUnit && (
                            <button
                              onClick={() => onSetSellMode(item.cartId, 'mid')}
                              className={`relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors duration-200 focus:outline-none ${isMid ? 'text-sky-700 dark:text-sky-300 font-extrabold' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                              {isMid && (
                                <motion.div
                                  layoutId={`activeSellMode-${item.cartId}`}
                                  className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm z-0"
                                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                                />
                              )}
                              <span className="relative z-10">
                                {item.midUnit.charAt(0).toUpperCase() + item.midUnit.slice(1)}
                              </span>
                            </button>
                          )}
                          {item.wholesaleUnit && (
                            <button
                              onClick={() => onSetSellMode(item.cartId, 'wholesale')}
                              className={`relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors duration-200 focus:outline-none ${isWholesale ? 'text-amber-700 dark:text-amber-400 font-extrabold' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                              {isWholesale && (
                                <motion.div
                                  layoutId={`activeSellMode-${item.cartId}`}
                                  className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm z-0"
                                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                                />
                              )}
                              <span className="relative z-10">
                                {item.wholesaleUnit.charAt(0).toUpperCase() + item.wholesaleUnit.slice(1)}
                              </span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3.5 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/40">
                          {item.unit ? item.unit.charAt(0).toUpperCase() + item.unit.slice(1) : 'Lẻ'}
                        </div>
                      )}

                      <div className="text-right flex items-center gap-2">
                        <div className="text-right flex flex-col justify-end">
                          {editingCartId === item.cartId ? (
                            <div 
                              className="flex items-center gap-2 bg-rose-50/50 dark:bg-rose-950/10 p-2 rounded-xl border border-rose-200/50 dark:border-rose-900/30 w-fit"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Giảm/cái:</span>
                              <input
                                type="text"
                                value={formatNumberWithCommas(editPriceVal)}
                                onChange={(e) => {
                                  const clean = e.target.value.replace(/[^0-9]/g, '');
                                  const parsed = clean ? parseInt(clean, 10).toString() : '';
                                  setEditPriceVal(parsed);
                                }}
                                onBlur={() => handleSaveCustomPrice(item.cartId, editPriceVal)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSaveCustomPrice(item.cartId, editPriceVal);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingCartId(null);
                                  }
                                }}
                                className="w-24 px-2.5 py-1 text-xs font-black text-rose-600 bg-white dark:bg-slate-900 border border-rose-350 dark:border-rose-700 rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-rose-500"
                                placeholder="Nhập..."
                                autoFocus
                                onFocus={(e) => e.target.select()}
                              />
                              <span className="text-xs text-slate-500 dark:text-slate-400">đ</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 justify-end">
                              {appliedPrice < originalPrice && (
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 line-through">
                                  {formatPrice(originalPrice)}
                                </span>
                              )}
                              {item.customDiscount !== undefined && item.customDiscount > 0 && (
                                <span className="text-[10px] bg-rose-100 dark:bg-rose-500/25 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded font-extrabold tracking-wider border border-rose-300/30">
                                  Giảm {formatPrice(item.customDiscount)}
                                </span>
                              )}
                              <div 
                                onClick={() => {
                                  setEditingCartId(item.cartId);
                                  setEditPriceVal(item.customDiscount !== undefined ? item.customDiscount.toString() : '');
                                }}
                                className="text-lg font-bold text-slate-500 dark:text-slate-400 cursor-pointer hover:text-sky-500 flex items-center gap-1.5"
                                title="Sửa chiết khấu sản phẩm"
                              >
                                {formatPrice(appliedPrice)} <span className="text-sm font-normal">/{unitLabel}</span>
                                <Edit2 size={12} className="opacity-45" />
                              </div>
                            </div>
                          )}
                          {getEffectiveTaxRate && getEffectiveTaxRate(item) > 0 && (
                            <span className="text-xs font-bold text-rose-600 bg-rose-100 dark:bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-200 mt-1 self-end">
                              +VAT {getEffectiveTaxRate(item)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Qty & Total Amount */}
                    <div className={`flex items-center justify-between mt-1 ${isCompact ? 'pt-2' : 'pt-3'} border-t border-slate-100 dark:border-slate-700/50`}>
                      <div className={`flex items-center border-2 rounded-xl overflow-hidden ${isCompact ? 'h-9' : 'h-11'} ${qtyControlsBg} border-slate-300 dark:border-slate-600 shadow-sm`}>
                        <motion.button 
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onUpdateQty(item.cartId, -1)}
                          className={`w-10 sm:w-12 h-full flex items-center justify-center transition-colors focus:outline-none border-r-2 ${qtyBtnClass} border-slate-300 dark:border-slate-600`}
                          aria-label="Giảm số lượng"
                        >
                          <Minus size={20} strokeWidth={2.5} />
                        </motion.button>
                          <input 
                            type="number"
                            step="any"
                            value={item.qty}
                            data-cart-index={index}
                            onChange={(e) => {
                              if (e.target.value.includes('-')) return;
                              
                              // Chống quét mã vạch nhầm vào ô số lượng
                              if (e.target.value.length >= 6) {
                                const orig = e.target.dataset.orig || 1;
                                onSetQty(item.cartId, orig); // Trả lại số lượng cũ
                                e.target.blur();
                                
                                // Chuyển hướng các số đã gõ vào ô tìm kiếm mã vạch
                                const scannerInput = document.getElementById('scanner-search-input');
                                if (scannerInput) {
                                  scannerInput.focus();
                                  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                                  nativeSetter.call(scannerInput, e.target.value);
                                  scannerInput.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                                return;
                              }
                              
                              onSetQty(item.cartId, e.target.value);
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '' || parseFloat(e.target.value) <= 0) {
                                onSetQty(item.cartId, 1);
                              }
                            }}
                            onFocus={(e) => {
                              e.target.dataset.orig = item.qty;
                              e.target.select();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                e.preventDefault();
                                const diff = e.key === 'ArrowUp' ? 1 : -1;
                                onUpdateQty(item.cartId, diff);
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                e.target.blur(); // Bỏ focus khi ấn Enter
                              }
                            }}
                            className={`cart-qty-input w-12 sm:w-16 h-full text-center font-black ${isCompact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} bg-white dark:bg-slate-900 focus:outline-none transition-all ${textClass}`}
                            min="0.01"
                          />
                        <motion.button 
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onUpdateQty(item.cartId, 1)}
                          className={`w-10 sm:w-12 h-full flex items-center justify-center transition-colors focus:outline-none border-l-2 ${qtyBtnClass} border-slate-300 dark:border-slate-600`}
                          aria-label="Tăng số lượng"
                        >
                          <Plus size={20} strokeWidth={2.5} />
                        </motion.button>
                      </div>

                      <div className={`font-black ${isCompact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'} ${isCredit ? 'text-rose-600 dark:text-rose-400' : 'text-sky-700 dark:text-sky-400'}`}>
                        {formatPrice(appliedPrice * item.qty)}
                      </div>
                    </div>

                    {/* Promotion Hint */}
                    {(() => {
                      const promo = activePromotions.find(p => p.type === 'buy_x_get_y' && p.buyProductId === item.id);
                      if (promo && (!item.sellMode || item.sellMode === 'base')) {
                        const setSize = promo.buyQuantity + promo.getQuantity;
                        const remainder = item.qty % setSize;
                        let hintText = '';
                        let isSuccess = false;
                        
                        if (remainder > 0) {
                          hintText = `Gợi ý: Mua thêm ${setSize - remainder} để được tặng ${promo.getQuantity} miễn phí!`;
                        } else if (item.qty > 0 && remainder === 0) {
                          hintText = `Đã áp dụng: Mua ${promo.buyQuantity} tặng ${promo.getQuantity}!`;
                          isSuccess = true;
                        }
                        
                        if (hintText) {
                          return (
                            <div className={`mt-3 text-xs sm:text-sm font-bold px-3 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-center shadow-sm ${
                              isSuccess 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                                : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30 animate-pulse'
                            }`}>
                              {isSuccess ? <CheckSquare size={16} className="shrink-0" /> : <Gift size={16} className="shrink-0" />}
                              <span>{hintText}</span>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}

                    {activeDiscountTier && (
                      <div className="mt-3 text-xs sm:text-sm font-bold px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 flex items-center justify-center gap-2 text-center shadow-sm">
                        <span>⚡ Đang giảm {formatPrice(activeDiscountTier.discountAmount)}/cái (Mua từ {activeDiscountTier.minQty} {item.unit || 'cái'})</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Checkout Summary Footer */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-800/50 p-4 sm:p-5 flex-shrink-0 flex flex-col gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col gap-1.5">
          {totalTaxAmount > 0 && (
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-semibold px-1">
              <span>Tổng Thuế VAT:</span>
              <span className="text-rose-500 dark:text-rose-400">+{formatPrice(totalTaxAmount)}</span>
            </div>
          )}
          
          <div className="flex justify-between items-end px-1 mt-1">
            <span className="text-sm font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isCredit ? 'TỔNG GHI NỢ' : 'TỔNG CẦN THU'}
            </span>
            <div className="text-right">
              {discount > 0 && (
                <div className="flex items-center justify-end gap-1.5 mb-0.5">
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    -{discountType === 'percent' ? `${discount}%` : formatPrice(discount)}
                  </span>
                  <div className="text-xs text-slate-400 dark:text-slate-500 line-through">
                    {formatPrice(totalAmount)}
                  </div>
                </div>
              )}
              <div className="text-3xl font-black text-sky-600 dark:text-sky-400 tracking-tight leading-none">
                {formatPrice(finalAmount)}
              </div>
            </div>
          </div>
        </div>

        <motion.button
          whileTap={items.length > 0 ? { scale: 0.98 } : {}}
          onClick={onCheckout}
          disabled={items.length === 0}
          className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-base font-black uppercase tracking-wider transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/50 ${
            items.length === 0
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-transparent' 
              : isCredit 
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30'
                : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-lg shadow-sky-500/30'
          }`}
        >
          <div className="flex flex-col items-center justify-center relative">
            <AnimatePresence>
              {showShortcuts && items.length > 0 && (
                <motion.span initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity:0, y: 10}} className="absolute -top-10 text-[10px] bg-sky-500 text-white px-3 py-1 rounded shadow-sm font-bold flex items-center gap-1 whitespace-nowrap">
                  Nhấn <CornerDownLeft size={12} /> (Enter) để thanh toán
                </motion.span>
              )}
            </AnimatePresence>
            <div className="flex items-center gap-2">
              <Receipt size={22} strokeWidth={2.5} />
              {isCredit ? 'Xác Nhận Ghi Nợ' : 'Xác Nhận Đơn Hàng'}
            </div>
          </div>
        </motion.button>
      </div>

    </div>
  );
}
