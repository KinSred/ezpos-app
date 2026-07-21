import React, { useState, useEffect } from 'react';
import ScannerColumn from './components/ScannerColumn';
import CartColumn from './components/CartColumn';
import AddProductModal from '../inventory/components/AddProductModal';
import CheckoutConfirmationModal from './components/CheckoutConfirmationModal';
import DuplicateBarcodeModal from '../inventory/components/DuplicateBarcodeModal';
import CheckoutSuccessModal from './components/CheckoutSuccessModal';
import PrintableReceipt from './components/PrintableReceipt';
import { db } from '../../db';
import toast from 'react-hot-toast';
import { autoSaveToLocalStorage, syncToCloud } from '../../utils/backup';
import { silentPrint } from '../../utils/silentPrint';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../contexts/AuthContext';

export default function POSScreen({ isActive = true }) {
  const { currentUser, currentShift } = useAuth();
  const [cartTabs, setCartTabs] = useState(() => {
    try {
      const saved = localStorage.getItem(`pos_cart_tabs_retail`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          return parsed.map(tab => ({
            ...tab,
            cartItems: tab.cartItems.map(item => ({
              ...item,
              uiKey: item.uiKey || (Date.now() + Math.random())
            }))
          }));
        }
      }
      // Migrate old data if present
      const oldCart = localStorage.getItem(`pos_cart_retail`);
      const oldCustomer = localStorage.getItem(`pos_customer_retail`);
      const oldDiscount = localStorage.getItem(`pos_discount_retail`);
      const oldDiscountType = localStorage.getItem(`pos_discountType_retail`);
      if (oldCart || oldCustomer) {
        return [{
          id: Date.now(),
          name: 'Đơn 1',
          items: oldCart ? JSON.parse(oldCart) : [],
          customer: oldCustomer ? JSON.parse(oldCustomer) : null,
          discount: oldDiscount ? JSON.parse(oldDiscount) : 0,
          discountType: oldDiscountType ? JSON.parse(oldDiscountType) : 'percent',
          surcharge: 0,
          isCredit: false
        }];
      }
    } catch (e) { console.error('Lỗi đọc cart tabs', e); }
    return [{ id: Date.now(), name: 'Đơn 1', items: [], customer: null, discount: 0, discountType: 'percent', surcharge: 0, isCredit: false }];
  });

  const [activeTabId, setActiveTabId] = useState(() => cartTabs[0]?.id || Date.now());
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Meta' || e.key === 'Control') {
        setShowShortcuts(e.type === 'keydown');
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  // Derived state from active tab
  const activeTab = cartTabs.find(tab => tab.id === activeTabId) || cartTabs[0];
  const cartItems = activeTab.items || [];
  const customer = activeTab.customer;
  const discount = activeTab.discount || 0;
  const discountType = activeTab.discountType || 'percent';
  const surcharge = activeTab.surcharge || 0;
  const isCredit = activeTab.isCredit ?? false;

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
  const setSurcharge = (amount) => updateActiveTab({ surcharge: typeof amount === 'function' ? amount(activeTab.surcharge || 0) : amount });
  const setIsCredit = (credit) => updateActiveTab({ isCredit: credit });
  const setPointsUsed = (points) => updateActiveTab({ pointsUsed: points });
  const pointsUsed = activeTab.pointsUsed || 0;
  
  const handleAddTab = () => {
    const newId = Date.now();
    let newName = `Đơn ${cartTabs.length + 1}`;
    const newTab = { id: newId, name: newName, items: [], customer: null, discount: 0, discountType: 'percent', surcharge: 0, isCredit: false, pointsUsed: 0 };
    setCartTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleRemoveTab = (id) => {
    if (cartTabs.length === 1) {
       // Reset the only tab
       setCartTabs([{ id: Date.now(), name: 'Đơn 1', items: [], customer: null, discount: 0, discountType: 'percent', surcharge: 0, isCredit: false, pointsUsed: 0 }]);
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

  // Global VAT & Settings
  const [globalVatEnabled, setGlobalVatEnabled] = useState(false);
  const [globalVatRate, setGlobalVatRate] = useState(0);
  const [hideStockEnabled, setHideStockEnabled] = useState(false);
  const [pointsEarnRatio, setPointsEarnRatio] = useState(10000);
  const [pointsRedeemRatio, setPointsRedeemRatio] = useState(100);
  const [pointsEnabled, setPointsEnabled] = useState(true);

  // States for modals and UI
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateProducts, setDuplicateProducts] = useState([]);
  const [activePrintOrder, setActivePrintOrder] = useState(null);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(`pos_cart_tabs_retail`, JSON.stringify(cartTabs));
  }, [cartTabs]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const en = await db.settings.get('vatEnabled');
        const rt = await db.settings.get('vatRate');
        const hs = await db.settings.get('hideStock');
        const ptsEn = await db.settings.get('pointsEnabled');
        const earnR = await db.settings.get('pointsEarnRatio');
        const redeemR = await db.settings.get('pointsRedeemRatio');
        setGlobalVatEnabled(en?.value === 'true');
        setGlobalVatRate(rt ? parseFloat(rt.value) : 0);
        setHideStockEnabled(hs?.value === 'true');
        setPointsEnabled(ptsEn?.value !== 'false');
        if (earnR) setPointsEarnRatio(parseFloat(earnR.value) || 10000);
        if (redeemR) setPointsRedeemRatio(parseFloat(redeemR.value) || 100);
      } catch (err) {
        console.error('Failed to load settings', err);
      }
    };
    fetchSettings();
  }, []);

  // Global Enter key & Shortcuts listener for Checkout
  useEffect(() => {
    let barcodeBuffer = '';

    const handleGlobalKeyDown = (e) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // F1 : Focus scanner search
      if (e.key === 'F1' || (isCmdOrCtrl && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'p'))) {
        if (showConfirmModal) return; 
        e.preventDefault();
        document.getElementById('scanner-search-input')?.focus();
        return;
      }

      // F2 : Search customer / Focus customer
      if (e.key === 'F2' || (isCmdOrCtrl && e.key.toLowerCase() === 'u')) {
        e.preventDefault();
        if (!showConfirmModal && cartItems.length > 0) {
          setShowConfirmModal(true);
          setTimeout(() => document.getElementById('customer-search-input')?.focus(), 100);
        } else {
          document.getElementById('customer-search-input')?.focus();
        }
        return;
      }

      // F3 : Add Tab
      if (e.key === 'F3' || (isCmdOrCtrl && e.key.toLowerCase() === 't')) {
        e.preventDefault();
        handleAddTab();
        return;
      }
      
      // F4 : Switch Tab
      if (e.key === 'F4' || (isCmdOrCtrl && (e.key === '[' || e.key === ']'))) {
        e.preventDefault();
        if (cartTabs && cartTabs.length > 1) {
          const currentIndex = cartTabs.findIndex(t => t.id === activeTabId);
          let nextIndex;
          if (isCmdOrCtrl && e.key === '[') {
            nextIndex = currentIndex - 1 < 0 ? cartTabs.length - 1 : currentIndex - 1;
          } else {
            nextIndex = (currentIndex + 1) % cartTabs.length;
          }
          setActiveTabId(cartTabs[nextIndex].id);
        }
        return;
      }

      // F8/F9 or Cmd+Enter : Checkout explicitly
      if (e.key === 'F8' || e.key === 'F9' || (isCmdOrCtrl && e.key === 'Enter')) {
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

      // Handle Arrow Up/Down globally if not in an input
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (cartItems.length > 0) {
            const firstItem = cartItems[0];
            const diff = e.key === 'ArrowUp' ? 1 : -1;
            updateCartItemQty(firstItem.cartId, diff);
          }
          return;
        }
      }

      // Handle Arrow Left/Right to switch units for the first item
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (cartItems.length > 0) {
            const firstItem = cartItems[0];
            const currentMode = firstItem.sellMode || (firstItem.isWholesale ? 'wholesale' : 'base');
            
            const availableModes = ['base'];
            if (firstItem.midUnit) availableModes.push('mid');
            if (firstItem.wholesaleUnit) availableModes.push('wholesale');
            
            if (availableModes.length > 1) {
              const currentIndex = availableModes.indexOf(currentMode);
              let nextIndex;
              if (e.key === 'ArrowRight') {
                nextIndex = (currentIndex + 1) % availableModes.length;
              } else {
                nextIndex = (currentIndex - 1 + availableModes.length) % availableModes.length;
              }
              updateCartItemSellMode(firstItem.cartId, availableModes[nextIndex]);
            }
          }
          return;
        }
      }

      // Ignore text typing if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key !== 'Enter' && e.key.length === 1 && !isCmdOrCtrl) {
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
      const sellMode = 'base';
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

  const updateCartItemSellMode = (oldCartId, newSellMode) => {
    setCartItems(prev => {
      const oldItemIndex = prev.findIndex(item => item.cartId === oldCartId);
      if (oldItemIndex === -1) return prev;
      
      const oldItem = prev[oldItemIndex];
      const newCartId = `${oldItem.id}-${newSellMode}`;
      
      if (oldCartId === newCartId) return prev;
      
      const existingNewItemIndex = prev.findIndex(item => item.cartId === newCartId);
      
      if (existingNewItemIndex !== -1) {
        const newArray = [...prev];
        const existingNewItem = newArray[existingNewItemIndex];
        const currentQty = parseFloat(existingNewItem.qty) || 0;
        const addQty = parseFloat(oldItem.qty) || 0;
        
        newArray[existingNewItemIndex] = {
          ...existingNewItem,
          qty: currentQty + addQty
        };
        newArray.splice(oldItemIndex, 1);
        return newArray;
      } else {
        const newArray = [...prev];
        newArray[oldItemIndex] = {
          ...oldItem,
          sellMode: newSellMode,
          cartId: newCartId
        };
        return newArray;
      }
    });
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
    const sellMode = item.sellMode || (item.isWholesale ? 'wholesale' : 'base');
    const isWholesale = sellMode === 'wholesale';
    const isMid = sellMode === 'mid';
    
    let basePrice = item.price;
    if (isCredit) {
      basePrice = isWholesale ? (item.wholesaleCreditPrice || item.wholesalePrice || item.price) 
                 : isMid ? (item.midCreditPrice || item.midPrice || item.price) 
                 : (item.creditPrice || item.price);
    } else {
      basePrice = isWholesale ? (item.wholesalePrice || item.price) 
                 : isMid ? (item.midPrice || item.price) 
                 : item.price;
    }
    
    if (isCredit && customer && customer.specialPrices && customer.specialPrices[item.id] && customer.specialPrices[item.id][sellMode] !== undefined) {
      basePrice = customer.specialPrices[item.id][sellMode];
    } else if (item.quantityDiscounts && item.quantityDiscounts.length > 0) {
      const quantity = parseFloat(item.qty) || 0;
      const applicableDiscount = [...item.quantityDiscounts]
        .sort((a, b) => b.quantity - a.quantity)
        .find(d => quantity >= d.quantity);
      if (applicableDiscount && applicableDiscount.price < basePrice) {
        basePrice = applicableDiscount.price;
      }
    }

    // Apply manual custom discount if set
    if (item.customDiscount !== undefined && item.customDiscount > 0) {
      basePrice = Math.max(0, basePrice - item.customDiscount);
    } else if (item.quantityDiscounts && item.quantityDiscounts.length > 0) {
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
  const pointsDiscountAmount = pointsUsed * pointsRedeemRatio;
  const discountAmount = discountType === 'amount' 
    ? Math.min(totalAmount, discount) 
    : (totalAmount * discount) / 100;
  
  // Total discount includes both regular discount and points discount
  const totalDiscount = Math.min(totalAmount, discountAmount + pointsDiscountAmount);
  
  const discountFactor = totalAmount > 0 ? (totalAmount - totalDiscount) / totalAmount : 1;
  
  const getEffectiveTaxRate = (item) => {
    if (!globalVatEnabled) return 0;
    if (item.taxRate !== undefined && item.taxRate !== null && item.taxRate !== -1) {
      return item.taxRate;
    }
    return globalVatRate;
  };

  const totalTaxAmount = cartItems.reduce((sum, item) => sum + Math.round((getAppliedPrice(item) * (item.qty || 0) * discountFactor) * getEffectiveTaxRate(item) / 100), 0);
  const finalAmount = Math.max(0, totalAmount - totalDiscount) + totalTaxAmount + surcharge;

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
        surcharge: surcharge,
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
          if (!customDiscount && item.quantityDiscounts && item.quantityDiscounts.length > 0) {
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
        storeId: storeId,
        userId: currentUser?.id,
        shiftId: currentShift?.id
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

      // 3. Update customer (debt & points)
      if (customer) {
        let newDebt = customer.debt || 0;
        let newPoints = customer.points || 0;
        
        if (pointsEnabled) {
          // Deduct used points
          newPoints = Math.max(0, newPoints - pointsUsed);
          
          // Add earned points
          const earnedPoints = Math.floor(finalAmount / pointsEarnRatio);
          newPoints += earnedPoints;
        }

        const updateData = { points: newPoints };

        if (isCredit) {
          newDebt += finalAmount;
          updateData.debt = newDebt;

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
        
        await db.customers.update(customer.phone, updateData);
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
      setSurcharge(0);
      setIsCredit(false);
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
              showShortcuts={showShortcuts}
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
              onUpdateSellMode={updateCartItemSellMode}
              cartTabs={cartTabs}
              activeTabId={activeTabId}
              onAddTab={handleAddTab}
              onRemoveTab={handleRemoveTab}
              onSwitchTab={setActiveTabId}
              showShortcuts={showShortcuts}
              hideStockEnabled={hideStockEnabled}
              pointsUsed={pointsUsed}
              setPointsUsed={setPointsUsed}
              pointsEnabled={pointsEnabled}
              pointsRedeemRatio={pointsRedeemRatio}
              customer={customer}
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
            surcharge={surcharge}
            setSurcharge={setSurcharge}
            pointsUsed={pointsUsed}
            setPointsUsed={setPointsUsed}
            pointsEnabled={pointsEnabled}
            pointsRedeemRatio={pointsRedeemRatio}
            finalAmount={finalAmount}
            customer={customer}
            setCustomer={setCustomer}
            isCredit={isCredit}
            setIsCredit={setIsCredit}
            getAppliedPrice={getAppliedPrice}
            onClose={() => {
              setShowConfirmModal(false);
              setIsCredit(false);
            }}
            onConfirm={handleConfirmCheckout}
            getEffectiveTaxRate={getEffectiveTaxRate}
            totalTaxAmount={totalTaxAmount}
            onRemoveItem={removeCartItem}
            onUpdateCustomPrice={setCartItemCustomDiscount}
            showShortcuts={showShortcuts}
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
