import React, { useEffect, useState } from "react";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

export function heroImgStyle(x, y, zoom) {
  const z = Math.max(1, Number(zoom) || 1);
  const vx = Math.max(-50, Math.min(50, Number(x) || 0));
  const vy = Math.max(-50, Math.min(50, Number(y) || 0));
  const shift = (v) => (v / 50) * (z - 1) * 50;
  return {
    objectPosition: `${50 - vx}% ${50 - vy}%`,
    transform: `translate(${shift(vx)}%, ${shift(vy)}%) scale(${z})`,
  };
}
export default function PeachHero({ character, imageUrl, statusText }) {
  const view = character.heroView || {};
  const displayImage = imageUrl || sanitizeUserImageUrl(character.avatarOriginal || character.avatar);
  const displayStatus = character.statusText || statusText;
  const collapseKey = `mali-peach-status-collapsed-${character.id}`;
  const seenKey = `mali-peach-status-seen-${character.id}`;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(collapseKey) === "1");
  const [seenAt, setSeenAt] = useState(() => Number(localStorage.getItem(seenKey)) || 0);
  useEffect(() => {
    setCollapsed(localStorage.getItem(collapseKey) === "1");
    setSeenAt(Number(localStorage.getItem(seenKey)) || 0);
  }, [collapseKey, seenKey]);
  const updatedAt = Number(character.statusUpdatedAt) || 0;
  const hasNewStatus = updatedAt > seenAt;
  useEffect(() => {
    if (!collapsed && updatedAt > seenAt) { setSeenAt(updatedAt); localStorage.setItem(seenKey, String(updatedAt)); }
  }, [collapsed, updatedAt, seenAt, seenKey]);
  const toggleStatus = (event) => {
    event.stopPropagation();
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(collapseKey, next ? "1" : "0");
    if (!next && updatedAt) { setSeenAt(updatedAt); localStorage.setItem(seenKey, String(updatedAt)); }
  };
  const updatedLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "";
  return <div className="mp-cw peach-hero">
    <div className="mp-av">{displayImage ? <>
      <img className="mp-hero-blur-bg" src={displayImage} alt="" aria-hidden="true" draggable={false} />
      <img src={displayImage} alt="" draggable={false} style={heroImgStyle(view.x, view.y, view.zoom)} />
    </> : "??"}</div>
    <div className={`mp-cw-info ${collapsed ? "is-collapsed" : ""}`} onClick={toggleStatus} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleStatus(e); }}>
      <div className="mp-cw-name">{character.name}<span className="mp-active-badge">ACTIVE</span>{!collapsed && updatedLabel && <span className="peach-status-time">{updatedLabel}</span>}{collapsed && hasNewStatus && <span className="peach-status-new" aria-label="有新狀態" />}</div>
      {!collapsed && <div className="mp-cw-desc">{displayStatus}</div>}
    </div>
  </div>;
}
