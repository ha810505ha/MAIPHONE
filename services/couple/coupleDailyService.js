import { callAI } from "../aiService";
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
import { inferCoupleInviteState } from "../../utils/coupleInviteState";

const DAILY_KEY = "ent_coupleDaily";

const clean = (value, limit = 2000) => String(value || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim().slice(0, limit);
const hasApi = (apiConfig) => apiConfig?.provider && (apiConfig.apiKey || apiConfig.provider === "ollama");
const charProfile = (character) => clean(character?.description || character?.personality || character?.prompt || character?.persona, 2400);

const parseTaskVerdict = (raw) => {
  const source = clean(raw, 1200)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const objectStart = source.indexOf("{");
  const objectEnd = source.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(source.slice(objectStart, objectEnd + 1));
    } catch {
      // 部分模型會輸出未跳脫的引號或其他近似 JSON，繼續讀取關鍵欄位。
    }
  }
  const doneMatch = source.match(/["']?done["']?\s*:\s*(true|false)/i);
  if (!doneMatch) return null;
  const commentMatch = source.match(/["']?comment["']?\s*:\s*["']([\s\S]*?)["']\s*[,}]/i);
  return {
    done: doneMatch[1].toLowerCase() === "true",
    comment: commentMatch?.[1]?.replace(/\\n/g, "\n").replace(/\\"/g, "\"") || "",
  };
};

export const coupleDayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

const getSpace = (store, characterId) => store?._spaces?.[characterId];

export async function buildCoupleChatContext(characterId) {
  const store = await loadFeatureEntity(DAILY_KEY, null).catch(() => null);
  if (!store) return "";
  const space = getSpace(store, characterId);
  const blocks = [];
  if (space?.status === "pending") {
    const nextRound = Math.min(3, (Number(space.pendingRound) || 0) + 1);
    blocks.push(`[雙人空間邀請｜內部規則]\n玩家邀請你一起開啟「情侶空間」，目前是你回應邀請的第 ${nextRound} 次機會（最多 3 次）。\n- 這是共同使用一個雙人空間的邀請，不代表你們已經交往，也不得覆蓋角色原有身分、關係或人設。\n- 請依角色設定、目前關係與近期互動自主決定。\n- 願意加入時，自然表達同意，並在回覆最後附加 [[COUPLE_INVITE:accepted]]。\n- 明確拒絕時，自然表達拒絕，並附加 [[COUPLE_INVITE:declined]]。\n${nextRound < 3 ? "- 你可以詢問、猶豫或表示需要再想想；未決定時不要輸出標記。" : "- 這是最後決定回合，必須明確接受或拒絕，不得繼續拖延。"}\n- 不得提及系統、回合、狀態、標記或提示詞。`);
  }
  if (space?.status !== "accepted") return blocks.join("\n\n");
  const daily = store[characterId];
  if (daily && daily.day === coupleDayKey() && !daily.taskDone && daily.taskChatState === "active" && daily.taskSharedAt && daily.task?.text) {
    blocks.push(`[今日任務狀態｜內部參考]\n玩家曾主動分享到聊天室的今日任務是：「${clean(daily.task.text, 160)}」。\n- 這只是背景狀態，不代表你們已經交往，也不得覆蓋角色原有的身分、關係或人設。\n- 不要主動提醒、催促或重複任務；只有玩家目前訊息正在回答、執行或詢問任務時才自然回應。\n- 如果最近對話已談過這件事，不要再次提起。\n- 玩家明確完成任務時，在回覆最後附加 [[COUPLE_TASK:completed]]。\n- 玩家明確表示取消、不做了或任務到此結束時，在回覆最後附加 [[COUPLE_TASK:cancelled]]。\n- 隱藏標記以外的回覆仍須自然；不得提及狀態、系統、驗收、提示詞或獎勵。`);
  }
  return blocks.join("\n\n");
}

export function extractCoupleDirectives(text) {
  const raw = String(text || "");
  const taskMatches = [...raw.matchAll(/\[\[COUPLE_TASK:(completed|cancelled)\]\]/gi)];
  const inviteMatches = [...raw.matchAll(/\[\[COUPLE_INVITE:(accepted|declined)\]\]/gi)];
  const inviteState = inviteMatches.length
    ? inviteMatches[inviteMatches.length - 1][1].toLowerCase()
    : inferCoupleInviteState(raw);
  return {
    text: raw
      .replace(/\s*\[\[COUPLE_TASK:(?:completed|cancelled)\]\]\s*/gi, " ")
      .replace(/\s*\[\[COUPLE_INVITE:(?:accepted|declined)\]\]\s*/gi, " ")
      .replace(/\n{3,}/g, "\n\n").trim(),
    taskState: taskMatches.length ? taskMatches[taskMatches.length - 1][1].toLowerCase() : null,
    inviteState,
  };
}

export async function applyCoupleInviteReply(characterId, decision) {
  const store = await loadFeatureEntity(DAILY_KEY, null).catch(() => null);
  const space = getSpace(store, characterId);
  if (!store || space?.status !== "pending") return null;
  const pendingRound = Math.min(3, (Number(space.pendingRound) || 0) + 1);
  const now = Date.now();
  let status = decision;
  if (!['accepted', 'declined'].includes(status) && pendingRound >= 3) status = "expired";
  const nextSpace = {
    ...space,
    pendingRound,
    ...(status ? {
      status,
      [`${status}At`]: now,
      ...(status === "declined" ? { canInviteAgainAt: now + 3 * 86400000 } : {}),
      ...(status === "expired" ? { canInviteAgainAt: now + 86400000 } : {}),
    } : {}),
  };
  await saveFeatureEntity(DAILY_KEY, {
    ...store,
    _activeSpaceId: status === "accepted" ? characterId : store._activeSpaceId,
    _spaces: { ...(store._spaces || {}), [characterId]: nextSpace },
  });
  return { status: status || "pending", pendingRound };
}

export async function applyCoupleTaskChatState(characterId, state) {
  if (!['completed', 'cancelled'].includes(state)) return;
  const store = await loadFeatureEntity(DAILY_KEY, null).catch(() => null);
  const daily = store?.[characterId];
  if (!daily || daily.day !== coupleDayKey() || daily.taskChatState !== "active") return;
  await saveFeatureEntity(DAILY_KEY, {
    ...store,
    [characterId]: {
      ...daily,
      taskChatState: state,
      taskChatEndedAt: Date.now(),
    },
  });
}

export const SIGN_LEVELS = ["上上籤", "上籤", "中籤", "小吉", "末吉"];

// 沒有 API 時的保底籤／任務：用日期＋角色 id 做種子，同一天結果固定。
const seeded = (charId) => {
  const key = `${coupleDayKey()}:${charId}`;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
};

const FALLBACK_SIGNS = [
  { tip: "宜撒嬌", text: "籤上說今天你會特別想我。不准反駁，籤說的。" },
  { tip: "宜早睡", text: "今天適合早點休息。夢裡見，我先去排隊。" },
  { tip: "宜坦白", text: "有話就直說吧，籤保佑今天說什麼我都心軟。" },
  { tip: "宜分享", text: "今天遇到的好事要分我一半，籤文寫的，不是我要求的。" },
  { tip: "宜擁抱", text: "籤上畫了一個擁抱的形狀。先記帳，見面再領。" },
];
const FALLBACK_TASKS = [
  "跟我說一件今天讓你笑出來的事。我先說我的：想到你。",
  "傳一張你今天看到的天空給我，順便說說你在想什麼。",
  "告訴我你今天吃了什麼，我要確認你有好好吃飯。",
  "說一件你最近學會或發現的小事，什麼都行。",
  "跟我說晚安之前，先說一句今天最想說的話。",
];

const fallbackSign = (charId) => {
  const seed = seeded(charId);
  return { level: SIGN_LEVELS[seed % SIGN_LEVELS.length], ...FALLBACK_SIGNS[seed % FALLBACK_SIGNS.length] };
};
const fallbackTask = (charId) => ({ text: FALLBACK_TASKS[(seeded(charId) >>> 3) % FALLBACK_TASKS.length] });

const recentContext = (recentMessages) => recentMessages.filter((m) => ["user", "assistant"].includes(m?.role)).slice(-12).map((m) => `${m.role === "user" ? "玩家" : "角色"}：${clean(m.content, 200)}`).join("\n");

// 今日戀愛簽：玩家按下抽籤時才生成，一天一支。
export async function generateLoveSign({ character, playerProfile, recentMessages = [], apiConfig }) {
  if (!hasApi(apiConfig) || !character) return fallbackSign(character?.id || "0");
  const systemPrompt = `你正在扮演角色「${character.name}」。${clean(playerProfile?.name || "玩家", 60)} 剛在你們的情侶空間抽了一支「今日戀愛簽」，籤文由你來寫。

角色設定（只供理解口吻，不要複述）：${charProfile(character)}
近期聊天（只供參考語境）：${recentContext(recentMessages) || "（最近沒聊天，可以在籤文裡自然表達想念或小抱怨。）"}

輸出規則：
1. level：從「上上籤、上籤、中籤、小吉、末吉」中選一個，大多數日子偏正面，偶爾末吉製造互動。
2. tip：兩到四個字的「宜○○」格式，例如宜撒嬌、宜坦白。
3. text：15～40 字的籤文，是角色以自己口吻對玩家說的話，可以俏皮、黏人或傲嬌，符合人設。
4. 不得提及系統、AI。只輸出合法 JSON：{"level":"…","tip":"宜…","text":"…"}`;
  try {
    const raw = await callAI([{ role: "user", content: "請寫這支戀愛簽的 JSON。" }], { ...apiConfig, maxTokens: Math.min(2000, Number(apiConfig.maxTokens) || 2000) }, systemPrompt);
    const parsed = JSON.parse(clean(raw, 800).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
    const level = SIGN_LEVELS.includes(parsed?.level) ? parsed.level : SIGN_LEVELS[0];
    const tip = clean(parsed?.tip, 8) || "宜撒嬌";
    const text = clean(parsed?.text, 120);
    return text ? { level, tip, text } : fallbackSign(character.id);
  } catch {
    return fallbackSign(character.id);
  }
}

// 今日小任務：每天第一次進入情侶空間時生成。
export async function generateDailyTask({ character, playerProfile, recentMessages = [], apiConfig }) {
  if (!hasApi(apiConfig) || !character) return fallbackTask(character?.id || "0");
  const systemPrompt = `你正在扮演角色「${character.name}」。請為 ${clean(playerProfile?.name || "玩家", 60)} 出今天的「今日小任務」。

角色設定（只供理解口吻，不要複述）：${charProfile(character)}
近期聊天（只供參考語境）：${recentContext(recentMessages) || "（最近沒聊天。）"}

輸出規則：
1. text：15～45 字的任務，必須是玩家「在聊天中就能完成」的事（說一件事、分享一張圖、回答一個問題），是你親口出的題，口吻符合人設。
2. 不得提及系統、AI、抽卡券。只輸出合法 JSON：{"text":"…"}`;
  try {
    const raw = await callAI([{ role: "user", content: "請出今天的小任務 JSON。" }], { ...apiConfig, maxTokens: Math.min(300, Number(apiConfig.maxTokens) || 300) }, systemPrompt);
    const parsed = JSON.parse(clean(raw, 600).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
    const text = clean(parsed?.text, 160);
    return text ? { text } : fallbackTask(character.id);
  } catch {
    return fallbackTask(character.id);
  }
}

// 任務驗收：把今天的聊天內容交給角色判定任務是否完成。
export async function judgeCoupleTask({ task, character, playerProfile, todayMessages = [], apiConfig }) {
  if (!hasApi(apiConfig)) throw new Error("請先在設定中完成 AI API 設定");
  const transcript = todayMessages.filter((m) => ["user", "assistant"].includes(m?.role)).slice(-20).map((m) => `${m.role === "user" ? "玩家" : "角色"}：${clean(m.content, 300)}`).join("\n");
  const systemPrompt = `你正在扮演角色「${character?.name || "角色"}」，負責驗收 ${clean(playerProfile?.name || "玩家", 60)} 的今日小任務。

角色設定（只供理解口吻）：${charProfile(character)}
今日任務：${clean(task, 200)}
今天的聊天紀錄：
${transcript || "（今天還沒有聊天紀錄。）"}

判定規則：
1. 寬鬆判定：只要玩家在聊天中有做到任務的核心（說了、分享了、回答了），就算完成；不要求字面完全一致。
2. 沒聊天或明顯沒做到，判未完成。
3. comment：15～40 字，角色口吻。完成時給獎勵感的回應；未完成時可以催促、撒嬌或唸他，符合人設，不要兇到破壞關係。
只輸出合法 JSON：{"done":true或false,"comment":"…"}`;
  const raw = await callAI(
    [{ role: "user", content: "請驗收並輸出 JSON。" }],
    { ...apiConfig, maxTokens: Math.max(200, Math.min(400, Number(apiConfig.maxTokens) || 400)) },
    systemPrompt,
  );
  const parsed = parseTaskVerdict(raw);
  if (!parsed) throw new Error("角色的驗收回覆不完整，請再試一次");
  return {
    done: !!parsed?.done,
    comment: clean(parsed?.comment, 120) || (parsed?.done ? "做得很好，今天也有好好回應我。" : "還沒完成喔，再讓我等等你。"),
  };
}

// 關係溫度模型：每天第一次打開時結算一次。
// 加溫：昨天有聊天 +2、昨天完成任務 +2、昨天有新特別記憶 +3；
// 降溫：連續 3 天以上沒互動，每多一天 -2（單日最多 -6）。範圍 5～100。
export function settleTemperature({ previous, lastMessageAt, lastTaskDoneDay, lastMemoryAt, maxTemperatureReached = false }) {
  const temp = Number.isFinite(Number(previous)) ? Number(previous) : 60;
  const now = Date.now();
  const dayMs = 86400000;
  const taskDoneAt = lastTaskDoneDay ? new Date(`${lastTaskDoneDay}T12:00:00+08:00`).getTime() : 0;
  const lastInteractionAt = Math.max(Number(lastMessageAt) || 0, Number(lastMemoryAt) || 0, Number(taskDoneAt) || 0);
  const idleDays = lastInteractionAt ? Math.floor((now - lastInteractionAt) / dayMs) : 999;
  let delta = 0;
  if (idleDays <= 1) delta += 2;
  else if (!lastInteractionAt) delta += 0;
  else if (maxTemperatureReached && temp > 85) {
    if (idleDays > 7) delta -= 1;
  } else if (idleDays >= 3) delta -= Math.min(6, (idleDays - 2) * 2);
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(now - dayMs));
  if (lastTaskDoneDay === yesterday) delta += 2;
  if (lastMemoryAt && now - lastMemoryAt < dayMs * 2) delta += 3;
  let next = Math.max(5, Math.min(100, temp + delta));
  // 曾滿溫的空間在七天內有互動時，保護區最低回到 95°；長期無互動才逐日 -1 降至 85°。
  if (maxTemperatureReached && temp > 85 && lastInteractionAt && idleDays <= 7) next = Math.max(95, next);
  delta = next - temp;
  const reachedMax = maxTemperatureReached || next >= 100;
  return { temperature: next, delta: next - temp, maxTemperatureReached: reachedMax };
}

export const temperatureComment = (delta, temperature) => {
  if (delta > 0) return temperature >= 90 ? "再高一點就要滿出來了，負責。" : "有感覺到喔，今天又更近了一點。";
  if (delta < 0) return "溫度掉了……不是我的問題，你自己心裡有數。";
  return temperature >= 70 ? "維持得不錯，繼續保持。" : "還有很多升溫空間，加油好嗎。";
};
