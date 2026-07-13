import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { Settings, Save, CreditCard, Building2, User, Download, Upload, Cloud, ShieldAlert, Key, Copy, Check, Receipt, Battery, ChevronDown, DownloadCloud, RefreshCw, Info, Keyboard, Command, ArrowLeft, ArrowRight, CornerDownLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { generateBackupData, restoreBackupData, syncToCloud, fetchFromCloud } from '../utils/backup';
import { motion, AnimatePresence } from 'framer-motion';

const BANKS = [
  { bin: "970436", name: "Vietcombank (VCB)" },
  { bin: "970415", name: "VietinBank (CTG)" },
  { bin: "970418", name: "BIDV" },
  { bin: "970422", name: "MBBank (MB)" },
  { bin: "970407", name: "Techcombank (TCB)" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank (VPB)" },
  { bin: "970423", name: "TPBank (TPB)" },
  { bin: "970403", name: "Sacombank (STB)" },
  { bin: "970448", name: "OCB" },
  { bin: "970428", name: "NamABank (NAB)" },
  { bin: "970431", name: "Eximbank (EIB)" },
  { bin: "970405", name: "Agribank (VBA)" },
  { bin: "970454", name: "Vietcapital Bank (BVB)" }
];

export default function SettingsScreen() {
  // Bank Settings
  const [bankBin, setBankBin] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [sepayApiKey, setSepayApiKey] = useState('');

  // Tax/VAT Settings
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRate, setVatRate] = useState('10');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [hideStockEnabled, setHideStockEnabled] = useState(false);

  // Backup & Cloud Settings
  const [storeId, setStoreId] = useState('');
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [inputStoreId, setInputStoreId] = useState('');
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);

  // Update Settings
  const [updateStatus, setUpdateStatus] = useState('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState('');

  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const bankDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target)) {
        setIsBankDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onUpdateMessage) {
      const removeListener = window.electronAPI.onUpdateMessage((msg) => {
        switch (msg.type) {
          case 'checking':
            setUpdateStatus('checking');
            break;
          case 'update-available':
            setUpdateStatus('available');
            break;
          case 'update-not-available':
            setUpdateStatus('not-available');
            setTimeout(() => setUpdateStatus('idle'), 3000);
            break;
          case 'error':
            setUpdateStatus('error');
            setUpdateError(msg.error);
            setTimeout(() => setUpdateStatus('idle'), 5000);
            break;
          case 'download-progress':
            setUpdateStatus('downloading');
            setUpdateProgress(Math.floor(msg.progress.percent));
            break;
          case 'update-downloaded':
            setUpdateStatus('downloaded');
            break;
          default:
            break;
        }
      });
      return () => removeListener();
    }
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const bin = await db.settings.get('bankBin');
      const acc = await db.settings.get('bankAccount');
      const name = await db.settings.get('bankAccountName');
      const sId = await db.settings.get('storeId');
      const sync = await db.settings.get('cloudSyncEnabled');
      const vatEn = await db.settings.get('vatEnabled');
      const vatR = await db.settings.get('vatRate');
      const sepayKey = await db.settings.get('sepayApiKey');
      const autoPrint = await db.settings.get('autoPrint');
      const hideStock = await db.settings.get('hideStock');

      if (bin) setBankBin(bin.value);
      if (acc) setBankAccount(acc.value);
      if (name) setBankAccountName(name.value);
      if (sId) setStoreId(sId.value);
      if (sync) setCloudSyncEnabled(sync.value === 'true');
      if (vatEn) setVatEnabled(vatEn.value === 'true');
      if (vatR) setVatRate(vatR.value);
      if (sepayKey) setSepayApiKey(sepayKey.value);
      if (autoPrint) setAutoPrintEnabled(autoPrint.value === 'true');
      if (hideStock) setHideStockEnabled(hideStock.value === 'true');
    };
    loadSettings();
  }, []);

  const handleToggleAutoPrint = async (e) => {
    const enabled = e.target.checked;
    setAutoPrintEnabled(enabled);
    await db.settings.put({ key: 'autoPrint', value: enabled ? 'true' : 'false' });
    if (enabled) {
      toast.success("Đã bật tự động in hóa đơn!");
    } else {
      toast.success("Đã tắt tự động in hóa đơn.");
    }
  };

  const handleToggleHideStock = async (e) => {
    const enabled = e.target.checked;
    setHideStockEnabled(enabled);
    await db.settings.put({ key: 'hideStock', value: enabled ? 'true' : 'false' });
    if (enabled) {
      toast.success("Đã ẩn số lượng tồn kho!");
    } else {
      toast.success("Đã hiển thị số lượng tồn kho.");
    }
  };

  const handleSaveTax = async (e) => {
    e.preventDefault();
    try {
      await db.settings.bulkPut([
        { key: 'vatEnabled', value: vatEnabled ? 'true' : 'false' },
        { key: 'vatRate', value: vatRate }
      ]);
      toast.success("Đã lưu cấu hình thuế VAT!");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi lưu cấu hình thuế.");
    }
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    try {
      await db.settings.bulkPut([
        { key: 'bankBin', value: bankBin },
        { key: 'bankAccount', value: bankAccount },
        { key: 'bankAccountName', value: bankAccountName.toUpperCase() },
        { key: 'sepayApiKey', value: sepayApiKey }
      ]);
      toast.success("Đã lưu cấu hình ngân hàng & SePay!");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi lưu cấu hình.");
    }
  };

  const handleExport = async () => {
    try {
      const data = await generateBackupData();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("download", `pos_pro_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Đã xuất file sao lưu JSON thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xuất file sao lưu.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (confirm("CẢNH BÁO: Nhập dữ liệu mới sẽ GHI ĐÈ & XÓA SẠCH toàn bộ sản phẩm, hóa đơn và thông tin hiện tại trên trình duyệt này. Bạn có chắc chắn muốn khôi phục?")) {
          await restoreBackupData(data);
          toast.success("Khôi phục dữ liệu thành công!");
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch (err) {
        console.error(err);
        toast.error("File sao lưu không hợp lệ.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleToggleCloudSync = async (e) => {
    const enabled = e.target.checked;
    setCloudSyncEnabled(enabled);
    await db.settings.put({ key: 'cloudSyncEnabled', value: enabled ? 'true' : 'false' });

    if (enabled) {
      const myStoreId = storeId || 'POS-DEFAULT';
      const success = await syncToCloud(myStoreId);
      if (success) {
        toast.success("Đã kích hoạt đồng bộ đám mây và lưu bản sao đầu tiên!");
      } else {
        toast.error("Không thể lưu bản sao lên đám mây. Vui lòng kiểm tra kết nối.");
      }
    } else {
      toast.success("Đã tắt đồng bộ đám mây ngầm.");
    }
  };

  const handleCloudRestore = async () => {
    const targetId = inputStoreId.trim().toUpperCase();
    if (!targetId) {
      toast.error("Vui lòng nhập Mã ID Cửa hàng.");
      return;
    }

    if (confirm(`CẢNH BÁO: Khôi phục dữ liệu từ Đám mây cho mã "${targetId}" sẽ XÓA SẠCH toàn bộ dữ liệu hiện tại trên thiết bị này. Bạn có muốn tiếp tục?`)) {
      toast.loading("Đang kết nối đám mây...");
      const data = await fetchFromCloud(targetId);
      toast.dismiss();

      if (data) {
        try {
          await restoreBackupData(data);
          await db.settings.put({ key: 'storeId', value: targetId });
          await db.settings.put({ key: 'cloudSyncEnabled', value: 'true' });
          toast.success("Đã khôi phục dữ liệu từ Đám mây thành công!");
          setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
          toast.error("Có lỗi xảy ra khi khôi phục dữ liệu.");
        }
      } else {
        toast.error("Không tìm thấy dữ liệu hoặc mã ID cửa hàng không tồn tại trên hệ thống.");
      }
    }
  };

  const copyStoreId = () => {
    navigator.clipboard.writeText(storeId);
    setCopied(true);
    toast.success("Đã sao chép Mã ID Cửa hàng!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckUpdate = () => {
    if (window.electronAPI?.checkForUpdates) {
      window.electronAPI.checkForUpdates();
    } else {
      toast.error('Chức năng cập nhật chỉ khả dụng trên ứng dụng Desktop.');
    }
  };

  const handleDownloadUpdate = () => {
    if (window.electronAPI?.downloadUpdate) {
      window.electronAPI.downloadUpdate();
    }
  };

  const handleInstallUpdate = () => {
    if (window.electronAPI?.installUpdate) {
      window.electronAPI.installUpdate();
    }
  };

  return (
    <div className="h-full bg-transparent p-6 overflow-y-auto transition-colors duration-200" aria-label="Giao diện cài đặt hệ thống">
      <div className="max-w-6xl mx-auto mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-sky-950 dark:text-white tracking-tight flex items-center gap-3">
            <Settings className="text-sky-600 dark:text-cyan-400" size={32} />
            Cài Đặt Hệ Thống
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* CỘT TRÁI: Cấu hình Ngân hàng & Thuế */}
          <div className="space-y-8 flex flex-col">
            {/* Cấu hình VietQR */}
            <div className="glass-card rounded-3xl p-6 flex flex-col gap-5 transition-colors duration-500 border border-slate-200/40 dark:border-slate-800/40 shadow-sm">
              <div>
                <h2 className="text-lg font-extrabold text-slate-850 dark:text-white mb-1 flex items-center gap-2">
                  <CreditCard className="text-sky-600 dark:text-cyan-400" size={20} />
                  Cấu Hình VietQR
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Cài đặt tài khoản ngân hàng để tạo mã QR động thanh toán tự động khi bán hàng.
                </p>
              </div>

              <form onSubmit={handleSaveBank} className="flex flex-col gap-4">
                <div className="space-y-4">
                  <div className="relative" ref={bankDropdownRef}>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-450 dark:text-slate-500 mb-1.5 uppercase tracking-widest">
                      Ngân Hàng (VietQR)
                    </label>
                    <div 
                      onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border rounded-2xl font-extrabold text-sm flex justify-between items-center cursor-pointer transition-all ${isBankDropdownOpen ? 'border-sky-500 ring-2 ring-sky-500/20 text-slate-850 dark:text-slate-100 bg-white dark:bg-slate-950' : 'border-slate-200/50 dark:border-slate-800/80 text-slate-850 dark:text-slate-100 hover:border-sky-500/50'}`}
                    >
                      <span className={!bankBin ? "text-slate-400 font-normal" : ""}>
                        {bankBin ? BANKS.find(b => b.bin === bankBin)?.name || "Đã chọn ngân hàng" : "-- Chọn ngân hàng --"}
                      </span>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${isBankDropdownOpen ? 'rotate-180 text-sky-500' : ''}`} />
                    </div>
                    
                    <AnimatePresence>
                      {isBankDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.15 }}
                          className="absolute z-10 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-xl max-h-60 overflow-y-auto"
                        >
                          <div
                            onClick={() => { setBankBin(''); setIsBankDropdownOpen(false); }}
                            className={`px-4 py-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!bankBin ? 'font-extrabold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/10' : 'text-slate-600 dark:text-slate-300'}`}
                          >
                            -- Chọn ngân hàng --
                          </div>
                          {BANKS.map((bank) => (
                            <div
                              key={bank.bin}
                              onClick={() => { setBankBin(bank.bin); setIsBankDropdownOpen(false); }}
                              className={`px-4 py-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-50 dark:border-slate-800/50 ${bankBin === bank.bin ? 'font-extrabold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/10' : 'text-slate-600 dark:text-slate-300'}`}
                            >
                              {bank.name}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-455 dark:text-slate-500 mb-1.5 uppercase tracking-widest">
                      Số Tài Khoản
                    </label>
                    <input
                      type="text"
                      required
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl text-slate-850 dark:text-slate-100 font-mono font-extrabold text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                      placeholder="Nhập số tài khoản ngân hàng..."
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-455 dark:text-slate-500 mb-1.5 uppercase tracking-widest">
                      Tên Chủ Tài Khoản
                    </label>
                    <input
                      type="text"
                      required
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl text-slate-850 dark:text-slate-100 font-extrabold text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 uppercase transition-all"
                      placeholder="VD: NGUYEN VAN A"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-455 dark:text-slate-500 mb-1.5 uppercase tracking-widest">
                      SePay API Key (Tự động xác nhận)
                    </label>
                    <input
                      type="password"
                      value={sepayApiKey}
                      onChange={(e) => setSepayApiKey(e.target.value)}
                      className="w-full px-4 py-3 bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/10 dark:border-emerald-500/10 rounded-2xl text-emerald-800 dark:text-emerald-400 font-mono text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      placeholder="Nhập API Key từ SePay..."
                    />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1">Bỏ trống nếu không sử dụng tự động xác nhận chuyển khoản.</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 flex justify-end">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-sky-500/15 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <Save size={16} />
                    Lưu Cấu Hình Ngân Hàng
                  </motion.button>
                </div>
              </form>
            </div>

            {/* Cấu hình Thuế VAT */}
            <div className="glass-card rounded-3xl p-6 flex flex-col gap-5 transition-colors duration-500 border border-slate-200/40 dark:border-slate-800/40 shadow-sm">
              <div>
                <h2 className="text-lg font-extrabold text-slate-850 dark:text-white mb-1 flex items-center gap-2">
                  <Receipt className="text-sky-600 dark:text-cyan-400" size={20} />
                  Cấu Hình Hóa Đơn & Thuế
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Bật/Tắt tính năng xuất hóa đơn VAT và điều chỉnh thuế suất VAT mặc định của cửa hàng.
                </p>
              </div>

              <form onSubmit={handleSaveTax} className="flex flex-col gap-4">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/40 dark:border-slate-800/60 transition-all">
                  <div className="pr-3">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">Tự động in hóa đơn</label>
                    <span className="text-[10px] text-slate-450 dark:text-slate-550 block mt-0.5 leading-normal">Tự động kích hoạt lệnh in sau khi thanh toán thành công</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={autoPrintEnabled}
                      onChange={handleToggleAutoPrint}
                      className="sr-only peer"
                      aria-label="Tự động in hóa đơn"
                    />
                    <div className="w-10 h-5.5 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-500 focus:outline-none"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/40 dark:border-slate-800/60 transition-all">
                  <div className="pr-3">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">Tắt theo dõi hàng tồn kho</label>
                    <span className="text-[10px] text-slate-450 dark:text-slate-550 block mt-0.5 leading-normal">Ẩn số lượng tồn kho và các cảnh báo hết hàng (Dành cho cửa hàng không muốn kiểm kho)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={hideStockEnabled}
                      onChange={handleToggleHideStock}
                      className="sr-only peer"
                      aria-label="Tắt theo dõi hàng tồn kho"
                    />
                    <div className="w-10 h-5.5 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-500 focus:outline-none"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/40 dark:border-slate-800/60 transition-all">
                  <div className="pr-3">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">Kích hoạt Hóa đơn VAT</label>
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 block mt-0.5 leading-normal">Tự động hiển thị và tính toán thuế VAT khi thanh toán và in</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={vatEnabled}
                      onChange={(e) => setVatEnabled(e.target.checked)}
                      className="sr-only peer"
                      aria-label="Kích hoạt Hóa đơn VAT"
                    />
                    <div className="w-10 h-5.5 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-500 focus:outline-none"></div>
                  </label>
                </div>

                <AnimatePresence>
                  {vatEnabled && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-455 dark:text-slate-500 mb-1.5 uppercase tracking-widest pt-2">
                        Thuế suất VAT (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          required
                          value={vatRate}
                          onChange={(e) => setVatRate(e.target.value)}
                          className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl text-slate-850 dark:text-slate-100 font-mono font-extrabold text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="VD: 10..."
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400">%</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 flex justify-end">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-sky-500/15 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <Save size={16} />
                    Lưu Cấu Hóa Đơn VAT
                  </motion.button>
                </div>
              </form>
            </div>
          </div>

          {/* CỘT PHẢI: Sao Lưu & Khôi Phục Dữ Liệu */}
          <div className="space-y-8 flex flex-col">
            <div className="glass-card rounded-3xl p-6 border border-slate-200/40 dark:border-slate-800/40 shadow-sm flex flex-col gap-6 transition-colors duration-200">
              <div>
                <h2 className="text-lg font-extrabold text-slate-850 dark:text-white mb-1 flex items-center gap-2">
                <Cloud className="text-sky-600 dark:text-cyan-400" size={20} />
                Bảo Vệ & Sao Lưu Dữ Liệu
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-550">
                Tránh mất dữ liệu bán hàng khi cài đặt lại hệ điều hành hoặc chuyển sang máy tính mới.
              </p>
            </div>

            {/* Mục 1: Thủ công JSON */}
            <div className="border-b border-slate-100 dark:border-slate-800/50 pb-5">
              <h3 className="text-[10px] font-bold text-slate-455 dark:text-slate-500 mb-3 uppercase tracking-widest">Sao lưu thủ công (JSON)</h3>
              <div className="flex gap-4">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold rounded-2xl text-xs sm:text-sm transition-all focus:outline-none border border-slate-200/30 dark:border-slate-800/40"
                >
                  <Download size={16} />
                  Tải Bản Sao (.json)
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleImportClick}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold rounded-2xl text-xs sm:text-sm transition-all focus:outline-none border border-slate-200/30 dark:border-slate-800/40"
                >
                  <Upload size={16} />
                  Nhập File Khôi Phục
                </motion.button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json"
                  className="hidden"
                />
              </div>
            </div>

            {/* Mục 2: Đồng bộ đám mây ẩn danh */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Cloud size={14} className="text-slate-400 dark:text-slate-500" />
                  Đồng bộ đám mây tự động
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cloudSyncEnabled}
                    onChange={handleToggleCloudSync}
                    className="sr-only peer"
                    aria-label="Kích hoạt tự động đồng bộ đám mây"
                  />
                  <div className="w-10 h-5.5 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-500 focus:outline-none"></div>
                </label>
              </div>

              {/* Box hiển thị Store ID */}
              <div className="bg-indigo-500/5 dark:bg-indigo-500/10 rounded-2xl p-4 flex items-center justify-between border border-indigo-500/10 mb-4 transition-colors duration-200">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/10 dark:bg-indigo-500/20 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Key size={18} />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Mã ID Cửa Hàng của bạn</div>
                    <div className="font-mono text-base font-black text-slate-900 dark:text-slate-100 tracking-wide">{storeId}</div>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={copyStoreId}
                  className="p-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-all focus:outline-none border border-slate-200/30 dark:border-slate-800/35"
                  title="Sao chép Store ID"
                  aria-label="Sao chép mã ID cửa hàng"
                >
                  {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                </motion.button>
              </div>

              <div className="text-[11px] font-semibold text-slate-550 dark:text-slate-450 leading-relaxed mb-5">
                💡 **Lưu ý bảo mật:** Hãy sao chép và cất giữ Mã ID này. Khi cần đổi máy tính hoặc khôi phục dữ liệu cũ, chỉ cần nhập mã này vào ô bên dưới.
              </div>

              {/* Ô Nhập để khôi phục từ Cloud */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputStoreId}
                  onChange={(e) => setInputStoreId(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl text-slate-950 dark:text-slate-100 font-mono font-extrabold text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all uppercase"
                  placeholder="Nhập Mã ID cũ để khôi phục..."
                  aria-label="Mã ID cửa hàng cũ để khôi phục"
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCloudRestore}
                  className="px-5 py-3 bg-sky-600 dark:bg-sky-500 hover:bg-sky-700 dark:hover:bg-sky-600 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md transition-all focus:outline-none"
                >
                  Khôi Phục
                </motion.button>
              </div>
            </div>
          </div>

          {/* Mục Cập Nhật Phần Mềm */}
          <div className="glass-card rounded-3xl p-6 border border-slate-200/40 dark:border-slate-800/40 shadow-sm flex flex-col gap-5 transition-colors duration-200">
              <div>
                <h2 className="text-lg font-extrabold text-slate-850 dark:text-white mb-1 flex items-center gap-2">
                  <DownloadCloud className="text-sky-600 dark:text-cyan-400" size={20} />
                  Thông Tin Cập Nhật
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-550">
                  Phiên bản hiện tại: <strong className="text-sky-600 dark:text-sky-400 text-sm">v1.0.1</strong>
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 flex flex-col items-center justify-center gap-4 border border-slate-100 dark:border-slate-800/60 text-center">
                {updateStatus === 'idle' && (
                  <>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Hệ thống đang sử dụng phiên bản ổn định.</p>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleCheckUpdate}
                      className="px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50 font-extrabold rounded-2xl text-xs sm:text-sm shadow-sm transition-all focus:outline-none flex items-center gap-2"
                    >
                      <RefreshCw size={16} />
                      Kiểm Tra Bản Cập Nhật
                    </motion.button>
                  </>
                )}
                
                {updateStatus === 'checking' && (
                  <div className="flex flex-col items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-sm">
                    <RefreshCw size={24} className="animate-spin" />
                    <span>Đang kiểm tra phiên bản mới...</span>
                  </div>
                )}

                {updateStatus === 'not-available' && (
                  <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    <Check size={24} />
                    <span>Bạn đang dùng phiên bản mới nhất!</span>
                  </div>
                )}

                {updateStatus === 'available' && (
                  <>
                    <div className="flex flex-col items-center gap-1 text-sky-600 dark:text-sky-400">
                      <Info size={24} />
                      <span className="font-bold text-sm">Có bản cập nhật mới!</span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleDownloadUpdate}
                      className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md transition-all focus:outline-none flex items-center gap-2"
                    >
                      <Download size={16} />
                      Tải Xuống Ngay
                    </motion.button>
                  </>
                )}

                {updateStatus === 'downloading' && (
                  <div className="w-full flex flex-col items-center gap-3">
                    <span className="text-sm font-bold text-sky-600 dark:text-sky-400">Đang tải xuống: {updateProgress}%</span>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-gradient-to-r from-sky-400 to-blue-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${updateProgress}%` }}></div>
                    </div>
                  </div>
                )}

                {updateStatus === 'downloaded' && (
                  <>
                    <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      <Check size={24} />
                      <span>Đã tải xong bản cập nhật!</span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleInstallUpdate}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md transition-all focus:outline-none flex items-center gap-2"
                    >
                      Khởi Động Lại & Cài Đặt
                    </motion.button>
                  </>
                )}

                {updateStatus === 'error' && (
                  <div className="flex flex-col items-center gap-2 text-rose-500 font-bold text-sm">
                    <ShieldAlert size={24} />
                    <span>Lỗi kiểm tra cập nhật: {updateError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mục Hướng dẫn Phím Tắt */}
            <div className="glass-card rounded-3xl p-6 border border-slate-200/40 dark:border-slate-800/40 shadow-sm flex flex-col gap-5 transition-colors duration-200">
              <div>
                <h2 className="text-lg font-extrabold text-slate-850 dark:text-white mb-1 flex items-center gap-2">
                  <Keyboard className="text-purple-600 dark:text-purple-400" size={20} />
                  Hướng Dẫn Phím Tắt
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-550">
                  Tối ưu hóa thao tác để bán hàng nhanh hơn bằng bàn phím.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cột 1 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Thanh Toán</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm">Enter</kbd>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tìm Sản Phẩm</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1"><Command size={12} />/Ctrl + F</kbd>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tìm Khách Hàng</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1"><Command size={12} />/Ctrl + U</kbd>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Chuyển Giá Sỉ/Lẻ</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1"><Command size={12} />/Ctrl + D</kbd>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nhập Giảm Giá</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1"><Command size={12} />/Ctrl + G</kbd>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Đổi Hình Thức Thanh Toán</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1"><ArrowLeft size={12} /> / <ArrowRight size={12} /></kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Điền Tiền Nhanh (VD: 50k)</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1">Gõ 50 <CornerDownLeft size={12} /></kbd>
                    </div>
                  </div>
                  {/* Cột 2 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Thêm Giỏ Hàng Mới</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1"><Command size={12} />/Ctrl + T</kbd>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Chuyển Giỏ Hàng</span>
                      <div className="flex gap-1">
                        <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1"><Command size={12} />/Ctrl + [</kbd>
                        <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm">]</kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Đóng Hộp Thoại</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm">ESC</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Chỉnh Số Lượng SP</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm">↑ ↓</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
