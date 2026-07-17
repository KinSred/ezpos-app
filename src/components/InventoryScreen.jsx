import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Package, Download, Upload, Trash2, Edit2, Search, AlertTriangle, Plus, X, PackagePlus, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import AddProductModal from './AddProductModal';
import StockIntakeModal from './StockIntakeModal';
import { motion, AnimatePresence } from 'framer-motion';
import { removeAccents } from '../utils/string';
import PrintableBarcodeLabel from './PrintableBarcodeLabel';

export default function InventoryScreen() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [editModalConfig, setEditModalConfig] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [productToEdit, setProductToEdit] = useState(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [showPrintLabelModal, setShowPrintLabelModal] = useState(false);
  const [productToPrint, setProductToPrint] = useState(null);
  const [activePrintLabels, setActivePrintLabels] = useState(null);

  const hideStockSetting = useLiveQuery(async () => {
    const s = await db.settings.get('hideStock');
    return s ? s.value === 'true' : false;
  }, []) || false;

  const [isNavigating, setIsNavigating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchInput);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setVisibleCount(50);
  }, [debouncedSearchTerm, showLowStockOnly]);
  
  const totalLowStockCount = useLiveQuery(async () => {
    const all = await db.products.toArray();
    return all.filter(p => p.stock <= (p.lowStockAlert !== undefined ? p.lowStockAlert : 5)).length;
  }, []) || 0;

  const products = useLiveQuery(
    async () => {
      const results = await db.products
        .filter(p => {
          let matchSearch = true;
          if (debouncedSearchTerm) {
            const term = removeAccents(debouncedSearchTerm.toLowerCase());
            matchSearch = removeAccents(p.name.toLowerCase()).includes(term) || p.barcode.includes(debouncedSearchTerm);
          }
          let matchLowStock = true;
          if (showLowStockOnly) {
             matchLowStock = p.stock <= (p.lowStockAlert !== undefined ? p.lowStockAlert : 5);
          }
          return matchSearch && matchLowStock;
        })
        .toArray();
        
      return results.sort((a, b) => b.id - a.id);
    },
    [debouncedSearchTerm, showLowStockOnly]
  );

  const productsList = products || [];
  const isLoading = isNavigating || !products;

  const handleDelete = (product) => {
    setProductToDelete(product);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      await db.products.delete(productToDelete.id);
      toast.success("Đã xóa sản phẩm thành công!");
      setProductToDelete(null);
    }
  };

  const handleUpdateStock = (id, currentStock) => {
    setEditModalConfig({
      productId: id,
      fieldName: 'stock',
      fieldLabel: 'tồn kho',
      currentValue: currentStock,
      type: 'number',
      onSave: async (value) => {
        await db.products.update(id, { stock: parseFloat(value) });
        toast.success("Đã cập nhật tồn kho");
      }
    });
  };

  const handleUpdatePrice = (id, currentPrice) => {
    setEditModalConfig({
      productId: id,
      fieldName: 'price',
      fieldLabel: 'giá bán (VNĐ)',
      currentValue: currentPrice,
      type: 'number',
      onSave: async (value) => {
        await db.products.update(id, { price: parseInt(value, 10) });
        toast.success("Đã cập nhật giá");
      }
    });
  };

  const handleUpdateMidPrice = (id, currentPrice) => {
    setEditModalConfig({
      productId: id,
      fieldName: 'midPrice',
      fieldLabel: 'giá lốc (VNĐ)',
      currentValue: currentPrice || '',
      type: 'number',
      onSave: async (value) => {
        await db.products.update(id, { midPrice: value ? parseInt(value, 10) : undefined });
        toast.success("Đã cập nhật giá lốc");
      }
    });
  };

  const handleUpdateMidCreditPrice = (id, currentPrice) => {
    setEditModalConfig({
      productId: id,
      fieldName: 'midCreditPrice',
      fieldLabel: 'giá lốc nợ (VNĐ)',
      currentValue: currentPrice || '',
      type: 'number',
      onSave: async (value) => {
        await db.products.update(id, { midCreditPrice: value ? parseInt(value, 10) : undefined });
        toast.success("Đã cập nhật giá lốc nợ");
      }
    });
  };

  const handleUpdateWholesalePrice = (id, currentPrice) => {
    setEditModalConfig({
      productId: id,
      fieldName: 'wholesalePrice',
      fieldLabel: 'giá sỉ (VNĐ)',
      currentValue: currentPrice || '',
      type: 'number',
      onSave: async (value) => {
        await db.products.update(id, { wholesalePrice: value ? parseInt(value, 10) : undefined });
        toast.success("Đã cập nhật giá sỉ");
      }
    });
  };

  const handleUpdateWholesaleCreditPrice = (id, currentPrice) => {
    setEditModalConfig({
      productId: id,
      fieldName: 'wholesaleCreditPrice',
      fieldLabel: 'giá sỉ nợ (VNĐ)',
      currentValue: currentPrice || '',
      type: 'number',
      onSave: async (value) => {
        await db.products.update(id, { wholesaleCreditPrice: value ? parseInt(value, 10) : undefined });
        toast.success("Đã cập nhật giá sỉ nợ");
      }
    });
  };

  const handleUpdateCreditPrice = (id, currentPrice) => {
    setEditModalConfig({
      productId: id,
      fieldName: 'creditPrice',
      fieldLabel: 'giá nợ (VNĐ)',
      currentValue: currentPrice || '',
      type: 'number',
      onSave: async (value) => {
        await db.products.update(id, { creditPrice: value ? parseInt(value, 10) : undefined });
        toast.success("Đã cập nhật giá nợ");
      }
    });
  };

  const handleUpdateTaxRate = (id, currentTax) => {
    setEditModalConfig({
      productId: id,
      fieldName: 'taxRate',
      fieldLabel: 'thuế VAT (%)',
      currentValue: currentTax !== undefined && currentTax !== -1 ? currentTax : -1,
      type: 'number',
      onSave: async (value) => {
        await db.products.update(id, { taxRate: parseFloat(value) || 0 });
        toast.success("Đã cập nhật thuế VAT");
      }
    });
  };

  const handleUpdateLowStockAlert = (id, currentAlert) => {
    setEditModalConfig({
      productId: id,
      fieldName: 'lowStockAlert',
      fieldLabel: 'ngưỡng báo hết',
      currentValue: currentAlert !== undefined ? currentAlert : 5,
      type: 'number',
      onSave: async (value) => {
        await db.products.update(id, { lowStockAlert: parseFloat(value) });
        toast.success("Đã cập nhật ngưỡng cảnh báo");
      }
    });
  };

  const handleExport = async () => {
    try {
      const allProducts = await db.products.toArray();
      const blob = new Blob([JSON.stringify(allProducts, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos-inventory-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Đã xuất dữ liệu thành công");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi xuất dữ liệu");
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (Array.isArray(data)) {
          await db.products.bulkPut(data);
          toast.success(`Đã nhập ${data.length} sản phẩm`);
        } else {
          toast.error("Định dạng file không hợp lệ");
        }
      } catch (error) {
        console.error(error);
        toast.error("Lỗi đọc file JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = null; // Reset
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const isLowStock = (product) => {
    const alertThreshold = product.lowStockAlert !== undefined ? product.lowStockAlert : 5;
    return product.stock <= alertThreshold;
  };

  const formatStockDisplay = (product) => {
    let stock = parseInt(product.stock) || 0;
    if (stock <= 0) return null;
    
    let wRate = parseInt(product.wholesaleConversionRate);
    let mRate = parseInt(product.midConversionRate);
    let hasW = product.wholesaleUnit && !isNaN(wRate) && wRate > 0;
    let hasM = product.midUnit && !isNaN(mRate) && mRate > 0;
    
    if (!hasW && !hasM) return null;
    
    let result = [];
    let remaining = stock;
    
    if (hasW) {
      let wCount = Math.floor(remaining / wRate);
      if (wCount > 0) {
        result.push(`${wCount} ${product.wholesaleUnit}`);
        remaining = remaining % wRate;
      }
    }
    
    if (hasM) {
      let mCount = Math.floor(remaining / mRate);
      if (mCount > 0) {
        result.push(`${mCount} ${product.midUnit}`);
        remaining = remaining % mRate;
      }
    }
    
    if (remaining > 0) {
      result.push(`${remaining} ${product.unit || 'cái'}`);
    }
    
    // Nếu chỉ có 1 thành phần và nó giống hệt số lượng lẻ ban đầu thì không cần hiện (vd: chưa đủ 1 lốc/thùng)
    if (result.length === 1 && result[0] === `${stock} ${product.unit || 'cái'}`) {
      return null;
    }
    
    return result.join(' + ');
  };

  return (
    <div className="h-full bg-transparent p-6 flex flex-col overflow-hidden transition-colors duration-200" aria-label="Giao diện quản lý kho hàng">
      {/* Top action row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-sky-950 dark:text-white tracking-tight flex items-center gap-3">
            <Package className="text-sky-600 dark:text-cyan-400" size={32} />
            Quản Lý Kho Hàng
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Quản lý giá cả, đơn vị tính và theo dõi số lượng tồn kho sản phẩm.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-sky-500" size={18} />
            </div>
            <input 
              type="text" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm tên hoặc mã sản phẩm..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-slate-800 dark:text-slate-100 shadow-sm"
            />
          </div>
          <input 
            type="file" 
            accept=".json" 
            id="import-file" 
            className="hidden" 
            onChange={handleImport}
          />
           <motion.label 
            whileTap={{ scale: 0.97 }}
            htmlFor="import-file"
            className="flex items-center gap-2 px-5 py-2.5 bg-white/60 dark:bg-slate-900/40 hover:bg-sky-50 dark:hover:bg-sky-950/30 border border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-200 font-semibold rounded-2xl text-sm cursor-pointer shadow-sm transition-all focus-within:ring-2 focus-within:ring-sky-500"
          >
            <Upload size={16} />
            Nhập Danh Sách
          </motion.label>

          <motion.button 
            whileTap={{ scale: 0.97 }}
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/60 dark:bg-slate-900/40 hover:bg-sky-50 dark:hover:bg-sky-950/30 border border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-200 font-semibold rounded-2xl text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <Download size={16} />
            Xuất Danh Sách
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowIntakeModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm shadow-lg shadow-emerald-500/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <PackagePlus size={16} />
            Nhập Hàng
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold rounded-2xl text-sm shadow-lg shadow-cyan-500/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <Plus size={16} />
            Thêm Mới
          </motion.button>
        </div>
      </div>

      {/* Banner cảnh báo sắp hết hàng */}
      {totalLowStockCount > 0 && !showLowStockOnly && !hideStockSetting && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors shadow-sm gap-4 flex-shrink-0"
          onClick={() => setShowLowStockOnly(true)}
        >
          <div className="flex items-center gap-3">
            <div className="bg-rose-500 text-white p-2.5 rounded-full animate-pulse shadow-md shadow-rose-500/30">
              <AlertTriangle size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-rose-800 dark:text-rose-400 font-black text-base">Cảnh báo: Có {totalLowStockCount} sản phẩm sắp hết hàng!</h3>
              <p className="text-rose-600 dark:text-rose-300 text-sm mt-0.5 font-medium">Bấm vào đây để lọc và xem danh sách mặt hàng cần nhập thêm.</p>
            </div>
          </div>
          <button className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-500/50 w-full sm:w-auto text-center">
            Kiểm tra ngay
          </button>
        </motion.div>
      )}

      {showLowStockOnly && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between flex-shrink-0 gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-white p-2.5 rounded-full shadow-md shadow-emerald-500/30">
              <AlertTriangle size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-emerald-800 dark:text-emerald-400 font-black text-base">Đang lọc danh sách {totalLowStockCount} sản phẩm sắp hết hàng</h3>
              <p className="text-emerald-600 dark:text-emerald-300 text-sm mt-0.5 font-medium">Để xem toàn bộ kho hàng, vui lòng hủy lọc.</p>
            </div>
          </div>
          <button 
            onClick={() => setShowLowStockOnly(false)}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <X size={16} strokeWidth={2.5} /> Hủy lọc
          </button>
        </motion.div>
      )}

      {/* Database Inventory Table Panel */}
      <div className="flex-1 glass-card rounded-3xl overflow-hidden flex flex-col min-h-0 transition-colors duration-500">
        
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-sm text-slate-800 dark:text-slate-100 border-collapse min-w-[700px]">
            <thead className="text-xs font-bold text-sky-900 dark:text-sky-100 uppercase tracking-wider bg-sky-100/80 dark:bg-sky-950/80 backdrop-blur-sm sticky top-0 z-10 border-b border-sky-200/50 dark:border-sky-800/30">
              <tr>
                <th className="px-6 py-4">Mã Vạch</th>
                <th className="px-6 py-4">Tên Sản Phẩm</th>
                <th className="px-6 py-4">Bán Lẻ</th>
                <th className="px-6 py-4">Bán Lốc / Vỉ</th>
                <th className="px-6 py-4">Bán Sỉ / Thùng</th>
                <th className="px-6 py-4 text-center">Tồn Kho</th>
                <th className="px-6 py-4 text-center">Thuế VAT</th>
                <th className="px-6 py-4 text-center w-24">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {isLoading ? (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse border-b border-slate-100 dark:border-slate-800/40">
                      <td className="px-6 py-4.5"><div className="h-4 bg-slate-200/60 dark:bg-slate-800/60 rounded-md w-24"></div></td>
                      <td className="px-6 py-4.5"><div className="h-4 bg-slate-200/60 dark:bg-slate-800/60 rounded-md w-40"></div></td>
                      <td className="px-6 py-4.5"><div className="h-4 bg-slate-200/60 dark:bg-slate-800/60 rounded-md w-24"></div></td>
                      <td className="px-6 py-4.5"><div className="h-4 bg-slate-200/60 dark:bg-slate-800/60 rounded-md w-20"></div></td>
                      <td className="px-6 py-4.5"><div className="h-4 bg-slate-200/60 dark:bg-slate-800/60 rounded-md w-20"></div></td>
                      <td className="px-6 py-4.5 text-center flex justify-center"><div className="h-6 bg-slate-200/60 dark:bg-slate-800/60 rounded-full w-16 mt-2"></div></td>
                      <td className="px-6 py-4.5 text-center"><div className="h-4 bg-slate-200/60 dark:bg-slate-800/60 rounded-md w-12 mx-auto"></div></td>
                      <td className="px-6 py-4.5 text-center"><div className="h-4 bg-slate-200/60 dark:bg-slate-800/60 rounded-md w-16 mx-auto"></div></td>
                    </tr>
                  ))}
                </>
              ) : productsList.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-16 text-slate-500 dark:text-slate-400">
                    Không tìm thấy sản phẩm nào trong kho.
                  </td>
                </tr>
              ) : (
                <>
                  {productsList.slice(0, visibleCount).map((product) => {
                    const low = isLowStock(product);
                    return (
                      <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors border-b border-slate-100 dark:border-slate-800/40">
                        <td className="px-6 py-4.5 font-mono text-xs text-slate-500 dark:text-slate-400">{product.barcode}</td>
                        <td className="px-6 py-4.5 font-extrabold text-slate-800 dark:text-slate-100">{product.name}</td>
                        
                        {/* Bán Lẻ */}
                        <td className="px-6 py-4.5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 group text-slate-800 dark:text-slate-200">
                              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-md uppercase tracking-wider">{product.unit || 'cái'}</span>
                              <span className="font-extrabold text-sm">{formatPrice(product.price)}</span>
                              <motion.button 
                                whileTap={{ scale: 0.85 }}
                                onClick={() => handleUpdatePrice(product.id, product.price)}
                                className="text-slate-400 hover:text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                              >
                                <Edit2 size={12} />
                              </motion.button>
                            </div>
                            <div className="flex items-center gap-2 group text-xs text-slate-500 dark:text-slate-400 font-medium">
                              <span className="italic">Nợ:</span>
                              <span className="font-semibold">{product.creditPrice ? formatPrice(product.creditPrice) : '-'}</span>
                              <motion.button 
                                whileTap={{ scale: 0.85 }}
                                onClick={() => handleUpdateCreditPrice(product.id, product.creditPrice)}
                                className="text-slate-400 hover:text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                              >
                                <Edit2 size={11} />
                              </motion.button>
                            </div>
                            {product.quantityDiscounts && product.quantityDiscounts.length > 0 && (
                              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/10 w-fit mt-1">
                                % C.Khấu số lượng
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Bán Lốc */}
                        <td className="px-6 py-4.5">
                          {product.midUnit ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded-md uppercase tracking-wider">{product.midUnit}</span>
                                <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                                  {product.midPrice ? formatPrice(product.midPrice) : '-'}
                                </span>
                                <motion.button 
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() => handleUpdateMidPrice(product.id, product.midPrice)}
                                  className="text-slate-400 hover:text-sky-500 opacity-0 hover:opacity-100 transition-opacity p-0.5 rounded"
                                >
                                  <Edit2 size={12} />
                                </motion.button>
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                                Quy đổi: 1 {product.midUnit} = {product.midConversionRate || 0} {product.unit || 'cái'}
                              </div>
                              <div className="flex items-center gap-2 group text-xs text-slate-500 dark:text-slate-400 font-medium">
                                <span className="italic">Nợ:</span>
                                <span className="font-semibold">{product.creditMidPrice ? formatPrice(product.creditMidPrice) : '-'}</span>
                                <motion.button 
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() => handleUpdateMidCreditPrice(product.id, product.creditMidPrice)}
                                  className="text-slate-400 hover:text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                                >
                                  <Edit2 size={11} />
                                </motion.button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleAddUnit(product, 'mid')}
                              className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold focus:outline-none"
                            >
                              <Plus size={12} /> Cấu hình lốc/vỉ
                            </button>
                          )}
                        </td>

                        {/* Bán Sỉ */}
                        <td className="px-6 py-4.5">
                          {product.wholesaleUnit ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md uppercase tracking-wider">{product.wholesaleUnit}</span>
                                <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                                  {product.wholesalePrice ? formatPrice(product.wholesalePrice) : '-'}
                                </span>
                                <motion.button 
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() => handleUpdateWholesalePrice(product.id, product.wholesalePrice)}
                                  className="text-slate-400 hover:text-indigo-500 opacity-0 hover:opacity-100 transition-opacity p-0.5 rounded"
                                >
                                  <Edit2 size={12} />
                                </motion.button>
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                                Quy đổi: 1 {product.wholesaleUnit} = {product.wholesaleConversionRate || 0} {product.unit || 'cái'}
                              </div>
                              <div className="flex items-center gap-2 group text-xs text-slate-500 dark:text-slate-400 font-medium">
                                <span className="italic">Nợ:</span>
                                <span className="font-semibold">{product.creditWholesalePrice ? formatPrice(product.creditWholesalePrice) : '-'}</span>
                                <motion.button 
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() => handleUpdateWholesaleCreditPrice(product.id, product.creditWholesalePrice)}
                                  className="text-slate-400 hover:text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                                >
                                  <Edit2 size={11} />
                                </motion.button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleAddUnit(product, 'wholesale')}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold focus:outline-none"
                            >
                              <Plus size={12} /> Cấu hình sỉ/thùng
                            </button>
                          )}
                        </td>

                        {/* Tồn kho */}
                        <td className="px-6 py-4.5 text-center">
                          {hideStockSetting ? (
                            <div className="flex items-center justify-center">
                              <span className="px-3 py-1 rounded-full text-xs font-bold border shadow-sm bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200/50 dark:border-sky-850/30">
                                Đang bán
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex items-center justify-center gap-1.5 group">
                                <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 border shadow-sm ${
                                  low 
                                    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-200/50 dark:border-rose-500/20 animate-pulse' 
                                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20'
                                }`}>
                                  {low && <AlertTriangle size={12} />}
                                  {product.stock} {product.unit || 'cái'}
                                </span>
                                <motion.button 
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() => handleUpdateStock(product.id, product.stock)}
                                  className="text-slate-400 hover:text-sky-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded"
                                >
                                  <Edit2 size={12} />
                                </motion.button>
                              </div>
                              {formatStockDisplay(product) && (
                                <div className="text-[10px] font-bold text-sky-650 dark:text-sky-400 bg-sky-500/5 dark:bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/10 whitespace-nowrap">
                                  = {formatStockDisplay(product)}
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400 dark:text-slate-550 flex items-center gap-1 group font-semibold uppercase tracking-wider">
                                Báo hết: {product.lowStockAlert !== undefined ? product.lowStockAlert : 5}
                                <motion.button 
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() => handleUpdateLowStockAlert(product.id, product.lowStockAlert)}
                                  className="text-slate-400 hover:text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                                >
                                  <Edit2 size={10} />
                                </motion.button>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Thuế VAT */}
                        <td className="px-6 py-4.5 text-center font-bold">
                          <div className="flex items-center justify-center gap-1 group">
                            <span className="text-xs text-rose-500 dark:text-rose-450 bg-rose-500/5 dark:bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/10">
                              {product.taxRate === undefined || product.taxRate === -1 ? 'Mặc định' : `${product.taxRate}%`}
                            </span>
                            <motion.button 
                              whileTap={{ scale: 0.85 }}
                              onClick={() => handleUpdateTaxRate(product.id, product.taxRate)}
                              className="text-slate-400 hover:text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                            >
                              <Edit2 size={12} />
                            </motion.button>
                          </div>
                        </td>

                        {/* Thao tác */}
                        <td className="px-6 py-4.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => { setProductToPrint(product); setShowPrintLabelModal(true); }}
                              className="text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 p-2 rounded-xl transition-colors focus:outline-none"
                              title="In mã vạch"
                              aria-label={`In mã vạch ${product.name}`}
                            >
                              <Printer size={16} />
                            </motion.button>
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setProductToEdit(product)}
                              className="text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 p-2 rounded-xl transition-colors focus:outline-none"
                              title="Sửa chi tiết"
                              aria-label={`Sửa sản phẩm ${product.name}`}
                            >
                              <Edit2 size={16} />
                            </motion.button>
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDelete(product)}
                              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 p-2 rounded-xl transition-colors focus:outline-none"
                              title="Xóa Sản phẩm"
                              aria-label={`Xóa sản phẩm ${product.name}`}
                            >
                              <Trash2 size={16} />
                            </motion.button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {visibleCount < productsList.length && (
                    <tr>
                      <td colSpan="8" className="text-center py-5 bg-sky-500/5 dark:bg-sky-500/2 border-b border-slate-100 dark:border-slate-800/40">
                        <motion.button 
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setVisibleCount(prev => prev + 50)}
                          className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl text-xs shadow-md transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2"
                        >
                          <span>Tải thêm sản phẩm (+50)</span>
                          <span className="bg-sky-600 dark:bg-sky-400 text-white dark:text-slate-900 px-2 py-0.5 rounded-full text-[10px]">
                            Còn {productsList.length - visibleCount} món
                          </span>
                        </motion.button>
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 border-t border-sky-200/40 dark:border-sky-900/30 bg-sky-100/30 dark:bg-sky-950/20 text-slate-500 dark:text-slate-400 text-xs flex justify-between items-center flex-shrink-0">
          <span>Tổng số mặt hàng: <strong>{productsList.length}</strong></span>
          <span className="hidden sm:flex items-center gap-1">
            💡 Rê chuột vào từng dòng và bấm vào biểu tượng <Edit2 size={12} className="inline" /> để sửa nhanh thông tin
          </span>
        </div>
      </div>



      {showIntakeModal && (
        <StockIntakeModal 
          onClose={() => setShowIntakeModal(false)}
          onSaved={() => setShowIntakeModal(false)}
        />
      )}

      <AnimatePresence>
        {editModalConfig && (
          <QuickEditModal 
            config={editModalConfig}
            onClose={() => setEditModalConfig(null)}
          />
        )}
        {productToDelete && (
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
                  <AlertTriangle size={32} strokeWidth={2} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Xóa mặt hàng</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Bạn có chắc chắn muốn xóa mặt hàng <strong className="text-slate-900 dark:text-slate-100">{productToDelete.name}</strong> không? Hành động này không thể hoàn tác.
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3 border-t border-slate-100 dark:border-slate-800/50">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                >
                  Hủy bỏ
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-500/30 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                >
                  Xác nhận Xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <AddProductModal 
            onClose={() => setShowAddModal(false)} 
            isManual={true}
          />
        )}
        {productToEdit && (
          <AddProductModal 
            productToEdit={productToEdit}
            onClose={() => setProductToEdit(null)} 
            isManual={true}
          />
        )}
        {showPrintLabelModal && productToPrint && (
          <PrintLabelModal
            product={productToPrint}
            onClose={() => {
              setShowPrintLabelModal(false);
              setProductToPrint(null);
            }}
            onPrint={(quantity) => {
              setActivePrintLabels({ product: productToPrint, quantity });
              setShowPrintLabelModal(false);
              setProductToPrint(null);
              setTimeout(async () => {
                try {
                  const result = await window.electronAPI.silentPrint();
                  if (result && result.success) {
                    toast.success(`Đã gửi lệnh in ${quantity} tem`);
                  } else {
                    toast.error(`Lỗi in: ${result?.error || 'Không xác định'}`);
                  }
                } catch (error) {
                  console.error(error);
                  toast.error("Lỗi khi kết nối máy in");
                }
                setActivePrintLabels(null);
              }, 400);
            }}
          />
        )}
      </AnimatePresence>

      {activePrintLabels && (
        <PrintableBarcodeLabel data={activePrintLabels} />
      )}
    </div>
  );
}

function PrintLabelModal({ product, onClose, onPrint }) {
  const [quantity, setQuantity] = useState(1);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = parseInt(quantity, 10);
    if (isNaN(q) || q <= 0) {
      toast.error("Vui lòng nhập số lượng hợp lệ (> 0)");
      return;
    }
    onPrint(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="glass-card rounded-3xl w-full max-w-sm overflow-hidden flex flex-col transition-colors duration-500 bg-white dark:bg-slate-900"
      >
        <div className="px-6 py-5 border-b border-sky-200/50 dark:border-sky-800/40 flex items-center justify-between bg-sky-100/50 dark:bg-sky-950/40">
          <h3 className="font-bold text-sky-950 dark:text-white text-base flex items-center gap-2">
            <Printer size={18} /> In tem mã vạch
          </h3>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-full transition-colors focus:outline-none"
          >
            <X size={18} />
          </motion.button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              Sản phẩm: <strong className="text-slate-900 dark:text-white">{product.name}</strong><br/>
              Mã vạch: <span className="font-mono text-xs">{product.barcode}</span>
            </div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Số lượng tem cần in
            </label>
            <input 
              ref={inputRef}
              type="number"
              required
              min="1"
              max="200"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2.5 bg-sky-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 transition-all font-semibold"
            />
          </div>

          <div className="mt-4 pt-4 border-t border-sky-200/40 dark:border-sky-900/30 flex justify-end gap-3">
            <motion.button 
              whileTap={{ scale: 0.97 }}
              type="button" 
              onClick={onClose}
              className="px-5 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold rounded-2xl text-sm transition-all focus:outline-none"
            >
              Hủy
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.97 }}
              type="submit" 
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-2xl text-sm shadow-[0_4px_12px_rgba(99,102,241,0.2)] transition-all focus:outline-none flex items-center gap-2"
            >
              <Printer size={16} />
              In ngay
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function QuickEditModal({ config, onClose }) {
  const [value, setValue] = useState(config.currentValue);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (config.type !== 'number') {
        inputRef.current.select();
      }
    }
  }, [config]);

  const handleSubmit = (e) => {
    e.preventDefault();
    let finalValue = value;
    if (config.type === 'number') {
      const numVal = parseFloat(value);
      if (isNaN(numVal)) {
        toast.error("Vui lòng nhập số hợp lệ.");
        return;
      }
      finalValue = numVal;
      // Auto multiply shorthand for price fields
      const priceFields = ['price', 'creditPrice', 'midPrice', 'midCreditPrice', 'wholesalePrice', 'wholesaleCreditPrice'];
      if (priceFields.includes(config.fieldName) && finalValue > 0 && finalValue < 1000) {
        finalValue = finalValue * 1000;
      }
    } else {
      finalValue = String(value).trim();
    }
    config.onSave(finalValue);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Helper live preview for Vietnam Dong (VND) price field
  const priceFields = ['price', 'creditPrice', 'midPrice', 'midCreditPrice', 'wholesalePrice', 'wholesaleCreditPrice'];
  const showVndMultiplierHelper = priceFields.includes(config.fieldName) && Number(value) > 0 && Number(value) < 1000;

  return (
    <div 
      className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="glass-card rounded-3xl w-full max-w-sm overflow-hidden flex flex-col transition-colors duration-500"
      >
        <div className="px-6 py-5 border-b border-sky-200/50 dark:border-sky-800/40 flex items-center justify-between bg-sky-100/50 dark:bg-sky-950/40">
          <h3 className="font-bold text-sky-950 dark:text-white text-base">
            Cập nhật {config.fieldLabel}
          </h3>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-full transition-colors focus:outline-none"
            aria-label="Đóng"
          >
            <X size={18} />
          </motion.button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Nhập giá trị mới
            </label>
            <input 
              ref={inputRef}
              type={config.type}
              required
              step={config.fieldName === 'unit' ? undefined : 'any'}
              min={config.type === 'number' ? "0" : undefined}
              value={value}
              onChange={(e) => {
                if (config.type === 'number' && e.target.value.includes('-')) return;
                setValue(e.target.value);
              }}
              className="w-full px-4 py-2.5 bg-sky-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 transition-all font-semibold"
            />
            {showVndMultiplierHelper && (
              <p className="mt-2 text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/5 dark:bg-sky-500/10 p-2 rounded-xl border border-sky-500/10">
                👉 Nhập nhầm giá thấp? Tự động nhảy thành: <strong className="font-bold text-sm underline">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) * 1000)}</strong>
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-sky-200/40 dark:border-sky-900/30 flex justify-end gap-3">
            <motion.button 
              whileTap={{ scale: 0.97 }}
              type="button" 
              onClick={onClose}
              className="px-5 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold rounded-2xl text-sm transition-all focus:outline-none"
            >
              Hủy
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.97 }}
              type="submit" 
              className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-2xl text-sm shadow-[0_4px_12px_rgba(14,165,233,0.15)] transition-all focus:outline-none"
            >
              Lưu thay đổi
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
