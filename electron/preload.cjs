const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Method to trigger a silent print via the main process
  silentPrint: (order) => ipcRenderer.invoke('print-receipt', order),
  
  // Auto Updater methods
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateMessage: (callback) => {
    ipcRenderer.on('update-message', (event, message) => callback(message));
    return () => ipcRenderer.removeAllListeners('update-message');
  }
});
