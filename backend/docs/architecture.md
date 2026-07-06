# Backend Architecture

## 建議服務

- Cloudflare Workers：API 與驗證
- Cloudflare D1：帳號、同步索引、點數帳本
- Cloudflare R2：大型備份與媒體檔案
- Cloudflare Cron Triggers：背景排程
- Firebase Cloud Messaging：Android 推播
- Google Play Billing：Android 付費交易

## 重要原則

1. 點數餘額只能由後端帳本計算，不能相信 App 傳來的餘額。
2. Google Play 付款必須由後端驗證收據後才入點。
3. 同步資料要有版本號、更新時間與衝突處理，避免不同裝置互相覆蓋。
4. API Key 與服務帳號只存在 Cloudflare Secrets，不寫入 APK 或 Git。
5. 敏感資料需最小化保存，並提供匯出與刪除帳號流程。
