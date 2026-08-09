export const SYSTEM_MAILS = Object.freeze([
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
