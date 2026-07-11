import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, DollarSign, CreditCard, History, X, Calendar, Receipt, UserPlus, Tag, Plus, ChevronDown, Trash2, Info, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db';
import toast from 'react-hot-toast';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Không rõ ngày';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Không rõ ngày';
    return date.toLocaleString('vi-VN');
  };

  const formatNumberWithCommas = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = val.toString().replace(/[^0-9]/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('en-US').format(parseInt(clean, 10));
  };

  const loadCustomers = async () => {
    const all = await db.customers.toArray();
    setCustomers(all.sort((a, b) => (b.debt || 0) - (a.debt || 0)));
  };

  const handleAddCustomer = async (e) => {
    if (e) e.preventDefault();
    const phone = newPhone.trim();
    const name = newName.trim();
    const debt = parseFloat(newDebt.replace(/[^0-9]/g, '')) || 0;

    if (!phone || !name) {
      toast.error('Vui lòng nhập đầy đủ tên và SĐT');
      return;
    }

    try {
      const existing = await db.customers.get(phone);
      if (existing) {
        toast.error('Số điện thoại này đã được đăng ký!');
        return;
      }

      await db.customers.add({
        phone,
        name,
        debt,
        points: 0,
        specialPrices: {}
      });

      toast.success(`Đã thêm khách hàng ${name} thành công!`);
      setShowAddModal(false);
      setNewPhone('');
      setNewName('');
      setNewDebt('');
      loadCustomers();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi thêm khách hàng');
    }
  };

  const handleEditCustomerSubmit = async (e) => {
    e.preventDefault();
    const name = editName.trim();
    const debt = parseFloat(editDebt.replace(/[^0-9]/g, '')) || 0;
    
    if (!name) {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }

    try {
      await db.customers.update(customerToEdit.phone, {
        name,
        debt
      });
      toast.success('Đã cập nhật thông tin khách hàng!');
      setShowEditModal(false);
      setCustomerToEdit(null);
      loadCustomers();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi cập nhật khách hàng');
    }
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

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amount = parseFloat(paymentAmount.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    if (amount > (selectedCustomer.debt || 0)) {
      toast.error('Số tiền trả không được lớn hơn số nợ hiện tại');
      return;
    }

    try {
      const newDebt = (selectedCustomer.debt || 0) - amount;
      await db.customers.update(selectedCustomer.phone, { debt: newDebt });

      await db.customerTransactions.add({
        customerPhone: selectedCustomer.phone,
        timestamp: Date.now(),
        type: 'payment',
        amount: amount,
        note: 'Khách thanh toán trả nợ',
        remainingDebt: newDebt
      });
      
      toast.success(`Đã thanh toán ${formatPrice(amount)} cho khách hàng ${selectedCustomer.name}`);
      setShowPaymentModal(false);
      setSelectedCustomer(null);
      setPaymentAmount('');
      loadCustomers();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi thanh toán nợ');
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-600 dark:text-cyan-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm theo tên hoặc SĐT..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 glass-card rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-shadow text-sky-900 dark:text-sky-50 placeholder-slate-400"
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
            <thead className="text-xs font-bold text-sky-900 dark:text-sky-100 uppercase tracking-wider bg-sky-100/80 dark:bg-sky-950/80 backdrop-blur-sm sticky top-0 z-10 border-b border-sky-200/50 dark:border-sky-800/30">
              <tr>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider">Khách Hàng</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider">Số Điện Thoại</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-right">Tổng Nợ</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
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
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors cursor-pointer group border-b border-slate-100 dark:border-slate-800/40"
                    title="Nhấn để xem lịch sử mua hàng"
                  >
                    <td className="py-4 px-6">
                      <div className="font-extrabold text-slate-850 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-all flex items-center gap-2">
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
                          className="px-3.5 py-2 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500 hover:text-white border border-sky-200 dark:border-sky-800/40 text-xs font-bold rounded-xl transition-all active:scale-[0.96] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
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
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/5 px-3.5 py-2 rounded-xl border border-emerald-500/10">Không nợ</span>
                        )}
                        <button
                          onClick={(e) => handleOpenEdit(customer, e)}
                          className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-xl transition-colors"
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
      <AnimatePresence>
        {showPaymentModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card rounded-3xl w-full max-w-md overflow-hidden transition-colors duration-500"
            >
              <div className="px-6 py-4 border-b border-sky-200/50 dark:border-sky-800/40 bg-sky-100/50 dark:bg-sky-950/40 flex justify-between items-center">
                <h3 className="font-bold text-sky-950 dark:text-white flex items-center gap-2">
                  <DollarSign className="text-emerald-500" size={20} />
                  Thanh Toán Nợ
                </h3>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400"
                >
                  <DollarSign size={16} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleProcessPayment} className="p-6 space-y-5">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Khách hàng</p>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{selectedCustomer.name} - {selectedCustomer.phone}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Nợ hiện tại</p>
                  <p className="font-bold text-rose-500 text-xl">{formatPrice(selectedCustomer.debt || 0)}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Số tiền thanh toán</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      required
                      value={formatNumberWithCommas(paymentAmount)}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '');
                        const parsed = clean ? parseInt(clean, 10).toString() : '';
                        setPaymentAmount(parsed);
                      }}
                      className="w-full px-4 py-3 bg-sky-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-mono text-lg"
                      placeholder="Nhập số tiền..."
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">VNĐ</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-3 bg-white/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all active:scale-[0.96] focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all active:scale-[0.96] shadow-lg shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    Xác Nhận
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative border border-amber-200/50 dark:border-slate-800 bg-[#fdfaf2] dark:bg-slate-950"
            >
              {/* Spiral Notebook Rings at the top */}
              <div className="absolute top-0 left-0 right-0 flex justify-center gap-4 -mt-3.5 z-20 pointer-events-none">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-2.5 h-6 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 rounded-full border border-slate-300 shadow-sm" />
                    <div className="w-1.5 h-1.5 bg-slate-900 rounded-full -mt-1.5" />
                  </div>
                ))}
              </div>

              {/* Notebook Header */}
              <div className="px-6 pt-7 pb-5 border-b border-amber-200/40 dark:border-slate-800 bg-[#faf6eb]/90 dark:bg-slate-900/90 flex justify-between items-start shrink-0 relative z-10 pl-12 pr-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-widest mb-1">
                    <Tag size={12} />
                    Sổ công nợ chi tiết (Sổ tay)
                  </div>
                  <h3 className="font-extrabold text-2xl text-slate-900 dark:text-white tracking-tight">
                    {selectedCustomer.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">SĐT: {selectedCustomer.phone}</p>
                </div>
                
                <div className="text-right flex flex-col items-end mr-4">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Dư nợ hiện tại:</span>
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 px-3 py-1 rounded-2xl shadow-sm font-mono">
                    {formatPrice(selectedCustomer.debt || 0)}
                  </span>
                </div>

                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors -mt-1"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Lined Paper Notebook Content */}
              <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar bg-[#fdfaf2] dark:bg-slate-950 pl-12">
                {/* Lined paper margin line decorator */}
                <div className="absolute left-9 top-0 bottom-0 border-l-2 border-rose-300/40" />

                {loadingHistory ? (
                  <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                  </div>
                ) : customerHistory.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
                    <Receipt size={40} className="opacity-20 text-amber-700" />
                    Sổ nợ trống. Chưa có lịch sử giao dịch nợ nào.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {customerHistory.map((tx, idx) => {
                      const isDebt = tx.type === 'debt';
                      return (
                        <div key={tx.id || idx} className="relative group flex justify-between items-start pb-4 border-b border-amber-100/50 dark:border-slate-800/40">
                          {/* Chronological bullet marker */}
                          <div className={`absolute -left-[16px] top-1.5 w-3 h-3 rounded-full border-2 border-[#fdfaf2] dark:border-slate-950 shadow-sm ${
                            isDebt ? 'bg-rose-500' : 'bg-emerald-500'
                          }`} />

                          <div className="flex-1 pr-6">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold font-mono tracking-wider block mb-1">
                              {formatDate(tx.timestamp)}
                            </span>
                            
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                              {tx.note}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`text-base font-black font-mono block ${
                              isDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {isDebt ? '+' : '-'}{formatPrice(tx.amount)}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-455 font-bold font-mono mt-1 bg-amber-50 dark:bg-slate-900 border border-amber-100 dark:border-slate-850 px-1.5 py-0.5 rounded-lg inline-block">
                              Nợ: {formatPrice(tx.remainingDebt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card rounded-3xl w-full max-w-md overflow-hidden transition-colors duration-500 bg-white/90 dark:bg-slate-900/90 shadow-2xl border border-slate-200/50 dark:border-slate-800/40"
            >
              <div className="px-6 py-4 border-b border-sky-200/50 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-950/40 flex justify-between items-center">
                <h3 className="font-bold text-sky-950 dark:text-white flex items-center gap-2">
                  <UserPlus className="text-sky-500" size={20} />
                  Thêm Khách Hàng Mới
                </h3>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddCustomer} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Tên Khách Hàng *</label>
                  <input 
                    type="text" 
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold"
                    placeholder="VD: Nguyễn Văn A..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Số Điện Thoại *</label>
                  <input 
                    type="text" 
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold"
                    placeholder="VD: 0987..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider mb-2">Dư Nợ Ban Đầu (VNĐ)</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={formatNumberWithCommas(newDebt)}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '');
                        const parsed = clean ? parseInt(clean, 10).toString() : '';
                        setNewDebt(parsed);
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold font-mono"
                      placeholder="VD: 0 hoặc bỏ trống..."
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-xs">VNĐ</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-3 bg-white/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-sky-500 text-white rounded-xl font-bold hover:bg-sky-600 transition-colors shadow-lg shadow-sky-500/20"
                  >
                    Lưu
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Customer Modal */}
      <AnimatePresence>
        {showEditModal && customerToEdit && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card rounded-3xl w-full max-w-md overflow-hidden transition-colors duration-500 bg-white/90 dark:bg-slate-900/90 shadow-2xl border border-slate-200/50 dark:border-slate-800/40"
            >
              <div className="px-6 py-4 border-b border-sky-200/50 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-950/40 flex justify-between items-center">
                <h3 className="font-bold text-sky-950 dark:text-white flex items-center gap-2">
                  <Edit2 className="text-sky-500" size={20} />
                  Chỉnh Sửa Khách Hàng
                </h3>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleEditCustomerSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Tên Khách Hàng *</label>
                  <input 
                    type="text" 
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold"
                    placeholder="VD: Nguyễn Văn A..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Số Điện Thoại</label>
                  <input 
                    type="text" 
                    disabled
                    value={customerToEdit.phone}
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-semibold cursor-not-allowed"
                  />
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 font-bold flex items-center gap-1">
                    <Info size={10} /> SĐT là mã định danh không thể thay đổi.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider mb-2">Dư Nợ Hiện Tại (VNĐ)</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={formatNumberWithCommas(editDebt)}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '');
                        const parsed = clean ? parseInt(clean, 10).toString() : '';
                        setEditDebt(parsed);
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all text-slate-900 dark:text-slate-100 font-semibold font-mono"
                      placeholder="VD: 0..."
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-xs">VNĐ</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-3 bg-white/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-sky-500 text-white rounded-xl font-bold hover:bg-sky-600 transition-colors shadow-lg shadow-sky-500/20"
                  >
                    Lưu Thay Đổi
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Special Prices Modal */}
      <AnimatePresence>
        {showSpecialPricesModal && selectedCustomer && (
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
                    setShowSpecialPricesModal(false);
                    setSelectedProductId('');
                    setNewSpecialPrice('');
                  }}
                  className="p-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X size={22} strokeWidth={2.5} />
                </button>
              </div>

              {/* Form to add special price */}
              {(() => {
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
                );
              })()}

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
        )}
      </AnimatePresence>
    </div>
  );
}
