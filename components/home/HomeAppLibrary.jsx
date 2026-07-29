import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { HOME_GESTURE, resolveLibrarySwipe, rubberBand } from "../../utils/homeGesture.js";
import MotionPresence from "../motion/MotionPresence.jsx";

const CATEGORY_BY_APP = {
  chat: "social", social: "social", couple: "social", phone: "social",
  status: "character", characters: "character", player: "character", wallet: "character",
  game: "play", petHome: "play", yunyin: "play", music: "play",
  gallery: "tools", lorebook: "tools", lbook: "tools", notebook: "tools", calendar: "tools", settings: "tools",
};

const CATEGORY_ORDER = ["social", "character", "play", "tools"];
const APP_LIBRARY_PAGE_SIZE = 20;

export function AllAppsDrawer({ open, apps, placedIds, renderAppIcon, tr, onClose, onOpenApp, onApplyHome, onPreloadApp }) {
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [libraryPage, setLibraryPage] = useState(0);
  const homeGestureRef = React.useRef(null);
  const touchHomeGestureRef = React.useRef(null);
  const lastPointerGestureAtRef = React.useRef(0);
  const closeTimerRef = React.useRef(null);
  const [libraryGesture, setLibraryGesture] = useState({
    active: false,
    axis: null,
    offsetX: 0,
    offsetY: 0,
    settleMs: HOME_GESTURE.settleMs,
  });
  useLayoutEffect(() => {
    if (!open) return;
    homeGestureRef.current = null;
    touchHomeGestureRef.current = null;
    lastPointerGestureAtRef.current = 0;
    setLibraryPage(0);
    setLibraryGesture({ active: false, axis: null, offsetX: 0, offsetY: 0, settleMs: HOME_GESTURE.settleMs });
  }, [open]);
  useEffect(() => {
    if (open) return;
    setSettingsOpen(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
    setQuery("");
    setLibraryPage(0);
  }, [open]);
  const visibleApps = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const visible = apps.filter((app) => !needle || app.name.toLocaleLowerCase().includes(needle));
    return CATEGORY_ORDER.flatMap((category) =>
      visible.filter((app) => (CATEGORY_BY_APP[app.id] || "tools") === category)
    );
  }, [apps, query]);
  const pages = useMemo(() => {
    const next = [];
    for (let index = 0; index < visibleApps.length; index += APP_LIBRARY_PAGE_SIZE) {
      next.push(visibleApps.slice(index, index + APP_LIBRARY_PAGE_SIZE));
    }
    return next.length ? next : [[]];
  }, [visibleApps]);
  useEffect(() => {
    setLibraryPage((page) => Math.min(page, pages.length - 1));
  }, [pages.length]);
  useEffect(() => setLibraryPage(0), [query, selectionMode]);
  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);
  const toggleSelection = (appId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };
  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };
  const confirmSelection = () => {
    onApplyHome([...selectedIds]);
    cancelSelection();
  };
  const selectionChanged = selectedIds.size !== placedIds.size
    || [...selectedIds].some((id) => !placedIds.has(id));
  const allSelected = apps.length > 0 && apps.every((app) => selectedIds.has(app.id));
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(apps.map((app) => app.id)));
  };
  const applyHomeGesture = (startX, startY, endX, endY, durationMs, viewportWidth) => {
    const action = resolveLibrarySwipe({
      startX,
      startY,
      endX,
      endY,
      durationMs,
      viewportWidth,
    });
    const velocity = durationMs > 0
      ? Math.max(Math.abs(endX - startX), Math.abs(endY - startY)) / durationMs
      : 0;
    const settleMs = velocity >= HOME_GESTURE.velocityThreshold
      ? HOME_GESTURE.flickSettleMs
      : HOME_GESTURE.settleMs;
    if (action === "home") {
      setLibraryGesture((current) => ({
        ...current,
        active: false,
        axis: "y",
        offsetX: 0,
        offsetY: -96,
        settleMs,
      }));
      closeTimerRef.current = window.setTimeout(onClose, settleMs);
      return;
    }
    if (action === "next-page") {
      setLibraryPage((page) => Math.min(pages.length - 1, page + 1));
    } else if (action === "previous-page") {
      setLibraryPage((page) => Math.max(0, page - 1));
    }
    setLibraryGesture((current) => ({
      ...current,
      active: false,
      offsetX: 0,
      offsetY: 0,
      settleMs,
    }));
  };
  const onHomeGestureStart = (event) => {
    if (event.target.closest?.("button, input")) {
      homeGestureRef.current = null;
      return;
    }
    homeGestureRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      time: event.timeStamp,
      width: event.currentTarget?.clientWidth || 390,
      axis: null,
    };
    setLibraryGesture({
      active: true,
      axis: null,
      offsetX: 0,
      offsetY: 0,
      settleMs: HOME_GESTURE.settleMs,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onHomeGestureMove = (event) => {
    const start = homeGestureRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.axis) {
      if (Math.hypot(dx, dy) < HOME_GESTURE.activationDistance) return;
      if (Math.abs(dx) > Math.abs(dy) * HOME_GESTURE.directionRatio) start.axis = "x";
      else if (Math.abs(dy) > Math.abs(dx) * HOME_GESTURE.directionRatio && dy < 0) start.axis = "y";
      else return;
    }
    if (start.axis === "x") {
      const atStart = libraryPage === 0 && dx > 0;
      const atEnd = libraryPage === pages.length - 1 && dx < 0;
      setLibraryGesture({
        active: true,
        axis: "x",
        offsetX: atStart || atEnd ? rubberBand(dx, start.width) : dx,
        offsetY: 0,
        settleMs: HOME_GESTURE.settleMs,
      });
    } else {
      setLibraryGesture({
        active: true,
        axis: "y",
        offsetX: 0,
        offsetY: Math.max(-140, dy * 0.42),
        settleMs: HOME_GESTURE.settleMs,
      });
    }
  };
  const onHomeGestureEnd = (event) => {
    const start = homeGestureRef.current;
    homeGestureRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    lastPointerGestureAtRef.current = Date.now();
    applyHomeGesture(
      start.x,
      start.y,
      event.clientX,
      event.clientY,
      event.timeStamp - start.time,
      start.width,
    );
  };
  const onHomeTouchStart = (event) => {
    if (event.target.closest?.("button, input")) {
      touchHomeGestureRef.current = null;
      return;
    }
    const touch = event.touches?.[0];
    touchHomeGestureRef.current = touch
      ? { x: touch.clientX, y: touch.clientY, time: event.timeStamp }
      : null;
  };
  const onHomeTouchEnd = (event) => {
    const start = touchHomeGestureRef.current;
    touchHomeGestureRef.current = null;
    if (!start || Date.now() - lastPointerGestureAtRef.current < 250) return;
    const touch = event.changedTouches?.[0];
    applyHomeGesture(
      start.x,
      start.y,
      touch?.clientX,
      touch?.clientY,
      event.timeStamp - start.time,
      event.currentTarget?.clientWidth,
    );
  };
  const cancelHomePointerGesture = () => {
    homeGestureRef.current = null;
    setLibraryGesture((current) => ({
      ...current,
      active: false,
      offsetX: 0,
      offsetY: 0,
      settleMs: HOME_GESTURE.settleMs,
    }));
  };
  const cancelHomeTouchGesture = () => {
    touchHomeGestureRef.current = null;
  };
  if (!open) return null;
  return (
    <div
      className={`mp-app-library ${selectionMode ? "is-selecting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={tr("全部 App", "All apps", "すべてのアプリ", "모든 앱")}
      style={{
        transform: `translate3d(0,${libraryGesture.offsetY}px,0)`,
        opacity: 1 - Math.min(0.35, Math.abs(libraryGesture.offsetY) / 400),
        transition: libraryGesture.active
          ? "none"
          : `transform ${libraryGesture.settleMs}ms cubic-bezier(.22,.72,.2,1), opacity ${libraryGesture.settleMs}ms ease`,
      }}
    >
      <div className="mp-library-head">
        <button className="mp-back mp-library-close" onClick={selectionMode ? cancelSelection : onClose} aria-label={tr("返回", "Back", "戻る", "뒤로")}>←</button>
        <strong>{selectionMode ? tr("選擇 App", "Select apps", "アプリを選択", "앱 선택") : tr("全部 App", "All apps", "すべてのアプリ", "모든 앱")}</strong>
        {!selectionMode && <button className="mp-library-settings" onClick={() => setSettingsOpen((value) => !value)} aria-label={tr("設定", "Settings", "設定", "설정")}>⚙</button>}
        {selectionMode && <button className="mp-library-select-all" onClick={toggleSelectAll}>
          {allSelected ? tr("取消全選", "Clear", "全解除", "전체 해제") : tr("全選", "Select all", "全選択", "전체 선택")}
        </button>}
      </div>
      <MotionPresence show={settingsOpen} exitMs={140}>
      {settingsOpen && (
        <div className="mp-library-settings-menu mp-popover">
          <button onClick={() => { setSettingsOpen(false); setSelectionMode(true); setSelectedIds(new Set(placedIds)); }}>
            <span>✓</span>{tr("管理主畫面 App", "Manage Home Screen", "ホーム画面を管理", "홈 화면 관리")}
          </button>
        </div>
      )}
      </MotionPresence>
      <div className="mp-library-search">
        <span>⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("搜尋 App", "Search apps", "アプリを検索", "앱 검색")} />
        {query && <button onClick={() => setQuery("")}>×</button>}
      </div>
      <div className="mp-library-pager"
        onPointerDown={onHomeGestureStart} onPointerMove={onHomeGestureMove} onPointerUp={onHomeGestureEnd} onPointerCancel={cancelHomePointerGesture}
        onTouchStart={onHomeTouchStart} onTouchEnd={onHomeTouchEnd} onTouchCancel={cancelHomeTouchGesture}>
        <div
          className="mp-library-pages-track"
          style={{
            transform: `translate3d(calc(-${libraryPage * 100}% + ${libraryGesture.offsetX}px),0,0)`,
            transitionDuration: libraryGesture.active
              ? "0ms"
              : `${libraryGesture.settleMs}ms`,
          }}
        >
          {pages.map((pageApps, pageIndex) => (
            <section className="mp-library-page" key={pageIndex} aria-hidden={pageIndex !== libraryPage}>
              <div className="mp-library-page-grid">
              {pageApps.map((app) => {
                const placed = placedIds.has(app.id);
                const selected = selectedIds.has(app.id);
                return (
                  <div className={`mp-library-app ${selectionMode ? "is-selecting" : ""} ${selectionMode && selected ? "is-selected" : ""} ${selectionMode && placed && !selected ? "is-removing" : ""}`} key={app.id}>
                    <button className="mp-library-open"
                      onPointerEnter={() => { void onPreloadApp?.(app.id); }}
                      onPointerDown={() => { void onPreloadApp?.(app.id); }}
                      onFocus={() => { void onPreloadApp?.(app.id); }}
                      onClick={() => selectionMode ? toggleSelection(app.id) : onOpenApp(app.id)}>
                      <span className={`mp-icon-c ${app.iconUrl ? "mp-icon-c-img" : ""}`}>{renderAppIcon(app, app.iconUrl ? (app.iconSize || 56) : 26)}</span>
                      <span>{app.name}</span>
                    </button>
                    {selectionMode && <span className="mp-library-check">{selected ? "✓" : ""}</span>}
                    {selectionMode && placed && <small>{selected ? tr("已在主畫面", "On Home", "追加済み", "홈에 있음") : tr("將移除", "Will remove", "削除予定", "제거 예정")}</small>}
                  </div>
                );
              })}
              </div>
              {!pageApps.length && <div className="mp-library-empty">{tr("找不到符合的 App", "No matching apps", "該当するアプリはありません", "일치하는 앱이 없습니다")}</div>}
            </section>
          ))}
        </div>
        {pages.length > 1 && <div className="mp-library-page-dots" aria-label={`${libraryPage + 1} / ${pages.length}`}>
          {pages.map((_, index) => <button key={index} className={index === libraryPage ? "active" : ""} onClick={() => setLibraryPage(index)} aria-label={`${index + 1}`} />)}
        </div>}
      </div>
      {selectionMode && (
        <div className="mp-library-selection-bar">
          <button onClick={cancelSelection}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
          <button className="primary" disabled={!selectionChanged} onClick={confirmSelection}>
            {tr("套用", "Apply", "適用", "적용")}
          </button>
        </div>
      )}
      <div className="mp-library-home-gesture" aria-label={tr("向上滑動返回主畫面", "Swipe up for Home", "上にスワイプしてホームへ", "위로 밀어 홈으로")}
        onPointerDown={onHomeGestureStart} onPointerMove={onHomeGestureMove} onPointerUp={onHomeGestureEnd} onPointerCancel={cancelHomePointerGesture}
        onTouchStart={onHomeTouchStart} onTouchEnd={onHomeTouchEnd} onTouchCancel={cancelHomeTouchGesture}><span /></div>
    </div>
  );
}

export function FolderPanel({ folder, appById, renderAppIcon, tr, onClose, onRename, onOpenApp, onRemoveApp, onPreloadApp }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder?.name || "");
  if (!folder) return null;
  const fallbackName = tr("資料夾", "Folder", "フォルダ", "폴더");
  const saveName = () => {
    onRename(name.trim());
    setEditing(false);
  };
  return (
    <div className="mp-folder-backdrop" onClick={onClose}>
      <div className="mp-folder-panel" onClick={(event) => event.stopPropagation()}>
        <div className="mp-folder-title">
          {editing ? (
            <input autoFocus value={name} maxLength={18} onChange={(event) => setName(event.target.value)} onBlur={saveName} onKeyDown={(event) => event.key === "Enter" && saveName()} />
          ) : <button onClick={() => setEditing(true)}>{folder.name || fallbackName} <small>✎</small></button>}
          <button className="mp-folder-close" onClick={onClose}>×</button>
        </div>
        <div className="mp-folder-grid">
          {folder.appIds.map((appId) => {
            const app = appById[appId];
            if (!app) return null;
            return (
              <div className="mp-folder-app" key={appId}>
                <button onPointerEnter={() => { void onPreloadApp?.(appId); }} onPointerDown={() => { void onPreloadApp?.(appId); }} onFocus={() => { void onPreloadApp?.(appId); }} onClick={() => onOpenApp(appId)}>
                  <span className={`mp-icon-c ${app.iconUrl ? "mp-icon-c-img" : ""}`}>{renderAppIcon(app, app.iconUrl ? (app.iconSize || 56) : 26)}</span>
                  <span>{app.name}</span>
                </button>
                <button className="mp-folder-remove" onClick={() => onRemoveApp(appId)} aria-label={tr("從主畫面移除", "Remove from Home", "ホーム画面から外す", "홈 화면에서 제거")}>−</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
