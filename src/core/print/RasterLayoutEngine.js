import EscPosEncoder from './EscPosEncoder';
import { formatPrice, normalizeNumber } from '../../utils/format';

/**
 * Raster Layout Engine
 * Renders the receipt data onto an offscreen HTML5 Canvas,
 * extracts the monochrome pixel data, and returns an ESC/POS Buffer
 * using the GS v 0 raster command.
 */

export const buildRasterBuffer = async (receiptData) => {
  // Wait for fonts to load
  await document.fonts.ready;

  const CANVAS_WIDTH = 576;
  const PADDING = 8;

  // We start with a reasonably large canvas and will crop it later
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = 4000; 
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Fill background white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  let y = 0;

  // Helpers
  const setFont = (size, bold = false, align = 'left') => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px "Inter", "Roboto", "Arial", sans-serif`;
    ctx.textAlign = align;
  };

  const drawText = (text, x, size, bold = false, align = 'left') => {
    setFont(size, bold, align);
    let drawX = x;
    if (align === 'center') drawX = CANVAS_WIDTH / 2;
    if (align === 'right') drawX = CANVAS_WIDTH - PADDING;
    
    ctx.fillText(text, drawX, y);
    return size * 1.2; // Return line height
  };

  const drawLine = () => {
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(PADDING, y + 5);
    ctx.lineTo(CANVAS_WIDTH - PADDING, y + 5);
    ctx.stroke();
    ctx.setLineDash([]);
    return 15;
  };

  const wrapText = (text, maxWidth, size, bold = false) => {
    setFont(size, bold, 'left');
    const words = text.split(' ');
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  // --- Render Header ---
  y += drawText(receiptData.storeInfo?.name || 'Cửa hàng', PADDING, 32, true, 'center') + 10;
  if (receiptData.storeInfo?.address) {
    y += drawText(`Đ/c: ${receiptData.storeInfo.address}`, PADDING, 22, false, 'center') + 5;
  }
  if (receiptData.storeInfo?.phone) {
    y += drawText(`SĐT: ${receiptData.storeInfo.phone}`, PADDING, 22, false, 'center') + 5;
  }
  y += 20; // Margin

  // --- Order Info ---
  if (receiptData.orderInfo?.id) {
    y += drawText(`Mã đơn: ${receiptData.orderInfo.id}`, PADDING, 22, false, 'left') + 5;
  }
  if (receiptData.orderInfo?.timestamp) {
    const timeStr = typeof receiptData.orderInfo.timestamp === 'string' 
      ? receiptData.orderInfo.timestamp 
      : new Date(receiptData.orderInfo.timestamp).toLocaleString('vi-VN');
    y += drawText(`Ngày: ${timeStr}`, PADDING, 22, false, 'left') + 5;
  }
  if (receiptData.orderInfo?.cashier) {
    y += drawText(`Thu ngân: ${receiptData.orderInfo.cashier}`, PADDING, 22, false, 'left') + 5;
  }
  if (receiptData.orderInfo?.isCopy) {
    y += 10;
    y += drawText('*** BẢN SAO ***', PADDING, 24, true, 'center') + 10;
  }
  y += 10;

  // --- Customer ---
  if (receiptData.customerInfo?.name) {
    y += drawText(`Khách hàng: ${receiptData.customerInfo.name}`, PADDING, 22, false, 'left') + 5;
    if (receiptData.customerInfo?.phone) {
      y += drawText(`SĐT: ${receiptData.customerInfo.phone}`, PADDING, 22, false, 'left') + 5;
    }
    y += 10;
  }

  // Divider
  y += drawLine();
  y += 10;

  // --- Items Header ---
  setFont(22, true, 'left');
  ctx.fillText("SP / Đơn giá x SL", PADDING, y);
  setFont(22, true, 'right');
  ctx.fillText("Thành tiền", CANVAS_WIDTH - PADDING, y);
  y += 30;

  y += drawLine();
  y += 10;

  // --- Items List ---
  (receiptData.items || []).forEach(item => {
    const quantity = normalizeNumber(item.quantity || item.qty);
    const unitPrice = normalizeNumber(item.price || item.unitPrice);
    const amountValue = normalizeNumber(item.amount || item.total);
    const finalAmount = amountValue > 0 ? amountValue : unitPrice * quantity;
    
    let name = item.name || item.productName || 'Sản phẩm không tên';
    if (item.taxRate > 0) name += ` (VAT ${item.taxRate}%)`;

    // Wrap product name within roughly 350px width
    const nameLines = wrapText(name, 350, 22, true);
    
    setFont(22, true, 'left');
    ctx.fillText(nameLines[0], PADDING, y);
    
    setFont(22, true, 'right');
    ctx.fillText(formatPrice(finalAmount).replace('đ', '').trim(), CANVAS_WIDTH - PADDING, y);
    y += 28;

    // Remaining name lines
    for (let i = 1; i < nameLines.length; i++) {
      setFont(22, true, 'left');
      ctx.fillText(nameLines[i], PADDING, y);
      y += 28;
    }

    // Discount
    const itemDiscount = normalizeNumber(item.discountAmount);
    if (itemDiscount > 0) {
      setFont(20, false, 'left');
      ctx.fillStyle = '#444444';
      ctx.fillText(`(Giảm: -${formatPrice(itemDiscount)}/${item.unit || 'cái'})`, PADDING, y);
      ctx.fillStyle = '#000000';
      y += 26;
    }

    // Price details
    setFont(22, false, 'left');
    ctx.fillText(`${formatPrice(unitPrice)} x ${quantity} ${item.unit || 'cái'}`, PADDING, y);
    y += 35;
  });

  y += drawLine();
  y += 10;

  // --- Payment Details ---
  const drawRow = (label, value, bold = false) => {
    setFont(24, bold, 'left');
    ctx.fillText(label, PADDING, y);
    setFont(24, bold, 'right');
    ctx.fillText(value, CANVAS_WIDTH - PADDING, y);
    y += 35;
  };

  const subtotal = (receiptData.items || []).reduce((sum, item) => {
    const qty = normalizeNumber(item.quantity || item.qty);
    const price = normalizeNumber(item.price || item.unitPrice);
    return sum + (qty * price);
  }, 0);

  drawRow('Tổng tiền hàng:', formatPrice(subtotal));

  if (receiptData.payment?.discount > 0) {
    drawRow('Giảm giá:', `-${formatPrice(receiptData.payment.discount)}`);
  }

  y += 10;
  // TỔNG THANH TOÁN (MUST be on same line)
  drawRow('TỔNG THANH TOÁN:', formatPrice(receiptData.payment?.total || 0), true);
  y += 10;

  // Payment Method
  const methodStr = receiptData.paymentMethod === 'vietqr' ? 'Chuyển khoản QR' : (receiptData.paymentMethod === 'credit' ? 'Ghi nợ' : 'Tiền mặt');
  drawRow('Hình thức mua:', methodStr, true);

  if (receiptData.payment?.received > 0) {
    drawRow('Khách đưa:', formatPrice(receiptData.payment.received));
    drawRow('Tiền thừa:', formatPrice(receiptData.payment?.change || 0));
  }

  y += drawLine();
  y += 10;

  // Footer
  if (receiptData.storeInfo?.footerMessage) {
    y += drawText(receiptData.storeInfo.footerMessage, PADDING, 22, false, 'center') + 5;
  }
  y += drawText('Cảm ơn & Hẹn gặp lại!', PADDING, 22, true, 'center') + 5;

  y += 150; // Extra space at bottom before cutting

  // Final crop
  const finalHeight = Math.ceil(y);
  const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, finalHeight);

  // Convert to ESC/POS bytes
  const encoder = new EscPosEncoder();
  encoder.initialize();
  encoder.raster(imageData.data, CANVAS_WIDTH, finalHeight);
  encoder.cut();

  return encoder.encode();
};
