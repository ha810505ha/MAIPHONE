import React, { useEffect, useRef, useState } from "react";

export default function ContactsApp({ t, closeApp, characters, activeCharId, sanitizeImage, onAdd, onSetActive, onChat, onView, onSaveDisplayOrder }) {
  const [page, setPage] = useState("list");
  const [draft, setDraft] = useState([]);
  const [dragId, setDragId] = useState(null);
  const dragRef = useRef({ id: null, timer: null, pointerId: null });
  useEffect(() => {
    if (page === "sort") setDraft(characters.map((character) => ({ id: character.id, pinned: !!character.displayPinned })));
  }, [page]);
  const byId = new Map(characters.map((character) => [character.id, character]));
  const visibleCharacters = page === "sort" ? draft.map((item) => ({ ...byId.get(item.id), displayPinned: item.pinned })).filter((item) => item.id) : characters;
  const togglePin = (id) => setDraft((items) => {
    const target = items.find((item) => item.id === id);
    if (!target) return items;
    const changed = { ...target, pinned: !target.pinned };
    const rest = items.filter((item) => item.id !== id);
    if (changed.pinned) return [...rest.filter((item) => item.pinned), changed, ...rest.filter((item) => !item.pinned)];
    return [...rest.filter((item) => item.pinned), changed, ...rest.filter((item) => !item.pinned)];
  });
  const beginDrag = (event, id) => {
    clearTimeout(dragRef.current.timer);
    const handle = event.currentTarget;
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    dragRef.current = { id: null, pendingId: id, pointerId: event.pointerId, handle, timer: setTimeout(() => { dragRef.current.id = id; setDragId(id); }, event.pointerType === "mouse" ? 0 : 220) };
  };
  const moveDrag = (event) => {
    if (!dragRef.current.id) return;
    event.preventDefault();
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-contact-sort-id]");
    const overId = row?.dataset?.contactSortId;
    if (!overId || overId === dragRef.current.id) return;
    setDraft((items) => {
      const from = items.findIndex((item) => item.id === dragRef.current.id), to = items.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0 || items[from].pinned !== items[to].pinned) return items;
      const next = [...items], [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next;
    });
  };
  const endDrag = () => { clearTimeout(dragRef.current.timer); try { const handle = dragRef.current.handle; if (handle?.hasPointerCapture?.(dragRef.current.pointerId)) handle.releasePointerCapture(dragRef.current.pointerId); } catch (_) {} dragRef.current = { id: null, timer: null, pointerId: null, handle: null }; setDragId(null); };
  if (page === "settings") return <div className="mp-page mp-contact-settings"><style>{`.mp-contact-settings .mp-cm{padding:14px}.mp-contact-setting-card{width:100%;display:flex;align-items:center;gap:12px;border:1px solid color-mix(in srgb,var(--mp-pink) 25%,transparent);border-radius:18px;background:var(--mp-surface);color:var(--mp-txt);padding:14px;text-align:left;box-shadow:0 5px 16px color-mix(in srgb,var(--mp-pink) 8%,transparent)}.mp-contact-setting-card:active{transform:scale(.99)}.mp-contact-setting-icon{width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(135deg,var(--mp-pink-lt),#fff);color:var(--mp-pink-dk);font-size:20px}.mp-contact-setting-copy{flex:1;min-width:0}.mp-contact-setting-copy b{display:block;font-size:14px}.mp-contact-setting-copy small{display:block;margin-top:4px;color:var(--mp-txt-l);font-size:10px;line-height:1.5}.mp-contact-setting-arrow{color:var(--mp-pink-dk);font-size:22px}`}</style><div className="mp-hdr"><div className="mp-back" onClick={() => setPage("list")}>←</div><div className="mp-htitle">聯絡人設定</div></div><div className="mp-cm"><button className="mp-contact-setting-card" type="button" onClick={() => setPage("sort")}><span className="mp-contact-setting-icon">↕</span><span className="mp-contact-setting-copy"><b>調整角色順序</b><small>設定聯絡人、狀態與手機共用的排列與釘選</small></span><span className="mp-contact-setting-arrow">›</span></button></div></div>;
  return <div className="mp-page"><div className="mp-hdr"><div className="mp-back" onClick={page === "sort" ? () => setPage("list") : closeApp}>←</div><div className="mp-htitle">{page === "sort" ? "調整角色順序" : t("characters")}</div>{page === "list" ? <button type="button" onClick={() => setPage("settings")} style={{ marginLeft: "auto", minWidth: 58, height: 40, border: "1px solid color-mix(in srgb,var(--mp-pink) 30%,transparent)", borderRadius: 13, background: "linear-gradient(135deg,var(--mp-pink-lt),var(--mp-surface))", color: "var(--mp-pink-dk)", fontSize: 13, fontWeight: 800 }}>設定</button> : <button type="button" onClick={() => { onSaveDisplayOrder(draft); setPage("list"); }} style={{ marginLeft: "auto", minWidth: 58, height: 40, border: "1px solid color-mix(in srgb,var(--mp-pink) 30%,transparent)", borderRadius: 13, background: "linear-gradient(135deg,var(--mp-pink-lt),var(--mp-surface))", color: "var(--mp-pink-dk)", fontSize: 13, fontWeight: 800 }}>儲存</button>}</div><div className="mp-cm">
    {page === "list" && <><button className="mp-add" onClick={onAdd}>{t("add")} / {t("import")} {t("characters")}</button><div style={{ height: 8 }} /></>}
    {page === "sort" && <><style>{`.mp-contact-sort-section{margin:5px 4px 8px;color:var(--mp-txt-l);font-size:10px;font-weight:800;letter-spacing:.12em}.mp-contact-sort-row{touch-action:pan-y;transition:transform .15s,opacity .15s,box-shadow .15s}.mp-contact-sort-row.dragging{opacity:.82;transform:scale(1.025);box-shadow:0 12px 28px color-mix(in srgb,var(--mp-pink) 24%,transparent);z-index:5}.mp-contact-drag-handle{width:38px;height:38px;border:0;background:transparent;color:var(--mp-txt-l);font-size:21px;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}.mp-contact-drag-handle:active{cursor:grabbing}`}</style><div style={{ padding: "2px 4px 12px", color: "var(--mp-txt-l)", fontSize: 11, lineHeight: 1.6 }}>長按右側把手後拖曳排序；★ 角色會固定在共同清單最上方。按「儲存」才會套用。</div></>}
    {visibleCharacters.map((character, index) => <React.Fragment key={character.id}>{page === "sort" && (index === 0 || visibleCharacters[index - 1]?.displayPinned !== character.displayPinned) && <div className="mp-contact-sort-section">{character.displayPinned ? "已釘選" : "其他角色"}</div>}<div data-contact-sort-id={page === "sort" ? character.id : undefined} className={`mp-cc ${page === "sort" ? "mp-contact-sort-row" : ""} ${dragId === character.id ? "dragging" : ""}`} onPointerMove={page === "sort" ? moveDrag : undefined} onPointerUp={page === "sort" ? endDrag : undefined} onPointerCancel={page === "sort" ? endDrag : undefined}><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: page === "sort" ? 0 : 8 }}>
      <div className="mp-av">{sanitizeImage(character.avatar) ? <img src={sanitizeImage(character.avatar)} alt="" /> : "🦊"}</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{character.name}</div>{page === "list" && <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{(character.description || character.personality || t("noRoleConfig")).slice(0, 52)}</div>}</div>
      {page === "sort" ? <><button className="mp-ibtn" type="button" onClick={() => togglePin(character.id)}>{character.displayPinned ? "★" : "☆"}</button><button className="mp-contact-drag-handle" type="button" aria-label="拖曳排序" onPointerDown={(event) => beginDrag(event, character.id)} onPointerUp={endDrag} onPointerCancel={endDrag}>☰</button></> : (activeCharId === character.id ? <span className="mp-active-badge">ACTIVE</span> : <button className="mp-ibtn" onClick={() => onSetActive(character)}>{t("setAsMainCharacter")}</button>)}
    </div>{page === "list" && <div style={{ display: "flex", gap: 6 }}><button className="mp-ibtn-chat" onClick={() => onChat(character)}>{t("startChatting")}</button><button className="mp-ibtn-chat" onClick={() => onView(character)}>{t("viewMore")}</button></div>}</div></React.Fragment>)}
  </div></div>;
}
