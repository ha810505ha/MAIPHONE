import React, { useState, useEffect, useRef } from "react";
import { VERSION, DEFAULT_APPS, DOCK_APPS, isLocalProvider } from "./constants/appConstants";
import { DATING_ENABLED } from "./config/featureFlags";
import { getChangelog } from "./constants/changelog";
import { createSocialFeedHelpers } from "./services/social/socialFeedHelpers";
import { useGacha } from "./contexts/GachaContext";
import useSocialFeed from "./hooks/social/useSocialFeed";
import { loadMailbox, MAILBOX_CHANGED_EVENT } from "./services/mailbox/mailboxService";
import useWalletController from "./hooks/wallet/useWalletController";
import { gid, ft, fd, sanitizeText, sanitizeUserImageUrl } from "./utils/coreUtils";
import { downloadJsonFile, downloadTextFile, exportToastMessage } from "./utils/exportFile";
import { UI_TEXT } from "./constants/uiText";
import { localizeFallbackText, translate } from "./utils/i18n";
import { callAI, isAiConfigReady } from "./services/aiService";
import { loadAppState, saveAppState, loadFeatureEntity } from "./utils/indexedDbStorage";
import { buildCalendarPromptContext, takeCalendarChatReminder } from "./services/calendar/calendarPromptContext";
import { addChatCalendarEvent, updateCalendarEvent } from "./services/calendar/calendarEventStore";
import { FEATURE_DATA_CHANGED_EVENT, featureDataEventIncludes } from "./services/featureDataLifecycle";
import { syncOnBoot, schedulePush } from "./services/syncService";
import { createDefaultVoiceSettings, normalizeCharacterVoiceSettings } from "./utils/voiceSettings";
import { sanitizeCustomCss } from "./utils/customCss";
import { sanitizeFontName } from "./utils/fontName";
import { PSEUDO_VOICE_TEXT_LIMIT } from "./utils/pseudoVoice";
import { compactActiveRoomMirrors, compactCharacterImages, compactGroupMessageImages, compactSocialPostImages } from "./utils/persistedMediaCleanup";
import "./styles/maliPhone.css";
import useAppearanceSettings from "./hooks/settings/useAppearanceSettings";
import useDocumentLocale from "./hooks/settings/useDocumentLocale";
import useThemeRuntime from "./hooks/settings/useThemeRuntime";
import useDirectChatAI from "./hooks/chat/useDirectChatAI";
import useChatSettingsController from "./hooks/chat/useChatSettingsController";
import useChatMessageActions from "./hooks/chat/useChatMessageActions";
import useProactiveChatController from "./hooks/chat/useProactiveChatController";
import useChatViewController from "./hooks/chat/useChatViewController";
import useDirectChatGenerationController from "./hooks/chat/useDirectChatGenerationController";
import useChatVoiceController from "./hooks/chat/useChatVoiceController";
import useChatImageController from "./hooks/chat/useChatImageController";
import useCharacterBlockController from "./hooks/chat/useCharacterBlockController";
import useCharacterBlockReaction from "./hooks/chat/useCharacterBlockReaction";
import useCharacterChatRooms from "./hooks/chat/useCharacterChatRooms";
import useGroupChatGenerationController from "./hooks/chat/useGroupChatGenerationController";
import useGroupChatController from "./hooks/chat/useGroupChatController";
import useChatRenderController from "./hooks/chat/useChatRenderController";
import useInnerThought from "./hooks/chat/useInnerThought";
import usePhoneDataGeneration from "./hooks/phone/usePhoneDataGeneration";
import usePlayerProfileController from "./hooks/player/usePlayerProfileController";
import usePersonaController from "./hooks/player/usePersonaController";
import { capturePersonaData, serializePersonas } from "./services/persona/personaModel";
import useCharacterInsights from "./hooks/characters/useCharacterInsights";
import useHomeDragAndDrop from "./hooks/home/useHomeDragAndDrop";
import useHomeCustomization from "./hooks/home/useHomeCustomization";
import { HOME_PAGE_SIZE, HOME_SLOT_COUNT, normalizeHomeSlots } from "./utils/homeLayout";
import { normalizeCharacterBlockStates } from "./services/chat/characterBlockState";
import { MEMORY_RECALL_TUNING, normalizeMemoryWeight, splitArchivedMemories } from "./services/chat/memoryRecall";
import useAppPersistence from "./hooks/data/useAppPersistence";
import useGlobalDataSnapshot from "./hooks/data/useGlobalDataSnapshot";
import useAppHydrationController from "./hooks/data/useAppHydrationController";
import useAppReset from "./hooks/data/useAppReset";
import useDataImportExport from "./hooks/data/useDataImportExport";
import useChatroomImportExport from "./hooks/data/useChatroomImportExport";
import { SceneBar } from "./components/chat/ChatMessageParts";
import {
  MaliPhoneContactsSurface,
  MaliPhoneDatingSurface,
  MaliPhoneLorebookSurface,
  MaliPhonePlayerSurface,
  MaliPhoneSocialSurface,
  MaliPhoneStatusSurface,
} from "./components/apps/MaliPhoneFeatureSurfaces";
import { MaliPhonePhoneSurface, MaliPhoneWalletSurface } from "./components/apps/MaliPhoneUtilitySurfaces";
import MaliPhoneSettingsSurface from "./components/settings/MaliPhoneSettingsSurface";
import MaliPhoneShell from "./components/shell/MaliPhoneShell";
import MaliPhoneOverlays from "./components/shell/MaliPhoneOverlays";
import usePhoneNavigation from "./hooks/navigation/usePhoneNavigation";
import useNotificationCenter from "./hooks/notifications/useNotificationCenter";
import { subscribeSystemNotificationClicks } from "./services/notifications/systemNotifications";
import useTransientItem from "./hooks/useTransientItem";
import useDatingApp from "./hooks/dating/useDatingApp";
import useAuthSession from "./hooks/auth/useAuthSession";
import { setMaliTestRuntime } from "./services/cloud/maliTestRuntime.js";
import { promoteDatingContact } from "./services/dating/datingMatchApply";
import { DATING_PROFILES } from "./data/dating/profiles";
import { DEFAULT_APP_STATE } from "./constants/defaultAppState";
import {
  preloadFeatureForApp,
  scheduleIdleFeaturePreload,
} from "./utils/featurePreload";
import {
  ONLINE_CHAT_TEXT_LIMIT,
  displayWalletText as formatWalletDisplayText,
  estimateTokens,
  getChatTextLimit,
  getMessageMode,
  isGemmaModel,
  parseShareEventNotice,
  stripInternalBlocks,
  stripModeLabel,
  stripUserPlaceholder as replaceUserPlaceholder,
} from "./utils/chatMessageUtils";
import {
  sortChatThreads as sortChatThreadsByActivity,
} from "./utils/chatSorting";
import { sortDisplayCharacters } from "./utils/characterSorting";

// 世界書 AUTO 條目的召回參數。IDF 正規化後 1 分＝在最近訊息命中一個專屬於該條目的詞，
// 門檻略低於 1 是留給浮點誤差與「稍微常見的詞剛好出現在最新一則」的餘裕。
const SOCIAL_POST_LIMIT = 100;

