import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Package, Download, Upload, Trash2, Edit2, Search, AlertTriangle, Plus, X, PackagePlus, Printer } from 'lucide-react';
import ProductTableRow from './components/ProductTableRow';
import DeleteProductModal from './components/DeleteProductModal';
import PrintLabelModal from './components/PrintLabelModal';
import QuickEditModal from './components/QuickEditModal';
import toast from 'react-hot-toast';
import AddProductModal from './components/AddProductModal';
import StockIntakeModal from './components/StockIntakeModal';
import { motion, AnimatePresence } from 'framer-motion';
import { removeAccents } from '../../utils/string';
import PrintableBarcodeLabel from './components/PrintableBarcodeLabel';
import SuppliersTab from './components/SuppliersTab';

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

  const handleExport = async () => {
    try {
      const allProducts = await db.products.toArray();
      const dataStr = JSON.stringify(allProducts, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `ezpos_inventory_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast.success("Đã xuất dữ liệu thành công!");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi xuất file");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          await db.products.bulkPut(importedData);
          toast.success(`Đã nhập ${importedData.length} sản phẩm thành công!`);
        } else {
          toast.error("Định dạng file không hợp lệ!");
        }
      } catch (error) {
        console.error(error);
        toast.error("Lỗi khi nhập file");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };


  const [activeTab, setActiveTab] = useState('products'); // 'products', 'suppliers'

  return (
    <div className="h-full bg-transparent p-6 flex flex-col overflow-hidden transition-colors duration-200" aria-label="Giao diện quản lý kho hàng">
      {/* Top action row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-sky-950 dark:text-white tracking-tight flex items-center gap-3">
            <Package className="text-sky-600 dark:text-cyan-400" size={32} />
            Quản Lý Kho Hàng
          </h1>
          <div className="flex gap-4 mt-2">
            <button 
              onClick={() => setActiveTab('products')}
              className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'products' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Sản Phẩm
            </button>
            <button 
              onClick={() => setActiveTab('suppliers')}
              className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'suppliers' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Nhà Cung Cấp
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">
              <Search className="text-sky-500" size={18} />
            </span>
            <input 
              type="text" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-full pl-12 pr-4 py-2.5 glass-input rounded-xl text-sm text-slate-800 dark:text-slate-100 shadow-sm"
            />
          </div>
          {activeTab === 'products' && (
            <>
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
                className="flex items-center gap-2 px-5 py-2.5 glass-button text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-sm cursor-pointer transition-all"
              >
                <Upload size={16} />
                <span className="hidden md:inline">Nhập Danh Sách</span>
              </motion.label>

              <motion.button 
                whileTap={{ scale: 0.97 }}
                onClick={handleExport}
                className="flex items-center gap-2 px-5 py-2.5 glass-button text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-sm transition-all focus:outline-none"
              >
                <Download size={16} />
                <span className="hidden md:inline">Xuất Danh Sách</span>
              </motion.button>

              <motion.button 
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowIntakeModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-2xl text-sm shadow-lg shadow-emerald-500/30 transition-all border border-white/20 backdrop-blur-sm"
              >
                <PackagePlus size={16} />
                Nhập Hàng
              </motion.button>

              <motion.button 
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold rounded-2xl text-sm shadow-lg shadow-cyan-500/30 transition-all border border-white/20 backdrop-blur-sm"
              >
                <Plus size={16} />
                Thêm Mới
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Banner cảnh báo sắp hết hàng */}
      {activeTab === 'products' && totalLowStockCount > 0 && !showLowStockOnly && !hideStockSetting && (
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

      {activeTab === 'products' && showLowStockOnly && (
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

      {/* Main Content Area */}
      <div className="flex-1 glass-card rounded-3xl overflow-hidden flex flex-col min-h-0 transition-colors duration-500">
        {activeTab === 'suppliers' ? (
          <SuppliersTab searchTerm={debouncedSearchTerm} />
        ) : (
          <>
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
                  {productsList.slice(0, visibleCount).map((product) => (
                    <ProductTableRow 
                      key={product.id}
                      product={product}
                      hideStockSetting={hideStockSetting}
                      setEditModalConfig={setEditModalConfig}
                      setProductToPrint={setProductToPrint}
                      setShowPrintLabelModal={setShowPrintLabelModal}
                      setProductToEdit={setProductToEdit}
                      handleDelete={handleDelete}
                    />
                  ))}

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
        </>
        )}
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
        <DeleteProductModal 
          isOpen={!!productToDelete} 
          onClose={() => setProductToDelete(null)} 
          onSuccess={() => setProductToDelete(null)}
          productToDelete={productToDelete}
        />
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


