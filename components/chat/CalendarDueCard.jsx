import React from "react";

export default function CalendarDueCard({ event, busy, onStart, onSnooze, onSkip, tr }) {
  if (!event) return null;
  return (
    <div className="mp-calendar-due-card">
      <div className="mp-calendar-due-copy">
        <span>⏰</span>
        <div>
          <b>{event.time ? tr("約定時間到了", "It is time for your appointment", "約束の時間です", "약속 시간이 되었어요") : tr("今天有一個約定", "You have an appointment today", "今日は約束があります", "오늘 약속이 있어요")}</b>
          <small>{event.title}{event.time ? ` · ${event.time}` : ""}</small>
        </div>
      </div>
      <div className="mp-calendar-due-actions">
        <button type="button" disabled={busy} onClick={() => onSnooze?.(event)}>{tr("稍後", "Later", "あとで", "나중에")}</button>
        <button type="button" disabled={busy} onClick={() => onSkip?.(event)}>{tr("略過", "Skip", "スキップ", "건너뛰기")}</button>
        <button type="button" className="primary" disabled={busy} onClick={() => onStart?.(event)}>{tr("開始約定", "Start", "始める", "시작")}</button>
      </div>
    </div>
  );
}
