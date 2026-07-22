import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Scan, CheckCircle2, Smartphone, Search, ArrowRight, PackagePlus, ChevronLeft, Package, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { Peer } from 'peerjs';
import { useLocation } from 'react-router-dom';

const PEER_PREFIX = 'taphoa-pos-';
const PIN_LENGTH = 6;
const PIN_PATTERN = /^\d{6}$/;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QUERY_LENGTH = 100;
const MAX_STOCK_ADDITION = 1_000_000;
const MAX_SEARCH_RESULTS = 10;

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isProductId = value => Number.isSafeInteger(value) && value > 0;
const isRequestId = value => typeof value === 'string' && REQUEST_ID_PATTERN.test(value);

const safeText = (value, fallback = '', maxLength = 120) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
};

const sanitizeConversionRate = value => {
  if (value === undefined || value === null) return undefined;
  const rate = Number(value);
  return Number.isSafeInteger(rate) && rate > 0 && rate <= MAX_STOCK_ADDITION ? rate : null;
};

const sanitizeRemoteProduct = product => {
  if (!isRecord(product) || !isProductId(product.id)) return null;

  const name = safeText(product.name, '', 200);
  const stock = Number(product.stock);
  const midConversionRate = sanitizeConversionRate(product.midConversionRate);
  const wholesaleConversionRate = sanitizeConversionRate(product.wholesaleConversionRate);

  if (!name || !Number.isFinite(stock) || midConversionRate === null || wholesaleConversionRate === null) {
    return null;
  }

  return {
    id: product.id,
    name,
    barcode: safeText(product.barcode, '', 100),
    stock,
    unit: safeText(product.unit, 'cái', 30),
    midUnit: safeText(product.midUnit, '', 30) || undefined,
    midConversionRate,
    wholesaleUnit: safeText(product.wholesaleUnit, '', 30) || undefined,
    wholesaleConversionRate
  };
};

const sanitizeQuantityInput = value => value.replace(/\D/g, '').slice(0, 7);

const parseQuantity = value => {
  if (!value) return 0;
  if (!/^\d+$/.test(value)) return Number.NaN;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
};

