/**
 * silentPrint.js
 * 
 * Thử gửi lệnh in đến Local Print Server (localhost:3333) trước.
 * Nếu server không chạy → fallback sang window.print() bình thường.
 */

const PRINT_SERVER_URL = 'http://localhost:3333';
let serverAvailable = null; // null = chưa kiểm tra, true/false = đã kiểm tra

/**
 * Kiểm tra xem Local Print Server có đang chạy không.
 * Kết quả được cache trong 30 giây để không phải kiểm tra liên tục.
 */
export const checkPrintServer = async () => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500); // timeout 1.5 giây
    const res = await fetch(`${PRINT_SERVER_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    serverAvailable = data.status === 'ok';
    return serverAvailable;
  } catch {
    serverAvailable = false;
    return false;
  }
};

/**
 * Hàm in chính — tự động chọn phương thức:
 * 1. Nếu chạy trong Electron Desktop App → Dùng API in ngầm của hệ điều hành.
 * 2. Nếu Local Print Server đang chạy → gửi JSON để in ngầm qua server (cho Web).
 * 3. Nếu không có gì → gọi window.print() như bình thường.
 * 
 * @param {object} order - Dữ liệu đơn hàng
 * @returns {Promise<{method: 'electron'|'server'|'browser', error?: string}>}
 */
export const silentPrint = async (order) => {
  // 1. ELECTRON NATIVE PRINT
  if (window.electronAPI && typeof window.electronAPI.silentPrint === 'function') {
    try {
      // Đợi component render xong DOM mới in
      await new Promise(resolve => setTimeout(resolve, 100)); 
      const result = await window.electronAPI.silentPrint(order);
      if (result && result.success) {
        return { method: 'electron' };
      } else {
        alert('[Electron Print] Lỗi in ngầm: ' + (result?.error || 'Unknown error'));
        return { method: 'browser', error: result?.error };
      }
    } catch (err) {
      alert('[Electron Print] Ngoại lệ: ' + err.message);
      return { method: 'browser', error: err.message };
    }
  }

  // Nếu không có API Electron (chạy trên web), thử dùng Local Server
  if (serverAvailable === null) {
      await checkPrintServer();
    }

  if (serverAvailable) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${PRINT_SERVER_URL}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        return { method: 'server' };
      } else {
        const data = await res.json();
        console.warn('[PrintServer] Lỗi từ server, fallback window.print():', data.error);
        serverAvailable = false;
        window.print();
        return { method: 'browser', error: data.error };
      }
    } catch (err) {
      console.warn('[PrintServer] Không thể kết nối server, fallback window.print():', err.message);
      serverAvailable = false;
      window.print();
      return { method: 'browser', error: err.message };
    }
  }

  // 3. NATIVE BROWSER PRINT
  alert('[Web Fallback] Không tìm thấy Electron API, chuyển sang In mặc định của trình duyệt!');
  window.print();
  return { method: 'browser' };
};
