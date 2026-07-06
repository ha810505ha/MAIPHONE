# MaliPhone Backend

MaliPhone 的後端工作區，預計以 Cloudflare Workers 為主要執行環境。

## 預計功能

- AI API 代理與金鑰保護
- 帳號登入與裝置管理
- App 資料雲端同步
- 背景主動訊息與排程
- Firebase Cloud Messaging 推播
- 付費點數、交易紀錄與商店收據驗證

## 目錄

- `worker/`：Cloudflare Worker API 程式
- `migrations/`：D1 資料庫結構與遷移
- `docs/`：架構、API 與安全設計文件

任何 API Key、Firebase 私鑰、付款金鑰或 `.dev.vars` 都不得提交到 Git。
