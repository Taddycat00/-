/**
 * PostgreSQL 雲端資料庫前端同步服務
 * 透過後端 Express API (/api/*) 與 PostgreSQL (Neon / Cloud SQL / Supabase) 進行通訊
 */

let isConnected = false;
let isConfigured = false;
let statusMessage = '';
let statusListeners = [];

export const PostgresService = {
  /**
   * 取得當前是否連線至 PostgreSQL
   */
  isConnected() {
    return isConnected;
  },

  /**
   * 取得連線狀態說明
   */
  getStatus() {
    return { isConnected, isConfigured, statusMessage };
  },

  /**
   * 註冊狀態改變監聽器
   */
  onStatusChange(listener) {
    if (typeof listener === 'function') {
      statusListeners.push(listener);
      listener(isConnected, isConfigured, statusMessage);
    }
  },

  _notifyListeners() {
    statusListeners.forEach(fn => {
      try {
        fn(isConnected, isConfigured, statusMessage);
      } catch (e) {
        console.error('Status listener error:', e);
      }
    });
  },

  /**
   * 初始化並檢查 PostgreSQL 資料庫連線狀態
   */
  async init(onDataSyncedCallback) {
    await this.checkStatus();
    if (isConnected) {
      console.log('PostgreSQL 已連線，執行初次資料同步...');
      await this.syncAll(onDataSyncedCallback);
    }
  },

  /**
   * 檢查伺服器 PostgreSQL 連線狀態
   */
  async checkStatus() {
    try {
      const res = await fetch('/api/db/status');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      isConnected = !!data.connected;
      isConfigured = !!data.configured;
      statusMessage = data.message || (isConnected ? 'PostgreSQL 連線正常' : '本地離線模式');
    } catch (err) {
      isConnected = false;
      isConfigured = false;
      statusMessage = '無法連線至後端伺服器 (切換本地離線模式)';
    }
    this._notifyListeners();
    return { isConnected, isConfigured, statusMessage };
  },

  /**
   * 全量雙向同步 (客戶、廠商、產品、報價單)
   */
  async syncAll(onDataSyncedCallback) {
    try {
      // 讀取當前 LocalStorage 內的最新資料
      const localCustomers = JSON.parse(localStorage.getItem('sys_customers') || '[]');
      const localVendors = JSON.parse(localStorage.getItem('sys_vendors') || '[]');
      const localProducts = JSON.parse(localStorage.getItem('sys_products') || '[]');
      const localQuotes = JSON.parse(localStorage.getItem('sys_quotes') || '[]');

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customers: localCustomers,
          vendors: localVendors,
          products: localProducts,
          quotes: localQuotes
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.success && json.data) {
        const { customers, vendors, products, quotes } = json.data;

        // 如果資料庫回傳的資料筆數大於等於本地或本地為空，以資料庫為準更新本地快取
        if (Array.isArray(customers) && (customers.length > 0 || localCustomers.length === 0)) {
          localStorage.setItem('sys_customers', JSON.stringify(customers));
        }
        if (Array.isArray(vendors) && (vendors.length > 0 || localVendors.length === 0)) {
          localStorage.setItem('sys_vendors', JSON.stringify(vendors));
        }
        if (Array.isArray(products) && (products.length > 0 || localProducts.length === 0)) {
          localStorage.setItem('sys_products', JSON.stringify(products));
        }
        if (Array.isArray(quotes) && (quotes.length > 0 || localQuotes.length === 0)) {
          localStorage.setItem('sys_quotes', JSON.stringify(quotes));
        }

        isConnected = true;
        this._notifyListeners();

        if (typeof onDataSyncedCallback === 'function') {
          onDataSyncedCallback(json.data);
        }
        return json.data;
      }
    } catch (err) {
      console.warn('與 PostgreSQL 同步失敗，維持本地儲存:', err);
      // 若同步失敗，不阻塞本地操作
    }
  },

  // ----------------------------------------------------
  // 單項即時同步 API
  // ----------------------------------------------------
  async saveCustomer(customer) {
    try {
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
      });
    } catch (err) {
      console.warn('客戶上傳至 PostgreSQL 失敗:', err);
    }
  },

  async deleteCustomer(customerId) {
    try {
      await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('從 PostgreSQL 刪除客戶失敗:', err);
    }
  },

  async saveVendor(vendor) {
    try {
      await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendor)
      });
    } catch (err) {
      console.warn('廠商上傳至 PostgreSQL 失敗:', err);
    }
  },

  async deleteVendor(vendorId) {
    try {
      await fetch(`/api/vendors/${encodeURIComponent(vendorId)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('從 PostgreSQL 刪除廠商失敗:', err);
    }
  },

  async saveProduct(product) {
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
    } catch (err) {
      console.warn('產品上傳至 PostgreSQL 失敗:', err);
    }
  },

  async deleteProduct(productId) {
    try {
      await fetch(`/api/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('從 PostgreSQL 刪除產品失敗:', err);
    }
  },

  async saveQuote(quote) {
    try {
      await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quote)
      });
    } catch (err) {
      console.warn('報價單上傳至 PostgreSQL 失敗:', err);
    }
  },

  async deleteQuote(quoteId) {
    try {
      await fetch(`/api/quotes/${encodeURIComponent(quoteId)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('從 PostgreSQL 刪除報價單失敗:', err);
    }
  }
};
