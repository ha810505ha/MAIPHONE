// 今日頁、入住管理、商店共用的「領取請求／交付訂單」動作與今日摘要。
// 結算邏輯本身在 residentRequests／shop；這裡只負責結算後的獎勵入帳、提示與存檔。
import { PLAYER_HOME_ID } from "../home/homeState";
import { requestById, requestSatisfied, claimRequest } from "../home/residentRequests";
import { deliverOrder, itemMeta } from "../systems/shop";

export function requestRewardText(template) {
  if (!template) return "";
  if (template.reward.coins) return `🪙${template.reward.coins}`;
  if (template.reward.crystals) return `💎${template.reward.crystals}`;
  return `${itemMeta(template.reward.materials.id).icon}×${template.reward.materials.n}`;
}

export function claimResidentRequest({ save, characters = [], yt, ym, onCrystals, onToast, onDirty }) {
  const request = save.home?.homes?.[PLAYER_HOME_ID]?.request;
  const template = requestById(request?.templateId);
  const speaker = characters.find((item) => item.id === request?.characterId);
  const result = claimRequest(save);
  if (result.error) { onToast(ym(result.error)); return false; }
  if (result.reward.crystals) onCrystals?.(result.reward.crystals, {
    note: yt("resident.requestNote", { name: speaker?.name || yt("resident.guest") }),
  });
  onDirty();
  onToast(yt("resident.claimed", { reward: requestRewardText(template), affinity: result.affinityGain }));
  return true;
}

export function deliverShopOrder({ save, order, yt, yv, ym, onCrystals, onToast, onDirty }) {
  const meta = itemMeta(order.itemId);
  const result = deliverOrder(save, order.id);
  if (typeof result === "string") { onToast(ym(result)); return false; }
  onCrystals(result.rewardCrystals, { note: yt("shop.orderNote", { name: yv(meta.name) }) });
  const extras = `${result.blueprintName ? yt("shop.gainedBlueprint", { name: yv(result.blueprintName) }) : ""}${result.materials ? yt("shop.gainedMaterial", { icon: itemMeta(result.materials.id).icon, name: yv(itemMeta(result.materials.id).name), count: result.materials.n }) : ""}`;
  onToast(yt("shop.deliveryComplete", { coins: result.rewardCoins, crystals: result.rewardCrystals, extras }));
  onDirty();
  return true;
}

// 今日摘要（純讀取；跨日更新由載入流程負責）。紅點只代表「條件已達成、還沒領」：
// 請求已達成未領取，或訂單材料已備齊未交付。「還沒開始做」不亮紅點。
export function todayPending(save) {
  const request = save.home?.homes?.[PLAYER_HOME_ID]?.request;
  const requestOpen = !!request && !request.done && !!requestById(request.templateId);
  const deliverable = (save.shop?.orders || []).some((order) => !order.done && (save.inventory[order.itemId] || 0) >= order.count);
  const requestReady = requestOpen && requestSatisfied(save, request);
  return { requestOpen, requestReady, deliverable, any: requestReady || deliverable };
}
