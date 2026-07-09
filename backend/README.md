# MaliPhone Backend

Node.js + Hono + Postgres（Drizzle ORM），部署目標 Railway。
完整規劃見 `docs/plan.md`，里程碑 M1–M7。

## 本地開發

```bash
cd backend
npm install
cp .env.example .env   # 填 DATABASE_URL（沒有 DB 也能啟動，/api/health 會顯示未設定）
npm run dev            # http://localhost:8787/api/health
```

## 資料庫

```bash
npm run db:generate    # schema 變動後產生 migration（drizzle/ 目錄）
npm run db:migrate     # 套用到 DATABASE_URL 指向的資料庫
```

migration 檔（`drizzle/`）要進 Git。

## Railway 部署

1. Railway 新增服務指向此 repo，**Root Directory 設 `backend/`**
2. 加一個 **Postgres 附加服務**，並在後端服務把 `DATABASE_URL` 連到它（Variables → Add Reference）
3. 後端服務 Variables 手動加 **`JWT_SECRET`**（隨機長字串，可用 `openssl rand -base64 48` 產生）
4. Settings → Build Command：
   ```bash
   cd .. && npm ci && npm run build && rm -rf backend/public && cp -r dist backend/public && cd backend && npm ci
   ```
   Start Command：`npm start`（migrations 會在啟動時自動套用）
5. Settings → Health Check Path 填 `/api/health`
6. 部署完成後開 `https://<你的網域>/api/health`，看到 `"db":{"ok":true,"mode":"postgres"}` 即成功
7. 網頁版與 API 同網域：`/` 是前端、`/api/*` 是後端

## 部署後回到前端要做的事

1. 把 Railway 網址填進 `services/syncService.js` 的 `OFFICIAL_SERVER_URL`（設定頁的伺服器網址欄位會自動隱藏）
2. 重新 build：網頁版 `npm run build`、APK `npm run build && npx cap sync` 後重新打包

## 部署檢查清單

- [ ] `DATABASE_URL` 已連到 Postgres 附加服務
- [ ] `JWT_SECRET` 已設定（沒設的話生產環境會直接拒絕啟動）
- [ ] `/api/health` 回 `db.ok: true, mode: "postgres"`（`pglite-dev` 表示 DATABASE_URL 沒接到）
- [ ] 網頁版打得開、能註冊登入
- [ ] APK 填/烘入正式網址後能登入（CORS 已在後端開好）
- [ ] Railway Postgres 備份已啟用（專案 Settings 確認）

## 目錄

- `src/index.js`：伺服器入口（health check + 靜態檔）
- `src/db/schema.js`：全部資料表（users / sessions / devices / entities / point_ledger / purchases / ai_usage）
- `src/routes/`：M2 起的 API 路由
- `drizzle/`：migration 檔
- `docs/`：計劃書與設計文件

任何 API Key、金流密鑰或 `.env` 都不得提交到 Git。
