/**
 * 信風 App 的共用興趣標籤。
 *
 * id 是配對與儲存資料的穩定鍵；labels 依序為繁中、英文、日文、韓文。
 * 不要改動既有 id，以免舊的玩家檔案與角色資料失去可辨識的標籤。
 */
const labelSet = (zhTW, en, ja, ko) => Object.freeze([zhTW, en, ja, ko]);
const category = (id, ...labels) => Object.freeze({ id, labels: labelSet(...labels) });
const tag = (id, categoryId, ...labels) => Object.freeze({ id, category: categoryId, labels: labelSet(...labels) });

export const INTEREST_CATEGORIES = Object.freeze([
  category("life", "生活方式", "Lifestyle", "ライフスタイル", "라이프스타일"),
  category("hobby", "興趣娛樂", "Interests", "趣味・エンタメ", "취미·엔터테인먼트"),
  category("sport", "運動", "Fitness", "スポーツ", "운동"),
  category("food", "飲食", "Food & drink", "食・ドリンク", "음식·음료"),
  category("travel", "旅行", "Travel", "旅行", "여행"),
  category("pet", "寵物", "Pets", "ペット", "반려동물"),
  category("personality", "相處方式", "Social style", "人付き合い", "관계 스타일"),
  category("values", "價值觀", "Values", "価値観", "가치관"),
]);

