// 秘境事件卡池。之後要加卡/改數值只動這個檔，程式不用改。
//
// choice 欄位：
//   risk:  0~1，出「壞結果」的機率（沒填 = 必定好結果）
//   check: { base, perRealm }，境界檢定：成功率 = base + perRealm × realmIdx
//   good / bad: { exp, coins, hp, item: { id, n } }
//   goodText / badText: 結果文本（fallback，之後 AI 觸發點可改寫）
export const EVENTS = [
  {
    id: "altar", weight: 10, icon: "⛩️",
    text: "霧中出現傾頹的祭壇，壇上放著一顆泛著微光的果實。",
    choices: [
      { label: "取走果實", hint: "稀有種子？可能遇襲", risk: 0.4,
        good: { item: { id: "xinglu_seed", n: 1 } }, goodText: "果實入手——是罕見的星露籽！",
        bad: { hp: -3 }, badText: "守壇的石像突然睜眼，你負傷退開。" },
      { label: "在祭壇打坐", hint: "修為 +150",
        good: { exp: 150 }, goodText: "壇上餘韻未散，你悟得一絲真意。" },
      { label: "繞路離開", hint: "安全前進", good: {}, goodText: "你安靜地繞開了祭壇。" },
    ],
  },
  {
    id: "beast", weight: 12, icon: "🐺",
    text: "一頭霧紋妖狼擋在路中，喉間低鳴。",
    choices: [
      { label: "拔劍迎戰", hint: "勝了有戰利品", risk: 0.35,
        good: { coins: 40, item: { id: "qingling", n: 2 } }, goodText: "妖狼敗退，你搜得皮毛與靈草。",
        bad: { hp: -4 }, badText: "狼爪撕開衣袖，你且戰且退。" },
      { label: "緩緩後退", hint: "多半能脫身", risk: 0.15,
        good: {}, goodText: "你退出了牠的領地，有驚無險。",
        bad: { hp: -2 }, badText: "妖狼突然撲來，你狼狽逃開。" },
    ],
  },
  {
    id: "herb", weight: 12, icon: "🌿",
    text: "崖壁下是一小片無人打理的野生藥園。",
    choices: [
      { label: "採外圍的藥草", hint: "青靈草 ×3",
        good: { item: { id: "qingling", n: 3 } }, goodText: "你採滿了一把青靈草。" },
      { label: "深入採珍稀藥材", hint: "月華菇？小心毒霧", risk: 0.3,
        good: { item: { id: "yuehua", n: 2 } }, goodText: "霧氣深處果然藏著月華菇！",
        bad: { hp: -2 }, badText: "毒霧刺鼻，你咳著退了出來。" },
    ],
  },
  {
    id: "merchant", weight: 8, icon: "🧙",
    text: "披斗篷的迷霧商人朝你晃了晃手中的葫蘆。",
    choices: [
      { label: "以血換藥", hint: "🩸-1，得回氣丹 ×2",
        good: { hp: -1, item: { id: "huiqi", n: 2 } }, goodText: "商人收下一滴精血，遞來兩顆回氣丹。" },
      { label: "聽他講古", hint: "修為 +100",
        good: { exp: 100 }, goodText: "商人的故事裡藏著前人的修行心得。" },
      { label: "不予理會", hint: "安全前進", good: {}, goodText: "你與商人擦肩而過。" },
    ],
  },
  {
    id: "trap", weight: 8, icon: "🚪",
    text: "一道刻滿符文的石門，門縫裡透出金光。",
    choices: [
      { label: "以靈力破陣", hint: "境界越高越穩", check: { base: 0.4, perRealm: 0.15 },
        good: { coins: 60 }, goodText: "石門轟然開啟，裡面是前人留下的儲物袋。",
        bad: { hp: -3 }, badText: "符文反噬，你被震飛數丈。" },
      { label: "不碰為妙", hint: "安全前進", good: {}, goodText: "你按下好奇心，繼續前行。" },
    ],
  },
  {
    id: "spring", weight: 9, icon: "💧",
    text: "山縫間湧出一泓靈泉，水面浮著淡淡靈光。",
    choices: [
      { label: "掬水而飲", hint: "🩸+3",
        good: { hp: 3 }, goodText: "泉水入喉，傷勢明顯好轉。" },
      { label: "臨泉打坐", hint: "修為 +120",
        good: { exp: 120 }, goodText: "泉邊靈氣充沛，修為小有精進。" },
    ],
  },
  {
    id: "treasure", weight: 8, icon: "🎁",
    text: "白骨旁散落一只上鎖的鐵箱，鎖上覆著薄霧。",
    choices: [
      { label: "撬開鐵箱", hint: "發大財？也許有詐", risk: 0.45,
        good: { coins: 80 }, goodText: "箱裡是沉甸甸的一袋靈石！",
        bad: { hp: -3 }, badText: "箱中毒針彈出，正中手腕。" },
      { label: "只撿散落的銅錢", hint: "🪙+15 穩穩的",
        good: { coins: 15 }, goodText: "你拾起白骨旁的散錢，默唸一聲告辭。" },
    ],
  },
  {
    id: "stele", weight: 8, icon: "🗿",
    text: "半截古碑立在霧中，碑文若隱若現。",
    choices: [
      { label: "凝神參悟", hint: "修為大漲？當心走火", risk: 0.25,
        good: { exp: 200 }, goodText: "碑文入心，你隱約觸到上境的門檻。",
        bad: { hp: -2 }, badText: "碑文戛然扭曲，你氣血翻湧。" },
      { label: "拓印碑文", hint: "🪙+25",
        good: { coins: 25 }, goodText: "拓片在坊市能賣個好價錢。" },
    ],
  },
  {
    id: "swarm", weight: 9, icon: "🦂",
    text: "前方峽道傳來密密麻麻的沙沙聲——蟲潮。",
    choices: [
      { label: "運起護體罡氣硬闖", hint: "快，但可能被咬", risk: 0.4,
        good: { item: { id: "qingling", n: 2 } }, goodText: "你衝出蟲潮，順手抓了兩把靈草。",
        bad: { hp: -3 }, badText: "幾隻毒蟲鑽進護罩，蜇得你手臂發麻。" },
      { label: "繞遠路", hint: "🩸-1 消耗體力",
        good: { hp: -1 }, goodText: "你多走了一個時辰，繞開了峽道。" },
    ],
  },
  {
    id: "bush", weight: 7, icon: "✨",
    text: "一叢灌木在霧裡發著星星點點的光。",
    choices: [
      { label: "摘取星露果", hint: "星露籽！但枝上有刺", risk: 0.5,
        good: { item: { id: "xinglu_seed", n: 1 } }, goodText: "你避開棘刺，摘下了發光的果實。",
        bad: { hp: -2 }, badText: "棘刺劃破手掌，果實滾落霧中。" },
      { label: "摘外圍的普通果子", hint: "青靈草 ×2",
        good: { item: { id: "qingling", n: 2 } }, goodText: "普通果子也是收穫。" },
    ],
  },
  {
    id: "echo", weight: 7, icon: "🕳️",
    text: "巨大的洞窟迴盪著你的腳步聲，深處似乎有東西反光。",
    choices: [
      { label: "朝深處大喊一聲", hint: "說不定震落什麼", risk: 0.5,
        good: { coins: 50 }, goodText: "轟隆——洞頂震落一小袋前人遺財。",
        bad: { hp: -2 }, badText: "震落的是碎石，砸得你抱頭鼠竄。" },
      { label: "靜靜通過", hint: "安全前進", good: {}, goodText: "你放輕腳步走出了洞窟。" },
    ],
  },
  {
    id: "monk", weight: 7, icon: "🧘",
    text: "一位苦行僧在霧中打坐，眉目安詳，似在等人。",
    choices: [
      { label: "上前討教", hint: "高深法門？未必投緣", risk: 0.3,
        good: { exp: 300 }, goodText: "僧人傳你一段呼吸法，字字珠璣。",
        bad: { hp: -2 }, badText: "僧人睜眼一喝，你識海一震。" },
      { label: "靜坐聽道", hint: "修為 +150",
        good: { exp: 150 }, goodText: "你在一旁聽了半晌，若有所悟。" },
    ],
  },
];

