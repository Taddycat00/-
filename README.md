# 報價單管理系統 - 本地端 Vite 開發與單機測試指引

本專案已完全設定好 **Vite 6** 本地端開發與建置環境。所有第三方前端依賴（包括 Bootstrap 5 與 Bootstrap Icons）均已納入 npm 依賴並由 Vite 進行本地打包，**支援 100% 離線單機測試與運行**，無需連外存取 CDN。

---

## 快速開始 (Quick Start)

### 1. 系統環境需求
- **Node.js**：版本 `>= 18.0.0` (建議 LTS 版本)
- **npm**：版本 `>= 9.0.0` (或使用 pnpm / yarn / bun)

---

### 2. 安裝依賴 (Install Dependencies)
在專案根目錄下開啟終端機 (Terminal / PowerShell)，執行：

```bash
npm install
```

---

### 3. 本地端單機測試運行 (Local Development)

#### 推薦方式 A：自動開啟瀏覽器並啟動本地伺服器
```bash
npm run dev:local
```
- 伺服器會自動啟動在 `http://localhost:5173`（若埠號被佔用會自動遞增）並自動在預設瀏覽器中開啟。
- 支援 Vite 原生 HMR 熱更新，修改程式碼即可即時預覽。

#### 方式 B：指定固定埠號 (同線上環境)
```bash
npm run dev
```
- 會在 `http://localhost:3000` 啟動服務。

---

### 4. 正式版本打包與本地預覽 (Build & Preview)

若要測試生產環境的打包結果：

```bash
# 1. 執行打包 (產出靜態檔案至 dist 目錄)
npm run build

# 2. 本地預覽打包結果
npm run preview:local
```

打包完成後的檔案位於 `dist/` 資料夾中，為純靜態網頁檔案，可直接部署至任何靜態託管平台（如 GitHub Pages、Cloudflare Pages、Nginx 或直接單機靜態伺服器）。

---

## PostgreSQL 雲端資料庫與本地儲存雙軌機制 (PostgreSQL & Offline Support)

本系統後端採用 **Node.js Express + pg 連線池** 架構，支援原生 **PostgreSQL** 關聯式資料庫（完全相容 **Neon Serverless Postgres、Supabase、Google Cloud SQL、AWS RDS** 等）。

### 1. 連線設定方式 (環境變數)
在專案根目錄 `.env`（或平台環境變數設定）中加入 `DATABASE_URL`：

```bash
# Neon 或標準 PostgreSQL 連線字串 (需包含 sslmode=require)
DATABASE_URL="postgresql://username:password@ep-example.neon.tech/neondb?sslmode=require"
```

或使用獨立變數設定：
```bash
PGHOST="ep-example.neon.tech"
PGPORT=5432
PGDATABASE="neondb"
PGUSER="username"
PGPASSWORD="password"
PGSSL=true
```

### 2. 資料庫自動初始化綱要 (Auto Schema Migration)
當設定連線並啟動時，系統後端會自動在 PostgreSQL 中建立以下 4 張資料表：
- `customers`：客戶管理資料表 (客戶代碼、公司名稱、統編、聯絡人、電話、信箱、地址)
- `vendors`：廠商管理資料表 (廠商代碼、公司名稱、統編、聯絡人、電話、信箱、地址)
- `products`：產品管理資料表 (產品代碼、產品名稱、規格說明、單位、**成本價**、**銷售單價**、庫存量)
- `quotes`：報價單資料表 (報價單號、報價日期、客戶資訊、品項 JSONB 清單、小計、稅額、含稅總額、備註、狀態)

### 3. 本機離線模式 (LocalStorage Fallback)
- **若尚未配置 `DATABASE_URL`**：系統頂部燈號顯示「**本地離線模式**」，所有新增、編輯、刪除操作均透過本機 LocalStorage 儲存，離線依然 100% 順暢可用。
- **連線至 PostgreSQL 後**：系統頂部燈號自動轉為「**PostgreSQL 已連線** (綠燈)」，所有資料操作均即時寫入雲端資料庫，點擊頂部「**同步**」按鈕可隨時進行全量雙向資料校驗與同步。

---

## 常用 NPM 指令清單

| 指令 | 說明 |
| :--- | :--- |
| `npm install` | 安裝所有必要套件（含 Vite、Bootstrap、Icons 等） |
| `npm run dev:local` | 本地啟動開發伺服器並自動開啟瀏覽器 (`localhost:5173`) |
| `npm run dev` | 啟動開發伺服器於 Port 3000 (`localhost:3000`) |
| `npm run build` | 執行 TypeScript 檢查與 Vite 生產打包，產出至 `dist/` |
| `npm run preview:local` | 啟動本地 Production 預覽伺服器並開啟瀏覽器 |
| `npm run lint` | 執行 TypeScript 型別檢查驗證 |
