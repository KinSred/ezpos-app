import { db } from '../db';
import { hashPin, legacyHashPin } from './security';

const BACKUP_FORMAT = 'ezpos-backup';
const CURRENT_BACKUP_VERSION = 3;
const LEGACY_BACKUP_VERSION = 2;
// Keep the whole staff identity graph local. Restoring shifts/attendance without
// their credential-bearing users would otherwise attach records to wrong IDs.
const ALWAYS_OMIT_CLOUD_TABLES = new Set(['settings', 'users', 'shifts', 'attendance']);
const LEGACY_PRESERVE_TABLES = new Set(['users', 'shifts', 'attendance']);

const SENSITIVE_KEY_FRAGMENTS = [
  'apikey',
  'accesstoken',
  'refreshtoken',
  'authtoken',
  'authorization',
  'clientsecret',
  'credential',
  'password',
  'passphrase',
  'privatekey',
  'pinhash',
  'secret',
  'token'
];

const isPlainRecord = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const normalizeKeyName = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

const isSensitiveKeyName = (key) => {
  const normalizedKey = normalizeKeyName(key);
  return normalizedKey === 'pin'
    || SENSITIVE_KEY_FRAGMENTS.some(fragment => normalizedKey.includes(fragment));
};

const containsSensitiveField = (value, visited = new WeakSet()) => {
  if (value === null || typeof value !== 'object') return false;
  if (visited.has(value)) return false;
  visited.add(value);

  if (Array.isArray(value)) {
    return value.some(item => containsSensitiveField(item, visited));
  }

  if (Object.prototype.hasOwnProperty.call(value, 'key') && isSensitiveKeyName(value.key)) {
    return true;
  }

  return Object.entries(value).some(([key, nestedValue]) => (
    isSensitiveKeyName(key) || containsSensitiveField(nestedValue, visited)
  ));
};

const getTableMap = () => new Map(db.tables.map(table => [table.name, table]));

const validateTableRows = (tableName, rows, table) => {
  if (!Array.isArray(rows)) {
    throw new Error(`Bảng "${tableName}" trong bản sao lưu phải là một mảng.`);
  }

  const primaryKey = table.schema.primKey;
  const seenPrimaryKeys = new Set();
  rows.forEach((row, index) => {
    if (!isPlainRecord(row)) {
      throw new Error(`Bản ghi ${index + 1} của bảng "${tableName}" không hợp lệ.`);
    }

    if (typeof primaryKey.keyPath === 'string' && row[primaryKey.keyPath] === undefined) {
      throw new Error(
        `Bản ghi ${index + 1} của bảng "${tableName}" thiếu khóa chính "${primaryKey.keyPath}".`
      );
    }

    if (typeof primaryKey.keyPath === 'string') {
      const primaryKeyValue = row[primaryKey.keyPath];
      const serializedKey = `${typeof primaryKeyValue}:${JSON.stringify(primaryKeyValue)}`;
      if (seenPrimaryKeys.has(serializedKey)) {
        throw new Error(`Bảng "${tableName}" chứa khóa chính trùng lặp ở bản ghi ${index + 1}.`);
      }
      seenPrimaryKeys.add(serializedKey);
    }
  });
};

const normalizeLegacyBackup = (data, tableMap) => {
  const requiredTables = ['products', 'orders', 'settings'];
  for (const tableName of requiredTables) {
    if (!Object.prototype.hasOwnProperty.call(data, tableName)) {
      throw new Error(`Bản sao lưu v2 thiếu bảng bắt buộc "${tableName}".`);
    }
  }

  const tables = Object.fromEntries([...tableMap.keys()].map(tableName => [tableName, []]));
  const legacyTables = {
    products: data.products,
    orders: data.orders,
    settings: data.settings,
    customers: data.customers ?? []
  };

  for (const [tableName, rows] of Object.entries(legacyTables)) {
    const table = tableMap.get(tableName);
    if (!table) continue;
    validateTableRows(tableName, rows, table);
    tables[tableName] = tableName === 'orders'
      ? rows.map(row => {
          const { userId: _userId, shiftId: _shiftId, ...safeOrder } = row;
          return safeOrder;
        })
      : rows;
  }

  return {
    tables,
    // A v2 file predates authentication. Keep the local identity graph so an
    // otherwise valid restore cannot delete the last administrator and lock
    // the store out of the application.
    tablesToRestore: [...tableMap.keys()].filter(tableName => !LEGACY_PRESERVE_TABLES.has(tableName))
  };
};

