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
import { loadFeatureBackup, restoreFeatureBackup, summarizeFeatureBackup } from "./services/featureBackupService";
import { syncOnBoot, schedulePush } from "./services/syncService";
import { createDefaultVoiceSettings, normalizeCharacterVoiceSettings } from "./utils/voiceSettings";
import { sanitizeCustomCss } from "./utils/customCss";
import { calculateCropDrag, clampCropPan, createImageCropState, drawCoverCrop } from "./utils/imageCrop";
import css, { FONT_PRESETS } from "./styles/maliPhoneCss";
import DesktopPet from "./DesktopPet";
import CustomCssGuide from "./CustomCssGuide";
import SettingsApp from "./components/settings/SettingsApp";
import AppRouter from "./components/apps/AppRouter";
import useAppearanceSettings from "./hooks/settings/useAppearanceSettings";
import useThemeRuntime from "./hooks/settings/useThemeRuntime";
import useDirectChatAI from "./hooks/chat/useDirectChatAI";
import useGroupChatAI from "./hooks/chat/useGroupChatAI";
import useGroupChatController from "./hooks/chat/useGroupChatController";
import useInnerThought from "./hooks/chat/useInnerThought";
import usePhoneDataGeneration from "./hooks/phone/usePhoneDataGeneration";
import useCharacterInsights from "./hooks/characters/useCharacterInsights";
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
import GroupChatModals from "./components/chat/GroupChatModals";
import ChatView from "./components/chat/ChatView";
import DirectChatView from "./components/chat/DirectChatView";
import { CharacterVoiceAction, RealityMessageText, SceneBar } from "./components/chat/ChatMessageParts";
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
  const [chatTimeSettings, setChatTimeSettings] = useState(defaultAppState.chatTimeSettings);
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
  const { themeName, setThemeName, fontName, setFontName, fontSizeScale, setFontSizeScale, uiLanguage, setUiLanguage, themeEffectsEnabled, setThemeEffectsEnabled, customCssEnabled, setCustomCssEnabled, customCss, setCustomCss, customCssDraft, setCustomCssDraft, customCssNotice, setCustomCssNotice, customCssGuideOpen, setCustomCssGuideOpen, settingsAppearanceOpen, setSettingsAppearanceOpen, scopedCustomCss } = useAppearanceSettings(defaultAppState);
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
  const [statusMemoryPages, setStatusMemoryPages] = useState({});
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
  setChatTimeSettings(data.chatTimeSettings && typeof data.chatTimeSettings === "object" ? data.chatTimeSettings : defaultAppState.chatTimeSettings);
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
  setFontSizeScale(["normal", "large", "xlarge", "xxlarge"].includes(data.fontSizeScale) ? data.fontSizeScale : defaultAppState.fontSizeScale);
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
  const persistenceSnapshot = { characters, activeCharId, chatHistory, chatModes, chatBackgrounds, groupChats, chatScenes, groupScenes, chatTimeSettings, innerThoughtSettings, proactiveSettings, proactiveUnread, posts, socialSettings, memories, lorebooks, chatLorebookBindings, phoneInboxCache, phoneAppCache, wallet, characterWallets, screenLockTimeout, apiPresets, playerProfile, apiConfig, ttsConfig, themeName, fontName, fontSizeScale, uiLanguage, homeSlots, dockOrder };
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
        setPlayerAvatarCrop(createImageCropState({ src: processed, width, height }));
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
      const size = 320;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawCoverCrop(ctx, img, playerAvatarCrop, size);
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
      return { ...s, ...calculateCropDrag(s, px, py) };
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
      setPhoneViewCharId(null);
      setPhonePage("picker");
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
    // Changing the mode changes message styling/layout. Preserve the user's
    // current position instead of letting the rebuilt list jump to the top.
    const element = chatMsgsRef.current;
    const distanceFromBottom = element
      ? element.scrollHeight - element.scrollTop - element.clientHeight
      : null;
    setChatModes((prev) => ({ ...(prev || {}), [charId]: mode }));
    setChatInput((value) => sanitizeText(value, getChatTextLimit(mode)));
    if (element && distanceFromBottom != null) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const next = chatMsgsRef.current;
        if (!next) return;
        next.scrollTop = Math.max(0, next.scrollHeight - next.clientHeight - distanceFromBottom);
      }));
    }
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
  const generateAssistantForHistory = (args) => generateDirectAssistant({ ...args, includeRealTime: isChatRealTimeEnabled(args.cid) }, {
    formatMessagesForPrompt, pickMemoriesForPrompt, pickLorebookEntriesForPrompt, characterWallets,
    formatMoney, tr, getPlayerContextBlock, estimateTokens, totalContextTokenLimit: TOTAL_CONTEXT_TOKEN_LIMIT,
    apiConfig, applyUserPlaceholder, buildChatSystemPrompt, callAI, sanitizeText, normalizeRealityReply,
    realityChatTextLimit: REALITY_CHAT_TEXT_LIMIT, normalizeAssistantReply, extractTransferDirective,
    stripModeLabel, stripInternalBlocks, splitAssistantBubbles, createId: gid, wait, setChatHistory,
    applyCharacterTransferToPlayer, isInnerThoughtAutoEnabled, generateInnerThought,
  });

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
      const today = proactiveDayKey();
      setProactiveSettings((prev) => ({
        ...prev,
        [cid]: {
          ...(prev?.[cid] || {}),
          proactiveDay: today,
          proactiveCount: (prev?.[cid]?.proactiveDay === today ? Number(prev?.[cid]?.proactiveCount) || 0 : 0) + 1,
        },
      }));
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
  const LOCAL_APP_DATA_KEYS = [
    "maliphone-pet-home",
    "maliphone-pet-settings",
    "maliphone-pet-cooldown-until",
    "mali_yunyin_save_v1",
    "mali_yunyin_crystals_v1",
  ];
  const getLocalAppDataSnapshot = () => LOCAL_APP_DATA_KEYS.reduce((snapshot, key) => {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) snapshot[key] = value;
    } catch {}
    return snapshot;
  }, {});
  const applyLocalAppDataSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    LOCAL_APP_DATA_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(snapshot, key)) return;
      try {
        const value = snapshot[key];
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      } catch {}
    });
    try { window.dispatchEvent(new Event("pet-settings-changed")); } catch {}
  };
  const getExportableAppState = async () => ({
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
      localAppData: getLocalAppDataSnapshot(),
      featureData: await loadFeatureBackup(),
    },
  });
  const downloadJsonFile = async (payload, filename) => {
    const jsonText = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonText], { type: "application/json" });

    // On native Android, write directly to the shared Documents directory.
    // WebView download attributes are not guaranteed to create a visible file.
    if (window.Capacitor?.isNativePlatform?.()) {
      try {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const safeName = String(filename || "maliphone-export.json").replace(/[^a-zA-Z0-9._-]/g, "_");
        const data = btoa(unescape(encodeURIComponent(jsonText)));
        await Filesystem.writeFile({ path: safeName, data, directory: Directory.Documents, recursive: true });
        return { method: "native-filesystem", path: safeName };
      } catch (error) {
        console.warn("[export] native filesystem unavailable, falling back", error);
      }
    }

    // Android WebView does not always honor an anchor's `download` attribute.
    // Prefer the native share/save sheet there so the user can explicitly choose
    // a destination (Files, Drive, messaging app, etc.). Desktop/mobile browsers
    // without file sharing continue to use the normal download flow below.
    const isNativeAndroid = !!window.Capacitor?.isNativePlatform?.() || /Android/i.test(navigator.userAgent || "");
    if (isNativeAndroid && typeof navigator.share === "function" && typeof File === "function") {
      try {
        const file = new File([blob], filename, { type: "application/json" });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return { method: "share" };
        }
      } catch (error) {
        // Closing the share sheet is not an export failure. For unsupported or
        // rejected shares, fall through to the regular browser download.
        if (error?.name === "AbortError") return { method: "cancelled" };
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { method: "download" };
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
      ...summarizeFeatureBackup(src),
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
      chatTimeSettings: src.chatTimeSettings && typeof src.chatTimeSettings === "object" ? src.chatTimeSettings : {},
      innerThoughtSettings: src.innerThoughtSettings && typeof src.innerThoughtSettings === "object" ? src.innerThoughtSettings : {},
      proactiveSettings: src.proactiveSettings && typeof src.proactiveSettings === "object" ? src.proactiveSettings : {},
      proactiveUnread: src.proactiveUnread && typeof src.proactiveUnread === "object" ? src.proactiveUnread : {},
      posts: Array.isArray(src.posts) ? src.posts : [],
      socialSettings: src.socialSettings && typeof src.socialSettings === "object" ? { autoPost: false, enabledCharacterIds: null, frequency: "normal", frequencyByCharacter: {}, ...src.socialSettings } : { autoPost: false, enabledCharacterIds: null, frequency: "normal", frequencyByCharacter: {} },
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
      fontSizeScale: ["normal", "large", "xlarge", "xxlarge"].includes(src.fontSizeScale) ? src.fontSizeScale : defaultAppState.fontSizeScale,
      uiLanguage: src.uiLanguage || defaultAppState.uiLanguage,
      homeSlots: Array.isArray(src.homeSlots) && src.homeSlots.length === HOME_SLOT_COUNT ? src.homeSlots : Array.from({ length: HOME_SLOT_COUNT }, () => null),
      dockOrder: Array.isArray(src.dockOrder) && src.dockOrder.length ? src.dockOrder : DOCK_APPS,
      localAppData: src.localAppData && typeof src.localAppData === "object" ? src.localAppData : {},
    };
    setCharacters(nextState.characters);
    setActiveCharId(nextState.activeCharId);
    setChatHistory(nextState.chatHistory);
    setChatModes(nextState.chatModes);
    setChatBackgrounds(nextState.chatBackgrounds);
    setGroupChats(nextState.groupChats);
    setChatScenes(nextState.chatScenes);
    setGroupScenes(nextState.groupScenes);
    setChatTimeSettings(nextState.chatTimeSettings);
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
    setFontSizeScale(nextState.fontSizeScale || defaultAppState.fontSizeScale);
    setUiLanguage(nextState.uiLanguage);
    setHomeSlots(nextState.homeSlots);
    setDockOrder(nextState.dockOrder);
    applyLocalAppDataSnapshot(nextState.localAppData);
    await restoreFeatureBackup(src);
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
  const { generatePhoneNpcChats, refreshPhonePlayerContact, generatePhoneApp } = usePhoneDataGeneration({
    phoneInboxCache, phoneAppCache, chatHistory, playerProfile, characterWallets, apiConfig,
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


  const { isNightTheme, isPeachTheme, themeCss } = useThemeRuntime({
    themeName,
    fontName,
    fontSizeScale,
    currentApp,
    themeEffectsEnabled,
    scopedCustomCss,
  });

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
    closeApp={closeApp} t={t} tr={tr} characters={sortDisplayCharacters(characters)} chatHistory={chatHistory} memories={memories} posts={posts}
    sanitizeUserImageUrl={sanitizeUserImageUrl} statusExpandedCharId={statusExpandedCharId} setStatusExpandedCharId={setStatusExpandedCharId}
    statusMemoryExpandedCharId={statusMemoryExpandedCharId} setStatusMemoryExpandedCharId={setStatusMemoryExpandedCharId} statusMemoryPages={statusMemoryPages} setStatusMemoryPages={setStatusMemoryPages}
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
    return { pinned, lastAt, openedAt: Number(char?.chatOpenedAt || 0), name: String(char?.name || "") };
  };
  const sortChatThreads = (list) => [...list].sort((a, b) => {
    const am = getChatThreadSortMeta(a);
    const bm = getChatThreadSortMeta(b);
    if (am.pinned !== bm.pinned) return am.pinned ? -1 : 1;
    const aNew = !am.lastAt && !!am.openedAt;
    const bNew = !bm.lastAt && !!bm.openedAt;
    if (aNew !== bNew) return aNew ? -1 : 1;
    if (aNew && bNew && am.openedAt !== bm.openedAt) return bm.openedAt - am.openedAt;
    if (am.lastAt !== bm.lastAt) return bm.lastAt - am.lastAt;
    return am.name.localeCompare(bm.name, "zh-Hant");
  });
  const sortGroupChats = (list) => [...list].sort((a, b) => {
    const am = !!a?.pinned;
    const bm = !!b?.pinned;
    if (am !== bm) return am ? -1 : 1;
    const ao = Number.isFinite(Number(a?.displayOrder)) ? Number(a.displayOrder) : null;
    const bo = Number.isFinite(Number(b?.displayOrder)) ? Number(b.displayOrder) : null;
    if (ao !== null || bo !== null) { if (ao === null) return 1; if (bo === null) return -1; if (ao !== bo) return ao - bo; }
    const at = Number(a?.createdAt || 0), bt = Number(b?.createdAt || 0);
    if (at !== bt) return bt - at;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "zh-Hant");
  });
  const sortDisplayCharacters = (list) => [...list].sort((a, b) => {
    if (!!a.displayPinned !== !!b.displayPinned) return a.displayPinned ? -1 : 1;
    const ao = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : Number.MAX_SAFE_INTEGER;
    const bo = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return characters.indexOf(a) - characters.indexOf(b);
  });
  const moveDisplayCharacter = (charId, direction) => {
    const ordered = sortDisplayCharacters(characters), index = ordered.findIndex((item) => item.id === charId), target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const order = new Map(ordered.map((item, position) => [item.id, position]));
    setCharacters((items) => items.map((item) => ({ ...item, displayOrder: order.get(item.id) })));
  };
  const markChatOpened = (character) => setCharacters((items) => items.map((item) => item.id === character.id ? { ...item, chatOpenedAt: Date.now() } : item));
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
    groupEditGroupId, groupEditMemberIds, groupEditName, groupEditRulePrompt, groupEditUseRealTime, groupEditCover,
    setGroupCoverCrop, setGroupEditCoverCrop, setGroupCreateCover, setGroupEditCover,
    setGroupCreateName, setGroupCreateRulePrompt, setGroupCreateMemberIds, setGroupCreateSearch, setGroupCreateOpen,
    setGroupEditGroupId, setGroupEditName, setGroupEditRulePrompt, setGroupEditUseRealTime, setGroupEditMemberIds, setGroupEditSearch, setGroupEditOpen,
    setGroupChats, setCurrentChatGroup, sanitizeImageUrl: sanitizeUserImageUrl, showToast, notify, tr,
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
    includeRealTime: isGroupRealTimeEnabled(group),
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
      return <ChatView
        currentGroup={currentChatGroup}
        tr={tr}
        group={{
          onPageClick: () => setModelBadgeOpen(false),
          members,
          header: {
            item: currentChatGroup, modelShort, modelFull, modelBadgeOpen, setModelBadgeOpen,
            onBack: () => setCurrentChatGroup(null),
            onTogglePinned: () => setGroupChats((previous) => previous.map((group) => group.id === currentChatGroup.id ? { ...group, pinned: !group.pinned } : group)),
            onOpenSettings: () => openEditGroup(currentChatGroup),
          },
          sceneBar: renderSceneBar("group", currentChatGroup.id, tr("場景", "Scene", "シーン", "장면")),
          content: {
            messages: visibleMsgs, isTyping, activeMessageId, setActiveMessageId,
            playerAvatar: getPlayerAvatar(), chatMsgsRef, messagesEndRef,
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
            setActionPanelOpen: setChatActionPanelOpen, fileInputRef, onImageUpload: handleImgUp,
            chatInput, setChatInput, onSend: sendGroupMessage,
          },
        }}
      />;
    }
    if (!currentChatChar) {
      return <ChatView tr={tr} list={{
        tab: chatListTab, setTab: setChatListTab, characters: sortChatThreads(characters),
        chatHistory, groups: sortGroupChats(groupChats), proactiveUnread, closeApp, openCreateGroup,
        onOpenCharacter: (character, unread) => {
          if (Date.now() <= suppressAppClickUntilRef.current) return;
          if (unread) setProactiveUnread((previous) => { const next = { ...previous }; delete next[character.id]; return next; });
          markChatOpened(character);
          setCurrentChatChar(character);
        },
        onOpenGroup: (group) => {
          if (Date.now() > suppressAppClickUntilRef.current) setCurrentChatGroup(group);
        },
        getGroupMembers, apiConfig, playerProfile, t,
      }} />;
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
      const loadEarlier = () => {
        const element = chatMsgsRef.current;
        if (!element) return;
        const nextCount = Math.min(msgs.length, visibleCount + 50);
        chatLoadAdjustRef.current = { charId: currentChatChar.id, prevScrollHeight: element.scrollHeight, prevScrollTop: element.scrollTop };
        setChatVisibleCounts((previous) => ({ ...previous, [currentChatChar.id]: nextCount }));
      };
      return <ChatView currentCharacter={currentChatChar} tr={tr} directView={<DirectChatView
        onPageClick={() => setModelBadgeOpen(false)}
        tr={tr}
        header={{
          item: currentChatChar, modelShort, modelFull, modelBadgeOpen, setModelBadgeOpen,
          onBack: () => { if (chatSettingsOpen) setChatSettingsOpen(false); else setCurrentChatChar(null); },
          onTogglePinned: () => toggleChatPin(currentChatChar.id),
          onOpenSettings: () => {
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
        settingsOpen={chatSettingsOpen}
        settings={{
          mode: { selectedMode, pending: hasPendingMode, onChange: (mode) => setSelectedChatMode(currentChatChar.id, mode) },
          innerThought: { autoEnabled: isInnerThoughtAutoEnabled(currentChatChar.id), onToggleAuto: () => setInnerThoughtAutoEnabled(currentChatChar.id, !isInnerThoughtAutoEnabled(currentChatChar.id)), open: chatSettingsThoughtsOpen, setOpen: setChatSettingsThoughtsOpen, records: thoughtRecords, visibleRecords: visibleThoughtRecords, page: activeThoughtPage, pageCount: thoughtPageCount, setPage: setThoughtHistoryPage, onJump: jumpToThoughtMessage, locale: uiLanguage, sanitizeText },
          proactive: { enabled: isProactiveEnabled(currentChatChar.id), frequency: getProactiveFrequency(currentChatChar.id), onToggle: () => setProactiveEnabled(currentChatChar.id, !isProactiveEnabled(currentChatChar.id)), onFrequencyChange: (frequency) => setProactiveFrequency(currentChatChar.id, frequency) },
          realTime: { enabled: isChatRealTimeEnabled(currentChatChar.id), onToggle: () => setChatRealTimeEnabled(currentChatChar.id, !isChatRealTimeEnabled(currentChatChar.id)) },
          background: { currentChatChar, chatSettingsBackgroundOpen, setChatSettingsBackgroundOpen, chatBackgrounds, normalizeChatBackground, getChatBackgroundLayerStyle, getChatBackgroundBlurFilter, onChatBackgroundFile, chatBgEditor, setChatBgEditor, updateChatBackground },
          lorebook: { chatSettingsLorebookOpen, setChatSettingsLorebookOpen, binding, lorebooks, chatSettingsExpandedBooks, setChatSettingsExpandedBooks, toggleChatLorebookBook, setAllChatLorebookEntries, toggleChatLorebookEntry, cycleChatLorebookEntryMode, currentChatChar, armAppClickSuppression },
          management: { open: chatroomManageOpen, setOpen: setChatroomManageOpen, character: currentChatChar, importing: chatroomImporting, importRef: chatroomImportRef, onImportFile: importChatroomFile, onExport: exportChatroomForCharacter, onOpenImport: openChatroomImport, onDelete: deleteChatroomForCharacter },
        }}
        messageList={{
          mode: selectedMode,
          containerStyle: chatCrStyle,
          backgroundLayer: chatBgUrl ? <><div style={{ ...getChatBackgroundLayerStyle(chatBg, 1.08), filter: getChatBackgroundBlurFilter(chatBg), zIndex: 0 }} /><div style={{ position: "absolute", inset: 0, background: isNightTheme ? "rgba(18,12,28,.46)" : "rgba(255,255,255,.52)", pointerEvents: "none", zIndex: 0 }} /></> : null,
          sceneBar: <div style={{ position: "relative", zIndex: 1 }}>{renderSceneBar("char", currentChatChar.id, tr("場景", "Scene", "シーン", "장면"))}</div>,
          messagesRef: chatMsgsRef, messagesEndRef,
          onScroll: (element) => {
            updateScrollToBottomVisibility(element);
            if (element.scrollTop > 0 || visibleCount >= msgs.length) return;
            const nextCount = Math.min(msgs.length, visibleCount + 50);
            chatLoadAdjustRef.current = { charId: currentChatChar.id, prevScrollHeight: element.scrollHeight, prevScrollTop: element.scrollTop };
            setChatVisibleCounts((previous) => ({ ...previous, [currentChatChar.id]: nextCount }));
          },
          hasEarlier: visibleCount < msgs.length, onLoadEarlier: loadEarlier, isTyping, showScrollToBottom,
          scrollButtonBottom: chatActionPanelOpen ? 142 : (chatImage ? 148 : 68),
          onScrollToBottom: scrollCurrentChatToBottom,
        }}
        messageRenderer={{
          messages: visibleMsgs, character: currentChatChar, activeMessageId, setActiveMessageId,
          highlightedThoughtMessageId, isTyping, getModeLabel, getMessageMode, stripModeLabel,
          stripInternalBlocks, parseShareEventNotice, isConnectionErrorNotice, startNoticeLongPress,
          cancelNoticeLongPress, retryChatFromNotice, deleteChatMessage, applyUserPlaceholder,
          formatMoney, renderRealityText, renderInnerThought, canRenderInnerThought,
          renderCharacterVoiceAction, setMessageEditor,
        }}
        composer={{
          image: chatImage, onClearImage: () => setChatImage(null), actionPanelOpen: chatActionPanelOpen,
          setActionPanelOpen: setChatActionPanelOpen, allowTransfer: selectedMode !== "reality",
          onOpenTransfer: () => setTransferModalOpen(true), fileInputRef, onImageUpload: handleImgUp,
          character: currentChatChar, onGiftEpisodeStarted: () => { setCurrentChatChar(null); setChatListTab("episodes"); },
          value: chatInput, setValue: setChatInput, textLimit: inputTextLimit, onSend: sendMessage,
        }}
      />} />;
    }
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
    t={t} closeApp={closeApp} characters={sortDisplayCharacters(characters)} activeCharId={activeCharId} sanitizeImage={sanitizeUserImageUrl}
    onAdd={() => { setEditingCharacter(null); setModal("addChar"); }}
    onSetActive={(character) => { setActiveCharId(character.id); showToast(`${character.name} ${t("setAsMainCharacter")}`); }}
    onChat={(character) => { markChatOpened(character); setCurrentChatChar(character); openApp("chat"); }}
    onView={(character) => { setEditingCharacter(character); setModal("addChar"); }}
    onSaveDisplayOrder={(draft) => {
      const meta = new Map(draft.map((item, index) => [item.id, { displayOrder: index, displayPinned: !!item.pinned }]));
      setCharacters((items) => items.map((item) => ({ ...item, ...(meta.get(item.id) || {}) })));
      showToast("角色順序已儲存");
    }}
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
      return { ...old, x: clampCropPan(drag.x + (event.clientX - drag.px) / (2 * z), 50), y: clampCropPan(drag.y + (event.clientY - drag.py) / (1.5 * z), 50) };
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
      themeProps: { t, tr, themeName, setThemeName, fontName, setFontName, fontSizeScale, setFontSizeScale, effectsEnabled: themeEffectsEnabled, setEffectsEnabled: setThemeEffectsEnabled },
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
      interfaceProps: { t, tr, uiLanguage, setUiLanguage, fontSizeScale, setFontSizeScale, screenLockTimeout, setScreenLockTimeout },
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
    characters={sortDisplayCharacters(characters)} chatHistory={chatHistory} phoneInboxCache={phoneInboxCache} characterWallets={characterWallets} playerProfile={playerProfile}
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
    <AppRouter currentApp={currentApp} closeApp={closeApp} t={t} tr={tr} game={{ page: gamePage, setPage: setGamePage, characters, onOpenChat: () => { setCurrentApp("chat"); setCurrentChatChar(null); setCurrentChatGroup(null); setChatListTab("episodes"); } }} yunyin={{ characters, apiConfig }} apiConfig={apiConfig} renderers={{
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
    <GroupChatModals
      characters={sortChatThreads(characters)}
      tr={tr}
      showToast={showToast}
      create={{
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
      }}
      edit={{
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
      }}
      crop={{
        createValue: groupCoverCrop,
        setCreateValue: setGroupCoverCrop,
        editValue: groupEditCoverCrop,
        setEditValue: setGroupEditCoverCrop,
        onApply: applyGroupCoverCrop,
        onClose: () => {
          setGroupCoverCrop(null);
          setGroupEditCoverCrop(null);
        },
      }}
    />
      {toast && <div className="mp-toast">{toast}</div>}
  </div></div></>);
}
