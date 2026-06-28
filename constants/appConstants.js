const VERSION = "1.1.9";
const MALIPHONE_AI_PROXY = "https://orange-butterfly-8390.d778105.workers.dev";

const CHANGELOG = {
  "1.1.9": [
    "06/29 更新",
    "新增角色心聲功能，支援自動生成、手動查看與心聲紀錄",
    "新增角色語音功能（測試版），支援 ElevenLabs 聲線設定、試聽與聊天室手動播放",
  ],
  "1.1.8": [
    "06/25 更新",
    "新增英文、日文、韓文介面語言，角色回應會根據 UI 語言設定回覆",
    "新增聊天室背景上傳功能",
    "調整現實模式的玩家對話框",
  ],
  "1.1.6": [
    "06/19 更新",
    "API 新增 DeepSeek",
    "聊天室新增群聊功能",
    "聊天室新增場景設定",
    "新增聊天室釘選功能",
  ],
  "1.1.5": [
    "06/13 更新",
    "API 新增 Vertex AI",
    "修正角色相關設定與 UI 顯示",
  ],
  "1.1.4": [
    "06/03 更新",
    "修正 Gemma / 角色相關設定與 UI 顯示",
  ],
  "1.1.3": [
    "06/02 更新",
    "加入角色狀態 / 設定 / 匯入 / 匯出",
    "修正角色與聊天顯示",
    "修正個人資料設定",
    "提升設定穩定性",
  ],
  "1.1.2": [
    "05/28 更新",
    "加入 AI / 對話 / 記憶 / 角色卡",
    "加入 AIRP 與聊天提示詞",
    "新增角色管理",
    "修正部分錯誤",
  ],
};

const API_PROVIDERS = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", models: ["deepseek-v4-flash", "deepseek-v4-pro"] },
  { id: "claude", name: "Claude", baseUrl: `${MALIPHONE_AI_PROXY}/claude`, models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-opus-4-6", "claude-sonnet-4-5-20250929", "claude-sonnet-4-5", "claude-opus-4-5-20251101", "claude-opus-4-5", "claude-opus-4-1-20250805", "claude-opus-4-1", "claude-sonnet-4-20250514"] },
  { id: "gemini", name: "Gemini API", baseUrl: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "vertex", name: "Vertex AI", baseUrl: "https://aiplatform.googleapis.com/v1", models: ["gemini-3.1-pro-preview", "gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-001", "gemini-2.0-flash-lite-001"] },
  { id: "grok", name: "Grok", baseUrl: "https://api.x.ai/v1", models: ["grok-3-mini", "grok-3"] },
  { id: "novelai", name: "NovelAI", baseUrl: "https://text.novelai.net/oa/v1", models: ["kayra", "erato", "clio"] },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", models: ["auto"] },
  { id: "ollama", name: "Ollama", baseUrl: `${MALIPHONE_AI_PROXY}/ollama`, models: ["gpt-oss:20b-cloud", "gpt-oss:120b-cloud", "llama3.1"] },
  { id: "custom", name: "Custom", baseUrl: "", models: [] },
];

const DEFAULT_APPS = [
  { id: "chat", name: "聊天", icon: "💬", iconUrl: "./app-icons/chat.png?v=1.1.5" },
  { id: "status", name: "狀態", icon: "🪪", iconUrl: "./app-icons/status.png?v=1.1.5" },
  { id: "social", name: "社群", icon: "🗯️", iconUrl: "./app-icons/social.png?v=1.1.5" },
  { id: "gallery", name: "相簿", icon: "🖼️", iconUrl: "./app-icons/album.png?v=1.1.5" },
  { id: "lorebook", name: "世界觀", icon: "📖", iconUrl: "./app-icons/worldbook.png?v=1.1.5" },
  { id: "player", name: "玩家", icon: "🪪", iconUrl: "./app-icons/profile.png?v=1.1.5" },
  { id: "wallet", name: "錢包", icon: "💰", iconUrl: "./app-icons/wallet.png?v=1.1.5" },
  { id: "game", name: "遊戲中心", icon: "🎮", iconUrl: "./app-icons/game.png?v=1.1.7" },
  { id: "lbook", name: "解答之書", icon: "📖", iconUrl: "./app-icons/book.png?v=1.1.1" },
  { id: "notebook", name: "筆記", icon: "📒", iconUrl: "./app-icons/notes.png?v=1.1.5" },
  { id: "settings", name: "設定", icon: "⚙️", iconUrl: "./app-icons/settings.png?v=1.1.5" },
  { id: "characters", name: "聯絡人", icon: "👥", iconUrl: "./app-icons/contacts.png?v=1.1.5" },
  { id: "phone", name: "手機", icon: "📱", iconUrl: "./app-icons/phone.png?v=1.1.5" },
];

const DOCK_APPS = ["chat", "social", "characters", "settings"];

export { VERSION, CHANGELOG, API_PROVIDERS, DEFAULT_APPS, DOCK_APPS };




