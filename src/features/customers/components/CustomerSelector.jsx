import React, { useState, useEffect } from 'react';
import { Search, UserCheck, UserPlus, ChevronUp, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';

export default function CustomerSelector({ customer, setCustomer, isCredit }) {
  const [phoneInput, setPhoneInput] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const allCustomers = useLiveQuery(() => db.customers.toArray()) || [];
  const filteredCustomers = allCustomers.filter(c => 
    c.phone.includes(phoneInput.trim()) || 
    c.name.toLowerCase().includes(phoneInput.trim().toLowerCase())
  );

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  // Debounced search customer when typing phone or name
  useEffect(() => {
    const lookupCustomer = async () => {
      if (phoneInput.trim().length >= 1) {
        const cust = await db.customers.get(phoneInput.trim());
        if (cust) {
          setCustomer(cust);
          setShowRegisterForm(false);
        } else {
          setCustomer(null);
          setShowRegisterForm(true);
        }
      } else {
        setCustomer(null);
        setShowRegisterForm(false);
      }
    };
    lookupCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneInput]);

  const handleRegisterCustomer = async (isQuickDebt = false) => {
    let finalPhone = phoneInput.trim();
    let finalName = newCustomerName.trim();
    
    if (isQuickDebt) {
      if (!phoneInput.trim()) {
        toast.error("Vui lòng nhập tên khách hàng vãng lai.");
        return;
      }
      finalName = phoneInput.trim();
      finalPhone = `_vl_${Date.now()}`; // dummy phone
    } else {
      if (!finalPhone || !finalName) {
        toast.error("Vui lòng nhập tên khách hàng.");
        return;
      }
    }

    const newCust = {
      phone: finalPhone,
      name: finalName,
      points: 0,
      debt: 0
    };
    try {
      const allCustomers = await db.customers.toArray();
      const existingName = allCustomers.find(c => c.name.toLowerCase() === finalName.toLowerCase());
      if (existingName) {
        toast.error('Tên khách hàng đã tồn tại! Không cho phép trùng tên.');
        return;
      }

      await db.customers.add(newCust);
      setCustomer(newCust);
      setShowRegisterForm(false);
      setNewCustomerName('');
      toast.success(`Đã thêm khách hàng ${newCust.name}!`);
    } catch (e) {
      toast.error("Lỗi khi đăng ký thành viên.");
    }
  };

  const handleClearCustomer = () => {
    setCustomer(null);
    setPhoneInput('');
    setShowRegisterForm(false);
  };

  return (
    <div className={`rounded-2xl p-4 border transition-colors duration-200 ${
      isCredit && !customer 
        ? 'bg-rose-50/50 dark:bg-rose-500/10 border-rose-500/30 ring-1 ring-rose-500/50' 
        : 'bg-white/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50'
    }`}>
      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <UserPlus size={14} />
        Khách Hàng {isCredit && <span className="text-rose-500">* Bắt buộc</span>}
      </h3>

      {!customer ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" size={16} />
            <input 
              id="customer-search-input"
              type="text"
              value={phoneInput}
              onChange={(e) => {
                setPhoneInput(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                if (phoneInput.trim() !== '') {
                  setShowDropdown(true);
                }
              }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="w-full pl-10 pr-9 py-3 bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all placeholder:font-normal placeholder:text-slate-400"
              placeholder="Nhập SĐT hoặc tên khách..."
              aria-label="Nhập số điện thoại khách hàng"
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowDropdown(!showDropdown);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors focus:outline-none"
            >
              {showDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <AnimatePresence>
              {showDropdown && filteredCustomers.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 max-h-48 overflow-y-auto overflow-x-hidden"
                >
                  {filteredCustomers.map(c => (
                    <div 
                      key={c.phone} 
                      className="px-4 py-3 hover:bg-sky-50 dark:hover:bg-sky-950/40 cursor-pointer flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 last:border-b-0 transition-colors"
                      onClick={() => {
                        setCustomer(c);
                        setPhoneInput(c.phone);
                        setShowDropdown(false);
                        setShowRegisterForm(false);
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0 pr-3">
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{c.name}</div>
                        {!c.phone.startsWith('_vl_') && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md inline-block w-fit">{c.phone}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {c.points > 0 && (
                          <div className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg flex-shrink-0 whitespace-nowrap">
                            Điểm: {c.points}
                          </div>
                        )}
                        {c.debt > 0 && (
                          <div className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-lg flex-shrink-0 whitespace-nowrap">
                            Nợ: {formatPrice(c.debt)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showRegisterForm && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="space-y-2 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50 overflow-hidden"
              >
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Khách hàng chưa đăng ký. Tạo nhanh:</p>
                <div className="flex gap-1.5">
                  <input 
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
                    placeholder="Tên khách hàng..."
                    aria-label="Tên khách hàng mới"
                  />
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRegisterCustomer(false)}
                    className="px-3 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Lưu
                  </motion.button>
                </div>
                {/* Nút Ghi nợ vãng lai */}
                <div className="flex justify-end pt-1">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRegisterCustomer(true)}
                    className="w-full px-3 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold rounded-xl hover:bg-amber-500/20 transition-colors focus:outline-none"
                  >
                    + Tạo khách vãng lai (Chỉ lấy tên ở trên)
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500 dark:text-emerald-400">
              <UserCheck size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{customer.name}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex gap-2">
                <span>Nợ: <span className="text-rose-500 font-bold">{formatPrice(customer.debt || 0)}</span></span>
                {customer.points > 0 && (
                  <span>• Điểm: <span className="text-emerald-500 font-bold">{customer.points}</span></span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={handleClearCustomer}
            className="text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors focus:outline-none"
            aria-label="Xóa khách hàng"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
