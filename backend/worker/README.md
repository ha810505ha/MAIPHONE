# Worker

Cloudflare Worker 原始碼預留目錄。正式開發時再建立 `wrangler.jsonc`、`package.json` 與 `src/`。

建議 API 分區：

- `/auth/*`：登入與工作階段
- `/sync/*`：雲端資料同步
- `/devices/*`：推播裝置 Token
- `/messages/*`：背景主動訊息
- `/billing/*`：點數與商店收據驗證
- `/proxy/*`：AI 供應商代理
