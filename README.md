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

## 單機資料儲存說明 (Offline Storage)

- 本系統的核心資料層（客戶名單、廠商清單、產品庫存與報價單紀錄）使用瀏覽器原生的 **LocalStorage** 進行持久化儲存。
- 首次在單機開啟時，系統會自動載入初始範例資料（示範客戶、廠商、產品及報價單）。
- 您在單機操作時所新增、修改或刪除的所有資料，都會完整保存在您本機瀏覽器中，關閉或重新整理網頁後資料皆會保留。

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
