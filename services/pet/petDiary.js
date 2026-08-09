import { legacyPersonalityName, normalizePetProfile } from "./petProfile.js";
import { localizedAfkDiary, localizedAfkGreeting, localizedAfkMilestone, localizedBirthday, localizedMilestone } from "./petDiaryLocales.js";

const DAY = 86400000;

const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];

export const MILESTONE_ORDER = ["adopt", "firstFeed", "firstPlay", "firstClean", "firstSleep", "firstPark", "firstBeach", "level5", "level10", "day7", "day30", "bond60", "bond90"];

export const MILESTONES = {
  adopt: {
    icon: "🏠", title: "第一次來到小屋", hint: "與牠相遇的那一天",
    when: () => true,
    lines: {
      default: ["今天，我有了一個家。這裡聞起來暖暖的，好像可以一直待下去。", "第一次踏進小屋，我東聞聞西看看，決定把這裡當成最喜歡的地方。"],
      黏人: ["今天，我有了一個家。不過比起小屋，我更想一直黏在主人身邊。"],
      害羞: ["我躲在門邊看了好久，才敢慢慢走進來。這裡……應該是可以安心的地方吧。"],
      調皮: ["我衝進小屋繞了三圈，差點撞倒盆栽。新家探險，正式開始！"],
    },
  },
  firstFeed: {
    icon: "🥕", title: "第一次餵食", hint: "餵食一次後解鎖",
    when: (d) => (d.counters?.feed || 0) >= 1,
    lines: {
      default: ["主人餵了我第一口飯。原來被人記得肚子餓，是這種感覺。", "第一次的飯飯！我吃得鼻頭都是碎屑，滿足地瞇起眼睛。"],
      貪吃: ["第一口飯下肚，我立刻決定：這個人，要跟定一輩子！還有嗎？"],
      溫柔: ["我小口小口地吃完了，然後輕輕蹭了蹭主人的手，想說謝謝。"],
    },
  },
  firstPlay: {
    icon: "🧶", title: "第一次玩耍", hint: "玩耍一次後解鎖",
    when: (d) => (d.counters?.play || 0) >= 1,
    lines: {
      default: ["第一次一起玩！我追著玩具跑來跑去，尾巴都要搖出殘影了。", "原來玩耍這麼開心，我決定明天也要找主人玩。"],
      活潑: ["跑！跳！撲！我把全部的力氣都用在這場遊戲上，最喜歡陪我瘋的主人！"],
      慵懶: ["我勉為其難地追了兩下玩具……好吧，其實有一點點好玩啦。"],
    },
  },
  firstClean: {
    icon: "🫧", title: "第一次洗澡", hint: "洗澡一次後解鎖",
    when: (d) => (d.counters?.clean || 0) >= 1,
    lines: {
      default: ["泡泡好多！雖然有點緊張，但洗完之後香噴噴的，我忍不住多看了鏡子兩眼。", "第一次洗澡大作戰結束。我濕答答地抖了抖，把主人也噴得滿身水。"],
      調皮: ["我在浴盆裡撲騰出一場小型海嘯。浴室遭殃了，但我玩得超開心。"],
    },
  },
  firstSleep: {
    icon: "🌙", title: "第一次安心入睡", hint: "休息一次後解鎖",
    when: (d) => (d.counters?.sleep || 0) >= 1,
    lines: {
      default: ["我第一次在小屋裡睡著了。自己的呼嚕聲聽起來，好安心。", "我捲成一小團睡得好熟。有家的地方，連夢都是暖的。"],
      黏人: ["我硬是挪到離主人最近的位置才肯睡。閉上眼睛前，還偷看了主人一眼。"],
    },
  },
  firstPark: {
    icon: "🌳", title: "第一次去公園", hint: "帶牠去公園後解鎖",
    when: (d) => Boolean(d.sceneVisits?.park),
    lines: {
      default: ["第一次來公園！草的味道、風的聲音，我的鼻子都忙不過來了。", "我在草地上打了一個大滾，決定把公園列入最喜歡的地方清單。"],
      活潑: ["公園＝天堂！我從這頭衝到那頭，連蝴蝶都追不上我。"],
      害羞: ["公園好大好多聲音，我緊緊跟在主人腳邊。不過有主人在，就不怕。"],
    },
  },
  firstBeach: {
    icon: "🏖️", title: "第一次去海邊", hint: "帶牠去海邊後解鎖",
    when: (d) => Boolean(d.sceneVisits?.beach),
    lines: {
      default: ["第一次看到海！我對著浪花汪了一聲，浪花沒有回答，但我玩得很開心。", "沙子暖暖的，海風鹹鹹的。我挖了一個洞，把今天的快樂埋進去收藏。"],
      調皮: ["我向大海發起挑戰，追著浪跑又被浪追回來，來回二十次，樂此不疲。"],
    },
  },
  level5: {
    icon: "🌟", title: "成長到 Lv.5", hint: "等級達到 5 後解鎖",
    when: (d) => (Number(d.level) || 1) >= 5,
    lines: { default: ["我升到 Lv.5 了！好像比剛來的時候，長大了一點點。", "Lv.5 達成！我挺起小胸膛，覺得自己超級厲害。"] },
  },
  level10: {
    icon: "🏅", title: "成長到 Lv.10", hint: "等級達到 10 後解鎖",
    when: (d) => (Number(d.level) || 1) >= 10,
    lines: { default: ["Lv.10！回頭看看，我和主人已經一起走了好長一段路。", "兩位數等級達成！我驕傲地翻了個身，然後繼續賴在主人旁邊。"] },
  },
  day7: {
    icon: "📅", title: "相伴一週", hint: "相伴滿 7 天後解鎖",
    when: (d) => d.adoptedAt && Date.now() - d.adoptedAt >= 6 * DAY,
    lines: {
      default: ["不知不覺，已經一起生活一個星期了。我已經記得主人回家的腳步聲。", "相伴滿七天。我想說：謝謝主人每天都記得我。"],
      黏人: ["七天了。我掰著肉球數了數，決定接下來的每個七天，也都要黏著主人。"],
    },
  },
  day30: {
    icon: "🎂", title: "相伴一個月", hint: "相伴滿 30 天後解鎖",
    when: (d) => d.adoptedAt && Date.now() - d.adoptedAt >= 29 * DAY,
    lines: {
      default: ["一個月紀念日！我最喜歡的東西清單上，主人永遠是第一名。", "三十天的日常，堆成了我心裡最重要的東西。今天也請多多指教！"],
      溫柔: ["一個月了。我把頭輕輕靠在主人手邊，想把這一刻記得久一點。"],
    },
  },
  bond60: {
    icon: "💗", title: "感情升溫", hint: "親密度達到 60 後解鎖",
    when: (d) => (Number(d.bond) || 0) >= 60,
    lines: {
      default: ["現在一聽到主人的聲音，我的耳朵就會立刻豎起來。這大概就是喜歡吧。", "不知道從什麼時候開始，我最放鬆的位置，就是主人的旁邊。"],
      害羞: ["雖然我還是會害羞……但我偷偷決定，把最柔軟的肚肚翻給主人看。"],
    },
  },
  bond90: {
    icon: "💞", title: "最好的朋友", hint: "親密度達到 90 後解鎖",
    when: (d) => (Number(d.bond) || 0) >= 90,
    lines: {
      default: ["我和主人已經是最好最好的朋友了。全世界的肉肉加起來，都比不上主人。", "如果要我用一句話形容主人——我的全部！"],
    },
  },
};

