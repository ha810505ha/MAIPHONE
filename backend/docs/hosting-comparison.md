# 部署平台比較：Railway vs Cloudflare vs Firebase vs 自架 VPS

_2026-07 記錄。價格會變動，重大決策前請再確認官方定價。_
_目前決策（2026-07-07 更新）：**初期用 Render Free + Neon Free（$0/月），成長後升級 Render Starter 或 Railway**，見文末〈免費層路徑〉。FCM 推播（免費）與 R2 圖片儲存的結論不變。_

## 我們的需求清單（評分基準）

1. 點數帳本：只插入的 ledger、SUM 餘額、交易 + row lock（金流，不能出錯）
2. AI 代理：轉發 OpenRouter，串流長回應，一次呼叫可能數十秒
3. 排程：cron 定時為多個玩家生成主動訊息（長時間批次）
4. 同步 API：低頻寫入（outbox debounce 後），JSONB 文件
5. 推播：FCM 到 Android
6. 網頁版與 API 同網域部署；APK 打絕對網址
7. 開發者是單人，維運時間有限

## 總表

| 面向 | Railway | Cloudflare (Workers+D1+R2) | Firebase | 自架 VPS (Hetzner/Linode 等) |
|---|---|---|---|---|
| 資料庫 | ✅ 真 Postgres，交易/lock 完整 | ⚠️ D1=SQLite，交易能力弱 | ❌ Firestore NoSQL，帳本模式不自然 | ✅ 自裝 Postgres，完全掌控 |
| 帳本/金流適配 | ✅ 主場 | ⚠️ 勉強 | ⚠️ 有交易但模式彆扭 | ✅ 同 Railway |
| AI 串流代理 | ✅ 無限制 | ⚠️ 可以但有 CPU 時間限制 | ⚠️ Functions 冷啟動、不擅長長串流 | ✅ 無限制 |
| Cron 長批次 | ✅ node-cron 無時限 | ❌ Cron Triggers 有執行時限 | ⚠️ Scheduled Functions（Blaze） | ✅ 系統 crontab |
| 本地開發體驗 | ✅ 就是 Node，本地=線上 | ⚠️ 要 wrangler 模擬 | ⚠️ 要 emulator suite | ✅ 就是 Node |
| 部署/維運負擔 | ✅ git push 即部署，零維運 | ✅ 零維運 | ✅ 零維運 | ❌ 全自己來：更新、防火牆、SSL、備份、被打了自己救 |
| DB 備份 | ✅ 內建 | ⚠️ D1 有快照 | ✅ 自動 | ❌ 自己排 pg_dump + 異地存放 |
| 延遲（台灣玩家） | ⚠️ 單區域（美西/新加坡 ~50-150ms） | ✅ 全球邊緣 | ✅ 可選亞洲區 | ✅ 可選東京/新加坡機房 |
| 免費層 | ❌ 最低 $5/月 | ✅ Workers 免費層 + R2 10GB 免費 | ✅ Spark 免費（但 Functions 要 Blaze） | ❌ 最低約 $4-6/月 |
| 起步月費（估） | $5-15 | $0-5 | $0-25（讀寫計費難預估） | $5-10 + 你的時間 |
| 規模化成本 | ⚠️ 中（比 VPS 貴） | ✅ 最便宜 | ❌ 讀寫次數計費，聊天 App 會失控 | ✅ 最便宜（不算人力） |
| 綁定程度 | ✅ 低（標準 Node+PG，隨時搬） | ⚠️ 中（Workers API 專有，但我們用 Hono 有抽象） | ❌ 高（Firestore/SDK 全專有） | ✅ 無 |
| 儲存上限 | Hobby 5GB / Pro 可擴到 1TB，$0.15-0.25/GB/月 | R2 10GB 免費後 $0.015/GB | 按用量 | 隨方案，通常數十 GB 起 |

## 各平台一句話定位

