import assert from "node:assert/strict";
import { encodeChat } from "gpt-tokenizer/model/gpt-4o";
import {
  estimateSocialInputTokens,
  estimateSocialTextTokens,
} from "../services/social/characterInteraction.js";

const directText = process.argv.slice(2).join(" ").trim();
if (directText) {
  const referenceTokens = encodeChat([{ role: "user", content: directText }]).length;
  const conservativeEstimate = estimateSocialInputTokens(
    [{ role: "user", content: directText }],
    "",
  );
  console.log(JSON.stringify({
    tokenizer: "gpt-4o / o200k_base",
    textTokens: estimateSocialTextTokens(directText),
    referenceChatTokens: referenceTokens,
    conservativeChatEstimate: conservativeEstimate,
  }, null, 2));
  process.exit(0);
}

const samples = [
  {
    name: "zh-TW character post",
    systemPrompt: [
      "請始終使用繁體中文。",
      "[角色名稱] 許簡",
      "[角色個性] 冷靜、敏銳，不輕易表露情緒，但會默默關心熟悉的人。",
      "[輸出規則] 保持角色口吻，輸出一則自然的社群貼文。",
    ].join("\n"),
    messages: [{
      role: "user",
      content: [
        "請寫一則今天的生活貼文，不要提到自己是 AI。",
        "最近對話：玩家說最近工作很累；角色提醒他要記得休息。",
        "最近貼文：深夜的便利商店比白天安靜很多。",
      ].join("\n"),
    }],
  },
  {
    name: "zh-TW nested reply",
    systemPrompt: [
      "請始終使用繁體中文。",
      "[角色個性] 外冷內熱，說話簡短直接。",
      "[與玩家的關係] 已經認識很久，嘴上嫌棄但非常在意玩家。",
    ].join("\n"),
    messages: [{
      role: "user",
      content: "貼文：今天又加班了。\n許簡留言：你到底有沒有好好吃飯？\n玩家回覆：剛剛只喝了咖啡。",
    }],
  },
  {
    name: "English social prompt",
    systemPrompt: "Stay in character. Write concise, natural social replies without mentioning AI.",
    messages: [{
      role: "user",
      content: "Post: I finally finished the project after three sleepless nights. Reply as a close friend.",
    }],
  },
  {
    name: "mixed emoji and markup",
    systemPrompt: "使用繁體中文並維持角色語氣。",
    messages: [{
      role: "user",
      content: "貼文：🎉 新作品完成！\n回覆 @Liam：真的嗎？👀\n標籤：#日常 #創作 https://example.com/post/123",
    }],
  },
  {
    name: "dense structured text",
    systemPrompt: "Return one short in-character reply.",
    messages: [{
      role: "user",
      content: JSON.stringify({
        post: "測試貼文",
        replyTo: "角色A",
        flags: ["social", "character-to-character", "nested-reply"],
        score: 0.875,
      }),
    }],
  },
];

const results = samples.map(({ name, systemPrompt, messages }) => {
  const referenceTokens = encodeChat([
    { role: "system", content: systemPrompt },
    ...messages,
  ]).length;
  const conservativeEstimate = estimateSocialInputTokens(messages, systemPrompt);
  return {
    sample: name,
    reference: referenceTokens,
    estimate: conservativeEstimate,
    ratio: Number((conservativeEstimate / referenceTokens).toFixed(2)),
  };
});

for (const result of results) {
  assert.ok(
    result.estimate >= result.reference,
    `${result.sample}: conservative estimate ${result.estimate} fell below o200k reference ${result.reference}`,
  );
}

console.table(results);
console.log("ok: social input estimator stays conservative against the gpt-4o o200k_base reference");
console.log("note: Claude, Gemini, OpenRouter-routed, and Ollama models can tokenize the same prompt differently");
