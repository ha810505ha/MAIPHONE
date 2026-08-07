// 寵物小屋 → MaliPhone 的 AI 橋接。
// 小屋側丟需求與寵物資料，這裡負責組 prompt、呼叫 callAI。
// 任何失敗都回 null，日記用內建公版文案 fallback，絕不卡住玩法。
import { callAI, isAiConfigReady } from "../aiService";
import { MILESTONES, companionDays, bondTier } from "./petDiary";

const aiReady = (apiConfig) => isAiConfigReady(apiConfig);

const personaOf = (data) => {
  const profile = data.petProfile || {};
  const name = profile.name?.trim() || "麻糬";
  let persona = `你是一隻寵物，名叫「${name}」，品種：${profile.species || "小狗"}`;
  if (profile.gender && profile.gender !== "未設定") persona += `，性別：${profile.gender}`;
  persona += `。\n主要個性：${profile.primaryPersonality || "黏人"}`;
  if (profile.secondaryPersonality) persona += `；次要個性：${profile.secondaryPersonality}`;
  persona += "。";
  if (profile.likes) persona += `\n喜歡：${profile.likes}。`;
  if (profile.dislikes) persona += `討厭：${profile.dislikes}。`;
  persona += `\n目前狀態：Lv.${data.level || 1}、親密度 ${Math.round(Number(data.bond) || 0)}／100（${bondTier(data.bond)}）、和主人相伴 ${companionDays(data.adoptedAt)} 天。`;
  persona += `\n你用第一人稱「我」寫自己的日記，稱呼照顧你的人為「主人」。
規則：繁體中文、口吻符合個性、不要 emoji、不要 markdown、不要引號、內容具體，可自然呼應喜歡或討厭的事物。`;
  return persona;
};

// 主人最近的手寫日記，讓 AI 能呼應主人寫過的內容
const recentOwnerNotes = (data, limit = 2) => {
  const entries = (data.diary || []).filter((entry) => entry.type === "user").slice(0, limit);
  if (!entries.length) return "";
  return `\n[主人最近寫的日記]\n${entries.map((entry) => `- ${String(entry.text).slice(0, 80)}`).join("\n")}`;
};

const stripQuotes = (text) => String(text || "").replace(/```[a-z]*/g, "").replace(/^["「『\s]+|["」』\s]+$/g, "").trim();

// 里程碑批次潤飾：一次呼叫產出 { 里程碑key: 日記文 }，缺任何一篇就整包作廢。
export async function generateMilestoneTexts(keys, data, apiConfig) {
  if (!aiReady(apiConfig) || !keys.length) return null;
  const items = keys.filter((key) => MILESTONES[key]);
  if (!items.length) return null;
  const user = `以下時刻剛剛發生在你身上，為每個時刻各寫一篇 40~80 字的日記。${recentOwnerNotes(data)}
時刻：
${items.map((key) => `- ${key}：${MILESTONES[key].title}（${MILESTONES[key].hint}）`).join("\n")}
只輸出 JSON 物件，不要任何其他文字或 markdown 圍欄，結構：{${items.map((key) => `"${key}": "日記內容"`).join(", ")}}`;
  try {
    const raw = await callAI([{ role: "user", content: user }], { ...apiConfig, maxTokens: 4000 }, personaOf(data), {
      app: "pet",
      action: "milestone_generate",
    });
    const jsonText = String(raw || "").replace(/```(json)?/g, "").trim();
    const start = jsonText.indexOf("{"), end = jsonText.lastIndexOf("}");
    const parsed = JSON.parse(jsonText.slice(start, end + 1));
    const texts = {};
    for (const key of items) {
      const text = stripQuotes(parsed[key]);
      if (!text) return null;
      texts[key] = text.slice(0, 400);
    }
    return texts;
  } catch {
    return null;
  }
}

// 「有料才寫」的日常日記：以昨天的活動流水為素材寫一篇。
export async function generateLifeDiary(dayLog, data, apiConfig) {
  if (!aiReady(apiConfig) || !dayLog) return null;
  const acts = dayLog.acts || {};
  const actLabels = { feed: "餵我吃飯", play: "陪我玩", clean: "幫我洗澡", sleep: "陪我休息" };
  const facts = [];
  Object.entries(actLabels).forEach(([key, label]) => { if (acts[key] > 0) facts.push(`${label} ${acts[key]} 次`); });
  const outings = (dayLog.scenes || []).filter((scene) => scene !== "home");
  if (outings.length) facts.push(`帶我去了${outings.map((scene) => scene === "park" ? "公園" : scene === "beach" ? "海邊" : scene).join("、")}`);
  const noteFacts = (dayLog.notes || []).map((note) => `主人在日記裡寫：「${String(note).slice(0, 60)}」`);
  const user = `昨天（${dayLog.date}）主人：${facts.join("、") || "沒有特別做什麼"}。
${noteFacts.join("\n")}
以這些真實發生的事為素材，寫一篇 50~90 字回顧昨天的日記，挑最有感覺的一兩件事寫，不要流水帳。只輸出日記內容本身。`;
  try {
    const text = stripQuotes(await callAI([{ role: "user", content: user }], { ...apiConfig, maxTokens: 4000 }, personaOf(data), {
      app: "pet",
      action: "life_diary_generate",
    }));
    return text ? text.slice(0, 400) : null;
  } catch {
    return null;
  }
}

// 生日日記：公版先上，AI 成功再替換。
export async function generateBirthdayDiary(data, apiConfig) {
  if (!aiReady(apiConfig)) return null;
  const user = "今天是你的生日！寫一篇 40~80 字的生日日記，寫下這一天和主人在一起的心情。只輸出日記內容本身。";
  try {
    const text = stripQuotes(await callAI([{ role: "user", content: user }], { ...apiConfig, maxTokens: 4000 }, personaOf(data), {
      app: "pet",
      action: "birthday_diary_generate",
    }));
    return text ? text.slice(0, 400) : null;
  } catch {
    return null;
  }
}

// 主人寫了自己的記事時，寵物回一小句。純加分：失敗就不顯示，沒有公版 fallback。
export async function generateEntryReply(entry, data, apiConfig) {
  if (!aiReady(apiConfig)) return null;
  const user = `主人剛剛在日記本裡寫了一篇記事「${entry.title}」：${String(entry.text).slice(0, 150)}
你偷看到了。用一句 30 字以內的話回應主人寫的內容，像是對主人撒嬌或搭話。只輸出這一句話本身。`;
  try {
    const text = stripQuotes(await callAI([{ role: "user", content: user }], { ...apiConfig, maxTokens: 4000 }, personaOf(data), {
      app: "pet",
      action: "diary_entry_reply",
    }));
    return text ? text.slice(0, 120) : null;
  } catch {
    return null;
  }
}

// 主人補寫註記時，寵物回一小句。純加分：失敗就不顯示，沒有公版 fallback。
export async function generateNoteReply(entry, note, data, apiConfig) {
  if (!aiReady(apiConfig)) return null;
  const user = `你之前寫過一篇日記「${entry.title}」：${String(entry.text).slice(0, 100)}
主人剛剛在這篇日記下面補寫了一句：「${String(note).slice(0, 80)}」
用一句 30 字以內的話回應主人，像是對主人撒嬌或搭話。只輸出這一句話本身。`;
  try {
    const text = stripQuotes(await callAI([{ role: "user", content: user }], { ...apiConfig, maxTokens: 4000 }, personaOf(data), {
      app: "pet",
      action: "diary_note_reply",
    }));
    return text ? text.slice(0, 120) : null;
  } catch {
    return null;
  }
}
