import React, { useState } from "react";
import { ROOM_CATALOG } from "../home/roomCatalog";
import { isRoomUnlocked, purchaseRoom } from "../home/homeExpansion";
import { PLAYER_HOME_ID } from "../home/homeState";
import { itemMeta } from "../systems/shop";
import { REALMS } from "../data/realms";
import { useYunyinLocale } from "../i18n/YunyinLocale.jsx";

const rowStyle = { display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2d6c6", borderRadius: 12, padding: "9px 10px", marginBottom: 8, background: "#fff" };

// 擴建居所：境界 + 金幣 + 材料解鎖新隔間。開通後小屋版型即時打通。
export default function HomeExpandPanel({ save, onDirty, onToast, onClose, onHomeRefresh }) {
  const { yt, yv, ym } = useYunyinLocale();
  const [, setTick] = useState(0);
  const home = save.home?.homes?.[PLAYER_HOME_ID];
  const rooms = ROOM_CATALOG.filter((room) => !room.base);

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ fontSize: 12, color: "#8a7a6a", marginBottom: 10 }}>
        {yt("expand.currentRealm", { realm: yv(REALMS[save.cultivation.realmIdx].name), coins: save.coins })}
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {rooms.map((room) => {
          const unlocked = isRoomUnlocked(home, room.id);
          const realmOk = save.cultivation.realmIdx >= room.realmIdx;
          const materialText = Object.entries(room.materials)
            .map(([id, n]) => yt("expand.materialOwned", { icon: itemMeta(id).icon, name: yv(itemMeta(id).name), count: n, owned: save.inventory[id] || 0 }))
            .join(" · ");
          return (
            <div key={room.id} style={{ ...rowStyle, opacity: unlocked ? 0.65 : realmOk ? 1 : 0.55 }}>
              <span style={{ fontSize: 22 }}>{room.icon}</span>
              <span style={{ flex: 1 }}>
                <b style={{ fontSize: 14 }}>{yv(room.name)}{!realmOk && !unlocked && ` 🔒${yv(room.realmName)}`}</b>
                <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                  {unlocked ? yt("common.unlocked") : `🪙${room.coins} · ${materialText}`}
                </span>
              </span>
              {unlocked ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#3d7a5c" }}>{yt("common.unlocked")}</span>
              ) : (
                <button
                  disabled={!realmOk}
                  onClick={() => {
                    const result = purchaseRoom(save, room.id);
                    if (result.error) { onToast(ym(result.error)); return; }
                    onDirty();
                    onHomeRefresh?.();
                    setTick((t) => t + 1);
                    onToast(yt("expand.openedToast", { icon: room.icon, name: yv(room.name) }));
                  }}
                  style={{
                    border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700,
                    cursor: realmOk ? "pointer" : "default", opacity: realmOk ? 1 : 0.55,
                    background: "linear-gradient(135deg,#7d5a6e,#9c7089)", color: "#fff",
                  }}
                >{yt("expand.action")}</button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "#8a7a6a", marginTop: 4 }}>{yt("expand.hint")}</div>
      <button onClick={onClose} style={{ width: "100%", marginTop: 10, border: 0, borderRadius: 12, padding: "9px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>{yt("common.leave")}</button>
    </div>
  );
}
