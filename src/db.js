import Dexie from 'dexie';
import { hashPin, legacyHashPin } from './utils/security';

export const db = new Dexie('POSDatabase');

const generateSecureStoreId = () => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Thiết bị không hỗ trợ tạo Store ID an toàn.');
  }
  const randomBytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(randomBytes);
  const token = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `POS-${token}`;
};

// Version 1 schema
db.version(1).stores({
  products: 'barcode, name, price, stock',
  orders: '++id, timestamp, total',
  settings: 'key, value'
});

// Version 2 schema: Add customers, and extra fields to products/orders for single-user features
db.version(2).stores({
  products: 'barcode, name, price, stock, unit, lowStockAlert',
  orders: '++id, timestamp, total, customerPhone',
  settings: 'key, value',
  customers: 'phone, name, points'
});

// Version 3 schema: Intermediate version to delete the old products table (with barcode primary key) and create productsTemp with ++id
db.version(3).stores({
  products: null,
  productsTemp: '++id, barcode, name, price, stock, unit, lowStockAlert',
  orders: '++id, timestamp, total, customerPhone',
  settings: 'key, value',
  customers: 'phone, name, points'
}).upgrade(async (tx) => {
  // Load current products from old table
  const products = await tx.table('products').toArray();
  // Migrate them to temporary table with numeric auto-incrementing key
  const migrated = products.map(p => ({
    barcode: p.barcode,
    name: p.name,
    price: p.price,
    stock: p.stock,
    unit: p.unit || 'cái',
    lowStockAlert: p.lowStockAlert !== undefined ? p.lowStockAlert : 5
  }));

  if (migrated.length > 0) {
    await tx.table('productsTemp').bulkAdd(migrated);
  }
});

// Version 4 schema: Recreate products table with ++id as primary key and clean up productsTemp
db.version(4).stores({
  products: '++id, barcode, name, price, stock, unit, lowStockAlert',
  productsTemp: null,
  orders: '++id, timestamp, total, customerPhone',
  settings: 'key, value',
  customers: 'phone, name, points'
}).upgrade(async (tx) => {
  const tempProducts = await tx.table('productsTemp').toArray();
  if (tempProducts.length > 0) {
    await tx.table('products').bulkAdd(tempProducts);
  }
});

// Version 5 schema: Add wholesale, credit pricing, tax, and debt management
db.version(5).stores({
  products: '++id, barcode, name, price, stock, unit, lowStockAlert, creditPrice, wholesalePrice, wholesaleCreditPrice, wholesaleUnit, wholesaleConversionRate, taxRate',
  orders: '++id, timestamp, total, customerPhone, paymentStatus, totalTax',
  settings: 'key, value',
  customers: 'phone, name, points, debt'
}).upgrade(async (tx) => {
  // Initialize new fields for existing records if necessary
  await tx.customers.toCollection().modify(customer => {
    if (customer.debt === undefined) customer.debt = 0;
  });
});

// Version 6 schema: Add promotions table
db.version(6).stores({
  products: '++id, barcode, name, price, stock, unit, lowStockAlert, creditPrice, wholesalePrice, wholesaleCreditPrice, wholesaleUnit, wholesaleConversionRate, taxRate',
  orders: '++id, timestamp, total, customerPhone, paymentStatus, totalTax',
  settings: 'key, value',
  customers: 'phone, name, points, debt',
  promotions: '++id, name, type, isActive'
});

