// 測試站專用信件只在 VITE_TEST_GRANTS_ENABLED=true 的建置才會包進程式，正式版的 bundle 裡不會有這段文字。
/* global __MALI_TEST_GRANTS__ */
const INCLUDE_TEST_GRANTS = typeof __MALI_TEST_GRANTS__ !== "undefined" && __MALI_TEST_GRANTS__ === true;

const TEST_GRANT_MAIL = {
  // 僅私人測試站建置（VITE_TEST_GRANTS_ENABLED=true）會出現，用來測試抽卡。
  id: "test-gacha-grant-2026-10",
  testOnly: true,
  sender: "MaliPhone 營運組",
  title: "測試站專用：抽卡測試結晶",
  content: "感謝參與測試！這封信附上 100,000 靈魂結晶，請盡情測試抽卡與信風，並把任何問題或感想回報給我們。",
  createdAt: "2026-10-15T00:00:00+08:00",
  expiresAt: "2027-12-31T00:00:00+08:00",
  attachments: [
    { grantId: "test-gacha-grant-2026-10-crystals", type: "crystals", amount: 100000, label: "靈魂結晶" },
  ],
  translations: {
    "zh-CN": {
      sender: "MaliPhone 运营组",
      title: "测试站专用：抽卡测试结晶",
      content: "感谢参与测试！这封信附上 100,000 灵魂结晶，请尽情测试抽卡与信风，并把任何问题或感想反馈给我们。",
      attachments: [{ label: "灵魂结晶" }],
    },
    en: {
      sender: "MaliPhone Operations",
      title: "Test Site Only: Gacha Test Crystals",
      content: "Thanks for testing! This mail includes 100,000 Soul Crystals. Please try the gacha and Tradewind features freely and send us any issues or thoughts.",
      attachments: [{ label: "Soul Crystal" }],
    },
    ja: {
      sender: "MaliPhone 運営チーム",
      title: "テスト環境限定：ガチャ用テスト結晶",
      content: "テストへのご参加ありがとうございます！このメールには魂の結晶 100,000 個が付いています。ガチャと信風機能を自由に試し、問題や感想をお知らせください。",
      attachments: [{ label: "魂の結晶" }],
    },
    ko: {
      sender: "MaliPhone 운영팀",
      title: "테스트 서버 전용: 가챠 테스트 결정",
      content: "테스트에 참여해 주셔서 감사합니다! 이 우편에는 영혼의 결정 100,000개가 들어 있습니다. 가챠와 신풍 기능을 자유롭게 시험해 보시고 문제나 감상을 알려주세요.",
      attachments: [{ label: "영혼의 결정" }],
    },
  },
};

export const SYSTEM_MAILS = Object.freeze([
  ...(INCLUDE_TEST_GRANTS ? [TEST_GRANT_MAIL] : []),
  {
    // 1.5.0 櫻色誓約開放紀念。領取紀錄跟著玩家資料（每份資料限領一次，小舞 2026-10-19 選 A）。
    id: "sakura-vow-launch-2026-10",
    sender: "MaliPhone 營運組",
    title: "櫻色誓約開放紀念",
    content: "櫻色誓約正式開放了！到遊戲中心召喚屬於你們的心意卡，再把珍藏送給喜歡的角色，展開只屬於你們的特別篇。這封信附上 10,000 靈魂結晶，祝你抽到心動的那一張。",
    createdAt: "2026-10-19T00:00:00+08:00",
    expiresAt: null,
    attachments: [
      { grantId: "sakura-vow-launch-2026-10-crystals", type: "crystals", amount: 10000, label: "靈魂結晶" },
    ],
    translations: {
      "zh-CN": {
        sender: "MaliPhone 运营组",
        title: "樱色誓约开放纪念",
        content: "樱色誓约正式开放了！到游戏中心召唤属于你们的心意卡，再把珍藏送给喜欢的角色，展开只属于你们的特别篇。这封信附上 10,000 灵魂结晶，祝你抽到心动的那一张。",
        attachments: [{ label: "灵魂结晶" }],
      },
      en: {
        sender: "MaliPhone Operations",
        title: "Sakura Vow Launch Gift",
        content: "Sakura Vow is now open! Summon heartfelt cards in the Game Center, then give one to a character you love to begin a special episode that's yours alone. This mail includes 10,000 Soul Crystals. May you draw the card that makes your heart skip.",
        attachments: [{ label: "Soul Crystal" }],
      },
      ja: {
        sender: "MaliPhone 運営チーム",
        title: "桜色の誓い 開放記念",
        content: "「桜色の誓い」が正式にオープンしました！ゲームセンターで想いのカードを召喚し、お気に入りのキャラクターに贈って、ふたりだけの特別編を始めましょう。魂の結晶 10,000 個をお届けします。ときめく一枚に出会えますように。",
        attachments: [{ label: "魂の結晶" }],
      },
      ko: {
        sender: "MaliPhone 운영팀",
        title: "벚꽃빛 서약 오픈 기념",
        content: "「벚꽃빛 서약」이 정식으로 열렸어요! 게임 센터에서 마음의 카드를 소환하고, 좋아하는 캐릭터에게 선물해 두 사람만의 특별편을 시작해 보세요. 영혼의 결정 10,000개를 보내 드려요. 설레는 한 장을 만나길 바라요.",
        attachments: [{ label: "영혼의 결정" }],
      },
    },
  },
  {
    id: "mailbox-launch-2026-07",
    sender: "MaliPhone 營運組",
    title: "系統信箱啟用紀念",
    content: "系統信箱已正式啟用！今後的活動獎勵、維護補償與特別贈禮都會透過這裡送達。",
    createdAt: "2026-07-16T00:00:00+08:00",
    expiresAt: null,
    attachments: [
      { grantId: "mailbox-launch-2026-07-crystals", type: "crystals", amount: 1000, label: "靈魂結晶" },
    ],
    translations: {
      "zh-CN": {
        sender: "MaliPhone 运营组",
        title: "系统邮箱启用纪念",
        content: "系统邮箱现已正式启用！今后的活动奖励、维护补偿与特别赠礼都会通过这里送达。",
        attachments: [{ label: "灵魂结晶" }],
      },
      en: {
        sender: "MaliPhone Operations",
        title: "System Mailbox Launch Gift",
        content: "The system mailbox is now live! Future event rewards, maintenance compensation, and special gifts will be delivered here.",
        attachments: [{ label: "Soul Crystal" }],
      },
      ja: {
        sender: "MaliPhone 運営チーム",
        title: "システムメール開始記念",
        content: "システムメールを正式に開始しました！今後のイベント報酬、メンテナンス補償、特別な贈り物はここに届きます。",
        attachments: [{ label: "魂の結晶" }],
      },
      ko: {
        sender: "MaliPhone 운영팀",
        title: "시스템 우편함 개설 기념",
        content: "시스템 우편함이 정식으로 열렸습니다! 앞으로의 이벤트 보상, 점검 보상 및 특별 선물은 이곳으로 전달됩니다.",
        attachments: [{ label: "영혼의 결정" }],
      },
    },
  },
]);
