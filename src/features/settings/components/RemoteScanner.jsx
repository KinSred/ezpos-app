import React, { useState, useEffect, useRef } from 'react';
import { Scan, CheckCircle2, Smartphone, Search, ArrowRight, PackagePlus, ChevronLeft, Package, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { Peer } from 'peerjs';

export default function RemoteScanner() {
  const [pin, setPin] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

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

  useEffect(() => {
    // Check if PIN is in URL
    const params = new URLSearchParams(window.location.search);
    const pinParam = params.get('pin');
    if (pinParam && pinParam.length === 4) {
      setPin(pinParam);
      // Auto connect after a short delay
      setTimeout(() => {
        connectToHostWithPin(pinParam);
      }, 500);
    }

    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const connectToHostWithPin = (pinToUse) => {
    if (!pinToUse || pinToUse.trim().length < 4) return;
    setIsConnecting(true);

    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      const fullHostId = `taphoa-pos-${pinToUse.trim()}`;
      const conn = peer.connect(fullHostId);

      conn.on('open', () => {
        setIsConnected(true);
        setIsConnecting(false);
        connRef.current = conn;
        toast.success("Đã kết nối với Máy tính!");
        setTimeout(() => {
          if (searchInputRef.current) searchInputRef.current.focus();
        }, 500);
      });

      conn.on('data', (data) => {
        if (data.type === 'SEARCH_RESULTS') {
          if (data.isTyping) {
            setSuggestions(data.results || []);
          } else {
            // When user hits Enter, just show suggestions and let them click
            if (data.results && data.results.length > 0) {
              setSuggestions(data.results);
            } else {
              toast.error("Không tìm thấy sản phẩm này trong kho máy tính.");
              setSearchTerm('');
              if (searchInputRef.current) searchInputRef.current.value = '';
              setSuggestions([]);
              if (navigator.vibrate) navigator.vibrate(300);
              setTimeout(() => {
                if (searchInputRef.current) searchInputRef.current.focus();
              }, 100);
            }
          }
        }
        else if (data.type === 'ADD_STOCK_SUCCESS') {
          toast.success("✅ Đã cập nhật trên máy tính!");
          setScannedProduct(null);
          setQtyBase('');
          setQtyMid('');
          setQtyWholesale('');
          setSearchTerm('');
          if (searchInputRef.current) searchInputRef.current.value = '';
          setSuggestions([]);
          setActiveTab('scan');
          setTimeout(() => {
            if (searchInputRef.current) searchInputRef.current.focus();
          }, 500);
        }
        else if (data.type === 'ERROR') {
          toast.error(data.message);
        }
      });

      conn.on('close', () => {
        setIsConnected(false);
        connRef.current = null;
        toast.error("Đã mất kết nối với máy tính.");
      });

      peer.on('error', (err) => {
        setIsConnecting(false);
        toast.error("Không thể kết nối. Kiểm tra lại mã PIN.");
        console.error(err);
      });
    });
  };

  const handleSearchTermChange = (e) => {
    const val = e.target.value;
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
    if (!searchTerm.trim()) return;
    if (connRef.current && connRef.current.open) {
      toast.loading("Đang tra cứu...", { duration: 500 });
      connRef.current.send({ type: 'SEARCH_PRODUCT', query: searchTerm, isTyping: false });
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
    let total = 0;
    const base = parseInt(qtyBase) || 0;
    total += base;

    if (scannedProduct.midUnit && scannedProduct.midConversionRate) {
      const mid = parseInt(qtyMid) || 0;
      total += mid * parseInt(scannedProduct.midConversionRate);
    }

    if (scannedProduct.wholesaleUnit && scannedProduct.wholesaleConversionRate) {
      const whole = parseInt(qtyWholesale) || 0;
      total += whole * parseInt(scannedProduct.wholesaleConversionRate);
    }
    return total;
  };

  const totalAdded = calculateTotalAdded();

  const handleAddStock = () => {
    if (totalAdded <= 0) {
      toast.error("Vui lòng nhập số lượng hợp lệ");
      return;
    }
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'ADD_STOCK', productId: scannedProduct.id, qty: totalAdded });
    }
  };

  const handleCancel = () => {
    setScannedProduct(null);
    setQtyBase('');
    setQtyMid('');
    setQtyWholesale('');
    setSearchTerm('');
    if (searchInputRef.current) searchInputRef.current.value = '';
    setSuggestions([]);
    setActiveTab('scan');
    setTimeout(() => {
      if (searchInputRef.current) searchInputRef.current.focus();
    }, 500);
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
            Nhập mã PIN hiển thị trên màn hình máy tính để bắt đầu làm máy quét.
          </p>

          <input
            type="text"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full text-center text-5xl font-black tracking-[0.3em] py-5 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none mb-6 transition-all text-indigo-600"
            placeholder="----"
          />

          <button
            onClick={() => connectToHostWithPin(pin)}
            disabled={pin.length < 4 || isConnecting}
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
                defaultValue={searchTerm}
                onChange={handleSearchTermChange}
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
            className="flex items-center gap-2 text-indigo-600 font-bold p-5"
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
                      value={qtyWholesale}
                      onChange={e => setQtyWholesale(e.target.value)}
                      placeholder="0"
                      className="w-full text-center text-4xl font-black py-4 rounded-xl bg-white border-2 border-slate-200 focus:border-indigo-500 focus:outline-none transition-all text-slate-800"
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
                      value={qtyMid}
                      onChange={e => setQtyMid(e.target.value)}
                      placeholder="0"
                      className="w-full text-center text-4xl font-black py-4 rounded-xl bg-white border-2 border-slate-200 focus:border-indigo-500 focus:outline-none transition-all text-slate-800"
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
                    autoFocus
                    value={qtyBase}
                    onChange={e => setQtyBase(e.target.value)}
                    placeholder="0"
                    className="w-full text-center text-4xl font-black py-4 rounded-xl bg-white border-2 border-indigo-200 focus:border-indigo-500 focus:outline-none transition-all text-slate-800"
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
                  +{totalAdded} <span className="text-base font-bold">{scannedProduct.unit}</span>
                </div>
              </div>

            </div>

            <div className="mt-auto pb-6">
              <button
                onClick={handleAddStock}
                disabled={totalAdded <= 0}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-[1.5rem] font-bold text-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 disabled:from-slate-300 disabled:to-slate-400 transition-all shadow-xl shadow-indigo-500/30 active:scale-[0.98]"
              >
                <PackagePlus size={24} />
                Cộng Vào Kho
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
