import React, { useState } from "react";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

export default function PlayerPersonaIndicator({ playerProfile, persona, tr, compact = false }) {
  const [open, setOpen] = useState(false);
  const name = String(playerProfile?.name || "").trim() || tr("玩家", "Player", "プレイヤー", "플레이어");
  const characters = Array.from(name);
  const nameLimit = compact ? 5 : 6;
  const compactName = characters.length > nameLimit ? `${characters.slice(0, nameLimit).join("")}…` : name;
  const avatar = sanitizeUserImageUrl(playerProfile?.avatar);
  const items = Object.values(persona?.personas || {});
  const canSwitch = items.length > 1;

  return (
    <div style={{ position: "relative", flex: compact ? "0 0 auto" : "0 0 auto", marginLeft: compact ? "auto" : 0 }}>
      <button type="button" title={canSwitch ? tr("切換玩家人格", "Switch persona", "人格を切り替え", "페르소나 전환") : name} onClick={(event) => { event.stopPropagation(); if (canSwitch) setOpen((value) => !value); }} style={{ width: compact ? "auto" : "100%", minWidth: compact ? 0 : "100%", minHeight: compact ? 36 : 28, display: "flex", alignItems: "center", justifyContent: compact ? "flex-start" : "flex-end", gap: 6, padding: compact ? "3px 9px 3px 4px" : "3px 14px", border: compact ? "1px solid color-mix(in srgb,var(--mp-pink) 34%,transparent)" : 0, borderTop: "1px solid color-mix(in srgb,var(--mp-pink) 24%,transparent)", borderRadius: compact ? 18 : 0, background: compact ? "linear-gradient(135deg,var(--mp-pink-lt),var(--mp-surface))" : "color-mix(in srgb,var(--mp-surface) 88%,transparent)", color: "var(--mp-txt-l)", fontSize: 10, boxSizing: "border-box", cursor: canSwitch ? "pointer" : "default" }}>
      {!compact && <span>{tr("以", "As", "", "")}</span>}
      <span style={{ width: compact ? 28 : 20, height: compact ? 28 : 20, flex: `0 0 ${compact ? 28 : 20}px`, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: "50%", background: "var(--mp-pink-lt)", fontSize: 10 }}>
        {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
      </span>
      <b style={{ maxWidth: 92, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", color: "var(--mp-pink-dk)", fontSize: 10.5 }}>{compactName}</b>
      {!compact && <span>{tr("身分對話", "", "として会話", "로 대화")}</span>}
      {canSwitch && <span style={{ color: "var(--mp-pink-dk)", fontSize: 8 }}>▾</span>}
      </button>
      {open && <div onClick={(event) => event.stopPropagation()} style={{ position: "absolute", right: compact ? 0 : 12, top: compact ? "calc(100% + 6px)" : "auto", bottom: compact ? "auto" : "calc(100% + 6px)", zIndex: 30, width: 210, maxHeight: 250, overflowY: "auto", padding: 6, border: "1px solid color-mix(in srgb,var(--mp-pink) 34%,transparent)", borderRadius: 16, background: "var(--mp-surface)", boxShadow: "0 12px 30px rgba(73,45,57,.18)" }}>
        {items.map((item) => {
          const active = item.id === persona.activePersonaId;
          const itemProfile = active ? playerProfile : item.data?.playerProfile;
          const itemName = String(item.label || itemProfile?.name || tr("玩家人格", "Persona", "人格", "페르소나"));
          const itemAvatar = sanitizeUserImageUrl(itemProfile?.avatar);
          return <button key={item.id} type="button" disabled={active} onClick={async () => { setOpen(false); await persona.onSwitch(item.id); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 9px", border: 0, borderRadius: 11, background: active ? "var(--mp-pink-lt)" : "transparent", color: "var(--mp-txt)", textAlign: "left", cursor: active ? "default" : "pointer" }}><span style={{ width: 30, height: 30, flex: "0 0 30px", display: "grid", placeItems: "center", overflow: "hidden", borderRadius: "50%", background: "var(--mp-pink-lt)" }}>{itemAvatar ? <img src={itemAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}</span><span style={{ flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontSize: 11, fontWeight: 800 }}>{itemName}</span>{active && <small style={{ color: "var(--mp-pink-dk)" }}>{tr("使用中", "Active", "使用中", "사용 중")}</small>}</button>;
        })}
      </div>}
    </div>
  );
}
