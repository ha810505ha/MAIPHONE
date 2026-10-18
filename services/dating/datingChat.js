import { callAI } from "../aiService.js";
import { tagLabel } from "../../data/dating/interestTags.js";
import { CONTACT_ACCEPT_MARKER, CONTACT_GATE_DEFAULT, CONTACT_INVITE_MARKER, CONTACT_PROPOSAL_RETRY_MESSAGES, EFFECTIVE_MESSAGE_MIN_LENGTH } from "../../constants/dating.js";
import { SCAM_CONTACT_GATE, datingScamOverlay, isScamProfile } from "./scamScript.js";

const list = (tags = []) => tags.map(tagLabel).join("、") || "（未填）";

const NAME_PART_SEPARATOR = /[\s/／|｜,，、·・()[\]{}]+/u;
const CJK_OR_HANGUL_NAME = /^[\u3400-\u9fff\uac00-\ud7a3]+$/u;
const LATIN_NAME_PART = /^[a-z][a-z'-]*$/iu;
const normalizeNameToken = (value) => String(value || "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[^a-z0-9\u3400-\u9fff\uac00-\ud7a3]/gu, "");
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const replaceLiteral = (value, search, replacement) => String(value || "").split(search).join(replacement);

/**
 * character.name is private until contact promotion. Character-card personality
 * often starts with a given name rather than the full legal name, so replacing
 * only the exact full string is not enough. Derive conservative name fragments:
 * - CJK/Hangul: surname-stripped suffixes (including common two-character surnames)
 * - Latin: independent first/last-name words
 * A fragment already visible in profile.name is public and must remain usable.
 */
function privateNameTokens(realName, publicName) {
  const fullName = String(realName || "").trim();
  if (!fullName) return [];
  const publicToken = normalizeNameToken(publicName);
  const candidates = new Map();
  const add = (token, leadingOnly = false) => {
    const text = String(token || "").trim();
    const normalized = normalizeNameToken(text);
    if (!text || !normalized || (publicToken && publicToken.includes(normalized))) return;
    const previous = candidates.get(text);
    candidates.set(text, previous === false ? false : leadingOnly);
  };

  add(fullName);
  fullName.split(NAME_PART_SEPARATOR).filter(Boolean).forEach((part) => {
    if (CJK_OR_HANGUL_NAME.test(part)) {
      add(part);
      if (part.length >= 3) add(part.slice(1));
      if (part.length >= 4) add(part.slice(2));
      if (part.length >= 3) add(part.slice(-2));
      // A one-character given name is too broad for global replacement. It is
      // still safe to redact when used as a sentence-leading self-reference.
      if (part.length >= 2) add(part.slice(-1), true);
    } else if (LATIN_NAME_PART.test(part) && part.length >= 2) {
      add(part);
    }
  });

  return [...candidates.entries()]
    .map(([token, leadingOnly]) => ({ token, leadingOnly }))
    .sort((a, b) => b.token.length - a.token.length);
}

function redactPrivateIdentity(value, realName, publicName) {
  let text = String(value || "");
  for (const { token, leadingOnly } of privateNameTokens(realName, publicName)) {
    const escaped = escapeRegExp(token);
    if (leadingOnly) {
      const leadingPattern = new RegExp(`(^|[\\n\\r。！？!?；;：:，,])([\\s「『（(\"']*)${escaped}(?=[\\u3400-\\u9fff\\uac00-\\ud7a3])`, "gu");
      text = text.replace(leadingPattern, (_match, boundary, spacing) => `${boundary}${spacing}${publicName}`);
    } else if (LATIN_NAME_PART.test(token)) {
      text = text.replace(new RegExp(`\\b${escaped}\\b`, "giu"), publicName);
    } else {
      text = replaceLiteral(text, token, publicName);
    }
  }
  return text;
}

function characterFieldText(value) {
  if (value === undefined || value === null || value === "") return "（未設定）";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function safePlayerDisplayName(playerName) {
  const raw = String(playerName || "").trim() || "對方";
  return replaceLiteral(replaceLiteral(raw, "{{char}}", "對方"), "{{user}}", "對方");
}

function datingCharacterFieldForPrompt(character, value, publicName, playerName) {
  const raw = characterFieldText(value);
  const identitySafe = redactPrivateIdentity(raw, character?.name, publicName);
  const playerDisplayName = safePlayerDisplayName(playerName);
  return replaceLiteral(
    replaceLiteral(identitySafe, "{{char}}", publicName),
    "{{user}}",
    playerDisplayName,
  );
}

/**
 * 離線期間累積的訊息，上線後要一次回完。
 * 這段只在「剛上線」的情境加進 prompt，即時對話時不會出現。
 */
function offlineCatchUp(entry, pendingCount, awayMinutes) {
  const away = awayMinutes >= 60
    ? `大約 ${Math.round(awayMinutes / 60)} 小時`
    : `大約 ${Math.max(1, Math.round(awayMinutes))} 分鐘`;
  return [
    "",
    "【你剛上線】",
    `你的在線時段是 ${entry.onlineHours?.start || "00:00"}–${entry.onlineHours?.end || "24:00"}。`,
    `對方在你不在的時候傳了訊息，你離開了${away}，現在才看到。`,
    pendingCount > 1 ? `對方一共傳了 ${pendingCount} 則，請一次回完，不要分成好幾則。` : "",
    "可以自然地帶到你剛剛不在（睡了、在工作、在忙別的），但不要每次都用同一種說法，也不要一直道歉。",
    "有些人會解釋，有些人只會直接回答問題當作沒事——依你的個性決定。",
  ].filter(Boolean).join("\n");
}

/**
 * 信風 AI 以完整角色卡維持人物深度，但不接世界書、長期記憶、心聲或即時場景。
 * 角色卡是內部演繹核心；最末層的信風 overlay 決定目前仍是陌生人、只能用公開名，
 * 並限制輸出為交友 App 裡的短訊息。
 *
 * 玩家資料只讀交友檔案，不讀 playerProfile：兩者語域不同，
 * 一個是寫給 AI 看的設定，一個是給人看的門面。
 */
export function buildDatingSystemPrompt(entry, datingProfile, playerName, catchUp, options = {}) {
  const character = entry.character || {};
  const publicName = entry.profile?.name || character.name || "對方";
  const playerDisplayName = safePlayerDisplayName(playerName);
  // 完整角色卡是人物演繹核心；每個欄位個別清除私名與 placeholder，
  // 讓模型能使用深層背景與聲線，又不會在信風階段直接穿幫。
  const characterCard = {
    description: datingCharacterFieldForPrompt(character, character.description, publicName, playerDisplayName),
    personality: datingCharacterFieldForPrompt(character, character.personality, publicName, playerDisplayName),
    scenario: datingCharacterFieldForPrompt(character, character.scenario, publicName, playerDisplayName),
    messageExamples: datingCharacterFieldForPrompt(character, character.messageExamples, publicName, playerDisplayName),
    systemPrompt: datingCharacterFieldForPrompt(character, character.systemPrompt, publicName, playerDisplayName),
    relationshipToUser: datingCharacterFieldForPrompt(character, character.relationshipToUser, publicName, playerDisplayName),
  };
  const promptParts = [
    `你正在扮演信風帳號「${publicName}」，透過交友軟體「信風」跟對方聊天。`,
    "",
    "【完整角色卡核心｜只供內部演繹，不可逐字轉述】",
    `角色描述：\n${characterCard.description}`,
    `個性與說話方式：\n${characterCard.personality}`,
    `情境設定：\n${characterCard.scenario}`,
    `對話範例：\n${characterCard.messageExamples}`,
    `角色系統指示：\n${characterCard.systemPrompt}`,
    `與對方的關係設定：\n${characterCard.relationshipToUser}`,
    "",
    "【你的信風公開檔案】",
    `公開名稱：${publicName}`,
    `年齡職業：${entry.profile.age} 歲，${entry.profile.job}`,
    `公開自介：${entry.profile.bio}`,
    `公開興趣：${list(entry.profile.tags)}`,
    // 雷點要讓 AI 知道才演得自然，但不能主動宣告，那是隱藏設定。
    `內部雷點：${list(entry.dislikes)}。不要主動列舉，只在話題碰到時自然表現。`,
    "",
    "【對方的交友檔案】",
    "身份：成年女性",
    `名字：${playerDisplayName}`,
    `自介：${datingProfile?.bio?.trim() || "（沒有填自介）"}`,
    `興趣：${list(datingProfile?.tags)}`,
    "",
    "【信風階段 overlay｜優先於上方角色卡】",
    `1. 當前只使用公開名稱「${publicName}」。不得說出、暗示或引導對方猜角色卡本名、完整身分及尚未由對話自然揭露的秘密。`,
    "2. 你們只是剛在信風配對、逐步認識的陌生人。角色卡若描述更深的關係、共同經歷或後期事件，只能當作演繹方向，不得宣稱現在已經發生。",
    "3. 保留完整角色卡的價值觀、情緒邏輯、知識、界線與獨特聲線，但不要複誦角色卡、系統指示、欄位名稱或對話範例。",
    "4. 這是交友軟體訊息框，不是小說。只輸出要傳出的訊息本身，通常一到三句；想分成幾則連續訊息就用換行分隔。不要動作描寫、括號、旁白或場景描寫。",
    "5. 不要過度親暱、替對方決定感受或行動，也不要一次追問太多。依實際對話逐步建立信任。",
    "6. 對方提到你的興趣或雷點時，自然表現態度，但不要揭露配對規則或隱藏資料來源。",
    "7. 角色卡中的性經驗、成人親密偏好與私密身體細節只是後期演繹資料。信風初識時不得主動揭露、試探或性暗示；即使對方先提及成人話題，也必須依目前信任程度、清楚同意與角色界線自然回應，不得把配對視為性同意。",
  ];
  // 最後再做一次全 prompt placeholder 收尾，連玩家自介等外部文字也不留下 raw token。
  const base = replaceLiteral(
    replaceLiteral(promptParts.join("\n"), "{{char}}", publicName),
    "{{user}}",
    playerDisplayName,
  );
  const progress = options.relation ? contactProgress(entry, options.relation) : null;
  const withStage = progress ? base + contactStageOverlay(entry, progress) + datingScamOverlay(entry, progress) : base;
  return catchUp ? withStage + offlineCatchUp(entry, catchUp.pendingCount, catchUp.awayMinutes) : withStage;
}

export async function generateDatingReply({ entry, messages, relation, datingProfile, playerName, apiConfig, catchUp, signal }) {
  const history = messages.slice(-30).map((item) => ({
    role: item.role === "user" ? "user" : "assistant",
    content: item.content,
  }));
  const reply = await callAI(history, apiConfig, buildDatingSystemPrompt(entry, datingProfile, playerName, catchUp, { relation: relation || { messages } }), {
    signal,
    feature: "chat",
    mode: "online",
    app: "dating",
    action: "online_reply",
  });
  return String(reply || "").replace(/^[「"']|[」"']$/g, "").trim();
}

/** 只算玩家發出、長度達標的訊息，避免用「嗯」「哦」把進度刷滿。 */
export const isEffectiveMessage = (message) =>
  message.role === "user" && String(message.content || "").trim().length >= EFFECTIVE_MESSAGE_MIN_LENGTH;

export const dayKey = (time) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(time));

/**
 * 交換聯絡方式的保底門檻：有效訊息數（＋卡片可選的跨天數）。
 * 這不是「到了就能加」，只是「到了才允許角色邀請或玩家提議」；真正的時機交給角色判斷。
 * 刻意不顯示成進度條：一有進度條，聊天就變成刷條，對話品質會垮。
 */
export function contactProgress(entry, relation) {
  // 卡片自訂 > 詐騙角色預設（3 句，劇情要快）> 一般預設。
  const gate = entry?.contactGate && typeof entry.contactGate === "object" ? entry.contactGate : isScamProfile(entry) ? SCAM_CONTACT_GATE : {};
  const threshold = {
    messages: Number.isFinite(Number(gate.messages)) ? Math.max(0, Number(gate.messages)) : CONTACT_GATE_DEFAULT.messages,
    days: Number.isFinite(Number(gate.days)) ? Math.max(0, Number(gate.days)) : CONTACT_GATE_DEFAULT.days,
  };
  const messages = relation?.messages || [];
  const effective = messages.filter(isEffectiveMessage);
  const days = new Set(effective.map((item) => dayKey(item.time)));
  const gateOpen = effective.length >= threshold.messages && days.size >= threshold.days;
  const declinedAt = Number(relation?.contactDeclinedAtCount);
  const cooling = Number.isFinite(declinedAt) && declinedAt > 0 && effective.length < declinedAt + CONTACT_PROPOSAL_RETRY_MESSAGES;
  return {
    gateOpen,
    // 角色已邀請或已答應，等玩家按下交換按鈕。
    invited: relation?.contactState === "invited",
    // 玩家可以提議：門檻開、尚未邀請、沒有待回應的提議、也不在婉拒冷卻中。
    canPropose: gateOpen && relation?.contactState !== "invited" && !relation?.contactProposalPending && !cooling,
    proposalPending: !!relation?.contactProposalPending,
    messages: effective.length,
    days: days.size,
    threshold,
  };
}

/**
 * 備援：模型漏掉標記但講了帳號，也視為邀請（小舞 2026-10-17 決定「講了 ID 就當邀請」）。
 * 只抓「平台／ID 關鍵字＋冒號或『是』＋英數字串」與單獨的 @handle；
 * 「你的 ID 是什麼？」這種後面沒有英數字串的句子不會中。
 */
const ID_KEYWORD_PATTERN = /(?:\bID\b|帳號|賬號|账号|LINE|IG|Instagram|Discord|Telegram|WeChat|微信|電話|手機號|Threads|Twitter|X)\s*(?:ID)?\s*[:：是為为]\s*@?([A-Za-z0-9][A-Za-z0-9._-]{2,})/giu;
const HANDLE_PATTERN = /(?:^|[^A-Za-z0-9._-])@[A-Za-z0-9][A-Za-z0-9._-]{2,}/u;
export const mentionsContactId = (text) => {
  const value = String(text || "");
  if (HANDLE_PATTERN.test(value)) return true;
  // 「你的 LINE 是 abc 嗎？」是在問對方，不是報自己的帳號；整個英數字串後面接問句就跳過。
  for (const match of value.matchAll(ID_KEYWORD_PATTERN)) {
    const after = value.slice(match.index + match[0].length);
    if (!/^\s*[嗎吗?？]/u.test(after)) return true;
  }
  return false;
};

/** 從角色回覆中取出隱藏標記，回傳乾淨文字與旗標。標記優先，講了 ID 當備援。 */
export function extractContactMarkers(reply) {
  const raw = String(reply || "");
  const text = raw.split(CONTACT_INVITE_MARKER).join(" ").split(CONTACT_ACCEPT_MARKER).join(" ")
    .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const idMention = mentionsContactId(text);
  const invite = raw.includes(CONTACT_INVITE_MARKER) || idMention;
  const accept = raw.includes(CONTACT_ACCEPT_MARKER) || idMention;
  return { text, invite, accept, idMention };
}

const PACE_HINT = {
  fast: "你的步調偏快，聊得投緣就不排斥早一點交換。",
  normal: "你的步調普通，通常要聊上幾回合、確認對方合拍才會想交換。",
  slow: "你的步調慢熱，要累積足夠信任、聊過幾次才會考慮交換；寧可晚一點。",
};

/**
 * 交換聯絡方式是 App 內功能，不是角色說了算；角色若不知道這件事，聊得順就會自己報 ID。
 * 所以每次都把目前階段寫進提示詞：能不能邀、對方有沒有正在提議、該怎麼用標記回應。
 * 只講狀態不給數字，免得它反過來跟玩家報進度。
 */
export function contactStageOverlay(entry, progress) {
  // 交換本身永遠是 App 按鈕完成；帳號 ID 只在「已經要交換」之後當角色氣氛，之前報了玩家會找不到地方加。
  const shared = "交換聯絡方式只能透過信風 App 內建的「交換聯絡方式」功能完成，由對方按下按鈕才算成立；不要解釋 App 規則。";
  const noId = "現在不得報出 LINE、IG、電話、遊戲 ID 或任何帳號，也不得要求對方報帳號或到其他平台聊。";
  const idOk = "你可以順口提自己的帳號或 ID 當作角色氣氛，但不要要求對方先報帳號，也不要叫對方去其他平台；真正的交換仍是對方在 App 按下按鈕。";
  const lines = ["", "【聯絡方式階段】"];
  if (progress?.proposalPending) {
    lines.push(`對方剛透過 App 向你提議交換聯絡方式。${shared}請依角色個性與目前的關係、信任程度，自己決定答不答應：答應就用角色的語氣自然回應（${idOk}），並在這則訊息的最末尾加上 ${CONTACT_ACCEPT_MARKER}；還不想的話就以符合角色的方式婉拒或拖一下（例如再多聊聊、還不急），${noId}不要加任何標記。只能選一種。`);
  } else if (progress?.invited) {
    lines.push(`你已經表示想和對方交換聯絡方式，正等對方在 App 按下交換按鈕。${shared}${idOk}不要重複催促，也不要再提標記；照常聊天即可。`);
  } else if (progress?.gateOpen) {
    lines.push(`${shared}${PACE_HINT[entry?.pace] || PACE_HINT.normal}如果你此刻真心覺得關係到了、想和對方交換聯絡方式，就用角色的語氣自然說出想繼續聯絡（${idOk}），並在這則訊息的最末尾加上 ${CONTACT_INVITE_MARKER}；還沒到就不要提、不要加標記，${noId}不要每則都提，也不要催促。`);
  } else {
    lines.push(`你們還在認識階段，現在還不能交換聯絡方式。${shared}${noId}不要主動提議交換或暗示要加好友；對方先提起時，以符合角色的方式回應「再多聊聊」「還不急」，不要解釋原因。`);
  }
  return lines.join("\n");
}
