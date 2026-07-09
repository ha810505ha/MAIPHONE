import React, { useState, useEffect, useRef } from "react";
import { VERSION, API_PROVIDERS, DEFAULT_APPS, DOCK_APPS } from "./constants/appConstants";
import { getChangelog } from "./constants/changelog";
import { createSocialFeedHelpers } from "./services/social/socialFeedHelpers";
import useSocialFeed from "./hooks/social/useSocialFeed";
import useWalletController from "./hooks/wallet/useWalletController";
import { gid, ft, fd, sanitizeText, sanitizeUserImageUrl } from "./utils/coreUtils";
import { UI_TEXT } from "./constants/uiText";
import { buildSystemPrompt } from "./utils/characterParser";
import { callAI, fetchAvailableModels } from "./services/aiService";
import { fetchElevenLabsDefaultVoices, synthesizeSpeech } from "./services/ttsService";
import { loadAppState, saveAppState } from "./utils/indexedDbStorage";
import { syncOnBoot, schedulePush } from "./services/syncService";
import { PHONE_APP_META, sanitizePhoneTheme, buildPhonePromptContext, buildPhoneAppPrompt, sanitizePhoneAppData } from "./utils/phoneAppGen";
import { createDefaultVoiceSettings, normalizeCharacterVoiceSettings } from "./utils/voiceSettings";
import { sanitizeCustomCss } from "./utils/customCss";
import css, { THEME_PRESETS, FONT_PRESETS } from "./styles/maliPhoneCss";
import DesktopPet from "./DesktopPet";
import CustomCssGuide from "./CustomCssGuide";
import SettingsApp from "./components/settings/SettingsApp";
import AppRouter from "./components/apps/AppRouter";
import useAppearanceSettings from "./hooks/settings/useAppearanceSettings";
import useDirectChatAI from "./hooks/chat/useDirectChatAI";
import useGroupChatAI from "./hooks/chat/useGroupChatAI";
import useGroupChatController from "./hooks/chat/useGroupChatController";
import useChatBackground from "./hooks/chat/useChatBackground";
import useHomeDragAndDrop from "./hooks/home/useHomeDragAndDrop";
import { getGroupMemberProfileText, buildGroupChatSystemPrompt, parseGroupReplies } from "./services/chat/groupChatHelpers";
import { generateGroupReplies } from "./services/chat/groupChatGenerator";
import { generateDirectAssistant } from "./services/chat/directChatGenerator";
import useAppPersistence from "./hooks/data/useAppPersistence";
import useDataImportExport from "./hooks/data/useDataImportExport";
import useChatroomImportExport from "./hooks/data/useChatroomImportExport";
import useVoicePlayback from "./hooks/audio/useVoicePlayback";
import PlayerProfileApp from "./components/apps/PlayerProfileApp";
import ContactsApp from "./components/apps/ContactsApp";
import WalletSettingsApp from "./components/apps/WalletSettingsApp";
import PhoneApp from "./components/apps/PhoneApp";
import SocialApp from "./components/apps/SocialApp";
import LorebookApp from "./components/apps/LorebookApp";
import StatusApp from "./components/apps/StatusApp";
import AddCharacterModal from "./components/characters/AddCharacterModal";
import { heroImgStyle } from "./components/home/PeachHero";
import WalletLedgerView from "./components/wallet/WalletLedgerView";
import GroupMemberPicker from "./components/chat/GroupMemberPicker";
import ChatListView from "./components/chat/ChatListView";
import ChatHeader from "./components/chat/ChatHeader";
import ChatSettingsPanel from "./components/chat/settings/ChatSettingsPanel";
import GroupChatContent from "./components/chat/GroupChatContent";
import { OnlineChatMessage, RealityChatMessage, SystemNoticeMessage, TransferMessage } from "./components/chat/DirectMessageTypes";
import DirectMessageList from "./components/chat/DirectMessageList";
import DirectChatComposer from "./components/chat/DirectChatComposer";
import { CharacterVoiceAction, InnerThoughtPanel, RealityMessageText, SceneBar } from "./components/chat/ChatMessageParts";
import LockScreen from "./components/shell/LockScreen";
import HomeScreen from "./components/shell/HomeScreen";
import { DEFAULT_APP_STATE } from "./constants/defaultAppState";

