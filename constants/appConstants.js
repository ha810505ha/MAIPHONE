const VERSION = "1.1.1";
const MALIPHONE_AI_PROXY = "https://orange-butterfly-8390.d778105.workers.dev";

const API_PROVIDERS = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "claude", name: "Claude", baseUrl: `${MALIPHONE_AI_PROXY}/claude`, models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"] },
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

export { VERSION, API_PROVIDERS, DEFAULT_APPS, DOCK_APPS };

