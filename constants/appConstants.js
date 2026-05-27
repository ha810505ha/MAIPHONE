const VERSION = "1.1.2";
const MALIPHONE_AI_PROXY = "https://orange-butterfly-8390.d778105.workers.dev";

const CHANGELOG = {
  "1.1.2": [
    "05/28 更新",
    "新增線上聊天 / 現實模式切換，並維持同一條角色時間線。",
    "現實模式支援 AIRP 段落排版、角色內心斜體與台詞上色。",
    "新增角色卡匯出 / 匯入，支援 MaliPhone 角色卡格式。",
    "角色頭像支援裁切、縮放與自動壓縮，方便跨裝置分享。",
    "社群發文會參考近期聊天主題，但避免公開私聊內容。",
  ],
};

const API_PROVIDERS = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "claude", name: "Claude", baseUrl: `${MALIPHONE_AI_PROXY}/claude`, models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-opus-4-6", "claude-sonnet-4-5-20250929", "claude-sonnet-4-5", "claude-opus-4-5-20251101", "claude-opus-4-5", "claude-opus-4-1-20250805", "claude-opus-4-1", "claude-sonnet-4-20250514"] },
  { id: "gemini", name: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "grok", name: "Grok", baseUrl: "https://api.x.ai/v1", models: ["grok-3-mini", "grok-3"] },
  { id: "novelai", name: "NovelAI", baseUrl: "https://text.novelai.net/oa/v1", models: ["kayra", "erato", "clio"] },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", models: ["auto"] },
  { id: "ollama", name: "Ollama", baseUrl: `${MALIPHONE_AI_PROXY}/ollama`, models: ["gpt-oss:20b-cloud", "gpt-oss:120b-cloud", "llama3.1"] },
  { id: "custom", name: "Custom", baseUrl: "", models: [] },
];

const DEFAULT_APPS = [
  { id: "chat", name: "聊天", icon: "💬", iconUrl: "./app-icons/chat.png" },
  { id: "status", name: "狀態", icon: "📊", iconUrl: "./app-icons/status.png" },
  { id: "social", name: "社交", icon: "📰", iconUrl: "./app-icons/social.png" },
  { id: "gallery", name: "相簿", icon: "🖼️", iconUrl: "./app-icons/album.png" },
  { id: "lorebook", name: "世界書", icon: "📚", iconUrl: "./app-icons/worldbook.png" },
  { id: "player", name: "個人資料", icon: "🐱", iconUrl: "./app-icons/profile.png" },
  { id: "wallet", name: "錢包", icon: "💳", iconUrl: "./app-icons/wallet.png" },
  { id: "notebook", name: "筆記", icon: "📒", iconUrl: "./app-icons/notes.png" },
  { id: "settings", name: "設定", icon: "⚙️", iconUrl: "./app-icons/settings.png" },
  { id: "characters", name: "聯絡人", icon: "👥", iconUrl: "./app-icons/contacts.png" },
  { id: "phone", name: "手機", icon: "📱", iconUrl: "./app-icons/phone.png" },
];

const DOCK_APPS = ["chat", "social", "characters", "settings"];

export { VERSION, CHANGELOG, API_PROVIDERS, DEFAULT_APPS, DOCK_APPS };

