/**
 * 報價單管理系統 - Firebase 雲端資料庫與驗證服務
 * 整合：
 * 1. Firebase App 初始化 (以 firebase-applet-config.json 為基礎)
 * 2. Firebase 匿名驗證 (確保安全存取 Firestore)
 * 3. Firestore 資料庫連線測試 (符合驗證準則)
 * 4. 雲端資料即時監聽與雙向同步 (客戶、廠商、產品、報價單)
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// 初始化 Firebase 應用程式
export const app = initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
  measurementId: firebaseConfig.measurementId
});

// 初始化 Firebase Auth
export const auth = getAuth(app);

// 初始化 Firestore 資料庫 (指定特定 Database ID)
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// 雲端連線狀態監聽器回呼清單
const statusListeners = new Set();
let isCloudConnected = false;
let isSyncing = false;

export const CloudService = {
  /**
   * 取得目前連線狀態
   */
  isConnected() {
    return isCloudConnected;
  },

  /**
   * 註冊狀態改變監聽器
   */
  onStatusChange(callback) {
    statusListeners.add(callback);
    callback(isCloudConnected);
    return () => statusListeners.delete(callback);
  },

  /**
   * 更新狀態並通知所有訂閱者
   */
  notifyStatus(connected) {
    isCloudConnected = connected;
    statusListeners.forEach(cb => {
      try { cb(connected); } catch (e) { console.error(e); }
    });
  },

  /**
   * 測試 Firestore 連線 (符合技能約束要求)
   */
  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      this.notifyStatus(true);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firebase 客戶端處於離線狀態，請檢查網路連線或配置。');
      } else {
        console.info('Firestore 連線測試回應：', error.message || error);
      }
      return false;
    }
  },

  /**
   * 啟動身分驗證與雲端同步服務
   */
  async init(onDataSynced) {
    try {
      // 確保使用者登入以通過 Firestore Security Rules 驗證
      await new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
          if (!user) {
            try {
              const cred = await signInAnonymously(auth);
              resolve(cred.user);
            } catch (err) {
              console.warn('Firebase 匿名登入失敗，將退回 LocalStorage 模式:', err);
              resolve(null);
            }
          } else {
            resolve(user);
          }
        });
      });

      // 執行連線測試
      await this.testConnection();
      this.notifyStatus(true);

      // 初次全量雙向同步
      await this.syncAll(onDataSynced);

      // 設定 Firestore 集合即時監聽
      this.setupRealtimeListeners(onDataSynced);
    } catch (err) {
      console.warn('初始化雲端資料庫異常，繼續使用本地儲存：', err);
      this.notifyStatus(false);
    }
  },

  /**
   * 同步所有資料表 (Customers, Vendors, Products, Quotes)
   */
  async syncAll(onDataSynced) {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const { StorageService } = await import('./storage.js');

      // 1. 同步客戶
      const cloudCustomers = await this.fetchCollection('customers');
      if (cloudCustomers.length > 0) {
        StorageService.saveCustomers(cloudCustomers);
      } else {
        // 雲端為空，將本地資料推上雲端
        const localCustomers = StorageService.getCustomers();
        for (const item of localCustomers) {
          await this.saveDocument('customers', item.customerId, item);
        }
      }

      // 2. 同步廠商
      const cloudVendors = await this.fetchCollection('vendors');
      if (cloudVendors.length > 0) {
        StorageService.saveVendors(cloudVendors);
      } else {
        const localVendors = StorageService.getVendors();
        for (const item of localVendors) {
          await this.saveDocument('vendors', item.vendorId, item);
        }
      }

      // 3. 同步產品
      const cloudProducts = await this.fetchCollection('products');
      if (cloudProducts.length > 0) {
        StorageService.saveProducts(cloudProducts);
      } else {
        const localProducts = StorageService.getProducts();
        for (const item of localProducts) {
          await this.saveDocument('products', item.productId, item);
        }
      }

      // 4. 同步報價單
      const cloudQuotes = await this.fetchCollection('quotes');
      if (cloudQuotes.length > 0) {
        StorageService.saveQuotes(cloudQuotes);
      } else {
        const localQuotes = StorageService.getQuotes();
        for (const item of localQuotes) {
          await this.saveDocument('quotes', item.quoteId, item);
        }
      }

      if (typeof onDataSynced === 'function') {
        onDataSynced();
      }
    } catch (err) {
      console.error('全量同步至雲端失敗:', err);
    } finally {
      isSyncing = false;
    }
  },

  /**
   * 取得指定 Firestore 集合內的所有資料
   */
  async fetchCollection(collectionName) {
    try {
      const snap = await getDocs(collection(db, collectionName));
      return snap.docs.map(d => d.data());
    } catch (err) {
      console.warn(`讀取集合 [${collectionName}] 失敗:`, err);
      return [];
    }
  },

  /**
   * 寫入或更新單一文件
   */
  async saveDocument(collectionName, docId, data) {
    if (!docId) return;
    try {
      const cleanData = { ...data, updatedAt: new Date().toISOString() };
      await setDoc(doc(db, collectionName, String(docId)), cleanData);
      this.notifyStatus(true);
    } catch (err) {
      console.warn(`寫入雲端文件 [${collectionName}/${docId}] 失敗:`, err);
    }
  },

  /**
   * 刪除單一文件
   */
  async deleteDocument(collectionName, docId) {
    if (!docId) return;
    try {
      await deleteDoc(doc(db, collectionName, String(docId)));
      this.notifyStatus(true);
    } catch (err) {
      console.warn(`刪除雲端文件 [${collectionName}/${docId}] 失敗:`, err);
    }
  },

  /**
   * 設定 Firestore 即時變更監聽 (多分頁與多裝置即時同步)
   */
  setupRealtimeListeners(onDataSynced) {
    const collections = ['customers', 'vendors', 'products', 'quotes'];
    const saveMethods = {
      customers: 'saveCustomers',
      vendors: 'saveVendors',
      products: 'saveProducts',
      quotes: 'saveQuotes'
    };

    collections.forEach(colName => {
      onSnapshot(collection(db, colName), async (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) {
          // 本機寫入尚未確認，暫時略過避免覆蓋輸入中狀態
          return;
        }
        const { StorageService } = await import('./storage.js');
        const items = snapshot.docs.map(d => d.data());
        if (items.length > 0) {
          const method = saveMethods[colName];
          if (StorageService[method]) {
            StorageService[method](items);
            if (typeof onDataSynced === 'function') {
              onDataSynced(colName);
            }
          }
        }
      }, (err) => {
        console.warn(`監聽 [${colName}] 集合異動失敗:`, err);
      });
    });
  }
};
