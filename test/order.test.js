import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReturnRefund,
  getOrderItemKey,
  getStockQuantity,
  normalizeQuantity
} from '../src/utils/order.js';

test('legacy order items receive distinct deterministic keys', () => {
  const first = { id: 10, sellMode: 'base' };
  const second = { id: 10, sellMode: 'base' };

  assert.equal(getOrderItemKey(first, 0), '10-base-0');
  assert.equal(getOrderItemKey(second, 1), '10-base-1');
  assert.notEqual(getOrderItemKey(first, 0), getOrderItemKey(second, 1));
});

test('persisted cartId remains the primary order item key', () => {
  assert.equal(getOrderItemKey({ cartId: '42-wholesale', id: 42 }, 3), '42-wholesale');
});

test('partial refund proportionally includes order-level adjustments', () => {
  const order = {
    total: 270,
    items: [
      { id: 1, cartId: '1-base', qty: 1, price: 100 },
      { id: 2, cartId: '2-base', qty: 2, price: 100 }
    ]
  };

  const result = calculateReturnRefund(order, { '1-base': 1 });
  assert.equal(result.returnedGross, 100);
  assert.equal(result.remainingGross, 300);
  assert.equal(result.returnRatio, 1 / 3);
  assert.equal(result.refundAmount, 90);
});

test('refund quantity is capped at the quantity remaining on the order', () => {
  const order = {
    total: 50_000,
    items: [{ id: 1, cartId: '1-base', qty: 2, price: 25_000 }]
  };

  const result = calculateReturnRefund(order, { '1-base': 999 });
  assert.equal(result.returnRatio, 1);
  assert.equal(result.refundAmount, 50_000);
});

test('stock restoration respects mid and wholesale conversion rates', () => {
  const product = { midConversionRate: 6, wholesaleConversionRate: 24 };

  assert.equal(getStockQuantity({ qty: 2, sellMode: 'mid' }, product), 12);
  assert.equal(getStockQuantity({ qty: 3, sellMode: 'wholesale' }, product), 72);
  assert.equal(getStockQuantity({ qty: 4, sellMode: 'base' }, product), 4);
});

test('decimal quantity strings are not treated as currency thousands', () => {
  assert.equal(normalizeQuantity('1.5'), 1.5);
  assert.equal(normalizeQuantity('1,5'), 1.5);
  assert.equal(getStockQuantity({ qty: '1.5', sellMode: 'base' }, {}), 1.5);
  assert.equal(getStockQuantity({ qty: '2', sellMode: 'mid' }, { midConversionRate: '1.5' }), 3);
});
