import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';
import { execFile } from 'node:child_process';
import { Socket } from 'node:net';
import ptp from 'pdf-to-printer';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

let mainWindow;

const runExecutable = (file, args) => new Promise((resolve, reject) => {
  execFile(file, args, { windowsHide: true }, (error) => {
    if (error) {
      reject(error);
      return;
    }
    resolve();
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    show: false, // Don't show until ready to prevent flickering
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Remove default menu for a cleaner POS look
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    // In development, load from Vite dev server (which uses HTTPS because of basicSsl)
    mainWindow.loadURL('https://localhost:5173');
    // Tạm thời tắt DevTools khi triển khai
    // mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handler for Silent Printing using PDF Spooler (Bypass Driver Limits)
ipcMain.handle('print-receipt', async () => {
  if (!mainWindow) return { success: false, error: 'No active window' };

  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    
    // Tìm máy in XP-80C, POS, hoặc máy in mặc định
    const targetPrinter = printers.find(p => 
      p.name.toUpperCase().includes('XP-') || 
      p.name.toUpperCase().includes('POS') || 
      p.isDefault
    );

    const deviceName = targetPrinter ? targetPrinter.name : (printers.length > 0 ? printers[0].name : '');
    if (!deviceName) {
      return { success: false, error: 'Không tìm thấy bất kỳ máy in nào trên hệ thống' };
    }

    // Lấy chiều cao thực tế của hóa đơn (tính bằng pixel)
    const heightInPixels = await mainWindow.webContents.executeJavaScript(`
      (function() {
        const el = document.querySelector('.print-only');
        return el ? el.offsetHeight : 0;
      })();
    `).catch(() => 0);

    // Khổ PDF là 64mm để khớp với @page size: 64mm trong CSS.
    // Driver CUPS sẽ in file 64mm này lên giấy 80mm và tự canh giữa.
    const widthInInches = 2.520; // 64mm = 2.520 inches
    let heightInInches = 11.811; // Mặc định 30cm nếu không lấy được chiều cao

    if (heightInPixels > 0) {
      // Cộng thêm 0.5 inch lề dưới cho máy dễ cắt
      heightInInches = (heightInPixels / 96) + 0.5;
    }

    // 1. Tạo file PDF từ màn hình hóa đơn (HTML) bằng Electron
    const pdfBuffer = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: { width: widthInInches, height: heightInInches },
      margins: { marginType: 'none' }
    });

    // 2. Lưu file PDF vào bộ nhớ đệm tạm thời
    const tempPdfPath = path.join(os.tmpdir(), `ezpos_receipt_${Date.now()}.pdf`);
    await fs.writeFile(tempPdfPath, pdfBuffer);

    // 3. Đẩy file PDF vào bộ đệm máy in tương ứng với từng Hệ điều hành
    if (process.platform === 'win32') {
      // Trên Windows: Dùng SumatraPDF (qua pdf-to-printer) với scale noscale
      await ptp.print(tempPdfPath, { 
        printer: deviceName,
        scale: "noscale"
      });
    } else if (process.platform === 'darwin') {
      // Trên macOS: Sử dụng lệnh native `lp` của hệ thống in ấn CUPS tích hợp sẵn
      await runExecutable('lp', ['-d', deviceName, tempPdfPath]).catch((error) => {
        console.error('Lỗi lệnh lp trên macOS:', error);
        throw new Error('Lỗi lệnh lp trên macOS: ' + error.message);
      });
    }

    // 4. Xóa file PDF tạm sau khi in xong
    fs.unlink(tempPdfPath).catch(() => {});

    return { success: true };
  } catch (err) {
    console.error('Lỗi in ngầm PDF:', err);
    return { success: false, error: err.message };
  }
});

// --- IPC Handler for Raw ESC/POS via TCP/IP ---
ipcMain.handle('print-raw-tcp', async (_event, payload = {}) => {
  const { ip, port = 9100, bufferData } = payload || {};
  if (typeof ip !== 'string' || !ip.trim() || ip.length > 253) {
    return { success: false, error: 'Địa chỉ máy in không hợp lệ' };
  }

  const normalizedPort = Number(port);
  if (!Number.isInteger(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535) {
    return { success: false, error: 'Cổng máy in không hợp lệ' };
  }

  if (!Array.isArray(bufferData) || bufferData.length === 0 || bufferData.length > 20 * 1024 * 1024) {
    return { success: false, error: 'Dữ liệu in không hợp lệ' };
  }

  if (!bufferData.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    return { success: false, error: 'Dữ liệu in chứa byte không hợp lệ' };
  }

  // Buffer ESC/POS đã được encoder ở renderer tạo đúng encoding. Gửi nguyên byte để
  // không phá các lệnh điều khiển hoặc dữ liệu ảnh raster bằng một vòng UTF-8/CP1258.
  const rawBuffer = Buffer.from(bufferData);

  return new Promise((resolve) => {
    const client = new Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      client.destroy();
      resolve(result);
    };

    client.setTimeout(5000);

    client.once('error', (err) => {
      console.error('Lỗi in TCP:', err);
      finish({ success: false, error: err.message });
    });

    client.once('timeout', () => {
      console.error('TCP Timeout');
      finish({ success: false, error: 'Connection timeout' });
    });

    client.connect(normalizedPort, ip.trim(), () => {
      client.end(rawBuffer, () => finish({ success: true }));
    });
  });
});

// --- IPC Handler for Raw ESC/POS via USB (macOS lp -o raw) ---
ipcMain.handle('print-raw-usb', async (_event, payload = {}) => {
  const { deviceName, bufferData } = payload || {};
  let tempBinPath;
  try {
    // Tìm máy in nếu không truyền tên
    let targetDeviceName = deviceName;
    if (!targetDeviceName) {
      const printers = await mainWindow.webContents.getPrintersAsync();
      const targetPrinter = printers.find(p => p.isDefault) || printers[0];
      targetDeviceName = targetPrinter?.name;
    }

    if (typeof targetDeviceName !== 'string' || !targetDeviceName.trim() || targetDeviceName.length > 255) {
      return { success: false, error: 'Không tìm thấy máy in USB' };
    }
    targetDeviceName = targetDeviceName.trim();

    if (!Array.isArray(bufferData) || bufferData.length === 0 || bufferData.length > 20 * 1024 * 1024) {
      return { success: false, error: 'Dữ liệu in không hợp lệ' };
    }

    if (!bufferData.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      return { success: false, error: 'Dữ liệu in chứa byte không hợp lệ' };
    }

    tempBinPath = path.join(os.tmpdir(), `ezpos_raw_${Date.now()}.bin`);
    
    // Ghi trực tiếp raw buffer ra file, không convert string để tránh hỏng dữ liệu Raster/ESC_POS
    const rawBuffer = Buffer.from(bufferData);
    await fs.writeFile(tempBinPath, rawBuffer);
    
    if (process.platform === 'darwin') {
      await runExecutable('lp', ['-d', targetDeviceName, '-o', 'raw', tempBinPath]).catch((error) => {
        throw new Error('Lỗi lệnh lp raw trên macOS: ' + error.message);
      });
    } else {
      return { success: false, error: 'Hệ điều hành chưa hỗ trợ in RAW USB trực tiếp.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Lỗi in RAW USB:', err);
    return { success: false, error: err.message };
  } finally {
    if (tempBinPath) fs.unlink(tempBinPath).catch(() => {});
  }
});

// --- Auto Updater Setup ---
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    // Trả về lỗi giả trong môi trường dev để test UI
    if (mainWindow) {
      setTimeout(() => mainWindow.webContents.send('update-message', { type: 'checking' }), 500);
      setTimeout(() => mainWindow.webContents.send('update-message', { type: 'update-not-available' }), 1500);
    }
    return { success: true, message: 'Dev mode: Mock check' };
  }
  
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result };
  } catch (err) {
    if (mainWindow) mainWindow.webContents.send('update-message', { type: 'error', error: err.message });
    return { success: false, error: err.message };
  }
});

ipcMain.handle('download-update', async () => {
  if (isDev) {
    if (mainWindow) {
      let percent = 0;
      const interval = setInterval(() => {
        percent += 20;
        mainWindow.webContents.send('update-message', { type: 'download-progress', progress: { percent } });
        if (percent >= 100) {
          clearInterval(interval);
          mainWindow.webContents.send('update-message', { type: 'update-downloaded' });
        }
      }, 500);
    }
    return { success: true };
  }
  
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-update', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall();
  }
});

autoUpdater.on('checking-for-update', () => {
  if (mainWindow) mainWindow.webContents.send('update-message', { type: 'checking' });
});
autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-message', { type: 'update-available', info });
});
autoUpdater.on('update-not-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-message', { type: 'update-not-available', info });
});
autoUpdater.on('error', (err) => {
  if (mainWindow) mainWindow.webContents.send('update-message', { type: 'error', error: err.message });
});
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) mainWindow.webContents.send('update-message', { type: 'download-progress', progress: progressObj });
});
autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-message', { type: 'update-downloaded', info });
});

// App lifecycle
// Chỉ bỏ qua lỗi SSL (do Vite self-signed) trong môi trường Development
if (isDev) {
  app.commandLine.appendSwitch('ignore-certificate-errors');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
