import React from "react";
import { CROPS } from "../data/crops";
import { RECIPES } from "../data/recipes";
import { MATERIALS } from "../data/materials";
import { itemMeta } from "../systems/shop";

// 物品分組：讓玩家隨時知道手上有什麼，不必走到丹房貨架才看得到。
const GROUPS = [
  { id: "crop", label: "作物", ids: CROPS.map((c) => c.id) },
  { id: "material", label: "建材", ids: [...MATERIALS.map((m) => m.id), "fuwen_zhuan", "lingmu_liang"] },
  { id: "pill", label: "丹藥", ids: RECIPES.filter((r) => !["fuwen_zhuan", "lingmu_liang"].includes(r.id)).map((r) => r.id) },
  { id: "seed", label: "種子", ids: CROPS.map((c) => `${c.id}_seed`) },
];

const rowStyle = { display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2d6c6", borderRadius: 12, padding: "8px 10px", marginBottom: 6, background: "#fff" };

export default function InventoryPanel({ save, onClose }) {
  const inv = save.inventory || {};
  const owned = Object.entries(inv).filter(([, n]) => n > 0);
  const totalValue = owned.reduce((sum, [id, n]) => sum + itemMeta(id).sellPrice * n, 0);
  const grouped = GROUPS.map((group) => ({
    ...group,
    items: group.ids.filter((id) => (inv[id] || 0) > 0).map((id) => [id, inv[id]]),
  })).filter((group) => group.items.length);
  // 沒被任何分組認領的（之後新增物品忘了歸類也不會消失）
  const claimed = new Set(GROUPS.flatMap((g) => g.ids));
  const others = owned.filter(([id]) => !claimed.has(id));

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#8a7a6a", marginBottom: 10 }}>
        <span>🪙 {save.coins}</span>
        <span style={{ marginLeft: "auto" }}>物品總值 約 🪙{totalValue}</span>
      </div>
      <div style={{ maxHeight: 340, overflowY: "auto" }}>
        {grouped.length === 0 && others.length === 0 && (
          <div style={{ fontSize: 12, color: "#8a7a6a" }}>背包空空如也——去靈田種點東西，或到秘境走一趟吧。</div>
        )}
        {grouped.map((group) => (
          <div key={group.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7d5a6e", marginBottom: 6 }}>{group.label}</div>
            {group.items.map(([id, n]) => {
              const meta = itemMeta(id);
              return (
                <div key={id} style={rowStyle}>
                  <span style={{ fontSize: 20 }}>{meta.icon}</span>
                  <span style={{ flex: 1, fontSize: 13 }}><b>{meta.name}</b> ×{n}</span>
                  <span style={{ fontSize: 11, color: "#8a7a6a" }}>單價 🪙{meta.sellPrice}</span>
                </div>
              );
            })}
          </div>
        ))}
        {others.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7d5a6e", marginBottom: 6 }}>其他</div>
            {others.map(([id, n]) => {
              const meta = itemMeta(id);
              return (
                <div key={id} style={rowStyle}>
                  <span style={{ fontSize: 20 }}>{meta.icon}</span>
                  <span style={{ flex: 1, fontSize: 13 }}><b>{meta.name}</b> ×{n}</span>
                  <span style={{ fontSize: 11, color: "#8a7a6a" }}>單價 🪙{meta.sellPrice}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#8a7a6a", marginTop: 4 }}>作物與丹藥可在丹房貨架上架販售；建材用於房屋擴建。</div>
      <button onClick={onClose} style={{ width: "100%", marginTop: 10, border: 0, borderRadius: 12, padding: "9px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>關閉</button>
    </div>
  );
}