// Boss 層（每輪最後一層固定）
export const BOSS_EVENT = {
  id: "boss", icon: "👹",
  text: "濃霧翻湧成牆，霧主的身影自其中緩緩凝聚——這一層的主人來了。",
  choices: [
    { label: "正面迎戰", hint: "境界越高勝算越大", check: { base: 0.45, perRealm: 0.1 },
      good: { coins: 120, exp: 300, item: { id: "xinglu_seed", n: 1 } },
      goodText: "霧主潰散成雨！你奪得了秘境的餽贈。",
      bad: { hp: -5 }, badText: "霧主的巨掌拍中你的護罩，你口吐鮮血。" },
    { label: "尋隙智取", hint: "報酬較少，較穩", risk: 0.35,
      good: { coins: 60, exp: 150 }, goodText: "你趁霧主凝形未穩偷得寶物，全身而退。",
      bad: { hp: -3 }, badText: "霧主識破了你的動作，甩尾掃中你。" },
  ],
};

// 詞條：每輪開始隨機抽 1~2 條（正負混合）
export const MODIFIERS = [
  { id: "herb_rich",  label: "藥草豐饒", desc: "物品掉落 ×2",     effect: { dropMul: 2 } },
  { id: "thin_mist",  label: "霧氣稀薄", desc: "層數 -1",         effect: { floorMinus: 1 } },
  { id: "spirit_wind",label: "靈風徐來", desc: "修為收益 ×1.5",   effect: { expMul: 1.5 } },
  { id: "blessing",   label: "山神庇佑", desc: "體力上限 +2",     effect: { hpPlus: 2 } },
  { id: "miasma",     label: "瘴氣瀰漫", desc: "體力上限 -1",     effect: { hpPlus: -1 } },
  { id: "beast_rage", label: "妖獸躁動", desc: "厄運機率 +10%",   effect: { riskPlus: 0.1 } },
];
