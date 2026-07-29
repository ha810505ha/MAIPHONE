import { sanitizeText } from "./coreUtils.js";

export const ONLINE_CHAT_TEXT_LIMIT = 800;
export const REALITY_CHAT_TEXT_LIMIT = 4000;

const MAX_ASSISTANT_BUBBLES = 6;

export function estimateTokens(value) {
  const text = String(value || "");
  const cjkCount = (text.match(/[぀-ヿ一-鿿가-힯]/g) || []).length;
  return Math.ceil(cjkCount + (text.length - cjkCount) / 4);
}

export function isChatMode(mode) {
  return mode === "reality" || mode === "online";
}

export function getMessageMode(message) {
  return isChatMode(message?.mode) ? message.mode : "online";
}

export function getLastCommittedChatMode(chatHistory, characterId) {
  const messages = chatHistory?.[characterId] || [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "mode_transition") {
      return isChatMode(message.toMode) ? message.toMode : "online";
    }
    if (message?.role === "user" || message?.role === "assistant") {
      return getMessageMode(message);
    }
  }
  return "online";
}

export function getSelectedChatMode(chatModes, chatHistory, characterId) {
  return chatModes?.[characterId] || getLastCommittedChatMode(chatHistory, characterId);
}

export function getChatTextLimit(mode) {
  return mode === "reality" ? REALITY_CHAT_TEXT_LIMIT : ONLINE_CHAT_TEXT_LIMIT;
}

export function getModeLabel(mode, tr) {
  return mode === "reality"
    ? tr("現實模式", "Reality mode", "現実モード", "현실 모드")
    : tr("線上聊天", "Online chat", "オンラインチャット", "온라인 채팅");
}

export function stripModeLabel(value) {
  return String(value || "")
    .replace(/^[\s\uFEFF\xA0]*[【\[]\s*(?:目前互動模式[:：]?\s*)?(線上聊天|現實模式)\s*[】\]]\s*/g, "")
    .replace(/^[\s\uFEFF\xA0]*(?:目前互動模式[:：]?\s*)?(線上聊天|現實模式)\s*[：:．。-]?\s*/g, "")
    .replace(/^[\s\uFEFF\xA0]*[【\[]\s*(?:模式[:：]?\s*)?(線上聊天|現實模式)\s*[】\]]\s*/g, "")
    .trim();
}

export function stripUserPlaceholder(value, userDisplayName) {
  return String(value || "")
    .replace(/\{\{user\}\}/gi, userDisplayName)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([，。！？、,.!?；;：:])/g, "$1")
    .trim();
}

export function stripInternalBlocks(value) {
  return String(value || "")
    .replace(/<internal>[\s\S]*?<\/internal>/gi, " ")
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function displayWalletText(value, userDisplayName) {
  return String(value || "")
    .replace(/\{\{user\}\}/gi, userDisplayName)
    .replace(/玩家/g, userDisplayName)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([，。！？、,.!?；;：:])/g, "$1")
    .trim();
}

export function normalizeAssistantReply(value) {
  if (!value) return "";
  let text = String(value).trim();
  text = stripInternalBlocks(text);
  text = stripModeLabel(text);
  text = text
    .replace(/\*[^*]{1,120}\*/g, " ")
    .replace(/（[^（）]{1,120}）/g, " ")
    .replace(/\([^()]{1,120}\)/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || "嗯，我在。";
}

export function normalizeRealityReply(value) {
  const text = String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || "他安靜地看著你，像是在等你把話說完。";
}

export function splitAssistantBubbles(value) {
  const lines = String(value || "")
    .replace(/\\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [String(value || "").trim()].filter(Boolean);
  if (lines.length <= MAX_ASSISTANT_BUBBLES) return lines;
  return [
    ...lines.slice(0, MAX_ASSISTANT_BUBBLES - 1),
    lines.slice(MAX_ASSISTANT_BUBBLES - 1).join("\n"),
  ];
}

export function extractTransferDirective(value) {
  const raw = String(value || "");
  const matches = [...raw.matchAll(/\[\[TRANSFER:amount=(\d+)(?:;note=([^\]]*))?\]\]/gi)];
  if (!matches.length) return { text: raw, transfer: null };

  const transfer = matches[matches.length - 1];
  const cleaned = raw
    .replace(/\s*\[\[TRANSFER:amount=\d+(?:;note=[^\]]*)?\]\]\s*/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return {
    text: cleaned,
    transfer: {
      amount: Number(transfer[1]),
      note: sanitizeText(transfer[2] || "", 60),
    },
  };
}

export function extractTransferResponseDirective(value) {
  const raw = String(value || "");
  const matches = [...raw.matchAll(/\[\[TRANSFER_RESPONSE:id=([^;\]]+);decision=(accept|return|pending)\]\]/gi)];
  if (!matches.length) return { text: raw, response: null };

  const response = matches[matches.length - 1];
  return {
    text: raw
      .replace(/\s*\[\[TRANSFER_RESPONSE:id=[^;\]]+;decision=(?:accept|return|pending)\]\]\s*/gi, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    response: {
      transferId: response[1],
      decision: response[2].toLowerCase(),
    },
  };
}

export function isGemmaModel(modelName) {
  return /gemma/i.test(String(modelName || ""));
}

export function parseShareEventNotice(value) {
  const raw = String(value || "");
  if (!raw.startsWith("[APP_SHARE_EVENT]")) return null;

  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  const meta = {};
  let bodyStart = 1;
  for (let index = 1; index < lines.length; index += 1) {
    if (!lines[index].includes("=")) {
      bodyStart = index;
      break;
    }
    const separatorIndex = lines[index].indexOf("=");
    const key = lines[index].slice(0, separatorIndex);
    const metaValue = lines[index].slice(separatorIndex + 1);
    meta[key] = metaValue;
    bodyStart = index + 1;
  }
  return { meta, body: lines.slice(bodyStart).join("\n") };
}
