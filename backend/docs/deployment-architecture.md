# 部署架構定案：Railway + Neon（+ Cloudflare 輔助）

_2026-07-07 版。承接 hosting-comparison.md 的結論與 plan.md 的里程碑；本文件是「照著做」的施工圖，含未來搬遷手冊。_

## 0. 一句話總結

**後端 Node 服務放 Railway（用既有的 $5/月額度），Postgres 放 Neon 免費層（$0），
網域掛在 Cloudflare 的自訂網域上（$0），大檔之後走 R2（$0 起）。**
每一塊都是標準元件（Node + 標準 PG + S3 相容 API），任何一塊都能單獨搬走。

## 1. 架構總覽

```
                       ┌─ Cloudflare DNS（免費）──────────────────┐
玩家（網頁/APK） ────►  api.你的網域.com  ── CNAME ──► Railway    │
                       └──────────────────────────────────────────┘
                                                        │
                                            ┌───────────▼───────────┐
                                            │ Railway：Node(Hono)   │  ~$1-3/月
                                            │  /api/auth /sync ...  │  （吃 $5 額度）
                                            │  ./public 靜態網頁版  │
                                            │  node-cron（M6 推播） │
                                            └───────────┬───────────┘
                                                        │ DATABASE_URL（pooled）
                                            ┌───────────▼───────────┐
                                            │ Neon：Postgres 免費層 │  $0
                                            │  0.5GB / 閒置自動休眠 │
                                            └───────────────────────┘

（M5 之後）大檔實體 ─► Cloudflare R2（10GB 免費、零出站費），DB 只存指標
（M6）推播 ─► FCM（免費）
```

### 元件與月費

| 元件 | 平台 | 費用 | 為什麼 |
|---|---|---|---|
| 後端 API + 網頁版靜態檔 | Railway（單一服務） | ~$1-3/月，吃既有 $5 額度 | 無休眠、node-cron 可跑、AI 串流無時限 |
| Postgres | Neon Free | $0 | Railway 上開 PG 會吃掉大半 $5 額度；Neon 是真 PG、零改碼 |
| 網域/DNS | Cloudflare（免費方案） | $0（網域本身年費另計） | **搬遷保險的核心**，見 §3 |
| 大檔物件儲存 | Cloudflare R2 | 10GB 免費，之後 $0.015/GB | 零出站流量費；S3 相容 API 不綁死 |
| 推播 | FCM | $0 | Android 標準 |

**不採用**：Railway 內建 Postgres（貴）、Cloudflare D1（要改寫成 SQLite + Workers，工作形狀相反）、
Supabase Free（7 天沒流量整庫暫停，比 Neon 麻煩）。

## 2. 分層原則（決定「以後好不好搬」的規則）

1. **後端只依賴環境變數**：`DATABASE_URL`、`JWT_SECRET`、（之後）`OPENROUTER_KEY`、`R2_*`。
   程式碼裡永遠不出現平台專屬 SDK（Railway/Neon 都只是「一條 PG 連線字串」）。
2. **資料庫只用標準 SQL + Drizzle migrations**：任何 Postgres（Neon/Railway/RDS/自架）`pg_dump` 整包搬走。
3. **前端只認 `mali_server_url` / `OFFICIAL_SERVER_URL`**：而且這個網址必須是**自訂網域**，
   不是 `xxx.up.railway.app`——這樣換平台只改 DNS，**已發行的 APK 永遠不用重發**。
4. **物件儲存只用 S3 相容 API**（aws-sdk v3 / aws4fetch）：R2、S3、B2、MinIO 互相可換。

## 3. 施工步驟（照順序做）

### 3.1 Neon（約 10 分鐘）

1. 註冊 neon.tech → New Project：
   - 名稱 `maliphone`，Postgres 17，**Region 選 AWS Singapore (ap-southeast-1)**（台灣玩家延遲最低）。
2. 拿連線字串：Dashboard → Connect → 勾 **Pooled connection**（host 帶 `-pooler` 的那條）。
   - 現有 `pg.Pool({ max: 10 })` 直接相容，程式碼零改動。
3. （建議）Neon 免費層有 branch 功能：開一個 `dev` branch 當雲端測試庫，
   main branch 只給正式環境用。本地開發維持 PGlite，不用碰 Neon。

### 3.2 Railway（約 20 分鐘）

