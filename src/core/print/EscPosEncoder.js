import { removeAccents } from '../../utils/string';

/**
 * EscPosEncoder builds a byte array for ESC/POS printers.
 * Uses Uint8Array to be compatible with both Browser and Node.js.
 */
export default class EscPosEncoder {
  constructor() {
    this.buffer = [];
  }

  /**
   * Khởi tạo máy in (ESC @)
   */
  initialize() {
    this.buffer.push(0x1B, 0x40);
    return this;
  }

  /**
   * Kích hoạt chế độ Tiếng Việt CP1258 (Xprinter thường là page 77)
   */
  enableVietnamese() {
    // Tắt chế độ Kanji/Chinese (FS .)
    this.buffer.push(0x1C, 0x2E);
    // Chọn Code Page 77 (CP1258)
    this.buffer.push(0x1B, 0x74, 77);
    return this;
  }

  /**
   * Căn lề
   * @param {'left'|'center'|'right'} align 
   */
  align(align) {
    const alignMap = { left: 0, center: 1, right: 2 };
    this.buffer.push(0x1B, 0x61, alignMap[align] || 0);
    return this;
  }

  /**
   * Chuyển đổi string sang byte CP1258 cơ bản
   * @param {string} str 
   * @returns {Uint8Array}
   */
  _encodeCP1258(str) {
    // Map các ký tự tiếng Việt sang CP1258
    // CP1258 dùng ký tự kết hợp (combining)
    // Để đơn giản và không phụ thuộc thư viện ngoài trong Browser, 
    // ta dùng phương pháp chuyển về tiếng Việt không dấu nếu gặp lỗi.
    // Hoặc ta có thể map các ký tự phức tạp ở đây.
    
    // Tạm thời, do CP1258 mapping khá phức tạp (cần chuẩn hóa NFD và map các dấu)
    // Nếu ứng dụng đang chạy ở Frontend, ta sẽ fallback về UTF-8 hoặc không dấu.
    // Vì máy in Xprinter XP-80TS nhận UTF-8 nếu bật đúng chế độ Kanji/UTF-8.
    
    const encoder = new TextEncoder();
    return encoder.encode(str); // Gửi UTF-8 byte
  }

  /**
   * In văn bản
   * @param {string} text 
   * @param {boolean} removeVietnamese - Xóa dấu tiếng Việt
   */
  text(text, removeVietnamese = true) {
    if (removeVietnamese) {
      const safeText = removeAccents(text);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(safeText);
      for (let i = 0; i < bytes.length; i++) {
        this.buffer.push(bytes[i]);
      }
    } else {
      // Dùng hàm tạm hoặc gửi UTF-8
      const bytes = this._encodeCP1258(text);
      for (let i = 0; i < bytes.length; i++) {
        this.buffer.push(bytes[i]);
      }
    }
    return this;
  }

  /**
   * In văn bản và xuống dòng
   * @param {string} text 
   * @param {boolean} removeVietnamese 
   */
  line(text, removeVietnamese = true) {
    this.text(text, removeVietnamese);
    this.newline();
    return this;
  }

  /**
   * Xuống dòng (LF)
   */
  newline() {
    this.buffer.push(0x0A);
    return this;
  }

  /**
   * Cắt giấy (GS V)
   */
  cut() {
    this.buffer.push(0x1D, 0x56, 0x41, 0x00); // Mức cắt mượt (partial cut)
    return this;
  }

  /**
   * Mở két tiền (ESC p)
   */
  drawer() {
    // Lệnh chuẩn cho cổng 0, 50ms pulse
    this.buffer.push(0x1B, 0x70, 0x00, 0x32, 0x32);
    return this;
  }

  /**
   * Định dạng in đậm (ESC E)
   * @param {boolean} on 
   */
  bold(on) {
    this.buffer.push(0x1B, 0x45, on ? 1 : 0);
    return this;
  }

  /**
   * Kích thước chữ (GS !)
   * @param {number} width 1-8
   * @param {number} height 1-8
   */
  size(width = 1, height = 1) {
    const n = ((width - 1) << 4) | (height - 1);
    this.buffer.push(0x1D, 0x21, n);
    return this;
  }

  /**
   * In chuỗi với đệm khoảng trắng ở giữa (VD: Tên sản phẩm ............ 10,000)
   * @param {string} left 
   * @param {string} right 
   * @param {number} width Tối đa ký tự trên 1 dòng
   * @param {boolean} removeVietnamese 
   */
  spaced(left, right, width = 32, removeVietnamese = true) {
    const leftSafe = removeVietnamese ? removeAccents(left) : left;
    const rightSafe = removeVietnamese ? removeAccents(right) : right;
    
    // Nếu quá dài thì phải cắt left
    let finalLeft = leftSafe;
    if (finalLeft.length + rightSafe.length + 1 > width) {
      finalLeft = finalLeft.substring(0, width - rightSafe.length - 1);
    }
    
    const spaces = width - finalLeft.length - rightSafe.length;
    const spaceStr = ' '.repeat(Math.max(0, spaces));
    this.line(finalLeft + spaceStr + rightSafe, false);
    return this;
  }

  /**
   * Chèn ảnh raster (1-bit bitmap) qua lệnh GS v 0
   * @param {Uint8ClampedArray} pixels Mảng RGBA từ canvas (width * height * 4)
   * @param {number} width Chiều rộng ảnh (pixels)
   * @param {number} height Chiều cao ảnh (pixels)
   */
  raster(pixels, width, height) {
    const bytesPerRow = Math.ceil(width / 8);
    
    // Command: GS v 0 (0x1D 0x76 0x30 0x00)
    // xL xH yL yH
    this.buffer.push(0x1D, 0x76, 0x30, 0x00);
    this.buffer.push(bytesPerRow % 256, Math.floor(bytesPerRow / 256));
    this.buffer.push(height % 256, Math.floor(height / 256));

    // Convert RGBA pixels to 1-bit monochrome data
    // Threshold for black is luminance < 128 and alpha > 128
    const rasterData = new Uint8Array(bytesPerRow * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const a = pixels[idx + 3];

        const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
        const isBlack = (luminance < 128 && a > 128);

        if (isBlack) {
          const byteIndex = y * bytesPerRow + Math.floor(x / 8);
          const bitPosition = 7 - (x % 8);
          rasterData[byteIndex] |= (1 << bitPosition);
        }
      }
    }

    for (let i = 0; i < rasterData.length; i++) {
      this.buffer.push(rasterData[i]);
    }
    
    return this;
  }

  /**
   * Lấy mảng byte (Uint8Array)
   */
  encode() {
    return new Uint8Array(this.buffer);
  }
}
