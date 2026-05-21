# MALIPHONE Cloudflare Workers AI Proxy

這是小手機給 `Claude` 和 `Ollama Cloud` 使用的代理範本。

目前策略是：

- `OpenAI / OpenRouter / Gemini / Grok` 先走前端直連。
- `Claude / Ollama Cloud` 因為容易被 CORS 擋，所以走 Cloudflare Worker。
- 玩家使用自己的 API Key。
- Worker 只轉發，不保存玩家 API Key。

## 為什麼需要代理

GitHub Pages 是純前端網站，瀏覽器直接呼叫某些 AI API 時會遇到 CORS 限制。

Claude 和 Ollama Cloud 目前就比較容易遇到這個問題，所以用 Worker 當中轉：

```text
小手機 GitHub Pages
  -> Cloudflare Worker
  -> Claude / Ollama Cloud
```

玩家的 API Key 仍然是玩家自己的，小手機只是在送出請求時交給 Worker 轉發。

## 部署 Worker

1. 進入 Cloudflare Dashboard。
2. 點 `Workers & Pages`。
3. 點 `Create`。
4. 選 `Worker`。
5. 選 `從 Hello World 開始!`。
6. Worker 名稱可以填：

```text
maliphone-ai-proxy
```

7. 建立後進入程式碼編輯器。
8. 刪掉預設 Hello World 程式碼。
9. 貼上 [`cloudflare-worker-proxy/worker.js`](../cloudflare-worker-proxy/worker.js) 的內容。
10. 按 `Deploy`。

部署後會拿到類似：

```text
https://maliphone-ai-proxy.你的帳號.workers.dev
```

下面用這個代稱：

```text
https://你的-worker網址.workers.dev
```

## 允許來源

Worker 內預設允許：

```text
http://localhost:5173
https://ha810505ha.github.io
```

如果未來你的 GitHub Pages 網址換掉，請改 `DEFAULT_ALLOWED_ORIGINS`。

如果用 Cloudflare 環境變數，可以設定：

```text
ALLOWED_ORIGINS=https://ha810505ha.github.io,http://localhost:5173
```

## 小手機內怎麼填

### Claude

```text
API 供應商：Claude
Base URL：https://你的-worker網址.workers.dev/claude
API Key：玩家自己的 Anthropic API Key
Model：claude-sonnet-4-20250514 或玩家可用模型
```

注意：Base URL 最後一定要有 `/claude`。

小手機會呼叫：

```text
https://你的-worker網址.workers.dev/claude/messages
```

Worker 會轉發到：

```text
https://api.anthropic.com/v1/messages
```

### Ollama Cloud

```text
API 供應商：Ollama
Base URL：https://你的-worker網址.workers.dev/ollama
API Key：玩家自己的 Ollama Cloud API Key
Model：玩家在 Ollama Cloud 可用的模型
```

注意：Base URL 最後一定要有 `/ollama`。

小手機會呼叫：

```text
https://你的-worker網址.workers.dev/ollama/chat/completions
```

Worker 會轉發到：

```text
https://ollama.com/v1/chat/completions
```

## 測試 Worker

打開：

```text
https://你的-worker網址.workers.dev/health
```

如果看到：

```json
{
  "ok": true,
  "name": "MALIPHONE Cloudflare AI Proxy"
}
```

代表 Worker 有成功部署。

## 目前開放的路徑

```text
/claude/messages
/claude/models
/ollama/chat/completions
/ollama/models
```

其他 provider 不經過這個 Worker，避免消耗代理流量。

## 安全注意

- 不要在 Worker 裡寫死你的 API Key。
- 不要 `console.log(request.headers)`。
- 不要 `console.log(await request.text())`。
- 不要讓前端傳任意目標網址。
- 如果未來玩家很多，再加 rate limit，避免 Worker 免費額度被刷掉。

## 常見問題

### `/health` 成功，但 Claude 不能抓模型

先確認小手機的 Base URL 是：

```text
https://你的-worker網址.workers.dev/claude
```

不是：

```text
https://你的-worker網址.workers.dev
```

如果還是不行，通常是 API Key 權限、模型端點限制，或 Worker 程式碼還沒重新 Deploy。

### `/health` 成功，但 Ollama Cloud 不能連

先確認小手機的 Base URL 是：

```text
https://你的-worker網址.workers.dev/ollama
```

Ollama Cloud 的模型名稱必須填玩家帳號可用的模型名稱。
