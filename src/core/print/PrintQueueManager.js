import { db } from '../../db';
import { SystemPrinterAdapter, EscPosLanAdapter, EscPosUsbAdapter } from './Adapters';

class PrintQueueManager {
  constructor() {
    this.isProcessing = false;
    this.activeJob = null;
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  _notify(job) {
    this.activeJob = job;
    this.listeners.forEach(l => l(job));
  }

  /**
   * Tạo adapter tương ứng với Printer Profile
   */
  _createAdapter(printer) {
    switch (printer.type) {
      case 'lan':
        return new EscPosLanAdapter(printer);
      case 'usb':
        return new EscPosUsbAdapter(printer);
      case 'system':
      default:
        return new SystemPrinterAdapter(printer);
    }
  }

  /**
   * Đẩy một hóa đơn vào hàng đợi
   * @param {number} printerId 
   * @param {Object} receiptData 
   * @param {string} type 
   */
  async enqueue(printerId, receiptData, type = 'receipt') {
    const jobId = await db.printJobs.add({
      printerId,
      status: 'pending',
      timestamp: Date.now(),
      type,
      receiptData,
      retryCount: 0,
      error: null
    });
    
    // Kích hoạt xử lý queue
    this.processQueue();
    return jobId;
  }

  /**
   * Xử lý hàng đợi (chạy ngầm)
   */
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      let nextJob = await db.printJobs.where('status').equals('pending').first();
      
      while (nextJob) {
        // Cập nhật trạng thái
        await db.printJobs.update(nextJob.id, { status: 'processing' });
        this._notify(nextJob);

        const printer = await db.printers.get(nextJob.printerId);
        if (!printer) {
          await db.printJobs.update(nextJob.id, { 
            status: 'failed', 
            error: 'Printer not found' 
          });
        } else {
          const adapter = this._createAdapter(printer);
          try {
            // Đợi React mount xong PrintableReceipt (nếu cần cho PDF/SystemPrinter)
            if (printer.type === 'system') {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            const result = await adapter.print(nextJob.receiptData);
            if (result.success) {
              await db.printJobs.update(nextJob.id, { status: 'printed' });
            } else {
              await db.printJobs.update(nextJob.id, { 
                status: 'failed',
                error: result.error || 'Unknown print error'
              });
            }
          } catch (err) {
            await db.printJobs.update(nextJob.id, { 
              status: 'failed',
              error: err.message
            });
          }
        }

        this._notify(null);
        // Lấy job tiếp theo
        nextJob = await db.printJobs.where('status').equals('pending').first();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * In lại bản sao từ jobId
   */
  async printCopy(jobId) {
    const job = await db.printJobs.get(jobId);
    if (!job) throw new Error('Job not found');

    const copyData = { ...job.receiptData };
    if (!copyData.orderInfo) copyData.orderInfo = {};
    copyData.orderInfo.isCopy = true;

    return this.enqueue(job.printerId, copyData, job.type);
  }
}

// Export a singleton instance
export const printQueue = new PrintQueueManager();
