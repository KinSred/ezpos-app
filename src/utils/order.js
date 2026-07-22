import { normalizeNumber } from './format.js';

/** Quantity values use a decimal point in the POS UI. Currency normalization
 * intentionally removes dots as thousands separators, so it must not be used
 * for quantities such as "1.5".
 */
export const normalizeQuantity = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;

  const normalized = value.trim().replace(',', '.');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : 0;
};

/**
 * Stable key for both new orders (which persist cartId) and legacy orders.
 */
export const getOrderItemKey = (item, index = 0) => {
  if (item?.cartId) return String(item.cartId);
  const identity = item?.id ?? item?.barcode ?? 'item';
  const mode = item?.sellMode || (item?.isWholesale ? 'wholesale' : 'base');
  return `${identity}-${mode}-${index}`;
};

/**
 * Calculate a proportional refund from the order's current payable total.
 * This keeps order-level discounts, points, VAT, promotions and surcharge
 * proportionally represented, including for legacy orders.
 */
export const calculateReturnRefund = (order, quantitiesByKey = {}) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  let remainingGross = 0;
  let returnedGross = 0;

  items.forEach((item, index) => {
    const quantity = Math.max(0, normalizeQuantity(item.qty ?? item.quantity));
    const price = Math.max(0, normalizeNumber(item.price ?? item.unitPrice));
    const returnQty = Math.min(
      quantity,
      Math.max(0, normalizeQuantity(quantitiesByKey[getOrderItemKey(item, index)]))
    );

    remainingGross += quantity * price;
    returnedGross += returnQty * price;
  });

  const returnRatio = remainingGross > 0
    ? Math.min(1, returnedGross / remainingGross)
    : 0;
  const currentTotal = Math.max(0, normalizeNumber(order?.total));

  return {
    returnedGross,
    remainingGross,
    returnRatio,
    refundAmount: Math.round(currentTotal * returnRatio)
  };
};

export const getStockQuantity = (item, product) => {
  const quantity = Math.max(0, normalizeQuantity(item?.qty ?? item?.quantity));
  const mode = item?.sellMode || (item?.isWholesale ? 'wholesale' : 'base');
  let conversion = 1;
  if (mode === 'wholesale') conversion = normalizeQuantity(product?.wholesaleConversionRate) || 1;
  if (mode === 'mid') conversion = normalizeQuantity(product?.midConversionRate) || 1;
  return quantity * conversion;
};
