import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Square, Calculator, FileText, Printer, LogOut, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EndShiftModal({ onClose }) {
  const { currentShift, endShift, currentUser, logout } = useAuth();
  const [actualCash, setActualCash] = useState('');
  const [loading, setLoading] = useState(false);
  const [zReportData, setZReportData] = useState(null);
  const submitLockRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    if (!actualCash && actualCash !== '0') {
      toast.error("Vui lòng nhập số tiền mặt có trong két");
      return;
    }

    submitLockRef.current = true;
    setLoading(true);
    try {
      const parsedCash = parseInt(actualCash.replace(/,/g, ''), 10);
      // Keep the user signed in long enough to inspect/print the Z-report.
      const result = await endShift(parsedCash, false);
      if (result && result.success) {
        toast.success("Đã lưu ca! Xem báo cáo Z cuối ngày.");
        setZReportData(result);
      } else {
        toast.error(result?.error || "Lỗi khi giao ca");
      }
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  const handleFormatCurrency = (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val) {
      val = parseInt(val, 10).toLocaleString('en-US');
    }
    setActualCash(val);
  };

  const formatPrice = (price) => {
    const amount = Number(price);
    return new Intl.NumberFormat('vi-VN').format(Number.isFinite(amount) ? amount : 0) + 'đ';
  };

  const handlePrintZReport = async () => {
    try {
      if (window.electronAPI && typeof window.electronAPI.silentPrint === 'function') {
        const result = await window.electronAPI.silentPrint({
          type: 'z-report',
          shiftId: zReportData?.shift?.id
        });
        if (!result?.success) {
          throw new Error(result?.error || 'Máy in không phản hồi');
        }
      } else {
        window.print();
      }
      toast.success("Đã gửi báo cáo Z đến máy in");
    } catch (error) {
      toast.error(`Không thể in báo cáo Z: ${error.message}`);
    }
  };

  const handleFinalLogout = async () => {
    await logout();
    onClose();
  };

  const paymentSummary = zReportData?.paymentSummary || {
    cash: 0,
    transfer: 0,
    credit: 0,
    total: 0
  };
  const collectionSummary = zReportData?.collectionSummary || { cash: 0, transfer: 0, total: 0 };

  const reportTime = zReportData?.shift?.endTime || Date.now();

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="glass-card rounded-3xl shadow-2xl w-full max-w-md overflow-hidden bg-white/90 dark:bg-slate-900/90 border border-white/20"
        >
          {zReportData ? (
            <div className="p-6 h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 glass-panel text-sky-500 rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Báo Cáo Cuối Ca (Z-Report)</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{format(new Date(reportTime), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>
                <button onClick={handleFinalLogout} className="p-2 text-slate-400 hover:text-slate-600 glass-button rounded-full" title="Đăng xuất">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 py-2">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span>Tiền mặt đầu ca:</span>
                    <span className="font-bold">{formatPrice(zReportData.shift.startingCash)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Doanh thu Tiền mặt:</span>
                    <span className="font-bold">
                      {formatPrice(paymentSummary.cash)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Doanh thu Chuyển khoản/QR:</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">
                      {formatPrice(paymentSummary.transfer)}
                    </span>
                  </div>
                  {collectionSummary.total > 0 && (
                    <>
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                        <span>Thu nợ tiền mặt:</span>
                        <span className="font-bold">{formatPrice(collectionSummary.cash)}</span>
                      </div>
                      <div className="flex justify-between text-sky-700 dark:text-sky-400">
                        <span>Thu nợ chuyển khoản:</span>
                        <span className="font-bold">{formatPrice(collectionSummary.transfer)}</span>
                      </div>
                    </>
                  )}
                  {paymentSummary.credit > 0 && (
                    <div className="flex justify-between">
                      <span>Doanh thu ghi nợ:</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {formatPrice(paymentSummary.credit)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span>Tổng tiền mặt trên máy tính:</span>
                    <span className="font-bold">{formatPrice(zReportData.expectedCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tiền mặt thực tế (đã nhập):</span>
                    <span className="font-bold">{formatPrice(zReportData.shift.actualCash)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span>Chênh lệch:</span>
                    <span className={`font-bold ${zReportData.difference < 0 ? 'text-rose-500' : zReportData.difference > 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                      {zReportData.difference > 0 ? '+' : ''}{formatPrice(zReportData.difference)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handlePrintZReport}
                  className="flex-1 py-3.5 px-4 glass-button text-sky-600 dark:text-sky-400 rounded-xl font-bold flex items-center justify-center gap-2 border border-sky-200/30 dark:border-sky-800/30"
                >
                  <Printer size={18} /> In Báo Cáo
                </button>
                <button
                  type="button"
                  onClick={handleFinalLogout}
                  className="flex-[1.5] py-3.5 px-4 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <LogOut size={18} /> Đăng Xuất
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 glass-panel text-amber-500 rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                  <Square size={24} fill="currentColor" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Giao Ca & Kết Thúc</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Thu ngân: {currentUser?.name}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass-panel p-4 rounded-2xl space-y-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-200/50">
                  <div className="flex justify-between">
                    <span>Tiền đầu ca:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {(currentShift?.startingCash || 0).toLocaleString()} VNĐ
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs opacity-75">
                    <span className="flex items-center gap-1"><Calculator size={14}/> Hệ thống sẽ tự tính tiền bán được.</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Kiểm đếm tiền mặt thực tế trong két</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">VNĐ</span>
                    <input
                      type="text"
                      value={actualCash}
                      onChange={handleFormatCurrency}
                      placeholder="VD: 1,500,000"
                      className="w-full pl-14 pr-4 py-3 glass-input rounded-xl text-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-sm"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3.5 px-4 glass-button text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-500/30 flex items-center justify-center disabled:opacity-50 border border-white/20 backdrop-blur-sm"
                  >
                    {loading ? 'Đang xử lý...' : 'Xác Nhận Kết Thúc'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </motion.div>
        </div>
      </AnimatePresence>

      {zReportData && createPortal(
        <div className="print-only text-[12px] leading-relaxed">
          <div className="text-center font-bold text-lg">BÁO CÁO CUỐI CA</div>
          <div className="text-center mb-3">{format(new Date(reportTime), 'dd/MM/yyyy HH:mm')}</div>
          <div>Thu ngân: <strong>{currentUser?.name || '—'}</strong></div>
          <div>Mã ca: <strong>#{zReportData.shift.id}</strong></div>
          <div className="border-t border-dashed border-black my-2" />
          <div className="flex justify-between"><span>Tiền đầu ca</span><strong>{formatPrice(zReportData.shift.startingCash)}</strong></div>
          <div className="flex justify-between"><span>Tiền mặt bán hàng</span><strong>{formatPrice(paymentSummary.cash)}</strong></div>
          <div className="flex justify-between"><span>Chuyển khoản/QR</span><strong>{formatPrice(paymentSummary.transfer)}</strong></div>
          <div className="flex justify-between"><span>Ghi nợ</span><strong>{formatPrice(paymentSummary.credit)}</strong></div>
          <div className="flex justify-between"><span>Thu nợ tiền mặt</span><strong>{formatPrice(collectionSummary.cash)}</strong></div>
          <div className="flex justify-between"><span>Thu nợ chuyển khoản</span><strong>{formatPrice(collectionSummary.transfer)}</strong></div>
          <div className="flex justify-between"><span>Tổng doanh thu</span><strong>{formatPrice(paymentSummary.total)}</strong></div>
          <div className="border-t border-dashed border-black my-2" />
          <div className="flex justify-between"><span>Tiền mặt dự kiến</span><strong>{formatPrice(zReportData.expectedCash)}</strong></div>
          <div className="flex justify-between"><span>Tiền mặt thực tế</span><strong>{formatPrice(zReportData.shift.actualCash)}</strong></div>
          <div className="flex justify-between text-base mt-1"><span>Chênh lệch</span><strong>{formatPrice(zReportData.difference)}</strong></div>
        </div>,
        document.body
      )}
    </>
  );
}
