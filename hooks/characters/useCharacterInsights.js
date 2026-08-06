import { useRef } from "react";
import {
  buildCharacterStatusConversation,
  buildCharacterStatusPrompt,
  CHARACTER_STATUS_SYSTEM_PROMPT,
  normalizeCharacterStatusOutput,
} from "../../utils/characterStatus.js";
import { messagePlainText } from "../../utils/pseudoImage";
import { isLocalProvider } from "../../constants/appConstants";

export default function useCharacterInsights({
  characters, chatHistory, memories, apiConfig, setCharacters, setMemories,
  setStatusRefreshingIds, setGenLoading, canUseCurrentProvider, getOutputLanguageDirective,
  isGemmaModel, stripInternalBlocks, buildMemoryDigest, callAI, sanitizeText, gid, showToast, tr,
}) {
  const statusRefreshBusyRef = useRef(new Set());
  const statusAutoRefreshAttemptRef = useRef(new Map());
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
      .filter((m) => m.role === "user" || m.role === "assistant");
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
      const mems = (memories[charId] || [])
        .filter((memory) => memory.pinned)
        .slice(0, 2)
        .map((memory) => `- ${sanitizeText(memory.text, 180)}`)
        .join("\n");
      const conv = buildCharacterStatusConversation(msgs, char.name);
      const statusPrompt = buildCharacterStatusPrompt({
        languageDirective: getOutputLanguageDirective({ includePlayerContext: false }),
        characterName: char.name,
        roleProfile,
        conversation: conv,
        memories: mems,
        gemma: isGemmaModel(apiConfig.model),
      });
      const rawStatus = await callAI(
        [{ role: "user", content: statusPrompt }],
        apiConfig,
        CHARACTER_STATUS_SYSTEM_PROMPT,
      );
      const status = normalizeCharacterStatusOutput(stripInternalBlocks(rawStatus));
      if (!status) { showToast("未取得狀態內容"); return; }
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, statusText: status, statusUpdatedAt: Date.now() } : c));
      showToast("狀態已更新");
    } catch (err) {
      showToast(`${tr("更新失敗", "Refresh failed", "更新に失敗しました", "새로고침 실패")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 120)}`);
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
  // options.silent：從聊天室呼叫時吞掉 toast，改由呼叫端依回傳結果彈聊天室小卡。
  const generateMemory = async (char, options = {}) => {
    const silent = options.silent === true;
    const notify = (message) => { if (!silent) showToast(message); };
    const msgs = chatHistory[char.id] || [];
    if (msgs.length < 4) { const m = "對話太少，先多聊幾句再生成記憶"; notify(m); return { status: "too_few", message: m }; }
    const existing = memories[char.id] || [];
    if (existing.length >= 30) { const m = "記憶已滿 30 條，請先刪除後再生成"; notify(m); return { status: "full", message: m }; }
    const isOllamaLocal = apiConfig.provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(apiConfig.baseUrl || "");
    const providerNeedsApiKey = !(isLocalProvider(apiConfig.provider) || isOllamaLocal);
    if (providerNeedsApiKey && !apiConfig.apiKey) { const m = "請先設定 API Key"; notify(m); return { status: "no_api_key", message: m }; }
    setGenLoading(true);
    try {
      const recent = msgs
        .slice(-30)
        .map((m) => `${m.role === "user" ? "{{user}}" : char.name}: ${messagePlainText(m)}`)
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
        notify("記憶過於相似，已略過新增");
        return { status: "duplicate", text: safeText };
      }
      setMemories(m => ({ ...m, [char.id]: [...(m[char.id] || []), { id: gid(), text: safeText, date: Date.now(), pinned: false }] }));
      notify("記憶生成成功");
      return { status: "added", text: safeText };
    } catch (err) {
      notify(`記憶生成失敗：${err.message}`);
      return { status: "error", message: err.message };
    } finally {
      setGenLoading(false);
    }
  };

  return { refreshCharacterStatus, togglePinMemory, deleteMemory, generateMemory };
}
