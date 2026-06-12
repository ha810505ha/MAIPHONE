const VERSION = "1.1.5";
const MALIPHONE_AI_PROXY = "https://orange-butterfly-8390.d778105.workers.dev";

const CHANGELOG = {
  "1.1.5": [
    "06/13 更新",
    "新增了 Vertex ai 可以選擇",
    "新增了深色主題（尚未完成）",
  ],
  "1.1.4": [
    "06/03 更新",
    "修正 Gemma/角色相關設定與 UI 顯示",
  ],
  "1.1.3": [
    "06/02 更新",
    "改善角色互動與設定流程",
    "調整預設/匯入/刪除等操作體驗",
    "修正聊天與記憶相關問題",
    "提升設定頁穩定性",
  ],
  "1.1.2": [
    "05/28 更新",
    "加入聊天 / 社群 / 記憶等功能",
    "新增 AIRP 與更多基礎介面",
    "優化角色與聊天室載入",
    "提升系統穩定性",
  ],
};

const API_PROVIDERS = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "claude", name: "Claude", baseUrl: `${MALIPHONE_AI_PROXY}/claude`, models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-opus-4-6", "claude-sonnet-4-5-20250929", "claude-sonnet-4-5", "claude-opus-4-5-20251101", "claude-opus-4-5", "claude-opus-4-1-20250805", "claude-opus-4-1", "claude-sonnet-4-20250514"] },
  { id: "gemini", name: "Gemini API", baseUrl: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "vertex", name: "Vertex AI (快速模式)", baseUrl: "https://aiplatform.googleapis.com/v1", models: ["gemini-3.1-pro-preview", "gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-001", "gemini-2.0-flash-lite-001"] },
  { id: "grok", name: "Grok", baseUrl: "https://api.x.ai/v1", models: ["grok-3-mini", "grok-3"] },
  { id: "novelai", name: "NovelAI", baseUrl: "https://text.novelai.net/oa/v1", models: ["kayra", "erato", "clio"] },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", models: ["auto"] },
  { id: "ollama", name: "Ollama", baseUrl: `${MALIPHONE_AI_PROXY}/ollama`, models: ["gpt-oss:20b-cloud", "gpt-oss:120b-cloud", "llama3.1"] },
  { id: "custom", name: "Custom", baseUrl: "", models: [] },
];

const DEFAULT_APPS = [
  { id: "chat", name: "聊天", icon: "💬", iconUrl: "./app-icons/chat.png" },
  { id: "status", name: "狀態", icon: "📡", iconUrl: "./app-icons/status.png" },
  { id: "social", name: "社群", icon: "🗯️", iconUrl: "./app-icons/social.png" },
  { id: "gallery", name: "相簿", icon: "🖼️", iconUrl: "./app-icons/album.png" },
  { id: "lorebook", name: "世界觀", icon: "📖", iconUrl: "./app-icons/worldbook.png" },
  { id: "player", name: "玩家", icon: "🙂", iconUrl: "./app-icons/profile.png" },
  { id: "wallet", name: "錢包", icon: "💰", iconUrl: "./app-icons/wallet.png" },
  { id: "notebook", name: "筆記", icon: "📝", iconUrl: "./app-icons/notes.png" },
  { id: "settings", name: "設定", icon: "⚙️", iconUrl: "./app-icons/settings.png" },
  { id: "characters", name: "角色", icon: "👥", iconUrl: "./app-icons/contacts.png" },
  { id: "phone", name: "手機", icon: "📱", iconUrl: "./app-icons/phone.png" },
];

const DOCK_APPS = ["chat", "social", "characters", "settings"];

export { VERSION, CHANGELOG, API_PROVIDERS, DEFAULT_APPS, DOCK_APPS };
