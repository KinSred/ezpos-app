import React, { useState, useEffect, useRef } from 'react';
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
  const checkoutLockRef = useRef(false);
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
  const [cartTabs, setCartTabs] = useState(() => {
    try {
      const saved = localStorage.getItem(`pos_cart_tabs_retail`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          return parsed.map(tab => ({
            ...tab,
            items: (tab.items || tab.cartItems || []).map(item => ({
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

  const setCustomer = (cust) => updateActiveTab({
    customer: cust,
    // Points belong to one customer only. Clear them when the customer is
    // removed or changed so a walk-in sale cannot inherit a prior discount.
    pointsUsed: cust?.phone === customer?.phone ? pointsUsed : 0
  });
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

      // The checkout modal owns its keyboard shortcuts. Do not let the global
      // cart handler change tabs, quantities or units behind that modal.
      if (showConfirmModal || isCheckoutProcessing) return;

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
  }, [showConfirmModal, showSuccessModal, showAddProductModal, showDuplicateModal, isCheckoutProcessing, cartItems, activeTabId, cartTabs, handleAddTab]);

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
        let newQty = Math.max(0, currentQty + delta);
        if (newQty > 9999) newQty = 9999;
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
        
        let numVal = parseFloat(val);
        if (!isNaN(numVal) && numVal > 9999) {
          val = '9999';
        }
        
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
  const discountAmount = discountType === 'amount' 
    ? Math.min(totalAmount, discount) 
    : (totalAmount * discount) / 100;
  const payableBeforePoints = Math.max(0, totalAmount - discountAmount);
  const maxUsefulPoints = Math.ceil(payableBeforePoints / pointsRedeemRatio);
  const appliedPointsUsed = pointsEnabled && customer
    ? Math.min(
        Math.max(0, Math.floor(Number(pointsUsed) || 0)),
        Math.max(0, Number(customer.points) || 0),
        maxUsefulPoints
      )
    : 0;
  const pointsDiscountAmount = Math.min(payableBeforePoints, appliedPointsUsed * pointsRedeemRatio);
  
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

  const handleConfirmCheckout = async (method, receivedAmount, changeAmount, orderDateStr) => {
    if (checkoutLockRef.current) return;

    checkoutLockRef.current = true;
    setIsCheckoutProcessing(true);

    // If credit, override method
    const actualMethod = isCredit ? 'credit' : method;
    try {
      const success = await handleCheckoutSuccess(receivedAmount, changeAmount, actualMethod, orderDateStr);
      if (success) setShowConfirmModal(false);
    } finally {
      checkoutLockRef.current = false;
      setIsCheckoutProcessing(false);
    }
  };

  const handleCheckoutSuccess = async (received, change, method, orderDateStr) => {
    try {
      const checkoutItems = cartItems.map(item => {
        const quantity = Number(item.qty);
        const appliedPrice = Number(getAppliedPrice(item));
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Số lượng của "${item.name}" phải lớn hơn 0.`);
        }
        if (!Number.isFinite(appliedPrice) || appliedPrice < 0) {
          throw new Error(`Giá bán của "${item.name}" không hợp lệ.`);
        }
        return { item, quantity, appliedPrice };
      });
      if (checkoutItems.length === 0) throw new Error('Giỏ hàng đang trống.');
      if (!Number.isFinite(finalAmount) || finalAmount < 0) {
        throw new Error('Tổng tiền đơn hàng không hợp lệ. Vui lòng kiểm tra lại số lượng và giá bán.');
      }

      const storeIdSetting = await db.settings.get('storeId');
      const storeId = typeof storeIdSetting?.value === 'string' ? storeIdSetting.value.trim() : '';
      const hideStockSetting = await db.settings.get('hideStock');
      const isHideStock = hideStockSetting?.value === 'true';
      
      const orderTimestamp = orderDateStr ? new Date(orderDateStr).getTime() : Date.now();
      if (!Number.isFinite(orderTimestamp)) {
        throw new Error('Ngày lập hóa đơn không hợp lệ.');
      }

      const requestedPointsUsed = appliedPointsUsed;
      const earnedPoints = pointsEnabled && customer ? Math.floor(finalAmount / pointsEarnRatio) : 0;

      const newOrder = {
        timestamp: orderTimestamp,
        total: finalAmount,
        originalTotal: finalAmount,
        baseTotal: baseTotalAmount,
        promoDiscount: promoDiscountAmount,
        discount: discountAmount,
        totalDiscount,
        discountPercent: discountType === 'percent' ? discount : 0,
        discountType: discountType,
        pointsUsed: requestedPointsUsed,
        pointsDiscount: pointsDiscountAmount,
        pointsEarned: earnedPoints,
        surcharge: surcharge,
        totalTax: totalTaxAmount,
        items: checkoutItems.map(({ item, quantity, appliedPrice }) => {
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
            cartId: item.cartId || `${item.id}-${mode}`,
            barcode: item.barcode,
            name: item.name,
            price: appliedPrice,
            qty: quantity,
            unit: appliedUnit,
            sellMode: mode,
            isWholesale: mode === 'wholesale', // legacy
            taxRate: getEffectiveTaxRate(item),
            taxAmount: Math.round((appliedPrice * quantity * discountFactor) * getEffectiveTaxRate(item) / 100),
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
        cashReceived: isCredit ? 0 : (Number(received) || 0),
        changeAmount: isCredit ? 0 : (Number(change) || 0),
        transferAmount: method === 'split' ? Math.max(0, finalAmount - received) : (method === 'vietqr' ? finalAmount : 0),
        storeId: storeId,
        userId: currentUser?.id,
        shiftId: currentShift?.id,
        stockTracked: !isHideStock,
        status: 'completed'
      };

      await db.transaction(
        'rw',
        [db.orders, db.products, db.customers, db.customerTransactions, db.shifts],
        async () => {
          if (!currentShift?.id) {
            throw new Error('Chưa có ca làm việc đang mở. Vui lòng mở ca trước khi thanh toán.');
          }
          const liveShift = await db.shifts.get(currentShift.id);
          if (!liveShift || liveShift.status !== 'active') {
            throw new Error('Ca làm việc đã kết thúc. Vui lòng mở ca mới trước khi thanh toán.');
          }
          newOrder.shiftId = liveShift.id;

          // Generate the public order number inside the same write transaction.
          let generatedId;
          for (let attempts = 0; attempts < 10; attempts++) {
            const candidate = Math.floor(100000 + Math.random() * 900000);
            if (!(await db.orders.get(candidate))) {
              generatedId = candidate;
              break;
            }
          }
          newOrder.id = generatedId || Date.now();

          let currentCustomer = null;
          if (customer) {
            currentCustomer = await db.customers.get(customer.phone);
            if (!currentCustomer) {
              throw new Error('Khách hàng đã bị xóa hoặc thay đổi. Vui lòng chọn lại khách hàng.');
            }
            if (requestedPointsUsed > (Number(currentCustomer.points) || 0)) {
              throw new Error('Số điểm khả dụng đã thay đổi. Vui lòng kiểm tra lại điểm khách hàng.');
            }

            newOrder.customerName = currentCustomer.name;
            if (isCredit) {
              newOrder.customerPreviousDebt = Number(currentCustomer.debt) || 0;
              newOrder.customerRemainingDebt = newOrder.customerPreviousDebt + finalAmount;
            }
          } else if (isCredit) {
            throw new Error('Vui lòng chọn khách hàng trước khi ghi nợ.');
          }

          await db.orders.add(newOrder);

          if (!isHideStock) {
            for (const { item, quantity } of checkoutItems) {
              const prod = await db.products.get(item.id);
              if (!prod) throw new Error(`Sản phẩm "${item.name}" không còn tồn tại trong kho.`);

              const mode = item.sellMode || (item.isWholesale ? 'wholesale' : 'base');
              let conversion = 1;
              if (mode === 'wholesale') conversion = Number(prod.wholesaleConversionRate) || 1;
              if (mode === 'mid') conversion = Number(prod.midConversionRate) || 1;

              const deductQty = quantity * conversion;
              const currentStock = Number(prod.stock) || 0;
              if (deductQty > currentStock) {
                throw new Error(`Tồn kho "${prod.name}" không đủ: cần ${deductQty}, hiện có ${currentStock}.`);
              }
              await db.products.update(item.id, { stock: currentStock - deductQty });
            }
          }

          if (currentCustomer) {
            const newPoints = pointsEnabled
              ? Math.max(0, (Number(currentCustomer.points) || 0) - requestedPointsUsed) + earnedPoints
              : (Number(currentCustomer.points) || 0);
            const updateData = { points: newPoints };

            if (isCredit) {
              updateData.debt = newOrder.customerRemainingDebt;
              const itemsSummary = newOrder.items.map(it => `${it.name} x${it.qty}`).join(', ');
              await db.customerTransactions.add({
                customerPhone: currentCustomer.phone,
                timestamp: orderTimestamp,
                type: 'debt',
                amount: finalAmount,
                orderId: newOrder.id,
                note: `Giao hàng ghi nợ${itemsSummary ? ` (${itemsSummary})` : ''}`,
                previousDebt: newOrder.customerPreviousDebt,
                remainingDebt: newOrder.customerRemainingDebt
              });
            }

            await db.customers.update(currentCustomer.phone, updateData);
          }
        }
      );

      toast.success(isCredit ? "Đã ghi nợ thành công!" : "Thanh toán thành công!");

      setLastCompletedOrder(newOrder);

      const autoPrintSetting = await db.settings.get('autoPrint');
      const isAutoPrint = autoPrintSetting && (autoPrintSetting.value === 'true' || autoPrintSetting.value === true);

      if (isAutoPrint) {
        setActivePrintOrder(newOrder);
        setTimeout(async () => {
          await silentPrint(newOrder);
          setActivePrintOrder(null);
        }, 300);
      } else {
        setShowSuccessModal(true);
      }

      await autoSaveToLocalStorage();
      const syncEnabled = await db.settings.get('cloudSyncEnabled');
      if (syncEnabled?.value === 'true') syncToCloud(storeId);

      clearCart();
      setCustomer(null);
      setDiscount(0);
      setSurcharge(0);
      setIsCredit(false);
      setPointsUsed(0);
      setActiveMobileTab('scanner');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Gặp lỗi khi xử lý thanh toán đơn hàng.");
      return false;
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
              pointsUsed={appliedPointsUsed}
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
            pointsUsed={appliedPointsUsed}
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
            isProcessing={isCheckoutProcessing}
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
