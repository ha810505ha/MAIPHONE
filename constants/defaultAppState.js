export const DEFAULT_APP_STATE = {
  characters: [], activeCharId: null, chatHistory: {}, chatModes: {}, chatBackgrounds: {}, groupChats: [], chatScenes: {}, groupScenes: {}, chatTimeSettings: {},
  innerThoughtSettings: {}, proactiveSettings: {}, proactiveUnread: {}, posts: [], socialSettings: { autoPost: false, enabledCharacterIds: null, frequency: "normal", frequencyByCharacter: {} }, memories: {}, lorebooks: [],
  chatLorebookBindings: {}, phoneInboxCache: {}, phoneAppCache: {}, wallet: { balance: 500, transactions: [], assets: [] }, characterWallets: {},
  apiPresets: [
    { id: "preset-1", name: "預設 1", provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" },
    { id: "preset-2", name: "預設 2", provider: "grok", baseUrl: "https://api.x.ai/v1", apiKey: "", model: "grok-3-mini" },
    { id: "preset-3", name: "預設 3", provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: "", model: "auto" },
  ],
  playerProfile: { name: "玩家", nickname: "", gender: "", bio: "", avatar: "", doll: { hairStyle: "長髮", topStyle: "連帽上衣", accessoryStyle: "髮夾", hairColor: "#5d4037", topColor: "#f48fb1", accessoryColor: "#90caf9" } },
  apiConfig: { provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini", location: "global", temperatureEnabled: false, temperature: 1 },
  ttsConfig: { enabled: false, provider: "elevenlabs", elevenlabs: { apiKey: "", model: "eleven_flash_v2_5", defaultVoiceId: "JBFqnCBsd6RMkjVDRZzb" }, minimax: { apiKey: "", model: "speech-2.8-turbo", baseUrl: "https://api.minimax.io", defaultVoiceId: "English_expressive_narrator" } },
  themeName: "莓果蘇打", fontName: "圓體", fontSizeScale: "normal", uiLanguage: "zh-TW", screenLockTimeout: 5,
};
