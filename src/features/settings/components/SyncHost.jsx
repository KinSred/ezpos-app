import React, { useEffect, useRef, useState } from 'react';
import { Peer } from 'peerjs';
import QRCode from 'react-qr-code';
import { db } from '../../../db';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Smartphone, X } from 'lucide-react';
import { removeAccents } from '../../../utils/string';

const PEER_PREFIX = 'taphoa-pos-';
const PIN_LENGTH = 6;
const MAX_QUERY_LENGTH = 100;
const MAX_STOCK_ADDITION = 1_000_000;
const MAX_SEARCH_RESULTS = 10;

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isProductId = value => Number.isSafeInteger(value) && value > 0;
const isRequestId = value => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const generateSecurePin = () => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Trình duyệt không hỗ trợ tạo mã PIN an toàn');
  }

  // Rejection sampling avoids modulo bias while keeping the PIN easy to enter manually.
  const minimum = 10 ** (PIN_LENGTH - 1);
  const range = 9 * minimum;
  const maximum = 2 ** 32;
  const unbiasedLimit = Math.floor(maximum / range) * range;
  const random = new Uint32Array(1);

  do {
    globalThis.crypto.getRandomValues(random);
  } while (random[0] >= unbiasedLimit);

  return String(minimum + (random[0] % range));
};

const safeText = (value, fallback = '', maxLength = 120) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
};

const positiveConversionRate = value => {
  const rate = Number(value);
  return Number.isSafeInteger(rate) && rate > 0 && rate <= MAX_STOCK_ADDITION ? rate : undefined;
};

const toRemoteProduct = product => ({
  id: product.id,
  name: safeText(product.name, 'Sản phẩm', 200),
  barcode: safeText(product.barcode, '', 100),
  stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0,
  unit: safeText(product.unit, 'cái', 30),
  midUnit: safeText(product.midUnit, '', 30) || undefined,
  midConversionRate: positiveConversionRate(product.midConversionRate),
  wholesaleUnit: safeText(product.wholesaleUnit, '', 30) || undefined,
  wholesaleConversionRate: positiveConversionRate(product.wholesaleConversionRate)
});

const buildRemoteUrl = pin => {
  if (!pin) return '';
  const url = new URL(window.location.href);
  url.hash = `/remote?pin=${encodeURIComponent(pin)}`;
  return url.toString();
};