const normalizeCurrentBackup = (data, tableMap) => {
  if (data.format !== BACKUP_FORMAT) {
    throw new Error(`Định dạng bản sao lưu v${CURRENT_BACKUP_VERSION} không hợp lệ.`);
  }
  if (!Number.isInteger(data.databaseVersion) || data.databaseVersion <= 0) {
    throw new Error('Bản sao lưu thiếu phiên bản cơ sở dữ liệu hợp lệ.');
  }
  if (!Number.isFinite(data.backupTime) || data.backupTime <= 0) {
    throw new Error('Bản sao lưu thiếu thời điểm tạo hợp lệ.');
  }
  if (data.databaseVersion > db.verno) {
    throw new Error(
      `Bản sao lưu dùng cơ sở dữ liệu v${data.databaseVersion}, mới hơn phiên bản ứng dụng hiện tại (v${db.verno}).`
    );
  }
  if (!isPlainRecord(data.tables)) {
    throw new Error('Bản sao lưu thiếu danh sách bảng dữ liệu hợp lệ.');
  }

  const unknownTables = Object.keys(data.tables).filter(tableName => !tableMap.has(tableName));
  if (unknownTables.length > 0) {
    throw new Error(`Bản sao lưu chứa bảng chưa được hỗ trợ: ${unknownTables.join(', ')}.`);
  }

  let omittedTables = [];
  if (data.cloudSanitization !== undefined) {
    if (!isPlainRecord(data.cloudSanitization)
      || data.cloudSanitization.sanitized !== true
      || !Array.isArray(data.cloudSanitization.omittedTables)) {
      throw new Error('Thông tin bảo vệ dữ liệu nhạy cảm của bản sao lưu cloud không hợp lệ.');
    }

    omittedTables = data.cloudSanitization.omittedTables;
    const invalidOmittedTables = omittedTables.filter(tableName => (
      typeof tableName !== 'string' || !tableMap.has(tableName)
    ));
    if (invalidOmittedTables.length > 0) {
      throw new Error('Bản sao lưu cloud khai báo bảng bị lược bỏ không hợp lệ.');
    }
    if (new Set(omittedTables).size !== omittedTables.length) {
      throw new Error('Bản sao lưu cloud khai báo trùng bảng bị lược bỏ.');
    }
    if (!Number.isInteger(data.cloudSanitization.removedSensitiveSettings)
      || data.cloudSanitization.removedSensitiveSettings < 0) {
      throw new Error('Số lượng cài đặt nhạy cảm đã lược bỏ không hợp lệ.');
    }
  }

  const omittedTableSet = new Set(omittedTables);
  const tables = {};
  const tablesToRestore = [];

  for (const [tableName, table] of tableMap) {
    if (omittedTableSet.has(tableName)) {
      if (Object.prototype.hasOwnProperty.call(data.tables, tableName)) {
        throw new Error(`Bảng "${tableName}" vừa có dữ liệu vừa được khai báo là đã lược bỏ.`);
      }
      continue;
    }

    // Older sanitized cloud backups could still contain settings or shift
    // rows. Preserve the complete local identity/settings graph regardless of
    // what an older cloud manifest declared.
    if (data.cloudSanitization !== undefined && ALWAYS_OMIT_CLOUD_TABLES.has(tableName)) {
      if (Object.prototype.hasOwnProperty.call(data.tables, tableName)) {
        validateTableRows(tableName, data.tables[tableName], table);
      }
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(data.tables, tableName)) {
      if (data.databaseVersion < db.verno) {
        tables[tableName] = [];
        tablesToRestore.push(tableName);
        continue;
      }
      throw new Error(`Bản sao lưu thiếu bảng bắt buộc "${tableName}".`);
    }

    validateTableRows(tableName, data.tables[tableName], table);
    tables[tableName] = data.tables[tableName];
    tablesToRestore.push(tableName);
  }

  return { tables, tablesToRestore };
};

const normalizeBackupData = (data) => {
  if (!isPlainRecord(data)) {
    throw new Error('Dữ liệu sao lưu phải là một đối tượng JSON hợp lệ.');
  }

  const tableMap = getTableMap();
  if (data.version === LEGACY_BACKUP_VERSION) {
    return normalizeLegacyBackup(data, tableMap);
  }
  if (data.version === CURRENT_BACKUP_VERSION) {
    return normalizeCurrentBackup(data, tableMap);
  }

  const displayedVersion = data.version === undefined ? 'không xác định' : data.version;
  throw new Error(`Phiên bản sao lưu "${displayedVersion}" chưa được hỗ trợ.`);
};

