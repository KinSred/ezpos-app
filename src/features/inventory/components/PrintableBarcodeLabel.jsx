import React from 'react';
import { createPortal } from 'react-dom';
import Barcode from 'react-barcode';

export default function PrintableBarcodeLabel({ data }) {
  if (!data || !data.product || !data.quantity || data.quantity <= 0) return null;
  
  const { product, quantity } = data;
  const labels = Array.from({ length: quantity });

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return createPortal(
    <div className="print-only bg-white text-black py-2">
      {labels.map((_, idx) => (
        <div 
          key={idx} 
          className="flex flex-col items-center justify-center border-b border-dashed border-slate-400 pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0" 
          style={{ pageBreakInside: 'avoid' }}
        >
          <div className="w-full flex justify-center py-1">
            <Barcode 
              value={product.barcode} 
              format="CODE128" 
              width={1.5} 
              height={45} 
              displayValue={true}
              fontSize={13}
              font="Courier New"
              fontOptions="bold"
              margin={0}
              background="#ffffff"
              lineColor="#000000"
            />
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}
