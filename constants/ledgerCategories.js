// 生活記帳（wallet.life）的固定分類表。分類必須是固定清單，自由輸入會讓統計碎掉。
// color 同時用於清單左側圖示底色與統計長條，兩邊共用一色方便對照。
export const EXPENSE_CATEGORIES = [
  { id: "food",      emoji: "🍜", color: "#F0904F", label: ["餐飲", "Food", "食費", "식비"] },
  { id: "transport", emoji: "🚌", color: "#5AA9E0", label: ["交通", "Transit", "交通", "교통"] },
  { id: "shopping",  emoji: "🛍️", color: "#E0567A", label: ["購物", "Shopping", "買い物", "쇼핑"] },
  { id: "fun",       emoji: "🎮", color: "#A06ADF", label: ["娛樂", "Fun", "娯楽", "여가"] },
  { id: "home",      emoji: "🏠", color: "#8BC46A", label: ["居住", "Home", "住居", "주거"] },
  { id: "health",    emoji: "💊", color: "#5AC8E0", label: ["醫療", "Health", "医療", "의료"] },
  { id: "study",     emoji: "📚", color: "#6C7AE0", label: ["學習", "Study", "学習", "학습"] },
  { id: "social",    emoji: "🎁", color: "#E8A0C0", label: ["人情", "Social", "交際", "경조사"] },
  { id: "other",     emoji: "📦", color: "#9AA5B1", label: ["其他", "Other", "その他", "기타"] },
];

export const INCOME_CATEGORIES = [
  { id: "salary",    emoji: "💰", color: "#4FAE7A", label: ["薪資", "Salary", "給与", "급여"] },
  { id: "bonus",     emoji: "🏆", color: "#E0B84A", label: ["獎金", "Bonus", "賞与", "상여"] },
  { id: "sidejob",   emoji: "💼", color: "#5AA9E0", label: ["兼職", "Side job", "副業", "부업"] },
  { id: "invest",    emoji: "📈", color: "#7BC47F", label: ["投資", "Invest", "投資", "투자"] },
  { id: "misc",      emoji: "✨", color: "#9AA5B1", label: ["其他", "Other", "その他", "기타"] },
];

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const categoriesFor = (type) => (type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);

export const findCategory = (id, type) =>
  ALL.find((c) => c.id === id) || categoriesFor(type)[categoriesFor(type).length - 1];

// tr 是 MaliPhone 的四語系函式：tr(zh, en, ja, ko)
export const categoryLabel = (category, tr) => tr(...(category?.label || ["其他", "Other", "その他", "기타"]));
