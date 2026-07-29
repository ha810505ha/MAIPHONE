import React, { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { confirmLocalized } from "../../utils/i18n";
import {
  loadFeatureEntity,
  saveFeatureEntity,
} from "../../utils/indexedDbStorage";
import { FEATURE_DATA_CHANGED_EVENT, featureDataEventIncludes } from "../../services/featureDataLifecycle";
import { NOTES_ENTITY_KEY, upsertNoteDraft } from "../../utils/notesPersistence";

const KEY = NOTES_ENTITY_KEY;
const COLORS = [
  "#57434b",
  "#9b4d68",
  "#d85e87",
  "#c47b22",
  "#3d7a5c",
  "#3974a8",
  "#7654a6",
  "#222222",
];
const FONTS = [
  ["system-ui", "系統字體"],
  ["Arial, sans-serif", "Arial"],
  ["'Noto Sans TC', sans-serif", "黑體"],
  ["'Noto Serif TC', serif", "明體"],
  ["'Microsoft JhengHei', sans-serif", "微軟正黑體"],
  ["monospace", "等寬字體"],
];
const id = () =>
  globalThis.crypto?.randomUUID?.() ||
  `note_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const empty = () => ({
  id: id(),
  title: "",
  content: "",
  privacy: "private",
  pinned: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
const textOf = (html = "") =>
  String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  // 禁止事件屬性 / javascript: 等危險載體,保留 rich-text 需要的樣式
  FORBID_ATTR: ["srcset"],
  ALLOW_DATA_ATTR: false,
};
const sanitizeHtml = (value = "") =>
  typeof DOMPurify.sanitize === "function"
    ? DOMPurify.sanitize(String(value), SANITIZE_CONFIG)
    : "";
const htmlOf = (value = "") =>
  /<\/?[a-z][\s\S]*>/i.test(value)
    ? sanitizeHtml(value)
    : String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

export default function NotesApp({ onBack }) {
  const [notes, setNotes] = useState(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [draft, setDraft] = useState(null),
    [showColors, setShowColors] = useState(false),
    [activeFormats, setActiveFormats] = useState({});
  const editorRef = useRef(null),
    selectionRef = useRef(null),
    timerRef = useRef(null),
    notesRef = useRef(notes),
    draftRef = useRef(draft),
    latestContentRef = useRef(null);
  notesRef.current = notes;
  draftRef.current = draft;
  const write = async (next) => {
    notesRef.current = next;
    setNotes(next);
    await saveFeatureEntity(KEY, next);
  };
  const persistCurrentDraft = ({ updateState = true } = {}) => {
    const activeDraft = draftRef.current;
    if (!activeDraft) return Promise.resolve(null);
    const content = latestContentRef.current
      ?? editorRef.current?.innerHTML
      ?? activeDraft.content;
    const result = upsertNoteDraft(notesRef.current, activeDraft, content);
    notesRef.current = result.notes;
    if (updateState) setNotes(result.notes);
    return saveFeatureEntity(KEY, result.notes).then(() => result.item);
  };
  const saveDraft = (content = null) => {
    if (!draftRef.current) return;
    if (content !== null) latestContentRef.current = content;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      persistCurrentDraft().catch((error) => console.error("[notes] 自動儲存失敗", error));
    }, 450);
  };
  useEffect(() => {
    if (draft) saveDraft();
  }, [draft?.title, draft?.privacy]);
  useEffect(() => {
    let live = true;
    const reload = () => {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      latestContentRef.current = null;
      draftRef.current = null;
      setDraft(null);
      loadFeatureEntity(KEY, [])
        .then((data) => {
          if (!live) return;
          const next = Array.isArray(data) ? data : [];
          notesRef.current = next;
          setNotes(next);
        })
        .catch(() => {
          if (!live) return;
          notesRef.current = [];
          setNotes([]);
        });
    };
    const onFeatureDataChanged = (event) => {
      if (featureDataEventIncludes(event, KEY)) reload();
    };
    reload();
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    return () => {
      live = false;
      window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (draftRef.current) {
        void persistCurrentDraft({ updateState: false }).catch((error) => console.error("[notes] 離開前儲存失敗", error));
      }
    };
  }, []);
  useEffect(() => {
    const remember = () => {
      const s = window.getSelection();
      if (s?.rangeCount && editorRef.current?.contains(s.anchorNode)) {
        selectionRef.current = s.getRangeAt(0).cloneRange();
        setActiveFormats({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strikeThrough: document.queryCommandState("strikeThrough"),
        });
      }
    };
    document.addEventListener("selectionchange", remember);
    return () => document.removeEventListener("selectionchange", remember);
  }, [draft]);
  const restoreSelection = () => {
    const selection = window.getSelection();
    if (selectionRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
    editorRef.current?.focus();
  };
  const format = (command, value = null) => {
    restoreSelection();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(command, false, value);
    setActiveFormats((current) => ({
      ...current,
      [command]: document.queryCommandState(command),
    }));
    saveDraft(editorRef.current?.innerHTML || "");
  };
  const setFontSize = (px) => {
    if (styleSelection({ fontSize: `${px}px` })) return;
    restoreSelection();
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    const marker = document.createTextNode("\u200B");
    span.style.fontSize = `${px}px`;
    span.appendChild(marker);
    range.insertNode(span);
    range.setStart(marker, 1);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    selectionRef.current = range.cloneRange();
    saveDraft(editorRef.current?.innerHTML || "");
  };
  const styleSelection = (style) => {
    const s = window.getSelection(),
      r = selectionRef.current || (s?.rangeCount ? s.getRangeAt(0) : null);
    if (!r || !r.toString()) return false;
    const next = r.cloneRange(),
      span = document.createElement("span");
    Object.assign(span.style, style);
    span.appendChild(next.extractContents());
    next.insertNode(span);
    selectionRef.current = next;
    s?.removeAllRanges();
    s?.addRange(next);
    editorRef.current?.focus();
    saveDraft(editorRef.current?.innerHTML || "");
    return true;
  };
  const visible = useMemo(
    () =>
      (notes || [])
        .filter(
          (n) =>
            (filter === "all" || n.privacy === filter) &&
            (!query.trim() ||
              `${n.title} ${textOf(n.content)}`
                .toLowerCase()
                .includes(query.trim().toLowerCase())),
        )
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
        ),
    [notes, filter, query],
  );
  if (notes === null)
    return (
      <div
        className="mp-page"
        style={{ display: "grid", placeItems: "center" }}
      >
        正在讀取筆記⋯
      </div>
    );
  if (draft)
    return (
      <div
        className="mp-page"
        style={{
          background: "linear-gradient(180deg,#fffaf8,#fdecef)",
          color: "#57434b",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div className="mp-hdr">
          <div
            className="mp-back"
            onClick={() => {
              clearTimeout(timerRef.current);
              timerRef.current = null;
              void persistCurrentDraft().catch((error) => console.error("[notes] 返回前儲存失敗", error));
              draftRef.current = null;
              latestContentRef.current = null;
              setDraft(null);
            }}
          >
            ←
          </div>
          <div className="mp-htitle">{draft.privacy === "private" ? "🔒 " : ""}{draft.title || "新增筆記"}</div>
          <div style={{ marginLeft: "auto", color: "#a78390", fontSize: 12 }}>
            自動儲存
          </div>
        </div>
        <div
          style={{
            padding: "14px 18px max(18px, env(safe-area-inset-bottom))",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="標題"
            style={{
              border: 0,
              borderBottom: "1px solid #f0cbd6",
              background: "transparent",
              padding: "8px 2px",
              fontSize: 24,
              fontWeight: 900,
              color: "#57434b",
              outline: 0,
            }}
          />
          <div style={{ display: "inline-grid", gridTemplateColumns: "auto auto", alignSelf: "flex-start", gap: 3, padding: 3, borderRadius: 999, background: "rgba(255,255,255,.7)", border: "1px solid #ead6dd" }}>
            {[["shared", "一般"], ["private", "🔒 私密"]].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setDraft({ ...draft, privacy: value })} style={{ border: 0, borderRadius: 999, padding: "5px 9px", background: draft.privacy === value ? (value === "private" ? "#756476" : "#f39ab3") : "transparent", color: draft.privacy === value ? "#fff" : "#8d7580", fontSize: 12, fontWeight: 800, transition: "background .18s ease,color .18s ease" }}>{label}</button>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              padding: 7,
              borderRadius: 18,
              background: draft.privacy === "private" ? "rgba(239,234,241,.94)" : "rgba(255,255,255,.78)",
              border: draft.privacy === "private" ? "1px solid #b9a9bc" : "1px solid #f0d5dc",
              position: "relative",
              zIndex: 10,
              order: 1,
              boxShadow: "0 8px 24px rgba(87,67,75,.14)",
            }}
          >
            {[
              ["bold", "B"],
              ["italic", "I"],
              ["underline", "U"],
              ["strikeThrough", "S"],
            ].map(([cmd, label]) => (
              <button
                key={cmd}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  format(cmd);
                }}
                style={{
                  border: 0,
                  borderRadius: 10,
                  minWidth: 32,
                  padding: "7px 9px",
                  background: activeFormats[cmd] ? "#d85e87" : "#fff4f6",
                  color: activeFormats[cmd] ? "#fff" : "#714f5c",
                  fontWeight: cmd === "bold" ? 900 : 500,
                  fontStyle: cmd === "italic" ? "italic" : "normal",
                  textDecoration:
                    cmd === "underline"
                      ? "underline"
                      : cmd === "strikeThrough"
                        ? "line-through"
                        : "none",
                }}
              >
                {label}
              </button>
            ))}
            <select
              defaultValue="16"
              onChange={(e) => setFontSize(e.target.value)}
              style={{
                border: 0,
                borderRadius: 10,
                padding: "7px 8px",
                background: "#fff4f6",
                color: "#714f5c",
              }}
            >
              <option value="12">12 px</option>
              <option value="14">14 px</option>
              <option value="16">16 px</option>
              <option value="18">18 px</option>
              <option value="22">22 px</option>
              <option value="28">28 px</option>
            </select>
            <select
              defaultValue="system-ui"
              onChange={(e) => format("fontName", e.target.value)}
              style={{ border: 0, borderRadius: 10, padding: "7px 8px", background: "#fff4f6", color: "#714f5c", maxWidth: 112 }}
            >
              {FONTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <div style={{ position: "relative" }}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowColors((value) => !value)} style={{ border: 0, borderRadius: 10, padding: "7px 10px", background: "#fff4f6", color: "#714f5c" }}>字色 ▾</button>
              {showColors && <div style={{ position: "absolute", top: "calc(100% + 7px)", right: 0, zIndex: 12, display: "grid", gridTemplateColumns: "repeat(4, 28px)", gap: 8, padding: 10, borderRadius: 14, background: "#fff", border: "1px solid #f0d5dc", boxShadow: "0 8px 24px rgba(87,67,75,.18)" }}>
                {COLORS.map((color) => <button key={color} type="button" aria-label={`套用 ${color} 字色`} onMouseDown={(e) => { e.preventDefault(); if (!styleSelection({ color })) format("foreColor", color); setShowColors(false); }} style={{ width: 28, height: 28, padding: 0, borderRadius: 8, border: "2px solid #fff", background: color, boxShadow: "0 0 0 1px #d8c1c9" }} />)}
              </div>}
            </div>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onMouseUp={() => {
              const s = window.getSelection();
              if (s?.rangeCount && s.toString())
                selectionRef.current = s.getRangeAt(0).cloneRange();
            }}
            onKeyUp={() => {
              const s = window.getSelection();
              if (s?.rangeCount && s.toString())
                selectionRef.current = s.getRangeAt(0).cloneRange();
            }}
            onInput={(e) => saveDraft(e.currentTarget.innerHTML)}
            dangerouslySetInnerHTML={{ __html: htmlOf(draft.content) }}
            style={{
              order: 2,
              flex: "1 1 auto",
              width: "100%",
              boxSizing: "border-box",
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              borderRadius: 6,
              padding: "22px 18px 80px",
              backgroundColor: draft.privacy === "private" ? "rgba(242,238,244,.96)" : "rgba(255,255,255,.88)",
              backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(207,170,181,.2) 32px)",
              backgroundSize: "100% 32px",
              color: "#57434b",
              fontSize: 16,
              lineHeight: "32px",
              outline: 0,
              boxShadow: draft.privacy === "private" ? "inset 0 0 0 1px rgba(117,100,118,.24),0 5px 18px rgba(87,67,75,.1)" : "0 5px 18px rgba(87,67,75,.08)",
            }}
          />
        </div>
      </div>
    );
  const open = (note) => {
    const next = note ? { ...note } : empty();
    latestContentRef.current = next.content || "";
    setDraft(next);
  };
  const remove = async (note) => {
    if (confirmLocalized("確定要刪除這篇筆記嗎？"))
      await write(notes.filter((n) => n.id !== note.id));
  };
  const pin = async (note) =>
    await write(
      notes.map((n) =>
        n.id === note.id
          ? { ...n, pinned: !n.pinned, updatedAt: Date.now() }
          : n,
      ),
    );
  return (
    <div
      className="mp-page"
      style={{
        background: "linear-gradient(180deg,#fffaf8,#fdecef)",
        color: "#57434b",
        overflowY: "auto",
        position: "relative",
        height: "100%",
        minHeight: 0,
        boxSizing: "border-box",
      }}
    >
      <div className="mp-hdr">
        <div className="mp-back" onClick={onBack}>
          ←
        </div>
        <div className="mp-htitle">筆記</div>
      </div>
      <div style={{ padding: 14 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋筆記"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #f0cbd6",
            borderRadius: 14,
            padding: "10px 13px",
            background: "rgba(255,255,255,.8)",
            outline: 0,
          }}
        />
        <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
          {[
            ["all", "全部"],
            ["private", "私密"],
            ["shared", "一般"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                border: 0,
                borderRadius: 999,
                padding: "7px 13px",
                background: filter === key ? "#7d5a6e" : "#fff",
                color: filter === key ? "#fff" : "#7d5a6e",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9a7f88", padding: 50 }}>
            還沒有筆記，點擊右下角鉛筆開始記錄
          </div>
        ) : (
          visible.map((note) => (
            <div
              key={note.id}
              onClick={() => open(note)}
              style={{
                position: "relative",
                marginBottom: 10,
                padding: "14px 44px 14px 15px",
                borderRadius: 16,
                background: "rgba(255,255,255,.82)",
                border: "1px solid #f0d5dc",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 800 }}>
                {note.pinned ? "📌 " : ""}
                {note.title || "未命名筆記"}
              </div>
              <div
                style={{
                  marginTop: 5,
                  color: "#8a737c",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {textOf(note.content) || "尚未輸入內容"}
              </div>
              <div style={{ marginTop: 7, color: "#b18c99", fontSize: 11 }}>
                {note.privacy === "private" ? "🔒 私密" : "一般"}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  pin(note);
                }}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 9,
                  border: 0,
                  background: "transparent",
                  fontSize: 17,
                }}
              >
                {note.pinned ? "★" : "☆"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(note);
                }}
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 10,
                  border: 0,
                  background: "transparent",
                  color: "#c58a9b",
                  fontSize: 12,
                }}
              >
                刪除
              </button>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        className="notes-add-button"
        aria-label="新增筆記"
        onClick={() => open()}
        style={{
          position: "absolute",
          right: 16,
          bottom: "max(26px, env(safe-area-inset-bottom))",
          zIndex: 20,
          width: 58,
          height: 58,
          border: 0,
          borderRadius: "50%",
          background: "linear-gradient(145deg,#f39ab3,#d85e87)",
          color: "#fff",
          fontSize: 28,
          lineHeight: 1,
          boxShadow: "0 10px 24px rgba(168,75,108,.32)",
        }}
      >
        ✎
      </button>
    </div>
  );
}