export const INTEREST_TAGS = Object.freeze([
  // 生活方式
  tag("morning", "life", "早起", "Early bird", "朝型", "아침형"),
  tag("nightowl", "life", "夜貓子", "Night owl", "夜型", "올빼미형"),
  tag("homebody", "life", "宅在家", "Homebody", "おうち派", "집순이·집돌이"),
  tag("spontaneous", "life", "說走就走", "Spontaneous", "思い立ったらすぐ", "즉흥 여행"),
  tag("routine", "life", "規律生活", "Routine", "規則正しい生活", "규칙적인 생활"),
  tag("workaholic", "life", "工作狂", "Work-driven", "仕事好き", "일 중심"),
  tag("remotework", "life", "遠端工作", "Remote work", "リモートワーク", "재택근무"),
  tag("citywalk", "life", "城市散步", "City walks", "街歩き", "도시 산책"),
  tag("minimalism", "life", "極簡生活", "Minimalism", "ミニマル生活", "미니멀 라이프"),
  tag("journaling", "life", "寫日記", "Journaling", "日記", "일기 쓰기"),
  tag("thrifting", "life", "二手尋寶", "Thrifting", "古着・リユース", "빈티지 쇼핑"),

  // 興趣娛樂
  tag("coffee", "hobby", "手沖咖啡", "Coffee", "コーヒー", "커피"),
  tag("tea", "hobby", "品茶", "Tea", "お茶", "차"),
  tag("movie", "hobby", "電影", "Movies", "映画", "영화"),
  tag("drama", "hobby", "影集", "TV series", "ドラマ", "드라마"),
  tag("reading", "hobby", "閱讀", "Reading", "読書", "독서"),
  tag("writing", "hobby", "寫作", "Writing", "執筆", "글쓰기"),
  tag("podcast", "hobby", "Podcast", "Podcasts", "ポッドキャスト", "팟캐스트"),
  tag("livemusic", "hobby", "現場音樂", "Live music", "ライブ音楽", "라이브 음악"),
  tag("festival", "hobby", "音樂祭", "Music festivals", "音楽フェス", "음악 페스티벌"),
  tag("photography", "hobby", "攝影", "Photography", "写真", "사진"),
  tag("videography", "hobby", "拍影片", "Videography", "動画撮影", "영상 촬영"),
  tag("drawing", "hobby", "畫畫", "Drawing", "お絵描き", "그림"),
  tag("design", "hobby", "設計", "Design", "デザイン", "디자인"),
  tag("crafts", "hobby", "手作", "Crafts", "ハンドメイド", "공예"),
  tag("pottery", "hobby", "陶藝", "Pottery", "陶芸", "도예"),
  tag("gaming", "hobby", "電玩", "Gaming", "ゲーム", "게임"),
  tag("boardgame", "hobby", "桌遊", "Board games", "ボードゲーム", "보드게임"),
  tag("anime", "hobby", "動畫", "Anime", "アニメ", "애니메이션"),
  tag("manga", "hobby", "漫畫", "Manga", "マンガ", "만화"),
  tag("karaoke", "hobby", "唱歌", "Karaoke", "カラオケ", "노래방"),
  tag("gardening", "hobby", "園藝", "Gardening", "ガーデニング", "가드닝"),
  tag("museum", "hobby", "逛展覽", "Museums & galleries", "美術館・展示", "전시 관람"),
  tag("languagelearning", "hobby", "學語言", "Language learning", "語学学習", "언어 공부"),
  tag("coding", "hobby", "寫程式", "Coding", "プログラミング", "코딩"),
  tag("astronomy", "hobby", "觀星", "Stargazing", "星空観察", "별 관찰"),

  // 運動
  tag("gym", "sport", "健身", "Gym", "ジム", "헬스"),
  tag("running", "sport", "跑步", "Running", "ランニング", "러닝"),
  tag("hiking", "sport", "登山", "Hiking", "登山", "등산"),
  tag("cycling", "sport", "單車", "Cycling", "サイクリング", "자전거"),
  tag("swimming", "sport", "游泳", "Swimming", "水泳", "수영"),
  tag("yoga", "sport", "瑜伽", "Yoga", "ヨガ", "요가"),
  tag("dance", "sport", "跳舞", "Dancing", "ダンス", "댄스"),
  tag("ballsports", "sport", "球類運動", "Ball sports", "球技", "구기 종목"),
  tag("badminton", "sport", "羽球", "Badminton", "バドミントン", "배드민턴"),
  tag("tennis", "sport", "網球", "Tennis", "テニス", "테니스"),
  tag("climbing", "sport", "攀岩", "Climbing", "クライミング", "클라이밍"),
  tag("surfing", "sport", "衝浪", "Surfing", "サーフィン", "서핑"),
  tag("martialarts", "sport", "武術", "Martial arts", "武道", "무술"),
  tag("extreme", "sport", "極限運動", "Extreme sports", "エクストリームスポーツ", "익스트림 스포츠"),

  // 飲食
  tag("foodie", "food", "美食探索", "Foodie", "食べ歩き", "맛집 탐방"),
  tag("cooking", "food", "做菜", "Cooking", "料理", "요리"),
  tag("baking", "food", "烘焙", "Baking", "お菓子作り", "베이킹"),
  tag("dessert", "food", "甜點", "Desserts", "スイーツ", "디저트"),
  tag("brunch", "food", "早午餐", "Brunch", "ブランチ", "브런치"),
  tag("spicy", "food", "吃辣", "Spicy food", "辛いもの", "매운 음식"),
  tag("vegetarian", "food", "素食", "Vegetarian", "ベジタリアン", "채식"),
  tag("vegan", "food", "全素", "Vegan", "ヴィーガン", "비건"),
  tag("drinking", "food", "小酌", "Drinks", "お酒", "가벼운 술"),
  tag("wine", "food", "葡萄酒", "Wine", "ワイン", "와인"),
  tag("craftbeer", "food", "精釀啤酒", "Craft beer", "クラフトビール", "수제 맥주"),
  tag("latenightsnack", "food", "宵夜", "Late-night snacks", "夜食", "야식"),

  // 旅行
  tag("travel", "travel", "出國旅行", "International travel", "海外旅行", "해외여행"),
  tag("camping", "travel", "露營", "Camping", "キャンプ", "캠핑"),
  tag("beach", "travel", "海邊", "Beach trips", "海", "바다 여행"),
  tag("mountains", "travel", "山林旅行", "Mountain trips", "山旅", "산 여행"),
  tag("citybreak", "travel", "城市小旅行", "City breaks", "都市旅行", "도시 여행"),
  tag("solotravel", "travel", "獨旅", "Solo travel", "ひとり旅", "혼자 여행"),
  tag("roadtrip", "travel", "公路旅行", "Road trips", "ロードトリップ", "로드 트립"),
  tag("backpacking", "travel", "背包旅行", "Backpacking", "バックパッカー旅", "배낭여행"),

  // 寵物
  tag("cat", "pet", "貓派", "Cat person", "猫派", "고양이파"),
  tag("dog", "pet", "狗派", "Dog person", "犬派", "강아지파"),
  tag("haspet", "pet", "有養寵物", "Has pets", "ペットと暮らす", "반려동물과 함께"),
  tag("birds", "pet", "鳥類", "Birds", "鳥", "새"),
  tag("smallpets", "pet", "小動物", "Small pets", "小動物", "소동물"),
  tag("animalwelfare", "pet", "動物保護", "Animal welfare", "動物保護", "동물 보호"),

  // 相處方式
  tag("slowwarm", "personality", "慢熱", "Slow to warm up", "人見知り", "낯가림"),
  tag("talkative", "personality", "健談", "Talkative", "話好き", "수다쟁이"),
  tag("humor", "personality", "幽默感", "Sense of humor", "ユーモア", "유머"),
  tag("quiet", "personality", "安靜", "Quiet", "静か", "차분함"),
  tag("direct", "personality", "直接溝通", "Direct communicator", "率直", "솔직한 소통"),
  tag("stable", "personality", "情緒穩定", "Emotionally steady", "安定志向", "정서적 안정"),
  tag("clingy", "personality", "喜歡黏在一起", "Likes lots of time together", "いつも一緒が好き", "함께하는 시간 선호"),
  tag("needsspace", "personality", "需要個人空間", "Needs personal space", "ひとり時間も大切", "개인 시간 필요"),
  tag("listener", "personality", "善於傾聽", "Good listener", "聞き上手", "경청형"),
  tag("curious", "personality", "好奇心旺盛", "Curious", "好奇心旺盛", "호기심 많음"),
  tag("affectionate", "personality", "會表達關心", "Affectionate", "愛情表現豊か", "애정 표현형"),
  tag("introvert", "personality", "內向", "Introvert", "内向的", "내향형"),
  tag("extrovert", "personality", "外向", "Extrovert", "外向的", "외향형"),
  tag("empathetic", "personality", "重視同理", "Empathetic", "共感力がある", "공감 능력"),

  // 價值觀
  tag("settle", "values", "想穩定交往", "Seeking a committed relationship", "真剣な交際希望", "진지한 만남"),
  tag("gowithflow", "values", "順其自然", "Go with the flow", "自然体", "자연스러운 관계"),
  tag("friendsfirst", "values", "先從朋友開始", "Friends first", "まずは友達から", "친구부터"),
  tag("career", "values", "重視事業", "Career-focused", "仕事を大切に", "커리어 중시"),
  tag("family", "values", "重視家人", "Family-oriented", "家族を大切に", "가족 중시"),
  tag("nosmoke", "values", "不抽菸", "Non-smoker", "禁煙", "비흡연"),
  tag("smoke", "values", "抽菸", "Smoker", "喫煙", "흡연"),
  tag("sustainability", "values", "永續生活", "Sustainability", "サステナブル", "지속가능성"),
  tag("equality", "values", "平等尊重", "Equality & respect", "平等と尊重", "평등과 존중"),
  tag("honesty", "values", "坦誠溝通", "Honest communication", "誠実な対話", "솔직한 대화"),
  tag("financialplanning", "values", "理財規劃", "Financial planning", "資産形成", "재무 계획"),
]);

const CATEGORY_MAP = new Map(INTEREST_CATEGORIES.map((item) => [item.id, item]));
const TAG_MAP = new Map(INTEREST_TAGS.map((item) => [item.id, item]));

const localizedLabel = (item, tr) => {
  const labels = item?.labels;
  if (!labels) return "";
  return typeof tr === "function" ? tr(...labels) : labels[0];
};

export const categoryLabel = (id, tr) => localizedLabel(CATEGORY_MAP.get(id), tr) || id;
export const tagLabel = (id, tr) => localizedLabel(TAG_MAP.get(id), tr) || id;
export const tagsByCategory = (categoryId) => INTEREST_TAGS.filter((item) => item.category === categoryId);
export const isValidTag = (id) => TAG_MAP.has(id);

export function groupTags(tagIds = []) {
  return INTEREST_CATEGORIES
    .map((item) => ({ ...item, tags: tagIds.filter((id) => TAG_MAP.get(id)?.category === item.id) }))
    .filter((group) => group.tags.length);
}
