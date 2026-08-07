import { useState } from "react";
import useChatBackground from "./useChatBackground";
import useChatPromptController from "./useChatPromptController";
import { isArchivedMemory } from "../../services/chat/memoryRecall";
import {
  getLastCommittedChatMode as selectLastCommittedChatMode,
  getModeLabel as localizeChatModeLabel,
  getSelectedChatMode as selectSelectedChatMode,
  getChatTextLimit,
  isChatMode,
} from "../../utils/chatMessageUtils";

/**
 * Owns chat-scoped settings and the adapters consumed by DirectChatView.
 *
 * Keeping the persisted chat options, prompt/lorebook rules, background
 * editing, and their small state transitions in one controller gives new chat
 * settings a stable home instead of adding another branch to MaliPhone.
 */
export default function useChatSettingsController({
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
  createId,
  setChatHistory,
  setChatInput,
  setMemories,
  getOutputLanguageDirective,
  tr,
  sanitizeText,
  sanitizeImageUrl,
  showToast,
}) {
  const [chatModes, setChatModes] = useState(defaultAppState.chatModes);
  const [chatBackgrounds, setChatBackgrounds] = useState(defaultAppState.chatBackgrounds);
  const [chatBgEditor, setChatBgEditor] = useState(null);
  const [chatTimeSettings, setChatTimeSettings] = useState(defaultAppState.chatTimeSettings);
  const [innerThoughtSettings, setInnerThoughtSettings] = useState(defaultAppState.innerThoughtSettings);
  const [proactiveSettings, setProactiveSettings] = useState(defaultAppState.proactiveSettings);
  const [proactiveUnread, setProactiveUnread] = useState(defaultAppState.proactiveUnread);
  const [expandedInnerThoughts, setExpandedInnerThoughts] = useState({});
  const [innerThoughtLoading, setInnerThoughtLoading] = useState({});
  const [memoryEditor, setMemoryEditor] = useState(null);
  const [chatLorebookBindings, setChatLorebookBindings] = useState(defaultAppState.chatLorebookBindings);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSettingsExpandedBooks, setChatSettingsExpandedBooks] = useState({});
  const [chatSettingsBackgroundOpen, setChatSettingsBackgroundOpen] = useState(false);
  const [chatSettingsLorebookOpen, setChatSettingsLorebookOpen] = useState(false);
  const [chatSettingsThoughtsOpen, setChatSettingsThoughtsOpen] = useState(false);
  const [thoughtHistoryPage, setThoughtHistoryPage] = useState(0);
  const [pendingThoughtScrollId, setPendingThoughtScrollId] = useState(null);
  const [highlightedThoughtMessageId, setHighlightedThoughtMessageId] = useState(null);
  const [chatroomManageOpen, setChatroomManageOpen] = useState(false);

  const getModeLabel = (mode) => localizeChatModeLabel(mode, tr);
  const prompt = useChatPromptController({
    chatScenes,
    chatRooms,
    activeRoomIds,
    lorebooks,
    chatLorebookBindings,
    memories,
    gachaSpecialMemories,
    transfers,
    setChatLorebookBindings,
    getOutputLanguageDirective,
    tr,
    sanitizeText,
    getModeLabel,
  });
  const background = useChatBackground({
    setChatBackgrounds,
    setChatBgEditor,
    sanitizeImageUrl,
    showToast,
    tr,
  });

  const isInnerThoughtAutoEnabled = (charId) => innerThoughtSettings?.[charId]?.auto !== false;
  const setInnerThoughtAutoEnabled = (charId, enabled) => {
    setInnerThoughtSettings((previous) => ({
      ...(previous || {}),
      [charId]: { ...(previous?.[charId] || {}), auto: !!enabled },
    }));
  };
  const isChatRealTimeEnabled = (charId) => chatTimeSettings?.[charId]?.enabled !== false;
  const setChatRealTimeEnabled = (charId, enabled) => {
    setChatTimeSettings((previous) => ({
      ...(previous || {}),
      [charId]: { ...(previous?.[charId] || {}), enabled: !!enabled },
    }));
  };
  const isGroupRealTimeEnabled = (group) => group?.useRealTime !== false;
  const isProactiveEnabled = (charId) => !!proactiveSettings?.[charId]?.enabled;
  const getProactiveFrequency = (charId) => proactiveSettings?.[charId]?.frequency || "normal";
  const setProactiveEnabled = (charId, enabled) => {
    setProactiveSettings((previous) => ({
      ...(previous || {}),
      [charId]: { ...(previous?.[charId] || {}), enabled: !!enabled },
    }));
  };
  const setProactiveFrequency = (charId, frequency) => {
    setProactiveSettings((previous) => ({
      ...(previous || {}),
      [charId]: { ...(previous?.[charId] || {}), frequency },
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
    setChatModes((previous) => ({ ...(previous || {}), [charId]: mode }));
    const character = characters.find((item) => String(item.id) === String(charId));
    const openingSource = mode === "reality"
      ? character?.initialRealityMessage
      : (character?.initialOnlineMessage ?? character?.firstMessage);
    const openingContent = sanitizeText(openingSource || "", 4000).trim();
    const currentMessages = chatHistory[charId] || [];
    // A room with only its opening or mode markers can safely switch its
    // opening message. Once a real exchange exists, only the selected mode
    // changes and the send flow adds the transition marker.
    const onlyOpening = currentMessages.every((message) => (
      message?.openingMessage === true || message?.role === "mode_transition"
    ));
    if (onlyOpening) {
      const openingMessage = openingContent
        ? { id: createId(), role: "assistant", content: openingContent, mode, openingMessage: true, time: Date.now() }
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
  const saveEditedMemory = () => {
    if (!memoryEditor) return;
    const nextText = sanitizeText(memoryEditor.text, 500);
    setMemories((previous) => ({
      ...previous,
      [memoryEditor.charId]: (previous[memoryEditor.charId] || []).map((memory) => (
        memory.id === memoryEditor.memoryId ? { ...memory, text: nextText } : memory
      )),
    }));
    setMemoryEditor(null);
    showToast(tr("記憶已更新", "Memory updated", "メモリを更新しました", "기억이 업데이트되었습니다"));
  };
  const openChatSettings = ({ rememberCurrentChatScroll } = {}) => {
    rememberCurrentChatScroll?.();
    setChatSettingsExpandedBooks({});
    setChatSettingsBackgroundOpen(false);
    setChatSettingsLorebookOpen(false);
    setChatSettingsThoughtsOpen(false);
    setThoughtHistoryPage(0);
    setChatroomManageOpen(false);
    setChatBgEditor(null);
    setChatSettingsOpen(true);
  };
  const closeChatSettings = () => setChatSettingsOpen(false);
  const getDirectSettings = ({
    character,
    selectedMode,
    pending = false,
    thoughtRecords = [],
    visibleThoughtRecords = [],
    activeThoughtPage = 0,
    thoughtPageCount = 1,
    onJumpToThought,
    locale,
    applyUserPlaceholder,
    onEditMemory,
    onTogglePinMemory,
    onDeleteMemory,
    armAppClickSuppression,
    story = {},
    management = {},
    contact = {},
  } = {}) => {
    const characterId = character?.id;
    return {
      mode: {
        selectedMode,
        pending,
        onChange: (mode) => setSelectedChatMode(characterId, mode),
      },
      innerThought: {
        autoEnabled: isInnerThoughtAutoEnabled(characterId),
        onToggleAuto: () => setInnerThoughtAutoEnabled(characterId, !isInnerThoughtAutoEnabled(characterId)),
        open: chatSettingsThoughtsOpen,
        setOpen: setChatSettingsThoughtsOpen,
        records: thoughtRecords,
        visibleRecords: visibleThoughtRecords,
        page: activeThoughtPage,
        pageCount: thoughtPageCount,
        setPage: setThoughtHistoryPage,
        onJump: onJumpToThought,
        locale,
        sanitizeText,
      },
      memory: {
        // 聊天設定面板只列活躍記憶；塵封書庫的入口在角色檔案（StatusApp）。
        memories: (memories[characterId] || []).filter((m) => !isArchivedMemory(m)),
        applyUserPlaceholder,
        onEdit: onEditMemory,
        onTogglePin: onTogglePinMemory,
        onDelete: onDeleteMemory,
      },
      proactive: {
        enabled: isProactiveEnabled(characterId),
        frequency: getProactiveFrequency(characterId),
        onToggle: () => setProactiveEnabled(characterId, !isProactiveEnabled(characterId)),
        onFrequencyChange: (frequency) => setProactiveFrequency(characterId, frequency),
      },
      realTime: {
        enabled: isChatRealTimeEnabled(characterId),
        onToggle: () => setChatRealTimeEnabled(characterId, !isChatRealTimeEnabled(characterId)),
      },
      story,
      background: {
        currentChatChar: character,
        chatSettingsBackgroundOpen,
        setChatSettingsBackgroundOpen,
        chatBackgrounds,
        normalizeChatBackground: background.normalizeChatBackground,
        getChatBackgroundLayerStyle: background.getChatBackgroundLayerStyle,
        getChatBackgroundBlurFilter: background.getChatBackgroundBlurFilter,
        onChatBackgroundFile: background.onChatBackgroundFile,
        chatBgEditor,
        setChatBgEditor,
        updateChatBackground: background.updateChatBackground,
      },
      lorebook: {
        chatSettingsLorebookOpen,
        setChatSettingsLorebookOpen,
        binding: characterId ? prompt.getChatLorebookBinding(characterId) : { enabledBookIds: [], entryOverrides: {}, entryModes: {} },
        lorebooks,
        chatSettingsExpandedBooks,
        setChatSettingsExpandedBooks,
        toggleChatLorebookBook: prompt.toggleChatLorebookBook,
        setAllChatLorebookEntries: prompt.setAllChatLorebookEntries,
        toggleChatLorebookEntry: prompt.toggleChatLorebookEntry,
        cycleChatLorebookEntryMode: prompt.cycleChatLorebookEntryMode,
        currentChatChar: character,
        armAppClickSuppression,
      },
      management: {
        open: chatroomManageOpen,
        setOpen: setChatroomManageOpen,
        character,
        ...management,
      },
      contact: {
        character,
        ...contact,
      },
    };
  };

  return {
    chatModes,
    setChatModes,
    chatBackgrounds,
    setChatBackgrounds,
    chatBgEditor,
    setChatBgEditor,
    chatTimeSettings,
    setChatTimeSettings,
    innerThoughtSettings,
    setInnerThoughtSettings,
    proactiveSettings,
    setProactiveSettings,
    proactiveUnread,
    setProactiveUnread,
    expandedInnerThoughts,
    setExpandedInnerThoughts,
    innerThoughtLoading,
    setInnerThoughtLoading,
    memoryEditor,
    setMemoryEditor,
    chatLorebookBindings,
    setChatLorebookBindings,
    chatSettingsOpen,
    setChatSettingsOpen,
    chatSettingsExpandedBooks,
    setChatSettingsExpandedBooks,
    chatSettingsBackgroundOpen,
    setChatSettingsBackgroundOpen,
    chatSettingsLorebookOpen,
    setChatSettingsLorebookOpen,
    chatSettingsThoughtsOpen,
    setChatSettingsThoughtsOpen,
    thoughtHistoryPage,
    setThoughtHistoryPage,
    pendingThoughtScrollId,
    setPendingThoughtScrollId,
    highlightedThoughtMessageId,
    setHighlightedThoughtMessageId,
    chatroomManageOpen,
    setChatroomManageOpen,
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
    prompt,
    background,
  };
}
