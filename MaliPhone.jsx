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
import { localizeFallbackText, normalizeUiLanguage, translate } from "./utils/i18n";
import { buildSystemPrompt } from "./utils/characterParser";
import { callAI } from "./services/aiService";
import { fetchElevenLabsDefaultVoices, synthesizeSpeech } from "./services/ttsService";
import { clearDeviceSecrets, loadAppState, saveAppState, loadFeatureEntity } from "./utils/indexedDbStorage";
import { preserveMissingDeviceSecrets } from "./utils/deviceSecrets";
import { buildCalendarPromptContext, takeCalendarChatReminder } from "./services/calendar/calendarPromptContext";
import { loadFeatureBackup, resetFeatureData, restoreFeatureBackup, summarizeFeatureBackup } from "./services/featureBackupService";
import { FEATURE_DATA_CHANGED_EVENT, featureDataEventIncludes } from "./services/featureDataLifecycle";
import { syncOnBoot, schedulePush } from "./services/syncService";
import { createDefaultVoiceSettings, normalizeCharacterVoiceSettings } from "./utils/voiceSettings";
import { sanitizeCustomCss } from "./utils/customCss";
import { sanitizeFontName } from "./utils/fontName";
import { PHOTO_RULE_CONTEXT, extractPhotoDirectives, pseudoImagePromptLine } from "./utils/pseudoImage";
import { createPseudoVoice, extractPseudoVoiceDirectives, PSEUDO_VOICE_TEXT_LIMIT, pseudoVoicePromptLine, VOICE_MESSAGE_RULE_CONTEXT } from "./utils/pseudoVoice";
import { compactActiveRoomMirrors, compactCharacterImages, compactGroupMessageImages, compactSocialPostImages } from "./utils/persistedMediaCleanup";
import "./styles/maliPhone.css";
import { FONT_PRESETS } from "./styles/themePresets";
import useAppearanceSettings from "./hooks/settings/useAppearanceSettings";
import useDocumentLocale from "./hooks/settings/useDocumentLocale";
import useThemeRuntime from "./hooks/settings/useThemeRuntime";
import useDirectChatAI from "./hooks/chat/useDirectChatAI";
import useCharacterChatRooms from "./hooks/chat/useCharacterChatRooms";
import useGroupChatAI from "./hooks/chat/useGroupChatAI";
import useGroupChatController from "./hooks/chat/useGroupChatController";
import useInnerThought from "./hooks/chat/useInnerThought";
import usePhoneDataGeneration from "./hooks/phone/usePhoneDataGeneration";
import usePlayerProfileController from "./hooks/player/usePlayerProfileController";
import usePersonaController from "./hooks/player/usePersonaController";
import { capturePersonaData, serializePersonas } from "./services/persona/personaModel";
import useCharacterInsights from "./hooks/characters/useCharacterInsights";
import useChatBackground from "./hooks/chat/useChatBackground";
import useHomeDragAndDrop from "./hooks/home/useHomeDragAndDrop";
import useHomeCustomization from "./hooks/home/useHomeCustomization";
import { HOME_PAGE_SIZE, HOME_SLOT_COUNT, normalizeHomeSlots } from "./utils/homeLayout";
import { getGroupMemberProfileText, buildGroupChatSystemPrompt, parseGroupReplies } from "./services/chat/groupChatHelpers";
import { generateGroupReplies } from "./services/chat/groupChatGenerator";
import { blockCharacterState, buildCharacterBlockCapabilityContext, buildCharacterBlockPromptContext, extractCharacterBlockDirective, normalizeCharacterBlockStates, setCharacterBlocksPlayerState, unblockCharacterState } from "./services/chat/characterBlockState";
import useAppPersistence from "./hooks/data/useAppPersistence";
import useDataImportExport from "./hooks/data/useDataImportExport";
import useChatroomImportExport from "./hooks/data/useChatroomImportExport";
import useVoicePlayback from "./hooks/audio/useVoicePlayback";
import { CharacterVoiceAction, RealityMessageText, SceneBar } from "./components/chat/ChatMessageParts";
import MaliPhoneChatSurface from "./components/chat/MaliPhoneChatSurface";
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
import useTransientItem from "./hooks/useTransientItem";
import useDatingApp from "./hooks/dating/useDatingApp";
import { promoteDatingContact } from "./services/dating/datingMatchApply";
import { DATING_PROFILES } from "./data/dating/profiles";
import { DEFAULT_APP_STATE } from "./constants/defaultAppState";
import {
  loadDirectChatGenerator,
  preloadFeatureForApp,
  scheduleIdleFeaturePreload,
} from "./utils/featurePreload";
import {
  selectDirectChatThoughts,
  selectMessageRangeIds,
  selectVisibleChatMessages,
} from "./utils/chatViewSelectors";
import {
  ONLINE_CHAT_TEXT_LIMIT,
  REALITY_CHAT_TEXT_LIMIT,
  displayWalletText as formatWalletDisplayText,
  estimateTokens,
  extractTransferDirective,
  extractTransferResponseDirective,
  getChatTextLimit,
  getLastCommittedChatMode as selectLastCommittedChatMode,
  getMessageMode,
  getModeLabel as localizeChatModeLabel,
  getSelectedChatMode as selectSelectedChatMode,
  isChatMode,
  isGemmaModel,
  normalizeAssistantReply,
  normalizeRealityReply,
  parseShareEventNotice,
  splitAssistantBubbles,
  stripInternalBlocks,
  stripModeLabel,
  stripUserPlaceholder as replaceUserPlaceholder,
} from "./utils/chatMessageUtils";
import {
  sortChatThreads as sortChatThreadsByActivity,
  sortGroupChats,
} from "./utils/chatSorting";
import { sortDisplayCharacters } from "./utils/characterSorting";

// 世界書 AUTO 條目的召回參數。IDF 正規化後 1 分＝在最近訊息命中一個專屬於該條目的詞，
// 門檻略低於 1 是留給浮點誤差與「稍微常見的詞剛好出現在最新一則」的餘裕。
const LOREBOOK_MIN_RECALL_SCORE = 0.9;
const LOREBOOK_KEYWORD_HIT_SCORE = 3;
// 最近 N 則訊息不衰減；再往前每則扣 7% 權重，最低保留 15%。
const LOREBOOK_FULL_WEIGHT_DEPTH = 6;
const LOREBOOK_RECENCY_FALLOFF = 0.07;
const LOREBOOK_MIN_RECENCY_WEIGHT = 0.15;
const SOCIAL_POST_LIMIT = 100;

