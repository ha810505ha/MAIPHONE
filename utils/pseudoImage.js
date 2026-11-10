// 示意圖片：畫面上顯示色塊，實際只把描述文字送進模型，完全不佔用視覺 token。
// 也讓不支援讀圖的模型能參與「傳照片」的互動。
import { resolvePseudoVoiceDuration } from "./pseudoVoice.js";

export const PSEUDO_IMAGE_DESC_LIMIT = 80;

// 同一段描述永遠得到同一個色相，讓同一張「照片」在歷史裡看起來一致。
export function pseudoImageHue(text) {
  const raw = String(text || "");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) % 360;
  return hash;
}

export function createPseudoImage(desc) {
  const text = String(desc || "").trim().slice(0, PSEUDO_IMAGE_DESC_LIMIT);
  if (!text) return null;
  return { desc: text, hue: pseudoImageHue(text) };
}

export function pseudoImageStyle(pseudoImage) {
  const hue = Number(pseudoImage?.hue ?? 0);
  return {
    background: `linear-gradient(135deg, hsl(${hue} 62% 76%), hsl(${(hue + 42) % 360} 58% 62%))`,
  };
}

// 進 prompt 的樣子：模型只會看到這行文字，不會收到任何圖片資料。
export function pseudoImagePromptLine(pseudoImage, senderLabel) {
  if (!pseudoImage?.desc) return "";
  return `\n[圖片] ${senderLabel}傳了一張照片，內容是：${pseudoImage.desc}`;
}

// 給各種「把對話壓成純文字」的摘要用途（角色手機、洞察、社群動態）：
// 示意圖片要變回可讀的一行，否則那些摘要只會看到空字串或無意義的 [圖片]。
export function messagePlainText(message, imageFallback = "[圖片]") {
  const base = String(message?.content || "").trim();
  const photo = message?.pseudoImage?.desc ? `[照片：${message.pseudoImage.desc}]` : "";
  const voice = message?.pseudoVoice?.transcript
    ? `[語音 ${resolvePseudoVoiceDuration(message.pseudoVoice)} 秒：${message.pseudoVoice.transcript}]`
    : "";
  return [voice ? "" : base, photo, voice].filter(Boolean).join(" ") || (message?.image ? imageFallback : "");
}

// 聊天列表、通知等玩家看得到的簡短預覽不可顯示示意圖片描述。
// 描述只用於模型理解圖片內容；UI 一律使用呼叫端提供的「某人傳送了圖片」文字。
export function messagePreviewText(message, {
  imageText = "[圖片]",
  voiceText = "[語音訊息]",
  fallback = "",
} = {}) {
  if (!message) return fallback;
  if (message.pseudoVoice) return voiceText;
  const content = String(message.content || "").trim();
  if (content) return content;
  if (message.pseudoImage || message.image) return imageText;
  return fallback;
}

const PHOTO_DIRECTIVE_RE = /\[\[PHOTO:([^\]]*)\]\]/gi;

// 角色回覆裡的 [[PHOTO:描述]]：必須在切氣泡之前剝除，否則標記會混進氣泡顯示出來。
export function extractPhotoDirectives(text) {
  const raw = String(text || "");
  const matches = [...raw.matchAll(PHOTO_DIRECTIVE_RE)];
  if (!matches.length) return { text: raw, photos: [] };
  const photos = matches.map((match) => createPseudoImage(match[1])).filter(Boolean).slice(0, 2);
  const cleaned = raw
    .replace(PHOTO_DIRECTIVE_RE, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { text: cleaned, photos };
}

export const PHOTO_RULE_CONTEXT = [
  "[傳送照片]",
  "你可以在回覆最後附上 [[PHOTO:照片內容描述]] 來傳一張照片給 {{user}}，描述限 40 字內（例：[[PHOTO:剛煮好的義大利麵，擺在木桌上]]）。",
  "只有情境自然、你真的會拍那張照片時才用；一次最多一張，不要每輪都傳。描述只寫畫面看得到的東西，不要寫成旁白或心情敘述。",
  "{{user}} 傳來的 [圖片] 行代表對方傳了照片，請當作你真的看到那張照片並自然回應，不要說自己看不到圖片。",
].join("\n");
