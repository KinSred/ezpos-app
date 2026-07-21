import EscPosEncoder from './EscPosEncoder';
import { formatPrice, normalizeNumber } from '../../utils/format';

/**
 * Receipt Layout Engine
 * Converts ReceiptData JSON into an ESC/POS Buffer.
 */

export const buildEscPosBuffer = (receiptData, paperSize = 58, removeVietnamese = true) => {
  const encoder = new EscPosEncoder();
  const width = paperSize === 58 ? 32 : 48; // Ký tự tối đa mỗi dòng

  encoder.initialize();
  if (!removeVietnamese) {
    encoder.enableVietnamese();
  }

  // --- Header ---
  encoder.align('center');
  encoder.bold(true).size(2, 2).line(receiptData.storeInfo?.name || 'Cửa hàng', removeVietnamese).size(1, 1).bold(false);
  
  if (receiptData.storeInfo?.address) {
    encoder.line(`Đ/c: ${receiptData.storeInfo.address}`, removeVietnamese);
  }
  if (receiptData.storeInfo?.phone) {
    encoder.line(`SĐT: ${receiptData.storeInfo.phone}`, removeVietnamese);
  }
  encoder.newline();

  // --- Order Info ---
  encoder.align('left');
  if (receiptData.orderInfo?.id) {
    encoder.line(`Mã đơn: ${receiptData.orderInfo.id}`, removeVietnamese);
  }
  if (receiptData.orderInfo?.timestamp) {
    const timeStr = typeof receiptData.orderInfo.timestamp === 'string' 
      ? receiptData.orderInfo.timestamp 
      : new Date(receiptData.orderInfo.timestamp).toLocaleString('vi-VN');
    encoder.line(`Ngày: ${timeStr}`, removeVietnamese);
  }
  if (receiptData.orderInfo?.cashier) {
    encoder.line(`Thu ngân: ${receiptData.orderInfo.cashier}`, removeVietnamese);
  }
  if (receiptData.orderInfo?.isCopy) {
    encoder.align('center').bold(true).line('*** BẢN SAO ***', removeVietnamese).bold(false).align('left');
  }

  encoder.line('-'.repeat(width));

  // --- Items ---
  // Tên món               SL      Tiền
  // (32 char) -> Tên(18) SL(4) Tiền(10)
  // (48 char) -> Tên(30) SL(6) Tiền(12)
  const nameLen = width === 32 ? 18 : 28;
  const qtyLen = width === 32 ? 4 : 6;
  const priceLen = width === 32 ? 10 : 14;

  const headerName = "Ten món".padEnd(nameLen);
  const headerQty = "SL".padStart(qtyLen);
  const headerPrice = "TTien".padStart(priceLen);
  encoder.line(headerName + headerQty + headerPrice, removeVietnamese);
  encoder.line('-'.repeat(width));

  (receiptData.items || []).forEach(item => {
    // Word wrap tên món nếu dài
    let name = item.name || item.productName || 'Sản phẩm không tên';
    const quantity = normalizeNumber(item.quantity || item.qty);
    const unitPrice = normalizeNumber(item.price || item.unitPrice);
    const amountValue = normalizeNumber(item.amount || item.total);
    const finalAmount = amountValue > 0 ? amountValue : unitPrice * quantity;

    let qty = quantity.toString().padStart(qtyLen);
    let total = formatPrice(finalAmount).replace('đ','').trim().padStart(priceLen);

    if (name.length > nameLen) {
      // In dòng đầu tiên kèm giá
      encoder.line(name.substring(0, nameLen) + qty + total, removeVietnamese);
      // In các dòng tiếp theo
      let remaining = name.substring(nameLen);
      while (remaining.length > 0) {
        encoder.line(remaining.substring(0, nameLen), removeVietnamese);
        remaining = remaining.substring(nameLen);
      }
    } else {
      encoder.line(name.padEnd(nameLen) + qty + total, removeVietnamese);
    }
    
    // In ghi chú
    if (item.note) {
      encoder.line(`  * ${item.note}`, removeVietnamese);
    }
  });

  encoder.line('-'.repeat(width));

  // --- Payment ---
  encoder.spaced('Tổng tiền hàng:', formatPrice(receiptData.payment?.subtotal || 0), width, removeVietnamese);
  if (receiptData.payment?.discount > 0) {
    encoder.spaced('Giảm giá:', `-${formatPrice(receiptData.payment.discount)}`, width, removeVietnamese);
  }
  encoder.bold(true).spaced('TỔNG THANH TOÁN:', formatPrice(receiptData.payment?.total || 0), width, removeVietnamese).bold(false);
  
  if (receiptData.payment?.received > 0) {
    encoder.spaced('Khách đưa:', formatPrice(receiptData.payment.received), width, removeVietnamese);
    encoder.spaced('Tiền thừa:', formatPrice(receiptData.payment?.change || 0), width, removeVietnamese);
  }

  encoder.newline();

  // --- Footer ---
  encoder.align('center');
  if (receiptData.footer?.message) {
    encoder.line(receiptData.footer.message, removeVietnamese);
  } else {
    encoder.line('CẢM ƠN VÀ HẸN GẶP LẠI!', removeVietnamese);
  }

  // Padding
  encoder.newline();
  encoder.newline();
  encoder.newline();
  encoder.newline();

  // Cut & Open drawer
  encoder.cut();
  encoder.drawer();

  return encoder.encode();
};
