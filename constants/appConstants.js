const MALIPHONE_AI_PROXY = "https://maliphone-ai-proxy.d778105.workers.dev";
const CURRENT_VERSION = "1.2.11";

// 本地模型預設接頭：多數本機推論伺服器（Ollama、LM Studio、llama.cpp server…）
// 都會在這個埠開一個 OpenAI 相容的 /v1 端點。
const DEFAULT_LOCAL_BASE_URL = "http://localhost:11434/v1";

// kind 用來把供應商分成「雲端 / 本地」兩區，設定頁據此切換不同面板，
// 服務層則以 isLocalProvider() 判斷是否免 API Key。
const API_PROVIDERS = [
  { id: "openai", name: "OpenAI", kind: "cloud", baseUrl: "https://api.openai.com/v1", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "deepseek", name: "DeepSeek", kind: "cloud", baseUrl: "https://api.deepseek.com/v1", models: ["deepseek-v4-flash", "deepseek-v4-pro"] },
  { id: "claude", name: "Claude", kind: "cloud", baseUrl: `${MALIPHONE_AI_PROXY}/claude`, models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-opus-4-6", "claude-sonnet-4-5-20250929", "claude-sonnet-4-5", "claude-opus-4-5-20251101", "claude-opus-4-5", "claude-opus-4-1-20250805", "claude-opus-4-1", "claude-sonnet-4-20250514"] },
  { id: "gemini", name: "Gemini API", kind: "cloud", baseUrl: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "vertex", name: "Vertex AI", kind: "cloud", baseUrl: "https://aiplatform.googleapis.com/v1", models: ["gemini-3.1-pro-preview", "gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-001", "gemini-2.0-flash-lite-001"] },
  { id: "grok", name: "Grok", kind: "cloud", baseUrl: "https://api.x.ai/v1", models: ["grok-3-mini", "grok-3"] },
  { id: "novelai", name: "NovelAI", kind: "cloud", baseUrl: "https://text.novelai.net/oa/v1", models: ["kayra", "erato", "clio"] },
  { id: "openrouter", name: "OpenRouter", kind: "cloud", baseUrl: "https://openrouter.ai/api/v1", models: ["auto"] },
  { id: "nvidia", name: "NVIDIA NIM", kind: "cloud", baseUrl: "https://integrate.api.nvidia.com/v1", models: ["meta/llama-3.3-70b-instruct", "openai/gpt-oss-20b", "openai/gpt-oss-120b", "deepseek-ai/deepseek-v4-flash", "qwen/qwen3.5-122b-a10b"] },
  { id: "ollama", name: "Ollama (雲端代理)", kind: "cloud", baseUrl: `${MALIPHONE_AI_PROXY}/ollama`, models: ["gpt-oss:20b-cloud", "gpt-oss:120b-cloud", "llama3.1"] },
  { id: "custom", name: "Custom", kind: "cloud", baseUrl: "", models: [] },
  { id: "local", name: "本地模型 (OpenAI 相容)", kind: "local", baseUrl: DEFAULT_LOCAL_BASE_URL, models: [] },
];

const CLOUD_PROVIDERS = API_PROVIDERS.filter((item) => item.kind !== "local");
const LOCAL_PROVIDERS = API_PROVIDERS.filter((item) => item.kind === "local");

// 單一判斷來源：某個供應商 id 是否屬於「玩家自己跑的本地模型」。
// 服務層與設定頁都用它，避免再散落 provider === "ollama" 的硬字串。
const isLocalProvider = (providerId) => LOCAL_PROVIDERS.some((item) => item.id === providerId);

const DEFAULT_APPS = [
  { id: "chat", name: "聊天", icon: "💬", iconUrl: "./app-icons/chat.webp?v=20260802" },
  { id: "status", name: "狀態", icon: "🪪", iconUrl: "./app-icons/status.webp?v=20260802" },
  { id: "social", name: "社群", icon: "🗯️", iconUrl: "./app-icons/social.webp?v=20260802" },
  { id: "gallery", name: "相簿", icon: "🖼️", iconUrl: "./app-icons/album.webp?v=20260802" },
  { id: "lorebook", name: "世界觀", icon: "📖", iconUrl: "./app-icons/worldbook.webp?v=20260802" },
  { id: "player", name: "玩家", icon: "🪪", iconUrl: "./app-icons/profile.webp?v=20260802" },
  { id: "wallet", name: "錢包", icon: "💰", iconUrl: "./app-icons/wallet.webp?v=20260802" },
  { id: "game", name: "遊戲中心", icon: "🎮", iconUrl: "./app-icons/game.webp?v=20260802" },
  { id: "petHome", name: "寵物小屋", icon: "🐾", iconUrl: "./app-icons/pet-home.webp?v=20260802", iconSize: 68 },
  { id: "yunyin", name: "雲隱山莊", icon: "⛰️", iconUrl: "./app-icons/yunyin-villa.webp?v=20260802", iconSize: 72 },
  { id: "lbook", name: "解答之書", icon: "📖", iconUrl: "./app-icons/book.webp?v=20260802" },
  { id: "notebook", name: "筆記", icon: "📒", iconUrl: "./app-icons/notes.webp?v=20260802" },
  { id: "music", name: "一起聽歌", icon: "🎧", iconUrl: "./app-icons/listen-together.webp?v=20260802" },
  { id: "dating", name: "信風", icon: "💘", iconUrl: "./app-icons/trade-wind.webp?v=20260802", iconSize: 62 },
  { id: "couple", name: "情侶空間", icon: "💞", iconUrl: "./app-icons/couple-space.webp?v=20260802", iconSize: 68 },
  { id: "calendar", name: "日曆", icon: "🗓️", iconUrl: "./app-icons/calendar.webp?v=20260802", iconSize: 68 },
  { id: "settings", name: "設定", icon: "⚙️", iconUrl: "./app-icons/settings.webp?v=20260802" },
  { id: "characters", name: "聯絡人", icon: "👥", iconUrl: "./app-icons/contacts.webp?v=20260802" },
  { id: "phone", name: "手機", icon: "📱", iconUrl: "./app-icons/phone.webp?v=20260802" },
];

const DOCK_APPS = ["chat", "social", "characters", "settings"];

export {
  CURRENT_VERSION as VERSION,
  API_PROVIDERS,
  CLOUD_PROVIDERS,
  LOCAL_PROVIDERS,
  DEFAULT_LOCAL_BASE_URL,
  isLocalProvider,
  DEFAULT_APPS,
  DOCK_APPS,
};

