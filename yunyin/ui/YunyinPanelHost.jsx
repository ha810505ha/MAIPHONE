import React from "react";
import { CROPS } from "../data/crops";
import { cropById, growMs, plantCrop } from "../systems/farm";
import { addPackVersion, addResidentPackVersion, PACK_POOLS, RESIDENT_PACK_POOLS } from "../systems/ai";
import { randomAppearance } from "../engine/sprite";
import CultivationPanel from "./CultivationPanel";
import ShopPanel from "./ShopPanel";
import FurnitureShopPanel from "./FurnitureShopPanel";
import HomeExpandPanel from "./HomeExpandPanel";
import ResidentPanel from "./ResidentPanel";
import InventoryPanel from "./InventoryPanel";
import DungeonPanel from "./DungeonPanel";
import CharacterPanel from "./CharacterPanel";
import GameSettingsPanel from "./GameSettingsPanel";
import { canDismissPanelFromBackdrop } from "./panelInteraction.js";
import { useYunyinLocale } from "../i18n/YunyinLocale.jsx";

function FarmAssistPanel({ panel, gameSave, markDirty, showToast, setPanel, onFarmAssist }) {
  const { yt, yv } = useYunyinLocale();
  const acceptAssist = () => {
    const planted = gameSave.farm.plots
      .map((plot, plotIdx) => ({ plot, plotIdx }))
      .filter(({ plot }) => plot.cropId);
    if (!planted.length) {
      showToast(yt("farmAssist.noneGrowing"));
      setPanel(null);
      return;
    }
    const selected = planted[Math.floor(Math.random() * planted.length)];
    const crop = cropById(selected.plot.cropId);
    if (!crop) {
      showToast(yt("farmAssist.notFound"));
      setPanel(null);
      return;
    }
    const remain = Math.max(0, (selected.plot.plantedAt + growMs(crop)) - Date.now());
    selected.plot.plantedAt -= Math.floor(remain * 0.25);
    gameSave.farmAssist = { day: new Date().toISOString().slice(0, 10), used: true };
    onFarmAssist?.(panel.npc);
    markDirty();
    showToast(yt("farmAssist.helped", { name: yv(panel.npc.name), name2: yv(crop.name) }));
    setPanel(null);
  };

  return (
    <div style={{ textAlign: "center", color: "#5d5147" }}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>🌱</div>
      <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>{yt("farmAssist.offer")}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ flex: 1, border: 0, borderRadius: 12, padding: "10px 8px", background: "linear-gradient(135deg,#7d5a6e,#9c7089)", color: "#fff", fontWeight: 700 }} onClick={acceptAssist}>{yt("farmAssist.accept")}</button>
        <button style={{ flex: 1, border: 0, borderRadius: 12, padding: "10px 8px", background: "#e8ddd0", color: "#6b5d4f", fontWeight: 700 }} onClick={() => { onFarmAssist?.(panel.npc); setPanel(null); }}>{yt("farmAssist.decline")}</button>
      </div>
    </div>
  );
}

