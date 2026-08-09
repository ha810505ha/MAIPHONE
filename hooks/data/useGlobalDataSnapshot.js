import { DOCK_APPS, VERSION } from "../../constants/appConstants";
import { HOME_SLOT_COUNT } from "../../utils/homeLayout";
import { normalizeUiLanguage } from "../../utils/i18n";
import { preserveMissingDeviceSecrets } from "../../utils/deviceSecrets";
import { sanitizeCustomCss } from "../../utils/customCss";
import { sanitizeFontName } from "../../utils/fontName";
import { FONT_PRESETS } from "../../styles/themePresets";
import {
  compactActiveRoomMirrors,
  compactCharacterImages,
  compactGroupMessageImages,
  compactSocialPostImages,
} from "../../utils/persistedMediaCleanup";
import { normalizeCharacterBlockStates } from "../../services/chat/characterBlockState";
import {
  loadFeatureBackup,
  restoreFeatureBackup,
  summarizeFeatureBackup,
} from "../../services/featureBackupService";
import { saveAppState } from "../../utils/indexedDbStorage";
import { serializePersonas } from "../../services/persona/personaModel";

export const LOCAL_APP_DATA_KEYS = [
  "maliphone-pet-home",
  "maliphone-pet-settings",
  "maliphone-pet-cooldown-until",
  "mali_yunyin_save_v1",
  "mali_yunyin_crystals_v1",
];

/**
 * Owns the app-state snapshot contract used by persistence, backup/import,
 * and feature-data restore. UI controllers should only provide state and
 * setters; the serialization and validation rules stay in this domain.
 */
