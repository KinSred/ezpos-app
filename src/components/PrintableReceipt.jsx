import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../db';

export default function PrintableReceipt({ order, isBatchPrint = false }) {
  const [tx, setTx] = useState(null);

  useEffect(() => {
    let active = true;
    if (order && order.timestamp && order.paymentStatus === 'credit') {
      db.customerTransactions.where('timestamp').equals(order.timestamp).first()
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
  }, [order?.id, order?.paymentStatus]);

  if (!order) return null;

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Không rõ ngày';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Không rõ ngày';
    return date.toLocaleString('vi-VN');
  };

  const calculateSubtotal = () => {
    return order.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  };

  const isCredit = order.paymentStatus === 'credit';

  const displayPrevDebt = order.customerPreviousDebt !== undefined 
    ? order.customerPreviousDebt 
    : (tx ? (tx.remainingDebt - tx.amount) : null);

  const displayNewDebt = order.customerRemainingDebt !== undefined 
    ? order.customerRemainingDebt 
    : (tx ? tx.remainingDebt : null);
  const renderSingleReceipt = (lienLabel) => {
    return (
      <div className="w-full mx-auto p-1.5 bg-white text-black font-mono text-[13.5px] leading-snug">
        {/* Receipt Header */}
        <div className="text-center mb-4">
          <h2 className="text-[17px] font-extrabold uppercase tracking-widest">TẠP HÓA HỒNG NGỌC</h2>
          <p className="text-[11.5px] text-black mt-0.5">Mã ID: {order.storeId || 'POS-STORE'}</p>
          <p className="text-[11.5px] text-black">Thời gian: {formatDate(order.timestamp)}</p>
          <h3 className="text-[15px] font-extrabold uppercase mt-2.5 tracking-wide border-t border-b border-black py-1.5">
            {isCredit ? 'HÓA ĐƠN GHI NỢ' : 'HÓA ĐƠN BÁN HÀNG'}
          </h3>
          {lienLabel && (
            <p className="text-[11.5px] font-bold text-center mt-1.5 text-slate-800 bg-slate-100 py-0.5 rounded tracking-wide">{lienLabel}</p>
          )}
          <p className="text-[13px] font-bold mt-1.5">Số: HD-{order.id}</p>
        </div>

        {/* Divider */}
        <div className="border-b border-dashed border-black my-2.5"></div>

        {/* Customer Info if exists */}
        {order.customerPhone && (
          <div className="mb-2.5 text-[12.5px] space-y-0.5">
            <div>Khách hàng: <span className="font-bold">{order.customerName || 'Thành viên'}</span></div>
            <div>SĐT: {order.customerPhone}</div>
          </div>
        )}

        {order.customerPhone && (
          <div className="border-b border-dashed border-black my-2.5"></div>
        )}

        {/* Items List */}
        <div className="space-y-2.5 my-2.5">
          <div className="flex justify-between font-bold text-[13px] border-b border-dashed border-black pb-1.5 mb-2">
            <span>SP / Đơn giá x SL</span>
            <span>Thành tiền</span>
          </div>

          {order.items.map((item, index) => {
            const typeLabel = item.sellMode === 'wholesale' ? '(Sỉ)' : item.sellMode === 'mid' ? '(Lốc)' : '';
            const itemDiscount = item.discountAmount || 0;
            const hasDiscount = itemDiscount > 0;

            return (
              <div key={index} className="flex flex-col text-[13px]">
                <div className="font-semibold text-black uppercase leading-tight">
                  {item.name} {typeLabel} {item.taxRate > 0 ? `(VAT ${item.taxRate}%)` : ''}
                </div>
                {hasDiscount && (
                  <div className="text-[11.5px] text-gray-755 italic">
                    (Giảm: -{formatPrice(itemDiscount)}/{item.unit || 'cái'})
                  </div>
                )}
                <div className="flex justify-between text-black mt-0.5">
                  <span>{formatPrice(item.price)} x {item.qty} {item.unit || 'cái'}</span>
                  <span className="font-bold">{formatPrice(item.price * item.qty)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-b border-dashed border-black my-2.5"></div>

        {/* Total Calculations */}
        <div className="space-y-1 text-[13.5px]">
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

          {order.totalTax > 0 && (
            <div className="flex justify-between">
              <span>Tổng VAT:</span>
              <span>{formatPrice(order.totalTax)}</span>
            </div>
          )}

          <div className="flex justify-between text-[14.5px] font-bold border-t border-double border-black pt-1.5 mt-1.5">
            <span>TỔNG THANH TOÁN:</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-b border-dashed border-black my-2.5"></div>

        {/* Payment Details & Debt Summary */}
        <div className="space-y-1 text-[12.5px]">
          <div className="flex justify-between">
            <span>Hình thức mua:</span>
            <span className="font-bold">{isCredit ? 'Ghi nợ' : (order.paymentMethod === 'vietqr' ? 'Chuyển khoản QR' : 'Tiền mặt')}</span>
          </div>

          {isCredit ? (
            <div className="mt-2 pt-1 border-t border-dotted border-black space-y-1 bg-gray-50/50 p-1 rounded">
              {displayPrevDebt !== null && (
                <div className="flex justify-between">
                  <span>Dư nợ cũ:</span>
                  <span>{formatPrice(displayPrevDebt)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-rose-700">
                <span>Nợ phát sinh đơn này:</span>
                <span>+{formatPrice(order.total)}</span>
              </div>
              {displayNewDebt !== null && (
                <div className="flex justify-between font-extrabold border-t border-dotted border-black pt-1 text-black">
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
      {(isCredit && !isBatchPrint) ? (
        <div className="flex flex-col">
          <div style={{ pageBreakAfter: 'always' }}>
            {renderSingleReceipt("LIÊN 1: GIAO KHÁCH HÀNG")}
          </div>
          
          <div>
            {renderSingleReceipt("LIÊN 2: CỬA HÀNG LƯU")}
          </div>
        </div>
      ) : (
        renderSingleReceipt(null)
      )}
    </div>,
    document.body
  );
}