const createRequestId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('Trình duyệt không hỗ trợ tạo mã yêu cầu an toàn');

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export default function RemoteScanner() {
  const location = useLocation();
  const [pin, setPin] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);

  const [activeTab, setActiveTab] = useState('scan'); // 'scan', 'product'

  const [scannedProduct, setScannedProduct] = useState(null);
  const [qtyBase, setQtyBase] = useState('');
  const [qtyMid, setQtyMid] = useState('');
  const [qtyWholesale, setQtyWholesale] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const searchInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const stockRequestTimeoutRef = useRef(null);
  const pendingStockRequestRef = useRef(null);
  const hostPinRef = useRef('');

  const clearStockRequest = useCallback((forgetRequest = true) => {
    if (stockRequestTimeoutRef.current) {
      clearTimeout(stockRequestTimeoutRef.current);
      stockRequestTimeoutRef.current = null;
    }
    if (forgetRequest) pendingStockRequestRef.current = null;
    setIsUpdatingStock(false);
  }, []);

  const resetProductForm = useCallback(() => {
    setScannedProduct(null);
    setQtyBase('');
    setQtyMid('');
    setQtyWholesale('');
    setSearchTerm('');
    setSuggestions([]);
    setActiveTab('scan');
    setTimeout(() => searchInputRef.current?.focus(), 300);
  }, []);

  const connectToHostWithPin = useCallback((pinToUse) => {
    const normalizedPin = String(pinToUse || '').trim();
    if (!PIN_PATTERN.test(normalizedPin)) {
      toast.error(`Mã PIN phải gồm đúng ${PIN_LENGTH} chữ số.`);
      return;
    }

    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    const previousConnection = connRef.current;
    const previousPeer = peerRef.current;
    connRef.current = null;
    peerRef.current = null;
    previousConnection?.close();
    previousPeer?.destroy();
    if (hostPinRef.current && hostPinRef.current !== normalizedPin) {
      clearStockRequest();
      resetProductForm();
    } else {
      clearStockRequest(false);
    }
    hostPinRef.current = normalizedPin;
    setIsConnected(false);
    setIsConnecting(true);

    const peer = new Peer();
    peerRef.current = peer;

    connectionTimeoutRef.current = setTimeout(() => {
      if (peerRef.current !== peer) return;
      setIsConnecting(false);
      toast.error('Kết nối quá thời gian. Hãy kiểm tra phiên trên máy tính.');
      const pendingConnection = connRef.current;
      connRef.current = null;
      peerRef.current = null;
      pendingConnection?.close();
      peer.destroy();
    }, 10_000);

    peer.on('open', () => {
      if (peerRef.current !== peer) return;
      const conn = peer.connect(`${PEER_PREFIX}${normalizedPin}`, { reliable: true });
      connRef.current = conn;

      conn.on('open', () => {
        if (connRef.current !== conn) return;
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        setIsConnected(true);
        setIsConnecting(false);
        toast.success('Đã kết nối với máy tính!');
        setTimeout(() => searchInputRef.current?.focus(), 300);
      });

      conn.on('data', (data) => {
        if (!isRecord(data) || typeof data.type !== 'string') {
          toast.error('Máy tính gửi phản hồi không hợp lệ.');
          return;
        }

        if (data.type === 'SEARCH_RESULTS') {
          if (!Array.isArray(data.results) || data.results.length > MAX_SEARCH_RESULTS || typeof data.isTyping !== 'boolean') {
            toast.error('Kết quả tìm kiếm không hợp lệ.');
            return;
          }

          const results = data.results.map(sanitizeRemoteProduct);
          if (results.some(product => product === null)) {
            toast.error('Kết quả tìm kiếm chứa dữ liệu không hợp lệ.');
            return;
          }

          if (data.isTyping) {
            setSuggestions(results);
          } else {
            if (results.length > 0) {
              setSuggestions(results);
            } else {
              toast.error('Không tìm thấy sản phẩm này trong kho máy tính.');
              setSearchTerm('');
              setSuggestions([]);
              if (navigator.vibrate) navigator.vibrate(300);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }
          }
          return;
        }

        if (data.type === 'ADD_STOCK_SUCCESS') {
          const pendingRequest = pendingStockRequestRef.current;
          const newStock = Number(data.newStock);
          const productName = safeText(data.productName, 'sản phẩm', 200);
          const isValidResponse = isRequestId(data.requestId)
            && pendingRequest?.requestId === data.requestId
            && isProductId(data.productId)
            && pendingRequest.productId === data.productId
            && Number.isSafeInteger(data.qty)
            && pendingRequest.qty === data.qty
            && Number.isFinite(newStock);

          if (!isValidResponse) {
            toast.error('Phản hồi cập nhật kho không khớp yêu cầu.');
            return;
          }

          clearStockRequest();
          toast.success(`✅ Đã cộng ${data.qty} vào ${productName}. Tồn mới: ${newStock}`);
          resetProductForm();
          return;
        }

        if (data.type === 'ERROR') {
          const message = safeText(data.message, '', 200);
          if (!message || (data.requestId !== undefined && !isRequestId(data.requestId))) {
            toast.error('Máy tính gửi thông báo lỗi không hợp lệ.');
            return;
          }
          if (!data.requestId || pendingStockRequestRef.current?.requestId === data.requestId) {
            clearStockRequest();
          }
          toast.error(message);
          return;
        }

        toast.error('Máy tính gửi loại phản hồi không được hỗ trợ.');
      });

      conn.on('close', () => {
        if (connRef.current !== conn) return;
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        connRef.current = null;
        setIsConnected(false);
        setIsConnecting(false);
        // Keep the request UUID so reconnecting to the same open host session can
        // safely ask for the same result without incrementing stock a second time.
        clearStockRequest(false);
        toast.error('Đã mất kết nối với máy tính. Kiểm tra cửa sổ ghép nối trên máy tính.');
      });

      conn.on('error', (error) => {
        console.error('Lỗi kết nối máy tính:', error);
        if (connRef.current === conn) toast.error('Kết nối với máy tính gặp lỗi.');
      });
    });

    peer.on('error', (error) => {
      console.error('Lỗi PeerJS trên điện thoại:', error);
      if (peerRef.current !== peer) return;
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      setIsConnecting(false);
      if (!connRef.current?.open) setIsConnected(false);
      toast.error(error.type === 'peer-unavailable'
        ? 'Không tìm thấy phiên. Kiểm tra mã PIN và giữ cửa sổ ghép nối mở trên máy tính.'
        : 'Không thể kết nối. Vui lòng thử lại.');
    });
  }, [clearStockRequest, resetProductForm]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pinParam = params.get('pin');
    if (!PIN_PATTERN.test(pinParam || '')) return undefined;

    setPin(pinParam);
    const timer = setTimeout(() => connectToHostWithPin(pinParam), 300);
    return () => clearTimeout(timer);
  }, [connectToHostWithPin, location.search]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (stockRequestTimeoutRef.current) clearTimeout(stockRequestTimeoutRef.current);
    const connection = connRef.current;
    const peer = peerRef.current;
    connRef.current = null;
    peerRef.current = null;
    connection?.close();
    peer?.destroy();
  }, []);

  const handleSearchTermChange = (e) => {
    const val = e.target.value.slice(0, MAX_QUERY_LENGTH);
    setSearchTerm(val);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (!val.trim()) {
      setSuggestions([]);
      return;
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (connRef.current && connRef.current.open) {
        connRef.current.send({ type: 'SEARCH_PRODUCT', query: val, isTyping: true });
      }
    }, 200); // 200ms debounce
  };

  const handleManualSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query || query.length > MAX_QUERY_LENGTH) return;
    if (connRef.current && connRef.current.open) {
      toast.loading('Đang tra cứu...', { duration: 500 });
      connRef.current.send({ type: 'SEARCH_PRODUCT', query, isTyping: false });
    }
  };

  const handleSelectProduct = (product) => {
    setScannedProduct(product);
    setActiveTab('product');
    setSuggestions([]);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  const calculateTotalAdded = () => {
    if (!scannedProduct) return 0;
    const base = parseQuantity(qtyBase);
    const mid = parseQuantity(qtyMid);
    const wholesale = parseQuantity(qtyWholesale);
    if (![base, mid, wholesale].every(Number.isSafeInteger)) return Number.NaN;

    let total = base;
    if (scannedProduct.midUnit && scannedProduct.midConversionRate) total += mid * scannedProduct.midConversionRate;
    if (scannedProduct.wholesaleUnit && scannedProduct.wholesaleConversionRate) {
      total += wholesale * scannedProduct.wholesaleConversionRate;
    }

    return Number.isSafeInteger(total) && total <= MAX_STOCK_ADDITION ? total : Number.NaN;
  };

  const totalAdded = calculateTotalAdded();
  const hasValidTotal = Number.isSafeInteger(totalAdded) && totalAdded > 0 && totalAdded <= MAX_STOCK_ADDITION;

  const handleAddStock = () => {
    if (!scannedProduct || !isProductId(scannedProduct.id) || !hasValidTotal) {
      toast.error(`Tổng số lượng phải từ 1 đến ${MAX_STOCK_ADDITION.toLocaleString('vi-VN')}`);
      return;
    }

    const conn = connRef.current;
    if (!conn?.open) {
      toast.error('Đã mất kết nối với máy tính.');
      return;
    }

    try {
      const previousRequest = pendingStockRequestRef.current;
      const requestId = previousRequest?.productId === scannedProduct.id && previousRequest.qty === totalAdded
        ? previousRequest.requestId
        : createRequestId();
      const request = { requestId, productId: scannedProduct.id, qty: totalAdded };
      pendingStockRequestRef.current = request;
      setIsUpdatingStock(true);
      conn.send({ type: 'ADD_STOCK', ...request });

      if (stockRequestTimeoutRef.current) clearTimeout(stockRequestTimeoutRef.current);
      stockRequestTimeoutRef.current = setTimeout(() => {
        setIsUpdatingStock(false);
        toast.error('Chưa nhận được phản hồi. Bấm lại để kiểm tra cùng yêu cầu, không tạo lần cộng mới.');
      }, 10_000);
    } catch (error) {
      clearStockRequest();
      toast.error(error.message);
    }
  };

  const handleCancel = () => {
    if (isUpdatingStock) return;
    clearStockRequest();
    resetProductForm();
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 relative overflow-hidden font-sans">
        <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-sky-500 to-indigo-600 rounded-b-[4rem] shadow-xl z-0"></div>

        <div className="z-10 w-full max-w-sm bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/50 shadow-2xl flex flex-col items-center">
          <div className="bg-gradient-to-br from-sky-400 to-indigo-500 p-5 rounded-[1.5rem] shadow-lg shadow-indigo-500/30 mb-6 text-white transform -translate-y-12">
            <Smartphone size={40} />
          </div>
          <h1 className="text-2xl font-black mb-2 text-slate-800 -mt-6">Đồng Bộ Di Động</h1>
          <p className="text-slate-500 text-center text-sm mb-8 px-4">
            Nhập mã PIN 6 số đang hiển thị trên máy tính để bắt đầu làm máy quét.
          </p>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            className="w-full text-center text-4xl font-black tracking-[0.2em] py-5 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none mb-6 transition-all text-indigo-600"
            placeholder="------"
            aria-label="Mã PIN kết nối 6 số"
          />

          <button
            onClick={() => connectToHostWithPin(pin)}
            disabled={!PIN_PATTERN.test(pin) || isConnecting}
            className="w-full py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 disabled:from-slate-400 disabled:to-slate-500 transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
          >
            {isConnecting ? 'Đang kết nối...' : 'Bắt Đầu Ghép Nối'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <h1 className="font-black text-lg flex items-center gap-2 text-slate-800">
          <Scan className="text-indigo-500" size={24} />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-indigo-600">Máy Quét Từ Xa</span>
        </h1>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
          <CheckCircle2 size={14} /> Đã ghép nối
        </div>
      </div>

      {activeTab === 'scan' && (
        <div className="flex-1 p-5 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">

          <div className="mb-6 mt-4">
            <h2 className="text-2xl font-black text-slate-800 mb-2">Tìm Sản Phẩm</h2>
            <p className="text-slate-500 text-sm">Quét mã vạch hoặc gõ tên để nhập số lượng.</p>
          </div>

          <form onSubmit={handleManualSearchSubmit} className="relative z-10">
            <div className="relative shadow-lg shadow-slate-200/50 rounded-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={24} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={handleSearchTermChange}
                maxLength={MAX_QUERY_LENGTH}
                placeholder="Mã vạch hoặc tên..."
                className="w-full bg-white border-2 border-slate-200 rounded-2xl pl-12 pr-16 py-4 text-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                autoFocus
              />
              <button
                type="submit"
                disabled={!searchTerm.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-50 text-indigo-600 disabled:opacity-50 disabled:bg-transparent disabled:text-slate-300 p-2.5 rounded-xl transition-colors"
              >
                <ArrowRight size={24} />
              </button>
            </div>
          </form>

          {/* Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <div className="mt-4 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 flex-1 max-h-[50vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">
              {suggestions.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className="w-full text-left p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center gap-4"
                >
                  <div className="bg-indigo-50 text-indigo-500 p-3 rounded-xl">
                    <Package size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{p.name}</h4>
                    <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{p.barcode}</span>
                      <span>• Tồn: {p.stock}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchTerm.trim() && suggestions.length === 0 && (
            <div className="mt-8 text-center text-slate-400 flex flex-col items-center">
              <Package size={48} className="text-slate-200 mb-3" />
              <p>Bấm Enter hoặc dấu mũi tên để tra cứu chính xác</p>
            </div>
          )}

        </div>
      )}

      {activeTab === 'product' && scannedProduct && (
        <div className="flex-1 bg-white flex flex-col animate-in fade-in slide-in-from-right-8 duration-300">

          <button
            onClick={handleCancel}
            disabled={isUpdatingStock}
            className="flex items-center gap-2 text-indigo-600 font-bold p-5 disabled:opacity-40"
          >
            <ChevronLeft size={20} /> Quay lại tìm kiếm
          </button>

          <div className="px-6 flex-1 flex flex-col">
            <div className="mb-8">
              <h2 className="text-3xl font-black text-slate-800 leading-tight mb-2">{scannedProduct.name}</h2>
              <div className="inline-block bg-slate-100 text-slate-500 font-mono text-sm px-2.5 py-1 rounded-md mb-6">{scannedProduct.barcode}</div>

              <div className="flex items-center justify-between p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                <span className="text-slate-600 font-medium">Tồn kho trên máy:</span>
                <span className="text-2xl font-black text-indigo-600">{scannedProduct.stock} <span className="text-base font-bold">{scannedProduct.unit}</span></span>
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-6">

              {scannedProduct.wholesaleUnit && scannedProduct.wholesaleConversionRate && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Số {scannedProduct.wholesaleUnit}</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max={MAX_STOCK_ADDITION}
                      step="1"
                      value={qtyWholesale}
                      onChange={e => setQtyWholesale(sanitizeQuantityInput(e.target.value))}
                      disabled={isUpdatingStock}
                      placeholder="0"
                      className="w-full text-center text-4xl font-black py-4 rounded-xl bg-white border-2 border-slate-200 focus:border-indigo-500 focus:outline-none transition-all text-slate-800 disabled:opacity-50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">x {scannedProduct.wholesaleConversionRate}</span>
                  </div>
                </div>
              )}

              {scannedProduct.midUnit && scannedProduct.midConversionRate && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Số {scannedProduct.midUnit}</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max={MAX_STOCK_ADDITION}
                      step="1"
                      value={qtyMid}
                      onChange={e => setQtyMid(sanitizeQuantityInput(e.target.value))}
                      disabled={isUpdatingStock}
                      placeholder="0"
                      className="w-full text-center text-4xl font-black py-4 rounded-xl bg-white border-2 border-slate-200 focus:border-indigo-500 focus:outline-none transition-all text-slate-800 disabled:opacity-50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">x {scannedProduct.midConversionRate}</span>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Số {scannedProduct.unit} (Lẻ)</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={MAX_STOCK_ADDITION}
                    step="1"
                    autoFocus
                    value={qtyBase}
                    onChange={e => setQtyBase(sanitizeQuantityInput(e.target.value))}
                    disabled={isUpdatingStock}
                    placeholder="0"
                    className="w-full text-center text-4xl font-black py-4 rounded-xl bg-white border-2 border-indigo-200 focus:border-indigo-500 focus:outline-none transition-all text-slate-800 disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{scannedProduct.unit}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div className="text-indigo-800 font-medium flex items-center gap-2">
                  <Info size={18} />
                  Sẽ cộng thêm:
                </div>
                <div className="text-2xl font-black text-indigo-600">
                  {hasValidTotal ? `+${totalAdded}` : 'Không hợp lệ'} <span className="text-base font-bold">{hasValidTotal ? scannedProduct.unit : ''}</span>
                </div>
              </div>

            </div>

            <div className="mt-auto pb-6">
              <button
                onClick={handleAddStock}
                disabled={!hasValidTotal || isUpdatingStock}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-[1.5rem] font-bold text-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 disabled:from-slate-300 disabled:to-slate-400 transition-all shadow-xl shadow-indigo-500/30 active:scale-[0.98]"
              >
                <PackagePlus size={24} />
                {isUpdatingStock ? 'Đang cập nhật...' : 'Cộng Vào Kho'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
