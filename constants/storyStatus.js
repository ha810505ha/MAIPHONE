// 「此刻」的知情度：未解伏筆與玩家備註可能是角色不該知道的內容，
// 所以這兩欄各自帶一個狀態，決定它在提示詞裡進哪一段。
//   known  角色知道，跟其他欄位一起注入
//   quiet  角色心裡有數，可以影響態度語氣，但不主動講破
//   hidden 角色完全不知情，只給導演視角維持場景一致
const STORY_VISIBILITY = ["known", "quiet", "hidden"];

// 只有這兩欄需要知情度；關係／場景／情緒／進行中，角色本來就身在其中。
const STORY_VISIBILITY_FIELDS = ["thread", "playerNote"];

const STORY_VISIBILITY_DEFAULTS = {
  // 伏筆沿用舊行為（角色知道）。
  thread: "known",
  // 知情程度的 UI 暫未開放；目前所有此刻欄位都預設提供給角色理解。
  playerNote: "known",
};

const STORY_VISIBILITY_ICONS = {
  known: "👁",
  quiet: "🤐",
  hidden: "🙈",
};

const normalizeStoryVisibility = (value, fallback) => (
  STORY_VISIBILITY.includes(value) ? value : fallback
);

const getStoryVisibility = (status, field) => normalizeStoryVisibility(
  status?.visibility?.[field],
  STORY_VISIBILITY_DEFAULTS[field] || "known",
);

const nextStoryVisibility = (value) => {
  const index = STORY_VISIBILITY.indexOf(value);
  return STORY_VISIBILITY[(index < 0 ? 0 : index + 1) % STORY_VISIBILITY.length];
};

export {
  STORY_VISIBILITY,
  STORY_VISIBILITY_FIELDS,
  STORY_VISIBILITY_DEFAULTS,
  STORY_VISIBILITY_ICONS,
  normalizeStoryVisibility,
  getStoryVisibility,
  nextStoryVisibility,
};