export default function SyncHost({ showModal, onClose }) {
  const [peerId, setPeerId] = useState('');
  const [connections, setConnections] = useState([]);
  const [sessionError, setSessionError] = useState('');
  const peerRef = useRef(null);

  useEffect(() => {
    if (!showModal) {
      setPeerId('');
      setConnections([]);
      setSessionError('');
      return undefined;
    }

    let disposed = false;
    let pin;

    try {
      pin = generateSecurePin();
    } catch (error) {
      setSessionError(error.message);
      return undefined;
    }

    setPeerId('');
    setConnections([]);
    setSessionError('');

    const peer = new Peer(`${PEER_PREFIX}${pin}`);
    const processedStockRequests = new Map();
    const inFlightStockRequests = new Map();
    peerRef.current = peer;

    peer.on('open', () => {
      if (!disposed) setPeerId(pin);
    });

    peer.on('connection', (conn) => {
      if (disposed) {
        conn.close();
        return;
      }

      const connectionKey = conn.connectionId || conn.peer;
      const send = payload => {
        if (conn.open) conn.send(payload);
      };
      const sendError = (message, requestId) => send({
        type: 'ERROR',
        message,
        ...(isRequestId(requestId) ? { requestId } : {})
      });

      const markConnected = () => {
        if (disposed) return;
        setConnections(previous => previous.includes(connectionKey)
          ? previous
          : [...previous, connectionKey]);
        toast.success('📱 Có thiết bị vừa kết nối!');
      };

      if (conn.open) markConnected();
      else conn.on('open', markConnected);

      conn.on('data', async (data) => {
        if (!isRecord(data) || typeof data.type !== 'string') {
          sendError('Thông điệp không hợp lệ');
          return;
        }

        try {
          if (data.type === 'SEARCH_PRODUCT') {
            if (typeof data.query !== 'string' || typeof data.isTyping !== 'boolean') {
              sendError('Yêu cầu tìm kiếm không hợp lệ');
              return;
            }

            const query = data.query.trim();
            if (!query || query.length > MAX_QUERY_LENGTH) {
              sendError(`Từ khóa phải có từ 1 đến ${MAX_QUERY_LENGTH} ký tự`);
              return;
            }

            const normalizedQuery = removeAccents(query.toLowerCase());
            const products = await db.products
              .filter((product) => {
                if (!isProductId(product.id)) return false;
                const name = safeText(product.name, '', 200).toLowerCase();
                const barcode = safeText(product.barcode, '', 100).toLowerCase();
                return removeAccents(name).includes(normalizedQuery) || barcode.includes(normalizedQuery);
              })
              .limit(MAX_SEARCH_RESULTS)
              .toArray();

            send({
              type: 'SEARCH_RESULTS',
              results: products.map(toRemoteProduct),
              isTyping: data.isTyping
            });
            return;
          }

          if (data.type === 'ADD_STOCK') {
            if (!isRequestId(data.requestId)) {
              sendError('Mã yêu cầu cập nhật không hợp lệ');
              return;
            }

            const previousResponse = processedStockRequests.get(data.requestId);
            if (previousResponse) {
              send(previousResponse);
              return;
            }

            const inFlightResponse = inFlightStockRequests.get(data.requestId);
            if (inFlightResponse) {
              send(await inFlightResponse);
              return;
            }

            if (!isProductId(data.productId)) {
              sendError('Mã sản phẩm không hợp lệ', data.requestId);
              return;
            }

            if (!Number.isSafeInteger(data.qty) || data.qty <= 0 || data.qty > MAX_STOCK_ADDITION) {
              sendError(`Số lượng phải là số nguyên từ 1 đến ${MAX_STOCK_ADDITION.toLocaleString('vi-VN')}`, data.requestId);
              return;
            }

            const stockUpdate = db.transaction('rw', db.products, async () => {
              const product = await db.products.get(data.productId);
              if (!product) return { error: 'Sản phẩm không tồn tại' };

              const currentStock = Number(product.stock);
              if (!Number.isFinite(currentStock)) return { error: 'Tồn kho hiện tại không hợp lệ' };

              const newStock = currentStock + data.qty;
              if (!Number.isFinite(newStock) || Math.abs(newStock) > Number.MAX_SAFE_INTEGER) {
                return { error: 'Tồn kho mới vượt giới hạn an toàn' };
              }

              await db.products.update(product.id, { stock: newStock });
              return {
                productId: product.id,
                productName: safeText(product.name, 'Sản phẩm', 200),
                qty: data.qty,
                newStock
              };
            });

            const responseTask = stockUpdate.then((result) => {
              if (result.error) {
                return { type: 'ERROR', message: result.error, requestId: data.requestId };
              }
              return { type: 'ADD_STOCK_SUCCESS', requestId: data.requestId, ...result };
            });
            inFlightStockRequests.set(data.requestId, responseTask);

            let response;
            try {
              response = await responseTask;
            } finally {
              inFlightStockRequests.delete(data.requestId);
            }

            processedStockRequests.set(data.requestId, response);
            if (processedStockRequests.size > 100) {
              processedStockRequests.delete(processedStockRequests.keys().next().value);
            }
            if (response.type === 'ADD_STOCK_SUCCESS') {
              toast.success(`📱 Nhập ${response.qty} vào ${response.productName} từ điện thoại!`);
            }
            send(response);
            return;
          }

          sendError('Loại thông điệp không được hỗ trợ');
        } catch (error) {
          console.error('Lỗi xử lý đồng bộ điện thoại:', error);
          sendError('Không thể xử lý yêu cầu. Vui lòng thử lại.');
        }
      });

      conn.on('close', () => {
        if (disposed) return;
        toast('📱 Một thiết bị đã ngắt kết nối', { icon: 'ℹ️' });
        setConnections(previous => previous.filter(id => id !== connectionKey));
      });

      conn.on('error', (error) => {
        console.error('Lỗi kết nối thiết bị từ xa:', error);
        if (!disposed) sendError('Kết nối thiết bị gặp lỗi');
      });
    });

    peer.on('error', (error) => {
      console.error('Lỗi phiên đồng bộ điện thoại:', error);
      if (disposed) return;
      setSessionError(error.type === 'unavailable-id'
        ? 'Mã phiên vừa tạo đã được sử dụng. Đóng và mở lại cửa sổ để tạo mã mới.'
        : 'Không thể mở phiên đồng bộ. Vui lòng thử lại.');
      setPeerId('');
    });

    return () => {
      disposed = true;
      if (peerRef.current === peer) peerRef.current = null;
      peer.destroy();
    };
  }, [showModal]);

  const copyId = async () => {
    if (!peerId) return;
    try {
      await navigator.clipboard.writeText(peerId);
      toast.success('Đã copy mã PIN');
    } catch {
      toast.error('Không thể copy mã PIN');
    }
  };

  const remoteUrl = buildRemoteUrl(peerId);

  return (
    <AnimatePresence>
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center relative"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors focus:outline-none"
              aria-label="Đóng phiên kết nối điện thoại"
            >
              <X size={20} />
            </button>

            <div className="bg-sky-500 text-white p-3 rounded-2xl shadow-lg shadow-sky-500/30 mb-4">
              <Smartphone size={32} />
            </div>

            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Kết Nối Điện Thoại</h2>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-6">
              Phiên chỉ hoạt động khi cửa sổ này đang mở. Quét QR hoặc nhập mã PIN 6 số trên điện thoại.
            </p>

            <div className="bg-white p-4 rounded-2xl border-4 border-sky-100 dark:border-sky-900/50 shadow-sm mb-6 min-h-[220px] min-w-[220px] flex items-center justify-center">
              {remoteUrl ? (
                <QRCode value={remoteUrl} size={180} />
              ) : (
                <span className="text-sm text-center text-slate-500 px-4">
                  {sessionError || 'Đang tạo phiên an toàn...'}
                </span>
              )}
            </div>

            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <div className="w-full mb-6 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 border rounded-xl p-3 text-xs text-rose-600 dark:text-rose-400">
                <span className="font-bold">⚠️ CẢNH BÁO:</span> Điện thoại sẽ KHÔNG quét được mã này vì bạn đang chạy trên <code>localhost</code>.
                <br/><br/>
                Mở ứng dụng bằng địa chỉ <strong>Network</strong> (ví dụ <code>https://192.168.x.x:5173</code>) được Vite hiển thị trong Terminal, rồi tạo lại mã QR.
              </div>
            )}

            <div className="w-full flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-6">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Mã PIN Kết Nối</span>
                <span className="text-3xl font-black text-sky-600 tracking-[0.2em]">{peerId || '······'}</span>
              </div>
              <button
                onClick={copyId}
                disabled={!peerId}
                className="p-3 bg-sky-100 text-sky-600 hover:bg-sky-200 rounded-xl transition-colors disabled:opacity-40"
                aria-label="Copy mã PIN kết nối"
              >
                <Copy size={20} />
              </button>
            </div>

            {sessionError && (
              <div className="w-full mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                {sessionError}
              </div>
            )}

            <div className="w-full">
              <div className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`${connections.length > 0 ? 'animate-ping bg-emerald-400' : 'bg-slate-400'} absolute inline-flex h-full w-full rounded-full opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${connections.length > 0 ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                </span>
                Trạng thái: {connections.length > 0 ? `${connections.length} thiết bị đang ghép nối` : 'Đang chờ ghép nối...'}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
