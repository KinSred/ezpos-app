import { buildEscPosBuffer } from './LayoutEngine';
import { buildRasterBuffer } from './RasterLayoutEngine';

/**
 * Interface cho tất cả các Printer Adapter
 */
export class PrintAdapter {
  constructor(printerProfile) {
    this.printer = printerProfile;
  }

  /**
   * Kết nối hoặc khởi tạo máy in
   * @returns {Promise<boolean>}
   */
  async connect() {
    return true;
  }

  /**
   * Gửi dữ liệu in
   * @param {Object} receiptData 
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async print(receiptData) {
    throw new Error("Method not implemented");
  }

  /**
   * Mở két tiền
   */
  async openDrawer() {
    throw new Error("Method not implemented");
  }
}

/**
 * Adapter in RAW ESC/POS qua mạng LAN (TCP/IP)
 */
export class EscPosLanAdapter extends PrintAdapter {
  async print(receiptData) {
    try {
      let buffer;
      if (this.printer.printMode === 'full-raster') {
        buffer = await buildRasterBuffer(receiptData);
      } else {
        buffer = buildEscPosBuffer(receiptData, this.printer.paperSize || 80, this.printer.vietnameseMode !== 'printer-text');
      }

      if (window.electronAPI && window.electronAPI.printRawTcp) {
        // Gửi mảng byte từ Frontend qua Electron Main Process bằng IPC
        const result = await window.electronAPI.printRawTcp({
          ip: this.printer.ip,
          port: this.printer.port || 9100,
          bufferData: Array.from(buffer)
        });
        return result;
      } else {
        return { success: false, error: 'Chỉ hỗ trợ trên ứng dụng Desktop' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async openDrawer() {
    try {
      if (window.electronAPI && window.electronAPI.printRawTcp) {
        // Lệnh ESC p mở két
        const buffer = new Uint8Array([0x1B, 0x70, 0x00, 0x32, 0x32]);
        const result = await window.electronAPI.printRawTcp({
          ip: this.printer.ip,
          port: this.printer.port || 9100,
          bufferData: Array.from(buffer)
        });
        return result;
      }
      return { success: false, error: 'Không có Electron API' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

/**
 * Adapter in RAW ESC/POS qua USB (Bypass driver)
 */
export class EscPosUsbAdapter extends PrintAdapter {
  async print(receiptData) {
    try {
      let buffer;
      if (this.printer.printMode === 'full-raster') {
        buffer = await buildRasterBuffer(receiptData);
      } else {
        buffer = buildEscPosBuffer(receiptData, this.printer.paperSize || 80, this.printer.vietnameseMode !== 'printer-text');
      }

      if (window.electronAPI && window.electronAPI.printRawUsb) {
        const result = await window.electronAPI.printRawUsb({
          deviceName: this.printer.usbDeviceName,
          bufferData: Array.from(buffer)
        });
        return result;
      } else {
        return { success: false, error: 'Chỉ hỗ trợ trên ứng dụng Desktop' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async openDrawer() {
    try {
      if (window.electronAPI && window.electronAPI.printRawUsb) {
        // Lệnh ESC p mở két
        const buffer = new Uint8Array([0x1B, 0x70, 0x00, 0x32, 0x32]);
        const result = await window.electronAPI.printRawUsb({
          deviceName: this.printer.usbDeviceName,
          bufferData: Array.from(buffer)
        });
        return result;
      }
      return { success: false, error: 'Không có Electron API' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

/**
 * Adapter in qua System Driver (In PDF) - Tương thích hiện tại (như Xprinter POS-80)
 */
export class SystemPrinterAdapter extends PrintAdapter {
  async print(receiptData) {
    // Với SystemPrinterAdapter, thay vì dùng buffer, ta gọi hàm in PDF mặc định.
    // Lệnh này dựa vào PrintableReceipt.jsx render HTML -> PDF.
    // Việc này yêu cầu phải set 'activePrintOrder' ở mức UI hoặc truyền object này qua ipcRenderer
    
    // Convert ReceiptData JSON to Order Format expected by current system
    const fakeOrderObj = this._convertToLegacyOrder(receiptData);
    
    if (window.electronAPI && window.electronAPI.silentPrint) {
      const result = await window.electronAPI.silentPrint(fakeOrderObj);
      return result;
    } else {
      // Fallback web
      window.print();
      return { success: true };
    }
  }

  async openDrawer() {
    return { success: false, error: 'Không hỗ trợ lệnh RAW mở két khi in qua System Driver' };
  }

  /**
   * Helper chuyển ReceiptData mới sang object Order cũ để PrintableReceipt hiểu được
   */
  _convertToLegacyOrder(receiptData) {
    return {
      id: receiptData.orderInfo?.id,
      timestamp: receiptData.orderInfo?.timestamp || new Date().toISOString(),
      cashier: receiptData.orderInfo?.cashier,
      items: (receiptData.items || []).map(i => ({
        name: i.name,
        productName: i.name,
        product: { name: i.name },
        quantity: i.quantity,
        price: i.price,
        note: i.note
      })),
      total: receiptData.payment?.total || 0,
      subtotal: receiptData.payment?.subtotal || 0,
      discount: receiptData.payment?.discount || 0,
      customerPaid: receiptData.payment?.received || 0,
      changeAmount: receiptData.payment?.change || 0
    };
  }
}
