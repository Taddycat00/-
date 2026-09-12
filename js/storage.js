/**
 * 報價單管理系統 - 資料存取與 LocalStorage 管理層 (Storage Service)
 * 職責：
 * 1. 統一管理 customers, vendors, products, quotes 之 LocalStorage 讀寫
 * 2. 維護自動流水號計數器 (C001, V001, P001, Q001)，確保刪除項目後號碼絕不重複
 * 3. 初次載入時自動寫入示範初始資料，讓使用者立即可操作與驗證
 */

const STORAGE_KEYS = {
  CUSTOMERS: 'quote_sys_customers',
  VENDORS: 'quote_sys_vendors',
  PRODUCTS: 'quote_sys_products',
  QUOTES: 'quote_sys_quotes',
  COUNTERS: 'quote_sys_id_counters'
};

// 初始示範資料：展示廠商 -> 產品 -> 客戶 -> 報價單 完整的 ID 關聯
const INITIAL_VENDORS = [
  {
    vendorId: 'V001',
    companyName: '宏碁聯網技術股份有限公司',
    contactPerson: '林智豪',
    englishName: 'Acer Tech Co.',
    department: '企業解決方案部',
    jobTitle: '客戶經理',
    phone: '02-2788-1234',
    email: 'ch.lin@acertech.com.tw',
    taxId: '23456781',
    address: '台北市南港區園區街 3 號 8 樓',
    paymentTerms: '月結 30 天 (電匯)',
    notes: '核心伺服器與商務筆電主要供應商'
  },
  {
    vendorId: 'V002',
    companyName: '華碩智慧商務科技有限公司',
    contactPerson: '陳美玲',
    englishName: 'Asus Smart Tech Ltd.',
    department: '通路業務部',
    jobTitle: '資深業務專員',
    phone: '02-2894-3447',
    email: 'meiling_chen@asuscorp.com',
    taxId: '89765432',
    address: '台北市北投區立德路 15 號',
    paymentTerms: '月結 45 天',
    notes: '顯示器與周邊設備指定合作商'
  }
];

const INITIAL_CUSTOMERS = [
  {
    customerId: 'C001',
    companyName: '數位時代創新數位行銷股份有限公司',
    contactPerson: '王建平',
    englishName: 'Digital Epoch Marketing',
    department: '資訊技術處',
    jobTitle: '技術總監 (CTO)',
    phone: '02-2500-8899',
    email: 'jp.wang@digitalepoch.tw',
    taxId: '54321098',
    address: '台北市中山區民生東路三段 100 號 12 樓',
    paymentTerms: '簽約預付 30%，完工 70%',
    notes: '長期合作客戶，預計年底升級全公司工作站'
  },
  {
    customerId: 'C002',
    companyName: '極致工藝設計顧問整合有限公司',
    contactPerson: '張嘉欣',
    englishName: 'Apex Craft Design',
    department: '行政採購組',
    jobTitle: '採購經理',
    phone: '04-2300-6677',
    email: 'cindy.chang@apexdesign.com.tw',
    taxId: '76543219',
    address: '台中市西區台灣大道二段 218 號 15 樓',
    paymentTerms: '次月 25 日結匯',
    notes: '需要高色準專業繪圖顯示器'
  }
];

const INITIAL_PRODUCTS = [
  {
    productId: 'P001',
    productName: '27 吋 4K HDR 專業色彩顯示器',
    cost: 11500,
    price: 15800,
    unit: '台',
    imageUrl: '',
    brand: 'ASUS ProArt',
    spec: '27吋 / IPS / 4K UHD 3840x2160 / 99% DCI-P3 / Type-C 96W',
    description: '專為影像後製與平面設計調校，原廠出廠逐台色彩校正認證',
    stockQty: 25,
    vendorId: 'V002',
    notes: '附原廠升降旋轉支架'
  },
  {
    productId: 'P002',
    productName: '15.6 吋商務效能筆記型電腦 (Core Ultra 7)',
    cost: 27000,
    price: 34900,
    unit: '台',
    imageUrl: '',
    brand: 'Acer TravelMate',
    spec: 'Intel Core Ultra 7 / 32GB DDR5 / 1TB PCIe 4.0 SSD / Win 11 Pro',
    description: '輕量軍規認證商務機，具備 AI 加速運算晶片與長效 14 小時續航',
    stockQty: 18,
    vendorId: 'V001',
    notes: '含三年到府收送原廠保固'
  },
  {
    productId: 'P003',
    productName: '企業級 Wi-Fi 7 雙頻三模商用路由器',
    cost: 4800,
    price: 6800,
    unit: '台',
    imageUrl: '',
    brand: 'ASUS ExpertWiFi',
    spec: 'Wi-Fi 7 BE9300 / 2.5G WAN + 4 LAN / 支援 VLAN 虛擬隔離網段',
    description: '專為百人辦公室設計的高承載商用路由器，支援自我排程診斷與訪客網路隔離',
    stockQty: 40,
    vendorId: 'V002',
    notes: '支援 PoE 供電與壁掛安裝'
  }
];

