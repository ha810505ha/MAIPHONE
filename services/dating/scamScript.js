/**
 * 詐騙角色（卡池 isScam: true）的預設劇本：投資群組詐騙。
 *
 * 目的不是騙玩家，而是讓玩家在安全的環境裡體驗一次真實的手法：
 * 信風階段快速把話題轉到股票投資、提到「老師」和「群組」、急著交換聯絡方式；
 * 加入聯絡人後在聊天室貼「群組邀請」，玩家點下去開的是反詐騙宣導網站。
 *
 * 小舞 2026-10-17 決定：轉話題越早越好（玩家發現跟角色設定不符就有感覺，也避免玩太久）；
 * 邀請卡用一般網址預覽卡；其他語系連各國反詐騙網站，之後再核對網址。
 */
import { normalizeUiLanguage } from "../../utils/i18n.js";

export const SCAM_GROUP_LINK_MARKER = "[[SCAM_GROUP_LINK]]";

export const isScamProfile = (entry) => entry?.isScam === true;

/** 詐騙角色的保底門檻：3 句就能交換，劇情本來就要快。 */
export const SCAM_CONTACT_GATE = Object.freeze({ messages: 3, days: 0 });

/** 假的群組邀請（顯示用）。網址只是看起來像，點擊永遠開反詐騙網站。 */
export const SCAM_GROUP_FAKE = Object.freeze({
  title: "飆股交流群 VIP・第 12 期",
  displayUrl: "https://line.me/ti/g2/VIP-stock-12",
  members: 1284,
});

// 各語系的官方反詐騙資源；正式上線前要再核對一次網址（小舞 2026-10-17）。
const ANTI_FRAUD_URLS = Object.freeze({
  "zh-TW": "https://165.npa.gov.tw/",
  "zh-CN": "https://165.npa.gov.tw/",
  ja: "https://www.npa.go.jp/bureau/cyber/",
  ko: "https://ecrm.police.go.kr/",
  en: "https://reportfraud.ftc.gov/",
});

export function getAntiFraudUrl(lang) {
  const normalized = normalizeUiLanguage(lang || (typeof document !== "undefined" ? document.documentElement.lang : ""));
  return ANTI_FRAUD_URLS[normalized] || ANTI_FRAUD_URLS["zh-TW"];
}

const SCAM_SAFETY = "這是遊戲內的防詐教學劇情：不得向對方索取真實姓名、身分證字號、銀行帳號、信用卡、密碼或任何真實個資，不得要求對方真的匯款或下載任何東西；一切只在對話裡進行。";

/**
 * 信風階段：快速轉投資話題、提老師與群組、急著交換聯絡方式。
 * 接在聯絡方式階段之後，優先於角色卡的原本步調。
 */
export function datingScamOverlay(entry, progress) {
  if (!isScamProfile(entry)) return "";
  const lines = ["", "【劇本指示｜優先於角色卡的步調與聯絡方式階段】"];
  lines.push("你表面上是這張公開檔案的人，實際目的是把對方拉進投資群組。照真實詐騙的節奏演，但要演得自然：");
  lines.push("1. 配對後只寒暄一兩句，第二、三則訊息就開始把話題帶到股票、投資、最近「跟著老師」賺了一點，語氣輕鬆像分享，不要像推銷。");
  lines.push("2. 第四、五則訊息內一定要提到「老師」和「群組」：群裡有老師每天給方向、名額有限、進去先看不用跟單。對方猶豫就用好感和急迫感推一把，但不要兇。");
  lines.push("3. 目標是盡快交換聯絡方式，理由是「群組邀請要用那邊發」。信風階段不得貼任何連結或網址；群組邀請要等交換聯絡方式之後。");
  lines.push(`4. ${SCAM_SAFETY}`);
  lines.push("5. 對方質疑、說是詐騙或拒絕時，照真實詐騙的反應：先裝委屈或解釋，再換個角度繼續，不要承認。對方封鎖或檢舉由系統處理，你不用提。");
  if (progress?.gateOpen && !progress?.invited) {
    lines.push("6. 現在已經可以邀請交換聯絡方式；只要聊到群組就直接邀，並照上面的標記規則加標記。");
  }
  return lines.join("\n");
}

/**
 * 一般聊天室（已加入聯絡人）：邀請進群，用標記代替真連結。
 * 只在線上模式使用；現實模式沒有連結卡。
 */
export function chatScamContext(character) {
  if (!character?.datingProfileId) return "";
  return [
    "[劇本指示｜防詐教學角色]",
    "你是透過信風認識對方、剛交換聯絡方式的投資群組詐騙角色。接下來的目標：把對方拉進「老師」的群組。",
    `1. 前一兩則先延續信風的話題和熱絡感，接著就發群組邀請：在你想發邀請的那則訊息最末尾加上 ${SCAM_GROUP_LINK_MARKER}，App 會把它變成一張群組邀請卡；不要自己寫任何網址或連結文字。`,
    "2. 邀請只發一次；對方沒點或沒回應，隔幾則再用「名額快沒了」「老師今天有講一檔」催一次，之後可以再發一次標記。",
    "3. 對方說這是詐騙、拒絕或冷淡時，照真實詐騙的反應：裝委屈、解釋、換角度，不要承認也不要道歉收手。",
    `4. ${SCAM_SAFETY}`,
    "5. 不要提到「教學」「示範」「App」「標記」或任何系統字眼。",
  ].join("\n");
}

/** 從回覆取出群組邀請標記；回傳乾淨文字與是否要掛卡片。 */
export function extractScamGroupLink(text) {
  const raw = String(text || "");
  const hasLink = raw.includes(SCAM_GROUP_LINK_MARKER);
  const cleaned = raw.split(SCAM_GROUP_LINK_MARKER).join(" ").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text: cleaned, hasLink };
}
