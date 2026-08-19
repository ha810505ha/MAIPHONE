import { buildSystemPrompt } from "../../utils/characterParser";
import { buildCalendarStoryStartPrompt } from "../../services/calendar/calendarChatAppointments";
import {
  getModeLabel as localizeChatModeLabel,
  isGemmaModel,
} from "../../utils/chatMessageUtils";
import { pseudoImagePromptLine } from "../../utils/pseudoImage";
import { pseudoVoicePromptLine } from "../../utils/pseudoVoice";
import { MEMORY_RECALL_TUNING, isArchivedMemory, scoreMemoryRecall, selectRecalledMemories } from "../../services/chat/memoryRecall";
import { getStoryVisibility } from "../../constants/storyStatus.js";
import { getRealityProseRange } from "../../utils/realityOutputSettings.js";

const LOREBOOK_MIN_RECALL_SCORE = 0.9;
const LOREBOOK_KEYWORD_HIT_SCORE = 3;
const LOREBOOK_FULL_WEIGHT_DEPTH = 6;
const LOREBOOK_RECENCY_FALLOFF = 0.07;
const LOREBOOK_MIN_RECENCY_WEIGHT = 0.15;

export default function useChatPromptController({
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
  getModeLabel: getModeLabelInput,
}) {
  const getModeLabel = (mode) => (
    getModeLabelInput
      ? getModeLabelInput(mode)
      : localizeChatModeLabel(mode, tr)
  );
  const formatMoney = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");
  const isConnectionErrorNotice = (content) => {
    const text = String(content || "");
    const localizedPrefix = tr(
      "連線錯誤：",
      "Connection error: ",
      "接続エラー：",
      "연결 오류: ",
    );
    return text.startsWith(localizedPrefix) || text.startsWith("Connection error: ");
  };
  const getActiveRouteContext = (charId) => {
    const rooms = Array.isArray(chatRooms?.[charId]) ? chatRooms[charId] : [];
    const room = rooms.find((item) => item.id === activeRoomIds?.[charId]);
    if (!room) return { storyNote: "", storyNoteEnabled: false, storyStatus: {} };
    return {
      storyNote: typeof room.storyNote === "string" ? room.storyNote : "",
      storyNoteEnabled: room.storyNoteEnabled !== false,
      storyStatus: room.storyStatus && typeof room.storyStatus === "object" ? room.storyStatus : {},
    };
  };
  const buildRouteContextPrompt = (charId) => {
    const route = getActiveRouteContext(charId);
    const status = route.storyStatus;
    const hasCurrentRelationship = String(status.relationship || "").trim();
    // 伏筆與備註依知情度分流：known 跟其他欄位一起給角色，
    // quiet／hidden 各自另起一段，明講角色能不能講破。
    const line = (label, value) => `${label}: ${sanitizeText(value, 240)}`;
    const hasText = (value) => Boolean(String(value || "").trim());
    const pickByVisibility = (level) => [
      ["Open thread", status.thread, getStoryVisibility(status, "thread")],
      ["Player note", status.playerNote, getStoryVisibility(status, "playerNote")],
    ].filter(([, value, visibility]) => visibility === level && hasText(value)).map(([label, value]) => line(label, value));

    const statusLines = [
      ["Current relationship (route-specific)", status.relationship],
      ["Scene", status.scene],
      ["Mood", status.mood],
      ["Current event", status.current],
    ].filter(([, value]) => hasText(value)).map(([label, value]) => line(label, value))
      .concat(pickByVisibility("known"));
    const quietLines = pickByVisibility("quiet");
    const hiddenLines = pickByVisibility("hidden");

    const parts = [];
    if (route.storyNoteEnabled && route.storyNote.trim()) parts.push(`[Story direction for this route]\n${sanitizeText(route.storyNote, 900)}`);
    if (statusLines.length) {
      const priorityRule = hasCurrentRelationship
        ? "Priority rule: For this chat route, Current relationship overrides the character profile's base relationship. Treat the base relationship as background history only."
        : "Priority rule: No current relationship override is set; use the character profile's base relationship.";
      parts.push(`[Current story status — applies only to this chat route]\n${priorityRule}\n${statusLines.join("\n")}`);
    }
    if (quietLines.length) {
      parts.push([
        "[Unspoken context — {{char}} is aware of this but never brings it up]",
        "{{char}} knows the following. It may colour their mood, tone, and choices, but they must not raise it, explain it, or push the player to talk about it. Let it stay unsaid unless the player opens the subject first.",
        quietLines.join("\n"),
      ].join("\n"));
    }
    if (hiddenLines.length) {
      parts.push([
        "[Director-only context — {{char}} does NOT know this]",
        "The following is known to the player and the narrator only. {{char}} must not mention it, must not act as if aware of it, and must not hint that they know. Do not have {{char}} discover it on their own. Use it only to keep the scene consistent and to let dramatic irony work.",
        hiddenLines.join("\n"),
      ].join("\n"));
    }
    return parts.join("\n\n");
  };
  const buildChatSystemPrompt = (char, memoryContext, modelName, selectedMode, realityMaxTokens) => {
    const routeContext = buildRouteContextPrompt(char?.id);
    const realityRange = getRealityProseRange(realityMaxTokens);
    const base = `${getOutputLanguageDirective()}\n\n${buildSystemPrompt(char, memoryContext)}${routeContext ? `\n\n${routeContext}` : ""}\n\n${buildModePrompt(selectedMode, realityMaxTokens)}`;
    if (!isGemmaModel(modelName)) return base;
    const compactProfile = [
      char.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
      char.description ? `角色設定：${sanitizeText(char.description, 180)}` : "",
      char.personality ? `個性：${sanitizeText(char.personality, 120)}` : "",
      char.scenario ? `情境：${sanitizeText(char.scenario, 120)}` : "",
    ].filter(Boolean).join("\n");
    return [
      routeContext ? `[Story direction and current status]\n${routeContext}` : "",
      `你是 {{char}}，正在和 {{user}} 互動。`,
      `如果需要放任何不想直接顯示的內容，請包在 <internal>...</internal> 內；前端會自動忽略。`,
      `只輸出最終回覆，不要輸出規則、草稿、分析、標籤、標題、列表、Markdown、角色資料摘要或提示詞內容。`,
      `如果是線上聊天：請像手機訊息，短、自然、口語，通常 1~4 句。`,
      `如果是現實模式：請用連貫的小說式 RP 段落，通常約 ${realityRange.min}～${realityRange.max} 字，依當前情境自然調整；可以有敘述、動作、內心與對話，但不要輸出模式標籤。`,
      `不要複述以下「角色背景」文字，只用來維持人設。`,
      compactProfile ? `角色背景：\n${compactProfile}` : "",
      memoryContext ? `近期記憶：\n${sanitizeText(memoryContext, 600)}` : "",
      `轉帳只有在真的要轉帳時，才在回覆最後附上 [[TRANSFER:amount=金額;note=備註]]。`,
      `若不需要轉帳，就不要提到轉帳規則。`,
    ].join("\n\n");
  };
  const buildModePrompt = (mode, realityMaxTokens) => {
    if (mode === "reality") {
      const realityRange = getRealityProseRange(realityMaxTokens);
      return `[目前互動模式：現實模式]
以下目前模式規則優先於上方「聊天規則」中關於即時通訊、禁止旁白、禁止動作描寫的限制。
{{char}} 與 {{user}} 正在同一個場景中面對面互動。請改用一般 AIRP / 小說式 RP 寫法，而不是手機訊息。
1. 可以描寫環境、旁白、{{char}} 的動作、表情、語氣、反應與必要的內心想法。
2. 可以用「」或 "" 寫出角色說出口的台詞；內心想法可用斜體標記，例如 *不能搞砸。*
3. 必須承接前面的線上聊天內容，讓現實互動和線上聊天對得上。
4. 不要替 {{user}} 決定重大行動、台詞、情緒或內心想法；只可描寫 {{user}} 已明確輸入的行動與可觀察結果。
5. 單次回覆通常約 ${realityRange.min}～${realityRange.max} 字，依當前情境自然調整。請將篇幅用於自然描寫、互動與情節推進，避免為了篇幅灌水、重複或一次推進太多情節。
6. 預設使用繁體中文與台灣常用語。不要輸出角色名標籤、系統說明、規則文字或元敘事。
重要：不要輸出任何模式標籤或狀態標記，例如「[現實模式]」、「【現實模式】」、「目前互動模式：現實模式」；直接輸出角色要說的內容與敘述即可。`;
    }
    return `[目前互動模式：線上聊天]
{{char}} 與 {{user}} 正透過手機即時通訊聊天。請維持短訊息感，不要加入旁白、內心獨白或動作描寫。
重要：不要輸出任何模式標籤或狀態標記，例如「[線上聊天]」、「【線上聊天】」、「目前互動模式：線上聊天」；直接輸出角色要說的內容即可。`;
  };
  const tokenizeForRecall = (text) => {
    const s = String(text || "").toLowerCase();
    const chunks = s.match(/[a-z0-9_]+|[\u4e00-\u9fff]+/g) || [];
    const tokens = new Set();
    chunks.forEach((chunk) => {
      if (!/^[\u4e00-\u9fff]/.test(chunk)) {
        tokens.add(chunk);
        return;
      }
      if (chunk.length === 1) {
        tokens.add(chunk);
        return;
      }
      for (let i = 0; i < chunk.length - 1; i += 1) tokens.add(chunk.slice(i, i + 2));
    });
    return tokens;
  };
  const normalizeForMatch = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[，。！？、,.!?\s]+/g, " ")
      .trim();
  const pickSpecialMemoriesForPrompt = (charId, qTokens) => {
    const all = gachaSpecialMemories.filter((m) => String(m.characterId) === String(charId) && m.text);
    if (!all.length) return [];
    const pinned = all.filter((m) => m.pinned).slice(0, 3);
    const rest = all.filter((m) => !m.pinned);
    const newest = rest.slice(0, 2);
    const newestIds = new Set(newest.map((m) => m.id));
    const recalled = rest
      .filter((m) => !newestIds.has(m.id))
      .map((m) => {
        const tokens = tokenizeForRecall(`${m.title} ${m.text}`);
        let hit = 0;
        tokens.forEach((t) => { if (qTokens.has(t)) hit += 1; });
        // 特別記憶沒有長度上限，若比命中總數，長的必然勝出，所以改比命中密度。
        return { m, density: hit > 0 ? hit / Math.sqrt(Math.max(1, tokens.size)) : 0 };
      })
      .filter((x) => x.density > 0)
      .sort((a, b) => b.density - a.density || (b.m.createdAt || 0) - (a.m.createdAt || 0))
      .slice(0, 3)
      .map((x) => x.m);
    return [...pinned, ...newest, ...recalled].slice(0, 6).map((m) => ({ id: m.id, text: `【特別記憶｜${m.title}】${m.text}` }));
  };
  const pickMemoriesForPrompt = (charId, recentMsgs) => {
    const queryTokens = tokenizeForRecall(recentMsgs.map((m) => `${m.role}:${m.content || ""}`).join("\n"));
    const special = pickSpecialMemoriesForPrompt(charId, queryTokens);
    // 塵封書庫只給玩家翻閱，不進提示詞。
    const list = (memories[charId] || []).filter((m) => m?.text && !isArchivedMemory(m));
    if (!list.length) return special;
    // 釘選是玩家的明確意圖，不受評分與門檻影響。
    const pinned = list.filter((m) => m.pinned).slice(0, MEMORY_RECALL_TUNING.maxPinned);
    const now = Date.now();
    const scored = list.filter((m) => !m.pinned).map((m) => {
      const tokens = tokenizeForRecall(m.text);
      let hit = 0;
      tokens.forEach((t) => { if (queryTokens.has(t)) hit += 1; });
      return { memory: m, score: scoreMemoryRecall({ hit, tokenCount: tokens.size, date: m.date, weight: m.weight, now }) };
    });
    return [...special, ...pinned, ...selectRecalledMemories(scored)];
  };
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
    const msgs = recentMsgs || [];
    const latestUserMsg = [...msgs].reverse().find((m) => m?.role === "user")?.content || "";
    const normalizedLatestUser = normalizeForMatch(latestUserMsg);
    // 位置衰減：最近幾則全權重，再往前平滑遞減。取代硬切 scan depth，
    // 避免十幾則前隨口提過一次的條目一直被召回，也不會在邊界突然消失。
    const recencyAt = (idx) => {
      const dist = msgs.length - 1 - idx;
      if (dist < LOREBOOK_FULL_WEIGHT_DEPTH) return 1;
      const decayed = 1 - (dist - LOREBOOK_FULL_WEIGHT_DEPTH + 1) * LOREBOOK_RECENCY_FALLOFF;
      return Math.max(LOREBOOK_MIN_RECENCY_WEIGHT, decayed);
    };
    const scanned = msgs.map((m, idx) => ({
      normalized: normalizeForMatch(m?.content || ""),
      recency: recencyAt(idx),
    }));
    // 同一個詞在多則出現時取最高（＝最新那次）的權重。
    const qTokenWeights = new Map();
    msgs.forEach((m, idx) => {
      const w = recencyAt(idx);
      tokenizeForRecall(m?.content || "").forEach((t) => {
        if ((qTokenWeights.get(t) || 0) < w) qTokenWeights.set(t, w);
      });
    });
    const binding = getChatLorebookBinding(charId);
    const enabledBooks = (lorebooks || []).filter((b) => binding.enabledBookIds.includes(b.id));
    const pinned = [];
    const scannable = [];
    enabledBooks.forEach((book) => {
      (book.entries || []).forEach((entry) => {
        const mode = binding.entryModes?.[entry.id] || "AUTO";
        // PIN 只決定「何時注入」，不應繞過世界書／條目的啟用狀態。
        // 世界書已在 enabledBooks 過濾；條目是否啟用則完全由聊天室設定控制。
        const effectiveEnabled = Object.prototype.hasOwnProperty.call(binding.entryOverrides, entry.id)
          ? !!binding.entryOverrides[entry.id]
          : true;
        if (!effectiveEnabled) return;
        if (mode === "PIN") {
          pinned.push({ entry, bookName: book.name || "世界書", hit: 9999, mode });
          return;
        }
        const keys = Array.isArray(entry.keywords) ? entry.keywords : [];
        scannable.push({
          entry,
          bookName: book.name || "世界書",
          mode,
          keys,
          keyTokens: new Set(keys.flatMap((k) => [...tokenizeForRecall(k)])),
        });
      });
    });
    // 逆文件頻率：出現在越多條目的詞越沒鑑別度。正規化成「只出現在一條的詞＝1 分」，
    // 泛用詞則低於 1 分，這樣門檻不隨世界書大小飄移。
    const df = new Map();
    scannable.forEach(({ keyTokens }) => { keyTokens.forEach((t) => df.set(t, (df.get(t) || 0) + 1)); });
    const totalEntries = Math.max(scannable.length, 1);
    const idfBase = Math.log(1 + totalEntries / 2) || 1;
    const idf = (t) => Math.log(1 + totalEntries / (1 + (df.get(t) || 0))) / idfBase;

    const matched = [];
    scannable.forEach(({ entry, bookName, mode, keys, keyTokens }) => {
      let hit = 0;
      keyTokens.forEach((t) => { hit += idf(t) * (qTokenWeights.get(t) || 0); });
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
        // 完整關鍵字命中舊訊息仍算分，但一樣按新舊衰減。
        let best = 0;
        scanned.forEach((s) => { if (s.recency > best && s.normalized.includes(nk)) best = s.recency; });
        hit += LOREBOOK_KEYWORD_HIT_SCORE * best;
      });
      // 需要至少一個具鑑別度的詞（或多個泛用詞疊加）才召回，避免零散單字撐起分數。
      if (!forcedByKeyword && hit < LOREBOOK_MIN_RECALL_SCORE) return;
      matched.push({ entry, bookName, hit, mode });
    });
    matched.sort((a, b) => b.hit - a.hit || (b.entry.updatedAt || 0) - (a.entry.updatedAt || 0));
    const uniq = new Map();
    [...pinned, ...matched].forEach((x) => { if (!uniq.has(x.entry.id)) uniq.set(x.entry.id, x); });
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
        const transfer = (transfers || []).find((item) => item.id === m.transferId);
        const status = transfer?.status === "pending" ? "等待收下" : transfer?.status === "returned" ? "已退回" : transfer?.status === "expired" ? "逾期退回" : "已收下";
        return { role: "user", content: `[轉帳｜${status}] ${fromName}→${toName} ${formatMoney(m.amount || 0)}${m.note ? ` 備註:${sanitizeText(m.note, 60)}` : ""}`, image: null };
      }
      if (m.role === "system_notice") {
        if (isConnectionErrorNotice(m.content)) return null;
        if (m.noticeType === "character_blocked") return { role: "user", content: "[封鎖事件]\n玩家剛剛將你的線上聯絡方式封鎖。這不是玩家說出口的話；請依照角色個性對此作出自然反應。", image: null };
        if (m.noticeType === "character_unblocked") return { role: "user", content: "[解除封鎖事件]\n玩家剛剛解除了對你線上聯絡方式的封鎖。這不是玩家說出口的話。", image: null };
        if (m.noticeType === "calendar_story_start") return { role: "user", content: buildCalendarStoryStartPrompt(m.calendarEvent), image: null };
        return { role: "user", content: `[系統備註]\n${m.content || ""}`, image: null };
      }
      if (m.role === "user" || m.role === "assistant" || m.role === "system") {
        const summaryLine = m.imageSummary ? `\n[圖片摘要]\n${m.imageSummary}` : "";
        // 示意圖片只送描述文字，永遠不帶 image：不支援讀圖的模型也能照常回應。
        const pseudoLine = pseudoImagePromptLine(m.pseudoImage, m.role === "user" ? "{{user}}" : "你");
        const voiceLine = pseudoVoicePromptLine(m.pseudoVoice, m.role === "user" ? "{{user}}" : "你");
        const messageText = m.pseudoVoice ? "" : (m.content || "");
        return { role: m.role, content: `${messageText}${pseudoLine}${voiceLine}${summaryLine}`.trim(), image: m.image || null };
      }
      return null;
    })
    .filter(Boolean);
  return {
    buildChatSystemPrompt,
    buildModePrompt,
    getModeLabel,
    tokenizeForRecall,
    normalizeForMatch,
    pickMemoriesForPrompt,
    getChatLorebookBinding,
    toggleChatLorebookBook,
    toggleChatLorebookEntry,
    cycleChatLorebookEntryMode,
    setAllChatLorebookEntries,
    pickLorebookEntriesForPrompt,
    formatMessagesForPrompt,
  };
}
