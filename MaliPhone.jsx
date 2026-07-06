import React, { useState, useEffect, useRef } from "react";
import { VERSION, CHANGELOG, API_PROVIDERS, DEFAULT_APPS, DOCK_APPS } from "./constants/appConstants";
import { ArrowDown, ChevronLeft, ChevronRight, Eye, LoaderCircle, Pause, RefreshCw, Volume2 } from "lucide-react";
import { gid, ft, fd, sanitizeText, sanitizeUserImageUrl } from "./utils/coreUtils";
import { UI_TEXT } from "./constants/uiText";
import { buildSystemPrompt } from "./utils/characterParser";
import { callAI, fetchAvailableModels } from "./services/aiService";
import { fetchElevenLabsDefaultVoices, synthesizeSpeech } from "./services/ttsService";
import { loadAppState, saveAppState } from "./utils/indexedDbStorage";
import { PHONE_APP_META, sanitizePhoneTheme, buildPhonePromptContext, buildPhoneAppPrompt, sanitizePhoneAppData } from "./utils/phoneAppGen";
import { createDefaultVoiceSettings, normalizeCharacterVoiceSettings } from "./utils/voiceSettings";
import { sanitizeCustomCss } from "./utils/customCss";
import css, { THEME_PRESETS, FONT_PRESETS } from "./styles/maliPhoneCss";
import PetHome from "./PetHome";
import DesktopPet from "./DesktopPet";
import CustomCssGuide from "./CustomCssGuide";
import CustomCssSettings from "./components/settings/CustomCssSettings";
import HeroImageSettings from "./components/settings/HeroImageSettings";
import ThemeSettings from "./components/settings/ThemeSettings";
import InterfaceSettings from "./components/settings/InterfaceSettings";
import ApiPresetSettings from "./components/settings/ApiPresetSettings";
import DataBackupSettings from "./components/settings/DataBackupSettings";
import AiConnectionSettings from "./components/settings/AiConnectionSettings";
import VoiceApiSettings from "./components/settings/VoiceApiSettings";
import ApiPresetModal from "./components/settings/ApiPresetModal";
import DataImportPreviewModal from "./components/settings/DataImportPreviewModal";
import ChatroomImportPreviewModal from "./components/settings/ChatroomImportPreviewModal";
import AboutInfoSettings from "./components/settings/AboutInfoSettings";
import ResetDataSettings from "./components/settings/ResetDataSettings";
import GameCenter from "./components/apps/GameCenter";
import AnswerBookApp from "./components/apps/AnswerBookApp";
import PlayerProfileApp from "./components/apps/PlayerProfileApp";
import ContactsApp from "./components/apps/ContactsApp";
import WalletSettingsApp from "./components/apps/WalletSettingsApp";
import PhoneApp from "./components/apps/PhoneApp";
import SocialApp from "./components/apps/SocialApp";
import LorebookApp from "./components/apps/LorebookApp";
import StatusApp from "./components/apps/StatusApp";
import AddCharacterModal from "./components/characters/AddCharacterModal";
import PeachHero, { heroImgStyle } from "./components/home/PeachHero";
import WalletLedgerView from "./components/wallet/WalletLedgerView";
import { BarClock, LockClock, DeskClock } from "./components/common/PhoneClocks";

// 立繪位移：object-position 滑動 cover 的溢出裁切窗口（到邊自動停），
// translate 只用縮放產生的溢出空間（上限 (zoom-1)*50%），兩者相加永遠不會露出背景缺口
export default function MaliPhone() {
  const defaultAppState = {
    characters: [],
    activeCharId: null,
    chatHistory: {},
    chatModes: {},
    chatBackgrounds: {},
    groupChats: [],
    chatScenes: {},
    groupScenes: {},
    innerThoughtSettings: {},
    proactiveSettings: {},
    proactiveUnread: {},
    posts: [],
    socialSettings: { autoPost: false },
    memories: {},
    lorebooks: [],
    chatLorebookBindings: {},
    phoneInboxCache: {},
    phoneAppCache: {},
    wallet: {
      balance: 500,
      transactions: [],
      assets: [],
    },
    characterWallets: {},
    apiPresets: [
      { id: "preset-1", name: "預設 1", provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" },
      { id: "preset-2", name: "預設 2", provider: "grok", baseUrl: "https://api.x.ai/v1", apiKey: "", model: "grok-3-mini" },
      { id: "preset-3", name: "預設 3", provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: "", model: "auto" },
    ],
    playerProfile: {
      name: "玩家",
      nickname: "",
      gender: "",
      bio: "",
      avatar: "",
      doll: {
        hairStyle: "長髮",
        topStyle: "連帽上衣",
        accessoryStyle: "髮夾",
        hairColor: "#5d4037",
        topColor: "#f48fb1",
        accessoryColor: "#90caf9",
      },
    },
    apiConfig: { provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini", location: "global" },
    ttsConfig: {
      enabled: false,
      provider: "elevenlabs",
      elevenlabs: { apiKey: "", model: "eleven_flash_v2_5", defaultVoiceId: "JBFqnCBsd6RMkjVDRZzb" },
      minimax: { apiKey: "", model: "speech-2.8-turbo", baseUrl: "https://api.minimax.io", defaultVoiceId: "English_expressive_narrator" },
    },
    themeName: "莓果蘇打",
    fontName: "圓體",
    uiLanguage: "zh-TW",
    screenLockTimeout: 5,
  };
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [toast, setToast] = useState(null);
  const [characters, setCharacters] = useState(defaultAppState.characters);
  const [activeCharId, setActiveCharId] = useState(defaultAppState.activeCharId);
  const [chatHistory, setChatHistory] = useState(defaultAppState.chatHistory);
  const [chatModes, setChatModes] = useState(defaultAppState.chatModes);
  const [chatBackgrounds, setChatBackgrounds] = useState(defaultAppState.chatBackgrounds);
  const [chatBgEditor, setChatBgEditor] = useState(null);
  const [groupChats, setGroupChats] = useState(defaultAppState.groupChats);
  const [chatScenes, setChatScenes] = useState(defaultAppState.chatScenes);
  const [groupScenes, setGroupScenes] = useState(defaultAppState.groupScenes);
  const [innerThoughtSettings, setInnerThoughtSettings] = useState(defaultAppState.innerThoughtSettings);
  const [proactiveSettings, setProactiveSettings] = useState(defaultAppState.proactiveSettings);
  const [proactiveUnread, setProactiveUnread] = useState(defaultAppState.proactiveUnread);
  const [expandedInnerThoughts, setExpandedInnerThoughts] = useState({});
  const [innerThoughtLoading, setInnerThoughtLoading] = useState({});
  const [chatInput, setChatInput] = useState("");
  const [chatImage, setChatImage] = useState(null);
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
  const [groupEditMemberIds, setGroupEditMemberIds] = useState([]);
  const [groupEditSearch, setGroupEditSearch] = useState("");
  const [groupEditCover, setGroupEditCover] = useState("");
  const [groupCoverCrop, setGroupCoverCrop] = useState(null);
  const [groupEditCoverCrop, setGroupEditCoverCrop] = useState(null);
  const [sceneEditor, setSceneEditor] = useState(null);
  const groupCoverInputRef = useRef(null);
  const groupEditCoverInputRef = useRef(null);
  const CHAT_IMAGE_MAX_BYTES = 1024 * 1024; // 1MB
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatChar, setCurrentChatChar] = useState(null);
  const [currentChatGroup, setCurrentChatGroup] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [messageEditor, setMessageEditor] = useState(null);
  const [posts, setPosts] = useState(defaultAppState.posts);
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
  const ONLINE_CHAT_TEXT_LIMIT = 800;
  const REALITY_CHAT_TEXT_LIMIT = 4000;
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
  const [walletGenLoading, setWalletGenLoading] = useState(false);
  const [apiPresets, setApiPresets] = useState(defaultAppState.apiPresets);
  const [playerProfile, setPlayerProfile] = useState(defaultAppState.playerProfile);
  const [themeName, setThemeName] = useState(defaultAppState.themeName);
  const [fontName, setFontName] = useState(defaultAppState.fontName);
  const [themeEffectsEnabled, setThemeEffectsEnabled] = useState(() => {
    try { return localStorage.getItem("mali_theme_effects") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("mali_theme_effects", themeEffectsEnabled ? "1" : "0"); } catch {}
  }, [themeEffectsEnabled]);
  const [customCssEnabled, setCustomCssEnabled] = useState(() => {
    try { return localStorage.getItem("mali_custom_css_enabled") === "1"; } catch { return false; }
  });
  const [customCss, setCustomCss] = useState(() => {
    try { return localStorage.getItem("mali_custom_css") || ""; } catch { return ""; }
  });
  const [customCssDraft, setCustomCssDraft] = useState(() => {
    try { return localStorage.getItem("mali_custom_css") || ""; } catch { return ""; }
  });
  const [customCssNotice, setCustomCssNotice] = useState("");
  const [customCssGuideOpen, setCustomCssGuideOpen] = useState(false);
  useEffect(() => {
    try { localStorage.setItem("mali_custom_css_enabled", customCssEnabled ? "1" : "0"); } catch {}
  }, [customCssEnabled]);
  const scopedCustomCss = customCssEnabled && customCss.trim()
    ? `@scope (.mp-phone) { ${sanitizeCustomCss(customCss)} }`
    : "";
  const [uiLanguage, setUiLanguage] = useState(defaultAppState.uiLanguage);
  const [playerAvatarCrop, setPlayerAvatarCrop] = useState(null);
  const [screenLockTimeout, setScreenLockTimeout] = useState(defaultAppState.screenLockTimeout);
  const [phoneViewCharId, setPhoneViewCharId] = useState(null);
  const [phonePage, setPhonePage] = useState("picker");
  const [phoneActiveThreadId, setPhoneActiveThreadId] = useState("player");
  const [phoneGenLoading, setPhoneGenLoading] = useState(false);
  const [memoryEditor, setMemoryEditor] = useState(null);
  const [activeMemoryId, setActiveMemoryId] = useState(null);
  const [apiConfig, setApiConfig] = useState(defaultAppState.apiConfig);
  const [ttsConfig, setTtsConfig] = useState(defaultAppState.ttsConfig);
  const [ttsVoices, setTtsVoices] = useState([]);
  const [ttsConnectionState, setTtsConnectionState] = useState("idle");
  const [voicePlayback, setVoicePlayback] = useState({ key: null, status: "idle" });
  const voiceAudioRef = useRef(null);
  const voiceAudioCacheRef = useRef(new Map());
  const [modelBadgeOpen, setModelBadgeOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [updateNoticeOpen, setUpdateNoticeOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [tempConfig, setTempConfig] = useState(null);
  const [providerModelOptions, setProviderModelOptions] = useState({});
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [presetSavePickerOpen, setPresetSavePickerOpen] = useState(false);
  const [clearCacheArmed, setClearCacheArmed] = useState(false);
  const [statusExpandedCharId, setStatusExpandedCharId] = useState(null);
  const [statusMemoryExpandedCharId, setStatusMemoryExpandedCharId] = useState(null);
  const [settingsApiOpen, setSettingsApiOpen] = useState(true);
  const [settingsResetOpen, setSettingsResetOpen] = useState(false);
  const [settingsVersionOpen, setSettingsVersionOpen] = useState(false);
  const [settingsDisclaimerOpen, setSettingsDisclaimerOpen] = useState(false);
  const [settingsAiConnOpen, setSettingsAiConnOpen] = useState(false);
  const [settingsVoiceOpen, setSettingsVoiceOpen] = useState(false);
  const [settingsResetDataOpen, setSettingsResetDataOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("appearance");
  const [settingsAppearanceOpen, setSettingsAppearanceOpen] = useState(() => {
    try { return localStorage.getItem("mali_settings_appearance_open") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("mali_settings_appearance_open", settingsAppearanceOpen ? "1" : "0"); } catch {}
  }, [settingsAppearanceOpen]);
  const [heroDraft, setHeroDraft] = useState(null);
  const heroFileRef = useRef(null);
  const heroDragRef = useRef(null);
  const [dataImporting, setDataImporting] = useState(false);
  const [dataImportPreview, setDataImportPreview] = useState(null);
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
  const [chatVisibleCounts, setChatVisibleCounts] = useState({});
  const [genLoading, setGenLoading] = useState(false);
  const [gamePage, setGamePage] = useState("hub");
  const [homePage, setHomePage] = useState(1);
  const PAGE_SIZE = 12;
  const HOME_SLOT_COUNT = PAGE_SIZE * 3;
  const [homeSlots, setHomeSlots] = useState(Array.from({ length: HOME_SLOT_COUNT }, () => null));
  const [dockOrder, setDockOrder] = useState(DOCK_APPS);
  const [isDraggingApp, setIsDraggingApp] = useState(false);
  const [pointerDrag, setPointerDrag] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const socialLastGlobalPostAtRef = useRef(0);
  const socialLastPostByCharRef = useRef({});
  const socialAutoPostingRef = useRef(false);
  const socialAutoPostGapRef = useRef(0);
  const walletAutoRefreshBusyRef = useRef(false);
  const statusRefreshBusyRef = useRef(new Set());
  const statusAutoRefreshAttemptRef = useRef(new Map());
  const proactiveSweepingRef = useRef(false);
  const currentChatCharIdRef = useRef(null);
  const SOCIAL_GLOBAL_COOLDOWN_MS = 60 * 1000;
  const SOCIAL_CHAR_COOLDOWN_MS = 3 * 60 * 1000;
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const noticeLongPressTimerRef = useRef(null);
  const swipeStartXRef = useRef(null);
  const swipeStartYRef = useRef(null);
  const lockStartYRef = useRef(null);
  const autoLockTimerRef = useRef(null);
  const edgeTurnTimerRef = useRef(null);
  const edgeTurnDirRef = useRef(null);
  const suppressAppClickUntilRef = useRef(0);
  const serviceWorkerReloadingRef = useRef(false);
  const serviceWorkerHadControllerRef = useRef(false);
  const dataImportRef = useRef(null);
  const chatroomImportRef = useRef(null);
  const [chatroomImportTarget, setChatroomImportTarget] = useState(null);
  const [chatroomImportPreview, setChatroomImportPreview] = useState(null);
  const [chatroomImporting, setChatroomImporting] = useState(false);
  const chatMsgsRef = useRef(null);
  const chatLoadAdjustRef = useRef(null);
  const thoughtJumpInProgressRef = useRef(false);
  const [walletSettingsOpen, setWalletSettingsOpen] = useState(false);
  const [walletSettingsPage, setWalletSettingsPage] = useState("main");
  const t = (key) => UI_TEXT[uiLanguage]?.[key] || UI_TEXT["zh-TW"]?.[key] || key;
  const tr = (zh, en, ja, ko) => ({ "zh-TW": zh, en, ja, ko }[uiLanguage] || zh);
  const getUiLanguageLabel = () => ({
    "zh-TW": "繁體中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
  }[uiLanguage] || uiLanguage);
  const getOutputLanguageDirective = () => {
    const languageLabel = getUiLanguageLabel();
    const playerGender = sanitizeText(playerProfile?.gender || "", 80).trim();
    const taiwaneseChineseDirective = uiLanguage === "zh-TW"
      ? "\n若輸出語言為繁體中文，必須使用臺灣繁體中文與臺灣慣用詞彙。"
      : "";
    const playerGenderDirective = playerGender
      ? `\n玩家填寫的性別／組成：${playerGender}。稱謂與單複數必須依此判斷。`
      : "\n玩家未填寫性別／組成；不得自行推測性別，且 {{user}} 預設為單一人物。";
    return `UI language: ${languageLabel}\n請使用${languageLabel}回覆。${taiwaneseChineseDirective}${playerGenderDirective}`;
  };
  const notify = (keyOrText, fallback) => {
    const message = UI_TEXT[uiLanguage]?.[keyOrText] || fallback || keyOrText;
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };
  const armAppClickSuppression = (ms = 600) => {
    suppressAppClickUntilRef.current = Date.now() + ms;
  };
  const ask = (keyOrText, fallback) => window.confirm(UI_TEXT[uiLanguage]?.[keyOrText] || fallback || keyOrText);
  const askInput = (keyOrText, defaultValue = "", fallback) => prompt(UI_TEXT[uiLanguage]?.[keyOrText] || fallback || keyOrText, defaultValue);

  useEffect(() => {
    let mounted = true;
    loadAppState(defaultAppState).then((data) => {
      if (!mounted) return;
      setCharacters(data.characters || []);
      setActiveCharId(data.activeCharId ?? null);
      setChatHistory(data.chatHistory || {});
      setChatModes(data.chatModes || {});
      setChatBackgrounds(data.chatBackgrounds && typeof data.chatBackgrounds === "object" ? data.chatBackgrounds : defaultAppState.chatBackgrounds);
      setGroupChats(Array.isArray(data.groupChats) ? data.groupChats : []);
      setChatScenes(data.chatScenes && typeof data.chatScenes === "object" ? data.chatScenes : defaultAppState.chatScenes);
      setGroupScenes(data.groupScenes && typeof data.groupScenes === "object" ? data.groupScenes : defaultAppState.groupScenes);
      setInnerThoughtSettings(data.innerThoughtSettings && typeof data.innerThoughtSettings === "object" ? data.innerThoughtSettings : defaultAppState.innerThoughtSettings);
      setProactiveSettings(data.proactiveSettings && typeof data.proactiveSettings === "object" ? data.proactiveSettings : defaultAppState.proactiveSettings);
      setProactiveUnread(data.proactiveUnread && typeof data.proactiveUnread === "object" ? data.proactiveUnread : defaultAppState.proactiveUnread);
      setPosts(data.posts || []);
      setSocialSettings(data.socialSettings && typeof data.socialSettings === "object" ? data.socialSettings : defaultAppState.socialSettings);
      setMemories(data.memories || {});
      setPhoneInboxCache(data.phoneInboxCache || {});
      setPhoneAppCache(data.phoneAppCache || {});
      setWallet(data.wallet || defaultAppState.wallet);
      setCharacterWallets(data.characterWallets || {});
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
      setUiLanguage(data.uiLanguage || defaultAppState.uiLanguage);
      const initialDock = (data.dockOrder && Array.isArray(data.dockOrder)) ? data.dockOrder : DOCK_APPS;
      setDockOrder(initialDock);
      if (data.homeSlots && Array.isArray(data.homeSlots) && data.homeSlots.length === HOME_SLOT_COUNT) {
        setHomeSlots(data.homeSlots);
      } else {
        const fallbackOrder = (data.homeOrder && Array.isArray(data.homeOrder))
          ? data.homeOrder
          : DEFAULT_APPS.filter(a => !DOCK_APPS.includes(a.id)).map(a => a.id);
        const nextSlots = Array.from({ length: HOME_SLOT_COUNT }, () => null);
        fallbackOrder
          .filter((id) => !initialDock.includes(id))
          .slice(0, PAGE_SIZE)
          .forEach((id, i) => { nextSlots[PAGE_SIZE + i] = id; });
        setHomeSlots(nextSlots);
      }
      setHydrated(true);
    }).catch(() => {
      if (mounted) setHydrated(true);
    });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      saveAppState({ characters, activeCharId, chatHistory, chatModes, chatBackgrounds, groupChats, chatScenes, groupScenes, innerThoughtSettings, proactiveSettings, proactiveUnread, posts, socialSettings, memories, lorebooks, chatLorebookBindings, phoneInboxCache, phoneAppCache, wallet, characterWallets, screenLockTimeout, apiPresets, playerProfile, apiConfig, ttsConfig, themeName, fontName, uiLanguage, homeSlots, dockOrder }).catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [hydrated, characters, activeCharId, chatHistory, chatModes, chatBackgrounds, groupChats, chatScenes, groupScenes, innerThoughtSettings, proactiveSettings, proactiveUnread, posts, socialSettings, memories, lorebooks, chatLorebookBindings, phoneInboxCache, phoneAppCache, wallet, characterWallets, screenLockTimeout, apiPresets, playerProfile, apiConfig, ttsConfig, themeName, fontName, uiLanguage, homeSlots, dockOrder]);
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

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const stopCurrentVoiceAudio = () => {
    const current = voiceAudioRef.current;
    if (!current) return;
    current.audio.pause();
    URL.revokeObjectURL(current.url);
    voiceAudioRef.current = null;
  };
  const playVoiceBlob = async (blob, key) => {
    stopCurrentVoiceAudio();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    voiceAudioRef.current = { audio, url, key };
    audio.onended = () => {
      if (voiceAudioRef.current?.audio === audio) voiceAudioRef.current = null;
      URL.revokeObjectURL(url);
      setVoicePlayback({ key: null, status: "idle" });
    };
    audio.onerror = () => {
      if (voiceAudioRef.current?.audio === audio) voiceAudioRef.current = null;
      URL.revokeObjectURL(url);
      setVoicePlayback({ key: null, status: "idle" });
      showToast(tr("語音播放失敗", "Voice playback failed", "音声の再生に失敗しました", "음성 재생 실패"));
    };
    await audio.play();
    setVoicePlayback({ key, status: "playing" });
  };
  const previewCharacterVoice = async (voiceSettings, text) => {
    try {
      const blob = await synthesizeSpeech({ text, config: ttsConfig, voiceSettings });
      await playVoiceBlob(blob, "voice-preview");
    } catch (err) {
      showToast(`${tr("語音試聽失敗", "Voice preview failed", "音声試聴に失敗しました", "음성 미리듣기 실패")}：${sanitizeText(err?.message || "", 120)}`);
    }
  };
  const loadElevenLabsDefaultVoices = async () => {
    const apiKey = ttsConfig.elevenlabs?.apiKey || "";
    try {
      setTtsConnectionState("loading");
      const voices = await fetchElevenLabsDefaultVoices(apiKey);
      if (!voices.length) throw new Error(tr("找不到可用聲音", "No available voices found", "利用可能な音声が見つかりません", "사용 가능한 음성을 찾을 수 없습니다"));
      setTtsVoices(voices);
      setTtsConfig((current) => ({
        ...current,
        elevenlabs: {
          ...current.elevenlabs,
          availableVoices: voices,
          defaultVoiceId: voices.some((voice) => voice.id === current.elevenlabs?.defaultVoiceId) ? current.elevenlabs.defaultVoiceId : voices[0].id,
        },
      }));
      setTtsConnectionState("success");
      showToast(tr(`連線成功，已載入 ${voices.length} 個可用聲音`, `Connected; loaded ${voices.length} available voices`, `接続成功：${voices.length}件の音声を読み込みました`, `연결 성공: 사용 가능한 음성 ${voices.length}개를 불러왔습니다`));
    } catch (err) {
      setTtsVoices([]);
      setTtsConnectionState("error");
      showToast(`${tr("ElevenLabs 連線失敗", "ElevenLabs connection failed", "ElevenLabs 接続失敗", "ElevenLabs 연결 실패")}：${sanitizeText(err?.message || "", 120)}`);
    }
  };
  const previewDefaultTtsVoice = async () => {
    const provider = ttsConfig.provider || "elevenlabs";
    const voiceId = ttsConfig[provider]?.defaultVoiceId || "";
    try {
      setTtsConnectionState("previewing");
      const voiceSettings = createDefaultVoiceSettings();
      voiceSettings.enabled = true;
      voiceSettings[provider].voiceId = voiceId;
      const blob = await synthesizeSpeech({
        text: tr("你好，語音 API 已連線成功。", "Hello, the voice API is connected.", "こんにちは、音声 API の接続に成功しました。", "안녕하세요, 음성 API 연결에 성공했습니다."),
        config: ttsConfig,
        voiceSettings,
      });
      await playVoiceBlob(blob, "tts-default-preview");
      setTtsConnectionState("success");
    } catch (err) {
      setTtsConnectionState("error");
      showToast(`${tr("語音測試失敗", "Voice test failed", "音声テストに失敗しました", "음성 테스트 실패")}：${sanitizeText(err?.message || "", 120)}`);
    }
  };
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
  const toggleCharacterVoice = async (char, message) => {
    const voiceSettings = char?.voiceSettings;
    if (!ttsConfig.enabled || !voiceSettings?.enabled) return;
    const provider = ttsConfig.provider || "elevenlabs";
    const voiceId = voiceSettings?.[provider]?.voiceId?.trim();
    if (!ttsConfig?.[provider]?.apiKey) return showToast(tr("請先到設定填寫語音 API Key", "Set the voice API key in Settings first", "設定で音声 API Key を入力してください", "설정에서 음성 API Key를 입력해주세요"));
    if (!voiceId) return showToast(tr("請先在角色設定填寫 Voice ID", "Set a Voice ID in character settings first", "キャラ設定で Voice ID を入力してください", "캐릭터 설정에서 Voice ID를 입력해주세요"));
    const key = `${provider}:${char.id}:${message.replyGroupId || message.id}`;
    if (voicePlayback.key === key && voicePlayback.status === "playing" && voiceAudioRef.current?.audio) {
      voiceAudioRef.current.audio.pause();
      setVoicePlayback({ key, status: "paused" });
      return;
    }
    if (voicePlayback.key === key && voicePlayback.status === "paused" && voiceAudioRef.current?.audio) {
      await voiceAudioRef.current.audio.play();
      setVoicePlayback({ key, status: "playing" });
      return;
    }
    const text = getReplySpeechText(char.id, message);
    if (!text) return showToast(tr("這段回覆沒有可朗讀的角色台詞", "This reply has no character dialogue to read", "この返信には読み上げる台詞がありません", "이 답변에는 읽을 캐릭터 대사가 없습니다"));
    const cacheKey = `${key}:${ttsConfig[provider]?.model || ""}:${voiceId}:${text}`;
    try {
      setVoicePlayback({ key, status: "loading" });
      let blob = voiceAudioCacheRef.current.get(cacheKey);
      if (!blob) {
        blob = await synthesizeSpeech({ text, config: ttsConfig, voiceSettings });
        voiceAudioCacheRef.current.set(cacheKey, blob);
      }
      await playVoiceBlob(blob, key);
    } catch (err) {
      setVoicePlayback({ key: null, status: "idle" });
      showToast(`${tr("語音生成失敗", "Voice generation failed", "音声生成に失敗しました", "음성 생성 실패")}：${sanitizeText(err?.message || "", 120)}`);
    }
  };
  const renderCharacterVoiceAction = (char, message, isActive, collapseWhenHidden = false) => {
    if (!ttsConfig.enabled || !char?.voiceSettings?.enabled) return null;
    const key = `${ttsConfig.provider || "elevenlabs"}:${char.id}:${message.replyGroupId || message.id}`;
    const status = voicePlayback.key === key ? voicePlayback.status : "idle";
    const isVisible = isActive || status !== "idle";
    return (
      <button
        type="button"
        className={`mp-voice-action ${isVisible ? "" : (collapseWhenHidden ? "mp-voice-action-collapsed" : "mp-voice-action-hidden")} ${status === "playing" ? "mp-voice-action-playing" : ""}`}
        disabled={status === "loading"}
        title={status === "playing" ? tr("暫停語音", "Pause voice", "音声を一時停止", "음성 일시정지") : tr("播放角色語音", "Play character voice", "キャラクター音声を再生", "캐릭터 음성 재생")}
        aria-label={status === "playing" ? tr("暫停語音", "Pause voice", "音声を一時停止", "음성 일시정지") : tr("播放角色語音", "Play character voice", "キャラクター音声を再生", "캐릭터 음성 재생")}
        onClick={(event) => { event.stopPropagation(); void toggleCharacterVoice(char, message); }}
      >
        {status === "loading" ? <LoaderCircle size={14} className="mp-voice-spinner" aria-hidden="true" /> : status === "playing" ? <Pause size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
      </button>
    );
  };
  const CHANGELOG_TEXT = {
    "1.2.1": {
      en: ["07/06 Update", "Redesigned Wallet with character filters, monthly income and expense totals, weekly charts, and monthly recaps", "Improved chat layout and message display; Enter now creates a new line on mobile and messages are sent only with the Send button", "Unified layouts across themes, added Peach Mousse and a theme-effects toggle, and refined visual effects", "Improved Settings, Custom CSS, and overall app interface stability", "Expanded the character phone with themed apps and improved chat refresh and player contact notes", "Added a global interface font selector"],
      ja: ["07/06 更新", "キャラクター別フィルター、月間収支、週別グラフ、月次まとめを備えたウォレット画面に刷新", "チャットのレイアウトとメッセージ表示を改善し、モバイルでは Enter で改行、送信ボタンでのみ送信するよう変更", "各テーマのレイアウトを統一し、ピーチムースとテーマ演出スイッチを追加、エフェクト表示を改善", "設定、カスタム CSS、各アプリ画面の構成と安定性を改善", "テーマ対応アプリを備えたキャラクタースマホを拡張し、チャット更新とプレイヤー連絡先メモを改善", "全体のインターフェースフォント選択機能を追加"],
      ko: ["07/06 업데이트", "캐릭터별 필터, 월간 수입·지출, 주간 차트와 월간 결산을 포함하도록 지갑 화면 개편", "채팅 레이아웃과 메시지 표시를 개선하고 모바일에서 Enter는 줄바꿈, 전송 버튼을 눌러야만 메시지가 전송되도록 변경", "모든 테마의 레이아웃을 통일하고 피치 무스와 테마 효과 스위치를 추가했으며 효과 표현 개선", "설정, 사용자 CSS 및 여러 앱 화면의 구조와 안정성 개선", "테마형 앱을 갖춘 캐릭터 휴대폰을 확장하고 채팅 새로고침과 플레이어 연락처 메모 개선", "전체 인터페이스 글꼴 선택 기능 추가"],
    },
    "1.2.0": {
      en: ["07/04 Update", "Added Pet Home with pet care, free roaming, map interactions, desktop pets, and data backup", "Added Matcha Lemon and Sea Salt Soda themes with unified primary-action colors", "Added automatic social posts so characters can share updates on their own", "Added proactive character messages with per-character controls and frequency settings"],
      ja: ["07/04 更新", "ペットのお世話、自由移動、マップ交流、デスクトップペット、データバックアップに対応したペットハウスを追加", "抹茶レモンとシーソルトソーダのテーマを追加し、主要操作ボタンの配色を統一", "キャラクターが自動で近況を投稿するSNS自動投稿機能を追加", "キャラクターごとにオン・オフと頻度を設定できる主動メッセージ機能を追加"],
      ko: ["07/04 업데이트", "펫 돌보기, 자유 이동, 지도 상호작용, 데스크톱 펫, 데이터 백업을 지원하는 펫 하우스 추가", "말차 레몬과 씨솔트 소다 테마를 추가하고 주요 동작 버튼 색상을 통일", "캐릭터가 스스로 근황을 공유하는 소셜 자동 게시 기능 추가", "캐릭터별 활성화와 빈도를 설정할 수 있는 선제 메시지 기능 추가"],
    },
    "1.1.9": {
      en: ["06/29 Update", "Added character inner thoughts with automatic generation, manual viewing, and thought history", "Added character voice support (beta), including ElevenLabs voice settings, previews, and manual playback in chat"],
      ja: ["06/29 更新", "キャラの心の声機能を追加し、自動生成・手動表示・履歴に対応", "キャラクター音声機能（テスト版）を追加し、ElevenLabs の音声設定・試聴・チャットでの手動再生に対応"],
      ko: ["06/29 업데이트", "캐릭터 속마음 기능을 추가하고 자동 생성, 수동 확인, 속마음 기록을 지원", "캐릭터 음성 기능(테스트 버전)을 추가하고 ElevenLabs 음성 설정, 미리듣기, 채팅 수동 재생을 지원"],
    },
    "1.1.8": {
      en: ["06/25 Update", "Added English, Japanese, and Korean UI languages; character replies now follow the selected UI language", "Added chatroom background image uploads", "Adjusted the player dialogue box in Reality mode"],
      ja: ["06/25 更新", "英語・日本語・韓国語の UI 言語を追加し、キャラの返信が選択中の UI 言語に合わせるようになりました", "チャットルーム背景画像のアップロード機能を追加", "現実モードのプレイヤー会話ボックスを調整"],
      ko: ["06/25 업데이트", "영어, 일본어, 한국어 UI 언어를 추가했으며 캐릭터 답변이 선택한 UI 언어를 따르도록 했습니다", "채팅방 배경 이미지 업로드 기능 추가", "현실 모드의 플레이어 대화 상자 조정"],
    },
    "1.1.6": {
      en: ["06/19 Update", "Added DeepSeek API", "Added group chat in chatrooms", "Added chatroom scene settings", "Added chatroom pinning"],
      ja: ["06/19 更新", "API に DeepSeek を追加", "チャットルームにグループチャットを追加", "チャットルームのシーン設定を追加", "チャットルームのピン留めを追加"],
      ko: ["06/19 업데이트", "API에 DeepSeek 추가", "채팅방에 그룹 채팅 기능 추가", "채팅방 장면 설정 추가", "채팅방 고정 기능 추가"],
    },
    "1.1.5": {
      en: ["06/13 Update", "Added Vertex AI API", "Fixed character settings and UI display"],
      ja: ["06/13 更新", "API に Vertex AI を追加", "キャラ関連設定と UI 表示を修正"],
      ko: ["06/13 업데이트", "API에 Vertex AI 추가", "캐릭터 관련 설정과 UI 표시 수정"],
    },
    "1.1.4": {
      en: ["06/03 Update", "Fixed Gemma / character settings and UI display"],
      ja: ["06/03 更新", "Gemma / キャラ関連設定と UI 表示を修正"],
      ko: ["06/03 업데이트", "Gemma / 캐릭터 관련 설정과 UI 표시 수정"],
    },
    "1.1.3": {
      en: ["06/02 Update", "Added character status / settings / import / export", "Fixed character and chat display", "Fixed player profile settings", "Improved settings stability"],
      ja: ["06/02 更新", "キャラのステータス / 設定 / インポート / エクスポートを追加", "キャラとチャット表示を修正", "プロフィール設定を修正", "設定の安定性を改善"],
      ko: ["06/02 업데이트", "캐릭터 상태 / 설정 / 가져오기 / 내보내기 추가", "캐릭터와 채팅 표시 수정", "프로필 설정 수정", "설정 안정성 개선"],
    },
    "1.1.2": {
      en: ["05/28 Update", "Added AI / chat / memory / character cards", "Added AIRP and chat prompts", "Added character management", "Fixed several bugs"],
      ja: ["05/28 更新", "AI / チャット / メモリ / キャラカードを追加", "AIRP とチャットプロンプトを追加", "キャラ管理を追加", "一部の不具合を修正"],
      ko: ["05/28 업데이트", "AI / 대화 / 기억 / 캐릭터 카드 추가", "AIRP 및 채팅 프롬프트 추가", "캐릭터 관리 추가", "일부 오류 수정"],
    },
  };
  const currentChangelogRaw = uiLanguage === "zh-TW"
    ? (CHANGELOG[VERSION] || [])
    : (CHANGELOG_TEXT[VERSION]?.[uiLanguage] || CHANGELOG[VERSION] || []);
  const currentChangelogTitle = currentChangelogRaw[0] || tr("版本更新", "Version update", "バージョン更新", "버전 업데이트");
  const currentChangelog = currentChangelogRaw.slice(1);
  const closeUpdateNotice = () => {
    try { localStorage.setItem("mali_seen_version", VERSION); } catch {}
    setUpdateNoticeOpen(false);
  };
  const playerAvatarRef = useRef(null);
  // 中日韓字元 ≈ 1 token，其餘（英文、標點）≈ 0.25 token
  const estimateTokens = (s) => {
    const str = String(s || "");
    const cjk = (str.match(/[぀-ヿ一-鿿가-힯]/g) || []).length;
    return Math.ceil(cjk + (str.length - cjk) / 4);
  };
  const getUserDisplayName = () => sanitizeText(playerProfile?.name || t("player"), 40) || t("player");
  const applyUserPlaceholder = (text) => String(text || "").replace(/\{\{user\}\}/g, getUserDisplayName());
  const replaceUserPlaceholderForWallet = (text) => String(text || "")
    .replace(/\{\{user\}\}/gi, getUserDisplayName())
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([，。！？、,.!?；;：:])/g, "$1")
    .trim();
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
  const handlePlayerAvatarUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const safe = sanitizeUserImageUrl(String(r.result || ""));
      if (!safe) return notify("頭像格式不支援", tr("頭像格式不支援", "Unsupported avatar format", "アバター形式に対応していません", "아바타 형식을 지원하지 않습니다"));
      setPlayerAvatarCrop({ src: safe, zoom: 1, panX: 0, panY: 0, dragging: false, dragStartX: 0, dragStartY: 0, startPanX: 0, startPanY: 0 });
    };
    r.readAsDataURL(f);
    e.target.value = "";
  };
  const applyPlayerAvatarCrop = () => {
    if (!playerAvatarCrop?.src) return;
    const img = new Image();
    img.onload = () => {
      const size = 320;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const iw = img.width;
      const ih = img.height;
      const scale = Math.max(size / iw, size / ih) * Math.max(1, playerAvatarCrop.zoom || 1);
      const dw = iw * scale;
      const dh = ih * scale;
      const panX = Number(playerAvatarCrop.panX || 0);
      const panY = Number(playerAvatarCrop.panY || 0);
      const maxShiftX = Math.max(0, (dw - size) / 2);
      const maxShiftY = Math.max(0, (dh - size) / 2);
      const shiftX = (maxShiftX * panX) / 100;
      const shiftY = (maxShiftY * panY) / 100;
      const dx = (size - dw) / 2 + shiftX;
      const dy = (size - dh) / 2 + shiftY;
      ctx.drawImage(img, dx, dy, dw, dh);
      const out = canvas.toDataURL("image/jpeg", 0.86);
      const safe = sanitizeUserImageUrl(out);
      if (!safe) return notify("頭像處理失敗", tr("頭像處理失敗", "Avatar processing failed", "アバターの処理に失敗しました", "아바타 처리가 실패했습니다"));
      setPlayerProfile((p) => ({ ...(p || {}), avatar: safe }));
      setPlayerAvatarCrop(null);
      notify("大頭貼已更新", tr("大頭貼已更新", "Avatar updated", "アバターを更新しました", "프로필 사진이 업데이트되었습니다"));
    };
    img.onerror = () => notify("圖片讀取失敗", tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
    img.src = playerAvatarCrop.src;
  };
  const startPlayerAvatarDrag = (e) => {
    if (!playerAvatarCrop) return;
    const px = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const py = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    setPlayerAvatarCrop((s) => ({ ...(s || {}), dragging: true, dragStartX: px, dragStartY: py, startPanX: s?.panX || 0, startPanY: s?.panY || 0 }));
  };
  const movePlayerAvatarDrag = (e) => {
    setPlayerAvatarCrop((s) => {
      if (!s?.dragging) return s;
      const px = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const py = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const nextPanX = (s.startPanX || 0) + ((px - (s.dragStartX || 0)) / 1.8);
      const nextPanY = (s.startPanY || 0) + ((py - (s.dragStartY || 0)) / 1.8);
      return { ...s, panX: Math.max(-100, Math.min(100, nextPanX)), panY: Math.max(-100, Math.min(100, nextPanY)) };
    });
  };
  const endPlayerAvatarDrag = () => setPlayerAvatarCrop((s) => s ? { ...s, dragging: false } : s);
  const onPlayerAvatarPointerDown = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
    startPlayerAvatarDrag(e);
  };
  const onPlayerAvatarPointerMove = (e) => {
    if (!playerAvatarCrop?.dragging) return;
    e.preventDefault();
    movePlayerAvatarDrag(e);
  };
  const onPlayerAvatarPointerUp = (e) => {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
    endPlayerAvatarDrag();
  };
  const activeChar = characters.find(c => c.id === activeCharId);
  const handleUnlock = () => { setUnlocking(true); setTimeout(() => { setLocked(false); setUnlocking(false); }, 450); };
  const onLockTouchStart = (e) => { lockStartYRef.current = e.touches?.[0]?.clientY ?? null; };
  const onLockTouchEnd = (e) => {
    const sy = lockStartYRef.current;
    const ey = e.changedTouches?.[0]?.clientY ?? null;
    lockStartYRef.current = null;
    if (sy === null || ey === null) return;
    const diff = sy - ey;
    if (diff > 70) handleUnlock();
  };
  const onLockMouseDown = (e) => { lockStartYRef.current = e.clientY ?? null; };
  const onLockMouseUp = (e) => {
    const sy = lockStartYRef.current;
    const ey = e.clientY ?? null;
    lockStartYRef.current = null;
    if (sy === null || ey === null) return;
    const diff = sy - ey;
    if (diff > 70) handleUnlock();
  };
  const onLockPointerDown = (e) => { lockStartYRef.current = e.clientY ?? null; };
  const onLockPointerUp = (e) => {
    const sy = lockStartYRef.current;
    const ey = e.clientY ?? null;
    lockStartYRef.current = null;
    if (sy === null || ey === null) return;
    const diff = sy - ey;
    if (diff > 70) handleUnlock();
  };
  const openApp = (id) => {
    armAppClickSuppression(220);
    if (id === "settings") setTempConfig({ ...apiConfig });
    if (id === "lorebook") setActiveLorebookId(null);
    if (id === "game") setGamePage("hub");
    if (id === "chat") {
      setCurrentChatChar(null);
      setCurrentChatGroup(null);
      setChatListTab("friends");
    }
    if (id === "phone") {
      setPhonePage(phoneViewCharId ? "desktop" : "picker");
      setPhoneActiveThreadId("player");
    }
    setCurrentApp(id);
  };
  const openAppFromTouch = (id, e) => {
    if (!e) return;
    e.preventDefault();
    e.stopPropagation();
    armAppClickSuppression(220);
    openApp(id);
  };
  const blockRecentAppClicks = (e) => {
    if (Date.now() <= suppressAppClickUntilRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  const closeApp = () => {
    armAppClickSuppression(220);
    setCurrentApp(null);
    setCurrentChatChar(null);
    setCurrentChatGroup(null);
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
      const limit = getChatTextLimit(messageEditor.mode);
      const next = (chatHistory[cid] || []).map((m) =>
        m.id === messageEditor.id ? { ...m, content: sanitizeText(messageEditor.content, limit) } : m
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
  const normalizeAssistantReply = (text) => {
    if (!text) return "";
    let t = String(text).trim();
    t = t.replace(/<internal>[\s\S]*?<\/internal>/gi, " ");
    t = t.replace(/<think>[\s\S]*?<\/think>/gi, " ");
    t = stripModeLabel(t);
    // 移除常見動作描寫格式：*...*、（...）、(...)
    t = t.replace(/\*[^*]{1,120}\*/g, " ");
    t = t.replace(/（[^（）]{1,120}）/g, " ");
    t = t.replace(/\([^()]{1,120}\)/g, " ");
    // 收斂空白與空行
    t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return t || "嗯，我在。";
  };
  const normalizeRealityReply = (text) => {
    const t = String(text || "")
      .replace(/\\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return t || "他安靜地看著你，像是在等你把話說完。";
  };
  const splitAssistantBubbles = (text) => {
    const normalized = String(text || "")
      .replace(/\\n/g, "\n")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (normalized.length <= 1) return [String(text || "").trim()].filter(Boolean);
    const maxBubbles = 6;
    if (normalized.length <= maxBubbles) return normalized;
    return [...normalized.slice(0, maxBubbles - 1), normalized.slice(maxBubbles - 1).join("\n")];
  };
  const isInnerThoughtAutoEnabled = (charId) => innerThoughtSettings?.[charId]?.auto !== false;
  const setInnerThoughtAutoEnabled = (charId, enabled) => {
    setInnerThoughtSettings((prev) => ({
      ...(prev || {}),
      [charId]: { ...(prev?.[charId] || {}), auto: !!enabled },
    }));
  };
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
  const normalizeInnerThought = (text) => {
    let clean = stripInternalBlocks(String(text || ""))
      .replace(/^\s*(?:心聲|內心(?:想法|獨白)?|想法)\s*[：:]\s*/i, "")
      .replace(/^[「『\"']+|[」』\"']+$/g, "")
      .replace(/\{\{char\}\}/gi, "")
      .replace(/\{\{user\}\}/gi, getUserDisplayName())
      .replace(/\n{2,}/g, "\n")
      .trim();
    return sanitizeText(clean, 240);
  };
  const isIncompleteInnerThought = (text) => {
    const clean = String(text || "").trim();
    return !clean || /[，,、：:；;（(「『【\[]$/.test(clean);
  };
  const generateInnerThought = async ({ char, messageId, source = "manual", historySnapshot = null }) => {
    if (!char?.id || !messageId || innerThoughtLoading[messageId]) return;
    const fullHistory = Array.isArray(historySnapshot) ? historySnapshot : (chatHistory[char.id] || []);
    const targetIndex = fullHistory.findIndex((m) => m.id === messageId);
    if (targetIndex < 0 || fullHistory[targetIndex]?.role !== "assistant") return;
    const target = fullHistory[targetIndex];
    const replyMessages = target.replyGroupId
      ? fullHistory.slice(0, targetIndex + 1).filter((m) => m.role === "assistant" && m.replyGroupId === target.replyGroupId)
      : (() => {
          const group = [];
          for (let index = targetIndex; index >= 0 && fullHistory[index]?.role === "assistant"; index -= 1) group.unshift(fullHistory[index]);
          return group;
        })();
    const targetReply = replyMessages.map((m) => m.content || "").filter(Boolean).join("\n");
    const targetMode = getMessageMode(target);
    const roundLimit = targetMode === "reality" ? 3 : 6;
    const eligibleMessages = fullHistory
      .slice(0, targetIndex + 1)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => getMessageMode(m) === targetMode);
    const recentRoundMessages = [];
    let includedRounds = 0;
    for (let index = eligibleMessages.length - 1; index >= 0; index -= 1) {
      const message = eligibleMessages[index];
      if (message.role === "user") {
        includedRounds += 1;
        if (includedRounds > roundLimit) break;
      }
      recentRoundMessages.unshift(message);
    }
    let contextMessages = recentRoundMessages
      .map((m) => ({
        role: m.role,
        content: sanitizeText(m.content || (m.image ? "[圖片]" : ""), 1200),
      }));
    const memoryContext = pickMemoriesForPrompt(char.id, contextMessages)
      .map((m, i) => `- ${i + 1}. ${m.text}`)
      .join("\n");
    const scene = chatScenes?.[char.id] || {};
    const sceneContext = [scene.location ? `地點：${sanitizeText(scene.location, 30)}` : "", scene.note ? `備註：${sanitizeText(scene.note, 100)}` : ""].filter(Boolean).join("\n");
    const prompt = `${getOutputLanguageDirective()}

你要寫的是角色「${char.name}」在目標訊息當下沒有說出口的心聲。

規則：
1. 必須使用角色第一人稱，並與目標訊息及當時劇情直接相關。
2. 只輸出心聲本身，不要角色名、標籤、引號、旁白、Markdown 或「我心想」。
3. 只寫 1 到 2 句，簡短自然，最多 80 字；每句都必須完整，不得在逗號、冒號或未完成語意處中斷。
4. 可以呈現嘴硬、猶豫、期待、隱瞞或話語與真心的反差，但不要為了反差硬加感情。
5. 不要替玩家描述內心、感受或未說出口的意圖。
6. 不要使用角色在當時不可能知道的資訊，也不要參考目標訊息之後的劇情。
7. 保留曖昧與留白，不要一次揭露角色所有秘密。

${sceneContext ? `[當時場景]\n${sceneContext}\n` : ""}${memoryContext ? `[相關記憶]\n${memoryContext}\n` : ""}
目標回覆（前端可能拆成多個氣泡，但屬於同一次回覆）：
${targetReply || target.content || "（無文字）"}`;
    const thoughtInstruction = "請根據以上對話與系統規則，生成角色在目標回覆當下沒有說出口的心聲。只輸出心聲本身。";
    const inputTokenLimit = 3000;
    const countThoughtInputTokens = () => estimateTokens(prompt) + estimateTokens(thoughtInstruction) + contextMessages.reduce((sum, message) => sum + estimateTokens(message.content || ""), 0);
    while (contextMessages.length > 1 && countThoughtInputTokens() > inputTokenLimit) {
      contextMessages = contextMessages.slice(1);
    }
    setInnerThoughtLoading((prev) => ({ ...prev, [messageId]: true }));
    try {
      const thoughtMessages = [
        ...contextMessages,
        {
          role: "user",
          content: thoughtInstruction,
        },
      ];
      let raw = await callAI(thoughtMessages, { ...apiConfig, maxTokens: 500 }, applyUserPlaceholder(prompt));
      if (isIncompleteInnerThought(raw)) {
        raw = await callAI([
          ...thoughtMessages,
          { role: "assistant", content: raw },
          { role: "user", content: "上一版心聲在語意未完成處中斷。請重新輸出一版完整的心聲，維持 1 到 2 句、最多 80 字，只輸出心聲本身。" },
        ], { ...apiConfig, maxTokens: 500 }, applyUserPlaceholder(prompt));
      }
      if (isIncompleteInnerThought(raw)) throw new Error(tr("模型回傳的心聲不完整，請再試一次", "The generated thought was incomplete. Please try again.", "生成された心の声が不完全です。もう一度お試しください", "생성된 속마음이 완전하지 않습니다. 다시 시도해주세요"));
      const content = normalizeInnerThought(raw);
      if (!content) throw new Error(tr("模型沒有產生心聲", "No inner thought was generated", "心の声が生成されませんでした", "속마음이 생성되지 않았습니다"));
      setChatHistory((prev) => ({
        ...prev,
        [char.id]: (prev[char.id] || []).map((m) => m.id === messageId ? {
          ...m,
          innerThought: { content, generatedAt: Date.now(), source, seen: source !== "auto" },
        } : m),
      }));
      setExpandedInnerThoughts((prev) => ({ ...prev, [messageId]: source !== "auto" }));
      if (source === "auto") {
        showToast(`${char.name || tr("角色", "The character", "キャラ", "캐릭터")}${tr(" 好像在想些什麼…", " seems to be thinking about something...", " は何か考えているみたい…", "이(가) 뭔가 생각하는 것 같아…")}`);
      }
    } catch (err) {
      showToast(`${tr("心聲生成失敗", "Failed to generate inner thought", "心の声の生成に失敗しました", "속마음 생성 실패")}：${sanitizeText(err?.message || "", 120)}`);
    } finally {
      setInnerThoughtLoading((prev) => ({ ...prev, [messageId]: false }));
    }
  };
  const renderInnerThought = (char, message) => {
    if (message?.role !== "assistant") return null;
    const thought = message.innerThought?.content || "";
    const expanded = !!expandedInnerThoughts[message.id];
    const loading = !!innerThoughtLoading[message.id];
    const unseenAutoThought = !!thought && message.innerThought?.source === "auto" && message.innerThought?.seen === false;
    const markInnerThoughtSeen = () => {
      if (!unseenAutoThought) return;
      setChatHistory((prev) => ({
        ...prev,
        [char.id]: (prev[char.id] || []).map((m) => m.id === message.id ? {
          ...m,
          innerThought: { ...m.innerThought, seen: true },
        } : m),
      }));
    };
    return (
      <div className={`mp-thought ${expanded && thought ? "expanded" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="mp-thought-bar">
          <button
            type="button"
            className="mp-thought-peek"
            disabled={loading}
            title={thought ? tr("顯示或收起心聲", "Show or hide inner thought", "心の声を表示・非表示", "속마음 표시 또는 숨기기") : tr("窺探心聲", "Peek at inner thought", "心の声をのぞく", "속마음 엿보기")}
            onClick={() => {
              if (thought) {
                if (!expanded) markInnerThoughtSeen();
                setExpandedInnerThoughts((prev) => ({ ...prev, [message.id]: !prev[message.id] }));
              } else {
                void generateInnerThought({ char, messageId: message.id, source: "manual" });
              }
            }}
          >
            <span className={unseenAutoThought ? "mp-thought-unseen-icon" : ""} aria-hidden="true">
              <Eye size={12} strokeWidth={2.1} />
            </span>
            <span>{loading
              ? tr("讀取中...", "Reading...", "読込中...", "읽는 중...")
              : !thought
                ? tr("窺探心聲", "Peek at inner thought", "心の声をのぞく", "속마음 엿보기")
                : unseenAutoThought
                  ? tr("心聲（未讀）", "Inner thought (new)", "心の声（未読）", "속마음 (새로움)")
                  : tr("心聲", "Inner thought", "心の声", "속마음")}</span>
          </button>
          {thought && (
            <button
              type="button"
              className="mp-thought-refresh"
              disabled={loading}
              title={tr("重新生成心聲", "Regenerate inner thought", "心の声を再生成", "속마음 다시 생성")}
              aria-label={tr("重新生成心聲", "Regenerate inner thought", "心の声を再生成", "속마음 다시 생성")}
              onClick={() => void generateInnerThought({ char, messageId: message.id, source: "manual" })}
            >
              <RefreshCw size={13} strokeWidth={2.1} aria-hidden="true" />
            </button>
          )}
        </div>
        {thought && expanded && <div className="mp-thought-content">{thought}</div>}
      </div>
    );
  };
  const isChatMode = (mode) => mode === "reality" || mode === "online";
  const getMessageMode = (m) => (isChatMode(m?.mode) ? m.mode : "online");
  const getLastCommittedChatMode = (charId) => {
    const list = chatHistory[charId] || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m?.role === "mode_transition") return isChatMode(m.toMode) ? m.toMode : "online";
      if (m?.role === "user" || m?.role === "assistant") return getMessageMode(m);
    }
    return "online";
  };
  const getSelectedChatMode = (charId) => chatModes?.[charId] || getLastCommittedChatMode(charId);
  const setSelectedChatMode = (charId, mode) => {
    if (!charId || !isChatMode(mode)) return;
    setChatModes((prev) => ({ ...(prev || {}), [charId]: mode }));
    setChatInput((value) => sanitizeText(value, getChatTextLimit(mode)));
  };
  const getModeLabel = (mode) => (mode === "reality" ? tr("現實模式", "Reality mode", "現実モード", "현실 모드") : tr("線上聊天", "Online chat", "オンラインチャット", "온라인 채팅"));
  const stripModeLabel = (text) => String(text || "")
    .replace(/^[\s\uFEFF\xA0]*[【\[]\s*(?:目前互動模式[:：]?\s*)?(線上聊天|現實模式)\s*[】\]]\s*/g, "")
    .replace(/^[\s\uFEFF\xA0]*(?:目前互動模式[:：]?\s*)?(線上聊天|現實模式)\s*[：:．。-]?\s*/g, "")
    .replace(/^[\s\uFEFF\xA0]*[【\[]\s*(?:模式[:：]?\s*)?(線上聊天|現實模式)\s*[】\]]\s*/g, "")
    .trim();
  const stripUserPlaceholder = (text) => String(text || "")
    .replace(/\{\{user\}\}/gi, getUserDisplayName())
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([，。！？、,.!?；;：:])/g, "$1")
    .trim();
  const stripInternalBlocks = (text) => String(text || "")
    .replace(/<internal>[\s\S]*?<\/internal>/gi, " ")
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const displayWalletText = (text) => {
    const name = getUserDisplayName();
    return String(text || "")
      .replace(/\{\{user\}\}/gi, name)
      .replace(/玩家/g, name)
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([，。！？、,.!?；;：:])/g, "$1")
      .trim();
  };
  const extractTransferDirective = (text) => {
    const raw = String(text || "");
    const matches = [...raw.matchAll(/\[\[TRANSFER:amount=(\d+)(?:;note=([^\]]*))?\]\]/gi)];
    if (!matches.length) return { text: raw, transfer: null };
    const transfer = matches[matches.length - 1];
    const cleaned = raw
      .replace(/\s*\[\[TRANSFER:amount=\d+(?:;note=[^\]]*)?\]\]\s*/gi, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    return {
      text: cleaned,
      transfer: {
        amount: Number(transfer[1]),
        note: sanitizeText(transfer[2] || "", 60),
      },
    };
  };
  const getChatTextLimit = (mode) => (mode === "reality" ? REALITY_CHAT_TEXT_LIMIT : ONLINE_CHAT_TEXT_LIMIT);
  const isGemmaModel = (modelName) => /gemma/i.test(String(modelName || ""));
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
  const buildRecentChatForSocialPost = (char) => {
    const list = (chatHistory[char.id] || [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-16)
      .map((m) => {
        const speaker = m.role === "user" ? "{{user}}" : char.name;
        const mode = getModeLabel(getMessageMode(m));
        const body = sanitizeText(m.content || (m.image ? "[圖片]" : ""), 180).replace(/\s+/g, " ").trim();
        return body ? `[${mode}] ${speaker}：${body}` : "";
      })
      .filter(Boolean);
    return list.join("\n");
  };
  const buildSocialPostPrompt = (char) => {
    const recentChat = buildRecentChatForSocialPost(char);
    const recentPosts = (posts || [])
      .filter((p) => p.charId === char.id)
      .slice(0, 3)
      .map((p, i) => `${i + 1}. ${sanitizeText(p.content || "", 80)}`)
      .filter(Boolean)
      .join("\n");
    return `${getOutputLanguageDirective()}

請替角色「${char.name}」寫一則可發在社群上的近況貼文。

社群定位：
- 這是朋友或熟人可能看得到的動態，不是私訊。
- 可以融合近期聊天的主題、情緒、事件後續或衍生想法，讓角色像有自己的生活延續。
- 不可以直接複述私聊內容，不可以像在對 {{user}} 單獨說話。
- 不要提到「剛剛跟你聊」「我們私訊」「{{user}}」或玩家姓名。
- 不要公開私密、曖昧、敏感、只屬於兩人之間的細節；若要引用，只能轉成模糊的心情或日常感想。
- 不要使用第二人稱「你」指向玩家。
- 內容 20~50 字，自然像真人隨手發文，不要標題、不要引號、不要解釋。

近期私聊脈絡（只能參考主題/情緒，不可外洩原文）：
${recentChat || "（近期沒有可參考的聊天）"}

近期貼文（避免重複語氣與主題）：
${recentPosts || "（無）"}`;
  };
  const formatPostTime = (ts) => {
    const time = Number(ts) || 0;
    const diff = Date.now() - time;
    if (diff < 60 * 1000) return tr("剛剛", "Just now", "たった今", "방금");
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return tr(`${mins} 分鐘前`, `${mins}m ago`, `${mins}分前`, `${mins}분 전`);
    const hours = Math.floor(mins / 60);
    if (hours < 24) return tr(`${hours} 小時前`, `${hours}h ago`, `${hours}時間前`, `${hours}시간 전`);
    const days = Math.floor(hours / 24);
    if (days === 1) return tr("昨天", "Yesterday", "昨日", "어제");
    if (days <= 3) return tr(`${days} 天前`, `${days}d ago`, `${days}日前`, `${days}일 전`);
    const locale = { "zh-TW": "zh-TW", en: "en-US", ja: "ja-JP", ko: "ko-KR" }[uiLanguage] || "zh-TW";
    return new Date(time).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  };
  const getPostAuthorName = (post) => post?.authorName || post?.charName || tr("未知", "Unknown", "不明", "알 수 없음");
  const getPostAuthorAvatar = (post) => post?.authorAvatar || post?.charAvatar || null;
  const getPostAuthorType = (post) => post?.authorType || (post?.charId ? "character" : "player");
  const getPlayerDisplayName = () => playerProfile?.nickname || playerProfile?.name || tr("你", "You", "あなた", "나");
  const getPlayerAvatar = () => sanitizeUserImageUrl(playerProfile?.avatar) || null;
  const getConnectionErrorPrefix = () => tr("連線錯誤：", "Connection error: ", "接続エラー: ", "연결 오류: ");
  const isConnectionErrorNotice = (content) => {
    const text = String(content || "");
    return text.startsWith("連線錯誤：") || text.startsWith("Connection error: ") || text.startsWith("接続エラー: ") || text.startsWith("연결 오류: ");
  };
  const getSceneState = (kind, id) => {
    if (kind === "group") return groupScenes?.[id] || { location: "", note: "" };
    return chatScenes?.[id] || { location: "", note: "" };
  };
  const getSceneLabel = (kind, id) => {
    const scene = getSceneState(kind, id);
    const bits = [
      scene.location ? sanitizeText(scene.location, 15) : "",
      scene.note ? sanitizeText(scene.note, 50) : "",
    ].filter(Boolean);
    return bits.join(" · ");
  };
  const renderSceneBar = (kind, id, title = tr("場景", "Scene", "シーン", "장면")) => {
    const scene = getSceneState(kind, id);
    const label = getSceneLabel(kind, id);
    const editing = sceneEditor?.kind === kind && sceneEditor?.id === id;
    const icon = "⌁";
    return (
      <div
        style={{
          margin: "0 14px 6px",
          padding: "0 2px",
        }}
      >
        {!editing ? (
          <div
            style={{
              fontSize: 11,
              color: "var(--mp-txt-l)",
              cursor: "pointer",
              lineHeight: 1.35,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            onClick={() => setSceneEditor({ kind, id, location: scene.location || "", note: scene.note || "" })}
          >
            <span style={{ flexShrink: 0 }}>{icon}</span>
            <span style={{ fontWeight: 800, color: "var(--mp-txt)", flexShrink: 0 }}>{title}：</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label || tr("點擊設定", "Tap to set", "タップして設定", "탭하여 설정")}</span>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <input
              className="mp-sinp"
              value={sceneEditor.location}
              onChange={(e) => setSceneEditor((s) => ({ ...s, location: e.target.value.slice(0, 15) }))}
              maxLength={15}
              placeholder={tr("地點（15字內）", "Location (up to 15 chars)", "場所（15文字以内）", "장소(15자 이내)")}
            />
            <input
              className="mp-sinp"
              value={sceneEditor.note}
              onChange={(e) => setSceneEditor((s) => ({ ...s, note: e.target.value.slice(0, 50) }))}
              maxLength={50}
              placeholder={tr("小備註（50字內）", "Note (up to 50 chars)", "メモ（50文字以内）", "메모(50자 이내)")}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
              <button
                className="mp-ibtn"
                style={{ padding: "3px 9px", minHeight: 24, fontSize: 10 }}
                onClick={() => {
                  const next = {
                    location: sanitizeText(sceneEditor.location || "", 15),
                    note: sanitizeText(sceneEditor.note || "", 50),
                  };
                  if (kind === "group") {
                    setGroupScenes((prev) => ({ ...prev, [id]: next }));
                  } else {
                    setChatScenes((prev) => ({ ...prev, [id]: next }));
                  }
                  setSceneEditor(null);
                }}
              >
                {tr("完成", "Done", "完了", "완료")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
  const formatSocialCount = (value) => {
    const n = Math.max(0, Math.round(Number(value) || 0));
    if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "")}萬`;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;
    return String(n);
  };
  const getCharacterSocialReach = (char) => {
    const text = normalizeForMatch([
      char?.name,
      char?.description,
      char?.personality,
      char?.scenario,
      char?.systemPrompt,
      char?.relationshipToUser,
      char?.creatorNotes,
      Array.isArray(char?.tags) ? char.tags.join(" ") : "",
    ].filter(Boolean).join(" "));
    const high = /(偶像|明星|藝人|歌手|演員|直播主|實況主|網紅|kol|influencer|model|模特|名人|人氣|粉絲|公眾人物|vtuber|youtuber)/i;
    const publicJob = /(醫生|律師|老師|教授|店長|老闆|企業家|主播|記者|作家|漫畫家|攝影師|設計師|學生會|社長)/i;
    const hidden = /(殺手|刺客|傭兵|特工|間諜|黑道|犯罪|通緝|逃亡|隱居|低調|孤僻|神秘|秘密|不擅社交|社恐|少朋友|無朋友|獨來獨往)/i;
    if (high.test(text)) return "celebrity";
    if (hidden.test(text)) return "private";
    if (publicJob.test(text)) return "local";
    return "normal";
  };
  const rollCharacterPostLikes = (char) => {
    const reach = getCharacterSocialReach(char);
    const rand = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    if (reach === "celebrity") return rand(1200, 28000);
    if (reach === "private") return rand(0, 18);
    if (reach === "local") return rand(24, 360);
    return rand(4, 95);
  };
  const shouldClampSocialPost = (content) => {
    const text = String(content || "");
    const manualLines = text.split(/\r?\n/).length;
    return manualLines > 5 || text.length > 115;
  };
  const shouldScrollComments = (comments) => {
    const list = comments || [];
    const totalChars = list.reduce((sum, c) => sum + String(c?.content || "").length, 0);
    const totalLines = list.reduce((sum, c) => sum + Math.ceil(String(c?.content || "").length / 26) + String(c?.content || "").split(/\r?\n/).length - 1, 0);
    return list.length > 6 || totalChars > 420 || totalLines > 10;
  };
  const getCommentDepth = (comment) => Math.min(3, Math.max(1, Number(comment?.depth) || (comment?.parentId ? 2 : 1)));
  const getCommentAuthorName = (comment, fallback = "") => (
    comment?.role === "assistant" ? (comment.charName || fallback) : getPlayerDisplayName()
  );
  const insertCommentAfterThread = (comments, anchorId, nextComment) => {
    const list = [...(comments || [])];
    if (!anchorId) return [...list, nextComment];
    const anchorIndex = list.findIndex((c) => c.id === anchorId);
    if (anchorIndex < 0) return [...list, nextComment];
    const anchorDepth = getCommentDepth(list[anchorIndex]);
    let insertAt = anchorIndex + 1;
    while (insertAt < list.length && getCommentDepth(list[insertAt]) > anchorDepth) insertAt += 1;
    list.splice(insertAt, 0, nextComment);
    return list;
  };
  const buildMemoryDigest = (memoriesList) => {
    const seen = new Set();
    return (memoriesList || [])
      .slice()
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .map((mem) => sanitizeText(mem?.text || "", 60))
      .filter(Boolean)
      .filter((text) => {
        const key = normalizeForMatch(text);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5)
      .map((text, idx) => `- ${idx + 1}. ${text}`)
      .join("\n");
  };
  const buildSocialCommentReplyPrompt = ({ char, post, targetComment, userText }) => `${getOutputLanguageDirective()}

社群貼文：「${post.content}」
${targetComment ? `你上一則留言：「${targetComment.content}」\n` : ""}{{user}} 回覆你：「${userText}」

請用角色「${char.name}」的口吻回覆這則社群留言。
規則：
- 這是公開/半公開社群留言，不是私訊。
- 回覆 1 句，最多 45 字。
- 不要公開私聊原文或敏感細節，不要角色名標籤，不要引號，不要解釋。`;
  const countTokenOverlap = (source, queryTokens) => {
    if (!queryTokens?.size) return 0;
    const sourceTokens = tokenizeForRecall(source);
    let hit = 0;
    queryTokens.forEach((t) => { if (sourceTokens.has(t)) hit += 1; });
    return hit;
  };
  const scoreCharacterForPlayerPost = (char, text) => {
    const qTokens = tokenizeForRecall(text);
    const recentMsgs = (chatHistory[char.id] || []).slice(-24);
    const recentChat = recentMsgs
      .map((m) => `${m.role === "user" ? "{{user}}" : char.name}: ${m.content || ""}`)
      .join("\n");
    const memoryText = (memories[char.id] || []).map((m) => m.text || "").join("\n");
    const profileText = [
      char.name,
      char.description,
      char.personality,
      char.scenario,
      char.systemPrompt,
      char.relationshipToUser,
      char.creatorNotes,
      memoryText,
      recentChat,
    ].filter(Boolean).join("\n");
    const recentCount = recentMsgs.filter((m) => m.role === "user" || m.role === "assistant").length;
    const latest = recentMsgs[recentMsgs.length - 1]?.time || 0;
    const recencyScore = latest ? Math.max(0, 6 - Math.floor((Date.now() - latest) / (24 * 60 * 60 * 1000))) : 0;
    const overlap = countTokenOverlap(profileText, qTokens);
    return (
      overlap * 3 +
      Math.min(10, recentCount) +
      recencyScore +
      (char.id === activeCharId ? 4 : 0) +
      Math.random() * 5
    );
  };
  const pickPlayerPostReactors = (text) => {
    const total = characters.length;
    if (total <= 0) return [];
    let target = total;
    if (total > 3 && total <= 5) target = 2 + Math.floor(Math.random() * (total - 1));
    if (total > 5 && total <= 10) target = Math.min(total, 3 + Math.floor(Math.random() * 6));
    if (total > 10) target = Math.min(total, 5 + Math.floor(Math.random() * 8));
    const nowMs = Date.now();
    return [...characters]
      .map((char) => ({ char, score: scoreCharacterForPlayerPost(char, text) + Math.random() * 4 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, target)
      .map((x, idx, arr) => {
        const progress = arr.length <= 1 ? 0.3 : idx / Math.max(1, arr.length - 1);
        const delay = Math.min(5 * 60 * 1000, 20000 + Math.floor(progress * 250000) + Math.floor(Math.random() * 30000));
        return {
        charId: x.char.id,
        charName: x.char.name,
        charAvatar: x.char.avatar,
        time: nowMs + delay,
        };
      });
  };
  const getVisibleLikedBy = (post) => (post?.likedBy || [])
    .filter((x) => !x.time || x.time <= socialTick)
    .sort((a, b) => (a.time || 0) - (b.time || 0));
  const getPostLikeCount = (post) => Math.max(0, Math.round(Number(post?.likes) || 0)) + getVisibleLikedBy(post).length;
  const getLikedByListText = (post) => {
    const likedBy = getVisibleLikedBy(post);
    if (!likedBy.length) return "";
    const names = likedBy.map((x) => x.charName).filter(Boolean).join("、");
    return names ? `${names} 喜歡這則貼文` : "";
  };
  const pickPlayerPostResponders = (text) => {
    const total = characters.length;
    if (total <= 0) return [];
    if (total <= 3) return [...characters];
    let target = 3;
    if (total > 5 && total <= 10) target = 3 + Math.floor(Math.random() * 3);
    if (total > 10) target = 3 + Math.floor(Math.random() * 5);
    target = Math.min(target, total);
    return [...characters]
      .map((char) => ({ char, score: scoreCharacterForPlayerPost(char, text) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, target)
      .map((x) => x.char);
  };
  const buildPlayerPostReplyPrompt = (char, post) => {
    const recentChat = buildRecentChatForSocialPost(char);
    const memoryText = (memories[char.id] || [])
      .filter((m) => m?.text)
      .slice(-5)
      .map((m) => `- ${m.text}`)
      .join("\n");
    return `${getOutputLanguageDirective()}

玩家在社群發了一則公開貼文：「${post.content}」

請判斷角色「${char.name}」是否會留言，並直接輸出留言內容。
規則：
- 這是社群留言，不是私訊，不要像只對玩家一個人撒嬌或報備。
- 可以根據角色設定、近期聊天主題、記憶做自然延伸，但不可公開私聊原文或敏感細節。
- 若貼文和角色沒有強關聯，也可以用普通朋友會留下的短回應。
- 請輸出 1 句，最多 45 字，不要角色名標籤、不要引號、不要解釋。

近期聊天參考（只能參考情緒與主題）：
${recentChat || "（沒有近期聊天）"}

記憶參考：
${memoryText || "（無）"}`;
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const formatMoney = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");
  const sortModelsByProvider = (provider, models) => {
    const list = [...(models || [])];
    if (provider !== "openrouter") return list;
    const companyOf = (m) => {
      const s = String(m || "");
      const slash = s.indexOf("/");
      return slash > 0 ? s.slice(0, slash).toLowerCase() : "zzz";
    };
    const isFree = (m) => /:free$/i.test(String(m || ""));
    return list.sort((a, b) => {
      const freeDiff = (isFree(b) ? 1 : 0) - (isFree(a) ? 1 : 0);
      if (freeDiff !== 0) return freeDiff;
      const ca = companyOf(a);
      const cb = companyOf(b);
      if (ca !== cb) return ca.localeCompare(cb);
      return String(a).localeCompare(String(b));
    });
  };
  const tokenizeForRecall = (text) => {
    const s = String(text || "").toLowerCase();
    const words = s.match(/[a-z0-9_]+|[\u4e00-\u9fff]/g) || [];
    return new Set(words.filter((w) => w.length >= 1));
  };
  const normalizeForMatch = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[，。！？、,.!?\s]+/g, " ")
      .trim();
  const normalizeMemoryText = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[，。！？、,.!?\s]+/g, " ")
      .trim();
  const memorySimilarity = (a, b) => {
    const sa = new Set(normalizeMemoryText(a).split(" ").filter(Boolean));
    const sb = new Set(normalizeMemoryText(b).split(" ").filter(Boolean));
    if (!sa.size || !sb.size) return 0;
    let inter = 0;
    sa.forEach((w) => { if (sb.has(w)) inter += 1; });
    return inter / Math.max(sa.size, sb.size);
  };
  const pickMemoriesForPrompt = (charId, recentMsgs) => {
    const list = (memories[charId] || []).filter((m) => m?.text);
    if (!list.length) return [];
    const pinned = list.filter((m) => m.pinned).slice(0, 5);
    const unpinned = list.filter((m) => !m.pinned);
    const query = recentMsgs.map((m) => `${m.role}:${m.content || ""}`).join("\n");
    const qTokens = tokenizeForRecall(query);
    const scored = unpinned.map((m) => {
      const tks = tokenizeForRecall(m.text);
      let hit = 0;
      tks.forEach((t) => { if (qTokens.has(t)) hit += 1; });
      return { m, hit };
    });
    scored.sort((a, b) => b.hit - a.hit || (b.m.date || 0) - (a.m.date || 0));
    const recalled = scored.filter((x) => x.hit > 0).slice(0, 3).map((x) => x.m);
    return [...pinned, ...recalled];
  };
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
    const query = recentMsgs.map((m) => `${m.role}:${m.content || ""}`).join("\n");
    const normalizedQuery = normalizeForMatch(query);
    const latestUserMsg = [...recentMsgs].reverse().find((m) => m?.role === "user")?.content || "";
    const normalizedLatestUser = normalizeForMatch(latestUserMsg);
    const qTokens = tokenizeForRecall(query);
    const binding = getChatLorebookBinding(charId);
    const enabledBooks = (lorebooks || []).filter((b) => binding.enabledBookIds.includes(b.id));
    const pinned = [];
    const matched = [];
    const candidates = [];
    enabledBooks.forEach((book) => {
      (book.entries || []).forEach((entry) => {
        const mode = binding.entryModes?.[entry.id] || "AUTO";
        const effectiveEnabled = mode === "PIN"
          ? true
          : (Object.prototype.hasOwnProperty.call(binding.entryOverrides, entry.id)
              ? !!binding.entryOverrides[entry.id]
              : !!entry.enabled);
        if (!effectiveEnabled) return;
        if (mode === "PIN") {
          pinned.push({ entry, bookName: book.name || "世界書", hit: 9999, mode });
          return;
        }
        const keys = Array.isArray(entry.keywords) ? entry.keywords : [];
        const keyTokens = new Set(keys.flatMap((k) => [...tokenizeForRecall(k)]));
        let hit = 0;
        keyTokens.forEach((t) => { if (qTokens.has(t)) hit += 1; });
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
          if (normalizedQuery.includes(nk)) hit += 3;
        });
        if (mode === "AUTO" && !forcedByKeyword && hit <= 0) return;
        if (hit > 0) matched.push({ entry, bookName: book.name || "世界書", hit, mode });
        if (hit > 0) candidates.push({ entry, bookName: book.name || "世界書", hit, mode });
      });
    });
    candidates.sort((a, b) => b.hit - a.hit || (b.entry.updatedAt || 0) - (a.entry.updatedAt || 0));
    const uniq = new Map();
    [...pinned, ...matched, ...candidates].forEach((x) => { if (!uniq.has(x.entry.id)) uniq.set(x.entry.id, x); });
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
        return { role: "user", content: `[轉帳] ${fromName}→${toName} ${formatMoney(m.amount || 0)}${m.note ? ` 備註:${sanitizeText(m.note, 60)}` : ""}`, image: null };
      }
      if (m.role === "system_notice") {
        if (isConnectionErrorNotice(m.content)) return null;
        return { role: "user", content: `[系統備註]\n${m.content || ""}`, image: null };
      }
      if (m.role === "user" || m.role === "assistant" || m.role === "system") {
        const summaryLine = m.imageSummary ? `\n[圖片摘要]\n${m.imageSummary}` : "";
        return { role: m.role, content: `${m.content || ""}${summaryLine}`.trim(), image: m.image || null };
      }
      return null;
    })
    .filter(Boolean);
  const generateAssistantForHistory = async ({ cid, char, nextForDisplay, selectedMode, um, text }) => {
      const now = new Date();
      const nowDate = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      const nowTime = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      const nowTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
      const nowContext = `[系統時間] 目前時間：${nowDate} ${nowTime} (${nowTz})`;
      const hist = formatMessagesForPrompt(nextForDisplay.slice(-30)).slice(-20);
      const hasCurrentImage = !!um.image;
      // 視覺 token 只花在本輪新圖：舊圖一律改用摘要文字，不再重送 image。
      const safeHist = hist.map((m, idx) => {
        const isLast = idx === hist.length - 1;
        if (hasCurrentImage && isLast) return m; // 本輪新圖保留 image
        return { ...m, image: null };
      });
      const picked = pickMemoriesForPrompt(cid, safeHist);
      const memoryContext = picked.map((m, i) => `- ${i + 1}. ${m.text}`).join("\n");
      const loreHits = pickLorebookEntriesForPrompt(cid, safeHist);
      const pinnedLore = loreHits.filter((x) => x.mode === "PIN");
      const autoLore = loreHits.filter((x) => x.mode !== "PIN");
      const pinnedLoreContext = pinnedLore.map((x, i) => `${i + 1}. [${x.bookName}] ${x.entry.title || "條目"}：${x.entry.content || ""}`).join("\n");
      const autoLoreContext = autoLore.map((x, i) => `- ${i + 1}. [${x.bookName}] ${x.entry.title || "條目"}：${x.entry.content || ""}`).join("\n");
      // 現實模式不提供轉帳功能：不注入轉帳規則、不解析轉帳指令（轉帳屬於線上聊天的手機世界觀）
      const allowTransfer = selectedMode !== "reality";
      const cw = characterWallets[cid];
      // 兩層注入：常駐迷你版確保角色隨時能出轉帳卡片；聊到錢才追加完整禮儀規則與交易紀錄
      const moneyTalkRe = /轉帳|轉錢|匯款|還錢|借錢|借我|付錢|買單|請客|紅包|零用錢|薪水|欠|[$＄]|\d\s*元|\d\s*塊/;
      const recentMoneyTalk = allowTransfer && [...safeHist.slice(-6).map((m) => m.content || ""), text || ""].some((s) => moneyTalkRe.test(String(s)));
      let walletContext = "";
      let transferRuleContext = "";
      if (!allowTransfer) {
        walletContext = cw ? [
          `[角色錢包]`,
          `目前餘額：${formatMoney(cw.balance || 0)}`,
          cw.summary ? `摘要：${cw.summary}` : "",
          `規則：錢包資料只能作為角色生活背景，不要把錢包資料當成每輪都要提及的內容。目前不提供轉帳功能，不要輸出任何轉帳指令。`,
        ].filter(Boolean).join("\n") : "";
      } else {
        walletContext = [
          `[角色錢包] 目前餘額：${formatMoney(Math.max(0, Number(cw?.balance || 0)))}`,
          `若情境自然、符合角色性格且你（{{char}}）真的決定轉帳給 {{user}}，就在回覆最後附上一個轉帳指令：[[TRANSFER:amount=金額;note=備註]]（note 可省略）。`,
          `餘額不足時不得宣稱轉帳成功，改為自然拒絕、延期或改轉較小金額。錢包資料只作為生活背景，不要每輪主動提及。`,
        ].join("\n");
        if (recentMoneyTalk) {
          transferRuleContext = [
            `[轉帳規則]`,
            `1. 玩家可以轉帳給角色，角色也可以主動轉帳給玩家；雙方轉帳與回應都要符合角色性格與當前情境，金額需合理，不因迎合而破壞人設。`,
            `2. 收到玩家轉帳時，依角色個性自然回應，不刻意改變平常的聊天語氣。`,
            `3. 只要角色真的有意願且餘額足夠，就直接輸出轉帳指令，不必等玩家要求；轉帳後可自然補充用途或情緒，但不能硬講。`,
            cw?.summary ? `錢包摘要：${cw.summary}` : "",
            (cw?.transactions || []).length ? `最近交易：\n${(cw.transactions || []).slice(0, 5).map((t) => `- ${t.type === "income" ? "收入" : "支出"} ${formatMoney(t.amount)}：${t.note}`).join("\n")}` : "",
          ].filter(Boolean).join("\n");
        }
      }
      const mergedContext = [
        getPlayerContextBlock(),
        nowContext,
        pinnedLoreContext ? `[強制條目 - 必須遵守]\n以下條目為當前對話的硬性規則，回覆時必須滿足：\n${pinnedLoreContext}` : "",
        memoryContext,
        walletContext,
        transferRuleContext,
        autoLoreContext ? `[世界書]\n${autoLoreContext}` : "",
      ].filter(Boolean).join("\n\n");
      // 全域 token 保險上限：先裁歷史，再裁 context，避免超過模型上下文。
      let boundedHist = [...safeHist];
      let boundedContext = mergedContext;
      const countAllTokens = () => (
        estimateTokens(boundedContext) +
        boundedHist.reduce((sum, m) => sum + estimateTokens(m?.content || ""), 0)
      );
      const contextTokenLimit = Math.min(
        TOTAL_CONTEXT_TOKEN_LIMIT,
        Math.max(10000, Number(apiConfig.contextTokens) || TOTAL_CONTEXT_TOKEN_LIMIT)
      );
      while (boundedHist.length > 6 && countAllTokens() > contextTokenLimit) {
        boundedHist.shift();
      }
      if (countAllTokens() > contextTokenLimit) {
        const overflow = countAllTokens() - contextTokenLimit;
        const trimChars = Math.max(0, Math.ceil(overflow * 3.5));
        if (trimChars > 0 && boundedContext.length > trimChars) {
          boundedContext = boundedContext.slice(0, boundedContext.length - trimChars);
        }
      }
      const finalHist = boundedHist.map((m) => ({ ...m, content: applyUserPlaceholder(m.content) }));
      const sysP = applyUserPlaceholder(buildChatSystemPrompt(char, boundedContext, apiConfig.model, selectedMode));
      const reply = await callAI(finalHist, apiConfig, sysP);
      const cleanReplyRaw = selectedMode === "reality" ? sanitizeText(normalizeRealityReply(reply), REALITY_CHAT_TEXT_LIMIT) : normalizeAssistantReply(reply);
      const extracted = extractTransferDirective(cleanReplyRaw);
      const cleanReply = stripModeLabel(stripInternalBlocks(extracted.text));
      const pendingTransfer = allowTransfer ? extracted.transfer : null;
      const currentCharWalletBalance = Math.max(0, Number(characterWallets[cid]?.balance || 0));
      const canApplyPendingTransfer = pendingTransfer?.amount > 0 && currentCharWalletBalance >= pendingTransfer.amount;
      const transferFailureNotice = pendingTransfer?.amount > 0 && !canApplyPendingTransfer
        ? tr(
            `轉帳失敗：${char.name || "角色"} 餘額不足，無法轉出 ${formatMoney(pendingTransfer.amount)}。請之後不要當作已成功轉帳。`,
            `Transfer failed: ${char.name || "Character"} has insufficient balance and cannot transfer ${formatMoney(pendingTransfer.amount)}. Do not treat it as completed later.`,
            `送金失敗: ${char.name || "キャラ"} の残高が不足しているため、${formatMoney(pendingTransfer.amount)} を送金できません。以後、成功したものとして扱わないでください。`,
            `이체 실패: ${char.name || "캐릭터"}의 잔액이 부족해 ${formatMoney(pendingTransfer.amount)}를 보낼 수 없습니다. 이후 성공한 것으로 처리하지 마세요.`
          )
        : null;
      let imageSummary = "";
      if (hasCurrentImage) {
        const base = text ? `{{user}} 訊息：${text}\n` : "";
        imageSummary = sanitizeText(`${base}重點：${cleanReply}`.slice(0, 220), 220);
      }
      if (hasCurrentImage && imageSummary) {
        setChatHistory((h) => ({
          ...h,
          [cid]: (h[cid] || []).map((m) => (m.id === um.id ? { ...m, imageSummary } : m)),
        }));
      }
      const bubbles = cleanReply.trim() ? (selectedMode === "reality" ? [cleanReply] : splitAssistantBubbles(cleanReply)) : [];
      const replyGroupId = gid();
      const assistantMessages = bubbles.map((content, index) => ({
        id: gid(),
        replyGroupId,
        replyGroupIndex: index,
        replyGroupSize: bubbles.length,
        role: "assistant",
        content,
        mode: selectedMode,
        time: Date.now(),
      }));
      let lastAssistantMessage = null;
      for (let i = 0; i < bubbles.length; i++) {
        const delay = i === 0 ? 420 : Math.min(1200, 520 + bubbles[i].length * 18);
        await wait(delay);
        lastAssistantMessage = { ...assistantMessages[i], time: Date.now() };
        assistantMessages[i] = lastAssistantMessage;
        setChatHistory(h => ({ ...h, [cid]: [...(h[cid] || []), lastAssistantMessage] }));
      }
      if (pendingTransfer?.amount > 0 && canApplyPendingTransfer) {
        await wait(220);
        applyCharacterTransferToPlayer({ cid, char, amount: pendingTransfer.amount, note: pendingTransfer.note, time: Date.now() });
      } else if (transferFailureNotice) {
        await wait(220);
        setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), { id: gid(), role: "system_notice", content: transferFailureNotice, time: Date.now() }] }));
      }
      if (lastAssistantMessage && isInnerThoughtAutoEnabled(cid) && Math.random() < 0.25) {
        const snapshot = [...nextForDisplay, ...assistantMessages];
        void generateInnerThought({ char, messageId: lastAssistantMessage.id, source: "auto", historySnapshot: snapshot });
      }
  };

  const PROACTIVE_FREQUENCY_HOURS = { low: [8, 16], normal: [4, 8], high: [1, 3] };
  const getProactiveIdleThresholdMs = (frequency) => {
    const [minH, maxH] = PROACTIVE_FREQUENCY_HOURS[frequency] || PROACTIVE_FREQUENCY_HOURS.normal;
    return (minH + Math.random() * (maxH - minH)) * 60 * 60 * 1000;
  };
  const getProactiveEligibleCharacters = () => {
    const now = Date.now();
    return characters.filter((c) => {
      const settings = proactiveSettings?.[c.id];
      if (!settings?.enabled) return false;
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
      const sysP = applyUserPlaceholder(`${buildChatSystemPrompt(char, mergedMemoryContext, apiConfig.model, selectedMode)}\n\n${proactiveRule}`);
      const triggerMsg = { role: "user", content: applyUserPlaceholder("[系統觸發]\n這不是 {{user}} 說的話，只是系統提示：時間已經過去，請 {{char}} 主動傳訊息給 {{user}}。"), image: null };
      const finalHist = [...recent.map((m) => ({ ...m, content: applyUserPlaceholder(m.content) })), triggerMsg];
      const reply = await callAI(finalHist, apiConfig, sysP);
      const cleanReplyRaw = selectedMode === "reality" ? sanitizeText(normalizeRealityReply(reply), REALITY_CHAT_TEXT_LIMIT) : normalizeAssistantReply(reply);
      const cleanReply = stripModeLabel(stripInternalBlocks(cleanReplyRaw));
      if (!cleanReply.trim()) return;
      const bubbles = selectedMode === "reality" ? [cleanReply] : splitAssistantBubbles(cleanReply);
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
          time: Date.now(),
        };
        firedAny = true;
        setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), msg] }));
      }
      if (!firedAny) return;
      if (currentChatCharIdRef.current !== cid) {
        setProactiveUnread((prev) => ({ ...prev, [cid]: (Number(prev?.[cid]) || 0) + bubbles.length }));
        showToast(tr(`${char.name} 傳了訊息給你`, `${char.name} sent you a message`, `${char.name} からメッセージが届きました`, `${char.name}님이 메시지를 보냈습니다`));
      }
    } catch (err) {
      console.warn("[proactive message]", err);
    }
  };
  const runProactiveSweep = () => {
    if (!hydrated || proactiveSweepingRef.current || !canUseCurrentProvider()) return;
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

  const sendMessage = async () => {
    if (!currentChatChar || isTyping) return;
    const cid = currentChatChar.id;
    const prev = chatHistory[cid] || [];
    const committedMode = getLastCommittedChatMode(cid);
    const selectedMode = getSelectedChatMode(cid);
    const textLimit = getChatTextLimit(selectedMode);
    const text = sanitizeText(chatInput.trim(), textLimit); const img = chatImage?.data || null;
    if (!text && !img) return;
    const modeChanged = committedMode !== selectedMode;
    const nowMs = Date.now();
    const transition = modeChanged
      ? { id: gid(), role: "mode_transition", fromMode: committedMode, toMode: selectedMode, time: nowMs }
      : null;
    const um = { id: gid(), role: "user", content: text, image: img, imageSummary: "", mode: selectedMode, time: nowMs };
    const nextForDisplay = transition ? [...prev, transition, um] : [...prev, um];
    setChatHistory(h => ({ ...h, [cid]: nextForDisplay }));
    setChatInput(""); setChatImage(null); setChatActionPanelOpen(false); setIsTyping(true);
    try {
      await generateAssistantForHistory({ cid, char: currentChatChar, nextForDisplay, selectedMode, um, text });
    } catch (err) {
      addChatErrorNotice(cid, err);
    }
    setIsTyping(false);
  };
  const retryChatFromNotice = async (noticeId) => {
    if (!currentChatChar || isTyping) return;
    const cid = currentChatChar.id;
    const list = chatHistory[cid] || [];
    const noticeIdx = list.findIndex((m) => m.id === noticeId);
    if (noticeIdx < 0) return;
    const userMsg = [...list.slice(0, noticeIdx)].reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    const selectedMode = getMessageMode(userMsg);
    const nextForDisplay = list.filter((m) => m.id !== noticeId);
    setChatHistory((h) => ({ ...h, [cid]: nextForDisplay }));
    setIsTyping(true);
    try {
      await generateAssistantForHistory({
        cid,
        char: currentChatChar,
        nextForDisplay,
        selectedMode,
        um: userMsg,
        text: userMsg.content || "",
      });
    } catch (err) {
      addChatErrorNotice(cid, err);
    }
    setIsTyping(false);
  };
  const parseShareEventNotice = (text) => {
    const raw = String(text || "");
    if (!raw.startsWith("[APP_SHARE_EVENT]")) return null;
    const lines = raw.split("\n").map((x) => x.trim()).filter(Boolean);
    const meta = {};
    let bodyStart = 1;
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].includes("=")) { bodyStart = i; break; }
      const idx = lines[i].indexOf("=");
      const k = lines[i].slice(0, idx);
      const v = lines[i].slice(idx + 1);
      meta[k] = v;
      bodyStart = i + 1;
    }
    return { meta, body: lines.slice(bodyStart).join("\n") };
  };

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

  const addCharacter = (c) => {
    const nc = {
      ...c,
      id: gid(),
      createdAt: Date.now(),
      name: sanitizeText(c.name, 80),
      description: sanitizeText(c.description, 8000),
      personality: sanitizeText(c.personality, 8000),
      scenario: sanitizeText(c.scenario, 8000),
      firstMessage: sanitizeText(c.firstMessage, 4000),
      messageExamples: sanitizeText(c.messageExamples, 12000),
      systemPrompt: sanitizeText(c.systemPrompt, 8000),
      relationshipToUser: sanitizeText(c.relationshipToUser, 120),
      creator: sanitizeText(c.creator, 80),
      creatorNotes: sanitizeText(c.creatorNotes, 4000),
      avatar: sanitizeUserImageUrl(c.avatar) || null,
      tags: Array.isArray(c.tags) ? c.tags.map((t) => sanitizeText(t, 30)).filter(Boolean).slice(0, 20) : [],
      statusText: sanitizeText(c.statusText || "", 80),
      statusUpdatedAt: c.statusUpdatedAt || 0,
      pinned: !!c.pinned,
      voiceSettings: normalizeCharacterVoiceSettings(c.voiceSettings),
    };
    setCharacters(p => [...p, nc]);
    if (!activeCharId) setActiveCharId(nc.id);
    setModal(null);
    showToast(`${nc.name} 已加入`);
  };
  const updateCharacter = (id, patch) => {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, voiceSettings: normalizeCharacterVoiceSettings(patch.voiceSettings ?? c.voiceSettings), avatar: sanitizeUserImageUrl(patch.avatar ?? c.avatar) || null, statusText: sanitizeText((patch.statusText ?? c.statusText) || "", 80), pinned: typeof patch.pinned === "boolean" ? patch.pinned : !!c.pinned } : c)));
    setModal(null);
    setEditingCharacter(null);
    showToast(tr("角色已更新", "Character updated", "キャラを更新しました", "캐릭터가 업데이트되었습니다"));
  };
  const exportCharacter = (char) => {
    if (!char) return;
    const payload = {
      format: "maliphone-character",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      character: {
        name: sanitizeText(char.name, 80),
        avatar: sanitizeUserImageUrl(char.avatar) || null,
        description: sanitizeText(char.description, 8000),
        systemPrompt: sanitizeText(char.systemPrompt, 8000),
        relationshipToUser: sanitizeText(char.relationshipToUser, 120),
        voiceSettings: char.voiceSettings || createDefaultVoiceSettings(),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = sanitizeText(char.name || "character", 40).replace(/[\\/:*?"<>|]+/g, "_").trim() || "character";
    a.href = url;
    a.download = `${safeName}.malichar.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`${char.name || tr("角色", "character", "キャラ", "캐릭터")} ${tr("已匯出", "exported", "書き出しました", "내보냈습니다")}`);
  };
  const getExportableAppState = () => ({
    version: VERSION,
    exportedAt: new Date().toISOString(),
    format: "maliphone-app-state",
    formatVersion: 1,
    state: {
      characters,
      activeCharId,
      chatHistory,
      chatModes,
      chatBackgrounds,
      groupChats,
      chatScenes,
      groupScenes,
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
      screenLockTimeout,
      apiPresets,
      playerProfile,
      apiConfig,
      ttsConfig,
      themeName,
      fontName,
      uiLanguage,
      homeSlots,
      dockOrder,
    },
  });
  const downloadJsonFile = (payload, filename) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const exportAllData = () => {
    const safeName = `maliphone-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJsonFile(getExportableAppState(), safeName);
    showToast(tr("資料已匯出", "Data exported", "データを書き出しました", "데이터를 내보냈습니다"));
  };
  const deleteChatroomForCharacter = (charId, charName = "這個角色") => {
    if (!charId) return;
    const firstConfirm = window.confirm(`確定要刪除「${charName}」的聊天室嗎？這只會清掉對話，不會刪除角色本身。`);
    if (!firstConfirm) return;
    const secondConfirm = window.confirm(tr("請再次確認：刪除後將無法復原這個聊天室的對話紀錄，確定要繼續嗎？", "Please confirm again: this chat history cannot be restored after deletion. Continue?", "再確認してください。削除後はこのチャット履歴を復元できません。続けますか？", "다시 확인해주세요. 삭제 후에는 이 채팅 기록을 복구할 수 없습니다. 계속할까요?"));
    if (!secondConfirm) return;
    setChatHistory((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    setChatModes((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    setChatLorebookBindings((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    setChatBackgrounds((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    setChatScenes((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    setInnerThoughtSettings((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    if (currentChatChar?.id === charId) {
      setChatActionPanelOpen(false);
      setMessageEditor(null);
      setActiveMessageId(null);
      setIsTyping(false);
      setChatInput("");
    }
    showToast(tr("聊天室已刪除", "Chatroom deleted", "チャットルームを削除しました", "채팅방을 삭제했습니다"));
  };
  const exportChatroomForCharacter = (charId, charName = "這個角色") => {
    if (!charId) return;
    const payload = {
      format: "maliphone-chatroom",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      characterId: charId,
      characterName: charName,
      chatHistory: chatHistory?.[charId] || [],
      chatMode: chatModes?.[charId] || "online",
      chatBackground: chatBackgrounds?.[charId] || "",
      chatLorebookBinding: chatLorebookBindings?.[charId] || null,
      innerThoughtSetting: innerThoughtSettings?.[charId] || null,
    };
    const safeName = sanitizeText(charName || "chatroom", 40).replace(/[\\/:*?"<>|]+/g, "_").trim() || "chatroom";
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadJsonFile(payload, `chat_${safeName}_${dateTag}.json`);
    showToast(tr("聊天室已匯出", "Chatroom exported", "チャットルームを書き出しました", "채팅방을 내보냈습니다"));
  };
  const summarizeImportedChatroom = (incoming) => {
    const src = incoming?.format === "maliphone-chatroom" ? incoming : incoming?.chatHistory ? incoming : null;
    return {
      format: incoming?.format === "maliphone-chatroom" ? "maliphone-chatroom" : "legacy",
      exportedAt: incoming?.exportedAt || null,
      messages: Array.isArray(src?.chatHistory) ? src.chatHistory.length : 0,
      hasMode: !!src?.chatMode,
      hasBackground: !!src?.chatBackground,
      hasBinding: !!src?.chatLorebookBinding,
    };
  };
  const openChatroomImport = (charId) => {
    setChatroomImportTarget(charId);
    chatroomImportRef.current?.click();
  };
  const importChatroomFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setChatroomImporting(true);
    try {
      const raw = JSON.parse(await file.text());
      setChatroomImportPreview({
        fileName: file.name,
        fileSize: file.size,
        summary: summarizeImportedChatroom(raw),
        raw,
      });
    } catch (err) {
      showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
      if (chatroomImportRef.current) chatroomImportRef.current.value = "";
      setChatroomImporting(false);
    } finally {
      if (chatroomImportRef.current) chatroomImportRef.current.value = "";
    }
  };
  const confirmChatroomImportPreview = async () => {
    const raw = chatroomImportPreview?.raw;
    const targetId = chatroomImportTarget;
    if (!raw || !targetId) return;
    if (!window.confirm(tr("確認匯入後，將覆蓋這個聊天室的對話紀錄。確定要繼續嗎？", "Import will overwrite this chatroom's conversation history. Continue?", "インポートするとこのチャットルームの会話履歴が上書きされます。続けますか？", "가져오기를 하면 이 채팅방의 대화 기록이 덮어써집니다. 계속할까요?"))) return;
    const chatHistoryItems = Array.isArray(raw?.chatHistory)
      ? raw.chatHistory
      : Array.isArray(raw?.messages)
        ? raw.messages
        : Array.isArray(raw)
          ? raw
          : [];
    const targetName = currentChatChar?.id === targetId ? currentChatChar.name : (characters.find((c) => c.id === targetId)?.name || tr("這個角色", "this character", "このキャラ", "이 캐릭터"));
    setChatHistory((prev) => ({ ...prev, [targetId]: chatHistoryItems }));
    if (raw?.chatMode) {
      setChatModes((prev) => ({ ...prev, [targetId]: raw.chatMode }));
    }
    if (Object.prototype.hasOwnProperty.call(raw || {}, "chatBackground")) {
      setChatBackgrounds((prev) => ({ ...prev, [targetId]: normalizeChatBackground(raw.chatBackground) }));
    }
    if (raw?.chatLorebookBinding) {
      setChatLorebookBindings((prev) => ({ ...prev, [targetId]: raw.chatLorebookBinding }));
    }
    if (raw?.innerThoughtSetting) {
      setInnerThoughtSettings((prev) => ({ ...prev, [targetId]: raw.innerThoughtSetting }));
    }
    if (currentChatChar?.id === targetId) {
      setChatActionPanelOpen(false);
      setMessageEditor(null);
      setActiveMessageId(null);
      setIsTyping(false);
      setChatInput("");
    }
    showToast(tr("聊天室已匯入", "Chatroom imported", "チャットルームを取り込みました", "채팅방을 가져왔습니다").replace("聊天室", targetName));
    setChatroomImportPreview(null);
    setChatroomImportTarget(null);
    setChatroomImporting(false);
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
    };
  };
  const applyImportedAppState = async (incoming) => {
    const src = incoming?.state && incoming?.format === "maliphone-app-state" ? incoming.state : incoming;
    if (!src || typeof src !== "object") throw new Error(tr("檔案內容不正確", "Invalid file content", "ファイル内容が正しくありません", "파일 내용이 올바르지 않습니다"));
    const nextState = {
      ...defaultAppState,
      characters: Array.isArray(src.characters) ? src.characters : [],
      activeCharId: src.activeCharId ?? null,
      chatHistory: src.chatHistory && typeof src.chatHistory === "object" ? src.chatHistory : {},
      chatModes: src.chatModes && typeof src.chatModes === "object" ? src.chatModes : {},
      chatBackgrounds: src.chatBackgrounds && typeof src.chatBackgrounds === "object" ? src.chatBackgrounds : {},
      groupChats: Array.isArray(src.groupChats) ? src.groupChats : [],
      chatScenes: src.chatScenes && typeof src.chatScenes === "object" ? src.chatScenes : {},
      groupScenes: src.groupScenes && typeof src.groupScenes === "object" ? src.groupScenes : {},
      innerThoughtSettings: src.innerThoughtSettings && typeof src.innerThoughtSettings === "object" ? src.innerThoughtSettings : {},
      proactiveSettings: src.proactiveSettings && typeof src.proactiveSettings === "object" ? src.proactiveSettings : {},
      proactiveUnread: src.proactiveUnread && typeof src.proactiveUnread === "object" ? src.proactiveUnread : {},
      posts: Array.isArray(src.posts) ? src.posts : [],
      socialSettings: src.socialSettings && typeof src.socialSettings === "object" ? src.socialSettings : { autoPost: false },
      memories: src.memories && typeof src.memories === "object" ? src.memories : {},
      lorebooks: Array.isArray(src.lorebooks) ? src.lorebooks : [],
      chatLorebookBindings: src.chatLorebookBindings && typeof src.chatLorebookBindings === "object" ? src.chatLorebookBindings : {},
      phoneInboxCache: src.phoneInboxCache && typeof src.phoneInboxCache === "object" ? src.phoneInboxCache : {},
      phoneAppCache: src.phoneAppCache && typeof src.phoneAppCache === "object" ? src.phoneAppCache : {},
      wallet: src.wallet && typeof src.wallet === "object" ? src.wallet : defaultAppState.wallet,
      characterWallets: src.characterWallets && typeof src.characterWallets === "object" ? src.characterWallets : {},
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
      uiLanguage: src.uiLanguage || defaultAppState.uiLanguage,
      homeSlots: Array.isArray(src.homeSlots) && src.homeSlots.length === HOME_SLOT_COUNT ? src.homeSlots : Array.from({ length: HOME_SLOT_COUNT }, () => null),
      dockOrder: Array.isArray(src.dockOrder) && src.dockOrder.length ? src.dockOrder : DOCK_APPS,
    };
    setCharacters(nextState.characters);
    setActiveCharId(nextState.activeCharId);
    setChatHistory(nextState.chatHistory);
    setChatModes(nextState.chatModes);
    setChatBackgrounds(nextState.chatBackgrounds);
    setGroupChats(nextState.groupChats);
    setChatScenes(nextState.chatScenes);
    setGroupScenes(nextState.groupScenes);
    setInnerThoughtSettings(nextState.innerThoughtSettings);
    setProactiveSettings(nextState.proactiveSettings);
    setProactiveUnread(nextState.proactiveUnread);
    setPosts(nextState.posts);
    setSocialSettings(nextState.socialSettings);
    setMemories(nextState.memories);
    setLorebooks(nextState.lorebooks);
    setChatLorebookBindings(nextState.chatLorebookBindings);
    setPhoneInboxCache(nextState.phoneInboxCache);
    setPhoneAppCache(nextState.phoneAppCache);
    setWallet(nextState.wallet);
    setCharacterWallets(nextState.characterWallets);
    setScreenLockTimeout(nextState.screenLockTimeout);
    setApiPresets(nextState.apiPresets);
    setPlayerProfile(nextState.playerProfile);
    setApiConfig(nextState.apiConfig);
    setTtsConfig(nextState.ttsConfig);
    setThemeName(nextState.themeName);
    setFontName(nextState.fontName);
    setUiLanguage(nextState.uiLanguage);
    setHomeSlots(nextState.homeSlots);
    setDockOrder(nextState.dockOrder);
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
  const importAllData = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDataImporting(true);
    try {
      const raw = JSON.parse(await file.text());
      setDataImportPreview({
        fileName: file.name,
        fileSize: file.size,
        summary: summarizeImportedData(raw),
        raw,
      });
    } catch (err) {
      showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
      if (dataImportRef.current) dataImportRef.current.value = "";
      setDataImporting(false);
    } finally {
      if (dataImportRef.current) dataImportRef.current.value = "";
    }
  };
  const confirmImportPreview = async () => {
    if (!dataImportPreview?.raw) return;
    if (!window.confirm(tr("確認匯入後，將覆蓋目前裝置上的全域資料。確定要繼續嗎？", "Import will overwrite the current device's global data. Continue?", "インポートすると現在の端末の全体データが上書きされます。続けますか？", "가져오기를 하면 현재 기기의 전체 데이터가 덮어써집니다. 계속할까요?"))) return;
    try {
      await applyImportedAppState(dataImportPreview.raw);
      showToast(tr("資料已匯入", "Data imported", "データを取り込みました", "데이터를 가져왔습니다"));
      setDataImportPreview(null);
    } catch (err) {
      showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
    } finally {
      setDataImporting(false);
    }
  };
  const canUseCurrentProvider = () => {
    const isOllamaLocal = apiConfig.provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(apiConfig.baseUrl || "");
    const providerNeedsApiKey = !(apiConfig.provider === "ollama" && isOllamaLocal);
    return !providerNeedsApiKey || !!apiConfig.apiKey;
  };
  const refreshCharacterStatus = async (charId, force = false) => {
    if (statusRefreshBusyRef.current.has(charId)) return;
    const char = characters.find((x) => x.id === charId);
    if (!char) { showToast("找不到角色"); return; }
    const nowTs = Date.now();
    const autoRetryCooldown = 3 * 60 * 1000;
    const fourHours = 4 * 60 * 60 * 1000;
    if (!force && nowTs - (statusAutoRefreshAttemptRef.current.get(charId) || 0) < autoRetryCooldown) return;
    if (!force && char.statusUpdatedAt && nowTs - char.statusUpdatedAt < fourHours) return;
    const msgs = (chatHistory[charId] || [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12);
    if (!force && msgs.length === 0) return;
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    if (!force) statusAutoRefreshAttemptRef.current.set(charId, nowTs);
    statusRefreshBusyRef.current.add(charId);
    try {
      const roleProfile = [
        char.description ? `角色設定：${sanitizeText(char.description, 400)}` : "",
        char.personality ? `個性：${sanitizeText(char.personality, 200)}` : "",
        char.scenario ? `情境：${sanitizeText(char.scenario, 200)}` : "",
        char.systemPrompt ? `補充規則：${sanitizeText(char.systemPrompt, 240)}` : "",
      ].filter(Boolean).join("\n");
      const mems = (memories[charId] || []).filter((m) => m.pinned).slice(0, 2).map((m) => `- ${m.text}`).join("\n");
      const conv = msgs.map((m) => `${m.role === "user" ? "{{user}}" : char.name}: ${m.content || "[圖片]"}`).join("\n");
      const statusPrompt = isGemmaModel(apiConfig.model)
        ? `${getOutputLanguageDirective()}\n\n請只輸出 1 句手機狀態文字，20~40 字，自然像角色正在發狀態。\n不要輸出角色設定摘要、年齡、職業、人格標籤、草稿、規則文字、Markdown 或解釋。\n\n角色：${char.name}\n${roleProfile ? `角色背景（只供參考，不要複述）：\n${roleProfile}\n\n` : ""}最近對話：\n${conv}\n${mems ? `\n參考記憶：\n${mems}\n` : ""}`
        : `${getOutputLanguageDirective()}\n\n請根據以下資訊，生成一則「符合角色人設」的手機狀態文字。\n規則：僅輸出 1 句，20~40 字，口語自然、對外可見，不要內心獨白、不要動作描述、不要引號包整句。\n\n角色：${char.name}\n${roleProfile ? `角色資料：\n${roleProfile}\n\n` : ""}最近對話：\n${conv}\n${mems ? `\n參考記憶：\n${mems}\n` : ""}`;
      const status = sanitizeText(stripInternalBlocks(await callAI([{ role: "user", content: statusPrompt }], apiConfig, "你是狀態文字助理。")), 80);
      if (!status) { showToast("未取得狀態內容"); return; }
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, statusText: status, statusUpdatedAt: Date.now() } : c));
      showToast("狀態已更新");
    } catch (err) {
      showToast(`${tr("刷新失敗", "Refresh failed", "更新に失敗しました", "새로고침 실패")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 120)}`);
    } finally {
      statusRefreshBusyRef.current.delete(charId);
    }
  };
  const togglePinMemory = (charId, memoryId) => {
    setMemories((prev) => {
      const arr = [...(prev[charId] || [])];
      const pinCount = arr.filter((x) => x.pinned).length;
      const idx = arr.findIndex((x) => x.id === memoryId);
      if (idx < 0) return prev;
      const target = arr[idx];
      if (!target.pinned && pinCount >= 5) {
        showToast(tr("釘選最多 5 條", "You can pin up to 5 items.", "固定できるのは最大5件です。", "최대 5개까지 고정할 수 있습니다."));
        return prev;
      }
      arr[idx] = { ...target, pinned: !target.pinned };
      return { ...prev, [charId]: arr };
    });
  };
  const deleteMemory = (charId, memoryId) => {
    if (!window.confirm(tr("確定要刪除這條記憶嗎？", "Delete this memory?", "このメモリを削除しますか？", "이 기억을 삭제할까요?"))) return;
    setMemories((prev) => ({ ...prev, [charId]: (prev[charId] || []).filter((x) => x.id !== memoryId) }));
    showToast(tr("記憶已刪除", "Memory deleted", "メモリを削除しました", "기억이 삭제되었습니다"));
  };
  const deleteCharacter = (id) => {
    const c = characters.find(x => x.id === id);
    setCharacters(p => p.filter(x => x.id !== id));
    if (activeCharId === id) setActiveCharId(characters.find(x => x.id !== id)?.id || null);
    setChatHistory(h => { const n = { ...h }; delete n[id]; return n; });
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

  const parseJsonObjectFromText = (raw) => {
    const t = String(raw || "").trim();
    try { return JSON.parse(t); } catch {}
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(t.slice(start, end + 1)); } catch {}
    }
    return null;
  };

  const generatePhoneNpcChats = async (char) => {
    if (!char) return;
    if (!window.confirm("刷新其他聊天只會重新生成其他聯絡人的聊天內容，不包含與玩家的聊天，也不會修改玩家暱稱或備註。確定要繼續嗎？")) return;
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    setPhoneGenLoading(true);
    try {
      const playerFormalName = sanitizeText(playerProfile?.name || "玩家", 40);
      const playerNickname = sanitizeText(playerProfile?.nickname || "", 40);
      const recent = (chatHistory[char.id] || []).slice(-10).map((m) => `${m.role === "user" ? playerFormalName : char.name}: ${m.content || "[圖片]"}`).join("\n");
      const roleProfile = [char.description, char.personality, char.scenario].filter(Boolean).join("\n");
      const prompt = [{
        role: "user",
        content: `請幫我生成 ${char.name} 的手機「其他聊天」資料（不含玩家），輸出 JSON 且只能輸出 JSON。
格式：
{
  "threads":[
    {
      "name":"聯絡人名稱",
      "relation":"與角色關係（簡短）",
      "messages":[
        {"from":"other","text":"..."},
        {"from":"char","text":"..."}
      ]
    }
  ]
}
規則：
1) 只產生 3~5 個 threads。
2) 每個 thread 產生 4~8 則短訊息，語氣像通訊軟體。
3) from 只能是 "char" 或 "other"。
4) 不要時間戳、不要 markdown、不要多餘欄位。
5) 玩家正式名稱是「${playerFormalName}」${playerNickname ? `，暱稱是「${playerNickname}」` : "，未設定暱稱"}。暱稱屬於較私密的稱呼，其他 NPC 預設不要使用；只有能從設定合理判斷該 NPC 與玩家很親近、而且知道這個暱稱時，才可以偶爾使用。一般情況請使用正式名稱、代稱或自然省略稱呼。
6) 不要讓所有 NPC 都認識玩家，也不要讓所有 NPC 都用相同方式稱呼玩家；依每個 NPC 與角色、玩家的關係自然判斷。

角色設定：
${roleProfile || "（無）"}

最近和 {{user}} 對話（供語氣參考）：
${recent || "（尚無）"}
`,
      }];
      const raw = await callAI(prompt, apiConfig, "你是手機聊天資料生成器，只能輸出有效 JSON。");
      const parsed = parseJsonObjectFromText(raw);
      const threadsRaw = Array.isArray(parsed?.threads) ? parsed.threads : [];
      const generatedAt = Date.now();
      const threads = threadsRaw.slice(0, 5).map((t, idx) => {
        const msgs = Array.isArray(t?.messages) ? t.messages : [];
        const lastMessageOffsetMinutes = 3 + idx * 19 + Math.floor(Math.random() * 12);
        const lastMessageTime = generatedAt - lastMessageOffsetMinutes * 60000;
        const messageGapMinutes = 2 + (idx % 4);
        return {
          id: `npc-${idx}-${gid()}`,
          name: sanitizeText(t?.name || `聯絡人${idx + 1}`, 24),
          relation: sanitizeText(t?.relation || "", 40),
          messages: msgs.slice(0, 8).map((m, mi) => ({
            id: `m-${idx}-${mi}-${gid()}`,
            from: m?.from === "char" ? "char" : "other",
            text: sanitizeText(m?.text || "", 120),
            time: lastMessageTime - Math.max(0, msgs.length - 1 - mi) * messageGapMinutes * 60000,
          })).filter((m) => !!m.text),
        };
      }).filter((t) => t.messages.length > 0);
      if (!threads.length) throw new Error("模型未回傳可用的聊天資料");
      setPhoneInboxCache((prev) => ({
        ...prev,
        [char.id]: { ...(prev[char.id] || {}), updatedAt: Date.now(), threads },
      }));
      showToast(`已更新其他聊天（${threads.length} 人）`);
    } catch (err) {
      showToast(`${tr("生成失敗", "Generation failed", "生成に失敗しました", "생성 실패")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 120)}`);
    }
    setPhoneGenLoading(false);
  };

  const refreshPhonePlayerContact = async (char) => {
    if (!char) return;
    if (!window.confirm("確定刷新玩家聊天室？\n\n只會更新玩家名稱、括號稱呼與關係備註；與玩家的對話內容、其他聯絡人聊天都不會改變。")) return;
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    setPhonePlayerContactLoading(true);
    try {
      const currentPlayerContact = phoneInboxCache[char.id]?.playerContact || {};
      const recentPlayerChat = (chatHistory[char.id] || []).slice(-6)
        .map((message) => `${message.role === "user" ? "玩家" : char.name}：${sanitizeText(message.content || "[圖片]", 300)}`)
        .join("\n");
      const prompt = [{
        role: "user",
        content: `${getOutputLanguageDirective()}

請從 ${char.name} 的視角，生成玩家在角色手機通訊錄中的資料，只能輸出 JSON：
{"suffix":"放在玩家名稱括號內的關係稱呼，可空白","note":"角色替玩家設定的短備註名"}

規則：
1) suffix 放在玩家名稱後方括號內，通常留空；只有角色個性或關係非常適合時才填寫，最多 8 字。
2) suffix 以雙方關係為主，例如「老婆」「男友」「室友」「青梅竹馬」，最多 8 字；不要填 thought、note、玩家等系統詞。
3) note 是 ${char.name} 替玩家設定的短備註名，例如「我家那位」「最重要的人」「總忘記帶傘」，2~16 字，不要寫成完整句子，但詞語與語意必須完整，禁止輸出「值得信任的後」這類未完成片段。
4) suffix 與 note 都必須使用目前介面語言，不要中英混搭，不要輸出 thought、note、memo、remark、角色設定等標籤。
5) 如果「與玩家關係」未設定，請從角色描述、System prompt、性格、情境與近期互動推斷最自然的稱呼與備註。
6) 目前備註是「${sanitizeText(currentPlayerContact.note || "尚無", 16)}」。這次刷新請生成不同的新備註，不要原樣重複。

角色設定：${sanitizeText([char.description, char.systemPrompt, char.personality, char.scenario].filter(Boolean).join("\n") || "未設定", 3200)}
與玩家關係：${sanitizeText(char.relationshipToUser || "未設定", 120)}
玩家名稱：${sanitizeText(playerProfile?.name || "玩家", 40)}
玩家暱稱：${sanitizeText(playerProfile?.nickname || "未設定", 40)}
近期互動：\n${recentPlayerChat || "尚無對話"}`,
      }];
      const raw = await callAI(prompt, { ...apiConfig, maxTokens: 300 }, "你是角色手機聯絡人資料生成器，只能輸出有效 JSON。");
      const parsed = parseJsonObjectFromText(raw) || {};
      const parsedContact = parsed.playerContact && typeof parsed.playerContact === "object"
        ? parsed.playerContact
        : parsed.contact && typeof parsed.contact === "object"
          ? parsed.contact
          : parsed;
      let nextNote = sanitizeText(
        parsedContact.note || parsedContact.remark || parsedContact.memo || parsedContact.contactNote || parsedContact["備註"] || "",
        16,
      ).replace(/^\s*(?:thought|note|memo|remark|備註)\s*[:：-]?\s*/i, "").trim();
      if (!nextNote) {
        const noteMatch = String(raw || "").match(/["']?(?:note|remark|memo|contactNote|備註)["']?\s*[:：]\s*["']([^"'\n}]{1,40})/i);
        nextNote = sanitizeText(noteMatch?.[1] || "", 16).replace(/^\s*(?:thought|note|memo|remark|備註)\s*[:：-]?\s*/i, "").trim();
      }
      const isIncompleteContactNote = (value) => /(?:的後|的前|的這|的那|[的與和或但而把被在向從為])$/.test(String(value || "").trim());
      if (!nextNote || /[a-z]{3,}/i.test(nextNote) || isIncompleteContactNote(nextNote)) {
        const retryRaw = await callAI([{
          role: "user",
          content: `${getOutputLanguageDirective()}\n請以 ${char.name} 的視角，只輸出一則 2~16 字、詞語完整的玩家聯絡人短備註名，例如「我家那位」或「最重要的人」。不要輸出未完成片段，不要 JSON、英文、標籤、引號或說明。玩家關係：${sanitizeText(char.relationshipToUser || "未設定", 120)}`,
        }], { ...apiConfig, maxTokens: 100 }, "你只輸出聯絡人備註文字。");
        nextNote = sanitizeText(String(retryRaw || "").replace(/^[「『"']+|[」』"']+$/g, "").trim(), 16)
          .replace(/^\s*(?:thought|note|memo|remark|備註)\s*[:：-]?\s*/i, "").trim();
      }
      if (!nextNote || isIncompleteContactNote(nextNote)) throw new Error("模型沒有產生完整的玩家聯絡人備註");
      const generatedSuffix = sanitizeText(parsedContact.suffix || "", 8)
        .replace(/^\s*(?:thought|note|memo|remark|稱呼)\s*[:：-]?\s*/i, "").trim();
      const playerContact = {
        suffix: Math.random() < 0.5 && !/[a-z]{3,}/i.test(generatedSuffix) ? generatedSuffix : "",
        note: nextNote,
      };
      setPhoneInboxCache((prev) => ({
        ...prev,
        [char.id]: { ...(prev[char.id] || {}), playerContact, playerContactUpdatedAt: Date.now() },
      }));
      showToast("玩家暱稱與備註已刷新");
    } catch (err) {
      showToast(`${tr("生成失敗", "Generation failed", "生成に失敗しました", "생성 실패")}：${sanitizeText(err?.message || "", 120)}`);
    } finally {
      setPhonePlayerContactLoading(false);
    }
  };

  // 商店 → 錢包同步：先清舊 shop 流水（餘額加回），再寫新流水（餘額扣掉）。刷新不會重複扣款。
  const syncShopOrdersToWallet = (charId, orders) => {
    setCharacterWallets((prev) => {
      const w = prev[charId];
      if (!w) return prev; // 錢包尚未生成就不寫，等錢包生成後玩家再刷新商店即可
      const oldTx = Array.isArray(w.transactions) ? w.transactions : [];
      const oldShopTotal = oldTx.filter((t) => t.source === "shop").reduce((s, t) => s + (+t.amount || 0), 0);
      const kept = oldTx.filter((t) => t.source !== "shop");
      const newTx = orders.map((o, i) => ({
        id: gid(), type: "expense", source: "shop",
        amount: o.price, note: `${o.emoji} ${o.item}`,
        time: Date.now() - i * 3600000,
      }));
      const newTotal = newTx.reduce((s, t) => s + t.amount, 0);
      return { ...prev, [charId]: {
        ...w,
        balance: Math.max(0, (+w.balance || 0) + oldShopTotal - newTotal),
        transactions: [...newTx, ...kept],
      } };
    });
  };

  const generatePhoneApp = async (char, appId) => {
    if (!char || !PHONE_APP_META[appId]) return;
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup first", "先にAI接続設定を完了してください", "먼저 AI 연결 설정을 완료해주세요")); return; }
    setPhoneAppGenLoading(appId);
    try {
      const theme = sanitizePhoneTheme(phoneAppCache[char.id]?.theme?.data);
      const extra = appId === "shop"
        ? { balance: characterWallets[char.id]?.balance }
        : appId === "diary"
          ? { prevTitles: (phoneAppCache[char.id]?.diary?.data?.entries || []).map((e) => e.title) }
          : { mode: theme.mode };
      const ctx = buildPhonePromptContext(char, chatHistory);
      const prompt = [{ role: "user", content: buildPhoneAppPrompt(appId, getOutputLanguageDirective(), ctx, extra) }];
      const raw = await callAI(prompt, apiConfig, "你是手機 App 資料生成器，只能輸出有效 JSON。");
      const data = sanitizePhoneAppData(appId, parseJsonObjectFromText(raw), phoneAppCache[char.id]?.[appId]?.data);
      if (!data) throw new Error(tr("模型未回傳可用資料", "Model returned no usable data", "モデルが有効なデータを返しませんでした", "모델이 사용 가능한 데이터를 반환하지 않았습니다"));
      setPhoneAppCache((prev) => ({
        ...prev,
        [char.id]: { ...(prev[char.id] || {}), [appId]: { updatedAt: Date.now(), data } },
      }));
      if (appId === "shop") syncShopOrdersToWallet(char.id, data.orders);
      if (appId === "diary") setDiaryPage(0);
      showToast(`已更新${PHONE_APP_META[appId].name}`);
    } catch (err) {
      showToast(`${tr("生成失敗", "Generation failed", "生成に失敗しました", "생성 실패")}：${sanitizeText(err?.message || "", 120)}`);
    }
    setPhoneAppGenLoading(null);
  };

  const generateMemory = async (char) => {
    const msgs = chatHistory[char.id] || [];
    if (msgs.length < 4) { showToast("對話太少，先多聊幾句再生成記憶"); return; }
    const existing = memories[char.id] || [];
    if (existing.length >= 30) { showToast("記憶已滿 30 條，請先刪除後再生成"); return; }
    const isOllamaLocal = apiConfig.provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(apiConfig.baseUrl || "");
    const providerNeedsApiKey = !(apiConfig.provider === "ollama" && isOllamaLocal);
    if (providerNeedsApiKey && !apiConfig.apiKey) { showToast("請先設定 API Key"); return; }
    setGenLoading(true);
    try {
      const recent = msgs
        .slice(-30)
        .map((m) => `${m.role === "user" ? "{{user}}" : char.name}: ${m.content || "[圖片]"}`)
        .join("\n");
      const roleProfile = [
        char.description ? `角色描述：${sanitizeText(char.description, 320)}` : "",
        char.personality ? `角色個性：${sanitizeText(char.personality, 220)}` : "",
        char.scenario ? `角色情境：${sanitizeText(char.scenario, 220)}` : "",
        char.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
      ].filter(Boolean).join("\n");
      const existingMemoriesContext = buildMemoryDigest(existing);
      const prompt = [{
        role: "user",
        content: `${getOutputLanguageDirective()}

你要為角色「${char.name}」整理長期記憶，務必嚴格遵守角色人設。
規則：
1) 只能輸出 1 則記憶，20~80 字。
2) 記憶必須具體、可持續（偏好/事實/關係/約定），避免空話。
3) 不得臆測或改寫角色的性別、身分、關係設定；若對話未提及就不要補。
4) 不要使用「她/他」等可能造成性別偏移的主詞，優先用角色名「${char.name}」。
5) 既有記憶摘要會列在下方，請避免重複、近似或只換句話說；若真的沒有新資訊，就不要硬生出同義句。
6) 只輸出記憶文字本身，不要解釋。

角色設定：
${roleProfile || "（無）"}

既有記憶（請避免重複）：
${existingMemoriesContext || "（無）"}

最近對話：
${recent}`,
      }];
      const text = await callAI(prompt, apiConfig, "你是角色記憶整理助手。");
      const safeText = sanitizeText(text, 120);
      if (!safeText || safeText.length < 8) throw new Error(tr("模型未產生有效記憶", "The model did not generate a valid memory", "モデルが有効なメモリを生成しませんでした", "모델이 유효한 기억을 생성하지 않았습니다"));
      const duplicated = existing.some((mem) => memorySimilarity(mem.text, safeText) >= 0.78);
      if (duplicated) {
        showToast("記憶過於相似，已略過新增");
      } else {
        setMemories(m => ({ ...m, [char.id]: [...(m[char.id] || []), { id: gid(), text: safeText, date: Date.now(), pinned: false }] }));
        showToast("記憶生成成功");
      }
    } catch (err) {
      showToast(`記憶生成失敗：${err.message}`);
    }
    setGenLoading(false);
  };

  const generatePost = async (char) => {
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    try {
      const sysP = `${buildSystemPrompt(char, getPlayerContextBlock())}

[目前輸出模式：社群貼文]
以下社群貼文規則優先於上方「聊天規則」中關於即時通訊、只輸出私訊內容的限制。
你正在替 {{char}} 產生一則公開/半公開社群動態。貼文要像角色自己發的近況，不是對 {{user}} 的私訊。`;
      const t = await callAI([{
        role: "user",
        content: buildSocialPostPrompt(char),
      }], apiConfig, sysP);
        const content = sanitizeText(String(t || "").replace(/^["「]|["」]$/g, "").trim(), 120) || "今天也算是有好好過完了。";
        setPosts(p => [{
          id: gid(),
          authorType: "character",
          authorName: char.name,
          authorAvatar: char.avatar,
          charId: char.id,
          charName: char.name,
          charAvatar: char.avatar,
          content,
          comments: [],
          time: Date.now(),
          likes: rollCharacterPostLikes(char),
          liked: false,
        }, ...p]);
        showToast(tr(`${char.name} 已發佈貼文`, `${char.name} published a post`, `${char.name} が投稿しました`, `${char.name}님이 게시물을 올렸습니다`));
      } catch (err) {
        showToast(`${tr("發文失敗", "Failed to post", "投稿に失敗しました", "게시 실패")}：${err.message}`);
      }
    };
  const handleRandomSocialPost = () => {
    const nowTs = Date.now();
    const globalLeft = SOCIAL_GLOBAL_COOLDOWN_MS - (nowTs - (socialLastGlobalPostAtRef.current || 0));
    if (globalLeft > 0) {
      showToast(tr(`刷新太快，請 ${Math.ceil(globalLeft / 1000)} 秒後再試`, `Too fast, try again in ${Math.ceil(globalLeft / 1000)}s`, `更新が早すぎます。${Math.ceil(globalLeft / 1000)}秒後にもう一度お試しください`, `너무 빨라요. ${Math.ceil(globalLeft / 1000)}초 후 다시 시도해주세요`));
      return;
    }
    const c = pickRandomSocialCharacter();
    if (!c) return;
    const lastForChar = socialLastPostByCharRef.current?.[c.id] || 0;
    const charLeft = SOCIAL_CHAR_COOLDOWN_MS - (nowTs - lastForChar);
    if (charLeft > 0) {
      showToast(tr(`${c.name} 剛發過文，請 ${Math.ceil(charLeft / 1000)} 秒後再試`, `${c.name} just posted, try again in ${Math.ceil(charLeft / 1000)}s`, `${c.name} は投稿したばかりです。${Math.ceil(charLeft / 1000)}秒後にお試しください`, `${c.name}님이 방금 게시했어요. ${Math.ceil(charLeft / 1000)}초 후 다시 시도해주세요`));
      return;
    }
    socialLastGlobalPostAtRef.current = nowTs;
    socialLastPostByCharRef.current = { ...(socialLastPostByCharRef.current || {}), [c.id]: nowTs };
    generatePost(c);
  };
  const pickRandomSocialCharacter = () => {
    if (!Array.isArray(characters) || characters.length === 0) return null;
    if (characters.length === 1) return characters[0];
    const lastCharId = posts?.[0]?.charId || null;
    const pool = characters.filter((c) => c.id !== lastCharId);
    const list = pool.length ? pool : characters;
    return list[Math.floor(Math.random() * list.length)] || null;
  };
  const generatePlayerPostReplies = async (post, responders) => {
    if (!post?.id || !responders.length || !canUseCurrentProvider()) return;
    for (const char of responders) {
      try {
        const sysP = `${buildSystemPrompt(char, getPlayerContextBlock())}

[目前輸出模式：社群留言]
以下規則優先於上方聊天規則。你正在替 {{char}} 在公開/半公開社群貼文下方留言，內容要像社群互動，不是私訊。`;
        const ai = await callAI([{
          role: "user",
          content: buildPlayerPostReplyPrompt(char, post),
        }], apiConfig, sysP);
        const reply = sanitizeText(String(ai || "").replace(/^["「]|["」]$/g, "").trim(), 120);
        if (!reply) continue;
        const charComment = {
          id: gid(),
          role: "assistant",
          charId: char.id,
          charName: char.name,
          charAvatar: char.avatar,
          content: reply,
          depth: 1,
          time: Date.now(),
        };
        setPosts((prev) => prev.map((p) => (
          p.id === post.id ? { ...p, comments: [...(p.comments || []), charComment] } : p
        )));
      } catch (_) {}
    }
  };
  const submitPlayerPost = async () => {
    if (playerPostSubmitting) return;
    const content = sanitizeText(playerPostText.trim(), PLAYER_SOCIAL_POST_LIMIT);
    if (!content) { showToast(tr("請輸入貼文內容", "Please enter post content", "投稿内容を入力してください", "게시물 내용을 입력해주세요")); return; }
    const post = {
      id: gid(),
      authorType: "player",
      authorName: getPlayerDisplayName(),
      authorAvatar: getPlayerAvatar(),
      charId: null,
      charName: getPlayerDisplayName(),
      charAvatar: getPlayerAvatar(),
      content,
      comments: [],
      time: Date.now(),
      likes: 0,
      liked: false,
      likedBy: pickPlayerPostReactors(content),
    };
    const responders = pickPlayerPostResponders(content);
    setPosts((prev) => [post, ...prev]);
    setPlayerPostText("");
    setPlayerPostModalOpen(false);
    if (!responders.length) return;
    if (!canUseCurrentProvider()) {
        showToast(tr("貼文已發佈；角色回覆需先完成 AI 連線設定", "Post published; AI connection is required for replies", "投稿しました。キャラの返信には先にAI接続設定が必要です。", "게시물이 등록되었습니다. 캐릭터 답글에는 먼저 AI 연결 설정이 필요합니다."));
      return;
    }
    setPlayerPostSubmitting(true);
    showToast(tr(`貼文已發佈，等待 ${responders.length} 則角色回覆`, `Post published, waiting for ${responders.length} replies`, `投稿しました。${responders.length}件のキャラ返信を待っています`, `게시물이 등록되었습니다. 캐릭터 답글 ${responders.length}개를 기다리는 중입니다`));
    await generatePlayerPostReplies(post, responders);
    setPlayerPostSubmitting(false);
  };
  const addPostComment = async (postId, explicitTarget = null) => {
    const target = explicitTarget || null;
    const inputKey = target ? `${postId}:${target.commentId}` : postId;
    const raw = postCommentInputs[inputKey] || "";
    const text = sanitizeText(raw, 240).trim();
    if (!text) return;
    const post = posts.find((x) => x.id === postId);
    if (!post) return;
    setPostCommentInputs((prev) => ({ ...prev, [inputKey]: "" }));
    const parentDepth = getCommentDepth(target);
    const userComment = {
      id: gid(),
      role: "user",
      content: text,
      parentId: target?.commentId || null,
      replyToName: target?.authorName || "",
      depth: target ? Math.min(3, parentDepth + 1) : 1,
      time: Date.now(),
    };
    setPosts((prev) => prev.map((p) => (
      p.id === postId
        ? { ...p, comments: insertCommentAfterThread(p.comments || [], target?.commentId || null, userComment) }
        : p
    )));
    if (target) setSocialReplyTarget(null);
    const char = target?.charId
      ? characters.find((c) => c.id === target.charId)
      : characters.find((c) => c.id === post.charId);
    if (!canUseCurrentProvider()) return;
    if (!char || userComment.depth >= 3) return;
    try {
      const sysP = buildSystemPrompt(char, getPlayerContextBlock());
      const ai = await callAI([{
        role: "user",
        content: target
          ? buildSocialCommentReplyPrompt({ char, post, targetComment: target, userText: text })
          : `你剛發了一則貼文：「${post.content}」\n{{user}} 留言：「${text}」\n請用角色口吻回覆 1 句自然留言，最多 45 字。`,
      }], apiConfig, sysP);
      const reply = sanitizeText(ai || "", 120).trim() || "收到，謝謝你的留言。";
      const charComment = {
        id: gid(),
        role: "assistant",
        charId: char.id,
        charName: char.name,
        charAvatar: char.avatar,
        content: reply,
        parentId: userComment.id,
        replyToName: getPlayerDisplayName(),
        depth: Math.min(3, userComment.depth + 1),
        time: Date.now(),
      };
      setPosts((prev) => prev.map((p) => (
        p.id === postId
          ? { ...p, comments: insertCommentAfterThread(p.comments || [], userComment.id, charComment) }
          : p
      )));
    } catch (_) {}
  };
  const sharePostToChat = (post) => {
    if (getPostAuthorType(post) !== "character" || !post.charId) {
      showToast(tr("玩家貼文目前不分享到角色聊天室", "Player posts can't be shared to character chats yet", "プレイヤーの投稿は今のところキャラのチャットに共有できません", "플레이어 게시물은 아직 캐릭터 채팅에 공유할 수 없습니다"));
      return;
    }
    if (!window.confirm("要分享到此角色聊天室嗎？")) return;
    const char = characters.find((c) => c.id === post.charId);
    if (!char) return;
    const lines = (post.comments || []).slice(-4).map((c) => `${c.role === "assistant" ? (c.charName || post.charName) : "{{user}}"}：${c.content}`);
    const rawBody = [`貼文：${post.content}`, ...(lines.length ? ["留言：", ...lines] : [])].join("\n");
    const approxTokens = Math.ceil(rawBody.length / 3.5);
    const content = approxTokens <= SHARE_RAW_TOKEN_LIMIT
      ? [
          `[APP_SHARE_EVENT]`,
          `source=social`,
          `mode=raw`,
          `actor=${post.charName}`,
          `token_estimate=${approxTokens}`,
          rawBody,
        ].join("\n")
      : [
          `[APP_SHARE_EVENT]`,
          `source=social`,
          `mode=summary`,
          `actor=${post.charName}`,
          `token_estimate=${approxTokens}`,
          `摘要：${sanitizeText(post.content, 220)}`,
          ...(lines.length ? [`互動重點：${sanitizeText(lines.join(" / "), 260)}`] : []),
        ].join("\n");
    const notice = { id: gid(), role: "system_notice", content, time: Date.now() };
    setChatHistory((h) => ({ ...h, [post.charId]: [...(h[post.charId] || []), notice] }));
    showToast(approxTokens <= SHARE_RAW_TOKEN_LIMIT ? "已分享到聊天室（原文）" : "已分享到聊天室（摘要）");
  };
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
  }, [hydrated, characters, chatHistory, proactiveSettings, proactiveUnread, apiConfig]);

  const SOCIAL_AUTO_POST_GAP_RANGE_MS = [40 * 60 * 1000, 90 * 60 * 1000];
  const rollSocialAutoPostGap = () => {
    const [minMs, maxMs] = SOCIAL_AUTO_POST_GAP_RANGE_MS;
    return minMs + Math.random() * (maxMs - minMs);
  };
  const runSocialAutoPostSweep = () => {
    if (!hydrated || !socialSettings?.autoPost || socialAutoPostingRef.current || !canUseCurrentProvider()) return;
    if (!Array.isArray(characters) || !characters.length) return;
    if (!socialAutoPostGapRef.current) socialAutoPostGapRef.current = rollSocialAutoPostGap();
    const lastCharPost = (posts || []).find((p) => getPostAuthorType(p) === "character");
    const lastAt = Math.max(lastCharPost?.time || 0, socialLastGlobalPostAtRef.current || 0);
    if (Date.now() - lastAt < socialAutoPostGapRef.current) return;
    const c = pickRandomSocialCharacter();
    if (!c) return;
    socialAutoPostingRef.current = true;
    socialLastGlobalPostAtRef.current = Date.now();
    socialLastPostByCharRef.current = { ...(socialLastPostByCharRef.current || {}), [c.id]: Date.now() };
    socialAutoPostGapRef.current = rollSocialAutoPostGap();
    generatePost(c).finally(() => { socialAutoPostingRef.current = false; });
  };
  useEffect(() => {
    if (!hydrated || !socialSettings?.autoPost) return;
    const onVisible = () => { if (document.visibilityState === "visible") runSocialAutoPostSweep(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const kick = setTimeout(runSocialAutoPostSweep, 6000);
    const iv = setInterval(runSocialAutoPostSweep, 10 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearTimeout(kick);
      clearInterval(iv);
    };
  }, [hydrated, socialSettings, characters, posts, apiConfig]);

  const normalizedThemeName = themeName === "湖水藍" ? "海鹽汽水" : themeName === "蜜桃手帳" ? "蜜桃慕斯" : themeName;
  const activeTheme = THEME_PRESETS[normalizedThemeName] || THEME_PRESETS["莓果蘇打"];
  const isNightTheme = themeName === "夜色絨幕";
  const hasPeachEffects = normalizedThemeName === "蜜桃慕斯";
  const isPeachTheme = true;
  const showThemeEffects = !currentApp;
  const activeFontStack = (FONT_PRESETS[fontName] || FONT_PRESETS["圓體"]).stack;
  const themeCss = `
    :root{
      ${Object.entries(activeTheme?.vars || {}).map(([k, v]) => `${k}:${v};`).join("")}
      --mp-font:${activeFontStack};
    }
    .mp-wrap{background:${activeTheme?.surfaces?.wrapBg || "linear-gradient(135deg,#fce4ec 0%,#e8eaf6 50%,#e1f5fe 100%)"};}
    .mp-phone{background:${activeTheme?.surfaces?.phoneBg || "linear-gradient(160deg,#fce4ec 0%,#f8bbd0 25%,#e1f5fe 50%,#b3e5fc 75%,#f3e5f5 100%)"};}
    .mp-lock{background:${activeTheme?.surfaces?.lockBg || "linear-gradient(160deg,#fce4ec 0%,#f8bbd0 30%,#e8eaf6 60%,#b3e5fc 100%)"};}
    .mp-lock-hint{max-width:min(82vw,320px);padding:0 12px;text-align:center;line-height:1.4;word-break:keep-all;overflow-wrap:anywhere;font-size:12px;}
    .mp-page{background:${activeTheme?.surfaces?.pageBg || "linear-gradient(180deg,#fce4ec 0%,#fff 30%)"};}
    ${isNightTheme ? `
      .mp-page{background:${activeTheme.surfaces.pageBg};}
      .mp-cr{background:linear-gradient(180deg,rgba(36,27,51,.97),rgba(26,22,37,.99));}
      .mp-bar,.mp-hdr,.mp-inp-bar,.mp-dock{background:rgba(26,22,37,.95);border-color:#3a2d4f;}
      .mp-modal,.mp-sg,.mp-cc,.mp-post,.mp-sc,.mp-cw,.mp-transfer-card{background:rgba(36,27,51,.95);border-color:#3a2d4f;box-shadow:0 8px 24px rgba(7,4,12,.26);}
      .mp-icon-c,.mp-dock-i,.mp-back{background:rgba(47,36,64,.9);border-color:#3a2d4f;box-shadow:0 3px 12px rgba(7,4,12,.24);}
      .mp-icon-c:hover,.mp-dock-i:hover,.mp-cw:hover{background:rgba(58,45,79,.96);box-shadow:0 5px 16px rgba(7,4,12,.3);}
      .mp-chat-switch,.mp-mode-tabs{background:rgba(47,36,64,.72);border-color:#3a2d4f;box-shadow:none;}
      .mp-chat-switch-btn{color:#b8a8c9;}
      .mp-chat-switch-btn.active{color:#f0e6f5;background:rgba(244,143,177,.18);box-shadow:0 2px 8px rgba(7,4,12,.2);}
      .mp-chat-row,.mp-ci{border-color:rgba(122,107,138,.24);}
      .mp-chat-row:hover,.mp-chat-row.pinned:hover,.mp-ci:hover{background:rgba(255,255,255,.055);}
      .mp-chat-row:active{background:rgba(244,143,177,.1);}
      .mp-msg-ai{background:#2f2440;color:#f0e6f5;border-color:#3a2d4f;box-shadow:0 2px 8px rgba(7,4,12,.2);}
      .mp-msg-user{background:linear-gradient(135deg,#ec6a95,#d95e88);color:#fff;box-shadow:0 2px 8px rgba(7,4,12,.22);}
      .mp-post-menu{background:rgba(36,27,51,.98);border-color:#3a2d4f;box-shadow:0 8px 24px rgba(7,4,12,.4);}
      .mp-msg-ai .mp-msg-t{color:#9384a2;}
      .mp-msg-user .mp-msg-t{color:rgba(255,255,255,.72);}
      .mp-reality-msg{background:transparent;border-color:transparent;box-shadow:none;color:#c9b8da;}
      .mp-reality-user .mp-reality-msg{background:linear-gradient(135deg,#465d79,#394b66);color:#f4f8fc;box-shadow:inset 0 0 0 1px rgba(165,201,232,.22),0 2px 10px rgba(7,4,12,.22);}
      .mp-reality-ai .mp-reality-msg{background:transparent;color:#b5a3c4;box-shadow:none;}
      .mp-reality-dialogue{color:#fff7fc;font-weight:400;}
      .mp-reality-thought{color:#d9a6e8;font-style:italic;font-weight:600;}
      .mp-reality-strong{color:#ff91b8;font-weight:800;}
      .mp-mode-sep{color:#a5c9e8;}
      .mp-mode-sep::before{background:linear-gradient(90deg,rgba(165,201,232,0),rgba(165,201,232,.42));}
      .mp-mode-sep::after{background:linear-gradient(90deg,rgba(165,201,232,.42),rgba(165,201,232,0));}
      .mp-mode-sep span{background:#26384d;border-color:rgba(165,201,232,.34);color:#c5def2;}
      .mp-chat-mode-reality .mp-inp-bar{background:rgba(30,24,43,.97);border-top-color:rgba(165,201,232,.28);box-shadow:0 -6px 18px rgba(7,4,12,.22);}
      .mp-chat-mode-reality .mp-inp{background:#292039;border-color:rgba(165,201,232,.24);}
      .mp-chat-mode-reality .mp-btn-send{background:linear-gradient(135deg,#a5c9e8,#7ba8d1);color:#1a1625;}
      .mp-thought-content{background:rgba(47,36,64,.72);border-color:rgba(200,168,224,.5);}
      .mp-inp,.mp-sinp,.mp-ssel,.mp-ta{background:#2f2440;color:#f0e6f5;border-color:#3a2d4f;}
      .mp-ssel option{background:#241b33;color:#f0e6f5;}
      .mp-inp:focus,.mp-sinp:focus,.mp-ta:focus{border-color:#7ba8d1;}
      .mp-inp::placeholder,.mp-sinp::placeholder,.mp-ta::placeholder{color:#9384a2;}
      .mp-cw-desc,.mp-ci-prev,.mp-lbl,.mp-mode-hint{color:#b8a8c9;}
      .mp-msg-t,.mp-reality-t,.mp-char-counter{color:#81728f;}
      .mp-htitle,.mp-clock-big,.mp-clock-day,.mp-lock-time,.mp-cw-name,.mp-ctitle,.mp-sec-ct,.mp-persona,.mp-icon-l{color:#f0e6f5;}
      .mp-lock-notif{background:rgba(47,36,64,.72);border-color:rgba(165,201,232,.24);}
      .mp-lock-notif-name{color:#f0e6f5;}
      .mp-ibtn,.mp-ibtn-chat{background:rgba(165,201,232,.1);border-color:rgba(165,201,232,.3);color:#a5c9e8;}
      .mp-ibtn-view{background:rgba(130,177,255,.12);border-color:rgba(130,177,255,.34);color:#a9c8ff;}
      .mp-ibtn-r{background:rgba(229,115,115,.1);border-color:rgba(229,115,115,.28);color:#ef9696;}
      .mp-badge-enabled{background:rgba(129,199,132,.16);color:#9bd29e;}
      .mp-badge-disabled{background:rgba(122,107,138,.18);color:#b8a8c9;}
      .mp-lorebook-content{background:#2f2440;border-color:#3a2d4f;color:#f0e6f5;}
      .mp-btn-img{background:rgba(47,36,64,.9);color:#f0e6f5;border-color:#3a2d4f;}
      .mp-btn-img.active{background:rgba(165,201,232,.14);color:#a5c9e8;border-color:rgba(165,201,232,.32);}
      .mp-save{background:linear-gradient(135deg,#f48fb1,#ec6a95);color:#1a1625;}
      .mp-mode-tab{color:#b8a8c9;}
      .mp-mode-tab.active{background:#3a2d4f;color:#f0e6f5;box-shadow:0 2px 8px rgba(7,4,12,.24);}
      .mp-msg-note{background:rgba(47,36,64,.72);border-color:#3a2d4f;color:#b8a8c9;}
      .mp-msg-editbtn{background:#2f2440;border-color:rgba(165,201,232,.34);color:#a5c9e8;box-shadow:0 2px 7px rgba(7,4,12,.32);}
      .mp-msg-editbtn:hover{background:#3a2d4f;border-color:rgba(165,201,232,.52);color:#c5def2;}
      .mp-msg-editbtn + .mp-msg-editbtn{border-color:rgba(229,115,115,.34);color:#e98a8a;}
      .mp-msg-editbtn + .mp-msg-editbtn:hover{border-color:rgba(229,115,115,.52);color:#ffaaaa;}
      .mp-page-dot{background:rgba(255,255,255,.2);}
      .mp-page-dot.active{background:#f48fb1;}
      .mp-scroll-bottom{color:#f0e6f5;filter:drop-shadow(0 1px 3px rgba(7,4,12,.78));}
    ` : ``}
    ${isPeachTheme ? `
      .mp-chat-row,.mp-ci{border-bottom-color:var(--mp-line);}
      .mp-thought-history-divider{background:var(--mp-line);}
      .mp-thought-history,.mp-thought-record{border-color:var(--mp-line);}
      .mp-thought-history-pages button,.mp-transfer-row,.mp-transfer-note{border-color:var(--mp-line);}
      .mp-msg{border-radius:18px;}
      .mp-msg-ai{background:var(--mp-surface);border:none;border-radius:18px 18px 18px 6px;box-shadow:0 4px 12px color-mix(in srgb,var(--mp-pink) 12%,transparent);}
      .mp-msg-user{border-radius:18px 18px 6px 18px;}
      .mp-chat-row-badge{background:linear-gradient(135deg,var(--mp-bubble),var(--mp-bubble-2));box-shadow:0 2px 6px color-mix(in srgb,var(--mp-bubble-2) 40%,transparent);}
      .mp-chat-row-time,.mp-msg-t,.mp-reality-t,.mp-post-tm{font-family:var(--mp-hand);font-size:10px;}
      .mp-cr::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(color-mix(in srgb,var(--mp-pink-dk) 8%,transparent) 1px,transparent 1px),radial-gradient(circle at 15% 10%,color-mix(in srgb,var(--mp-pink-lt) 45%,transparent),transparent 38%);background-size:9px 9px,100% 100%;}
      .mp-msgs{position:relative;z-index:1;}
      .mp-phone::before,.mp-phone::after{position:absolute;top:-26px;z-index:95;pointer-events:none;font-size:12px;opacity:0;animation:mpPetal 12s linear infinite;}
      .mp-phone::before{content:'🌸';left:12%;text-shadow:98px 76px 0 rgba(244,169,176,.8);}
      .mp-phone::after{content:'🌸';left:64%;text-shadow:74px 128px 0 rgba(224,122,139,.72);animation-delay:3s;animation-duration:14s;}
      .mp-desk-scroll>.mp-cw{position:relative;height:155px;margin:6px 0 12px;padding:0;display:block;overflow:hidden;border:0;border-radius:20px;background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--mp-surface) 78%,transparent) 0 12px,color-mix(in srgb,var(--mp-pink) 12%,transparent) 12px 24px);box-shadow:0 8px 24px color-mix(in srgb,var(--mp-pink-dk) 10%,transparent);touch-action:pan-x pan-y;}
      .mp-desk-scroll>.mp-cw::before{content:'角色立繪 ／ 自訂桌布';position:absolute;left:50%;top:50%;z-index:0;transform:translate(-50%,-50%);padding:7px 13px;border-radius:12px;background:color-mix(in srgb,var(--mp-surface) 86%,transparent);color:var(--mp-txt-l);font-size:10px;white-space:nowrap;}
      .mp-desk-scroll>.mp-cw>.mp-av{position:absolute;inset:0;z-index:1;width:100%;height:100%;border-radius:0;background:transparent;box-shadow:none;font-size:0;}
      .mp-desk-scroll>.mp-cw>.mp-av img{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover;object-position:center;transform-origin:center;will-change:transform;user-select:none;-webkit-user-drag:none;}
      .mp-desk-scroll>.mp-cw>.mp-av img.mp-hero-blur-bg{z-index:0;object-fit:cover;transform:scale(1.12);filter:blur(16px) saturate(1.08) brightness(1.02);opacity:.85;}
      .mp-desk-scroll>.mp-cw>.mp-cw-info{position:absolute;left:12px;bottom:12px;z-index:2;width:max-content;max-width:calc(100% - 24px);padding:7px 14px 8px 10px;border-radius:18px;background:color-mix(in srgb,var(--mp-surface) 88%,transparent);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 4px 14px color-mix(in srgb,var(--mp-pink-dk) 18%,transparent);}
      .mp-desk-scroll>.mp-cw .mp-cw-name{font-size:11px;font-weight:800;gap:5px;}
      .mp-desk-scroll>.mp-cw .mp-active-badge{width:7px;height:7px;min-width:7px;padding:0;border-radius:50%;font-size:0;background:#9CCC65;box-shadow:0 0 6px rgba(156,204,101,.8);}
      .mp-desk-scroll>.mp-cw .mp-cw-desc{max-width:270px;margin-top:2px;font-family:var(--mp-font);font-size:11px;line-height:1.35;color:var(--mp-pink-dk);white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;}
      .peach-hero{cursor:default;}
      .peach-hero:active{transform:none;}
      .peach-hero>.mp-cw-info{cursor:pointer;transition:max-width .18s ease,padding .18s ease,border-radius .18s ease;}
      .peach-hero>.mp-cw-info.is-collapsed{width:auto;max-width:calc(100% - 24px);padding:7px 12px;border-radius:999px;}
      .peach-status-time{font-family:var(--mp-font);font-size:9px;font-weight:500;color:var(--mp-txt-l);white-space:nowrap;}
      .peach-status-new{width:7px;height:7px;border-radius:50%;background:#ef6f83;box-shadow:0 0 0 3px rgba(239,111,131,.16),0 0 7px rgba(239,111,131,.7);animation:mpThoughtPulse 1.15s ease-in-out infinite;}
      .peach-hero-adjust{position:absolute;right:9px;top:9px;z-index:4;padding:5px 9px;border:0;border-radius:999px;background:rgba(255,252,248,.88);color:var(--mp-pink-dk);font-size:10px;font-weight:800;box-shadow:0 3px 10px rgba(107,87,80,.14);cursor:pointer;}
      .peach-hero.is-adjusting{cursor:grab;touch-action:none;box-shadow:inset 0 0 0 2px var(--mp-pink-dk),0 8px 24px rgba(224,122,139,.18);}
      .peach-hero.is-adjusting:active{transform:none;cursor:grabbing;}
      .peach-hero-tools{position:absolute;left:8px;right:8px;bottom:8px;z-index:5;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:14px;background:rgba(255,252,248,.92);box-shadow:0 4px 14px rgba(107,87,80,.18);}
      .peach-hero-tools input{min-width:0;flex:1;accent-color:var(--mp-pink-dk);}
      .peach-hero-tools button{border:0;border-radius:10px;padding:5px 8px;background:var(--mp-pink-lt);color:var(--mp-txt);font-size:10px;font-weight:800;cursor:pointer;}
      .peach-hero-tools button:last-child{background:linear-gradient(135deg,var(--mp-save-1),var(--mp-save-2));color:#fff;}
      .peach-hero.is-adjusting>.mp-cw-info{display:none;}
      .mp-home-mid{min-height:240px;}
      .mp-grid{gap:14px 8px;}
      .mp-chat-list{width:100%;min-width:0;max-width:100%;overflow-x:hidden;}
      .mp-chat-list-line{width:100%;min-width:0;max-width:100%;padding:8px 14px 16px;gap:10px;box-sizing:border-box;overflow-x:hidden;}
      .mp-chat-list-line .mp-chat-row{position:relative;width:100%;min-width:0;max-width:100%;min-height:84px;padding:12px 14px 12px 12px;gap:12px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--mp-pink) 20%,var(--mp-surface));border-radius:22px;background:color-mix(in srgb,var(--mp-surface) 86%,transparent);box-shadow:0 7px 20px color-mix(in srgb,var(--mp-pink-dk) 8%,transparent);overflow:hidden;}
      .mp-chat-list-line .mp-chat-row:hover{background:var(--mp-surface);box-shadow:0 9px 24px color-mix(in srgb,var(--mp-pink-dk) 12%,transparent);}
      .mp-chat-list-line .mp-chat-row:active{transform:scale(.985);background:var(--mp-surface);}
      .mp-chat-list-line .mp-chat-row.pinned{border-color:color-mix(in srgb,var(--mp-pink) 72%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mp-pink) 17%,transparent),0 8px 22px color-mix(in srgb,var(--mp-pink-dk) 11%,transparent);}
      .mp-chat-list-line .mp-chat-row-avatar{width:56px;height:56px;border-radius:50%;border:2px solid var(--mp-surface);box-shadow:0 0 0 2px color-mix(in srgb,var(--mp-pink) 48%,transparent);font-size:22px;}
      .mp-chat-list-line .mp-chat-row.pinned .mp-chat-row-avatar{box-shadow:0 0 0 3px color-mix(in srgb,var(--mp-pink) 62%,transparent),0 0 0 6px var(--mp-surface);}
      .mp-chat-list-line .mp-chat-row-body{align-self:stretch;display:flex;flex-direction:column;justify-content:center;}
      .mp-chat-list-line .mp-chat-row-top{align-items:center;}
      .mp-chat-list-line .mp-chat-row-name{font-size:14px;color:var(--mp-txt);}
      .mp-chat-list-line .mp-chat-row-name>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .mp-chat-list-line .mp-chat-row-pin{order:2;color:var(--mp-pink-dk);font-size:11px;}
      .mp-chat-list-line .mp-chat-row-time{font-family:var(--mp-hand);font-size:9px;color:var(--mp-txt-l);padding:0;}
      .mp-chat-list-line .mp-chat-row-preview{min-width:0;max-width:100%;margin-top:4px;font-size:12px;color:var(--mp-txt-l);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .mp-chat-list-line .mp-chat-row-bottom{align-items:center;}
      .mp-chat-list-line .mp-chat-row-badge{min-width:30px;height:24px;padding:0 9px;border-radius:999px;background:linear-gradient(135deg,var(--mp-bubble),var(--mp-bubble-2));box-shadow:0 3px 9px color-mix(in srgb,var(--mp-bubble-2) 24%,transparent);font-family:var(--mp-hand);font-size:11px;}
      @media (prefers-reduced-motion:reduce){.mp-phone::before,.mp-phone::after{display:none;}}
    ` : ``}
    ${!hasPeachEffects ? `.mp-cr::before{display:none!important}` : ``}
    ${!themeEffectsEnabled ? `.mp-phone::before,.mp-phone::after{display:none!important;animation:none!important}` : ``}
    ${false && showThemeEffects && normalizedThemeName === "莓果蘇打" ? `
      .mp-phone::before,.mp-phone::after{display:block;content:'○';top:auto;bottom:-30px;color:rgba(255,255,255,.72);font-size:25px;text-shadow:72px -130px 0 rgba(144,202,249,.38),188px -48px 0 rgba(206,147,216,.32),278px -210px 0 rgba(244,143,177,.36);animation:mpBubbleRise 13s ease-in infinite;}
      .mp-phone::after{left:46%;font-size:17px;animation-delay:5s;animation-duration:16s;}
    ` : ``}
    ${false && showThemeEffects && normalizedThemeName === "夜色絨幕" ? `
      .mp-phone::before,.mp-phone::after{display:block;content:'✦';top:12%;left:12%;color:#f4dfff;font-size:9px;text-shadow:62px 88px 0 #a5c9e8,176px 22px 0 #f48fb1,248px 154px 0 #c8a8e0,94px 310px 0 #fff;animation:mpStarTwinkle 4.8s ease-in-out infinite;}
      .mp-phone::after{content:'·';top:24%;left:28%;font-size:17px;animation-delay:1.8s;animation-duration:6.2s;}
    ` : ``}
    ${false && showThemeEffects && normalizedThemeName === "抹茶檸檬" ? `
      .mp-phone::before,.mp-phone::after{display:block;content:'🍃';top:-30px;left:13%;font-size:13px;text-shadow:104px 120px 0 rgba(124,179,66,.55),232px 30px 0 rgba(230,168,23,.38);animation:mpLeafFall 15s linear infinite;}
      .mp-phone::after{left:58%;font-size:10px;animation-delay:6s;animation-duration:18s;}
    ` : ``}
    ${false && showThemeEffects && normalizedThemeName === "海鹽汽水" ? `
      .mp-phone::before,.mp-phone::after{display:block;content:'';inset:0;top:0;left:0;font-size:0;background-image:radial-gradient(ellipse at 20% 30%,rgba(255,255,255,.22) 0 2px,transparent 3px),radial-gradient(ellipse at 70% 65%,rgba(77,182,172,.16) 0 3px,transparent 4px);background-size:54px 38px,76px 52px;animation:mpWaterShimmer 12s ease-in-out infinite;}
      .mp-phone::after{animation-delay:3s;animation-duration:16s;filter:blur(1px);}
    ` : ``}
    ${normalizedThemeName === "莓果蘇打" ? `
      .mp-phone::before,.mp-phone::after{content:'🫧';top:auto;bottom:-28px;color:rgba(255,255,255,.82);font-family:var(--mp-font);font-size:22px;text-shadow:none;filter:none;animation:mpBubbleRise 13s ease-in infinite;}
      .mp-phone::after{content:'🫧';left:58%;font-size:20px;text-shadow:none;filter:none;animation-name:mpBubbleRiseAlt;animation-delay:3.7s;animation-duration:16.8s;animation-timing-function:ease-in-out;}
    ` : ``}
    ${normalizedThemeName === "夜色絨幕" ? `
      .mp-phone::before,.mp-phone::after{content:'✦';color:#f4dfff;font-size:11px;text-shadow:98px 76px 0 rgba(165,201,232,.78);}
      .mp-phone::after{content:'⋆';font-size:15px;color:#c8a8e0;text-shadow:74px 128px 0 rgba(244,143,177,.72);}
    ` : ``}
    ${normalizedThemeName === "抹茶檸檬" ? `
      .mp-phone::before,.mp-phone::after{content:'🍃';font-size:13px;text-shadow:98px 76px 0 rgba(124,179,66,.48);}
      .mp-phone::after{content:'•';font-size:18px;color:#e6a817;text-shadow:74px 128px 0 rgba(230,168,23,.42);}
    ` : ``}
    ${normalizedThemeName === "海鹽汽水" ? `
      .mp-phone::before,.mp-phone::after{content:'❄️';top:22%;left:-25px;font-size:14px;text-shadow:78px 34px 0 rgba(79,195,247,.22);animation:mpSaltCrystalDrift 15s ease-in-out infinite;}
      .mp-phone::after{content:'❄️';top:62%;left:auto;right:-25px;font-size:10px;color:rgba(255,255,255,.82);text-shadow:64px -32px 0 rgba(77,182,172,.2);animation:mpSaltCrystalDriftAlt 18s ease-in-out 4s infinite;}
    ` : ``}
    ${scopedCustomCss}
  `;

  const lockNotifications = Object.keys(proactiveUnread || {})
    .filter((cid) => proactiveUnread[cid])
    .map((cid) => {
      const nc = characters.find((c) => c.id === cid);
      if (!nc) return null;
      const ms = chatHistory[cid] || [];
      const lm = ms[ms.length - 1];
      return { charId: cid, char: nc, time: lm?.time || 0, preview: lm?.content || "" };
    })
    .filter(Boolean)
    .sort((a, b) => b.time - a.time)
    .slice(0, 2);
  const openLockNotification = (notif) => {
    setProactiveUnread((prev) => { const n = { ...prev }; delete n[notif.charId]; return n; });
    setCurrentChatChar(notif.char);
    openApp("chat");
    handleUnlock();
  };
  if (locked) return (<><style>{css}</style><style>{themeCss}</style><div className="mp-wrap"><div className="mp-phone"><div className={`mp-lock ${unlocking?"out":""}`} onTouchStart={onLockTouchStart} onTouchEnd={onLockTouchEnd} onMouseDown={onLockMouseDown} onMouseUp={onLockMouseUp} onPointerDown={onLockPointerDown} onPointerUp={onLockPointerUp} onDoubleClick={handleUnlock}><BarClock ft={ft} hideTime /><LockClock ft={ft} fd={fd} />{lockNotifications.length > 0 && (<div className="mp-lock-notifs">{lockNotifications.map((notif) => (<button key={notif.charId} type="button" className="mp-lock-notif" onClick={(e) => { e.stopPropagation(); openLockNotification(notif); }}><div className="mp-lock-notif-avatar">{sanitizeUserImageUrl(notif.char.avatar) ? <img src={sanitizeUserImageUrl(notif.char.avatar)} alt="" /> : (notif.char.name?.[0] || "🙂")}</div><div className="mp-lock-notif-body"><div className="mp-lock-notif-name">{notif.char.name}</div><div className="mp-lock-notif-preview">{notif.preview}</div></div></button>))}</div>)}<div className="mp-lock-hint">{tr("向上滑動解鎖 MaliPhone（或雙擊）", "Swipe up to unlock MaliPhone (or double-click)", "MaliPhone を上にスワイプしてロック解除（またはダブルクリック）", "MaliPhone을 위로 밀어 잠금 해제(또는 더블클릭)")}</div></div></div></div></>);

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
    lbook: { ...DEFAULT_APPS.find((a) => a.id === "lbook"), name: t("answerBook") },
    notebook: { ...DEFAULT_APPS.find((a) => a.id === "notebook"), name: t("notebook") },
    settings: { ...DEFAULT_APPS.find((a) => a.id === "settings"), name: t("settings") },
    characters: { ...DEFAULT_APPS.find((a) => a.id === "characters"), name: t("characters") },
    phone: { ...DEFAULT_APPS.find((a) => a.id === "phone"), name: t("phone") },
  };
  const appById = Object.fromEntries(DEFAULT_APPS.map(a => [a.id, localizedAppById[a.id] || a]));
  const renderAppIcon = (app, size = 26) => {
    if (app?.iconUrl) {
      return <img className="mp-app-icon-img" src={app.iconUrl} alt={app?.name || ""} draggable={false} onContextMenu={(e)=>e.preventDefault()} style={{ width: size, height: size }} />;
    }
    return app?.icon || "";
  };
  const allAppIds = DEFAULT_APPS.map((a) => a.id);
  const safeDock = dockOrder.filter((id) => allAppIds.includes(id)).slice(0, 4);
  const dockSet = new Set(safeDock);
  const cleanedSlots = homeSlots.map((id) => (id && allAppIds.includes(id) && !dockSet.has(id) ? id : null));
  const used = new Set();
  for (let i = 0; i < cleanedSlots.length; i++) {
    const id = cleanedSlots[i];
    if (!id) continue;
    if (used.has(id)) cleanedSlots[i] = null;
    else used.add(id);
  }
  const missingForHome = allAppIds.filter((id) => !dockSet.has(id) && !used.has(id));
  for (let i = PAGE_SIZE; i < PAGE_SIZE * 2 && missingForHome.length; i++) {
    if (!cleanedSlots[i]) cleanedSlots[i] = missingForHome.shift();
  }
  for (let i = 0; i < cleanedSlots.length && missingForHome.length; i++) {
    if (!cleanedSlots[i]) cleanedSlots[i] = missingForHome.shift();
  }
  const homePages = [
    cleanedSlots.slice(0, PAGE_SIZE),
    cleanedSlots.slice(PAGE_SIZE, PAGE_SIZE * 2),
    cleanedSlots.slice(PAGE_SIZE * 2, PAGE_SIZE * 3),
  ];
  const dockApps = safeDock.map(id => appById[id]).filter(Boolean);

  const findSlotIndex = (slots, appId) => slots.findIndex((id) => id === appId);
  const moveAppToHomeSlot = (appId, targetSlotIndex) => {
    if (!allAppIds.includes(appId)) return;
    if (safeDock.includes(appId) && safeDock.length <= 2) return;
    const nextDock = safeDock.filter((id) => id !== appId);
    const nextSlots = [...cleanedSlots];
    const fromSlot = findSlotIndex(nextSlots, appId);
    if (fromSlot >= 0) nextSlots[fromSlot] = null;
    const occupant = nextSlots[targetSlotIndex];
    nextSlots[targetSlotIndex] = appId;
    if (occupant && occupant !== appId) {
      if (fromSlot >= 0) nextSlots[fromSlot] = occupant;
      else {
        const emptyIdx = nextSlots.findIndex((id) => id === null);
        if (emptyIdx >= 0) nextSlots[emptyIdx] = occupant;
      }
    }
    setDockOrder(nextDock);
    setHomeSlots(nextSlots);
  };
  const moveAppToDock = (appId, targetDockIndex) => {
    if (!allAppIds.includes(appId)) return;
    const isFromDock = safeDock.includes(appId);
    let nextDock = safeDock.filter((id) => id !== appId);
    if (!isFromDock && nextDock.length >= 4) return;
    if (isFromDock && nextDock.length < 2) return;
    const idx = Math.max(0, Math.min(targetDockIndex, nextDock.length));
    nextDock.splice(idx, 0, appId);
    const nextSlots = cleanedSlots.map((id) => (id === appId ? null : id));
    setDockOrder(nextDock);
    setHomeSlots(nextSlots);
  };
  const onHomeTouchStart = (e) => {
    if (isDraggingApp || pointerDrag) return;
    swipeStartXRef.current = e.touches?.[0]?.clientX ?? null;
    swipeStartYRef.current = e.touches?.[0]?.clientY ?? null;
  };
  const switchHomePageBySwipe = (sx, sy, ex, ey) => {
    if (isDraggingApp) return;
    if (sx === null || ex === null || sy === null || ey === null) return;
    const diffX = sx - ex;
    const diffY = sy - ey;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);
    // 更接近手機手感：降低觸發門檻，並允許些微斜向滑動
    if (absX < 18) return;
    if (absY > absX * 1.35) return;
    if (diffX > 0) setHomePage(p => Math.min(p + 1, homePages.length - 1));
    else setHomePage(p => Math.max(p - 1, 0));
  };
  const onHomeTouchEnd = (e) => {
    if (isDraggingApp || pointerDrag) {
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      return;
    }
    const sx = swipeStartXRef.current;
    const sy = swipeStartYRef.current;
    const ex = e.changedTouches?.[0]?.clientX ?? null;
    const ey = e.changedTouches?.[0]?.clientY ?? null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    switchHomePageBySwipe(sx, sy, ex, ey);
  };
  const onHomeMouseDown = (e) => {
    if (isDraggingApp || pointerDrag) return;
    swipeStartXRef.current = e.clientX ?? null;
    swipeStartYRef.current = e.clientY ?? null;
  };
  const onHomeMouseUp = (e) => {
    if (isDraggingApp || pointerDrag) {
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      return;
    }
    const sx = swipeStartXRef.current;
    const sy = swipeStartYRef.current;
    const ex = e.clientX ?? null;
    const ey = e.clientY ?? null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    switchHomePageBySwipe(sx, sy, ex, ey);
  };
  const onHomePointerDown = (e) => {
    if (pointerDrag) return;
    swipeStartXRef.current = e.clientX ?? null;
    swipeStartYRef.current = e.clientY ?? null;
  };
  const onHomePointerUp = (e) => {
    if (pointerDrag) {
      const dragging = pointerDrag;
      setPointerDrag(null);
      setIsDraggingApp(false);
      clearTimeout(edgeTurnTimerRef.current);
      edgeTurnTimerRef.current = null;
      edgeTurnDirRef.current = null;
      const upDx = Math.abs((e.clientX || 0) - (dragging.startX || 0));
      const upDy = Math.abs((e.clientY || 0) - (dragging.startY || 0));
      const movedByDistance = (upDx + upDy) > 8;
      if (!dragging.moved && !movedByDistance) {
        openApp(dragging.appId);
        return;
      }
      suppressAppClickUntilRef.current = Date.now() + 350;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slotEl = el?.closest?.("[data-drop-slot]");
      const dockEl = el?.closest?.("[data-drop-dock]");
      const dockWrap = el?.closest?.("[data-drop-dock-wrap]");
      if (slotEl) {
        const slot = Number(slotEl.getAttribute("data-drop-slot"));
        if (!Number.isNaN(slot)) moveAppToHomeSlot(dragging.appId, slot);
      } else if (dockWrap) {
        const rect = dockWrap.getBoundingClientRect();
        const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const slotCount = Math.max(1, dockApps.length);
        const ratio = relX / rect.width;
        const targetIndex = Math.max(0, Math.min(dockApps.length, Math.round(ratio * slotCount)));
        moveAppToDock(dragging.appId, targetIndex);
      } else if (dockEl) {
        const idx = Number(dockEl.getAttribute("data-drop-dock"));
        if (!Number.isNaN(idx)) moveAppToDock(dragging.appId, idx);
      }
      return;
    }
    const sx = swipeStartXRef.current;
    const sy = swipeStartYRef.current;
    const ex = e.clientX ?? null;
    const ey = e.clientY ?? null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    switchHomePageBySwipe(sx, sy, ex, ey);
  };
  const onHomePointerMove = (e) => {
    if (!pointerDrag) return;
    const dx = Math.abs((e.clientX || 0) - pointerDrag.startX);
    const dy = Math.abs((e.clientY || 0) - pointerDrag.startY);
    const moved = dx + dy > 8;
    setPointerDrag((p) => ({ ...p, x: e.clientX || 0, y: e.clientY || 0, moved }));
    const vw = window.innerWidth || 0;
    const x = e.clientX || 0;
    const edge = 28;
    let dir = null;
    const maxPage = Math.max(0, homePages.length - 1);
    if (x <= edge && homePage > 0) dir = -1;
    else if (x >= vw - edge && homePage < maxPage) dir = 1;
    if (dir !== edgeTurnDirRef.current) {
      clearTimeout(edgeTurnTimerRef.current);
      edgeTurnTimerRef.current = null;
      edgeTurnDirRef.current = dir;
      if (dir) {
        edgeTurnTimerRef.current = setTimeout(() => {
          setHomePage((p) => Math.max(0, Math.min(maxPage, p + dir)));
          edgeTurnTimerRef.current = null;
          edgeTurnDirRef.current = null;
        }, 450);
      }
    }
  };

    // ---- Status (RPG) ----
  const renderStatus = () => <StatusApp
    closeApp={closeApp} t={t} tr={tr} characters={characters} chatHistory={chatHistory} memories={memories} posts={posts}
    sanitizeUserImageUrl={sanitizeUserImageUrl} statusExpandedCharId={statusExpandedCharId} setStatusExpandedCharId={setStatusExpandedCharId}
    statusMemoryExpandedCharId={statusMemoryExpandedCharId} setStatusMemoryExpandedCharId={setStatusMemoryExpandedCharId}
    refreshCharacterStatus={refreshCharacterStatus} activeMemoryId={activeMemoryId} setActiveMemoryId={setActiveMemoryId}
    setMemoryEditor={setMemoryEditor} togglePinMemory={togglePinMemory} deleteMemory={deleteMemory}
    generateMemory={generateMemory} genLoading={genLoading}
  />;

  // ---- Chat ----
  const renderRealityInline = (text) => {
    const raw = String(text || "");
    const nodes = [];
    const re = /(\*\*[^*\n]{1,500}\*\*|__[^_\n]{1,500}__|「[^」]{1,500}」|"[^"\n]{1,500}"|\*[^*\n]{1,500}\*|_[^_\n]{1,500}_)/g;
    let last = 0;
    let match;
    while ((match = re.exec(raw))) {
      if (match.index > last) nodes.push(raw.slice(last, match.index));
      const token = match[0];
      if (token.startsWith("**") || token.startsWith("__")) {
        nodes.push(<strong key={`b-${match.index}`} className="mp-reality-strong">{token.slice(2, -2)}</strong>);
      } else if (token.startsWith("「") || token.startsWith("\"")) {
        nodes.push(<span key={`d-${match.index}`} className="mp-reality-dialogue">{token}</span>);
      } else {
        nodes.push(<span key={`t-${match.index}`} className="mp-reality-thought">{token.slice(1, -1)}</span>);
      }
      last = match.index + token.length;
    }
    if (last < raw.length) nodes.push(raw.slice(last));
    return nodes.map((node, i) => typeof node === "string" ? <React.Fragment key={`s-${i}`}>{node}</React.Fragment> : node);
  };
  const renderRealityText = (text) => String(text || "").split(/\n{2,}/).map((para, idx) => (
    <p key={idx} className="mp-reality-p">
      {para.split("\n").map((line, lineIdx) => (
        <React.Fragment key={lineIdx}>
          {lineIdx > 0 && <br />}
          {renderRealityInline(line)}
        </React.Fragment>
      ))}
    </p>
  ));
  const getChatThreadSortMeta = (char) => {
    const msgs = chatHistory[char?.id] || [];
    const lastMsg = msgs[msgs.length - 1] || null;
    const lastAt = Number(lastMsg?.time || 0);
    const pinned = !!char?.pinned || !!char?.chatPinned;
    return { pinned, lastAt, name: String(char?.name || "") };
  };
  const sortChatThreads = (list) => [...list].sort((a, b) => {
    const am = getChatThreadSortMeta(a);
    const bm = getChatThreadSortMeta(b);
    if (am.pinned !== bm.pinned) return am.pinned ? -1 : 1;
    if (am.lastAt !== bm.lastAt) return bm.lastAt - am.lastAt;
    return am.name.localeCompare(bm.name, "zh-Hant");
  });
  const sortGroupChats = (list) => [...list].sort((a, b) => {
    const am = !!a?.pinned;
    const bm = !!b?.pinned;
    if (am !== bm) return am ? -1 : 1;
    const at = Number(a?.updatedAt || a?.lastAt || (a?.messages || [])[((a?.messages || []).length - 1)]?.time || 0);
    const bt = Number(b?.updatedAt || b?.lastAt || (b?.messages || [])[((b?.messages || []).length - 1)]?.time || 0);
    if (at !== bt) return bt - at;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "zh-Hant");
  });
  // Pinning is a pure local UI/state action only. It must never trigger AI calls or alter prompt content.
  const toggleChatPin = (charId) => {
    setCharacters((prev) => {
      const target = prev.find((c) => c.id === charId);
      showToast(target?.pinned ? tr("已取消釘選", "Unpinned", "固定を解除しました", "고정 해제됨") : tr("已釘選", "Pinned", "固定しました", "고정됨"));
      return prev.map((c) => (c.id === charId ? { ...c, pinned: !c.pinned } : c));
    });
  };
  const getGroupMembers = (group) => {
    const ids = Array.isArray(group?.memberIds) && group.memberIds.length ? group.memberIds : characters.map((c) => c.id);
    return characters.filter((c) => ids.includes(c.id));
  };
  const compressGroupCoverFile = (file, done) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const raw = String(r.result || "");
      const safe = sanitizeUserImageUrl(raw);
      if (!safe) return showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
      const img = new Image();
      img.onload = () => {
        const maxEdge = 720;
        const maxSide = Math.max(img.width, img.height);
        const scale = maxSide > maxEdge ? (maxEdge / maxSide) : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return showToast("圖片處理失敗");
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", 0.82);
        const next = sanitizeUserImageUrl(out);
        if (!next) return showToast("圖片處理失敗");
        done(next);
      };
      img.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
      img.src = safe;
    };
    r.readAsDataURL(file);
  };
  const compressChatBackgroundFile = (file, done) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const raw = String(r.result || "");
      const safe = sanitizeUserImageUrl(raw);
      if (!safe) return showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
      const img = new Image();
      img.onload = () => {
        const maxBytes = 1500 * 1024;
        const maxEdges = [1600, 1400, 1200, 1000, 820];
        const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];
        let picked = null;
        const bytesFromDataUrl = (dataUrl) => Math.ceil(Math.max(0, String(dataUrl || "").length - String(dataUrl || "").indexOf(",") - 1) * 0.75);
        for (const maxEdge of maxEdges) {
          const maxSide = Math.max(img.width, img.height);
          const scale = maxSide > maxEdge ? (maxEdge / maxSide) : 1;
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return showToast("圖片處理失敗");
          ctx.drawImage(img, 0, 0, w, h);
          for (const quality of qualities) {
            const out = canvas.toDataURL("image/jpeg", quality);
            const bytes = bytesFromDataUrl(out);
            picked = { out, bytes };
            if (bytes <= maxBytes) break;
          }
          if (picked?.bytes <= maxBytes) break;
        }
        if (!picked || picked.bytes > maxBytes) return showToast(tr("圖片壓縮後仍過大，請改用尺寸更小或內容較簡單的圖片", "The image is still too large after compression. Please use a smaller or simpler image.", "圧縮後も画像が大きすぎます。もっと小さい、またはシンプルな画像を使ってください。", "압축 후에도 이미지가 너무 큽니다. 더 작거나 단순한 이미지를 사용해주세요."));
        const next = sanitizeUserImageUrl(picked.out);
        if (!next) return showToast("圖片處理失敗");
        done(next);
      };
      img.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
      img.src = safe;
    };
    r.readAsDataURL(file);
  };
  const normalizeChatBackground = (bg) => {
    if (!bg) return { src: "", x: 0, y: 0, zoom: 1, blur: 0 };
    if (typeof bg === "string") return { src: sanitizeUserImageUrl(bg) || "", x: 0, y: 0, zoom: 1, blur: 0 };
    return {
      src: sanitizeUserImageUrl(bg?.src || bg?.url || "") || "",
      x: Number.isFinite(Number(bg?.x)) ? Number(bg.x) : 0,
      y: Number.isFinite(Number(bg?.y)) ? Number(bg.y) : 0,
      zoom: Number.isFinite(Number(bg?.zoom)) ? Number(bg.zoom) : 1,
      blur: Number.isFinite(Number(bg?.blur)) ? Number(bg.blur) : 0,
    };
  };
  const getChatBackgroundLayerStyle = (bg, extraScale = 1, fitAxis = "height") => {
    const normalized = normalizeChatBackground(bg);
    const zoom = Math.max(1, Math.min(2.2, Number(normalized.zoom) || 1));
    const scaledZoom = zoom * Math.max(1, Number(extraScale) || 1);
    const backgroundSize = fitAxis === "width"
      ? `calc(100% * ${scaledZoom}) auto`
      : `auto calc(100% * ${scaledZoom})`;
    return {
      position: "absolute",
      inset: 0,
      backgroundImage: `url(${normalized.src})`,
      backgroundRepeat: "no-repeat",
      backgroundSize,
      backgroundPosition: `${50 + (Number(normalized.x) || 0)}% ${50 + (Number(normalized.y) || 0)}%`,
      pointerEvents: "none",
    };
  };
  const getChatBackgroundBlurFilter = (bg) => {
    const normalized = normalizeChatBackground(bg);
    return `blur(${Math.max(0, Math.min(24, Number(normalized.blur) || 0))}px) saturate(.92) brightness(.96)`;
  };
  const updateChatBackground = (charId, bg) => {
    setChatBackgrounds((prev) => ({ ...prev, [charId]: normalizeChatBackground(bg) }));
  };
  const onChatBackgroundFile = (charId, file) => {
    if (!charId || !file) return;
    compressChatBackgroundFile(file, (safe) => {
      const next = { src: safe, x: 0, y: 0, zoom: 1, blur: 0 };
      updateChatBackground(charId, next);
      setChatBgEditor({ charId, ...next, dragging: false, dragStartX: 0, dragStartY: 0, startX: 0, startY: 0 });
      showToast(tr("聊天室背景已更新", "Chat background updated", "チャット背景を更新しました", "채팅 배경이 업데이트되었습니다"));
    });
  };
  const openGroupCoverCrop = (file, mode = "create") => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const safe = sanitizeUserImageUrl(String(r.result || ""));
      if (!safe) return showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
      const img = new Image();
      img.onload = () => {
        const crop = { src: safe, width: img.width, height: img.height, zoom: 1, panX: 0, panY: 0, dragging: false, dragStartX: 0, dragStartY: 0, startPanX: 0, startPanY: 0 };
        if (mode === "edit") setGroupEditCoverCrop(crop);
        else setGroupCoverCrop(crop);
      };
      img.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
      img.src = safe;
    };
    r.readAsDataURL(file);
  };
  const applyGroupCoverCrop = (mode = "create") => {
    const crop = mode === "edit" ? groupEditCoverCrop : groupCoverCrop;
    if (!crop?.src) return;
    const img = new Image();
    img.onload = () => {
      const size = 320;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return showToast("圖片處理失敗");
      const iw = img.width;
      const ih = img.height;
      const scale = Math.max(size / iw, size / ih) * Math.max(1, crop.zoom || 1);
      const dw = iw * scale;
      const dh = ih * scale;
      const panX = Number(crop.panX || 0);
      const panY = Number(crop.panY || 0);
      const maxShiftX = Math.max(0, (dw - size) / 2);
      const maxShiftY = Math.max(0, (dh - size) / 2);
      const shiftX = (maxShiftX * panX) / 100;
      const shiftY = (maxShiftY * panY) / 100;
      const dx = (size - dw) / 2 + shiftX;
      const dy = (size - dh) / 2 + shiftY;
      ctx.drawImage(img, dx, dy, dw, dh);
      const out = canvas.toDataURL("image/jpeg", 0.84);
      const safe = sanitizeUserImageUrl(out);
      if (!safe) return showToast("圖片處理失敗");
      if (mode === "edit") {
        setGroupEditCover(safe);
        setGroupEditCoverCrop(null);
      } else {
        setGroupCreateCover(safe);
        setGroupCoverCrop(null);
      }
    notify(tr("群組圖片已更新", "Group cover updated", "グループ画像を更新しました", "그룹 이미지가 업데이트되었습니다"), "Group cover updated");
    };
    img.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
    img.src = crop.src;
  };
  const getGroupSpeakerForAssistant = (group, messages, excludeIds = []) => {
    const members = getGroupMembers(group);
    if (!members.length) return { name: "群組", avatar: null };
    const used = new Set([...(excludeIds || [])]);
    const pool = members.filter((m) => !used.has(m.id));
    const baseList = pool.length ? pool : members;
    const assistantCount = (messages || []).filter((m) => m.role === "assistant").length;
    const idx = assistantCount % baseList.length;
    const picked = baseList[idx] || baseList[0];
    return { name: picked?.name || "群組", avatar: sanitizeUserImageUrl(picked?.avatar || null) };
  };
  const getGroupMemberProfileText = (char) => [
    `角色：${char?.name || "未命名"}`,
    char?.description ? `角色設定：${sanitizeText(char.description, 240)}` : "",
    char?.personality ? `個性：${sanitizeText(char.personality, 180)}` : "",
    char?.scenario ? `情境：${sanitizeText(char.scenario, 180)}` : "",
    char?.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
  ].filter(Boolean).join("\n");
  const buildGroupChatSystemPrompt = (group, memberNames, memberProfiles, recent) => {
    const scene = groupScenes?.[group?.id] || {};
    const sceneText = [
      scene.location ? `地點：${sanitizeText(scene.location, 15)}` : "",
      scene.note ? `小備註：${sanitizeText(scene.note, 50)}` : "",
    ].filter(Boolean).join(" · ");
    return `${getOutputLanguageDirective()}

你正在群組聊天室中回覆，請保持多人聊天感，不要提及系統、不要提到 AI 身份。
群組成員：${memberNames}
${sceneText ? `目前場景：${sceneText}\n` : ""}群組成員角色資料：
${memberProfiles || "（無）"}
回覆規則：
1. 你要一次產生「這一輪群聊」的多位角色回覆，不要只回一位。
2. 最多輸出 3 則回覆，至少 1 則。只有在自然適合時才讓多位角色發言，不要硬湊滿 3 則。
3. 每一則回覆都要是不同角色，不能重複同一角色兩次。
4. 每一則回覆都要維持一般聊天室的對話形式，像真的在群組裡接話，不要寫成公告、總結、條列或分析。
5. 維持「線上聊天」感，只能講角色說出口的內容，不要加入旁白、動作、表情、內心獨白。
6. 不要輸出像 *他站了起來*、（點頭）、【動作】這類格式，也不要寫成小說段落。
7. 每則內容維持短到中等長度，通常 1~3 句；如果角色對這個話題很有興趣，可以讓同一段講得更完整一點，但不要超過 3 句。
8. 若前文或這一輪明顯點名某角色，請優先安排該角色回覆。
9. 可以有角色回玩家，也可以有角色回前一位角色，但每一則只能回一個對象，不要同時回兩個人。
10. 可以自然接話、表態、提問、建議，並且主動推進話題，例如丟出新觀點、接續延伸、提出下一步或換一個相關話題，但幅度要小，不要一次推太多，也不要跳太遠。
11. 不要輸出模式標籤、解說、分析或 Markdown，只能輸出 JSON。
12. 請嚴格輸出以下格式，不要多字少字：
{"replies":[{"speaker":"角色名稱","content":"回覆內容"}]}
13. 如果這一輪只需要 1 則回覆，就只放 1 個物件。
14. 需要承接最近對話：
${recent || "（目前無內容）"}`;
  };
  const parseGroupReplies = (raw) => {
    if (!raw) return [];
    const text = String(raw).trim();
    const candidates = [];
    candidates.push(text);
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) candidates.push(fenced[1].trim());
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      candidates.push(text.slice(firstBrace, lastBrace + 1).trim());
    }
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        const replies = Array.isArray(parsed?.replies) ? parsed.replies : Array.isArray(parsed?.turns) ? parsed.turns : [];
        const cleaned = replies.map((item) => ({
          speaker: sanitizeText(item?.speaker || item?.name || "", 80),
          content: sanitizeText(item?.content || item?.reply || "", 4000).trim(),
        })).filter((item) => item.speaker && item.content);
        if (cleaned.length) return cleaned.slice(0, 3);
      } catch (_) {}
    }
    const fallbackLines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(?:[-*•]|\d+[.)]?)\s*(.+?)\s*[:：]\s*(.+)$/);
        if (m) return { speaker: sanitizeText(m[1], 80), content: sanitizeText(m[2], 4000).trim() };
        return null;
      })
      .filter(Boolean);
    return fallbackLines.slice(0, 3);
  };
  const currentGroupMessages = currentChatGroup ? (currentChatGroup.messages || []) : [];
  const getCurrentGroupModelHint = () => {
    const providerShortMap = {
      openai: "GPT",
      deepseek: "DS",
      claude: "Claude",
      gemini: "Gemini",
      vertex: "Vertex",
      grok: "Grok",
      openrouter: "OR",
    };
    return providerShortMap[apiConfig?.provider || "openai"] || "AI";
  };
  const openCreateGroup = () => {
    setGroupCreateName("");
    setGroupCreateRulePrompt("");
    setGroupCreateMemberIds([]);
    setGroupCreateSearch("");
    setGroupCreateCover("");
    setGroupCreateOpen(true);
  };
  const openEditGroup = (group) => {
    if (!group) return;
    setGroupEditGroupId(group.id);
    setGroupEditName(group.name || "");
    setGroupEditRulePrompt(group.rulePrompt || "");
    setGroupEditMemberIds(Array.isArray(group.memberIds) ? group.memberIds.slice(0, 5) : []);
    setGroupEditSearch("");
    setGroupEditCover(group.cover || "");
    setGroupEditOpen(true);
  };
  const handleGroupCreateCoverUp = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    openGroupCoverCrop(f, "create");
    e.target.value = "";
  };
  const handleGroupEditCoverUp = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    openGroupCoverCrop(f, "edit");
    e.target.value = "";
  };
  const saveEditGroup = () => {
    if (!groupEditGroupId) return;
    const members = characters.filter((c) => groupEditMemberIds.includes(c.id)).slice(0, 5);
    if (members.length === 0) {
      showToast(tr("請至少選擇 1 位角色", "Select at least 1 character", "少なくとも1人のキャラを選択してください", "캐릭터를 1명 이상 선택해주세요"));
      return;
    }
    const memberLabel = members.map((m) => m.name).join("、");
    const fallbackName = tr(`${memberLabel}的群組聊天室`, `${memberLabel}'s group chat`, `${memberLabel}のグループチャット`, `${memberLabel}의 그룹 채팅`);
    const name = sanitizeText(groupEditName.trim() || fallbackName, 80);
    setGroupChats((prev) => prev.map((g) => g.id === groupEditGroupId ? {
      ...g,
      name,
      rulePrompt: sanitizeText(groupEditRulePrompt.trim(), 3000),
      memberIds: members.map((m) => m.id),
      cover: groupEditCover || "",
      updatedAt: Date.now(),
    } : g));
    if (currentChatGroup?.id === groupEditGroupId) {
      setCurrentChatGroup((prev) => prev ? {
        ...prev,
        name,
        rulePrompt: sanitizeText(groupEditRulePrompt.trim(), 3000),
        memberIds: members.map((m) => m.id),
        cover: groupEditCover || "",
        updatedAt: Date.now(),
      } : prev);
    }
    setGroupEditOpen(false);
    showToast(tr("群組已更新", "Group updated", "グループを更新しました", "그룹이 업데이트되었습니다"));
  };
  const createGroupChat = () => {
    if (groupCreateMemberIds.length === 0) {
      showToast(tr("請至少選擇 1 位角色", "Select at least 1 character", "少なくとも1人のキャラを選択してください", "캐릭터를 1명 이상 선택해주세요"));
      return;
    }
    const members = characters.filter((c) => groupCreateMemberIds.includes(c.id)).slice(0, 5);
    const memberLabel = members.map((m) => m.name).join("、");
    const fallbackName = tr(`${memberLabel}的群組聊天室`, `${memberLabel}'s group chat`, `${memberLabel}のグループチャット`, `${memberLabel}의 그룹 채팅`);
    const name = sanitizeText(groupCreateName.trim() || fallbackName, 80);
    const payload = {
      id: gid(),
      name,
      rulePrompt: sanitizeText(groupCreateRulePrompt.trim(), 3000),
      memberIds: members.map((m) => m.id),
      cover: groupCreateCover || "",
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setGroupChats((prev) => [...prev, payload]);
    setGroupCreateOpen(false);
    setCurrentChatGroup(payload);
    notify(tr("已建立群組", "Group created", "グループを作成しました", "그룹이 생성되었습니다"), `Group created: ${name || fallbackName}`);
  };
  const sendGroupMessage = async () => {
    if (!currentChatGroup || isTyping) return;
    const text = sanitizeText(chatInput.trim(), 4000);
    const img = chatImage?.data || null;
    if (!text && !img) return;
    const nowMs = Date.now();
    const members = getGroupMembers(currentChatGroup);
    const now = new Date();
    const nowDate = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const nowTime = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const nowTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
    const nowContext = `[系統時間] 目前時間：${nowDate} ${nowTime} (${nowTz})`;
    const userMsg = {
      id: gid(),
      role: "user",
      content: text,
      image: img,
      imageSummary: "",
      time: nowMs,
      speakerName: getPlayerDisplayName(),
      speakerAvatar: sanitizeUserImageUrl(getPlayerAvatar()),
    };
    const nextMessages = [...(currentChatGroup.messages || []), userMsg];
    setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: nextMessages, updatedAt: nowMs } : g));
    setChatInput("");
    setChatImage(null);
    setChatActionPanelOpen(false);
    setIsTyping(true);
    try {
      const memberNames = members.map((m) => m.name).join("、") || tr("群組成員", "Group members", "グループメンバー", "그룹 멤버");
      const memberProfiles = members
        .map((c) => getGroupMemberProfileText(c))
        .filter(Boolean)
        .join("\n\n");
      const hist = nextMessages
        .slice(-18)
        .map((m) => {
          const summaryLine = m.imageSummary ? `\n[圖片摘要]\n${m.imageSummary}` : "";
          return { role: m.role, content: `${m.content || ""}${summaryLine}`.trim(), image: m.image || null };
        })
        .filter(Boolean);
      const safeHist = hist.map((m, idx) => {
        const isLast = idx === hist.length - 1;
        if (img && isLast) return m;
        return { ...m, image: null };
      });
      const recent = safeHist.map((m) => `${m.role === "user" ? "玩家" : (m.speakerName || "群組")}: ${m.content || "[圖片]"}`).join("\n");
      const sysP = `${nowContext}\n\n${buildGroupChatSystemPrompt(currentChatGroup, memberNames, memberProfiles, recent)}`;
      const reply = await callAI(safeHist, apiConfig, sysP);
      const parsedReplies = parseGroupReplies(stripInternalBlocks(reply));
      const speakerMap = new Map(members.map((m) => [m.name, m]));
      const usableReplies = [];
      const seenSpeakers = new Set();
      for (const item of parsedReplies) {
        const matched = speakerMap.get(item.speaker) || members.find((m) => m.name === item.speaker);
        const resolvedName = matched?.name || item.speaker;
        if (!resolvedName || !item.content || seenSpeakers.has(resolvedName)) continue;
        seenSpeakers.add(resolvedName);
        usableReplies.push({
          speakerName: resolvedName,
          speakerAvatar: sanitizeUserImageUrl(matched?.avatar || ""),
          content: item.content,
        });
      }
      if (!usableReplies.length) {
        const fallbackSpeaker = members[0];
        const fallbackContent = sanitizeText(stripInternalBlocks(reply), 4000).trim();
        if (fallbackSpeaker && fallbackContent) {
          usableReplies.push({
            speakerName: fallbackSpeaker.name,
            speakerAvatar: sanitizeUserImageUrl(fallbackSpeaker.avatar || ""),
            content: fallbackContent,
          });
        }
      }
      const replyMessages = usableReplies.map((r) => ({
        id: gid(),
        role: "assistant",
        content: r.content,
        time: Date.now(),
        speakerName: r.speakerName,
        speakerAvatar: r.speakerAvatar,
      }));
      if (replyMessages.length) {
        let workingMessages = [...nextMessages];
        for (let i = 0; i < replyMessages.length; i += 1) {
          const msg = replyMessages[i];
          if (i > 0) {
            const lengthFactor = Math.max(0, Math.min(1, (replyMessages[i - 1]?.content?.length || 0) / 220));
            const wait = Math.round(220 + (lengthFactor * 520));
            await new Promise((resolve) => setTimeout(resolve, wait));
          }
          workingMessages = [...workingMessages, msg];
          setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: workingMessages, updatedAt: Date.now() } : g));
        }
      }
      if (img && replyMessages.length) {
        const latestReplyText = replyMessages.map((m) => m.content).join(" / ");
        const base = text ? `{{user}} 訊息：${text}\n` : "";
        const imageSummary = sanitizeText(`${base}重點：${latestReplyText}`.slice(0, 220), 220);
        if (imageSummary) {
          setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? {
            ...g,
            messages: (g.messages || []).map((m) => (m.id === userMsg.id ? { ...m, imageSummary } : m)),
            updatedAt: Date.now(),
          } : g));
        }
      }
    } catch (err) {
      const notice = { id: gid(), role: "system_notice", content: `${getConnectionErrorPrefix()}${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 500)}`, time: Date.now() };
      setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: [...nextMessages, notice], updatedAt: Date.now() } : g));
    }
    setIsTyping(false);
  };
  const retryGroupFromNotice = async (noticeId) => {
    if (!currentChatGroup || isTyping) return;
    const list = currentChatGroup.messages || [];
    const noticeIdx = list.findIndex((m) => m.id === noticeId);
    if (noticeIdx < 0) return;
    const userMsg = [...list.slice(0, noticeIdx)].reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    const nextMessages = list.filter((m) => m.id !== noticeId);
    const members = getGroupMembers(currentChatGroup);
    const now = new Date();
    const nowDate = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const nowTime = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const nowTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
    const nowContext = `[系統時間] 目前時間：${nowDate} ${nowTime} (${nowTz})`;
    setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: nextMessages, updatedAt: Date.now() } : g));
    setIsTyping(true);
    try {
      const memberNames = members.map((m) => m.name).join("、") || tr("群組成員", "Group members", "グループメンバー", "그룹 멤버");
      const memberProfiles = members
        .map((c) => getGroupMemberProfileText(c))
        .filter(Boolean)
        .join("\n\n");
      const hist = nextMessages
        .slice(-18)
        .map((m) => {
          const summaryLine = m.imageSummary ? `\n[圖片摘要]\n${m.imageSummary}` : "";
          return { role: m.role, content: `${m.content || ""}${summaryLine}`.trim(), image: m.image || null };
        })
        .filter(Boolean);
      const safeHist = hist.map((m) => ({ ...m, image: null }));
      const recent = safeHist.map((m) => `${m.role === "user" ? "玩家" : (m.speakerName || "群組")}: ${m.content || "[圖片]"}`).join("\n");
      const sysP = `${nowContext}\n\n${buildGroupChatSystemPrompt(currentChatGroup, memberNames, memberProfiles, recent)}`;
      const reply = await callAI(safeHist, apiConfig, sysP);
      const parsedReplies = parseGroupReplies(stripInternalBlocks(reply));
      const speakerMap = new Map(members.map((m) => [m.name, m]));
      const usableReplies = [];
      const seenSpeakers = new Set();
      for (const item of parsedReplies) {
        const matched = speakerMap.get(item.speaker) || members.find((m) => m.name === item.speaker);
        const resolvedName = matched?.name || item.speaker;
        if (!resolvedName || !item.content || seenSpeakers.has(resolvedName)) continue;
        seenSpeakers.add(resolvedName);
        usableReplies.push({
          speakerName: resolvedName,
          speakerAvatar: sanitizeUserImageUrl(matched?.avatar || ""),
          content: item.content,
        });
      }
      if (!usableReplies.length) {
        const fallbackSpeaker = members[0];
        const fallbackContent = sanitizeText(stripInternalBlocks(reply), 4000).trim();
        if (fallbackSpeaker && fallbackContent) {
          usableReplies.push({
            speakerName: fallbackSpeaker.name,
            speakerAvatar: sanitizeUserImageUrl(fallbackSpeaker.avatar || ""),
            content: fallbackContent,
          });
        }
      }
      if (usableReplies.length) {
        let workingMessages = [...nextMessages];
        for (let i = 0; i < usableReplies.length; i += 1) {
          const item = usableReplies[i];
          if (i > 0) {
            const prevLen = usableReplies[i - 1]?.content?.length || 0;
            const lengthFactor = Math.max(0, Math.min(1, prevLen / 220));
            const wait = Math.round(220 + (lengthFactor * 520));
            await new Promise((resolve) => setTimeout(resolve, wait));
          }
          const msg = {
            id: gid(),
            role: "assistant",
            content: item.content,
            time: Date.now(),
            speakerName: item.speakerName,
            speakerAvatar: item.speakerAvatar,
          };
          workingMessages = [...workingMessages, msg];
          setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: workingMessages, updatedAt: Date.now() } : g));
        }
      }
    } catch (err) {
      const notice = { id: gid(), role: "system_notice", content: `${getConnectionErrorPrefix()}${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 500)}`, time: Date.now() };
      setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: [...nextMessages, notice], updatedAt: Date.now() } : g));
    }
    setIsTyping(false);
  };
  const renderGroupMemberGrid = (selectedIds, setSelectedIds, search, setSearch) => (
    <>
      <input
        className="mp-sinp"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={tr("搜尋角色名稱", "Search characters", "キャラを検索", "캐릭터 검색")}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>
        <span>{tr("最多 5 位角色", "Up to 5 characters", "最大5人まで", "최대 5명")}</span>
        <span>{tr("已選", "Selected", "選択", "선택")} {selectedIds.length}/5</span>
      </div>
      <div style={{ marginTop: 6, maxHeight: 300, overflowY: "auto", paddingRight: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4 }}>
          {sortChatThreads(characters)
            .filter((c) => c.name?.includes(search.trim()) || !search.trim())
            .map((c) => {
              const selected = selectedIds.includes(c.id);
              const disabled = !selected && selectedIds.length >= 5;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="mp-group-pick"
                  style={{
                    minHeight: 94,
                    border: "none",
                    boxShadow: "none",
                    opacity: disabled ? 0.45 : (selected ? 1 : 0.5),
                    background: "transparent",
                  }}
                  onClick={() => {
                    if (selected) {
                      setSelectedIds((prev) => prev.filter((id) => id !== c.id));
                      return;
                    }
                    if (selectedIds.length >= 5) {
                      showToast(tr("最多只能加入 5 位角色", "You can add up to 5 characters", "追加できるのは最大5人です", "최대 5명까지만 추가할 수 있습니다"));
                      return;
                    }
                    setSelectedIds((prev) => [...prev, c.id]);
                  }}
                >
                  <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 14, overflow: "hidden", background: "transparent", display: "flex", alignItems: "end", justifyContent: "start" }}>
                    {sanitizeUserImageUrl(c.avatar) ? (
                      <img src={sanitizeUserImageUrl(c.avatar)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#fce4ec,#e1f5fe)", color: "#5c6f7b", fontSize: 24, fontWeight: 800 }}>
                        {c.name?.[0] || "🙂"}
                      </div>
                    )}
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 5px 6px", background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.48) 100%)", color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.05, boxSizing: "border-box" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    </div>
                    {selected && <div style={{ position: "absolute", top: 4, right: 4, width: 16, height: 16, borderRadius: 999, background: "rgba(184,122,65,.95)", color: "#fff", display: "grid", placeItems: "center", fontSize: 10, boxShadow: "0 4px 10px rgba(0,0,0,.18)" }}>✓</div>}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </>
  );
  const renderChat = () => {
    if (currentChatGroup) {
      const msgs = currentChatGroup.messages || [];
      const visibleMsgs = msgs;
      const members = getGroupMembers(currentChatGroup);
      const providerShortMap = {
        openai: "GPT",
        deepseek: "DS",
        claude: "Claude",
        gemini: "Gemini",
        vertex: "Vertex",
        grok: "Grok",
        openrouter: "OR",
      };
      const providerFullMap = {
        openai: "OpenAI",
        deepseek: "DeepSeek",
        claude: "Claude",
        gemini: "Gemini API",
        vertex: "Vertex AI (快速模式)",
        grok: "Grok",
        openrouter: "OpenRouter",
      };
      const modelShort = providerShortMap[apiConfig?.provider || "openai"] || "AI";
      const providerKey = apiConfig?.provider || "openai";
      const modelFull = `${providerFullMap[providerKey] || providerKey} · ${apiConfig?.model || "-"}`;
      return (
        <div className="mp-page" onClick={() => setModelBadgeOpen(false)} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="mp-hdr">
            <div className="mp-back" onClick={() => setCurrentChatGroup(null)}>←</div>
            <button
              type="button"
              className={`mp-chat-pin ${currentChatGroup?.pinned ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, pinned: !g.pinned } : g));
              }}
              title={currentChatGroup?.pinned ? tr("取消釘選", "Unpin", "固定を解除", "고정 해제") : tr("釘選聊天室", "Pin chatroom", "チャットルームを固定", "채팅방 고정")}
            >
              {currentChatGroup?.pinned ? "♥" : "♡"}
            </button>
            <div className="mp-htitle" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentChatGroup.name}</div>
            <button
              type="button"
              className="mp-ibtn"
              style={{ marginLeft: "auto" }}
              title={modelFull}
              onClick={(e) => {
                e.stopPropagation();
                setModelBadgeOpen((v) => !v);
              }}
            >
              {modelShort}
            </button>
            <button className="mp-ibtn" onClick={() => openEditGroup(currentChatGroup)}>{tr("設定", "Settings", "設定", "설정")}</button>
          </div>
          {modelBadgeOpen && (
            <div
              style={{ position: "absolute", top: 56, right: 74, zIndex: 40, background: "#fff", border: "1px solid rgba(244,143,177,.35)", borderRadius: 12, padding: "8px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxWidth: 220 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#666", marginBottom: 2 }}>{tr("目前模型", "Current model", "現在のモデル", "현재 모델")}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{modelFull}</div>
            </div>
          )}
          <div className="mp-cm" style={{ paddingTop: 8, paddingLeft: 0, paddingRight: 0, paddingBottom: 0, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div style={{ margin: "0 14px 8px", fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.5, textAlign: "center" }}>
              {tr("群組成員：", "Group members: ", "グループメンバー: ", "그룹 멤버: ")}{members.length ? members.map((m) => m.name).join("、") : tr("暫無成員", "No members yet", "まだメンバーがいません", "아직 멤버가 없습니다")}
            </div>
            {renderSceneBar("group", currentChatGroup.id, tr("場景", "Scene", "シーン", "장면"))}
            <div className="mp-cr" style={{ flex: 1, minHeight: 0 }}>
              <div className="mp-msgs" ref={chatMsgsRef} style={{ flex: 1, minHeight: 0, paddingBottom: 12 }} onScroll={(e) => updateScrollToBottomVisibility(e.currentTarget)}>
                {visibleMsgs.map((m) => (
                  m.role === "system_notice" ? (
                    <div key={m.id} className="mp-msg-note-wrap">
                      <div className="mp-msg-note">
                        <div>{m.content}</div>
                        {isConnectionErrorNotice(m.content) && (
                          <button className="mp-retry-btn" disabled={isTyping} onClick={(e) => { e.stopPropagation(); retryGroupFromNotice(m.id); }}>
                            {tr("重新生成", "Regenerate", "再生成", "다시 생성")}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                  <div key={m.id} className={`mp-msg-wrap ${m.role === "user" ? "mp-msg-wrap-user mp-group-msg-wrap-user" : "mp-msg-wrap-ai mp-group-msg-wrap-ai"}`}>
                    <div className="mp-group-msg-meta">
                      <div className="mp-group-msg-avatar">
                        {m.role === "user"
                          ? (getPlayerAvatar() ? <img src={getPlayerAvatar()} alt="" /> : null)
                          : (m.speakerAvatar ? <img src={m.speakerAvatar} alt="" /> : "👥")}
                      </div>
                      {m.role !== "user" && <div className="mp-group-msg-name">{m.speakerName || tr("群組", "Group", "グループ", "그룹")}</div>}
                    </div>
                    <div
                      className={`mp-msg ${m.role === "user" ? "mp-msg-user" : "mp-msg-ai"}`}
                      onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}
                    >
                      {m.image && <img src={`data:image/png;base64,${m.image}`} className="mp-msg-img" alt="" />}
                      {m.content && <div>{m.content}</div>}
                      <div className="mp-msg-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button
                        className={`mp-msg-editbtn ${activeMessageId === m.id ? "" : "mp-msg-editbtn-hidden"}`}
                        onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: "online" })}
                      >
                        ✎
                      </button>
                      <button
                        className={`mp-msg-editbtn ${activeMessageId === m.id ? "" : "mp-msg-editbtn-hidden"}`}
                        onClick={() => {
                          if (!window.confirm(tr("確定要刪除這則對話嗎？", "Delete this message?", "このメッセージを削除しますか？", "이 메시지를 삭제할까요?"))) return;
                          if (currentChatGroup) {
                            const next = (currentChatGroup.messages || []).filter((x) => x.id !== m.id);
                            setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: next, updatedAt: Date.now() } : g));
                          }
                          setActiveMessageId(null);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  )
                ))}
                {visibleMsgs.length === 0 && <div style={{fontSize:11,color:"var(--mp-txt-l)",textAlign:"center",padding:"18px 0"}}>{tr("目前沒有群組訊息", "No group messages yet", "グループメッセージはまだありません", "아직 그룹 메시지가 없습니다")}</div>}
                {isTyping && <div className="mp-typing"><span /><span /><span /></div>}
                <div ref={messagesEndRef} />
              </div>
              {showScrollToBottom && (
                <button
                  type="button"
                  className="mp-scroll-bottom"
                  style={{ bottom: 8 }}
                  aria-label={tr("捲到最新訊息", "Scroll to latest message", "最新メッセージへ移動", "최신 메시지로 이동")}
                  title={tr("捲到最新訊息", "Scroll to latest message", "最新メッセージへ移動", "최신 메시지로 이동")}
                  onClick={scrollCurrentChatToBottom}
                >
                  <ArrowDown size={23} strokeWidth={2.2} aria-hidden="true" />
                </button>
              )}
            </div>
            {chatImage && (
              <div className="mp-imgprev">
                <img src={`data:${chatImage.mime};base64,${chatImage.data}`} alt="" />
                <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 4 }}>
                  {chatImage.width}x{chatImage.height} · {Math.round(chatImage.bytes / 1024)}KB
                </div>
                <button onClick={() => setChatImage(null)}>×</button>
              </div>
            )}
            {chatActionPanelOpen && (
              <div className="mp-chat-actions">
                <button className="mp-chat-action" onClick={() => { setChatActionPanelOpen(false); fileInputRef.current?.click(); }}>
                  <span className="mp-chat-action-i">🖼</span>
                  <span>{tr("相片", "Photo", "写真", "사진")}</span>
                </button>
                <button className="mp-chat-action" disabled>
                  <span className="mp-chat-action-i">📅</span>
                  <span>{tr("日程", "Schedule", "予定", "일정")}</span>
                </button>
                <button className="mp-chat-action" disabled>
                  <span className="mp-chat-action-i">⚙️</span>
                  <span>{tr("更多", "More", "その他", "더보기")}</span>
                </button>
              </div>
            )}
            <div className="mp-inp-bar" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
              <button className={`mp-btn mp-btn-img ${chatActionPanelOpen ? "active" : ""}`} onClick={()=>setChatActionPanelOpen((v) => !v)}>＋</button>
              <input type="file" ref={fileInputRef} accept="image/*" style={{display:"none"}} onChange={handleImgUp} />
              <div className="mp-inp-wrap">
                <textarea
                  className="mp-inp"
                  placeholder={tr("輸入群組訊息...", "Type a group message...", "グループメッセージを入力...", "그룹 메시지를 입력...")}
                  rows={1}
                  maxLength={4000}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  value={chatInput}
                  onChange={e=>setChatInput(e.target.value.slice(0, 4000))}
                />
                <div className="mp-char-counter">{chatInput.length}/4000</div>
              </div>
              <button className="mp-btn mp-btn-send" onClick={sendGroupMessage}>➤</button>
            </div>
          </div>
        </div>
      );
    }
    if (!currentChatChar) {
      return (
        <div className="mp-page" onClick={() => setModelBadgeOpen(false)}>
          <div className="mp-hdr">
            <div className="mp-back" onClick={closeApp}>←</div>
            <div className="mp-htitle">{t("chat")}</div>
            {chatListTab === "groups" && (
              <button
                type="button"
                className="mp-ibtn"
                style={{ marginLeft: "auto", padding: "4px 10px", background: "linear-gradient(135deg,#f9e6ee,#fff6fb)" }}
                onClick={openCreateGroup}
                title="Add group"
              >
                ＋
              </button>
            )}
          </div>
          <div className="mp-cm" style={{ paddingTop: 2 }}>
            <div className="mp-chat-switch">
              <button
                className={`mp-chat-switch-btn ${chatListTab === "friends" ? "active" : ""}`}
                onClick={() => setChatListTab("friends")}
              >
              <span>{tr("好友", "Friends", "フレンド", "친구")}</span>
              </button>
              <button
                className={`mp-chat-switch-btn ${chatListTab === "groups" ? "active" : ""}`}
                onClick={() => setChatListTab("groups")}
              >
                <span>{t("chatroom")}</span>
              </button>
            </div>
            {chatListTab === "friends" ? (
              characters.length === 0 ? (
                <div className="mp-empty mp-chat-empty">
                  <div className="mp-empty-i">💬</div>
                  <div className="mp-empty-t">No friend chats yet</div>
                </div>
              ) : (
                <div className="mp-chat-list mp-chat-list-line">
                  {sortChatThreads(characters).map((c) => {
                    const ms = chatHistory[c.id] || [];
                    const lm = ms[ms.length - 1];
                    const isPinned = !!c.pinned || !!c.chatPinned;
                    const unreadCount = Number(proactiveUnread?.[c.id]) || 0;
                    const isUnread = unreadCount > 0;
                    return (
                      <button key={c.id} className={`mp-chat-row ${isPinned ? "pinned" : ""}`} onClick={() => {
                        if (Date.now() <= suppressAppClickUntilRef.current) return;
                        if (isUnread) setProactiveUnread((prev) => { const n = { ...prev }; delete n[c.id]; return n; });
                        setCurrentChatChar(c);
                      }}>
                        <div className="mp-chat-row-avatar">
                          {sanitizeUserImageUrl(c.avatar) ? <img src={sanitizeUserImageUrl(c.avatar)} alt="" /> : (c.name?.[0] || "🙂")}
                        </div>
                        <div className="mp-chat-row-body">
                          <div className="mp-chat-row-top">
                            <div className="mp-chat-row-name">
                              {isPinned && <span className="mp-chat-row-pin">♥</span>}
                              <span>{c.name}</span>
                            </div>
                            <div className="mp-chat-row-time">{lm?.time ? new Date(lm.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                          </div>
                          <div className="mp-chat-row-bottom">
                            <div className="mp-chat-row-preview" style={isUnread ? { fontWeight: 700, color: "var(--mp-txt)" } : undefined}>{lm?.content || t("noMessagesShort")}</div>
                            {isUnread && <span className="mp-chat-row-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="mp-chat-list mp-chat-list-line">
                {sortGroupChats(groupChats).map((g) => {
                  const msgs = g.messages || [];
                  const lm = msgs[msgs.length - 1];
                  const isPinned = !!g.pinned;
                  const members = getGroupMembers(g);
                  return (
                    <button key={g.id} className={`mp-chat-row ${isPinned ? "pinned" : ""}`} onClick={() => Date.now() > suppressAppClickUntilRef.current && setCurrentChatGroup(g)}>
                      <div className="mp-chat-row-avatar">
                        {sanitizeUserImageUrl(g.cover)
                          ? <img src={sanitizeUserImageUrl(g.cover)} alt="" />
                          : (members[0]?.avatar && sanitizeUserImageUrl(members[0].avatar)
                            ? <img src={sanitizeUserImageUrl(members[0].avatar)} alt="" />
                            : "👥")}
                      </div>
                      <div className="mp-chat-row-body">
                        <div className="mp-chat-row-top">
                          <div className="mp-chat-row-name">
                            {isPinned && <span className="mp-chat-row-pin">♥</span>}
                            <span>{g.name}</span>
                          </div>
                          <div className="mp-chat-row-time">{lm?.time ? new Date(lm.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                        </div>
                        <div className="mp-chat-row-preview">{lm?.content || `${members.length || characters.length} ${tr("位成員", "members", "人のメンバー", "명의 멤버")}`}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }
    if (currentChatChar) {
      const msgs = chatHistory[currentChatChar.id] || [];
      const visibleCount = Math.max(50, chatVisibleCounts[currentChatChar.id] || 50);
      const visibleMsgs = msgs.slice(Math.max(0, msgs.length - visibleCount));
      const innerThoughtAnchorIds = new Set();
      msgs.forEach((message, index) => {
        if (message?.role !== "assistant") return;
        if (message.replyGroupId) {
          if (message.replyGroupIndex === message.replyGroupSize - 1) innerThoughtAnchorIds.add(message.id);
          return;
        }
        if (msgs[index + 1]?.role !== "assistant") innerThoughtAnchorIds.add(message.id);
      });
      const latestInnerThoughtAnchorId = [...msgs].reverse().find((message) => message?.role === "assistant")?.id || null;
      const canRenderInnerThought = (message) => (
        innerThoughtAnchorIds.has(message.id) && (
          !!message.innerThought?.content ||
          (!isTyping && message.id === latestInnerThoughtAnchorId)
        )
      );
      const thoughtRecords = msgs
        .filter((message) => message?.role === "assistant" && message.innerThought?.content)
        .slice()
        .sort((a, b) => (b.innerThought.generatedAt || b.time || 0) - (a.innerThought.generatedAt || a.time || 0));
      const thoughtPageSize = 5;
      const thoughtPageCount = Math.max(1, Math.ceil(thoughtRecords.length / thoughtPageSize));
      const activeThoughtPage = Math.min(thoughtHistoryPage, thoughtPageCount - 1);
      const visibleThoughtRecords = thoughtRecords.slice(activeThoughtPage * thoughtPageSize, (activeThoughtPage + 1) * thoughtPageSize);
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
      const providerShortMap = {
        openai: "GPT",
        deepseek: "DS",
        claude: "Claude",
        gemini: "Gemini",
        vertex: "Vertex",
        grok: "Grok",
        openrouter: "OR",
      };
      const providerFullMap = {
        openai: "OpenAI",
        deepseek: "DeepSeek",
        claude: "Claude",
        gemini: "Gemini API",
        vertex: "Vertex AI (快速模式)",
        grok: "Grok",
        openrouter: "OpenRouter",
      };
      const providerKey = apiConfig?.provider || "openai";
      const modelShort = providerShortMap[providerKey] || "AI";
      const modelFull = `${providerFullMap[providerKey] || providerKey} · ${apiConfig?.model || "-"}`;
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
      return (
        <div className="mp-page" onClick={() => setModelBadgeOpen(false)}>
          <div className="mp-hdr">
            <div className="mp-back" onClick={() => {
              if (chatSettingsOpen) {
                setChatSettingsOpen(false);
                return;
              }
              setCurrentChatChar(null);
            }}>←</div>
            <button
              type="button"
              className={`mp-chat-pin ${currentChatChar?.pinned ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleChatPin(currentChatChar.id);
              }}
              title={currentChatChar?.pinned ? tr("取消釘選", "Unpin", "固定を解除", "고정 해제") : tr("釘選聊天室", "Pin chatroom", "チャットルームを固定", "채팅방 고정")}
            >
              {currentChatChar?.pinned ? "♥" : "♡"}
            </button>
            <div className="mp-htitle" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentChatChar.name}</div>
            <button
              type="button"
              className="mp-ibtn"
              style={{ marginLeft: "auto" }}
              title={modelFull}
              onClick={(e) => {
                e.stopPropagation();
                setModelBadgeOpen((v) => !v);
              }}
            >
              {modelShort}
            </button>
            <button className="mp-ibtn" onClick={() => { setChatSettingsExpandedBooks({}); setChatSettingsBackgroundOpen(false); setChatSettingsLorebookOpen(false); setChatSettingsThoughtsOpen(false); setThoughtHistoryPage(0); setChatroomManageOpen(false); setChatBgEditor(null); setChatSettingsOpen(true); }}>{tr("設定", "Settings", "設定", "설정")}</button>
          </div>
          {modelBadgeOpen && (
            <div
              style={{ position: "absolute", top: 56, right: 74, zIndex: 40, background: "#fff", border: "1px solid rgba(244,143,177,.35)", borderRadius: 12, padding: "8px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxWidth: 220 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#666", marginBottom: 2 }}>{tr("目前模型", "Current model", "現在のモデル", "현재 모델")}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{modelFull}</div>
            </div>
          )}
          {chatSettingsOpen ? (
            <div className="mp-cm" style={{ paddingTop: 8 }}>
              <div className="mp-cc" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("聊天室設定", "Chat settings", "チャット設定", "채팅 설정")}</div>
              </div>
              <div className="mp-cc">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("互動模式", "Interaction mode", "インタラクションモード", "상호작용 모드")}</div>
                  {hasPendingMode && <div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>{tr("下次送出後切換", "Switch after next send", "次の送信後に切り替え", "다음 전송 후 전환")}</div>}
                </div>
                <div className="mp-mode-tabs">
                  <button className={`mp-mode-tab ${selectedMode === "online" ? "active" : ""}`} onClick={() => setSelectedChatMode(currentChatChar.id, "online")}>{tr("線上聊天", "Online chat", "オンラインチャット", "온라인 채팅")}</button>
                  <button className={`mp-mode-tab ${selectedMode === "reality" ? "active" : ""}`} onClick={() => setSelectedChatMode(currentChatChar.id, "reality")}>{tr("現實模式", "Reality mode", "現実モード", "현실 모드")}</button>
                </div>
                <div className="mp-mode-hint">
                  {selectedMode === "reality"
                    ? tr("現實模式會以段落形式呈現，可包含敘述、動作、內心想法與對話。", "Reality mode uses full-width paragraphs and supports narration, actions, inner thoughts, and dialogue.", "現実モードは段落形式で、地の文、動作、内心、会話を含められます。", "현실 모드는 문단 형식으로 묘사, 행동, 내면, 대화를 포함할 수 있습니다.")
                    : tr("線上聊天會維持手機訊息風格與短訊節奏。", "Online chat keeps the phone-bubble style and short-message pace.", "オンラインチャットはスマホの吹き出し形式と短文ペースを維持します。", "온라인 채팅은 휴대폰 말풍선 스타일과 짧은 메시지 템포를 유지합니다.")}
                </div>
              </div>
              <div className="mp-cc">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("自動心聲", "Automatic inner thoughts", "心の声の自動生成", "속마음 자동 생성")}</div>
                    <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 3, lineHeight: 1.5 }}>
                      {tr("偶爾在角色回覆後產生；關閉後仍可手動窺探。", "Occasionally appears after replies. Manual peeking remains available when off.", "返信後に時々生成されます。オフでも手動で確認できます。", "답장 후 가끔 생성됩니다. 꺼도 수동으로 볼 수 있습니다.")}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isInnerThoughtAutoEnabled(currentChatChar.id)}
                    className={`mp-switch ${isInnerThoughtAutoEnabled(currentChatChar.id) ? "active" : ""}`}
                    onClick={() => setInnerThoughtAutoEnabled(currentChatChar.id, !isInnerThoughtAutoEnabled(currentChatChar.id))}
                  >
                    <span />
                  </button>
                </div>
                <div className="mp-thought-history-divider" />
                <button
                  type="button"
                  className="mp-thought-history-toggle"
                  onClick={() => setChatSettingsThoughtsOpen((open) => !open)}
                >
                  <span>{tr("心聲紀錄", "Inner thought history", "心の声の履歴", "속마음 기록")} · {thoughtRecords.length}</span>
                  <span>{chatSettingsThoughtsOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
                </button>
                {chatSettingsThoughtsOpen && (
                  <div className="mp-thought-history">
                    {visibleThoughtRecords.length ? visibleThoughtRecords.map((message) => (
                      <button
                        key={message.id}
                        type="button"
                        className="mp-thought-record"
                        onClick={() => jumpToThoughtMessage(message.id)}
                      >
                        <div className="mp-thought-record-meta">
                          <Eye size={12} strokeWidth={2} aria-hidden="true" />
                          <span>{new Date(message.innerThought.generatedAt || message.time).toLocaleString(uiLanguage, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="mp-thought-record-content">{message.innerThought.content}</div>
                        <div className="mp-thought-record-preview">{tr("原回覆", "Reply", "元の返信", "원래 답장")}：{sanitizeText(message.content || "", 46)}</div>
                      </button>
                    )) : (
                      <div className="mp-thought-history-empty">{tr("還沒有留下任何心聲", "No inner thoughts yet", "心の声はまだありません", "아직 남겨진 속마음이 없습니다")}</div>
                    )}
                    {thoughtRecords.length > thoughtPageSize && (
                      <div className="mp-thought-history-pages">
                        <button
                          type="button"
                          aria-label={tr("上一頁", "Previous page", "前のページ", "이전 페이지")}
                          disabled={activeThoughtPage === 0}
                          onClick={() => setThoughtHistoryPage((page) => Math.max(0, page - 1))}
                        >
                          <ChevronLeft size={15} aria-hidden="true" />
                        </button>
                        <span>{activeThoughtPage + 1} / {thoughtPageCount}</span>
                        <button
                          type="button"
                          aria-label={tr("下一頁", "Next page", "次のページ", "다음 페이지")}
                          disabled={activeThoughtPage >= thoughtPageCount - 1}
                          onClick={() => setThoughtHistoryPage((page) => Math.min(thoughtPageCount - 1, page + 1))}
                        >
                          <ChevronRight size={15} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mp-cc">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("主動傳訊息", "Proactive messages", "自発的なメッセージ", "먼저 보내는 메시지")}</div>
                    <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 3, lineHeight: 1.5 }}>
                      {tr("離開一段時間再回來時，角色有機會主動傳訊息給你。", "When you're away and come back, the character may occasionally message you first.", "しばらく離れてから戻ると、キャラが時々先にメッセージを送ることがあります。", "자리를 비웠다 돌아오면 캐릭터가 가끔 먼저 메시지를 보낼 수 있습니다.")}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isProactiveEnabled(currentChatChar.id)}
                    className={`mp-switch ${isProactiveEnabled(currentChatChar.id) ? "active" : ""}`}
                    onClick={() => setProactiveEnabled(currentChatChar.id, !isProactiveEnabled(currentChatChar.id))}
                  >
                    <span />
                  </button>
                </div>
                {isProactiveEnabled(currentChatChar.id) && (
                  <div className="mp-mode-tabs" style={{ marginTop: 10, gridTemplateColumns: "repeat(3,1fr)" }}>
                    <button className={`mp-mode-tab ${getProactiveFrequency(currentChatChar.id) === "low" ? "active" : ""}`} onClick={() => setProactiveFrequency(currentChatChar.id, "low")}>{tr("低頻率", "Low", "低頻度", "낮음")}</button>
                    <button className={`mp-mode-tab ${getProactiveFrequency(currentChatChar.id) === "normal" ? "active" : ""}`} onClick={() => setProactiveFrequency(currentChatChar.id, "normal")}>{tr("一般", "Normal", "普通", "보통")}</button>
                    <button className={`mp-mode-tab ${getProactiveFrequency(currentChatChar.id) === "high" ? "active" : ""}`} onClick={() => setProactiveFrequency(currentChatChar.id, "high")}>{tr("高頻率", "High", "高頻度", "높음")}</button>
                  </div>
                )}
              </div>
              <div className="mp-cc">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => {
                    setChatSettingsBackgroundOpen((v) => {
                      const next = !v;
                      if (!next) setChatBgEditor(null);
                      return next;
                    });
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("聊天室背景", "Chat background", "チャット背景", "채팅 배경")}</div>
                  <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>
                    {chatSettingsBackgroundOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")} · {normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {}).src ? tr("已設定", "Set", "設定済み", "설정됨") : tr("未設定", "Not set", "未設定", "미설정")}
                  </div>
                </div>
                {chatSettingsBackgroundOpen && (<>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div
                    style={{
                      width: 72,
                      height: 112,
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid rgba(231,197,214,.8)",
                      background: "linear-gradient(135deg,#fff,#f7eef6)",
                      boxShadow: "0 2px 8px rgba(0,0,0,.04)",
                      position: "relative",
                    }}
                  >
                    {normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {}).src && (
                      <div
                        style={{
                          ...getChatBackgroundLayerStyle(chatBackgrounds?.[currentChatChar.id] || {}),
                          filter: getChatBackgroundBlurFilter(chatBackgrounds?.[currentChatChar.id] || {}),
                        }}
                      />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    id={`chat-bg-${currentChatChar.id}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onChatBackgroundFile(currentChatChar.id, file);
                      e.target.value = "";
                    }}
                  />
                  <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => document.getElementById(`chat-bg-${currentChatChar.id}`)?.click()}>
                    {tr("上傳", "Upload", "アップロード", "업로드")}
                  </button>
                  <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => {
                    const current = normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {});
                    setChatBgEditor({
                      charId: currentChatChar.id,
                      ...current,
                      dragging: false,
                      dragStartX: 0,
                      dragStartY: 0,
                      startX: 0,
                      startY: 0,
                    });
                  }}>
                    {tr("調整", "Adjust", "調整", "조정")}
                  </button>
                  <button className="mp-ibtn-r" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => { updateChatBackground(currentChatChar.id, ""); setChatBgEditor(null); }}>
                    {tr("清除", "Clear", "クリア", "지우기")}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>
                  {tr("未設定時會維持原本底色。", "If not set, the default background color stays.", "未設定の場合は既定の背景色のままです。", "미설정 시 기본 배경색을 유지합니다.")}
                </div>
                {chatBgEditor?.charId === currentChatChar.id && chatBgEditor.src && (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(255,255,255,.72)", border: "1px solid rgba(231,197,214,.55)" }}>
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "9 / 16",
                        maxHeight: 360,
                        borderRadius: 14,
                        overflow: "hidden",
                        position: "relative",
                        background: "#f8f1f6",
                        touchAction: "none",
                        border: "1px solid rgba(231,197,214,.6)",
                        marginBottom: 10,
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.45)",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
                        setChatBgEditor((s) => s ? { ...s, dragging: true, dragStartX: e.clientX || 0, dragStartY: e.clientY || 0, startX: s.x || 0, startY: s.y || 0 } : s);
                      }}
                      onPointerMove={(e) => {
                        if (!chatBgEditor?.dragging) return;
                        e.preventDefault();
                        const dx = ((e.clientX || 0) - (chatBgEditor.dragStartX || 0)) / 2;
                        const dy = ((e.clientY || 0) - (chatBgEditor.dragStartY || 0)) / 2;
                        setChatBgEditor((s) => s ? { ...s, x: Math.max(-50, Math.min(50, (s.startX || 0) - dx)), y: Math.max(-50, Math.min(50, (s.startY || 0) - dy)) } : s);
                      }}
                      onPointerUp={(e) => {
                        try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
                        setChatBgEditor((s) => s ? { ...s, dragging: false } : s);
                      }}
                      onPointerCancel={(e) => {
                        try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
                        setChatBgEditor((s) => s ? { ...s, dragging: false } : s);
                      }}
                      >
                        <div
                          style={{
                            ...getChatBackgroundLayerStyle(chatBgEditor),
                            filter: getChatBackgroundBlurFilter(chatBgEditor),
                          }}
                        />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundImage: "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)",
                          backgroundSize: "24px 24px",
                          backgroundPosition: "center center",
                          mixBlendMode: "soft-light",
                          opacity: .55,
                          pointerEvents: "none",
                        }}
                      />
                      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, transform: "translateX(-50%)", background: "rgba(255,255,255,.58)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, transform: "translateY(-50%)", background: "rgba(255,255,255,.58)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", left: "50%", top: "50%", width: 12, height: 12, transform: "translate(-50%, -50%)", borderRadius: 999, border: "2px solid rgba(255,255,255,.92)", boxShadow: "0 0 0 2px rgba(244,143,177,.22)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.08)" }} />
                      <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,.88)", borderRadius: 14, boxShadow: "0 0 0 9999px rgba(255,255,255,.10)", pointerEvents: "none" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{tr("縮放", "Zoom", "ズーム", "확대")}</span>
                      <input
                        type="range"
                        min="1"
                        max="2.2"
                        step="0.01"
                        value={chatBgEditor.zoom || 1}
                        onChange={(e) => setChatBgEditor((s) => s ? { ...s, zoom: Number(e.target.value) } : s)}
                        style={{ flex: 1 }}
                      />
                      <button
                        className="mp-ibtn"
                        style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1 }}
                        onClick={() => {
                          const current = normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {});
                          setChatBgEditor({ charId: currentChatChar.id, ...current, dragging: false, dragStartX: 0, dragStartY: 0, startX: 0, startY: 0 });
                        }}
                      >
                        {tr("重置", "Reset", "リセット", "초기화")}
                      </button>
                      <button
                        className="mp-ibtn"
                        style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1 }}
                        onClick={() => setChatBgEditor((s) => s ? { ...s, blur: 0 } : s)}
                      >
                        {tr("無模糊", "No blur", "ぼかしなし", "흐림 없음")}
                      </button>
                      <button
                        className="mp-save"
                        style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1, minWidth: 72 }}
                        onClick={() => {
                          updateChatBackground(currentChatChar.id, {
                            src: chatBgEditor.src,
                            x: chatBgEditor.x,
                            y: chatBgEditor.y,
                            zoom: chatBgEditor.zoom,
                            blur: chatBgEditor.blur,
                          });
                          setChatBgEditor((s) => s ? { ...s, dragging: false } : s);
                        }}
                      >
                        {tr("套用", "Apply", "適用", "적용")}
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{tr("模糊", "Blur", "ぼかし", "흐림")}</span>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        step="1"
                        value={chatBgEditor.blur || 0}
                        onChange={(e) => setChatBgEditor((s) => s ? { ...s, blur: Number(e.target.value) } : s)}
                        style={{ flex: 1 }}
                      />
                      <span style={{ width: 32, textAlign: "right", fontSize: 11, color: "var(--mp-txt-l)" }}>{Math.round(chatBgEditor.blur || 0)}px</span>
                    </div>
                  </div>
                )}
                </>)}
              </div>
              <div className="mp-cc">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setChatSettingsLorebookOpen((v) => !v)}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("世界書綁定", "Lorebook binding", "ワールドブック連携", "월드북 연결")}</div>
                  <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{chatSettingsLorebookOpen ? `${tr("收合", "Collapse", "折りたたむ", "접기")} · ${binding.enabledBookIds.length} ${tr("啟用", "enabled", "有効", "활성화")}` : `${tr("展開", "Expand", "展開", "펼치기")} · ${binding.enabledBookIds.length} ${tr("啟用", "enabled", "有効", "활성화")}`}</div>
                </div>
                {chatSettingsLorebookOpen && (
                  <div style={{ marginTop: 8 }}>
                    {(lorebooks || []).length === 0 && <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{tr("尚無世界書", "No lorebooks yet", "まだ世界観がありません", "아직 월드북이 없습니다")}</div>}
                    {(lorebooks || []).map((book) => {
                      const bookOn = binding.enabledBookIds.includes(book.id);
                      const isExpanded = !!chatSettingsExpandedBooks[book.id];
                      return (
                        <div key={book.id} style={{ marginBottom: 10, border: "1px solid rgba(244,143,177,.2)", borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, padding: "10px 10px 8px", background: "rgba(244,143,177,.08)" }}>
                            <input type="checkbox" checked={bookOn} onChange={() => toggleChatLorebookBook(currentChatChar.id, book.id)} />
                            <span style={{ flex: 1 }}>{book.name || tr("未命名世界書", "Untitled lorebook", "無題の世界観", "이름 없는 월드북")}</span>
                            <span style={{ fontSize: 10, color: "var(--mp-txt-l)", fontWeight: 600 }}>{(book.entries || []).length} {tr("條目", "entries", "項目", "항목")}</span>
                            <button
                              className="mp-ibtn"
                              style={{ padding: "2px 8px", fontSize: 10 }}
                              onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setChatSettingsExpandedBooks((prev) => ({ ...prev, [book.id]: !isExpanded })); }}
                            >
                              {isExpanded ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}
                            </button>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: "8px 10px 10px", background: "#fff" }}>
                              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                                <button className="mp-ibtn" style={{ fontSize: 10, padding: "2px 8px" }} disabled={!bookOn} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setAllChatLorebookEntries(currentChatChar.id, book, true); }}>Select all</button>
                                <button className="mp-ibtn" style={{ fontSize: 10, padding: "2px 8px" }} disabled={!bookOn} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setAllChatLorebookEntries(currentChatChar.id, book, false); }}>Select none</button>
                                {!bookOn && <span style={{ fontSize: 10, color: "var(--mp-txt-l)", marginLeft: "auto" }}>Enable this lorebook first</span>}
                              </div>
                              <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
                              {(book.entries || []).map((entry) => {
                                const entryOn = Object.prototype.hasOwnProperty.call(binding.entryOverrides, entry.id)
                                  ? !!binding.entryOverrides[entry.id]
                                  : !!entry.enabled;
                                const mode = binding.entryModes?.[entry.id] || "AUTO";
                                const modeColor = mode === "PIN" ? "#1e88e5" : "#43a047";
                                return (
                                  <label key={entry.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--mp-txt-l)", padding: "4px 2px" }}>
                                    <input type="checkbox" checked={entryOn} disabled={!bookOn} onChange={() => toggleChatLorebookEntry(currentChatChar.id, entry.id, !!entry.enabled)} />
                                    <span style={{flex:1}}>{entry.title || "Untitled entry"}</span>
                                    <button
                                      className="mp-ibtn"
                                      disabled={!bookOn}
                                      style={{ fontSize: 10, padding: "1px 8px", borderColor: modeColor, color: modeColor }}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        armAppClickSuppression();
                                        cycleChatLorebookEntryMode(currentChatChar.id, entry.id);
                                      }}
                                      title={tr("AUTO=keyword match, PIN=pinned", "AUTO=keyword match, PIN=pinned", "AUTO=キーワード一致、PIN=固定", "AUTO=키워드 일치, PIN=고정")}
                                    >
                                      {mode}
                                    </button>
                                  </label>
                                );
                              })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mp-cc">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setChatroomManageOpen((v) => !v)}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("聊天室管理", "Chatroom management", "チャットルーム管理", "채팅방 관리")}</div>
                  <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{chatroomManageOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</div>
                </div>
                {chatroomManageOpen && (
                  <>
                    <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.7, marginTop: 8, marginBottom: 8 }}>
                      {tr("可獨立匯出/匯入這個角色的聊天室，或刪除對話重新開始，不會影響角色本體。", "Export/import this character's chatroom separately, or delete the conversation and start over without affecting the character itself.", "このキャラのチャットルームを個別にエクスポート/インポートしたり、会話を削除して最初からやり直せます。キャラ本体には影響しません。", "이 캐릭터의 채팅방을 따로 내보내기/가져오기 하거나 대화를 삭제하고 다시 시작할 수 있으며, 캐릭터 자체에는 영향이 없습니다.")}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <button
                        type="button"
                        className="mp-save"
                        style={{ background: "linear-gradient(135deg,#90caf9,#42a5f5)" }}
                        onClick={() => exportChatroomForCharacter(currentChatChar.id, currentChatChar.name)}
                      >
                        {tr("匯出聊天室", "Export chatroom", "チャットルームを書き出す", "채팅방 내보내기")}
                      </button>
                      <button
                        type="button"
                        className="mp-save"
                        style={{ background: "linear-gradient(135deg,#b0bec5,#78909c)" }}
                        onClick={() => openChatroomImport(currentChatChar.id)}
                      >
                        {chatroomImporting ? tr("等待選擇檔案...", "Waiting for file selection...", "ファイル選択待ち...", "파일 선택 대기 중...") : tr("匯入聊天室", "Import chatroom", "チャットルームを取り込む", "채팅방 가져오기")}
                      </button>
                      <button
                        type="button"
                        className="mp-save"
                        style={{ background: "linear-gradient(135deg,#ef9a9a,#e53935)" }}
                        onClick={() => deleteChatroomForCharacter(currentChatChar.id, currentChatChar.name)}
                      >
                        {tr("刪除聊天室", "Delete chatroom", "チャットルームを削除", "채팅방 삭제")}
                      </button>
                      <input ref={chatroomImportRef} type="file" accept=".json,application/json" style={{display:"none"}} onChange={importChatroomFile} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={`mp-cr mp-chat-mode-${selectedMode}`} style={chatCrStyle}>
            {chatBgUrl && (
              <>
                <div
                  style={{
                    ...getChatBackgroundLayerStyle(chatBg, 1.08),
                    filter: getChatBackgroundBlurFilter(chatBg),
                    zIndex: 0,
                  }}
                />
                <div style={{ position: "absolute", inset: 0, background: isNightTheme ? "rgba(18,12,28,.46)" : "rgba(255,255,255,.52)", pointerEvents: "none", zIndex: 0 }} />
              </>
            )}
            <div style={{position:"relative",zIndex:1}}>
              {renderSceneBar("char", currentChatChar.id, tr("場景", "Scene", "シーン", "장면"))}
            </div>
            <div
              className="mp-msgs"
              ref={chatMsgsRef}
              style={{ position: "relative", zIndex: 1 }}
              onScroll={(e) => {
                const el = e.currentTarget;
                updateScrollToBottomVisibility(el);
                if (el.scrollTop > 0) return;
                if (visibleCount >= msgs.length) return;
                const nextCount = Math.min(msgs.length, visibleCount + 50);
                chatLoadAdjustRef.current = {
                  charId: currentChatChar.id,
                  prevScrollHeight: el.scrollHeight,
                  prevScrollTop: el.scrollTop,
                };
                setChatVisibleCounts((prev) => ({ ...prev, [currentChatChar.id]: nextCount }));
              }}
            >
              {visibleCount < msgs.length && (
                <div style={{display:"flex",justifyContent:"center",padding:"6px 0 10px"}}>
                  <button
                    type="button"
                    className="mp-ibtn"
                    style={{fontSize:11,padding:"4px 10px"}}
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      const el = chatMsgsRef.current;
                      if (!el) return;
                      const nextCount = Math.min(msgs.length, visibleCount + 50);
                      chatLoadAdjustRef.current = {
                        charId: currentChatChar.id,
                        prevScrollHeight: el.scrollHeight,
                        prevScrollTop: el.scrollTop,
                      };
                      setChatVisibleCounts((prev) => ({ ...prev, [currentChatChar.id]: nextCount }));
                    }}
                  >
                    Load earlier messages
                  </button>
                </div>
              )}
              {visibleMsgs.map(m => {
                  if (m.role === "mode_transition") {
                    return (
                      <div key={m.id} className="mp-mode-sep">
                        <span>{getModeLabel(m.toMode)}</span>
                      </div>
                    );
                  }
                  if (m.role === "system_notice") {
                    const share = parseShareEventNotice(m.content);
                    const isConnectionError = isConnectionErrorNotice(m.content);
                    return (
                      <div key={m.id} className="mp-msg-note-wrap">
                        <div
                          className="mp-msg-note"
                          onPointerDown={() => startNoticeLongPress(m.id)}
                        onPointerUp={cancelNoticeLongPress}
                        onPointerLeave={cancelNoticeLongPress}
                      >
                          {share ? (
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>{tr("社群分享", "Social share", "SNS共有", "소셜 공유")}</div>
                              <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginBottom: 6 }}>
                                {tr("來源：", "Source: ", "出典: ", "출처: ")}{share.meta.source || "-"}
                              </div>
                              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 180, overflowY: "auto", paddingRight: 2 }}>{applyUserPlaceholder(share.body)}</div>
                            </div>
                          ) : (
                            <div>
                              <div>{m.content}</div>
                              {isConnectionError && (
                                <button className="mp-retry-btn" disabled={isTyping} onClick={(e) => { e.stopPropagation(); retryChatFromNotice(m.id); }}>
                                  重新生成
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      {activeMessageId === m.id && (
                        <button className="mp-msg-editbtn" onClick={() => deleteChatMessage(currentChatChar.id, m.id)}>🗑</button>
                      )}
                    </div>
                  );
                }
                const isUser = m.role === "user";
                const isActive = activeMessageId === m.id;
                if (m.role === "transfer") {
                  const fromName = m.fromType === "player" ? tr("你", "You", "あなた", "당신") : (m.fromName || tr("對方", "The other party", "相手", "상대방"));
                  const toName = m.toType === "player" ? tr("你", "You", "あなた", "당신") : (m.toName || tr("對方", "The other party", "相手", "상대방"));
                  const heading = m.fromType === "player" ? `${tr("你", "You", "あなた", "당신")} ${tr("轉帳給", "transfer to", "送金先", "송금 대상")} ${toName}` : `${fromName} ${tr("轉帳給", "transfer to", "送金先", "송금 대상")} ${tr("你", "You", "あなた", "당신")}`;
                  const statusText = m.fromType === "player" ? tr("已送出", "Sent", "送信済み", "전송됨") : tr("已收到", "Received", "受信済み", "받음");
                  return (
                    <div key={m.id} className="mp-msg-wrap mp-msg-wrap-transfer">
                      <div
                        className="mp-msg mp-transfer-card"
                        onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}
                      >
                        <div className="mp-transfer-success">
                          <div className="mp-transfer-check">✓</div>
                        <div className="mp-transfer-success-text">{tr("轉帳成功", "Transfer successful", "送金成功", "송금 성공")}</div>
                        </div>
                        <div className="mp-transfer-line">{heading}</div>
                        <div className="mp-transfer-meta">
                          <div className="mp-transfer-row"><span className="mp-transfer-k">{tr("轉帳金額", "Amount", "金額", "금액")}</span><span className="mp-transfer-v">${formatMoney(m.amount || 0)}</span></div>
                          <div className="mp-transfer-row"><span className="mp-transfer-k">{tr("轉帳日期", "Date", "日付", "날짜")}</span><span className="mp-transfer-v">{new Date(m.time).toLocaleDateString("zh-TW")}</span></div>
                        </div>
                        <div className="mp-transfer-note">{m.note ? `${tr("備註", "Note", "メモ", "메모")}：${m.note}` : tr("無備註", "No note", "メモなし", "메모 없음")}</div>
                        <div className="mp-transfer-footer">
                          <span>{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</span>
                          <span className="mp-transfer-status">{statusText}</span>
                        </div>
                      </div>
                      {activeMessageId === m.id && <button className="mp-msg-editbtn" onClick={() => {
                        if (!window.confirm(tr("刪除後不保留這筆交易紀錄，確定嗎？", "This transaction record will be removed. Continue?", "削除するとこの取引記録は残りません。続けますか？", "삭제하면 이 거래 기록은 남지 않습니다. 계속할까요?"))) return;
                        deleteChatMessage(currentChatChar.id, m.id);
                      }}>🗑</button>}
                    </div>
                  );
                }
                const isReality = getMessageMode(m) === "reality";
                const displayContent = stripModeLabel(stripInternalBlocks(m.content));
                if (isReality) {
                  return (
                    <div data-message-id={m.id} key={m.id} className={`mp-reality-wrap ${isUser ? "mp-reality-user" : "mp-reality-ai"} ${highlightedThoughtMessageId === m.id ? "mp-thought-jump-highlight" : ""}`}>
                      {isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                      <div className={`mp-thought-stack ${isUser ? "mp-thought-stack-user" : ""}`}>
                        <div className="mp-reality-msg" onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}>
                          {m.image && <img src={`data:image/png;base64,${m.image}`} className="mp-msg-img" alt="" />}
                          {displayContent && renderRealityText(displayContent)}
                          {isUser && <div className="mp-reality-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>}
                        </div>
                        {!isUser && <div className="mp-reality-footer">
                          <span className="mp-reality-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</span>
                          {isActive && <button className="mp-msg-editbtn" onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                          {renderCharacterVoiceAction(currentChatChar, m, isActive, true)}
                        </div>}
                        {!isUser && canRenderInnerThought(m) && renderInnerThought(currentChatChar, m)}
                      </div>
                    </div>
                  );
                }
                return (
                  <div data-message-id={m.id} key={m.id} className={`mp-msg-wrap ${isUser?"mp-msg-wrap-user":"mp-msg-wrap-ai"} ${highlightedThoughtMessageId === m.id ? "mp-thought-jump-highlight" : ""}`}>
                    {isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                    <div className={`mp-thought-stack ${isUser ? "mp-thought-stack-user" : ""}`}>
                      <div className={`mp-msg ${isUser?"mp-msg-user":"mp-msg-ai"}`} onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}>
                        {m.image && <img src={`data:image/png;base64,${m.image}`} className="mp-msg-img" alt="" />}
                        {displayContent && <div>{displayContent}</div>}
                        <div className="mp-msg-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                      {!isUser && canRenderInnerThought(m) && renderInnerThought(currentChatChar, m)}
                    </div>
                    {!isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                    {!isUser && renderCharacterVoiceAction(currentChatChar, m, isActive)}
                  </div>
                );
              })}
              {isTyping && <div className="mp-typing"><span /><span /><span /></div>}
              <div ref={messagesEndRef} />
            </div>
            {showScrollToBottom && (
              <button
                type="button"
                className="mp-scroll-bottom"
                style={{ bottom: chatActionPanelOpen ? 142 : (chatImage ? 148 : 68) }}
                aria-label={tr("捲到最新訊息", "Scroll to latest message", "最新メッセージへ移動", "최신 메시지로 이동")}
                title={tr("捲到最新訊息", "Scroll to latest message", "最新メッセージへ移動", "최신 메시지로 이동")}
                onClick={scrollCurrentChatToBottom}
              >
                <ArrowDown size={23} strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
            {chatImage && (
              <div className="mp-imgprev">
                <img src={`data:${chatImage.mime};base64,${chatImage.data}`} alt="" />
                <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 4 }}>
                  {chatImage.width}x{chatImage.height} · {Math.round(chatImage.bytes / 1024)}KB
                </div>
                <button onClick={() => setChatImage(null)}>×</button>
              </div>
            )}
            {chatActionPanelOpen && (
              <div className="mp-chat-actions">
                <button className="mp-chat-action" onClick={() => { setChatActionPanelOpen(false); fileInputRef.current?.click(); }}>
                  <span className="mp-chat-action-i">🖼</span>
                  <span>{tr("相片", "Photo", "写真", "사진")}</span>
                </button>
                {selectedMode !== "reality" && (
                  <button className="mp-chat-action" onClick={() => { setChatActionPanelOpen(false); setTransferModalOpen(true); }}>
                    <span className="mp-chat-action-i">💸</span>
                    <span>{tr("轉帳", "Transfer", "送金", "송금")}</span>
                  </button>
                )}
                <button className="mp-chat-action" disabled>
                  <span className="mp-chat-action-i">📅</span>
                  <span>{tr("日程", "Schedule", "予定", "일정")}</span>
                </button>
                <button className="mp-chat-action" disabled>
                  <span className="mp-chat-action-i">⚙️</span>
                  <span>{tr("更多", "More", "その他", "더보기")}</span>
                </button>
              </div>
            )}
              <div className="mp-inp-bar">
                <button className={`mp-btn mp-btn-img ${chatActionPanelOpen ? "active" : ""}`} onClick={()=>setChatActionPanelOpen((v) => !v)}>＋</button>
                <input type="file" ref={fileInputRef} accept="image/*" style={{display:"none"}} onChange={handleImgUp} />
                <div className="mp-inp-wrap">
                  <textarea
                    className="mp-inp"
                    placeholder={tr("輸入訊息...", "Type a message...", "メッセージを入力...", "메시지를 입력...")}
                    name="mali_chat_text"
                    rows={1}
                    maxLength={inputTextLimit}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="sentences"
                    spellCheck={false}
                    data-form-type="other"
                    data-lpignore="true"
                    value={chatInput}
                    onChange={e=>setChatInput(e.target.value.slice(0, inputTextLimit))}
                  />
                  <div className="mp-char-counter">{chatInput.length}/{inputTextLimit}</div>
                </div>
                <button className="mp-btn mp-btn-send" onClick={sendMessage}>➤</button>
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="mp-page">
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("chat")}</div></div>
        <div className="mp-cl">
          {characters.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">💬</div><div className="mp-empty-t">No characters to chat with yet<br/>Add one from Characters</div></div>
          : characters.map(c => { const ms = chatHistory[c.id]||[]; const lm = ms[ms.length-1]; return (
            <div key={c.id} className="mp-ci" onClick={()=>setCurrentChatChar(c)}>
              <div className="mp-ci-av">{sanitizeUserImageUrl(c.avatar)?<img src={sanitizeUserImageUrl(c.avatar)} alt=""/>:"🦊"}</div>
              <div className="mp-ci-info"><div className="mp-ci-name">{c.name}</div><div className="mp-ci-prev">{lm?(lm.role==="transfer"?(lm.note?`Transfer ${formatMoney(lm.amount)}｜${lm.note}`:`Transfer ${formatMoney(lm.amount)}`):(lm.image?"[Image]":stripModeLabel(stripInternalBlocks(lm.content))?.slice(0,30))):"No messages yet"}</div></div>
              {lm && <div className="mp-ci-time">{new Date(lm.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>}
            </div>); })}
        </div>
      </div>
    );
  };

  const renderSocial = () => <SocialApp
    socialSettingsOpen={socialSettingsOpen} setSocialSettingsOpen={setSocialSettingsOpen}
    socialSettings={socialSettings} setSocialSettings={setSocialSettings} posts={posts} setPosts={setPosts}
    closeApp={closeApp} t={t} tr={tr} characters={characters} setPlayerPostModalOpen={setPlayerPostModalOpen}
    handleRandomSocialPost={handleRandomSocialPost} socialFeedRef={socialFeedRef}
    setPendingPostScrollId={setPendingPostScrollId} getPostAuthorName={getPostAuthorName}
    getPostAuthorAvatar={getPostAuthorAvatar} getPostAuthorType={getPostAuthorType} formatPostTime={formatPostTime}
    sanitizeUserImageUrl={sanitizeUserImageUrl} getLikedByListText={getLikedByListText}
    activeCommentPostId={activeCommentPostId} setActiveCommentPostId={setActiveCommentPostId}
    socialReplyTarget={socialReplyTarget} setSocialReplyTarget={setSocialReplyTarget}
    activeLikePostId={activeLikePostId} setActiveLikePostId={setActiveLikePostId}
    expandedSocialPosts={expandedSocialPosts} setExpandedSocialPosts={setExpandedSocialPosts}
    shouldClampSocialPost={shouldClampSocialPost} shouldScrollComments={shouldScrollComments}
    highlightedPostId={highlightedPostId} activePostMenuId={activePostMenuId} setActivePostMenuId={setActivePostMenuId}
    showToast={showToast} sharePostToChat={sharePostToChat} formatSocialCount={formatSocialCount}
    getPostLikeCount={getPostLikeCount} getCommentDepth={getCommentDepth} getCommentAuthorName={getCommentAuthorName}
    postCommentInputs={postCommentInputs} setPostCommentInputs={setPostCommentInputs} addPostComment={addPostComment}
  />;
  const renderLorebook = () => <LorebookApp
    lorebooks={lorebooks} setLorebooks={setLorebooks} activeLorebookId={activeLorebookId} setActiveLorebookId={setActiveLorebookId}
    editingLorebookBook={editingLorebookBook} setEditingLorebookBook={setEditingLorebookBook}
    editingLorebookEntry={editingLorebookEntry} setEditingLorebookEntry={setEditingLorebookEntry}
    pendingLorebookExport={pendingLorebookExport} setPendingLorebookExport={setPendingLorebookExport}
    viewingLorebookEntry={viewingLorebookEntry} setViewingLorebookEntry={setViewingLorebookEntry}
    lorebookImportInputRef={lorebookImportInputRef} closeApp={closeApp} t={t} tr={tr}
    sanitizeText={sanitizeText} downloadJsonFile={downloadJsonFile} showToast={showToast} gid={gid} notify={notify} ask={ask}
  />;
  const renderCharacters = () => <ContactsApp
    t={t} closeApp={closeApp} characters={characters} activeCharId={activeCharId} sanitizeImage={sanitizeUserImageUrl}
    onAdd={() => { setEditingCharacter(null); setModal("addChar"); }}
    onSetActive={(character) => { setActiveCharId(character.id); showToast(`${character.name} ${t("setAsMainCharacter")}`); }}
    onChat={(character) => { setCurrentChatChar(character); openApp("chat"); }}
    onView={(character) => { setEditingCharacter(character); setModal("addChar"); }}
  />;
  const beginHeroEdit = (src = sanitizeUserImageUrl(activeChar?.heroImage || activeChar?.avatarOriginal || activeChar?.avatar), sourceType = activeChar?.heroImage ? "hero" : "avatar") => {
    if (!activeChar) return;
    const saved = activeChar.heroView || {};
    setHeroDraft({ src: src || "", sourceType, x: Number(saved.x) || 0, y: Number(saved.y) || 0, zoom: Number(saved.zoom) || 1 });
  };
  const onHeroFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeChar) return;
    if (!file.type.startsWith("image/")) return showToast(tr("請選擇圖片檔案", "Choose an image file", "画像ファイルを選択してください", "이미지 파일을 선택하세요"));
    if (file.size > 5 * 1024 * 1024) return showToast(tr("立繪圖片請小於 5MB", "Hero image must be under 5MB", "立ち絵は5MB未満にしてください", "이미지는 5MB 이하여야 합니다"));
    const reader = new FileReader();
    reader.onload = () => { const safe = sanitizeUserImageUrl(String(reader.result || "")); if (safe) setHeroDraft({ src: safe, sourceType: "hero", x: 0, y: 0, zoom: 1 }); };
    reader.readAsDataURL(file);
  };
  const startHeroSettingDrag = (event) => {
    if (!heroDraft?.src) return;
    event.preventDefault();
    heroDragRef.current = { px: event.clientX, py: event.clientY, x: heroDraft.x, y: heroDraft.y };
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) {}
  };
  const moveHeroSettingDrag = (event) => {
    const drag = heroDragRef.current;
    if (!drag) return;
    event.preventDefault();
    setHeroDraft((old) => {
      if (!old) return old;
      // 放大時位移對畫面的影響變大，靈敏度除以縮放倍率讓拖曳速度保持一致
      const z = Math.max(1, Number(old.zoom) || 1);
      return { ...old, x: Math.max(-50, Math.min(50, drag.x + (event.clientX - drag.px) / (2 * z))), y: Math.max(-50, Math.min(50, drag.y + (event.clientY - drag.py) / (1.5 * z))) };
    });
  };
  const endHeroSettingDrag = (event) => {
    heroDragRef.current = null;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch (_) {}
  };
  const saveHeroDraft = () => {
    if (!activeChar || !heroDraft?.src) return;
    setCharacters((list) => list.map((item) => item.id === activeChar.id ? { ...item, ...(heroDraft.sourceType === "hero" ? { heroImage: heroDraft.src } : {}), heroView: { x: heroDraft.x, y: heroDraft.y, zoom: heroDraft.zoom } } : item));
    setHeroDraft(null); showToast(tr("桌面立繪已儲存", "Hero image saved", "立ち絵を保存しました", "이미지를 저장했습니다"));
  };
  const clearAllData = () => {
    if(!confirm(tr("確定要清空所有資料嗎？", "Are you sure you want to clear all data?", "本当にすべてのデータを消去しますか？", "정말 모든 데이터를 삭제할까요?"))) return;
    setCharacters([]);
    setActiveCharId(null);
    setCurrentChatChar(null);
    setCurrentChatGroup(null);
    setChatHistory({});
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
    setApiPresets(defaultAppState.apiPresets);
    setPlayerProfile(defaultAppState.playerProfile);
    setApiConfig(defaultAppState.apiConfig);
    setTtsConfig(defaultAppState.ttsConfig);
    stopCurrentVoiceAudio();
    voiceAudioCacheRef.current.clear();
    setVoicePlayback({ key: null, status: "idle" });
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

  const renderSettings = () => {
    const tc = tempConfig || apiConfig;
    const activeTtsConfig = ttsConfig[ttsConfig.provider] || {};
    const availableTtsVoices = ttsVoices.length ? ttsVoices : (ttsConfig.elevenlabs?.availableVoices || []);
    const updateActiveTtsConfig = (patch) => setTtsConfig((current) => ({
      ...current,
      [current.provider]: { ...(current[current.provider] || {}), ...patch },
    }));
    const cp = API_PROVIDERS.find(p=>p.id===tc.provider);
    const modelOptions = providerModelOptions[tc.provider] || cp?.models || [];
    const getProviderBaseUrl = (provider, fallback = "") => {
      const found = API_PROVIDERS.find((p) => p.id === provider);
      return provider === "custom" ? fallback : (found?.baseUrl || fallback || "");
    };
    const applyApiPreset = (idx) => {
      const p = apiPresets[idx];
      if (!p) return;
      const provider = p.provider || "openai";
      setTempConfig((c) => ({
        ...(c || {}),
        provider,
        baseUrl: getProviderBaseUrl(provider, p.baseUrl || c?.baseUrl || ""),
        apiKey: p.apiKey || "",
        model: p.model || c?.model || "",
      }));
      showToast(`已套用 ${p.name || `預設 ${idx + 1}`}`);
    };
    const activePresetIndex = (apiPresets || []).findIndex((p) =>
      p &&
      p.provider === tc.provider &&
      p.baseUrl === tc.baseUrl &&
      p.apiKey === tc.apiKey &&
      p.model === tc.model
    );
    const saveApiPreset = (idx) => {
      const p = tc || apiConfig;
      setApiPresets((prev) => {
        const list = [...(prev || [])];
        const fallback = defaultAppState.apiPresets[idx] || { id: `preset-${idx + 1}`, name: `預設 ${idx + 1}` };
        list[idx] = {
          id: list[idx]?.id || fallback.id,
          name: list[idx]?.name || fallback.name,
          provider: p.provider,
          baseUrl: getProviderBaseUrl(p.provider, p.baseUrl),
          apiKey: p.apiKey,
          model: p.model,
        };
        return list;
      });
      notify(tr("已儲存到預設", `Saved to preset ${idx + 1}`, `プリセット ${idx + 1} に保存しました`, `프리셋 ${idx + 1}에 저장되었습니다`), `Saved to preset ${idx + 1}`);
    };
    const fetchLatestModels = async () => {
      try {
        setFetchingModels(true);
        const models = sortModelsByProvider(tc.provider, await fetchAvailableModels(tc));
        if (!models.length) throw new Error(tr("找不到可用模型", "No models found", "利用可能なモデルが見つかりません", "사용 가능한 모델을 찾을 수 없습니다"));
        setProviderModelOptions((previous) => ({ ...previous, [tc.provider]: models }));
        setTempConfig((current) => ({ ...current, model: models.includes(current.model) ? current.model : models[0] }));
        showToast(tr(`已抓取 ${models.length} 個模型`, `Fetched ${models.length} models`, `${models.length}件のモデルを取得しました`, `모델 ${models.length}개를 가져왔습니다`));
      } catch (error) {
        const message = tc.provider === "vertex" ? tr("抓取失敗，可手動輸入模型名稱", "Fetch failed; you can type the model name manually", "取得に失敗しました。モデル名を手動入力できます", "가져오기에 실패했습니다. 모델 이름을 직접 입력할 수 있습니다") : tr("抓取失敗", "Fetch failed", "取得に失敗しました", "가져오기 실패");
        showToast(`${message}：${error.message}`);
      } finally { setFetchingModels(false); }
    };
    const testApiConnection = async () => {
      if (testingConnection) return;
      setTestingConnection(true);
      try {
        const reply = await callAI([{ role: "user", content: "請只回覆 OK" }], tc, "你是連線測試助手，只能回覆 OK。");
        const ok = /\bOK\b|ＯＫ/i.test(String(reply || "").trim());
        notify("連線成功", ok ? "Connection successful" : `Connected, but the reply looks odd: ${sanitizeText(reply, 40) || "empty"}`);
      } catch (err) {
        notify("連線失敗", `Connection failed: ${sanitizeText(err?.message || "unknown error", 120)}`);
      }
      setTestingConnection(false);
    };
    const clearSiteCache = async () => {
      try {
        if (!clearCacheArmed) {
          setClearCacheArmed(true);
          showToast(tr("再按一次清除快取", "Tap again to clear cache", "もう一度押すとキャッシュを削除します", "한 번 더 누르면 캐시를 삭제합니다"));
          setTimeout(() => setClearCacheArmed(false), 3000);
          return;
        }
        setClearCacheArmed(false);
        if (!window.confirm(tr("確定要清除網站快取並重新載入嗎？", "Clear site cache and reload?", "サイトキャッシュを削除して再読み込みしますか？", "사이트 캐시를 삭제하고 다시 불러올까요?"))) return;
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        showToast(tr("快取已清除，正在重新載入", "Cache cleared, reloading now", "キャッシュを削除しました。再読み込みしています", "캐시를 삭제했습니다. 다시 불러오는 중입니다"));
        setTimeout(() => window.location.reload(), 250);
      } catch (err) {
        showToast(`${tr("清除快取失敗", "Failed to clear cache", "キャッシュ削除に失敗しました", "캐시 삭제 실패")}：${err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류")}`);
      }
    };
    return (
      <div className="mp-page">
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("settings")}</div></div>
        <div className="mp-set">
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:4}}>
            {[
              { id: "appearance", label: t("appearance") },
              { id: "api", label: t("api") },
              { id: "data", label: t("data") },
              { id: "about", label: t("about") },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="mp-ibtn"
                style={{
                  padding: "8px 6px",
                  minWidth: 0,
                  fontWeight: 800,
                  background: settingsTab === tab.id
                    ? (isNightTheme ? "linear-gradient(135deg,#4b3a62,#3a2d4f)" : "linear-gradient(135deg,#9aa8b3,#7b8791)")
                    : (isNightTheme ? "rgba(47,36,64,.72)" : "rgba(255,255,255,.72)"),
                  color: settingsTab === tab.id ? "#fff" : "var(--mp-txt)",
                  border: settingsTab === tab.id
                    ? (isNightTheme ? "1px solid rgba(200,168,224,.38)" : "1px solid rgba(123,135,145,.35)")
                    : (isNightTheme ? "1px solid #3a2d4f" : "1px solid rgba(160,176,186,.25)"),
                }}
                onClick={() => setSettingsTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {settingsTab === "appearance" && (
            <>
            <div className="mp-sg">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,cursor:"pointer"}} onClick={() => setSettingsAppearanceOpen((value) => !value)}>
                <div><div className="mp-sg-t" style={{marginBottom:2}}>{tr("主題與外觀", "Theme & appearance", "テーマと外観", "테마 및 외관")}</div><div style={{fontSize:10,color:"var(--mp-txt-l)"}}>{tr("主題、桌面立繪與自訂 CSS", "Theme, desktop image, and custom CSS", "テーマ、立ち絵、カスタム CSS", "테마, 데스크톱 이미지, 사용자 CSS")}</div></div>
                <span style={{fontSize:11,fontWeight:800,color:"var(--mp-pink-dk)"}}>{settingsAppearanceOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
              </div>
              {settingsAppearanceOpen && <div style={{display:"flex",flexDirection:"column",marginTop:12}}>
              <ThemeSettings t={t} tr={tr} themeName={themeName} setThemeName={setThemeName} fontName={fontName} setFontName={setFontName} effectsEnabled={themeEffectsEnabled} setEffectsEnabled={setThemeEffectsEnabled} />
              <CustomCssSettings
                tr={tr}
                enabled={customCssEnabled}
                setEnabled={setCustomCssEnabled}
                draft={customCssDraft}
                setDraft={setCustomCssDraft}
                notice={customCssNotice}
                setNotice={setCustomCssNotice}
                sanitize={sanitizeCustomCss}
                onOpenGuide={() => setCustomCssGuideOpen(true)}
                onReset={() => { setCustomCssDraft(""); setCustomCss(""); setCustomCssEnabled(false); setCustomCssNotice(tr("已重設", "Reset", "リセットしました", "초기화됨")); try { localStorage.removeItem("mali_custom_css"); } catch {} }}
                onApply={(safe) => { setCustomCssDraft(safe); setCustomCss(safe); setCustomCssEnabled(true); setCustomCssNotice(tr("已儲存並套用", "Saved and applied", "保存して適用しました", "저장 및 적용됨")); try { localStorage.setItem("mali_custom_css", safe); } catch {} }}
              />
              <HeroImageSettings
                tr={tr} activeChar={activeChar} heroFileRef={heroFileRef} onHeroFile={onHeroFile}
                heroDraft={heroDraft} setHeroDraft={setHeroDraft} beginHeroEdit={beginHeroEdit}
                removeHero={() => setCharacters((list) => list.map((item) => item.id === activeChar.id ? { ...item, heroImage:"", heroView:null } : item))}
                startDrag={startHeroSettingDrag} moveDrag={moveHeroSettingDrag} endDrag={endHeroSettingDrag}
                heroImgStyle={heroImgStyle} saveDraft={saveHeroDraft}
              />
              </div>}
            </div>
            <InterfaceSettings t={t} tr={tr} uiLanguage={uiLanguage} setUiLanguage={setUiLanguage} screenLockTimeout={screenLockTimeout} setScreenLockTimeout={setScreenLockTimeout} />
            </>
          )}
          {settingsTab === "api" && (
            <>
              <ApiPresetSettings tr={tr} activePresetIndex={activePresetIndex} config={tc} onApplyPreset={applyApiPreset} />
              <AiConnectionSettings
                t={t} tr={tr} open={settingsAiConnOpen} setOpen={setSettingsAiConnOpen}
                config={tc} setConfig={setTempConfig} providers={API_PROVIDERS} modelOptions={modelOptions}
                fetchingModels={fetchingModels} onFetchModels={fetchLatestModels}
                testingConnection={testingConnection} onTest={testApiConnection}
                onProviderChange={(providerId) => { const provider = API_PROVIDERS.find((item) => item.id === providerId); setTempConfig((current) => ({ ...current, provider: provider.id, baseUrl: getProviderBaseUrl(provider.id, current?.baseUrl || ""), model: provider.models[0] || "" })); }}
                onSave={() => { setApiConfig(tc); notify(tr("設定已儲存", "Settings saved", "設定を保存しました", "설정이 저장되었습니다"), "Settings saved"); }}
                onSavePreset={() => setPresetSavePickerOpen(true)}
              />
              <VoiceApiSettings
                tr={tr} open={settingsVoiceOpen} setOpen={setSettingsVoiceOpen}
                config={ttsConfig} setConfig={setTtsConfig} activeConfig={activeTtsConfig}
                updateConfig={(patch) => { setTtsConnectionState("idle"); setTtsVoices([]); updateActiveTtsConfig(patch); }}
                voices={availableTtsVoices} connectionState={ttsConnectionState}
                onLoadVoices={() => void loadElevenLabsDefaultVoices()}
                onPreview={() => void previewDefaultTtsVoice()}
              />
            </>
          )}
          {presetSavePickerOpen && <ApiPresetModal
            tr={tr} t={t} onClose={() => setPresetSavePickerOpen(false)}
            onSave={(index) => { saveApiPreset(index); setPresetSavePickerOpen(false); }}
          />}
          {settingsTab === "data" && (
            <>
              <DataBackupSettings tr={tr} dataImporting={dataImporting} dataImportRef={dataImportRef} onExport={exportAllData} onImport={importAllData} />
            </>
          )}
          {dataImportPreview && <DataImportPreviewModal
            tr={tr} preview={dataImportPreview}
            onCancel={() => { setDataImportPreview(null); setDataImporting(false); }}
            onConfirm={confirmImportPreview}
          />}
          {chatroomImportPreview && <ChatroomImportPreviewModal
            tr={tr} preview={chatroomImportPreview}
            onCancel={() => { setChatroomImportPreview(null); setChatroomImportTarget(null); setChatroomImporting(false); }}
            onConfirm={confirmChatroomImportPreview}
          />}
          {settingsTab === "about" && (
            <>
              <AboutInfoSettings
                tr={tr} version={VERSION} currentChangelogTitle={currentChangelogTitle} currentChangelog={currentChangelog}
                versionOpen={settingsVersionOpen} setVersionOpen={setSettingsVersionOpen}
                disclaimerOpen={settingsDisclaimerOpen} setDisclaimerOpen={setSettingsDisclaimerOpen}
              />
              <ResetDataSettings
                tr={tr} open={settingsResetDataOpen} setOpen={setSettingsResetDataOpen}
                clearCacheArmed={clearCacheArmed} onClearAll={clearAllData} onClearCache={clearSiteCache}
              />
            </>
          )}
          </div>
        </div>
      );
    };

  const renderPlayer = () => <PlayerProfileApp
    t={t} tr={tr} closeApp={closeApp} profile={playerProfile} setProfile={setPlayerProfile}
    avatarRef={playerAvatarRef} sanitizeImage={sanitizeUserImageUrl} onAvatarUpload={handlePlayerAvatarUpload}
    crop={playerAvatarCrop} setCrop={setPlayerAvatarCrop}
    onCropPointerDown={onPlayerAvatarPointerDown} onCropPointerMove={onPlayerAvatarPointerMove} onCropPointerUp={onPlayerAvatarPointerUp}
    onApplyCrop={applyPlayerAvatarCrop}
  />;
  const addWalletTransaction = (type, amount, note) => {
    const safeAmount = Math.max(0, Number(amount) || 0);
    if (!safeAmount) return;
    setWallet((w) => {
      const prev = w || { balance: 0, transactions: [], assets: [] };
      const delta = type === "expense" ? -safeAmount : safeAmount;
      const nextBalance = Math.max(0, (prev.balance || 0) + delta);
      const tx = {
        id: gid(),
        type,
        amount: safeAmount,
        note: sanitizeText(note || "", 80) || (type === "income" ? "入帳" : "消費"),
        time: Date.now(),
        source: "manual",
      };
      return { ...prev, balance: nextBalance, transactions: [tx, ...(prev.transactions || [])].slice(0, 1000) };
    });
  };
  const addWalletAsset = (name, qty = 1) => {
    const title = sanitizeText(name || "", 40).trim();
    if (!title) return;
    const count = Math.max(1, Number(qty) || 1);
    setWallet((w) => {
      const prev = w || { balance: 0, transactions: [], assets: [] };
      const list = [...(prev.assets || [])];
      const idx = list.findIndex((a) => a.name === title);
      if (idx >= 0) list[idx] = { ...list[idx], qty: (list[idx].qty || 0) + count, updatedAt: Date.now() };
      else list.unshift({ id: gid(), name: title, qty: count, updatedAt: Date.now() });
      return { ...prev, assets: list.slice(0, 120) };
    });
  };
  const transferToCurrentChar = () => {
    if (!currentChatChar || transferSubmitting) return;
    const amount = Math.max(0, Math.round(Number(transferAmount) || 0));
    if (!amount) { showToast(tr("請輸入轉帳金額", "Please enter a transfer amount", "振込金額を入力してください", "송금 금액을 입력해주세요")); return; }
    const currentBalance = Number(wallet?.balance || 0);
    if (currentBalance < amount) { showToast(tr("餘額不足", "Insufficient balance", "残高不足", "잔액 부족")); return; }
    const cid = currentChatChar.id;
    const note = sanitizeText(transferNote, 60);
    const now = Date.now();
    const transferMsg = {
      id: gid(),
      role: "transfer",
      fromType: "player",
      fromName: getPlayerDisplayName(),
      toType: "character",
      toId: cid,
      toName: currentChatChar.name,
      amount,
      note,
      content: note ? `轉帳 $${formatMoney(amount)}｜${note}` : `轉帳 $${formatMoney(amount)}`,
      time: now,
    };
    setTransferSubmitting(true);
    try {
      setWallet((w) => ({
        ...(w || { balance: 0, transactions: [], assets: [] }),
        balance: Math.max(0, (w?.balance || 0) - amount),
        transactions: [{
          id: gid(),
          type: "expense",
          amount,
          note: note ? stripUserPlaceholder(`轉帳給${currentChatChar.name}｜${note}`) : `轉帳給${currentChatChar.name}`,
          time: now,
          charId: cid,
          source: "chat",
        }, ...(w?.transactions || [])].slice(0, 1000),
      }));
      setCharacterWallets((prev) => {
        const cw = prev[cid] || { balance: 0, transactions: [], summary: "", generatedAt: Date.now() };
        return {
          ...prev,
          [cid]: {
            ...cw,
            balance: Math.max(0, (cw.balance || 0) + amount),
            transactions: [{
              id: gid(),
              type: "income",
              amount,
            note: note ? stripUserPlaceholder(`收到玩家轉帳｜${note}`) : "收到玩家轉帳",
              time: now,
            }, ...(cw.transactions || [])].slice(0, CHARACTER_WALLET_TX_LIMIT),
          },
        };
      });
      setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), transferMsg] }));
      setTransferAmount("");
      setTransferNote("");
      setTransferModalOpen(false);
      showToast(tr("已完成轉帳", "Transfer completed", "振込が完了しました", "송금이 완료되었습니다"));
    } finally {
      setTransferSubmitting(false);
    }
  };
  const applyCharacterTransferToPlayer = ({ cid, char, amount, note, time, displayAtEnd = true }) => {
    const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (!cid || !char || !safeAmount) return null;
    const safeNote = sanitizeText(note || "", 60);
    const now = Number(time) || Date.now();
    const transferMsg = {
      id: gid(),
      role: "transfer",
      fromType: "character",
      fromId: cid,
      fromName: char.name || "角色",
      toType: "player",
      toName: getPlayerDisplayName(),
      amount: safeAmount,
      note: safeNote,
      content: safeNote ? `轉帳 $${formatMoney(safeAmount)}｜${safeNote}` : `轉帳 $${formatMoney(safeAmount)}`,
      time: now,
    };
    setWallet((w) => ({
      ...(w || { balance: 0, transactions: [], assets: [] }),
      balance: Math.max(0, (w?.balance || 0) + safeAmount),
      transactions: [{
        id: gid(),
        type: "income",
        amount: safeAmount,
        note: safeNote ? stripUserPlaceholder(`收到${char.name || "角色"}轉帳｜${safeNote}`) : `收到${char.name || "角色"}轉帳`,
        time: now,
        charId: cid,
        source: "chat",
      }, ...(w?.transactions || [])].slice(0, 1000),
    }));
    setCharacterWallets((prev) => {
      const cw = prev[cid] || { balance: 0, transactions: [], summary: "", generatedAt: Date.now() };
      return {
        ...prev,
        [cid]: {
          ...cw,
          balance: Math.max(0, (cw.balance || 0) - safeAmount),
          transactions: [{
            id: gid(),
            type: "expense",
            amount: safeAmount,
            note: safeNote ? stripUserPlaceholder(`轉帳給玩家｜${safeNote}`) : "轉帳給玩家",
            time: now,
          }, ...(cw.transactions || [])].slice(0, CHARACTER_WALLET_TX_LIMIT),
        },
      };
    });
    setChatHistory((h) => {
      const next = [...(h[cid] || []), transferMsg];
      return { ...h, [cid]: displayAtEnd ? next : next };
    });
    return transferMsg;
  };
  const normalizeWalletData = (data) => {
    const txs = Array.isArray(data?.transactions) ? data.transactions : [];
    return {
      balance: Math.max(0, Math.round(Number(data?.balance) || 0)),
      transactions: txs.slice(0, CHARACTER_WALLET_TX_LIMIT).map((t) => ({
        id: t.id || gid(),
        type: t.type === "income" ? "income" : "expense",
        amount: Math.max(1, Math.round(Number(t.amount) || 1)),
        note: stripUserPlaceholder(sanitizeText(t.note || "", 80)) || (t.type === "income" ? "入帳" : "消費"),
        time: Number(t.time) || Date.now(),
      })),
      summary: stripUserPlaceholder(sanitizeText(data?.summary || "", 120)),
      walletProfile: stripUserPlaceholder(sanitizeText(data?.walletProfile || data?.summary || "", 220)),
      generatedAt: data?.generatedAt || Date.now(),
      refreshedAt: data?.refreshedAt || data?.generatedAt || Date.now(),
      lastRefreshedSlot: data?.lastRefreshedSlot || null,
    };
  };
  const reconcileWalletLedger = (openingBalance, transactions, limit = CHARACTER_WALLET_TX_LIMIT) => {
    let balance = Math.max(0, Math.round(Number(openingBalance) || 0));
    const reconciled = [];
    const ordered = [...(transactions || [])].sort((a, b) => Number(a?.time || 0) - Number(b?.time || 0));
    ordered.forEach((tx) => {
      if (!tx) return;
      const type = tx.type === "income" ? "income" : "expense";
      let amount = Math.max(1, Math.round(Number(tx.amount) || 0));
      if (!amount) return;
      if (type === "expense") {
        if (balance <= 0) return;
        if (amount > balance) amount = balance;
        if (amount <= 0) return;
        balance -= amount;
      } else {
        balance += amount;
      }
      reconciled.push({
        id: tx.id || gid(),
        type,
        amount,
        note: stripUserPlaceholder(sanitizeText(tx.note || "", 80)) || (type === "income" ? "入帳" : "消費"),
        time: Number(tx.time) || Date.now(),
      });
    });
    return { balance, transactions: reconciled.slice(0, limit).reverse() };
  };
  const buildWalletRoleProfile = (char) => [
    char.description ? `角色描述：${sanitizeText(char.description, 900)}` : "",
    char.systemPrompt ? `系統提示詞：${sanitizeText(char.systemPrompt, 600)}` : "",
    char.personality ? `個性：${sanitizeText(char.personality, 500)}` : "",
    char.scenario ? `情境：${sanitizeText(char.scenario, 500)}` : "",
    char.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
    Array.isArray(char.tags) && char.tags.length ? `標籤：${sanitizeText(char.tags.join("、"), 120)}` : "",
  ].filter(Boolean).join("\n");
  const buildWalletRefreshHistory = (cw) => (cw?.transactions || [])
    .slice(0, 3)
    .map((t) => `${t.type === "income" ? "收入" : "支出"} ${formatMoney(t.amount)}：${stripUserPlaceholder(t.note)}`)
    .join("\n");
  const generateCharacterWallet = async (char, { mode = "initial" } = {}) => {
    if (!char) return;
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    setWalletGenLoading(true);
    try {
      const currentWallet = characterWallets[char.id] || null;
      const walletProfile = currentWallet?.walletProfile || currentWallet?.summary || "";
      const refreshHistory = buildWalletRefreshHistory(currentWallet);
      const isRefresh = mode === "refresh";
      const roleProfile = isRefresh ? "" : buildWalletRoleProfile(char);
      const walletPrompt = isRefresh
        ? `請根據角色的錢包摘要，補充角色「${char.name}」在當前時段的新流水，只輸出有效 JSON。
規則：
1) 只生成 1~3 筆新的 transactions，內容必須是日常收入或日常支出。
2) 不要生成轉帳事件，轉帳已由聊天室事件另外處理。
3) 不要重做整個錢包，也不要清空既有交易；只回傳增量結果。
4) balance 請回傳本次刷新後、可對帳的整數餘額起點；實際最後餘額會由程式依流水逐筆計算。
5) summary 與 walletProfile 原樣沿用，不要重寫成全新摘要。
6) 所有支出必須能被目前餘額支撐，若錢不夠，請改成較小額支出、臨時收入、借貸、預支，或直接不產生支出。
7) time 使用目前時間附近的毫秒 timestamp，可用 ${Date.now()} 往前推。
格式：
{"balance":1200,"summary":"原摘要可沿用","walletProfile":"原摘要可沿用","transactions":[{"type":"income","amount":300,"note":"午班收入","time":1710000000000}]}

錢包摘要：
${walletProfile || "（無）"}

最近流水摘要：
${refreshHistory || "（無）"}

角色設定補充：已由 walletProfile 取代，刷新時不要重新閱讀完整角色設定。`
        : `請根據角色設定，生成角色「${char.name}」自己的錢包狀態與錢包摘要，只輸出有效 JSON。
規則：
1) balance 是合理餘額，整數，不要太誇張。
2) transactions 產生 8~12 筆，包含 income/expense，金額與備註要貼近角色職業、生活、興趣、作息、社交圈。
3) 收入/支出要明顯符合角色身分，不要出現與角色設定衝突的來源或消費。例：學生不要有高薪月薪；居家型角色不要頻繁高額外出消費；上班族收入可來自薪資/兼職/獎金，但不要莫名其妙像企業老闆。
4) 若角色是醫生，收入/支出可部分和醫療、值班、書籍、交通有關，但不能全部都醫療；也要有飲食、娛樂、興趣、人際等生活花費。
5) 不要提到 {{user}}，這是角色自己的錢包。
6) 另外產生一份只用於錢包的 summary，並同步產生 walletProfile。walletProfile 只保留職業、收入來源、消費習慣、生活風格、財務風格等財務相關資訊，不要包含對 {{user}} 的態度、性行為、曖昧互動或私密感情。
7) walletProfile 會用於之後的錢包刷新，請寫得簡短、穩定、方便長期重複使用。
8) 所有支出必須能被目前餘額支撐，若錢不夠，請改成較小額支出、臨時收入、借貸、預支，或直接不產生支出。
9) 每筆流水的 note 要像角色真的會有的消費/收入，不要是泛用模板。
10) time 使用目前時間附近的毫秒 timestamp，可用 ${Date.now()} 往前推。
格式：
{"balance":1200,"summary":"一句 20~50 字生活摘要","walletProfile":"一句更短的錢包摘要","transactions":[{"type":"income","amount":3000,"note":"薪資入帳","time":1710000000000}]}

角色設定：
${roleProfile || "（無）"}`;
      const raw = await callAI([{
        role: "user",
        content: `${getOutputLanguageDirective()}\n\n${walletPrompt}`,
      }], apiConfig, "你是角色生活流水生成器，只能輸出有效 JSON。");
      const match = String(raw || "").match(/\{[\s\S]*\}/);
      if (!match) throw new Error("模型未回傳 JSON");
      const parsed = JSON.parse(match[0]);
      const next = normalizeWalletData(parsed);
      const refreshedAt = Date.now();
      const lastRefreshedSlot = getWalletTimeSlot(refreshedAt);
      setCharacterWallets((prev) => {
        const current = prev[char.id] || { balance: 0, transactions: [], summary: "", generatedAt: Date.now() };
        const mergedTransactions = isRefresh
          ? [...(next.transactions || []), ...(current.transactions || [])].slice(0, CHARACTER_WALLET_TX_LIMIT)
          : (next.transactions || []).slice(0, CHARACTER_WALLET_TX_LIMIT);
        const orderedTransactions = [...mergedTransactions].sort((a, b) => Number(a?.time || 0) - Number(b?.time || 0));
        const openingBalance = isRefresh ? (current.balance || 0) : (Number(parsed.balance) || 0);
        const reconciled = reconcileWalletLedger(openingBalance, orderedTransactions, CHARACTER_WALLET_TX_LIMIT);
        return {
          ...prev,
          [char.id]: {
            ...current,
            ...next,
            summary: next.summary || current.summary || "",
            walletProfile: isRefresh ? (current.walletProfile || current.summary || "") : (next.walletProfile || next.summary || current.walletProfile || current.summary || ""),
            balance: reconciled.balance,
            transactions: reconciled.transactions,
            refreshedAt,
            lastRefreshedSlot,
          },
        };
      });
      showToast(isRefresh ? `${char.name} 的錢包已刷新` : `${char.name} 的錢包已更新`);
    } catch (err) {
      showToast(`${tr("角色錢包生成失敗", "Character wallet generation failed", "キャラのウォレット生成に失敗しました", "캐릭터 지갑 생성에 실패했습니다")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 120)}`);
    }
    setWalletGenLoading(false);
  };
  const regenerateCharacterWallet = async (char) => {
    if (!char) return;
    const ok = window.confirm(tr("重新生成會清空舊的錢包資料，並重新讀取角色設定建立新錢包，確定要繼續嗎？", "Regenerating will clear the old wallet data and rebuild a new wallet from the character settings. Continue?", "再生成すると古いウォレットデータが消去され、キャラ設定を読み直して新しいウォレットが作成されます。続けますか？", "다시 생성하면 기존 지갑 데이터가 지워지고 캐릭터 설정을 다시 읽어 새 지갑이 만들어집니다. 계속할까요?"));
    if (!ok) return;
    setCharacterWallets((prev) => ({ ...prev, [char.id]: { balance: 0, transactions: [], summary: "", generatedAt: Date.now() } }));
    await generateCharacterWallet(char, { mode: "initial" });
  };
  const clearWalletData = () => {
    if (!window.confirm(tr("確定要清除錢包頁面的資料嗎？", "Clear the wallet page data?", "ウォレットページのデータを消去しますか？", "지갑 페이지 데이터를 지울까요?"))) return;
    if (!window.confirm(tr("請再次確認：這只會清除錢包頁面內容，不會影響聊天室，確定要繼續嗎？", "Please confirm again: this only clears the wallet page content and won't affect chats. Continue?", "再確認してください。これはウォレットページの内容のみを消去し、チャットには影響しません。続けますか？", "다시 확인해주세요. 이것은 지갑 페이지만 지우며 채팅에는 영향을 주지 않습니다. 계속할까요?"))) return;
    setWallet(defaultAppState.wallet); setCharacterWallets({}); setWalletSettingsPage("main"); setWalletSettingsOpen(false);
    showToast(tr("錢包資料已清除", "Wallet data cleared", "ウォレットデータを消去しました", "지갑 데이터를 지웠습니다"));
  };
  const renderWallet = () => walletSettingsOpen && walletSettingsPage === "settings"
    ? <WalletSettingsApp tr={tr} onBack={() => setWalletSettingsPage("main")} onClear={clearWalletData} />
    : <WalletLedgerView wallet={wallet} setWallet={setWallet} characters={characters} closeApp={closeApp} openSettings={() => { setWalletSettingsPage("settings"); setWalletSettingsOpen(true); }} tr={tr} formatMoney={formatMoney} displayWalletText={displayWalletText} sanitizeUserImageUrl={sanitizeUserImageUrl} />;
  const renderPhone = () => <PhoneApp
    phoneViewCharId={phoneViewCharId} setPhoneViewCharId={setPhoneViewCharId} phonePage={phonePage} setPhonePage={setPhonePage}
    phoneActiveThreadId={phoneActiveThreadId} setPhoneActiveThreadId={setPhoneActiveThreadId}
    characters={characters} chatHistory={chatHistory} phoneInboxCache={phoneInboxCache} characterWallets={characterWallets} playerProfile={playerProfile}
    closeApp={closeApp} t={t} tr={tr} sanitizeUserImageUrl={sanitizeUserImageUrl} renderAppIcon={renderAppIcon}
    phoneGenLoading={phoneGenLoading} generatePhoneNpcChats={generatePhoneNpcChats} phonePlayerContactLoading={phonePlayerContactLoading} refreshPhonePlayerContact={refreshPhonePlayerContact}
    phoneAppCache={phoneAppCache} phoneAppGenLoading={phoneAppGenLoading} generatePhoneApp={generatePhoneApp}
    diaryPage={diaryPage} setDiaryPage={setDiaryPage}
    walletGenLoading={walletGenLoading} generateCharacterWallet={generateCharacterWallet} regenerateCharacterWallet={regenerateCharacterWallet}
    formatMoney={formatMoney} displayWalletText={displayWalletText} armAppClickSuppression={armAppClickSuppression}
    suppressAppClickUntilRef={suppressAppClickUntilRef} gid={gid}
  />;
  const renderPlaceholder = (i, n) => (<div className="mp-page"><div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{i} {n}</div></div><div className="mp-empty" style={{flex:1}}><div className="mp-empty-i">{i}</div><div className="mp-empty-t">{t("comingSoon")}<br/>{t("stayTuned")}</div></div></div>);
  const renderGame = () => <GameCenter page={gamePage} setPage={setGamePage} closeApp={closeApp} t={t} tr={tr} />;
  const renderBook = () => <AnswerBookApp closeApp={closeApp} title={t("answerBook")} />;
  const renderApp = () => {
    switch(currentApp) {
      case "chat": return renderChat();
      case "status": return renderStatus();
      case "social": return renderSocial();
      case "lorebook": return renderLorebook();
      case "characters": return renderCharacters();
      case "settings": return renderSettings();
      case "player": return renderPlayer();
      case "wallet": return renderWallet();
      case "gallery": return renderPlaceholder("🖼️", t("gallery"));
      case "game": return renderGame();
      case "petHome": return <PetHome onClose={closeApp} />;
      case "lbook": return renderBook();
      case "notebook": return renderPlaceholder("📒", t("notebook"));
      case "phone": return renderPhone();
      default: return null;
    }
  };
  const onPointerDragStartApp = (e, appId, fromArea) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    clearTimeout(edgeTurnTimerRef.current);
    edgeTurnTimerRef.current = null;
    edgeTurnDirRef.current = null;
    setIsDraggingApp(true);
    setPointerDrag({
      appId,
      fromArea,
      startX: e.clientX || 0,
      startY: e.clientY || 0,
      x: e.clientX || 0,
      y: e.clientY || 0,
      moved: false,
    });
  };
  const cancelPointerDrag = () => {
    setPointerDrag(null);
    setIsDraggingApp(false);
    clearTimeout(edgeTurnTimerRef.current);
    edgeTurnTimerRef.current = null;
    edgeTurnDirRef.current = null;
  };
  const onDropToHome = (e, slotIndex) => {
    e.preventDefault();
    try {
      const { appId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveAppToHomeSlot(appId, slotIndex);
    } catch (_) {}
  };
  const onDropToHomeGrid = (e, pageIdx) => {
    e.preventDefault();
    // 目前以主畫面(中間頁)為主：拖放一律落在中間頁 4x3
    const targetPage = 1;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const col = Math.max(0, Math.min(3, Math.floor((relX / rect.width) * 4)));
    const row = Math.max(0, Math.min(2, Math.floor((relY / rect.height) * 3)));
    const slot = targetPage * PAGE_SIZE + row * 4 + col;
    onDropToHome(e, slot);
  };
  const onDropToDock = (e, index) => {
    e.preventDefault();
    try {
      const { appId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveAppToDock(appId, index);
    } catch (_) {}
  };
  const onDropToDockContainer = (e) => {
    e.preventDefault();
    try {
      const { appId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const slotCount = Math.max(1, dockApps.length);
      const ratio = relX / rect.width;
      const targetIndex = Math.max(0, Math.min(dockApps.length, Math.round(ratio * slotCount)));
      moveAppToDock(appId, targetIndex);
    } catch (_) {}
  };
  const onHomeDragOverPageEdge = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const edge = 28;
    const maxPage = Math.max(0, homePages.length - 1);
    if (x <= rect.left + edge) setHomePage(p => Math.max(0, p - 1));
    else if (x >= rect.right - edge) setHomePage(p => Math.min(maxPage, p + 1));
  };
  return (<><style>{css}</style><style>{themeCss}</style><div className="mp-wrap" onClickCapture={blockRecentAppClicks}><div className="mp-phone">
    <div className="mp-desk" onTouchStart={onHomeTouchStart} onTouchEnd={onHomeTouchEnd} onMouseDown={onHomeMouseDown} onMouseUp={onHomeMouseUp} onPointerDown={onHomePointerDown} onPointerUp={onHomePointerUp} onPointerMove={onHomePointerMove} onPointerCancel={cancelPointerDrag} onDragOver={onHomeDragOverPageEdge}><BarClock ft={ft} /><div className="mp-desk-scroll">
      <DeskClock ft={ft} fd={fd} />
      {activeChar && (isPeachTheme ? <PeachHero character={activeChar} imageUrl={sanitizeUserImageUrl(activeChar.heroImage)} statusText={(activeChar.statusText || activeChar.description || tr("在線中", "Online", "オンライン中", "온라인 중")).slice(0,34)} onOpen={() => openApp("status")} /> : <div className="mp-cw" onClick={(e)=>{e.stopPropagation(); openApp("status");}} onPointerUp={(e)=>openAppFromTouch("status", e)}><div className="mp-av">{sanitizeUserImageUrl(activeChar.avatar)?<img src={sanitizeUserImageUrl(activeChar.avatar)} alt=""/>:"??"}</div><div className="mp-cw-info"><div className="mp-cw-name">{activeChar.name}<span className="mp-active-badge">ACTIVE</span></div><div className="mp-cw-desc">{(activeChar.statusText || activeChar.description || tr("在線中", "Online", "オンライン中", "온라인 중")).slice(0,34)}</div><div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:2}}>{tr("更新：", "Updated: ", "更新: ", "업데이트: ")}{activeChar.statusUpdatedAt ? new Date(activeChar.statusUpdatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}) : "--:--"}</div></div></div>)}
      <div className="mp-home-mid">
        <div className="mp-pages">
          <div className="mp-pages-track" style={{ transform: `translateX(-${homePage * 100}%)` }}>
            {homePages.map((apps, idx) => (
              <div key={idx} className="mp-grid" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>onDropToHomeGrid(e, idx)}>
                {Array.from({ length: PAGE_SIZE }).map((_, slotIdx) => {
                  const app = apps[slotIdx] ? appById[apps[slotIdx]] : null;
                  const absoluteIdx = idx * PAGE_SIZE + slotIdx;
                  return (
                    <div
                      key={`slot-${absoluteIdx}`}
                      className={`mp-icon ${app ? "" : "mp-icon-empty"}`}
                      data-app-id={app?.id || undefined}
                      onDragOver={(e)=>e.preventDefault()}
                      onDrop={(e)=>onDropToHome(e, absoluteIdx)}
                      data-drop-slot={absoluteIdx}
                      onClick={(e)=>{ e.stopPropagation(); app && !isDraggingApp && Date.now() > suppressAppClickUntilRef.current && openApp(app.id); }}
                      onPointerUp={(e)=>{ if (app && !isDraggingApp) openAppFromTouch(app.id, e); }}
                      draggable={false}
                      onPointerDown={(e)=>app && onPointerDragStartApp(e, app.id, "home")}
                    >
                      <div className={`mp-icon-c ${app?.iconUrl ? "mp-icon-c-img" : ""}`}>{app ? renderAppIcon(app, app.iconUrl ? 56 : 26) : ""}</div>
                      <span className="mp-icon-l">{app ? app.name : ""}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>{!currentApp && <div className="mp-page-dots">
      {homePages.map((_, idx) => <span key={idx} className={`mp-page-dot ${homePage===idx ? "active" : ""}`} />)}
    </div>}<div className="mp-dock" data-drop-dock-wrap="1" onDragOver={(e)=>e.preventDefault()} onDrop={onDropToDockContainer} style={{justifyContent: "center", gap: dockApps.length <= 2 ? 22 : 14}}>
      {dockApps.map((app, idx) => {
        return (
          <div
            key={`dock-${idx}`}
            className="mp-dock-i"
            data-app-id={app.id}
            onDragOver={(e)=>e.preventDefault()}
            onDrop={(e)=>onDropToDock(e, idx)}
            data-drop-dock={idx}
            onClick={(e)=>{ e.stopPropagation(); !isDraggingApp && Date.now() > suppressAppClickUntilRef.current && openApp(app.id); }}
            onPointerUp={(e)=>{ if (!isDraggingApp) openAppFromTouch(app.id, e); }}
            draggable={false}
            onPointerDown={(e)=>onPointerDragStartApp(e, app.id, "dock")}
          >
            {renderAppIcon(app, app.iconUrl ? 56 : 24)}
          </div>
        );
      })}
    </div></div>
    {pointerDrag && pointerDrag.moved && (
      <div style={{position:"fixed",left:pointerDrag.x-22,top:pointerDrag.y-22,width:44,height:44,borderRadius:14,background:"rgba(255,255,255,.92)",border:"1px solid rgba(231,197,214,.9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,pointerEvents:"none",zIndex:9999,boxShadow:"0 8px 18px rgba(0,0,0,.15)"}}>
        {appById[pointerDrag.appId]?.icon || "🧩"}
      </div>
    )}
    {currentApp && renderApp()}
    {customCssGuideOpen && <CustomCssGuide onClose={() => setCustomCssGuideOpen(false)} />}
    <DesktopPet currentApp={currentApp} />
    {modal === "addChar" && <AddCharacterModal setModal={setModal} setEditingCharacter={setEditingCharacter} addCharacter={addCharacter} updateCharacter={updateCharacter} exportCharacter={exportCharacter} deleteCharacter={deleteCharacter} editingCharacter={editingCharacter} sanitizeUserImageUrl={sanitizeUserImageUrl} uiLanguage={uiLanguage} ttsConfig={ttsConfig} ttsVoices={ttsVoices.length ? ttsVoices : (ttsConfig.elevenlabs?.availableVoices || [])} onVoicePreview={previewCharacterVoice} />}
    {memoryEditor && (
      <div className="mp-overlay" onClick={() => setMemoryEditor(null)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">{tr("編輯記憶", "Edit memory", "メモリを編集", "기억 편집")}</div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("記憶內容（最多 500 字）", "Memory content (up to 500 chars)", "メモ内容（500文字以内）", "기억 내용(최대 500자)")}</div>
            <textarea className="mp-ta" value={memoryEditor.text} maxLength={500} onChange={(e)=>setMemoryEditor((s)=>({ ...s, text: e.target.value }))} style={{minHeight:140,resize:"vertical"}} />
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setMemoryEditor(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{flex:1}} onClick={() => {
              const t = sanitizeText(memoryEditor.text, 500);
              setMemories((prev) => ({
                ...prev,
                [memoryEditor.charId]: (prev[memoryEditor.charId] || []).map((m) =>
                  m.id === memoryEditor.memoryId ? { ...m, text: t } : m
                ),
              }));
              setMemoryEditor(null);
              showToast(tr("記憶已更新", "Memory updated", "メモリを更新しました", "기억이 업데이트되었습니다"));
            }}>{tr("儲存", "Save", "保存", "저장")}</button>
          </div>
        </div>
      </div>
    )}
    {messageEditor && (
      <div className="mp-overlay" onClick={closeMessageEditor}>
        <div className="mp-modal" onClick={(e)=>e.stopPropagation()}>
          <div className="mp-modal-t" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>{tr("編輯對話", "Edit message", "メッセージを編集", "메시지 편집")}</span>
            <button className="mp-ibtn-r" onClick={deleteMessageWithConfirm} title={tr("刪除此段訊息", "Delete this message", "このメッセージを削除", "이 메시지 삭제")}>🗑️</button>
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("訊息內容", "Message content", "メッセージ内容", "메시지 내용")}</div>
            <textarea
              className="mp-ta"
              value={messageEditor.content}
              maxLength={getChatTextLimit(messageEditor.mode)}
              onChange={(e)=>setMessageEditor((s)=>({ ...s, content: e.target.value.slice(0, getChatTextLimit(s?.mode)) }))}
              style={{minHeight:120,resize:"vertical"}}
            />
            <div className="mp-char-counter mp-char-counter-modal">{(messageEditor.content || "").length}/{getChatTextLimit(messageEditor.mode)}</div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={closeMessageEditor}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{flex:1}} onClick={saveEditedMessage}>{tr("儲存", "Save", "保存", "저장")}</button>
          </div>
        </div>
      </div>
    )}
    {updateNoticeOpen && (
      <div className="mp-overlay" onClick={closeUpdateNotice}>
        <div className="mp-modal" onClick={(e)=>e.stopPropagation()}>
          <div className="mp-modal-t">MaliPhone v{VERSION} {tr("更新", "Update", "更新", "업데이트")}</div>
          <div className="mp-update-list">
            {(currentChangelog.length ? currentChangelog : [tr("這個版本沒有填寫更新內容。", "No update notes were added for this version.", "このバージョンの更新内容は未記入です。", "이 버전의 업데이트 내용이 없습니다.")]).map((item, idx) => (
              <div key={idx} className="mp-update-item">{item}</div>
            ))}
          </div>
          <button className="mp-save" style={{marginTop:12}} onClick={closeUpdateNotice}>{tr("知道了", "Got it", "OK", "확인")}</button>
        </div>
      </div>
    )}
    {playerPostModalOpen && (
      <div className="mp-overlay" onClick={() => setPlayerPostModalOpen(false)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">{tr("發佈社群貼文", "Create social post", "投稿を作成", "소셜 게시물 작성")}</div>
          <div className="mp-row">
            <textarea
              className="mp-ta"
              value={playerPostText}
              maxLength={PLAYER_SOCIAL_POST_LIMIT}
              placeholder={tr("今天想分享什麼？", "What would you like to share today?", "今日は何を共有しますか？", "오늘 무엇을 공유할까요?")}
              onChange={(e) => setPlayerPostText(e.target.value.slice(0, PLAYER_SOCIAL_POST_LIMIT))}
              style={{minHeight:130,resize:"vertical"}}
            />
            <div className="mp-char-counter mp-char-counter-modal">{playerPostText.length}/{PLAYER_SOCIAL_POST_LIMIT}</div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setPlayerPostModalOpen(false)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{flex:1}} disabled={playerPostSubmitting} onClick={submitPlayerPost}>{playerPostSubmitting ? tr("發佈中...", "Posting...", "投稿中...", "게시 중...") : tr("發佈", "Post", "投稿", "게시")}</button>
          </div>
        </div>
      </div>
    )}
    {transferModalOpen && currentChatChar && (
      <div className="mp-overlay" onClick={() => setTransferModalOpen(false)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">{tr("轉帳給", "Transfer to", "送金先", "송금 대상")} {currentChatChar.name}</div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("金額", "Amount", "金額", "금액")}</div>
            <input
              className="mp-sinp"
              inputMode="numeric"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={tr("輸入金額", "Enter amount", "金額を入力", "금액을 입력")}
            />
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("備註", "Note", "メモ", "메모")}</div>
            <input
              className="mp-sinp"
              value={transferNote}
              maxLength={60}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder={tr("可不填，例如：下午茶 / 車資 / 還款", "Optional, e.g. snacks / fare / repayment", "任意入力。例: おやつ / 交通費 / 返済", "선택 사항. 예: 간식 / 교통비 / 상환")}
            />
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setTransferModalOpen(false)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{flex:1}} disabled={transferSubmitting} onClick={transferToCurrentChar}>{transferSubmitting ? tr("轉帳中...", "Transferring...", "送金中...", "송금 중...") : tr("確認轉帳", "Confirm transfer", "送金を確定", "송금 확인")}</button>
          </div>
        </div>
      </div>
    )}
    {groupCreateOpen && (
      <div className="mp-overlay" onClick={() => setGroupCreateOpen(false)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">{tr("新增群組", "Create group", "グループを作成", "그룹 만들기")}</div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("群組名稱", "Group name", "グループ名", "그룹 이름")}</div>
            <input
              className="mp-sinp"
              value={groupCreateName}
              onChange={(e) => setGroupCreateName(e.target.value)}
              placeholder={tr("可留空，建立後再命名", "Optional, name it later", "未入力でも可。後で名前を変更できます", "비워도 됩니다. 나중에 이름을 정하세요")}
            />
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("未命名時，會自動依成員名稱生成群組名。", "If left blank, the group name will be generated from the members.", "未入力の場合はメンバー名から自動生成されます。", "비워두면 멤버 이름으로 자동 생성됩니다.")}</div>
          </div>
            <div className="mp-row">
            <div className="mp-lbl">{tr("群組圖片", "Group cover", "グループ画像", "그룹 이미지")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="mp-av" style={{ cursor: "pointer" }} onClick={() => groupCoverInputRef.current?.click()}>
                {groupCreateCover ? <img src={groupCreateCover} alt="" /> : "👥"}
              </div>
              <input type="file" ref={groupCoverInputRef} accept="image/*" style={{ display: "none" }} onChange={handleGroupCreateCoverUp} />
              <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => groupCoverInputRef.current?.click()}>{tr("上傳", "Upload", "アップロード", "업로드")}</button>
              <button className="mp-ibtn-r" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => setGroupCreateCover("")}>{tr("移除", "Remove", "削除", "제거")}</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("會顯示在群組聊天室列表。", "Shown in the group chat list.", "グループチャット一覧に表示されます。", "그룹 채팅 목록에 표시됩니다.")}</div>
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("要加入的角色", "Characters to add", "追加するキャラ", "추가할 캐릭터")}</div>
            {renderGroupMemberGrid(groupCreateMemberIds, setGroupCreateMemberIds, groupCreateSearch, setGroupCreateSearch)}
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("群組聊天規則", "Group chat rules", "グループチャットのルール", "그룹 채팅 규칙")}</div>
            <textarea
              className="mp-ta"
              value={groupCreateRulePrompt}
              onChange={(e) => setGroupCreateRulePrompt(e.target.value)}
              placeholder={tr("例如：自然聊天、可互相吐槽、不要提系統...", "For example: natural chat, playful teasing, no system talk...", "例: 自然な会話、軽いツッコミ可、システムの話はしない...", "예: 자연스러운 대화, 가벼운 농담 가능, 시스템 언급 금지...")}
              style={{ minHeight: 120, resize: "vertical" }}
            />
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("之後可作為群組 AI 回覆的專屬 Prompt。", "Can be used later as the group AI's dedicated prompt.", "後でグループAIの専用プロンプトとして使えます。", "나중에 그룹 AI 전용 프롬프트로 사용할 수 있습니다.")}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={() => setGroupCreateOpen(false)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{ flex: 1 }} onClick={createGroupChat}>{tr("建立群組", "Create group", "グループを作成", "그룹 만들기")}</button>
          </div>
        </div>
      </div>
    )}
    {groupEditOpen && (
      <div className="mp-overlay" onClick={() => setGroupEditOpen(false)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">{tr("編輯群組", "Edit group", "グループを編集", "그룹 편집")}</div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("群組名稱", "Group name", "グループ名", "그룹 이름")}</div>
            <input
              className="mp-sinp"
              value={groupEditName}
              onChange={(e) => setGroupEditName(e.target.value)}
              placeholder={tr("可留空，儲存後再命名", "Optional, name it later", "未入力でも可。保存後に名前を変更できます", "비워도 됩니다. 저장 후 이름을 정하세요")}
            />
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("未命名時，會自動依成員名稱生成群組名。", "If left blank, the group name will be generated from the members.", "未入力の場合はメンバー名から自動生成されます。", "비워두면 멤버 이름으로 자동 생성됩니다.")}</div>
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("群組圖片", "Group cover", "グループ画像", "그룹 이미지")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="mp-av" style={{ cursor: "pointer" }} onClick={() => groupEditCoverInputRef.current?.click()}>
                {groupEditCover ? <img src={groupEditCover} alt="" /> : "👥"}
              </div>
              <input type="file" ref={groupEditCoverInputRef} accept="image/*" style={{ display: "none" }} onChange={handleGroupEditCoverUp} />
              <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => groupEditCoverInputRef.current?.click()}>{tr("上傳", "Upload", "アップロード", "업로드")}</button>
              <button className="mp-ibtn-r" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => setGroupEditCover("")}>{tr("移除", "Remove", "削除", "제거")}</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("會顯示在群組聊天室列表。", "Shown in the group chat list.", "グループチャット一覧に表示されます。", "그룹 채팅 목록에 표시됩니다.")}</div>
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("要加入的角色", "Characters to add", "追加するキャラ", "추가할 캐릭터")}</div>
            {renderGroupMemberGrid(groupEditMemberIds, setGroupEditMemberIds, groupEditSearch, setGroupEditSearch)}
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("群組聊天規則", "Group chat rules", "グループチャットのルール", "그룹 채팅 규칙")}</div>
            <textarea
              className="mp-ta"
              value={groupEditRulePrompt}
              onChange={(e) => setGroupEditRulePrompt(e.target.value)}
              placeholder={tr("例如：自然聊天、可互相吐槽、不要提系統...", "For example: natural chat, playful teasing, no system talk...", "例: 自然な会話、軽いツッコミ可、システムの話はしない...", "예: 자연스러운 대화, 가벼운 농담 가능, 시스템 언급 금지...")}
              style={{ minHeight: 120, resize: "vertical" }}
            />
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("之後可作為群組 AI 回覆的專屬 Prompt。", "Can be used later as the group AI's dedicated prompt.", "後でグループAIの専用プロンプトとして使えます。", "나중에 그룹 AI 전용 프롬프트로 사용할 수 있습니다.")}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={() => setGroupEditOpen(false)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{ flex: 1 }} onClick={saveEditGroup}>{tr("儲存", "Save", "保存", "저장")}</button>
          </div>
          </div>
        </div>
      )}
      {(groupCoverCrop || groupEditCoverCrop) && (
        <div className="mp-overlay" onClick={() => { setGroupCoverCrop(null); setGroupEditCoverCrop(null); }}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-t">{tr("裁切群組圖片", "Crop group cover", "グループ画像をトリミング", "그룹 이미지 자르기")}</div>
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginBottom: 10 }}>{tr("可拖曳調整位置，完成後會自動壓縮。", "Drag to adjust the position; it will be compressed automatically when done.", "ドラッグで位置を調整できます。完了時に自動で圧縮されます。", "드래그로 위치를 조정할 수 있으며 완료 시 자동 압축됩니다.")}</div>
            <div
              style={{ width: 220, height: 220, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(244,143,177,.35)", background: "#fff", touchAction: "none", cursor: "grab", position: "relative", margin: "0 auto" }}
              onPointerDown={(e) => {
                const crop = groupEditCoverCrop || groupCoverCrop;
                if (!crop) return;
                e.preventDefault();
                try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
                const px = e.clientX ?? 0;
                const py = e.clientY ?? 0;
                const next = { ...crop, dragging: true, dragStartX: px, dragStartY: py, startPanX: crop.panX || 0, startPanY: crop.panY || 0 };
                if (groupEditCoverCrop) setGroupEditCoverCrop(next); else setGroupCoverCrop(next);
              }}
              onPointerMove={(e) => {
                const crop = groupEditCoverCrop || groupCoverCrop;
                if (!crop?.dragging) return;
                e.preventDefault();
                const px = e.clientX ?? 0;
                const py = e.clientY ?? 0;
                const nextPanX = (crop.startPanX || 0) + ((px - (crop.dragStartX || 0)) / 1.8);
                const nextPanY = (crop.startPanY || 0) + ((py - (crop.dragStartY || 0)) / 1.8);
                const next = { ...crop, panX: Math.max(-100, Math.min(100, nextPanX)), panY: Math.max(-100, Math.min(100, nextPanY)) };
                if (groupEditCoverCrop) setGroupEditCoverCrop(next); else setGroupCoverCrop(next);
              }}
              onPointerUp={(e) => {
                try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
                const crop = groupEditCoverCrop || groupCoverCrop;
                if (!crop) return;
                const next = { ...crop, dragging: false };
                if (groupEditCoverCrop) setGroupEditCoverCrop(next); else setGroupCoverCrop(next);
              }}
            >
              <img
                src={(groupEditCoverCrop || groupCoverCrop)?.src}
                alt=""
                style={{
                  position: "absolute",
                  width: (() => {
                    const crop = groupEditCoverCrop || groupCoverCrop;
                    const box = 220;
                    const iw = Number(crop?.width || 1);
                    const ih = Number(crop?.height || 1);
                    return iw * Math.max(box / iw, box / ih) * Math.max(1, Number(crop?.zoom || 1));
                  })(),
                  height: (() => {
                    const crop = groupEditCoverCrop || groupCoverCrop;
                    const box = 220;
                    const iw = Number(crop?.width || 1);
                    const ih = Number(crop?.height || 1);
                    return ih * Math.max(box / iw, box / ih) * Math.max(1, Number(crop?.zoom || 1));
                  })(),
                  left: (() => {
                    const crop = groupEditCoverCrop || groupCoverCrop;
                    const box = 220;
                    const iw = Number(crop?.width || 1);
                    const ih = Number(crop?.height || 1);
                    const scale = Math.max(box / iw, box / ih) * Math.max(1, Number(crop?.zoom || 1));
                    const dw = iw * scale;
                    const maxShiftX = Math.max(0, (dw - box) / 2);
                    return (box - dw) / 2 + (maxShiftX * Number(crop?.panX || 0)) / 100;
                  })(),
                  top: (() => {
                    const crop = groupEditCoverCrop || groupCoverCrop;
                    const box = 220;
                    const iw = Number(crop?.width || 1);
                    const ih = Number(crop?.height || 1);
                    const scale = Math.max(box / iw, box / ih) * Math.max(1, Number(crop?.zoom || 1));
                    const dh = ih * scale;
                    const maxShiftY = Math.max(0, (dh - box) / 2);
                    return (box - dh) / 2 + (maxShiftY * Number(crop?.panY || 0)) / 100;
                  })(),
                  objectFit: "cover",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
            <div className="mp-row">
              <div className="mp-lbl">{tr("縮放", "Zoom", "ズーム", "확대")}</div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={(groupEditCoverCrop || groupCoverCrop)?.zoom || 1}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (groupEditCoverCrop) setGroupEditCoverCrop((s) => ({ ...(s || {}), zoom: value })); else setGroupCoverCrop((s) => ({ ...(s || {}), zoom: value }));
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={() => { setGroupCoverCrop(null); setGroupEditCoverCrop(null); }}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
              <button className="mp-save" style={{ flex: 1 }} onClick={() => applyGroupCoverCrop(groupEditCoverCrop ? "edit" : "create")}>{tr("完成裁切", "Finish crop", "トリミング完了", "자르기 완료")}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="mp-toast">{toast}</div>}
  </div></div></>);
}