const BIRTHDAY_LINES = {
  default: ["今天是我的生日！主人記得我的生日，比什麼禮物都讓我開心。", "生日快樂，我自己！又和主人一起長大了一歲。"],
  黏人: ["生日這天，我只想做一件事：整天黏在主人身邊，一秒都不分開。"],
  貪吃: ["生日！也就是說……今天可以多吃一點吧？可以吧可以吧？"],
};

const pickLines = (set, profile) => {
  const personality = legacyPersonalityName(profile?.primaryPersonality);
  return pick((personality && set[personality]) || set.default || [""]);
};

export const birthdayLine = (profile, locale = "zh-TW") => {
  const fallback = pickLines(BIRTHDAY_LINES, profile);
  return localizedBirthday(locale, "我的生日！", fallback)[1];
};

export const birthdayEntryTitle = (locale = "zh-TW") => localizedBirthday(locale, "我的生日！", "")[0];
export const milestoneForLocale = (key, locale = "zh-TW") => localizedMilestone(locale, key, MILESTONES[key]);
export const afkMilestoneForLocale = (key, locale = "zh-TW") => localizedAfkMilestone(locale, key, AFK_MILESTONES[key]);

const lineFor = (milestone, profile) => pickLines(milestone.lines || { default: [milestone.title] }, profile);