const createCloudSafeBackup = (backup) => {
  const safeTables = {};
  const omittedTables = [];
  let removedSensitiveSettings = 0;

  for (const [tableName, rows] of Object.entries(backup.tables)) {
    if (ALWAYS_OMIT_CLOUD_TABLES.has(tableName)) {
      if (tableName === 'settings') {
        removedSensitiveSettings = rows.filter(setting => isSensitiveKeyName(setting.key)).length;
      }
      omittedTables.push(tableName);
      continue;
    }

    if (rows.some(row => containsSensitiveField(row))) {
      omittedTables.push(tableName);
      continue;
    }

    safeTables[tableName] = rows.map(row => {
      // Staff/shift tables stay local, so their numeric IDs must not be
      // restored onto an unrelated local identity graph.
      const { userId: _userId, shiftId: _shiftId, ...safeRow } = row;
      return safeRow;
    });
  }

  return {
    ...backup,
    tables: safeTables,
    cloudSanitization: {
      sanitized: true,
      omittedTables,
      removedSensitiveSettings
    }
  };
};

const getCloudBackupUrl = (storeId) => {
  if (typeof storeId !== 'string') return null;
  const cleanStoreId = storeId.trim().toUpperCase();
  if (!cleanStoreId) return null;
  return `https://kvdb.io/POSProBackupBucket/${encodeURIComponent(cleanStoreId)}`;
};

/**
 * Gathers a transactionally consistent snapshot of every current IndexedDB table.
 */
export const generateBackupData = async () => {
  const currentTables = [...db.tables];
  const tables = await db.transaction('r', currentTables, async () => {
    const entries = await Promise.all(currentTables.map(async table => (
      [table.name, await table.toArray()]
    )));
    return Object.fromEntries(entries);
  });

  return {
    format: BACKUP_FORMAT,
    version: CURRENT_BACKUP_VERSION,
    databaseVersion: db.verno,
    backupTime: Date.now(),
    tables
  };
};

/**
 * Replaces all tables represented by a validated backup in one atomic transaction.
 * Legacy v2 backups are expanded with empty newer tables to prevent stale data mixing.
 * Cloud-safe backups intentionally preserve locally stored credential-bearing tables.
 */
export const restoreBackupData = async (data) => {
  const { tables, tablesToRestore } = normalizeBackupData(data);
  if (tablesToRestore.includes('users')) {
    const users = tables.users || [];
    const usernames = new Set();
    const hasInvalidCredential = users.some(user => {
      const username = typeof user?.username === 'string' ? user.username.trim() : '';
      const normalizedUsername = username.toLowerCase();
      const duplicateUsername = usernames.has(normalizedUsername);
      usernames.add(normalizedUsername);
      return !username
        || duplicateUsername
        || typeof user?.pinHash !== 'string'
        || !/^[0-9a-f]{64}$/i.test(user.pinHash);
    });
    if (hasInvalidCredential) {
      throw new Error('Bản sao lưu chứa tài khoản thiếu tên đăng nhập, trùng tên hoặc mã PIN không hợp lệ.');
    }
    if (!users.some(user => user?.role === 'admin'
      && user?.isActive === true
      && typeof user.username === 'string'
      && user.username.trim())) {
      throw new Error('Bản sao lưu không có tài khoản Admin đang hoạt động nên không thể khôi phục an toàn.');
    }
  }

  const tableMap = getTableMap();
  const dexieTables = tablesToRestore.map(tableName => tableMap.get(tableName));
  const defaultPinHash = await hashPin('0000');
  const legacyDefaultPinHash = await legacyHashPin('0000');
  const transactionTables = [...new Set([...dexieTables, db.users])];

  await db.transaction('rw', transactionTables, async () => {
    for (const tableName of tablesToRestore) {
      await tableMap.get(tableName).clear();
    }

    for (const tableName of tablesToRestore) {
      const rows = tables[tableName];
      if (rows.length > 0) {
        await tableMap.get(tableName).bulkPut(rows);
      }
    }

    await db.users.filter(user => (
      user.pinHash === defaultPinHash || user.pinHash === legacyDefaultPinHash
    )).modify({ mustChangePin: true });
  });

  try {
    localStorage.setItem('pos_last_backup_time', Date.now().toString());
  } catch (error) {
    console.warn('Không thể cập nhật thời gian sao lưu trong LocalStorage:', error);
  }
};

/**
 * Saves a complete local copy of the database as a fallback backup.
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
 * Uploads a sanitized database backup to the anonymous cloud database (kvdb.io).
 */
export const syncToCloud = async (storeId) => {
  const url = getCloudBackupUrl(storeId);
  if (!url) return false;

  try {
    const data = createCloudSafeBackup(await generateBackupData());
    const response = await fetch(url, {
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
 * Fetches a database backup from the anonymous cloud database (kvdb.io).
 */
export const fetchFromCloud = async (storeId) => {
  const url = getCloudBackupUrl(storeId);
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Lỗi khi tải dữ liệu từ đám mây:', error);
    return null;
  }
};
