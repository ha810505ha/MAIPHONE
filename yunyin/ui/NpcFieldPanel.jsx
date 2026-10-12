// 住客角色田（MP-030）：走進田裡點作物格才有幫忙／偷菜（成長中只能幫忙；成熟後擇一，兩個都要二次確認）；
// 點圍欄或木牌打開時只看資訊，提示要走進田裡。
import React, { useState } from "react";
import { Droplets, Hand, Sprout } from "lucide-react";
import { cropById } from "../systems/farm";
import {
  actedToday, claimNpcFieldReward, helpNpcField, npcFieldProgress, npcFieldRemainMin, npcFieldStage, stealNpcField,
} from "../systems/npcFields.js";
import { useYunyinLocale } from "../i18n/YunyinLocale.jsx";

const C = { ink: "#4e3826", sub: "#8a7a6a", plum: "#7d5a6e", line: "#e0d2c0", card: "#fdf7ef", green: "#5f8f57", warn: "#c0703a" };
const cardStyle = { border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, background: C.card, fontSize: 13, color: C.ink, lineHeight: 1.65 };
const noteStyle = { fontSize: 11.5, color: C.sub, lineHeight: 1.6, marginTop: 10 };
const button = (tone, enabled = true) => ({
  flex: 1, minHeight: 46, border: 0, borderRadius: 12, padding: "6px 10px", fontSize: 14, fontWeight: 800, lineHeight: 1.25,
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: enabled ? "pointer" : "default",
  background: !enabled ? "#ece2d6" : tone === "warn" ? "linear-gradient(135deg,#c0703a,#d98b52)" : tone === "ghost" ? "#e8ddd0" : "linear-gradient(135deg,#7d5a6e,#9c7089)",
  color: !enabled ? C.sub : tone === "ghost" ? "#6b5d4f" : "#fff",
});
const fmtTime = (minutes, yt) => {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h > 0 ? yt("duration.hoursMinutes", { hours: h, minutes: m }) : yt("duration.minutes", { minutes: m });
};

