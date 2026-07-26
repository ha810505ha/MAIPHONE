import React, { useState } from "react";
import { PLAYER_HOME_ID } from "../home/homeState";
import { guestBedCount, inviteResident, dismissResident } from "../home/homeResidents";
import { isRoomUnlocked } from "../home/homeExpansion";
import { refreshDailyRequest, requestById, requestSatisfied, claimRequest } from "../home/residentRequests";
import { itemMeta } from "../systems/shop";

const rowStyle = { display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2d6c6", borderRadius: 12, padding: "8px 10px", marginBottom: 7, background: "#fff" };
const btnStyle = (danger = false) => ({
  border: 0, borderRadius: 10, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  background: danger ? "#ead8d0" : "linear-gradient(135deg,#7d5a6e,#9c7089)", color: danger ? "#8b4c45" : "#fff",
});

// 入住管理：客房開通 + 客床數 = 容量，一床一人。住客會在家中活動並每日累積好感。
export default function ResidentPanel({ save, characters = [], onDirty, onToast, onCrystals, onClose, onHomeRefresh }) {
  const [, setTick] = useState(0);
  const home = save.home?.homes?.[PLAYER_HOME_ID];
  const request = refreshDailyRequest(save.home);
  const template = requestById(request?.templateId);
  const beds = guestBedCount(home);
  const residents = home?.residents || [];
  const guestRoomOpen = isRoomUnlocked(home, "guest");
  const candidates = characters.filter((character) => !residents.includes(character.id));

  const act = (fn, charId, doneMsg) => {
    const result = fn(save.home, charId);
    if (result.error) { onToast(result.error); return; }
    onDirty();
    onHomeRefresh?.();
    setTick((t) => t + 1);
    onToast(doneMsg);
  };

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ fontSize: 12, color: "#8a7a6a", marginBottom: 10 }}>
        {guestRoomOpen ? <>客床 <b>{beds}</b> 張・入住 <b>{residents.length}</b> 人（一床一人）</> : "要先在擴建裡開通客房，並擺上客床。"}
      </div>
      {template && (() => {
        const speaker = characters.find((item) => item.id === request.characterId);
        const ok = requestSatisfied(save, request);
        const rewardText = template.reward.coins ? `🪙${template.reward.coins}`
          : template.reward.crystals ? `💎${template.reward.crystals}`
          : `${itemMeta(template.reward.materials.id).icon}×${template.reward.materials.n}`;
        const hint = template.kind === "item" ? `需要 ${itemMeta(template.itemId).icon}${itemMeta(template.itemId).name}×${template.count}（有 ${save.inventory[template.itemId] || 0}）`
          : template.kind === "decor" ? "在屋內擺上對應家具即可"
          : "與住客一起進行該活動即可";
        return (
          <div style={{ border: "1px solid #e0d2c0", borderRadius: 12, padding: "10px 11px", marginBottom: 10, background: "#fdf7ef" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7d5a6e", marginBottom: 4 }}>今日請求・{speaker?.name || "住客"}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>「{template.text}」</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, fontSize: 11, color: "#8a7a6a" }}>{request.done ? "已完成，明天再來看看吧" : `${hint}・報酬 ${rewardText} + 好感`}</span>
              {!request.done && (
                <button disabled={!ok} style={{ ...btnStyle(), opacity: ok ? 1 : 0.5, cursor: ok ? "pointer" : "default" }} onClick={() => {
                  const result = claimRequest(save);
                  if (result.error) { onToast(result.error); return; }
                  if (result.reward.crystals) onCrystals?.(result.reward.crystals, {
                    note: `雲隱山莊・完成${speaker?.name || "住客"}的請求`,
                  });
                  onDirty(); setTick((t) => t + 1);
                  onToast(`請求完成！獲得 ${rewardText}，好感 +${result.affinityGain}`);
                }}>達成</button>
              )}
            </div>
          </div>
        );
      })()}
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {residents.map((charId) => {
          const character = characters.find((item) => item.id === charId);
          const affinity = save.home.relationships?.[charId]?.affinity ?? 0;
          return (
            <div key={charId} style={rowStyle}>
              {character?.avatar || character?.avatarUrl
                ? <img src={character.avatar || character.avatarUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: "#f5e7df" }}>✿</div>}
              <span style={{ flex: 1 }}>
                <b style={{ fontSize: 13 }}>{character?.name || charId}</b>
                <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>入住中・好感 {affinity}</span>
              </span>
              <button style={btnStyle(true)} onClick={() => act(dismissResident, charId, "已請離，客床空出來了")}>請離</button>
            </div>
          );
        })}
        {guestRoomOpen && candidates.map((character) => (
          <div key={character.id} style={{ ...rowStyle, opacity: residents.length >= beds ? 0.6 : 1 }}>
            {character.avatar || character.avatarUrl
              ? <img src={character.avatar || character.avatarUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
              : <div style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: "#f5e7df" }}>✿</div>}
            <span style={{ flex: 1, fontSize: 13 }}><b>{character.name}</b></span>
            <button style={btnStyle()} onClick={() => act(inviteResident, character.id, `${character.name} 搬進來了！`)}>邀請入住</button>
          </div>
        ))}
        {guestRoomOpen && !candidates.length && !residents.length && <div style={{ fontSize: 12, color: "#8a7a6a" }}>沒有可邀請的角色。</div>}
      </div>
      <div style={{ fontSize: 11, color: "#8a7a6a", marginTop: 4 }}>住客會在家裡活動、坐椅子睡午覺，每天首次回家＋1 好感。</div>
      <button onClick={onClose} style={{ width: "100%", marginTop: 10, border: 0, borderRadius: 12, padding: "9px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>離開</button>
    </div>
  );
}
