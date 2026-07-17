import React from 'react';
import { Edit2, Plus, AlertTriangle, Printer, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../../../db';
import toast from 'react-hot-toast';

export default function ProductTableRow({ 
  product, 
  hideStockSetting,
  setEditModalConfig, 
  setProductToPrint, 
  setShowPrintLabelModal,
  setProductToEdit,
  handleDelete
}) {

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const isLowStock = (prod) => {
    const alertThreshold = prod.lowStockAlert !== undefined ? prod.lowStockAlert : 5;
    return prod.stock <= alertThreshold;
  };

  const formatStockDisplay = (prod) => {
    let stock = parseInt(prod.stock) || 0;
    if (stock <= 0) return null;
    
    let wRate = parseInt(prod.wholesaleConversionRate);
    let mRate = parseInt(prod.midConversionRate);
    let hasW = prod.wholesaleUnit && !isNaN(wRate) && wRate > 0;
    let hasM = prod.midUnit && !isNaN(mRate) && mRate > 0;
    
    if (!hasW && !hasM) return null;
    
    let result = [];
    let remaining = stock;
    
    if (hasW) {
      let wCount = Math.floor(remaining / wRate);
      if (wCount > 0) {
        result.push(`${wCount} ${prod.wholesaleUnit}`);
        remaining = remaining % wRate;
      }
    }
    
    if (hasM) {
      let mCount = Math.floor(remaining / mRate);
      if (mCount > 0) {
        result.push(`${mCount} ${prod.midUnit}`);
        remaining = remaining % mRate;
      }
    }
    
    if (remaining > 0) {
      result.push(`${remaining} ${prod.unit || 'cái'}`);
    }
    
    if (result.length === 1 && result[0] === `${stock} ${prod.unit || 'cái'}`) {
      return null;
    }
    
    return result.join(' + ');
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

  const handleAddUnit = (prod, type) => {
    setProductToEdit(prod);
  };

  const low = isLowStock(product);

  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors border-b border-slate-100 dark:border-slate-800/40">
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
}
