import React, { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import QRCode from 'react-qr-code';
import { db } from '../db';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, X, Copy } from 'lucide-react';
import { removeAccents } from '../utils/string';

export default function SyncHost({ showModal, onClose }) {
  const [peerId, setPeerId] = useState('');
  const [connections, setConnections] = useState([]);
  const peerRef = useRef(null);

  useEffect(() => {
    // Generate a 4 digit pin
    const shortId = Math.floor(1000 + Math.random() * 9000).toString();
    const prefix = 'taphoa-pos-';
    const fullId = prefix + shortId;

    const peer = new Peer(fullId);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(shortId);
    });

    peer.on('connection', (conn) => {
      toast.success("📱 Có thiết bị vừa kết nối!");
      
      setConnections(prev => [...prev, conn.peer]);

      conn.on('data', async (data) => {
        try {
          if (data.type === 'SEARCH_PRODUCT') {
            const q = removeAccents(data.query.toLowerCase().trim());
            const results = await db.products
              .filter(p => removeAccents(p.name.toLowerCase()).includes(q) || p.barcode.includes(q))
              .limit(10)
              .toArray();
            conn.send({ type: 'SEARCH_RESULTS', results, isTyping: data.isTyping });
          } 
          else if (data.type === 'ADD_STOCK') {
            const product = await db.products.get(data.productId);
            if (product) {
               const newStock = (parseFloat(product.stock) || 0) + data.qty;
               await db.products.update(product.id, { stock: newStock });
               toast.success(`📱 Nhập ${data.qty} vào ${product.name} từ điện thoại!`);
               conn.send({ type: 'ADD_STOCK_SUCCESS', productId: product.id, newStock });
            } else {
               conn.send({ type: 'ERROR', message: 'Sản phẩm không tồn tại' });
            }
          }
        } catch (err) {
          console.error(err);
        }
      });

      conn.on('close', () => {
        toast("📱 Một thiết bị đã ngắt kết nối", { icon: 'ℹ️' });
        setConnections(prev => prev.filter(p => p !== conn.peer));
      });
    });

    return () => {
      peer.destroy();
    };
  }, []);

  const copyId = () => {
    navigator.clipboard.writeText(peerId);
    toast.success("Đã copy mã PIN");
  };

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
            >
              <X size={20} />
            </button>
            
            <div className="bg-sky-500 text-white p-3 rounded-2xl shadow-lg shadow-sky-500/30 mb-4">
              <Smartphone size={32} />
            </div>
            
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Kết Nối Điện Thoại</h2>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-6">
              Dùng camera điện thoại quét mã QR bên dưới để mở thẳng ứng dụng và kết nối tự động.
            </p>

            <div className="bg-white p-4 rounded-2xl border-4 border-sky-100 dark:border-sky-900/50 shadow-sm mb-6">
              <QRCode value={`${window.location.origin}/remote?pin=${peerId}`} size={180} />
            </div>

            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <div className="w-full mb-6 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 border rounded-xl p-3 text-xs text-rose-600 dark:text-rose-400">
                <span className="font-bold">⚠️ CẢNH BÁO:</span> Điện thoại sẽ KHÔNG quét được mã này vì bạn đang chạy trên <code>localhost</code>.
                <br/><br/>
                Vui lòng nhìn vào cửa sổ dòng lệnh (Terminal) nơi bạn chạy web, tìm dòng <code>Network: http://192.168.x.x:5173/</code> và dùng địa chỉ <strong>192.168.x.x</strong> đó để mở web trên máy tính thay vì localhost nhé. (Đã tự động cấu hình lại hệ thống, bạn cần tắt web và chạy lại lệnh <code>npm run dev</code>)
              </div>
            )}

            <div className="w-full flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-6">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Mã PIN Kết Nối</span>
                <span className="text-3xl font-black text-sky-600 tracking-[0.2em]">{peerId || '...'}</span>
              </div>
              <button 
                onClick={copyId}
                className="p-3 bg-sky-100 text-sky-600 hover:bg-sky-200 rounded-xl transition-colors"
              >
                <Copy size={20} />
              </button>
            </div>

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
