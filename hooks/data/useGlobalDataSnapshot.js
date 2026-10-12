import { useRef, useState } from "react";
import { DOCK_APPS, VERSION } from "../../constants/appConstants";
import { HOME_SLOT_COUNT } from "../../utils/homeLayout";
import { normalizeUiLanguage } from "../../utils/i18n";
import { preserveMissingDeviceSecrets, stripDeviceSecrets } from "../../utils/deviceSecrets";
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
import { capturePersonaData, serializePersonas } from "../../services/persona/personaModel";
import {
  compactActivePersona,
  compactLegacyLocalData,
  packBackupMedia,
  restoreActivePersona,
  unpackBackupMedia,
} from "../../utils/backupMediaAssets";
import {
  createTextSyncDocument,
  preserveLocalMedia,
  stripTextSyncMedia,
  validateTextSyncDocument,
} from "../../utils/textSyncDocument";
import {
  SNAPSHOT_REASONS,
  getLocalSnapshot,
  isDailySnapshotDue,
  saveLocalSnapshot,
} from "../../services/backup/localSnapshotService";
import { recordRuntimeDiagnostic } from "../../services/diagnostics/runtimeDiagnostics";
import { mergeWalletSyncData } from "../../utils/walletSync";
import { summarizeBackupContent } from "../../utils/backupInspect";
import { mergeGameProgressSyncData } from "../../utils/gameProgressSync";
import { runDataRestoreTransaction } from "../../services/backup/dataRestoreTransaction";

