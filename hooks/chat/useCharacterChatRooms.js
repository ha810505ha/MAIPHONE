import { useEffect, useRef, useState } from "react";
import { normalizePersistedPseudoVoiceMessages } from "../../utils/pseudoVoice";

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
  const emptyScene = () => ({ location: "", note: "" });
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
      if (!rooms.length) {
        const roomId = `room_${cid}_legacy`;
        rooms = [{ id: roomId, title: tr("原本的聊天室", "Original chat", "元のチャット", "기존 채팅"), messages: activeHistory[cid] || [], memories: activeMemories[cid] || [], scene: loadedScenes[cid] || emptyScene(), statusText: character.statusText || "", statusUpdatedAt: character.statusUpdatedAt || 0, createdAt: character.createdAt || Date.now(), updatedAt: Date.now() }];
        migratedRooms[cid] = rooms;
        migratedActiveIds[cid] = roomId;
      }
      const activeId = rooms.some((room) => room.id === migratedActiveIds[cid]) ? migratedActiveIds[cid] : rooms[0].id;
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
        return normalizedMessages === hydratedRoom.messages
          ? hydratedRoom
          : { ...hydratedRoom, messages: normalizedMessages };
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

  const activateRoom = (characterId, roomId, sourceRooms = chatRooms) => {
    const savedRooms = snapshotActiveRoom(characterId, sourceRooms);
    const room = savedRooms.find((item) => item.id === roomId);
    if (!room) return;
    switchingRef.current = true;
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
    const room = { id: createId(), title: sanitizeText(title, 60).trim() || tr("新的對話", "New chat", "新しい会話", "새 대화"), messages: openingMessage ? [openingMessage] : [], memories: [], scene: emptyScene(), statusText: "", statusUpdatedAt: 0, createdAt: now, updatedAt: now };
    const nextRooms = [...savedRooms, room];
    setChatRooms((previous) => ({ ...previous, [characterId]: nextRooms }));
    activateRoom(characterId, room.id, { ...chatRooms, [characterId]: nextRooms });
  };

  const renameRoom = (characterId) => {
    const rooms = chatRooms[characterId] || [];
    const activeId = activeRoomIds[characterId];
    const current = rooms.find((room) => room.id === activeId);
    if (!current) return;
    const title = window.prompt(tr("重新命名對話", "Rename chat", "会話名を変更", "대화 이름 변경"), current.title || "");
    if (title === null || !sanitizeText(title, 60).trim()) return;
    setChatRooms((previous) => ({ ...previous, [characterId]: (previous[characterId] || []).map((room) => room.id === activeId ? { ...room, title: sanitizeText(title, 60).trim(), updatedAt: Date.now() } : room) }));
  };

  const deleteRoom = (characterId) => {
    const rooms = snapshotActiveRoom(characterId);
    if (rooms.length <= 1) return;
    const activeId = activeRoomIds[characterId];
    const current = rooms.find((room) => room.id === activeId);
    const message = tr(`確定刪除「${current?.title || "這個對話"}」？其中的訊息與記憶會一併刪除。`, `Delete “${current?.title || "this chat"}”? Its messages and memories will also be deleted.`, `「${current?.title || "この会話"}」を削除しますか？メッセージと記憶も削除されます。`, `“${current?.title || "이 대화"}”를 삭제할까요? 메시지와 기억도 함께 삭제됩니다.`);
    if (!window.confirm(message)) return;
    const remaining = rooms.filter((room) => room.id !== activeId);
    setChatRooms((previous) => ({ ...previous, [characterId]: remaining }));
    activateRoom(characterId, remaining[0].id, { ...chatRooms, [characterId]: remaining });
  };

  const clearRoom = (characterId) => {
    const rooms = snapshotActiveRoom(characterId);
    const activeId = activeRoomIds[characterId];
    const current = rooms.find((room) => room.id === activeId);
    if (!current) return;
    const message = tr(`確定要清空「${current.title || "當前聊天室"}」嗎？其中的訊息、記憶與場景會被清除，但聊天室本身會保留。`, `Clear “${current.title || "the current chat"}”? Its messages, memories, and scene will be removed, but the chatroom will remain.`, `「${current.title || "現在のチャット"}」を空にしますか？メッセージ・記憶・シーンは削除されますが、チャットルームは残ります。`, `“${current.title || "현재 채팅"}”을 비울까요? 메시지, 기억, 장면은 삭제되지만 채팅방은 유지됩니다.`);
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

  const addCharacterRoom = (character) => {
    const roomId = `room_${character.id}_first`;
    const openingMessage = createOpeningMessage(character, "online");
    const messages = openingMessage ? [openingMessage] : [];
    const room = { id: roomId, title: tr("第一個聊天室", "First chat", "最初のチャット", "첫 번째 채팅"), messages, memories: [], scene: emptyScene(), statusText: character.statusText || "", statusUpdatedAt: character.statusUpdatedAt || 0, createdAt: Date.now(), updatedAt: Date.now() };
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

  return { chatRooms, activeRoomIds, setChatRooms, setActiveRoomIds, loadRoomState, activateRoom, createRoom, renameRoom, deleteRoom, clearRoom, addCharacterRoom, removeCharacterRooms, clearRooms };
}