// Version 7 schema: Add customerTransactions table
db.version(7).stores({
  products: '++id, barcode, name, price, stock, unit, lowStockAlert, creditPrice, wholesalePrice, wholesaleCreditPrice, wholesaleUnit, wholesaleConversionRate, taxRate',
  orders: '++id, timestamp, total, customerPhone, paymentStatus, totalTax',
  settings: 'key, value',
  customers: 'phone, name, points, debt',
  promotions: '++id, name, type, isActive',
  customerTransactions: '++id, customerPhone, timestamp, type, amount, remainingDebt'
}).upgrade(async (tx) => {
  // Migrate existing credit orders to customerTransactions
  const creditOrders = await tx.table('orders').where('paymentStatus').equals('credit').toArray();
  const customers = await tx.table('customers').toArray();
  
  // Sort credit orders chronologically
  creditOrders.sort((a, b) => a.timestamp - b.timestamp);
  
  // Track running debt per customer during migration
  const customerDebts = {};
  for (const c of customers) {
    customerDebts[c.phone] = 0;
  }
  
  const transactions = [];
  for (const order of creditOrders) {
    if (!order.customerPhone) continue;
    
    // Add to running debt
    const prevDebt = customerDebts[order.customerPhone] || 0;
    const newDebt = prevDebt + order.total;
    customerDebts[order.customerPhone] = newDebt;
    
    // Build brief note listing items
    const itemsSummary = order.items?.map(it => `${it.name} x${it.qty}`).join(', ') || '';
    
    transactions.push({
      customerPhone: order.customerPhone,
      timestamp: order.timestamp,
      type: 'debt',
      amount: order.total,
      orderId: order.id,
      note: `Giao hàng ghi nợ${itemsSummary ? ` (${itemsSummary})` : ''}`,
      remainingDebt: newDebt
    });
  }
  
  // Align to current customers.debt
  for (const c of customers) {
    const calcDebt = customerDebts[c.phone] || 0;
    const actualDebt = c.debt || 0;
    if (calcDebt !== actualDebt) {
      const diff = actualDebt - calcDebt;
      transactions.push({
        customerPhone: c.phone,
        timestamp: Date.now(),
        type: diff > 0 ? 'debt' : 'payment',
        amount: Math.abs(diff),
        note: diff > 0 ? 'Điều chỉnh tăng nợ cũ' : 'Thanh toán nợ cũ',
        remainingDebt: actualDebt
      });
    }
  }
  
  if (transactions.length > 0) {
    await tx.table('customerTransactions').bulkAdd(transactions);
  }
});

// Version 8 schema: Add users, shifts, attendance, and update orders
db.version(8).stores({
  products: '++id, barcode, name, price, stock, unit, lowStockAlert, creditPrice, wholesalePrice, wholesaleCreditPrice, wholesaleUnit, wholesaleConversionRate, taxRate',
  orders: '++id, timestamp, total, customerPhone, paymentStatus, totalTax, userId, shiftId',
  settings: 'key, value',
  customers: 'phone, name, points, debt',
  promotions: '++id, name, type, isActive',
  customerTransactions: '++id, customerPhone, timestamp, type, amount, remainingDebt',
  users: '++id, username, pinHash, role, name, isActive',
  shifts: '++id, userId, startTime, endTime, startingCash, expectedCash, actualCash, difference, status',
  attendance: '++id, userId, clockIn, clockOut, date, totalHours'
}).upgrade(async (tx) => {
  // Seed default admin user if no users exist
  const usersCount = await tx.table('users').count();
  if (usersCount === 0) {
    const defaultPinHash = await Dexie.waitFor(hashPin('0000'));
    await tx.table('users').add({
      username: 'admin',
      pinHash: defaultPinHash,
      role: 'admin',
      name: 'Chủ Cửa Hàng',
      isActive: true,
      mustChangePin: true
    });
  }
});

// Version 9 schema: Add suppliers and supplierTransactions
db.version(9).stores({
  products: '++id, barcode, name, price, stock, unit, lowStockAlert, creditPrice, wholesalePrice, wholesaleCreditPrice, wholesaleUnit, wholesaleConversionRate, taxRate',
  orders: '++id, timestamp, total, customerPhone, paymentStatus, totalTax, userId, shiftId',
  settings: 'key, value',
  customers: 'phone, name, points, debt',
  promotions: '++id, name, type, isActive',
  customerTransactions: '++id, customerPhone, timestamp, type, amount, remainingDebt',
  users: '++id, username, pinHash, role, name, isActive',
  shifts: '++id, userId, startTime, endTime, startingCash, expectedCash, actualCash, difference, status',
  attendance: '++id, userId, clockIn, clockOut, date, totalHours',
  suppliers: '++id, name, phone, debt, note',
  supplierTransactions: '++id, supplierId, timestamp, type, amount, remainingDebt, note'
});

