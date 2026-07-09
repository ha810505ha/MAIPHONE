import React from "react";
import { BarClock, DeskClock } from "../common/PhoneClocks";
import PeachHero from "../home/PeachHero";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

function ActiveCharacterCard({ character, peachTheme, onOpen, onOpenFromTouch, tr }) {
  if (!character) return null;
  const status = (character.statusText || character.description || tr("在線中", "Online", "オンライン中", "온라인 중")).slice(0, 34);
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

function AppGrid({ pages, page, pageSize, appById, dragging, renderAppIcon, onDropGrid, onDropSlot, onOpenApp, onOpenFromTouch, onPointerDragStart }) {
  return (
    <div className="mp-home-mid">
      <div className="mp-pages">
        <div className="mp-pages-track" style={{ transform: `translateX(-${page * 100}%)` }}>
          {pages.map((apps, pageIndex) => (
            <div key={pageIndex} className="mp-grid" onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropGrid(event, pageIndex)}>
              {Array.from({ length: pageSize }).map((_, slotIndex) => {
                const app = apps[slotIndex] ? appById[apps[slotIndex]] : null;
                const absoluteIndex = pageIndex * pageSize + slotIndex;
                return (
                  <div key={`slot-${absoluteIndex}`} className={`mp-icon ${app ? "" : "mp-icon-empty"}`} data-app-id={app?.id || undefined} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropSlot(event, absoluteIndex)} data-drop-slot={absoluteIndex} onClick={(event) => { event.stopPropagation(); if (app && !dragging) onOpenApp(app.id); }} onPointerUp={(event) => { if (app && !dragging) onOpenFromTouch(app.id, event); }} draggable={false} onPointerDown={(event) => app && onPointerDragStart(event, app.id, "home")}>
                    <div className={`mp-icon-c ${app?.iconUrl ? "mp-icon-c-img" : ""}`}>{app ? renderAppIcon(app, app.iconUrl ? 56 : 26) : ""}</div>
                    <span className="mp-icon-l">{app ? app.name : ""}</span>
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

function Dock({ apps, dragging, renderAppIcon, onDropContainer, onDropApp, onOpenApp, onOpenFromTouch, onPointerDragStart }) {
  return (
    <div className="mp-dock" data-drop-dock-wrap="1" onDragOver={(event) => event.preventDefault()} onDrop={onDropContainer} style={{ justifyContent: "center", gap: apps.length <= 2 ? 22 : 14 }}>
      {apps.map((app, index) => (
        <div key={`dock-${index}`} className="mp-dock-i" data-app-id={app.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropApp(event, index)} data-drop-dock={index} onClick={(event) => { event.stopPropagation(); if (!dragging) onOpenApp(app.id); }} onPointerUp={(event) => { if (!dragging) onOpenFromTouch(app.id, event); }} draggable={false} onPointerDown={(event) => onPointerDragStart(event, app.id, "dock")}>
          {renderAppIcon(app, app.iconUrl ? 56 : 24)}
        </div>
      ))}
    </div>
  );
}

export default function HomeScreen({ ft, fd, activeCharacter, peachTheme, tr, currentApp, pages, page, pageSize, appById, dockApps, dragging, pointerDrag, renderAppIcon, gestureHandlers, onOpenStatus, onOpenStatusFromTouch, onDropGrid, onDropSlot, onDropDockContainer, onDropDockApp, onOpenApp, onOpenFromTouch, onPointerDragStart }) {
  return (
    <>
      <div className="mp-desk" {...gestureHandlers}>
        <BarClock ft={ft} />
        <div className="mp-desk-scroll">
          <DeskClock ft={ft} fd={fd} />
          <ActiveCharacterCard character={activeCharacter} peachTheme={peachTheme} onOpen={onOpenStatus} onOpenFromTouch={onOpenStatusFromTouch} tr={tr} />
          <AppGrid pages={pages} page={page} pageSize={pageSize} appById={appById} dragging={dragging} renderAppIcon={renderAppIcon} onDropGrid={onDropGrid} onDropSlot={onDropSlot} onOpenApp={onOpenApp} onOpenFromTouch={onOpenFromTouch} onPointerDragStart={onPointerDragStart} />
        </div>
        {!currentApp && <div className="mp-page-dots">{pages.map((_, index) => <span key={index} className={`mp-page-dot ${page === index ? "active" : ""}`} />)}</div>}
        <Dock apps={dockApps} dragging={dragging} renderAppIcon={renderAppIcon} onDropContainer={onDropDockContainer} onDropApp={onDropDockApp} onOpenApp={onOpenApp} onOpenFromTouch={onOpenFromTouch} onPointerDragStart={onPointerDragStart} />
      </div>
      {pointerDrag?.moved && (
        <div style={{ position: "fixed", left: pointerDrag.x - 22, top: pointerDrag.y - 22, width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,.92)", border: "1px solid rgba(231,197,214,.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, pointerEvents: "none", zIndex: 9999, boxShadow: "0 8px 18px rgba(0,0,0,.15)" }}>
          {appById[pointerDrag.appId]?.icon || "🧩"}
        </div>
      )}
    </>
  );
}