// 立繪位移：object-position 滑動 cover 的溢出裁切窗口（到邊自動停），
// translate 只用縮放產生的溢出空間（上限 (zoom-1)*50%），兩者相加永遠不會露出背景缺口
export default function MaliPhone() {
  useEffect(() => scheduleIdleFeaturePreload(), []);
  const defaultAppState = DEFAULT_APP_STATE;
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
  const [chatModes, setChatModes] = useState(defaultAppState.chatModes);
  const [chatBackgrounds, setChatBackgrounds] = useState(defaultAppState.chatBackgrounds);
  const [chatBgEditor, setChatBgEditor] = useState(null);
  const [groupChats, setGroupChats] = useState(defaultAppState.groupChats);
  const [chatScenes, setChatScenes] = useState(defaultAppState.chatScenes);
  const [groupScenes, setGroupScenes] = useState(defaultAppState.groupScenes);
  const [chatTimeSettings, setChatTimeSettings] = useState(defaultAppState.chatTimeSettings);
  const [innerThoughtSettings, setInnerThoughtSettings] = useState(defaultAppState.innerThoughtSettings);
  const [proactiveSettings, setProactiveSettings] = useState(defaultAppState.proactiveSettings);
  const [proactiveUnread, setProactiveUnread] = useState(defaultAppState.proactiveUnread);
  const [expandedInnerThoughts, setExpandedInnerThoughts] = useState({});
  const [innerThoughtLoading, setInnerThoughtLoading] = useState({});
  const [chatInput, setChatInput] = useState("");
  const [chatImage, setChatImage] = useState(null);
  const [chatPseudoImage, setChatPseudoImage] = useState(null);
  const [chatPseudoVoiceMode, setChatPseudoVoiceMode] = useState(false);
  const [memoryCard, setMemoryCard] = useState(null);
  // 記住每個角色上次生成記憶時的最後一則訊息 id：用來在「沒有新對話又生成」時給軟提示（不擋）。
  const [lastMemGenMsgId, setLastMemGenMsgId] = useState({});
  const [chatActionPanelOpen, setChatActionPanelOpen] = useState(false);
  const [chatListTab, setChatListTab] = useState("friends");
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [groupCreateName, setGroupCreateName] = useState("");
  const [groupCreateRulePrompt, setGroupCreateRulePrompt] = useState("");
  const [groupCreateMemberIds, setGroupCreateMemberIds] = useState([]);
  const [groupCreateSearch, setGroupCreateSearch] = useState("");
  const [groupCreateCover, setGroupCreateCover] = useState("");
  const [groupEditOpen, setGroupEditOpen] = useState(false);
  const [groupEditGroupId, setGroupEditGroupId] = useState(null);
  const [groupEditName, setGroupEditName] = useState("");
  const [groupEditRulePrompt, setGroupEditRulePrompt] = useState("");
  const [groupEditUseRealTime, setGroupEditUseRealTime] = useState(true);
  const [groupEditMemberIds, setGroupEditMemberIds] = useState([]);
  const [groupEditSearch, setGroupEditSearch] = useState("");
  const [groupEditCover, setGroupEditCover] = useState("");
  const [groupCoverCrop, setGroupCoverCrop] = useState(null);
  const [groupEditCoverCrop, setGroupEditCoverCrop] = useState(null);
  const [sceneEditor, setSceneEditor] = useState(null);
  const CHAT_IMAGE_MAX_BYTES = 1024 * 1024; // 1MB
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatChar, setCurrentChatChar] = useState(null);
  const [currentChatGroup, setCurrentChatGroup] = useState(null);
  useEffect(() => setChatPseudoVoiceMode(false), [currentChatChar?.id]);
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
  const [chatLorebookBindings, setChatLorebookBindings] = useState(defaultAppState.chatLorebookBindings);
  const [phoneInboxCache, setPhoneInboxCache] = useState(defaultAppState.phoneInboxCache);
  const [phonePlayerContactLoading, setPhonePlayerContactLoading] = useState(false);
  const [phoneAppCache, setPhoneAppCache] = useState(defaultAppState.phoneAppCache);
  const [phoneAppGenLoading, setPhoneAppGenLoading] = useState(null); // 正在生成的 appId 或 null
  const [diaryPage, setDiaryPage] = useState(0); // 日記目前頁碼；換角色或離開日記時 reset 0
  const [wallet, setWallet] = useState(defaultAppState.wallet);
  const [characterWallets, setCharacterWallets] = useState(defaultAppState.characterWallets);
  const [transfers, setTransfers] = useState(defaultAppState.transfers);
  const [characterBlockStates, setCharacterBlockStates] = useState(defaultAppState.characterBlockStates);
  const [pendingBlockReaction, setPendingBlockReaction] = useState(null);
  const [walletGenLoading, setWalletGenLoading] = useState(false);
  const [apiPresets, setApiPresets] = useState(defaultAppState.apiPresets);
  const { themeName, setThemeName, fontName, setFontName, fontSizeScale, setFontSizeScale, customFontName, setCustomFontName, uiLanguage, setUiLanguage, themeEffectsEnabled, setThemeEffectsEnabled, customCssEnabled, setCustomCssEnabled, customCss, setCustomCss, customCssDraft, setCustomCssDraft, customCssNotice, setCustomCssNotice, customCssGuideOpen, setCustomCssGuideOpen, settingsAppearanceOpen, setSettingsAppearanceOpen, scopedCustomCss } = useAppearanceSettings(defaultAppState);
  useDocumentLocale(uiLanguage);
  const [screenLockTimeout, setScreenLockTimeout] = useState(defaultAppState.screenLockTimeout);
  const [phoneViewCharId, setPhoneViewCharId] = useState(null);
  const [phonePage, setPhonePage] = useState("picker");
  const [phoneActiveThreadId, setPhoneActiveThreadId] = useState("player");
  const [phoneGenLoading, setPhoneGenLoading] = useState(false);
  const [memoryEditor, setMemoryEditor] = useState(null);
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
  const [editingLorebookEntry, setEditingLorebookEntry] = useState(null);
  const [editingLorebookBook, setEditingLorebookBook] = useState(null);
  const [pendingLorebookExport, setPendingLorebookExport] = useState(null);
  const [activeLorebookId, setActiveLorebookId] = useState(null);
  const [viewingLorebookEntry, setViewingLorebookEntry] = useState(null);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSettingsExpandedBooks, setChatSettingsExpandedBooks] = useState({});
  const [chatSettingsBackgroundOpen, setChatSettingsBackgroundOpen] = useState(false);
  const [chatSettingsLorebookOpen, setChatSettingsLorebookOpen] = useState(false);
  const [chatSettingsThoughtsOpen, setChatSettingsThoughtsOpen] = useState(false);
  const [thoughtHistoryPage, setThoughtHistoryPage] = useState(0);
  const [pendingThoughtScrollId, setPendingThoughtScrollId] = useState(null);
  const [highlightedThoughtMessageId, setHighlightedThoughtMessageId] = useState(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [chatroomManageOpen, setChatroomManageOpen] = useState(false);
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
  const {
    chatRooms, activeRoomIds, loadRoomState,
    activateRoom: activateCharacterRoom,
    createRoom: createCharacterRoom,
    renameRoom: renameCharacterRoom,
    deleteRoom: deleteCharacterRoom,
    clearRoom: clearCharacterRoom,
    addCharacterRoom, removeCharacterRooms, clearRooms,
  } = useCharacterChatRooms({
    characters, setCharacters, chatHistory, setChatHistory, memories, setMemories,
    chatScenes, setChatScenes,
    currentChatChar, setCurrentChatChar, setChatInput, setChatImage, setActiveMessageId,
    setMessageEditor, setIsTyping, setChatVisibleCounts, createId: gid, sanitizeText, tr,
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

  const applyPersonaData = (data = {}) => {
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
    setSocialSettings(data.socialSettings || defaultAppState.socialSettings);
    setMemories(roomState.memories);
    setChatLorebookBindings(data.chatLorebookBindings || {});
    setPhoneInboxCache(data.phoneInboxCache || {});
    setPhoneAppCache(data.phoneAppCache || {});
    setWallet(data.wallet || defaultAppState.wallet);
    setCharacterWallets(data.characterWallets || {});
    setTransfers(Array.isArray(data.transfers) ? data.transfers : []);
    setCharacterBlockStates(normalizeCharacterBlockStates(data.characterBlockStates));
    setPlayerProfile(data.playerProfile || defaultAppState.playerProfile);
    setCurrentChatChar(null);
    setCurrentChatGroup(null);
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

  const applyLoadedAppState = (data) => {
  const personaState = personaController.hydratePersonas(data);
  data = { ...data, ...personaState.activeData };
  const roomState = loadRoomState(data, data.characters || []);
  const characterChatMeta = data.characterChatMeta || {};
  setCharacters(roomState.characters.map((character) => {
    const meta = characterChatMeta[character.id];
    if (!meta) return character;
    return {
      ...character,
      pinned: !!meta.pinned,
      chatOpenedAt: Number(meta.chatOpenedAt) || 0,
      chatroomDeleted: !!meta.chatroomDeleted,
      chatroomDeletedAt: Number(meta.chatroomDeletedAt) || 0,
    };
  }));
  setActiveCharId(data.activeCharId ?? null);
  setChatHistory(roomState.chatHistory);
  setChatModes(data.chatModes || {});
  setChatBackgrounds(data.chatBackgrounds && typeof data.chatBackgrounds === "object" ? data.chatBackgrounds : defaultAppState.chatBackgrounds);
  setGroupChats(Array.isArray(data.groupChats) ? data.groupChats : []);
  setChatScenes(roomState.chatScenes);
  setGroupScenes(data.groupScenes && typeof data.groupScenes === "object" ? data.groupScenes : defaultAppState.groupScenes);
  setChatTimeSettings(data.chatTimeSettings && typeof data.chatTimeSettings === "object" ? data.chatTimeSettings : defaultAppState.chatTimeSettings);
  setInnerThoughtSettings(data.innerThoughtSettings && typeof data.innerThoughtSettings === "object" ? data.innerThoughtSettings : defaultAppState.innerThoughtSettings);
  setProactiveSettings(data.proactiveSettings && typeof data.proactiveSettings === "object" ? data.proactiveSettings : defaultAppState.proactiveSettings);
  setProactiveUnread(data.proactiveUnread && typeof data.proactiveUnread === "object" ? data.proactiveUnread : defaultAppState.proactiveUnread);
  notificationCenter.hydrate(data);
  setPosts(data.posts || []);
  setSocialSettings(data.socialSettings && typeof data.socialSettings === "object" ? data.socialSettings : defaultAppState.socialSettings);
  setMemories(roomState.memories);
  setPhoneInboxCache(data.phoneInboxCache || {});
  setPhoneAppCache(data.phoneAppCache || {});
  setWallet(data.wallet || defaultAppState.wallet);
  setCharacterWallets(data.characterWallets || {});
  setTransfers(Array.isArray(data.transfers) ? data.transfers : []);
  setCharacterBlockStates(normalizeCharacterBlockStates(data.characterBlockStates));
  setScreenLockTimeout(Number.isFinite(Number(data.screenLockTimeout)) ? Number(data.screenLockTimeout) : defaultAppState.screenLockTimeout);
  setApiPresets(Array.isArray(data.apiPresets) && data.apiPresets.length ? data.apiPresets : defaultAppState.apiPresets);
  setPlayerProfile(data.playerProfile || defaultAppState.playerProfile);
  setChatLorebookBindings(data.chatLorebookBindings || {});
  const loadedLorebooks = Array.isArray(data.lorebooks) ? data.lorebooks : [];
  if (loadedLorebooks.length) {
    setLorebooks(loadedLorebooks);
    setActiveLorebookId(loadedLorebooks[0]?.id || null);
  } else if (Array.isArray(data.lorebookEntries) && data.lorebookEntries.length) {
    const migrated = [{
      id: gid(),
      name: "預設世界書",
      description: "",
      enabled: true,
      updatedAt: Date.now(),
      entries: data.lorebookEntries,
    }];
    setLorebooks(migrated);
    setActiveLorebookId(migrated[0].id);
  } else {
    setLorebooks([]);
    setActiveLorebookId(null);
  }
  setApiConfig(data.apiConfig || defaultAppState.apiConfig);
  setTtsConfig(data.ttsConfig && typeof data.ttsConfig === "object" ? {
    ...defaultAppState.ttsConfig,
    ...data.ttsConfig,
    elevenlabs: { ...defaultAppState.ttsConfig.elevenlabs, ...(data.ttsConfig.elevenlabs || {}) },
    minimax: { ...defaultAppState.ttsConfig.minimax, ...(data.ttsConfig.minimax || {}) },
  } : defaultAppState.ttsConfig);
  setThemeName(data.themeName || defaultAppState.themeName);
  setFontName(FONT_PRESETS[data.fontName] ? data.fontName : defaultAppState.fontName);
  setFontSizeScale(["normal", "large", "xlarge", "xxlarge"].includes(data.fontSizeScale) ? data.fontSizeScale : defaultAppState.fontSizeScale);
  setUiLanguage(normalizeUiLanguage(data.uiLanguage, defaultAppState.uiLanguage));
  const initialDock = (data.dockOrder && Array.isArray(data.dockOrder)) ? data.dockOrder : DOCK_APPS;
  setDockOrder(initialDock);
  if (data.homeSlots && Array.isArray(data.homeSlots) && data.homeSlots.length === HOME_SLOT_COUNT) {
    setHomeSlots(normalizeHomeSlots(data.homeSlots, DEFAULT_APPS.map((app) => app.id), initialDock));
  } else {
    const fallbackOrder = (data.homeOrder && Array.isArray(data.homeOrder))
      ? data.homeOrder
      : DEFAULT_APPS.filter(a => !DOCK_APPS.includes(a.id)).map(a => a.id);
    const nextSlots = Array.from({ length: HOME_SLOT_COUNT }, () => null);
    fallbackOrder
      .filter((id) => !initialDock.includes(id))
      .slice(0, HOME_PAGE_SIZE)
      .forEach((id, i) => { nextSlots[HOME_PAGE_SIZE + i] = id; });
    setHomeSlots(normalizeHomeSlots(nextSlots, DEFAULT_APPS.map((app) => app.id), initialDock));
  }

  };
  const dating = useDatingApp({ apiConfig, playerName: playerProfile?.name, onError: (message) => showToast(message) });
  const notificationCenter = useNotificationCenter({
    characters, chatHistory, proactiveUnread, locked, currentApp,
    datingState: dating.state, datingProfiles: DATING_PROFILES,
    posts, mailboxMails,
  });
  const activePersonaData = captureCurrentPersona();
  const persistenceSnapshot = {
    characters, activeCharId, chatHistory, chatRooms, activeRoomIds, chatModes,
    chatBackgrounds, groupChats, chatScenes, groupScenes, chatTimeSettings,
    innerThoughtSettings, proactiveSettings, proactiveUnread, posts, socialSettings,
    memories, lorebooks, chatLorebookBindings, phoneInboxCache, phoneAppCache, wallet,
    characterWallets, transfers, characterBlockStates, screenLockTimeout, apiPresets,
    playerProfile, apiConfig, ttsConfig, ...notificationCenter.persisted, themeName,
    fontName, fontSizeScale, uiLanguage, homeSlots, dockOrder,
    personas: serializePersonas(personaController.personas, personaController.activePersonaId, activePersonaData),
    activePersonaId: personaController.activePersonaId,
  };
  const { hydrated } = useAppPersistence({
    defaults: defaultAppState,
    snapshot: persistenceSnapshot,
    loadState: loadAppState,
    saveState: saveAppState,
    syncOnBoot,
    schedulePush,
    onLoad: applyLoadedAppState,
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
    if (!pendingThoughtScrollId || chatSettingsOpen) return;
    const frame = requestAnimationFrame(() => {
      const container = chatMsgsRef.current;
      const target = container
        ? Array.from(container.querySelectorAll("[data-message-id]")).find((node) => node.dataset.messageId === pendingThoughtScrollId)
        : null;
      if (!target) return;
      const targetTop = target.offsetTop - (container.clientHeight - target.clientHeight) / 2;
      container.scrollTop = Math.max(0, targetTop);
      setExpandedInnerThoughts((prev) => ({ ...prev, [pendingThoughtScrollId]: true }));
      setHighlightedThoughtMessageId(pendingThoughtScrollId);
      setPendingThoughtScrollId(null);
      setTimeout(() => { thoughtJumpInProgressRef.current = false; }, 500);
      setTimeout(() => setHighlightedThoughtMessageId(null), 1800);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingThoughtScrollId, chatSettingsOpen, chatVisibleCounts, chatHistory]);
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
    if (!hydrated || currentApp !== "social") return;
    notificationCenter.markSocialRead();
    setSocialTick(Date.now());
    const hasPendingLikes = (posts || []).some((p) => (
      (p.likedBy || []).some((x) => (x.time || 0) > Date.now())
    ));
    if (!hasPendingLikes) return;
    const timer = setInterval(() => setSocialTick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [hydrated, currentApp, posts]);
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
      normalized[charId] = (arr || []).map((m) => {
        const next = {
          id: m.id || gid(),
          text: sanitizeText(m.text, 500),
          date: m.date || Date.now(),
          pinned: !!m.pinned,
        };
        if (!m.id || typeof m.pinned === "undefined" || next.text !== m.text) changed = true;
        return next;
      }).slice(0, 30);
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
    if (!currentChatChar) return;
    if (thoughtJumpInProgressRef.current) return;
    const el = chatMsgsRef.current || messagesEndRef.current?.parentElement;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollTop = el.scrollHeight;
      setShowScrollToBottom(false);
    }, 0);
    return () => clearTimeout(t);
  }, [currentChatChar?.id, chatHistory, isTyping, chatVisibleCounts]);
  useEffect(() => {
    if (!currentChatGroup) return;
    const el = chatMsgsRef.current || messagesEndRef.current?.parentElement;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollTop = el.scrollHeight;
      setShowScrollToBottom(false);
    }, 0);
    return () => clearTimeout(t);
  }, [currentChatGroup?.id, groupChats, isTyping]);
  const updateScrollToBottomVisibility = (element) => {
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 250);
  };
  const scrollCurrentChatToBottom = () => {
    const element = chatMsgsRef.current;
    if (!element) return;
    thoughtJumpInProgressRef.current = false;
    setHighlightedThoughtMessageId(null);
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    setShowScrollToBottom(false);
  };
  const getCurrentChatScrollKey = () => currentChatChar?.id ? `${currentChatChar.id}::${activeRoomIds[currentChatChar.id] || "default"}` : null;
  const rememberCurrentChatScroll = (element = chatMsgsRef.current) => {
    const key = getCurrentChatScrollKey();
    if (!key || !element) return;
    chatScrollPositionsRef.current[key] = {
      scrollTop: element.scrollTop,
      distanceFromBottom: Math.max(0, element.scrollHeight - element.scrollTop - element.clientHeight),
    };
  };
  useEffect(() => {
    if (chatSettingsOpen || !currentChatChar?.id) return;
    const key = getCurrentChatScrollKey();
    const saved = key ? chatScrollPositionsRef.current[key] : null;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      const element = chatMsgsRef.current;
      if (!element) return;
      if (saved) {
        const fromBottom = Math.max(0, Number(saved.distanceFromBottom) || 0);
        element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - fromBottom);
      } else {
        element.scrollTop = element.scrollHeight;
      }
      updateScrollToBottomVisibility(element);
    }));
    return () => cancelAnimationFrame(frame);
  }, [chatSettingsOpen, currentChatChar?.id, activeRoomIds[currentChatChar?.id]]);
  useEffect(() => {
    if (!currentChatChar) return;
    setChatVisibleCounts((prev) => {
      const current = prev[currentChatChar.id];
      if (current === 50) return prev;
      return { ...prev, [currentChatChar.id]: 50 };
    });
  }, [currentChatChar?.id]);
  useEffect(() => {
    const adjust = chatLoadAdjustRef.current;
    if (!adjust?.charId) return;
    if (adjust.charId !== currentChatChar?.id) return;
    const el = chatMsgsRef.current;
    if (!el) return;
    const diff = el.scrollHeight - (adjust.prevScrollHeight || el.scrollHeight);
    if (diff > 0) el.scrollTop = (adjust.prevScrollTop || 0) + diff;
    chatLoadAdjustRef.current = null;
  }, [currentChatChar?.id, chatVisibleCounts]);
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

  const extractRealitySpeech = (text) => {
    const parts = [];
    const source = String(text || "");
    const pattern = /「([^」]+)」|“([^”]+)”|"([^"]+)"/g;
    let match;
    while ((match = pattern.exec(source))) parts.push(match[1] || match[2] || match[3]);
    return parts.join(" ").trim();
  };
  const getReplySpeechText = (charId, message) => {
    const history = chatHistory[charId] || [];
    const group = message.replyGroupId
      ? history.filter((item) => item.role === "assistant" && item.replyGroupId === message.replyGroupId)
      : [message];
    const combined = group.map((item) => stripModeLabel(stripInternalBlocks(item.content || ""))).filter(Boolean).join("\n");
    const speech = getMessageMode(message) === "reality" ? extractRealitySpeech(combined) : combined;
    return speech.replace(/\*\*|__|[*_`#]/g, "").trim();
  };
  const ttsGenerationTargetRef = useRef(null);
  const markMessageVoiceGenerated = (char, message) => {
    const generatedAt = Date.now();
    setChatHistory((history) => ({
      ...history,
      [char.id]: (history[char.id] || []).map((item) => {
        const belongsToReply = message.replyGroupId
          ? item.role === "assistant" && item.replyGroupId === message.replyGroupId
          : item.id === message.id;
        return belongsToReply ? { ...item, ttsGeneratedAt: generatedAt } : item;
      }),
    }));
  };
  const { voices: ttsVoices, setVoices: setTtsVoices, connectionState: ttsConnectionState, setConnectionState: setTtsConnectionState, playback: voicePlayback, stop: stopCurrentVoiceAudio, clearCache: clearVoicePlaybackCache, previewCharacterVoice, loadDefaultVoices: loadElevenLabsDefaultVoices, previewDefaultVoice: previewDefaultTtsVoice, toggleCharacterVoice } = useVoicePlayback({
    config: ttsConfig, setConfig: setTtsConfig, fetchVoices: fetchElevenLabsDefaultVoices,
    synthesizeSpeech: async (options) => {
      const blob = await synthesizeSpeech(options);
      const target = ttsGenerationTargetRef.current;
      if (target) markMessageVoiceGenerated(target.char, target.message);
      return blob;
    },
    getSpeechText: getReplySpeechText, showToast, sanitizeText, tr,
  });
  const renderCharacterVoiceAction = (char, message, isActive, collapseWhenHidden = false) => {
    if (!ttsConfig.enabled || !char?.voiceSettings?.enabled) return null;
    const key = `${ttsConfig.provider || "elevenlabs"}:${char.id}:${message.replyGroupId || message.id}`;
    const status = voicePlayback.key === key ? voicePlayback.status : "idle";
    return (
      <CharacterVoiceAction visible={isActive || status !== "idle"} collapseWhenHidden={collapseWhenHidden} status={status} onToggle={() => {
        ttsGenerationTargetRef.current = { char, message };
        void toggleCharacterVoice(char, message).finally(() => { ttsGenerationTargetRef.current = null; });
      }} tr={tr} />
    );
  };
  const getCharacterVoiceBubblePlayback = (char, message) => {
    const key = `${ttsConfig.provider || "elevenlabs"}:${char.id}:${message.id}`;
    return {
      status: voicePlayback.key === key ? voicePlayback.status : "idle",
      onToggle: () => {
        if (!ttsConfig.enabled) {
          showToast("請先在設定中啟用語音功能");
          return;
        }
        if (!char?.voiceSettings?.enabled) {
          showToast("請先為此角色啟用語音");
          return;
        }
        ttsGenerationTargetRef.current = { char, message };
        void toggleCharacterVoice(char, message).finally(() => { ttsGenerationTargetRef.current = null; });
      },
    };
  };
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
  const getCalendarContext = (query) => buildCalendarPromptContext(calendarEvents, query);
  const getCalendarReminderContext = () => takeCalendarChatReminder(calendarEvents);
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
      if (appId === "social") notificationCenter.markSocialRead();
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
  const saveEditedMemory = () => {
    if (!memoryEditor) return;
    const nextText = sanitizeText(memoryEditor.text, 500);
    setMemories((previous) => ({
      ...previous,
      [memoryEditor.charId]: (previous[memoryEditor.charId] || []).map((memory) =>
        memory.id === memoryEditor.memoryId ? { ...memory, text: nextText } : memory
      ),
    }));
    setMemoryEditor(null);
    showToast(tr("記憶已更新", "Memory updated", "メモリを更新しました", "기억이 업데이트되었습니다"));
  };
  const closeMessageEditor = () => setMessageEditor(null);
  const deleteChatMessage = (charId, messageId) => {
    setChatHistory((h) => ({ ...h, [charId]: (h[charId] || []).filter((m) => m.id !== messageId) }));
    setActiveMessageId(null);
  };
  const startNoticeLongPress = (messageId) => {
    clearTimeout(noticeLongPressTimerRef.current);
    noticeLongPressTimerRef.current = setTimeout(() => {
      setActiveMessageId(messageId);
    }, 450);
  };
  const cancelNoticeLongPress = () => {
    clearTimeout(noticeLongPressTimerRef.current);
    noticeLongPressTimerRef.current = null;
  };
  const saveEditedMessage = () => {
    if (!messageEditor) return;
    if (currentChatGroup && !currentChatChar) {
      const next = (currentChatGroup.messages || []).map((m) =>
        m.id === messageEditor.id ? { ...m, content: sanitizeText(messageEditor.content, 4000) } : m
      );
      setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: next, updatedAt: Date.now() } : g));
    } else if (currentChatChar) {
      const cid = currentChatChar.id;
      const limit = messageEditor.pseudoVoice ? PSEUDO_VOICE_TEXT_LIMIT : getChatTextLimit(messageEditor.mode);
      const next = (chatHistory[cid] || []).map((m) =>
        m.id === messageEditor.id ? {
          ...m,
          content: sanitizeText(messageEditor.content, limit),
          ...(messageEditor.pseudoVoice ? { pseudoVoice: createPseudoVoice(sanitizeText(messageEditor.content, limit)) } : {}),
        } : m
      );
      setChatHistory((h) => ({ ...h, [cid]: next }));
    } else {
      return;
    }
    setMessageEditor(null);
    setActiveMessageId(null);
    showToast(tr("訊息已更新", "Message updated", "メッセージを更新しました", "메시지가 업데이트되었습니다"));
  };
  const deleteMessageWithConfirm = () => {
    if (!messageEditor) return;
    if (!window.confirm(tr("確定要刪除這則對話嗎？", "Delete this message?", "このメッセージを削除しますか？", "이 메시지를 삭제할까요?"))) return;
    if (currentChatGroup && !currentChatChar) {
      const next = (currentChatGroup.messages || []).filter((m) => m.id !== messageEditor.id);
      setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: next, updatedAt: Date.now() } : g));
    } else if (currentChatChar) {
      const cid = currentChatChar.id;
      const next = (chatHistory[cid] || []).filter((m) => m.id !== messageEditor.id);
      setChatHistory((h) => ({ ...h, [cid]: next }));
    } else {
      return;
    }
    setMessageEditor(null);
    setActiveMessageId(null);
    showToast(tr("訊息已刪除", "Message deleted", "メッセージを削除しました", "메시지가 삭제되었습니다"));
  };
  const isInnerThoughtAutoEnabled = (charId) => innerThoughtSettings?.[charId]?.auto !== false;
  const setInnerThoughtAutoEnabled = (charId, enabled) => {
    setInnerThoughtSettings((prev) => ({
      ...(prev || {}),
      [charId]: { ...(prev?.[charId] || {}), auto: !!enabled },
    }));
  };
  const isChatRealTimeEnabled = (charId) => chatTimeSettings?.[charId]?.enabled !== false;
  const setChatRealTimeEnabled = (charId, enabled) => {
    setChatTimeSettings((prev) => ({
      ...(prev || {}),
      [charId]: { ...(prev?.[charId] || {}), enabled: !!enabled },
    }));
  };
  const isGroupRealTimeEnabled = (group) => group?.useRealTime !== false;
  const isProactiveEnabled = (charId) => !!proactiveSettings?.[charId]?.enabled;
  const getProactiveFrequency = (charId) => proactiveSettings?.[charId]?.frequency || "normal";
  const setProactiveEnabled = (charId, enabled) => {
    setProactiveSettings((prev) => ({
      ...(prev || {}),
      [charId]: { ...(prev?.[charId] || {}), enabled: !!enabled },
    }));
  };
  const setProactiveFrequency = (charId, frequency) => {
    setProactiveSettings((prev) => ({
      ...(prev || {}),
      [charId]: { ...(prev?.[charId] || {}), frequency },
    }));
  };
  const getLastCommittedChatMode = (charId) => selectLastCommittedChatMode(chatHistory, charId);
  const getSelectedChatMode = (charId) => selectSelectedChatMode(chatModes, chatHistory, charId);
  const setSelectedChatMode = (charId, mode) => {
    if (!charId || !isChatMode(mode)) return;
    // Changing the mode changes message styling/layout. Preserve the user's
    // current position instead of letting the rebuilt list jump to the top.
    const element = chatMsgsRef.current;
    const distanceFromBottom = element
      ? element.scrollHeight - element.scrollTop - element.clientHeight
      : null;
    setChatModes((prev) => ({ ...(prev || {}), [charId]: mode }));
    const character = characters.find((item) => String(item.id) === String(charId));
    const openingSource = mode === "reality"
      ? character?.initialRealityMessage
      : (character?.initialOnlineMessage ?? character?.firstMessage);
    const openingContent = sanitizeText(openingSource || "", 4000).trim();
    const currentMessages = chatHistory[charId] || [];
    // 房裡目前只有開場白／切換標記（還沒真正開始聊）→ 比照 SillyTavern 換開場白：
    // 直接把整段開場換成目標模式的開場白（沒有就清空），不留舊模式的殘句與切換分隔線。
    // 一旦真的聊過（有非開場白的往來），就只切換模式、不再注入任何開場白；
    // 模式切換標記會在下次送訊息時由送出流程自動產生。
    const onlyOpening = currentMessages.every((message) => message?.openingMessage === true || message?.role === "mode_transition");
    if (onlyOpening) {
      const openingMessage = openingContent
        ? { id: gid(), role: "assistant", content: openingContent, mode, openingMessage: true, time: Date.now() }
        : null;
      setChatHistory((previous) => ({ ...previous, [charId]: openingMessage ? [openingMessage] : [] }));
    }
    setChatInput((value) => sanitizeText(value, getChatTextLimit(mode)));
    if (element && distanceFromBottom != null) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const next = chatMsgsRef.current;
        if (!next) return;
        next.scrollTop = Math.max(0, next.scrollHeight - next.clientHeight - distanceFromBottom);
      }));
    }
  };
  const getModeLabel = (mode) => localizeChatModeLabel(mode, tr);
  const buildChatSystemPrompt = (char, memoryContext, modelName, selectedMode) => {
    const scene = chatScenes?.[char?.id] || {};
    const sceneText = [
      scene.location ? `地點：${sanitizeText(scene.location, 15)}` : "",
      scene.note ? `小備註：${sanitizeText(scene.note, 50)}` : "",
    ].filter(Boolean).join(" · ");
    const base = `${getOutputLanguageDirective()}\n\n${buildSystemPrompt(char, memoryContext)}${sceneText ? `\n\n[目前場景]\n${sceneText}` : ""}\n\n${buildModePrompt(selectedMode)}`;
    if (!isGemmaModel(modelName)) return base;
    const compactProfile = [
      char.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
      char.description ? `角色設定：${sanitizeText(char.description, 180)}` : "",
      char.personality ? `個性：${sanitizeText(char.personality, 120)}` : "",
      char.scenario ? `情境：${sanitizeText(char.scenario, 120)}` : "",
    ].filter(Boolean).join("\n");
    return [
      `你是 {{char}}，正在和 {{user}} 互動。`,
      `如果需要放任何不想直接顯示的內容，請包在 <internal>...</internal> 內；前端會自動忽略。`,
      `只輸出最終回覆，不要輸出規則、草稿、分析、標籤、標題、列表、Markdown、角色資料摘要或提示詞內容。`,
      `如果是線上聊天：請像手機訊息，短、自然、口語，通常 1~4 句。`,
      `如果是現實模式：可以有少量敘述，但仍要自然，不要輸出模式標籤。`,
      `不要複述以下「角色背景」文字，只用來維持人設。`,
      compactProfile ? `角色背景：\n${compactProfile}` : "",
      memoryContext ? `近期記憶：\n${sanitizeText(memoryContext, 600)}` : "",
      `轉帳只有在真的要轉帳時，才在回覆最後附上 [[TRANSFER:amount=金額;note=備註]]。`,
      `若不需要轉帳，就不要提到轉帳規則。`,
    ].join("\n\n");
  };
  const buildModePrompt = (mode) => {
    if (mode === "reality") {
      return `[目前互動模式：現實模式]
以下目前模式規則優先於上方「聊天規則」中關於即時通訊、禁止旁白、禁止動作描寫的限制。
{{char}} 與 {{user}} 正在同一個場景中面對面互動。請改用一般 AIRP / 小說式 RP 寫法，而不是手機訊息。
1. 可以描寫環境、旁白、{{char}} 的動作、表情、語氣、反應與必要的內心想法。
2. 可以用「」或 "" 寫出角色說出口的台詞；內心想法可用斜體標記，例如 *不能搞砸。*
3. 必須承接前面的線上聊天內容，讓現實互動和線上聊天對得上。
4. 不要替 {{user}} 決定重大行動、台詞、情緒或內心想法；只可描寫 {{user}} 已明確輸入的行動與可觀察結果。
5. 單次回覆上限約 4000 字，避免一次推進太多情節。
6. 預設使用繁體中文與台灣常用語。不要輸出角色名標籤、系統說明、規則文字或元敘事。
重要：不要輸出任何模式標籤或狀態標記，例如「[現實模式]」、「【現實模式】」、「目前互動模式：現實模式」；直接輸出角色要說的內容與敘述即可。`;
    }
    return `[目前互動模式：線上聊天]
{{char}} 與 {{user}} 正透過手機即時通訊聊天。請維持短訊息感，不要加入旁白、內心獨白或動作描寫。
重要：不要輸出任何模式標籤或狀態標記，例如「[線上聊天]」、「【線上聊天】」、「目前互動模式：線上聊天」；直接輸出角色要說的內容即可。`;
  };
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
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const formatMoney = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");
  // \u4e2d\u6587\u6539\u7528 bigram\uff08\u9023\u7e8c\u4e8c\u5b57\uff09\u5207\u8a5e\uff1a\u55ae\u5b57\u5207\u5206\u6703\u8b93\u300c\u706b\u300d\u8aa4\u547d\u4e2d\u300c\u706b\u934b\u300d\u3001\u300c\u767d\u300d\u8aa4\u547d\u4e2d\u300c\u660e\u767d\u300d\uff0c
  // \u9020\u6210\u4e16\u754c\u66f8\u8207\u8a18\u61b6\u53ec\u56de\u5927\u91cf\u566a\u97f3\u3002\u82f1\u6578\u8a5e\u7dad\u6301\u6574\u6bb5\u4fdd\u7559\u3002
  const tokenizeForRecall = (text) => {
    const s = String(text || "").toLowerCase();
    const chunks = s.match(/[a-z0-9_]+|[\u4e00-\u9fff]+/g) || [];
    const tokens = new Set();
    chunks.forEach((chunk) => {
      if (!/^[\u4e00-\u9fff]/.test(chunk)) {
        tokens.add(chunk);
        return;
      }
      if (chunk.length === 1) {
        tokens.add(chunk);
        return;
      }
      for (let i = 0; i < chunk.length - 1; i += 1) tokens.add(chunk.slice(i, i + 2));
    });
    return tokens;
  };
  const normalizeForMatch = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[，。！？、,.!?\s]+/g, " ")
      .trim();
  const {
    buildSocialPostPrompt, formatPostTime, getPostAuthorName, getPostAuthorAvatar,
    getPostAuthorType, getPlayerDisplayName, getPlayerAvatar, getConnectionErrorPrefix,
    isConnectionErrorNotice, formatSocialCount, rollCharacterPostLikes,
    shouldClampSocialPost, shouldScrollComments, getCommentDepth, getCommentAuthorName,
    insertCommentAfterThread, buildMemoryDigest, buildSocialCommentReplyPrompt,
    pickPlayerPostReactors, getPostLikeCount, getLikedByListText,
    pickPlayerPostResponders, buildPlayerPostReplyPrompt,
  } = createSocialFeedHelpers({
    chatHistory, getModeLabel, getMessageMode, sanitizeText, posts,
    getOutputLanguageDirective, tr, uiLanguage, playerProfile, sanitizeUserImageUrl,
    normalizeForMatch, tokenizeForRecall, memories, activeCharId, characters, socialTick,
  });
  const { specialMemories: gachaSpecialMemories, compactEpisodeImages } = useGacha();
  useEffect(() => {
    if (!hydrated) return;
    compactEpisodeImages(characters);
  }, [hydrated, characters, compactEpisodeImages]);
  // 特別記憶（抽卡特別篇凝結而來）獨立於 30 條長期記憶之外。
  // 數量不設上限，但注入固定最多 6 條：釘選 3 ＋ 最新 2 ＋ 關鍵字召回 3（去重）。
  const pickSpecialMemoriesForPrompt = (charId, qTokens) => {
    const all = gachaSpecialMemories.filter((m) => String(m.characterId) === String(charId) && m.text);
    if (!all.length) return [];
    const pinned = all.filter((m) => m.pinned).slice(0, 3);
    const rest = all.filter((m) => !m.pinned);
    const newest = rest.slice(0, 2);
    const newestIds = new Set(newest.map((m) => m.id));
    const recalled = rest
      .filter((m) => !newestIds.has(m.id))
      .map((m) => {
        let hit = 0;
        tokenizeForRecall(`${m.title} ${m.text}`).forEach((t) => { if (qTokens.has(t)) hit += 1; });
        return { m, hit };
      })
      .filter((x) => x.hit > 0)
      .sort((a, b) => b.hit - a.hit || (b.m.createdAt || 0) - (a.m.createdAt || 0))
      .slice(0, 3)
      .map((x) => x.m);
    return [...pinned, ...newest, ...recalled].slice(0, 6).map((m) => ({ id: m.id, text: `【特別記憶｜${m.title}】${m.text}` }));
  };
  const pickMemoriesForPrompt = (charId, recentMsgs) => {
    const queryTokens = tokenizeForRecall(recentMsgs.map((m) => `${m.role}:${m.content || ""}`).join("\n"));
    const special = pickSpecialMemoriesForPrompt(charId, queryTokens);
    const list = (memories[charId] || []).filter((m) => m?.text);
    if (!list.length) return special;
    const pinned = list.filter((m) => m.pinned).slice(0, 5);
    const unpinned = list.filter((m) => !m.pinned);
    const scored = unpinned.map((m) => {
      const tks = tokenizeForRecall(m.text);
      let hit = 0;
      tks.forEach((t) => { if (queryTokens.has(t)) hit += 1; });
      return { m, hit };
    });
    scored.sort((a, b) => b.hit - a.hit || (b.m.date || 0) - (a.m.date || 0));
    const recalled = scored.filter((x) => x.hit > 0).slice(0, 3).map((x) => x.m);
    return [...special, ...pinned, ...recalled];
  };
  const { generateInnerThought, renderInnerThought } = useInnerThought({
    chatHistory,
    chatScenes,
    innerThoughtLoading,
    expandedInnerThoughts,
    apiConfig,
    setChatHistory,
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
  const getChatLorebookBinding = (charId) => {
    const fallbackBookIds = (lorebooks || []).map((b) => b.id);
    const binding = chatLorebookBindings?.[charId];
    if (!binding) return { enabledBookIds: fallbackBookIds, entryOverrides: {}, entryModes: {} };
    return {
      enabledBookIds: Array.isArray(binding.enabledBookIds) ? binding.enabledBookIds : fallbackBookIds,
      entryOverrides: binding.entryOverrides || {},
      entryModes: binding.entryModes || {},
    };
  };
  const toggleChatLorebookBook = (charId, bookId) => {
    setChatLorebookBindings((prev) => {
      const current = prev?.[charId] || {
        enabledBookIds: (lorebooks || []).map((b) => b.id),
        entryOverrides: {},
        entryModes: {},
      };
      const exists = current.enabledBookIds.includes(bookId);
      const enabledBookIds = exists
        ? current.enabledBookIds.filter((id) => id !== bookId)
        : [...current.enabledBookIds, bookId];
      return { ...prev, [charId]: { ...current, enabledBookIds } };
    });
  };
  const toggleChatLorebookEntry = (charId, entryId, defaultEnabled) => {
    setChatLorebookBindings((prev) => {
      const current = prev?.[charId] || {
        enabledBookIds: (lorebooks || []).map((b) => b.id),
        entryOverrides: {},
        entryModes: {},
      };
      const nowEnabled = Object.prototype.hasOwnProperty.call(current.entryOverrides, entryId)
        ? !!current.entryOverrides[entryId]
        : !!defaultEnabled;
      const nextEnabled = !nowEnabled;
      return {
        ...prev,
        [charId]: {
          ...current,
          entryOverrides: { ...current.entryOverrides, [entryId]: nextEnabled },
        },
      };
    });
  };
  const cycleChatLorebookEntryMode = (charId, entryId) => {
    setChatLorebookBindings((prev) => {
      const current = prev?.[charId] || {
        enabledBookIds: (lorebooks || []).map((b) => b.id),
        entryOverrides: {},
        entryModes: {},
      };
      const now = current.entryModes?.[entryId] || "AUTO";
      const next = now === "AUTO" ? "PIN" : "AUTO";
      return {
        ...prev,
        [charId]: {
          ...current,
          entryModes: { ...(current.entryModes || {}), [entryId]: next },
        },
      };
    });
  };
  const setAllChatLorebookEntries = (charId, book, enabled) => {
    if (!book) return;
    setChatLorebookBindings((prev) => {
      const current = prev?.[charId] || {
        enabledBookIds: (lorebooks || []).map((b) => b.id),
        entryOverrides: {},
        entryModes: {},
      };
      const nextOverrides = { ...current.entryOverrides };
      (book.entries || []).forEach((entry) => {
        if (!entry?.id) return;
        nextOverrides[entry.id] = !!enabled;
      });
      return {
        ...prev,
        [charId]: {
          ...current,
          entryOverrides: nextOverrides,
        },
      };
    });
  };
  const pickLorebookEntriesForPrompt = (charId, recentMsgs) => {
    const msgs = recentMsgs || [];
    const latestUserMsg = [...msgs].reverse().find((m) => m?.role === "user")?.content || "";
    const normalizedLatestUser = normalizeForMatch(latestUserMsg);
    // 位置衰減：最近幾則全權重，再往前平滑遞減。取代硬切 scan depth，
    // 避免十幾則前隨口提過一次的條目一直被召回，也不會在邊界突然消失。
    const recencyAt = (idx) => {
      const dist = msgs.length - 1 - idx;
      if (dist < LOREBOOK_FULL_WEIGHT_DEPTH) return 1;
      const decayed = 1 - (dist - LOREBOOK_FULL_WEIGHT_DEPTH + 1) * LOREBOOK_RECENCY_FALLOFF;
      return Math.max(LOREBOOK_MIN_RECENCY_WEIGHT, decayed);
    };
    const scanned = msgs.map((m, idx) => ({
      normalized: normalizeForMatch(m?.content || ""),
      recency: recencyAt(idx),
    }));
    // 同一個詞在多則出現時取最高（＝最新那次）的權重。
    const qTokenWeights = new Map();
    msgs.forEach((m, idx) => {
      const w = recencyAt(idx);
      tokenizeForRecall(m?.content || "").forEach((t) => {
        if ((qTokenWeights.get(t) || 0) < w) qTokenWeights.set(t, w);
      });
    });
    const binding = getChatLorebookBinding(charId);
    const enabledBooks = (lorebooks || []).filter((b) => binding.enabledBookIds.includes(b.id));
    const pinned = [];
    const scannable = [];
    enabledBooks.forEach((book) => {
      (book.entries || []).forEach((entry) => {
        const mode = binding.entryModes?.[entry.id] || "AUTO";
        // PIN 只決定「何時注入」，不應繞過世界書／條目的啟用狀態。
        // 世界書已在 enabledBooks 過濾；條目是否啟用則完全由聊天室設定控制。
        const effectiveEnabled = Object.prototype.hasOwnProperty.call(binding.entryOverrides, entry.id)
          ? !!binding.entryOverrides[entry.id]
          : true;
        if (!effectiveEnabled) return;
        if (mode === "PIN") {
          pinned.push({ entry, bookName: book.name || "世界書", hit: 9999, mode });
          return;
        }
        const keys = Array.isArray(entry.keywords) ? entry.keywords : [];
        scannable.push({
          entry,
          bookName: book.name || "世界書",
          mode,
          keys,
          keyTokens: new Set(keys.flatMap((k) => [...tokenizeForRecall(k)])),
        });
      });
    });
    // 逆文件頻率：出現在越多條目的詞越沒鑑別度。正規化成「只出現在一條的詞＝1 分」，
    // 泛用詞則低於 1 分，這樣門檻不隨世界書大小飄移。
    const df = new Map();
    scannable.forEach(({ keyTokens }) => { keyTokens.forEach((t) => df.set(t, (df.get(t) || 0) + 1)); });
    const totalEntries = Math.max(scannable.length, 1);
    const idfBase = Math.log(1 + totalEntries / 2) || 1;
    const idf = (t) => Math.log(1 + totalEntries / (1 + (df.get(t) || 0))) / idfBase;

    const matched = [];
    scannable.forEach(({ entry, bookName, mode, keys, keyTokens }) => {
      let hit = 0;
      keyTokens.forEach((t) => { hit += idf(t) * (qTokenWeights.get(t) || 0); });
      // AUTO 強觸發：完整關鍵字命中「最新使用者訊息」即直接命中。
      let forcedByKeyword = false;
      keys.forEach((k) => {
        const nk = normalizeForMatch(k);
        if (!nk) return;
        if (normalizedLatestUser.includes(nk)) {
          forcedByKeyword = true;
          hit += 1000;
          return;
        }
        // 完整關鍵字命中舊訊息仍算分，但一樣按新舊衰減。
        let best = 0;
        scanned.forEach((s) => { if (s.recency > best && s.normalized.includes(nk)) best = s.recency; });
        hit += LOREBOOK_KEYWORD_HIT_SCORE * best;
      });
      // 需要至少一個具鑑別度的詞（或多個泛用詞疊加）才召回，避免零散單字撐起分數。
      if (!forcedByKeyword && hit < LOREBOOK_MIN_RECALL_SCORE) return;
      matched.push({ entry, bookName, hit, mode });
    });
    matched.sort((a, b) => b.hit - a.hit || (b.entry.updatedAt || 0) - (a.entry.updatedAt || 0));
    const uniq = new Map();
    [...pinned, ...matched].forEach((x) => { if (!uniq.has(x.entry.id)) uniq.set(x.entry.id, x); });
    return Array.from(uniq.values()).slice(0, 8);
  };

  const formatMessagesForPrompt = (list) => (list || [])
    .map((m) => {
      if (m.role === "mode_transition") {
        return { role: "user", content: `[模式切換]\n接下來從${getModeLabel(m.fromMode)}切換為${getModeLabel(m.toMode)}。請自然承接同一條時間線。`, image: null };
      }
      if (m.role === "transfer") {
        const fromName = m.fromType === "player" ? "你" : (m.fromName || "對方");
        const toName = m.toType === "player" ? "你" : (m.toName || "對方");
        const transfer = (transfers || []).find((item) => item.id === m.transferId);
        const status = transfer?.status === "pending" ? "等待收下" : transfer?.status === "returned" ? "已退回" : transfer?.status === "expired" ? "逾期退回" : "已收下";
        return { role: "user", content: `[轉帳｜${status}] ${fromName}→${toName} ${formatMoney(m.amount || 0)}${m.note ? ` 備註:${sanitizeText(m.note, 60)}` : ""}`, image: null };
      }
      if (m.role === "system_notice") {
        if (isConnectionErrorNotice(m.content)) return null;
        if (m.noticeType === "character_blocked") return { role: "user", content: "[封鎖事件]\n玩家剛剛將你的線上聯絡方式封鎖。這不是玩家說出口的話；請依照角色個性對此作出自然反應。", image: null };
        if (m.noticeType === "character_unblocked") return { role: "user", content: "[解除封鎖事件]\n玩家剛剛解除了對你線上聯絡方式的封鎖。這不是玩家說出口的話。", image: null };
        return { role: "user", content: `[系統備註]\n${m.content || ""}`, image: null };
      }
      if (m.role === "user" || m.role === "assistant" || m.role === "system") {
        const summaryLine = m.imageSummary ? `\n[圖片摘要]\n${m.imageSummary}` : "";
        // 示意圖片只送描述文字，永遠不帶 image：不支援讀圖的模型也能照常回應。
        const pseudoLine = pseudoImagePromptLine(m.pseudoImage, m.role === "user" ? "{{user}}" : "你");
        const voiceLine = pseudoVoicePromptLine(m.pseudoVoice, m.role === "user" ? "{{user}}" : "你");
        const messageText = m.pseudoVoice ? "" : (m.content || "");
        return { role: m.role, content: `${messageText}${pseudoLine}${voiceLine}${summaryLine}`.trim(), image: m.image || null };
      }
      return null;
    })
    .filter(Boolean);
  const generateAssistantForHistory = async (args) => {
    const { generateDirectAssistant } = await loadDirectChatGenerator();
    return generateDirectAssistant({ ...args, includeRealTime: isChatRealTimeEnabled(args.cid) }, {
      formatMessagesForPrompt, pickMemoriesForPrompt, pickLorebookEntriesForPrompt, characterWallets,
      formatMoney, tr, getPlayerContextBlock, getCalendarContext, getCalendarReminderContext, estimateTokens, totalContextTokenLimit: TOTAL_CONTEXT_TOKEN_LIMIT,
      apiConfig, applyUserPlaceholder, buildChatSystemPrompt, callAI, sanitizeText, normalizeRealityReply,
      realityChatTextLimit: REALITY_CHAT_TEXT_LIMIT, normalizeAssistantReply, extractTransferDirective, extractTransferResponseDirective,
      stripModeLabel, stripInternalBlocks, splitAssistantBubbles, createId: gid, wait, setChatHistory,
      applyCharacterTransferToPlayer, transfers, handleCharacterTransferDecision,
      characterBlockStates, buildCharacterBlockPromptContext, buildCharacterBlockCapabilityContext, extractCharacterBlockDirective,
      applyCharacterBlockDirective: (cid, action) => setCharacterBlocksPlayer(cid, action === "block"),
      isInnerThoughtAutoEnabled, generateInnerThought,
    });
  };

  useEffect(() => {
    if (!pendingBlockReaction) return;
    const { cid, noticeId } = pendingBlockReaction;
    const char = characters.find((item) => item.id === cid);
    const history = chatHistory[cid] || [];
    const notice = history.find((item) => item.id === noticeId);
    if (!char || !notice || !characterBlockStates?.[cid]?.blocked) return;
    setPendingBlockReaction(null);
    void generateAssistantForHistory({ cid, char, nextForDisplay: history, selectedMode: "online", um: notice, text: "" })
      .catch((error) => console.warn("[block reaction]", error));
  }, [pendingBlockReaction, characterBlockStates, chatHistory]);

  const setCharacterBlocked = (character, blocked) => {
    if (!character?.id) return;
    const cid = character.id;
    const now = Date.now();
    const roomId = activeRoomIds[cid] || null;
    if (blocked && currentChatCharIdRef.current === cid) setChatInput("");
    setCharacterBlockStates((previous) => ({
      ...previous,
      [cid]: blocked
        ? blockCharacterState(previous?.[cid], { blockedAt: now, triggerRoomId: roomId })
        : unblockCharacterState(previous?.[cid], { unblockedAt: now }),
    }));
    const noticeId = gid();
    setChatHistory((previous) => ({
      ...previous,
      [cid]: [...(previous[cid] || []), {
        id: noticeId,
        role: "system_notice",
        noticeType: blocked ? "character_blocked" : "character_unblocked",
        content: blocked ? `你已封鎖 ${character.name}` : `你已解除封鎖 ${character.name}`,
        time: now,
      }],
    }));
    if (blocked) setPendingBlockReaction({ cid, noticeId });
    showToast(blocked ? `已封鎖 ${character.name}` : `已解除封鎖 ${character.name}`);
  };

  const setCharacterBlocksPlayer = (cid, blocked) => {
    const character = characters.find((item) => item.id === cid);
    if (!character) return false;
    const current = characterBlockStates?.[cid];
    if (current?.characterBlocksPlayer === blocked) return false;
    const now = Date.now();
    const noticeTime = new Date(now).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
    setCharacterBlockStates((previous) => ({
      ...previous,
      [cid]: setCharacterBlocksPlayerState(previous?.[cid], blocked, now),
    }));
    setChatHistory((previous) => ({
      ...previous,
      [cid]: [...(previous[cid] || []), {
        id: gid(),
        role: "system_notice",
        noticeType: blocked ? "player_blocked_by_character" : "player_unblocked_by_character",
        content: blocked ? `${character.name} 已封鎖你 · ${noticeTime}` : `${character.name} 已解除對你的封鎖 · ${noticeTime}`,
        time: now,
      }],
    }));
    showToast(blocked ? `${character.name} 已封鎖你` : `${character.name} 已解除封鎖`);
    return true;
  };

  const PROACTIVE_FREQUENCY_HOURS = {
    occasional: [8, 16], normal: [4, 8], active: [2.5, 4], always: [1.5, 2.5],
    low: [8, 16], high: [2.5, 4],
  };
  const PROACTIVE_DAILY_CAP = { off: 0, occasional: 3, normal: 6, active: 10, always: 15, low: 3, high: 10 };
  const proactiveDayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  const getProactiveIdleThresholdMs = (frequency) => {
    const [minH, maxH] = PROACTIVE_FREQUENCY_HOURS[frequency] || PROACTIVE_FREQUENCY_HOURS.normal;
    return (minH + Math.random() * (maxH - minH)) * 60 * 60 * 1000;
  };
  const getProactiveEligibleCharacters = () => {
    const now = Date.now();
    return characters.filter((c) => {
      const settings = proactiveSettings?.[c.id];
      if (!settings?.enabled) return false;
      const frequency = settings.frequency || "normal";
      if (frequency === "off") return false;
      const today = proactiveDayKey();
      const dailyCount = settings.proactiveDay === today ? Number(settings.proactiveCount) || 0 : 0;
      if (dailyCount >= (PROACTIVE_DAILY_CAP[frequency] ?? 6)) return false;
      if (proactiveUnread?.[c.id]) return false;
      const list = chatHistory[c.id] || [];
      if (!list.length) return false;
      const lastMsg = list[list.length - 1];
      const idle = now - (lastMsg?.time || 0);
      return idle > getProactiveIdleThresholdMs(settings.frequency);
    });
  };
  const triggerProactiveMessage = async (char) => {
    const cid = char.id;
    try {
      const recent = formatMessagesForPrompt((chatHistory[cid] || []).slice(-16));
      const memoryContext = pickMemoriesForPrompt(cid, recent).map((m, i) => `- ${i + 1}. ${m.text}`).join("\n");
      const pinnedLoreContext = pickLorebookEntriesForPrompt(cid, recent)
        .filter((x) => x.mode === "PIN")
        .map((x, i) => `${i + 1}. [${x.bookName}] ${x.entry.title || "條目"}：${x.entry.content || ""}`)
        .join("\n");
      const mergedMemoryContext = [memoryContext, pinnedLoreContext ? `[強制條目]\n${pinnedLoreContext}` : ""].filter(Boolean).join("\n\n");
      const selectedMode = getLastCommittedChatMode(cid);
      const proactiveRule = selectedMode === "reality"
        ? `[主動互動觸發 - 系統規則]\n距離上次互動已經過了一段時間。現在請你以 {{char}} 的身份，在現實場景中主動與 {{user}} 互動，用一段連貫的段落呈現（可包含敘述、動作、對話），自然地開啟話題或延續先前情境，符合角色個性與最近脈絡。不要提到「系統」「AI」「觸發」等字眼，也不要解釋自己為什麼開口，也不要輸出轉帳指令。`
        : `[主動訊息觸發 - 系統規則]\n距離上次互動已經過了一段時間沒有新訊息。現在請你以 {{char}} 的身份，主動傳一則（或幾則）訊息給 {{user}}，自然地開啟話題或延續先前對話，語氣與內容要符合角色個性與最近對話脈絡。不要提到「系統」「AI」「觸發」等字眼，也不要解釋自己為什麼傳訊息，也不要輸出轉帳指令。`;
      const proactiveBlockContext = buildCharacterBlockPromptContext({ state: characterBlockStates?.[cid], mode: selectedMode, now: Date.now() });
      const proactiveContext = [mergedMemoryContext, proactiveBlockContext, selectedMode === "online" ? VOICE_MESSAGE_RULE_CONTEXT : ""].filter(Boolean).join("\n\n");
      const sysP = applyUserPlaceholder(`${buildChatSystemPrompt(char, proactiveContext, apiConfig.model, selectedMode)}\n\n${proactiveRule}`);
      const triggerMsg = { role: "user", content: applyUserPlaceholder("[系統觸發]\n這不是 {{user}} 說的話，只是系統提示：時間已經過去，請 {{char}} 主動傳訊息給 {{user}}。"), image: null };
      const finalHist = [...recent.map((m) => ({ ...m, content: applyUserPlaceholder(m.content) })), triggerMsg];
      const reply = await callAI(finalHist, apiConfig, sysP);
      const cleanReplyRaw = selectedMode === "reality" ? sanitizeText(normalizeRealityReply(reply), REALITY_CHAT_TEXT_LIMIT) : normalizeAssistantReply(reply);
      // 標記必須在切氣泡前剝除，否則 [[PHOTO:...]] 會原樣顯示在氣泡裡。
      const voiceExtracted = selectedMode === "online"
        ? extractPseudoVoiceDirectives(cleanReplyRaw)
        : { text: cleanReplyRaw, voices: [] };
      const photoExtracted = extractPhotoDirectives(voiceExtracted.text);
      const cleanReply = stripModeLabel(stripInternalBlocks(photoExtracted.text));
      if (!cleanReply.trim() && !photoExtracted.photos.length && !voiceExtracted.voices.length) return;
      const bubbles = (selectedMode === "reality" ? [cleanReply] : splitAssistantBubbles(cleanReply)).filter((bubble) => bubble.trim());
      const replyGroupId = gid();
      let firedAny = false;
      for (let i = 0; i < bubbles.length; i++) {
        await wait(i === 0 ? 260 : Math.min(900, 400 + bubbles[i].length * 14));
        const msg = {
          id: gid(),
          replyGroupId,
          replyGroupIndex: i,
          replyGroupSize: bubbles.length,
          role: "assistant",
          content: bubbles[i],
          mode: selectedMode,
          proactive: true,
          interceptedByBlock: selectedMode === "online" && characterBlockStates?.[cid]?.blocked === true,
          time: Date.now(),
        };
        firedAny = true;
        setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), msg] }));
      }
      for (const pseudoVoice of voiceExtracted.voices) {
        await wait(320);
        firedAny = true;
        setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), {
          id: gid(), role: "assistant", content: pseudoVoice.transcript, pseudoVoice,
          mode: "online", proactive: true,
          interceptedByBlock: characterBlockStates?.[cid]?.blocked === true,
          time: Date.now(),
        }] }));
      }
      for (const photo of photoExtracted.photos) {
        await wait(320);
        firedAny = true;
        setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), { id: gid(), role: "assistant", content: "", pseudoImage: photo, mode: selectedMode, proactive: true, interceptedByBlock: selectedMode === "online" && characterBlockStates?.[cid]?.blocked === true, time: Date.now() }] }));
      }
      if (!firedAny) return;
      const today = proactiveDayKey();
      setProactiveSettings((prev) => ({
        ...prev,
        [cid]: {
          ...(prev?.[cid] || {}),
          proactiveDay: today,
          proactiveCount: (prev?.[cid]?.proactiveDay === today ? Number(prev?.[cid]?.proactiveCount) || 0 : 0) + 1,
        },
      }));
      // 只寫未讀就好；提醒交給通知中心，它會從 proactiveUnread 衍生出橫幅、紅點與鎖定畫面。
      if (currentChatCharIdRef.current !== cid) {
        setProactiveUnread((prev) => ({ ...prev, [cid]: (Number(prev?.[cid]) || 0) + bubbles.length }));
      }
    } catch (err) {
      console.warn("[proactive message]", err);
    }
  };
  const runProactiveSweep = () => {
    if (!hydrated || proactiveSweepingRef.current || !canUseCurrentProvider()) return;
    if (notificationCenter.settings.pauseProactive) return;
    const eligible = getProactiveEligibleCharacters();
    if (!eligible.length) return;
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    proactiveSweepingRef.current = true;
    triggerProactiveMessage(pick).finally(() => { proactiveSweepingRef.current = false; });
  };

  const addChatErrorNotice = (cid, err) => {
    const detail = sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 500);
    setChatHistory(h => ({ ...h, [cid]: [...(h[cid] || []), { id: gid(), role: "system_notice", content: `${getConnectionErrorPrefix()}${detail}`, time: Date.now() }] }));
  };

  const { sendMessage, retryMessage: retryChatFromNotice } = useDirectChatAI({
    currentCharacter: currentChatChar, isTyping, chatHistory, chatInput, chatImage, chatPseudoImage, chatPseudoVoiceMode,
    getCommittedMode: getLastCommittedChatMode, getSelectedMode: getSelectedChatMode, getMessageMode,
    getTextLimit: getChatTextLimit, sanitizeText, createId: gid,
    isPlayerBlockedByCharacter: (characterId) => characterBlockStates?.[characterId]?.characterBlocksPlayer === true,
    setChatHistory, setChatInput, setChatImage, setChatPseudoImage, setChatPseudoVoiceMode, setActionPanelOpen: setChatActionPanelOpen, setIsTyping,
    generateAssistant: generateAssistantForHistory, addErrorNotice: addChatErrorNotice,
  });
  const handleImgUp = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const raw = String(r.result || "");
      const safe = sanitizeUserImageUrl(raw);
      if (!safe) {
        showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
        return;
      }
      const imgEl = new Image();
      imgEl.onload = () => {
        const { width, height } = imgEl;
        const candidates = [
          { maxEdge: 1280, quality: 0.8 },
          { maxEdge: 1024, quality: 0.72 },
          { maxEdge: 896, quality: 0.65 },
          { maxEdge: 768, quality: 0.58 },
        ];
        let picked = null;
        for (const c of candidates) {
          const maxSide = Math.max(width, height);
          const scale = maxSide > c.maxEdge ? (c.maxEdge / maxSide) : 1;
          const targetW = Math.max(1, Math.round(width * scale));
          const targetH = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.drawImage(imgEl, 0, 0, targetW, targetH);
          const out = canvas.toDataURL("image/jpeg", c.quality);
          const data = out.split(",")[1] || "";
          const bytes = Math.floor((data.length * 3) / 4);
          picked = { data, mime: "image/jpeg", bytes, width: targetW, height: targetH, quality: c.quality };
          if (bytes <= CHAT_IMAGE_MAX_BYTES) break;
        }
        if (!picked || picked.bytes > CHAT_IMAGE_MAX_BYTES) {
          setChatImage(null);
          showToast(tr("圖片壓縮到最低設定後仍超過 1MB，請改用裁切圖或內容更簡單的圖片", "Even after maximum compression, the image is still over 1MB. Please use a cropped or simpler image.", "最小圧縮後も1MBを超えています。トリミングした画像か、よりシンプルな画像を使ってください。", "최저 압축 후에도 1MB를 초과합니다. 잘라낸 이미지나 더 단순한 이미지를 사용해주세요."));
          return;
        }
        setChatImage(picked);
        showToast(`已壓縮圖片 ${picked.width}x${picked.height} / ${Math.round(picked.bytes / 1024)}KB`);
      };
      imgEl.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
      imgEl.src = safe;
    };
    r.readAsDataURL(f);
    e.target.value = "";
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
  const LOCAL_APP_DATA_KEYS = [
    "maliphone-pet-home",
    "maliphone-pet-settings",
    "maliphone-pet-cooldown-until",
    "mali_yunyin_save_v1",
    "mali_yunyin_crystals_v1",
  ];
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
  const getAppStateSnapshot = async ({ includeSecrets = false, compactMedia = true, includeMissingLocalData = false } = {}) => {
    const exportCharacters = compactMedia ? compactCharacterImages(characters) : characters;
    const exportGroupChats = compactMedia ? compactGroupMessageImages(groupChats, exportCharacters) : groupChats;
    const exportPosts = compactMedia ? compactSocialPostImages(posts, exportCharacters) : posts;
    const exportChatRooms = compactMedia ? compactActiveRoomMirrors(chatRooms, activeRoomIds) : chatRooms;
    const exportApiConfig = includeSecrets ? apiConfig : { ...apiConfig, apiKey: "" };
    const exportApiPresets = (Array.isArray(apiPresets) ? apiPresets : []).map((preset) => ({
      ...preset,
      apiKey: includeSecrets ? preset.apiKey : "",
    }));
    const exportTtsConfig = includeSecrets ? ttsConfig : {
      ...ttsConfig,
      elevenlabs: { ...(ttsConfig?.elevenlabs || {}), apiKey: "" },
      minimax: { ...(ttsConfig?.minimax || {}), apiKey: "" },
    };
    return ({
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
      personas: serializePersonas(personaController.personas, personaController.activePersonaId, captureCurrentPersona()),
      activePersonaId: personaController.activePersonaId,
      localAppData: getLocalAppDataSnapshot({ includeMissing: includeMissingLocalData }),
      featureData: await loadFeatureBackup(exportCharacters, {
        compactImages: compactMedia,
        personaIds: Object.keys(personaController.personas || {}),
      }),
    },
    });
  };
  const getExportableAppState = () => getAppStateSnapshot();
  const getRollbackAppState = () => getAppStateSnapshot({ includeSecrets: true, compactMedia: false, includeMissingLocalData: true });
  const validateImportedAppState = (incoming) => {
    const fail = () => { throw new Error(tr("備份檔案格式不正確或資料超出安全上限", "The backup format is invalid or exceeds safe limits", "バックアップ形式が正しくないか、安全上限を超えています", "백업 형식이 올바르지 않거나 안전 한도를 초과했습니다")); };
    const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
    if (!isRecord(incoming)) fail();
    if (incoming.format && incoming.format !== "maliphone-app-state") fail();
    if (incoming.formatVersion != null && (!Number.isInteger(Number(incoming.formatVersion)) || Number(incoming.formatVersion) > 1)) fail();
    const src = incoming?.state && incoming?.format === "maliphone-app-state" ? incoming.state : incoming;
    if (!isRecord(src)) fail();
    const knownFields = ["characters", "chatHistory", "chatRooms", "groupChats", "posts", "lorebooks", "playerProfile", "personas", "featureData"];
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
    const objectFields = ["chatHistory", "chatRooms", "activeRoomIds", "chatModes", "chatBackgrounds", "chatScenes", "groupScenes", "chatTimeSettings", "innerThoughtSettings", "proactiveSettings", "proactiveUnread", "memories", "chatLorebookBindings", "phoneInboxCache", "phoneAppCache", "wallet", "characterWallets", "playerProfile", "personas", "apiConfig", "ttsConfig", "localAppData", "featureData"];
    for (const field of objectFields) {
      if (src[field] != null && !isRecord(src[field])) fail();
    }
    const chatThreads = isRecord(src.chatHistory) ? Object.values(src.chatHistory) : [];
    if (chatThreads.length > 1000 || chatThreads.some((messages) => !Array.isArray(messages) || messages.length > 20000)) fail();
  };
  const summarizeImportedData = (incoming) => {
    const src = incoming?.state && incoming?.format === "maliphone-app-state" ? incoming.state : incoming;
    return {
      format: incoming?.format === "maliphone-app-state" ? "maliphone-app-state" : "legacy",
      exportedAt: incoming?.exportedAt || null,
      characters: Array.isArray(src?.characters) ? src.characters.length : 0,
      chatThreads: src?.chatHistory && typeof src.chatHistory === "object" ? Object.keys(src.chatHistory).length : 0,
      chatBackgrounds: src?.chatBackgrounds && typeof src.chatBackgrounds === "object" ? Object.keys(src.chatBackgrounds).length : 0,
      groupChats: Array.isArray(src?.groupChats) ? src.groupChats.length : 0,
      scenes: (src?.chatScenes && typeof src.chatScenes === "object" ? Object.keys(src.chatScenes).length : 0) + (src?.groupScenes && typeof src.groupScenes === "object" ? Object.keys(src.groupScenes).length : 0),
      posts: Array.isArray(src?.posts) ? src.posts.length : 0,
      lorebooks: Array.isArray(src?.lorebooks) ? src.lorebooks.length : 0,
      playerProfile: !!src?.playerProfile,
      customCss: typeof src?.customCss === "string" && !!src.customCss.trim(),
      ...summarizeFeatureBackup(src),
    };
  };
  const applyImportedAppState = async (incoming, { rollback = false } = {}) => {
    const src = incoming?.state && incoming?.format === "maliphone-app-state" ? incoming.state : incoming;
    if (!src || typeof src !== "object") throw new Error(tr("檔案內容不正確", "Invalid file content", "ファイル内容が正しくありません", "파일 내용이 올바르지 않습니다"));
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
      socialSettings: src.socialSettings && typeof src.socialSettings === "object" ? { autoPost: false, enabledCharacterIds: null, frequency: "normal", frequencyByCharacter: {}, ...src.socialSettings } : { autoPost: false, enabledCharacterIds: null, frequency: "normal", frequencyByCharacter: {} },
      memories: src.memories && typeof src.memories === "object" ? src.memories : {},
      lorebooks: Array.isArray(src.lorebooks) ? src.lorebooks : [],
      chatLorebookBindings: src.chatLorebookBindings && typeof src.chatLorebookBindings === "object" ? src.chatLorebookBindings : {},
      phoneInboxCache: src.phoneInboxCache && typeof src.phoneInboxCache === "object" ? src.phoneInboxCache : {},
      phoneAppCache: src.phoneAppCache && typeof src.phoneAppCache === "object" ? src.phoneAppCache : {},
      wallet: src.wallet && typeof src.wallet === "object" ? src.wallet : defaultAppState.wallet,
      characterWallets: src.characterWallets && typeof src.characterWallets === "object" ? src.characterWallets : {},
      transfers: Array.isArray(src.transfers) ? src.transfers : [],
      characterBlockStates: normalizeCharacterBlockStates(src.characterBlockStates),
      screenLockTimeout: Number.isFinite(Number(src.screenLockTimeout)) ? Number(src.screenLockTimeout) : defaultAppState.screenLockTimeout,
      apiPresets: Array.isArray(src.apiPresets) && src.apiPresets.length ? src.apiPresets : defaultAppState.apiPresets,
      playerProfile: src.playerProfile && typeof src.playerProfile === "object" ? src.playerProfile : defaultAppState.playerProfile,
      apiConfig: src.apiConfig && typeof src.apiConfig === "object" ? src.apiConfig : defaultAppState.apiConfig,
      ttsConfig: src.ttsConfig && typeof src.ttsConfig === "object" ? {
        ...defaultAppState.ttsConfig,
        ...src.ttsConfig,
        elevenlabs: { ...defaultAppState.ttsConfig.elevenlabs, ...(src.ttsConfig.elevenlabs || {}) },
        minimax: { ...defaultAppState.ttsConfig.minimax, ...(src.ttsConfig.minimax || {}) },
      } : defaultAppState.ttsConfig,
      themeName: src.themeName || defaultAppState.themeName,
      fontName: FONT_PRESETS[src.fontName] ? src.fontName : defaultAppState.fontName,
      fontSizeScale: ["normal", "large", "xlarge", "xxlarge"].includes(src.fontSizeScale) ? src.fontSizeScale : defaultAppState.fontSizeScale,
      uiLanguage: normalizeUiLanguage(src.uiLanguage, defaultAppState.uiLanguage),
      homeSlots: Array.isArray(src.homeSlots) && src.homeSlots.length === HOME_SLOT_COUNT ? src.homeSlots : Array.from({ length: HOME_SLOT_COUNT }, () => null),
      dockOrder: Array.isArray(src.dockOrder) && src.dockOrder.length ? src.dockOrder : DOCK_APPS,
      personas: src.personas && typeof src.personas === "object" ? src.personas : {},
      activePersonaId: src.activePersonaId || null,
      localAppData: src.localAppData && typeof src.localAppData === "object" ? src.localAppData : {},
    };
    // 一般備份刻意不包含敏感資料；匯入這類備份時保留本裝置現有 Key。
    // 若備份確實包含 Key，非空的匯入值仍會優先套用。
    nextState = preserveMissingDeviceSecrets(nextState, {
      apiConfig,
      apiPresets,
      ttsConfig,
    });
    applyLoadedAppState(nextState);
    setChatModes(nextState.chatModes);
    setChatBackgrounds(nextState.chatBackgrounds);
    setGroupChats(nextState.groupChats);
    // 場景改綁聊天室：由 applyLoadedAppState → loadRoomState 依作用中聊天室 hydrate，這裡不再用角色層原始值覆蓋。
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
    await restoreFeatureBackup(src, { replace: true, reason: rollback ? "rollback" : "import" });
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
  const canUseCurrentProvider = () => {
    const isOllamaLocal = apiConfig.provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(apiConfig.baseUrl || "");
    const providerNeedsApiKey = !(isLocalProvider(apiConfig.provider) || isOllamaLocal);
    return !providerNeedsApiKey || !!apiConfig.apiKey;
  };
  const { refreshCharacterStatus, togglePinMemory, deleteMemory, generateMemory } = useCharacterInsights({
    characters, chatHistory, memories, apiConfig, setCharacters, setMemories,
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
    setChatHistory, setWalletGenLoading,
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
    sharePostToChat,
  } = useSocialFeed({
    apiConfig, characters, posts, setPosts, chatHistory, setChatHistory, memories, activeCharId,
    hydrated, socialSettings, playerProfile, playerPostText, setPlayerPostText,
    playerPostSubmitting, setPlayerPostSubmitting, setPlayerPostModalOpen,
    postCommentInputs, setPostCommentInputs, setSocialReplyTarget,
    socialLastGlobalPostAtRef, socialLastPostByCharRef, socialAutoPostingRef, socialAutoPostGapRef,
    SOCIAL_GLOBAL_COOLDOWN_MS, SOCIAL_CHAR_COOLDOWN_MS, PLAYER_SOCIAL_POST_LIMIT, SHARE_RAW_TOKEN_LIMIT,
    canUseCurrentProvider, showToast, tr, getPlayerContextBlock, buildSocialPostPrompt,
    rollCharacterPostLikes, getPlayerDisplayName, pickPlayerPostReactors,
    pickPlayerPostResponders, buildPlayerPostReplyPrompt, getCommentDepth,
    insertCommentAfterThread, buildSocialCommentReplyPrompt, getPostAuthorType,
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
    actions={{ refreshCharacterStatus, setMemoryEditor, togglePinMemory, deleteMemory, generateMemory, applyUserPlaceholder }}
  />;

  // ---- Chat ----
  const renderRealityText = (text) => <RealityMessageText text={text} />;
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
    getGroupMembers, openCreateGroup, openEditGroup, handleGroupCreateCoverUp,
    handleGroupEditCoverUp, saveEditGroup, deleteGroupChat, createGroupChat, applyGroupCoverCrop,
  } = useGroupChatController({
    characters, currentChatGroup, groupCoverCrop, groupEditCoverCrop,
    groupCreateMemberIds, groupCreateName, groupCreateRulePrompt, groupCreateCover,
    groupEditGroupId, groupEditMemberIds, groupEditName, groupEditRulePrompt, groupEditUseRealTime, groupEditCover,
    setGroupCoverCrop, setGroupEditCoverCrop, setGroupCreateCover, setGroupEditCover,
    setGroupCreateName, setGroupCreateRulePrompt, setGroupCreateMemberIds, setGroupCreateSearch, setGroupCreateOpen,
    setGroupEditGroupId, setGroupEditName, setGroupEditRulePrompt, setGroupEditUseRealTime, setGroupEditMemberIds, setGroupEditSearch, setGroupEditOpen,
    setGroupChats, setGroupScenes, setCurrentChatGroup, sanitizeImageUrl: sanitizeUserImageUrl, showToast, notify, tr,
  });
  const {
    normalizeChatBackground, getChatBackgroundLayerStyle, getChatBackgroundBlurFilter,
    updateChatBackground, onChatBackgroundFile,
  } = useChatBackground({
    setChatBackgrounds, setChatBgEditor, sanitizeImageUrl: sanitizeUserImageUrl, showToast, tr,
  });
  const { importRef: chatroomImportRef, preview: chatroomImportPreview, importing: chatroomImporting, deleteChatroom: deleteChatroomForCharacter, exportChatroom: exportChatroomForCharacter, openImport: openChatroomImport, importFile: importChatroomFile, confirmImport: confirmChatroomImportPreview, cancelImport: cancelChatroomImport } = useChatroomImportExport({
    currentCharacter: currentChatChar, characters, chatHistory, chatModes, chatBackgrounds, chatLorebookBindings, innerThoughtSettings, chatTimeSettings,
    setChatHistory, setChatModes, setChatBackgrounds, setChatLorebookBindings, setInnerThoughtSettings, setChatTimeSettings,
    setCharacters, setMemories, setChatScenes, setProactiveUnread, removeCharacterRooms,
    onChatroomDeleted: () => { setChatSettingsOpen(false); setCurrentChatChar(null); },
    resetOpenChat: () => { setChatActionPanelOpen(false); setMessageEditor(null); setActiveMessageId(null); setIsTyping(false); setChatInput(""); },
    normalizeBackground: normalizeChatBackground, downloadJsonFile, showToast, sanitizeText, tr,
  });
  const buildGroupPrompt = (group, memberNames, memberProfiles, recent) => buildGroupChatSystemPrompt({
    group, memberNames, memberProfiles, recent, groupScenes, sanitizeText,
    outputLanguageDirective: getOutputLanguageDirective(),
  });
  const parseGroupReplyPayload = (raw) => parseGroupReplies(raw, sanitizeText);
  const currentGroupMessages = currentChatGroup ? (currentChatGroup.messages || []) : [];
  const runGroupReplyGeneration = ({ group, members, messages, currentImage, signal }) => generateGroupReplies({
    group,
    members: members.map((member) => ({ ...member, profileText: getGroupMemberProfileText(member, sanitizeText) })),
    messages,
    currentImage,
    signal,
    includeRealTime: isGroupRealTimeEnabled(group),
    apiConfig,
    callAI,
    buildSystemPrompt: buildGroupPrompt,
    parseReplies: parseGroupReplyPayload,
    stripInternalBlocks,
    sanitizeText,
    tr,
  });
  const { sendGroupMessage, retryGroupMessage: retryGroupFromNotice } = useGroupChatAI({
    currentGroup: currentChatGroup, isTyping, input: chatInput, image: chatImage, pseudoImage: chatPseudoImage,
    setInput: setChatInput, setImage: setChatImage, setPseudoImage: setChatPseudoImage, setActionPanelOpen: setChatActionPanelOpen, setIsTyping,
    setGroups: setGroupChats, getMembers: getGroupMembers, getPlayerName: getPlayerDisplayName,
    sanitizeText, createId: gid,
    generateReplies: runGroupReplyGeneration, connectionErrorPrefix: getConnectionErrorPrefix, tr,
  });
  const renderChat = () => {
    const chatPersonaSwitcher = {
      activePersonaId: personaController.activePersonaId,
      personas: personaController.personas,
      onSwitch: (id) => personaController.switchPersona(id, captureCurrentPersona)
        .catch((error) => showToast(error?.message || "無法切換玩家人格")),
    };
    if (currentChatGroup) {
      const msgs = currentChatGroup.messages || [];
      const visibleMsgs = msgs;
      const members = getGroupMembers(currentChatGroup);
      const resolveSpeakerAvatar = (message) => sanitizeUserImageUrl(
        members.find((member) => String(member.id) === String(message?.speakerId))?.avatar
        || members.find((member) => member.name === message?.speakerName)?.avatar
        || message?.speakerAvatar,
      );
      return <MaliPhoneChatSurface
        apiConfig={apiConfig}
        currentGroup={currentChatGroup}
        tr={tr}
        group={{
          onPageClick: () => setModelBadgeOpen(false),
          members,
          header: {
            item: currentChatGroup, modelBadgeOpen, setModelBadgeOpen,
            onBack: () => setCurrentChatGroup(null),
            onTogglePinned: () => setGroupChats((previous) => previous.map((group) => group.id === currentChatGroup.id ? { ...group, pinned: !group.pinned } : group)),
            onOpenSettings: () => openEditGroup(currentChatGroup),
          },
          sceneBar: renderSceneBar("group", currentChatGroup.id, tr("場景", "Scene", "シーン", "장면")),
          content: {
            messages: visibleMsgs, isTyping, activeMessageId, setActiveMessageId,
            playerAvatar: getPlayerAvatar(), playerProfile, persona: chatPersonaSwitcher, resolveSpeakerAvatar, chatMsgsRef, messagesEndRef,
            onScroll: updateScrollToBottomVisibility, isConnectionErrorNotice, onRetry: retryGroupFromNotice,
            onEdit: (message) => setMessageEditor({ id: message.id, content: message.content || "", mode: "online" }),
            onDelete: (message) => {
              if (!window.confirm(tr("確定要刪除這則對話嗎？", "Delete this message?", "このメッセージを削除しますか？", "이 메시지를 삭제할까요?"))) return;
              const next = (currentChatGroup.messages || []).filter((item) => item.id !== message.id);
              setGroupChats((previous) => previous.map((group) => group.id === currentChatGroup.id ? { ...group, messages: next, updatedAt: Date.now() } : group));
              setActiveMessageId(null);
            },
            showScrollToBottom, onScrollToBottom: scrollCurrentChatToBottom,
            chatImage, onClearImage: () => setChatImage(null), actionPanelOpen: chatActionPanelOpen,
            chatPseudoImage, onSetPseudoImage: setChatPseudoImage,
            setActionPanelOpen: setChatActionPanelOpen, fileInputRef, onImageUpload: handleImgUp,
            chatInput, setChatInput, onSend: sendGroupMessage,
          },
        }}
      />;
    }
    if (!currentChatChar) {
      return <MaliPhoneChatSurface tr={tr} list={{
        tab: chatListTab, setTab: setChatListTab, characters: sortChatThreads(characters.filter((character) => !character.chatroomDeleted)),
        chatHistory, groups: sortGroupChats(groupChats), proactiveUnread, characterBlockStates, closeApp, openCreateGroup,
        onOpenCharacter: (character, unread) => {
          if (Date.now() <= suppressAppClickUntilRef.current) return;
          if (unread) setProactiveUnread((previous) => { const next = { ...previous }; delete next[character.id]; return next; });
          openCharacterChat(character);
        },
        onOpenGroup: (group) => {
          if (Date.now() > suppressAppClickUntilRef.current) setCurrentChatGroup(group);
        },
        getGroupMembers, apiConfig, playerProfile, persona: chatPersonaSwitcher, t,
      }} />;
    }
    if (currentChatChar) {
      const msgs = chatHistory[currentChatChar.id] || [];
      const {
        visibleCount,
        visibleMessages: visibleMsgs,
        hasEarlier,
        nextVisibleCount,
      } = selectVisibleChatMessages(msgs, chatVisibleCounts[currentChatChar.id]);
      const {
        records: thoughtRecords,
        visibleRecords: visibleThoughtRecords,
        activePage: activeThoughtPage,
        pageCount: thoughtPageCount,
        canRender: canRenderInnerThought,
      } = selectDirectChatThoughts(msgs, thoughtHistoryPage, isTyping);
      const jumpToThoughtMessage = (messageId) => {
        thoughtJumpInProgressRef.current = true;
        setChatVisibleCounts((prev) => ({ ...prev, [currentChatChar.id]: msgs.length }));
        setPendingThoughtScrollId(messageId);
        setChatSettingsOpen(false);
      };
      const binding = getChatLorebookBinding(currentChatChar.id);
      const selectedMode = getSelectedChatMode(currentChatChar.id);
      const committedMode = getLastCommittedChatMode(currentChatChar.id);
      const hasPendingMode = selectedMode !== committedMode;
      const inputTextLimit = getChatTextLimit(selectedMode);
      const characterBlockState = characterBlockStates?.[currentChatChar.id] || null;
      const isCharacterBlocked = characterBlockState?.playerBlocksCharacter === true || characterBlockState?.blocked === true;
      const isPlayerBlockedByCharacter = characterBlockState?.characterBlocksPlayer === true;
      const chatBg = normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || "");
      const chatBgUrl = chatBg.src;
      const chatCrStyle = chatBgUrl
        ? {
            flex: 1,
            minHeight: 0,
            position: "relative",
            overflow: "hidden",
          }
        : { flex: 1, minHeight: 0 };
      const loadEarlier = () => {
        const element = chatMsgsRef.current;
        if (!element) return;
        chatLoadAdjustRef.current = { charId: currentChatChar.id, prevScrollHeight: element.scrollHeight, prevScrollTop: element.scrollTop };
        setChatVisibleCounts((previous) => ({ ...previous, [currentChatChar.id]: nextVisibleCount }));
      };
      const directMessageRendererProps = {
        character: currentChatChar, activeMessageId, setActiveMessageId,
        highlightedThoughtMessageId, isTyping, getModeLabel, getMessageMode, stripModeLabel,
        stripInternalBlocks, parseShareEventNotice, isConnectionErrorNotice, startNoticeLongPress,
        cancelNoticeLongPress, retryChatFromNotice, deleteChatMessage, applyUserPlaceholder,
        formatMoney, renderRealityText, renderInnerThought, canRenderInnerThought,
        renderCharacterVoiceAction, getCharacterVoiceBubblePlayback, setMessageEditor, transfers, onResolveTransfer: resolveTransfer,
      };
      const selectScreenshotBoundary = (messageId) => {
        if (!chatScreenshotSelection.active) return;
        if (!chatScreenshotSelection.startId) {
          setChatScreenshotSelection({ active: true, startId: messageId, endId: null, selectedIds: [] });
          return;
        }
        const selectedIds = selectMessageRangeIds(msgs, chatScreenshotSelection.startId, messageId);
        if (!selectedIds) return;
        setChatScreenshotSelection({ active: true, startId: chatScreenshotSelection.startId, endId: messageId, selectedIds });
      };
      const screenshotSelectionProps = {
        active: chatScreenshotSelection.active,
        startId: chatScreenshotSelection.startId,
        endId: chatScreenshotSelection.endId,
        selectedIds: chatScreenshotSelection.selectedIds,
        onSelect: selectScreenshotBoundary,
      };
      return <MaliPhoneChatSurface
        apiConfig={apiConfig}
        currentCharacter={currentChatChar}
        tr={tr}
        onDirectPageClick={() => setModelBadgeOpen(false)}
        directHeader={{
          item: currentChatChar, modelBadgeOpen, setModelBadgeOpen,
          rooms: chatRooms[currentChatChar.id] || [],
          activeRoomId: activeRoomIds[currentChatChar.id],
          onSwitchRoom: (roomId) => activateCharacterRoom(currentChatChar.id, roomId),
          onCreateRoom: () => createCharacterRoom(currentChatChar.id),
          onRenameRoom: () => renameCharacterRoom(currentChatChar.id),
          onDeleteRoom: () => deleteCharacterRoom(currentChatChar.id),
          onBack: () => { if (chatSettingsOpen) setChatSettingsOpen(false); else setCurrentChatChar(null); },
          onTogglePinned: () => toggleChatPin(currentChatChar.id),
          onOpenSettings: () => {
            rememberCurrentChatScroll();
            setChatSettingsExpandedBooks({});
            setChatSettingsBackgroundOpen(false);
            setChatSettingsLorebookOpen(false);
            setChatSettingsThoughtsOpen(false);
            setThoughtHistoryPage(0);
            setChatroomManageOpen(false);
            setChatBgEditor(null);
            setChatSettingsOpen(true);
          },
        }}
        directSettingsOpen={chatSettingsOpen}
        directSettings={{
          mode: { selectedMode, pending: hasPendingMode, onChange: (mode) => setSelectedChatMode(currentChatChar.id, mode) },
          innerThought: { autoEnabled: isInnerThoughtAutoEnabled(currentChatChar.id), onToggleAuto: () => setInnerThoughtAutoEnabled(currentChatChar.id, !isInnerThoughtAutoEnabled(currentChatChar.id)), open: chatSettingsThoughtsOpen, setOpen: setChatSettingsThoughtsOpen, records: thoughtRecords, visibleRecords: visibleThoughtRecords, page: activeThoughtPage, pageCount: thoughtPageCount, setPage: setThoughtHistoryPage, onJump: jumpToThoughtMessage, locale: uiLanguage, sanitizeText },
          memory: { memories: memories[currentChatChar.id] || [], applyUserPlaceholder, onEdit: (memory) => setMemoryEditor({ charId: currentChatChar.id, memoryId: memory.id, text: memory.text || "" }), onTogglePin: (memory) => togglePinMemory(currentChatChar.id, memory.id), onDelete: (memory) => deleteMemory(currentChatChar.id, memory.id) },
          proactive: { enabled: isProactiveEnabled(currentChatChar.id), frequency: getProactiveFrequency(currentChatChar.id), onToggle: () => setProactiveEnabled(currentChatChar.id, !isProactiveEnabled(currentChatChar.id)), onFrequencyChange: (frequency) => setProactiveFrequency(currentChatChar.id, frequency) },
          realTime: { enabled: isChatRealTimeEnabled(currentChatChar.id), onToggle: () => setChatRealTimeEnabled(currentChatChar.id, !isChatRealTimeEnabled(currentChatChar.id)) },
          background: { currentChatChar, chatSettingsBackgroundOpen, setChatSettingsBackgroundOpen, chatBackgrounds, normalizeChatBackground, getChatBackgroundLayerStyle, getChatBackgroundBlurFilter, onChatBackgroundFile, chatBgEditor, setChatBgEditor, updateChatBackground },
          lorebook: { chatSettingsLorebookOpen, setChatSettingsLorebookOpen, binding, lorebooks, chatSettingsExpandedBooks, setChatSettingsExpandedBooks, toggleChatLorebookBook, setAllChatLorebookEntries, toggleChatLorebookEntry, cycleChatLorebookEntryMode, currentChatChar, armAppClickSuppression },
          management: { open: chatroomManageOpen, setOpen: setChatroomManageOpen, character: currentChatChar, importing: chatroomImporting, importRef: chatroomImportRef, onImportFile: importChatroomFile, onExport: exportChatroomForCharacter, onOpenImport: openChatroomImport, onClear: () => clearCharacterRoom(currentChatChar.id), onDelete: deleteChatroomForCharacter },
          contact: { character: currentChatChar, blockState: characterBlockState, onBlock: () => setCharacterBlocked(currentChatChar, true), onUnblock: () => setCharacterBlocked(currentChatChar, false) },
        }}
        directBlockBanner={{ playerBlocksCharacter: isCharacterBlocked, characterBlocksPlayer: isPlayerBlockedByCharacter, mode: selectedMode, character: currentChatChar, onUnblock: () => setCharacterBlocked(currentChatChar, false) }}
        directMessageList={{
          mode: selectedMode,
          containerStyle: chatCrStyle,
          backgroundLayer: chatBgUrl ? <><div style={{ ...getChatBackgroundLayerStyle(chatBg, 1.08), filter: getChatBackgroundBlurFilter(chatBg), zIndex: 0 }} /><div style={{ position: "absolute", inset: 0, background: isNightTheme ? "rgba(18,12,28,.46)" : "rgba(255,255,255,.52)", pointerEvents: "none", zIndex: 0 }} /></> : null,
          sceneBar: <div style={{ position: "relative", zIndex: 1 }}>{renderSceneBar("char", currentChatChar.id, tr("場景", "Scene", "シーン", "장면"),
            <button type="button" className="mp-scene-mem-btn" disabled={genLoading} onClick={async (event) => {
              event.stopPropagation();
              const chatMsgs = chatHistory[currentChatChar.id] || [];
              const lastId = chatMsgs.length ? chatMsgs[chatMsgs.length - 1].id : null;
              const noNewChat = lastId != null && lastMemGenMsgId[currentChatChar.id] === lastId;
              const result = await generateMemory(currentChatChar, { silent: true });
              if (!result) return;
              if (result.status === "added" || result.status === "duplicate") setLastMemGenMsgId((prev) => ({ ...prev, [currentChatChar.id]: lastId }));
              setMemoryCard({ ...result, noNewChat });
            }}>{genLoading ? tr("生成中…", "Saving…", "生成中…", "생성 중…") : `✦ ${tr("記憶", "Memory", "記憶", "기억")}`}</button>
          )}</div>,
          messagesRef: chatMsgsRef, messagesEndRef,
          onScroll: (element) => {
            rememberCurrentChatScroll(element);
            updateScrollToBottomVisibility(element);
            if (element.scrollTop > 0 || !hasEarlier) return;
            chatLoadAdjustRef.current = { charId: currentChatChar.id, prevScrollHeight: element.scrollHeight, prevScrollTop: element.scrollTop };
            setChatVisibleCounts((previous) => ({ ...previous, [currentChatChar.id]: nextVisibleCount }));
          },
          hasEarlier, onLoadEarlier: loadEarlier, isTyping, showScrollToBottom,
          scrollButtonBottom: chatActionPanelOpen ? 142 : ((chatImage || chatPseudoImage || chatPseudoVoiceMode) ? 148 : 68),
          onScrollToBottom: scrollCurrentChatToBottom,
        }}
        directMessageRenderer={{...directMessageRendererProps, messages: visibleMsgs, screenshotSelection: screenshotSelectionProps}}
        directComposer={{
          image: chatImage, onClearImage: () => setChatImage(null), actionPanelOpen: chatActionPanelOpen,
          pseudoImage: chatPseudoImage, onSetPseudoImage: setChatPseudoImage,
          pseudoVoiceMode: chatPseudoVoiceMode, onSetPseudoVoiceMode: setChatPseudoVoiceMode,
          setActionPanelOpen: setChatActionPanelOpen, allowTransfer: selectedMode !== "reality",
          onOpenTransfer: () => setTransferModalOpen(true), fileInputRef, onImageUpload: handleImgUp,
          onStartScreenshot: () => setChatScreenshotSelection({ active: true, startId: null, endId: null, selectedIds: [] }),
          screenshotSelection: screenshotSelectionProps,
          onCancelScreenshot: () => setChatScreenshotSelection({ active: false, startId: null, endId: null, selectedIds: [] }),
          onSaveScreenshot: () => { setChatScreenshotSelection((current) => ({ ...current, active: false })); setChatScreenshotOpen(true); },
          character: currentChatChar, onGiftEpisodeStarted: () => { setCurrentChatChar(null); setChatListTab("episodes"); },
          value: chatInput, setValue: setChatInput, textLimit: inputTextLimit, onSend: sendMessage, mode: selectedMode, playerProfile, persona: chatPersonaSwitcher,
        }}
        screenshot={{ open: chatScreenshotOpen, onClose: () => setChatScreenshotOpen(false), onReselect: () => { setChatScreenshotOpen(false); setChatScreenshotSelection({ active: true, startId: null, endId: null, selectedIds: [] }); }, messages: msgs, initialSelectedIds: chatScreenshotSelection.selectedIds, character: currentChatChar, sceneBar: renderSceneBar("char", currentChatChar.id, tr("場景", "Scene", "シーン", "장면")), mode: selectedMode, rendererProps: directMessageRendererProps, backgroundUrl: chatBgUrl, isNightTheme }}
        memoryToast={{ card: memoryCard, onClose: () => setMemoryCard(null), applyUserPlaceholder }}
      />;
    }
  };

  const renderSocial = () => <MaliPhoneSocialSurface
    core={{ closeApp, t, tr, characters, sanitizeUserImageUrl, showToast, postLimit: SOCIAL_POST_LIMIT, downloadTextFile, exportToastMessage }}
    state={{
      socialSettingsOpen, setSocialSettingsOpen, socialSettings, setSocialSettings, posts, setPosts,
      activeCommentPostId, setActiveCommentPostId, socialReplyTarget, setSocialReplyTarget,
      activeLikePostId, setActiveLikePostId, expandedSocialPosts, setExpandedSocialPosts,
      highlightedPostId, activePostMenuId, setActivePostMenuId, postCommentInputs, setPostCommentInputs,
    }}
    actions={{ setPlayerPostModalOpen, handleRandomSocialPost, setPendingPostScrollId, sharePostToChat, addPostComment }}
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
  const clearAllData = async () => {
    if(!confirm(tr("確定要清空所有資料嗎？", "Are you sure you want to clear all data?", "本当にすべてのデータを消去しますか？", "정말 모든 데이터를 삭제할까요?"))) return;
    try {
      await resetFeatureData();
      await clearDeviceSecrets();
      const { clearImageApiConfig } = await import("./services/images/galleryImageStorage");
      await clearImageApiConfig();
      applyLocalAppDataSnapshot({}, { replace: true });
    } catch (error) {
      showToast(`${tr("清空資料失敗", "Failed to clear data", "データの消去に失敗しました", "데이터 삭제 실패")}：${sanitizeText(error?.message || "Unknown error", 80)}`);
      return;
    }
    setCharacters([]);
    setActiveCharId(null);
    setCurrentChatChar(null);
    setCurrentChatGroup(null);
    setChatHistory({});
    clearRooms();
    setChatModes({});
    setChatBackgrounds({});
    setGroupChats([]);
    setInnerThoughtSettings({});
    setProactiveSettings({});
    setProactiveUnread({});
    setExpandedInnerThoughts({});
    setInnerThoughtLoading({});
    setChatScenes({});
    setGroupScenes({});
    setChatLorebookBindings({});
    setPosts([]);
    setMemories({});
    setLorebooks([]);
    setActiveLorebookId(null);
    setPhoneInboxCache({});
    setPhoneAppCache({});
    setWallet(defaultAppState.wallet);
    setCharacterWallets({});
    setTransfers([]);
    setCharacterBlockStates({});
    personaController.resetPersonas(defaultAppState);
    setApiPresets(defaultAppState.apiPresets);
    setPlayerProfile(defaultAppState.playerProfile);
    setApiConfig(defaultAppState.apiConfig);
    setTtsConfig(defaultAppState.ttsConfig);
    clearVoicePlaybackCache();
    setScreenLockTimeout(defaultAppState.screenLockTimeout);
    setHomeSlots(Array.from({ length: HOME_SLOT_COUNT }, () => null));
    setDockOrder(DOCK_APPS);
    setPhonePage("picker");
    setPhoneViewCharId(null);
    setPhoneActiveThreadId("player");
    armAppClickSuppression();
    setCurrentApp(null);
    setModal(null);
    setUpdateNoticeOpen(false);
    setChatSettingsOpen(false);
    setChatSettingsBackgroundOpen(false);
    setChatSettingsLorebookOpen(false);
    setChatroomManageOpen(false);
    setChatSettingsExpandedBooks({});
    setChatBgEditor(null);
    setChatVisibleCounts({});
    setActiveMessageId(null);
    setMessageEditor(null);
    setIsTyping(false);
    setChatInput("");
    setChatImage(null);
    setPlayerPostModalOpen(false);
    setPlayerPostText("");
    setTransferModalOpen(false);
    setTransferAmount("");
    setTransferNote("");
    setSocialReplyTarget(null);
    setExpandedSocialPosts({});
    setChatroomImportPreview(null);
    setChatroomImportTarget(null);
    setDataImportPreview(null);
    try { localStorage.removeItem("mali_seen_version"); } catch {}
    showToast(tr("資料已清空", "Data cleared", "データを消去しました", "데이터를 삭제했습니다"));
  };

  const renderSettings = () => (
    <MaliPhoneSettingsSurface
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
      }}
      release={{
        changelogTitle: currentChangelogTitle,
        changelog: currentChangelog,
        onClearAll: clearAllData,
      }}
      notifications={{
        settings: notificationCenter.settings,
        updateSettings: notificationCenter.updateSettings,
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
      onRename: personaController.renamePersona,
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
          groupChat={{
            open: Boolean(groupCreateOpen || groupEditOpen || groupCoverCrop || groupEditCoverCrop),
            props: {
              characters: sortChatThreads(characters),
              tr,
              showToast,
              create: {
                open: groupCreateOpen,
                name: groupCreateName,
                setName: setGroupCreateName,
                cover: groupCreateCover,
                setCover: setGroupCreateCover,
                memberIds: groupCreateMemberIds,
                setMemberIds: setGroupCreateMemberIds,
                search: groupCreateSearch,
                setSearch: setGroupCreateSearch,
                rulePrompt: groupCreateRulePrompt,
                setRulePrompt: setGroupCreateRulePrompt,
                onCoverUpload: handleGroupCreateCoverUp,
                onClose: () => setGroupCreateOpen(false),
                onSubmit: createGroupChat,
              },
              edit: {
                open: groupEditOpen,
                name: groupEditName,
                setName: setGroupEditName,
                cover: groupEditCover,
                setCover: setGroupEditCover,
                memberIds: groupEditMemberIds,
                setMemberIds: setGroupEditMemberIds,
                search: groupEditSearch,
                setSearch: setGroupEditSearch,
                rulePrompt: groupEditRulePrompt,
                setRulePrompt: setGroupEditRulePrompt,
                useRealTime: groupEditUseRealTime,
                setUseRealTime: setGroupEditUseRealTime,
                onCoverUpload: handleGroupEditCoverUp,
                onClose: () => setGroupEditOpen(false),
                onSubmit: saveEditGroup,
                onDelete: deleteGroupChat,
              },
              crop: {
                createValue: groupCoverCrop,
                setCreateValue: setGroupCoverCrop,
                editValue: groupEditCoverCrop,
                setEditValue: setGroupEditCoverCrop,
                onApply: applyGroupCoverCrop,
                onClose: () => {
                  setGroupCoverCrop(null);
                  setGroupEditCoverCrop(null);
                },
              },
            },
          }}
          toast={toast}
        />
      )}
    />
  );
}