// Version 10 schema: Add printers and printJobs
db.version(10).stores({
  products: '++id, barcode, name, price, stock, unit, lowStockAlert, creditPrice, wholesalePrice, wholesaleCreditPrice, wholesaleUnit, wholesaleConversionRate, taxRate',
  orders: '++id, timestamp, total, customerPhone, paymentStatus, totalTax, userId, shiftId',
  settings: 'key, value',
  customers: 'phone, name, points, debt',
  promotions: '++id, name, type, isActive',
  customerTransactions: '++id, customerPhone, timestamp, type, amount, remainingDebt',
  users: '++id, username, pinHash, role, name, isActive',
  shifts: '++id, userId, startTime, endTime, startingCash, expectedCash, actualCash, difference, status',
  attendance: '++id, userId, clockIn, clockOut, date, totalHours',
  suppliers: '++id, name, phone, debt, note',
  supplierTransactions: '++id, supplierId, timestamp, type, amount, remainingDebt, note',
  printers: '++id, name, type, paperSize, vietnameseMode, ip, port',
  printJobs: '++id, printerId, status, timestamp, type'
});

// Version 11: add shift-aware debt-payment indexes and force stores still
// using the shared bootstrap PIN to choose a private PIN before login.
db.version(11).stores({
  products: '++id, barcode, name, price, stock, unit, lowStockAlert, creditPrice, wholesalePrice, wholesaleCreditPrice, wholesaleUnit, wholesaleConversionRate, taxRate',
  orders: '++id, timestamp, total, customerPhone, paymentStatus, totalTax, userId, shiftId',
  settings: 'key, value',
  customers: 'phone, name, points, debt',
  promotions: '++id, name, type, isActive',
  customerTransactions: '++id, customerPhone, timestamp, type, amount, remainingDebt, shiftId, paymentMethod, [shiftId+type]',
  users: '++id, username, pinHash, role, name, isActive',
  shifts: '++id, userId, startTime, endTime, startingCash, expectedCash, actualCash, difference, status',
  attendance: '++id, userId, clockIn, clockOut, date, totalHours',
  suppliers: '++id, name, phone, debt, note',
  supplierTransactions: '++id, supplierId, timestamp, type, amount, remainingDebt, note',
  printers: '++id, name, type, paperSize, vietnameseMode, ip, port',
  printJobs: '++id, printerId, status, timestamp, type'
}).upgrade(async (tx) => {
  const [defaultPinHash, legacyDefaultPinHash] = await Dexie.waitFor(Promise.all([
    hashPin('0000'),
    legacyHashPin('0000')
  ]));
  await tx.table('users').filter(user => (
    user.pinHash === defaultPinHash || user.pinHash === legacyDefaultPinHash
  )).modify(user => {
    if (user.pinHash === defaultPinHash || user.pinHash === legacyDefaultPinHash) {
      user.mustChangePin = true;
    }
  });
});

// Helper to seed initial settings if empty
export const initializeSettings = async () => {
  const bankBinCount = await db.settings.where('key').equals('bankBin').count();
  if (bankBinCount === 0) {
    // Store ID is a capability token for the anonymous backup endpoint.
    const randomId = generateSecureStoreId();
    await db.settings.bulkPut([
      { key: 'bankBin', value: '970436' }, // Vietcombank by default
      { key: 'bankAccount', value: '000000000' },
      { key: 'bankAccountName', value: 'NGUYEN VAN A' },
      { key: 'storeId', value: randomId },
      { key: 'cloudSyncEnabled', value: 'false' },
      { key: 'vatEnabled', value: 'false' },
      { key: 'vatRate', value: '10' }
    ]);
  } else {
    // Make sure new settings are initialized for existing users
    const vatEnabledExists = await db.settings.where('key').equals('vatEnabled').count();
    if (vatEnabledExists === 0) {
      await db.settings.bulkPut([
        { key: 'vatEnabled', value: 'false' },
        { key: 'vatRate', value: '10' }
      ]);
    }
  }
};

export const initializeUsers = async () => {
  const usersCount = await db.users.count();
  if (usersCount === 0) {
    const defaultPinHash = await hashPin('0000');
    await db.users.add({
      username: 'admin',
      pinHash: defaultPinHash,
      role: 'admin',
      name: 'Chủ Cửa Hàng',
      isActive: true,
      mustChangePin: true
    });
  }
};

initializeSettings();
initializeUsers();