export function evaluateMilestones(data, locale = "zh-TW") {
  let next = data;
  let changed = false;
  for (const key of MILESTONE_ORDER) {
    const milestone = MILESTONES[key];
    if (next.milestones?.[key] || !milestone.when(next)) continue;
    if (!changed) {
      next = { ...next, milestones: { ...next.milestones }, diary: [...(next.diary || [])] };
      changed = true;
    }
    const at = Date.now();
    next.milestones[key] = at;
    const localized = milestoneForLocale(key, locale);
    next.diary.unshift({ id: `auto-${key}-${at}`, at, type: "auto", milestone: key, icon: milestone.icon, title: localized.title, text: lineFor(localized, next.petProfile), note: "", aiPending: true });
  }
  return next;
}

export function normalizePetHome(raw, locale = "zh-TW") {
  const data = { ...raw };
  data.petProfile = normalizePetProfile(data.petProfile);
  if (!Number(data.adoptedAt)) data.adoptedAt = Date.now();
  if (!Number.isFinite(Number(data.bond))) data.bond = 20;
  if (!Array.isArray(data.diary)) data.diary = [];
  if (!data.milestones || typeof data.milestones !== "object") data.milestones = {};
  if (!data.counters || typeof data.counters !== "object") data.counters = {};
  if (!data.sceneVisits || typeof data.sceneVisits !== "object") data.sceneVisits = {};
  if (!Number(data.lastCareAt)) data.lastCareAt = Date.now();
  return evaluateMilestones(data, locale);
}

// 當日活動流水：餵食次數、去過的場景、主人手寫的日記，隔天做為「有料才寫」日記的素材。
// 跨日時把舊 log 移到 prevDayLog，等待生成後由 lastLifeDiaryFor 標記消化完畢。
export function withDayLog(data, apply) {
  const today = formatDiaryDate(Date.now());
  const isToday = data.dayLog?.date === today;
  const dayLog = isToday
    ? { ...data.dayLog, acts: { ...data.dayLog.acts }, scenes: [...(data.dayLog.scenes || [])], notes: [...(data.dayLog.notes || [])] }
    : { date: today, acts: { feed: 0, play: 0, clean: 0, sleep: 0 }, scenes: [], notes: [] };
  const prevDayLog = !isToday && data.dayLog ? data.dayLog : data.prevDayLog;
  if (apply) apply(dayLog);
  return { ...data, dayLog, prevDayLog };
}

