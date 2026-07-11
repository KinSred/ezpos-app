import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';
import ptp from 'pdf-to-printer';
import { autoUpdater } from 'electron-updater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    show: false, // Don't show until ready to prevent flickering
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
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
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
ipcMain.handle('print-receipt', async (event, order) => {
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

    // Căn chính xác bằng vùng in thực tế (printable area) của đầu in XP-80C là 64mm.
    // CSS mặc định là 96 DPI -> 1 inch = 96 pixels.
    const widthInInches = 2.519; // 64mm = 2.519 inches
    let heightInInches = 11.811; // Mặc định 30cm nếu không lấy được chiều cao

    if (heightInPixels > 0) {
      // Cộng thêm 0.5 inch (khoảng 1.2cm) lề dưới cho máy dễ cắt
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
      const { exec } = await import('child_process');
      await new Promise((resolve, reject) => {
        exec(`lp -d "${deviceName}" "${tempPdfPath}"`, (error) => {
          if (error) {
            console.error('Lỗi lệnh lp trên macOS:', error);
            reject(new Error('Lỗi lệnh lp trên macOS: ' + error.message));
          } else {
            resolve();
          }
        });
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
// Bỏ qua lỗi SSL do Vite dùng chứng chỉ tự ký (basicSsl)
app.commandLine.appendSwitch('ignore-certificate-errors');

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
