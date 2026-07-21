/**
 * Normalize an unknown value to a valid finite number.
 * Returns 0 if invalid or NaN.
 * @param {unknown} value 
 * @returns {number}
 */
export const normalizeNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value
      .replace(/[^\d,-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    const result = Number(normalized);
    return Number.isFinite(result) ? result : 0;
  }

  return 0;
};

/**
 * Format a number to Vietnamese currency (VND)
 * @param {number} price 
 * @returns {string} Formatted price
 */
export const formatPrice = (price) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(normalizeNumber(price));
};
