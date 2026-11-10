// 估算帳號雲端文件大小：合成不同規模的玩家資料，量 JSON 原始大小與 gzip 後大小。
import { gzipSync } from "node:zlib";

// 用隨機常用字組句，避免重複文字讓 gzip 壓得不真實（真實聊天約壓到 30～45%）。
const POOL = "的一是在不了有和人這中大為上個國我以要他時來用們生到作地於出就分對成會可主發年動同工也能下過子說產種面而方後多定行學法所民得經十三之進著等部度家電力裡如水化高自二理起小物現實加量都兩體制機當使點從業本去把性好應開它合還因由其些然前外天政四日那社義事平形相全表間樣與關各重新線內數正心反你明看原又麼利比或但質氣第向道命此變條只沒結解問意建月公無系軍很情者最立代想已通並提直題黨程展五果料象員革位入常文總次品式活設及管特件長求老頭基資邊流路級少圖山統接知較將組見計別她手角期根論運農指幾九區強放決西被幹做必戰先回則任取據處隊南給色光門即保治北造百規熱領七海口東導器壓志世金增爭濟階油思術極交受聯什認六共權收證改清美再採轉更單風切打白教速花帶安場身車例真務具萬每目至達走積示議聲報鬥完類八離華名確才科張信馬節話米整空元況今集溫傳土許步群廣石記需段研界拉林律叫且究觀越織裝影算低持音眾書布复容兒須際商非驗連斷深難近礦千週委素技備半辦青省列習響約支般史感勞便團往酸歷市克何除消構府稱太準精值號率族維劃選標寫存候毛親快效斯院查江型眼王按格養易置派層片始卻專狀育廠京識適屬圓包火住調滿縣局照參紅細引聽該鐵價嚴";
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const sentence = (n) => Array.from({ length: n }, () => POOL[Math.floor(rnd() * POOL.length)]).join("");
const zh = sentence(40);
const msg = (i, role) => ({ id: `m${i}`, role, content: sentence(role === "assistant" ? 160 : 40), time: 1_790_000_000_000 + i * 60000, mode: "online" });
const character = (i) => ({ id: `c${i}`, name: `角色${i}`, persona: sentence(500), scenario: sentence(240), firstMessage: zh, tags: ["a", "b"], createdAt: 1 });
const episode = (i, n) => ({ id: `ep${i}`, characterId: "c1", mode: "reality", status: "completed", updatedAt: 1, playerMessageCount: n / 2, messages: Array.from({ length: n }, (_, k) => msg(k, k % 2 ? "assistant" : "user")) });

function build({ characters, messagesPerChar, episodes, episodeLen, notes }) {
  const chars = Array.from({ length: characters }, (_, i) => character(i));
  const chatHistory = Object.fromEntries(chars.map((c) => [c.id, Array.from({ length: messagesPerChar }, (_, i) => msg(i, i % 2 ? "assistant" : "user"))]));
  const memories = Object.fromEntries(chars.map((c) => [c.id, Array.from({ length: 30 }, (_, i) => ({ id: `mem${i}`, text: sentence(40), weight: 1, createdAt: i }))]));
  return {
    characters: chars, chatHistory, memories,
    posts: Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, text: zh, time: i, comments: [{ id: `k${i}`, text: zh }] })),
    featureData: {
      notes: Array.from({ length: notes }, (_, i) => ({ id: `n${i}`, title: "筆記", body: sentence(200) })),
      yunyinSave: { coins: 1234, inventory: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`item${i}`, i])), farm: { plots: Array.from({ length: 18 }, (_, id) => ({ id, cropId: "qingling", plantedAt: 1, readyAt: 2 })) }, home: { furnitureUnlocks: {}, placed: Array.from({ length: 40 }, (_, i) => ({ id: i, x: 1, y: 2 })) } },
      gachaInventory: Array.from({ length: 120 }, (_, i) => ({ uid: `u${i}`, cardId: `card-${i % 30}`, rarity: "SR", obtainedAt: i })),
      gachaEpisodes: Array.from({ length: episodes }, (_, i) => episode(i, episodeLen)),
      gachaSpecialMemories: Array.from({ length: 20 }, (_, i) => ({ id: `sm${i}`, episodeId: `ep${i}`, characterId: "c1", summary: sentence(120), pinned: i < 3 })),
      gachaCrystalLedger: Array.from({ length: 30 }, (_, i) => ({ id: `l${i}`, delta: 10, balance: 100 + i, at: i, note: "登入獎勵" })),
      petHome: { name: "小白", level: 5, exp: 120, hunger: 50, diary: Array.from({ length: 60 }, (_, i) => ({ id: `d${i}`, text: zh, at: i })) },
      systemMailbox: { mails: Array.from({ length: 10 }, (_, i) => ({ id: `mail${i}`, title: "系統信", body: zh.repeat(2), read: true })) },
      loginReward: { cycle: 3, day: 4, claimedDates: Array.from({ length: 20 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`) },
    },
  };
}

const profiles = [
  ["輕度：3 角色×150 則、2 段特別篇", { characters: 3, messagesPerChar: 150, episodes: 2, episodeLen: 30, notes: 10 }],
  ["中度：8 角色×600 則、10 段特別篇", { characters: 8, messagesPerChar: 600, episodes: 10, episodeLen: 40, notes: 50 }],
  ["重度：12 角色×1500 則、30 段特別篇", { characters: 12, messagesPerChar: 1500, episodes: 30, episodeLen: 40, notes: 100 }],
  ["極重：20 角色×3000 則、60 段特別篇", { characters: 20, messagesPerChar: 3000, episodes: 60, episodeLen: 40, notes: 200 }],
];
const fmt = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
for (const [label, spec] of profiles) {
  const json = JSON.stringify(build(spec));
  const gz = gzipSync(Buffer.from(json, "utf8"), { level: 6 });
  const messages = spec.characters * spec.messagesPerChar + spec.episodes * spec.episodeLen;
  console.log(`${label}｜訊息總數 ${messages}｜JSON ${fmt(json.length)}｜gzip ${fmt(gz.length)}｜壓縮比 ${(gz.length / json.length * 100).toFixed(0)}%`);
}
