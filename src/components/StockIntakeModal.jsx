import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X, PackagePlus, ArrowRight, Save, Info } from 'lucide-react';
import { db } from '../db';
import toast from 'react-hot-toast';
import { removeAccents } from '../utils/string';

export default function StockIntakeModal({ onClose, onSaved }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const [qtyBase, setQtyBase] = useState('');
  const [qtyMid, setQtyMid] = useState('');
  const [qtyWholesale, setQtyWholesale] = useState('');
  
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const search = async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }
      const q = removeAccents(searchTerm.toLowerCase().trim());
      const results = await db.products
        .filter(p => removeAccents(p.name.toLowerCase()).includes(q) || p.barcode.includes(q))
        .limit(10)
        .toArray();
      setSearchResults(results);
    };
    search();
  }, [searchTerm]);

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setSearchResults([]);
    setQtyBase('');
    setQtyMid('');
    setQtyWholesale('');
  };

  const handleClearSelection = () => {
    setSelectedProduct(null);
    setTimeout(() => {
      if (searchInputRef.current) searchInputRef.current.focus();
    }, 100);
  };

  const calculateTotalAdded = () => {
    if (!selectedProduct) return 0;
    
    let total = 0;
    
    const base = parseInt(qtyBase) || 0;
    total += base;
    
    if (selectedProduct.midUnit && selectedProduct.midConversionRate) {
      const mid = parseInt(qtyMid) || 0;
      total += mid * parseInt(selectedProduct.midConversionRate);
    }
    
    if (selectedProduct.wholesaleUnit && selectedProduct.wholesaleConversionRate) {
      const whole = parseInt(qtyWholesale) || 0;
      total += whole * parseInt(selectedProduct.wholesaleConversionRate);
    }
    
    return total;
  };

  const totalAdded = calculateTotalAdded();

  const handleSave = async () => {
    if (!selectedProduct) return;
    if (totalAdded <= 0) {
      toast.error("Vui lòng nhập số lượng lớn hơn 0");
      return;
    }
    
    try {
      const currentStock = parseInt(selectedProduct.stock) || 0;
      const newStock = currentStock + totalAdded;
      
      await db.products.update(selectedProduct.id, { stock: newStock });
      toast.success(`Đã nhập thêm ${totalAdded} ${selectedProduct.unit || 'cái'}`);
      
      if (onSaved) onSaved();
      else onClose();
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi lưu");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-sky-500 text-white p-2 rounded-xl shadow-md shadow-sky-500/30">
              <PackagePlus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Nhập Hàng Vào Kho</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tìm sản phẩm và cộng dồn số lượng</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors focus:outline-none"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          {!selectedProduct ? (
            <div className="flex flex-col h-full">
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Quét mã vạch hoặc gõ tên sản phẩm để tìm..."
                  className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-lg focus:outline-none focus:border-sky-500 dark:focus:border-sky-500 text-slate-800 dark:text-slate-100 shadow-sm transition-colors"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="w-full text-left p-4 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{p.name}</h4>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{p.barcode}</span>
                          <span>• Tồn: <strong>{p.stock}</strong> {p.unit}</span>
                        </div>
                      </div>
                      <ArrowRight className="text-slate-300 group-hover:text-sky-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
              
              {searchTerm && searchResults.length === 0 && (
                <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                  Không tìm thấy sản phẩm nào khớp với "{searchTerm}"
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              
              <div className="flex items-start justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl">
                <div>
                  <h3 className="text-xl font-black text-sky-700 dark:text-sky-400">{selectedProduct.name}</h3>
                  <div className="flex items-center gap-3 mt-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md">{selectedProduct.barcode}</span>
                    <span>Tồn kho hiện tại: <strong className="text-lg text-slate-800 dark:text-slate-100">{selectedProduct.stock}</strong> {selectedProduct.unit}</span>
                  </div>
                </div>
                <button 
                  onClick={handleClearSelection}
                  className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-bold underline underline-offset-4"
                >
                  Đổi mặt hàng
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border-2 border-sky-100 dark:border-sky-900/30 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  Nhập số lượng mới
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">Cộng thêm vào kho</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedProduct.wholesaleUnit && selectedProduct.wholesaleConversionRate && (
                    <div>
                      <label className="block text-sm font-bold text-amber-600 dark:text-amber-500 mb-1.5 uppercase tracking-wider">
                        Số {selectedProduct.wholesaleUnit}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={qtyWholesale}
                          onChange={(e) => setQtyWholesale(e.target.value)}
                          className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-800 dark:text-slate-100"
                          placeholder="0"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">x {selectedProduct.wholesaleConversionRate}</span>
                      </div>
                    </div>
                  )}

                  {selectedProduct.midUnit && selectedProduct.midConversionRate && (
                    <div>
                      <label className="block text-sm font-bold text-blue-600 dark:text-blue-500 mb-1.5 uppercase tracking-wider">
                        Số {selectedProduct.midUnit}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={qtyMid}
                          onChange={(e) => setQtyMid(e.target.value)}
                          className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 dark:text-slate-100"
                          placeholder="0"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">x {selectedProduct.midConversionRate}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                      Số {selectedProduct.unit} (Lẻ)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={qtyBase}
                      onChange={(e) => setQtyBase(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-slate-800 dark:text-slate-100"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between p-4 bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20 rounded-xl">
                  <div className="text-sky-800 dark:text-sky-300 font-medium flex items-center gap-2">
                    <Info size={18} />
                    Tổng lượng cộng thêm:
                  </div>
                  <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
                    +{totalAdded} <span className="text-base font-bold">{selectedProduct.unit}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleSave}
                  disabled={totalAdded <= 0}
                  className="px-8 py-3 rounded-xl font-bold text-white bg-sky-500 hover:bg-sky-600 shadow-md shadow-sky-500/30 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={20} />
                  Xác nhận Nhập Hàng
                </button>
              </div>

            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
