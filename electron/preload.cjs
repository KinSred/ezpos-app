const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Method to trigger a silent print via the main process
  silentPrint: (order) => ipcRenderer.invoke('print-receipt', order),
  
  // Method to send raw ESC/POS bytes over TCP
  printRawTcp: (data) => ipcRenderer.invoke('print-raw-tcp', data),

  // Method to send raw ESC/POS bytes over USB
  printRawUsb: (data) => ipcRenderer.invoke('print-raw-usb', data),
  
  // Auto Updater methods
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateMessage: (callback) => {
    ipcRenderer.on('update-message', (event, message) => callback(message));
    return () => ipcRenderer.removeAllListeners('update-message');
  }
});
