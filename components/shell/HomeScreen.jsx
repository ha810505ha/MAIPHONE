import React, { useLayoutEffect, useRef } from "react";
import { BarClock, DeskClock } from "../common/PhoneClocks";
import PeachHero from "../home/PeachHero";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

function ActiveCharacterCard({ character, peachTheme, onOpen, onOpenFromTouch, tr }) {
  if (!character) return null;
  const status = (character.statusText || character.description || tr("線上", "Online", "オンライン中", "온라인 중")).slice(0, 34);
  if (peachTheme) return <PeachHero character={character} imageUrl={sanitizeUserImageUrl(character.heroImage)} statusText={status} onOpen={onOpen} />;
  const avatar = sanitizeUserImageUrl(character.avatar);
  return (
    <div className="mp-cw" onClick={(event) => { event.stopPropagation(); onOpen(); }} onPointerUp={(event) => onOpenFromTouch(event)}>
      <div className="mp-av">{avatar ? <img src={avatar} alt="" /> : "??"}</div>
      <div className="mp-cw-info">
        <div className="mp-cw-name">{character.name}<span className="mp-active-badge">ACTIVE</span></div>
        <div className="mp-cw-desc">{status}</div>
        <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 2 }}>
          {tr("更新：", "Updated: ", "更新: ", "업데이트: ")}{character.statusUpdatedAt ? new Date(character.statusUpdatedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
        </div>
      </div>
    </div>
  );
}

// 紅點只表示「有沒有」，數量留給 App 內部的列表顯示——桌面圖示這個尺寸放數字會太擠。
const Badge = ({ show }) => (show ? <span className="mp-icon-badge" /> : null);

