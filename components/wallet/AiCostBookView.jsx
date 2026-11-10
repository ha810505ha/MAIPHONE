import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader, SUB_PAGE_CLASS } from "../shell/LargeTitle";
import SegmentedControl from "../common/SegmentedControl";
import EmptyState from "../common/EmptyState";
import Icon from "../common/Icon";
import useDialogFocus from "../../hooks/ui/useDialogFocus";
import { normalizeUiLanguage } from "../../utils/i18n.js";
import OpenRouterCreditStatus from "../settings/OpenRouterCreditStatus";
import { FEATURE_DATA_CHANGED_EVENT, featureDataEventIncludes } from "../../services/featureDataLifecycle.js";
import {
  AI_USAGE_ENTITY_KEY,
  AI_USAGE_RETENTION_DAYS,
  createEmptyAiUsageLedger,
  monthKeyOf,
  normalizeModelKey,
  resolveEntryCost,
  sumAiUsageBetween,
  summarizeAiUsageMonth,
} from "../../services/aiUsage/aiUsageCore.js";
import { loadAiUsageLedger, updateAiUsageLedger } from "../../services/aiUsage/aiUsageStore.js";
import { isReferencePriceStale, refreshReferencePrices } from "../../services/aiUsage/aiUsagePricing.js";

// AI 花費本（MP-063）：錢包裡的第三本帳，只記 AI 呼叫的花費，跟劇情錢包、生活記帳互不扣抵。
const DAY_MS = 24 * 60 * 60 * 1000;
const ENTRY_PAGE = 60;

const appLabel = (tr, app, action) => {
  if (action === "proactive_reply") return tr("主動訊息", "Proactive messages", "自発メッセージ", "먼저 보내는 메시지");
  const labels = {
    chat: tr("聊天", "Chat", "チャット", "채팅"),
    social: tr("社群", "Social", "ソーシャル", "소셜"),
    yunyin: tr("雲隱山莊", "Cloudveil Villa", "雲隠山荘", "운은산장"),
    characters: tr("角色記憶與狀態", "Character memory & status", "キャラの記憶とステータス", "캐릭터 기억·상태"),
    couple: tr("情侶空間", "Couple Space", "カップルスペース", "커플 공간"),
    dating: tr("交友", "Dating", "マッチング", "데이팅"),
    gacha: tr("抽卡特別篇", "Gacha episodes", "ガチャのエピソード", "가챠 에피소드"),
    music: tr("一起聽歌", "Listen together", "一緒に聴く", "함께 듣기"),
    pet: tr("寵物小屋", "Pet house", "ペットハウス", "펫 하우스"),
    phone: tr("角色手機", "Character phone", "キャラのスマホ", "캐릭터 폰"),
    settings: tr("連線測試", "Connection test", "接続テスト", "연결 테스트"),
    wallet: tr("錢包", "Wallet", "ウォレット", "지갑"),
  };
  return labels[app] || tr("其他", "Other", "その他", "기타");
};

const sourceLabel = (tr, src) => ({
  actual: tr("實扣", "Charged", "実際の請求", "실제 청구"),
  estimate: tr("估算", "Estimated", "推定", "추정"),
  free: tr("免費", "Free", "無料", "무료"),
  points: tr("點數", "Points", "ポイント", "포인트"),
  unpriced: tr("未定價", "No price", "価格未設定", "가격 없음"),
  mixed: tr("混合", "Mixed", "混在", "혼합"),
}[src] || src);

const providerBadge = {
  openrouter: "OR", local: "L", claude: "C", gemini: "G", vertex: "V", openai: "AI", deepseek: "DS", grok: "X", mali: "M", ollama: "O", nvidia: "NV",
};

