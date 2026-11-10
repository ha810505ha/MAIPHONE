import { ROOM_CATALOG, roomById } from "./roomCatalog";
import { PLAYER_HOME_ID } from "./homeState";
import { itemMeta } from "../systems/shop";

export const isRoomUnlocked = (home, roomId) =>
  !!roomById(roomId)?.base || (home?.unlockedRooms || []).includes(roomId);

// 擴建房間：境界 + 金幣 + 材料三重檢查，通過即扣款並開通（unlockedRooms 進存檔）。
export function purchaseRoom(save, roomId) {
  const room = roomById(roomId);
  if (!room || room.base) return { error: "無法擴建此區域" };
  const home = save.home?.homes?.[PLAYER_HOME_ID];
  if (!home) return { error: "找不到住宅" };
  if (isRoomUnlocked(home, roomId)) return { error: "已經開通了" };
  if (save.cultivation.realmIdx < room.realmIdx) return { error: `境界不足，需要${room.realmName}` };
  if (save.coins < room.coins) return { error: "🪙 不足" };
  const missing = Object.entries(room.materials).filter(([id, n]) => (save.inventory[id] || 0) < n);
  if (missing.length) return { error: `材料不足：${missing.map(([id, n]) => `${itemMeta(id).icon}${itemMeta(id).name} 還缺 ${n - (save.inventory[id] || 0)}`).join("、")}` };

  save.coins -= room.coins;
  for (const [id, n] of Object.entries(room.materials)) save.inventory[id] -= n;
  home.unlockedRooms.push(roomId);
  return { room };
}

export const nextLockedRooms = (save) => {
  const home = save.home?.homes?.[PLAYER_HOME_ID];
  return ROOM_CATALOG.filter((room) => !room.base && !isRoomUnlocked(home, room.id));
};
