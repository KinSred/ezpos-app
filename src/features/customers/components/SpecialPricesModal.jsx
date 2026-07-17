import React from 'react';
import { Tag, X, Search, ChevronDown, Plus, Info, DollarSign, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SpecialPricesModal({
  isOpen,
  onClose,
  selectedCustomer,
  products,
  specialPricesList,
  selectedProductId,
  setSelectedProductId,
  newSpecialPrice,
  setNewSpecialPrice,
  specialUnitMode,
  setSpecialUnitMode,
  isProductDropdownOpen,
  setIsProductDropdownOpen,
  productSearchTerm,
  setProductSearchTerm,
  handleSaveSpecialPrice,
  handleRemoveSpecialPrice,
  productDropdownRef
}) {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const formatNumberWithCommas = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = val.toString().replace(/[^0-9]/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('en-US').format(parseInt(clean, 10));
  };

  if (!isOpen || !selectedCustomer) return null;

  const selectedProduct = products.find(p => p.id.toString() === selectedProductId);
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || (p.barcode && p.barcode.includes(productSearchTerm)));

  const getDefaultPrice = (product, mode) => {
    if (!product) return 0;
    if (mode === 'wholesale') return product.wholesalePrice || 0;
    if (mode === 'mid') return product.midPrice || 0;
    return product.price || 0;
  };

  const getCreditPrice = (product, mode) => {
    if (!product) return 0;
    if (mode === 'wholesale') return product.wholesaleCreditPrice || product.wholesalePrice || 0;
    if (mode === 'mid') return product.midCreditPrice || product.midPrice || 0;
    return product.creditPrice || product.price || 0;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden transition-colors duration-500 bg-[#fdfaf2] dark:bg-slate-950 shadow-2xl relative border border-amber-200/50 dark:border-slate-800"
        >
          {/* Decorative top bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500"></div>
          
          <div className="px-6 py-5 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex justify-between items-center shrink-0">
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white flex items-center gap-2.5">
                <div className="bg-sky-100 dark:bg-sky-500/20 p-2 rounded-xl text-sky-600 dark:text-sky-400">
                  <Tag size={20} strokeWidth={2.5} />
                </div>
                Bảng Giá Riêng
              </h3>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1 ml-11">
                Khách hàng: <span className="text-sky-700 dark:text-sky-400 font-bold">{selectedCustomer.name}</span>
              </p>
            </div>
            <button 
              onClick={() => {
                onClose();
                setSelectedProductId('');
                setNewSpecialPrice('');
              }}
              className="p-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <X size={22} strokeWidth={2.5} />
            </button>
          </div>

          {/* Form to add special price */}
          <form onSubmit={handleSaveSpecialPrice} className="p-6 lg:px-8 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-4 w-1 bg-sky-500 rounded-full"></div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Cấu hình giá riêng mới</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Cột Sản Phẩm */}
              <div className="md:col-span-5 relative" ref={productDropdownRef}>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Sản phẩm</label>
                <div 
                  onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                  className={`w-full px-4 py-3 bg-white dark:bg-slate-950 border rounded-2xl text-sm flex justify-between items-center cursor-pointer transition-all shadow-sm ${isProductDropdownOpen ? 'border-sky-500 ring-4 ring-sky-500/10 text-slate-900 dark:text-slate-100' : 'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700'}`}
                >
                  <span className={`font-bold truncate pr-2 ${!selectedProductId ? "text-slate-400 font-semibold" : ""}`}>
                    {selectedProductId 
                      ? (() => {
                          const p = products.find(p => p.id.toString() === selectedProductId);
                          return p ? `${p.name} ${p.barcode ? `(${p.barcode})` : ''}` : 'Chọn sản phẩm...';
                        })()
                      : "Chọn sản phẩm..."}
                  </span>
                  <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isProductDropdownOpen ? 'rotate-180 text-sky-500' : ''}`} />
                </div>
                
                <AnimatePresence>
                  {isProductDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-20 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 flex flex-col overflow-hidden"
                    >
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Tìm theo tên, mã vạch..."
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-slate-800 dark:text-slate-200 font-medium"
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar flex-1 p-1.5">
                        <div
                          onClick={() => { setSelectedProductId(''); setIsProductDropdownOpen(false); setProductSearchTerm(''); }}
                          className={`px-3 py-2.5 text-sm rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!selectedProductId ? 'font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/10' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                          -- Hủy chọn --
                        </div>
                        {filteredProducts.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => { setSelectedProductId(p.id.toString()); setIsProductDropdownOpen(false); setProductSearchTerm(''); }}
                            className={`px-3 py-2.5 text-sm rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors mt-1 ${selectedProductId === p.id.toString() ? 'font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/10' : 'text-slate-700 dark:text-slate-300'}`}
                          >
                            <div className="font-bold">{p.name}</div>
                            {p.barcode && <div className="text-[11px] text-slate-400 font-mono mt-0.5">{p.barcode}</div>}
                          </div>
                        ))}
                        {filteredProducts.length === 0 && (
                          <div className="px-3 py-6 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
                            <Search size={24} className="opacity-20" />
                            Không tìm thấy sản phẩm
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Cột Đơn Vị */}
              <div className="md:col-span-3 relative">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Đơn vị</label>
                <div className="relative">
                  <select
                    value={specialUnitMode}
                    onChange={(e) => setSpecialUnitMode(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 font-bold appearance-none transition-all shadow-sm cursor-pointer"
                  >
                    <option value="base">Bán lẻ {selectedProduct ? `(${selectedProduct.unit || 'cái'})` : ''}</option>
                    <option value="mid">Bán lốc {selectedProduct ? `(${selectedProduct.midUnit || 'lốc'})` : ''}</option>
                    <option value="wholesale">Bán sỉ {selectedProduct ? `(${selectedProduct.wholesaleUnit || 'sỉ'})` : ''}</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Cột Giá */}
              <div className="md:col-span-2 relative">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Giá thiết lập</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatNumberWithCommas(newSpecialPrice)}
                    onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '');
                        const parsed = clean ? parseInt(clean, 10).toString() : '';
                        setNewSpecialPrice(parsed);
                      }}
                    placeholder="0"
                    className="w-full pl-4 pr-9 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-sky-600 dark:text-sky-400 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 font-black font-mono text-right transition-all shadow-sm"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">đ</span>
                </div>
              </div>

              {/* Cột Button */}
              <div className="md:col-span-2 flex items-end">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-2xl text-sm hover:from-sky-600 hover:to-blue-700 transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                >
                  <Plus size={18} strokeWidth={2.5} /> Lưu Giá
                </motion.button>
              </div>
            </div>

            <AnimatePresence>
              {selectedProduct && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-dashed border-slate-200 dark:border-slate-800/60">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg">
                      <Info size={14} className="text-slate-400" />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Giá mặc định: <span className="font-extrabold text-slate-800 dark:text-slate-200">{formatPrice(getDefaultPrice(selectedProduct, specialUnitMode))}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/5 rounded-lg border border-amber-100 dark:border-amber-500/10">
                      <DollarSign size={14} className="text-amber-500" />
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Giá nợ gốc: <span className="font-extrabold">{formatPrice(getCreditPrice(selectedProduct, specialUnitMode))}</span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Special prices list */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar bg-white dark:bg-slate-950">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-4 w-1 bg-emerald-500 rounded-full"></div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Danh sách giá đã thiết lập</h4>
            </div>
            
            {specialPricesList.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50 dark:bg-slate-900/20">
                <Tag size={48} className="opacity-20 text-slate-400" />
                <p className="font-semibold text-sm">Chưa có thiết lập bảng giá riêng nào cho khách này.</p>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800/80 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                      <th className="py-4 px-5">Sản phẩm</th>
                      <th className="py-4 px-5">Đơn vị áp dụng</th>
                      <th className="py-4 px-5 text-right">Đơn giá riêng</th>
                      <th className="py-4 px-5 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {specialPricesList.map((item, idx) => {
                      const productObj = products.find(p => p.id === item.id);
                      let unitLabel = item.mode === 'wholesale' ? 'Sỉ' : item.mode === 'mid' ? 'Lốc' : 'Lẻ';
                      if (productObj) {
                        if (item.mode === 'wholesale') unitLabel = productObj.wholesaleUnit || 'Sỉ';
                        else if (item.mode === 'mid') unitLabel = productObj.midUnit || 'Lốc';
                        else unitLabel = productObj.unit || 'Lẻ';
                      }
                      
                      const modeBadgeClass = item.mode === 'wholesale' 
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' 
                        : item.mode === 'mid' 
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30' 
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30';
                      return (
                        <tr key={idx} className="group hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors">
                          <td className="py-4 px-5">
                            <div className="font-extrabold text-slate-800 dark:text-slate-100 text-sm group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{item.name}</div>
                            {item.barcode && <div className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">{item.barcode}</div>}
                          </td>
                          <td className="py-4 px-5">
                            <span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase border ${modeBadgeClass}`}>
                              {unitLabel}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right font-black text-sky-600 dark:text-sky-400 font-mono text-base">
                            {formatPrice(item.price)}
                          </td>
                          <td className="py-4 px-5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveSpecialPrice(item.id, item.mode)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                              title="Xóa giá riêng"
                            >
                              <Trash2 size={18} strokeWidth={2.5} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
