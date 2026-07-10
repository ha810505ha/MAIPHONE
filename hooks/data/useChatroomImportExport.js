import { useCallback, useRef, useState } from "react";

function removeKey(setter, key) { setter((previous) => { const next = { ...previous }; delete next[key]; return next; }); }

export default function useChatroomImportExport({ currentCharacter, characters, chatHistory, chatModes, chatBackgrounds, chatLorebookBindings, innerThoughtSettings, chatTimeSettings, setChatHistory, setChatModes, setChatBackgrounds, setChatLorebookBindings, setInnerThoughtSettings, setChatTimeSettings, resetOpenChat, normalizeBackground, downloadJsonFile, showToast, sanitizeText, tr }) {
  const importRef = useRef(null);
  const [targetId, setTargetId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  const deleteChatroom = useCallback((characterId, characterName = "這個角色") => {
    if (!characterId || !window.confirm(`確定要刪除「${characterName}」的聊天室嗎？這只會清掉對話，不會刪除角色本身。`) || !window.confirm(tr("請再次確認：刪除後將無法復原這個聊天室的對話紀錄，確定要繼續嗎？", "Please confirm again: this chat history cannot be restored after deletion. Continue?", "再確認してください。削除後はこのチャット履歴を復元できません。続けますか？", "다시 확인해주세요. 삭제 후에는 이 채팅 기록을 복구할 수 없습니다. 계속할까요?"))) return;
    [setChatHistory, setChatModes, setChatLorebookBindings, setChatBackgrounds, setInnerThoughtSettings, setChatTimeSettings].forEach((setter) => removeKey(setter, characterId));
    if (currentCharacter?.id === characterId) resetOpenChat();
    showToast(tr("聊天室已刪除", "Chatroom deleted", "チャットルームを削除しました", "채팅방을 삭제했습니다"));
  }, [currentCharacter, resetOpenChat, showToast, tr, setChatHistory, setChatModes, setChatLorebookBindings, setChatBackgrounds, setInnerThoughtSettings, setChatTimeSettings]);

  const exportChatroom = useCallback((characterId, characterName = "這個角色") => {
    if (!characterId) return;
    const payload = { format: "maliphone-chatroom", formatVersion: 1, exportedAt: new Date().toISOString(), characterId, characterName, chatHistory: chatHistory?.[characterId] || [], chatMode: chatModes?.[characterId] || "online", chatBackground: chatBackgrounds?.[characterId] || "", chatLorebookBinding: chatLorebookBindings?.[characterId] || null, innerThoughtSetting: innerThoughtSettings?.[characterId] || null, chatTimeSetting: chatTimeSettings?.[characterId] || null };
    const safeName = sanitizeText(characterName || "chatroom", 40).replace(/[\\/:*?"<>|]+/g, "_").trim() || "chatroom";
    downloadJsonFile(payload, `chat_${safeName}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.json`);
    showToast(tr("聊天室已匯出", "Chatroom exported", "チャットルームを書き出しました", "채팅방을 내보냈습니다"));
  }, [chatHistory, chatModes, chatBackgrounds, chatLorebookBindings, innerThoughtSettings, chatTimeSettings, sanitizeText, downloadJsonFile, showToast, tr]);

  const openImport = useCallback((characterId) => { setTargetId(characterId); importRef.current?.click(); }, []);
  const importFile = useCallback(async (event) => {
    const file = event.target.files?.[0]; if (!file) return; setImporting(true);
    try { const raw = JSON.parse(await file.text()); const source = raw?.format === "maliphone-chatroom" ? raw : raw?.chatHistory ? raw : null; setPreview({ fileName: file.name, fileSize: file.size, summary: { format: raw?.format === "maliphone-chatroom" ? "maliphone-chatroom" : "legacy", exportedAt: raw?.exportedAt || null, messages: Array.isArray(source?.chatHistory) ? source.chatHistory.length : 0, hasMode: !!source?.chatMode, hasBackground: !!source?.chatBackground, hasBinding: !!source?.chatLorebookBinding, hasTimeSetting: !!source?.chatTimeSetting }, raw }); }
    catch (error) { showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기 실패")}：${sanitizeText(error?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`); setImporting(false); }
    finally { if (importRef.current) importRef.current.value = ""; }
  }, [showToast, tr, sanitizeText]);

  const confirmImport = useCallback(async () => {
    const raw = preview?.raw; if (!raw || !targetId || !window.confirm(tr("確認匯入後，將覆蓋這個聊天室的對話紀錄。確定要繼續嗎？", "Import will overwrite this chatroom's conversation history. Continue?", "インポートするとこのチャットルームの会話履歴が上書きされます。続けますか？", "가져오기를 하면 이 채팅방의 대화 기록이 덮어써집니다. 계속할까요?"))) return;
    const messages = Array.isArray(raw.chatHistory) ? raw.chatHistory : Array.isArray(raw.messages) ? raw.messages : Array.isArray(raw) ? raw : [];
    setChatHistory((previous) => ({ ...previous, [targetId]: messages }));
    if (raw.chatMode) setChatModes((previous) => ({ ...previous, [targetId]: raw.chatMode }));
    if (Object.prototype.hasOwnProperty.call(raw || {}, "chatBackground")) setChatBackgrounds((previous) => ({ ...previous, [targetId]: normalizeBackground(raw.chatBackground) }));
    if (raw.chatLorebookBinding) setChatLorebookBindings((previous) => ({ ...previous, [targetId]: raw.chatLorebookBinding }));
    if (raw.innerThoughtSetting) setInnerThoughtSettings((previous) => ({ ...previous, [targetId]: raw.innerThoughtSetting }));
    if (raw.chatTimeSetting) setChatTimeSettings((previous) => ({ ...previous, [targetId]: raw.chatTimeSetting }));
    if (currentCharacter?.id === targetId) resetOpenChat();
    const name = currentCharacter?.id === targetId ? currentCharacter.name : (characters.find((character) => character.id === targetId)?.name || tr("這個角色", "this character", "このキャラ", "이 캐릭터"));
    showToast(tr("聊天室已匯入", "Chatroom imported", "チャットルームを取り込みました", "채팅방을 가져왔습니다").replace("聊天室", name));
    setPreview(null); setTargetId(null); setImporting(false);
  }, [preview, targetId, tr, setChatHistory, setChatModes, setChatBackgrounds, normalizeBackground, setChatLorebookBindings, setInnerThoughtSettings, setChatTimeSettings, currentCharacter, resetOpenChat, characters, showToast]);

  const cancelImport = useCallback(() => { setPreview(null); setTargetId(null); setImporting(false); }, []);
  return { importRef, preview, importing, deleteChatroom, exportChatroom, openImport, importFile, confirmImport, cancelImport };
}
