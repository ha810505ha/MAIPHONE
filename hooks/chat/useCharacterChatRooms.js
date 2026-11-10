import { useEffect, useRef, useState } from "react";
import { normalizePersistedPseudoVoiceMessages } from "../../utils/pseudoVoice";
import { isRequestRoomActive, updateMessagesInRoomList } from "../../services/chat/chatRoomRouting.js";
import { replaceAssistantSwipeGroup } from "../../utils/assistantSwipeGroups.js";
import { STORY_VISIBILITY_DEFAULTS, normalizeStoryVisibility } from "../../constants/storyStatus.js";
import { normalizeRealityOutputTokens } from "../../utils/realityOutputSettings.js";

export default function useCharacterChatRooms({
  characters,
  setCharacters,
  chatHistory,
  setChatHistory,
  memories,
  setMemories,
  chatScenes,
  setChatScenes,
  currentChatChar,
  setCurrentChatChar,
  setChatInput,
  setChatImage,
  setActiveMessageId,
  setMessageEditor,
  setIsTyping,
  setChatVisibleCounts,
  createId,
  sanitizeText,
  tr,
}) {
  const [chatRooms, setChatRooms] = useState({});
  const [activeRoomIds, setActiveRoomIds] = useState({});
  const switchingRef = useRef(false);
  const activeRoomIdsRef = useRef(activeRoomIds);
  activeRoomIdsRef.current = activeRoomIds;
  const emptyScene = () => ({ location: "", note: "" });
  const createDefaultQuickActions = () => ([
    { id: "continue", label: "繼續劇情", prompt: "請自然地延續目前劇情。", behavior: "fill" },
    { id: "night", label: "跳到晚上", prompt: "時間跳到晚上，請自然描寫後續。", behavior: "fill" },
    { id: "scene", label: "換場景", prompt: "請自然地帶我們換到下一個適合的場景。", behavior: "fill" },
    { id: "initiative", label: "讓他主動", prompt: "讓對方自然地主動推進互動。", behavior: "fill" },
  ]);
  const normalizeStoryStatus = (status) => ({
    relationship: typeof status?.relationship === "string" ? status.relationship : "",
    scene: typeof status?.scene === "string" ? status.scene : "",
    mood: typeof status?.mood === "string" ? status.mood : "",
    current: typeof status?.current === "string" ? status.current : "",
    thread: typeof status?.thread === "string" ? status.thread : "",
    playerNote: typeof status?.playerNote === "string" ? status.playerNote : "",
    visibility: {
      thread: normalizeStoryVisibility(status?.visibility?.thread, STORY_VISIBILITY_DEFAULTS.thread),
      playerNote: normalizeStoryVisibility(status?.visibility?.playerNote, STORY_VISIBILITY_DEFAULTS.playerNote),
    },
  });
  const normalizeRoomStoryData = (room) => {
    const storyStatus = normalizeStoryStatus(room.storyStatus);
    const legacyScene = room.scene && typeof room.scene === "object" ? room.scene : emptyScene();
    const legacySceneText = [legacyScene.location, legacyScene.note]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" · ");
    // One-time, non-destructive migration: never overwrite a route that already has a current scene.
    if (!room.legacySceneMigrated && !storyStatus.scene.trim() && legacySceneText) storyStatus.scene = legacySceneText;
    return {
      ...room,
      archivedAt: Number(room.archivedAt) > 0 ? Number(room.archivedAt) : null,
      legacySceneMigrated: true,
      storyNote: typeof room.storyNote === "string" ? room.storyNote : "",
      storyNoteEnabled: room.storyNoteEnabled !== false,
      realityMaxTokens: normalizeRealityOutputTokens(room.realityMaxTokens),
      storyStatus,
      quickActionsEnabled: room.quickActionsEnabled !== false,
      quickActions: Array.isArray(room.quickActions) && room.quickActions.length ? room.quickActions.slice(0, 8) : createDefaultQuickActions(),
    };
  };
  const createOpeningMessage = (character, mode = "online") => {
    const source = mode === "reality"
      ? character?.initialRealityMessage
      : (character?.initialOnlineMessage ?? character?.firstMessage);
    const content = sanitizeText(source || "", 4000).trim();
    return content ? { id: createId(), role: "assistant", content, mode, openingMessage: true, time: Date.now() } : null;
  };

  const loadRoomState = (data, loadedCharacters) => {
    const loadedRooms = data.chatRooms && typeof data.chatRooms === "object" ? data.chatRooms : {};
    const loadedActiveIds = data.activeRoomIds && typeof data.activeRoomIds === "object" ? data.activeRoomIds : {};
    const loadedScenes = data.chatScenes && typeof data.chatScenes === "object" ? data.chatScenes : {};
    const migratedRooms = { ...loadedRooms };
    const migratedActiveIds = { ...loadedActiveIds };
    const activeHistory = Object.fromEntries(
      Object.entries(data.chatHistory || {}).map(([characterId, messages]) => [
        characterId,
        normalizePersistedPseudoVoiceMessages(messages),
      ]),
    );
    const activeMemories = { ...(data.memories || {}) };
    const activeScenes = { ...loadedScenes };
    const hydratedCharacters = loadedCharacters.map((character) => {
      const cid = character.id;
      if (character.chatroomDeleted) {
        delete migratedRooms[cid];
        delete migratedActiveIds[cid];
        delete activeHistory[cid];
        delete activeMemories[cid];
        delete activeScenes[cid];
        return character;
      }
      let rooms = Array.isArray(migratedRooms[cid]) ? migratedRooms[cid].filter((room) => room?.id) : [];
      // Older saves were all standalone rooms. Preserve them as root conversations.
      rooms = rooms.map((room) => ({
        ...room,
        roomType: room.roomType === "branch" ? "branch" : "root",
        parentRoomId: room.parentRoomId || null,
        forkMessageId: room.forkMessageId || null,
      })).map((room, index) => !room.parentRoomId ? {
        ...room,
        sortOrder: Number.isFinite(Number(room.sortOrder)) ? Number(room.sortOrder) : index,
      } : room);
      if (!rooms.length) {
        const roomId = `room_${cid}_legacy`;
        rooms = [normalizeRoomStoryData({ id: roomId, roomType: "root", parentRoomId: null, forkMessageId: null, sortOrder: 0, archivedAt: null, title: tr("原本的聊天室", "Original chat", "元のチャット", "기존 채팅"), messages: activeHistory[cid] || [], memories: activeMemories[cid] || [], scene: loadedScenes[cid] || emptyScene(), statusText: character.statusText || "", statusUpdatedAt: character.statusUpdatedAt || 0, createdAt: character.createdAt || Date.now(), updatedAt: Date.now() })];
        migratedRooms[cid] = rooms;
        migratedActiveIds[cid] = roomId;
      }
      const activeCandidates = rooms.filter((room) => {
        let cursor = room;
        const visited = new Set();
        while (cursor?.parentRoomId && !visited.has(cursor.id)) {
          visited.add(cursor.id);
          cursor = rooms.find((item) => item.id === cursor.parentRoomId);
        }
        return !cursor?.archivedAt;
      });
      const activeId = activeCandidates.some((room) => room.id === migratedActiveIds[cid])
        ? migratedActiveIds[cid]
        : (activeCandidates[0]?.id || rooms[0].id);
      migratedActiveIds[cid] = activeId;
      // 舊資料的場景只綁角色：把它視為「作用中聊天室」的場景補進去；其餘聊天室各自維持自己的場景（沒有就空白）。
      rooms = rooms.map((room) => {
        let hydratedRoom = room;
        if (room.activeDataInTopLevel && room.id === activeId) {
          hydratedRoom = {
            ...room,
            messages: Array.isArray(activeHistory[cid]) ? activeHistory[cid] : [],
            memories: Array.isArray(activeMemories[cid]) ? activeMemories[cid] : [],
            scene: loadedScenes[cid] || emptyScene(),
            activeDataInTopLevel: undefined,
          };
        } else if (!room.scene || typeof room.scene !== "object") {
          hydratedRoom = room.id === activeId && loadedScenes[cid]
            ? { ...room, scene: loadedScenes[cid] }
            : { ...room, scene: emptyScene() };
        }
        const normalizedMessages = normalizePersistedPseudoVoiceMessages(hydratedRoom.messages);
        const normalizedRoom = normalizedMessages === hydratedRoom.messages
          ? hydratedRoom
          : { ...hydratedRoom, messages: normalizedMessages };
        return normalizeRoomStoryData(normalizedRoom);
      });
      migratedRooms[cid] = rooms;
      const activeRoom = rooms.find((room) => room.id === activeId) || rooms[0];
      activeHistory[cid] = Array.isArray(activeRoom.messages) ? activeRoom.messages : [];
      activeMemories[cid] = Array.isArray(activeRoom.memories) ? activeRoom.memories : [];
      activeScenes[cid] = activeRoom.scene || emptyScene();
      return { ...character, statusText: activeRoom.statusText || "", statusUpdatedAt: activeRoom.statusUpdatedAt || 0 };
    });
    setChatRooms(migratedRooms);
    setActiveRoomIds(migratedActiveIds);
    return { characters: hydratedCharacters, chatHistory: activeHistory, memories: activeMemories, chatScenes: activeScenes };
  };

  useEffect(() => {
    if (switchingRef.current) return;
    setChatRooms((previous) => {
      let changed = false;
      const next = { ...previous };
      characters.forEach((character) => {
        const cid = character.id;
        const roomId = activeRoomIds[cid];
        const rooms = Array.isArray(previous[cid]) ? previous[cid] : [];
        const index = rooms.findIndex((room) => room.id === roomId);
        if (index < 0) return;
        const room = rooms[index];
        const messages = chatHistory[cid] || [];
        const roomMemories = memories[cid] || [];
        const roomScene = chatScenes[cid] || emptyScene();
        const sceneSame = (room.scene?.location || "") === (roomScene.location || "") && (room.scene?.note || "") === (roomScene.note || "");
        if (room.messages === messages && room.memories === roomMemories && room.statusText === (character.statusText || "") && room.statusUpdatedAt === (character.statusUpdatedAt || 0) && sceneSame) return;
        const updatedRooms = [...rooms];
        updatedRooms[index] = { ...room, messages, memories: roomMemories, scene: roomScene, statusText: character.statusText || "", statusUpdatedAt: character.statusUpdatedAt || 0, updatedAt: Date.now() };
        next[cid] = updatedRooms;
        changed = true;
      });
      return changed ? next : previous;
    });
  }, [chatHistory, memories, chatScenes, characters, activeRoomIds]);

  const snapshotActiveRoom = (characterId, sourceRooms = chatRooms) => {
    const rooms = Array.isArray(sourceRooms[characterId]) ? sourceRooms[characterId] : [];
    const activeId = activeRoomIds[characterId];
    const character = characters.find((item) => String(item.id) === String(characterId));
    return rooms.map((room) => room.id === activeId ? { ...room, messages: chatHistory[characterId] || [], memories: memories[characterId] || [], scene: chatScenes[characterId] || emptyScene(), statusText: character?.statusText || "", statusUpdatedAt: character?.statusUpdatedAt || 0, updatedAt: Date.now() } : room);
  };

  const updateRoomMessages = (characterId, roomId, updater) => {
    if (!characterId || typeof updater !== "function") return;
    const applyUpdate = (messages) => {
      const current = Array.isArray(messages) ? messages : [];
      const next = updater(current);
      return Array.isArray(next) ? next : current;
    };
    const currentRooms = Array.isArray(chatRooms[characterId]) ? chatRooms[characterId] : [];
    const requestRoot = (() => {
      let room = currentRooms.find((item) => item.id === roomId) || null;
      const visited = new Set();
      while (room?.parentRoomId && !visited.has(room.id)) {
        visited.add(room.id);
        room = currentRooms.find((item) => item.id === room.parentRoomId) || null;
      }
      return room;
    })();
    if (requestRoot?.archivedAt) return;
    if (isRequestRoomActive(activeRoomIdsRef.current, characterId, roomId)) {
      setChatHistory((previous) => ({
        ...previous,
        [characterId]: applyUpdate(previous[characterId]),
      }));
      return;
    }
    setChatRooms((previous) => {
      const rooms = Array.isArray(previous[characterId]) ? previous[characterId] : [];
      const root = findRootRoom(rooms, roomId);
      if (root?.archivedAt) return previous;
      const nextRooms = updateMessagesInRoomList(rooms, roomId, applyUpdate);
      if (nextRooms === rooms) return previous;
      return { ...previous, [characterId]: nextRooms };
    });
  };

  const activateRoom = (characterId, roomId, sourceRooms = chatRooms) => {
    const savedRooms = snapshotActiveRoom(characterId, sourceRooms);
    const room = savedRooms.find((item) => item.id === roomId);
    if (!room) return;
    switchingRef.current = true;
    activeRoomIdsRef.current = { ...activeRoomIdsRef.current, [characterId]: roomId };
    setChatRooms((previous) => ({ ...previous, [characterId]: savedRooms }));
    setActiveRoomIds((previous) => ({ ...previous, [characterId]: roomId }));
    setChatHistory((previous) => ({ ...previous, [characterId]: Array.isArray(room.messages) ? room.messages : [] }));
    setMemories((previous) => ({ ...previous, [characterId]: Array.isArray(room.memories) ? room.memories : [] }));
    setChatScenes((previous) => ({ ...previous, [characterId]: room.scene || emptyScene() }));
    setCharacters((previous) => previous.map((character) => String(character.id) === String(characterId) ? { ...character, statusText: room.statusText || "", statusUpdatedAt: room.statusUpdatedAt || 0 } : character));
    setCurrentChatChar((current) => current && String(current.id) === String(characterId) ? { ...current, statusText: room.statusText || "", statusUpdatedAt: room.statusUpdatedAt || 0 } : current);
    setChatInput(""); setChatImage(null); setActiveMessageId(null); setMessageEditor(null); setIsTyping(false);
    setChatVisibleCounts((previous) => ({ ...previous, [characterId]: 50 }));
    setTimeout(() => { switchingRef.current = false; }, 0);
  };

  const createRoom = (characterId) => {
    const title = window.prompt(tr("輸入新對話名稱", "Name the new chat", "新しい会話名", "새 대화 이름"), tr("新的對話", "New chat", "新しい会話", "새 대화"));
    if (title === null) return;
    const savedRooms = snapshotActiveRoom(characterId);
    const now = Date.now();
    const character = characters.find((item) => String(item.id) === String(characterId));
    const openingMessage = createOpeningMessage(character, "online");
    const nextSortOrder = savedRooms.reduce((maximum, item) => !item.parentRoomId ? Math.max(maximum, Number(item.sortOrder) || 0) : maximum, -1) + 1;
    const room = normalizeRoomStoryData({ id: createId(), roomType: "root", parentRoomId: null, forkMessageId: null, sortOrder: nextSortOrder, archivedAt: null, title: sanitizeText(title, 60).trim() || tr("新的對話", "New chat", "新しい会話", "새 대화"), messages: openingMessage ? [openingMessage] : [], memories: [], scene: emptyScene(), statusText: "", statusUpdatedAt: 0, createdAt: now, updatedAt: now });
    const nextRooms = [...savedRooms, room];
    setChatRooms((previous) => ({ ...previous, [characterId]: nextRooms }));
    activateRoom(characterId, room.id, { ...chatRooms, [characterId]: nextRooms });
  };

  const createBranch = (characterId, options = {}) => {
    const savedRooms = snapshotActiveRoom(characterId);
    const parentRoomId = activeRoomIds[characterId];
    const parent = savedRooms.find((room) => room.id === parentRoomId);
    if (!parent) return;

    const sourceMessages = Array.isArray(parent.messages) ? parent.messages : [];
    const requestedIndex = options.forkMessageId
      ? sourceMessages.findIndex((message) => message.id === options.forkMessageId)
      : sourceMessages.length - 1;
    if (requestedIndex < 0) return;

    const forkMessage = sourceMessages[requestedIndex];
    const selectedSwipeIndex = Number.isInteger(options.swipeIndex) ? options.swipeIndex : null;
    const forkedMessages = selectedSwipeIndex == null
      ? sourceMessages.slice(0, requestedIndex + 1)
      : replaceAssistantSwipeGroup(sourceMessages.slice(0, requestedIndex + 1), forkMessage.id, selectedSwipeIndex, createId);
    const messages = forkedMessages.map((message) => {
      const { swipes, swipeIndex, ...plainMessage } = message;
      return plainMessage;
    });
    const now = Date.now();
    const branchNumber = savedRooms.filter((room) => room.parentRoomId === parentRoomId).length + 1;
    const title = `${tr("分支", "Branch", "分岐", "분기")} ${branchNumber}`;
    const branch = normalizeRoomStoryData({
      id: createId(),
      roomType: "branch",
      parentRoomId,
      forkMessageId: forkMessage.id,
      title,
      messages,
      memories: Array.isArray(parent.memories) ? [...parent.memories] : [],
      scene: parent.scene || emptyScene(),
      statusText: parent.statusText || "",
      statusUpdatedAt: parent.statusUpdatedAt || 0,
      storyNote: parent.storyNote || "",
      storyNoteEnabled: parent.storyNoteEnabled !== false,
      realityMaxTokens: normalizeRealityOutputTokens(parent.realityMaxTokens),
      storyStatus: normalizeStoryStatus(parent.storyStatus),
      quickActionsEnabled: parent.quickActionsEnabled !== false,
      quickActions: Array.isArray(parent.quickActions) ? parent.quickActions.map((action) => ({ ...action })) : createDefaultQuickActions(),
      createdAt: now,
      updatedAt: now,
    });
    const nextRooms = [...savedRooms, branch];
    setChatRooms((previous) => ({ ...previous, [characterId]: nextRooms }));
    activateRoom(characterId, branch.id, { ...chatRooms, [characterId]: nextRooms });
  };

  const updateActiveRoomMetadata = (characterId, updater) => {
    if (!characterId || typeof updater !== "function") return;
    const savedRooms = snapshotActiveRoom(characterId);
    const activeId = activeRoomIds[characterId];
    const nextRooms = savedRooms.map((room) => (
      room.id === activeId
        ? normalizeRoomStoryData({ ...room, ...updater(normalizeRoomStoryData(room)), updatedAt: Date.now() })
        : room
    ));
    setChatRooms((previous) => ({ ...previous, [characterId]: nextRooms }));
  };

  const findRootRoom = (rooms, roomId) => {
    let room = rooms.find((item) => item.id === roomId) || null;
    const visited = new Set();
    while (room?.parentRoomId && !visited.has(room.id)) {
      visited.add(room.id);
      room = rooms.find((item) => item.id === room.parentRoomId) || null;
    }
    return room;
  };

  const archiveRoom = (characterId, roomId) => {
    const rooms = snapshotActiveRoom(characterId);
    const root = findRootRoom(rooms, roomId);
    if (!root || root.archivedAt) return { ok: false, reason: "not_found" };
    const availableRoots = rooms
      .filter((room) => !room.parentRoomId && !room.archivedAt && room.id !== root.id)
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
    if (!availableRoots.length) return { ok: false, reason: "last_active" };
    const nextRooms = rooms.map((room) => room.id === root.id ? { ...room, archivedAt: Date.now(), updatedAt: Date.now() } : room);
    const activeRoot = findRootRoom(rooms, activeRoomIds[characterId]);
    if (activeRoot?.id === root.id) {
      activateRoom(characterId, availableRoots[0].id, { ...chatRooms, [characterId]: nextRooms });
    } else {
      setChatRooms((previous) => ({ ...previous, [characterId]: nextRooms }));
    }
    return { ok: true };
  };

  const restoreRoom = (characterId, roomId, activate = false) => {
    const rooms = snapshotActiveRoom(characterId);
    const root = findRootRoom(rooms, roomId);
    if (!root?.archivedAt) return { ok: false, reason: "not_found" };
    const nextRooms = rooms.map((room) => room.id === root.id
      ? { ...room, archivedAt: null, updatedAt: Date.now() }
      : room);
    if (activate) activateRoom(characterId, root.id, { ...chatRooms, [characterId]: nextRooms });
    else setChatRooms((previous) => ({ ...previous, [characterId]: nextRooms }));
    return { ok: true };
  };

  const moveRoom = (characterId, roomId, direction) => {
    const rooms = snapshotActiveRoom(characterId);
    const roots = rooms
      .filter((room) => !room.parentRoomId && !room.archivedAt)
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
    const index = roots.findIndex((room) => room.id === roomId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= roots.length) return { ok: false, reason: "edge" };
    const current = roots[index];
    const target = roots[targetIndex];
    const currentOrder = Number.isFinite(Number(current.sortOrder)) ? Number(current.sortOrder) : index;
    const targetOrder = Number.isFinite(Number(target.sortOrder)) ? Number(target.sortOrder) : targetIndex;
    setChatRooms((previous) => ({
      ...previous,
      [characterId]: (previous[characterId] || []).map((room) => room.id === current.id
        ? { ...room, sortOrder: targetOrder }
        : room.id === target.id
          ? { ...room, sortOrder: currentOrder }
          : room),
    }));
    return { ok: true };
  };

  const renameRoom = (characterId, roomId = activeRoomIds[characterId]) => {
    const rooms = chatRooms[characterId] || [];
    const current = rooms.find((room) => room.id === roomId);
    if (!current) return;
    const title = window.prompt(tr("重新命名對話", "Rename chat", "会話名を変更", "대화 이름 변경"), current.title || "");
    if (title === null || !sanitizeText(title, 60).trim()) return;
    setChatRooms((previous) => ({ ...previous, [characterId]: (previous[characterId] || []).map((room) => room.id === roomId ? { ...room, title: sanitizeText(title, 60).trim(), updatedAt: Date.now() } : room) }));
    return { ok: true };
  };

  const deleteRoom = (characterId, roomId = activeRoomIds[characterId]) => {
    const rooms = snapshotActiveRoom(characterId);
    if (rooms.length <= 1) return;
    const activeId = activeRoomIds[characterId];
    const current = rooms.find((room) => room.id === roomId);
    const rootCount = rooms.filter((room) => !room.parentRoomId && !room.archivedAt).length;
    if (!current?.parentRoomId && !current?.archivedAt && rootCount <= 1) return { ok: false, reason: "last_active" };
    const message = tr(`確定刪除「${current?.title || "這個對話"}」？其中的訊息與記憶會一併刪除。`, `Delete “${current?.title || "this chat"}”? Its messages and memories will also be deleted.`, `「${current?.title || "この会話"}」を削除しますか？メッセージと記憶も削除されます。`, `“${current?.title || "이 대화"}”를 삭제할까요? 메시지와 기억도 함께 삭제됩니다.`);
    if (!window.confirm(message)) return;
    const deletedIds = new Set([roomId]);
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      rooms.forEach((room) => {
        if (room.parentRoomId && deletedIds.has(room.parentRoomId) && !deletedIds.has(room.id)) {
          deletedIds.add(room.id);
          foundChild = true;
        }
      });
    }
    const remaining = rooms.filter((room) => !deletedIds.has(room.id));
    if (deletedIds.has(activeId)) {
      const nextActive = remaining
        .filter((room) => !room.parentRoomId && !room.archivedAt)
        .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))[0] || remaining[0];
      activateRoom(characterId, nextActive.id, { ...chatRooms, [characterId]: remaining });
    } else {
      setChatRooms((previous) => ({ ...previous, [characterId]: remaining }));
    }
    return { ok: true };
  };

  const clearRoom = (characterId) => {
    const rooms = snapshotActiveRoom(characterId);
    const activeId = activeRoomIds[characterId];
    const current = rooms.find((room) => room.id === activeId);
    if (!current) return;
    const message = tr(`確定要清空「${current.title || "目前聊天室"}」嗎？其中的訊息、記憶與場景會被清除，但聊天室本身會保留。`, `Clear “${current.title || "the current chat"}”? Its messages, memories, and scene will be removed, but the chatroom will remain.`, `「${current.title || "現在のチャット"}」を空にしますか？メッセージ・記憶・シーンは削除されますが、チャットルームは残ります。`, `“${current.title || "현재 채팅"}”을 비울까요? 메시지, 기억, 장면은 삭제되지만 채팅방은 유지됩니다.`);
    if (!window.confirm(message)) return;
    const secondMessage = tr("請再次確認：清空後，這個聊天室目前的訊息、記憶與場景都無法復原。確定要繼續嗎？", "Please confirm again: this chatroom's current messages, memories, and scene cannot be restored after clearing. Continue?", "再確認してください。消去後、このチャットルームのメッセージ・記憶・シーンは復元できません。続けますか？", "다시 확인해주세요. 비운 뒤에는 이 채팅방의 메시지, 기억, 장면을 복구할 수 없습니다. 계속할까요?");
    if (!window.confirm(secondMessage)) return;
    const clearedRooms = rooms.map((room) => room.id === activeId
      ? { ...room, messages: [], memories: [], scene: emptyScene(), statusText: "", statusUpdatedAt: 0, updatedAt: Date.now() }
      : room);
    switchingRef.current = true;
    setChatRooms((previous) => ({ ...previous, [characterId]: clearedRooms }));
    setChatHistory((previous) => ({ ...previous, [characterId]: [] }));
    setMemories((previous) => ({ ...previous, [characterId]: [] }));
    setChatScenes((previous) => ({ ...previous, [characterId]: emptyScene() }));
    setCharacters((previous) => previous.map((character) => String(character.id) === String(characterId) ? { ...character, statusText: "", statusUpdatedAt: 0 } : character));
    setCurrentChatChar((currentCharacter) => currentCharacter && String(currentCharacter.id) === String(characterId) ? { ...currentCharacter, statusText: "", statusUpdatedAt: 0 } : currentCharacter);
    setChatInput(""); setChatImage(null); setActiveMessageId(null); setMessageEditor(null); setIsTyping(false);
    setChatVisibleCounts((previous) => ({ ...previous, [characterId]: 50 }));
    setTimeout(() => { switchingRef.current = false; }, 0);
  };

  const addCharacterRoom = (character, options = {}) => {
    const roomId = `room_${character.id}_first`;
    const suppliedMessages = Array.isArray(options.messages) ? options.messages : null;
    const openingMessage = suppliedMessages ? null : createOpeningMessage(character, "online");
    const messages = suppliedMessages || (openingMessage ? [openingMessage] : []);
    const room = normalizeRoomStoryData({ id: roomId, roomType: "root", parentRoomId: null, forkMessageId: null, sortOrder: 0, archivedAt: null, title: tr("第一個聊天室", "First chat", "最初のチャット", "첫 번째 채팅"), messages, memories: [], scene: emptyScene(), statusText: character.statusText || "", statusUpdatedAt: character.statusUpdatedAt || 0, createdAt: Date.now(), updatedAt: Date.now() });
    setChatRooms((previous) => ({ ...previous, [character.id]: [room] }));
    setActiveRoomIds((previous) => ({ ...previous, [character.id]: roomId }));
    setChatHistory((previous) => ({ ...previous, [character.id]: messages }));
    setMemories((previous) => ({ ...previous, [character.id]: [] }));
    setChatScenes((previous) => ({ ...previous, [character.id]: emptyScene() }));
  };

  const removeCharacterRooms = (characterId) => {
    setChatRooms((previous) => { const next = { ...previous }; delete next[characterId]; return next; });
    setActiveRoomIds((previous) => { const next = { ...previous }; delete next[characterId]; return next; });
  };

  const clearRooms = () => { setChatRooms({}); setActiveRoomIds({}); };

  return { chatRooms, activeRoomIds, setChatRooms, setActiveRoomIds, loadRoomState, activateRoom, createRoom, createBranch, updateActiveRoomMetadata, renameRoom, deleteRoom, clearRoom, archiveRoom, restoreRoom, moveRoom, addCharacterRoom, removeCharacterRooms, clearRooms, updateRoomMessages };
}
