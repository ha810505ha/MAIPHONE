import React, { useState } from "react";
import { FURNITURE_IMAGES } from "../data/assetUrls";
import { useYunyinLocale } from "../i18n/YunyinLocale.jsx";

export const YUNYIN_HUD_ACTION_TOP = 82;
export const yunyinCameraControlTop = (canDecorate) => (
  YUNYIN_HUD_ACTION_TOP + (canDecorate ? 144 : 96)
);

// 佈置選單的縮圖：秀真實素材貼圖而非 emoji，玩家才看得出不同顏色/款式家具的實際長相。
function FurnitureThumb({ item, size = 32 }) {
  const { yv } = useYunyinLocale();
  const src = FURNITURE_IMAGES[item.id];
  if (!src) return <span style={{ fontSize: size * 0.6 }}>{item.icon}</span>;
  return <img src={src} alt={yv(item.name)} style={{ maxWidth: size, maxHeight: size, objectFit: "contain", imageRendering: "pixelated" }} />;
}

export function YunyinHud({ onBack, mapTitle, coins, crystals, onOpenSettings, onOpenInventory, canDecorate = false, decorating = false, onToggleDecorating }) {
  const { locale, yt } = useYunyinLocale();
  const resourceStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    minWidth: 0,
    padding: "5px 8px",
    borderRadius: 12,
    background: "rgba(0,0,0,.45)",
    color: "#fff",
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
  };
  const actionStyle = { width: 40, height: 40, borderRadius: 14, border: 0, padding: 0, background: "rgba(0,0,0,.45)", color: "#fff", fontSize: 18 };
  const resourceLabelStyle = { flexShrink: 0 };
  const resourceValueStyle = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" };
  const formatResource = (value) => Math.max(0, Math.round(Number(value) || 0)).toLocaleString(locale);
  return <><div data-yunyin-hud="1" style={{ position: "absolute", zIndex: 3, inset: 0, pointerEvents: "none" }}>
    <div data-yunyin-hud-title-row="1" style={{ position: "absolute", top: 10, left: 12, right: 154, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <button onClick={onBack} style={{ pointerEvents: "auto", flexShrink: 0, border: 0, borderRadius: 12, padding: "6px 12px", background: "rgba(0,0,0,.45)", color: "#fff", fontSize: 15 }}>←</button>
      <div style={{ color: "#fff", fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{yt("hud.title", { map: mapTitle })}</div>
    </div>
    <div data-yunyin-hud-resource-stack="1" style={{ position: "absolute", top: 10, right: 12, width: 134, display: "grid", gap: 5 }}>
      <div aria-label={`${yt("hud.coins")} ${coins}`} style={resourceStyle}><span style={resourceLabelStyle}>🪙 {yt("hud.coins")}</span><b style={resourceValueStyle}>{formatResource(coins)}</b></div>
      <div aria-label={`${yt("hud.crystals")} ${crystals}`} style={resourceStyle}><span style={resourceLabelStyle}>💎 {yt("hud.crystals")}</span><b style={resourceValueStyle}>{formatResource(crystals)}</b></div>
    </div>
  </div><div data-yunyin-action-stack="1" style={{ position: "absolute", zIndex: 3, top: YUNYIN_HUD_ACTION_TOP, right: 12, display: "grid", gap: 8 }}>
    <button type="button" aria-label={yt("hud.settings")} title={yt("hud.settings")} onClick={onOpenSettings} style={actionStyle}>⚙️</button>
    <button type="button" aria-label={yt("hud.inventory")} title={yt("hud.inventory")} onClick={onOpenInventory} style={actionStyle}>🎒</button>
    {canDecorate && <button type="button" aria-label={yt("hud.decorate")} title={yt("hud.decorate")} onClick={onToggleDecorating} style={{ ...actionStyle, background: decorating ? "#f0c75e" : actionStyle.background, color: decorating ? "#4e3826" : "#fff" }}>🛋️</button>}
  </div></>;
}

// 順序：右上資源 > 設定 > 背包 >（家園才顯示佈置）> 放大鏡。
// 放大鏡固定放最後——它展開的倍率清單只會往下長，不會把其他按鈕往下推。
export function CameraZoomControl({ value, onChange, top = 178 }) {
  const { yt, yv } = useYunyinLocale();
  const [open, setOpen] = useState(false);
  return <div aria-label={yt("camera.zoom")} style={{ position: "absolute", top, right: 12, zIndex: 3, display: "grid", justifyItems: "end", gap: 8 }}>
    <button type="button" aria-label={yt("camera.adjust")} aria-expanded={open} title={yt("camera.current", { value })} onClick={() => setOpen((current) => !current)} style={{ width: 40, height: 40, border: 0, borderRadius: 14, padding: 0, background: open ? "#f0c75e" : "rgba(0,0,0,.45)", color: open ? "#4e3826" : "#fff", fontSize: 18 }}>🔍</button>
    {open && <div style={{ display: "grid", gap: 5, padding: 5, borderRadius: 13, background: "rgba(0,0,0,.48)", boxShadow: "0 4px 14px rgba(0,0,0,.22)" }}>
      {[0.5, 1, 1.5, 2].map((scale) => <button key={scale} type="button" title={yt("camera.option", { value: scale })} onClick={() => { onChange(scale); setOpen(false); }} style={{ width: 40, height: 29, border: 0, borderRadius: 9, padding: 0, background: value === scale ? "#f0c75e" : "rgba(255,255,255,.14)", color: value === scale ? "#4e3826" : "#fff", fontSize: 11, fontWeight: 800 }}>{scale}×</button>)}
    </div>}
  </div>;
}

export function HomeEditorOverlay({ editor, catalog, previewControlsRef, onSelect, onConfirmPreview, onCancelPreview, onClose, onExpand, onResidents }) {
  const { yt, yv } = useYunyinLocale();
  if (!editor.active) return null;
  return <><div ref={previewControlsRef} aria-label={yt("home.previewActions")} style={{ position: "absolute", zIndex: 6, display: "none", gap: 7, transform: "translate(-50%, -100%)", padding: 6, borderRadius: 16, background: "rgba(44,34,39,.88)", boxShadow: "0 5px 16px rgba(0,0,0,.35)" }}>
    <button type="button" aria-label={yt("home.confirmPosition")} title={yt("home.confirm")} disabled={!editor.preview?.valid} onClick={onConfirmPreview} style={{ width: 38, height: 38, border: 0, borderRadius: 12, background: editor.preview?.valid ? "#78c88a" : "#777", color: "#fff", fontSize: 21, fontWeight: 900, opacity: editor.preview?.valid ? 1 : 0.5 }}>✓</button>
    <button type="button" aria-label={editor.selectedUid ? yt("home.store") : yt("home.cancelPreview")} title={editor.selectedUid ? yt("home.store") : yt("home.cancelPreview")} onClick={onCancelPreview} style={{ width: 38, height: 38, border: 0, borderRadius: 12, background: "#d87570", color: "#fff", fontSize: 20, fontWeight: 900 }}>✕</button>
  </div><div style={{ position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 4, padding: 10, borderRadius: 16, background: "rgba(255,250,243,.96)", boxShadow: "0 7px 24px rgba(0,0,0,.28)" }}>
    <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 7 }}>
      {catalog.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} style={{ flex: "0 0 auto", minWidth: 68, padding: "7px 8px", borderRadius: 11, border: editor.furnitureId === item.id ? "2px solid #b17c61" : "1px solid #ddd0c1", background: editor.furnitureId === item.id ? "#f8e2c8" : "#fff", color: "#57483f" }}><span style={{ height: 32, display: "flex", alignItems: "flex-end", justifyContent: "center" }}><FurnitureThumb item={item} /></span><span style={{ display: "block", fontSize: 10 }}>{yv(item.name)}</span></button>)}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#76675d" }}><span style={{ flex: 1 }}>{editor.preview ? (editor.preview.valid ? (editor.selectedUid ? yt("home.moveStoredHint") : yt("home.movePreviewHint")) : yt("home.invalidHint")) : editor.furnitureId ? yt("home.previewHint") : yt("home.selectHint")}</span>{onExpand && <button onClick={onExpand} style={{ border: 0, borderRadius: 10, padding: "7px 10px", background: "#e3d6b8", color: "#6b5636" }}>{yt("home.expand")}</button>}{onResidents && <button onClick={onResidents} style={{ border: 0, borderRadius: 10, padding: "7px 10px", background: "#d7e0d3", color: "#4d6247" }}>{yt("home.residents")}</button>}<button onClick={onClose} style={{ border: 0, borderRadius: 10, padding: "7px 12px", background: "#7d5a6e", color: "#fff", fontWeight: 800 }}>{yt("home.finishSave")}</button></div>
  </div></>;
}

