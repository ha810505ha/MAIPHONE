import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
import { parseIcs } from "../../services/calendar/icsParser";
import { fetchWithTimeout, isRequestCancelled, NETWORK_TIMEOUTS } from "../../utils/networkRequest.js";

const STORE_KEY = "ent_calendar";
const pad = (n) => String(n).padStart(2, "0");
const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const newId = () => `cal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const monthMatrix = (year, month) => {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => {
    const d = new Date(start);
    d.setDate(start.getDate() + week * 7 + day);
    return d;
  }));
};

// 日曆 App：本地事件＋ICS 匯入。事件可設定「角色可見」，
// 之後由聊天 prompt 注入管線取用（與約定清單共用，注入規則另行定案）。
export default function CalendarApp({ closeApp, tr }) {
  const [store, setStore] = useState(null); // {events: []}
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selected, setSelected] = useState(() => ymd(new Date()));
  const [modal, setModal] = useState(null); // "add" | "edit" | "import" | null
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", date: "", time: "", note: "", visibleToChar: true, characterReminderEnabled: false });
  const [icsText, setIcsText] = useState("");
  const [icsUrl, setIcsUrl] = useState("");
  const [icsVisible, setIcsVisible] = useState(false);
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [pickerYear, setPickerYear] = useState(null); // null = 收合；數字 = 選擇器顯示中的年份
  const icsRequestRef = useRef(null);

  useEffect(() => {
    loadFeatureEntity(STORE_KEY, null).then((saved) => setStore(saved && Array.isArray(saved.events) ? saved : { events: [] })).catch(() => setStore({ events: [] }));
  }, []);
  useEffect(() => () => icsRequestRef.current?.abort(), []);
  useEffect(() => {
    if (modal !== "import") icsRequestRef.current?.abort();
  }, [modal]);
  const saveStore = (next) => {
    setStore(next);
    saveFeatureEntity(STORE_KEY, next).catch(() => {});
    window.dispatchEvent(new CustomEvent("calendar-storage-updated", { detail: next }));
  };
  const events = store?.events || [];

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const event of events) {
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date).push(event);
    }
    for (const list of map.values()) list.sort((a, b) => (a.time || "99") < (b.time || "99") ? -1 : 1);
    return map;
  }, [events]);

  const todayKey = ymd(new Date());
  const weeks = monthMatrix(cursor.year, cursor.month);
  const dayEvents = eventsByDate.get(selected) || [];
  const importedCount = events.filter((e) => e.source === "ics").length;
  const weekdays = [
    tr("日", "Sun", "日", "일"), tr("一", "Mon", "月", "월"), tr("二", "Tue", "火", "화"),
    tr("三", "Wed", "水", "수"), tr("四", "Thu", "木", "목"), tr("五", "Fri", "金", "금"), tr("六", "Sat", "土", "토"),
  ];
  const monthLabel = (year, month) => tr(`${year} 年 ${month} 月`, `${month}/${year}`, `${year}年${month}月`, `${year}년 ${month}월`);
  const dateLabel = (month, day) => tr(`${month} 月 ${day} 日`, `${month}/${day}`, `${month}月${day}日`, `${month}월 ${day}일`);

  const shiftMonth = (delta) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const resetForm = () => { setForm({ title: "", date: "", time: "", note: "", visibleToChar: true, characterReminderEnabled: false }); setEditingId(null); setModal(null); };
  const submitEvent = () => {
    const title = form.title.trim();
    if (!title) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? form.date : selected;
    const payload = { title: title.slice(0, 60), date, time: form.time || "", note: form.note.trim().slice(0, 140), visibleToChar: !!form.visibleToChar, characterReminderEnabled: !!form.characterReminderEnabled };
    if (editingId) {
      saveStore({ ...store, events: events.map((e) => e.id !== editingId ? e : { ...e, ...payload, updatedAt: Date.now() }) });
      setSelected(date);
    } else {
      saveStore({ ...store, events: [...events, { id: newId(), ...payload, source: "local", createdAt: Date.now() }] });
    }
    resetForm();
  };
  const startEdit = (event) => {
    setForm({ title: event.title, date: event.date, time: event.time || "", note: event.note || "", visibleToChar: !!event.visibleToChar, characterReminderEnabled: !!event.characterReminderEnabled });
    setEditingId(event.id);
    setModal("edit");
  };

  const importEvents = (parsed) => {
    if (!parsed.length) { setNotice(tr("沒有解析到任何事件，請確認是 .ics 內容", "No events were found. Please check the .ics content.", "イベントを解析できませんでした。.icsの内容を確認してください。", "일정을 찾지 못했습니다. .ics 내용을 확인하세요.")); return; }
    const capped = parsed.slice(0, 500);
    const imported = capped.map((e) => ({ id: newId(), title: e.title, date: e.date, time: e.time || "", note: e.note || "", recurring: !!e.recurring, visibleToChar: icsVisible, characterReminderEnabled: false, source: "ics", createdAt: Date.now() }));
    saveStore({ ...store, events: [...events, ...imported] });
    const recurringCount = capped.filter((e) => e.recurring).length;
    setNotice(tr(
      `已匯入 ${imported.length} 筆事件${parsed.length > 500 ? "（超過 500 筆已截斷）" : ""}${recurringCount ? `；${recurringCount} 筆為重複性事件，目前只收錄首次日期` : ""}`,
      `Imported ${imported.length} events${parsed.length > 500 ? " (limited to the first 500)" : ""}${recurringCount ? `; ${recurringCount} recurring events were added using only their first date` : ""}`,
      `${imported.length}件のイベントを読み込みました${parsed.length > 500 ? "（500件を超える分は省略）" : ""}${recurringCount ? `。${recurringCount}件の繰り返しイベントは初回の日付のみ登録しました` : ""}`,
      `일정 ${imported.length}개를 가져왔습니다${parsed.length > 500 ? "(500개를 초과한 항목은 제외)" : ""}${recurringCount ? `; 반복 일정 ${recurringCount}개는 첫 날짜만 등록했습니다` : ""}`
    ));
    setIcsText("");
    setIcsUrl("");
    setModal(null);
  };

  const importFromUrl = async () => {
    const url = icsUrl.trim();
    if (!url || importing) return;
    icsRequestRef.current?.abort();
    const controller = new AbortController();
    icsRequestRef.current = controller;
    setImporting(true);
    setNotice("");
    try {
      const response = await fetchWithTimeout(
        url.replace(/^webcal:\/\//i, "https://"),
        {},
        { signal: controller.signal, timeoutMs: NETWORK_TIMEOUTS.METADATA },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      importEvents(parseIcs(await response.text()));
    } catch (error) {
      if (isRequestCancelled(error)) return;
      setNotice(tr(
        "網址讀取失敗（可能是跨網域限制）。請改用「匯出 .ics 檔案」後貼上內容或選擇檔案。",
        "The URL could not be read, possibly due to cross-origin restrictions. Export an .ics file, then paste its contents or select the file.",
        "URLを読み込めませんでした（クロスオリジン制限の可能性があります）。.icsを書き出し、内容を貼り付けるかファイルを選択してください。",
        "URL을 읽지 못했습니다(교차 출처 제한일 수 있음). .ics 파일을 내보낸 뒤 내용을 붙여넣거나 파일을 선택하세요."
      ));
    } finally {
      if (icsRequestRef.current === controller) {
        icsRequestRef.current = null;
        setImporting(false);
      }
    }
  };

  const onPickFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importEvents(parseIcs(String(reader.result || "")));
    reader.readAsText(file);
    event.target.value = "";
  };

  const removeEvent = (id) => saveStore({ ...store, events: events.filter((e) => e.id !== id) });
  const toggleVisible = (id) => saveStore({ ...store, events: events.map((e) => e.id !== id ? e : { ...e, visibleToChar: !e.visibleToChar }) });
  const clearImported = () => {
    if (!window.confirm(tr(
      `確定要清除全部 ${importedCount} 筆匯入的事件嗎？手動新增的事件會保留。`,
      `Clear all ${importedCount} imported events? Manually created events will be kept.`,
      `読み込んだ${importedCount}件のイベントをすべて消去しますか？手動で作成したイベントは残ります。`,
      `가져온 일정 ${importedCount}개를 모두 지울까요? 직접 만든 일정은 유지됩니다.`
    ))) return;
    saveStore({ ...store, events: events.filter((e) => e.source !== "ics") });
  };

  const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid var(--mp-card-border)", borderRadius: 12, background: "var(--mp-card-bg)", padding: "9px 12px", fontSize: 12, color: "var(--mp-txt)", outline: "none" };

  return (
    <div className="mp-page calendar-app-page" style={{ "--calendar-accent": "var(--mp-accent)", "--calendar-muted": "var(--mp-muted)", background: "var(--mp-page-bg)" }}>
      <div className="mp-hdr" style={{ background: "transparent" }}>
        <div className="mp-back" onClick={closeApp}>←</div>
        <div className="mp-htitle">🗓️ {tr("日曆", "Calendar", "カレンダー", "달력")}</div>
        <button type="button" onClick={() => { setNotice(""); setModal("import"); }}
          className="calendar-import-button" style={{ marginLeft: "auto", border: "1px solid var(--mp-card-border)", borderRadius: 99, background: "var(--mp-glass)", color: "var(--mp-txt)", fontSize: 9.5, fontWeight: 800, padding: "5px 10px" }}>⇪ {tr("匯入 ICS", "Import ICS", "ICSを読み込む", "ICS 가져오기")}</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 14px 24px" }}>

        {/* 月份導航：點標題展開年月選擇器 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "6px 0 10px" }}>
          <button type="button" onClick={() => shiftMonth(-1)} style={{ border: 0, background: "transparent", fontSize: 16, color: "var(--calendar-accent)" }}>‹</button>
          <button type="button" onClick={() => setPickerYear(pickerYear === null ? cursor.year : null)}
            style={{ border: 0, background: pickerYear !== null ? "var(--mp-glass)" : "transparent", borderRadius: 10, padding: "3px 10px", fontSize: 14, fontWeight: 900, color: "var(--mp-txt)" }}>
            {monthLabel(cursor.year, cursor.month + 1)} <span style={{ fontSize: 9, color: "var(--calendar-muted)" }}>{pickerYear !== null ? "▲" : "▼"}</span>
          </button>
          <button type="button" onClick={() => shiftMonth(1)} style={{ border: 0, background: "transparent", fontSize: 16, color: "var(--calendar-accent)" }}>›</button>
        </div>

        {/* 年月選擇器 */}
        {pickerYear !== null && (
          <div className="calendar-picker" style={{ background: "var(--mp-card-bg)", border: "1px solid var(--mp-card-border)", borderRadius: 18, padding: "10px 12px 12px", marginBottom: 10, boxShadow: "var(--mp-shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, paddingBottom: 8 }}>
              <button type="button" onClick={() => setPickerYear(pickerYear - 1)} style={{ border: 0, background: "transparent", fontSize: 15, color: "var(--calendar-accent)" }}>‹</button>
              <span style={{ fontSize: 13, fontWeight: 900, color: "var(--mp-txt)" }}>{tr(`${pickerYear} 年`, `${pickerYear}`, `${pickerYear}年`, `${pickerYear}년`)}</span>
              <button type="button" onClick={() => setPickerYear(pickerYear + 1)} style={{ border: 0, background: "transparent", fontSize: 15, color: "var(--calendar-accent)" }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
              {Array.from({ length: 12 }, (_, m) => {
                const isCurrent = pickerYear === cursor.year && m === cursor.month;
                const now = new Date();
                const isThisMonth = pickerYear === now.getFullYear() && m === now.getMonth();
                return (
                  <button key={m} type="button" onClick={() => { setCursor({ year: pickerYear, month: m }); setPickerYear(null); }}
                    style={{ border: isThisMonth && !isCurrent ? "1.5px solid var(--calendar-accent)" : "1.5px solid transparent", borderRadius: 11, padding: "8px 0", fontSize: 11.5, fontWeight: 800,
                      color: isCurrent ? "var(--mp-on-accent)" : "var(--mp-txt)", background: isCurrent ? "linear-gradient(135deg,var(--mp-bubble),var(--calendar-accent))" : "var(--mp-glass)" }}>
                    {tr(`${m + 1} 月`, `${m + 1}`, `${m + 1}月`, `${m + 1}월`)}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); setSelected(ymd(d)); setPickerYear(null); }}
              style={{ display: "block", margin: "9px auto 0", border: 0, borderRadius: 99, background: "color-mix(in srgb,var(--calendar-accent) 12%,transparent)", color: "var(--calendar-accent)", fontSize: 10, fontWeight: 800, padding: "5px 14px" }}>{tr("回到今天", "Today", "今日に戻る", "오늘로 돌아가기")}</button>
          </div>
        )}

        {/* 月曆格 */}
        <div className="calendar-grid" style={{ background: "var(--mp-card-bg)", border: "1px solid var(--mp-card-border)", borderRadius: 18, padding: "10px 8px 8px", boxShadow: "var(--mp-shadow)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", textAlign: "center", fontSize: 9.5, fontWeight: 800, color: "var(--calendar-muted)", paddingBottom: 5 }}>
            {weekdays.map((w, index) => <span key={`${index}-${w}`}>{w}</span>)}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
              {week.map((day) => {
                const key = ymd(day);
                const inMonth = day.getMonth() === cursor.month;
                const isToday = key === todayKey;
                const isSelected = key === selected;
                const list = eventsByDate.get(key);
                const hasVisible = list?.some((e) => e.visibleToChar);
                return (
                  <button key={key} type="button" onClick={() => { setSelected(key); if (!inMonth) setCursor({ year: day.getFullYear(), month: day.getMonth() }); }}
                    style={{ border: 0, background: isSelected ? "linear-gradient(135deg,var(--mp-bubble),var(--calendar-accent))" : "transparent", borderRadius: 11, padding: "6px 0 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, opacity: inMonth ? 1 : .35 }}>
                    <span style={{ fontSize: 12, fontWeight: isToday || isSelected ? 900 : 600, color: isSelected ? "var(--mp-on-accent)" : isToday ? "var(--calendar-accent)" : "var(--mp-txt)", width: 20, lineHeight: "20px", borderRadius: "50%", border: isToday && !isSelected ? "1.5px solid var(--calendar-accent)" : "1.5px solid transparent" }}>{day.getDate()}</span>
                    <span style={{ height: 5, display: "flex", gap: 2 }}>
                      {list?.length ? <span style={{ width: 5, height: 5, borderRadius: "50%", background: isSelected ? "var(--mp-on-accent)" : hasVisible ? "var(--calendar-accent)" : "var(--calendar-muted)" }} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* 當日事件 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 2px 8px" }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "var(--mp-txt)" }}>{dateLabel(Number(selected.slice(5, 7)), Number(selected.slice(8, 10)))}</span>
          <span style={{ fontSize: 9, color: "var(--calendar-muted)" }}>🩷 {tr("角色可見", "Visible to characters", "キャラに表示", "캐릭터에게 공개")} · 🔒 {tr("僅自己可見", "Private", "自分のみ", "나만 보기")}</span>
          <button type="button" onClick={() => { setForm({ title: "", date: selected, time: "", note: "", visibleToChar: true, characterReminderEnabled: false }); setEditingId(null); setModal("add"); }}
            className="calendar-add-button" style={{ marginLeft: "auto", border: 0, borderRadius: 99, background: "linear-gradient(135deg,var(--mp-bubble),var(--calendar-accent))", color: "var(--mp-on-accent)", fontSize: 10, fontWeight: 800, padding: "5px 12px", boxShadow: "var(--mp-shadow)" }}>＋ {tr("新增", "Add", "追加", "추가")}</button>
        </div>
        {dayEvents.length === 0
          ? <div style={{ textAlign: "center", fontSize: 11, color: "var(--calendar-muted)", padding: "16px 0" }}>{tr("這天還沒有安排", "Nothing scheduled for this day", "この日の予定はありません", "이날 예정이 없습니다")}</div>
          : dayEvents.map((event) => (
            <div key={event.id} className="calendar-event-card" style={{ background: "var(--mp-card-bg)", border: "1px solid var(--mp-card-border)", borderLeft: `3px solid ${event.visibleToChar ? "var(--calendar-accent)" : "var(--calendar-muted)"}`, borderRadius: 14, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 9 }}>
              <button type="button" onClick={() => startEdit(event)} style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", padding: 0, textAlign: "left" }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--mp-txt)" }}>{event.time && <span style={{ color: "var(--calendar-accent)", marginRight: 6 }}>{event.time}</span>}{event.title}{event.recurring ? " ↻" : ""}</div>
                {event.note && <div style={{ fontSize: 10, color: "var(--calendar-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.note}</div>}
                <div style={{ fontSize: 8.5, color: "var(--calendar-muted)", marginTop: 3 }}>{event.source === "ics" ? tr("匯入", "Imported", "読み込み", "가져옴") : tr("手動", "Manual", "手動", "직접 입력")} · {tr("點擊編輯", "Tap to edit", "タップして編集", "눌러서 편집")}</div>
              </button>
              <button type="button" title={event.visibleToChar ? tr("角色看得到（點擊改為私人）", "Visible to characters (tap to make private)", "キャラに表示（タップで非公開）", "캐릭터에게 공개(눌러서 비공개)") : tr("只有你看得到（點擊開放給角色）", "Private (tap to share with characters)", "自分のみ（タップでキャラに公開）", "나만 보기(눌러서 캐릭터에게 공개)")} onClick={() => toggleVisible(event.id)}
                style={{ border: 0, background: "transparent", fontSize: 15 }}>{event.visibleToChar ? "🩷" : "🔒"}</button>
              <button type="button" onClick={() => removeEvent(event.id)} style={{ border: 0, background: "transparent", fontSize: 12, color: "#c48ba0" }}>✕</button>
            </div>
          ))}
        {importedCount > 0 && <button type="button" onClick={clearImported} style={{ display: "block", margin: "14px auto 0", border: 0, background: "transparent", color: "#b58a9c", fontSize: 10, textDecoration: "underline" }}>{tr(`清除全部匯入事件（${importedCount} 筆）`, `Clear all imported events (${importedCount})`, `読み込んだイベントをすべて消去（${importedCount}件）`, `가져온 일정 모두 지우기(${importedCount}개)`)}</button>}
        {notice && <div style={{ textAlign: "center", fontSize: 10.5, color: "#a2652f", marginTop: 10, lineHeight: 1.7 }}>{notice}</div>}
      </div>

      {/* 新增／編輯事件 */}
      {(modal === "add" || modal === "edit") && (
        <div className="mp-overlay" onClick={resetForm}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-t">{modal === "edit" ? tr("編輯事件", "Edit event", "イベントを編集", "일정 편집") : tr(`新增事件 · ${selected}`, `Add event · ${selected}`, `イベントを追加・${selected}`, `일정 추가 · ${selected}`)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 10 }}>
              <input style={inputStyle} placeholder={tr("標題（必填）", "Title (required)", "タイトル（必須）", "제목(필수)")} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1.4 }} type="date" value={form.date || selected} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                <input style={{ ...inputStyle, flex: 1 }} type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
              </div>
              <input style={inputStyle} placeholder={tr("備註（選填）", "Note (optional)", "メモ（任意）", "메모(선택)")} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "#6d4658" }}>
                <input type="checkbox" checked={form.visibleToChar} onChange={(e) => setForm((f) => ({ ...f, visibleToChar: e.target.checked }))} />
                🩷 {tr("讓角色看得到這個行程（角色可能會提起或提醒你）", "Let characters see this event (they may mention it or remind you)", "この予定をキャラに表示する（話題にしたり、知らせてくれることがあります）", "캐릭터에게 이 일정을 공개합니다(언급하거나 알려줄 수 있음)")}
              </label>
            </div>
              <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 11.5, color: "#6d4658", opacity: form.visibleToChar && form.time ? 1 : 0.55 }}>
                <input
                  type="checkbox"
                  checked={form.characterReminderEnabled}
                  disabled={!form.visibleToChar || !form.time}
                  onChange={(e) => setForm((f) => ({ ...f, characterReminderEnabled: e.target.checked }))}
                />
                {tr("到時間附近讓角色自然關心", "Let characters naturally check in around the event time", "予定時刻の前後にキャラが自然に気にかける", "일정 시간 전후에 캐릭터가 자연스럽게 관심을 보이게 하기")}
              </label>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={resetForm}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
              <button className="mp-save" style={{ flex: 1 }} disabled={!form.title.trim()} onClick={submitEvent}>{modal === "edit" ? tr("儲存", "Save", "保存", "저장") : tr("新增", "Add", "追加", "추가")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ICS 匯入 */}
      {modal === "import" && (
        <div className="mp-overlay" onClick={() => setModal(null)}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-t">{tr("匯入行事曆（.ics）", "Import calendar (.ics)", "カレンダーを読み込む（.ics）", "캘린더 가져오기(.ics)")}</div>
            <div style={{ fontSize: 10.5, color: "#8a6478", lineHeight: 1.7, marginTop: 6 }}>{tr("Google 日曆／Apple 行事曆都能匯出 .ics 檔。可以選擇檔案、貼上內容，或貼訂閱網址。", "Google Calendar and Apple Calendar can export .ics files. Select a file, paste its contents, or enter a subscription URL.", "Googleカレンダー／Appleカレンダーは.icsを書き出せます。ファイル選択、内容の貼り付け、購読URLの入力に対応しています。", "Google 캘린더와 Apple 캘린더에서 .ics 파일을 내보낼 수 있습니다. 파일 선택, 내용 붙여넣기 또는 구독 URL 입력을 지원합니다.")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 10 }}>
              <label style={{ ...inputStyle, textAlign: "center", cursor: "pointer", fontWeight: 800 }}>
                📂 {tr("選擇 .ics 檔案", "Choose an .ics file", ".icsファイルを選択", ".ics 파일 선택")}
                <input type="file" accept=".ics,text/calendar" style={{ display: "none" }} onChange={onPickFile} />
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder={tr("或貼上訂閱網址（webcal:// 或 https://…ics）", "Or paste a subscription URL (webcal:// or https://…ics)", "または購読URLを貼り付け（webcal:// または https://…ics）", "또는 구독 URL 붙여넣기(webcal:// 또는 https://…ics)")} value={icsUrl} onChange={(e) => setIcsUrl(e.target.value)} />
                <button className="mp-save" style={{ padding: "0 14px" }} disabled={!icsUrl.trim() || importing} onClick={importFromUrl}>{importing ? "…" : tr("讀取", "Load", "読み込む", "불러오기")}</button>
              </div>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder={tr("或直接貼上 .ics 檔的文字內容", "Or paste the text content of an .ics file", "または.icsファイルの内容を直接貼り付け", "또는 .ics 파일의 텍스트 내용을 직접 붙여넣기")} value={icsText} onChange={(e) => setIcsText(e.target.value)} />
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "#6d4658" }}>
                <input type="checkbox" checked={icsVisible} onChange={(e) => setIcsVisible(e.target.checked)} />
                🩷 {tr("匯入的事件讓角色看得到（預設關閉，保護隱私）", "Let characters see imported events (off by default for privacy)", "読み込んだイベントをキャラに表示（プライバシー保護のため初期設定はオフ）", "가져온 일정을 캐릭터에게 공개(개인정보 보호를 위해 기본값은 꺼짐)")}
              </label>
            </div>
            {notice && <div style={{ fontSize: 10.5, color: "#a2652f", marginTop: 8, lineHeight: 1.6 }}>{notice}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={() => setModal(null)}>{tr("關閉", "Close", "閉じる", "닫기")}</button>
              <button className="mp-save" style={{ flex: 1 }} disabled={!icsText.trim()} onClick={() => importEvents(parseIcs(icsText))}>{tr("匯入貼上的內容", "Import pasted content", "貼り付けた内容を読み込む", "붙여넣은 내용 가져오기")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
