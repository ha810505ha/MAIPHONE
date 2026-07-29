import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pin, Pencil, Trash2 } from "lucide-react";

const PAGE_SIZE = 5;

export default function ChatMemorySettings({
  memories = [],
  applyUserPlaceholder,
  onEdit,
  onTogglePin,
  onDelete,
  tr,
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const sorted = useMemo(() => [...memories].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (Number(b.date) || 0) - (Number(a.date) || 0);
  }), [memories]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const renderText = (text) => applyUserPlaceholder?.(text) ?? text;

  return (
    <div className="mp-cc mp-chat-memory-settings">
      <button type="button" className="mp-thought-history-toggle" onClick={() => setOpen((value) => !value)}>
        <span>✦ {tr("長期記憶", "Long-term memories", "長期記憶", "장기 기억")} · {memories.length}/30</span>
        <span>{open ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("查看", "View", "見る", "보기")}</span>
      </button>
      <div className="mp-chat-memory-hint">{tr(
        "這個聊天室目前保存、並會提供給角色參考的記憶。",
        "Memories saved for this chat and available to the character.",
        "このチャットに保存され、キャラクターが参照する記憶です。",
        "이 채팅에 저장되어 캐릭터가 참고하는 기억입니다。",
      )}</div>
      {open && (
        <div className="mp-chat-memory-list">
          {visible.length ? visible.map((memory, index) => {
            const id = memory.id || `${safePage}-${index}`;
            const active = activeId === id;
            return (
              <div key={id} className={`mp-chat-memory-item ${active ? "active" : ""}`} onClick={() => setActiveId(active ? null : id)}>
                <div className="mp-chat-memory-text">{renderText(memory.text)}</div>
                <div className="mp-chat-memory-meta">
                  <span>{memory.date ? new Date(memory.date).toLocaleDateString("zh-TW") : ""}{memory.pinned ? ` · ${tr("已釘選", "Pinned", "ピン留め", "고정됨")}` : ""}</span>
                  {active && (
                    <span className="mp-chat-memory-actions">
                      <button type="button" title={tr("編輯", "Edit", "編集", "편집")} onClick={(event) => { event.stopPropagation(); onEdit?.(memory); }}><Pencil size={13} /></button>
                      <button type="button" title={tr("釘選", "Pin", "ピン留め", "고정")} onClick={(event) => { event.stopPropagation(); onTogglePin?.(memory); }}><Pin size={13} fill={memory.pinned ? "currentColor" : "none"} /></button>
                      <button type="button" className="danger" title={tr("刪除", "Delete", "削除", "삭제")} onClick={(event) => { event.stopPropagation(); onDelete?.(memory); }}><Trash2 size={13} /></button>
                    </span>
                  )}
                </div>
              </div>
            );
          }) : <div className="mp-thought-history-empty">{tr("目前還沒有長期記憶", "No long-term memories yet", "長期記憶はまだありません", "아직 장기 기억이 없습니다")}</div>}
          {pageCount > 1 && (
            <div className="mp-thought-history-pages">
              <button type="button" disabled={safePage <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={15} /></button>
              <span>{safePage + 1} / {pageCount}</span>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}><ChevronRight size={15} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
