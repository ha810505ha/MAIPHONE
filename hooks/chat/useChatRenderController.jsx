import React from "react";
import MaliPhoneChatSurface from "../../components/chat/MaliPhoneChatSurface";
import { RealityMessageText } from "../../components/chat/ChatMessageParts";
import { getRetryableTailUserMessage, isPendingRequestForRoom } from "../../services/chat/chatRetryState";
import {
  selectDirectChatThoughts,
  selectMessageRangeIds,
  selectVisibleChatMessages,
} from "../../utils/chatViewSelectors";
import { getChatTextLimit, stripInternalBlocks, stripModeLabel } from "../../utils/chatMessageUtils";
import { sortGroupChats } from "../../utils/chatSorting";
import { selectDueCalendarEvent } from "../../services/calendar/calendarChatAppointments";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

/**
 * Owns the screen-level orchestration for the chat app.
 *
 * ChatView and DirectChatView stay presentation-focused while this controller
 * selects the active branch (group, list, or direct), derives its view data,
 * and wires the existing domain actions into the surface contract.
 */
export default function useChatRenderController({
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
}) {
  const chatPersonaSwitcher = {
    activePersonaId: personaController.activePersonaId,
    personas: personaController.personas,
    onSwitch: (id) => personaController.switchPersona(id, captureCurrentPersona, {
      keepChatCharId: currentChatChar?.id || null,
      keepChatGroupId: currentChatGroup?.id || null,
    }).catch((error) => showToast(error?.message || "無法切換玩家人格")),
  };
  const renderRealityText = (text) => <RealityMessageText text={text} />;

  const renderChat = () => {
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
              if (!window.confirm(tr("確定要刪除這則對話嗎？", "Delete this message?", "このメッセージを削除しますか？", "이 메시지를 삭제할까요？"))) return;
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
    const selectedMode = getSelectedChatMode(currentChatChar.id);
    const committedMode = getLastCommittedChatMode(currentChatChar.id);
    const hasPendingMode = selectedMode !== committedMode;
    const dueCalendarEvent = selectDueCalendarEvent(calendarEvents, currentChatChar.id, new Date(calendarTick));
    const inputTextLimit = getChatTextLimit(selectedMode);
    const currentRoomId = activeRoomIds[currentChatChar.id] || null;
    const currentRoom = (chatRooms[currentChatChar.id] || []).find((room) => room.id === currentRoomId) || null;
    const updateCurrentRoomStory = (patch) => updateCharacterRoomMetadata(currentChatChar.id, (room) => ({
      ...patch,
      storyStatus: patch.storyStatus ? { ...(room.storyStatus || {}), ...patch.storyStatus } : room.storyStatus,
    }));
    const currentRoomPending = isPendingRequestForRoom(directPendingRequest, currentChatChar.id, currentRoomId);
    const hasComposerDraft = !!(chatInput.trim() || chatImage || chatPseudoImage || chatPseudoVoiceMode);
    const retryLastReplyAvailable = !isTyping
      && !currentRoomPending
      && !hasComposerDraft
      && !!getRetryableTailUserMessage(msgs);
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
    const directMessageRendererProps = {
      character: currentChatChar, activeMessageId, setActiveMessageId,
      highlightedThoughtMessageId, isTyping, getModeLabel, getMessageMode, stripModeLabel,
      stripInternalBlocks, parseShareEventNotice, isConnectionErrorNotice, startNoticeLongPress,
      cancelNoticeLongPress, retryChatFromNotice, deleteChatMessage, applyUserPlaceholder,
      formatMoney, renderRealityText, renderInnerThought, canRenderInnerThought,
      renderCharacterVoiceAction, getCharacterVoiceBubblePlayback, setMessageEditor, transfers, onResolveTransfer: resolveTransfer,
      onAddCalendarProposal: addCalendarProposal, onDismissCalendarProposal: dismissCalendarProposal,
      onSelectSwipe: selectAssistantSwipe, onGenerateSwipe: generateAssistantSwipe, onDeleteSwipe: deleteAssistantSwipe,
      onCreateSwipeBranch: (messageId, swipeIndex) => createCharacterBranch(currentChatChar.id, { forkMessageId: messageId, swipeIndex }),
      showThinking,
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
        testQuotaEnabled: apiConfig?.aiSource === "hosted_test",
        rooms: chatRooms[currentChatChar.id] || [],
        activeRoomId: activeRoomIds[currentChatChar.id],
        roomBusy: isTyping || currentRoomPending,
        onSwitchRoom: (roomId) => {
          delete chatScrollPositionsRef.current[`${currentChatChar.id}::${roomId || "default"}`];
          activateCharacterRoom(currentChatChar.id, roomId);
        },
        onCreateRoom: () => createCharacterRoom(currentChatChar.id),
        onCreateBranch: () => createCharacterBranch(currentChatChar.id),
        onRenameRoom: (roomId) => renameCharacterRoom(currentChatChar.id, roomId),
        onDeleteRoom: (roomId) => deleteCharacterRoom(currentChatChar.id, roomId),
        onArchiveRoom: (roomId) => {
          if (isTyping || currentRoomPending) {
            showToast(tr("回覆生成完成後才能收進時光抽屜", "Wait for the reply to finish before archiving", "返信の生成完了後に時の引き出しへ移動できます", "답변 생성이 끝난 뒤 시간 서랍에 넣을 수 있어요"));
            return { ok: false, reason: "busy" };
          }
          const result = archiveCharacterRoom(currentChatChar.id, roomId);
          if (!result?.ok && result?.reason === "last_active") showToast(tr("至少要保留一個可聊天的主聊天室", "Keep at least one active main chat", "チャット可能なメインチャットを1つ残してください", "대화 가능한 메인 채팅을 하나 이상 남겨주세요"));
          else if (result?.ok) showToast(tr("已收進時光抽屜", "Moved to the Time Drawer", "時の引き出しに移動しました", "시간 서랍에 넣었어요"));
          return result;
        },
        onRestoreRoom: (roomId) => {
          const result = restoreCharacterRoom(currentChatChar.id, roomId, true);
          if (result?.ok) showToast(tr("已移回聊天室", "Restored to chats", "チャットに戻しました", "채팅으로 복원했어요"));
          return result;
        },
        onMoveRoom: (roomId, direction) => moveCharacterRoom(currentChatChar.id, roomId, direction),
        onBack: () => { if (chatSettingsOpen) closeChatSettings(); else setCurrentChatChar(null); },
        onTogglePinned: () => toggleChatPin(currentChatChar.id),
        onOpenSettings: () => openChatSettings({ rememberCurrentChatScroll }),
      }}
      directSettingsOpen={chatSettingsOpen}
      directSettings={getDirectSettings({
        character: currentChatChar,
        selectedMode,
        pending: hasPendingMode,
        thoughtRecords,
        visibleThoughtRecords,
        activeThoughtPage,
        thoughtPageCount,
        onJumpToThought: (messageId) => jumpToThoughtMessage(messageId, currentChatChar.id, msgs.length),
        thinking: { enabled: showThinking, onToggle: toggleShowThinking },
        locale: uiLanguage,
        applyUserPlaceholder,
        onEditMemory: (memory) => setMemoryEditor({ charId: currentChatChar.id, memoryId: memory.id, text: memory.text || "" }),
        onTogglePinMemory: (memory) => togglePinMemory(currentChatChar.id, memory.id),
        onDeleteMemory: (memory) => deleteMemory(currentChatChar.id, memory.id),
        armAppClickSuppression,
        story: {
          route: currentRoom,
          onUpdate: updateCurrentRoomStory,
        },
        management: { importing: chatroomImporting, importRef: chatroomImportRef, onImportFile: importChatroomFile, onExport: exportChatroomForCharacter, onOpenImport: openChatroomImport, onClear: () => clearCharacterRoom(currentChatChar.id), onDelete: deleteChatroomForCharacter },
        contact: { blockState: characterBlockState, onBlock: () => setCharacterBlocked(currentChatChar, true), onUnblock: () => setCharacterBlocked(currentChatChar, false) },
      })}
      directBlockBanner={{ playerBlocksCharacter: isCharacterBlocked, characterBlocksPlayer: isPlayerBlockedByCharacter, mode: selectedMode, character: currentChatChar, onUnblock: () => setCharacterBlocked(currentChatChar, false) }}
      directCalendarReminder={{ event: dueCalendarEvent, busy: isTyping, onStart: startDueCalendarStory, onSnooze: snoozeDueCalendarStory, onSkip: skipDueCalendarStory }}
      directStoryStatus={{ storyStatus: currentRoom?.storyStatus, onUpdate: (storyStatus) => updateCurrentRoomStory({ storyStatus }), memoryAction: <button type="button" className="mp-scene-mem-btn" disabled={genLoading} onClick={async (event) => {
        event.stopPropagation();
        const chatMsgs = chatHistory[currentChatChar.id] || [];
        const lastId = chatMsgs.length ? chatMsgs[chatMsgs.length - 1].id : null;
        const noNewChat = lastId != null && lastMemGenMsgId[currentChatChar.id] === lastId;
        const result = await generateMemory(currentChatChar, { silent: true });
        if (!result) return;
        if (result.status === "added" || result.status === "duplicate") setLastMemGenMsgId((prev) => ({ ...prev, [currentChatChar.id]: lastId }));
        setMemoryCard({ ...result, noNewChat });
      }}>{genLoading ? tr("生成中…", "Saving…", "生成中…", "생성 중…") : `✦ ${tr("記憶", "Memory", "記憶", "기억")}`}</button> }}
      directStoryNote={{ note: currentRoom?.storyNote, enabled: currentRoom?.storyNoteEnabled !== false }}
      directMessageList={{
        mode: selectedMode, playerProfile, persona: chatPersonaSwitcher,
        containerStyle: chatCrStyle,
        backgroundLayer: chatBgUrl ? <><div style={{ ...getChatBackgroundLayerStyle(chatBg, 1.08), filter: getChatBackgroundBlurFilter(chatBg), zIndex: 0 }} /><div style={{ position: "absolute", inset: 0, background: isNightTheme ? "rgba(18,12,28,.46)" : "rgba(255,255,255,.52)", pointerEvents: "none", zIndex: 0 }} /></> : null,
        sceneBar: null,
        messagesRef: chatMsgsRef, messagesEndRef,
        scrollKey: `${currentChatChar.id}::${currentRoomId || "default"}`,
        onScroll: (element) => handleDirectChatScroll(element, { characterId: currentChatChar.id, hasEarlier, nextVisibleCount }),
        hasEarlier, onLoadEarlier: () => loadEarlierMessages(currentChatChar.id, nextVisibleCount), isTyping: isTyping || currentRoomPending, showScrollToBottom,
        scrollButtonBottom: chatActionPanelOpen ? 142 : ((chatImage || chatPseudoImage || chatPseudoVoiceMode) ? 148 : 68),
        onScrollToBottom: scrollCurrentChatToBottom,
      }}
      directMessageRenderer={{ ...directMessageRendererProps, messages: visibleMsgs, screenshotSelection: screenshotSelectionProps }}
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
        value: chatInput, setValue: setChatInput, textLimit: inputTextLimit, onSend: sendMessage,
        retryAvailable: retryLastReplyAvailable, onRetryLast: retryLastUnansweredMessage, busy: isTyping || currentRoomPending,
        mode: selectedMode, playerProfile, persona: chatPersonaSwitcher,
        quickActions: currentRoom?.quickActions || [], quickActionsEnabled: currentRoom?.quickActionsEnabled !== false,
        onQuickAction: (action) => {
          const prompt = String(action?.prompt || "").trim();
          if (!prompt) return;
          if (action.behavior === "send") sendMessage(prompt);
          else setChatInput(prompt);
        },
      }}
      screenshot={{ open: chatScreenshotOpen, onClose: () => setChatScreenshotOpen(false), onReselect: () => { setChatScreenshotOpen(false); setChatScreenshotSelection({ active: true, startId: null, endId: null, selectedIds: [] }); }, messages: msgs, initialSelectedIds: chatScreenshotSelection.selectedIds, character: currentChatChar, sceneBar: null, mode: selectedMode, rendererProps: directMessageRendererProps, backgroundUrl: chatBgUrl, isNightTheme }}
      memoryToast={{ card: memoryCard, onClose: () => setMemoryCard(null), applyUserPlaceholder }}
    />;
  };

  return { renderChat };
}
