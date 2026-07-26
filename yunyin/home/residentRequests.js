// 住客請求：每日全家一則（多住客隨機一位發出），完成給實物＋好感，過期無懲罰。
// 取代原本的「需求數值」設計——只有正向回饋，忘記登入不會有罪惡感。
import { furnitureById } from "./furnitureCatalog";
import { PLAYER_HOME_ID, createHomeRelationship } from "./homeState";
import { addHomeAffinity } from "./homeRelationships";
import { residentStage } from "./homeResidents";

const dayKeyOf = (now) => new Date(now).toISOString().slice(0, 10);
const STAGE_RANK = { stranger: 0, familiar: 1, friend: 2, close: 3, intimate: 4 };

// kind: item=交付背包物品／decor=屋內要有該類家具／company=陪伴（沿用互動偵測）
export const REQUEST_TEMPLATES = Object.freeze([
  { id: "req_qingling", kind: "item", itemId: "qingling", count: 3, minRank: 0, text: "想泡壺青靈草茶，能帶些回來嗎？", reward: { coins: 90 } },
  { id: "req_yuehua", kind: "item", itemId: "yuehua", count: 2, minRank: 1, text: "月華菇燉湯最補了，幫我找幾朵？", reward: { coins: 130 } },
  { id: "req_huiqi", kind: "item", itemId: "huiqi", count: 1, minRank: 1, text: "屋裡該備顆回氣丹，以防萬一。", reward: { coins: 120 } },
  { id: "req_lingmu", kind: "item", itemId: "lingmu", count: 2, minRank: 2, text: "想刻個小木雕，需要點靈木。", reward: { coins: 150 } },
  { id: "req_qingshi", kind: "item", itemId: "qingshi", count: 3, minRank: 2, text: "院子的小徑想鋪點青石。", reward: { coins: 140 } },
  { id: "req_xinglu", kind: "item", itemId: "xinglu", count: 1, minRank: 3, text: "聽說星露籽會發光，好想親眼看看。", reward: { coins: 260 } },

  { id: "req_plant", kind: "decor", category: "decor", text: "屋裡要是有盆綠意，看著就舒服。", minRank: 0, reward: { materials: { id: "qingshi", n: 3 } } },
  { id: "req_rug", kind: "decor", category: "rug", text: "地上鋪塊毯子，坐著才不涼。", minRank: 1, reward: { materials: { id: "lingmu", n: 2 } } },
  { id: "req_storage", kind: "decor", category: "storage", text: "東西越來越多了，添個櫃子吧？", minRank: 1, reward: { materials: { id: "qingshi", n: 4 } } },
  { id: "req_chair", kind: "decor", category: "chair", text: "想有張椅子，能坐著等你回來。", minRank: 2, reward: { materials: { id: "lingmu", n: 3 } } },
  { id: "req_table", kind: "decor", category: "table", text: "有張桌子的話，就能一起吃飯了。", minRank: 2, reward: { materials: { id: "qingshi", n: 5 } } },

  { id: "req_meal", kind: "company", action: "eat", text: "今晚⋯⋯一起吃頓飯好嗎？", minRank: 4, reward: { crystals: 12 } },
  { id: "req_sleep", kind: "company", action: "sleep", text: "夜深了，想聽著你的呼吸聲入睡。", minRank: 4, reward: { crystals: 15 } },
  { id: "req_read", kind: "company", action: "read", text: "陪我讀會兒書吧，不說話也好。", minRank: 4, reward: { crystals: 10 } },
]);

export const requestById = (id) => REQUEST_TEMPLATES.find((item) => item.id === id) || null;

const rankOf = (homeState, characterId) => STAGE_RANK[residentStage(homeState, characterId).id] || 0;

// 每日刷新：全家一則，發話者從住客中隨機挑一位
export function refreshDailyRequest(homeState, now = Date.now(), random = Math.random) {
  const home = homeState.homes?.[PLAYER_HOME_ID];
  if (!home) return null;
  const dayKey = dayKeyOf(now);
  if (home.request?.day === dayKey) return home.request;
  const residents = home.residents || [];
  if (!residents.length) { home.request = null; return null; }

  const speaker = residents[Math.floor(random() * residents.length)];
  const pool = REQUEST_TEMPLATES.filter((item) => item.minRank <= rankOf(homeState, speaker));
  if (!pool.length) { home.request = null; return null; }
  const template = pool[Math.floor(random() * pool.length)];
  home.request = { day: dayKey, characterId: speaker, templateId: template.id, done: false };
  return home.request;
}

// 完成條件檢查（不改狀態）：回傳 true/false
export function requestSatisfied(save, request) {
  const template = requestById(request?.templateId);
  if (!template || request.done) return false;
  const home = save.home.homes?.[PLAYER_HOME_ID];
  if (template.kind === "item") return (save.inventory[template.itemId] || 0) >= template.count;
  if (template.kind === "decor") {
    return (home?.furniture || []).some((item) => furnitureById(item.furnitureId)?.category === template.category);
  }
  return !!request.companyDone; // company：由互動當下標記
}

// 陪伴類：玩家與住客同時進行指定動作時呼叫
export function markCompanyAction(homeState, characterId, action) {
  const home = homeState.homes?.[PLAYER_HOME_ID];
  const request = home?.request;
  const template = requestById(request?.templateId);
  if (!request || request.done || !template || template.kind !== "company") return false;
  if (request.characterId !== characterId || template.action !== action) return false;
  request.companyDone = true;
  return true;
}

// 領獎：扣掉交付物品、發實物與好感。回傳 { reward, affinityGain } 或 { error }
export function claimRequest(save, now = Date.now()) {
  const homeState = save.home;
  const home = homeState.homes?.[PLAYER_HOME_ID];
  const request = home?.request;
  const template = requestById(request?.templateId);
  if (!request || !template) return { error: "目前沒有請求" };
  if (request.done) return { error: "今天的請求已經完成了" };
  if (!requestSatisfied(save, request)) return { error: "條件還沒達成" };

  if (template.kind === "item") save.inventory[template.itemId] -= template.count;
  const reward = template.reward;
  if (reward.coins) save.coins += reward.coins;
  if (reward.materials) save.inventory[reward.materials.id] = (save.inventory[reward.materials.id] || 0) + reward.materials.n;

  const relation = homeState.relationships[request.characterId] || (homeState.relationships[request.characterId] = createHomeRelationship(request.characterId));
  const affinityGain = addHomeAffinity(relation, 2, { dayKey: dayKeyOf(now) });
  request.done = true;
  return { reward, affinityGain, characterId: request.characterId };
}
