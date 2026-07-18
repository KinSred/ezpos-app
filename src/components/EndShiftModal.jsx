import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, DollarSign, Calculator, FileText, Printer, LogOut, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EndShiftModal({ onClose }) {
  const { currentShift, endShift, currentUser, logout } = useAuth();
  const [actualCash, setActualCash] = useState('');
  const [loading, setLoading] = useState(false);
  const [zReportData, setZReportData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!actualCash && actualCash !== '0') {
      toast.error("Vui lòng nhập số tiền mặt có trong két");
      return;
    }

    setLoading(true);
    const parsedCash = parseInt(actualCash.replace(/,/g, ''));
    // endShift will return shift data but won't logout automatically (false param)
    const result = await endShift(parsedCash, false);
    setLoading(false);

    if (result && result.success) {
      toast.success("Đã lưu ca! Xem báo cáo Z cuối ngày.");
      setZReportData(result);
    } else {
      toast.error(result?.error || "Lỗi khi giao ca");
    }
  };

  const handleFormatCurrency = (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val) {
      val = parseInt(val).toLocaleString('en-US');
    }
    setActualCash(val);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price || 0) + 'đ';
  };

  const handlePrintZReport = async () => {
    // In a real app, this would format an HTML string and send to the electron printer
    toast.success("Đang gửi lệnh in báo cáo Z...");
    if (window.electronAPI && window.electronAPI.silentPrint) {
       await window.electronAPI.silentPrint();
    }
  };

  const handleFinalLogout = async () => {
    await logout();
    onClose();
  };

  return (
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 glass-button rounded-full">
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
                      {formatPrice(zReportData.shiftOrders.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + (o.cashReceived || o.total) - (o.changeAmount || 0), 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Doanh thu Chuyển khoản:</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">
                      {formatPrice(zReportData.shiftOrders.filter(o => o.paymentMethod === 'transfer').reduce((sum, o) => sum + o.total, 0))}
                    </span>
                  </div>
                  
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
  );
}
