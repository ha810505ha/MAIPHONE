import React, { useEffect, useState } from "react";

export default function ChatStoryNoteFloat({ note, enabled, tr }) {
  const [railOpen, setRailOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  useEffect(() => {
    setRailOpen(false);
    setNoteOpen(false);
  }, [note]);
  if (!enabled || !String(note || "").trim()) return null;
  return <aside className={`mp-story-note-float ${railOpen ? "is-rail-open" : ""} ${noteOpen ? "is-note-open" : ""}`} onClick={(event) => event.stopPropagation()}>
    {noteOpen && <div className="mp-story-note-popover"><div><b>🗒 {tr("劇情便條", "Story note", "ストーリーメモ", "스토리 메모")}</b><button type="button" onClick={() => setNoteOpen(false)}>×</button></div><p>{note}</p></div>}
    {railOpen ? <div className="mp-story-note-rail"><button type="button" onClick={() => setNoteOpen((value) => !value)} title={tr("顯示劇情便條", "Show story note", "ストーリーメモを表示", "스토리 메모 표시")}>🗒</button><button type="button" onClick={() => { setRailOpen(false); setNoteOpen(false); }} title={tr("貼回邊緣", "Dock to edge", "端に戻す", "가장자리에 숨기기")}>›</button></div> : <button type="button" className="mp-story-note-dock" onClick={() => setRailOpen(true)} aria-label={tr("打開劇情便條", "Open story note", "ストーリーメモを開く", "스토리 메모 열기")}>‹</button>}
  </aside>;
}
