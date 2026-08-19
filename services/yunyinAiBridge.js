// 雲隱山莊 → MaliPhone 的 AI 橋接。
// 遊戲側只丟角色 id 與需求，這裡負責找角色卡、組 prompt、呼叫 callAI。
// 任何失敗都回 null，遊戲用內建句庫 fallback，絕不卡住遊戲。
import { callAI, isAiConfigReady } from "./aiService";

const charPersona = (char) => {
  let p = `你是「${char.name}」。`;
  if (char.relationshipToUser) p += `\n[與玩家關係]\n${char.relationshipToUser}`;
  if (char.personality) p += `\n[個性]\n${char.personality}`;
  else if (char.description) p += `\n[角色描述]\n${String(char.description).slice(0, 400)}`;
  return p;
};

// 生成個人句庫：一次呼叫產出全部觸發池的台詞 JSON（poolSpec = { 池名: 句數 }）。
// 成功回傳 { 池名: [句...] }，任何失敗回 null。
export async function yunyinGenerateLinePack(charId, poolSpec, apiConfig, characters, locale = "zh-TW") {
  const char = characters.find((c) => c.id === charId);
  if (!char || !isAiConfigReady(apiConfig)) return null;

  const outputLanguage = {
    "zh-TW": "繁體中文",
    "zh-CN": "簡體中文",
    en: "英文",
    ja: "日文",
    ko: "韓文",
  }[locale] || "繁體中文";

  const sys = `${charPersona(char)}
[情境]
你住在玩家經營的修仙莊園「雲隱山莊」，陪伴玩家修行、種靈田、闖秘境。
[任務]
為下列遊戲時機各寫台詞，以你的角色口吻對玩家說，每句簡短自然。所有台詞必須使用${outputLanguage}，不要旁白動作描寫、不要引號。
只輸出 JSON 物件，不要任何其他文字或 markdown 圍欄。`;

  const poolDesc = {
    breakthrough_ok: "玩家突破境界成功時的祝賀",
    breakthrough_fail: "玩家突破失敗、修為折損時的安慰",
    dungeon: "陪玩家在秘境探索途中的搭話",
    dungeonBoss: "秘境 Boss 戰前後的打氣",
    harvest: "玩家在靈田收成時的搭話",
    rareHarvest: "玩家收成稀有作物（星露籽）時的驚嘆",
    chat: "玩家在莊園裡點你打招呼時的日常閒聊",
    home: "角色已正式入住玩家家中後的居家日常台詞，要有共同生活與熟悉感，不要寫成普通路人寒暄",
  };
  const user = `輸出這個結構的 JSON：\n{${Object.entries(poolSpec)
    .map(([k, n]) => `"${k}": [${n} 句「${poolDesc[k] || k}」]`)
    .join(", ")}}`;

  const raw = await callAI([{ role: "user", content: user }], { ...apiConfig, maxTokens: 2000 }, sys, {
    app: "yunyin",
    action: "game_event_generate",
  });
  try {
    const jsonText = String(raw || "").replace(/```(json)?/g, "").trim();
    const start = jsonText.indexOf("{"), end = jsonText.lastIndexOf("}");
    const parsed = JSON.parse(jsonText.slice(start, end + 1));
    const lines = {};
    for (const key of Object.keys(poolSpec)) {
      const arr = Array.isArray(parsed[key]) ? parsed[key] : [];
      lines[key] = arr.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 60));
      if (!lines[key].length) return null; // 缺池就整包作廢，避免半殘句庫
    }
    return lines;
  } catch {
    return null;
  }
}

// （舊的「每次觸發即時生成一句」已退役，改為上面的一次性句庫生成）
