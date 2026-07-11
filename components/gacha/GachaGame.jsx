import React, { useMemo, useState } from "react";
import { useGacha } from "../../contexts/GachaContext";
import GachaRevealSequence from "./GachaRevealSequence";

const colors = { SSR: ["#504160", "#f0bfd5"], SR: ["#a66f81", "#f5d2dc"], R: ["#74769c", "#dddff3"] };
export default function GachaGame({ characters = [], onBack, onOpenChat }) {
  const { inventory, crystals, draw, startEpisode } = useGacha();
  const [tab, setTab] = useState("summon");
  const [filter, setFilter] = useState("ALL");
  const [reveals, setReveals] = useState([]);
  const [gift, setGift] = useState(null);
  const [characterId, setCharacterId] = useState("");
  const [mode, setMode] = useState("reality");
  const groupedInventory = useMemo(() => {
    const groups = new Map();
    inventory.forEach((item) => {
      const existing = groups.get(item.id);
      if (existing) existing.count += 1;
      else groups.set(item.id, { ...item, count: 1 });
    });
    return [...groups.values()];
  }, [inventory]);
  const visible = useMemo(() => filter === "ALL" ? groupedInventory : groupedInventory.filter((item) => item.rarity === filter), [groupedInventory, filter]);
  const summon = (count) => {
    const cost = count === 10 ? 1800 : 180;
    if (crystals < cost || !confirm(`確定消耗 ${cost.toLocaleString()} 靈魂結晶進行召喚？`)) return;
    setReveals(draw(count) || []);
  };
  const confirmGift = () => {
    const character = characters.find((item) => String(item.id) === String(characterId));
    if (!gift || !character) return;
    startEpisode({ itemUid: gift.uid, characterId: character.id, characterName: character.name, characterAvatar: character.avatar, mode });
    setGift(null); onOpenChat?.();
  };
  return <div className="mp-page sg-game" style={{ background: "#fffaf8", color: "#4f3d46", overflowY: "auto" }}>
    <style>{`
      .sg-game button{font-family:inherit}.sg-button{width:auto;min-width:0;min-height:42px;height:auto;border:1px solid #ead9df;border-radius:14px;padding:9px 12px;display:flex;align-items:center;justify-content:center;background:#fff;color:#59464f;font-size:14px;font-weight:800;line-height:1.35;white-space:normal;cursor:pointer}.sg-button:active{transform:scale(.98)}.sg-button:disabled{opacity:.42}.sg-button-primary{background:linear-gradient(135deg,#70545f,#4d3d45);border-color:transparent;color:#fff}.sg-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 18px}.sg-tab-button{border:0;border-radius:12px;padding:10px;background:transparent;color:#9a858e;font-size:15px;font-weight:800;line-height:1.2}.sg-tab-button.active{background:#f8e7ed;color:#c85f83}.sg-draw-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.sg-draw-buttons .sg-button{min-height:62px}.sg-collection-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}.sg-collection-count{display:flex;flex-direction:column;gap:2px}.sg-collection-count small{color:#9c8991;font-weight:500}.sg-filter-row{display:flex;flex-wrap:nowrap;gap:3px}.sg-filter-button{border:0;background:transparent;color:inherit;border-radius:8px;padding:6px 8px;font-size:12px}.sg-filter-button.active{background:#57454e;color:#fff}.sg-card-art{position:relative}.sg-card-count{position:absolute;right:9px;top:9px;z-index:1;min-width:31px;padding:4px 7px;border-radius:14px;background:rgba(48,35,44,.82);border:1px solid rgba(255,255,255,.48);box-shadow:0 3px 10px rgba(0,0,0,.18);color:#fff;font-size:11px;font-weight:900;text-align:center;line-height:1}.sg-gift-modal h3{margin-top:2px;line-height:1.4}.sg-gift-modal .mp-inp{display:block;margin:10px 0 12px;min-height:44px;font-size:14px}.sg-gift-modes{display:grid;grid-template-columns:1fr;gap:8px;margin:12px 0}.sg-gift-confirm{width:100%;margin-top:14px}@media(max-width:360px){.sg-collection-head{align-items:flex-start;flex-direction:column}.sg-filter-row{align-self:stretch}.sg-filter-button{flex:1}.sg-tabs{padding-inline:12px}}
    `}</style>
    <div className="mp-hdr" style={{ position: "sticky", top: 0, zIndex: 3, background: "rgba(255,250,248,.94)" }}><div className="mp-back" onClick={onBack}>←</div><div className="mp-htitle">櫻色誓約</div><b style={{ marginLeft: "auto", fontSize: 12 }}>🌸 {crystals.toLocaleString()}</b></div>
    <div className="sg-tabs">{[["summon","心動召喚"],["collection","我的珍藏"]].map(([key,label]) => <button key={key} className={`sg-tab-button ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === "summon" ? <div style={{ padding: 20, textAlign: "center" }}>
      <div style={{ minHeight: 310, borderRadius: 28, padding: 30, display: "grid", placeItems: "center", background: "radial-gradient(circle at 50% 30%,#fff 0,#f8d8e3 32%,#71617c 100%)", boxShadow: "0 18px 40px rgba(87,54,70,.22)" }}><div><div style={{ fontSize: 70 }}>🌸</div><h1 style={{ fontFamily: "serif", margin: "10px 0" }}>櫻色誓約</h1><p>翻閱命運，收藏一份能送給他的心意</p></div></div>
      <div className="sg-draw-buttons"><button className="sg-button" disabled={crystals < 180} onClick={() => summon(1)}><span>單次思念<br/><small>180 結晶</small></span></button><button className="sg-button sg-button-primary" disabled={crystals < 1800} onClick={() => summon(10)}><span>十連守候<br/><small>1,800 結晶</small></span></button></div><small style={{ display: "block", marginTop: 16, opacity: .65 }}>SSR 6% · SR 24% · R 70%</small>
    </div> : <div style={{ padding: 18 }}>
      <div className="sg-collection-head"><div className="sg-collection-count"><b>已收藏 {inventory.length} 份</b><small>{groupedInventory.length} 種心意</small></div><div className="sg-filter-row">{["ALL","SSR","SR","R"].map((key) => <button key={key} className={`sg-filter-button ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>{key === "ALL" ? "全部" : key}</button>)}</div></div>
      {visible.length ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{visible.map((item) => { const palette = colors[item.rarity]; return <button key={item.id} onClick={() => { setGift(item); setCharacterId(""); }} style={{ border: 0, background: "transparent", color: "inherit", textAlign: "left", padding: 0 }}><div className="sg-card-art" style={{ aspectRatio: "3/4", borderRadius: 18, display: "grid", placeItems: "center", fontSize: 48, background: `linear-gradient(145deg,${palette[0]},${palette[1]})`, boxShadow: item.rarity === "SSR" ? "0 0 0 2px #d5b45b" : "0 6px 15px #6b4b5a33" }}>{item.count > 1 && <span className="sg-card-count">×{item.count}</span>}{item.icon}</div><b style={{ display: "block", marginTop: 7 }}>{item.name}</b><small>{item.rarity} · 點擊贈送</small></button>; })}</div> : <div className="mp-empty"><div className="mp-empty-i">🌸</div><div>尚未收藏任何心意</div></div>}
    </div>}
    {!!reveals.length && <GachaRevealSequence items={reveals} onClose={() => { setReveals([]); setTab("collection"); }} />}
    {gift && <div className="mp-overlay" onClick={() => setGift(null)}><div className="mp-modal sg-gift-modal" onClick={(event) => event.stopPropagation()}><h3>把「{gift.name}」送給誰？</h3><select className="mp-inp" value={characterId} onChange={(event) => setCharacterId(event.target.value)}><option value="">選擇角色</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select><div className="sg-gift-modes"><button className="sg-button" onClick={() => setMode("reality")} style={{ outline: mode === "reality" ? "2px solid #ef8eb0" : "none" }}>親手送給他（現實）</button><button className="sg-button" onClick={() => setMode("online")} style={{ outline: mode === "online" ? "2px solid #ef8eb0" : "none" }}>將禮物寄給他（線上）</button></div><small>確認後才會消耗這份珍藏，並建立特別篇房間。</small><button className="sg-button sg-button-primary sg-gift-confirm" disabled={!characterId} onClick={confirmGift}>確認並進入特別篇</button></div></div>}
  </div>;
}
