import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Receipt, QrCode, Coins, CheckCircle2, X, AlertTriangle, CreditCard, Trash2, Edit2, Calendar, Command, ArrowLeft, ArrowRight, CornerDownLeft } from 'lucide-react';
import { db } from '../db';
import toast from 'react-hot-toast';
import CustomerSelector from './CustomerSelector';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function CheckoutConfirmationModal({
  cartItems,
  baseTotalAmount,
  promoDiscountAmount,
  totalAmount,
  discount,
  setDiscount,
  discountType,
  setDiscountType,
  finalAmount,
  customer,
  setCustomer,
  isCredit,
  setIsCredit,
  getAppliedPrice,
  onClose,
  onConfirm,
  getEffectiveTaxRate,
  totalTaxAmount,
  onRemoveItem,
  onUpdateCustomPrice,
  mode,
  showShortcuts
}) {
  const [paymentMethod, setPaymentMethod] = useState(mode === 'wholesale' ? 'credit' : (isCredit ? 'credit' : 'cash')); // 'cash' or 'vietqr' or 'credit'
  const [cashReceived, setCashReceived] = useState('');
  const [bankInfo, setBankInfo] = useState(null);
  const [orderDate, setOrderDate] = useState(new Date());
  const [qrUrl, setQrUrl] = useState('');
  const [showFullQR, setShowFullQR] = useState(false);
  
  // SePay integration states
  const [sepayApiKey, setSepayApiKey] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [pollingStatus, setPollingStatus] = useState('');

  const cashInputRef = useRef(null);

  const [editingCartId, setEditingCartId] = useState(null);
  const [editPriceVal, setEditPriceVal] = useState('');

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

  // Price formatting
  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const cleanCashReceived = cashReceived ? String(cashReceived).replace(/,/g, '') : '';
  const changeAmount = cleanCashReceived ? Math.max(0, parseFloat(cleanCashReceived) - finalAmount) : 0;

  // Load bank settings for VietQR
  useEffect(() => {
    if (paymentMethod === 'vietqr' || paymentMethod === 'split') {
      const fetchSettings = async () => {
        try {
          const binSetting = await db.settings.get('bankBin');
          const accSetting = await db.settings.get('bankAccount');
          const nameSetting = await db.settings.get('bankAccountName');
          const sepaySetting = await db.settings.get('sepayApiKey');

          const bin = binSetting?.value || '970436';
          const acc = accSetting?.value || '';
          const name = nameSetting?.value || '';
          const sepayKey = sepaySetting?.value || '';

          setBankInfo({ bin, acc, name });
          setSepayApiKey(sepayKey);

          let addInfoText = 'Thanh toan don hang';
          if (sepayKey) {
            const uniqueCode = `DH${Date.now().toString().slice(-6)}`;
            setOrderCode(uniqueCode);
            addInfoText = uniqueCode;
          }

          const amountToTransfer = paymentMethod === 'split' ? Math.max(0, finalAmount - (cleanCashReceived ? parseFloat(cleanCashReceived) : 0)) : finalAmount;
          
          if (amountToTransfer > 0) {
            const url = `https://img.vietqr.io/image/${bin}-${acc}-compact2.png?amount=${amountToTransfer}&addInfo=${encodeURIComponent(addInfoText)}&accountName=${encodeURIComponent(name)}`;
            setQrUrl(url);
          } else {
            setQrUrl('');
          }
        } catch (error) {
          console.error("Error fetching settings:", error);
        }
      };
      fetchSettings();
    }
  }, [paymentMethod, finalAmount, cleanCashReceived]);

  // SePay API Polling
  useEffect(() => {
    if (paymentMethod !== 'vietqr' || !sepayApiKey || !orderCode) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        if (isMounted) setPollingStatus('Đang kiểm tra giao dịch...');
        const response = await fetch('https://my.sepay.vn/userapi/transactions/list', {
          headers: {
            'Authorization': `Bearer ${sepayApiKey}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        
        if (data && data.transactions) {
          const match = data.transactions.find(t => 
            t.transaction_content && t.transaction_content.includes(orderCode) && 
            parseFloat(t.amount_in) >= finalAmount
          );

          if (match && isMounted) {
            toast.success(`Đã nhận thanh toán từ ${match.bank_brand_name || 'Khách hàng'}`);
            clearInterval(interval);
            onConfirm(paymentMethod, finalAmount, 0, orderDate);
          } else if (isMounted) {
            setPollingStatus('Đang chờ thanh toán...');
          }
        }
      } catch (err) {
        console.error("SePay polling error:", err);
        if (isMounted) setPollingStatus('Lỗi kết nối SePay');
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [paymentMethod, sepayApiKey, orderCode, finalAmount, onConfirm, orderDate]);

  // Autofocus cash input when Cash or Split is selected
  useEffect(() => {
    if ((paymentMethod === 'cash' || paymentMethod === 'split') && cashInputRef.current) {
      // Small timeout to ensure modal animation is done
      setTimeout(() => cashInputRef.current.focus(), 100);
    }
  }, [paymentMethod]);

  // Accessibility (A11y): Escape key to close modal, F11/F9/Enter to submit
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Giảm giá (Cmd+G)
      if (isCmdOrCtrl && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const discountInput = document.getElementById('checkout-discount-input');
        if (discountInput) discountInput.focus();
        return;
      }

      // Đổi phương thức thanh toán (Trái/Phải nếu ko trong input, hoặc Cmd+Trái/Phải)
      if ((isCmdOrCtrl && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) || 
          (!isCmdOrCtrl && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA')) {
        e.preventDefault();
        const methods = ['cash', 'vietqr', 'split', 'credit'];
        const currentIdx = methods.indexOf(paymentMethod);
        const nextIdx = e.key === 'ArrowRight' ? (currentIdx + 1) % methods.length : (currentIdx - 1 + methods.length) % methods.length;
        const nextMethod = methods[nextIdx];
        setPaymentMethod(nextMethod);
        if (setIsCredit) setIsCredit(nextMethod === 'credit');
        return;
      }

      // Gợi ý tiền khách đưa (Cmd + 1..5)
      if (isCmdOrCtrl && ['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        if (paymentMethod !== 'cash' && paymentMethod !== 'split') {
          setPaymentMethod('cash');
          if (setIsCredit) setIsCredit(false);
        }
        const quickOptions = [50000, 100000, 200000, 500000, finalAmount];
        const val = quickOptions[parseInt(e.key) - 1];
        setCashReceived(new Intl.NumberFormat('en-US').format(val));
        return;
      }

      if (e.key === 'F11' || e.key === 'F9' || (isCmdOrCtrl && e.key === 'Enter')) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Enter') {
        // Chỉ submit nếu đang ở input tiền mặt, hoặc không focus vào input/textarea nào cả
        if (
          e.target === cashInputRef.current ||
          (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA')
        ) {
          e.preventDefault();
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, paymentMethod, cashReceived, finalAmount, customer, isCredit]);

  // Cash format with commas
  const formatNumberWithCommas = (value) => {
    if (!value) return '';
    const clean = String(value).replace(/,/g, '');
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleCashChange = (e) => {
    const rawValue = e.target.value;
    const cleanDigits = rawValue.replace(/\D/g, '');
    const parsed = cleanDigits ? parseInt(cleanDigits, 10).toString() : '';
    setCashReceived(formatNumberWithCommas(parsed));
  };

  // Quick cash shortcuts
  const handleQuickCash = (amount) => {
    setCashReceived(formatNumberWithCommas(amount));
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    if (isCredit) {
      if (!customer) {
        toast.error("Vui lòng chọn khách hàng để ghi nợ!");
        return;
      }
      onConfirm('credit', 0, 0, orderDate);
      return;
    }

    if (paymentMethod === 'cash') {
      const cleanCash = cashReceived ? String(cashReceived).replace(/,/g, '') : '';
      let received = cleanCash ? parseFloat(cleanCash) : finalAmount;
      if (received > 0 && received < 1000) received = received * 1000;
      
      if (received < finalAmount) {
        toast.error("Số tiền khách đưa chưa đủ!");
        return;
      }
      onConfirm(paymentMethod, received, received - finalAmount, orderDate);
    } else if (paymentMethod === 'split') {
      const cleanCash = cashReceived ? String(cashReceived).replace(/,/g, '') : '';
      let receivedCash = cleanCash ? parseFloat(cleanCash) : 0;
      if (receivedCash > 0 && receivedCash < 1000) receivedCash = receivedCash * 1000;

      if (receivedCash >= finalAmount) {
         // It's effectively just cash
         onConfirm('cash', receivedCash, receivedCash - finalAmount, orderDate);
      } else {
         onConfirm('split', receivedCash, 0, orderDate);
      }
    } else {
      // For QR Code transfer
      onConfirm(paymentMethod, finalAmount, 0, orderDate);
    }
  };

  // Common quick money options in VND
  const quickMoneyOptions = [
    { label: 'Đúng số tiền', value: finalAmount },
    { label: '50.000 đ', value: 50000 },
    { label: '100.000 đ', value: 100000 },
    { label: '200.000 đ', value: 200000 },
    { label: '500.000 đ', value: 500000 }
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto no-print"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-800/50 transition-colors duration-300"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 sticky top-0">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
            <div className="bg-sky-100 dark:bg-sky-500/20 p-1.5 rounded-lg text-sky-600 dark:text-sky-400">
              <Receipt size={20} strokeWidth={2.5} />
            </div>
            {isCredit ? 'Xác Nhận Đơn Nợ' : 'Thanh Toán Đơn Hàng'}
          </h3>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 p-2 rounded-2xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Đóng"
          >
            <X size={24} strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* Content Panel */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto max-h-[85vh]">

          {/* Cột trái (45%): Review mặt hàng */}
          <div className="lg:col-span-5 border-r border-slate-200/50 dark:border-slate-800/50 p-5 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50">
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingBag size={18} className="text-sky-500" />
              Chi tiết mặt hàng <span className="bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 px-2.5 py-1 rounded-full text-[11px]">{cartItems.reduce((acc, item) => acc + item.qty, 0)}</span>
            </h4>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[30vh] lg:max-h-none custom-scrollbar">
              <motion.div 
                variants={{
                  show: {
                    transition: { staggerChildren: 0.05 }
                  }
                }}
                initial="hidden"
                animate="show"
                className="space-y-3.5"
              >
                {cartItems.map((item) => {
                  const sellMode = item.sellMode || (item.isWholesale ? 'wholesale' : 'base');
                  const isWholesale = sellMode === 'wholesale';
                  const isMid = sellMode === 'mid';
                  let typeLabel = '';
                  if (isWholesale) typeLabel = '(Sỉ)';
                  if (isMid) typeLabel = '(Lốc)';

                  let unitLabel = item.unit || 'cái';
                  if (isWholesale) unitLabel = item.wholesaleUnit;
                  if (isMid) unitLabel = item.midUnit;

                  const appliedPrice = getAppliedPrice ? getAppliedPrice(item) : item.price;
                  let originalPrice = appliedPrice;
                  if (isCredit) {
                    originalPrice = isWholesale ? (item.wholesaleCreditPrice || item.wholesalePrice || item.price) : isMid ? (item.midCreditPrice || item.midPrice || item.price) : (item.creditPrice || item.price);
                  } else {
                    originalPrice = isWholesale ? (item.wholesalePrice || item.price) : isMid ? (item.midPrice || item.price) : item.price;
                  }

                  return (
                    <motion.div 
                      key={item.cartId}
                      variants={{
                        hidden: { opacity: 0, x: -10 },
                        show: { opacity: 1, x: 0 }
                      }}
                      className="flex flex-col p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm group relative"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={`font-bold text-sm leading-tight mb-1.5 ${isWholesale ? 'text-amber-600 dark:text-amber-400' : isMid ? 'text-sky-600 dark:text-sky-400' : 'text-slate-800 dark:text-slate-100'}`}>
                            {item.name} {typeLabel}
                          </p>
                          {editingCartId === item.cartId ? (
                            <div 
                              className="flex items-center gap-2 mt-2 bg-rose-50/50 dark:bg-rose-950/10 p-2 rounded-xl border border-rose-200/50 dark:border-rose-900/30 w-fit"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Giảm giá/cái:</span>
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
                                className="w-24 px-2.5 py-1 text-xs font-black text-rose-600 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-rose-500"
                                placeholder="Gõ số tiền..."
                                autoFocus
                                onFocus={(e) => e.target.select()}
                              />
                              <span className="text-xs text-slate-500 dark:text-slate-400">đ × {item.qty} {unitLabel}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div 
                                onClick={() => {
                                  setEditingCartId(item.cartId);
                                  setEditPriceVal(item.customDiscount !== undefined ? item.customDiscount.toString() : '');
                                }}
                                className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium bg-slate-50 dark:bg-slate-900/50 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-500 transition-colors"
                                title="Click để sửa chiết khấu"
                              >
                                {appliedPrice < originalPrice && (
                                  <span className="line-through text-slate-400 mr-1">{formatPrice(originalPrice)}</span>
                                )}
                                <span>{formatPrice(appliedPrice)}</span>
                                <Edit2 size={10} className="opacity-50 ml-0.5" />
                                <span className="text-slate-350 dark:text-slate-600 px-1">×</span>
                                <span className="text-slate-700 dark:text-slate-300 font-bold">{item.qty}</span>
                                <span className="pl-0.5">{unitLabel}</span>
                              </div>
                              {item.customDiscount !== undefined && item.customDiscount > 0 && (
                                <span className="text-[9px] bg-rose-100 dark:bg-rose-500/25 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded font-extrabold tracking-wider border border-rose-300/25">
                                  Giảm {formatPrice(item.customDiscount)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-slate-800 dark:text-slate-100">{formatPrice(appliedPrice * item.qty)}</span>
                          {onRemoveItem && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onRemoveItem(item.cartId); }}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:text-slate-500 dark:hover:bg-rose-500/20 rounded-lg transition-colors focus:outline-none opacity-0 group-hover:opacity-100 -mr-1.5"
                              title="Xóa mặt hàng"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {getEffectiveTaxRate && getEffectiveTaxRate(item) > 0 && (
                        <div className="text-xs text-rose-500 dark:text-rose-400 mt-2 flex items-center gap-1 font-medium bg-rose-50 dark:bg-rose-500/10 self-start px-2 py-1 rounded-md">
                          + Thuế VAT {getEffectiveTaxRate(item)}%
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* Order Price calculation breakdown */}
            <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/50 space-y-2 mt-auto">
              <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                <span>Tiền hàng cơ bản:</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{formatPrice(baseTotalAmount || totalAmount)}</span>
              </div>
              {promoDiscountAmount > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-500/10 p-2 rounded-lg -mx-2 px-2">
                  <span>Trừ khuyến mãi:</span>
                  <span className="font-mono">-{formatPrice(promoDiscountAmount)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 p-2 rounded-lg -mx-2 px-2">
                  <span>Chiết khấu {discountType === 'percent' ? `(${discount}%)` : ''}:</span>
                  <span className="font-mono">-{formatPrice(discountType === 'percent' ? (totalAmount * discount) / 100 : Math.min(totalAmount, discount))}</span>
                </div>
              )}
              {totalTaxAmount > 0 && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                  <span>Tổng Thuế VAT:</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">+{formatPrice(totalTaxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-end pt-4 mt-2 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-base uppercase tracking-wider mb-1">Tổng Cần Thu</span>
                <span className="text-3xl font-black text-sky-600 dark:text-sky-400 font-mono tracking-tight">{formatPrice(finalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Cột phải (55%): Lựa chọn hình thức & nhập thông tin thanh toán */}
          <div className="lg:col-span-7 p-5 flex flex-col justify-between min-h-0 bg-transparent relative z-10">
            <div>
              {paymentMethod === 'credit' && (
                <div className="mb-4">
                  <CustomerSelector 
                    customer={customer} 
                    setCustomer={setCustomer} 
                    isCredit={isCredit} 
                  />
                </div>
              )}
              
              <div className="mb-4 group bg-gradient-to-br from-white/80 to-white/40 dark:from-slate-800/80 dark:to-slate-900/40 backdrop-blur-xl rounded-2xl p-4 border border-white/60 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-300 relative">
                {/* Decorative background element wrapper */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-sky-500/10 dark:bg-sky-400/5 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-colors duration-500"></div>
                </div>
                
                <div className="flex items-center justify-between mb-2.5 relative z-10">
                  <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="bg-sky-100 dark:bg-sky-500/20 p-1.5 rounded-lg text-sky-600 dark:text-sky-400 shadow-sm">
                      <Calendar size={14} strokeWidth={2.5} />
                    </div>
                    Thời gian tạo đơn
                  </label>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold px-2.5 py-1 bg-sky-50 dark:bg-sky-500/10 rounded-lg border border-sky-100/50 dark:border-sky-500/20">
                    Tuỳ chỉnh
                  </span>
                </div>
                <div className="relative z-10 group/input datepicker-wrapper">
                  <DatePicker
                    selected={orderDate}
                    onChange={(date) => setOrderDate(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="dd/MM/yyyy, HH:mm"
                    className="w-full pl-4 pr-11 py-3 bg-white/90 dark:bg-slate-950/90 border border-slate-200/80 dark:border-slate-800/80 rounded-xl text-sm font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 transition-all cursor-pointer shadow-inner hover:border-sky-300 dark:hover:border-sky-700/50"
                    title="Thay đổi ngày giờ nếu bạn xuất đơn muộn"
                    popperClassName="custom-datepicker-popper"
                    portalId="root"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-500/70 group-hover/input:text-sky-500 transition-colors pointer-events-none bg-white/90 dark:bg-slate-950/90 pl-1">
                     <Edit2 size={16} strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              <div className="mb-4 bg-white/40 dark:bg-slate-900/40 rounded-2xl p-3 border border-slate-200/50 dark:border-slate-800/50">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Chiết Khấu / Giảm Giá</span>
                  <AnimatePresence>
                    {showShortcuts && (
                      <motion.span initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.8}} className="text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded shadow-sm normal-case font-bold tracking-normal flex items-center gap-1">
                        <Command size={10} />/Ctrl + G
                      </motion.span>
                    )}
                  </AnimatePresence>
                </h4>
                <div className="flex gap-2">
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountType('percent');
                        if (discount > 100) setDiscount(100);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        discountType === 'percent'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('amount')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        discountType === 'amount'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      VNĐ
                    </button>
                  </div>
                  <input 
                    id="checkout-discount-input"
                    type="text" 
                    value={discount ? new Intl.NumberFormat('en-US').format(discount) : ''}
                    onChange={(e) => {
                      let val = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                      if (!val) { setDiscount(0); return; }
                      let num = parseInt(val, 10);
                      if (discountType === 'percent' && num > 100) num = 100;
                      setDiscount(num);
                    }}
                    onBlur={() => {
                      if (discountType === 'amount' && discount > 0 && discount < 1000) {
                        setDiscount(discount * 1000);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                    placeholder={`Nhập ${discountType === 'percent' ? '%' : 'số tiền'}...`}
                  />
                </div>
              </div>
              
              <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Hình thức thanh toán</span>
                <AnimatePresence>
                  {showShortcuts && (
                    <motion.span initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.8}} className="text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded shadow-sm normal-case font-bold tracking-normal flex items-center gap-1">
                      <ArrowLeft size={10} />/<ArrowRight size={10} /> Đổi
                    </motion.span>
                  )}
                </AnimatePresence>
              </h4>
 
              {/* Segmented Control Selector */}
              {mode !== 'wholesale' ? (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <motion.button 
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => { setPaymentMethod('cash'); if (setIsCredit) setIsCredit(false); }}
                    className={`p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 border ${
                      paymentMethod === 'cash'
                        ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-400 shadow-[0_2px_8px_rgba(14,165,233,0.15)]'
                        : 'bg-white dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-sky-300 dark:hover:border-sky-700/50 shadow-sm'
                    }`}
                    aria-label="Thanh toán tiền mặt"
                  >
                    <Coins size={20} strokeWidth={2} className={paymentMethod === 'cash' ? 'text-sky-500' : ''} />
                    <span>Tiền Mặt</span>
                  </motion.button>
                  
                  <motion.button 
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => { setPaymentMethod('vietqr'); if (setIsCredit) setIsCredit(false); }}
                    className={`p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 border ${
                      paymentMethod === 'vietqr'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-[0_2px_8px_rgba(16,185,129,0.15)]'
                        : 'bg-white dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-emerald-300 dark:hover:border-emerald-700/50 shadow-sm'
                    }`}
                    aria-label="Thanh toán chuyển khoản"
                  >
                    <QrCode size={20} strokeWidth={2} className={paymentMethod === 'vietqr' ? 'text-emerald-500' : ''} />
                    <span>Chuyển Khoản</span>
                  </motion.button>

                  <motion.button 
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => { setPaymentMethod('split'); if (setIsCredit) setIsCredit(false); }}
                    className={`p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 border ${
                      paymentMethod === 'split'
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-[0_2px_8px_rgba(99,102,241,0.15)]'
                        : 'bg-white dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700/50 shadow-sm'
                    }`}
                    aria-label="Thanh toán kết hợp"
                  >
                    <div className="flex -space-x-2">
                      <Coins size={20} strokeWidth={2} className={paymentMethod === 'split' ? 'text-indigo-500' : 'text-slate-400'} />
                      <QrCode size={20} strokeWidth={2} className={paymentMethod === 'split' ? 'text-indigo-500' : 'text-slate-400'} />
                    </div>
                    <span>Kết Hợp</span>
                  </motion.button>
                  
                  <motion.button 
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => { 
                      setPaymentMethod('credit'); 
                      if (setIsCredit) setIsCredit(true); 
                    }}
                    className={`p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 border ${
                      paymentMethod === 'credit'
                        ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 shadow-[0_2px_8px_rgba(245,158,11,0.15)]'
                        : 'bg-white dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-amber-300 dark:hover:border-amber-700/50 shadow-sm'
                    }`}
                    aria-label="Thanh toán ghi nợ"
                  >
                    <CreditCard size={20} strokeWidth={2} className={paymentMethod === 'credit' ? 'text-amber-500' : ''} />
                    <span>Ghi Nợ</span>
                  </motion.button>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/35 rounded-xl text-center text-xs font-bold text-amber-700 dark:text-amber-450">
                  Hình thức thanh toán: GHI NỢ (Bắt buộc cho đơn giao sỉ đại lý)
                </div>
              )}
 
 
              {/* Dynamic Payment Details Area */}
              <AnimatePresence mode="wait">
                {paymentMethod === 'credit' ? (
                  <motion.div
                    key="credit-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="bg-amber-50 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center"
                  >
                    <CreditCard className="mx-auto text-amber-500 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-2">Đơn Hàng Ghi Nợ</h3>
                    {customer ? (
                      <p className="text-sm text-amber-600 dark:text-amber-400/80">
                        Khách hàng <strong>{customer.name}</strong> sẽ được ghi nợ số tiền <strong className="text-lg">{formatPrice(finalAmount)}</strong>
                      </p>
                    ) : (
                      <p className="text-sm text-rose-500 font-bold bg-rose-50 dark:bg-rose-500/10 py-2 rounded-lg">
                        Vui lòng chọn khách hàng ở mục trên để thực hiện ghi nợ.
                      </p>
                    )}
                  </motion.div>
                ) : paymentMethod === 'cash' ? (
                      // TIỀN MẶT
                      <motion.div
                        key="cash-panel"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wider flex items-center justify-between">
                            <span>Số Tiền Khách Đưa (VNĐ)</span>
                            <AnimatePresence>
                              {showShortcuts && (
                                <motion.span initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.8}} className="text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded shadow-sm normal-case font-bold tracking-normal flex items-center gap-1">
                                  Gõ 50 <CornerDownLeft size={10} /> = 50.000
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </label>
                          <input 
                            ref={cashInputRef}
                            type="text" 
                            required
                            value={cashReceived}
                            onChange={handleCashChange}
                            onBlur={() => {
                              const num = parseInt(cashReceived.replace(/,/g, ''), 10) || 0;
                              if (num > 0 && num < 1000) {
                                setCashReceived(new Intl.NumberFormat('en-US').format(num * 1000));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                e.preventDefault();
                                const methods = ['cash', 'vietqr', 'split', 'credit'];
                                const currentIdx = methods.indexOf(paymentMethod);
                                const nextIdx = e.key === 'ArrowRight' ? (currentIdx + 1) % methods.length : (currentIdx - 1 + methods.length) % methods.length;
                                const nextMethod = methods[nextIdx];
                                setPaymentMethod(nextMethod);
                                if (setIsCredit) setIsCredit(nextMethod === 'credit');
                              }
                            }}
                            className="w-full px-4 py-3 bg-sky-50/50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-2xl sm:text-3xl font-black text-sky-700 dark:text-sky-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 transition-all font-mono shadow-inner"
                            placeholder="VD: 50,000..."
                            aria-label="Tiền mặt khách đưa"
                          />
                        </div>
 
                        {/* Quick money shortcuts list */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {quickMoneyOptions.map((opt, idx) => (
                            <motion.button
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.95 }}
                              key={idx}
                              type="button"
                              onClick={() => handleQuickCash(opt.value)}
                              className="flex-1 min-w-[90px] px-2 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                            >
                              {opt.label}
                            </motion.button>
                          ))}
                        </div>
 
                        {/* Change due visualization */}
                        <AnimatePresence>
                          {cashReceived && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0, scale: 0.95 }}
                              animate={{ opacity: 1, height: 'auto', scale: 1 }}
                              exit={{ opacity: 0, height: 0, scale: 0.95 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="flex justify-between items-center bg-emerald-500 dark:bg-emerald-600 p-4 rounded-xl shadow-lg mt-3 text-white">
                                <span className="text-xs font-extrabold uppercase tracking-wide opacity-90">Tiền thừa thối khách:</span>
                                <span className="text-2xl font-black font-mono tracking-tight">{formatPrice(changeAmount)}</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ) : paymentMethod === 'split' ? (
                      // KẾT HỢP
                      <motion.div
                        key="split-panel"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wider">
                            Số Tiền Khách Trả Bằng Tiền Mặt (VNĐ)
                          </label>
                          <input 
                            ref={cashInputRef}
                            type="text" 
                            required
                            value={cashReceived}
                            onChange={handleCashChange}
                            onBlur={() => {
                              const num = parseInt(cashReceived.replace(/,/g, ''), 10) || 0;
                              if (num > 0 && num < 1000) {
                                setCashReceived(new Intl.NumberFormat('en-US').format(num * 1000));
                              }
                            }}
                            className="w-full px-4 py-3 bg-indigo-50/50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-2xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all font-mono shadow-inner"
                            placeholder="Nhập số tiền mặt..."
                          />
                        </div>

                        {/* Quick money shortcuts list */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {quickMoneyOptions.map((opt, idx) => (
                            <motion.button
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.95 }}
                              key={idx}
                              type="button"
                              onClick={() => handleQuickCash(opt.value)}
                              className="flex-1 min-w-[90px] px-2 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              {opt.label}
                            </motion.button>
                          ))}
                        </div>

                        <AnimatePresence>
                          {Math.max(0, finalAmount - (cleanCashReceived ? parseFloat(cleanCashReceived) : 0)) > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0, scale: 0.95 }}
                              animate={{ opacity: 1, height: 'auto', scale: 1 }}
                              exit={{ opacity: 0, height: 0, scale: 0.95 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden mt-3"
                            >
                              <div className="bg-white p-3.5 rounded-3xl shadow-md border border-slate-200/50 dark:border-slate-800/50 flex gap-4 items-center justify-between">
                                <div className="text-left pl-2">
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cần chuyển khoản thêm:</span>
                                  <div className="text-2xl font-black text-indigo-600 font-mono">
                                    {formatPrice(finalAmount - (cleanCashReceived ? parseFloat(cleanCashReceived) : 0))}
                                  </div>
                                </div>
                                {qrUrl ? (
                                  <img src={qrUrl} alt="Mã VietQR" className="w-24 h-24 object-contain rounded-xl cursor-pointer" onClick={() => setShowFullQR(true)} />
                                ) : (
                                  <div className="w-24 h-24 bg-slate-100 rounded-xl animate-pulse"></div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ) : (
                      // CHUYỂN KHOẢN QR
                      <motion.div
                        key="qr-panel"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-col items-center gap-4 py-2 min-h-[300px]"
                      >
                        {/* QR Code Scannable Container */}
                        <motion.div 
                          className="bg-white p-3.5 rounded-3xl shadow-xl border border-slate-200/50 dark:border-slate-800/50 relative cursor-pointer min-h-[252px] min-w-[252px] flex items-center justify-center"
                          whileHover={{ scale: 1.1, zIndex: 50, y: -5 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                          onClick={() => { if (qrUrl) setShowFullQR(true); }}
                        >
                          {qrUrl ? (
                            <div className="relative group">
                              <img src={qrUrl} alt="Mã VietQR" className="w-56 h-56 object-contain rounded-2xl transition-opacity" />
                              <div className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] font-bold bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded-full shadow-sm backdrop-blur-sm uppercase tracking-wider">Bấm để phóng to ra giữa màn hình</span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-56 h-56 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-2xl"></div>
                          )}
                          
                          {/* Warning if Bank is not configured */}
                          {(!bankInfo?.acc || bankInfo?.acc === '000000000') && (
                            <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 rounded-3xl">
                              <AlertTriangle className="text-rose-500 mb-2" size={24} />
                              <p className="text-rose-600 dark:text-rose-400 font-bold mb-1">Chưa Cài Đặt VietQR</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Nhân viên cần truy cập mục <strong>Cài Đặt</strong> để nhập số tài khoản ngân hàng thụ hưởng trước.</p>
                            </div>
                          )}
                        </motion.div>
 
                        {/* Beneficiary account info removed as requested */}
                        
                        {sepayApiKey && orderCode && (
                          <div className="mt-4 flex items-center justify-center gap-2 bg-emerald-100 dark:bg-emerald-500/20 py-2 px-4 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              {pollingStatus || 'Hệ thống đang chờ nhận tiền tự động...'}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
            </div>
 
            {/* Bottom Actions inside the right side */}
            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-end gap-3 flex-shrink-0">
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.2)' }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={handleSubmit}
                className={`flex-1 px-6 py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  isCredit 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/30'
                    : paymentMethod === 'split'
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-indigo-500/30'
                      : paymentMethod === 'vietqr'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/30'
                        : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/30'
                }`}
              >
                <CheckCircle2 size={18} strokeWidth={2.5} />
                {isCredit ? 'Xác Nhận Ghi Nợ' : (paymentMethod === 'vietqr' || paymentMethod === 'split') ? 'Xác Nhận Đã Nhận Tiền' : 'Hoàn Tất Thanh Toán'}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Fullscreen QR Code Overlay */}
      <AnimatePresence>
        {showFullQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
            onClick={() => setShowFullQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-lg w-full text-center relative flex flex-col items-center border border-slate-200/50 dark:border-slate-800/50"
              onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to backdrop
            >
              <button
                onClick={() => setShowFullQR(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors focus:outline-none"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-xl font-black text-sky-600 dark:text-sky-400 mb-6 flex items-center gap-2">
                <QrCode size={24} /> Quét Mã Thanh Toán
              </h3>
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 mb-6">
                <img src={qrUrl} alt="Mã VietQR Phóng To" className="w-80 h-80 object-contain rounded-2xl" />
              </div>

              {bankInfo?.name && (
                <div className="w-full bg-sky-50 dark:bg-sky-900/20 py-4 px-6 rounded-2xl border border-sky-100 dark:border-sky-800/30">
                  <p className="font-semibold text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tài khoản thụ hưởng</p>
                  <p className="font-black text-lg text-slate-800 dark:text-slate-100">{bankInfo.name}</p>
                  <p className="text-base text-sky-600 dark:text-sky-400 font-mono font-bold mt-0.5">{bankInfo.acc}</p>
                  <p className="mt-4 text-sm font-bold text-slate-800 dark:text-slate-200">
                    Số tiền: <span className="text-xl text-rose-500 dark:text-rose-400 font-black">{formatPrice(finalAmount)}</span>
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
