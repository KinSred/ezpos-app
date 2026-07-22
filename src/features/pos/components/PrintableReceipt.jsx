import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../../db';
import { formatPrice, normalizeNumber } from '../../../utils/format';
import { normalizeQuantity } from '../../../utils/order';

export default function PrintableReceipt({ order, isBatchPrint = false }) {
  const [tx, setTx] = useState(null);

  useEffect(() => {
    let active = true;
    if (order && order.timestamp && order.paymentStatus === 'credit') {
      const transactionQuery = order.id
        ? db.customerTransactions.filter(transaction => transaction.orderId === order.id).last()
        : db.customerTransactions.where('timestamp').equals(order.timestamp).first();
      transactionQuery
        .then(foundTx => {
          if (active) setTx(foundTx);
        })
        .catch(err => {
          console.error("Error fetching receipt transaction:", err);
        });
    } else {
      setTx(null);
    }
    return () => {
      active = false;
    };
  }, [order]);

  if (!order) return null;

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Không rõ ngày';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Không rõ ngày';
    return date.toLocaleString('vi-VN');
  };

  const calculateSubtotal = () => {
    return order.items.reduce((sum, item) => {
      const quantity = normalizeQuantity(item.qty ?? item.quantity);
      const unitPrice = normalizeNumber(item.price || item.unitPrice);
      return sum + (unitPrice * quantity);
    }, 0);
  };

  const isCredit = order.paymentStatus === 'credit';

  const displayPrevDebt = order.customerPreviousDebt !== undefined
    ? order.customerPreviousDebt
    : (tx ? tx.previousDebt : null);

  const displayNewDebt = order.customerRemainingDebt !== undefined
    ? order.customerRemainingDebt
    : (tx ? tx.remainingDebt : null);

  const renderSingleReceipt = (lienLabel) => {
    return (
      <div className="w-full mx-auto p-0 bg-white text-black font-mono text-[12.5px] leading-snug">
        {/* Receipt Header */}
        <div className="text-center mb-4">
          <h2 className="text-[17px] font-extrabold uppercase tracking-widest">EZPOS</h2>
          <div className="text-[14px] font-bold mt-1 uppercase">HOÁ ĐƠN THANH TOÁN</div>
          {lienLabel && <div className="text-[12px] font-semibold italic mt-0.5">({lienLabel})</div>}
        </div>

        {/* Store Info */}
        <div className="text-center space-y-0.5 mb-3 border-b border-dashed border-black pb-3">
          {order.storeInfo?.name && <div className="font-bold text-[14px]">{order.storeInfo.name}</div>}
          {order.storeInfo?.address && <div>Đ/c: {order.storeInfo.address}</div>}
          {order.storeInfo?.phone && <div>SĐT: {order.storeInfo.phone}</div>}
        </div>

        {/* Order Info */}
        <div className="space-y-1 mb-3 border-b border-dashed border-black pb-3">
          {order.id && (
            <div className="flex justify-between">
              <span className="whitespace-nowrap shrink-0">Mã đơn:</span>
              <span className="font-bold text-right">{order.id}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="whitespace-nowrap shrink-0">Ngày:</span>
            <span className="text-right">{formatDate(order.timestamp)}</span>
          </div>
          {order.cashier && (
            <div className="flex justify-between gap-1 overflow-hidden">
              <span className="whitespace-nowrap shrink-0">Thu ngân:</span>
              <span className="text-right whitespace-nowrap truncate">{order.cashier}</span>
            </div>
          )}
        </div>

        {/* Customer Info */}
        {order.customerName && (
          <div className="space-y-0.5 mb-3">
            <div className="flex justify-between">
              <span className="whitespace-nowrap shrink-0">Khách hàng:</span>
              <span className="font-bold text-right">{order.customerName}</span>
            </div>
            {order.customerPhone && !order.customerPhone.startsWith('_vl_') && (
              <div className="flex justify-between">
                <span className="whitespace-nowrap shrink-0">SĐT:</span>
                <span className="text-right">{order.customerPhone}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Divider for Customer Info */}
        {(order.customerName || order.customerPhone) && (
          <div className="border-b border-dashed border-black my-2.5"></div>
        )}

        {/* Items List */}
        <div className="space-y-2.5 my-2.5">
          <div className="flex justify-between font-bold text-[12px] border-b border-dashed border-black pb-1.5 mb-2">
            <span>SP / Đơn giá x SL</span>
            <span>Thành tiền</span>
          </div>

          {order.items.map((item, index) => {
            const quantity = normalizeQuantity(item.qty ?? item.quantity);
            const unitPrice = normalizeNumber(item.price || item.unitPrice);
            const amountValue = normalizeNumber(item.amount);
            const finalAmount = amountValue > 0 ? amountValue : unitPrice * quantity;
            
            const itemDiscount = normalizeNumber(item.discountAmount);
            const hasDiscount = itemDiscount > 0;
            const productName = item.name || item.productName || 'Sản phẩm không tên';

            return (
              <div key={index} className="flex flex-col text-[12px]">
                <div className="font-semibold text-black uppercase leading-tight">
                  {productName} {item.taxRate > 0 ? `(VAT ${item.taxRate}%)` : ''}
                </div>
                {hasDiscount && (
                  <div className="text-[11.5px] text-gray-755 italic">
                    (Giảm: -{formatPrice(itemDiscount)}/{item.unit || 'cái'})
                  </div>
                )}
                <div className="flex justify-between text-black mt-0.5">
                  <span>{formatPrice(unitPrice)} x {quantity} {item.unit || 'cái'}</span>
                  <span className="font-bold">{formatPrice(finalAmount)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-b border-dashed border-black my-2.5"></div>

        {/* Total Calculations */}
        <div className="space-y-1 text-[12.5px]">
          <div className="flex justify-between">
            <span>Cộng tiền hàng:</span>
            <span>{formatPrice(calculateSubtotal())}</span>
          </div>

          {order.baseTotal && order.promoDiscount > 0 && (
            <div className="flex justify-between">
              <span>Tiền hàng cơ bản:</span>
              <span>{formatPrice(order.baseTotal || order.total)}</span>
            </div>
          )}

          {order.promoDiscount > 0 && (
            <div className="flex justify-between">
              <span>Trừ khuyến mãi:</span>
              <span>-{formatPrice(order.promoDiscount)}</span>
            </div>
          )}

          {order.discount > 0 && (
            <div className="flex justify-between">
              <span>Chiết khấu ({order.discountPercent || 0}%):</span>
              <span>-{formatPrice(order.discount)}</span>
            </div>
          )}

          {order.pointsDiscount > 0 && (
            <div className="flex justify-between">
              <span>Dùng điểm ({order.pointsUsed || 0} điểm):</span>
              <span>-{formatPrice(order.pointsDiscount)}</span>
            </div>
          )}

          {order.totalTax > 0 && (
            <div className="flex justify-between">
              <span>Tổng VAT:</span>
              <span>{formatPrice(order.totalTax)}</span>
            </div>
          )}

          {order.surcharge > 0 && (
            <div className="flex justify-between font-medium">
              <span>Khác:</span>
              <span>{formatPrice(order.surcharge)}</span>
            </div>
          )}

          <div className="flex justify-between text-[13.5px] font-bold border-t border-double border-black pt-1.5 mt-1.5 whitespace-nowrap">
            <span>{isCredit ? 'TỔNG ĐƠN HÀNG:' : 'TỔNG THANH TOÁN:'}</span>
            <span>{formatPrice(order.total)}</span>
          </div>
          {order.returnedAmount > 0 && (
            <div className="flex justify-between text-rose-600 text-[11.5px] italic">
              <span>Hoàn trả lũy kế (tham khảo):</span>
              <span>{formatPrice(order.returnedAmount)}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-b border-dashed border-black my-2.5"></div>

        {/* Payment Details & Debt Summary */}
        <div className="space-y-1 text-[12.5px]">
          {!isCredit && (
            <div className="flex justify-between">
              <span>Hình thức mua:</span>
              <span className="font-bold">{{
                cash: 'Tiền mặt',
                vietqr: 'Chuyển khoản QR',
                transfer: 'Chuyển khoản',
                split: 'Tiền mặt + Chuyển khoản'
              }[order.paymentMethod] || 'Khác'}</span>
            </div>
          )}

          {isCredit ? (
            <div className="mt-1 pt-1.5 border-t-0 space-y-1 bg-gray-50/50 p-1 rounded">
              <div className="flex justify-between">
                <span>Hình thức mua:</span>
                <span className="font-bold">GHI NỢ</span>
              </div>
              {displayPrevDebt !== null && displayPrevDebt > 0 && (
                <div className="flex justify-between">
                  <span>Dư nợ cũ:</span>
                  <span>{formatPrice(displayPrevDebt)}</span>
                </div>
              )}
              {displayNewDebt !== null && (
                <div className="flex justify-between font-extrabold border-t border-dashed border-black pt-1.5 mt-1 text-black text-[13px]">
                  <span>TỔNG NỢ HIỆN TẠI:</span>
                  <span>{formatPrice(displayNewDebt)}</span>
                </div>
              )}
            </div>
          ) : (
            order.paymentMethod === 'cash' && (
              <>
                <div className="flex justify-between mt-1">
                  <span>Khách đưa:</span>
                  <span>{formatPrice(order.cashReceived || order.total)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dotted border-black pt-1">
                  <span>Trả lại:</span>
                  <span>{formatPrice(order.changeAmount || 0)}</span>
                </div>
              </>
            )
          )}
        </div>

        {/* Footer message / Signatures */}
        <div className="text-center mt-5 text-[12.5px] space-y-1.5">
          {(isCredit && !isBatchPrint) ? (
            <div className="pt-2">
              <p className="font-bold italic text-[11.5px] text-center mb-6">"Khách hàng đồng ý nhận nợ & ký xác nhận bên dưới"</p>
              <div className="flex justify-between text-center font-bold px-1 pt-1 text-[11.5px] leading-tight">
                <div className="w-[48%] flex flex-col items-center">
                  <span>Người nhận hàng</span>
                  <span className="font-normal text-[10px] italic text-black mt-0.5">(Ký, ghi rõ họ tên)</span>
                  <div className="h-24"></div>
                </div>
                <div className="w-[48%] flex flex-col items-center">
                  <span>Người lập phiếu</span>
                  <span className="font-normal text-[10px] italic text-black mt-0.5">(Ký, ghi rõ họ tên)</span>
                  <div className="h-24"></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-1">
              <p className="font-bold">CẢM ƠN QUÝ KHÁCH</p>
              <p>HẸN GẶP LẠI!</p>
            </div>
          )}
          <p className="text-[10.5px] text-black mt-4 pt-1 border-t border-dotted border-black/10">Powered by EZPOS - Tri Bao</p>
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="print-only bg-white text-black py-2">
      {renderSingleReceipt(null)}
    </div>,
    document.body
  );
}