// 立繪位移：object-position 滑動 cover 的溢出裁切窗口（到邊自動停），
// translate 只用縮放產生的溢出空間（上限 (zoom-1)*50%），兩者相加永遠不會露出背景缺口
export default function MaliPhone() {
  useEffect(() => scheduleIdleFeaturePreload(), []);
  const defaultAppState = DEFAULT_APP_STATE;
  const authSession = useAuthSession();
  useEffect(() => {
    setMaliTestRuntime({ session: authSession.session });
    return () => setMaliTestRuntime({ session: null });
  }, [authSession.session]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  useEffect(() => {
    let active = true;
    loadFeatureEntity("ent_calendar", null)
      .then((saved) => { if (active) setCalendarEvents(Array.isArray(saved?.events) ? saved.events : []); })
      .catch(() => {});
    const onCalendarUpdated = (event) => {
      const next = event?.detail;
      if (Array.isArray(next?.events)) setCalendarEvents(next.events);
      else loadFeatureEntity("ent_calendar", null)
        .then((saved) => setCalendarEvents(Array.isArray(saved?.events) ? saved.events : []))
        .catch(() => {});
    };
    window.addEventListener("calendar-storage-updated", onCalendarUpdated);
    const onFeatureDataChanged = (event) => {
      if (featureDataEventIncludes(event, "ent_calendar")) onCalendarUpdated(event);
    };
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    return () => {
      active = false;
      window.removeEventListener("calendar-storage-updated", onCalendarUpdated);
      window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    };
  }, []);
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const { item: toast, show: showToast } = useTransientItem({ holdMs: 2000, exitMs: 120 });
  const [characters, setCharacters] = useState(defaultAppState.characters);
  const [activeCharId, setActiveCharId] = useState(defaultAppState.activeCharId);
  const [chatHistory, setChatHistory] = useState(defaultAppState.chatHistory);
  const [groupChats, setGroupChats] = useState(defaultAppState.groupChats);
  const [chatScenes, setChatScenes] = useState(defaultAppState.chatScenes);
  const [groupScenes, setGroupScenes] = useState(defaultAppState.groupScenes);
  // 思想（思考鏈）顯示總開關：全域顯示偏好，用 localStorage 記住，預設開啟。
  const [showThinking, setShowThinking] = useState(() => {
    try { return localStorage.getItem("mali_show_thinking") !== "0"; } catch { return true; }
  });
  const toggleShowThinking = () => setShowThinking((value) => {
    const next = !value;
    try { localStorage.setItem("mali_show_thinking", next ? "1" : "0"); } catch {}
    return next;
  });
  const [chatInput, setChatInput] = useState("");
  const [chatImage, setChatImage] = useState(null);
  const [chatPseudoImage, setChatPseudoImage] = useState(null);
  const [chatPseudoVoiceMode, setChatPseudoVoiceMode] = useState(false);
  const [memoryCard, setMemoryCard] = useState(null);
  // 記住每個角色上次生成記憶時的最後一則訊息 id：用來在「沒有新對話又生成」時給軟提示（不擋）。
  const [lastMemGenMsgId, setLastMemGenMsgId] = useState({});
  const [chatActionPanelOpen, setChatActionPanelOpen] = useState(false);
  const [chatListTab, setChatListTab] = useState("friends");
  const [sceneEditor, setSceneEditor] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatChar, setCurrentChatChar] = useState(null);
  const [currentChatGroup, setCurrentChatGroup] = useState(null);
  const [calendarTick, setCalendarTick] = useState(Date.now());
  useEffect(() => setChatPseudoVoiceMode(false), [currentChatChar?.id]);
  useEffect(() => {
    if (currentApp !== "chat" || !currentChatChar?.id) return undefined;
    setCalendarTick(Date.now());
    const timer = setInterval(() => setCalendarTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [currentApp, currentChatChar?.id]);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [messageEditor, setMessageEditor] = useState(null);
  const [posts, setPosts] = useState(defaultAppState.posts);
  const [mailboxMails, setMailboxMails] = useState([]);
  const [socialSettings, setSocialSettings] = useState(defaultAppState.socialSettings);
  const [socialSettingsOpen, setSocialSettingsOpen] = useState(false);
  const [activePostMenuId, setActivePostMenuId] = useState(null);
  const [pendingPostScrollId, setPendingPostScrollId] = useState(null);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const socialFeedRef = useRef(null);
  const [postCommentInputs, setPostCommentInputs] = useState({});
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [activeLikePostId, setActiveLikePostId] = useState(null);
  const [socialReplyTarget, setSocialReplyTarget] = useState(null);
  const [expandedSocialPosts, setExpandedSocialPosts] = useState({});
  const [socialTick, setSocialTick] = useState(Date.now());
  const [playerPostModalOpen, setPlayerPostModalOpen] = useState(false);
  const [playerPostText, setPlayerPostText] = useState("");
  const [playerPostSubmitting, setPlayerPostSubmitting] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const SHARE_RAW_TOKEN_LIMIT = 1000;
  const PLAYER_SOCIAL_POST_LIMIT = 500;
  const CHARACTER_WALLET_TX_LIMIT = 15;
  const TOTAL_CONTEXT_TOKEN_LIMIT = 40000;
  const [memories, setMemories] = useState(defaultAppState.memories);
  const [lorebooks, setLorebooks] = useState(defaultAppState.lorebooks);
  const lorebookImportInputRef = useRef(null);
  const [phoneInboxCache, setPhoneInboxCache] = useState(defaultAppState.phoneInboxCache);
  const [phonePlayerContactLoading, setPhonePlayerContactLoading] = useState(false);
  const [phoneAppCache, setPhoneAppCache] = useState(defaultAppState.phoneAppCache);
  const [phoneAppGenLoading, setPhoneAppGenLoading] = useState(null); // 正在生成的 appId 或 null
  const [diaryPage, setDiaryPage] = useState(0); // 日記目前頁碼；換角色或離開日記時 reset 0
  const [wallet, setWallet] = useState(defaultAppState.wallet);
  const [characterWallets, setCharacterWallets] = useState(defaultAppState.characterWallets);
  const [transfers, setTransfers] = useState(defaultAppState.transfers);
  const [walletGenLoading, setWalletGenLoading] = useState(false);
  const [apiPresets, setApiPresets] = useState(defaultAppState.apiPresets);
  const { themeName, setThemeName, fontName, setFontName, fontSizeScale, setFontSizeScale, customFontName, setCustomFontName, uiLanguage, setUiLanguage, themeEffectsEnabled, setThemeEffectsEnabled, customCssEnabled, setCustomCssEnabled, customCss, setCustomCss, customCssDraft, setCustomCssDraft, customCssNotice, setCustomCssNotice, customCssGuideOpen, setCustomCssGuideOpen, settingsAppearanceOpen, setSettingsAppearanceOpen, scopedCustomCss } = useAppearanceSettings(defaultAppState);
  useDocumentLocale(uiLanguage);
  const [screenLockTimeout, setScreenLockTimeout] = useState(defaultAppState.screenLockTimeout);
  const [customPrompts, setCustomPrompts] = useState(defaultAppState.customPrompts);
  const [phoneViewCharId, setPhoneViewCharId] = useState(null);
  const [phonePage, setPhonePage] = useState("picker");
  const [phoneActiveThreadId, setPhoneActiveThreadId] = useState("player");
  const [phoneGenLoading, setPhoneGenLoading] = useState(false);
  const [activeMemoryId, setActiveMemoryId] = useState(null);
  const [apiConfig, setApiConfig] = useState(defaultAppState.apiConfig);
  const [ttsConfig, setTtsConfig] = useState(defaultAppState.ttsConfig);
  const [modelBadgeOpen, setModelBadgeOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [addCharacterModalSession, setAddCharacterModalSession] = useState(0);
  const [updateNoticeOpen, setUpdateNoticeOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [statusExpandedCharId, setStatusExpandedCharId] = useState(null);
  const [statusMemoryExpandedCharId, setStatusMemoryExpandedCharId] = useState(null);
  const [statusMemoryPages, setStatusMemoryPages] = useState({});
  const [statusRefreshingIds, setStatusRefreshingIds] = useState({});
  const [settingsTab, setSettingsTab] = useState("appearance");
  useEffect(() => {
    if (!authSession.isPasswordRecovery) return;
    setCurrentApp("settings");
    setSettingsTab("data");
  }, [authSession.isPasswordRecovery]);
  const [editingLorebookEntry, setEditingLorebookEntry] = useState(null);
  const [editingLorebookBook, setEditingLorebookBook] = useState(null);
  const [pendingLorebookExport, setPendingLorebookExport] = useState(null);
  const [activeLorebookId, setActiveLorebookId] = useState(null);
  const [viewingLorebookEntry, setViewingLorebookEntry] = useState(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [chatScreenshotOpen, setChatScreenshotOpen] = useState(false);
  const [chatScreenshotSelection, setChatScreenshotSelection] = useState({ active: false, startId: null, endId: null, selectedIds: [] });
  const [chatVisibleCounts, setChatVisibleCounts] = useState({});
  const [genLoading, setGenLoading] = useState(false);
  const [gamePage, setGamePage] = useState("hub");
  const [homePage, setHomePage] = useState(1);
  const [homeSlots, setHomeSlots] = useState(Array.from({ length: HOME_SLOT_COUNT }, () => null));
  const [dockOrder, setDockOrder] = useState(DOCK_APPS);
  const [isDraggingApp, setIsDraggingApp] = useState(false);
  const [pointerDrag, setPointerDrag] = useState(null);
  const socialLastGlobalPostAtRef = useRef(0);
  const socialLastPostByCharRef = useRef({});
  const socialAutoPostingRef = useRef(false);
  const socialAutoPostGapRef = useRef(0);
  const walletAutoRefreshBusyRef = useRef(false);
  const proactiveSweepingRef = useRef(false);
  const currentChatCharIdRef = useRef(null);
  const SOCIAL_GLOBAL_COOLDOWN_MS = 60 * 1000;
  const SOCIAL_CHAR_COOLDOWN_MS = 3 * 60 * 1000;
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const noticeLongPressTimerRef = useRef(null);
  const swipeStartXRef = useRef(null);
  const swipeStartYRef = useRef(null);
  const autoLockTimerRef = useRef(null);
  const edgeTurnTimerRef = useRef(null);
  const edgeTurnDirRef = useRef(null);
  const serviceWorkerReloadingRef = useRef(false);
  const serviceWorkerHadControllerRef = useRef(false);
  const chatMsgsRef = useRef(null);
  const chatLoadAdjustRef = useRef(null);
  const chatScrollPositionsRef = useRef({});
  const thoughtJumpInProgressRef = useRef(false);
  const t = (key) => UI_TEXT[uiLanguage]?.[key] || UI_TEXT["zh-TW"]?.[key] || key;
  const tr = (...translations) => translate(uiLanguage, ...translations);
  const notify = (keyOrText, fallback) => {
    const message = UI_TEXT[uiLanguage]?.[keyOrText]
      || localizeFallbackText(uiLanguage, fallback || keyOrText);
    showToast(message);
  };
  const {
    applyPlayerAvatarCrop,
    handlePlayerAvatarUpload,
    onPlayerAvatarPointerDown,
    onPlayerAvatarPointerMove,
    onPlayerAvatarPointerUp,
    playerAvatarCrop,
    playerAvatarRef,
    playerProfile,
    setPlayerAvatarCrop,
    setPlayerProfile,
  } = usePlayerProfileController({
    initialProfile: defaultAppState.playerProfile,
    notify,
    sanitizeImage: sanitizeUserImageUrl,
    tr,
  });
  const getUiLanguageLabel = () => ({
    "zh-TW": "繁體中文",
    "zh-CN": "简体中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
  }[uiLanguage] || uiLanguage);
  const getOutputLanguageDirective = ({ includePlayerContext = true } = {}) => {
    const languageLabel = getUiLanguageLabel();
    const playerGender = sanitizeText(playerProfile?.gender || "", 80).trim();
    const taiwaneseChineseDirective = uiLanguage === "zh-TW"
      ? "\n若輸出語言為繁體中文，必須使用臺灣繁體中文與臺灣慣用詞彙。"
      : uiLanguage === "zh-CN"
        ? "\n若输出语言为简体中文，必须使用中国大陆简体中文与常用词汇。"
      : "";
    const playerGenderDirective = playerGender
      ? `\n玩家填寫的性別／組成：${playerGender}。稱謂與單複數必須依此判斷。`
      : "\n玩家未填寫性別／組成；不得自行推測性別，且 {{user}} 預設為單一人物。";
    return `UI language: ${languageLabel}\n請使用${languageLabel}回覆。${taiwaneseChineseDirective}${includePlayerContext ? playerGenderDirective : ""}`;
  };
  const ask = (keyOrText, fallback) => window.confirm(
    UI_TEXT[uiLanguage]?.[keyOrText] || localizeFallbackText(uiLanguage, fallback || keyOrText),
  );
  const askInput = (keyOrText, defaultValue = "", fallback) => prompt(
    UI_TEXT[uiLanguage]?.[keyOrText] || localizeFallbackText(uiLanguage, fallback || keyOrText),
    defaultValue,
  );
  const { handleImgUp } = useChatImageController({
    setChatImage,
    sanitizeImageUrl: sanitizeUserImageUrl,
    showToast,
    tr,
  });
  const {
    chatRooms, activeRoomIds, loadRoomState,
    activateRoom: activateCharacterRoom,
    createRoom: createCharacterRoom,
    createBranch: createCharacterBranch,
    renameRoom: renameCharacterRoom,
    deleteRoom: deleteCharacterRoom,
    clearRoom: clearCharacterRoom,
    archiveRoom: archiveCharacterRoom,
    restoreRoom: restoreCharacterRoom,
    moveRoom: moveCharacterRoom,
    addCharacterRoom, removeCharacterRooms, clearRooms,
    updateRoomMessages: updateCharacterRoomMessages,
    updateActiveRoomMetadata: updateCharacterRoomMetadata,
  } = useCharacterChatRooms({
    characters, setCharacters, chatHistory, setChatHistory, memories, setMemories,
    chatScenes, setChatScenes,
    currentChatChar, setCurrentChatChar, setChatInput, setChatImage, setActiveMessageId,
    setMessageEditor, setIsTyping, setChatVisibleCounts, createId: gid, sanitizeText, tr,
  });
  const {
    characterBlockStates,
    pendingBlockReaction,
    setCharacterBlocked,
    setCharacterBlocksPlayer,
    setCharacterBlockStates,
    setPendingBlockReaction,
  } = useCharacterBlockController({
    initialBlockStates: defaultAppState.characterBlockStates,
    characters,
    activeRoomIds,
    currentChatCharIdRef,
    setChatHistory,
    setChatInput,
    createId: gid,
    showToast,
  });
  const { specialMemories: gachaSpecialMemories, compactEpisodeImages } = useGacha();
  const chatSettings = useChatSettingsController({
    defaultAppState,
    characters,
    chatHistory,
    chatScenes,
    chatRooms,
    activeRoomIds,
    lorebooks,
    memories,
    gachaSpecialMemories,
    transfers,
    chatMsgsRef,
    createId: gid,
    setChatHistory,
    setChatInput,
    setMemories,
    getOutputLanguageDirective,
    tr,
    sanitizeText,
    sanitizeImageUrl: sanitizeUserImageUrl,
    showToast,
  });
  const {
    chatModes, setChatModes,
    chatBackgrounds, setChatBackgrounds,
    chatBgEditor, setChatBgEditor,
    chatTimeSettings, setChatTimeSettings,
    innerThoughtSettings, setInnerThoughtSettings,
    proactiveSettings, setProactiveSettings,
    proactiveUnread, setProactiveUnread,
    expandedInnerThoughts, setExpandedInnerThoughts,
    innerThoughtLoading, setInnerThoughtLoading,
    memoryEditor, setMemoryEditor,
    chatLorebookBindings, setChatLorebookBindings,
    chatSettingsOpen, setChatSettingsOpen,
    chatSettingsExpandedBooks, setChatSettingsExpandedBooks,
    chatSettingsBackgroundOpen, setChatSettingsBackgroundOpen,
    chatSettingsLorebookOpen, setChatSettingsLorebookOpen,
    chatSettingsThoughtsOpen, setChatSettingsThoughtsOpen,
    thoughtHistoryPage, setThoughtHistoryPage,
    pendingThoughtScrollId, setPendingThoughtScrollId,
    highlightedThoughtMessageId, setHighlightedThoughtMessageId,
    chatroomManageOpen, setChatroomManageOpen,
    getModeLabel,
    getLastCommittedChatMode,
    getSelectedChatMode,
    setSelectedChatMode,
    isInnerThoughtAutoEnabled,
    setInnerThoughtAutoEnabled,
    isChatRealTimeEnabled,
    setChatRealTimeEnabled,
    isGroupRealTimeEnabled,
    isProactiveEnabled,
    getProactiveFrequency,
    setProactiveEnabled,
    setProactiveFrequency,
    saveEditedMemory,
    openChatSettings,
    closeChatSettings,
    getDirectSettings,
  } = chatSettings;
  const {
    buildChatSystemPrompt,
    buildModePrompt,
    tokenizeForRecall,
    normalizeForMatch,
    pickMemoriesForPrompt,
    pickLorebookEntriesForPrompt,
    formatMessagesForPrompt,
  } = chatSettings.prompt;
  const {
    normalizeChatBackground,
    getChatBackgroundLayerStyle,
    getChatBackgroundBlurFilter,
    updateChatBackground,
    onChatBackgroundFile,
  } = chatSettings.background;
  const { importRef: chatroomImportRef, preview: chatroomImportPreview, importing: chatroomImporting, deleteChatroom: deleteChatroomForCharacter, exportChatroom: exportChatroomForCharacter, openImport: openChatroomImport, importFile: importChatroomFile, confirmImport: confirmChatroomImportPreview, cancelImport: cancelChatroomImport } = useChatroomImportExport({
    currentCharacter: currentChatChar, characters, chatHistory, chatModes, chatBackgrounds, chatLorebookBindings, innerThoughtSettings, chatTimeSettings,
    setChatHistory, setChatModes, setChatBackgrounds, setChatLorebookBindings, setInnerThoughtSettings, setChatTimeSettings,
    setCharacters, setMemories, setChatScenes, setProactiveUnread, removeCharacterRooms,
    onChatroomDeleted: () => { setChatSettingsOpen(false); setCurrentChatChar(null); },
    resetOpenChat: () => { setChatActionPanelOpen(false); setMessageEditor(null); setActiveMessageId(null); setIsTyping(false); setChatInput(""); },
    normalizeBackground: normalizeChatBackground, downloadJsonFile, showToast, sanitizeText, tr,
  });

  const captureCurrentPersona = () => capturePersonaData({
    activeCharId, chatHistory, chatRooms, activeRoomIds, chatModes, chatBackgrounds,
    groupChats, chatScenes, groupScenes, chatTimeSettings, innerThoughtSettings,
    proactiveSettings, proactiveUnread, posts, socialSettings, memories,
    chatLorebookBindings, phoneInboxCache, phoneAppCache, wallet, characterWallets,
    transfers, characterBlockStates, playerProfile,
    characterChatMeta: Object.fromEntries(characters.map((character) => [character.id, {
      pinned: !!character.pinned,
      chatOpenedAt: Number(character.chatOpenedAt) || 0,
      chatroomDeleted: !!character.chatroomDeleted,
      chatroomDeletedAt: Number(character.chatroomDeletedAt) || 0,
    }])),
  }, defaultAppState);

  const applyPersonaData = (data = {}, options = {}) => {
    const characterChatMeta = data.characterChatMeta || {};
    const personaCharacters = characters.map((character) => {
      const meta = characterChatMeta[character.id] || {};
      return {
        ...character,
        statusText: "",
        statusUpdatedAt: 0,
        pinned: !!meta.pinned,
        chatOpenedAt: Number(meta.chatOpenedAt) || 0,
        chatroomDeleted: !!meta.chatroomDeleted,
        chatroomDeletedAt: Number(meta.chatroomDeletedAt) || 0,
      };
    });
    const roomState = loadRoomState(data, personaCharacters);
    setCharacters(roomState.characters);
    setActiveCharId(data.activeCharId ?? null);
    setChatHistory(roomState.chatHistory);
    setChatModes(data.chatModes || {});
    setChatBackgrounds(data.chatBackgrounds || {});
    setGroupChats(Array.isArray(data.groupChats) ? data.groupChats : []);
    setChatScenes(roomState.chatScenes);
    setGroupScenes(data.groupScenes || {});
    setChatTimeSettings(data.chatTimeSettings || {});
    setInnerThoughtSettings(data.innerThoughtSettings || {});
    setProactiveSettings(data.proactiveSettings || {});
    setProactiveUnread(data.proactiveUnread || {});
    setPosts(Array.isArray(data.posts) ? data.posts : []);
    setSocialSettings({
      ...defaultAppState.socialSettings,
      ...(data.socialSettings && typeof data.socialSettings === "object" ? data.socialSettings : {}),
    });
    setMemories(roomState.memories);
    setChatLorebookBindings(data.chatLorebookBindings || {});
    setPhoneInboxCache(data.phoneInboxCache || {});
    setPhoneAppCache(data.phoneAppCache || {});
    setWallet(data.wallet || defaultAppState.wallet);
    setCharacterWallets(data.characterWallets || {});
    setTransfers(Array.isArray(data.transfers) ? data.transfers : []);
    setCharacterBlockStates(normalizeCharacterBlockStates(data.characterBlockStates));
    setPlayerProfile(data.playerProfile || defaultAppState.playerProfile);
    const keptChar = options.keepChatCharId
      ? roomState.characters.find((character) => character.id === options.keepChatCharId && !character.chatroomDeleted)
      : null;
    const keptGroup = options.keepChatGroupId && !keptChar
      ? (Array.isArray(data.groupChats) ? data.groupChats : []).find((group) => group.id === options.keepChatGroupId)
      : null;
    setCurrentChatChar(keptChar || null);
    setCurrentChatGroup(keptGroup || null);
    setChatInput("");
    setChatImage(null);
    setIsTyping(false);
  };

  const personaController = usePersonaController({
    defaults: defaultAppState,
    onApplyPersona: applyPersonaData,
    onBeforeSwitch: async () => {
      if (isTyping || phoneGenLoading || phoneAppGenLoading || walletGenLoading) {
        throw new Error("請等待目前的生成完成後再切換玩家人格");
      }
    },
  });

  const dating = useDatingApp({ apiConfig, playerName: playerProfile?.name, onError: (message) => showToast(message) });
  const notificationCenter = useNotificationCenter({
    characters, chatHistory, proactiveUnread, locked, currentApp,
    datingState: dating.state, datingProfiles: DATING_PROFILES,
    posts, socialNow: socialTick, mailboxMails,
  });
  const { applyLoadedAppState } = useAppHydrationController({
    defaultAppState,
    personaController,
    loadRoomState,
    notificationCenter,
    createId: gid,
    setters: {
      setCharacters,
      setActiveCharId,
      setChatHistory,
      setChatModes,
      setChatBackgrounds,
      setGroupChats,
      setChatScenes,
      setGroupScenes,
      setChatTimeSettings,
      setInnerThoughtSettings,
      setProactiveSettings,
      setProactiveUnread,
      setPosts,
      setSocialSettings,
      setMemories,
      setPhoneInboxCache,
      setPhoneAppCache,
      setWallet,
      setCharacterWallets,
      setTransfers,
      setCharacterBlockStates,
      setScreenLockTimeout,
      setCustomPrompts,
      setApiPresets,
      setPlayerProfile,
      setChatLorebookBindings,
      setLorebooks,
      setActiveLorebookId,
      setApiConfig,
      setTtsConfig,
      setThemeName,
      setFontName,
      setFontSizeScale,
      setUiLanguage,
      setDockOrder,
      setHomeSlots,
      setCurrentChatChar,
      setCurrentChatGroup,
      setChatInput,
      setChatImage,
      setIsTyping,
    },
  });
  const dataController = useGlobalDataSnapshot({
    defaultAppState,
    state: {
      characters, activeCharId, chatHistory, chatRooms, activeRoomIds, chatModes,
      chatBackgrounds, groupChats, chatScenes, groupScenes, chatTimeSettings,
      innerThoughtSettings, proactiveSettings, proactiveUnread, posts, socialSettings,
      memories, lorebooks, chatLorebookBindings, phoneInboxCache, phoneAppCache, wallet,
      characterWallets, transfers, characterBlockStates, screenLockTimeout, customPrompts, apiPresets,
      playerProfile, apiConfig, ttsConfig, themeName, fontName, fontSizeScale, uiLanguage,
      customFontName, customCss, customCssEnabled, homeSlots, dockOrder,
      notificationCenter, personaController, captureCurrentPersona,
    },
    setters: {
      setChatModes, setChatBackgrounds, setGroupChats, setGroupScenes,
      setChatTimeSettings, setInnerThoughtSettings, setProactiveSettings,
      setProactiveUnread, setPosts, setSocialSettings, setLorebooks,
      setChatLorebookBindings, setPhoneInboxCache, setPhoneAppCache, setWallet,
      setCharacterWallets, setTransfers, setCharacterBlockStates, setScreenLockTimeout,
      setApiPresets, setPlayerProfile, setApiConfig, setTtsConfig, setThemeName,
      setFontName, setFontSizeScale, setUiLanguage, setCustomFontName, setCustomCss,
      setCustomCssDraft, setCustomCssEnabled, setHomeSlots, setDockOrder,
      setActiveLorebookId, setCurrentChatChar, setCurrentChatGroup, setChatBgEditor,
      setChatSettingsBackgroundOpen, setChatSettingsLorebookOpen, setChatroomManageOpen,
      setChatSettingsExpandedBooks,
    },
    applyLoadedAppState,
    tr,
    sanitizeText,
  });
  const { hydrated } = useAppPersistence({
    defaults: defaultAppState,
    snapshot: dataController.persistenceSnapshot,
    loadState: loadAppState,
    saveState: saveAppState,
    syncOnBoot,
    schedulePush,
    onLoad: applyLoadedAppState,
  });
  const {
    updateScrollToBottomVisibility,
    scrollCurrentChatToBottom,
    getCurrentChatScrollKey,
    rememberCurrentChatScroll,
    jumpToThoughtMessage,
    loadEarlierMessages,
    handleDirectChatScroll,
  } = useChatViewController({
    currentChatChar,
    currentChatGroup,
    activeRoomIds,
    chatHistory,
    groupChats,
    chatSettingsOpen,
    pendingThoughtScrollId,
    chatVisibleCounts,
    isTyping,
    chatMsgsRef,
    messagesEndRef,
    chatLoadAdjustRef,
    chatScrollPositionsRef,
    thoughtJumpInProgressRef,
    setExpandedInnerThoughts,
    setHighlightedThoughtMessageId,
    setPendingThoughtScrollId,
    setShowScrollToBottom,
    setChatVisibleCounts,
    setChatSettingsOpen,
  });
  useEffect(() => {
    if (!hydrated) return undefined;
    let active = true;
    const refreshMailbox = () => {
      loadMailbox()
        .then((result) => { if (active) setMailboxMails(result.mails); })
        .catch(() => {});
    };
    refreshMailbox();
    window.addEventListener(MAILBOX_CHANGED_EVENT, refreshMailbox);
    const onFeatureDataChanged = (event) => {
      if (featureDataEventIncludes(event, "ent_systemMailbox")) refreshMailbox();
    };
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    return () => {
      active = false;
      window.removeEventListener(MAILBOX_CHANGED_EVENT, refreshMailbox);
      window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    };
  }, [hydrated]);
  useEffect(() => {
    if (!hydrated || ttsConfig.provider !== "minimax") return;
    setTtsConfig((current) => ({ ...current, provider: "elevenlabs" }));
  }, [hydrated, ttsConfig.provider]);
  useEffect(() => {
    if (!currentChatGroup?.id) return;
    const latest = groupChats.find((g) => g.id === currentChatGroup.id);
    if (!latest) return;
    if (latest === currentChatGroup) return;
    setCurrentChatGroup(latest);
  }, [groupChats, currentChatGroup?.id]);
  useEffect(() => {
    if (locked) return;
    const timeoutMs = screenLockTimeout === 0 ? null : Math.max(1, Number(screenLockTimeout) || 0) * 60 * 1000;
    if (!timeoutMs) return;
    const schedule = () => {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = setTimeout(() => {
        setLocked(true);
        setUnlocking(false);
      }, timeoutMs);
    };
    schedule();
    const events = ["pointerdown", "mousedown", "touchstart", "keydown", "scroll"];
    const onActivity = () => schedule();
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    return () => {
      clearTimeout(autoLockTimerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [locked, screenLockTimeout]);
  useEffect(() => {
    if (!hydrated) return undefined;
    const hasPendingSocialActivity = (at) => (posts || []).some((post) => (
      (post.likedBy || []).some((reaction) => (reaction.time || 0) > at)
      || (post.comments || []).some((comment) => (comment.time || 0) > at)
    ));
    const now = Date.now();
    setSocialTick(now);
    if (!hasPendingSocialActivity(now)) return undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      setSocialTick(now);
      if (!hasPendingSocialActivity(now)) clearInterval(timer);
    }, 15000);
    return () => clearInterval(timer);
  }, [hydrated, posts]);
  const getWalletTimeSlot = (ts) => {
    const h = new Date(ts || Date.now()).getHours();
    if (h >= 6 && h < 12) return "morning";
    if (h >= 12 && h < 18) return "afternoon";
    return "night";
  };
  const shouldAutoRefreshWallet = (cw) => {
    if (!cw?.summary) return false;
    const currentSlot = getWalletTimeSlot(Date.now());
    const lastSlot = cw.lastRefreshedSlot || getWalletTimeSlot(cw.refreshedAt || cw.generatedAt || Date.now());
    return currentSlot !== lastSlot;
  };
  useEffect(() => {
    if (!hydrated || phonePage !== "wallet") return;
    const selectedCharId = phoneViewCharId || null;
    const selectedChar = characters.find((c) => c.id === selectedCharId) || null;
    const phoneWallet = selectedChar ? characterWallets[selectedChar.id] : null;
    if (!selectedChar || !phoneWallet?.summary || walletAutoRefreshBusyRef.current) return;
    if (!shouldAutoRefreshWallet(phoneWallet)) return;
    walletAutoRefreshBusyRef.current = true;
    generateCharacterWallet(selectedChar, { mode: "refresh" })
      .finally(() => {
        walletAutoRefreshBusyRef.current = false;
      });
  }, [hydrated, phonePage, phoneViewCharId, characters, characterWallets]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      const seen = localStorage.getItem("mali_seen_version");
      if (seen !== VERSION) setUpdateNoticeOpen(true);
    } catch {}
  }, [hydrated]);
  useEffect(() => {
    if (!(typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PROD)) return;
    if (!("serviceWorker" in navigator)) return;
    const base = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";
    serviceWorkerHadControllerRef.current = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (!serviceWorkerHadControllerRef.current) {
        serviceWorkerHadControllerRef.current = true;
        return;
      }
      if (serviceWorkerReloadingRef.current) return;
      serviceWorkerReloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.register(`${base}sw.js`).then((reg) => {
      reg.update().catch(() => {});
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    }).catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    let changed = false;
    const normalized = {};
    Object.entries(memories || {}).forEach(([charId, arr]) => {
      const rebuilt = (arr || []).map((m) => {
        // 這裡是整個物件重建，新增欄位務必同步加入，否則會在下次啟動時被靜默清掉。
        const next = {
          id: m.id || gid(),
          text: sanitizeText(m.text, 500),
          date: m.date || Date.now(),
          pinned: !!m.pinned,
          weight: normalizeMemoryWeight(m.weight),
          archived: !!m.archived,
        };
        if (!m.id || typeof m.pinned === "undefined" || next.text !== m.text || next.weight !== m.weight || next.archived !== m.archived) changed = true;
        return next;
      });
      // 活躍與塵封各自計上限。若沿用單一 slice，書庫一長就會把記憶整批截斷。
      const { active, archived } = splitArchivedMemories(rebuilt);
      const keptActive = active.slice(0, MEMORY_RECALL_TUNING.activeLimit);
      const keptArchived = archived.slice(0, MEMORY_RECALL_TUNING.archiveLimit);
      if (keptActive.length !== active.length || keptArchived.length !== archived.length) changed = true;
      normalized[charId] = [...keptActive, ...keptArchived];
    });
    if (changed) setMemories(normalized);
  }, [hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    const compactedCharacters = compactCharacterImages(characters);
    const compactedGroups = compactGroupMessageImages(groupChats, compactedCharacters);
    const compactedPosts = compactSocialPostImages(posts, compactedCharacters);
    const bookmarkedCount = compactedPosts.filter((post) => post?.bookmarked).length;
    let unbookmarkedSlots = Math.max(0, SOCIAL_POST_LIMIT - bookmarkedCount);
    const limitedPosts = compactedPosts.length > SOCIAL_POST_LIMIT
      ? compactedPosts.filter((post) => post?.bookmarked || unbookmarkedSlots-- > 0)
      : compactedPosts;
    if (compactedCharacters !== characters) setCharacters(compactedCharacters);
    if (compactedGroups !== groupChats) setGroupChats(compactedGroups);
    if (limitedPosts !== posts) setPosts(limitedPosts);
  }, [hydrated, characters, groupChats, posts]);
  useEffect(() => {
    const forceEnd = () => {
      setPointerDrag(null);
      setIsDraggingApp(false);
      clearTimeout(edgeTurnTimerRef.current);
      edgeTurnTimerRef.current = null;
      edgeTurnDirRef.current = null;
    };
    window.addEventListener("pointerup", forceEnd);
    window.addEventListener("pointercancel", forceEnd);
    return () => {
      window.removeEventListener("pointerup", forceEnd);
      window.removeEventListener("pointercancel", forceEnd);
    };
  }, []);

  const {
    voices: ttsVoices,
    setVoices: setTtsVoices,
    connectionState: ttsConnectionState,
    setConnectionState: setTtsConnectionState,
    clearCache: clearVoicePlaybackCache,
    previewCharacterVoice,
    loadDefaultVoices: loadElevenLabsDefaultVoices,
    previewDefaultVoice: previewDefaultTtsVoice,
    renderCharacterVoiceAction,
    getCharacterVoiceBubblePlayback,
  } = useChatVoiceController({
    ttsConfig,
    setTtsConfig,
    chatHistory,
    setChatHistory,
    showToast,
    sanitizeText,
    tr,
  });
  const currentChangelogRaw = getChangelog(VERSION, uiLanguage);
  const currentChangelogTitle = currentChangelogRaw[0] || tr("版本更新", "Version update", "バージョン更新", "버전 업데이트");
  const currentChangelog = currentChangelogRaw.slice(1);
  const closeUpdateNotice = () => {
    try { localStorage.setItem("mali_seen_version", VERSION); } catch {}
    setUpdateNoticeOpen(false);
  };
  const getUserDisplayName = () => sanitizeText(playerProfile?.name || t("player"), 40) || t("player");
  const applyUserPlaceholder = (text) => String(text || "").replace(/\{\{user\}\}/g, getUserDisplayName());
  const stripUserPlaceholder = (text) => replaceUserPlaceholder(text, getUserDisplayName());
  const replaceUserPlaceholderForWallet = stripUserPlaceholder;
  const displayWalletText = (text) => formatWalletDisplayText(text, getUserDisplayName());
  const getPlayerContextBlock = () => {
    const n = sanitizeText(playerProfile?.name || "玩家", 40);
    const nn = sanitizeText(playerProfile?.nickname || "", 40);
    const g = sanitizeText(playerProfile?.gender || "", 80);
    const b = sanitizeText(playerProfile?.bio || "", 400);
    const nameLine = nn ? `名稱：${n}\n暱稱：${nn}` : `名稱：${n}`;
    const nicknameRule = nn
      ? `暱稱使用規則：僅在語氣自然、關係熟悉時偶爾使用暱稱「${nn}」，不要每句都使用。`
      : "";
    return [ `[玩家設定]\n${nameLine}${g ? `\n性別／組成：${g}` : "\n性別／組成：未填寫，不得自行推測"}${b ? `\n設定：${b}` : ""}`, nicknameRule ].filter(Boolean).join("\n");
  };
  const getCalendarContext = (query, characterId) => buildCalendarPromptContext(calendarEvents, query, new Date(), characterId);
  const getCalendarReminderContext = (characterId) => takeCalendarChatReminder(calendarEvents, new Date(), globalThis?.localStorage, characterId);
  const activeChar = characters.find(c => c.id === activeCharId);
  const {
    armAppClickSuppression,
    blockRecentAppClicks,
    closeApp,
    handleUnlock,
    lockGestureHandlers,
    openApp,
    openAppFromTouch,
    suppressAppClickUntilRef,
  } = usePhoneNavigation({
    canOpenApp: (appId) => appId !== "dating" || DATING_ENABLED,
    preloadApp: preloadFeatureForApp,
    onUnlockStart: () => setUnlocking(true),
    onUnlockComplete: () => {
      setLocked(false);
      setUnlocking(false);
    },
    onOpenApp: (appId) => {
      if (appId === "lorebook") setActiveLorebookId(null);
      if (appId === "game") setGamePage("hub");
      if (appId === "chat") {
        setCurrentChatChar(null);
        setCurrentChatGroup(null);
        setChatListTab("friends");
      }
      if (appId === "phone") {
        setPhoneViewCharId(null);
        setPhonePage("picker");
        setPhoneActiveThreadId("player");
      }
      setCurrentApp(appId);
    },
    onCloseApp: () => {
      setCurrentApp(null);
      setCurrentChatChar(null);
      setCurrentChatGroup(null);
    },
  });
  const {
    closeMessageEditor,
    deleteChatMessage,
    startNoticeLongPress,
    cancelNoticeLongPress,
    saveEditedMessage,
    deleteMessageWithConfirm,
  } = useChatMessageActions({
    currentChatChar,
    currentChatGroup,
    chatHistory,
    messageEditor,
    noticeLongPressTimerRef,
    setChatHistory,
    setGroupChats,
    setMessageEditor,
    setActiveMessageId,
    sanitizeText,
    showToast,
    tr,
  });
  const getSceneState = (kind, id) => {
    if (kind === "group") return groupScenes?.[id] || { location: "", note: "" };
    return chatScenes?.[id] || { location: "", note: "" };
  };
  const renderSceneBar = (kind, id, title = tr("場景", "Scene", "シーン", "장면"), action = null) => {
    const scene = getSceneState(kind, id);
    const editing = sceneEditor?.kind === kind && sceneEditor?.id === id;
    return (
      <SceneBar title={title} scene={scene} editor={editing ? sceneEditor : null} action={action} tr={tr}
        onStartEditing={() => setSceneEditor({ kind, id, location: scene.location || "", note: scene.note || "" })}
        onChange={setSceneEditor}
        onSave={() => {
          const next = { location: sanitizeText(sceneEditor.location || "", 15), note: sanitizeText(sceneEditor.note || "", 50) };
          if (kind === "group") setGroupScenes((prev) => ({ ...prev, [id]: next }));
          else setChatScenes((prev) => ({ ...prev, [id]: next }));
          setSceneEditor(null);
        }}
      />
    );
  };
  const formatMoney = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");
  // \u4e2d\u6587\u6539\u7528 bigram\uff08\u9023\u7e8c\u4e8c\u5b57\uff09\u5207\u8a5e\uff1a\u55ae\u5b57\u5207\u5206\u6703\u8b93\u300c\u706b\u300d\u8aa4\u547d\u4e2d\u300c\u706b\u934b\u300d\u3001\u300c\u767d\u300d\u8aa4\u547d\u4e2d\u300c\u660e\u767d\u300d\uff0c
  // \u9020\u6210\u4e16\u754c\u66f8\u8207\u8a18\u61b6\u53ec\u56de\u5927\u91cf\u566a\u97f3\u3002\u82f1\u6578\u8a5e\u7dad\u6301\u6574\u6bb5\u4fdd\u7559\u3002
  const {
    buildSocialSystemPrompt, buildSocialPostPrompt, formatPostTime, getPostAuthorName, getPostAuthorAvatar,
    getPostAuthorType, getPlayerDisplayName, getPlayerAvatar, getConnectionErrorPrefix,
    isConnectionErrorNotice, formatSocialCount, rollCharacterPostLikes,
    shouldClampSocialPost, shouldScrollComments, getCommentDepth, getCommentAuthorName,
    insertCommentAfterThread, buildMemoryDigest, buildSocialCommentReplyPrompt,
    pickPlayerPostReactors, getPostLikeCount, getLikedByListText,
    pickPlayerPostResponders, buildPlayerPostReplyPrompt,
    scoreCharacterForCharacterPost, getCharacterCommentReplyChance,
    buildCharacterPostInteractionPrompt, buildCharacterReplyToCommentPrompt,
  } = createSocialFeedHelpers({
    chatHistory, getModeLabel, getMessageMode, sanitizeText, posts,
    getOutputLanguageDirective, tr, uiLanguage, playerProfile, sanitizeUserImageUrl,
    normalizeForMatch, tokenizeForRecall, memories, activeCharId, characters, socialTick,
  });
  useEffect(() => {
    if (!hydrated) return;
    compactEpisodeImages(characters);
  }, [hydrated, characters, compactEpisodeImages]);
  // 特別記憶（抽卡特別篇凝結而來）獨立於 30 條長期記憶之外。
  // 數量不設上限，但注入固定最多 6 條：釘選 3 ＋ 最新 2 ＋ 關鍵字召回 3（去重）。
  const { generateInnerThought, renderInnerThought } = useInnerThought({
    chatHistory,
    getActiveStoryStatus: (characterId) => {
      const rooms = Array.isArray(chatRooms?.[characterId]) ? chatRooms[characterId] : [];
      return rooms.find((room) => room.id === activeRoomIds?.[characterId])?.storyStatus || {};
    },
    innerThoughtLoading,
    expandedInnerThoughts,
    apiConfig,
    setChatHistory,
    getActiveRoomId: (characterId) => activeRoomIds[characterId] || null,
    updateRoomMessages: updateCharacterRoomMessages,
    setInnerThoughtLoading,
    setExpandedInnerThoughts,
    pickMemoriesForPrompt,
    getMessageMode,
    getOutputLanguageDirective,
    getUserDisplayName,
    applyUserPlaceholder,
    estimateTokens,
    stripInternalBlocks,
    callAI,
    sanitizeText,
    showToast,
    tr,
  });
  const { generateAssistantForHistory } = useDirectChatGenerationController({
    isChatRealTimeEnabled,
    formatMessagesForPrompt,
    pickMemoriesForPrompt,
    pickLorebookEntriesForPrompt,
    characterWallets,
    formatMoney,
    tr,
    getPlayerContextBlock,
    getCalendarContext,
    getCalendarReminderContext,
    totalContextTokenLimit: TOTAL_CONTEXT_TOKEN_LIMIT,
    apiConfig,
    applyUserPlaceholder,
    buildChatSystemPrompt,
    callAI,
    sanitizeText,
    updateChatMessages: updateCharacterRoomMessages,
    // Wallet callbacks are initialized later in this component; defer their lookup until generation runs.
    applyCharacterTransferToPlayer: (...args) => applyCharacterTransferToPlayer(...args),
    transfers,
    handleCharacterTransferDecision: (...args) => handleCharacterTransferDecision(...args),
    characterBlockStates,
    applyCharacterBlockDirective: (cid, action) => setCharacterBlocksPlayer(cid, action === "block"),
    isInnerThoughtAutoEnabled,
    generateInnerThought,
    createId: gid,
  });
  useCharacterBlockReaction({
    pendingBlockReaction,
    characterBlockStates,
    characters,
    chatHistory,
    activeRoomIds,
    setPendingBlockReaction,
    generateAssistantForHistory,
  });

  const addChatErrorNotice = (cid, err, roomId = activeRoomIds[cid] || null) => {
    const detail = sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 500);
    updateCharacterRoomMessages(cid, roomId, (messages) => [...messages, { id: gid(), role: "system_notice", content: `${getConnectionErrorPrefix()}${detail}`, time: Date.now() }]);
  };

  const {
    sendMessage,
    retryMessage: retryChatFromNotice,
    retryLastUnansweredMessage,
    selectAssistantSwipe,
    generateAssistantSwipe,
    deleteAssistantSwipe,
    pendingRequest: directPendingRequest,
    startCalendarStory,
  } = useDirectChatAI({
    currentCharacter: currentChatChar, isTyping, chatHistory, chatInput, chatImage, chatPseudoImage, chatPseudoVoiceMode,
    getActiveRoomId: (characterId) => activeRoomIds[characterId] || null,
    getCommittedMode: getLastCommittedChatMode, getSelectedMode: getSelectedChatMode, getMessageMode,
    getTextLimit: getChatTextLimit, sanitizeText, createId: gid,
    isPlayerBlockedByCharacter: (characterId) => characterBlockStates?.[characterId]?.characterBlocksPlayer === true,
    setChatHistory, setChatInput, setChatImage, setChatPseudoImage, setChatPseudoVoiceMode, setActionPanelOpen: setChatActionPanelOpen, setIsTyping,
    generateAssistant: generateAssistantForHistory, addErrorNotice: addChatErrorNotice,
    onSwipeError: () => showToast(tr("無法生成替代回覆，請再試一次", "Couldn't generate an alternative reply. Please try again.", "代替の返信を生成できませんでした。もう一度お試しください。", "대체 답변을 생성하지 못했어요. 다시 시도해 주세요.")),
    onSwipeLimit: (limit) => showToast(tr(`最多保留 ${limit} 個回覆版本`, `Keep up to ${limit} reply versions`, `${limit} 件まで返信を保存できます`, `답장 버전은 최대 ${limit}개까지 저장할 수 있어요`)),
  });
  const addCalendarProposal = async (message, proposal) => {
    const character = currentChatChar;
    if (!character?.id || !message?.id) return;
    try {
      const result = await addChatCalendarEvent({ proposal, character, sourceMessageId: message.id });
      setChatHistory((history) => ({
        ...history,
        [character.id]: (history[character.id] || []).map((item) => (
          item.id === message.id
            ? { ...item, calendarProposal: { ...proposal, status: "added", eventId: result.event.id } }
            : item
        )),
      }));
      showToast(result.duplicate
        ? tr("這個約定已在日曆中", "This appointment is already in your calendar", "この予定はすでにカレンダーにあります", "이 약속은 이미 캘린더에 있어요")
        : tr("已加入日曆，角色會在時間附近知道", "Added to calendar. The character will know near the time", "カレンダーに追加しました。時間が近づくとキャラも分かります", "캘린더에 추가했어요. 시간이 가까워지면 캐릭터도 알게 됩니다"));
    } catch (error) {
      showToast(tr("無法加入日曆", "Could not add to calendar", "カレンダーに追加できませんでした", "캘린더에 추가하지 못했어요"));
      console.warn("[calendar proposal]", error);
    }
  };
  const dismissCalendarProposal = (message) => {
    const characterId = currentChatChar?.id;
    if (!characterId || !message?.id) return;
    setChatHistory((history) => ({
      ...history,
      [characterId]: (history[characterId] || []).map((item) => (
        item.id === message.id && item.calendarProposal
          ? { ...item, calendarProposal: { ...item.calendarProposal, status: "dismissed" } }
          : item
      )),
    }));
  };
  const startDueCalendarStory = async (event) => {
    if (!event?.id || isTyping) return;
    try {
      const updated = await updateCalendarEvent(event.id, { storyStatus: "started", startedAt: Date.now(), snoozedUntil: null });
      if (!updated) return;
      const started = await startCalendarStory(updated);
      if (!started) await updateCalendarEvent(event.id, { storyStatus: "scheduled", startedAt: null });
    } catch (error) {
      showToast(tr("無法開始這個約定", "Could not start this appointment", "この予定を開始できませんでした", "이 약속을 시작하지 못했어요"));
      console.warn("[calendar story]", error);
    }
  };
  const snoozeDueCalendarStory = async (event) => {
    if (!event?.id) return;
    try {
      await updateCalendarEvent(event.id, { snoozedUntil: Date.now() + 10 * 60 * 1000 });
      showToast(tr("10 分鐘後再提醒", "Remind again in 10 minutes", "10分後にもう一度知らせます", "10분 후 다시 알려드릴게요"));
    } catch (error) {
      console.warn("[calendar snooze]", error);
    }
  };
  const skipDueCalendarStory = async (event) => {
    if (!event?.id) return;
    try {
      await updateCalendarEvent(event.id, { storyStatus: "skipped", skippedAt: Date.now() });
      showToast(tr("已略過這次約定", "Appointment skipped", "この予定をスキップしました", "이번 약속을 건너뛰었어요"));
    } catch (error) {
      console.warn("[calendar skip]", error);
    }
  };
  // silent：背景建立的角色（例如交友配對熟成）不跳 toast，
  // 否則玩家在山莊裡會被一則「已加入」打斷，違反沉浸 App 不打擾的規則。
  const addCharacter = (c, options = {}) => {
    const nc = {
      ...c,
      id: gid(),
      createdAt: Date.now(),
      name: sanitizeText(c.name, 80),
      description: sanitizeText(c.description, 8000),
      personality: sanitizeText(c.personality, 8000),
      scenario: sanitizeText(c.scenario, 8000),
      firstMessage: sanitizeText(c.firstMessage, 4000),
      initialOnlineMessage: sanitizeText(c.initialOnlineMessage ?? c.firstMessage, 4000),
      initialRealityMessage: sanitizeText(c.initialRealityMessage, 4000),
      messageExamples: sanitizeText(c.messageExamples, 12000),
      systemPrompt: sanitizeText(c.systemPrompt, 8000),
      relationshipToUser: sanitizeText(c.relationshipToUser, 120),
      creator: sanitizeText(c.creator, 80),
      creatorNotes: sanitizeText(c.creatorNotes, 4000),
      characterVersion: sanitizeText(c.characterVersion, 40),
      privateNotes: sanitizeText(c.privateNotes, 4000),
      avatar: sanitizeUserImageUrl(c.avatar) || null,
      tags: Array.isArray(c.tags) ? c.tags.map((t) => sanitizeText(t, 30)).filter(Boolean).slice(0, 20) : [],
      statusText: sanitizeText(c.statusText || "", 80),
      statusUpdatedAt: c.statusUpdatedAt || 0,
      pinned: !!c.pinned,
      voiceSettings: normalizeCharacterVoiceSettings(c.voiceSettings),
    };
    setCharacters(p => [...p, nc]);
    addCharacterRoom(nc);
    if (!activeCharId) setActiveCharId(nc.id);
    if (!options.silent) {
      setModal(null);
      showToast(`${nc.name} 已加入`);
    }
    return nc;
  };
  const updateCharacter = (id, patch) => {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, firstMessage: sanitizeText(patch.initialOnlineMessage ?? patch.firstMessage ?? c.initialOnlineMessage ?? c.firstMessage, 4000), initialOnlineMessage: sanitizeText(patch.initialOnlineMessage ?? patch.firstMessage ?? c.initialOnlineMessage ?? c.firstMessage, 4000), initialRealityMessage: sanitizeText(patch.initialRealityMessage ?? c.initialRealityMessage, 4000), creator: sanitizeText(patch.creator ?? c.creator, 80), creatorNotes: sanitizeText(patch.creatorNotes ?? c.creatorNotes, 4000), characterVersion: sanitizeText(patch.characterVersion ?? c.characterVersion, 40), privateNotes: sanitizeText(patch.privateNotes ?? c.privateNotes, 4000), tags: Array.isArray(patch.tags ?? c.tags) ? (patch.tags ?? c.tags).map((tag) => sanitizeText(tag, 30)).filter(Boolean).slice(0, 20) : [], voiceSettings: normalizeCharacterVoiceSettings(patch.voiceSettings ?? c.voiceSettings), avatar: sanitizeUserImageUrl(patch.avatar ?? c.avatar) || null, statusText: sanitizeText((patch.statusText ?? c.statusText) || "", 80), pinned: typeof patch.pinned === "boolean" ? patch.pinned : !!c.pinned } : c)));
    setModal(null);
    setEditingCharacter(null);
    showToast(tr("角色已更新", "Character updated", "キャラを更新しました", "캐릭터가 업데이트되었습니다"));
  };
  const exportCharacter = async (char) => {
    if (!char) return;
    const payload = {
      format: "maliphone-character",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      character: {
        name: sanitizeText(char.name, 80),
        avatar: sanitizeUserImageUrl(char.avatar) || null,
        description: sanitizeText(char.description, 8000),
        personality: sanitizeText(char.personality, 8000),
        scenario: sanitizeText(char.scenario, 8000),
        firstMessage: sanitizeText(char.firstMessage, 4000),
        initialOnlineMessage: sanitizeText(char.initialOnlineMessage ?? char.firstMessage, 4000),
        initialRealityMessage: sanitizeText(char.initialRealityMessage, 4000),
        messageExamples: sanitizeText(char.messageExamples, 12000),
        systemPrompt: sanitizeText(char.systemPrompt, 8000),
        relationshipToUser: sanitizeText(char.relationshipToUser, 120),
        tags: Array.isArray(char.tags) ? char.tags.map((tag) => sanitizeText(tag, 30)).filter(Boolean).slice(0, 20) : [],
        creator: sanitizeText(char.creator, 80),
        creatorNotes: sanitizeText(char.creatorNotes, 4000),
        characterVersion: sanitizeText(char.characterVersion, 40),
        privateNotes: sanitizeText(char.privateNotes, 4000),
        voiceSettings: char.voiceSettings || createDefaultVoiceSettings(),
      },
    };
    const safeName = sanitizeText(char.name || "character", 40).replace(/[\\/:*?"<>|]+/g, "_").trim() || "character";
    try {
      const result = await downloadJsonFile(payload, `${safeName}.malichar.json`);
      const message = exportToastMessage(result, tr);
      if (message) showToast(`${char.name || tr("角色", "character", "キャラ", "캐릭터")} ${message}`);
    } catch (error) {
      showToast(`${tr("匯出失敗", "Export failed", "書き出しに失敗しました", "내보내기 실패")}：${sanitizeText(error?.message || "Unknown error", 80)}`);
    }
  };
  const {
    applyLocalAppDataSnapshot,
    getExportableAppState,
    getRollbackAppState,
    validateImportedAppState,
    summarizeImportedData,
    applyImportedAppState,
  } = dataController;
  const { importRef: dataImportRef, importing: dataImporting, preview: dataImportPreview, exportAllData, importAllData, confirmImport: confirmImportPreview, cancelImport: cancelDataImport } = useDataImportExport({
    getExportableState: getExportableAppState,
    getRollbackState: getRollbackAppState,
    downloadJsonFile,
    summarizeImportedData,
    validateImportedState: validateImportedAppState,
    applyImportedState: applyImportedAppState,
    showToast,
    tr,
    sanitizeText,
  });
  const clearAllData = useAppReset({
    defaultAppState,
    applyLocalAppDataSnapshot,
    personaController,
    resetChatroomImport: cancelChatroomImport,
    resetDataImport: cancelDataImport,
    clearRooms,
    clearVoicePlaybackCache,
    armAppClickSuppression,
    tr,
    sanitizeText,
    showToast,
    setters: {
      setCharacters, setActiveCharId, setCurrentChatChar, setCurrentChatGroup,
      setChatHistory, setChatModes, setChatBackgrounds, setGroupChats,
      setInnerThoughtSettings, setProactiveSettings, setProactiveUnread,
      setExpandedInnerThoughts, setInnerThoughtLoading, setChatScenes, setGroupScenes,
      setChatLorebookBindings, setPosts, setMemories, setLorebooks, setActiveLorebookId,
      setPhoneInboxCache, setPhoneAppCache, setWallet, setCharacterWallets,
      setTransfers, setCharacterBlockStates, setApiPresets, setPlayerProfile,
      setApiConfig, setTtsConfig, setScreenLockTimeout, setHomeSlots, setDockOrder,
      setPhonePage, setPhoneViewCharId, setPhoneActiveThreadId, setCurrentApp, setModal,
      setUpdateNoticeOpen, setChatSettingsOpen, setChatSettingsBackgroundOpen,
      setChatSettingsLorebookOpen, setChatroomManageOpen, setChatSettingsExpandedBooks,
      setChatBgEditor, setChatVisibleCounts, setActiveMessageId, setMessageEditor,
      setIsTyping, setChatInput, setChatImage, setPlayerPostModalOpen, setPlayerPostText,
      setTransferModalOpen, setTransferAmount, setTransferNote, setSocialReplyTarget,
      setExpandedSocialPosts,
    },
  });
  const canUseCurrentProvider = () => {
    if (apiConfig.aiSource === "hosted_test") return isAiConfigReady(apiConfig) && Boolean(authSession.session?.access_token);
    return isAiConfigReady(apiConfig);
  };
  const { refreshCharacterStatus, togglePinMemory, deleteMemory, generateMemory, archiveMemory, restoreMemory, compressMemories, revertMemorySummary } = useCharacterInsights({
    characters, chatHistory, memories, apiConfig, customPrompts, setCharacters, setMemories,
    setStatusRefreshingIds, setGenLoading, canUseCurrentProvider, getOutputLanguageDirective,
    isGemmaModel, stripInternalBlocks, buildMemoryDigest, callAI, sanitizeText, gid, showToast, tr,
  });
  const deleteCharacter = (id) => {
    const c = characters.find(x => x.id === id);
    setCharacters(p => p.filter(x => x.id !== id));
    if (activeCharId === id) setActiveCharId(characters.find(x => x.id !== id)?.id || null);
    setChatHistory(h => { const n = { ...h }; delete n[id]; return n; });
    setCharacterBlockStates((states) => { const next = { ...states }; delete next[id]; return next; });
    removeCharacterRooms(id);
    setChatModes(h => { const n = { ...h }; delete n[id]; return n; });
    setChatBackgrounds(h => { const n = { ...h }; delete n[id]; return n; });
    setChatScenes(h => { const n = { ...h }; delete n[id]; return n; });
    setChatLorebookBindings(h => { const n = { ...h }; delete n[id]; return n; });
    setMemories(m => { const n = { ...m }; delete n[id]; return n; });
    setCharacterWallets((w) => { const n = { ...w }; delete n[id]; return n; });
    setProactiveSettings((p) => { const n = { ...p }; delete n[id]; return n; });
    setProactiveUnread((p) => { const n = { ...p }; delete n[id]; return n; });
    setPhoneInboxCache((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    showToast(`${c?.name || "角色"} 已刪除`);
  };

  const {
    syncShopOrdersToWallet,
    transferToCurrentChar,
    applyCharacterTransferToPlayer,
    resolveTransfer,
    handleCharacterTransferDecision,
    generateCharacterWallet,
    regenerateCharacterWallet,
    clearWalletData,
  } = useWalletController({
    wallet, setWallet, chatHistory, characterWallets, setCharacterWallets, characterBlockStates, transfers, setTransfers,
    currentChatChar, transferSubmitting, transferAmount, transferNote,
    setTransferSubmitting, setTransferAmount, setTransferNote, setTransferModalOpen,
    setChatHistory, getActiveRoomId: (characterId) => activeRoomIds[characterId] || null,
    updateRoomMessages: updateCharacterRoomMessages, setWalletGenLoading,
    defaultWallet: defaultAppState.wallet,
    characterWalletTxLimit: CHARACTER_WALLET_TX_LIMIT,
    apiConfig, canUseCurrentProvider, showToast, tr, getPlayerDisplayName,
    formatMoney, stripUserPlaceholder, getOutputLanguageDirective, getWalletTimeSlot,
  });
  useEffect(() => {
    if (!hydrated) return;
    const next = (transfers || []).filter((item) => item.status === "pending").sort((a, b) => Number(a.expiresAt || 0) - Number(b.expiresAt || 0))[0];
    if (!next) return;
    const delay = Math.max(0, Math.min(2147483647, Number(next.expiresAt || 0) - Date.now()));
    const timer = setTimeout(() => resolveTransfer(next, "expired", "system"), delay);
    return () => clearTimeout(timer);
  }, [hydrated, transfers]);
  const { generatePhoneNpcChats, refreshPhonePlayerContact, generatePhoneApp } = usePhoneDataGeneration({
    phoneInboxCache, phoneAppCache, chatHistory, memories, playerProfile, characterWallets, apiConfig,
    setPhoneInboxCache, setPhoneAppCache, setPhoneGenLoading, setPhonePlayerContactLoading,
    setPhoneAppGenLoading, setDiaryPage, syncShopOrdersToWallet, canUseCurrentProvider,
    getOutputLanguageDirective, callAI, sanitizeText, gid, showToast, tr,
  });
  const {
    handleRandomSocialPost,
    submitPlayerPost,
    addPostComment,
    editPlayerComment,
    deletePlayerComment,
    sharePostToChat,
  } = useSocialFeed({
    apiConfig, characters, posts, setPosts, chatHistory, setChatHistory, memories, activeCharId,
    hydrated, socialSettings, playerProfile, playerPostText, setPlayerPostText,
    playerPostSubmitting, setPlayerPostSubmitting, setPlayerPostModalOpen,
    postCommentInputs, setPostCommentInputs, setSocialReplyTarget,
    socialLastGlobalPostAtRef, socialLastPostByCharRef, socialAutoPostingRef, socialAutoPostGapRef,
    SOCIAL_GLOBAL_COOLDOWN_MS, SOCIAL_CHAR_COOLDOWN_MS, PLAYER_SOCIAL_POST_LIMIT, SHARE_RAW_TOKEN_LIMIT,
    canUseCurrentProvider, showToast, tr, buildSocialSystemPrompt, buildSocialPostPrompt,
    rollCharacterPostLikes, getPlayerDisplayName, pickPlayerPostReactors,
    pickPlayerPostResponders, buildPlayerPostReplyPrompt, getCommentDepth,
    insertCommentAfterThread, buildSocialCommentReplyPrompt, getPostAuthorType,
    scoreCharacterForCharacterPost, getCharacterCommentReplyChance,
    buildCharacterPostInteractionPrompt, buildCharacterReplyToCommentPrompt,
  });
  const { runProactiveSweep } = useProactiveChatController({
    characters,
    chatHistory,
    proactiveSettings,
    proactiveUnread,
    characterBlockStates,
    hydrated,
    apiConfig,
    pauseProactive: notificationCenter.settings.pauseProactive,
    proactiveSweepingRef,
    currentChatCharIdRef,
    buildChatSystemPrompt,
    formatMessagesForPrompt,
    pickMemoriesForPrompt,
    pickLorebookEntriesForPrompt,
    getLastCommittedChatMode,
    applyUserPlaceholder,
    sanitizeText,
    callAI,
    canUseCurrentProvider,
    setChatHistory,
    setProactiveSettings,
    setProactiveUnread,
    createId: gid,
  });
  useEffect(() => {
    if (!hydrated || !activeCharId) return;
    refreshCharacterStatus(activeCharId, false);
    const t = setInterval(() => { refreshCharacterStatus(activeCharId, false); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [hydrated, activeCharId, chatHistory, memories, apiConfig, characters]);

  useEffect(() => {
    currentChatCharIdRef.current = currentChatChar?.id || null;
  }, [currentChatChar]);

  useEffect(() => {
    if (currentApp !== "social") setSocialSettingsOpen(false);
    setActivePostMenuId(null);
  }, [currentApp]);

  const [, setSocialTimeTick] = useState(0);
  useEffect(() => {
    if (currentApp !== "social") return;
    const iv = setInterval(() => setSocialTimeTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(iv);
  }, [currentApp]);

  useEffect(() => {
    if (!pendingPostScrollId || socialSettingsOpen || currentApp !== "social") return;
    const frame = requestAnimationFrame(() => {
      const container = socialFeedRef.current;
      const target = container
        ? Array.from(container.querySelectorAll("[data-post-id]")).find((node) => node.dataset.postId === pendingPostScrollId)
        : null;
      setPendingPostScrollId(null);
      if (!target || !container) return;
      const targetTop = target.offsetTop - (container.clientHeight - target.clientHeight) / 2;
      container.scrollTop = Math.max(0, targetTop);
      setHighlightedPostId(pendingPostScrollId);
      setTimeout(() => setHighlightedPostId(null), 1800);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingPostScrollId, socialSettingsOpen, currentApp, posts]);

  useEffect(() => {
    if (!hydrated) return;
    const onVisible = () => { if (document.visibilityState === "visible") runProactiveSweep(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const kick = setTimeout(runProactiveSweep, 4000);
    const iv = setInterval(runProactiveSweep, 15 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearTimeout(kick);
      clearInterval(iv);
    };
  }, [hydrated, characters, chatHistory, proactiveSettings, proactiveUnread, apiConfig, notificationCenter.settings.pauseProactive]);


  const { isNightTheme, isPeachTheme, themeCss } = useThemeRuntime({
    themeName,
    fontName,
    fontSizeScale,
    customFontName,
    currentApp,
    themeEffectsEnabled,
    scopedCustomCss,
  });

  // 通知點擊：消未讀並跳到目的地。目的地由通知自己帶著走，新來源不用改這裡。
  const openNotification = (notif) => {
    const charId = notif.payload?.charId;
    notificationCenter.dismissBanner();
    if (notif.payload?.settingsTab) setSettingsTab(notif.payload.settingsTab);
    // 順序不能反：openApp("chat") 會清掉 currentChatChar，先設角色會被蓋掉，只停在列表。
    openApp(notif.appId);
    if (charId) {
      setProactiveUnread((prev) => { const next = { ...prev }; delete next[charId]; return next; });
      setCurrentChatChar(characters.find((item) => item.id === charId) || null);
    }
    if (notif.payload?.profileId) dating.openChat(notif.payload.profileId);
    if (locked) handleUnlock();
  };

  // 系統通知的點擊由 sw.js 轉發進來，走的是同一個 openNotification。
  // 用 ref 接是因為 openNotification 每次 render 都重建，effect 不該跟著重綁。
  const openNotificationRef = useRef(openNotification);
  openNotificationRef.current = openNotification;
  useEffect(() => {
    const unsubscribe = subscribeSystemNotificationClicks((notification) => {
      if (notification?.appId) openNotificationRef.current(notification);
    });
    // 從關閉狀態被通知叫起來時，訊息會早於 listener 掛載，所以主動要一次。
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "CLAIM_PENDING_NOTIFICATION" }))
        .catch(() => {});
    }
    return unsubscribe;
  }, []);

  const localizedAppById = {
    chat: { ...DEFAULT_APPS.find((a) => a.id === "chat"), name: t("chat") },
    status: { ...DEFAULT_APPS.find((a) => a.id === "status"), name: t("status") },
    social: { ...DEFAULT_APPS.find((a) => a.id === "social"), name: t("social") },
    gallery: { ...DEFAULT_APPS.find((a) => a.id === "gallery"), name: t("gallery") },
    lorebook: { ...DEFAULT_APPS.find((a) => a.id === "lorebook"), name: t("lorebook") },
    player: { ...DEFAULT_APPS.find((a) => a.id === "player"), name: t("player") },
    wallet: { ...DEFAULT_APPS.find((a) => a.id === "wallet"), name: t("wallet") },
    game: { ...DEFAULT_APPS.find((a) => a.id === "game"), name: t("gameCenter") },
    petHome: { ...DEFAULT_APPS.find((a) => a.id === "petHome"), name: tr("寵物小屋", "Pet Home", "ペットのおうち", "펫 하우스") },
    yunyin: { ...DEFAULT_APPS.find((a) => a.id === "yunyin"), name: tr("雲隱山莊", "Yunyin Villa", "雲隠山荘", "운은산장") },
    lbook: { ...DEFAULT_APPS.find((a) => a.id === "lbook"), name: t("answerBook") },
    notebook: { ...DEFAULT_APPS.find((a) => a.id === "notebook"), name: t("notebook") },
    music: { ...DEFAULT_APPS.find((a) => a.id === "music"), name: tr("一起聽歌", "Listen Together", "一緒に音楽", "함께 듣기") },
    dating: { ...DEFAULT_APPS.find((a) => a.id === "dating"), name: tr("信風", "Tradewind", "信風", "신풍") },
    couple: { ...DEFAULT_APPS.find((a) => a.id === "couple"), name: tr("情侶空間", "Couple Space", "カップルスペース", "커플 공간") },
    calendar: { ...DEFAULT_APPS.find((a) => a.id === "calendar"), name: tr("日曆", "Calendar", "カレンダー", "달력") },
    settings: { ...DEFAULT_APPS.find((a) => a.id === "settings"), name: t("settings") },
    characters: { ...DEFAULT_APPS.find((a) => a.id === "characters"), name: t("characters") },
    phone: { ...DEFAULT_APPS.find((a) => a.id === "phone"), name: t("phone") },
  };
  const appById = Object.fromEntries(DEFAULT_APPS.map(a => [a.id, localizedAppById[a.id] || a]));
  const localizedApps = DEFAULT_APPS
    .filter((app) => app.id !== "dating" || DATING_ENABLED)
    .map((app) => appById[app.id]);
  const renderAppIcon = (app, size = 26) => {
    if (app?.iconUrl) {
      return <img className="mp-app-icon-img" src={app.iconUrl} alt={app?.name || ""} draggable={false} onContextMenu={(e)=>e.preventDefault()} style={{ width: size, height: size }} />;
    }
    return app?.icon || "";
  };
  const home = useHomeCustomization({ apps: localizedApps, homeSlots, setHomeSlots, dockOrder, setDockOrder });
  const { allAppIds, safeDock, cleanedSlots, homePages } = home;
  const dockApps = safeDock.map(id => appById[id]).filter(Boolean);

  const {
    onHomeTouchStart, onHomeTouchEnd, onHomeTouchCancel, onHomeMouseDown, onHomeMouseUp,
    onHomePointerDown, onHomePointerUp, onHomePointerMove,
    onPointerDragStartApp, cancelPointerDrag, onDropToHome, onDropToHomeGrid,
    onDropToDock, onDropToDockContainer, onHomeDragOverPageEdge, homeGesture,
  } = useHomeDragAndDrop({
    allAppIds, safeDock, cleanedSlots, dockApps, homePages, homePage, setHomePage,
    setHomeSlots, setDockOrder, isDraggingApp, setIsDraggingApp, pointerDrag, setPointerDrag,
    swipeStartXRef, swipeStartYRef, edgeTurnTimerRef, edgeTurnDirRef, suppressAppClickUntilRef,
    pageSize: HOME_PAGE_SIZE, openApp, openAllApps: home.openLibrary,
  });

  // ---- Status (RPG) ----
  const renderStatus = () => <MaliPhoneStatusSurface
    core={{ closeApp, t, tr, sanitizeUserImageUrl }}
    data={{ characters, chatHistory, memories, posts, playerProfile }}
    state={{
      statusExpandedCharId, setStatusExpandedCharId, statusMemoryExpandedCharId, setStatusMemoryExpandedCharId,
      statusMemoryPages, setStatusMemoryPages, statusRefreshingIds, activeMemoryId, setActiveMemoryId, genLoading,
    }}
    actions={{ refreshCharacterStatus, setMemoryEditor, togglePinMemory, deleteMemory, generateMemory, archiveMemory, restoreMemory, compressMemories, revertMemorySummary, applyUserPlaceholder }}
    memoryPrompt={{ value: customPrompts?.memoryCompress || "", onChange: (text) => setCustomPrompts((prev) => ({ ...prev, memoryCompress: text })) }}
  />;

  // ---- Chat ----
  const sortChatThreads = (charactersToSort) => sortChatThreadsByActivity(charactersToSort, chatHistory);
  const markChatOpened = (character) => setCharacters((items) => items.map((item) => item.id === character.id ? { ...item, chatOpenedAt: Date.now() } : item));
  const openCharacterChat = (character) => {
    if (!character?.id) return;
    const reopenedCharacter = character.chatroomDeleted
      ? { ...character, chatroomDeleted: false, chatroomDeletedAt: null }
      : character;
    if (character.chatroomDeleted) {
      setCharacters((items) => items.map((item) => item.id === character.id ? reopenedCharacter : item));
      addCharacterRoom(reopenedCharacter);
    }
    const roomId = activeRoomIds[character.id] || "default";
    delete chatScrollPositionsRef.current[`${character.id}::${roomId}`];
    markChatOpened(reopenedCharacter);
    setCurrentChatChar(reopenedCharacter);
  };
  // Pinning is a pure local UI/state action only. It must never trigger AI calls or alter prompt content.
  const toggleChatPin = (charId) => {
    setCharacters((prev) => {
      const target = prev.find((c) => c.id === charId);
      showToast(target?.pinned ? tr("已取消釘選", "Unpinned", "固定を解除しました", "고정 해제됨") : tr("已釘選", "Pinned", "固定しました", "고정됨"));
      return prev.map((c) => (c.id === charId ? { ...c, pinned: !c.pinned } : c));
    });
  };
  const {
    getGroupMembers, openCreateGroup, openEditGroup, saveEditGroup, deleteGroupChat, createGroupChat,
    getGroupChatModalProps,
  } = useGroupChatController({
    setGroupChats, setGroupScenes, setCurrentChatGroup, sanitizeImageUrl: sanitizeUserImageUrl, showToast, notify, tr,
  });
  const { sendGroupMessage, retryGroupMessage: retryGroupFromNotice } = useGroupChatGenerationController({
    currentGroup: currentChatGroup, isTyping, input: chatInput, image: chatImage, pseudoImage: chatPseudoImage,
    setInput: setChatInput, setImage: setChatImage, setPseudoImage: setChatPseudoImage, setActionPanelOpen: setChatActionPanelOpen, setIsTyping,
    setGroups: setGroupChats, getMembers: getGroupMembers, getPlayerName: getPlayerDisplayName,
    isGroupRealTimeEnabled, groupScenes, apiConfig, callAI, sanitizeText, createId: gid,
    connectionErrorPrefix: getConnectionErrorPrefix, tr,
    outputLanguageDirective: getOutputLanguageDirective(),
  });
  const { renderChat } = useChatRenderController({
    apiConfig,
    activeMessageId,
    activeRoomIds,
    activateCharacterRoom,
    addCalendarProposal,
    applyUserPlaceholder,
    armAppClickSuppression,
    calendarEvents,
    calendarTick,
    captureCurrentPersona,
    characterBlockStates,
    characters,
    chatActionPanelOpen,
    chatBackgrounds,
    chatHistory,
    chatImage,
    chatInput,
    chatListTab,
    chatMsgsRef,
    chatPseudoImage,
    chatPseudoVoiceMode,
    chatRooms,
    chatScreenshotOpen,
    chatScreenshotSelection,
    chatSettingsOpen,
    chatVisibleCounts,
    chatScrollPositionsRef,
    chatroomImportRef,
    chatroomImporting,
    clearCharacterRoom,
    archiveCharacterRoom,
    restoreCharacterRoom,
    moveCharacterRoom,
    closeApp,
    closeChatSettings,
    createCharacterRoom,
    createCharacterBranch,
    updateCharacterRoomMetadata,
    currentChatChar,
    currentChatGroup,
    deleteCharacterRoom,
    deleteChatMessage,
    deleteMemory,
    deleteChatroomForCharacter,
    directPendingRequest,
    dismissCalendarProposal,
    exportChatroomForCharacter,
    fileInputRef,
    formatMoney,
    genLoading,
    generateMemory,
    getCharacterVoiceBubblePlayback,
    getChatBackgroundBlurFilter,
    getChatBackgroundLayerStyle,
    getDirectSettings,
    getGroupMembers,
    getLastCommittedChatMode,
    getMessageMode,
    getModeLabel,
    getPlayerAvatar,
    getSelectedChatMode,
    groupChats,
    handleDirectChatScroll,
    handleImgUp,
    highlightedThoughtMessageId,
    importChatroomFile,
    isConnectionErrorNotice,
    isNightTheme,
    isTyping,
    jumpToThoughtMessage,
    lastMemGenMsgId,
    loadEarlierMessages,
    memoryCard,
    messagesEndRef,
    modelBadgeOpen,
    normalizeChatBackground,
    openCharacterChat,
    openChatSettings,
    openChatroomImport,
    openCreateGroup,
    openEditGroup,
    parseShareEventNotice,
    personaController,
    playerProfile,
    proactiveUnread,
    renderCharacterVoiceAction,
    renderInnerThought,
    renderSceneBar,
    rememberCurrentChatScroll,
    renameCharacterRoom,
    resolveTransfer,
    retryChatFromNotice,
    retryGroupFromNotice,
    retryLastUnansweredMessage,
    selectAssistantSwipe,
    generateAssistantSwipe,
    deleteAssistantSwipe,
    scrollCurrentChatToBottom,
    sendGroupMessage,
    sendMessage,
    setActiveMessageId,
    setCharacterBlocked,
    setChatActionPanelOpen,
    setChatImage,
    setChatInput,
    setChatListTab,
    setChatPseudoImage,
    setChatPseudoVoiceMode,
    setChatScreenshotOpen,
    setChatScreenshotSelection,
    setCurrentChatChar,
    setCurrentChatGroup,
    setGroupChats,
    setLastMemGenMsgId,
    setMemoryCard,
    setMemoryEditor,
    setMessageEditor,
    setModelBadgeOpen,
    setProactiveUnread,
    setTransferModalOpen,
    showScrollToBottom,
    showThinking,
    showToast,
    sortChatThreads,
    startDueCalendarStory,
    startNoticeLongPress,
    cancelNoticeLongPress,
    snoozeDueCalendarStory,
    skipDueCalendarStory,
    suppressAppClickUntilRef,
    t,
    thoughtHistoryPage,
    toggleChatPin,
    togglePinMemory,
    toggleShowThinking,
    transfers,
    tr,
    uiLanguage,
    updateScrollToBottomVisibility,
  });
  const renderSocial = () => <MaliPhoneSocialSurface
    core={{ closeApp, t, tr, characters, sanitizeUserImageUrl, showToast, postLimit: SOCIAL_POST_LIMIT, downloadTextFile, exportToastMessage }}
    state={{
      socialSettingsOpen, setSocialSettingsOpen, socialSettings, setSocialSettings, posts, setPosts,
      activeCommentPostId, setActiveCommentPostId, socialReplyTarget, setSocialReplyTarget,
      activeLikePostId, setActiveLikePostId, expandedSocialPosts, setExpandedSocialPosts,
      highlightedPostId, activePostMenuId, setActivePostMenuId, postCommentInputs, setPostCommentInputs,
      socialActivities: notificationCenter.socialActivities,
      socialUnreadCount: notificationCenter.socialUnreadCount,
    }}
    actions={{
      setPlayerPostModalOpen,
      handleRandomSocialPost,
      setPendingPostScrollId,
      sharePostToChat,
      addPostComment,
      editPlayerComment,
      deletePlayerComment,
      markSocialReadThrough: notificationCenter.markSocialReadThrough,
    }}
    helpers={{
      socialFeedRef, getPostAuthorName, getPostAuthorAvatar, getPostAuthorType, formatPostTime,
      getLikedByListText, shouldClampSocialPost, shouldScrollComments, formatSocialCount,
      getPostLikeCount, getCommentDepth, getCommentAuthorName,
    }}
  />;
  const renderLorebook = () => <MaliPhoneLorebookSurface
    core={{ lorebookImportInputRef, closeApp, t, tr, sanitizeText, downloadJsonFile, showToast, gid, notify, ask }}
    state={{
      lorebooks, setLorebooks, activeLorebookId, setActiveLorebookId,
      editingLorebookBook, setEditingLorebookBook, editingLorebookEntry, setEditingLorebookEntry,
      pendingLorebookExport, setPendingLorebookExport, viewingLorebookEntry, setViewingLorebookEntry,
    }}
  />;
  const renderCharacters = () => <MaliPhoneContactsSurface
    core={{ t, tr, closeApp, sanitizeImage: sanitizeUserImageUrl, showToast }}
    data={{ characters, setCharacters, activeCharId }}
    actions={{
      onAdd: () => { setAddCharacterModalSession((session) => session + 1); setEditingCharacter(null); setModal("addChar"); },
      onSetActive: (character) => { setActiveCharId(character.id); showToast(`${character.name} ${t("setAsMainCharacter")}`); },
      onChat: (character) => { openApp("chat"); openCharacterChat(character); },
      onView: (character) => { setAddCharacterModalSession((session) => session + 1); setEditingCharacter(character); setModal("addChar"); },
    }}
  />;
  const renderSettings = () => (
    <MaliPhoneSettingsSurface
      auth={authSession}
      core={{
        closeApp,
        isNightTheme,
        notify,
        settingsTab,
        setSettingsTab,
        showToast,
        t,
        tr,
      }}
      api={{
        config: apiConfig,
        setConfig: setApiConfig,
        presets: apiPresets,
        setPresets: setApiPresets,
      }}
      appearance={{
        open: settingsAppearanceOpen,
        setOpen: setSettingsAppearanceOpen,
        theme: {
          themeName,
          setThemeName,
          fontName,
          setFontName,
          fontSizeScale,
          setFontSizeScale,
          customFontName,
          setCustomFontName,
          effectsEnabled: themeEffectsEnabled,
          setEffectsEnabled: setThemeEffectsEnabled,
        },
        css: {
          enabled: customCssEnabled,
          setEnabled: setCustomCssEnabled,
          draft: customCssDraft,
          setDraft: setCustomCssDraft,
          value: customCss,
          setValue: setCustomCss,
          notice: customCssNotice,
          setNotice: setCustomCssNotice,
          onOpenGuide: () => setCustomCssGuideOpen(true),
        },
        hero: {
          activeCharacter: activeChar,
          setCharacters,
          sanitizeImage: sanitizeUserImageUrl,
        },
        interface: {
          uiLanguage,
          setUiLanguage,
          fontSizeScale,
          setFontSizeScale,
          screenLockTimeout,
          setScreenLockTimeout,
        },
      }}
      voice={{
        config: ttsConfig,
        setConfig: setTtsConfig,
        voices: ttsVoices,
        setVoices: setTtsVoices,
        connectionState: ttsConnectionState,
        setConnectionState: setTtsConnectionState,
        loadDefaultVoices: loadElevenLabsDefaultVoices,
        previewDefaultVoice: previewDefaultTtsVoice,
      }}
      data={{
        importing: dataImporting,
        importRef: dataImportRef,
        onExport: exportAllData,
        onImport: importAllData,
        cloudBackupProps: {
          getExportableState: getExportableAppState,
          getRollbackState: getRollbackAppState,
          validateImportedState: validateImportedAppState,
          summarizeImportedData,
          applyImportedState: applyImportedAppState,
          showToast,
        },
      }}
      release={{
        changelogTitle: currentChangelogTitle,
        changelog: currentChangelog,
        onClearAll: clearAllData,
      }}
      notifications={{
        settings: notificationCenter.settings,
        updateSettings: notificationCenter.updateSettings,
        systemPermission: notificationCenter.systemPermission,
        requestSystemPermission: notificationCenter.requestSystemPermission,
      }}
      mailboxMails={mailboxMails}
    />
  );
  const renderDating = () => <MaliPhoneDatingSurface
    core={{ closeApp, showToast }} dating={dating} playerProfile={playerProfile}
    actions={{
      onPromoteToContact: (entry, messages) => promoteDatingContact({ entry, messages, addCharacter, setChatHistory, createId: gid }),
      onOpenContact: (charId) => { openApp("chat"); openCharacterChat(characters.find((item) => item.id === charId) || null); },
    }}
  />;
  const renderPlayer = () => <MaliPhonePlayerSurface
    core={{ t, tr, closeApp }}
    profile={{ profile: playerProfile, setProfile: setPlayerProfile, avatarRef: playerAvatarRef, sanitizeImage: sanitizeUserImageUrl, onAvatarUpload: handlePlayerAvatarUpload }}
    persona={{
      activePersonaId: personaController.activePersonaId,
      personas: personaController.personas,
      maxPersonas: personaController.maxPersonas,
      onSwitch: (id) => personaController.switchPersona(id, captureCurrentPersona).catch((error) => showToast(error?.message || "無法切換玩家人格")),
      onCreate: (label) => personaController.createPersona(label, { name: label }),
      onDelete: (id) => personaController.deletePersona(id).catch((error) => showToast(error?.message || "無法刪除玩家人格")),
    }}
    crop={{
      crop: playerAvatarCrop, setCrop: setPlayerAvatarCrop,
      onCropPointerDown: onPlayerAvatarPointerDown, onCropPointerMove: onPlayerAvatarPointerMove,
      onCropPointerUp: onPlayerAvatarPointerUp, onApplyCrop: applyPlayerAvatarCrop,
    }}
  />;
  const renderWallet = () => (
    <MaliPhoneWalletSurface
      wallet={wallet}
      setWallet={setWallet}
      characters={characters}
      closeApp={closeApp}
      clearWalletData={clearWalletData}
      tr={tr}
      formatMoney={formatMoney}
      displayWalletText={displayWalletText}
      sanitizeUserImageUrl={sanitizeUserImageUrl}
      showToast={showToast}
    />
  );
  const renderPhone = () => (
    <MaliPhonePhoneSurface
      navigation={{
        phoneViewCharId,
        setPhoneViewCharId,
        phonePage,
        setPhonePage,
        phoneActiveThreadId,
        setPhoneActiveThreadId,
        closeApp,
      }}
      data={{
        characters: sortDisplayCharacters(characters),
        chatHistory,
        phoneInboxCache,
        characterWallets,
        transfers,
        playerProfile,
        phoneAppCache,
        setPhoneAppCache,
        diaryPage,
        setDiaryPage,
      }}
      generation={{
        phoneGenLoading,
        generatePhoneNpcChats,
        phonePlayerContactLoading,
        refreshPhonePlayerContact,
        phoneAppGenLoading,
        generatePhoneApp,
        walletGenLoading,
        generateCharacterWallet,
        regenerateCharacterWallet,
      }}
      shared={{
        t,
        tr,
        sanitizeUserImageUrl,
        renderAppIcon,
        formatMoney,
        displayWalletText,
        armAppClickSuppression,
        suppressAppClickUntilRef,
        gid,
      }}
    />
  );
  return (
    <MaliPhoneShell
      themeCss={themeCss}
      locked={locked}
      lockProps={{
        unlocking,
        notifications: notificationCenter.lockNotifications,
        onOpenNotification: openNotification,
        onUnlock: handleUnlock,
        gestureHandlers: lockGestureHandlers,
        ft,
        fd,
        tr,
      }}
      onClickCapture={blockRecentAppClicks}
      homeProps={{
        ft,
        fd,
        activeCharacter: activeChar,
        peachTheme: isPeachTheme,
        tr,
        currentApp,
        pages: homePages,
        page: homePage,
        pageSize: HOME_PAGE_SIZE,
        appById,
        dockApps,
        badges: notificationCenter.badges,
        dragging: isDraggingApp,
        pointerDrag,
        pageGesture: homeGesture,
        renderAppIcon,
        gestureHandlers: {
        onTouchStart: onHomeTouchStart,
        onTouchEnd: onHomeTouchEnd,
        onTouchCancel: onHomeTouchCancel,
        onPointerDown: onHomePointerDown,
        onPointerUp: onHomePointerUp,
        onPointerMove: onHomePointerMove,
        onPointerCancel: cancelPointerDrag,
        onDragOver: onHomeDragOverPageEdge,
        },
        onOpenStatus: () => openApp("status"),
        onOpenStatusFromTouch: (event) => openAppFromTouch("status", event),
        onDropGrid: onDropToHomeGrid,
        onDropSlot: onDropToHome,
        onDropDockContainer: onDropToDockContainer,
        onDropDockApp: onDropToDock,
        onOpenApp: (appId) => { if (Date.now() > suppressAppClickUntilRef.current) openApp(appId); },
        onOpenFolder: home.showFolder,
        onOpenAllApps: home.openLibrary,
        onOpenFromTouch: openAppFromTouch,
        onPointerDragStart: onPointerDragStartApp,
        onPreloadApp: preloadFeatureForApp,
      }}
      libraryProps={{
        open: home.libraryOpen,
        apps: localizedApps,
        placedIds: home.placedIds,
        renderAppIcon,
        tr,
        onClose: home.closeLibrary,
        onOpenApp: (appId) => { home.closeLibrary(); openApp(appId); },
        onApplyHome: home.applyHomeSelection,
        onPreloadApp: preloadFeatureForApp,
      }}
      folderProps={{
        folder: home.openFolder,
        appById,
        renderAppIcon,
        tr,
        onClose: home.closeFolder,
        onRename: home.renameFolder,
        onOpenApp: (appId) => { home.closeFolder(); openApp(appId); },
        onRemoveApp: home.removeFromFolder,
        onPreloadApp: preloadFeatureForApp,
      }}
      routerProps={{
        currentApp,
        closeApp,
        t,
        tr,
        game: {
          page: gamePage,
          setPage: setGamePage,
          characters,
          onOpenChat: () => {
            setCurrentApp("chat");
            setCurrentChatChar(null);
            setCurrentChatGroup(null);
            setChatListTab("episodes");
          },
        },
        yunyin: { characters, apiConfig },
        apiConfig,
        playerProfile,
        chatHistory,
        setChatHistory,
        renderers: {
          chat: renderChat,
          status: renderStatus,
          social: renderSocial,
          lorebook: renderLorebook,
          characters: renderCharacters,
          settings: renderSettings,
          player: renderPlayer,
          wallet: renderWallet,
          phone: renderPhone,
          dating: renderDating,
        },
      }}
      currentApp={currentApp}
      notificationProps={{
        notification: notificationCenter.banner,
        onOpen: openNotification,
        onDismiss: notificationCenter.dismissBanner,
        tr,
      }}
      globalLayer={(
        <MaliPhoneOverlays
          currentApp={currentApp}
          tr={tr}
          dataImport={{
            preview: dataImportPreview,
            onCancel: cancelDataImport,
            onConfirm: confirmImportPreview,
          }}
          chatroomImport={{
            preview: chatroomImportPreview,
            onCancel: cancelChatroomImport,
            onConfirm: confirmChatroomImportPreview,
          }}
          customCssGuide={{
            open: customCssGuideOpen,
            onClose: () => setCustomCssGuideOpen(false),
          }}
          character={{
            open: modal === "addChar",
            sessionKey: addCharacterModalSession,
            props: {
              setModal,
              setEditingCharacter,
              addCharacter,
              updateCharacter,
              exportCharacter,
              deleteCharacter,
              editingCharacter,
              sanitizeUserImageUrl,
              uiLanguage,
              ttsConfig,
              ttsVoices: ttsVoices.length ? ttsVoices : (ttsConfig.elevenlabs?.availableVoices || []),
              onVoicePreview: previewCharacterVoice,
            },
          }}
          memory={{
            value: memoryEditor,
            onChange: setMemoryEditor,
            onClose: () => setMemoryEditor(null),
            onSave: saveEditedMemory,
          }}
          message={{
            value: messageEditor,
            onChange: setMessageEditor,
            onClose: closeMessageEditor,
            onDelete: deleteMessageWithConfirm,
            onSave: saveEditedMessage,
            getLimit: (editor) => editor?.pseudoVoice
              ? PSEUDO_VOICE_TEXT_LIMIT
              : getChatTextLimit(editor?.mode),
          }}
          updateNotice={{
            open: updateNoticeOpen,
            version: VERSION,
            items: currentChangelog,
            onClose: closeUpdateNotice,
          }}
          playerPost={{
            open: playerPostModalOpen,
            text: playerPostText,
            limit: PLAYER_SOCIAL_POST_LIMIT,
            submitting: playerPostSubmitting,
            onClose: () => setPlayerPostModalOpen(false),
            onTextChange: setPlayerPostText,
            onSubmit: submitPlayerPost,
          }}
          transfer={{
            open: transferModalOpen,
            character: currentChatChar,
            amount: transferAmount,
            note: transferNote,
            submitting: transferSubmitting,
            onClose: () => setTransferModalOpen(false),
            onAmountChange: setTransferAmount,
            onNoteChange: setTransferNote,
            onSubmit: transferToCurrentChar,
          }}
          groupChat={getGroupChatModalProps({ displayCharacters: sortChatThreads(characters) })}
          toast={toast}
        />
      )}
    />
  );
}
