import React, { useEffect, useRef, useState } from "react";
import "./styles/desktopPet.css";
import "./styles/desktopPetStay.css";
import "./styles/desktopPetDrag.css";
import "./styles/desktopPetRoam.css";
import "./styles/petTiming.css";
import "./styles/petScale.css";
import "./styles/desktopPetHomeTarget.css";
import "./styles/desktopPetBubble.css";
import "./styles/desktopPetBubbleText.css";
import "./styles/desktopPetFocus.css";
import { DEFAULT_PET_SETTINGS, loadPetStorage, savePetSettingsPatch } from "./services/pet/petStorage";

const toDesktopSettings = (value) => ({ enabled: Boolean(value?.desktopPet), returnMinutes: Number(value?.desktopPetReturnMinutes) || 5 });

const DESKTOP_PET_LINES = [
  "主人，要不要陪我玩？", "我把球球帶來了～", "看看我嘛！", "摸摸頭，可以嗎？",
  "我有乖乖喔！", "有一點睏睏了……", "陪我睡一下嘛～", "我正在自己玩球！",
  "主人忙，我在旁邊等你。", "嘿嘿，我找到你了！", "今天也最喜歡主人！", "汪！我在這裡喔～",
];
const randomDesktopLine = () => DESKTOP_PET_LINES[Math.floor(Math.random() * DESKTOP_PET_LINES.length)];

