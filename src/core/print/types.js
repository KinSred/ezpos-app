/**
 * @typedef {Object} ReceiptItem
 * @property {string} name - Tên sản phẩm
 * @property {number} quantity - Số lượng
 * @property {number} price - Đơn giá
 * @property {number} total - Thành tiền
 * @property {string} [note] - Ghi chú (tùy chọn)
 */

/**
 * @typedef {Object} ReceiptData
 * @property {Object} storeInfo
 * @property {string} storeInfo.name
 * @property {string} storeInfo.address
 * @property {string} storeInfo.phone
 * @property {Object} orderInfo
 * @property {string} orderInfo.id - Mã đơn hàng
 * @property {string} orderInfo.cashier - Thu ngân
 * @property {number|string|Date} orderInfo.timestamp - Thời gian (timestamp hoặc string)
 * @property {boolean} [orderInfo.isCopy] - Đánh dấu bản sao
 * @property {ReceiptItem[]} items - Danh sách món
 * @property {Object} payment
 * @property {number} payment.subtotal - Tổng tạm tính
 * @property {number} payment.discount - Tiền giảm giá
 * @property {number} payment.total - Tổng tiền (đã giảm)
 * @property {number} payment.received - Tiền khách đưa
 * @property {number} payment.change - Tiền thối lại
 * @property {string} payment.method - Phương thức thanh toán (cash, transfer, card)
 * @property {Object} footer
 * @property {string} [footer.message] - Lời cảm ơn
 * @property {string} [footer.qrCode] - Nội dung mã QR (nếu có)
 * @property {string} [footer.barcode] - Nội dung mã vạch (nếu có)
 */

export {};
