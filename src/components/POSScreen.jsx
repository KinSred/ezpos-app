import React, { useState, useEffect } from 'react';
import ScannerColumn from './ScannerColumn';
import CartColumn from './CartColumn';
import AddProductModal from './AddProductModal';
import CheckoutConfirmationModal from './CheckoutConfirmationModal';
import DuplicateBarcodeModal from './DuplicateBarcodeModal';
import CheckoutSuccessModal from './CheckoutSuccessModal';
import PrintableReceipt from './PrintableReceipt';
import { db } from '../db';
import toast from 'react-hot-toast';
import { autoSaveToLocalStorage, syncToCloud } from '../utils/backup';
import { silentPrint } from '../utils/silentPrint';
import { useLiveQuery } from 'dexie-react-hooks';

export default function POSScreen({ mode = 'retail', isActive = true }) {
  const [cartTabs, setCartTabs] = useState(() => {
    try {
      const saved = localStorage.getItem(`pos_cart_tabs_${mode}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      }
      // Migrate old data if present
      const oldCart = localStorage.getItem(`pos_cart_${mode}`);
      const oldCustomer = localStorage.getItem(`pos_customer_${mode}`);
      const oldDiscount = localStorage.getItem(`pos_discount_${mode}`);
      const oldDiscountType = localStorage.getItem(`pos_discountType_${mode}`);
      if (oldCart || oldCustomer) {
        return [{
          id: Date.now(),
          name: 'Đơn 1',
          items: oldCart ? JSON.parse(oldCart) : [],
          customer: oldCustomer ? JSON.parse(oldCustomer) : null,
          discount: oldDiscount ? JSON.parse(oldDiscount) : 0,
          discountType: oldDiscountType ? JSON.parse(oldDiscountType) : 'percent',
          isCredit: mode === 'wholesale'
        }];
      }
    } catch (e) { console.error('Lỗi đọc cart tabs', e); }
    return [{ id: Date.now(), name: 'Đơn 1', items: [], customer: null, discount: 0, discountType: 'percent', isCredit: mode === 'wholesale' }];
  });

  const [activeTabId, setActiveTabId] = useState(() => cartTabs[0]?.id || Date.now());

  // Derived state from active tab
  const activeTab = cartTabs.find(tab => tab.id === activeTabId) || cartTabs[0];
  const cartItems = activeTab.items || [];
  const customer = activeTab.customer;
  const discount = activeTab.discount || 0;
  const discountType = activeTab.discountType || 'percent';
  const isCredit = activeTab.isCredit ?? (mode === 'wholesale');

  const updateActiveTab = (updates) => {
    setCartTabs(prev => prev.map(tab => tab.id === activeTabId ? { ...tab, ...updates } : tab));
  };

  const setCartItems = (setter) => {
    setCartTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        const newItems = typeof setter === 'function' ? setter(tab.items || []) : setter;
        return { ...tab, items: newItems };
      }
      return tab;
    }));
  };

  const setCustomer = (cust) => updateActiveTab({ customer: cust });
  const setDiscount = (disc) => updateActiveTab({ discount: typeof disc === 'function' ? disc(activeTab.discount || 0) : disc });
  const setDiscountType = (type) => updateActiveTab({ discountType: type });
  const setIsCredit = (credit) => updateActiveTab({ isCredit: credit });
  
  const handleAddTab = () => {
    const newId = Date.now();
    let newName = `Đơn ${cartTabs.length + 1}`;
    const newTab = { id: newId, name: newName, items: [], customer: null, discount: 0, discountType: 'percent', isCredit: mode === 'wholesale' };
    setCartTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleRemoveTab = (id) => {
    if (cartTabs.length === 1) {
       // Reset the only tab
       setCartTabs([{ id: Date.now(), name: 'Đơn 1', items: [], customer: null, discount: 0, discountType: 'percent', isCredit: mode === 'wholesale' }]);
    } else {
      const newTabs = cartTabs.filter(t => t.id !== id);
      setCartTabs(newTabs);
      if (activeTabId === id) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
    }
  };

  // States for Success checkout modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState(null);

  // Global VAT Settings
  const [globalVatEnabled, setGlobalVatEnabled] = useState(false);
  const [globalVatRate, setGlobalVatRate] = useState(0);

  // States for modals and UI
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateProducts, setDuplicateProducts] = useState([]);
  const [activePrintOrder, setActivePrintOrder] = useState(null);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(`pos_cart_tabs_${mode}`, JSON.stringify(cartTabs));
  }, [cartTabs, mode]);

  useEffect(() => {
    const fetchVat = async () => {
      try {
        const en = await db.settings.get('vatEnabled');
        const rt = await db.settings.get('vatRate');
        setGlobalVatEnabled(en?.value === 'true');
        setGlobalVatRate(rt ? parseFloat(rt.value) : 0);
      } catch (err) {
        console.error('Failed to load VAT settings', err);
      }
    };
    fetchVat();
  }, []);

  // Global Enter key & Shortcuts listener for Checkout
  useEffect(() => {
    let barcodeBuffer = '';

    const handleGlobalKeyDown = (e) => {
      // Shortcuts that should work everywhere (unless input is focused? F-keys don't type text)
      if (e.key === 'F1') {
        e.preventDefault();
        document.getElementById('scanner-search-input')?.focus();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        handleAddTab();
        return;
      }
      
      // Switch Tab: F3
      if (e.key === 'F3') {
        e.preventDefault();
        if (cartTabs && cartTabs.length > 1) {
          const currentIndex = cartTabs.findIndex(t => t.id === activeTabId);
          const nextIndex = (currentIndex + 1) % cartTabs.length;
          setActiveTabId(cartTabs[nextIndex].id);
        }
        return;
      }

      if (e.key === 'F4') {
        e.preventDefault();
        if (!showConfirmModal && cartItems.length > 0) {
          setShowConfirmModal(true);
          // Wait for modal to render then focus
          setTimeout(() => document.getElementById('customer-search-input')?.focus(), 100);
        } else {
          document.getElementById('customer-search-input')?.focus();
        }
        return;
      }
      if (e.key === 'F8' || e.key === 'F9') {
        e.preventDefault();
        if (!showConfirmModal && !showSuccessModal && !showAddProductModal && !showDuplicateModal) {
          if (cartItems.length > 0) {
            setShowConfirmModal(true);
          } else {
            toast.error("Giỏ hàng đang trống!");
          }
        }
        return;
      }

      if (e.key === 'F10') {
        e.preventDefault();
        if (cartItems.length > 0) {
          const allWholesale = cartItems.every(item => item.sellMode === 'wholesale' || (!item.sellMode && item.isWholesale));
          const newMode = allWholesale ? 'base' : 'wholesale';
          const updated = cartItems.map(item => {
             if (item.wholesaleUnit) {
               return { ...item, sellMode: newMode, isWholesale: newMode === 'wholesale' };
             }
             return item;
          });
          updateCartItems(activeTabId, updated);
          toast.success(`Đã chuyển toàn bộ giỏ hàng sang ${newMode === 'wholesale' ? 'GIÁ SỈ' : 'GIÁ LẺ'}`);
        }
        return;
      }

      // Handle Arrow Up/Down globally if not in an input
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          const inputs = document.querySelectorAll('.cart-qty-input');
          if (inputs.length > 0) {
            if (e.key === 'ArrowDown') {
              inputs[0].focus();
            } else {
              inputs[inputs.length - 1].focus();
            }
          }
          return;
        }
      }

      // Ignore text typing if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key !== 'Enter' && e.key.length === 1) {
        barcodeBuffer += e.key;
      }

      // If pressing Enter and no modals are open
      if (e.key === 'Enter') {
        // If it was a fast barcode scan, do NOT trigger checkout!
        if (barcodeBuffer.length >= 4) {
          barcodeBuffer = '';
          return; 
        }

        if (!showConfirmModal && !showSuccessModal && !showAddProductModal && !showDuplicateModal) {
          // If cart has items, proceed to checkout
          if (cartItems.length > 0) {
            e.preventDefault();
            setShowConfirmModal(true);
          }
        }
        barcodeBuffer = '';
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConfirmModal, showSuccessModal, showAddProductModal, showDuplicateModal, cartItems, activeTabId, cartTabs, handleAddTab]);

  // Close checkout modal if cart becomes empty
  useEffect(() => {
    if (cartItems.length === 0 && showConfirmModal) {
      setShowConfirmModal(false);
    }
  }, [cartItems.length, showConfirmModal]);

  // Responsive state for mobile tabs
  const [activeMobileTab, setActiveMobileTab] = useState('scanner'); // 'scanner', 'cart', 'checkout'

  const handleScan = async (barcode) => {
    if (!barcode) return;
    try {
      const matches = await db.products.where('barcode').equals(barcode).toArray();
      if (matches.length === 1) {
        addToCart(matches[0]);
        toast.success(`Đã thêm ${matches[0].name}`, { id: `add-${matches[0].id}` });
        if (window.innerWidth < 1024) setActiveMobileTab('cart');
      } else if (matches.length > 1) {
        setDuplicateProducts(matches);
        setShowDuplicateModal(true);
      } else {
        setScannedBarcode(barcode);
        setShowAddProductModal(true);
      }
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi quét mã.");
    }
  };

  const handleSelectDuplicate = (product) => {
    addToCart(product);
    toast.success(`Đã thêm ${product.name}`, { id: `add-${product.id}` });
    setShowDuplicateModal(false);
    setDuplicateProducts([]);
    if (window.innerWidth < 1024) setActiveMobileTab('cart');
  };

  const handleSelectProduct = (product) => {
    addToCart(product);
    toast.success(`Đã thêm ${product.name}`, { id: `add-${product.id}` });
    if (window.innerWidth < 1024) setActiveMobileTab('cart');
  };

  const addToCart = (product, quantity = 1) => {
    setCartItems(prev => {
      let sellMode = 'base';
      if (mode === 'wholesale') {
        if (product.wholesaleUnit) sellMode = 'wholesale';
        else if (product.midUnit) sellMode = 'mid';
      }
      
      const cartId = `${product.id}-${sellMode}`;
      const existingItem = prev.find(item => item.cartId === cartId);
      
      if (existingItem) {
        return prev.map(item => 
          item.cartId === cartId
            ? { ...item, qty: item.qty + quantity } 
            : item
        );
      }
      return [{ ...product, qty: quantity, sellMode, cartId, uiKey: Date.now() + Math.random() }, ...prev];
    });
  };

  const updateCartItemQty = (cartId, delta) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartId === cartId) {
        const currentQty = parseFloat(item.qty) || 0;
        const newQty = Math.max(0, currentQty + delta);
        return { ...item, qty: newQty === 0 ? 1 : newQty }; // If goes to 0 by button, reset to 1
      }
      return item;
    }));
  };

  const removeCartItem = (cartId) => {
    setCartItems(prev => prev.filter(item => item.cartId !== cartId));
  };

  const setCartItemQty = (cartId, qty) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartId === cartId) {
        let val = String(qty);
        if (val.includes('-')) return item; // reject minus sign
        val = val.replace(/[^0-9.]/g, ''); // only allow numbers and dot
        const parts = val.split('.');
        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
        return { ...item, qty: val };
      }
      return item;
    }));
  };

  const cycleCartItemSellMode = (cartId) => {
    setCartItems(prev => {
      const itemToToggle = prev.find(item => item.cartId === cartId);
      if (!itemToToggle) return prev;

      const currentMode = itemToToggle.sellMode || (itemToToggle.isWholesale ? 'wholesale' : 'base');
      let nextMode = 'base';
      if (currentMode === 'base') {
        nextMode = itemToToggle.midUnit ? 'mid' : (itemToToggle.wholesaleUnit ? 'wholesale' : 'base');
      } else if (currentMode === 'mid') {
        nextMode = itemToToggle.wholesaleUnit ? 'wholesale' : 'base';
      } else if (currentMode === 'wholesale') {
        nextMode = 'base';
      }

      return applyNewSellMode(prev, itemToToggle, cartId, currentMode, nextMode);
    });
  };

  const setCartItemSellMode = (cartId, nextMode) => {
    setCartItems(prev => {
      const itemToToggle = prev.find(item => item.cartId === cartId);
      if (!itemToToggle) return prev;
      const currentMode = itemToToggle.sellMode || (itemToToggle.isWholesale ? 'wholesale' : 'base');
      return applyNewSellMode(prev, itemToToggle, cartId, currentMode, nextMode);
    });
  };

  const applyNewSellMode = (prev, itemToToggle, cartId, currentMode, nextMode) => {
    if (currentMode === nextMode) return prev;

    const newCartId = `${itemToToggle.id}-${nextMode}`;
    const existingTarget = prev.find(item => item.cartId === newCartId);

    if (existingTarget) {
      return prev.map(item => {
        if (item.cartId === newCartId) {
          return { ...item, qty: item.qty + itemToToggle.qty };
        }
        return item;
      }).filter(item => item.cartId !== cartId);
    } else {
      return prev.map(item => {
        if (item.cartId === cartId) {
          return { ...item, sellMode: nextMode, cartId: newCartId };
        }
        return item;
      });
    }
  };

  const clearCart = () => setCartItems([]);

  const handleProductAdded = (newProduct) => {
    addToCart(newProduct);
    toast.success(`Đã lưu và thêm ${newProduct.name}`);
    setShowAddProductModal(false);
    if (window.innerWidth < 1024) setActiveMobileTab('cart');
  };

  const setCartItemCustomDiscount = (cartId, customDiscount) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartId === cartId) {
        return { ...item, customDiscount: customDiscount === '' ? undefined : parseFloat(customDiscount) };
      }
      return item;
    }));
  };

  const getAppliedPrice = (item) => {
    const mode = item.sellMode || (item.isWholesale ? 'wholesale' : 'base');
    let basePrice = item.price;

    // Check if customer has a special price for this product and unit mode (only for credit/debt sales!)
    if (isCredit && customer && customer.specialPrices && customer.specialPrices[item.id] && customer.specialPrices[item.id][mode] !== undefined) {
      basePrice = customer.specialPrices[item.id][mode];
    } else {
      if (isCredit) {
        if (mode === 'wholesale') basePrice = item.wholesaleCreditPrice || item.wholesalePrice || item.price;
        else if (mode === 'mid') basePrice = item.midCreditPrice || item.midPrice || item.price;
        else basePrice = item.creditPrice || item.price;
      } else {
        if (mode === 'wholesale') basePrice = item.wholesalePrice || item.price;
        else if (mode === 'mid') basePrice = item.midPrice || item.price;
        else basePrice = item.price;
      }
    }

    // Apply manual custom discount if set
    if (item.customDiscount !== undefined && item.customDiscount > 0) {
      basePrice = Math.max(0, basePrice - item.customDiscount);
    } else if (mode === 'base' && item.quantityDiscounts && item.quantityDiscounts.length > 0) {
      // Apply quantity discount if we are selling the base unit
      const qty = parseFloat(item.qty) || 0;
      const sortedTiers = [...item.quantityDiscounts].sort((a, b) => b.minQty - a.minQty);
      const matchingTier = sortedTiers.find(tier => qty >= tier.minQty);
      if (matchingTier) {
        basePrice = Math.max(0, basePrice - (matchingTier.discountAmount || 0));
      }
    }
    return basePrice;
  };

  const activePromotions = useLiveQuery(() => db.promotions.toArray())?.filter(p => p.isActive) || [];

  const baseTotalAmount = cartItems.reduce((sum, item) => sum + (getAppliedPrice(item) * (item.qty || 0)), 0);
  
  let promoDiscountAmount = 0;
  activePromotions.forEach(promo => {
    if (promo.type === 'buy_x_get_y') {
      const baseItem = cartItems.find(item => item.id === promo.buyProductId && (!item.sellMode || item.sellMode === 'base'));
      if (baseItem) {
        const setSize = promo.buyQuantity + promo.getQuantity;
        const numberOfSets = Math.floor(baseItem.qty / setSize);
        if (numberOfSets > 0) {
          const freeItems = numberOfSets * promo.getQuantity;
          promoDiscountAmount += freeItems * getAppliedPrice(baseItem);
        }
      }
    }
  });

  const totalAmount = Math.max(0, baseTotalAmount - promoDiscountAmount);
  const discountAmount = discountType === 'amount' 
    ? Math.min(totalAmount, discount) 
    : (totalAmount * discount) / 100;
  const discountFactor = totalAmount > 0 ? (totalAmount - discountAmount) / totalAmount : 1;
  
  const getEffectiveTaxRate = (item) => {
    if (!globalVatEnabled) return 0;
    if (item.taxRate !== undefined && item.taxRate !== null && item.taxRate !== -1) {
      return item.taxRate;
    }
    return globalVatRate;
  };

  const totalTaxAmount = cartItems.reduce((sum, item) => sum + Math.round((getAppliedPrice(item) * (item.qty || 0) * discountFactor) * getEffectiveTaxRate(item) / 100), 0);
  const finalAmount = Math.max(0, totalAmount - discountAmount) + totalTaxAmount;

  const handleConfirmCheckout = (method, receivedAmount, changeAmount, orderDateStr) => {
    // If credit, override method
    const actualMethod = isCredit ? 'credit' : method;
    handleCheckoutSuccess(receivedAmount, changeAmount, actualMethod, orderDateStr);
    setShowConfirmModal(false);
  };

  const handleCheckoutSuccess = async (received, change, method, orderDateStr) => {
    try {
      const storeIdSetting = await db.settings.get('storeId');
      const storeId = storeIdSetting?.value || 'POS-STORE';
      
      const orderTimestamp = orderDateStr ? new Date(orderDateStr).getTime() : Date.now();

      const newOrder = {
        timestamp: orderTimestamp,
        total: finalAmount,
        baseTotal: baseTotalAmount,
        promoDiscount: promoDiscountAmount,
        discount: discountAmount,
        discountPercent: discountType === 'percent' ? discount : 0,
        discountType: discountType,
        totalTax: totalTaxAmount,
        items: cartItems.map(item => {
          const mode = item.sellMode || (item.isWholesale ? 'wholesale' : 'base');
          let appliedUnit = item.unit;
          if (mode === 'wholesale') appliedUnit = item.wholesaleUnit;
          if (mode === 'mid') appliedUnit = item.midUnit;

          // Calculate originalPrice before customDiscount or quantityDiscount
          let originalPrice = item.price;
          if (isCredit) {
            if (mode === 'wholesale') originalPrice = item.wholesaleCreditPrice || item.wholesalePrice || item.price;
            else if (mode === 'mid') originalPrice = item.midCreditPrice || item.midPrice || item.price;
            else originalPrice = item.creditPrice || item.price;
          } else {
            if (mode === 'wholesale') originalPrice = item.wholesalePrice || item.price;
            else if (mode === 'mid') originalPrice = item.midPrice || item.price;
            else originalPrice = item.price;
          }

          const customDiscount = item.customDiscount || 0;
          let quantityDiscount = 0;
          if (!customDiscount && mode === 'base' && item.quantityDiscounts && item.quantityDiscounts.length > 0) {
            const qty = parseFloat(item.qty) || 0;
            const sortedTiers = [...item.quantityDiscounts].sort((a, b) => b.minQty - a.minQty);
            const matchingTier = sortedTiers.find(tier => qty >= tier.minQty);
            if (matchingTier) {
              quantityDiscount = matchingTier.discountAmount || 0;
            }
          }

          return {
            id: item.id,
            barcode: item.barcode,
            name: item.name,
            price: getAppliedPrice(item),
            qty: item.qty || 1,
            unit: appliedUnit,
            sellMode: mode,
            isWholesale: mode === 'wholesale', // legacy
            taxRate: getEffectiveTaxRate(item),
            taxAmount: Math.round((getAppliedPrice(item) * (item.qty || 1) * discountFactor) * getEffectiveTaxRate(item) / 100),
            originalPrice: originalPrice,
            discountAmount: customDiscount || quantityDiscount
          };
        }),
        customerPhone: customer?.phone || '',
        customerName: customer?.name || '',
        customerPreviousDebt: isCredit && customer ? (customer.debt || 0) : undefined,
        customerRemainingDebt: isCredit && customer ? ((customer.debt || 0) + finalAmount) : undefined,
        paymentStatus: isCredit ? 'credit' : 'paid',
        paymentMethod: method,
        cashReceived: isCredit ? 0 : received,
        changeAmount: isCredit ? 0 : change,
        transferAmount: method === 'split' ? Math.max(0, finalAmount - received) : (method === 'vietqr' ? finalAmount : 0),
        storeId: storeId
      };

      // Generate a unique random 6-digit order ID to protect sales volume privacy
      let generatedId;
      let attempts = 0;
      while (attempts < 10) {
        const candidate = Math.floor(100000 + Math.random() * 900000);
        const existing = await db.orders.get(candidate);
        if (!existing) {
          generatedId = candidate;
          break;
        }
        attempts++;
      }
      if (!generatedId) {
        generatedId = Date.now();
      }

      newOrder.id = generatedId;

      // 1. Add order
      await db.orders.add(newOrder);
      const orderId = generatedId;

      // 2. Deduct inventory stocks (only if stock tracking is enabled)
      const hideStockSetting = await db.settings.get('hideStock');
      const isHideStock = hideStockSetting ? hideStockSetting.value === 'true' : false;

      if (!isHideStock) {
        for (const item of cartItems) {
          const prod = await db.products.get(item.id);
          if (prod) {
            const actualQty = item.qty || 1;
            const mode = item.sellMode || (item.isWholesale ? 'wholesale' : 'base');
            let conversion = 1;
            if (mode === 'wholesale') conversion = prod.wholesaleConversionRate || 1;
            if (mode === 'mid') conversion = prod.midConversionRate || 1;

            const deductQty = actualQty * conversion;
            await db.products.update(item.id, {
              stock: Math.max(0, (prod.stock || 0) - deductQty)
            });
          }
        }
      }

      // 3. Update customer (debt)
      if (customer) {
        if (isCredit) {
          const newDebt = (customer.debt || 0) + finalAmount;
          await db.customers.update(customer.phone, { debt: newDebt });

          // Build note listing items for the transaction log
          const itemsSummary = cartItems.map(it => `${it.name} x${it.qty}`).join(', ') || '';

          await db.customerTransactions.add({
            customerPhone: customer.phone,
            timestamp: orderTimestamp,
            type: 'debt',
            amount: finalAmount,
            orderId: orderId,
            note: `Giao hàng ghi nợ${itemsSummary ? ` (${itemsSummary})` : ''}`,
            remainingDebt: newDebt
          });
        }
      }

      toast.success(isCredit ? "Đã ghi nợ thành công!" : "Thanh toán thành công!");

      setLastCompletedOrder(newOrder);
      setShowSuccessModal(true);

      const autoPrintSetting = await db.settings.get('autoPrint');
      if (autoPrintSetting && (autoPrintSetting.value === 'true' || autoPrintSetting.value === true)) {
        setActivePrintOrder(newOrder);
        setTimeout(async () => {
          await silentPrint(newOrder);
          setActivePrintOrder(null);
        }, 300);
      }

      await autoSaveToLocalStorage();
      const syncEnabled = await db.settings.get('cloudSyncEnabled');
      if (syncEnabled?.value === 'true') syncToCloud(storeId);

      clearCart();
      setCustomer(null);
      setDiscount(0);
      setIsCredit(mode === 'wholesale');
      setActiveMobileTab('scanner');
    } catch (error) {
      console.error(error);
      toast.error("Gặp lỗi khi xử lý thanh toán đơn hàng.");
    }
  };

  return (
    <>
      <div className="h-full flex flex-col p-4 lg:p-6 bg-transparent overflow-hidden no-print transition-colors duration-200">
        
        {/* Mobile Tab Control Segmented Bar (hidden on PC) */}
        <div className="flex lg:hidden bg-slate-200/50 dark:bg-slate-900/50 p-1 rounded-2xl mb-4 flex-shrink-0 border border-slate-200/40 dark:border-slate-800/40 shadow-inner">
          <button 
            onClick={() => setActiveMobileTab('scanner')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeMobileTab === 'scanner' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-md' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
          >
            Máy Quét
          </button>
          
          <button 
            onClick={() => setActiveMobileTab('cart')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeMobileTab === 'cart' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-md' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
          >
            Giỏ Hàng
            {cartItems.length > 0 && (
              <span className="bg-sky-500 dark:bg-sky-600 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-black animate-pulse">
                {cartItems.length}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => {
              if (cartItems.length === 0) {
                toast.error("Giỏ hàng đang trống!");
                return;
              }
              setShowConfirmModal(true);
            }}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350"
          >
            Thanh Toán
          </button>
        </div>

        {/* columns container */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
          
          {/* Cột Trái: Scanner */}
          <div className={`${activeMobileTab === 'scanner' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[21.25rem] glass-card rounded-3xl flex-col flex-shrink-0 z-10 overflow-hidden transition-colors duration-500`}>
            <ScannerColumn 
              isActive={isActive}
              onScan={handleScan} 
              onSelectProduct={handleSelectProduct} 
              onAddProduct={() => setShowAddProductModal(true)} 
            />
          </div>

          {/* Cột Giữa: Giỏ Hàng & Checkout Summary */}
          <div className={`${activeMobileTab === 'cart' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col min-w-0 glass-card rounded-3xl overflow-hidden transition-colors duration-500`}>
            <CartColumn 
              items={cartItems} 
              onUpdateQty={updateCartItemQty} 
              onSetQty={setCartItemQty}
              onRemove={removeCartItem} 
              onClear={clearCart}
              onToggleSellMode={cycleCartItemSellMode}
              onSetSellMode={setCartItemSellMode}
              isCredit={isCredit}
              setIsCredit={setIsCredit}
              getAppliedPrice={getAppliedPrice}
              getEffectiveTaxRate={getEffectiveTaxRate}
              totalAmount={totalAmount}
              totalTaxAmount={totalTaxAmount}
              finalAmount={finalAmount}
              discount={discount}
              discountType={discountType}
              onCheckout={() => setShowConfirmModal(true)}
              activePromotions={activePromotions}
              onUpdateCustomPrice={setCartItemCustomDiscount}
              cartTabs={cartTabs}
              activeTabId={activeTabId}
              onAddTab={handleAddTab}
              onRemoveTab={handleRemoveTab}
              onSwitchTab={setActiveTabId}
            />
          </div>
        </div>

        {/* Modals */}
        {showAddProductModal && (
          <AddProductModal 
            barcode={scannedBarcode} 
            isManual={true}
            onClose={() => setShowAddProductModal(false)}
            onSaved={handleProductAdded}
          />
        )}

        {showConfirmModal && (
          <CheckoutConfirmationModal 
            cartItems={cartItems}
            baseTotalAmount={baseTotalAmount}
            promoDiscountAmount={promoDiscountAmount}
            totalAmount={totalAmount}
            discount={discount}
            setDiscount={setDiscount}
            discountType={discountType}
            setDiscountType={setDiscountType}
            finalAmount={finalAmount}
            customer={customer}
            setCustomer={setCustomer}
            isCredit={isCredit}
            setIsCredit={setIsCredit}
            getAppliedPrice={getAppliedPrice}
            onClose={() => setShowConfirmModal(false)}
            onConfirm={handleConfirmCheckout}
            getEffectiveTaxRate={getEffectiveTaxRate}
            totalTaxAmount={totalTaxAmount}
            onRemoveItem={removeCartItem}
            onUpdateCustomPrice={setCartItemCustomDiscount}
            mode={mode}
          />
        )}

        {showDuplicateModal && (
          <DuplicateBarcodeModal 
            products={duplicateProducts}
            onSelect={handleSelectDuplicate}
            onClose={() => {
              setShowDuplicateModal(false);
              setDuplicateProducts([]);
            }}
            onAddNew={() => {
              const bc = duplicateProducts[0]?.barcode || '';
              setShowDuplicateModal(false);
              setDuplicateProducts([]);
              setScannedBarcode(bc);
              setShowAddProductModal(true);
            }}
          />
        )}

        {showSuccessModal && (
          <CheckoutSuccessModal 
            order={lastCompletedOrder}
            onClose={() => {
              setShowSuccessModal(false);
              setLastCompletedOrder(null);
            }}
            onPrint={async (order) => {
              setActivePrintOrder(order);
              setTimeout(async () => {
                await silentPrint(order);
                setActivePrintOrder(null);
              }, 500);
            }}
          />
        )}
      </div>

      <PrintableReceipt order={activePrintOrder} />
    </>
  );
}
