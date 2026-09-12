import { Pool } from 'pg';

let pool: Pool | null = null;
let isInitialized = false;

/**
 * 取得或建立 PostgreSQL Connection Pool
 */
export function getDbPool(): Pool | null {
  if (pool) return pool;

  const dbUrl = process.env.DATABASE_URL?.trim();
  const host = process.env.PGHOST?.trim();

  if (dbUrl) {
    try {
      const isRemote = !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1');
      pool = new Pool({
        connectionString: dbUrl,
        ssl: isRemote ? { rejectUnauthorized: false } : undefined,
        max: 10,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000
      });

      pool.on('error', (err) => {
        console.error('PostgreSQL Pool 發生錯誤:', err);
      });

      return pool;
    } catch (err) {
      console.error('解析 DATABASE_URL 失敗:', err);
      return null;
    }
  }

  if (host) {
    try {
      const isRemote = host !== 'localhost' && host !== '127.0.0.1';
      pool = new Pool({
        host,
        port: Number(process.env.PGPORT) || 5432,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl: isRemote || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
        max: 10,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000
      });

      pool.on('error', (err) => {
        console.error('PostgreSQL Pool 發生錯誤:', err);
      });

      return pool;
    } catch (err) {
      console.error('建立 PostgreSQL 連線失敗:', err);
      return null;
    }
  }

  return null;
}

/**
 * 檢查 PostgreSQL 連線狀態
 */
export async function checkDbConnection(): Promise<{
  connected: boolean;
  configured: boolean;
  message: string;
  version?: string;
}> {
  const p = getDbPool();
  if (!p) {
    return {
      connected: false,
      configured: false,
      message: '尚未設定 DATABASE_URL 或 PostgreSQL 環境變數，目前使用本機離線模式'
    };
  }

  try {
    const res = await p.query('SELECT version(), NOW() AS server_time');
    const versionStr = res.rows[0]?.version || 'PostgreSQL';
    return {
      connected: true,
      configured: true,
      message: 'PostgreSQL 資料庫連線正常',
      version: versionStr.split(' on ')[0]
    };
  } catch (err: any) {
    console.error('PostgreSQL 連線測試失敗:', err.message);
    return {
      connected: false,
      configured: true,
      message: `連線 PostgreSQL 失敗: ${err.message}`
    };
  }
}

/**
 * 初始化資料庫綱要 (自動建立 customers, vendors, products, quotes 資料表)
 */
