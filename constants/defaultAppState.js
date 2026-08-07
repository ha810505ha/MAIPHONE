import { DEFAULT_NOTIFICATION_SETTINGS } from "./notifications";

export const DEFAULT_APP_STATE = {
  personas: {}, activePersonaId: null,
  characters: [], activeCharId: null, chatHistory: {}, chatRooms: {}, activeRoomIds: {}, chatModes: {}, chatBackgrounds: {}, groupChats: [], chatScenes: {}, groupScenes: {}, chatTimeSettings: {},
  innerThoughtSettings: {}, proactiveSettings: {}, proactiveUnread: {}, posts: [], socialSettings: { autoPost: false, enabledCharacterIds: null, frequency: "normal", frequencyByCharacter: {}, characterInteractionsEnabled: false, characterInteractionChance: 50 }, memories: {}, lorebooks: [],
  chatLorebookBindings: {}, phoneInboxCache: {}, phoneAppCache: {}, wallet: { balance: 500, transactions: [], assets: [], life: { balance: 0, transactions: [], budget: 0 } }, characterWallets: {}, transfers: [], characterBlockStates: {}, characterChatMeta: {},
  apiPresets: [
    { id: "preset-1", name: "預設 1", provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" },
    { id: "preset-2", name: "預設 2", provider: "grok", baseUrl: "https://api.x.ai/v1", apiKey: "", model: "grok-3-mini" },
    { id: "preset-3", name: "預設 3", provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: "", model: "auto" },
  ],
  playerProfile: { name: "玩家", nickname: "", gender: "", bio: "", avatar: "", doll: { hairStyle: "長髮", topStyle: "連帽上衣", accessoryStyle: "髮夾", hairColor: "#5d4037", topColor: "#f48fb1", accessoryColor: "#90caf9" } },
  apiConfig: { provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini", location: "global", temperatureEnabled: false, temperature: 1, aiSource: "personal", hostedTestProvider: "", hostedTestModel: "" },
  ttsConfig: { enabled: false, provider: "elevenlabs", elevenlabs: { apiKey: "", model: "eleven_flash_v2_5", defaultVoiceId: "JBFqnCBsd6RMkjVDRZzb" }, minimax: { apiKey: "", model: "speech-2.8-turbo", baseUrl: "https://api.minimax.io", defaultVoiceId: "English_expressive_narrator" } },
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS, notificationState: { lastNotifiedAt: 0 },
  themeName: "莓果蘇打", fontName: "圓體", fontSizeScale: "normal", uiLanguage: "zh-TW", screenLockTimeout: 5,
  // 玩家可改寫的提示詞。空字串代表沿用內建預設，所以清空欄位等同還原。
  customPrompts: { memoryCompress: "" },
};
