import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, DollarSign, CreditCard, History, X, Calendar, Receipt, UserPlus, Tag, Plus, Trash2, Edit2 } from 'lucide-react';
import PrintDebtModal from './components/PrintDebtModal';
import SpecialPricesModal from './components/SpecialPricesModal';
import HistoryModal from './components/HistoryModal';
import PaymentModal from './components/PaymentModal';
import EditCustomerModal from './components/EditCustomerModal';
import AddCustomerModal from './components/AddCustomerModal';
import PrintableReceipt from '../pos/components/PrintableReceipt';
import { motion } from 'framer-motion';
import { db } from '../../db';
import toast from 'react-hot-toast';
import { silentPrint } from '../../utils/silentPrint';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [showPrintDebtModal, setShowPrintDebtModal] = useState(false);
  const [printDateFrom, setPrintDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [printDateTo, setPrintDateTo] = useState(new Date());
  const [isPrintingDebt, setIsPrintingDebt] = useState(false);
  const [activePrintOrder, setActivePrintOrder] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newDebt, setNewDebt] = useState('');

  const [showEditModal, setShowEditModal] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDebt, setEditDebt] = useState('');

  const [showSpecialPricesModal, setShowSpecialPricesModal] = useState(false);
  const [specialPricesList, setSpecialPricesList] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newSpecialPrice, setNewSpecialPrice] = useState('');
  const [specialUnitMode, setSpecialUnitMode] = useState('base');

  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const productDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const loadCustomers = async () => {
    const all = await db.customers.toArray();
    setCustomers(all.sort((a, b) => (b.debt || 0) - (a.debt || 0)));
  };

  const handleOpenEdit = (customer, e) => {
    e.stopPropagation();
    setCustomerToEdit(customer);
    setEditName(customer.name);
    setEditDebt(customer.debt ? customer.debt.toString() : '0');
    setShowEditModal(true);
  };

  const handleDeleteCustomer = async (customer, e) => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc muốn xóa khách hàng ${customer.name}? Các giao dịch của khách hàng này cũng sẽ bị xóa.`)) {
      return;
    }
    try {
      await db.customers.delete(customer.phone);
      await db.customerTransactions.where('customerPhone').equals(customer.phone).delete();
      toast.success('Đã xóa khách hàng!');
      loadCustomers();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa khách hàng!');
    }
  };

  const rebuildSpecialPricesList = (specialPrices, allProds) => {
    const list = [];
    for (const prodId of Object.keys(specialPrices)) {
      const prod = allProds.find(p => p.id.toString() === prodId);
      if (prod) {
        const modes = specialPrices[prodId] || {};
        for (const mode of Object.keys(modes)) {
          list.push({
            id: prod.id,
            name: prod.name,
            barcode: prod.barcode,
            mode: mode, // 'base', 'mid', 'wholesale'
            price: modes[mode]
          });
        }
      }
    }
    setSpecialPricesList(list);
  };

  const handleOpenSpecialPrices = async (customer) => {
    setSelectedCustomer(customer);
    setShowSpecialPricesModal(true);
    
    // Load all products for the selector
    const allProds = await db.products.toArray();
    setProducts(allProds);

    // Build the special prices list for display
    const prices = customer.specialPrices || {};
    rebuildSpecialPricesList(prices, allProds);
  };

  const handleSaveSpecialPrice = async (e) => {
    if (e) e.preventDefault();
    if (!selectedCustomer || !selectedProductId || !newSpecialPrice || !specialUnitMode) {
      toast.error('Vui lòng chọn đầy đủ sản phẩm, đơn vị và nhập giá riêng');
      return;
    }

    const price = parseFloat(newSpecialPrice.replace(/[^0-9]/g, ''));
    if (isNaN(price) || price <= 0) {
      toast.error('Giá bán không hợp lệ');
      return;
    }

    try {
      const currentSpecialPrices = selectedCustomer.specialPrices || {};
      const productPrices = currentSpecialPrices[selectedProductId] || {};
      
      const updatedPrices = {
        ...currentSpecialPrices,
        [selectedProductId]: {
          ...productPrices,
          [specialUnitMode]: price
        }
      };

      await db.customers.update(selectedCustomer.phone, { specialPrices: updatedPrices });
      
      // Update local states
      const updatedCustomer = { ...selectedCustomer, specialPrices: updatedPrices };
      setSelectedCustomer(updatedCustomer);
      
      // Rebuild list
      rebuildSpecialPricesList(updatedPrices, products);
      setNewSpecialPrice('');
      setSelectedProductId('');
      toast.success('Đã lưu giá bán riêng!');
      loadCustomers();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi lưu giá bán riêng');
    }
  };

  const handleRemoveSpecialPrice = async (productId, mode) => {
    if (!selectedCustomer) return;
    try {
      const currentSpecialPrices = selectedCustomer.specialPrices || {};
      const productPrices = currentSpecialPrices[productId] || {};
      const updatedProductPrices = { ...productPrices };
      delete updatedProductPrices[mode];

      const updatedPrices = { ...currentSpecialPrices };
      if (Object.keys(updatedProductPrices).length === 0) {
        delete updatedPrices[productId];
      } else {
        updatedPrices[productId] = updatedProductPrices;
      }

      await db.customers.update(selectedCustomer.phone, { specialPrices: updatedPrices });
      
      // Update local states
      const updatedCustomer = { ...selectedCustomer, specialPrices: updatedPrices };
      setSelectedCustomer(updatedCustomer);
      
      rebuildSpecialPricesList(updatedPrices, products);
      toast.success('Đã xóa giá bán riêng');
      loadCustomers();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xóa giá bán riêng');
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const handleOpenPayment = (customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount(customer.debt?.toString() || '0');
    setShowPaymentModal(false);
    setShowPaymentModal(true);
  };

  const handleViewHistory = async (customer) => {
    setSelectedCustomer(customer);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const txs = await db.customerTransactions.where('customerPhone').equals(customer.phone).reverse().toArray();
      setCustomerHistory(txs);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải sổ nợ chi tiết');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleBatchPrintDebt = async (e) => {
    e.preventDefault();
    if (!printDateFrom || !printDateTo) {
      toast.error('Vui lòng chọn đầy đủ thời gian Từ ngày và Đến ngày');
      return;
    }

    const startTimestamp = new Date(printDateFrom).setHours(0, 0, 0, 0);
    const endTimestamp = new Date(printDateTo).setHours(23, 59, 59, 999);

    if (startTimestamp > endTimestamp) {
      toast.error('Thời gian bắt đầu không được lớn hơn thời gian kết thúc');
      return;
    }

    setIsPrintingDebt(true);
    const loadingToast = toast.loading('Đang chuẩn bị in các hóa đơn nợ...');
    
    try {
      const txs = await db.customerTransactions
        .where('customerPhone').equals(selectedCustomer.phone)
        .toArray();
      
      const targetTxs = txs.filter(tx => 
        tx.type === 'debt' && 
        tx.timestamp >= startTimestamp && 
        tx.timestamp <= endTimestamp && 
        tx.orderId // Must have an associated orderId
      );

      if (targetTxs.length === 0) {
        toast.error('Không tìm thấy hóa đơn nợ nào trong khoảng thời gian này!', { id: loadingToast });
        setIsPrintingDebt(false);
        return;
      }

      // Sort chronological
      targetTxs.sort((a, b) => a.timestamp - b.timestamp);
      
      let printedCount = 0;
      
      for (const tx of targetTxs) {
        // Use indexed timestamp to find the exact order
        const order = await db.orders.where('timestamp').equals(tx.timestamp).first();
        if (order) {
          toast.loading(`Đang in đơn nợ ngày ${new Date(order.timestamp).toLocaleDateString('vi-VN')}...`, { id: loadingToast });
          
          setActivePrintOrder(order);
          // Wait for DOM to render the PrintableReceipt component before taking PDF snapshot
          await new Promise(r => setTimeout(r, 250)); 
          
          await silentPrint(order);
          
          setActivePrintOrder(null);
          // Wait 1.5 seconds between prints to avoid overwhelming the printer buffer
          await new Promise(r => setTimeout(r, 1500));
          printedCount++;
        }
      }

      toast.success(`Đã in thành công ${printedCount} hóa đơn nợ!`, { id: loadingToast });
      setShowPrintDebtModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra trong quá trình in', { id: loadingToast });
    } finally {
      setIsPrintingDebt(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 lg:p-6 bg-transparent transition-colors duration-500">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-sky-950 dark:text-white flex items-center gap-2">
            <Users className="text-sky-600 dark:text-cyan-400" />
            Sổ Công Nợ & Khách Hàng
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Quản lý khách hàng thành viên và theo dõi công nợ</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-600 dark:text-cyan-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm theo tên hoặc SĐT..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 glass-input rounded-xl text-sm transition-shadow text-sky-900 dark:text-sky-50 placeholder-slate-400"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-xl text-sm shadow-[0_4px_12px_rgba(14,165,233,0.25)] transition-all flex items-center justify-center gap-1.5"
          >
            <span>+ Khách Hàng</span>
          </motion.button>
        </div>
      </div>

      <div className="flex-1 glass-card rounded-3xl overflow-hidden flex flex-col transition-colors duration-500">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest bg-white/40 dark:bg-[#0a0d1a]/50 backdrop-blur-md sticky top-0 z-10 border-b border-black/5 dark:border-white/5">
              <tr>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider">Khách Hàng</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider">Số Điện Thoại</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-right">Tổng Nợ</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Không tìm thấy khách hàng nào.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => (
                  <tr 
                    key={customer.phone} 
                    onClick={() => handleViewHistory(customer)}
                    className="hover:bg-white/15 dark:hover:bg-white/5 transition-all duration-205 cursor-pointer group border-b border-black/5 dark:border-white/5"
                    title="Nhấn để xem lịch sử mua hàng"
                  >
                    <td className="py-4 px-6">
                      <div className="font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-all flex items-center gap-2">
                        {customer.name}
                        <History size={14} className="opacity-0 group-hover:opacity-60 transition-opacity text-sky-500" />
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-500 dark:text-slate-400 font-medium">{customer.phone}</td>
                    <td className="py-4 px-6 text-right font-black text-rose-500 dark:text-rose-450">
                      {formatPrice(customer.debt || 0)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenSpecialPrices(customer)}
                          className="px-3.5 py-2 glass-button text-sky-600 dark:text-sky-400 border border-sky-200/30 dark:border-sky-800/30 text-xs font-bold rounded-xl transition-all"
                        >
                          Giá Riêng
                        </button>
                        {(customer.debt || 0) > 0 ? (
                          <button
                            onClick={() => handleOpenPayment(customer)}
                            className="px-4 py-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/15 transition-all active:scale-[0.96] focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                          >
                            Trả Nợ
                          </button>
                        ) : (
                          <span className="glass-badge-emerald">Không nợ</span>
                        )}
                        <button
                          onClick={(e) => handleOpenEdit(customer, e)}
                          className="p-2 text-slate-400 glass-button rounded-xl transition-colors"
                          title="Chỉnh sửa thông tin"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteCustomer(customer, e)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                          title="Xóa khách hàng"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal 
        isOpen={showPaymentModal} 
        onClose={() => setShowPaymentModal(false)} 
        onSuccess={() => { setShowPaymentModal(false); loadCustomers(); }}
        selectedCustomer={selectedCustomer}
      />

      {/* History Modal */}
      <HistoryModal 
        isOpen={showHistoryModal} 
        onClose={() => setShowHistoryModal(false)} 
        selectedCustomer={selectedCustomer}
        customerHistory={customerHistory}
        loadingHistory={loadingHistory}
        onOpenPrintDebt={() => setShowPrintDebtModal(true)}
      />

      {/* Add Customer Modal */}
      <AddCustomerModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onSuccess={() => { setShowAddModal(false); loadCustomers(); }}
      />

      {/* Edit Customer Modal */}
      <EditCustomerModal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
        onSuccess={() => { setShowEditModal(false); loadCustomers(); }}
        customerToEdit={customerToEdit}
      />

      {/* Special Prices Modal */}
      <SpecialPricesModal 
        isOpen={showSpecialPricesModal} 
        onClose={() => setShowSpecialPricesModal(false)} 
        selectedCustomer={selectedCustomer}
        products={products}
        specialPricesList={specialPricesList}
        selectedProductId={selectedProductId}
        setSelectedProductId={setSelectedProductId}
        newSpecialPrice={newSpecialPrice}
        setNewSpecialPrice={setNewSpecialPrice}
        specialUnitMode={specialUnitMode}
        setSpecialUnitMode={setSpecialUnitMode}
        isProductDropdownOpen={isProductDropdownOpen}
        setIsProductDropdownOpen={setIsProductDropdownOpen}
        productSearchTerm={productSearchTerm}
        setProductSearchTerm={setProductSearchTerm}
        handleSaveSpecialPrice={handleSaveSpecialPrice}
        handleRemoveSpecialPrice={handleRemoveSpecialPrice}
        productDropdownRef={productDropdownRef}
      />

      {/* Print Debt Modal */}
      <PrintDebtModal 
        isOpen={showPrintDebtModal} 
        onClose={() => setShowPrintDebtModal(false)} 
        selectedCustomer={selectedCustomer}
        isPrintingDebt={isPrintingDebt}
        printDateFrom={printDateFrom}
        setPrintDateFrom={setPrintDateFrom}
        printDateTo={printDateTo}
        setPrintDateTo={setPrintDateTo}
        handleBatchPrintDebt={handleBatchPrintDebt}
      />

      <PrintableReceipt order={activePrintOrder} isBatchPrint={true} />
    </div>
  );
}