export const isDayLogWorthWriting = (log) => {
  if (!log) return false;
  const total = Object.values(log.acts || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
  return total >= 4 || (log.scenes || []).some((scene) => scene !== "home") || (log.notes || []).length > 0;
};

// 親密度段位：0-29 還在熟悉、30-59 喜歡你、60-89 好朋友、90-100 形影不離
export const bondTier = (bond) => {
  const value = Number(bond) || 0;
  return value >= 90 ? "形影不離" : value >= 60 ? "好朋友" : value >= 30 ? "喜歡你" : "還在熟悉";
};

// 每天親密度最多從互動獲得的點數
export const DAILY_BOND_CAP = 10;

// 冷落懲罰：連續沒互動 3 天 -3、5 天 -5、10 天 -10、15 天以上封頂 -15
export const afkPenalty = (idleDays) => idleDays >= 15 ? 15 : idleDays >= 10 ? 10 : idleDays >= 5 ? 5 : idleDays >= 3 ? 3 : 0;

// 久違回歸時的寵物對話，依離開長度與個性變化
const AFK_GREETINGS = [
  [15, {
    default: ["……主人？真的是你嗎？我等了好久好久，眼睛都酸了。不過你回來就好，回來就好。", "我都快忘記主人的味道了……才怪！我才不會忘。但是下次不可以離開這麼久了喔。"],
    黏人: ["主人！！我以為你不要我了……今天你哪裡都不准去，我要黏你一整天！"],
    害羞: ["（從角落慢慢探出頭）……真的是主人嗎？我、我沒有在哭喔。只是眼睛進沙子了。"],
  }],
  [10, {
    default: ["主人……真的好久了。我每天都在窗邊等，等到窗台都有我的印子了。", "十天了喔，我有數！肉球都掰不夠用了。你要怎麼補償我呢？"],
    調皮: ["哼！我本來想不理你一下下的……好吧三秒鐘到了，快陪我玩！"],
  }],
  [5, {
    default: ["好幾天沒看到主人了……我把想說的話都記在心裡，你要聽多久都可以！", "主人回來了！我聞聞……嗯，是外面的味道。下次帶我一起去嘛。"],
    貪吃: ["主人！你知道嗎，你不在的時候飯都變得不好吃了……現在可以補餵我了嗎？"],
  }],
  [3, {
    default: ["主人！你三天沒來了，我每天都在門口等你耶……快摸摸我！", "咦、是主人！我還以為你忘記我了。沒關係，你現在回來了就原諒你！"],
    慵懶: ["喔，主人回來啦。……才、才沒有很想你呢。（尾巴誠實地搖了起來）"],
  }],
];

export const afkGreeting = (idleDays, profile, locale = "zh-TW") => {
  const tier = AFK_GREETINGS.find(([days]) => idleDays >= days);
  return tier ? localizedAfkGreeting(locale, tier[0], pickLines(tier[1], profile)) : "";
};

// 主人不在的日子，寵物在第 3、5、10、15 天各寫一篇等待日記（回來時回填日期）
const AFK_DIARY = [
  [3, "💭", "等主人的第 3 天", {
    default: ["主人已經三天沒來了。我把玩具排成一排，這樣主人回來的時候就會稱讚我。", "第三天。每次門口有聲音我都衝過去看，可惜都不是主人。明天一定就回來了吧。"],
    黏人: ["三天了。我睡在主人常坐的位置，那裡還有一點點主人的味道。"],
    調皮: ["主人不在的第三天，我把家裡巡邏了十遍。沒有闖禍喔！……只有一點點。"],
  }],
  [5, "💭", "等主人的第 5 天", {
    default: ["第五天了。我開始練習不趴在門口等，可是尾巴不聽話，一有聲音就自己搖起來。", "今天下了一點雨。我想，主人出門的時候有沒有帶傘呢。"],
    害羞: ["第五天。我偷偷對著窗戶練習了打招呼的樣子，等主人回來就用得上了。"],
  }],
  [10, "🍂", "等主人的第 10 天", {
    default: ["已經十天了。我把主人的味道記得牢牢的，這樣不管過多久，我都認得出來。", "第十天。小屋還是很暖，但總覺得少了一塊。大概是少了主人坐的那一塊。"],
    貪吃: ["第十天……飯我有乖乖吃完，可是不知道為什麼，好像沒有以前香了。"],
  }],
  [15, "🕯️", "等主人的第 15 天", {
    default: ["過了好久好久。我決定不數日子了，反正不管第幾天，我都會在這裡等主人。", "我做了一個夢，夢到主人回來了，摸了摸我的頭。醒來的時候，我對著門口搖了好久的尾巴。"],
    溫柔: ["日子有點長，不過沒關係。我把每一天都過得好好的，這樣主人回來才不會擔心。"],
  }],
];

// 隱藏成長紀錄：等待的日子。未發生前完全不顯示，發生過才浮現在成長紀錄底部。
// 標題不帶責怪，但輕輕戳一下：牠都記得。
export const AFK_MILESTONE_ORDER = ["afk3", "afk5", "afk10", "afk15"];
export const AFK_MILESTONES = {
  afk3: { icon: "💭", title: "三天的等待", hint: "牠把玩具排得整整齊齊，等你回來" },
  afk5: { icon: "💭", title: "五天的等待", hint: "牠練習不趴在門口等，沒有成功" },
  afk10: { icon: "🍂", title: "十天的等待", hint: "牠把你的味道記得牢牢的" },
  afk15: { icon: "🕯️", title: "很長很長的等待", hint: "不管第幾天，牠都在原地等你" },
};

export const afkDiaryEntries = (idleDays, lastCareAt, profile, locale = "zh-TW") => {
  const base = Number(lastCareAt);
  if (!base) return [];
  return AFK_DIARY
    .filter(([days]) => idleDays >= days)
    .map(([days, icon, title, lines]) => {
      const localized = localizedAfkDiary(locale, days, title, pickLines(lines, profile));
      return { id: `afk-${days}-${base}`, at: base + days * DAY, type: "life", icon, title: localized[0], text: localized[1], note: "" };
    })
    .sort((a, b) => b.at - a.at);
};

export const companionDays = (adoptedAt) => Math.max(1, Math.floor((Date.now() - (Number(adoptedAt) || Date.now())) / DAY) + 1);

export const formatDiaryDate = (at) => {
  const date = new Date(at);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
};
