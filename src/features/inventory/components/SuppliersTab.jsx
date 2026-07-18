import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db';
import { Users, Search, DollarSign, History, Trash2, Edit2, Plus, X, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function SuppliersTab({ searchTerm }) {
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [debt, setDebt] = useState('');
  const [note, setNote] = useState('');

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.phone.includes(searchTerm)
  );

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const formatNumberWithCommas = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = val.toString().replace(/[^0-9]/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('en-US').format(parseInt(clean, 10));
  };

  const handleDeleteSupplier = async (supplier, e) => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc muốn xóa nhà cung cấp ${supplier.name}?`)) {
      return;
    }
    try {
      await db.suppliers.delete(supplier.id);
      await db.supplierTransactions.where('supplierId').equals(supplier.id).delete();
      toast.success('Đã xóa nhà cung cấp!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa nhà cung cấp!');
    }
  };

  const handleOpenAdd = () => {
    setName('');
    setPhone('');
    setDebt('');
    setNote('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (supplier, e) => {
    e.stopPropagation();
    setSupplierToEdit(supplier);
    setName(supplier.name);
    setPhone(supplier.phone);
    setDebt(supplier.debt ? supplier.debt.toString() : '0');
    setNote(supplier.note || '');
    setShowEditModal(true);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const parsedDebt = parseFloat(debt.toString().replace(/[^0-9]/g, '')) || 0;

    if (!cleanName || !cleanPhone) {
      toast.error('Vui lòng nhập đầy đủ tên và số điện thoại');
      return;
    }

    try {
      if (showAddModal) {
        await db.suppliers.add({
          name: cleanName,
          phone: cleanPhone,
          debt: parsedDebt,
          note: note.trim()
        });
        toast.success(`Đã thêm nhà cung cấp ${cleanName}`);
      } else if (showEditModal && supplierToEdit) {
        await db.suppliers.update(supplierToEdit.id, {
          name: cleanName,
          phone: cleanPhone,
          debt: parsedDebt,
          note: note.trim()
        });
        toast.success(`Đã cập nhật nhà cung cấp ${cleanName}`);
      }
      
      setShowAddModal(false);
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi lưu nhà cung cấp');
    }
  };

  return (
    <div className="flex-1 overflow-auto flex flex-col min-h-0">
      <div className="flex justify-end p-4 border-b border-slate-200/50 dark:border-slate-800/50">
        <motion.button 
          whileTap={{ scale: 0.97 }}
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold rounded-2xl text-sm shadow-lg shadow-sky-500/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          <Plus size={16} />
          Thêm Nhà Cung Cấp
        </motion.button>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <Truck size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Chưa có dữ liệu nhà cung cấp</p>
            <p className="text-sm mt-1">Vui lòng thêm nhà cung cấp mới để quản lý công nợ.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                <th className="p-4">Nhà Cung Cấp</th>
                <th className="p-4">Số Điện Thoại</th>
                <th className="p-4 text-right">Công Nợ</th>
                <th className="p-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
              {filteredSuppliers.map((supplier) => (
                <tr 
                  key={supplier.id} 
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                >
                  <td className="p-4">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{supplier.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{supplier.note}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-mono text-slate-600 dark:text-slate-300">{supplier.phone}</div>
                  </td>
                  <td className="p-4 text-right">
                    <div className={`font-bold text-sm ${supplier.debt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatPrice(supplier.debt || 0)}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-xl transition-colors"
                        title="Sửa"
                        onClick={(e) => handleOpenEdit(supplier, e)}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSupplier(supplier, e)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Add/Edit */}
      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-sky-600 dark:text-sky-400">
                  <div className="p-2 bg-sky-100 dark:bg-sky-500/20 rounded-xl">
                    <Truck size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white">
                    {showAddModal ? 'Thêm Nhà Cung Cấp' : 'Sửa Nhà Cung Cấp'}
                  </h3>
                </div>
                <button
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveSupplier} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                    Tên nhà cung cấp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium"
                    placeholder="Nhập tên công ty/nhà cung cấp..."
                    autoFocus
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                    Số điện thoại <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium"
                    placeholder="Nhập số điện thoại..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Ghi chú</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium"
                    placeholder="Mô tả hàng hóa cấp, địa chỉ..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Dư nợ hiện tại (VNĐ)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₫</span>
                    <input
                      type="text"
                      value={formatNumberWithCommas(debt)}
                      onChange={(e) => setDebt(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 bg-rose-50/50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-bold"
                      placeholder="Nhập số tiền đang nợ..."
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 ml-1">Nếu bạn đang nợ NCC này tiền, hãy nhập số dư vào đây.</p>
                </div>

                <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                    className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    {showAddModal ? 'Thêm Mới' : 'Cập Nhật'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