export const LOCAL_APP_DATA_KEYS = [
  "maliphone-pet-home",
  "maliphone-pet-settings",
  "maliphone-pet-cooldown-until",
  "mali_yunyin_save_v1",
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
  const persistenceWriteGuard = useRef({ active: false, blocked: false, pending: null, epoch: 0 }).current;
  const [persistencePaused, setPersistencePaused] = useState(false);
  const [restoreRecovery, setRestoreRecovery] = useState(null);
  const {
    characters,
    activeCharId,
    chatHistory,
    chatRooms,
    activeRoomIds,
    chatModes,
    chatReplyTimings,
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
    customPrompts,
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
    setChatReplyTimings,
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
    chatReplyTimings,
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
    customPrompts,
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
    packMedia = true,
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

    const featureData = await loadFeatureBackup(exportCharacters, {
      compactImages: compactMedia,
      personaIds: Object.keys(personaController.personas || {}),
    });
    const rawLocalAppData = getLocalAppDataSnapshot({ includeMissing: includeMissingLocalData });
    // Rollback needs the exact local values, including duplicated legacy entries.
    const localAppData = includeMissingLocalData
      ? rawLocalAppData
      : compactLegacyLocalData(rawLocalAppData, featureData);
    const backupState = {
      characters: exportCharacters,
      activeCharId,
      chatHistory,
      chatRooms: exportChatRooms,
      activeRoomIds,
      chatModes,
      chatReplyTimings,
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
      customPrompts,
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
      personas: compactActivePersona(
        serializePersonas(
          personaController.personas,
          personaController.activePersonaId,
          captureCurrentPersona(),
        ),
        personaController.activePersonaId,
      ),
      activePersonaId: personaController.activePersonaId,
      localAppData,
      // The gallery has its own IndexedDB database and is deliberately local-only
      // until its product rules and media sync model are finalized.
      featureData,
    };
    // 快照只要文字，跳過替每張圖片算雜湊的打包步驟，直接回傳未打包的狀態。
    if (!packMedia) return { state: backupState };
    const packed = await packBackupMedia(backupState);
    return {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      format: "maliphone-app-state",
      formatVersion: 2,
      assets: packed.assets,
      state: packed.state,
    };
  };

  const getExportableAppState = () => getAppStateSnapshot();
  const getRollbackAppState = () => getAppStateSnapshot({
    includeSecrets: true,
    compactMedia: false,
    includeMissingLocalData: true,
  });

  // 本機快照：文字資料（去掉圖片，不含金鑰），還原時保留這台裝置現有的圖片。
  const takeLocalSnapshot = async (reason) => {
    const { state: rawState } = await getAppStateSnapshot({ packMedia: false });
    const state = stripTextSyncMedia(rawState);
    return saveLocalSnapshot({ reason, state, version: VERSION });
  };

  // 快照失敗不擋住玩家已確認的操作，但要留下診斷。
  const takeLocalSnapshotSafely = async (reason) => {
    try {
      return await takeLocalSnapshot(reason);
    } catch (error) {
      recordRuntimeDiagnostic({ kind: "local-snapshot", error, source: `localSnapshot:${reason}` });
      return null;
    }
  };

  const takeDailySnapshotIfDue = async () => {
    if (persistenceWriteGuard.active || persistenceWriteGuard.blocked) return null;
    try {
      if (!(await isDailySnapshotDue())) return null;
    } catch (error) {
      recordRuntimeDiagnostic({ kind: "local-snapshot", error, source: "localSnapshot:daily-check" });
      return null;
    }
    if (persistenceWriteGuard.active || persistenceWriteGuard.blocked) return null;
    return takeLocalSnapshotSafely(SNAPSHOT_REASONS.daily);
  };

  const runProtectedRestore = async (prepare, { source = "import" } = {}) => {
    if (persistenceWriteGuard.active || persistenceWriteGuard.blocked) {
      const error = new Error("Restore is already active or blocked");
      error.restoreStatus = persistenceWriteGuard.blocked ? "blocked" : "busy";
      throw error;
    }
    persistenceWriteGuard.active = true;
    persistenceWriteGuard.epoch += 1;
    setPersistencePaused(true);
    let localBackup;
    try {
      // Drain any save already in flight before capturing the rollback state.
      await persistenceWriteGuard.pending;
      localBackup = await getRollbackAppState();
      const appState = await prepare(localBackup);
      validateImportedAppState(appState);
      return await runDataRestoreTransaction({
        apply: () => applyAppState(appState),
        rollback: () => applyAppState(localBackup, { rollback: true }),
      });
    } catch (error) {
      if (error.restoreStatus === "rollback-failed") {
        persistenceWriteGuard.blocked = true;
        // Only the sanitized backup is exposed to the recovery export UI.
        setRestoreRecovery({ error, backup: { ...localBackup, state: stripDeviceSecrets(localBackup.state) } });
        recordRuntimeDiagnostic({ kind: "storage-restore", error: error.rollbackError, source: `restore:${source}:rollback` });
      }
      if (!error.restoreStatus) error.restoreStatus = "not-started";
      throw error;
    } finally {
      persistenceWriteGuard.active = false;
      if (!persistenceWriteGuard.blocked) setPersistencePaused(false);
    }
  };

  const restoreLocalSnapshot = (id) => runProtectedRestore(async (localBackup) => {
    const snapshot = await getLocalSnapshot(id);
    if (!snapshot?.state || typeof snapshot.state !== "object") {
      throw new Error(tr("找不到這份快照", "This snapshot could not be found", "このスナップショットが見つかりません", "이 스냅샷을 찾을 수 없습니다"));
    }
    return {
      format: "maliphone-app-state",
      formatVersion: 1,
      state: preserveLocalMedia(snapshot.state, unpackBackupMedia(localBackup.state, localBackup.assets)),
    };
  }, { source: "snapshot" });

  const getTextSyncDocument = async () => {
    const backup = await getAppStateSnapshot();
    const appState = unpackBackupMedia(backup.state, backup.assets);
    return createTextSyncDocument(appState, { version: VERSION });
  };

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
      && (!Number.isInteger(Number(incoming.formatVersion)) || Number(incoming.formatVersion) > 2)
    ) fail();
    const packedSrc = incoming?.state && incoming?.format === "maliphone-app-state"
      ? incoming.state
      : incoming;
    const src = Number(incoming?.formatVersion) >= 2
      ? unpackBackupMedia(packedSrc, incoming?.assets)
      : packedSrc;
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
      "chatReplyTimings",
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
      isRescue: incoming?.source === "maliphone-rescue",
      exportedAt: incoming?.exportedAt || null,
      // 摘要只看名字與時間，圖片仍是打包後的參照也不影響。
      content: summarizeBackupContent(src),
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

  // Private writer: only the protected transaction may apply or roll back data.
  const applyAppState = async (incoming, { rollback = false } = {}) => {
    const packedSrc = incoming?.state && incoming?.format === "maliphone-app-state"
      ? incoming.state
      : incoming;
    const src = Number(incoming?.formatVersion) >= 2
      ? unpackBackupMedia(packedSrc, incoming?.assets)
      : packedSrc;
    if (!src || typeof src !== "object") {
      throw new Error(tr(
        "檔案內容不正確",
        "Invalid file content",
        "ファイル内容が正しくありません",
        "파일 내용이 올바르지 않습니다",
      ));
    }
    // 任何覆蓋（匯入、雲端下載、雲端備份還原、快照還原）前，先替目前資料留一份快照。
    const safetySnapshot = !rollback ? await takeLocalSnapshotSafely(SNAPSHOT_REASONS.beforeOverwrite) : null;

    let nextState = {
      ...defaultAppState,
      characters: Array.isArray(src.characters) ? src.characters : [],
      activeCharId: src.activeCharId ?? null,
      chatHistory: src.chatHistory && typeof src.chatHistory === "object" ? src.chatHistory : {},
      chatRooms: src.chatRooms && typeof src.chatRooms === "object" ? src.chatRooms : {},
      activeRoomIds: src.activeRoomIds && typeof src.activeRoomIds === "object" ? src.activeRoomIds : {},
      chatModes: src.chatModes && typeof src.chatModes === "object" ? src.chatModes : {},
      chatReplyTimings: src.chatReplyTimings && typeof src.chatReplyTimings === "object" ? src.chatReplyTimings : {},
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
    nextState.personas = restoreActivePersona(
      nextState.personas,
      nextState.activePersonaId,
      capturePersonaData(nextState, defaultAppState),
    );

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
    return { snapshotCreated: Boolean(safetySnapshot) };
  };

  const applyImportedAppState = (incoming, options) => runProtectedRestore(() => incoming, options);

  const applyTextSyncDocument = (incoming) => runProtectedRestore((localBackup) => {
    const document = validateTextSyncDocument(incoming);
    // Keep media, feature stores, local-only data, and device secrets on this
    // device. The remote document only becomes authoritative for text state.
    const localState = unpackBackupMedia(localBackup.state, localBackup.assets);
    const mergedState = preserveLocalMedia(document.state, localState);
    // Merge shared progress explicitly. Media-related and unsupported feature
    // stores remain local to this device.
    const gameProgress = mergeGameProgressSyncData(localState.featureData || {}, document.state.featureData || {});
    mergedState.featureData = {
      ...(localState.featureData || {}),
      ...(document.state.featureData || {}),
      ...gameProgress,
    };
    const walletData = mergeWalletSyncData({
      wallet: localState.wallet,
      characterWallets: localState.characterWallets,
      transfers: localState.transfers,
    }, document.state.walletData);
    mergedState.wallet = walletData.wallet;
    mergedState.characterWallets = walletData.characterWallets;
    mergedState.transfers = walletData.transfers;
    mergedState.localAppData = localState.localAppData;
    mergedState.customCss = localState.customCss;
    mergedState.customCssEnabled = localState.customCssEnabled;
    mergedState.customFontName = localState.customFontName;
    const appState = {
      format: "maliphone-app-state",
      formatVersion: 1,
      state: mergedState,
    };
    return appState;
  }, { source: "text-sync" });

  return {
    persistenceSnapshot,
    persistenceWriteGuard,
    persistencePaused,
    restoreRecovery,
    getLocalAppDataSnapshot,
    applyLocalAppDataSnapshot,
    getExportableAppState,
    getRollbackAppState,
    getTextSyncDocument,
    validateImportedAppState,
    summarizeImportedData,
    applyImportedAppState,
    applyTextSyncDocument,
    takeLocalSnapshotSafely,
    takeDailySnapshotIfDue,
    restoreLocalSnapshot,
  };
}
