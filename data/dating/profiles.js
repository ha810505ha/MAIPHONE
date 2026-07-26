/**
 * 交友 App 的角色池，唯一資料來源。
 *
 * 一筆分兩層：
 *   profile   — 滑卡時看得到的交友檔案。bio 要像真人在寫自介，不是角色設定表。
 *   character — 配對成功後丟進 addCharacter() 的角色卡，欄位對齊聯絡人。
 *
 * dislikes 是隱藏設定，永遠不顯示在卡片上。沒有人會在交友檔案寫自己討厭什麼，
 * 這也剛好讓玩家無法反向工程去迎合，踩雷永遠是意外。
 *
 * responseStyle  配對通知要等多久，也決定在線時打字打多久（instant / normal / slow）
 * pace           聊到多熟才會出現「交換聯絡方式」（fast / normal / slow）
 * onlineHours    在線時段，可跨午夜。時段外傳訊息，他上線後才會一次回完。
 *                要跟標籤對上——標了「夜貓子」卻 07:00 就上線會很怪。
 * photos         放在 public/dating-photos/ 下；留空會自動用漸層底加名字首字。
 */
export const DATING_PROFILES = Object.freeze([
  {
    id: "lin-yuchen",
    responseStyle: "normal",
    pace: "normal",
    onlineHours: { start: "06:00", end: "22:00" },
    profile: {
      name: "林雨宸",
      age: 26,
      job: "獨立咖啡店主",
      distance: 3,
      bio: "開店第四年，每天最喜歡的時段是還沒開門的早上七點。\n喜歡安靜但不排斥吵鬧的人。找一個願意陪我試新豆子的人。",
      photos: [],
      tags: ["coffee", "morning", "reading", "cat", "quiet", "stable"],
    },
    dislikes: ["smoke", "workaholic"],
    openingMessage: "欸，真的配對到了。\n我看你檔案很久了，一直在想要不要滑右邊。",
    superLikeOpeningMessage: "你給我 Super Like 喔？\n⋯⋯有點害羞，但我承認我開心了一下。",
    character: {
      name: "林雨宸",
      avatar: "",
      description: "26 歲，開了四年的獨立咖啡店店主。話不多但很穩，習慣用做事代替說話。",
      personality: "外冷內熱，慢熱但一旦熟了會很黏。討厭應酬和菸味。對咖啡的事會突然變得很多話。",
      relationshipToUser: "信風配對",
      tags: ["咖啡", "慢熱", "溫柔"],
    },
  },
  {
    id: "zhou-che",
    responseStyle: "instant",
    pace: "fast",
    onlineHours: { start: "09:00", end: "02:00" },
    profile: {
      name: "周澈",
      age: 29,
      job: "接案攝影師",
      distance: 8,
      bio: "上禮拜在花蓮拍到很好看的日出，這禮拜人已經在台北了。\n手機大概三秒回一次，不是因為閒，是因為真的想聊。",
      photos: [],
      tags: ["photography", "spontaneous", "travel", "roadtrip", "talkative", "humor", "drinking"],
    },
    dislikes: ["homebody", "routine"],
    openingMessage: "配對到了欸！\n我先講喔，我回訊息很快，如果覺得煩要跟我說。",
    superLikeOpeningMessage: "Super Like？欸這我第一次收到。\n那我現在講話是不是要帥一點。",
    character: {
      name: "周澈",
      avatar: "",
      description: "29 歲接案攝影師，全台跑透透，很少待在同一個城市超過兩週。",
      personality: "外向、話多、回訊息極快。喜歡把人拉出門。受不了一成不變的生活，會直接說出口。",
      relationshipToUser: "信風配對",
      tags: ["攝影", "外向", "說走就走"],
    },
  },
  {
    id: "shen-wanning",
    responseStyle: "slow",
    pace: "slow",
    onlineHours: { start: "21:00", end: "03:00" },
    profile: {
      name: "沈晚寧",
      age: 31,
      job: "大學圖書館員",
      distance: 15,
      bio: "一天大概講不到二十句話，但寫得比講得多。\n如果你不介意我隔很久才回，我們可能會處得不錯。",
      photos: [],
      tags: ["reading", "quiet", "homebody", "cat", "nightowl", "needsspace", "vegetarian"],
    },
    dislikes: ["clingy", "karaoke", "extreme"],
    openingMessage: "……嗨。\n抱歉，我不太會開頭。",
    superLikeOpeningMessage: "我看到你用了 Super Like。\n我盯著那個通知看了好久，還是決定回你了。",
    character: {
      name: "沈晚寧",
      avatar: "",
      description: "31 歲大學圖書館員，寡言，習慣用文字表達。作息偏晚。",
      personality: "極度慢熱、需要大量獨處時間。回訊息慢但每一句都想過。被逼近會退。文字裡比說話溫柔得多。",
      relationshipToUser: "信風配對",
      tags: ["安靜", "慢熱", "文字"],
    },
  },
]);
