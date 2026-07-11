import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { PackagePlus, X } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function AddProductModal({ barcode = '', onClose, onSaved, isManual = false, productToEdit = null }) {
  const [barcodeVal, setBarcodeVal] = useState(productToEdit ? productToEdit.barcode : (barcode || ''));
  const [price, setPrice] = useState(productToEdit ? (productToEdit.price || '').toString() : '');
  const [creditPrice, setCreditPrice] = useState(productToEdit ? (productToEdit.creditPrice || '').toString() : '');
  const [stock, setStock] = useState(productToEdit ? (productToEdit.stock || '0').toString() : '10');
  const [lowStockAlert, setLowStockAlert] = useState(productToEdit ? (productToEdit.lowStockAlert !== undefined ? productToEdit.lowStockAlert : '5').toString() : '5');
  const [taxRate, setTaxRate] = useState(productToEdit ? (productToEdit.taxRate === undefined ? '-1' : productToEdit.taxRate.toString()) : '-1');

  // Mid-tier state (Lốc, Vỉ)
  const [hasMidUnit, setHasMidUnit] = useState(productToEdit ? !!productToEdit.midUnit : false);
  const midUnitRef = useRef(null);
  const [midConversionRate, setMidConversionRate] = useState(productToEdit ? (productToEdit.midConversionRate || '6').toString() : '6');
  const [midPrice, setMidPrice] = useState(productToEdit ? (productToEdit.midPrice || '').toString() : '');
  const [midCreditPrice, setMidCreditPrice] = useState(productToEdit ? (productToEdit.midCreditPrice || '').toString() : '');

  // Wholesale state
  const [hasWholesale, setHasWholesale] = useState(productToEdit ? !!productToEdit.wholesaleUnit : false);
  const wholesaleUnitRef = useRef(null);
  const [wholesaleConversionRate, setWholesaleConversionRate] = useState(productToEdit ? (productToEdit.wholesaleConversionRate || '24').toString() : '24');
  const [wholesalePrice, setWholesalePrice] = useState(productToEdit ? (productToEdit.wholesalePrice || '').toString() : '');
  const [wholesaleCreditPrice, setWholesaleCreditPrice] = useState(productToEdit ? (productToEdit.wholesaleCreditPrice || '').toString() : '');

  // Quantity Discounts state
  const [hasQuantityDiscounts, setHasQuantityDiscounts] = useState(productToEdit ? !!(productToEdit.quantityDiscounts && productToEdit.quantityDiscounts.length > 0) : false);
  const [quantityDiscounts, setQuantityDiscounts] = useState(productToEdit?.quantityDiscounts || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addDiscountTier = () => {
    setQuantityDiscounts(prev => [...prev, { minQty: 5, discountAmount: 2000 }]);
  };

  const removeDiscountTier = (index) => {
    setQuantityDiscounts(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateDiscountTier = (index, field, value) => {
    setQuantityDiscounts(prev => prev.map((tier, idx) => {
      if (idx === index) {
        if (field === 'minQty') {
          return { ...tier, minQty: value };
        } else if (field === 'discountAmount') {
          return { ...tier, discountAmount: value }; // Keep as string for formatting while editing
        }
      }
      return tier;
    }));
  };

  const nameInputRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const unitInputRef = useRef(null);
  const priceInputRef = useRef(null);
  const submitBtnRef = useRef(null);

  const formatDisplayPrice = (val) => {
    if (!val) return '';
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const handlePriceChange = (setter) => (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let clean = raw ? parseInt(raw, 10).toString() : '';
    if (clean && parseInt(clean, 10) > 10000000) {
      clean = '10000000';
    }
    setter(clean);
  };

  const handlePriceBlur = (getter, setter) => () => {
    if (!getter) return;
    const clean = getter.toString().replace(/[^0-9]/g, '');
    let val = parseInt(clean, 10);
    if (!isNaN(val) && val > 0 && val < 1000) {
      val = val * 1000;
      setter(val.toString());
    }
  };

  useEffect(() => {
    if (isManual && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    } else if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isManual]);

  // Accessibility (A11y): Close modal on ESC keydown
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const finalName = nameInputRef.current?.value?.trim();
    const finalUnit = unitInputRef.current?.value?.trim() || 'cái';
    
    if (!finalName || !price) {
      toast.error("Vui lòng điền tên và giá bán!");
      return;
    }

    let finalBarcode = barcodeVal.trim();
    if (!finalBarcode) {
      finalBarcode = 'SP-' + Math.floor(Date.now() / 1000) + Math.floor(100 + Math.random() * 900);
    }

    const finalQuantityDiscounts = hasQuantityDiscounts
      ? quantityDiscounts
          .map(tier => ({
            minQty: parseInt(tier.minQty, 10) || 0,
            discountAmount: parseInt(tier.discountAmount, 10) || 0
          }))
          .filter(tier => tier.minQty > 0 && tier.discountAmount > 0)
      : [];

    const productData = {
      barcode: finalBarcode,
      name: finalName,
      price: parseInt(price, 10) || 0,
      stock: parseFloat(stock) || 0,
      unit: finalUnit,
      lowStockAlert: parseFloat(lowStockAlert) || 5,
      creditPrice: creditPrice ? parseInt(creditPrice, 10) : undefined,
      taxRate: taxRate === '-1' ? -1 : (parseFloat(taxRate) || 0),
      quantityDiscounts: finalQuantityDiscounts
    };

    if (hasMidUnit) {
      productData.midUnit = midUnitRef.current?.value?.trim() || 'lốc';
      productData.midConversionRate = parseFloat(midConversionRate) || 1;
      productData.midPrice = midPrice ? parseInt(midPrice, 10) : undefined;
      productData.midCreditPrice = midCreditPrice ? parseInt(midCreditPrice, 10) : undefined;
    } else {
      productData.midUnit = undefined;
      productData.midConversionRate = undefined;
      productData.midPrice = undefined;
      productData.midCreditPrice = undefined;
    }

    if (hasWholesale) {
      productData.wholesaleUnit = wholesaleUnitRef.current?.value?.trim() || 'thùng';
      productData.wholesaleConversionRate = parseFloat(wholesaleConversionRate) || 1;
      productData.wholesalePrice = wholesalePrice ? parseInt(wholesalePrice, 10) : undefined;
      productData.wholesaleCreditPrice = wholesaleCreditPrice ? parseInt(wholesaleCreditPrice, 10) : undefined;
    } else {
      productData.wholesaleUnit = undefined;
      productData.wholesaleConversionRate = undefined;
      productData.wholesalePrice = undefined;
      productData.wholesaleCreditPrice = undefined;
    }

    try {
      if (productToEdit) {
        productData.id = productToEdit.id;
        await db.products.put(productData);
        toast.success("Cập nhật sản phẩm thành công!");
        if (onSaved) {
          onSaved(productData);
        } else {
          onClose();
        }
      } else {
        const generatedId = await db.products.add(productData);
        productData.id = generatedId;
        toast.success("Thêm sản phẩm thành công!");
        if (onSaved) {
          onSaved(productData);
        } else {
          onClose();
        }
      }
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Lỗi khi lưu sản phẩm.");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-slate-50 dark:bg-slate-900 rounded-[2rem] w-full max-w-5xl flex flex-col shadow-2xl transition-colors duration-200 border border-white/20 max-h-[95vh]"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/50 flex-shrink-0 rounded-t-[2rem]">
          <h3 id="modal-title" className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5 text-lg">
            <div className="bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 p-2 rounded-xl shadow-inner">
              <PackagePlus size={20} strokeWidth={2.5} />
            </div>
            {productToEdit ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
          </h3>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 p-2 rounded-full transition-colors focus:outline-none"
            aria-label="Đóng hộp thoại"
          >
            <X size={20} strokeWidth={2.5} />
          </motion.button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-y-auto no-scrollbar pb-2">

            {/* CỘT TRÁI: THÔNG TIN CƠ BẢN & BÁN LẺ */}
            <div className="flex flex-col gap-5">

              <div className="bg-white dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-5 relative">
                    <label htmlFor="ap_barcode" className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                      Mã Vạch {isManual && <span className="lowercase normal-case font-normal">(Trống tự sinh)</span>}
                    </label>
                    <input
                      id="ap_barcode"
                      type="text"
                      ref={barcodeInputRef}
                      value={barcodeVal}
                      onChange={(e) => setBarcodeVal(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && nameInputRef.current?.focus()}
                      readOnly={!isManual && !productToEdit}
                      className={`w-full px-3 py-2.5 rounded-xl font-mono text-sm focus:outline-none transition-all ${(!isManual && !productToEdit)
                        ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed border border-transparent'
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                        }`}
                      placeholder={isManual ? "VD: 893..." : ""}
                    />
                  </div>
                  <div className="col-span-7">
                    <label htmlFor="ap_name" className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Tên Sản Phẩm *</label>
                    <input
                      id="ap_name"
                      type="text"
                      ref={nameInputRef}
                      required
                      defaultValue={productToEdit ? productToEdit.name : ""}
                      onChange={(e) => isSubmitting && !e.target.value && setIsSubmitting(false)}
                      onKeyDown={(e) => e.key === 'Enter' && unitInputRef.current?.focus()}
                      className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none transition-all ${isSubmitting && !nameInputRef.current?.value ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'}`}
                      placeholder="Nhập tên sản phẩm..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm relative">
                <h4 className="absolute -top-3 left-4 px-2 bg-white dark:bg-slate-900 text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5 border border-slate-100 dark:border-slate-700 rounded-full">
                  <span className="w-4 h-4 bg-sky-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center">1</span> Thông Tin Bán Lẻ
                </h4>
                <div className="grid grid-cols-12 gap-4 mt-2">
                  <div className="col-span-4">
                    <label htmlFor="ap_unit" className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Đơn Vị *</label>
                    <input
                      id="ap_unit"
                      type="text"
                      ref={unitInputRef}
                      required
                      defaultValue={productToEdit ? productToEdit.unit : "cái"}
                      onKeyDown={(e) => e.key === 'Enter' && priceInputRef.current?.focus()}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                      placeholder="Lon, Gói..."
                    />
                  </div>
                  <div className="col-span-4 relative">
                    <label htmlFor="ap_price" className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Giá Bán *</label>
                    <input
                      id="ap_price"
                      type="text"
                      ref={priceInputRef}
                      required
                      value={formatDisplayPrice(price)}
                      onChange={handlePriceChange(setPrice)}
                      onBlur={handlePriceBlur(price, setPrice)}
                      onKeyDown={(e) => e.key === 'Enter' && submitBtnRef.current?.focus()}
                      className={`w-full px-3 py-2.5 bg-sky-50/50 dark:bg-slate-900 border rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none transition-all font-bold text-sky-600 dark:text-sky-400 ${isSubmitting && !price ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'}`}
                      placeholder="VD: 10,000"
                    />
                  </div>
                  <div className="col-span-4 relative">
                    <label htmlFor="ap_credit" className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Giá Nợ</label>
                    <input
                      id="ap_credit"
                      type="text"
                      value={formatDisplayPrice(creditPrice)}
                      onChange={handlePriceChange(setCreditPrice)}
                      onBlur={handlePriceBlur(creditPrice, setCreditPrice)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 transition-all"
                      placeholder="Để trống=Giá bán"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="ap_stock" className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Tồn Kho</label>
                    <input
                      id="ap_stock"
                      type="text"
                      value={stock}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        const clean = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                        setStock(clean);
                      }}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="ap_low_stock" className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Báo Hết</label>
                    <input
                      id="ap_low_stock"
                      type="text"
                      value={lowStockAlert}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setLowStockAlert(val ? parseInt(val, 10).toString() : '');
                      }}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="ap_tax_rate" className="block text-xs font-bold text-rose-400 mb-2 uppercase tracking-wider">Thuế VAT (%)</label>
                    <select
                      id="ap_tax_rate"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all font-semibold"
                    >
                      <option value="-1">Mặc định</option>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="8">8%</option>
                      <option value="10">10%</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: CẤU HÌNH LỐC & SỈ */}
            <div className="flex flex-col gap-5">

              <div className={`p-5 rounded-2xl border transition-all duration-300 relative ${hasMidUnit ? 'bg-sky-50/30 dark:bg-sky-900/10 border-sky-200 dark:border-sky-800/50 shadow-sm' : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50'}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Cấu Hình Cấp Giữa (Lốc / Vỉ)
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={hasMidUnit}
                      onChange={(e) => setHasMidUnit(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-sky-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all shadow-inner"></div>
                  </label>
                </div>

                {hasMidUnit && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-12 gap-4 mt-5"
                  >
                    <div className="col-span-4">
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Đơn Vị Lốc</label>
                      <input
                        type="text"
                        ref={midUnitRef}
                        defaultValue={productToEdit ? productToEdit.midUnit : "lốc"}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                        placeholder="VD: Lốc, Vỉ..."
                      />
                    </div>
                    <div className="col-span-8">
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Quy Đổi</label>
                      <input
                        type="text"
                        value={midConversionRate}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setMidConversionRate(val ? parseInt(val, 10).toString() : '');
                        }}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                        placeholder="1 Lốc = ? Lẻ"
                      />
                    </div>
                    <div className="col-span-6 relative">
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Giá Lốc</label>
                      <input
                        type="text"
                        value={formatDisplayPrice(midPrice)}
                        onChange={handlePriceChange(setMidPrice)}
                        onBlur={handlePriceBlur(midPrice, setMidPrice)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                        placeholder="VD: 60,000"
                      />
                    </div>
                    <div className="col-span-6 relative">
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Giá Lốc Nợ</label>
                      <input
                        type="text"
                        value={formatDisplayPrice(midCreditPrice)}
                        onChange={handlePriceChange(setMidCreditPrice)}
                        onBlur={handlePriceBlur(midCreditPrice, setMidCreditPrice)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                        placeholder="Trống = Giá Lốc"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              <div className={`p-5 rounded-2xl border transition-all duration-300 relative ${hasWholesale ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50 shadow-sm' : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50'}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                    Cấu Hình Bán Sỉ / Thùng
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={hasWholesale}
                      onChange={(e) => setHasWholesale(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all shadow-inner"></div>
                  </label>
                </div>

                {hasWholesale && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-12 gap-4 mt-5"
                  >
                    <div className="col-span-4">
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Đơn Vị Sỉ</label>
                      <input
                        type="text"
                        ref={wholesaleUnitRef}
                        defaultValue={productToEdit ? productToEdit.wholesaleUnit : "thùng"}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                        placeholder="VD: Thùng, Hộp..."
                      />
                    </div>
                    <div className="col-span-8">
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Quy Đổi</label>
                      <input
                        type="text"
                        value={wholesaleConversionRate}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setWholesaleConversionRate(val ? parseInt(val, 10).toString() : '');
                        }}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="1 Sỉ = ? Lẻ"
                      />
                    </div>
                    <div className="col-span-6 relative">
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Giá Sỉ</label>
                      <input
                        type="text"
                        value={formatDisplayPrice(wholesalePrice)}
                        onChange={handlePriceChange(setWholesalePrice)}
                        onBlur={handlePriceBlur(wholesalePrice, setWholesalePrice)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="VD: 220,000"
                      />
                    </div>
                    <div className="col-span-6 relative">
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Giá Sỉ Nợ</label>
                      <input
                        type="text"
                        value={formatDisplayPrice(wholesaleCreditPrice)}
                        onChange={handlePriceChange(setWholesaleCreditPrice)}
                        onBlur={handlePriceBlur(wholesaleCreditPrice, setWholesaleCreditPrice)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="Trống = Giá Sỉ"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Cấu hình Chiết khấu số lượng */}
              <div className={`p-5 rounded-2xl border transition-all duration-300 relative mt-5 ${hasQuantityDiscounts ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50 shadow-sm' : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50'}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-450 w-6 h-6 rounded-full flex items-center justify-center text-xs">%</span>
                    Chiết Khấu Theo Số Lượng
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={hasQuantityDiscounts}
                      onChange={(e) => setHasQuantityDiscounts(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all shadow-inner"></div>
                  </label>
                </div>

                {hasQuantityDiscounts && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 space-y-4"
                  >
                    {quantityDiscounts.map((tier, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase">Mua tối thiểu</label>
                          <input
                            type="text"
                            value={tier.minQty ? new Intl.NumberFormat('en-US').format(tier.minQty) : ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              if (!val) {
                                updateDiscountTier(idx, 'minQty', '');
                                return;
                              }
                              updateDiscountTier(idx, 'minQty', parseInt(val, 10));
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none text-slate-800 dark:text-slate-100"
                            placeholder="VD: 5"
                          />
                        </div>
                        <div className="flex-1 relative">
                          <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase">Mức giảm (đ/cái)</label>
                          <input
                            type="text"
                            value={tier.discountAmount ? new Intl.NumberFormat('vi-VN').format(tier.discountAmount) : ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              if (!val) {
                                updateDiscountTier(idx, 'discountAmount', '');
                                return;
                              }
                              let num = parseInt(val, 10);
                              if (num > 10000000) num = 10000000;
                              updateDiscountTier(idx, 'discountAmount', num);
                            }}
                            onBlur={() => {
                              if (tier.discountAmount > 0 && tier.discountAmount < 1000) {
                                updateDiscountTier(idx, 'discountAmount', tier.discountAmount * 1000);
                              }
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none text-sky-600 dark:text-sky-400"
                            placeholder="VD: 2,000"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDiscountTier(idx)}
                          className="mt-4 p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addDiscountTier}
                      className="w-full py-2.5 border border-dashed border-emerald-500/30 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-500/5 text-xs font-bold rounded-xl transition-colors"
                    >
                      + Thêm mức chiết khấu
                    </button>
                  </motion.div>
                )}
              </div>

            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-5 mt-2 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 font-bold rounded-xl text-sm transition-all focus:outline-none"
            >
              Hủy
            </motion.button>
            <motion.button
              ref={submitBtnRef}
              whileTap={{ scale: 0.97 }}
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-xl text-sm shadow-[0_4px_12px_rgba(14,165,233,0.25)] transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {productToEdit ? 'Lưu Thay Đổi' : 'Lưu & Bán Ngay'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
