import { useRef } from "react";

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

  return { refreshCharacterStatus, togglePinMemory, deleteMemory, generateMemory };
}

