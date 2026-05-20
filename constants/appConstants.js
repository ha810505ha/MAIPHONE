const VERSION = "1.1.1";

const API_PROVIDERS = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "claude", name: "Claude", baseUrl: "https://api.anthropic.com/v1", models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"] },
  { id: "gemini", name: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "grok", name: "Grok", baseUrl: "https://api.x.ai/v1", models: ["grok-3-mini", "grok-3"] },
  { id: "novelai", name: "NovelAI", baseUrl: "https://text.novelai.net/oa/v1", models: ["kayra", "erato", "clio"] },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", models: ["auto"] },
  { id: "ollama", name: "Ollama", baseUrl: "https://ollama.com/v1", models: ["gpt-oss:20b-cloud", "gpt-oss:120b-cloud", "llama3.1"] },
  { id: "custom", name: "Custom", baseUrl: "", models: [] },
];

const DEFAULT_APPS = [
  { id: "chat", name: "聊天", icon: "💬" },
  { id: "status", name: "狀態", icon: "📊" },
  { id: "social", name: "社交", icon: "📰" },
  { id: "gallery", name: "相簿", icon: "🖼️" },
  { id: "lorebook", name: "世界書", icon: "📚" },
  { id: "player", name: "個人資料", icon: "🐱" },
  { id: "wallet", name: "錢包", icon: "💳" },
  { id: "notebook", name: "筆記", icon: "📒" },
  { id: "settings", name: "設定", icon: "⚙️" },
  { id: "characters", name: "聯絡人", icon: "👥" },
  { id: "phone", name: "手機", icon: "📱" },
];

const DOCK_APPS = ["chat", "social", "characters", "settings"];

export { VERSION, API_PROVIDERS, DEFAULT_APPS, DOCK_APPS };

