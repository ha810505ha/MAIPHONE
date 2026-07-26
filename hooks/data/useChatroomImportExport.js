import { useCallback, useRef, useState } from "react";
import { exportToastMessage } from "../../utils/exportFile";

function removeKey(setter, key) { setter((previous) => { const next = { ...previous }; delete next[key]; return next; }); }

import { normalizePersistedPseudoVoiceMessages } from "../../utils/pseudoVoice";

export default function useChatroomImportExport({ currentCharacter, characters, chatHistory, chatModes, chatBackgrounds, chatLorebookBindings, innerThoughtSettings, chatTimeSettings, setChatHistory, setChatModes, setChatBackgrounds, setChatLorebookBindings, setInnerThoughtSettings, setChatTimeSettings, setCharacters, setMemories, setChatScenes, setProactiveUnread, removeCharacterRooms, onChatroomDeleted, resetOpenChat, normalizeBackground, downloadJsonFile, showToast, sanitizeText, tr }) {
  const importRef = useRef(null);
  const pendingTargetRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  const deleteChatroom = useCallback((characterId, characterName = "這個角色") => {
    if (!characterId || !window.confirm(`確定要完整刪除「${characterName}」的聊天室嗎？\n\n聊天室、所有分支對話、訊息、記憶及相關設定都會刪除；角色聯絡人仍會保留。`) || !window.confirm(tr("請再次確認：刪除後無法復原。之後若要重新聊天，請到聯絡人點「開始聊天」建立新聊天室。確定繼續嗎？", "Please confirm again: deletion cannot be undone. To chat again, start a new chat from Contacts. Continue?", "再確認してください。削除後は元に戻せません。再び話す場合は、連絡先から新しいチャットを開始してください。続けますか？", "다시 확인해주세요. 삭제 후에는 복구할 수 없습니다. 다시 대화하려면 연락처에서 새 채팅을 시작하세요. 계속할까요?"))) return;
    [setChatHistory, setChatModes, setChatLorebookBindings, setChatBackgrounds, setInnerThoughtSettings, setChatTimeSettings, setMemories, setChatScenes, setProactiveUnread].forEach((setter) => setter && removeKey(setter, characterId));
    removeCharacterRooms?.(characterId);
    setCharacters?.((previous) => previous.map((character) => String(character.id) === String(characterId)
      ? { ...character, chatroomDeleted: true, chatroomDeletedAt: Date.now(), pinned: false, chatPinned: false }
      : character));
    if (currentCharacter?.id === characterId) {
      resetOpenChat();
      onChatroomDeleted?.();
    }
    showToast(tr("聊天室已刪除", "Chatroom deleted", "チャットルームを削除しました", "채팅방을 삭제했습니다"));
  }, [currentCharacter, resetOpenChat, onChatroomDeleted, removeCharacterRooms, showToast, tr, setCharacters, setChatHistory, setChatModes, setChatLorebookBindings, setChatBackgrounds, setInnerThoughtSettings, setChatTimeSettings, setMemories, setChatScenes, setProactiveUnread]);

  const exportChatroom = useCallback(async (characterId, characterName = "這個角色") => {
    if (!characterId) return;
    const payload = { format: "maliphone-chatroom", formatVersion: 1, exportedAt: new Date().toISOString(), characterId, characterName, chatHistory: chatHistory?.[characterId] || [], chatMode: chatModes?.[characterId] || "online", chatBackground: chatBackgrounds?.[characterId] || "", chatLorebookBinding: chatLorebookBindings?.[characterId] || null, innerThoughtSetting: innerThoughtSettings?.[characterId] || null, chatTimeSetting: chatTimeSettings?.[characterId] || null };
    const safeName = sanitizeText(characterName || "chatroom", 40).replace(/[\\/:*?"<>|]+/g, "_").trim() || "chatroom";
    try {
      const result = await downloadJsonFile(payload, `chat_${safeName}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.json`);
      const message = exportToastMessage(result, tr);
      if (message) showToast(`${tr("聊天室", "Chatroom", "チャットルーム", "채팅방")}${message}`);
    } catch (error) {
      showToast(`${tr("匯出失敗", "Export failed", "書き出しに失敗しました", "내보내기 실패")}：${sanitizeText(error?.message || "Unknown error", 80)}`);
    }
  }, [chatHistory, chatModes, chatBackgrounds, chatLorebookBindings, innerThoughtSettings, chatTimeSettings, sanitizeText, downloadJsonFile, showToast, tr]);

  const openImport = useCallback((characterId) => {
    const character = characters.find((item) => String(item.id) === String(characterId));
    pendingTargetRef.current = { id: characterId, name: character?.name || tr("這個角色", "this character", "このキャラ", "이 캐릭터") };
    setPreview(null);
    setImporting(false);
    importRef.current?.click();
  }, [characters, tr]);
  const importFile = useCallback(async (event) => {
    const file = event.target.files?.[0]; if (!file) return; setImporting(true);
    try { const raw = JSON.parse(await file.text()); const source = raw?.format === "maliphone-chatroom" ? raw : raw?.chatHistory ? raw : null; const target = pendingTargetRef.current; if (!target?.id) throw new Error(tr("找不到匯入目標角色", "Import target character not found", "インポート先のキャラが見つかりません", "가져오기 대상 캐릭터를 찾을 수 없습니다")); setPreview({ fileName: file.name, fileSize: file.size, targetCharacterId: target.id, targetCharacterName: target.name, summary: { format: raw?.format === "maliphone-chatroom" ? "maliphone-chatroom" : "legacy", exportedAt: raw?.exportedAt || null, messages: Array.isArray(source?.chatHistory) ? source.chatHistory.length : 0, hasMode: !!source?.chatMode, hasBackground: !!source?.chatBackground, hasBinding: !!source?.chatLorebookBinding, hasTimeSetting: !!source?.chatTimeSetting }, raw }); }
    catch (error) { showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기 실패")}：${sanitizeText(error?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`); setImporting(false); }
    finally { if (importRef.current) importRef.current.value = ""; }
  }, [showToast, tr, sanitizeText]);

  const confirmImport = useCallback(async () => {
    const raw = preview?.raw; const targetId = preview?.targetCharacterId; if (!raw || !targetId || !window.confirm(tr("確認匯入後，將覆蓋這個聊天室的對話紀錄。確定要繼續嗎？", "Import will overwrite this chatroom's conversation history. Continue?", "インポートするとこのチャットルームの会話履歴が上書きされます。続けますか？", "가져오기를 하면 이 채팅방의 대화 기록이 덮어써집니다. 계속할까요?"))) return;
    const messages = normalizePersistedPseudoVoiceMessages(
      Array.isArray(raw.chatHistory) ? raw.chatHistory : Array.isArray(raw.messages) ? raw.messages : Array.isArray(raw) ? raw : [],
    );
    setChatHistory((previous) => ({ ...previous, [targetId]: messages }));
    if (raw.chatMode) setChatModes((previous) => ({ ...previous, [targetId]: raw.chatMode }));
    if (Object.prototype.hasOwnProperty.call(raw || {}, "chatBackground")) setChatBackgrounds((previous) => ({ ...previous, [targetId]: normalizeBackground(raw.chatBackground) }));
    if (raw.chatLorebookBinding) setChatLorebookBindings((previous) => ({ ...previous, [targetId]: raw.chatLorebookBinding }));
    if (raw.innerThoughtSetting) setInnerThoughtSettings((previous) => ({ ...previous, [targetId]: raw.innerThoughtSetting }));
    if (raw.chatTimeSetting) setChatTimeSettings((previous) => ({ ...previous, [targetId]: raw.chatTimeSetting }));
    if (currentCharacter?.id === targetId) resetOpenChat();
    const name = preview.targetCharacterName || (characters.find((character) => String(character.id) === String(targetId))?.name || tr("這個角色", "this character", "このキャラ", "이 캐릭터"));
    showToast(tr("聊天室已匯入", "Chatroom imported", "チャットルームを取り込みました", "채팅방을 가져왔습니다").replace("聊天室", name));
    setPreview(null); pendingTargetRef.current = null; setImporting(false);
  }, [preview, tr, setChatHistory, setChatModes, setChatBackgrounds, normalizeBackground, setChatLorebookBindings, setInnerThoughtSettings, setChatTimeSettings, currentCharacter, resetOpenChat, characters, showToast]);

  const cancelImport = useCallback(() => { setPreview(null); pendingTargetRef.current = null; setImporting(false); }, []);
  return { importRef, preview, importing, deleteChatroom, exportChatroom, openImport, importFile, confirmImport, cancelImport };
}
