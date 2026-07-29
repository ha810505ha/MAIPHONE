import React, { useState } from "react";
import { gid, sanitizeText } from "../../utils/coreUtils";
import { categoriesFor, findCategory, categoryLabel } from "../../constants/ledgerCategories";

// 生活記帳：玩家自己的真實收支，與劇情錢包（wallet.balance / wallet.transactions）完全隔離。
// 這裡的收支永遠不影響角色轉帳、商店等劇情扣款，只在錢包首頁的總資產做顯示層加總。
const DEFAULT_LIFE = { balance: 0, transactions: [], budget: 0 };
const dayKey = (time) => { const d = new Date(time); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const toDateInput = (time) => { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function LifeLedgerView({ wallet, setWallet, onBack, tr, formatMoney, showToast }) {
  const life = { ...DEFAULT_LIFE, ...(wallet?.life || {}) };
  // 記帳帳戶允許為負（流水必須加得起來，不能為了好看而截斷），所以負號要放在錢號前面。
  const money = (n) => `${n < 0 ? "-" : ""}$${formatMoney(Math.abs(n))}`;
  const [tab, setTab] = useState("ledger");
  const [entryOpen, setEntryOpen] = useState(false);
  const [type, setType] = useState("expense");
  const [amountStr, setAmountStr] = useState("");
  const [categoryId, setCategoryId] = useState("food");
  const [note, setNote] = useState("");
  const [dateStr, setDateStr] = useState(toDateInput(Date.now()));
  const [monthOffset, setMonthOffset] = useState(0);
  const [visible, setVisible] = useState(60);

  const setLife = (patch) => setWallet((w) => {
    const prev = { ...DEFAULT_LIFE, ...((w || {}).life || {}) };
    return { ...(w || {}), life: { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) } };
  });

  const txs = [...(life.transactions || [])].sort((a, b) => (b.time || 0) - (a.time || 0));
  const now = new Date();
  const mDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthTx = txs.filter((t) => { const d = new Date(t.time); return d.getFullYear() === mDate.getFullYear() && d.getMonth() === mDate.getMonth(); });
  const monthExpense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const monthIncome = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + (Number(t.amount) || 0), 0);

  // 預算條：本月剩餘可用 / 剩餘天數 = 每日可花，是記帳 App 最有感的一塊。
  const budget = Math.max(0, Number(life.budget) || 0);
  const budgetLeft = Math.max(0, budget - monthExpense);
  const budgetPct = budget ? Math.min(100, (monthExpense / budget) * 100) : 0;
  const daysInMonth = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
  const daysLeft = monthOffset === 0 ? Math.max(1, daysInMonth - now.getDate() + 1) : daysInMonth;

  const byCategory = Object.values(monthTx.filter((t) => t.type === "expense").reduce((out, t) => {
    const cat = findCategory(t.category, "expense");
    const cur = out[cat.id] || { cat, total: 0, count: 0 };
    cur.total += Number(t.amount) || 0; cur.count += 1; out[cat.id] = cur; return out;
  }, {})).sort((a, b) => b.total - a.total);

  const groups = txs.slice(0, visible).reduce((out, t) => {
    const key = dayKey(t.time);
    let g = out[out.length - 1];
    if (!g || g.key !== key) {
      const d = new Date(t.time);
      const label = key === dayKey(Date.now()) ? tr("今天", "Today", "今日", "오늘")
        : key === dayKey(Date.now() - 864e5) ? tr("昨天", "Yesterday", "昨日", "어제")
          : `${d.getMonth() + 1}/${d.getDate()}`;
      g = { key, label, items: [], total: 0 };
      out.push(g);
    }
    g.items.push(t);
    g.total += (t.type === "expense" ? -1 : 1) * (Number(t.amount) || 0);
    return out;
  }, []);

  const openEntry = (nextType) => {
    setType(nextType);
    setCategoryId(categoriesFor(nextType)[0].id);
    setAmountStr(""); setNote(""); setDateStr(toDateInput(Date.now()));
    setEntryOpen(true);
  };
  const tapKey = (k) => setAmountStr((s) => {
    if (k === "del") return s.slice(0, -1);
    if (k === "." ) return s.includes(".") || !s ? s : `${s}.`;
    if (s.includes(".") && s.split(".")[1].length >= 2) return s;
    return (s === "0" ? "" : s) + k;
  });
  const saveEntry = () => {
    const amount = Math.round((Number(amountStr) || 0) * 100) / 100;
    if (!amount || amount <= 0) { showToast?.(tr("請輸入金額", "Enter an amount", "金額を入力してください", "금액을 입력해주세요")); return; }
    // 手動指定日期時保留當下時分，讓同一天多筆仍有先後順序。
    const picked = new Date(`${dateStr}T00:00:00`);
    const time = Number.isNaN(picked.getTime()) ? Date.now()
      : picked.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    const tx = { id: gid(), type, amount, category: categoryId, note: sanitizeText(note, 40), time };
    setLife((prev) => ({
      balance: Math.round(((Number(prev.balance) || 0) + (type === "income" ? amount : -amount)) * 100) / 100,
      transactions: [tx, ...(prev.transactions || [])].slice(0, 2000),
    }));
    setEntryOpen(false);
  };
  const removeEntry = (tx) => {
    if (!window.confirm(tr("刪除這筆記帳？", "Delete this entry?", "この記録を削除しますか？", "이 기록을 삭제할까요?"))) return;
    setLife((prev) => ({
      balance: Math.round(((Number(prev.balance) || 0) + (tx.type === "income" ? -tx.amount : tx.amount)) * 100) / 100,
      transactions: (prev.transactions || []).filter((x) => x.id !== tx.id),
    }));
  };
  const editBudget = () => {
    const raw = window.prompt(tr("設定每月預算（0 表示不設）", "Monthly budget (0 to disable)", "月間予算（0で無効）", "월 예산 (0이면 해제)"), String(budget));
    if (raw === null) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    setLife({ budget: Math.max(0, Math.round(parsed)) });
  };
  const editBalance = () => {
    const raw = window.prompt(tr("設定生活帳戶餘額", "Set life account balance", "生活口座の残高を設定", "생활 계좌 잔액 설정"), String(life.balance || 0));
    if (raw === null) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    setLife({ balance: Math.round(parsed * 100) / 100 });
  };
  // 資料要能帶得走，玩家才敢認真記帳。
  const exportCsv = () => {
    if (!txs.length) { showToast?.(tr("還沒有記帳資料", "Nothing to export yet", "まだデータがありません", "아직 데이터가 없어요")); return; }
    const rows = [["date", "type", "category", "note", "amount"], ...txs.map((t) => [
      new Date(t.time).toISOString().slice(0, 10),
      t.type,
      categoryLabel(findCategory(t.category, t.type), tr),
      t.note || "",
      (t.type === "expense" ? -1 : 1) * Number(t.amount || 0),
    ])];
    const csv = `﻿${rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `ledger-${toDateInput(Date.now())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cats = categoriesFor(type);
  const maxCat = Math.max(1, ...byCategory.map((c) => c.total));

  return <div className="mp-page">
    <div className="mp-hdr">
      <div className="mp-back" onClick={onBack}>←</div>
      <div>
        <div className="mp-htitle">{tr("生活記帳", "Life ledger", "生活家計簿", "생활 가계부")}</div>
        <div className="mp-wallet-month-sub">{tr("我自己的收支", "My own spending", "自分の収支", "나의 수입·지출")}</div>
      </div>
      <button className="mp-ibtn" style={{ marginLeft: "auto" }} onClick={exportCsv} title="CSV">⬇</button>
    </div>
    <div className="mp-cm">
      <div className="mp-life-bank">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="mp-life-label">{tr("生活帳戶", "Life account", "生活口座", "생활 계좌")}</span>
          <button className="mp-bank-edit" onClick={editBalance}>✎ {tr("設定餘額", "Set balance", "残高設定", "잔액 설정")}</button>
        </div>
        <div className="mp-life-amt">{money(life.balance || 0)}</div>
        <div className="mp-life-sum">
          {mDate.getMonth() + 1}{tr("月", "", "月", "월")}・{tr("支出", "Spent", "支出", "지출")} ${formatMoney(monthExpense)} ・ {tr("收入", "Income", "収入", "수입")} ${formatMoney(monthIncome)}
        </div>
      </div>

      <div className="mp-life-budget" onClick={editBudget}>
        {budget ? <>
          <div className="mp-life-budget-top">
            <span>{tr("本月預算剩餘", "Budget left", "今月の残り予算", "이번 달 남은 예산")}</span>
            <b>${formatMoney(budgetLeft)}</b>
          </div>
          <div className="mp-wbar"><i className={budgetPct >= 100 ? "over" : ""} style={{ width: `${budgetPct}%` }} /></div>
          <div className="mp-life-budget-sub">
            ${formatMoney(budget)} {tr("中已用", "used", "のうち使用", "중 사용")} ${formatMoney(monthExpense)}
            {monthOffset === 0 ? ` · ${tr("剩", "", "残り", "남은")} ${daysLeft} ${tr("天，每天可花", "days left, per day", "日、1日あたり", "일, 하루")} $${formatMoney(Math.floor(budgetLeft / daysLeft))}` : ""}
          </div>
        </> : <div className="mp-life-budget-empty">＋ {tr("設定每月預算", "Set a monthly budget", "月間予算を設定", "월 예산 설정하기")}</div>}
      </div>

      <div className="mp-life-actions">
        <button className="mp-life-add expense" onClick={() => openEntry("expense")}>− {tr("記一筆支出", "Add expense", "支出を記録", "지출 기록")}</button>
        <button className="mp-life-add income" onClick={() => openEntry("income")}>＋ {tr("記一筆收入", "Add income", "収入を記録", "수입 기록")}</button>
      </div>

      <div className="mp-wtabs" style={{ margin: "11px 0 8px" }}>
        <button className={`mp-wtab ${tab === "ledger" ? "active" : ""}`} onClick={() => setTab("ledger")}>{tr("明細", "Entries", "明細", "내역")}</button>
        <button className={`mp-wtab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>{tr("統計", "Stats", "統計", "통계")}</button>
      </div>

      {tab === "stats" ? <div className="mp-wallet-month-body">
        <div className="mp-wmonth-nav">
          <button onClick={() => setMonthOffset((v) => v - 1)}>‹</button>
          <span>{mDate.getFullYear()} · {mDate.getMonth() + 1}{tr("月", "", "月", "월")}</span>
          <button disabled={monthOffset >= 0} onClick={() => setMonthOffset((v) => v + 1)}>›</button>
        </div>
        <div className="mp-wcard">
          <div className="mp-month-card-title">{tr("分類支出", "By category", "カテゴリ別支出", "분류별 지출")}</div>
          {byCategory.length ? byCategory.map(({ cat, total, count }) => <div className="mp-life-cat-row" key={cat.id}>
            <span className="mp-life-cat-ico" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mp-life-cat-top">
                <span>{categoryLabel(cat, tr)}<small> ×{count}</small></span>
                <b>${formatMoney(total)}</b>
              </div>
              <div className="mp-life-cat-bar"><i style={{ width: `${(total / maxCat) * 100}%`, background: cat.color }} /></div>
            </div>
            <span className="mp-life-cat-pct">{monthExpense ? Math.round((total / monthExpense) * 100) : 0}%</span>
          </div>) : <div className="mp-life-budget-empty">{tr("這個月還沒有支出", "No spending this month", "今月の支出はまだありません", "이번 달 지출이 없어요")}</div>}
        </div>
        <div className="mp-wcard">
          <div className="mp-month-card-title">{tr("本月結餘", "Net this month", "今月の収支", "이번 달 수지")}</div>
          <div className="mp-wcomp-row"><span>{tr("收入", "Income", "収入", "수입")}</span><b className="mp-month-in">${formatMoney(monthIncome)}</b></div>
          <div className="mp-wcomp-row" style={{ marginTop: 6 }}><span>{tr("支出", "Expense", "支出", "지출")}</span><b className="mp-month-out">${formatMoney(monthExpense)}</b></div>
          <div className="mp-wcomp-row" style={{ marginTop: 10, fontSize: 14 }}>
            <span>{tr("結餘", "Net", "収支", "수지")}</span>
            <b className={monthIncome - monthExpense >= 0 ? "mp-month-in" : "mp-month-out"}>{money(monthIncome - monthExpense)}</b>
          </div>
          {monthTx.length > 0 && <div className="mp-life-budget-sub" style={{ marginTop: 8 }}>
            {tr("日均支出", "Daily average", "1日平均支出", "일평균 지출")} ${formatMoney(Math.round(monthExpense / daysInMonth))}
          </div>}
        </div>
      </div> : (txs.length ? <>
        {groups.map((g) => <div key={g.key}>
          <div className="mp-wday">{g.label}<span className="mp-life-day-total">{g.total >= 0 ? "+" : "−"}{formatMoney(Math.abs(g.total))}</span></div>
          {g.items.map((t) => {
            const cat = findCategory(t.category, t.type);
            return <div key={t.id} className="mp-wrow" onDoubleClick={() => removeEntry(t)}>
              <div className="mp-wrow-av" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mp-wrow-note">{t.note || categoryLabel(cat, tr)}</div>
                <div className="mp-wrow-meta">{categoryLabel(cat, tr)} · {new Date(t.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <span className={`mp-wamt ${t.type === "expense" ? "out" : "in"}`}>{t.type === "expense" ? "-" : "+"}{formatMoney(t.amount)}</span>
              <button className="mp-wmem-btn" onClick={() => removeEntry(t)}>✕</button>
            </div>;
          })}
        </div>)}
        {visible < txs.length && <button className="mp-save" onClick={() => setVisible((v) => v + 60)}>{tr("載入更多", "Load more", "もっと見る", "더 보기")}</button>}
      </> : <div className="mp-empty">
        <div className="mp-empty-i">📒</div>
        <div className="mp-empty-t">{tr("還沒有記帳，從上面記第一筆吧", "No entries yet — add your first one above", "まだ記録がありません。上から最初の1件を", "아직 기록이 없어요. 위에서 첫 기록을 남겨보세요")}</div>
      </div>)}
    </div>

    {entryOpen && <div className="mp-life-sheet-wrap" onClick={() => setEntryOpen(false)}>
      <div className="mp-life-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mp-life-sheet-tabs">
          {["expense", "income"].map((k) => <button key={k} className={type === k ? "active" : ""}
            onClick={() => { setType(k); setCategoryId(categoriesFor(k)[0].id); }}>
            {k === "expense" ? tr("支出", "Expense", "支出", "지출") : tr("收入", "Income", "収入", "수입")}
          </button>)}
        </div>
        <div className={`mp-life-sheet-amt ${type}`}>{type === "expense" ? "−" : "+"} {amountStr || "0"}</div>
        <div className="mp-life-cats">
          {cats.map((c) => <button key={c.id} className={`mp-life-cat ${categoryId === c.id ? "active" : ""}`}
            style={categoryId === c.id ? { background: c.color, borderColor: c.color, color: "#fff" } : undefined}
            onClick={() => setCategoryId(c.id)}>
            <span>{c.emoji}</span><small>{categoryLabel(c, tr)}</small>
          </button>)}
        </div>
        <div className="mp-life-sheet-meta">
          <input className="mp-life-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={40}
            placeholder={tr("備註（選填）", "Note (optional)", "メモ（任意）", "메모 (선택)")} />
          <input className="mp-life-date" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
        </div>
        <div className="mp-life-keys">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map((k) => <button key={k} onClick={() => tapKey(k)}>{k}</button>)}
          <button onClick={() => tapKey("del")}>⌫</button>
        </div>
        <div className="mp-life-sheet-actions">
          <button className="mp-life-cancel" onClick={() => setEntryOpen(false)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
          <button className="mp-save" style={{ flex: 2 }} onClick={saveEntry}>{tr("儲存", "Save", "保存", "저장")}</button>
        </div>
      </div>
    </div>}
  </div>;
}
