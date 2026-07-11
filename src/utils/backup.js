import { db } from '../db';

/**
 * Gathers all data from IndexedDB stores to form a single backup object.
 */
export const generateBackupData = async () => {
  const products = await db.products.toArray();
  const orders = await db.orders.toArray();
  const settings = await db.settings.toArray();
  const customers = await db.customers.toArray();

  return {
    version: 2,
    backupTime: Date.now(),
    products,
    orders,
    settings,
    customers
  };
};

/**
 * Overwrites the IndexedDB database with the provided backup data.
 */
export const restoreBackupData = async (data) => {
  if (!data || typeof data !== 'object') {
    throw new Error('Dữ liệu sao lưu không hợp lệ.');
  }

  // Basic validation of keys
  if (!data.products || !data.orders || !data.settings) {
    throw new Error('Cấu trúc file sao lưu không đúng định dạng POS Pro.');
  }

  await db.transaction('rw', [db.products, db.orders, db.settings, db.customers], async () => {
    // Clear current data
    await db.products.clear();
    await db.orders.clear();
    await db.settings.clear();
    await db.customers.clear();

    // Insert backup data
    if (data.products.length > 0) await db.products.bulkPut(data.products);
    if (data.orders.length > 0) await db.orders.bulkPut(data.orders);
    if (data.settings.length > 0) await db.settings.bulkPut(data.settings);
    if (data.customers && data.customers.length > 0) await db.customers.bulkPut(data.customers);
  });

  // Keep track of backup time in localStorage to clear any warnings
  localStorage.setItem('pos_last_backup_time', Date.now().toString());
};

/**
 * Saves a copy of the database to LocalStorage as a fallback backup.
 */
export const autoSaveToLocalStorage = async () => {
  try {
    const data = await generateBackupData();
    localStorage.setItem('pos_local_backup', JSON.stringify(data));
    localStorage.setItem('pos_last_backup_time', Date.now().toString());
  } catch (error) {
    console.error('Lỗi khi tự động lưu LocalStorage:', error);
  }
};

/**
 * Uploads database backup to anonymous cloud database (kvdb.io)
 */
export const syncToCloud = async (storeId) => {
  if (!storeId) return false;
  try {
    const data = await generateBackupData();
    const cleanStoreId = storeId.trim().toUpperCase();
    const response = await fetch(`https://kvdb.io/POSProBackupBucket/${cleanStoreId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.ok;
  } catch (error) {
    console.error('Lỗi khi đồng bộ đám mây:', error);
    return false;
  }
};

/**
 * Fetches database backup from anonymous cloud database (kvdb.io)
 */
export const fetchFromCloud = async (storeId) => {
  if (!storeId) return null;
  try {
    const cleanStoreId = storeId.trim().toUpperCase();
    const response = await fetch(`https://kvdb.io/POSProBackupBucket/${cleanStoreId}`);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return null;
  } catch (error) {
    console.error('Lỗi khi tải dữ liệu từ đám mây:', error);
    return null;
  }
};