export function NpcFieldPanel({ panel, save, characters = [], onDirty, onToast, onResidentLine, onOpenResidents, onClose }) {
  const { yt, yv } = useYunyinLocale();
  const [confirm, setConfirm] = useState(null); // "help" | "steal"
  const characterId = panel.characterId;
  const field = characterId ? save.farm?.npcFields?.[characterId] : null;

  if (!characterId || !field) {
    return <div>
      <div style={cardStyle}>{yt("npcField.emptyBody")}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" style={button("ghost")} onClick={onClose}>{yt("common.close")}</button>
        <button type="button" style={button("primary")} onClick={onOpenResidents}>{yt("npcField.openResidents")}</button>
      </div>
    </div>;
  }

  const name = characters.find((item) => item.id === characterId)?.name || yt("resident.guest");
  const crop = cropById(field.cropId);
  const cropName = crop ? yv(crop.name) : "";
  const now = Date.now();
  const stage = npcFieldStage(field, now);
  const ripe = stage === 3;
  const acted = actedToday(field, now);
  const count = Math.max(0, (panel.cropCount || 9) - (ripe ? field.stolen || 0 : 0));

  const doHelp = () => {
    const result = helpNpcField(save, characterId, Date.now());
    if (result.error) { onToast(yt(`npcField.error.${result.error}`)); setConfirm(null); return; }
    onDirty();
    onToast(result.affinityGain > 0 ? yt("npcField.helped", { name, gain: result.affinityGain }) : yt("npcField.helpedNoGain", { name }));
    onResidentLine?.(characterId, "fieldThanks");
    onClose();
  };
  const doSteal = () => {
    const result = stealNpcField(save, characterId, Date.now());
    if (result.error) { onToast(yt(`npcField.error.${result.error}`)); setConfirm(null); return; }
    onDirty();
    const vars = { icon: crop?.icon || "", crop: cropName, count: result.amount };
    onToast(result.caught ? yt("npcField.stealCaught", vars) : yt("npcField.stealOk", vars));
    if (result.caught) onResidentLine?.(characterId, "stealCaught");
    onClose();
  };

  if (confirm) {
    const steal = confirm === "steal";
    return <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, textAlign: "center", marginBottom: 10 }}>{yt(steal ? "npcField.confirmStealTitle" : "npcField.confirmHelpTitle")}</div>
      <div style={cardStyle}>{steal ? yt("npcField.confirmStealBody", { name, crop: cropName }) : yt("npcField.confirmHelpBody", { name })}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" style={button("ghost")} onClick={() => setConfirm(null)}>{yt("npcField.cancel")}</button>
        <button type="button" style={button(steal ? "warn" : "primary")} onClick={steal ? doSteal : doHelp}>{yt(steal ? "npcField.confirmSteal" : "npcField.confirmHelp")}</button>
      </div>
    </div>;
  }

  const progress = Math.round(npcFieldProgress(field, now) * 100);
  const helpEnabled = !acted;
  const stealEnabled = ripe && !acted;
  const stealHint = acted ? null : !ripe ? yt("npcField.stealNeedRipe") : null;
  return <div>
    <div style={{ textAlign: "center", fontSize: 12, color: C.sub, marginTop: -4, marginBottom: 10 }}>
      {crop ? `${crop.icon} ${yt(ripe ? "npcField.cropRipe" : "npcField.cropGrowing", { crop: cropName, count })}` : ""}
    </div>
    <div style={cardStyle}>
      {ripe ? <>
        <b style={{ color: C.green }}>{yt("npcField.ripe")}</b>{yt("npcField.ripeBody", { name })}
      </> : <>
        {yt("npcField.progress", { percent: progress })}
        <div style={{ height: 8, borderRadius: 99, background: "#efe4d5", overflow: "hidden", margin: "6px 0" }}>
          <i style={{ display: "block", height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#8fbf6a,#5f8f57)" }} />
        </div>
        {yt("npcField.remain", { time: fmtTime(npcFieldRemainMin(field, now), yt) })}
      </>}
      <div style={{ marginTop: 6, color: C.sub, fontSize: 12 }}>
        {field.helped > 0 ? yt("npcField.helpedThisRound", { count: field.helped }) : yt("npcField.notHelpedYet")}
      </div>
    </div>
    {acted && <div style={{ ...noteStyle, color: C.plum, fontWeight: 700, textAlign: "center" }}>{yt(acted === "help" ? "npcField.actedHelp" : "npcField.actedSteal")}</div>}
    {!panel.fromPlot ? <div style={{ ...noteStyle, color: C.plum, fontWeight: 700, textAlign: "center" }}>{yt("npcField.walkInHint")}</div> : <>
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
      <button type="button" disabled={!helpEnabled} style={button("primary", helpEnabled)} onClick={() => setConfirm("help")}>
        {ripe ? <Hand size={16} aria-hidden="true" /> : <Droplets size={16} aria-hidden="true" />}{yt("npcField.help")}
      </button>
      <button type="button" disabled={!stealEnabled} style={{ ...button("warn", stealEnabled), flexDirection: "column", gap: 0 }} onClick={() => setConfirm("steal")}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Sprout size={16} aria-hidden="true" />{yt("npcField.steal")}</span>
        {stealHint && <small style={{ fontSize: 10.5, fontWeight: 600 }}>{stealHint}</small>}
      </button>
    </div>
    <div style={noteStyle}>{yt("npcField.helpNote")}<br />{yt("npcField.choiceNote")}</div>
    </>}
    <button type="button" style={{ ...button("ghost"), width: "100%", marginTop: 12, flex: "none" }} onClick={onClose}>{yt("common.close")}</button>
  </div>;
}

// 收成回禮：住客收成時這一輪有幫過忙才會有；下次進靈田時跳出來
export function NpcFieldRewardPanel({ panel, save, characters = [], onDirty, onToast, onCrystals, onClose }) {
  const { yt, yv } = useYunyinLocale();
  const characterId = panel.characterId;
  const reward = save.farm?.npcFields?.[characterId]?.pendingReward;
  const name = characters.find((item) => item.id === characterId)?.name || yt("resident.guest");
  if (!reward) return <button type="button" style={{ ...button("ghost"), width: "100%" }} onClick={onClose}>{yt("common.close")}</button>;
  const crop = cropById(reward.cropId);
  const chip = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "4px 10px", fontSize: 13, fontWeight: 700, color: C.ink };
  const claim = () => {
    const claimed = claimNpcFieldReward(save, characterId);
    if (!claimed) { onClose(); return; }
    if (claimed.crystals) onCrystals?.(claimed.crystals, { note: yt("npcField.rewardLedgerNote", { name }) });
    onDirty();
    onToast(yt("npcField.rewardClaimed", { name }));
    onClose();
  };
  return <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 12.5, color: C.sub, marginTop: -4 }}>{yt("npcField.rewardThanks", { count: reward.helped })}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", margin: "12px 0" }}>
      {crop && <span style={chip}>{crop.icon} {yv(crop.name)} ×{reward.crops}</span>}
      {reward.coins > 0 && <span style={chip}>{yt("npcField.rewardCoins", { count: reward.coins })}</span>}
      {reward.crystals > 0 && <span style={chip}>{yt("npcField.rewardCrystals", { count: reward.crystals })}</span>}
    </div>
    <div style={{ ...noteStyle, marginTop: 0, textAlign: "left" }}>{yt("npcField.rewardNote")}</div>
    <button type="button" style={{ ...button("primary"), width: "100%", marginTop: 14, flex: "none" }} onClick={claim}>{yt("npcField.rewardClaim")}</button>
  </div>;
}