1. New Project → Deploy from GitHub repo，**Region 選 Southeast Asia (Singapore)**，跟 Neon 同區。
2. Service 設定：
   - Root Directory：`backend/`
   - Build：`npm ci`（前端要同域部署時見下方 §3.4）
   - Start：`node src/index.js`
3. Variables（對照 `.env.example`）：
   - `DATABASE_URL` = Neon pooled 連線字串
   - `JWT_SECRET` = 隨機長字串（`openssl rand -base64 48`），**設了就永遠不要換**（換了全部裝置登出）
   - `NODE_ENV` = `production`
4. 部署後打 `https://<railway 網址>/api/health`，確認 `db.ok: true`。
   - migrations 由 `src/index.js` 啟動時自動套用，不用手動跑。

### 3.3 Cloudflare 自訂網域（約 15 分鐘，**不要跳過**）

這一步是整份文件最重要的搬遷保險：

1. 買一個網域（Cloudflare Registrar 成本價，或任何註冊商），DNS 託管到 Cloudflare 免費方案。
2. Railway service → Settings → Custom Domain 加 `api.你的網域.com`，
   到 Cloudflare 加對應 CNAME（首次設定時 Proxy 先關（灰雲）驗證，成功後可開橘雲）。
3. 前端 `services/syncService.js` 的 `OFFICIAL_SERVER_URL` 填 `https://api.你的網域.com`。
4. **從此以後**：搬 Render、搬 VPS、換任何平台 = 改一條 CNAME，5 分鐘生效，玩家無感。

### 3.4 網頁版前端部署（二選一）

- **A. 同域部署（現況設計，先用這個）**：CI/部署腳本裡 `npm run build`（repo 根目錄）→
  把 `dist/` 複製到 `backend/public/` → Railway 啟動時自動 serve + SPA fallback（`src/index.js` 已支援）。
  好處：一個服務、同源不用想 CORS。
- **B. Cloudflare Pages（流量大了再切）**：前端靜態檔搬到 Pages（免費、全球 CDN），
  Railway 只剩純 API。後端 CORS 已全開、認證走 Bearer，切過去不用改後端。
  何時切：Railway 出站流量或 CPU 開始被靜態檔吃掉、或想要前端全球加速時。

### 3.5 備份（第一週內做，約 30 分鐘）

Neon 免費層有短期 PITR（時間窗以官方為準，數小時～一天），**不夠當災難備份**。加一層異地備份：

1. 開 R2 bucket `maliphone-backup`（或先用 GitHub 私有 repo 的 Actions artifacts）。
2. GitHub Actions 每日 cron：`pg_dump "$NEON_URL" -Fc -f backup.dump` → 上傳 R2。
   免費額度內（Actions 分鐘數 + R2 10GB）完全 $0。
3. **每季演練一次還原**：`pg_restore` 到 Neon dev branch，確認資料完整。沒演練過的備份等於沒有備份。

## 4. 容量水位與升級門檻

| 水位 | 症狀/指標 | 動作 | 新增成本 |
|---|---|---|---|
| Neon 儲存 > 0.4GB（80%） | Neon 控制台 Storage 圖表 | 先清墓碑實體 + 壓縮 JSONB；不行就升 Neon Launch（10GB） | +$5/月 |
| Neon compute 時數吃緊 | 月中就用掉大半 CU-hours | 通常是保溫/輪詢太頻繁，先查；真不夠再升級 | +$5/月 |
| 單一實體 > 800KB 被拒 | sync push 回 `too_large` | 啟動 R2 大檔方案（§5） | ~$0 |
| Railway 額度月中爆掉 | Usage 頁面 | 檢查是否有殭屍服務；確認只跑一個小容器 | — |
| DB 延遲影響體驗 | /api/health 的 db 檢查變慢 | 確認 Railway 與 Neon 同區；查 N+1（sync push 的逐筆查詢是已知熱點） | — |
| 月費穩定 > $50 | — | 重新評估自架 VPS 或混合架構（hosting-comparison.md 結論） | — |

## 5. 大檔方案（R2，對應 plan.md §5）

觸發條件：玩家開始被 800KB 上限擋到（聊天背景圖等）。

設計（實作時再細化）：