export default function useGlobalDataSnapshot({
  defaultAppState,
  state,
  setters,
  applyLoadedAppState,
  tr,
  sanitizeText,
}) {
  const {
    characters,
    activeCharId,
    chatHistory,
    chatRooms,
    activeRoomIds,
    chatModes,
    chatBackgrounds,
    groupChats,
    chatScenes,
    groupScenes,
    chatTimeSettings,
    innerThoughtSettings,
    proactiveSettings,
    proactiveUnread,
    posts,
    socialSettings,
    memories,
    lorebooks,
    chatLorebookBindings,
    phoneInboxCache,
    phoneAppCache,
    wallet,
    characterWallets,
    transfers,
    characterBlockStates,
    screenLockTimeout,
    apiPresets,
    playerProfile,
    apiConfig,
    ttsConfig,
    themeName,
    fontName,
    fontSizeScale,
    uiLanguage,
    customFontName,
    customCss,
    customCssEnabled,
    homeSlots,
    dockOrder,
    notificationCenter,
    personaController,
    captureCurrentPersona,
  } = state;

  const {
    setChatModes,
    setChatBackgrounds,
    setGroupChats,
    setGroupScenes,
    setChatTimeSettings,
    setInnerThoughtSettings,
    setProactiveSettings,
    setProactiveUnread,
    setPosts,
    setSocialSettings,
    setLorebooks,
    setChatLorebookBindings,
    setPhoneInboxCache,
    setPhoneAppCache,
    setWallet,
    setCharacterWallets,
    setTransfers,
    setCharacterBlockStates,
    setScreenLockTimeout,
    setApiPresets,
    setPlayerProfile,
    setApiConfig,
    setTtsConfig,
    setThemeName,
    setFontName,
    setFontSizeScale,
    setUiLanguage,
    setCustomFontName,
    setCustomCss,
    setCustomCssDraft,
    setCustomCssEnabled,
    setHomeSlots,
    setDockOrder,
    setActiveLorebookId,
    setCurrentChatChar,
    setCurrentChatGroup,
    setChatBgEditor,
    setChatSettingsBackgroundOpen,
    setChatSettingsLorebookOpen,
    setChatroomManageOpen,
    setChatSettingsExpandedBooks,
  } = setters;

  const getLocalAppDataSnapshot = ({ includeMissing = false } = {}) => LOCAL_APP_DATA_KEYS.reduce((snapshot, key) => {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) snapshot[key] = value;
      else if (includeMissing) snapshot[key] = null;
    } catch {}
    return snapshot;
  }, {});

  const applyLocalAppDataSnapshot = (snapshot, { replace = false } = {}) => {
    if (!snapshot || typeof snapshot !== "object") return;
    LOCAL_APP_DATA_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
        if (replace) {
          try { localStorage.removeItem(key); } catch {}
        }
        return;
      }
      try {
        const value = snapshot[key];
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      } catch {}
    });
    try { window.dispatchEvent(new Event("pet-settings-changed")); } catch {}
  };

  const persistenceSnapshot = {
    characters,
    activeCharId,
    chatHistory,
    chatRooms,
    activeRoomIds,
    chatModes,
    chatBackgrounds,
    groupChats,
    chatScenes,
    groupScenes,
    chatTimeSettings,
    innerThoughtSettings,
    proactiveSettings,
    proactiveUnread,
    posts,
    socialSettings,
    memories,
    lorebooks,
    chatLorebookBindings,
    phoneInboxCache,
    phoneAppCache,
    wallet,
    characterWallets,
    transfers,
    characterBlockStates,
    screenLockTimeout,
    apiPresets,
    playerProfile,
    apiConfig,
    ttsConfig,
    ...notificationCenter.persisted,
    themeName,
    fontName,
    fontSizeScale,
    uiLanguage,
    homeSlots,
    dockOrder,
    personas: serializePersonas(
      personaController.personas,
      personaController.activePersonaId,
      captureCurrentPersona(),
    ),
    activePersonaId: personaController.activePersonaId,
  };

  const getAppStateSnapshot = async ({
    includeSecrets = false,
    compactMedia = true,
    includeMissingLocalData = false,
  } = {}) => {
    const exportCharacters = compactMedia ? compactCharacterImages(characters) : characters;
    const exportGroupChats = compactMedia
      ? compactGroupMessageImages(groupChats, exportCharacters)
      : groupChats;
    const exportPosts = compactMedia ? compactSocialPostImages(posts, exportCharacters) : posts;
    const exportChatRooms = compactMedia
      ? compactActiveRoomMirrors(chatRooms, activeRoomIds)
      : chatRooms;
    const exportApiConfig = includeSecrets
      ? apiConfig
      : { ...apiConfig, apiKey: "", openRouterManagementKey: "" };
    const exportApiPresets = (Array.isArray(apiPresets) ? apiPresets : []).map((preset) => ({
      ...preset,
      apiKey: includeSecrets ? preset.apiKey : "",
    }));
    const exportTtsConfig = includeSecrets ? ttsConfig : {
      ...ttsConfig,
      elevenlabs: { ...(ttsConfig?.elevenlabs || {}), apiKey: "" },
      minimax: { ...(ttsConfig?.minimax || {}), apiKey: "" },
    };

    return {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      format: "maliphone-app-state",
      formatVersion: 1,
      state: {
        characters: exportCharacters,
        activeCharId,
        chatHistory,
        chatRooms: exportChatRooms,
        activeRoomIds,
        chatModes,
        chatBackgrounds,
        groupChats: exportGroupChats,
        chatScenes,
        groupScenes,
        chatTimeSettings,
        innerThoughtSettings,
        proactiveSettings,
        proactiveUnread,
        posts: exportPosts,
        socialSettings,
        memories,
        lorebooks,
        chatLorebookBindings,
        phoneInboxCache,
        phoneAppCache,
        wallet,
        characterWallets,
        transfers,
        characterBlockStates,
        screenLockTimeout,
        apiPresets: exportApiPresets,
        playerProfile,
        apiConfig: exportApiConfig,
        ttsConfig: exportTtsConfig,
        ...notificationCenter.persisted,
        themeName,
        fontName,
        fontSizeScale,
        uiLanguage,
        customFontName,
        customCss,
        customCssEnabled,
        homeSlots,
        dockOrder,
        personas: serializePersonas(
          personaController.personas,
          personaController.activePersonaId,
          captureCurrentPersona(),
        ),
        activePersonaId: personaController.activePersonaId,
        localAppData: getLocalAppDataSnapshot({ includeMissing: includeMissingLocalData }),
        featureData: await loadFeatureBackup(exportCharacters, {
          compactImages: compactMedia,
          personaIds: Object.keys(personaController.personas || {}),
        }),
      },
    };
  };

  const getExportableAppState = () => getAppStateSnapshot();
  const getRollbackAppState = () => getAppStateSnapshot({
    includeSecrets: true,
    compactMedia: false,
    includeMissingLocalData: true,
  });

  const validateImportedAppState = (incoming) => {
    const fail = () => {
      throw new Error(tr(
        "備份檔案格式不正確或資料超出安全上限",
        "The backup format is invalid or exceeds safe limits",
        "バックアップ形式が正しくないか、安全上限を超えています",
        "백업 형식이 올바르지 않거나 안전 한도를 초과했습니다",
      ));
    };
    const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
    if (!isRecord(incoming)) fail();
    if (incoming.format && incoming.format !== "maliphone-app-state") fail();
    if (
      incoming.formatVersion != null
      && (!Number.isInteger(Number(incoming.formatVersion)) || Number(incoming.formatVersion) > 1)
    ) fail();
    const src = incoming?.state && incoming?.format === "maliphone-app-state"
      ? incoming.state
      : incoming;
    if (!isRecord(src)) fail();
    const knownFields = [
      "characters",
      "chatHistory",
      "chatRooms",
      "groupChats",
      "posts",
      "lorebooks",
      "playerProfile",
      "personas",
      "featureData",
    ];
    if (!knownFields.some((field) => Object.prototype.hasOwnProperty.call(src, field))) fail();
    const arrayLimits = {
      characters: 500,
      groupChats: 300,
      posts: 10000,
      lorebooks: 1000,
      transfers: 20000,
      apiPresets: 100,
      homeSlots: 500,
      dockOrder: 100,
    };
    for (const [field, limit] of Object.entries(arrayLimits)) {
      if (src[field] != null && (!Array.isArray(src[field]) || src[field].length > limit)) fail();
    }
    const objectFields = [
      "chatHistory",
      "chatRooms",
      "activeRoomIds",
      "chatModes",
      "chatBackgrounds",
      "chatScenes",
      "groupScenes",
      "chatTimeSettings",
      "innerThoughtSettings",
      "proactiveSettings",
      "proactiveUnread",
      "memories",
      "chatLorebookBindings",
      "phoneInboxCache",
      "phoneAppCache",
      "wallet",
      "characterWallets",
      "playerProfile",
      "personas",
      "apiConfig",
      "ttsConfig",
      "localAppData",
      "featureData",
    ];
    for (const field of objectFields) {
      if (src[field] != null && !isRecord(src[field])) fail();
    }
    const chatThreads = isRecord(src.chatHistory) ? Object.values(src.chatHistory) : [];
    if (
      chatThreads.length > 1000
      || chatThreads.some((messages) => !Array.isArray(messages) || messages.length > 20000)
    ) fail();
  };

  const summarizeImportedData = (incoming) => {
    const src = incoming?.state && incoming?.format === "maliphone-app-state"
      ? incoming.state
      : incoming;
    return {
      format: incoming?.format === "maliphone-app-state" ? "maliphone-app-state" : "legacy",
      exportedAt: incoming?.exportedAt || null,
      characters: Array.isArray(src?.characters) ? src.characters.length : 0,
      chatThreads: src?.chatHistory && typeof src.chatHistory === "object"
        ? Object.keys(src.chatHistory).length
        : 0,
      chatBackgrounds: src?.chatBackgrounds && typeof src.chatBackgrounds === "object"
        ? Object.keys(src.chatBackgrounds).length
        : 0,
      groupChats: Array.isArray(src?.groupChats) ? src.groupChats.length : 0,
      scenes: (
        src?.chatScenes && typeof src.chatScenes === "object"
          ? Object.keys(src.chatScenes).length
          : 0
      ) + (
        src?.groupScenes && typeof src.groupScenes === "object"
          ? Object.keys(src.groupScenes).length
          : 0
      ),
      posts: Array.isArray(src?.posts) ? src.posts.length : 0,
      lorebooks: Array.isArray(src?.lorebooks) ? src.lorebooks.length : 0,
      playerProfile: !!src?.playerProfile,
      customCss: typeof src?.customCss === "string" && !!src.customCss.trim(),
      ...summarizeFeatureBackup(src),
    };
  };

  const applyImportedAppState = async (incoming, { rollback = false } = {}) => {
    const src = incoming?.state && incoming?.format === "maliphone-app-state"
      ? incoming.state
      : incoming;
    if (!src || typeof src !== "object") {
      throw new Error(tr(
        "檔案內容不正確",
        "Invalid file content",
        "ファイル内容が正しくありません",
        "파일 내용이 올바르지 않습니다",
      ));
    }

    let nextState = {
      ...defaultAppState,
      characters: Array.isArray(src.characters) ? src.characters : [],
      activeCharId: src.activeCharId ?? null,
      chatHistory: src.chatHistory && typeof src.chatHistory === "object" ? src.chatHistory : {},
      chatRooms: src.chatRooms && typeof src.chatRooms === "object" ? src.chatRooms : {},
      activeRoomIds: src.activeRoomIds && typeof src.activeRoomIds === "object" ? src.activeRoomIds : {},
      chatModes: src.chatModes && typeof src.chatModes === "object" ? src.chatModes : {},
      chatBackgrounds: src.chatBackgrounds && typeof src.chatBackgrounds === "object" ? src.chatBackgrounds : {},
      groupChats: Array.isArray(src.groupChats) ? src.groupChats : [],
      chatScenes: src.chatScenes && typeof src.chatScenes === "object" ? src.chatScenes : {},
      groupScenes: src.groupScenes && typeof src.groupScenes === "object" ? src.groupScenes : {},
      chatTimeSettings: src.chatTimeSettings && typeof src.chatTimeSettings === "object" ? src.chatTimeSettings : {},
      innerThoughtSettings: src.innerThoughtSettings && typeof src.innerThoughtSettings === "object" ? src.innerThoughtSettings : {},
      proactiveSettings: src.proactiveSettings && typeof src.proactiveSettings === "object" ? src.proactiveSettings : {},
      proactiveUnread: src.proactiveUnread && typeof src.proactiveUnread === "object" ? src.proactiveUnread : {},
      notificationSettings: src.notificationSettings,
      notificationState: src.notificationState,
      posts: Array.isArray(src.posts) ? src.posts : [],
      socialSettings: src.socialSettings && typeof src.socialSettings === "object"
        ? { ...defaultAppState.socialSettings, ...src.socialSettings }
        : { ...defaultAppState.socialSettings },
      memories: src.memories && typeof src.memories === "object" ? src.memories : {},
      customPrompts: src.customPrompts && typeof src.customPrompts === "object"
        ? { ...defaultAppState.customPrompts, ...src.customPrompts }
        : { ...defaultAppState.customPrompts },
      lorebooks: Array.isArray(src.lorebooks) ? src.lorebooks : [],
      chatLorebookBindings: src.chatLorebookBindings && typeof src.chatLorebookBindings === "object" ? src.chatLorebookBindings : {},
      phoneInboxCache: src.phoneInboxCache && typeof src.phoneInboxCache === "object" ? src.phoneInboxCache : {},
      phoneAppCache: src.phoneAppCache && typeof src.phoneAppCache === "object" ? src.phoneAppCache : {},
      wallet: src.wallet && typeof src.wallet === "object" ? src.wallet : defaultAppState.wallet,
      characterWallets: src.characterWallets && typeof src.characterWallets === "object" ? src.characterWallets : {},
      transfers: Array.isArray(src.transfers) ? src.transfers : [],
      characterBlockStates: normalizeCharacterBlockStates(src.characterBlockStates),
      screenLockTimeout: Number.isFinite(Number(src.screenLockTimeout))
        ? Number(src.screenLockTimeout)
        : defaultAppState.screenLockTimeout,
      apiPresets: Array.isArray(src.apiPresets) && src.apiPresets.length
        ? src.apiPresets
        : defaultAppState.apiPresets,
      playerProfile: src.playerProfile && typeof src.playerProfile === "object"
        ? src.playerProfile
        : defaultAppState.playerProfile,
      apiConfig: {
        ...defaultAppState.apiConfig,
        ...(src.apiConfig && typeof src.apiConfig === "object" ? src.apiConfig : {}),
        aiSource: src.apiConfig?.aiSource === "hosted_test" ? "hosted_test" : "personal",
      },
      ttsConfig: src.ttsConfig && typeof src.ttsConfig === "object"
        ? {
          ...defaultAppState.ttsConfig,
          ...src.ttsConfig,
          elevenlabs: { ...defaultAppState.ttsConfig.elevenlabs, ...(src.ttsConfig.elevenlabs || {}) },
          minimax: { ...defaultAppState.ttsConfig.minimax, ...(src.ttsConfig.minimax || {}) },
        }
        : defaultAppState.ttsConfig,
      themeName: src.themeName || defaultAppState.themeName,
      fontName: FONT_PRESETS[src.fontName] ? src.fontName : defaultAppState.fontName,
      fontSizeScale: ["normal", "large", "xlarge", "xxlarge"].includes(src.fontSizeScale)
        ? src.fontSizeScale
        : defaultAppState.fontSizeScale,
      uiLanguage: normalizeUiLanguage(src.uiLanguage, defaultAppState.uiLanguage),
      homeSlots: Array.isArray(src.homeSlots) && src.homeSlots.length === HOME_SLOT_COUNT
        ? src.homeSlots
        : Array.from({ length: HOME_SLOT_COUNT }, () => null),
      dockOrder: Array.isArray(src.dockOrder) && src.dockOrder.length ? src.dockOrder : DOCK_APPS,
      personas: src.personas && typeof src.personas === "object" ? src.personas : {},
      activePersonaId: src.activePersonaId || null,
      localAppData: src.localAppData && typeof src.localAppData === "object" ? src.localAppData : {},
    };

    nextState = preserveMissingDeviceSecrets(nextState, {
      apiConfig,
      apiPresets,
      ttsConfig,
    });
    applyLoadedAppState(nextState);
    setChatModes(nextState.chatModes);
    setChatBackgrounds(nextState.chatBackgrounds);
    setGroupChats(nextState.groupChats);
    setGroupScenes(nextState.groupScenes);
    setChatTimeSettings(nextState.chatTimeSettings);
    setInnerThoughtSettings(nextState.innerThoughtSettings);
    setProactiveSettings(nextState.proactiveSettings);
    setProactiveUnread(nextState.proactiveUnread);
    notificationCenter.hydrate(nextState);
    setPosts(nextState.posts);
    setSocialSettings(nextState.socialSettings);
    setLorebooks(nextState.lorebooks);
    setChatLorebookBindings(nextState.chatLorebookBindings);
    setPhoneInboxCache(nextState.phoneInboxCache);
    setPhoneAppCache(nextState.phoneAppCache);
    setWallet(nextState.wallet);
    setCharacterWallets(nextState.characterWallets);
    setTransfers(nextState.transfers);
    setCharacterBlockStates(nextState.characterBlockStates);
    setScreenLockTimeout(nextState.screenLockTimeout);
    setApiPresets(nextState.apiPresets);
    setPlayerProfile(nextState.playerProfile);
    setApiConfig(nextState.apiConfig);
    setTtsConfig(nextState.ttsConfig);
    setThemeName(nextState.themeName);
    setFontName(nextState.fontName);
    setFontSizeScale(nextState.fontSizeScale || defaultAppState.fontSizeScale);
    setUiLanguage(nextState.uiLanguage);
    setCustomFontName(sanitizeFontName(typeof src.customFontName === "string" ? src.customFontName : ""));
    const importedCss = sanitizeCustomCss(typeof src.customCss === "string" ? src.customCss : "");
    setCustomCss(importedCss);
    setCustomCssDraft(importedCss);
    setCustomCssEnabled(!!src.customCssEnabled && !!importedCss.trim());
    try {
      if (importedCss) localStorage.setItem("mali_custom_css", importedCss);
      else localStorage.removeItem("mali_custom_css");
    } catch {}
    setHomeSlots(nextState.homeSlots);
    setDockOrder(nextState.dockOrder);
    applyLocalAppDataSnapshot(nextState.localAppData, { replace: true });
    await restoreFeatureBackup(src, {
      replace: true,
      reason: rollback ? "rollback" : "import",
    });
    setActiveLorebookId(nextState.lorebooks[0]?.id || null);
    setCurrentChatChar(null);
    setCurrentChatGroup(null);
    setChatBgEditor(null);
    setChatSettingsBackgroundOpen(false);
    setChatSettingsLorebookOpen(false);
    setChatroomManageOpen(false);
    setChatSettingsExpandedBooks({});
    await saveAppState(nextState);
  };

  return {
    persistenceSnapshot,
    getLocalAppDataSnapshot,
    applyLocalAppDataSnapshot,
    getExportableAppState,
    getRollbackAppState,
    validateImportedAppState,
    summarizeImportedData,
    applyImportedAppState,
  };
}