export const YunyinToast = ({ message }) => message ? <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,.72)", color: "#fff", fontSize: 13, borderRadius: 14, padding: "8px 16px", zIndex: 7, pointerEvents: "none" }}>{message}</div> : null;

export function CompanionNotice({ notice }) {
  if (!notice) return null;
  return <div style={{ position: "absolute", left: 12, right: 12, bottom: 72, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 4 }}><div style={{ display: "flex", alignItems: "center", gap: 10, width: "min(92%, 360px)", padding: 9, borderRadius: 18, background: "rgba(255,250,243,.96)", color: "#3f3438", boxShadow: "0 6px 20px rgba(45,31,35,.2)" }}>{notice.avatar ? <img src={notice.avatar} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} /> : <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: "50%", background: "#f5e7df", color: "#8b5c70" }}>✿</div>}<div style={{ minWidth: 0 }}><b style={{ color: "#8b5c70", fontSize: 11 }}>{notice.name}</b><div style={{ color: "#3f3438", fontSize: 13, lineHeight: 1.45 }}>{notice.text}</div></div></div></div>;
}

export function OfflineSummary({ summary, formatDuration, onCollect }) {
  const { yt } = useYunyinLocale();
  if (!summary) return null;
  return <div style={{ position: "absolute", inset: 0, background: "rgba(20,14,26,.6)", display: "grid", placeItems: "center", zIndex: 6 }}><div data-yunyin-panel="1" style={{ background: "#fffaf3", borderRadius: 18, padding: "22px 24px", width: "min(80%, 300px)", textAlign: "center" }}><div style={{ fontSize: 28 }}>⛰️</div><h3>{yt("offline.title")}</h3><div style={{ fontSize: 13, lineHeight: 1.8 }}>{yt("offline.trained")} <b>{formatDuration(summary.mins)}</b><br />{yt("offline.cultivation")} <b>+{summary.expGained}</b>{summary.ripened > 0 && <><br />{yt("offline.farmReady", { count: summary.ripened })}</>}{summary.sold > 0 && <><br />{yt("offline.sold", { count: summary.sold, earned: summary.earned })}</>}{summary.crafted > 0 && <><br />{yt("offline.crafted", { count: summary.crafted })}</>}</div><button onClick={onCollect} style={{ marginTop: 16, border: 0, borderRadius: 12, padding: "9px 30px", background: "#7d5a6e", color: "#fff" }}>{yt("common.collect")}</button></div></div>;
}
