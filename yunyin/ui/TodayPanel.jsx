// 今日頁：住客請求／行商訂單／每日小事集中在一處，分三個分頁。
import React, { useState } from "react";
import { BookOpen, Check, Coins, Flame, Gem, MapPin, Package, Sparkles, Droplets, Brush, Swords } from "lucide-react";
import { PLAYER_HOME_ID } from "../home/homeState";
import { CHORES, choreWorker } from "../home/homeResidents";
import { requestById, requestSatisfied } from "../home/residentRequests";
import { itemMeta } from "../systems/shop";
import { maxRunsOf } from "../systems/dungeon";
import { taiwanDayKey } from "../../utils/taiwanDayKey.js";
import { useYunyinLocale } from "../i18n/YunyinLocale.jsx";
import { claimResidentRequest, requestRewardText, todayPending } from "./dailyActions";

const C = { ink: "#4e3826", sub: "#8a7a6a", plum: "#7d5a6e", line: "#e0d2c0", card: "#fdf7ef", green: "#5f8f57", gold: "#e3b84f", dot: "#e5534b" };
const utcDay = () => new Date().toISOString().slice(0, 10);
const cardStyle = { border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, background: C.card };
const actionButton = (enabled) => ({
  minHeight: 44, minWidth: 84, border: 0, borderRadius: 12, padding: "0 14px", fontSize: 13, fontWeight: 800,
  background: enabled ? "linear-gradient(135deg,#7d5a6e,#9c7089)" : "#ece2d6", color: enabled ? "#fff" : C.sub,
  cursor: enabled ? "pointer" : "default",
});

function RequestTab({ save, characters, actions }) {
  const { yt, yv } = useYunyinLocale();
  const home = save.home?.homes?.[PLAYER_HOME_ID];
  const request = home?.request;
  const template = requestById(request?.templateId);
  if (!template) return <div style={{ ...cardStyle, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{yt(home?.residents?.length ? "today.noRequest" : "today.noResidents")}</div>;
  const speaker = characters.find((item) => item.id === request.characterId);
  const name = speaker?.name || yt("resident.guest");
  const ok = requestSatisfied(save, request);
  const avatar = speaker?.avatar || speaker?.avatarUrl;
  const where = template.kind === "item"
    ? yt("resident.itemRequest", { icon: itemMeta(template.itemId).icon, name: yv(itemMeta(template.itemId).name), count: template.count, owned: save.inventory[template.itemId] || 0 })
    : template.kind === "decor" ? yt("resident.decorRequest")
    : yt(`resident.activityRequest.${template.action}`, { name });
  return <div style={cardStyle}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {avatar
        ? <img src={avatar} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        : <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#f1dfe7", display: "grid", placeItems: "center", color: C.plum, fontWeight: 800, flexShrink: 0 }}>{name.slice(0, 1)}</div>}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: C.sub }}>{yt("today.requestFrom", { name })}</div>
        <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, lineHeight: 1.5 }}>「{yv(template.text)}」</div>
      </div>
    </div>
    {!request.done && <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "#fff", fontSize: 12, color: C.ink, lineHeight: 1.55 }}>
      <MapPin size={15} color={C.plum} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />{where}
    </div>}
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
      <span style={{ flex: 1, fontSize: 12, color: C.sub }}>{request.done ? yt("resident.completed") : yt("today.reward", { reward: requestRewardText(template) })}</span>
      {!request.done && <button type="button" disabled={!ok} style={actionButton(ok)} onClick={actions.claim}>{ok ? yt("resident.claim") : yt("today.notYet")}</button>}
    </div>
    {!request.done && <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>{yt("today.requestExpiry")}</div>}
  </div>;
}

// 訂單只顯示進度與還缺多少；交付仍要到丹房的行商訂單攤（決定保留跑一趟丹房的節奏）
function OrdersTab({ save }) {
  const { yt, yv } = useYunyinLocale();
  const orders = save.shop?.orders || [];
  if (!orders.length) return <div style={{ ...cardStyle, fontSize: 13, color: C.sub }}>{yt("shop.noOrders")}</div>;
  return <div style={{ display: "grid", gap: 8 }}>
    {orders.map((order) => {
      const meta = itemMeta(order.itemId);
      const have = save.inventory[order.itemId] || 0;
      const enough = have >= order.count;
      const tierKey = { "普通": "shop.tierNormal", "進階": "shop.tierAdvanced", "稀有": "shop.tierRare" }[order.tier];
      return <div key={order.id} style={{ ...cardStyle, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, opacity: order.done ? 0.55 : 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: C.ink, fontWeight: 700 }}>
            {tierKey && <span style={{ fontSize: 11, color: order.tier === "稀有" ? "#a8761a" : C.sub, marginRight: 6 }}>{yt(tierKey)}</span>}
            {meta.icon} {yv(meta.name)} {Math.min(have, order.count)}/{order.count}
          </div>
          {!order.done && <div style={{ height: 6, borderRadius: 6, background: "#eadfce", marginTop: 6 }}><div style={{ width: `${Math.min(100, (have / order.count) * 100)}%`, height: "100%", borderRadius: 6, background: enough ? C.green : C.gold }} /></div>}
          <div style={{ fontSize: 11, color: C.sub, marginTop: 4, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}><Coins size={12} color="#c79a2b" aria-hidden="true" />{order.rewardCoins}</span>
            <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}><Gem size={12} color="#6aa9d6" aria-hidden="true" />{order.rewardCrystals}</span>
            {order.rewardBlueprint && <span>{yt("shop.blueprintExtra")}</span>}
            {order.rewardMaterials && <span>{itemMeta(order.rewardMaterials.id).icon}×{order.rewardMaterials.n}</span>}
          </div>
        </div>
        <span style={{ flexShrink: 0, maxWidth: 96, textAlign: "right", fontSize: 12, fontWeight: 800, lineHeight: 1.35, color: order.done || enough ? C.green : C.sub }}>
          {order.done ? yt("shop.delivered") : enough ? yt("today.orderReady") : yt("today.orderMissing", { count: order.count - have })}
        </span>
      </div>;
    })}
    <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.5 }}>{yt("today.orderDeliverHint")}<br />{yt("today.orderHint")}</div>
  </div>;
}

