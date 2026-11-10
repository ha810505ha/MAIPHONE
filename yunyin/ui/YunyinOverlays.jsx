import React, { useEffect, useRef, useState } from "react";
import { FURNITURE_IMAGES } from "../data/assetUrls";
import { useYunyinLocale } from "../i18n/YunyinLocale.jsx";
import { Backpack, ChevronLeft, Coins, Gem, Menu, ScrollText, Settings, Sofa, Users, X, ZoomIn } from "lucide-react";
import { formatResourceNumber } from "./resourceNumber.js";

export const YUNYIN_HUD_ACTION_TOP = 82;
// 上方 HUD 列（返回鍵、地名、金幣結晶兩行）約佔的高度；鏡頭可往上多捲這段，避免地圖上緣被擋住
export const YUNYIN_HUD_SAFE_TOP = 76;
const CAMERA_SCALES = [0.5, 1, 1.5, 2];
const HUD_MENU_STYLES = "@keyframes yunyinHudIn{from{opacity:0;transform:translateY(-8px) scale(.92)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){[data-yunyin-hud-item]{animation:none!important}}";

// 佈置選單的縮圖：秀真實素材貼圖而非 emoji，玩家才看得出不同顏色/款式家具的實際長相。
function FurnitureThumb({ item, size = 32 }) {
  const { yv } = useYunyinLocale();
  const src = FURNITURE_IMAGES[item.id];
  if (!src) return <span style={{ fontSize: size * 0.6 }}>{item.icon}</span>;
  return <img src={src} alt={yv(item.name)} style={{ maxWidth: size, maxHeight: size, objectFit: "contain", imageRendering: "pixelated" }} />;
}

