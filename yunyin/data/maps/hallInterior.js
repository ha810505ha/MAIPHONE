// 修煉堂內部：金色祭壇（修煉/突破面板）、蒲團（打坐——每日首次獲得隨機修為）。
// 最上方多留一排牆做「頭部空間」，石柱/掛軸這類高貼圖才不會被畫布頂端裁斷。
const ground = [
  "WWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWW",
  "WffffffffffffW",
  "WffffffffffffW",
  "WffffffffffffW",
  "WffffffffffffW",
  "WffffffffffffW",
  "WffffffffffffW",
  "WffffffffffffW",
  "WWWWWWffWWWWWW",
];

// 坐姿動畫只有朝左/朝右，蒲團席位依所在側選面向（面向大廳中央）
const cushionSit = (id, facing) => ({
  id, img: "hallCushion", w: 1, h: 1, blocking: true,
  interactions: [{ id: "meditate", action: "sit", label: "打坐", minDurationMs: 6000, maxDurationMs: 12000, slots: [
    { id: "seat", approach: [0, 1], facing, renderOffset: [0, -1] },
  ] }],
});

export default {
  id: "hall_interior",
  name: "修煉堂",
  kind: "interior",
  layers: { ground },
  spawn: [6, 8],
  buildings: [
    { id: "hall_altar", label: "突破祭壇", x: 6, y: 2, w: 1, h: 1, door: [6, 3], opens: "cultivation", img: "hallAltar", renderScale: 1.25, color: "#c9a53c", roof: "#8a6a2c", showLabel: true, collisionPadding: { top: 2 } },
  ],
  decorations: [
    // 祭壇兩側石柱與香爐
    { id: "hall_pillar_left", img: "hallPillar", x: 4, y: 2, w: 1, h: 1, blocking: true },
    { id: "hall_pillar_right", img: "hallPillar", x: 8, y: 2, w: 1, h: 1, blocking: true },
    { id: "hall_incense_left", img: "hallIncense", x: 5, y: 3, w: 1, h: 1, blocking: true },
    { id: "hall_incense_right", img: "hallIncense", x: 7, y: 3, w: 1, h: 1, blocking: true },
    // 打坐區：榻榻米（flat：畫在地面層）上放蒲團
    { id: "hall_tatami_left", img: "hallTatami", x: 2, y: 5, w: 2, h: 2, blocking: false, flat: true },
    { id: "hall_tatami_right", img: "hallTatami", x: 10, y: 5, w: 2, h: 2, blocking: false, flat: true },
    { ...cushionSit("hall_cushion_1", "right"), x: 2, y: 5 },
    { ...cushionSit("hall_cushion_2", "left"), x: 11, y: 5 },
    // 角落點綴
    { id: "hall_scroll_left", img: "hallScroll", x: 1, y: 2, w: 1, h: 1, blocking: true },
    { id: "hall_scroll_right", img: "hallScroll", x: 12, y: 2, w: 1, h: 1, blocking: true },
    { id: "hall_bonsai_left", img: "decorBonsaiB", x: 1, y: 7, w: 1, h: 1, blocking: true },
    { id: "hall_bonsai_right", img: "decorBonsaiA", x: 12, y: 7, w: 1, h: 1, blocking: true },
  ],
  plots: [],
  portals: [
    { x: 6, y: 9, to: "gate", spawn: [9, 9], label: "離開修煉堂", icon: "🚪" },
    { x: 7, y: 9, to: "gate", spawn: [9, 9], label: "離開修煉堂", icon: "🚪" },
  ],
};
