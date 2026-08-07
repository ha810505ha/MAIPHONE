import { useRef } from "react";
import {
  buildCharacterStatusConversation,
  buildCharacterStatusPrompt,
  CHARACTER_STATUS_SYSTEM_PROMPT,
  normalizeCharacterStatusOutput,
} from "../../utils/characterStatus.js";
import { messagePlainText } from "../../utils/pseudoImage";
import {
  MEMORY_RECALL_TUNING,
  isArchivedMemory,
  selectMemoriesToArchive,
  splitArchivedMemories,
} from "../../services/chat/memoryRecall";
import {
  MEMORY_COMPRESSION,
  applyCompressionResult,
  buildMemoryCompressionPrompt,
  revertCompression,
  validateCompressionSelection,
} from "../../services/chat/memoryCompression";

export default function useCharacterInsights({
  characters, chatHistory, memories, apiConfig, customPrompts, setCharacters, setMemories,
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
        { app: "characters", action: "status_refresh" },
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
  const setMemoryArchived = (charId, memoryId, archived) => {
    setMemories((prev) => {
      const arr = prev[charId] || [];
      const idx = arr.findIndex((x) => x.id === memoryId);
      if (idx < 0) return prev;
      // 撈回時活躍區可能已經滿了。先放進去，再把保留分數最低的（可能就是剛撈回的
      // 那條以外的舊記憶）擠回書庫，維持活躍上限。
      const next = arr.map((mem) => (mem.id === memoryId ? { ...mem, archived: !!archived } : mem));
      if (archived) return { ...prev, [charId]: next };
      // 剛撈回的那條自己可能就是保留分數最低的。選擇擠出對象時先把它當成釘選保護起來，
      // 否則會被立刻塞回書庫，玩家看到的就是「按了沒反應」。
      const toArchive = selectMemoriesToArchive(
        next.map((mem) => (mem.id === memoryId ? { ...mem, pinned: true } : mem)),
        { keep: MEMORY_RECALL_TUNING.activeLimit },
      );
      const trimmed = next.map((mem) => (toArchive.has(mem.id) ? { ...mem, archived: true } : mem));
      const { active } = splitArchivedMemories(trimmed);
      if (active.length > MEMORY_RECALL_TUNING.activeLimit) {
        showToast(tr("活躍記憶已滿，請先塵封或刪除幾條", "Active memories are full. Archive or delete a few first.", "アクティブな記憶が上限です。先にいくつか封印または削除してください。", "활성 기억이 가득 찼습니다. 먼저 몇 개를 봉인하거나 삭제하세요."));
        return prev;
      }
      return { ...prev, [charId]: trimmed };
    });
    showToast(archived
      ? tr("已移入塵封書庫", "Moved to the archive", "封印書庫に移しました", "봉인 서고로 옮겼습니다")
      : tr("已從塵封書庫取回", "Restored from the archive", "封印書庫から戻しました", "봉인 서고에서 되돌렸습니다"));
  };
  const archiveMemory = (charId, memoryId) => setMemoryArchived(charId, memoryId, true);
  const restoreMemory = (charId, memoryId) => setMemoryArchived(charId, memoryId, false);
  const compressMemories = async (char, memoryIds) => {
    const check = validateCompressionSelection(memoryIds);
    if (!check.ok) {
      const message = check.reason === "too_few"
        ? tr(`請至少選擇 ${check.need} 條記憶`, `Select at least ${check.need} memories`, `${check.need} 件以上選択してください`, `최소 ${check.need}개를 선택하세요`)
        : tr(`一次最多壓縮 ${check.limit} 條`, `You can compress up to ${check.limit} at once`, `一度に圧縮できるのは最大 ${check.limit} 件です`, `한 번에 최대 ${check.limit}개까지 압축할 수 있습니다`);
      showToast(message);
      return { status: check.reason, message };
    }
    if (!canUseCurrentProvider()) {
      const message = tr("請先在設定中啟用可用的 AI 來源", "Enable an available AI source in settings first", "先に設定で利用可能な AI ソースを有効にしてください", "먼저 설정에서 사용 가능한 AI 소스를 활성화하세요");
      showToast(message);
      return { status: "no_ai_source", message };
    }
    const selectedIds = new Set(memoryIds);
    const selected = (memories[char.id] || []).filter((m) => selectedIds.has(m.id));
    if (selected.length !== memoryIds.length) {
      const message = tr("部分記憶已不存在，請重新選擇", "Some memories no longer exist. Select again.", "一部の記憶が存在しません。選び直してください。", "일부 기억이 존재하지 않습니다. 다시 선택하세요.");
      showToast(message);
      return { status: "stale", message };
    }
    setGenLoading(true);
    try {
      const prompt = buildMemoryCompressionPrompt({
        template: customPrompts?.memoryCompress,
        charName: char.name,
        memories: selected,
      });
      const raw = await callAI(
        [{ role: "user", content: `${getOutputLanguageDirective()}\n\n${prompt}` }],
        apiConfig,
        "你是角色記憶整理助手。",
        { app: "characters", action: "memory_compress" },
      );
      const summaryText = sanitizeText(stripInternalBlocks(raw), MEMORY_COMPRESSION.summaryMaxChars);
      if (!summaryText || summaryText.length < 8) {
        throw new Error(tr("模型未產生有效摘要", "The model did not produce a valid summary", "モデルが有効な要約を生成しませんでした", "모델이 유효한 요약을 생성하지 않았습니다"));
      }
      const summary = {
        id: gid(),
        text: summaryText,
        date: Date.now(),
        pinned: false,
        // 摘要承載了多條記憶，預設比單條記憶重要一級。
        weight: Math.min(MEMORY_RECALL_TUNING.maxWeight, MEMORY_RECALL_TUNING.defaultWeight + 1),
        archived: false,
        sourceIds: memoryIds.slice(),
      };
      setMemories((prev) => ({
        ...prev,
        [char.id]: applyCompressionResult(prev[char.id] || [], { sourceIds: memoryIds, summary }),
      }));
      showToast(tr(`已壓縮 ${selected.length} 條記憶，原文已移入塵封書庫`, `Compressed ${selected.length} memories; the originals moved to the archive`, `${selected.length} 件を圧縮し、原文は封印書庫に移しました`, `${selected.length}개를 압축했고 원문은 봉인 서고로 옮겼습니다`));
      return { status: "compressed", text: summaryText, summaryId: summary.id };
    } catch (err) {
      showToast(tr(`記憶壓縮失敗：${err.message}`, `Compression failed: ${err.message}`, `記憶の圧縮に失敗しました：${err.message}`, `기억 압축 실패: ${err.message}`));
      return { status: "error", message: err.message };
    } finally {
      setGenLoading(false);
    }
  };
  const revertMemorySummary = (charId, summaryId) => {
    if (!window.confirm(tr("要還原這條摘要嗎？摘要會刪除，原本的記憶會取回。", "Revert this summary? The summary is deleted and the original memories return.", "この要約を元に戻しますか？要約は削除され、元の記憶が戻ります。", "이 요약을 되돌릴까요? 요약은 삭제되고 원래 기억이 돌아옵니다."))) return;
    let restored = 0;
    setMemories((prev) => {
      const result = revertCompression(prev[charId] || [], summaryId);
      restored = result.restored;
      return { ...prev, [charId]: result.list };
    });
    showToast(tr(`已還原 ${restored} 條記憶`, `Restored ${restored} memories`, `${restored} 件の記憶を復元しました`, `${restored}개의 기억을 복원했습니다`));
  };
  // options.silent：從聊天室呼叫時吞掉 toast，改由呼叫端依回傳結果彈聊天室小卡。
  const generateMemory = async (char, options = {}) => {
    const silent = options.silent === true;
    const notify = (message) => { if (!silent) showToast(message); };
    const msgs = chatHistory[char.id] || [];
    if (msgs.length < 4) { const m = "對話太少，先多聊幾句再生成記憶"; notify(m); return { status: "too_few", message: m }; }
    const existing = (memories[char.id] || []).filter((m) => !isArchivedMemory(m));
    if (!canUseCurrentProvider()) { const m = "請先在設定中啟用可用的 AI 來源"; notify(m); return { status: "no_ai_source", message: m }; }
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
      const text = await callAI(prompt, apiConfig, "你是角色記憶整理助手。", {
        app: "characters",
        action: "memory_generate",
      });
      const safeText = sanitizeText(text, 120);
      if (!safeText || safeText.length < 8) throw new Error(tr("模型未產生有效記憶", "The model did not generate a valid memory", "モデルが有効なメモリを生成しませんでした", "모델이 유효한 기억을 생성하지 않았습니다"));
      const duplicated = existing.some((mem) => memorySimilarity(mem.text, safeText) >= 0.78);
      if (duplicated) {
        notify("記憶過於相似，已略過新增");
        return { status: "duplicate", text: safeText };
      }
      let archivedCount = 0;
      setMemories(m => {
        const next = [...(m[char.id] || []), { id: gid(), text: safeText, date: Date.now(), pinned: false, weight: MEMORY_RECALL_TUNING.defaultWeight, archived: false }];
        // 活躍區滿了不再拒絕生成，改成把保留分數最低的塵封進書庫（原文保留、可撈回）。
        const toArchive = selectMemoriesToArchive(next, { keep: MEMORY_RECALL_TUNING.activeLimit });
        archivedCount = toArchive.size;
        if (!archivedCount) return { ...m, [char.id]: next };
        return { ...m, [char.id]: next.map((mem) => (toArchive.has(mem.id) ? { ...mem, archived: true } : mem)) };
      });
      // 塵封是使用者沒要求就發生的資料搬動，必須留痕，不能靜默。
      notify(archivedCount ? `記憶生成成功，${archivedCount} 則較舊記憶已移入塵封書庫` : "記憶生成成功");
      return { status: "added", text: safeText, archivedCount };
    } catch (err) {
      notify(`記憶生成失敗：${err.message}`);
      return { status: "error", message: err.message };
    } finally {
      setGenLoading(false);
    }
  };

  return { refreshCharacterStatus, togglePinMemory, deleteMemory, generateMemory, archiveMemory, restoreMemory, compressMemories, revertMemorySummary };
}
