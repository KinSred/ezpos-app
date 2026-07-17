import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Edit2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../db';
import toast from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';

export default function PromotionsScreen() {
  const promotions = useLiveQuery(() => db.promotions.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];

  const [showAddForm, setShowAddForm] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState(null);
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('buy_x_get_y'); // 'buy_x_get_y'
  const [buyProductId, setBuyProductId] = useState('');
  const [buyQuantity, setBuyQuantity] = useState(2);
  const [getQuantity, setGetQuantity] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setName('');
    setType('buy_x_get_y');
    setBuyProductId('');
    setBuyQuantity(2);
    setGetQuantity(1);
    setIsActive(true);
    setShowAddForm(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name || !buyProductId || buyQuantity <= 0 || getQuantity <= 0) {
      toast.error('Vui lòng nhập đầy đủ thông tin hợp lệ!');
      return;
    }

    try {
      await db.promotions.add({
        name,
        type,
        buyProductId: parseInt(buyProductId),
        buyQuantity: parseInt(buyQuantity),
        getQuantity: parseInt(getQuantity),
        isActive,
        createdAt: Date.now()
      });
      toast.success('Đã thêm chương trình khuyến mãi!');
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi lưu khuyến mãi.');
    }
  };

  const handleDelete = (id) => {
    setPromoToDelete(id);
  };

  const confirmDelete = async () => {
    if (promoToDelete) {
      await db.promotions.delete(promoToDelete);
      toast.success('Đã xóa khuyến mãi!');
      setPromoToDelete(null);
    }
  };

  const toggleActive = async (promo) => {
    await db.promotions.update(promo.id, { isActive: !promo.isActive });
    toast.success(promo.isActive ? 'Đã tắt khuyến mãi!' : 'Đã bật khuyến mãi!');
  };

  const getProductName = (id) => {
    const p = products.find(p => p.id === id);
    return p ? p.name : 'Sản phẩm không tồn tại';
  };

  return (
    <div className="h-full bg-slate-50/50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto mt-6">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <Tag className="text-rose-500" size={32} />
            Quản Lý Khuyến Mãi
          </h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-rose-500 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-rose-600 transition-all shadow-[0_4px_14px_rgba(244,63,94,0.3)]"
          >
            <Plus size={20} />
            Thêm Chương Trình
          </button>
        </div>

        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              className="mb-8 overflow-hidden"
            >
              <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Tạo Khuyến Mãi Mới</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tên Chương Trình *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="VD: Mua 2 tặng 1 Sữa Tươi..."
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Loại Khuyến Mãi</label>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none"
                    >
                      <option value="buy_x_get_y">Mua M tặng N (cùng sản phẩm)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Sản phẩm áp dụng *</label>
                    <select
                      required
                      value={buyProductId}
                      onChange={e => setBuyProductId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none"
                    >
                      <option value="">-- Chọn sản phẩm --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Kho: {p.stock} {p.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Số lượng mua (M) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={buyQuantity}
                      onChange={e => setBuyQuantity(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Số lượng tặng (N) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={getQuantity}
                      onChange={e => setGetQuantity(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600"
                  >
                    Lưu Khuyến Mãi
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promotions.map(promo => (
            <div key={promo.id} className={`bg-white dark:bg-slate-800 rounded-3xl p-6 border transition-all duration-300 ${promo.isActive ? 'border-rose-200 dark:border-rose-500/20 shadow-[0_12px_24px_rgba(244,63,94,0.04)] dark:shadow-none' : 'border-slate-200/60 dark:border-slate-800 opacity-60'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3 items-center">
                  <div className={`p-2.5 rounded-2xl ${promo.isActive ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                    <Tag size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-850 dark:text-slate-100 line-clamp-1" title={promo.name}>{promo.name}</h3>
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Mua {promo.buyQuantity} tặng {promo.getQuantity}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl mb-5 border border-slate-100 dark:border-slate-800/30">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sản phẩm áp dụng:</p>
                <p className="font-extrabold text-sm text-slate-700 dark:text-slate-350 line-clamp-1">{getProductName(promo.buyProductId)}</p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-4">
                <button
                  onClick={() => toggleActive(promo)}
                  className="relative flex items-center cursor-pointer focus:outline-none"
                  aria-label="Bật tắt khuyến mãi"
                >
                  <div className={`w-10 h-5.5 rounded-full transition-colors duration-300 relative ${promo.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <motion.div 
                      layout
                      className="w-4.5 h-4.5 bg-white rounded-full shadow-sm absolute top-0.5 left-0.5"
                      animate={{ x: promo.isActive ? 16 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-2">
                    {promo.isActive ? 'Đang chạy' : 'Tạm dừng'}
                  </span>
                </button>
                
                <button
                  onClick={() => handleDelete(promo.id)}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {promotions.length === 0 && !showAddForm && (
            <div className="col-span-full py-12 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mb-4 text-rose-300 dark:text-rose-500/50">
                <Tag size={32} />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Chưa có chương trình khuyến mãi nào.</p>
              <button onClick={() => setShowAddForm(true)} className="text-rose-500 font-bold mt-2 hover:underline">Tạo ngay</button>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {promoToDelete && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-700/50"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Xác Nhận Xóa</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                  Bạn có chắc chắn muốn xóa chương trình khuyến mãi này không? Hành động này không thể hoàn tác.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setPromoToDelete(null)}
                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors"
                  >
                    Hủy Bỏ
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 py-3 px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-rose-500/30"
                  >
                    Đồng Ý Xóa
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