export default function DesktopPet({ currentApp }) {
  const [petSettings, setPetSettings] = useState(() => toDesktopSettings(DEFAULT_PET_SETTINGS));
  const [visit, setVisit] = useState(null);
  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [walkFrame, setWalkFrame] = useState(1);
  const [walking, setWalking] = useState(false);
  const [overHome, setOverHome] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const dragRef = useRef(null);
  const longPressRef = useRef(null);
  const walkStopRef = useRef(null);
  const dragRafRef = useRef(null);
  const pendingDragPointRef = useRef(null);

  useEffect(() => {
    const sync = () => loadPetStorage({}).then(({ settings }) => { setPetSettings(toDesktopSettings(settings)); setCooldownUntil(Number(settings.cooldownUntil) || 0); }).catch(() => {});
    sync();
    window.addEventListener("pet-settings-changed", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("pet-settings-changed", sync); window.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return undefined;
    setVisit(null); setPosition(null);
    const timer = setTimeout(() => setCooldownUntil(0), cooldownUntil - Date.now() + 50);
    return () => clearTimeout(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!petSettings.enabled || cooldownUntil > Date.now() || currentApp === "petHome") { setVisit(null); setPosition(null); return undefined; }
    const tryVisit = () => {
      if (visit) return;
      if (Math.random() > 0.42) return;
      const side = Math.random() > 0.5 ? "left" : "right";
      const level = Math.floor(Math.random() * 3);
      setVisit({ id: Date.now(), side, level, action: Math.random() > 0.5 ? "walk" : "peek", note: randomDesktopLine() });
    };
    const firstTimer = setTimeout(tryVisit, 3500 + Math.random() * 4500);
    const interval = setInterval(tryVisit, 18000 + Math.random() * 9000);
    return () => { clearTimeout(firstTimer); clearInterval(interval); };
  }, [petSettings.enabled, cooldownUntil, currentApp, visit]);

  useEffect(() => () => { clearTimeout(longPressRef.current); clearTimeout(walkStopRef.current); if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current); }, []);
  useEffect(() => {
    if (!walking) return undefined;
    const timer = setInterval(() => setWalkFrame((frame) => frame % 3 + 1), 800);
    return () => clearInterval(timer);
  }, [walking]);

  useEffect(() => {
    if (!visit || currentApp === "petHome" || dragging) return undefined;
    const move = () => {
      setWalking(true);
      setVisit((old) => old ? { ...old, note: randomDesktopLine() } : old);
      setPosition({ x: 10 + Math.random() * 202, y: 90 + Math.random() * 438 });
      clearTimeout(walkStopRef.current);
      walkStopRef.current = setTimeout(() => setWalking(false), 2800);
    };
    const first = setTimeout(move, 5000);
    const interval = setInterval(move, 14000 + Math.random() * 6000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [visit?.id, currentApp, dragging]);

  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const pointerTarget = event.currentTarget;
    const pointerId = event.pointerId;
    try { pointerTarget?.setPointerCapture?.(pointerId); } catch (_) {}
    const rect = event.currentTarget.getBoundingClientRect();
    const host = event.currentTarget.closest(".mp-phone")?.getBoundingClientRect() || event.currentTarget.parentElement?.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, hostLeft: host?.left || 0, hostTop: host?.top || 0, hostWidth: host?.width || 380, hostHeight: host?.height || 720 };
    longPressRef.current = setTimeout(() => {
      if (!dragRef.current) return;
      setPosition({ x: rect.left - (host?.left || 0), y: rect.top - (host?.top || 0) });
      setDragging(true);
      setWalking(false);
      setVisit((old) => old ? { ...old, action: "grabbed" } : old);
    }, 360);
  };

  const onPointerMove = (event) => {
    if (!dragging || !dragRef.current) return;
    event.preventDefault();
    pendingDragPointRef.current = { clientX: event.clientX, clientY: event.clientY };
    if (dragRafRef.current) return;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      const point = pendingDragPointRef.current;
      if (!point || !dragRef.current) return;
      const petWidth = 158, petHeight = 174, leftAllowance = 21, rightAllowance = 80, verticalAllowance = 12;
      const minX = -leftAllowance, maxX = dragRef.current.hostWidth - petWidth + rightAllowance;
      const minY = -verticalAllowance + 8, maxY = dragRef.current.hostHeight - petHeight + verticalAllowance;
      const x = Math.max(minX, Math.min(maxX, point.clientX - dragRef.current.hostLeft - dragRef.current.offsetX));
      const y = Math.max(minY, Math.min(maxY, point.clientY - dragRef.current.hostTop - dragRef.current.offsetY));
      setPosition({ x, y });
      const localX = point.clientX - dragRef.current.hostLeft;
      const localY = point.clientY - dragRef.current.hostTop;
      setOverHome(localY > dragRef.current.hostHeight - 125 && localX > dragRef.current.hostWidth / 2 - 70 && localX < dragRef.current.hostWidth / 2 + 70);
    });
  };

  const onPointerUp = (event) => {
    clearTimeout(longPressRef.current);
    if (dragRafRef.current) { cancelAnimationFrame(dragRafRef.current); dragRafRef.current = null; }
    pendingDragPointRef.current = null;
    try { if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch (_) {}
    if (dragging) {
      if (overHome) {
        const until = Date.now() + petSettings.returnMinutes * 60 * 1000;
        savePetSettingsPatch({ cooldownUntil: until }).catch((error) => console.error("[pet] 冷卻時間保存失敗", error));
        setCooldownUntil(until); setVisit(null); setPosition(null); setDragging(false); setOverHome(false); dragRef.current = null;
        return;
      }
      setDragging(false);
      setOverHome(false);
      setVisit((old) => old ? { ...old, action: "happy" } : old);
      setTimeout(() => setVisit((old) => old ? { ...old, action: "peek" } : old), 1300);
    } else if (visit) {
      setVisit((old) => old ? { ...old, action: "happy" } : old);
      setTimeout(() => setVisit((old) => old ? { ...old, action: "peek" } : old), 1300);
    }
    dragRef.current = null;
  };

  if (!visit) return null;
  const sprite = dragging || visit.action === "grabbed" ? "grabbed" : visit.action === "happy" ? "happy" : walking ? `walk-${walkFrame}` : "idle";
  const dragStyle = position ? {
    left: 0,
    top: 0,
    right: "auto",
    bottom: "auto",
    translate: `${position.x}px ${position.y}px`,
    animation: "none",
  } : undefined;
  return <><button className={`desktop-pet desktop-pet-stay desktop-pet-${visit.side} desktop-pet-level-${visit.level} desktop-pet-${visit.action} ${dragging ? "is-dragging" : ""} ${position && !dragging && currentApp !== "petHome" ? "desktop-pet-roaming" : ""}`} style={dragStyle} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="長按拖曳桌面小寵物"><span className="desktop-pet-note">{visit.action === "grabbed" ? "呀！" : visit.action === "happy" ? "最喜歡摸摸了 ♥" : visit.note || "嗨～"}</span><img className="desktop-pet-sprite-image" src={`./pet-assets/${sprite}.png`} alt="麻糬" draggable={false} /></button>{dragging && <div className={`desktop-pet-home-target ${overHome ? "active" : ""}`}><span>🏠</span><b>{overHome ? "放開回小屋" : "拖到這裡回小屋"}</b></div>}</>;
}