// 立繪位移：object-position 滑動 cover 的溢出裁切窗口（到邊自動停），
// translate 只用縮放產生的溢出空間（上限 (zoom-1)*50%），兩者相加永遠不會露出背景缺口
export default function MaliPhone() {
  const defaultAppState = DEFAULT_APP_STATE;
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
  const { themeName, setThemeName, fontName, setFontName, uiLanguage, setUiLanguage, themeEffectsEnabled, setThemeEffectsEnabled, customCssEnabled, setCustomCssEnabled, customCss, setCustomCss, customCssDraft, setCustomCssDraft, customCssNotice, setCustomCssNotice, customCssGuideOpen, setCustomCssGuideOpen, settingsAppearanceOpen, setSettingsAppearanceOpen, scopedCustomCss } = useAppearanceSettings(defaultAppState);
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
  const [statusRefreshingIds, setStatusRefreshingIds] = useState({});
  const [settingsApiOpen, setSettingsApiOpen] = useState(true);
  const [settingsResetOpen, setSettingsResetOpen] = useState(false);
  const [settingsVersionOpen, setSettingsVersionOpen] = useState(false);
  const [settingsDisclaimerOpen, setSettingsDisclaimerOpen] = useState(false);
  const [settingsAiConnOpen, setSettingsAiConnOpen] = useState(false);
  const [settingsVoiceOpen, setSettingsVoiceOpen] = useState(false);
  const [settingsResetDataOpen, setSettingsResetDataOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("appearance");
  const [heroDraft, setHeroDraft] = useState(null);
  const heroFileRef = useRef(null);
  const heroDragRef = useRef(null);
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

  const applyLoadedAppState = (data) => {
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

  };
  const persistenceSnapshot = { characters, activeCharId, chatHistory, chatModes, chatBackgrounds, groupChats, chatScenes, groupScenes, innerThoughtSettings, proactiveSettings, proactiveUnread, posts, socialSettings, memories, lorebooks, chatLorebookBindings, phoneInboxCache, phoneAppCache, wallet, characterWallets, screenLockTimeout, apiPresets, playerProfile, apiConfig, ttsConfig, themeName, fontName, uiLanguage, homeSlots, dockOrder };
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
  const { voices: ttsVoices, setVoices: setTtsVoices, connectionState: ttsConnectionState, setConnectionState: setTtsConnectionState, playback: voicePlayback, stop: stopCurrentVoiceAudio, clearCache: clearVoicePlaybackCache, previewCharacterVoice, loadDefaultVoices: loadElevenLabsDefaultVoices, previewDefaultVoice: previewDefaultTtsVoice, toggleCharacterVoice } = useVoicePlayback({
    config: ttsConfig, setConfig: setTtsConfig, fetchVoices: fetchElevenLabsDefaultVoices,
    synthesizeSpeech, getSpeechText: getReplySpeechText, showToast, sanitizeText, tr,
  });
  const renderCharacterVoiceAction = (char, message, isActive, collapseWhenHidden = false) => {
    if (!ttsConfig.enabled || !char?.voiceSettings?.enabled) return null;
    const key = `${ttsConfig.provider || "elevenlabs"}:${char.id}:${message.replyGroupId || message.id}`;
    const status = voicePlayback.key === key ? voicePlayback.status : "idle";
    return (
      <CharacterVoiceAction visible={isActive || status !== "idle"} collapseWhenHidden={collapseWhenHidden} status={status} onToggle={() => void toggleCharacterVoice(char, message)} tr={tr} />
    );
  };
  const currentChangelogRaw = getChangelog(VERSION, uiLanguage);
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
      const img = new Image();
      img.onload = () => {
        const maxSide = 1024;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const output = canvas.toDataURL("image/jpeg", 0.86);
        const processed = sanitizeUserImageUrl(output);
        if (!processed) return notify("頭像處理失敗", tr("頭像處理失敗", "Avatar processing failed", "アバターの処理に失敗しました", "아바타 처리가 실패했습니다"));
        setPlayerAvatarCrop({
          src: processed,
          width,
          height,
          zoom: 1,
          panX: 0,
          panY: 0,
          dragging: false,
          dragStartX: 0,
          dragStartY: 0,
          startPanX: 0,
          startPanY: 0,
        });
      };
      img.onerror = () => notify("圖片讀取失敗", tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
      img.src = safe;
    };
    r.readAsDataURL(f);
    e.target.value = "";
  };
  const applyPlayerAvatarCrop = () => {
    if (!playerAvatarCrop?.src) return;
    const img = new Image();
    img.onload = () => {
      const iw = img.width;
      const ih = img.height;
      const size = 320;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
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
    clean = sanitizeText(clean, 240);
    // 超長被裁切時，退回到最後一個句末標點，避免句中截斷
    if (clean.length === 240) {
      const lastEnd = Math.max(...["。", "！", "？", "…", "～", "!", "?", "."].map((p) => clean.lastIndexOf(p)));
      if (lastEnd > 0) clean = clean.slice(0, lastEnd + 1);
    }
    return clean;
  };
  const isIncompleteInnerThought = (text) => {
    const clean = String(text || "").trim();
    // 被 MAX_TOKENS 硬切的句子結尾通常是一般文字，改成檢查是否以句末標點收尾
    return !clean || !/[。！？…～!?.」』"'）)\]】]$/.test(clean);
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
      // thinking 模型（如 Gemini 2.5）的內部思考會計入 maxOutputTokens，額度太低會讓正文被截斷
      let raw = await callAI(thoughtMessages, { ...apiConfig, maxTokens: 3000 }, applyUserPlaceholder(prompt));
      if (isIncompleteInnerThought(raw)) {
        raw = await callAI([
          ...thoughtMessages,
          { role: "assistant", content: raw },
          { role: "user", content: "上一版心聲在語意未完成處中斷。請重新輸出一版完整的心聲，維持 1 到 2 句、最多 80 字，只輸出心聲本身。" },
        ], { ...apiConfig, maxTokens: 3000 }, applyUserPlaceholder(prompt));
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
    return <InnerThoughtPanel thought={thought} expanded={expanded} loading={loading} unseen={unseenAutoThought} tr={tr} onToggle={() => {
      if (thought) {
        if (!expanded) markInnerThoughtSeen();
        setExpandedInnerThoughts((prev) => ({ ...prev, [message.id]: !prev[message.id] }));
      } else void generateInnerThought({ char, messageId: message.id, source: "manual" });
    }} onRegenerate={() => void generateInnerThought({ char, messageId: message.id, source: "manual" })} />;
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
  const getSceneState = (kind, id) => {
    if (kind === "group") return groupScenes?.[id] || { location: "", note: "" };
    return chatScenes?.[id] || { location: "", note: "" };
  };
  const renderSceneBar = (kind, id, title = tr("場景", "Scene", "シーン", "장면")) => {
    const scene = getSceneState(kind, id);
    const editing = sceneEditor?.kind === kind && sceneEditor?.id === id;
    return (
      <SceneBar title={title} scene={scene} editor={editing ? sceneEditor : null} tr={tr}
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
  const generateAssistantForHistory = (args) => generateDirectAssistant(args, {
    formatMessagesForPrompt, pickMemoriesForPrompt, pickLorebookEntriesForPrompt, characterWallets,
    formatMoney, tr, getPlayerContextBlock, estimateTokens, totalContextTokenLimit: TOTAL_CONTEXT_TOKEN_LIMIT,
    apiConfig, applyUserPlaceholder, buildChatSystemPrompt, callAI, sanitizeText, normalizeRealityReply,
    realityChatTextLimit: REALITY_CHAT_TEXT_LIMIT, normalizeAssistantReply, extractTransferDirective,
    stripModeLabel, stripInternalBlocks, splitAssistantBubbles, createId: gid, wait, setChatHistory,
    applyCharacterTransferToPlayer, isInnerThoughtAutoEnabled, generateInnerThought,
  });

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

  const { sendMessage, retryMessage: retryChatFromNotice } = useDirectChatAI({
    currentCharacter: currentChatChar, isTyping, chatHistory, chatInput, chatImage,
    getCommittedMode: getLastCommittedChatMode, getSelectedMode: getSelectedChatMode, getMessageMode,
    getTextLimit: getChatTextLimit, sanitizeText, createId: gid,
    setChatHistory, setChatInput, setChatImage, setActionPanelOpen: setChatActionPanelOpen, setIsTyping,
    generateAssistant: generateAssistantForHistory, addErrorNotice: addChatErrorNotice,
  });
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
  const { importRef: dataImportRef, importing: dataImporting, preview: dataImportPreview, exportAllData, importAllData, confirmImport: confirmImportPreview, cancelImport: cancelDataImport } = useDataImportExport({
    getExportableState: getExportableAppState,
    downloadJsonFile,
    summarizeImportedData,
    applyImportedState: applyImportedAppState,
    showToast,
    tr,
    sanitizeText,
  });
  const canUseCurrentProvider = () => {
    const isOllamaLocal = apiConfig.provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(apiConfig.baseUrl || "");
    const providerNeedsApiKey = !(apiConfig.provider === "ollama" && isOllamaLocal);
    return !providerNeedsApiKey || !!apiConfig.apiKey;
  };
  const refreshCharacterStatus = async (charId, force = false) => {
    if (statusRefreshBusyRef.current.has(charId)) {
      if (force) showToast(tr("狀態正在更新中", "Status is already updating", "ステータスを更新中です", "상태를 업데이트하는 중입니다"));
      return;
    }
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
    setStatusRefreshingIds((previous) => ({ ...previous, [charId]: true }));
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
      setStatusRefreshingIds((previous) => { const next = { ...previous }; delete next[charId]; return next; });
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

  const {
    syncShopOrdersToWallet,
    transferToCurrentChar,
    applyCharacterTransferToPlayer,
    generateCharacterWallet,
    regenerateCharacterWallet,
    clearWalletData,
  } = useWalletController({
    wallet, setWallet, characterWallets, setCharacterWallets,
    currentChatChar, transferSubmitting, transferAmount, transferNote,
    setTransferSubmitting, setTransferAmount, setTransferNote, setTransferModalOpen,
    setChatHistory, setWalletGenLoading,
    setWalletSettingsPage, setWalletSettingsOpen,
    defaultWallet: defaultAppState.wallet,
    characterWalletTxLimit: CHARACTER_WALLET_TX_LIMIT,
    apiConfig, canUseCurrentProvider, showToast, tr, getPlayerDisplayName,
    formatMoney, stripUserPlaceholder, getOutputLanguageDirective, getWalletTimeSlot,
  });
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
    rollCharacterPostLikes, getPlayerDisplayName, getPlayerAvatar, pickPlayerPostReactors,
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
  }, [hydrated, characters, chatHistory, proactiveSettings, proactiveUnread, apiConfig]);


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

  const {
    onHomeTouchStart, onHomeTouchEnd, onHomeMouseDown, onHomeMouseUp,
    onHomePointerDown, onHomePointerUp, onHomePointerMove,
    onPointerDragStartApp, cancelPointerDrag, onDropToHome, onDropToHomeGrid,
    onDropToDock, onDropToDockContainer, onHomeDragOverPageEdge,
  } = useHomeDragAndDrop({
    allAppIds, safeDock, cleanedSlots, dockApps, homePages, homePage, setHomePage,
    setHomeSlots, setDockOrder, isDraggingApp, setIsDraggingApp, pointerDrag, setPointerDrag,
    swipeStartXRef, swipeStartYRef, edgeTurnTimerRef, edgeTurnDirRef, suppressAppClickUntilRef,
    pageSize: PAGE_SIZE, openApp,
  });

    // ---- Status (RPG) ----
  const renderStatus = () => <StatusApp
    closeApp={closeApp} t={t} tr={tr} characters={characters} chatHistory={chatHistory} memories={memories} posts={posts}
    sanitizeUserImageUrl={sanitizeUserImageUrl} statusExpandedCharId={statusExpandedCharId} setStatusExpandedCharId={setStatusExpandedCharId}
    statusMemoryExpandedCharId={statusMemoryExpandedCharId} setStatusMemoryExpandedCharId={setStatusMemoryExpandedCharId}
    refreshCharacterStatus={refreshCharacterStatus} statusRefreshingIds={statusRefreshingIds} activeMemoryId={activeMemoryId} setActiveMemoryId={setActiveMemoryId}
    setMemoryEditor={setMemoryEditor} togglePinMemory={togglePinMemory} deleteMemory={deleteMemory}
    generateMemory={generateMemory} genLoading={genLoading} applyUserPlaceholder={applyUserPlaceholder}
  />;

  // ---- Chat ----
  const renderRealityText = (text) => <RealityMessageText text={text} />;
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
  const {
    getGroupMembers, openCreateGroup, openEditGroup, handleGroupCreateCoverUp,
    handleGroupEditCoverUp, saveEditGroup, createGroupChat, applyGroupCoverCrop,
  } = useGroupChatController({
    characters, currentChatGroup, groupCoverCrop, groupEditCoverCrop,
    groupCreateMemberIds, groupCreateName, groupCreateRulePrompt, groupCreateCover,
    groupEditGroupId, groupEditMemberIds, groupEditName, groupEditRulePrompt, groupEditCover,
    setGroupCoverCrop, setGroupEditCoverCrop, setGroupCreateCover, setGroupEditCover,
    setGroupCreateName, setGroupCreateRulePrompt, setGroupCreateMemberIds, setGroupCreateSearch, setGroupCreateOpen,
    setGroupEditGroupId, setGroupEditName, setGroupEditRulePrompt, setGroupEditMemberIds, setGroupEditSearch, setGroupEditOpen,
    setGroupChats, setCurrentChatGroup, sanitizeImageUrl: sanitizeUserImageUrl, showToast, notify, tr,
  });
  const {
    normalizeChatBackground, getChatBackgroundLayerStyle, getChatBackgroundBlurFilter,
    updateChatBackground, onChatBackgroundFile,
  } = useChatBackground({
    setChatBackgrounds, setChatBgEditor, sanitizeImageUrl: sanitizeUserImageUrl, showToast, tr,
  });
  const { importRef: chatroomImportRef, preview: chatroomImportPreview, importing: chatroomImporting, deleteChatroom: deleteChatroomForCharacter, exportChatroom: exportChatroomForCharacter, openImport: openChatroomImport, importFile: importChatroomFile, confirmImport: confirmChatroomImportPreview, cancelImport: cancelChatroomImport } = useChatroomImportExport({
    currentCharacter: currentChatChar, characters, chatHistory, chatModes, chatBackgrounds, chatLorebookBindings, innerThoughtSettings,
    setChatHistory, setChatModes, setChatBackgrounds, setChatLorebookBindings, setInnerThoughtSettings,
    resetOpenChat: () => { setChatActionPanelOpen(false); setMessageEditor(null); setActiveMessageId(null); setIsTyping(false); setChatInput(""); },
    normalizeBackground: normalizeChatBackground, downloadJsonFile, showToast, sanitizeText, tr,
  });
  const buildGroupPrompt = (group, memberNames, memberProfiles, recent) => buildGroupChatSystemPrompt({
    group, memberNames, memberProfiles, recent, groupScenes, sanitizeText,
    outputLanguageDirective: getOutputLanguageDirective(),
  });
  const parseGroupReplyPayload = (raw) => parseGroupReplies(raw, sanitizeText);
  const currentGroupMessages = currentChatGroup ? (currentChatGroup.messages || []) : [];
  const runGroupReplyGeneration = ({ group, members, messages, currentImage }) => generateGroupReplies({
    group,
    members: members.map((member) => ({ ...member, profileText: getGroupMemberProfileText(member, sanitizeText) })),
    messages,
    currentImage,
    apiConfig,
    callAI,
    buildSystemPrompt: buildGroupPrompt,
    parseReplies: parseGroupReplyPayload,
    stripInternalBlocks,
    sanitizeText,
    sanitizeImageUrl: sanitizeUserImageUrl,
    tr,
  });
  const { sendGroupMessage, retryGroupMessage: retryGroupFromNotice } = useGroupChatAI({
    currentGroup: currentChatGroup, isTyping, input: chatInput, image: chatImage,
    setInput: setChatInput, setImage: setChatImage, setActionPanelOpen: setChatActionPanelOpen, setIsTyping,
    setGroups: setGroupChats, getMembers: getGroupMembers, getPlayerName: getPlayerDisplayName,
    getPlayerAvatar, sanitizeText, sanitizeImageUrl: sanitizeUserImageUrl, createId: gid,
    generateReplies: runGroupReplyGeneration, connectionErrorPrefix: getConnectionErrorPrefix, tr,
  });
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
          <ChatHeader item={currentChatGroup} modelShort={modelShort} modelFull={modelFull} modelBadgeOpen={modelBadgeOpen} setModelBadgeOpen={setModelBadgeOpen} onBack={() => setCurrentChatGroup(null)} onTogglePinned={() => setGroupChats((prev) => prev.map((group) => group.id === currentChatGroup.id ? { ...group, pinned: !group.pinned } : group))} onOpenSettings={() => openEditGroup(currentChatGroup)} tr={tr} />
          <div className="mp-cm" style={{ paddingTop: 8, paddingLeft: 0, paddingRight: 0, paddingBottom: 0, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div style={{ margin: "0 14px 8px", fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.5, textAlign: "center" }}>
              {tr("群組成員：", "Group members: ", "グループメンバー: ", "그룹 멤버: ")}{members.length ? members.map((m) => m.name).join("、") : tr("暫無成員", "No members yet", "まだメンバーがいません", "아직 멤버가 없습니다")}
            </div>
            {renderSceneBar("group", currentChatGroup.id, tr("場景", "Scene", "シーン", "장면"))}
            <GroupChatContent
              messages={visibleMsgs} isTyping={isTyping} activeMessageId={activeMessageId} setActiveMessageId={setActiveMessageId}
              playerAvatar={getPlayerAvatar()} chatMsgsRef={chatMsgsRef} messagesEndRef={messagesEndRef}
              onScroll={updateScrollToBottomVisibility} isConnectionErrorNotice={isConnectionErrorNotice} onRetry={retryGroupFromNotice}
              onEdit={(message) => setMessageEditor({ id: message.id, content: message.content || "", mode: "online" })}
              onDelete={(message) => {
                if (!window.confirm(tr("確定要刪除這則對話嗎？", "Delete this message?", "このメッセージを削除しますか？", "이 메시지를 삭제할까요?"))) return;
                const next = (currentChatGroup.messages || []).filter((item) => item.id !== message.id);
                setGroupChats((previous) => previous.map((group) => group.id === currentChatGroup.id ? { ...group, messages: next, updatedAt: Date.now() } : group));
                setActiveMessageId(null);
              }}
              showScrollToBottom={showScrollToBottom} onScrollToBottom={scrollCurrentChatToBottom}
              chatImage={chatImage} onClearImage={() => setChatImage(null)} actionPanelOpen={chatActionPanelOpen} setActionPanelOpen={setChatActionPanelOpen}
              fileInputRef={fileInputRef} onImageUpload={handleImgUp} chatInput={chatInput} setChatInput={setChatInput} onSend={sendGroupMessage} tr={tr}
            />
          </div>
        </div>
      );
    }
    if (!currentChatChar) {
      return (
        <ChatListView
          tab={chatListTab}
          setTab={setChatListTab}
          characters={sortChatThreads(characters)}
          chatHistory={chatHistory}
          groups={sortGroupChats(groupChats)}
          proactiveUnread={proactiveUnread}
          closeApp={closeApp}
          openCreateGroup={openCreateGroup}
          onOpenCharacter={(character, unread) => {
            if (Date.now() <= suppressAppClickUntilRef.current) return;
            if (unread) setProactiveUnread((previous) => { const next = { ...previous }; delete next[character.id]; return next; });
            setCurrentChatChar(character);
          }}
          onOpenGroup={(group) => {
            if (Date.now() > suppressAppClickUntilRef.current) setCurrentChatGroup(group);
          }}
          getGroupMembers={getGroupMembers}
          t={t}
          tr={tr}
        />
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
          <ChatHeader item={currentChatChar} modelShort={modelShort} modelFull={modelFull} modelBadgeOpen={modelBadgeOpen} setModelBadgeOpen={setModelBadgeOpen}
            onBack={() => { if (chatSettingsOpen) setChatSettingsOpen(false); else setCurrentChatChar(null); }}
            onTogglePinned={() => toggleChatPin(currentChatChar.id)}
            onOpenSettings={() => { setChatSettingsExpandedBooks({}); setChatSettingsBackgroundOpen(false); setChatSettingsLorebookOpen(false); setChatSettingsThoughtsOpen(false); setThoughtHistoryPage(0); setChatroomManageOpen(false); setChatBgEditor(null); setChatSettingsOpen(true); }}
            tr={tr}
          />
          {chatSettingsOpen ? (
            <ChatSettingsPanel tr={tr}
              mode={{ selectedMode, pending: hasPendingMode, onChange: (mode) => setSelectedChatMode(currentChatChar.id, mode) }}
              innerThought={{ autoEnabled: isInnerThoughtAutoEnabled(currentChatChar.id), onToggleAuto: () => setInnerThoughtAutoEnabled(currentChatChar.id, !isInnerThoughtAutoEnabled(currentChatChar.id)), open: chatSettingsThoughtsOpen, setOpen: setChatSettingsThoughtsOpen, records: thoughtRecords, visibleRecords: visibleThoughtRecords, page: activeThoughtPage, pageCount: thoughtPageCount, setPage: setThoughtHistoryPage, onJump: jumpToThoughtMessage, locale: uiLanguage, sanitizeText }}
              proactive={{ enabled: isProactiveEnabled(currentChatChar.id), frequency: getProactiveFrequency(currentChatChar.id), onToggle: () => setProactiveEnabled(currentChatChar.id, !isProactiveEnabled(currentChatChar.id)), onFrequencyChange: (frequency) => setProactiveFrequency(currentChatChar.id, frequency) }}
              background={{ currentChatChar, chatSettingsBackgroundOpen, setChatSettingsBackgroundOpen, chatBackgrounds, normalizeChatBackground, getChatBackgroundLayerStyle, getChatBackgroundBlurFilter, onChatBackgroundFile, chatBgEditor, setChatBgEditor, updateChatBackground }}
              lorebook={{ chatSettingsLorebookOpen, setChatSettingsLorebookOpen, binding, lorebooks, chatSettingsExpandedBooks, setChatSettingsExpandedBooks, toggleChatLorebookBook, setAllChatLorebookEntries, toggleChatLorebookEntry, cycleChatLorebookEntryMode, currentChatChar, armAppClickSuppression }}
              management={{ open: chatroomManageOpen, setOpen: setChatroomManageOpen, character: currentChatChar, importing: chatroomImporting, importRef: chatroomImportRef, onImportFile: importChatroomFile, onExport: exportChatroomForCharacter, onOpenImport: openChatroomImport, onDelete: deleteChatroomForCharacter }}
            />
          ) : (
            <>
            <DirectMessageList mode={selectedMode} containerStyle={chatCrStyle}
              backgroundLayer={chatBgUrl ? <><div style={{ ...getChatBackgroundLayerStyle(chatBg, 1.08), filter: getChatBackgroundBlurFilter(chatBg), zIndex: 0 }} /><div style={{ position: "absolute", inset: 0, background: isNightTheme ? "rgba(18,12,28,.46)" : "rgba(255,255,255,.52)", pointerEvents: "none", zIndex: 0 }} /></> : null}
              sceneBar={<div style={{ position: "relative", zIndex: 1 }}>{renderSceneBar("char", currentChatChar.id, tr("場景", "Scene", "シーン", "장면"))}</div>}
              messagesRef={chatMsgsRef} messagesEndRef={messagesEndRef}
              onScroll={(element) => {
                updateScrollToBottomVisibility(element);
                if (element.scrollTop > 0 || visibleCount >= msgs.length) return;
                const nextCount = Math.min(msgs.length, visibleCount + 50);
                chatLoadAdjustRef.current = { charId: currentChatChar.id, prevScrollHeight: element.scrollHeight, prevScrollTop: element.scrollTop };
                setChatVisibleCounts((previous) => ({ ...previous, [currentChatChar.id]: nextCount }));
              }}
              hasEarlier={visibleCount < msgs.length} onLoadEarlier={() => {
                const element = chatMsgsRef.current;
                if (!element) return;
                const nextCount = Math.min(msgs.length, visibleCount + 50);
                chatLoadAdjustRef.current = { charId: currentChatChar.id, prevScrollHeight: element.scrollHeight, prevScrollTop: element.scrollTop };
                setChatVisibleCounts((previous) => ({ ...previous, [currentChatChar.id]: nextCount }));
              }}
              isTyping={isTyping} showScrollToBottom={showScrollToBottom}
              scrollButtonBottom={chatActionPanelOpen ? 142 : (chatImage ? 148 : 68)}
              onScrollToBottom={scrollCurrentChatToBottom} tr={tr}
            >
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
                    return <SystemNoticeMessage key={m.id} message={m} share={share} connectionError={isConnectionErrorNotice(m.content)}
                      active={activeMessageId === m.id} isTyping={isTyping}
                      onLongPressStart={() => startNoticeLongPress(m.id)} onLongPressEnd={cancelNoticeLongPress}
                      onRetry={() => retryChatFromNotice(m.id)} onDelete={() => deleteChatMessage(currentChatChar.id, m.id)}
                      applyUserPlaceholder={applyUserPlaceholder} tr={tr} />;
                  }
                const isUser = m.role === "user";
                const isActive = activeMessageId === m.id;
                if (m.role === "transfer") {
                  return <TransferMessage key={m.id} message={m} active={isActive}
                    onToggle={() => setActiveMessageId((previous) => previous === m.id ? null : m.id)}
                    onDelete={() => {
                      if (!window.confirm(tr("刪除後不保留這筆交易紀錄，確定嗎？", "This transaction record will be removed. Continue?", "削除するとこの取引記録は残りません。続けますか？", "삭제하면 이 거래 기록은 남지 않습니다. 계속할까요?"))) return;
                      deleteChatMessage(currentChatChar.id, m.id);
                    }}
                    formatMoney={formatMoney} tr={tr} />;
                }
                const isReality = getMessageMode(m) === "reality";
                const displayContent = stripModeLabel(stripInternalBlocks(m.content));
                if (isReality) {
                  return <RealityChatMessage key={m.id} message={m} isUser={isUser} active={isActive}
                    highlighted={highlightedThoughtMessageId === m.id} displayContent={displayContent}
                    renderedContent={renderRealityText(displayContent)}
                    innerThought={canRenderInnerThought(m) ? renderInnerThought(currentChatChar, m) : null}
                    voiceAction={renderCharacterVoiceAction(currentChatChar, m, isActive, true)}
                    onToggle={() => setActiveMessageId((previous) => previous === m.id ? null : m.id)}
                    onEdit={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}
                  />;
                }
                return <OnlineChatMessage key={m.id} message={m} isUser={isUser} active={isActive}
                  highlighted={highlightedThoughtMessageId === m.id} displayContent={displayContent}
                  innerThought={canRenderInnerThought(m) ? renderInnerThought(currentChatChar, m) : null}
                  voiceAction={renderCharacterVoiceAction(currentChatChar, m, isActive)}
                  onToggle={() => setActiveMessageId((previous) => previous === m.id ? null : m.id)}
                  onEdit={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}
                />;
              })}
            </DirectMessageList>
            <DirectChatComposer image={chatImage} onClearImage={() => setChatImage(null)}
              actionPanelOpen={chatActionPanelOpen} setActionPanelOpen={setChatActionPanelOpen}
              allowTransfer={selectedMode !== "reality"} onOpenTransfer={() => setTransferModalOpen(true)}
              fileInputRef={fileInputRef} onImageUpload={handleImgUp}
              value={chatInput} setValue={setChatInput} textLimit={inputTextLimit} onSend={sendMessage} tr={tr}
            />
            </>
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
    const settingsAppearance = {
      open: settingsAppearanceOpen,
      toggleOpen: () => setSettingsAppearanceOpen((value) => !value),
      themeProps: { t, tr, themeName, setThemeName, fontName, setFontName, effectsEnabled: themeEffectsEnabled, setEffectsEnabled: setThemeEffectsEnabled },
      cssProps: {
        tr, enabled: customCssEnabled, setEnabled: setCustomCssEnabled, draft: customCssDraft, setDraft: setCustomCssDraft,
        notice: customCssNotice, setNotice: setCustomCssNotice, sanitize: sanitizeCustomCss,
        onOpenGuide: () => setCustomCssGuideOpen(true),
        onReset: () => { setCustomCssDraft(""); setCustomCss(""); setCustomCssEnabled(false); setCustomCssNotice(tr("已重設", "Reset", "リセットしました", "초기화됨")); try { localStorage.removeItem("mali_custom_css"); } catch {} },
        onApply: (safe) => { setCustomCssDraft(safe); setCustomCss(safe); setCustomCssEnabled(true); setCustomCssNotice(tr("已儲存並套用", "Saved and applied", "保存して適用しました", "저장 및 적용됨")); try { localStorage.setItem("mali_custom_css", safe); } catch {} },
      },
      heroProps: {
        tr, activeChar, heroFileRef, onHeroFile, heroDraft, setHeroDraft, beginHeroEdit,
        removeHero: () => setCharacters((list) => list.map((item) => item.id === activeChar.id ? { ...item, heroImage: "", heroView: null } : item)),
        startDrag: startHeroSettingDrag, moveDrag: moveHeroSettingDrag, endDrag: endHeroSettingDrag, heroImgStyle, saveDraft: saveHeroDraft,
      },
      interfaceProps: { t, tr, uiLanguage, setUiLanguage, screenLockTimeout, setScreenLockTimeout },
    };
    const settingsApi = {
      presetProps: { tr, activePresetIndex, config: tc, onApplyPreset: applyApiPreset },
      connectionProps: {
        t, tr, open: settingsAiConnOpen, setOpen: setSettingsAiConnOpen, config: tc, setConfig: setTempConfig,
        providers: API_PROVIDERS, modelOptions, fetchingModels, onFetchModels: fetchLatestModels,
        testingConnection, onTest: testApiConnection,
        onProviderChange: (providerId) => { const provider = API_PROVIDERS.find((item) => item.id === providerId); setTempConfig((current) => ({ ...current, provider: provider.id, baseUrl: getProviderBaseUrl(provider.id, current?.baseUrl || ""), model: provider.models[0] || "" })); },
        onSave: () => { setApiConfig(tc); notify(tr("設定已儲存", "Settings saved", "設定を保存しました", "설정이 저장되었습니다"), "Settings saved"); },
        onSavePreset: () => setPresetSavePickerOpen(true),
      },
      voiceProps: {
        tr, open: settingsVoiceOpen, setOpen: setSettingsVoiceOpen, config: ttsConfig, setConfig: setTtsConfig,
        activeConfig: activeTtsConfig, updateConfig: (patch) => { setTtsConnectionState("idle"); setTtsVoices([]); updateActiveTtsConfig(patch); },
        voices: availableTtsVoices, connectionState: ttsConnectionState,
        onLoadVoices: () => void loadElevenLabsDefaultVoices(), onPreview: () => void previewDefaultTtsVoice(),
      },
    };
    const settingsModals = {
      preset: presetSavePickerOpen ? { tr, t, onClose: () => setPresetSavePickerOpen(false), onSave: (index) => { saveApiPreset(index); setPresetSavePickerOpen(false); } } : null,
      dataImport: dataImportPreview ? { tr, preview: dataImportPreview, onCancel: cancelDataImport, onConfirm: confirmImportPreview } : null,
      chatroomImport: chatroomImportPreview ? { tr, preview: chatroomImportPreview, onCancel: cancelChatroomImport, onConfirm: confirmChatroomImportPreview } : null,
    };
    return <SettingsApp
      closeApp={closeApp} t={t} tr={tr} tab={settingsTab} setTab={setSettingsTab} nightTheme={isNightTheme}
      appearance={settingsAppearance} api={settingsApi}
      data={{ syncProps: { tr, notify }, backupProps: { tr, dataImporting, dataImportRef, onExport: exportAllData, onImport: importAllData } }}
      about={{
        infoProps: { tr, version: VERSION, currentChangelogTitle, currentChangelog, versionOpen: settingsVersionOpen, setVersionOpen: setSettingsVersionOpen, disclaimerOpen: settingsDisclaimerOpen, setDisclaimerOpen: setSettingsDisclaimerOpen },
        resetProps: { tr, open: settingsResetDataOpen, setOpen: setSettingsResetDataOpen, clearCacheArmed, onClearAll: clearAllData, onClearCache: clearSiteCache },
      }}
      modals={settingsModals}
    />;
    };

  const renderPlayer = () => <PlayerProfileApp
    t={t} tr={tr} closeApp={closeApp} profile={playerProfile} setProfile={setPlayerProfile}
    avatarRef={playerAvatarRef} sanitizeImage={sanitizeUserImageUrl} onAvatarUpload={handlePlayerAvatarUpload}
    crop={playerAvatarCrop} setCrop={setPlayerAvatarCrop}
    onCropPointerDown={onPlayerAvatarPointerDown} onCropPointerMove={onPlayerAvatarPointerMove} onCropPointerUp={onPlayerAvatarPointerUp}
    onApplyCrop={applyPlayerAvatarCrop}
  />;
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
  if (locked) return (
    <>
      <style>{css}</style>
      <style>{themeCss}</style>
      <LockScreen
        unlocking={unlocking}
        notifications={lockNotifications}
        onOpenNotification={openLockNotification}
        onUnlock={handleUnlock}
        gestureHandlers={{
          onTouchStart: onLockTouchStart,
          onTouchEnd: onLockTouchEnd,
          onMouseDown: onLockMouseDown,
          onMouseUp: onLockMouseUp,
          onPointerDown: onLockPointerDown,
          onPointerUp: onLockPointerUp,
        }}
        ft={ft}
        fd={fd}
        tr={tr}
      />
    </>
  );

  return (<><style>{css}</style><style>{themeCss}</style><div className="mp-wrap" onClickCapture={blockRecentAppClicks}><div className="mp-phone">
    <HomeScreen
      ft={ft} fd={fd} activeCharacter={activeChar} peachTheme={isPeachTheme} tr={tr} currentApp={currentApp}
      pages={homePages} page={homePage} pageSize={PAGE_SIZE} appById={appById} dockApps={dockApps}
      dragging={isDraggingApp} pointerDrag={pointerDrag} renderAppIcon={renderAppIcon}
      gestureHandlers={{ onTouchStart: onHomeTouchStart, onTouchEnd: onHomeTouchEnd, onMouseDown: onHomeMouseDown, onMouseUp: onHomeMouseUp, onPointerDown: onHomePointerDown, onPointerUp: onHomePointerUp, onPointerMove: onHomePointerMove, onPointerCancel: cancelPointerDrag, onDragOver: onHomeDragOverPageEdge }}
      onOpenStatus={() => openApp("status")} onOpenStatusFromTouch={(event) => openAppFromTouch("status", event)}
      onDropGrid={onDropToHomeGrid} onDropSlot={onDropToHome} onDropDockContainer={onDropToDockContainer} onDropDockApp={onDropToDock}
      onOpenApp={(appId) => { if (Date.now() > suppressAppClickUntilRef.current) openApp(appId); }}
      onOpenFromTouch={openAppFromTouch} onPointerDragStart={onPointerDragStartApp}
    />
    <AppRouter currentApp={currentApp} closeApp={closeApp} t={t} tr={tr} game={{ page: gamePage, setPage: setGamePage }} yunyin={{ characters, apiConfig }} renderers={{
      chat: renderChat,
      status: renderStatus,
      social: renderSocial,
      lorebook: renderLorebook,
      characters: renderCharacters,
      settings: renderSettings,
      player: renderPlayer,
      wallet: renderWallet,
      phone: renderPhone,
    }} />
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
            <GroupMemberPicker characters={sortChatThreads(characters)} selectedIds={groupCreateMemberIds} setSelectedIds={setGroupCreateMemberIds} search={groupCreateSearch} setSearch={setGroupCreateSearch} tr={tr} showToast={showToast} />
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
            <GroupMemberPicker characters={sortChatThreads(characters)} selectedIds={groupEditMemberIds} setSelectedIds={setGroupEditMemberIds} search={groupEditSearch} setSearch={setGroupEditSearch} tr={tr} showToast={showToast} />
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