// 右側工具列可收合：平常只剩「選單」，有未完成的今日事項時亮紅點；
// 點開後依序滑出各功能，點任一功能或畫面空白處就收起，避免一整排擋住地圖。
export function YunyinHud({ onBack, mapTitle, coins, crystals, onOpenSettings, onOpenInventory, onOpenToday, onOpenResidents, todayPending = false, cameraScale = 1, onZoom, canDecorate = false, decorating = false, onToggleDecorating }) {
  const { locale, yt } = useYunyinLocale();
  const [showBalances, setShowBalances] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const balanceCloseRef = useRef(null);
  useEffect(() => {
    if (!showBalances) return undefined;
    const previousFocus = document.activeElement;
    balanceCloseRef.current?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [showBalances]);
  const resourceStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    minWidth: 0,
    minHeight: 30,
    padding: "5px 9px",
    borderRadius: 12,
    background: "rgba(0,0,0,.45)",
    color: "#fff",
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    border: 0,
    fontFamily: "inherit",
    pointerEvents: "auto",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  const resourceLabelStyle = { flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5 };
  const resourceValueStyle = { flexShrink: 0, whiteSpace: "nowrap", marginLeft: "auto" };
  const formatResource = (value) => formatResourceNumber(value, locale, true);
  const closeMenu = () => { setMenuOpen(false); setZoomOpen(false); };
  const pick = (action) => () => { closeMenu(); action?.(); };
  const tileStyle = (highlight) => ({ position: "relative", width: 52, height: 52, border: 0, borderRadius: 16, padding: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: highlight ? "#f0c75e" : "rgba(0,0,0,.5)", color: highlight ? "#4e3826" : "#fff", fontFamily: "inherit", cursor: "pointer" });
  const tileLabelStyle = { fontSize: 10, fontWeight: 700, lineHeight: 1.1, maxWidth: 48, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const redDot = <span aria-hidden="true" style={{ position: "absolute", top: 5, right: 5, width: 9, height: 9, borderRadius: 9, background: "#e5534b", border: "2px solid #fff", boxSizing: "border-box" }} />;
  const menuItems = [
    { id: "today", Icon: ScrollText, label: yt("hud.today"), aria: todayPending ? `${yt("hud.today")}・${yt("hud.todayPending")}` : yt("hud.today"), onClick: pick(onOpenToday), dot: todayPending },
    { id: "inventory", Icon: Backpack, label: yt("hud.inventoryShort"), aria: yt("hud.inventory"), onClick: pick(onOpenInventory) },
    canDecorate && { id: "decorate", Icon: Sofa, label: yt("hud.decorateShort"), aria: yt("hud.decorate"), onClick: pick(onToggleDecorating), highlight: decorating },
    canDecorate && onOpenResidents && { id: "residents", Icon: Users, label: yt("hud.residents"), aria: yt("panel.residents"), onClick: pick(onOpenResidents) },
    { id: "settings", Icon: Settings, label: yt("hud.settingsShort"), aria: yt("hud.settings"), onClick: pick(onOpenSettings) },
    { id: "zoom", Icon: ZoomIn, label: yt("hud.zoom"), aria: yt("camera.adjust"), onClick: () => setZoomOpen((current) => !current), highlight: zoomOpen, expanded: zoomOpen },
  ].filter(Boolean);
  return <><style>{HUD_MENU_STYLES}</style><div data-yunyin-hud="1" style={{ position: "absolute", zIndex: 3, inset: 0, pointerEvents: "none" }}>
    <div data-yunyin-hud-title-row="1" style={{ position: "absolute", top: 10, left: 12, right: 180, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <button type="button" aria-label={yt("common.back")} onClick={onBack} style={{ pointerEvents: "auto", flexShrink: 0, width: 44, height: 44, border: 0, borderRadius: 14, padding: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,.45)", color: "#fff" }}><ChevronLeft size={24} aria-hidden="true" /></button>
      <div style={{ color: "#fff", fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 3px rgba(0,0,0,.45)" }}>{mapTitle}</div>
    </div>
    <div data-yunyin-hud-resource-stack="1" style={{ position: "absolute", top: 10, right: 12, width: 160, display: "grid", gap: 5 }}>
      <button type="button" aria-label={`${yt("hud.coins")} ${coins}`} aria-haspopup="dialog" onClick={() => setShowBalances(true)} style={resourceStyle}><span style={resourceLabelStyle}><Coins size={14} color="#f0c75e" aria-hidden="true" />{yt("hud.coins")}</span><b style={resourceValueStyle}>{formatResource(coins)}</b></button>
      <button type="button" aria-label={`${yt("hud.crystals")} ${crystals}`} aria-haspopup="dialog" onClick={() => setShowBalances(true)} style={resourceStyle}><span style={resourceLabelStyle}><Gem size={14} color="#9fd6ff" aria-hidden="true" />{yt("hud.crystals")}</span><b style={resourceValueStyle}>{formatResource(crystals)}</b></button>
    </div>
  </div>{menuOpen && <div aria-hidden="true" onClick={closeMenu} onPointerDown={(event) => event.stopPropagation()} style={{ position: "absolute", inset: 0, zIndex: 3 }} />}<div data-yunyin-action-stack="1" style={{ position: "absolute", zIndex: 3, top: YUNYIN_HUD_ACTION_TOP, right: 12, display: "grid", justifyItems: "end", gap: 8 }}>
    <button type="button" aria-label={menuOpen ? yt("hud.menuClose") : (todayPending ? `${yt("hud.menu")}・${yt("hud.todayPending")}` : yt("hud.menu"))} aria-expanded={menuOpen} onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))} style={tileStyle(menuOpen)}>
      {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}<span style={tileLabelStyle}>{menuOpen ? yt("hud.menuClose") : yt("hud.menu")}</span>{!menuOpen && todayPending && redDot}
    </button>
    {menuOpen && menuItems.map(({ id, Icon, label, aria, onClick, dot, highlight, expanded }, index) => <div key={id} data-yunyin-hud-item={id} style={{ position: "relative", animation: `yunyinHudIn .18s ease-out ${index * 0.035}s both` }}>
      <button type="button" aria-label={aria} title={aria} aria-expanded={expanded} onClick={onClick} style={tileStyle(highlight)}><Icon size={20} strokeWidth={1.9} aria-hidden="true" /><span style={tileLabelStyle}>{label}</span>{dot && redDot}</button>
      {id === "zoom" && zoomOpen && <div aria-label={yt("camera.zoom")} style={{ position: "absolute", top: 0, right: 60, display: "flex", gap: 5, padding: 5, borderRadius: 14, background: "rgba(0,0,0,.55)", boxShadow: "0 4px 14px rgba(0,0,0,.22)" }}>
        {CAMERA_SCALES.map((scale) => <button key={scale} type="button" aria-pressed={cameraScale === scale} title={yt("camera.option", { value: scale })} onClick={() => { onZoom?.(scale); closeMenu(); }} style={{ width: 44, height: 42, border: 0, borderRadius: 10, padding: 0, background: cameraScale === scale ? "#f0c75e" : "rgba(255,255,255,.16)", color: cameraScale === scale ? "#4e3826" : "#fff", fontSize: 12, fontWeight: 800 }}>{scale}×</button>)}
      </div>}
    </div>)}
  </div>{showBalances && <dialog open aria-modal="true" data-yunyin-panel="1" aria-label={yt("hud.balances")} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); setShowBalances(false); } if (event.key === "Tab") { event.preventDefault(); balanceCloseRef.current?.focus(); } }} style={{ position: "absolute", inset: 0, margin: 0, width: "100%", height: "100%", maxWidth: "none", maxHeight: "none", boxSizing: "border-box", border: 0, padding: 24, zIndex: 8, background: "rgba(20,14,26,.6)", display: "grid", placeItems: "center" }} onClick={() => setShowBalances(false)}>
    <div style={{ width: "min(100%, 300px)", boxSizing: "border-box", padding: 20, borderRadius: 18, background: "#fffaf3", color: "#4e3826" }} onClick={(event) => event.stopPropagation()}>
      <b>{yt("hud.balances")}</b>
      {[["hud.coins", coins, "🪙"], ["hud.crystals", crystals, "💎"]].map(([key, value, icon]) => <div key={key} style={{ marginTop: 16 }}><div style={{ fontSize: 12 }}>{icon} {yt(key)}</div><strong style={{ display: "block", marginTop: 4, fontSize: 20, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{formatResourceNumber(value, locale)}</strong></div>)}
      <button type="button" ref={balanceCloseRef} onClick={() => setShowBalances(false)} style={{ marginTop: 20, width: "100%", border: 0, borderRadius: 12, padding: 10, background: "#7d5a6e", color: "#fff" }}>{yt("common.close")}</button>
    </div>
  </dialog>}</>;
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