1. R2 bucket `maliphone-media`，後端用 S3 相容 SDK + 環境變數 `R2_ENDPOINT/R2_KEY/R2_SECRET`。
2. `POST /media/upload-url`：驗 JWT → 檢查大小/類型/配額 → 回傳 presigned PUT URL（App 直傳 R2，不過 Railway，省流量）。
3. 實體 data 改存指標：`{ "$blob": "media/<userId>/<hash>", size, mime }`；同步協定不變。
4. 讀取走 presigned GET 或公開 bucket + 不可猜測路徑。
5. 帳號刪除時（plan.md §11）連同 R2 物件一起刪。

搬遷性：S3 相容 API，R2 → S3/B2/MinIO 只改 endpoint + 搬檔（`rclone` 一行）。

## 6. 搬遷手冊（真的要搬時照這裡做）

### 6.1 資料庫搬家（Neon → 任何 Postgres：Railway PG、RDS、自架）

停機窗口約 10–30 分鐘（資料量小的時候做最輕鬆）：

1. 前置：目標庫建好、拿到新 `DATABASE_URL`；先彩排一次（dump → restore 到目標，不切流量）。
2. 維護模式：Railway 上把服務暫停（App 端本來就離線容錯：outbox 會累積，恢復後自動推）。
3. `pg_dump "$舊URL" -Fc -f mali.dump` → `pg_restore -d "$新URL" --no-owner mali.dump`。
4. **驗證序列**：`SELECT last_value FROM entities_server_seq_seq;` 兩邊一致
   （sync 游標依賴它，跑掉會讓裝置重拉或漏拉）。核對 `users`/`entities` 筆數。
5. Railway Variables 換 `DATABASE_URL` → 重啟 → 打 `/api/health` → 用兩台測試裝置各做一次同步驗證。
6. 舊 Neon 保留唯讀一週再刪。

### 6.2 後端搬家（Railway → Render/Fly/VPS）

因為有 §3.3 的自訂網域，這是最輕鬆的一種：

1. 新平台部署同一個 repo（`backend/` + 環境變數照抄；DB 不動，還是 Neon）。
2. 新平台網址先冒煙測試 `/api/health` + 註冊/同步流程。
3. Cloudflare 把 `api.你的網域.com` 的 CNAME 指向新平台。TTL 內全量切換，APK 不用動。
4. 舊 Railway 服務留著跑幾天再關（DNS 殘留流量的保險）。

### 6.3 前端搬家（Railway 同域 → Cloudflare Pages）

1. Pages 綁 repo，build 指令 `npm run build`、輸出 `dist/`。
2. 網頁版網域指向 Pages；`OFFICIAL_SERVER_URL` 不變（還是 api 子網域）。
3. 後端刪掉 `public/` 部署步驟即可，其餘不動。

### 6.4 物件儲存搬家（R2 → 任何 S3 相容）

`rclone sync r2:maliphone-media s3:new-bucket` → 換三個環境變數 → 完成。
DB 裡存的是相對指標（`media/...`），不含網域，不用改資料。

## 7. 環境變數總表（單一事實來源，新增時同步更新 `.env.example`）

| 變數 | 用途 | 哪裡設 |
|---|---|---|
| `DATABASE_URL` | Neon pooled 連線字串 | Railway Variables |
| `JWT_SECRET` | access token 簽章，設定後不可更換 | Railway Variables |
| `NODE_ENV` | `production` | Railway Variables |
| `PORT` | Railway 自動注入 | 自動 |
| （M4）`OPENROUTER_KEY` | 站方 AI 代理 | Railway Variables |
| （M5）`R2_ENDPOINT` / `R2_KEY` / `R2_SECRET` | 大檔儲存 | Railway Variables |
| （M6）`FCM_SERVICE_ACCOUNT` | 推播 | Railway Variables |

## 8. 上線前檢查清單

- [ ] Neon 專案建立（Singapore、pooled string）
- [ ] Railway 部署成功、`/api/health` 的 `db.ok: true`
- [ ] 自訂網域生效、`OFFICIAL_SERVER_URL` 填自訂網域（不是 railway.app 網址）
- [ ] 兩台裝置註冊/登入/同步全流程通過（對應 plan.md M2/M3 驗收）
- [ ] 每日 pg_dump 備份 job 上線，且做過一次還原演練
- [ ] plan.md §11 安全清單過一遍（特別是：後端安全項目——status 檢查、匿名帳號 deviceId 取回、
      登入節流按 email 鎖定——**上正式登入系統前必須修**，見 code review 紀錄 2026-07-07）
