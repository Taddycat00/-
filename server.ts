import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  checkDbConnection,
  initDbSchema,
  dbGetCustomers,
  dbUpsertCustomer,
  dbDeleteCustomer,
  dbGetVendors,
  dbUpsertVendor,
  dbDeleteVendor,
  dbGetProducts,
  dbUpsertProduct,
  dbDeleteProduct,
  dbGetQuotes,
  dbUpsertQuote,
  dbDeleteQuote
} from './server/db.ts';

dotenv.config();

const PORT = 3000;
const app = express();

app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------
// PostgreSQL 資料庫狀態與測試 API
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/db/status', async (req, res) => {
  try {
    const status = await checkDbConnection();
    if (status.connected) {
      await initDbSchema();
    }
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ connected: false, configured: false, message: err.message });
  }
});

app.post('/api/db/init', async (req, res) => {
  try {
    const success = await initDbSchema();
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 客戶 API
// ----------------------------------------------------
app.get('/api/customers', async (req, res) => {
  try {
    const data = await dbGetCustomers();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const customer = req.body;
    if (!customer || !customer.customerId) {
      return res.status(400).json({ success: false, error: '缺少客戶編號' });
    }
    await dbUpsertCustomer(customer);
    res.json({ success: true, customerId: customer.customerId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    await dbDeleteCustomer(customerId);
    res.json({ success: true, customerId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 廠商 API
// ----------------------------------------------------
app.get('/api/vendors', async (req, res) => {
  try {
    const data = await dbGetVendors();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/vendors', async (req, res) => {
  try {
    const vendor = req.body;
    if (!vendor || !vendor.vendorId) {
      return res.status(400).json({ success: false, error: '缺少廠商編號' });
    }
    await dbUpsertVendor(vendor);
    res.json({ success: true, vendorId: vendor.vendorId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/vendors/:id', async (req, res) => {
  try {
    const vendorId = req.params.id;
    await dbDeleteVendor(vendorId);
    res.json({ success: true, vendorId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 產品 API
// ----------------------------------------------------
app.get('/api/products', async (req, res) => {
  try {
    const data = await dbGetProducts();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = req.body;
    if (!product || !product.productId) {
      return res.status(400).json({ success: false, error: '缺少產品編號' });
    }
    await dbUpsertProduct(product);
    res.json({ success: true, productId: product.productId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    await dbDeleteProduct(productId);
    res.json({ success: true, productId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 報價單 API
// ----------------------------------------------------
app.get('/api/quotes', async (req, res) => {
  try {
    const data = await dbGetQuotes();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/quotes', async (req, res) => {
  try {
    const quote = req.body;
    if (!quote || !quote.quoteId) {
      return res.status(400).json({ success: false, error: '缺少報價單編號' });
    }
    await dbUpsertQuote(quote);
    res.json({ success: true, quoteId: quote.quoteId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/quotes/:id', async (req, res) => {
  try {
    const quoteId = req.params.id;
    await dbDeleteQuote(quoteId);
    res.json({ success: true, quoteId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 全量同步 API (雙向推送與拉取)
// ----------------------------------------------------
app.post('/api/sync', async (req, res) => {
  try {
    await initDbSchema();
    const { customers, vendors, products, quotes } = req.body;

    if (Array.isArray(customers)) {
      for (const c of customers) {
        if (c && c.customerId) await dbUpsertCustomer(c);
      }
    }
    if (Array.isArray(vendors)) {
      for (const v of vendors) {
        if (v && v.vendorId) await dbUpsertVendor(v);
      }
    }
    if (Array.isArray(products)) {
      for (const p of products) {
        if (p && p.productId) await dbUpsertProduct(p);
      }
    }
    if (Array.isArray(quotes)) {
      for (const q of quotes) {
        if (q && q.quoteId) await dbUpsertQuote(q);
      }
    }

    // 回傳資料庫中最新數據
    const [latestCustomers, latestVendors, latestProducts, latestQuotes] = await Promise.all([
      dbGetCustomers(),
      dbGetVendors(),
      dbGetProducts(),
      dbGetQuotes()
    ]);

    res.json({
      success: true,
      data: {
        customers: latestCustomers,
        vendors: latestVendors,
        products: latestProducts,
        quotes: latestQuotes
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// Vite 中介層與 SPA 服務
// ----------------------------------------------------
async function startServer() {
  // 自動嘗試初始化資料庫結構 (若已配置)
  initDbSchema().catch(() => {});

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PostgreSQL Server] 系統運行於 http://0.0.0.0:${PORT}`);
  });
}

startServer();