const INITIAL_QUOTES = [
  {
    quoteId: 'Q001',
    customerId: 'C001',
    quoteStaff: '陳永祥',
    contactPhone: '02-2500-8899',
    contactAddress: '台北市中山區民生東路三段 100 號 12 樓',
    quoteDate: '2026-09-10',
    validityDate: '2026-10-10',
    notes: '全系列產品享有原廠三年保固，報價含到府基本網路佈建安裝服務',
    items: [
      {
        productId: 'P002',
        productName: '15.6 吋商務效能筆記型電腦 (Core Ultra 7)',
        unitPrice: 34900,
        description: '輕量軍規認證商務機，具備 AI 加速運算晶片與長效 14 小時續航',
        quantity: 5,
        subtotal: 174500
      },
      {
        productId: 'P003',
        productName: '企業級 Wi-Fi 7 雙頻三模商用路由器',
        unitPrice: 6800,
        description: '專為百人辦公室設計的高承載商用路由器，支援自我排程診斷與訪客網路隔離',
        quantity: 2,
        subtotal: 13600
      }
    ],
    totalAmount: 188100
  }
];

export const StorageService = {
  /**
   * 初始化 LocalStorage 初始狀態
   */
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
      this.save(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.VENDORS)) {
      this.save(STORAGE_KEYS.VENDORS, INITIAL_VENDORS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      this.save(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUOTES)) {
      this.save(STORAGE_KEYS.QUOTES, INITIAL_QUOTES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.COUNTERS)) {
      // 記錄各模組已使用的最大流水號數字
      this.save(STORAGE_KEYS.COUNTERS, {
        customer: 2,
        vendor: 2,
        product: 3,
        quote: 1
      });
    }
  },

  /**
   * 讀取指定 Key 的陣列資料
   * @param {string} key 
   * @returns {Array}
   */
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`讀取 LocalStorage [${key}] 失敗:`, e);
      return [];
    }
  },

  /**
   * 寫入指定 Key 的資料
   * @param {string} key 
   * @param {*} value 
   */
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`寫入 LocalStorage [${key}] 失敗:`, e);
    }
  },

  /**
   * 取得各模組清單捷徑
   */
  getCustomers() { return this.get(STORAGE_KEYS.CUSTOMERS); },
  getVendors() { return this.get(STORAGE_KEYS.VENDORS); },
  getProducts() { return this.get(STORAGE_KEYS.PRODUCTS); },
  getQuotes() { return this.get(STORAGE_KEYS.QUOTES); },

  /**
   * 儲存各模組清單捷徑
   */
  saveCustomers(data) { this.save(STORAGE_KEYS.CUSTOMERS, data); },
  saveVendors(data) { this.save(STORAGE_KEYS.VENDORS, data); },
  saveProducts(data) { this.save(STORAGE_KEYS.PRODUCTS, data); },
  saveQuotes(data) { this.save(STORAGE_KEYS.QUOTES, data); },

  /**
   * 依照規則十一產生唯一不重複代碼
   * 例如：C001, C002, 刪除 C002 後新增依然是 C003 或更高，絕不因為刪除而重複使用舊編號！
   * @param {'customer'|'vendor'|'product'|'quote'} type 
   * @returns {string} 新代碼
   */
  generateNextId(type) {
    const prefixes = {
      customer: 'C',
      vendor: 'V',
      product: 'P',
      quote: 'Q'
    };
    const prefix = prefixes[type] || 'ID';
    const counters = this.get(STORAGE_KEYS.COUNTERS) || {
      customer: 0,
      vendor: 0,
      product: 0,
      quote: 0
    };

    const currentCount = Number(counters[type] || 0);
    const nextCount = currentCount + 1;
    counters[type] = nextCount;
    this.save(STORAGE_KEYS.COUNTERS, counters);

    // 格式化為三位數補零 (例如 1 -> 001, 12 -> 012)
    const padded = String(nextCount).padStart(3, '0');
    return `${prefix}${padded}`;
  },

  /**
   * 依 ID 尋找單筆資料
   */
  findCustomerById(id) {
    return this.getCustomers().find(c => c.customerId === id);
  },
  findVendorById(id) {
    return this.getVendors().find(v => v.vendorId === id);
  },
  findProductById(id) {
    return this.getProducts().find(p => p.productId === id);
  },
  findQuoteById(id) {
    return this.getQuotes().find(q => q.quoteId === id);
  }
};
