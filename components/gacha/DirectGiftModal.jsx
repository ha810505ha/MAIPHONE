import React, { useMemo, useState } from "react";
import { useGacha } from "../../contexts/GachaContext";

export default function DirectGiftModal({ character, onClose, onStarted }) {
  const { inventory, startEpisode } = useGacha();
  const [selectedUid, setSelectedUid] = useState("");
  const [mode, setMode] = useState("reality");
  const gifts = useMemo(() => {
    const grouped = new Map();
    inventory.forEach((item) => {
      const existing = grouped.get(item.id);
      if (existing) existing.count += 1;
      else grouped.set(item.id, { ...item, count: 1 });
    });
    return [...grouped.values()];
  }, [inventory]);
  const selected = gifts.find((item) => item.uid === selectedUid);
  const confirmGift = () => {
    if (!selected || !character) return;
    const episode = startEpisode({ itemUid: selected.uid, characterId: character.id, characterName: character.name, characterAvatar: character.avatar, mode });
    if (episode) onStarted?.(episode);
  };
  return <div className="mp-overlay" onClick={onClose}>
    <style>{`
      .sg-direct-gift{width:90%;max-height:78%;padding:18px}.sg-direct-gift h3{margin:0 0 4px}.sg-direct-gift-sub{font-size:12px;color:var(--mp-txt-l);margin-bottom:14px}.sg-direct-gift-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-height:270px;overflow-y:auto;padding:2px}.sg-direct-gift-item{position:relative;min-width:0;border:1px solid color-mix(in srgb,var(--mp-pink) 28%,transparent);border-radius:14px;background:var(--mp-surface);color:var(--mp-txt);padding:10px;text-align:left}.sg-direct-gift-item.active{border-color:var(--mp-pink-dk);box-shadow:0 0 0 2px color-mix(in srgb,var(--mp-pink) 35%,transparent)}.sg-direct-gift-icon{display:grid;place-items:center;height:58px;font-size:31px;border-radius:10px;background:linear-gradient(145deg,#eee5f2,#f8dce6)}.sg-direct-gift-item b{display:block;margin-top:6px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-direct-gift-count{position:absolute;right:7px;top:7px;padding:3px 6px;border-radius:10px;background:#4f3d46;color:#fff;font-size:10px}.sg-direct-gift-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:13px 0}.sg-direct-gift-button{min-height:42px;border:1px solid #ead9df;border-radius:13px;background:#fff;color:#59464f;font-weight:800}.sg-direct-gift-button.active{border-color:#e979a1;background:#fbe8ef;color:#bd5378}.sg-direct-gift-confirm{width:100%;min-height:44px;border:0;border-radius:14px;background:linear-gradient(135deg,#ec8eae,#d95d87);color:#fff;font-weight:900}.sg-direct-gift-confirm:disabled{opacity:.4}.sg-direct-gift-empty{text-align:center;padding:35px 10px;color:var(--mp-txt-l)}
    `}</style>
    <div className="mp-modal sg-direct-gift" onClick={(event) => event.stopPropagation()}><h3>贈送心意給 {character?.name}</h3><div className="sg-direct-gift-sub">選擇一份「櫻色誓約」珍藏來開啟特別篇</div>
      {gifts.length ? <><div className="sg-direct-gift-list">{gifts.map((item) => <button key={item.id} className={`sg-direct-gift-item ${selectedUid === item.uid ? "active" : ""}`} onClick={() => setSelectedUid(item.uid)}><div className="sg-direct-gift-icon">{item.icon}</div>{item.count > 1 && <span className="sg-direct-gift-count">×{item.count}</span>}<b>{item.name}</b><small>{item.rarity}</small></button>)}</div><div className="sg-direct-gift-modes"><button className={`sg-direct-gift-button ${mode === "reality" ? "active" : ""}`} onClick={() => setMode("reality")}>親手送給他<br/><small>現實</small></button><button className={`sg-direct-gift-button ${mode === "online" ? "active" : ""}`} onClick={() => setMode("online")}>將禮物寄給他<br/><small>線上</small></button></div><button className="sg-direct-gift-confirm" disabled={!selectedUid} onClick={confirmGift}>確認並開啟特別篇</button></> : <div className="sg-direct-gift-empty">目前沒有可贈送的珍藏<br/><small>請先到遊戲中心的「櫻色誓約」召喚</small></div>}
    </div>
  </div>;
}