function AppGrid({ pages, page, pageSize, appById, badges, dragging, pointerDrag, pageGesture, renderAppIcon, onDropGrid, onDropSlot, onOpenApp, onOpenFromTouch, onPointerDragStart, onPreloadApp }) {
  const itemElementsRef = useRef(new Map());
  const previousRectsRef = useRef(new Map());
  const motionAnimationsRef = useRef(new Map());
  const renderedPages = pointerDrag?.previewSlots
    ? pages.map((_, pageIndex) => pointerDrag.previewSlots.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize))
    : pages;
  useLayoutEffect(() => {
    const nextRects = new Map();
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    itemElementsRef.current.forEach((element, id) => {
      if (!element) return;
      const next = element.getBoundingClientRect();
      nextRects.set(id, next);
      const previous = previousRectsRef.current.get(id);
      if (!previous || reduceMotion || typeof element.animate !== "function") return;
      const dx = previous.left - next.left;
      const dy = previous.top - next.top;
      if (Math.abs(dx) + Math.abs(dy) < 2) return;
      motionAnimationsRef.current.get(id)?.cancel();
      element.style.willChange = "transform";
      const animation = element.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "translate(0,0)" }], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" });
      motionAnimationsRef.current.set(id, animation);
      const finish = () => {
        if (motionAnimationsRef.current.get(id) !== animation) return;
        motionAnimationsRef.current.delete(id);
        element.style.willChange = "";
      };
      animation.onfinish = finish;
      animation.oncancel = finish;
    });
    previousRectsRef.current = nextRects;
    return () => {
      for (const animation of motionAnimationsRef.current.values()) animation.cancel();
      motionAnimationsRef.current.clear();
    };
  }, [pointerDrag?.previewSlots]);
  return (
    <div className="mp-home-mid">
      <div className="mp-pages">
        <div
          className="mp-pages-track"
          style={{
            transform: `translate3d(calc(-${page * 100}% + ${pageGesture?.offsetX || 0}px),0,0)`,
            transitionDuration: pageGesture?.active
              ? "0ms"
              : `${pageGesture?.settleMs || 240}ms`,
          }}
        >
          {renderedPages.map((apps, pageIndex) => (
            <div key={pageIndex} className="mp-grid" onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropGrid(event, pageIndex)}>
              {Array.from({ length: pageSize }).map((_, slotIndex) => {
                const entry = apps[slotIndex] || null;
                const app = entry?.type === "app" ? appById[entry.appId] : null;
                const folder = entry?.type === "folder" ? entry : null;
                const placeholder = entry?.type === "placeholder";
                const entryKey = app ? `app-${app.id}` : folder ? `folder-${folder.id}` : null;
                const absoluteIndex = pageIndex * pageSize + slotIndex;
                return (
                  <div
                    ref={(element) => {
                      if (!entryKey) return;
                      if (element) itemElementsRef.current.set(entryKey, element);
                      else itemElementsRef.current.delete(entryKey);
                    }}
                    key={`slot-${absoluteIndex}`}
                    className={`mp-icon ${entry ? "" : "mp-icon-empty"} ${placeholder ? "mp-icon-placeholder" : ""} ${pointerDrag?.folderArmedSlot === absoluteIndex ? "mp-folder-drop-armed" : ""} ${pointerDrag?.insertionSlot === absoluteIndex ? `mp-insert-${pointerDrag.insertionAfter ? "after" : "before"}` : ""}`}
                    data-app-id={app?.id || undefined}
                    data-folder-id={folder?.id || undefined}
                    data-drag-placeholder={placeholder ? "1" : undefined}
                    data-drop-slot={absoluteIndex}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => onDropSlot(event, absoluteIndex)}
                    onPointerEnter={() => { if (app) void onPreloadApp?.(app.id); }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (folder) onOpenApp(folder);
                      else if (app && !dragging) onOpenApp(app.id);
                    }}
                    onPointerUp={(event) => {
                      if (app && !dragging) onOpenFromTouch(app.id, event);
                    }}
                    onPointerDown={(event) => {
                      if (folder) {
                        event.stopPropagation();
                        return;
                      }
                      if (app) {
                        void onPreloadApp?.(app.id);
                        onPointerDragStart(event, app.id, "home");
                      }
                    }}
                    draggable={false}
                  >
                    {placeholder ? <div className="mp-drag-placeholder" /> : folder ? (
                      <div className="mp-icon-c mp-folder-icon">{folder.appIds.slice(0, 4).map((id) => <span key={id}>{renderAppIcon(appById[id], appById[id]?.iconUrl ? 22 : 13)}</span>)}</div>
                    ) : <div className={`mp-icon-c ${app?.iconUrl ? "mp-icon-c-img" : ""}`}>{app ? renderAppIcon(app, app.iconUrl ? (app.iconSize || 56) : 26) : ""}</div>}
                    <span className="mp-icon-l">{placeholder ? "" : folder ? (folder.name || "資料夾") : (app ? app.name : "")}</span>
                    <Badge show={app ? !!badges?.[app.id] : folder?.appIds?.some((id) => badges?.[id])} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dock({ apps, badges, dragging, renderAppIcon, onDropContainer, onDropApp, onOpenApp, onOpenFromTouch, onPointerDragStart, onPreloadApp }) {
  return (
    <div className="mp-dock" data-drop-dock-wrap="1" onDragOver={(event) => event.preventDefault()} onDrop={onDropContainer} style={{ justifyContent: "center", gap: apps.length <= 2 ? 22 : 14 }}>
      {apps.map((app, index) => (
        <div key={`dock-${index}`} className="mp-dock-i" data-app-id={app.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropApp(event, index)} data-drop-dock={index} onPointerEnter={() => { void onPreloadApp?.(app.id); }} onClick={(event) => { event.stopPropagation(); if (!dragging) onOpenApp(app.id); }} onPointerUp={(event) => { if (!dragging) onOpenFromTouch(app.id, event); }} draggable={false} onPointerDown={(event) => { void onPreloadApp?.(app.id); onPointerDragStart(event, app.id, "dock"); }}>
          {renderAppIcon(app, app.iconUrl ? (app.iconSize || 56) : 24)}
          <Badge show={!!badges?.[app.id]} />
        </div>
      ))}
    </div>
  );
}

export default function HomeScreen({ ft, fd, activeCharacter, peachTheme, tr, currentApp, pages, page, pageSize, appById, dockApps, badges, dragging, pointerDrag, pageGesture, renderAppIcon, gestureHandlers, onOpenStatus, onOpenStatusFromTouch, onDropGrid, onDropSlot, onDropDockContainer, onDropDockApp, onOpenApp, onOpenFolder, onOpenAllApps, onOpenFromTouch, onPointerDragStart, onPreloadApp }) {
  const verticalOffset = pageGesture?.axis === "y" ? pageGesture.offsetY || 0 : 0;
  const verticalProgress = Math.min(1, Math.abs(verticalOffset) / 150);
  const stopHomeGesture = (event) => event.stopPropagation();
  return (
    <>
      <div
        className={`mp-desk ${currentApp ? "is-obscured" : ""}`}
        aria-hidden={currentApp ? "true" : undefined}
        style={{
          transform: `translate3d(0,${verticalOffset * 0.28}px,0) scale(${1 - verticalProgress * 0.025})`,
          opacity: 1 - verticalProgress * 0.14,
          transition: pageGesture?.active
            ? "none"
            : `transform ${pageGesture?.settleMs || 240}ms cubic-bezier(.22,.72,.2,1), opacity ${pageGesture?.settleMs || 240}ms ease`,
        }}
        {...gestureHandlers}
      >
        <BarClock ft={ft} />
        <div className="mp-desk-scroll">
          <DeskClock ft={ft} fd={fd} />
          <ActiveCharacterCard character={activeCharacter} peachTheme={peachTheme} onOpen={onOpenStatus} onOpenFromTouch={onOpenStatusFromTouch} tr={tr} />
          <AppGrid pages={pages} page={page} pageSize={pageSize} appById={appById} badges={badges} dragging={dragging} pointerDrag={pointerDrag} pageGesture={pageGesture} renderAppIcon={renderAppIcon} onDropGrid={onDropGrid} onDropSlot={onDropSlot} onOpenApp={(target) => typeof target === "string" ? onOpenApp(target) : onOpenFolder(target)} onOpenFromTouch={onOpenFromTouch} onPointerDragStart={onPointerDragStart} onPreloadApp={onPreloadApp} />
        </div>
        {!currentApp && (
          <button
            type="button"
            className="mp-all-apps-handle"
            aria-label={tr("全部 App", "All apps", "すべてのアプリ", "모든 앱")}
            onPointerDown={stopHomeGesture}
            onPointerUp={stopHomeGesture}
            onTouchStart={stopHomeGesture}
            onTouchEnd={stopHomeGesture}
            onClick={(event) => {
              event.stopPropagation();
              onOpenAllApps();
            }}
          >
            <span>⌃</span>{tr("全部 App", "All apps", "すべてのアプリ", "모든 앱")}
          </button>
        )}
        {!currentApp && <div className="mp-page-dots">{pages.map((_, index) => <span key={index} className={`mp-page-dot ${page === index ? "active" : ""}`} />)}</div>}
        <Dock apps={dockApps} badges={badges} dragging={dragging} renderAppIcon={renderAppIcon} onDropContainer={onDropDockContainer} onDropApp={onDropDockApp} onOpenApp={onOpenApp} onOpenFromTouch={onOpenFromTouch} onPointerDragStart={onPointerDragStart} onPreloadApp={onPreloadApp} />
      </div>
      {pointerDrag?.moved && (
        <div style={{ position: "fixed", left: 0, top: 0, width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,.92)", border: "1px solid rgba(231,197,214,.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, pointerEvents: "none", zIndex: 9999, boxShadow: "0 12px 24px rgba(0,0,0,.2)", transform: `translate3d(${pointerDrag.x - 28}px, ${pointerDrag.y - 28}px, 0) scale(1.04)`, willChange: "transform" }}>
          {renderAppIcon(appById[pointerDrag.appId], appById[pointerDrag.appId]?.iconUrl ? (appById[pointerDrag.appId]?.iconSize || 56) : 26) || "🧩"}
        </div>
      )}
    </>
  );
}