export async function initDbSchema(): Promise<boolean> {
  if (isInitialized) return true;
  const p = getDbPool();
  if (!p) return false;

  try {
    const client = await p.connect();
    try {
      await client.query(`
        -- 1. 客戶資料表
        CREATE TABLE IF NOT EXISTS customers (
          customer_id VARCHAR(50) PRIMARY KEY,
          company_name VARCHAR(200) NOT NULL,
          tax_id VARCHAR(50),
          contact_person VARCHAR(100),
          phone VARCHAR(50),
          email VARCHAR(100),
          address TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- 2. 廠商資料表
        CREATE TABLE IF NOT EXISTS vendors (
          vendor_id VARCHAR(50) PRIMARY KEY,
          company_name VARCHAR(200) NOT NULL,
          tax_id VARCHAR(50),
          contact_person VARCHAR(100),
          phone VARCHAR(50),
          email VARCHAR(100),
          address TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- 3. 產品資料表 (成本與售價分欄)
        CREATE TABLE IF NOT EXISTS products (
          product_id VARCHAR(50) PRIMARY KEY,
          product_name VARCHAR(200) NOT NULL,
          specs TEXT,
          unit VARCHAR(20) NOT NULL,
          cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
          unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
          stock INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- 4. 報價單資料表
        CREATE TABLE IF NOT EXISTS quotes (
          quote_id VARCHAR(50) PRIMARY KEY,
          quote_date VARCHAR(20) NOT NULL,
          customer_id VARCHAR(50) NOT NULL,
          customer_name VARCHAR(200) NOT NULL,
          tax_id VARCHAR(50),
          contact_person VARCHAR(100),
          phone VARCHAR(50),
          email VARCHAR(100),
          address TEXT,
          items JSONB NOT NULL DEFAULT '[]'::jsonb,
          subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
          tax_type VARCHAR(20) NOT NULL DEFAULT 'tax_inclusive',
          tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
          total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
          notes TEXT,
          status VARCHAR(20) NOT NULL DEFAULT '草稿',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      isInitialized = true;
      console.log('PostgreSQL 資料庫表初始化成功');
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('初始化 PostgreSQL 表結構失敗:', err.message);
    return false;
  }
}

// ----------------------------------------------------
// 客戶 CRUD 操作
// ----------------------------------------------------
export async function dbGetCustomers() {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  const res = await p.query('SELECT * FROM customers ORDER BY customer_id ASC');
  return res.rows.map(r => ({
    customerId: r.customer_id,
    companyName: r.company_name,
    taxId: r.tax_id || '',
    contactPerson: r.contact_person || '',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export async function dbUpsertCustomer(c: any) {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  await p.query(
    `INSERT INTO customers (customer_id, company_name, tax_id, contact_person, phone, email, address, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (customer_id) DO UPDATE SET
       company_name = EXCLUDED.company_name,
       tax_id = EXCLUDED.tax_id,
       contact_person = EXCLUDED.contact_person,
       phone = EXCLUDED.phone,
       email = EXCLUDED.email,
       address = EXCLUDED.address,
       updated_at = NOW()`,
    [c.customerId, c.companyName, c.taxId || '', c.contactPerson || '', c.phone || '', c.email || '', c.address || '']
  );
}

export async function dbDeleteCustomer(customerId: string) {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  await p.query('DELETE FROM customers WHERE customer_id = $1', [customerId]);
}

// ----------------------------------------------------
// 廠商 CRUD 操作
// ----------------------------------------------------
export async function dbGetVendors() {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  const res = await p.query('SELECT * FROM vendors ORDER BY vendor_id ASC');
  return res.rows.map(r => ({
    vendorId: r.vendor_id,
    companyName: r.company_name,
    taxId: r.tax_id || '',
    contactPerson: r.contact_person || '',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export async function dbUpsertVendor(v: any) {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  await p.query(
    `INSERT INTO vendors (vendor_id, company_name, tax_id, contact_person, phone, email, address, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (vendor_id) DO UPDATE SET
       company_name = EXCLUDED.company_name,
       tax_id = EXCLUDED.tax_id,
       contact_person = EXCLUDED.contact_person,
       phone = EXCLUDED.phone,
       email = EXCLUDED.email,
       address = EXCLUDED.address,
       updated_at = NOW()`,
    [v.vendorId, v.companyName, v.taxId || '', v.contactPerson || '', v.phone || '', v.email || '', v.address || '']
  );
}

export async function dbDeleteVendor(vendorId: string) {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  await p.query('DELETE FROM vendors WHERE vendor_id = $1', [vendorId]);
}

// ----------------------------------------------------
// 產品 CRUD 操作
// ----------------------------------------------------
export async function dbGetProducts() {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  const res = await p.query('SELECT * FROM products ORDER BY product_id ASC');
  return res.rows.map(r => ({
    productId: r.product_id,
    productName: r.product_name,
    specs: r.specs || '',
    unit: r.unit || '件',
    costPrice: Number(r.cost_price) || 0,
    unitPrice: Number(r.unit_price) || 0,
    stock: Number(r.stock) || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export async function dbUpsertProduct(pData: any) {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  await p.query(
    `INSERT INTO products (product_id, product_name, specs, unit, cost_price, unit_price, stock, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (product_id) DO UPDATE SET
       product_name = EXCLUDED.product_name,
       specs = EXCLUDED.specs,
       unit = EXCLUDED.unit,
       cost_price = EXCLUDED.cost_price,
       unit_price = EXCLUDED.unit_price,
       stock = EXCLUDED.stock,
       updated_at = NOW()`,
    [
      pData.productId,
      pData.productName,
      pData.specs || '',
      pData.unit || '件',
      Number(pData.costPrice) || 0,
      Number(pData.unitPrice) || 0,
      Number(pData.stock) || 0
    ]
  );
}

export async function dbDeleteProduct(productId: string) {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  await p.query('DELETE FROM products WHERE product_id = $1', [productId]);
}

// ----------------------------------------------------
// 報價單 CRUD 操作
// ----------------------------------------------------
export async function dbGetQuotes() {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  const res = await p.query('SELECT * FROM quotes ORDER BY quote_id DESC');
  return res.rows.map(r => ({
    quoteId: r.quote_id,
    quoteDate: r.quote_date,
    customerId: r.customer_id,
    customerName: r.customer_name,
    taxId: r.tax_id || '',
    contactPerson: r.contact_person || '',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
    subtotal: Number(r.subtotal) || 0,
    taxType: r.tax_type || 'tax_inclusive',
    taxAmount: Number(r.tax_amount) || 0,
    totalAmount: Number(r.total_amount) || 0,
    notes: r.notes || '',
    status: r.status || '草稿',
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export async function dbUpsertQuote(q: any) {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  await p.query(
    `INSERT INTO quotes (
      quote_id, quote_date, customer_id, customer_name, tax_id, contact_person,
      phone, email, address, items, subtotal, tax_type, tax_amount, total_amount, notes, status, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
    ON CONFLICT (quote_id) DO UPDATE SET
      quote_date = EXCLUDED.quote_date,
      customer_id = EXCLUDED.customer_id,
      customer_name = EXCLUDED.customer_name,
      tax_id = EXCLUDED.tax_id,
      contact_person = EXCLUDED.contact_person,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      address = EXCLUDED.address,
      items = EXCLUDED.items,
      subtotal = EXCLUDED.subtotal,
      tax_type = EXCLUDED.tax_type,
      tax_amount = EXCLUDED.tax_amount,
      total_amount = EXCLUDED.total_amount,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status,
      updated_at = NOW()`,
    [
      q.quoteId,
      q.quoteDate,
      q.customerId,
      q.customerName,
      q.taxId || '',
      q.contactPerson || '',
      q.phone || '',
      q.email || '',
      q.address || '',
      JSON.stringify(q.items || []),
      Number(q.subtotal) || 0,
      q.taxType || 'tax_inclusive',
      Number(q.taxAmount) || 0,
      Number(q.totalAmount) || 0,
      q.notes || '',
      q.status || '草稿'
    ]
  );
}

export async function dbDeleteQuote(quoteId: string) {
  const p = getDbPool();
  if (!p) throw new Error('PostgreSQL 未連線');
  await p.query('DELETE FROM quotes WHERE quote_id = $1', [quoteId]);
}
