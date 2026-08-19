import React, { useState } from "react";
import { PLAYER_HOME_ID } from "../home/homeState";
import { guestBedCount, inviteResident, dismissResident } from "../home/homeResidents";
import { isRoomUnlocked } from "../home/homeExpansion";
import { refreshDailyRequest, requestById, requestSatisfied, claimRequest } from "../home/residentRequests";
import { MAX_PACK_VERSIONS, residentPackOf, setActiveResidentPackVersion } from "../systems/ai";
import { itemMeta } from "../systems/shop";
import { useYunyinLocale } from "../i18n/YunyinLocale.jsx";

const rowStyle = { display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2d6c6", borderRadius: 12, padding: "8px 10px", marginBottom: 7, background: "#fff" };
const btnStyle = (danger = false) => ({
  border: 0, borderRadius: 10, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  background: danger ? "#ead8d0" : "linear-gradient(135deg,#7d5a6e,#9c7089)", color: danger ? "#8b4c45" : "#fff",
});

// 入住管理：客房開通 + 客床數 = 容量，一床一人。住客會在家中活動並每日累積好感。
export default function ResidentPanel({ save, characters = [], onDirty, onToast, onCrystals, onClose, onHomeRefresh, onGenerateLines }) {
  const { yt, yv, ym } = useYunyinLocale();
  const [, setTick] = useState(0);
  const [genBusy, setGenBusy] = useState(null);
  const [genError, setGenError] = useState("");
  const [expandedChar, setExpandedChar] = useState(null);
  const home = save.home?.homes?.[PLAYER_HOME_ID];
  const request = refreshDailyRequest(save.home);
  const template = requestById(request?.templateId);
  const beds = guestBedCount(home);
  const residents = home?.residents || [];
  const guestRoomOpen = isRoomUnlocked(home, "guest");
  const candidates = characters.filter((character) => !residents.includes(character.id));

  const act = (fn, charId, doneMsg) => {
    const result = fn(save.home, charId);
    if (result.error) { onToast(ym(result.error)); return; }
    onDirty();
    onHomeRefresh?.();
    setTick((t) => t + 1);
    onToast(doneMsg);
  };

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ fontSize: 12, color: "#8a7a6a", marginBottom: 10 }}>
        {guestRoomOpen ? yt("resident.capacity", { beds, residents: residents.length }) : yt("resident.roomRequired")}
      </div>
      {template && (() => {
        const speaker = characters.find((item) => item.id === request.characterId);
        const ok = requestSatisfied(save, request);
        const rewardText = template.reward.coins ? `🪙${template.reward.coins}`
          : template.reward.crystals ? `💎${template.reward.crystals}`
          : `${itemMeta(template.reward.materials.id).icon}×${template.reward.materials.n}`;
        const hint = template.kind === "item" ? yt("resident.itemRequest", { icon: itemMeta(template.itemId).icon, name: yv(itemMeta(template.itemId).name), count: template.count, owned: save.inventory[template.itemId] || 0 })
          : template.kind === "decor" ? yt("resident.decorRequest")
          : yt("resident.activityRequest");
        return (
          <div style={{ border: "1px solid #e0d2c0", borderRadius: 12, padding: "10px 11px", marginBottom: 10, background: "#fdf7ef" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7d5a6e", marginBottom: 4 }}>{yt("resident.dailyRequest", { name: speaker?.name || yt("resident.guest") })}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>「{yv(template.text)}」</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, fontSize: 11, color: "#8a7a6a" }}>{request.done ? yt("resident.completed") : yt("resident.reward", { hint, reward: rewardText })}</span>
              {!request.done && (
                <button disabled={!ok} style={{ ...btnStyle(), opacity: ok ? 1 : 0.5, cursor: ok ? "pointer" : "default" }} onClick={() => {
                  const result = claimRequest(save);
                  if (result.error) { onToast(ym(result.error)); return; }
                  if (result.reward.crystals) onCrystals?.(result.reward.crystals, {
                    note: yt("resident.requestNote", { name: speaker?.name || yt("resident.guest") }),
                  });
                  onDirty(); setTick((t) => t + 1);
                  onToast(yt("resident.claimed", { reward: rewardText, affinity: result.affinityGain }));
                }}>{yt("resident.claim")}</button>
              )}
            </div>
          </div>
        );
      })()}
      {residents.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#4a4038", marginBottom: 2 }}>{yt("resident.lineLibrary")}</div>
          <div style={{ fontSize: 11, color: "#8a7a6a", marginBottom: 7, lineHeight: 1.5 }}>{yt("resident.lineLibraryDescription")}</div>
        </>
      )}
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {residents.map((charId) => {
          const character = characters.find((item) => item.id === charId);
          const affinity = save.home.relationships?.[charId]?.affinity ?? 0;
          const pack = residentPackOf(save, charId);
          const busy = genBusy === charId;
          return (
            <div key={charId} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {character?.avatar || character?.avatarUrl
                  ? <img src={character.avatar || character.avatarUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
                  : <div style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: "#f5e7df" }}>✿</div>}
                <span style={{ flex: 1 }}>
                  <b style={{ fontSize: 13 }}>{character?.name || charId}</b>
                  <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>{yt("resident.status", { affinity })}</span>
                </span>
                <button style={btnStyle(true)} onClick={() => act(dismissResident, charId, yt("resident.dismissed"))}>{yt("resident.dismiss")}</button>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  disabled={busy || !onGenerateLines}
                  onClick={async () => {
                    setGenError("");
                    setGenBusy(charId);
                    try {
                      const error = await onGenerateLines(charId);
                      if (error) setGenError(`${character?.name || charId}：${error}`);
                    } catch {
                      setGenError(`${character?.name || charId}：${yt("settings.generateFailed")}`);
                    }
                    setGenBusy(null);
                    setTick((tick) => tick + 1);
                  }}
                  style={{ ...btnStyle(), flex: 1, opacity: busy || !onGenerateLines ? 0.55 : 1, cursor: busy || !onGenerateLines ? "default" : "pointer" }}
                >{busy ? yt("settings.generating") : yt("settings.generateLibrary")}</button>
                {pack?.versions?.length > 0 && (
                  <button onClick={() => setExpandedChar(expandedChar === charId ? null : charId)} style={{ border: "1px solid #d9cdbc", borderRadius: 10, padding: "5px 9px", fontSize: 11, background: "#fff", color: "#6b5d4f", cursor: "pointer" }}>
                    {expandedChar === charId ? yt("settings.collapse") : yt("settings.viewLines")}
                  </button>
                )}
              </div>
              {pack?.versions?.length > 0 && (
                <div style={{ display: "flex", gap: 5 }}>
                  {Array.from({ length: MAX_PACK_VERSIONS }, (_, index) => {
                    const version = pack.versions[index];
                    const active = pack.active === index;
                    return (
                      <button key={index} disabled={!version} onClick={() => { setActiveResidentPackVersion(save, charId, index); onDirty(); setTick((tick) => tick + 1); }} style={{ flex: 1, border: active ? "2px solid #7d5a6e" : "1px solid #d9cdbc", borderRadius: 9, padding: "4px 0", fontSize: 10, background: active ? "#f3ecf1" : "#fff", color: version ? "#4a4038" : "#c4b8a8" }}>
                        {version ? yt("settings.version", { number: index + 1, active: active ? " ✓" : "" }) : "—"}
                      </button>
                    );
                  })}
                </div>
              )}
              {expandedChar === charId && pack?.versions?.length > 0 && (
                <div style={{ background: "#f7f2ea", borderRadius: 10, padding: "8px 10px", maxHeight: 150, overflowY: "auto" }}>
                  {(pack.versions[Math.min(pack.active, pack.versions.length - 1)]?.lines?.home || []).map((line, index) => (
                    <div key={index} style={{ fontSize: 11, color: "#4a4038", lineHeight: 1.6 }}>・{line}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {genError && <div style={{ fontSize: 11, color: "#a05656", padding: "3px 0 7px" }}>{genError}</div>}
        {residents.length > 0 && !onGenerateLines && <div style={{ fontSize: 11, color: "#b0a494", padding: "3px 0 7px" }}>{yt("settings.apiRequired")}</div>}
        {guestRoomOpen && candidates.map((character) => (
          <div key={character.id} style={{ ...rowStyle, opacity: residents.length >= beds ? 0.6 : 1 }}>
            {character.avatar || character.avatarUrl
              ? <img src={character.avatar || character.avatarUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
              : <div style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: "#f5e7df" }}>✿</div>}
            <span style={{ flex: 1, fontSize: 13 }}><b>{character.name}</b></span>
            <button style={btnStyle()} onClick={() => act(inviteResident, character.id, yt("resident.invited", { name: character.name }))}>{yt("resident.invite")}</button>
          </div>
        ))}
        {guestRoomOpen && !candidates.length && !residents.length && <div style={{ fontSize: 12, color: "#8a7a6a" }}>{yt("resident.noneAvailable")}</div>}
      </div>
      <div style={{ fontSize: 11, color: "#8a7a6a", marginTop: 4 }}>{yt("resident.hint")}</div>
      <button onClick={onClose} style={{ width: "100%", marginTop: 10, border: 0, borderRadius: 12, padding: "9px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>{yt("common.leave")}</button>
    </div>
  );
}