export default function YunyinPanelHost({ panel, setPanel, gameSave, markDirty, onCompanion, showToast, addCrystals, crystals = 0, characters, onAiGenerate, npcAppearanceRef, onHomeRefresh, onFarmAssist, onPlayerAction }) {
  const { yt, yv, ym } = useYunyinLocale();
  if (!panel) return null;
  const closeFromBackdrop = () => {
    if (!canDismissPanelFromBackdrop(panel)) return;
    setPanel(null);
  };
  return (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 5 }} onClick={closeFromBackdrop}>
          <div data-yunyin-panel="1" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} style={{ background: "#fffaf3", borderRadius: 18, padding: "20px 22px", width: "min(84%, 330px)", maxHeight: "84%", overflowY: "auto", boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, textAlign: "center" }}>{panel.titleKey ? yt(panel.titleKey, panel.titleVariables) : panel.title}</div>
            {panel.type === "cultivation" ? (
              <CultivationPanel save={gameSave} onDirty={markDirty} onCompanion={onCompanion} onClose={() => setPanel(null)} />
            ) : panel.type === "shop" ? (
              <ShopPanel save={gameSave} onDirty={markDirty} onToast={showToast} onCrystals={addCrystals} onClose={() => setPanel(null)} initialTab={panel.tab || "furnace"} lockTab />
            ) : panel.type === "furnitureShop" ? (
              <FurnitureShopPanel save={gameSave} crystals={crystals} onCrystals={addCrystals} onDirty={markDirty} onToast={showToast} onClose={() => setPanel(null)} />
            ) : panel.type === "homeExpand" ? (
              <HomeExpandPanel save={gameSave} onDirty={markDirty} onToast={showToast} onClose={() => setPanel(null)} onHomeRefresh={onHomeRefresh} />
            ) : panel.type === "inventory" ? (
              <InventoryPanel save={gameSave} onClose={() => setPanel(null)} />
            ) : panel.type === "homeResidents" ? (
              <ResidentPanel
                save={gameSave} characters={characters} onDirty={markDirty} onToast={showToast} onCrystals={addCrystals}
                onClose={() => setPanel(null)} onHomeRefresh={onHomeRefresh}
                onGenerateLines={onAiGenerate ? async (charId) => {
                  const home = gameSave.home?.homes?.player_home;
                  if (!home?.residents?.includes(charId)) return yt("resident.onlyResidents");
                  const lines = await onAiGenerate(charId, RESIDENT_PACK_POOLS);
                  if (!lines) return yt("panel.generateFailedApi");
                  addResidentPackVersion(gameSave, charId, lines);
                  markDirty();
                  return null;
                } : null}
              />
            ) : panel.type === "dungeon" ? (
              <DungeonPanel save={gameSave} onDirty={markDirty} onToast={showToast} onCompanion={onCompanion} onCrystals={addCrystals} onClose={() => setPanel(null)} />
            ) : panel.type === "farmAssist" ? (
              <FarmAssistPanel panel={panel} gameSave={gameSave} markDirty={markDirty} showToast={showToast} setPanel={setPanel} onFarmAssist={onFarmAssist} />
            ) : panel.type === "settings" ? (
              <GameSettingsPanel
                save={gameSave} characters={characters} onDirty={markDirty}
                onGenerateLines={onAiGenerate ? async (charId) => {
                  const lines = await onAiGenerate(charId, PACK_POOLS);
                  if (!lines) return yt("panel.generateFailedApi");
                  addPackVersion(gameSave, charId, lines);
                  markDirty();
                  return null;
                } : null}
                onEditAppearance={(npcIdx = null) => setPanel({
                  type: "character", ...(npcIdx != null ? { npcIdx } : {}),
                  titleKey: npcIdx != null ? "panel.residentAppearance" : "panel.playerAppearance",
                  titleVariables: npcIdx != null ? { name: gameSave.npcs[npcIdx]?.name || yt("panel.resident") } : undefined,
                  returnTo: { type: "settings", titleKey: "panel.settings" },
                })}
                onClose={() => setPanel(null)}
              />
            ) : panel.type === "character" ? (
              <CharacterPanel
                key={panel.npcIdx ?? "player"}
                value={panel.npcIdx != null
                  ? (gameSave.npcs[panel.npcIdx].appearance || randomAppearance(gameSave.npcs[panel.npcIdx].seed))
                  : gameSave.player.appearance}
                onSave={(appearance) => {
                  if (panel.npcIdx != null) {
                    gameSave.npcs[panel.npcIdx].appearance = appearance;
                    npcAppearanceRef.current(gameSave.npcs[panel.npcIdx].seed, appearance);
                  } else {
                    gameSave.player.appearance = appearance;
                  }
                  markDirty();
                }}
                onClose={() => setPanel(panel.returnTo || null)}
              />
            ) : panel.type === "plant" ? (
              <div>
                {CROPS.map((c) => {
                  const seedKey = `${c.id}_seed`;
                  const affordable = c.source === "shop" ? gameSave.coins >= c.seedCost : (gameSave.inventory[seedKey] || 0) > 0;
                  const actualGrowMin = Math.ceil(growMs(c) / 60000);
                  return (
                    <button
                      key={c.id}
                      disabled={!affordable}
                      onClick={() => {
                        if (Date.now() < (panel.interactionReadyAt || 0)) return;
                        const err = plantCrop(gameSave, panel.plotIdx, c.id);
                        if (err) { showToast(ym(err)); return; }
                        markDirty();
                        setPanel(null);
                        showToast(yt("plant.planted", { icon: c.icon, name: yv(c.name) }));
                        onPlayerAction?.(900); // 借 pickup 當種植的示意動作，沒有專屬動畫素材
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 8,
                        border: "1px solid #e2d6c6", borderRadius: 12, padding: "10px 12px", textAlign: "left",
                        background: affordable ? "#fff" : "#f1ebe2", cursor: affordable ? "pointer" : "default", opacity: affordable ? 1 : 0.6,
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{c.icon}</span>
                      <span style={{ flex: 1 }}>
                        <b style={{ fontSize: 14 }}>{yv(c.name)}</b>
                        <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>{yt("plant.details", { minutes: actualGrowMin, price: c.sellPrice })}</span>
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#6b5d4f" }}>
                        {c.source === "shop" ? `🪙 ${c.seedCost}` : yt("plant.seeds", { count: gameSave.inventory[seedKey] || 0 })}
                      </span>
                    </button>
                  );
                })}
                <button onClick={() => setPanel(null)} style={{ width: "100%", border: 0, borderRadius: 12, padding: "9px 0", background: "#e8ddd0", color: "#6b5d4f", fontSize: 14, cursor: "pointer" }}>{yt("common.cancel")}</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "#8a7a6a", lineHeight: 1.6, textAlign: "center" }}>{yt("panel.placeholder")}</div>
                <button onClick={() => setPanel(null)} style={{ marginTop: 14, border: 0, borderRadius: 12, padding: "8px 22px", background: "#7d5a6e", color: "#fff", fontSize: 14, cursor: "pointer", display: "block", margin: "14px auto 0" }}>{yt("common.close")}</button>
              </>
            )}
          </div>
        </div>

  );
}
