import React, { useEffect, useState } from "react";

export default function CalendarAppointmentCard({ message, proposal, onAdd, onDismiss, tr }) {
  const [form, setForm] = useState(() => ({
    title: proposal?.title || "",
    date: proposal?.date || "",
    time: proposal?.time || "",
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      title: proposal?.title || "",
      date: proposal?.date || "",
      time: proposal?.time || "",
    });
  }, [proposal?.title, proposal?.date, proposal?.time]);

  if (!proposal || proposal.status === "dismissed") return null;
  if (proposal.status === "added") {
    return (
      <div className="mp-calendar-proposal mp-calendar-proposal-added">
        <span>✓</span>
        <div><b>{tr("已加入日曆", "Added to calendar", "カレンダーに追加済み", "캘린더에 추가됨")}</b><small>{proposal.date}{proposal.time ? ` · ${proposal.time}` : ""}</small></div>
      </div>
    );
  }

  const canSave = form.title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(form.date);
  return (
    <div className="mp-calendar-proposal">
      <div className="mp-calendar-proposal-heading">
        <span className="mp-calendar-proposal-icon">📅</span>
        <div>
          <b>{tr("要加入日曆嗎？", "Add this to your calendar?", "カレンダーに追加しますか？", "캘린더에 추가할까요?")}</b>
          <small>{tr("確認後，只有這位角色會知道並在時間附近提醒", "After confirmation, only this character can know and remind you near the time", "確認後、このキャラだけが予定を知り、時間が近づくと知らせます", "확인하면 이 캐릭터만 일정을 알고 시간이 가까워지면 알려줍니다")}</small>
        </div>
      </div>
      <input
        className="mp-calendar-proposal-title"
        value={form.title}
        maxLength={60}
        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        aria-label={tr("約定名稱", "Appointment title", "予定名", "약속 이름")}
      />
      <div className="mp-calendar-proposal-time">
        <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
        <input type="time" value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} />
      </div>
      {!form.time && <div className="mp-calendar-proposal-hint">{tr("未設定時間：會記住日期，但不會顯示準時提醒", "No time set: the date is saved, but no timed reminder will appear", "時刻未設定：日付は保存されますが、時刻の通知は表示されません", "시간 미설정: 날짜는 저장되지만 정시 알림은 표시되지 않습니다")}</div>}
      <div className="mp-calendar-proposal-actions">
        <button type="button" onClick={() => onDismiss?.(message)}>{tr("略過", "Skip", "スキップ", "건너뛰기")}</button>
        <button
          type="button"
          className="primary"
          disabled={!canSave || saving}
          onClick={async () => {
            setSaving(true);
            try { await onAdd?.(message, { ...form, title: form.title.trim() }); }
            finally { setSaving(false); }
          }}
        >
          {saving ? "…" : tr("加入日曆", "Add to calendar", "カレンダーに追加", "캘린더에 추가")}
        </button>
      </div>
    </div>
  );
}
