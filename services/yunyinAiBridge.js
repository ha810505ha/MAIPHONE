// 雲隱山莊 → MaliPhone 的 AI 橋接。
// 遊戲側只丟 { charId, trigger, prompt }，這裡負責找角色卡、組輕量 prompt、呼叫 callAI。
// 遊戲永遠拿「一句話或 null」，null 時遊戲用內建句庫，絕不卡住遊戲。
import { callAI } from "./aiService";

export async function yunyinAiReact(context, apiConfig, characters) {
  const char = characters.find((c) => c.id === context.charId);
  if (!char || !apiConfig?.apiKey) return null;

  let sys = `你是「${char.name}」。`;
  if (char.relationshipToUser) sys += `\n[與玩家關係]\n${char.relationshipToUser}`;
  if (char.personality) sys += `\n[個性]\n${char.personality}`;
  else if (char.description) sys += `\n[角色描述]\n${String(char.description).slice(0, 400)}`;
  sys += `
[情境]
你目前住在玩家經營的修仙莊園「雲隱山莊」裡，陪伴玩家修行、種靈田、闖秘境。
[規則]
針對接下來描述的遊戲事件，以你的角色口吻對玩家說「一句話」（30 字以內）。
只輸出那句話本身：不要旁白、動作描寫、引號、角色名前綴。使用繁體中文。`;

  const text = await callAI(
    [{ role: "user", content: context.prompt }],
    { ...apiConfig, maxTokens: 200 },
    sys,
  );
  const line = String(text || "").trim().split("\n")[0].slice(0, 60);
  return line || null;
}