function DailyTab({ save }) {
  const { yt } = useYunyinLocale();
  const homeState = save.home;
  const choreDays = homeState?.homes?.[PLAYER_HOME_ID]?.choreDays || {};
  const choreIcon = { water: Droplets, clean: Brush, furnace: Flame };
  const runsLeft = save.dungeon?.runsToday ?? 0;
  const rows = [
    { key: "meditate", Icon: Sparkles, title: yt("today.meditate"), done: save.hall?.lastMeditateDay === taiwanDayKey(), note: yt(save.hall?.lastMeditateDay === taiwanDayKey() ? "today.meditateDone" : "today.meditateTodo") },
    ...Object.values(CHORES).map((chore) => {
      const done = choreDays[chore.id] === utcDay();
      const worker = !done && choreWorker(homeState, chore.id);
      return { key: chore.id, Icon: choreIcon[chore.id], title: yt(`today.chore.${chore.id}`), done, note: yt(done ? "today.choreDone" : worker ? `today.choreWaiting.${chore.id}` : "today.choreNoHelper") };
    }),
    { key: "dungeon", Icon: Swords, title: yt("today.dungeon"), done: runsLeft <= 0, note: yt("dungeon.runsLeft", { remaining: runsLeft, max: maxRunsOf(save.cultivation) }) },
  ];
  return <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
    {rows.map(({ key, Icon, title, done, note }, index) => <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", minHeight: 48, boxSizing: "border-box", borderTop: index ? `1px solid ${C.line}` : 0 }}>
      <Icon size={18} color={done ? C.green : C.plum} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, color: C.ink, fontWeight: 700 }}>{title}</div><div style={{ fontSize: 11, color: C.sub, lineHeight: 1.45 }}>{note}</div></div>
      {done
        ? <span aria-label={yt("today.done")} style={{ width: 24, height: 24, borderRadius: 24, background: C.green, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}><Check size={15} aria-hidden="true" /></span>
        : <span aria-label={yt("today.todo")} style={{ width: 20, height: 20, borderRadius: 20, border: `2px solid ${C.line}`, flexShrink: 0 }} />}
    </div>)}
  </div>;
}

export default function TodayPanel({ save, characters = [], onDirty, onToast, onCrystals }) {
  const { yt, ym } = useYunyinLocale();
  const [tab, setTab] = useState("request");
  const [, setTick] = useState(0);
  const pending = todayPending(save);
  const refresh = () => setTick((value) => value + 1);
  const actions = {
    claim: () => { if (claimResidentRequest({ save, characters, yt, ym, onCrystals, onToast, onDirty })) refresh(); },
  };
  const tabs = [
    { id: "request", label: yt("today.tabRequest"), Icon: BookOpen, dot: pending.requestReady },
    { id: "orders", label: yt("today.tabOrders"), Icon: Package, dot: pending.deliverable },
    { id: "daily", label: yt("today.tabDaily"), Icon: Sparkles, dot: false },
  ];
  // 固定最小高度：三個分頁內容長短不同，面板置中時才不會在切換分頁時上下跳動
  return <div style={{ textAlign: "left", color: C.ink, minHeight: 360 }}>
    <div role="tablist" aria-label={yt("panel.today")} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, padding: 4, marginBottom: 12, borderRadius: 14, background: "#f1e7da" }}>
      {tabs.map(({ id, label, Icon, dot }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ position: "relative", minHeight: 44, border: 0, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 13, fontWeight: 800, background: tab === id ? "#fff" : "transparent", color: tab === id ? C.plum : C.sub, cursor: "pointer" }}>
        <Icon size={15} aria-hidden="true" />{label}
        {dot && <span aria-hidden="true" style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: 7, background: C.dot }} />}
      </button>)}
    </div>
    {tab === "request" ? <RequestTab save={save} characters={characters} actions={actions} />
      : tab === "orders" ? <OrdersTab save={save} />
      : <DailyTab save={save} />}
  </div>;
}