- **Railway**：「有狀態、長運算、傳統後端」的主場——正是我們的形狀。弱點只有無免費層與單區域。
- **Cloudflare**：「無狀態、高流量、輕運算」的主場——跟我們的形狀相反。但 R2 物件儲存和免費額度值得單獨借用。
- **Firebase**：「純前端想零後端做即時 App」的主場。我們已有自己的 schema 與同步協定，套它是倒退。但 **FCM 推播免費且是 Android 標準**，無論主機在哪都用它。
- **自架 VPS**：功能上與 Railway 等價且更便宜，代價是所有維運自己扛（安全更新、SSL、備份、監控、故障半夜自己爬起來修）。單人開發者的時間比 $10/月貴。

## 免費層路徑（2026-07-07 補充）

前提：用戶初期約 10 人、最終目標 3-4 千人；單人創作者，成本壓到最低。後端是標準 Node（Hono）+ Postgres（Drizzle），auth 自建（argon2），不綁平台，隨時可搬。

### 方案 A：Render Free + Neon Free（$0/月）⭐ 初期採用

- Node 服務放 Render 免費層；資料庫用 Neon 免費 Postgres（0.5GB / 月 100 CU-hours）。
- 優點：$0、真 Postgres（帳本交易/lock 完整）、git push 部署、程式碼零修改。
- 缺點與對策：
  - 15 分鐘無流量休眠，喚醒 ~30-60 秒 → 用外部免費排程（cron-job.org）每 ~10 分鐘 ping API 保溫。
  - 服務內 node-cron 睡著不跑 → 排程改由外部 cron 打專用 API endpoint 觸發。
  - 每月 750 instance hours，單一服務 24h 開著剛好夠（不要開第二個免費服務）。
- 容量：0.5GB 對 10 人綽綽有餘；數百人、同步 JSONB 變大時升 Neon Launch（$5/月 → 10GB）。

### 方案 B：Railway Hobby（$5/月）— 體驗最佳

無休眠、無冷啟動、DB 與服務同平台、cron 直接在程序內跑。就是上表的 Railway 欄，冷啟動惹人厭時的第一升級選項（或 Render Starter $7/月不休眠）。

### 方案 C：Oracle Cloud Always Free VPS（$0/月）— 不推薦

永久免費 ARM VM（最高 4 核 24GB）+ 自裝 Postgres，效能撐到數千人。但維運全自己扛、閒置可能被回收、熱門區域搶不到機器。單人時間比 $5/月貴。

### 方案 D：Cloudflare Workers + Neon（$0/月）— 不採用

免費層最慷慨，但 AI 長串流有 CPU 時限、Cron Triggers 有執行時限，與工作形狀相反（同上表結論）。

### 升級路徑

1. **現在（~10 人）**：方案 A，$0。
2. **數十～數百人或冷啟動困擾**：Render Starter（$7/月）或搬 Railway（$5 起）。標準 Node+PG，搬家 = 改部署目標 + `pg_dump`，半天內完成。
3. **3-4 千人**：成本主要在 DB 容量與 AI 代理流量，估 $10-25/月（Neon Launch / Railway Pro），屆時再評估。

帳號登入 + 同步與平台無關：auth 是自己的 API + Postgres，前端（網頁/APK）只打 `mali_server_url`，換平台換網址即可。

## 決策與遷移路徑（2026-07 原始版，Railway 優先時的記錄）

**當時決策**：Railway（Hobby $5/月起）＋ M6 時接 FCM。圖片體積成為問題時把大檔改存 R2、DB 只存指標（plan.md §5）。→ 已被上方〈免費層路徑〉取代，Railway 改為第一升級選項。

**何時重新評估**：
- Railway 月費超過 ~$50 且穩定成長 → 評估自架 VPS（此時值得花維運時間）或混合架構
- 台灣玩家抱怨延遲 → Railway 換新加坡區域，或評估 Cloudflare 前置
- 圖片流量大 → R2（無出站流量費是它的殺手鐧）

**遷移成本保險**（當初的架構決策）：
- 後端用 Hono——同一套程式碼可跑 Node（Railway/VPS）或 Cloudflare Workers，換家改入口即可
- 資料庫用標準 SQL + Drizzle migrations——任何 Postgres 都能整包搬走
- 前端透過 `mali_server_url` 指向後端——換網址就換伺服器，APK 不用重發