// 金額小於 1 美元時多留兩位，不然一個月幾分錢會全部顯示成 $0.00。
const usd = (value) => (value == null ? "—" : `$${Number(value).toFixed(Math.abs(Number(value)) < 1 && Number(value) !== 0 ? 4 : 2)}`);
const entryUsd = (value) => (value == null ? "—" : value === 0 ? "$0" : `$${Number(value).toFixed(value < 0.01 ? 4 : 3)}`);
const tok = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n || 0));
// 日期跟著介面語言，不跟作業系統語言（UI 巡檢第二輪 #10）。
const uiDateLocale = () => {
  const lang = normalizeUiLanguage(typeof document !== "undefined" ? document.documentElement.lang : "");
  return lang === "en" ? "en-US" : lang;
};
const startOfDay = (time) => { const d = new Date(time); d.setHours(0, 0, 0, 0); return d.getTime(); };
const startOfWeek = (time) => {
  const day = startOfDay(time);
  const weekday = (new Date(day).getDay() + 6) % 7;
  return day - weekday * DAY_MS;
};

function SourceTag({ tr, src }) {
  return <span className={`mp-aicost-tag ${src}`}>{sourceLabel(tr, src)}</span>;
}

function EntryDetail({ tr, entry, resolved, onClose }) {
  const dialogRef = useDialogFocus(true, onClose);
  const line = (label, value) => <div className="mp-aicost-detail-row"><span>{label}</span><b>{value}</b></div>;
  return <div className="mp-aicost-sheet-backdrop" role="presentation" data-back-dismiss onClick={onClose}>
    <div className="mp-aicost-sheet" role="dialog" aria-modal="true" aria-label={tr("花費明細", "Cost details", "費用の詳細", "비용 상세")} ref={dialogRef} onClick={(event) => event.stopPropagation()}>
      <div className="mp-aicost-sheet-top">
        <div>
          <b>{appLabel(tr, entry.app, entry.action)}</b>
          <small>{new Date(entry.t).toLocaleString(uiDateLocale(), { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small>
        </div>
        <div className="mp-aicost-sheet-amt">
          <b>{resolved.src === "points" ? `${entry.pts || 0} ${tr("點", "pts", "pt", "점")}` : entryUsd(resolved.cost)}</b>
          <SourceTag tr={tr} src={resolved.src} />
        </div>
      </div>
      {line(tr("模型", "Model", "モデル", "모델"), entry.model || "—")}
      {line(tr("輸入", "Input", "入力", "입력"), `${(entry.in || 0).toLocaleString()} tok`)}
      {entry.cr > 0 && line(tr("其中快取命中", "Cached input", "うちキャッシュ", "캐시 적중"), `${entry.cr.toLocaleString()} tok`)}
      {line(tr("輸出", "Output", "出力", "출력"), `${(entry.out || 0).toLocaleString()} tok`)}
      {entry.rs > 0 && line(tr("其中思考", "Reasoning", "うち思考", "추론"), `${entry.rs.toLocaleString()} tok`)}
      <p className="mp-aicost-note">
        {{
          actual: tr("實扣＝供應商回報的實際金額。", "Charged = the amount the provider reported.", "実際の請求＝プロバイダーが報告した金額です。", "실제 청구 = 제공자가 알려 준 실제 금액입니다."),
          estimate: tr("估算＝token 數 × 價目表，實際以供應商帳單為準。", "Estimated = tokens × price list. Your provider's bill is final.", "推定＝トークン数 × 価格表です。正確な金額はプロバイダーの請求をご確認ください。", "추정 = 토큰 수 × 가격표입니다. 정확한 금액은 제공자 청구서를 확인하세요."),
          free: tr("本機模型不收費。", "Local models are free.", "ローカルモデルは無料です。", "로컬 모델은 무료입니다."),
          points: tr("Mali 代管模型用點數計費。", "Hosted Mali models are billed in points.", "Mali のホストモデルはポイントで計算されます。", "Mali 호스팅 모델은 포인트로 계산됩니다."),
          unpriced: tr("找不到這個模型的價目，可以在設定自訂價目。", "No price found for this model. You can add one in settings.", "このモデルの価格が見つかりません。設定で追加できます。", "이 모델의 가격을 찾을 수 없어요. 설정에서 추가할 수 있어요."),
        }[resolved.src]}
        <br />{tr("不記錄 API Key、提示詞或對話內容。", "API keys, prompts and messages are never recorded.", "API キー、プロンプト、会話内容は記録しません。", "API 키, 프롬프트, 대화 내용은 기록하지 않아요.")}
      </p>
      <button type="button" className="mp-save mp-save--secondary" onClick={onClose}>{tr("關閉", "Close", "閉じる", "닫기")}</button>
    </div>
  </div>;
}

function CostSettings({ tr, ledger, onBack, showToast }) {
  const [form, setForm] = useState({ model: "", input: "", output: "", cacheRead: "" });
  const [refreshing, setRefreshing] = useState(false);
  const customs = Object.entries(ledger.customPrices || {});
  const refCount = Object.keys(ledger.referencePrices?.prices || {}).length;

  const toggle = () => updateAiUsageLedger((current) => ({ ...current, settings: { ...current.settings, enabled: !current.settings.enabled } })).catch(() => {});
  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshReferencePrices();
      showToast?.(tr("價目已更新", "Prices updated", "価格を更新しました", "가격을 업데이트했어요"));
    } catch {
      showToast?.(tr("價目更新失敗，請稍後再試", "Couldn't update prices. Try again later.", "価格を更新できませんでした。しばらくしてからお試しください。", "가격을 업데이트하지 못했어요. 잠시 후 다시 시도하세요."));
    } finally {
      setRefreshing(false);
    }
  };
  const addCustom = () => {
    const model = form.model.trim();
    const input = Number(form.input);
    const output = Number(form.output);
    const cacheRead = form.cacheRead === "" ? null : Number(form.cacheRead);
    if (!model || !Number.isFinite(input) || input < 0 || !Number.isFinite(output) || output < 0 || (cacheRead != null && (!Number.isFinite(cacheRead) || cacheRead < 0))) {
      showToast?.(tr("請填模型名稱與輸入／輸出價格", "Enter a model name and input/output prices", "モデル名と入力／出力の価格を入力してください", "모델 이름과 입력/출력 가격을 입력하세요"));
      return;
    }
    updateAiUsageLedger((current) => ({ ...current, customPrices: { ...current.customPrices, [model]: { input, output, ...(cacheRead == null ? {} : { cacheRead }) } } }))
      .then(() => setForm({ model: "", input: "", output: "", cacheRead: "" }))
      .catch(() => {});
  };
  const removeCustom = (model) => updateAiUsageLedger((current) => {
    const next = { ...current.customPrices };
    delete next[model];
    return { ...current, customPrices: next };
  }).catch(() => {});

  return <div className={SUB_PAGE_CLASS}>
    <AppHeader title={tr("花費本設定", "Cost book settings", "費用帳の設定", "비용 장부 설정")} onBack={onBack} backLabel={tr("返回花費本", "Back to cost book", "費用帳に戻る", "비용 장부로 돌아가기")} />
    <div className="mp-cm mp-aicost-settings">
      <div className="mp-wcard">
        <div className="mp-wcomp-row">
          <span>{tr("記錄 AI 花費", "Track AI spending", "AI の費用を記録", "AI 비용 기록")}</span>
          <button type="button" className={`mp-chip ${ledger.settings.enabled ? "active" : ""}`} aria-pressed={ledger.settings.enabled} onClick={toggle}>
            {ledger.settings.enabled ? tr("開啟", "On", "オン", "켜짐") : tr("關閉", "Off", "オフ", "꺼짐")}
          </button>
        </div>
        <p className="mp-aicost-note">{tr(`明細保留 ${AI_USAGE_RETENTION_DAYS} 天，之後只留每月合計。只記模型、功能、token 與金額，不記 API Key、提示詞或對話內容。`, `Details are kept for ${AI_USAGE_RETENTION_DAYS} days, then only monthly totals remain. Only the model, feature, tokens and cost are recorded — never API keys, prompts or messages.`, `明細は ${AI_USAGE_RETENTION_DAYS} 日間保存し、その後は月ごとの合計だけが残ります。記録するのはモデル、機能、トークン、金額のみで、API キー、プロンプト、会話内容は記録しません。`, `상세 내역은 ${AI_USAGE_RETENTION_DAYS}일 동안 보관하고, 이후에는 월별 합계만 남아요. 모델, 기능, 토큰, 금액만 기록하며 API 키, 프롬프트, 대화 내용은 기록하지 않아요.`)}</p>
      </div>

      <div className="mp-wcard">
        <div className="mp-month-card-title">{tr("參考價目", "Reference prices", "参考価格", "참고 가격")}</div>
        <p className="mp-aicost-note">{tr("Claude、OpenAI、Gemini 等官方 API 用 OpenRouter 公開的模型價目估算；OpenRouter 本身直接記實扣金額。", "Official APIs such as Claude, OpenAI and Gemini are estimated with OpenRouter's public model prices. OpenRouter calls record the actual charge.", "Claude、OpenAI、Gemini など公式 API の費用は OpenRouter が公開しているモデル価格で推定します。OpenRouter 経由の呼び出しは実際の請求額を記録します。", "Claude, OpenAI, Gemini 등 공식 API 비용은 OpenRouter가 공개한 모델 가격으로 추정해요. OpenRouter 호출은 실제 청구 금액을 기록해요.")}</p>
        <div className="mp-wcomp-row">
          <span>{refCount ? tr(`${refCount} 個模型・${new Date(ledger.referencePrices.updatedAt).toLocaleDateString(uiDateLocale())} 更新`, `${refCount} models · updated ${new Date(ledger.referencePrices.updatedAt).toLocaleDateString(uiDateLocale())}`, `${refCount} モデル・${new Date(ledger.referencePrices.updatedAt).toLocaleDateString(uiDateLocale())} 更新`, `${refCount}개 모델 · ${new Date(ledger.referencePrices.updatedAt).toLocaleDateString(uiDateLocale())} 업데이트`) : tr("尚未下載", "Not downloaded yet", "未取得", "아직 받지 않음")}</span>
          <button type="button" className="mp-chip" disabled={refreshing} onClick={refresh}>{refreshing ? tr("更新中…", "Updating…", "更新中…", "업데이트 중…") : tr("更新", "Update", "更新", "업데이트")}</button>
        </div>
      </div>

      <div className="mp-wcard">
        <div className="mp-month-card-title">{tr("自訂價目（美金／每百萬 token）", "Custom prices (USD per 1M tokens)", "カスタム価格（USD／100 万トークン）", "사용자 가격 (USD / 100만 토큰)")}</div>
        {customs.length ? customs.map(([model, price]) => <div key={model} className="mp-aicost-price-row">
          <span title={model}>{model}</span>
          <small>{tr("輸入", "In", "入力", "입력")} ${price.input} · {tr("輸出", "Out", "出力", "출력")} ${price.output}{price.cacheRead != null ? ` · ${tr("快取", "Cache", "キャッシュ", "캐시")} $${price.cacheRead}` : ""}</small>
          <button type="button" className="mp-chip" onClick={() => removeCustom(model)} aria-label={tr(`刪除 ${model} 的價目`, `Remove price for ${model}`, `${model} の価格を削除`, `${model} 가격 삭제`)}>{tr("刪除", "Remove", "削除", "삭제")}</button>
        </div>) : <p className="mp-aicost-note">{tr("自訂價目會優先於參考價目，適合沒有列在 OpenRouter 的模型。", "Custom prices override reference prices — handy for models not listed on OpenRouter.", "カスタム価格は参考価格より優先されます。OpenRouter にないモデルに便利です。", "사용자 가격은 참고 가격보다 우선해요. OpenRouter에 없는 모델에 유용해요.")}</p>}
        <div className="mp-aicost-form">
          <input className="mp-sinp" value={form.model} onChange={(event) => setForm((f) => ({ ...f, model: event.target.value }))} placeholder={tr("模型名稱（例：claude-sonnet-4-5）", "Model name (e.g. claude-sonnet-4-5)", "モデル名（例：claude-sonnet-4-5）", "모델 이름 (예: claude-sonnet-4-5)")} aria-label={tr("模型名稱", "Model name", "モデル名", "모델 이름")} />
          <div className="mp-aicost-form-row">
            <input className="mp-sinp" inputMode="decimal" value={form.input} onChange={(event) => setForm((f) => ({ ...f, input: event.target.value }))} placeholder={tr("輸入", "Input", "入力", "입력")} aria-label={tr("輸入價格", "Input price", "入力価格", "입력 가격")} />
            <input className="mp-sinp" inputMode="decimal" value={form.output} onChange={(event) => setForm((f) => ({ ...f, output: event.target.value }))} placeholder={tr("輸出", "Output", "出力", "출력")} aria-label={tr("輸出價格", "Output price", "出力価格", "출력 가격")} />
            <input className="mp-sinp" inputMode="decimal" value={form.cacheRead} onChange={(event) => setForm((f) => ({ ...f, cacheRead: event.target.value }))} placeholder={tr("快取（選填）", "Cache (opt.)", "キャッシュ（任意）", "캐시 (선택)")} aria-label={tr("快取命中價格", "Cached input price", "キャッシュ価格", "캐시 가격")} />
          </div>
          <button type="button" className="mp-save mp-save--secondary" onClick={addCustom}>＋ {tr("加入自訂價目", "Add custom price", "カスタム価格を追加", "사용자 가격 추가")}</button>
        </div>
      </div>
    </div>
  </div>;
}

export default function AiCostBookView({ tr, onBack, showToast, openRouterKey = "", openRouterKeyType = "key" }) {
  const [ledger, setLedger] = useState(createEmptyAiUsageLedger);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("entries");
  const [filter, setFilter] = useState("all");
  const [monthOffset, setMonthOffset] = useState(0);
  const [visible, setVisible] = useState(ENTRY_PAGE);
  const [picked, setPicked] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const reload = useCallback(() => {
    let alive = true;
    loadAiUsageLedger()
      .then((next) => { if (alive) { setLedger(next); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => reload(), [reload]);
  useEffect(() => {
    const onChanged = (event) => { if (featureDataEventIncludes(event, AI_USAGE_ENTITY_KEY)) reload(); };
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, onChanged);
  }, [reload]);
  // 參考價目超過一週才自動更新；失敗就沿用舊價目，不打擾玩家。
  useEffect(() => {
    if (loaded && isReferencePriceStale(ledger)) refreshReferencePrices().catch(() => {});
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const thisMonth = monthKeyOf(now);
  const monthSummary = useMemo(() => summarizeAiUsageMonth(ledger, thisMonth), [ledger, thisMonth]);
  const today = useMemo(() => sumAiUsageBetween(ledger, startOfDay(now), now + DAY_MS), [ledger, now]);
  const week = useMemo(() => sumAiUsageBetween(ledger, startOfWeek(now), now + DAY_MS), [ledger, now]);

  const statsMonthDate = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + monthOffset, 1);
  const statsSummary = useMemo(() => summarizeAiUsageMonth(ledger, monthKeyOf(statsMonthDate.getTime())), [ledger, monthOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedEntries = useMemo(() => [...ledger.entries].reverse().map((entry) => ({ entry, resolved: resolveEntryCost(entry, ledger) })), [ledger]);
  const filtered = filter === "all" ? resolvedEntries : resolvedEntries.filter(({ resolved }) => resolved.src === filter);
  const groups = useMemo(() => {
    const list = [];
    for (const item of filtered.slice(0, visible)) {
      const key = startOfDay(item.entry.t);
      let group = list[list.length - 1];
      if (!group || group.key !== key) {
        group = { key, items: [], total: 0 };
        list.push(group);
      }
      group.items.push(item);
      group.total += item.resolved.cost || 0;
    }
    return list;
  }, [filtered, visible]);
  const dayLabel = (key) => {
    if (key === startOfDay(now)) return tr("今天", "Today", "今日", "오늘");
    if (key === startOfDay(now) - DAY_MS) return tr("昨天", "Yesterday", "昨日", "어제");
    return new Date(key).toLocaleDateString(uiDateLocale(), { month: "numeric", day: "numeric", weekday: "short" });
  };

  if (settingsOpen) return <CostSettings tr={tr} ledger={ledger} onBack={() => setSettingsOpen(false)} showToast={showToast} />;

  const byApp = Object.entries(statsSummary.byApp).sort((a, b) => b[1] - a[1]);
  const maxApp = Math.max(0, ...byApp.map(([, value]) => value));
  const byModel = Object.entries(statsSummary.byModel).sort((a, b) => b[1].cost - a[1].cost);
  const maxModel = Math.max(0, ...byModel.map(([, value]) => value.cost));
  const monthLabel = (date) => tr(`${date.getFullYear()} · ${date.getMonth() + 1}月`, date.toLocaleDateString("en", { year: "numeric", month: "short" }), `${date.getFullYear()} · ${date.getMonth() + 1}月`, `${date.getFullYear()} · ${date.getMonth() + 1}월`);

  return <div className={SUB_PAGE_CLASS}>
    <AppHeader
      title={tr("AI 花費本", "AI cost book", "AI 費用帳", "AI 비용 장부")}
      subtitle={tr("每次叫 AI 花了多少", "What each AI call cost", "AI を呼ぶたびの費用", "AI 호출마다 든 비용")}
      onBack={onBack}
      backLabel={tr("返回錢包", "Back to Wallet", "ウォレットに戻る", "지갑으로 돌아가기")}
      right={<button type="button" className="mp-hdr-action" onClick={() => setSettingsOpen(true)}>{tr("設定", "Settings", "設定", "설정")}</button>}
    />
    <div className="mp-cm">
      <div className="mp-aicost-bank">
        <div className="mp-aicost-bank-top">
          <span>{tr(`${new Date(now).getMonth() + 1}月 AI 花費（USD）`, "AI spending this month (USD)", `${new Date(now).getMonth() + 1}月の AI 費用（USD）`, `${new Date(now).getMonth() + 1}월 AI 비용 (USD)`)}</span>
          <span>{tr("今日", "Today", "今日", "오늘")} {usd(today.cost)}・{tr("本週", "Week", "今週", "이번 주")} {usd(week.cost)}</span>
        </div>
        <div className="mp-aicost-bank-amt">{usd(monthSummary.cost)}</div>
        <div className="mp-aicost-bank-sum">
          {sourceLabel(tr, "actual")} {usd(monthSummary.actual)} ＋ {sourceLabel(tr, "estimate")} {usd(monthSummary.estimate)}・{tr(`共 ${monthSummary.calls} 次`, `${monthSummary.calls} calls`, `${monthSummary.calls} 回`, `${monthSummary.calls}회`)}
          {monthSummary.points > 0 && <>・{monthSummary.points} {tr("點", "pts", "pt", "점")}</>}
        </div>
        {!ledger.settings.enabled && <div className="mp-aicost-bank-sum">{tr("記帳已關閉，可在設定重新開啟。", "Tracking is off. Turn it on in settings.", "記録はオフです。設定でオンにできます。", "기록이 꺼져 있어요. 설정에서 켤 수 있어요.")}</div>}
      </div>

      {openRouterKey ? <OpenRouterCreditStatus apiKey={openRouterKey} tr={tr} type={openRouterKeyType} /> : null}

      <SegmentedControl className="mp-wallet-seg" ariaLabel={tr("花費本分頁", "Cost book tabs", "費用帳のタブ", "비용 장부 탭")} value={tab} onChange={setTab} items={[{ id: "entries", label: tr("明細", "Entries", "明細", "내역") }, { id: "stats", label: tr("統計", "Stats", "統計", "통계") }]} />

      {tab === "entries" ? <>
        <div className="mp-chip-row" style={{ marginBottom: 10 }}>
          {["all", "actual", "estimate", "free", "unpriced"].map((key) => <button key={key} type="button" className={`mp-chip ${filter === key ? "active" : ""}`} onClick={() => { setFilter(key); setVisible(ENTRY_PAGE); }}>
            {key === "all" ? tr("全部", "All", "すべて", "전체") : sourceLabel(tr, key)}
          </button>)}
        </div>
        {groups.length ? <>
          {groups.map((group) => <div key={group.key}>
            <div className="mp-wday">{dayLabel(group.key)}<span className="mp-life-day-total">{entryUsd(group.total)}</span></div>
            {group.items.map(({ entry, resolved }) => <button type="button" key={entry.id} className="mp-wrow mp-aicost-row" onClick={() => setPicked({ entry, resolved })}>
              <span className={`mp-wrow-av mp-aicost-provider ${entry.provider}`}>{providerBadge[entry.provider] || "AI"}</span>
              <span className="mp-aicost-row-main">
                <span className="mp-wrow-note">{appLabel(tr, entry.app, entry.action)}</span>
                <span className="mp-wrow-meta mp-aicost-ellipsis">{new Date(entry.t).toLocaleTimeString(uiDateLocale(), { hour: "2-digit", minute: "2-digit" })} · {entry.model || "—"}</span>
                {(entry.in > 0 || entry.out > 0) && <span className="mp-wrow-meta">{tr("輸入", "In", "入力", "입력")} {tok(entry.in)}{entry.cr ? ` (${tr("快取", "cache", "キャッシュ", "캐시")} ${tok(entry.cr)})` : ""} → {tr("輸出", "Out", "出力", "출력")} {tok(entry.out)}</span>}
              </span>
              <span className="mp-aicost-row-side">
                <span className="mp-wamt out">{resolved.src === "points" ? `${entry.pts || 0}${tr("點", "pt", "pt", "점")}` : entryUsd(resolved.cost)}</span>
                <SourceTag tr={tr} src={resolved.src} />
              </span>
            </button>)}
          </div>)}
          {visible < filtered.length && <button type="button" className="mp-save mp-save--secondary" onClick={() => setVisible((v) => v + ENTRY_PAGE)}>{tr("載入更多", "Load more", "もっと見る", "더 보기")}</button>}
        </> : <EmptyState compact icon="receipt" title={loaded ? tr("還沒有 AI 花費紀錄", "No AI spending yet", "AI の費用記録はまだありません", "아직 AI 비용 기록이 없어요") : tr("讀取中…", "Loading…", "読み込み中…", "불러오는 중…")} text={!loaded ? "" : ledger?.settings?.enabled === false
          ? tr("目前記帳已關閉，叫 AI 不會留下紀錄。可以在設定重新開啟。", "Tracking is off, so AI calls are not recorded. You can turn it back on in settings.", "現在記録はオフのため、AI を呼んでも記録されません。設定でオンに戻せます。", "지금은 기록이 꺼져 있어 AI를 불러도 기록되지 않아요. 설정에서 다시 켤 수 있어요.")
          : tr("之後每次叫 AI，都會記在這裡。", "Each AI call from now on will be recorded here.", "これから AI を呼ぶたびにここへ記録されます。", "앞으로 AI를 부를 때마다 여기에 기록돼요.")} />}
      </> : <div className="mp-wallet-month-body">
        <div className="mp-wmonth-nav">
          <button type="button" onClick={() => setMonthOffset((v) => v - 1)} aria-label={tr("上個月", "Previous month", "前の月", "이전 달")}>‹</button>
          <span>{monthLabel(statsMonthDate)}</span>
          <button type="button" disabled={monthOffset >= 0} onClick={() => setMonthOffset((v) => v + 1)} aria-label={tr("下個月", "Next month", "次の月", "다음 달")}>›</button>
        </div>
        <div className="mp-wcard">
          <div className="mp-month-card-title">{tr("本月合計", "Month total", "今月の合計", "이번 달 합계")}</div>
          <div className="mp-wcomp-row"><span>{tr("花費", "Spent", "費用", "비용")}</span><b>{usd(statsSummary.cost)}</b></div>
          <div className="mp-wcomp-row" style={{ marginTop: 6 }}><span>{sourceLabel(tr, "actual")} / {sourceLabel(tr, "estimate")}</span><b>{usd(statsSummary.actual)} / {usd(statsSummary.estimate)}</b></div>
          <div className="mp-wcomp-row" style={{ marginTop: 6 }}><span>{tr("呼叫次數", "Calls", "呼び出し回数", "호출 횟수")}</span><b>{statsSummary.calls}</b></div>
          {statsSummary.unpriced > 0 && <p className="mp-aicost-note">{tr(`有 ${statsSummary.unpriced} 次找不到價目，沒有算進金額；可在設定加自訂價目。`, `${statsSummary.unpriced} calls had no price and aren't included. Add a custom price in settings.`, `${statsSummary.unpriced} 回は価格が見つからず金額に含まれていません。設定でカスタム価格を追加できます。`, `${statsSummary.unpriced}회는 가격이 없어 금액에 포함되지 않았어요. 설정에서 사용자 가격을 추가할 수 있어요.`)}</p>}
        </div>
        <div className="mp-wcard">
          <div className="mp-month-card-title">{tr("依功能", "By feature", "機能別", "기능별")}</div>
          {byApp.length ? byApp.map(([app, value]) => <div className="mp-life-cat-row" key={app}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mp-life-cat-top"><span>{appLabel(tr, app)}</span><b>{usd(value)}</b></div>
              <div className="mp-life-cat-bar"><i className="mp-aicost-bar" style={{ width: `${maxApp ? (value / maxApp) * 100 : 0}%` }} /></div>
            </div>
            <span className="mp-life-cat-pct">{statsSummary.cost ? Math.round((value / statsSummary.cost) * 100) : 0}%</span>
          </div>) : <p className="mp-aicost-note">{tr("這個月沒有紀錄", "Nothing this month", "今月の記録はありません", "이번 달 기록이 없어요")}</p>}
        </div>
        <div className="mp-wcard">
          <div className="mp-month-card-title">{tr("依模型", "By model", "モデル別", "모델별")}</div>
          {byModel.length ? byModel.map(([key, value]) => {
            const model = key.split("|").slice(1).join("|") || "—";
            return <div className="mp-life-cat-row" key={key}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mp-life-cat-top"><span className="mp-aicost-ellipsis" title={model}>{normalizeModelKey(model) ? model : "—"} <SourceTag tr={tr} src={value.src} /></span><b>{usd(value.cost)}</b></div>
                <div className="mp-life-cat-bar"><i className="mp-aicost-bar" style={{ width: `${maxModel ? (value.cost / maxModel) * 100 : 0}%` }} /></div>
              </div>
            </div>;
          }) : <p className="mp-aicost-note">{tr("這個月沒有紀錄", "Nothing this month", "今月の記録はありません", "이번 달 기록이 없어요")}</p>}
        </div>
      </div>}
    </div>
    {picked && <EntryDetail tr={tr} entry={picked.entry} resolved={picked.resolved} onClose={() => setPicked(null)} />}
  </div>;
}

/** 錢包首頁的入口列（結晶列下方）：顯示本月與今日花費，點進花費本。 */
export function AiCostAccountButton({ tr, onOpen }) {
  const [ledger, setLedger] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    const reload = () => loadAiUsageLedger().then((next) => { if (alive) { setLedger(next); setNow(Date.now()); } }).catch(() => {});
    reload();
    const onChanged = (event) => { if (featureDataEventIncludes(event, AI_USAGE_ENTITY_KEY)) reload(); };
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, onChanged);
    return () => { alive = false; window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, onChanged); };
  }, []);
  const month = ledger ? summarizeAiUsageMonth(ledger, monthKeyOf(now)).cost : 0;
  const today = ledger ? sumAiUsageBetween(ledger, startOfDay(now), now + DAY_MS).cost : 0;
  return <button type="button" className="mp-crystal-account mp-aicost-account" onClick={onOpen}>
    <span className="mp-crystal-icon" aria-hidden="true"><Icon name="chip" size={20} /></span>
    <span className="mp-crystal-copy">
      <small>{tr(`AI 花費・${new Date(now).getMonth() + 1}月`, "AI spending · this month", `AI 費用・${new Date(now).getMonth() + 1}月`, `AI 비용 · ${new Date(now).getMonth() + 1}월`)}</small>
      <b>{usd(month)} <small className="mp-aicost-account-today">{tr("今日", "Today", "今日", "오늘")} {usd(today)}</small></b>
    </span>
    <span className="mp-crystal-link">{tr("花費本", "Cost book", "費用帳", "비용 장부")} ›</span>
  </button>;
}
