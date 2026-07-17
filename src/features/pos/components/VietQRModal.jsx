import React, { useState, useEffect } from 'react';
import { QrCode, CheckCircle2, X } from 'lucide-react';
import { db } from '../../../db';

export default function VietQRModal({ amount, onClose, onSuccess }) {
  const [qrUrl, setQrUrl] = useState('');
  const [bankInfo, setBankInfo] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const binSetting = await db.settings.get('bankBin');
        const accSetting = await db.settings.get('bankAccount');
        const nameSetting = await db.settings.get('bankAccountName');

        const bin = binSetting?.value || '970436';
        const acc = accSetting?.value || '';
        const name = nameSetting?.value || '';

        setBankInfo({ bin, acc, name });

        const url = `https://img.vietqr.io/image/${bin}-${acc}-compact2.png?amount=${amount}&addInfo=Thanh toan don hang&accountName=${encodeURIComponent(name)}`;
        setQrUrl(url);
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    fetchSettings();
  }, [amount]);

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

  const handleSuccessClick = () => {
    onSuccess();
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="glass-card rounded-3xl w-full max-w-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300 border border-slate-200 dark:border-slate-800 transition-colors duration-200">
        
        <div className="px-6 py-5 border-b border-sky-200/50 dark:border-sky-800/40 flex items-center justify-between bg-sky-100/50 dark:bg-sky-950/40 transition-colors duration-200">
          <h3 id="qr-modal-title" className="font-bold text-sky-950 dark:text-white flex items-center gap-2 text-lg">
            <QrCode className="text-sky-600 dark:text-cyan-400" size={22} />
            Thanh Toán VietQR
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Đóng hộp thoại"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          <div className="text-center mb-6">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Số tiền cần chuyển khoản</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{formatPrice(amount)}</p>
          </div>

          {/* QR image is rendered with a clean white card for scannability even in dark mode */}
          <div className="bg-white p-3 rounded-3xl border border-slate-200 dark:border-slate-800 relative">
            {qrUrl ? (
              <img src={qrUrl} alt="Mã VietQR" className="w-60 h-60 object-contain rounded-2xl" />
            ) : (
              <div className="w-60 h-60 bg-sky-50/50 dark:bg-slate-900/50 animate-pulse rounded-2xl"></div>
            )}
            
            {(!bankInfo?.acc || bankInfo?.acc === '000000000') && (
              <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 rounded-3xl">
                <p className="text-rose-600 dark:text-rose-400 font-bold mb-2">Chưa Thiết Lập Ngân Hàng</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Vui lòng vào tab <strong>Cài Đặt</strong> để cập nhật thông tin tài khoản của bạn trước.</p>
              </div>
            )}
          </div>

          {bankInfo?.name && bankInfo?.name !== 'NGUYEN VAN A' && (
            <div className="mt-4 text-center bg-sky-50/50 dark:bg-slate-900/50 py-2.5 px-4 rounded-2xl w-full border border-slate-200/50 dark:border-slate-800/50 transition-colors duration-200">
              <p className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tài khoản thụ hưởng</p>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">{bankInfo.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{bankInfo.acc}</p>
            </div>
          )}

          <button 
            onClick={handleSuccessClick}
            className="w-full mt-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-[0_4px_14px_rgba(16,185,129,0.25)] transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Xác nhận đã nhận tiền thành công"
          >
            <CheckCircle2 size={20} />
            Xác Nhận Đã Nhận Tiền
          </button>
        </div>
      </div>
    </div>
  );
}
