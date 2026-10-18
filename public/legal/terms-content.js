/* global window */
// 服務條款內容（五語系）。經 Codex 對照消保法定型化契約常見問題審閱。
// 點數／付費相關條款待點數制度上線時另行新增。
(function () {
  var MAIL = '<a href="mailto:support@maliphone.com">support@maliphone.com</a>';
  window.MALI_LEGAL = { doc: "terms", content: {} };
  var C = window.MALI_LEGAL.content;

  C["zh-TW"] = {
    title: "MaliPhone 服務條款",
    updated: "生效日期：2026 年 10 月 15 日",
    intro: [
      "歡迎來到 MaliPhone。這份條款說明你和營運者之間的約定，本頁會一直公開，方便你隨時閱讀或保存。請在開始使用前看完；使用本服務即表示你同意這些內容，如果不同意，請不要使用。",
      "本服務由個人開發者營運，下文的「營運者」即指營運 MaliPhone 的這位個人開發者。資料如何處理，請見<a href=\"./privacy?lang=zh-TW\">隱私權政策</a>。"
    ],
    sections: [
      { h: "一、這是什麼服務", blocks: [
        { p: "MaliPhone 是一個以手機介面呈現的 AI 角色互動空間，包含聊天、社群、錢包、日曆、小遊戲等功能。角色與情境由你設定，回覆由 AI 產生。" }
      ] },
      { h: "二、使用資格", blocks: [
        { ul: [
          "你必須年滿 18 歲。",
          "若你所在地的法律對這類服務有更高的年齡要求，請依當地規定。"
        ] }
      ] },
      { h: "三、帳號", blocks: [
        { ul: [
          "登入是選用的。登入時請使用你本人的 Email，並保管好登入方式。",
          "帳號只限本人使用。除了因營運者的系統問題造成的情形，帳號底下的操作由你負責。",
          "發現帳號遭他人使用時，請盡快通知營運者，以便協助處理。"
        ] }
      ] },
      { h: "四、關於 AI 內容", blocks: [
        { ul: [
          "角色與情節都是虛構的，不代表任何真實人物、事件或營運者的立場。",
          "AI 可能說錯、前後矛盾或產生不恰當的內容。請不要把它當成醫療、法律、財務、心理健康或其他專業建議。",
          "如果你正面臨危機或有傷害自己的念頭，請直接聯絡身邊信任的人或專業求助管道。"
        ] }
      ] },
      { h: "五、自備 API Key", blocks: [
        { ul: [
          "使用自己的 API Key 時，你與該服務商之間另有約定。費用、用量上限與內容規範，依該服務商的條款處理。",
          "因使用自己的 Key 產生的費用，由你自行負擔。"
        ] }
      ] },
      { h: "六、你的內容", blocks: [
        { ul: [
          "你對自己建立或上傳的內容原本享有的權利，不會因為使用本服務而轉移給營運者。AI 產生的文字依法不一定受著作權保護。",
          "為了讓功能正常運作，例如儲存、同步、傳給 AI 產生回覆，你同意營運者在必要範圍內處理這些內容，不會挪作他用。",
          "你上傳或輸入的內容不得侵害他人權利。使用他人的角色設定、圖片，或真實人物的照片與身分前，請先確認你有權使用或已取得同意。"
        ] }
      ] },
      { h: "七、不可以做的事", blocks: [
        { ul: [
          "違反中華民國法律或你所在地的法律",
          "產生、索取或散布任何與未成年人有關的性內容",
          "冒充真實人物或機構，或未經同意散布他人的個人資料",
          "騷擾、威脅、詐騙，或煽動暴力與仇恨",
          "鼓勵自殘或自殺",
          "侵害他人的著作權、商標或其他權利",
          "攻擊或干擾本服務，或用程式大量存取、繞過額度限制"
        ] }
      ] },
      { h: "八、違規處理與申訴", blocks: [
        { p: "發現違規時，營運者會依情節輕重採取以下措施：通知改善、限制內建 AI 功能、暫停或終止帳號。除非情節重大或依法需要立即處理，營運者會先寄信通知你原因。涉及兒少性剝削等違法內容，會依法通報主管機關。" },
        { p: "如果你認為處理有誤，可以在收到通知後 14 天內寫信到 " + MAIL + " 申訴，營運者會重新檢視並回覆結果。帳號被暫停或終止時，你裝置上的資料不受影響。" }
      ] },
      { h: "九、遊戲內道具", blocks: [
        { p: "靈魂結晶、卡片等遊戲內道具只能在本服務內使用，沒有金錢價值，不能兌換現金，也不能轉讓。道具的內容、取得方式與數值可能隨版本調整。" }
      ] },
      { h: "十、智慧財產權", blocks: [
        { p: "本服務的程式碼、名稱、圖示、介面設計、內建角色、文字與素材，屬於營運者或其授權人所有，並保留所有權利。未經營運者事前書面同意，不得複製、修改、散布、販售，或以本服務為基礎製作衍生作品。部分素材與第三方開源套件依其各自的授權條款使用，詳見 App 內「素材授權與致謝」。" }
      ] },
      { h: "十一、服務變更、中斷與終止", blocks: [
        { ul: [
          "營運者可能新增、調整或移除功能，也可能因維護或不可抗力暫停服務。重大變更會盡量提前公告。",
          "營運者會盡力維持服務穩定，但無法保證永不中斷或完全沒有錯誤。",
          "你的資料主要存在自己的裝置上，建議定期使用備份功能。",
          "若本服務決定停止營運，會在至少 30 天前於 App 內公告，讓你有時間備份資料。",
          "你可以隨時停止使用。刪除帳號的方式請見隱私權政策。"
        ] }
      ] },
      { h: "十二、責任", blocks: [
        { p: "本服務目前免費提供。在法律允許的範圍內，因裝置故障、清除瀏覽器資料、第三方服務中斷，或你使用自己的 API Key 所產生的損失，營運者不負賠償責任。" },
        { p: "但因營運者的故意或重大過失造成的損害，以及法律規定不得排除的責任，營運者仍依法負責。" }
      ] },
      { h: "十三、條款更新", blocks: [
        { p: "條款更新時會修改生效日期。對你權益有重大影響的變更，會在生效至少 7 天前於 App 內公告。如果你不同意新條款，可以停止使用並申請刪除帳號；生效後繼續使用，即視為同意。" }
      ] },
      { h: "十四、準據法與管轄", blocks: [
        { p: "本條款以中華民國法律為準據法。因本服務產生的爭議，以臺灣高雄地方法院為第一審管轄法院。這不影響你依《消費者保護法》第 47 條，向消費關係發生地的法院提起訴訟的權利。" }
      ] },
      { h: "十五、聯絡營運者", blocks: [
        { p: "營運者：MaliPhone（個人開發者營運）<br>Email：" + MAIL }
      ] }
    ]
  };

  C["zh-CN"] = {
    title: "MaliPhone 服务条款",
    updated: "生效日期：2026 年 10 月 15 日",
    intro: [
      "欢迎来到 MaliPhone。这份条款说明你和运营者之间的约定，本页会一直公开，方便你随时阅读或保存。请在开始使用前看完；使用本服务即表示你同意这些内容，如果不同意，请不要使用。",
      "本服务由个人开发者运营，下文的“运营者”即指运营 MaliPhone 的这位个人开发者。数据如何处理，请见<a href=\"./privacy?lang=zh-CN\">隐私政策</a>。"
    ],
    sections: [
      { h: "一、这是什么服务", blocks: [
        { p: "MaliPhone 是一个以手机界面呈现的 AI 角色互动空间，包含聊天、社区、钱包、日历、小游戏等功能。角色与情境由你设定，回复由 AI 生成。" }
      ] },
      { h: "二、使用资格", blocks: [
        { ul: [
          "你必须年满 18 岁。",
          "若你所在地的法律对这类服务有更高的年龄要求，请依当地规定。"
        ] }
      ] },
      { h: "三、账号", blocks: [
        { ul: [
          "登录是可选的。登录时请使用你本人的 Email，并保管好登录方式。",
          "账号仅限本人使用。除了因运营者的系统问题造成的情形，账号下的操作由你负责。",
          "发现账号被他人使用时，请尽快通知运营者，以便协助处理。"
        ] }
      ] },
      { h: "四、关于 AI 内容", blocks: [
        { ul: [
          "角色与情节都是虚构的，不代表任何真实人物、事件或运营者的立场。",
          "AI 可能说错、前后矛盾或生成不恰当的内容。请不要把它当成医疗、法律、财务、心理健康或其他专业建议。",
          "如果你正面临危机或有伤害自己的念头，请直接联系身边信任的人或专业求助渠道。"
        ] }
      ] },
      { h: "五、自备 API Key", blocks: [
        { ul: [
          "使用自己的 API Key 时，你与该服务商之间另有约定。费用、用量上限与内容规范，依该服务商的条款处理。",
          "因使用自己的 Key 产生的费用，由你自行承担。"
        ] }
      ] },
      { h: "六、你的内容", blocks: [
        { ul: [
          "你对自己创建或上传的内容原本享有的权利，不会因为使用本服务而转移给运营者。AI 生成的文字依法不一定受著作权保护。",
          "为了让功能正常运作，例如保存、同步、发送给 AI 生成回复，你同意运营者在必要范围内处理这些内容，不会挪作他用。",
          "你上传或输入的内容不得侵害他人权利。使用他人的角色设定、图片，或真实人物的照片与身份前，请先确认你有权使用或已取得同意。"
        ] }
      ] },
      { h: "七、不可以做的事", blocks: [
        { ul: [
          "违反中华民国法律或你所在地的法律",
          "生成、索取或传播任何与未成年人有关的性内容",
          "冒充真实人物或机构，或未经同意传播他人的个人数据",
          "骚扰、威胁、欺诈，或煽动暴力与仇恨",
          "鼓励自残或自杀",
          "侵害他人的著作权、商标或其他权利",
          "攻击或干扰本服务，或用程序大量访问、绕过额度限制"
        ] }
      ] },
      { h: "八、违规处理与申诉", blocks: [
        { p: "发现违规时，运营者会依情节轻重采取以下措施：通知改善、限制内置 AI 功能、暂停或终止账号。除非情节重大或依法需要立即处理，运营者会先发邮件告知你原因。涉及儿童及未成年人性剥削等违法内容，会依法通报主管机关。" },
        { p: "如果你认为处理有误，可以在收到通知后 14 天内写信到 " + MAIL + " 申诉，运营者会重新审查并回复结果。账号被暂停或终止时，你设备上的数据不受影响。" }
      ] },
      { h: "九、游戏内道具", blocks: [
        { p: "灵魂结晶、卡片等游戏内道具只能在本服务内使用，没有金钱价值，不能兑换现金，也不能转让。道具的内容、获取方式与数值可能随版本调整。" }
      ] },
      { h: "十、知识产权", blocks: [
        { p: "本服务的代码、名称、图标、界面设计、内置角色、文字与素材，属于运营者或其授权方所有，并保留所有权利。未经运营者事先书面同意，不得复制、修改、分发、销售，或以本服务为基础制作衍生作品。部分素材与第三方开源软件包依其各自的授权条款使用，详见 App 内“素材授权与致谢”。" }
      ] },
      { h: "十一、服务变更、中断与终止", blocks: [
        { ul: [
          "运营者可能新增、调整或移除功能，也可能因维护或不可抗力暂停服务。重大变更会尽量提前公告。",
          "运营者会尽力维持服务稳定，但无法保证永不中断或完全没有错误。",
          "你的数据主要保存在自己的设备上，建议定期使用备份功能。",
          "若本服务决定停止运营，会在至少 30 天前于 App 内公告，让你有时间备份数据。",
          "你可以随时停止使用。删除账号的方式请见隐私政策。"
        ] }
      ] },
      { h: "十二、责任", blocks: [
        { p: "本服务目前免费提供。在法律允许的范围内，因设备故障、清除浏览器数据、第三方服务中断，或你使用自己的 API Key 所产生的损失，运营者不负赔偿责任。" },
        { p: "但因运营者的故意或重大过失造成的损害，以及法律规定不得排除的责任，运营者仍依法负责。" }
      ] },
      { h: "十三、条款更新", blocks: [
        { p: "条款更新时会修改生效日期。对你权益有重大影响的变更，会在生效至少 7 天前于 App 内公告。如果你不同意新条款，可以停止使用并申请删除账号；生效后继续使用，即视为同意。" }
      ] },
      { h: "十四、准据法与管辖", blocks: [
        { p: "本条款以中华民国法律为准据法。因本服务产生的争议，以台湾高雄地方法院（臺灣高雄地方法院）为第一审管辖法院。这不影响你依《消费者保护法》第 47 条，向消费关系发生地的法院提起诉讼的权利。" }
      ] },
      { h: "十五、联系运营者", blocks: [
        { p: "运营者：MaliPhone（个人开发者运营）<br>Email：" + MAIL }
      ] }
    ]
  };

  C.en = {
    title: "MaliPhone Terms of Service",
    updated: "Effective date: October 15, 2026",
    intro: [
      "Welcome to MaliPhone. These terms explain the agreement between you and us. This page will always stay public so you can read or save it at any time. Please read it before you start; by using the service you agree to these terms, and if you do not agree, please do not use it.",
      "This service is run by an individual developer, and \"we\" below means the individual developer who operates MaliPhone. For how data is handled, please see the <a href=\"./privacy?lang=en\">Privacy Policy</a>."
    ],
    sections: [
      { h: "1. What this service is", blocks: [
        { p: "MaliPhone is a space for interacting with AI characters, presented as a phone interface. It includes chat, social, wallet, calendar, small games and more. You set up the characters and situations, and the replies are generated by AI." }
      ] },
      { h: "2. Who can use it", blocks: [
        { ul: [
          "You must be at least 18 years old.",
          "If the law where you live sets a higher age requirement for this kind of service, please follow the local rules."
        ] }
      ] },
      { h: "3. Accounts", blocks: [
        { ul: [
          "Signing in is optional. When you sign in, please use your own Email and keep your sign-in method safe.",
          "An account is for its owner only. Except where caused by a problem with our systems, you are responsible for actions taken under your account.",
          "If you find your account being used by someone else, please tell us as soon as possible and we will help."
        ] }
      ] },
      { h: "4. About AI content", blocks: [
        { ul: [
          "Characters and storylines are fictional and do not represent any real person, event or our views.",
          "AI can be wrong, contradict itself or produce inappropriate content. Please do not treat it as medical, legal, financial, mental health or other professional advice.",
          "If you are in crisis or have thoughts of hurting yourself, please reach out directly to someone you trust or to a professional support service."
        ] }
      ] },
      { h: "5. Bringing your own API Key", blocks: [
        { ul: [
          "When you use your own API Key, you have a separate agreement with that provider. Fees, usage limits and content rules follow that provider's terms.",
          "Any fees incurred by using your own Key are yours to pay."
        ] }
      ] },
      { h: "6. Your content", blocks: [
        { ul: [
          "Rights you originally hold in content you create or upload are not transferred to us by using this service. Under the law, AI-generated text is not necessarily protected by copyright.",
          "So that features can work, for example saving, syncing, and sending content to AI to generate replies, you agree that we may process this content to the extent necessary, and we will not use it for anything else.",
          "Content you upload or enter must not infringe anyone's rights. Before using someone else's character settings or images, or a real person's photos and identity, please make sure you have the right to use them or have obtained consent."
        ] }
      ] },
      { h: "7. What you must not do", blocks: [
        { ul: [
          "Violate the laws of the Republic of China (Taiwan) or the laws where you live",
          "Generate, request or distribute any sexual content involving minors",
          "Impersonate a real person or organization, or distribute others' personal data without consent",
          "Harass, threaten or defraud others, or incite violence and hatred",
          "Encourage self-harm or suicide",
          "Infringe others' copyrights, trademarks or other rights",
          "Attack or disrupt this service, or use programs to access it in bulk or bypass quota limits"
        ] }
      ] },
      { h: "8. Handling violations and appeals", blocks: [
        { p: "When we find a violation, we will take one of the following measures depending on how serious it is: asking you to correct it, restricting the built-in AI features, or suspending or terminating the account. Unless the case is serious or the law requires immediate action, we will email you the reason first. Unlawful content such as the sexual exploitation of children and minors will be reported to the competent authorities as required by law." },
        { p: "If you think we got it wrong, you can appeal by writing to " + MAIL + " within 14 days of receiving the notice, and we will review it again and reply with the result. If your account is suspended or terminated, the data on your device is not affected." }
      ] },
      { h: "9. In-game items", blocks: [
        { p: "In-game items such as Soul Crystals and cards can only be used within this service. They have no monetary value, cannot be exchanged for cash, and cannot be transferred. The contents, ways of obtaining and values of items may change with new versions." }
      ] },
      { h: "10. Intellectual property", blocks: [
        { p: "The code, name, icons, interface design, built-in characters, text and assets of this service belong to the operator or its licensors, and all rights are reserved. Without the operator's prior written permission, you may not copy, modify, distribute, sell, or create derivative works based on this service. Some assets and third-party open-source packages are used under their own license terms; see \"Asset credits and licenses\" in the app." }
      ] },
      { h: "11. Changes, interruptions and termination of the service", blocks: [
        { ul: [
          "We may add, adjust or remove features, and may suspend the service for maintenance or force majeure. We will try to announce major changes in advance.",
          "We will do our best to keep the service stable, but we cannot guarantee it will never be interrupted or be completely free of errors.",
          "Your data is mostly stored on your own device, so we recommend using the backup feature regularly.",
          "If we decide to stop operating this service, we will announce it in the app at least 30 days in advance so you have time to back up your data.",
          "You can stop using the service at any time. For how to delete your account, please see the Privacy Policy."
        ] }
      ] },
      { h: "12. Liability", blocks: [
        { p: "This service is currently provided free of charge. To the extent permitted by law, we are not liable for losses caused by device failure, clearing browser data, interruptions of third-party services, or your use of your own API Key." },
        { p: "However, we remain liable as required by law for damage caused by our intentional misconduct or gross negligence, and for liability that the law does not allow to be excluded." }
      ] },
      { h: "13. Updates to these terms", blocks: [
        { p: "When the terms are updated, the effective date will be changed. For changes that significantly affect your rights, we will announce them in the app at least 7 days before they take effect. If you do not agree to the new terms, you can stop using the service and request that your account be deleted; if you keep using it after they take effect, you are considered to have agreed." }
      ] },
      { h: "14. Governing law and jurisdiction", blocks: [
        { p: "These terms are governed by the laws of the Republic of China (Taiwan). For disputes arising from this service, the Kaohsiung District Court in Taiwan is the court of first instance with jurisdiction. This does not affect your right under Article 47 of the Consumer Protection Act to bring a lawsuit in the court of the place where the consumer relationship arose." }
      ] },
      { h: "15. Contact us", blocks: [
        { p: "Operator: MaliPhone (run by an individual developer)<br>Email: " + MAIL }
      ] }
    ]
  };

  C.ja = {
    title: "MaliPhone 利用規約",
    updated: "施行日：2026年10月15日",
    intro: [
      "MaliPhone へようこそ。この規約は、あなたと運営者との間の約束事を説明するものです。このページは常に公開しており、いつでもお読みいただいたり保存したりできます。ご利用を始める前にお読みください。本サービスを利用することで、これらの内容に同意したものとみなします。同意いただけない場合は、ご利用をお控えください。",
      "本サービスは個人開発者が運営しており、以下の「運営者」とは、MaliPhone を運営しているこの個人開発者を指します。データの取り扱いについては、<a href=\"./privacy?lang=ja\">プライバシーポリシー</a>をご覧ください。"
    ],
    sections: [
      { h: "一、このサービスについて", blocks: [
        { p: "MaliPhone は、スマートフォンの画面の形で提供される、AI キャラクターと交流するためのスペースです。チャット、ソーシャル、ウォレット、カレンダー、ミニゲームなどの機能があります。キャラクターやシチュエーションはあなたが設定し、返信は AI が生成します。" }
      ] },
      { h: "二、利用資格", blocks: [
        { ul: [
          "18歳以上である必要があります。",
          "お住まいの地域の法律で、この種のサービスにより高い年齢要件が定められている場合は、その地域の規定に従ってください。"
        ] }
      ] },
      { h: "三、アカウント", blocks: [
        { ul: [
          "ログインは任意です。ログインする際はご自身のメールアドレスを使い、ログイン方法を大切に管理してください。",
          "アカウントは本人のみが使用できます。運営者のシステムの問題によって生じた場合を除き、アカウントで行われた操作はあなたの責任となります。",
          "アカウントが他人に使われていることに気づいた場合は、できるだけ早く運営者にご連絡ください。対応をお手伝いします。"
        ] }
      ] },
      { h: "四、AI のコンテンツについて", blocks: [
        { ul: [
          "キャラクターやストーリーは架空のものであり、実在の人物や出来事、運営者の見解を表すものではありません。",
          "AI は誤った内容を話したり、前後で矛盾したり、不適切な内容を生成したりすることがあります。医療、法律、金融、メンタルヘルスなどの専門的な助言として受け取らないでください。",
          "あなたが危機的な状況にあったり、自分を傷つけたい気持ちがあったりする場合は、身近で信頼できる人や専門の相談窓口に直接ご連絡ください。"
        ] }
      ] },
      { h: "五、ご自身の API Key の利用", blocks: [
        { ul: [
          "ご自身の API Key を使う場合、あなたとその提供元との間には別の取り決めがあります。料金、利用上限、コンテンツに関するルールは、その提供元の規約に従います。",
          "ご自身の Key を使って発生した費用は、あなたの負担となります。"
        ] }
      ] },
      { h: "六、あなたのコンテンツ", blocks: [
        { ul: [
          "あなたが作成またはアップロードしたコンテンツについて、もともとあなたが持っている権利は、本サービスを利用することで運営者に移転することはありません。AI が生成した文章は、法律上、必ずしも著作権で保護されるとは限りません。",
          "保存、同期、AI への送信による返信の生成など、機能を正常に動かすために、必要な範囲でこれらのコンテンツを運営者が処理することに同意するものとします。他の目的には使用しません。",
          "アップロードまたは入力するコンテンツは、他人の権利を侵害してはなりません。他人のキャラクター設定や画像、実在の人物の写真や身元情報を使う前に、使用する権利があるか、同意を得ているかを確認してください。"
        ] }
      ] },
      { h: "七、してはいけないこと", blocks: [
        { ul: [
          "中華民国（台湾）の法律、またはお住まいの地域の法律に違反すること",
          "未成年者に関わる性的なコンテンツを生成、要求、または拡散すること",
          "実在の人物や団体になりすますこと、または同意なく他人の個人データを拡散すること",
          "嫌がらせ、脅迫、詐欺、または暴力や憎悪の扇動を行うこと",
          "自傷や自殺を促すこと",
          "他人の著作権、商標、その他の権利を侵害すること",
          "本サービスを攻撃または妨害すること、またはプログラムで大量にアクセスしたり利用枠の制限を回避したりすること"
        ] }
      ] },
      { h: "八、違反への対応と異議申し立て", blocks: [
        { p: "違反を見つけた場合、運営者は内容の程度に応じて、改善の依頼、内蔵 AI 機能の制限、アカウントの一時停止または終了のいずれかの措置を取ります。内容が重大な場合や、法令により直ちに対応する必要がある場合を除き、先にメールで理由をお知らせします。児童や未成年者への性的搾取など違法なコンテンツについては、法令に基づき所管の機関に通報します。" },
        { p: "対応に誤りがあるとお考えの場合は、通知を受け取ってから14日以内に " + MAIL + " 宛にご連絡のうえ、異議を申し立てることができます。運営者は改めて内容を確認し、結果を返信します。アカウントが一時停止または終了された場合でも、あなたの端末内のデータには影響しません。" }
      ] },
      { h: "九、ゲーム内アイテム", blocks: [
        { p: "魂の結晶やカードなどのゲーム内アイテムは、本サービス内でのみ使用でき、金銭的価値はなく、現金に交換することも、譲渡することもできません。アイテムの内容、入手方法、数値は、バージョンによって調整されることがあります。" }
      ] },
      { h: "十、知的財産権", blocks: [
        { p: "本サービスのプログラムコード、名称、アイコン、画面デザイン、内蔵キャラクター、文章および素材は、運営者またはそのライセンサーに帰属し、すべての権利を留保します。運営者の事前の書面による許可なく、複製、改変、配布、販売、または本サービスを基にした二次的著作物の作成を行うことはできません。一部の素材およびサードパーティのオープンソースパッケージは、それぞれのライセンス条件に基づいて使用しており、詳細はアプリ内の「素材ライセンスとクレジット」をご覧ください。" }
      ] },
      { h: "十一、サービスの変更、中断、終了", blocks: [
        { ul: [
          "運営者は、機能の追加、調整、削除を行うことがあり、メンテナンスや不可抗力によりサービスを一時停止することもあります。重大な変更は、できるだけ事前にお知らせします。",
          "サービスの安定した提供に努めますが、中断が一切ないこと、エラーが全くないことを保証することはできません。",
          "あなたのデータは主にご自身の端末に保存されるため、バックアップ機能を定期的にご利用ください。",
          "本サービスの運営を終了する場合は、少なくとも30日前にアプリ内でお知らせし、データをバックアップする時間を確保します。",
          "ご利用はいつでもやめることができます。アカウントの削除方法は、プライバシーポリシーをご覧ください。"
        ] }
      ] },
      { h: "十二、責任", blocks: [
        { p: "本サービスは現在、無料で提供されています。法律で認められる範囲で、端末の故障、ブラウザのデータ消去、第三者サービスの中断、またはご自身の API Key の利用によって生じた損失について、運営者は賠償責任を負いません。" },
        { p: "ただし、運営者の故意または重大な過失によって生じた損害、および法律上免除できない責任については、法令に従い責任を負います。" }
      ] },
      { h: "十三、規約の更新", blocks: [
        { p: "規約を更新したときは、施行日を変更します。あなたの権利に重大な影響を与える変更は、効力が生じる少なくとも7日前にアプリ内でお知らせします。新しい規約に同意いただけない場合は、ご利用をやめ、アカウントの削除を申請できます。効力が生じた後も利用を続けた場合は、同意したものとみなします。" }
      ] },
      { h: "十四、準拠法と管轄", blocks: [
        { p: "本規約は中華民国（台湾）の法律を準拠法とします。本サービスに関して生じた紛争については、台湾の高雄地方法院（臺灣高雄地方法院）を第一審の管轄裁判所とします。これは、「消費者保護法」第47条に基づき、消費関係が生じた地の裁判所に訴えを提起するあなたの権利に影響しません。" }
      ] },
      { h: "十五、お問い合わせ", blocks: [
        { p: "運営者：MaliPhone（個人開発者による運営）<br>Email：" + MAIL }
      ] }
    ]
  };

  C.ko = {
    title: "MaliPhone 서비스 이용약관",
    updated: "시행일: 2026년 10월 15일",
    intro: [
      "MaliPhone에 오신 것을 환영합니다. 이 약관은 이용자와 운영자 사이의 약속을 설명합니다. 이 페이지는 언제나 공개되어 있어 언제든지 읽거나 저장하실 수 있습니다. 사용하시기 전에 끝까지 읽어 주세요. 본 서비스를 이용하시면 이 내용에 동의하신 것으로 간주하며, 동의하지 않으시면 이용하지 말아 주세요.",
      "본 서비스는 개인 개발자가 운영하며, 아래의 '운영자'는 MaliPhone을 운영하는 이 개인 개발자를 가리킵니다. 데이터가 어떻게 처리되는지는 <a href=\"./privacy?lang=ko\">개인정보 처리방침</a>을 확인해 주세요."
    ],
    sections: [
      { h: "1. 어떤 서비스인가요", blocks: [
        { p: "MaliPhone은 휴대폰 화면 형태로 제공되는 AI 캐릭터 교류 공간으로, 채팅, 소셜, 지갑, 캘린더, 미니 게임 등의 기능이 있습니다. 캐릭터와 상황은 이용자가 설정하고, 답변은 AI가 만듭니다." }
      ] },
      { h: "2. 이용 자격", blocks: [
        { ul: [
          "만 18세 이상이어야 합니다.",
          "이용자가 거주하는 지역의 법률이 이런 서비스에 더 높은 연령 요건을 두고 있다면 해당 지역의 규정을 따라 주세요."
        ] }
      ] },
      { h: "3. 계정", blocks: [
        { ul: [
          "로그인은 선택 사항입니다. 로그인할 때는 본인의 이메일을 사용하고 로그인 수단을 잘 관리해 주세요.",
          "계정은 본인만 사용할 수 있습니다. 운영자 시스템 문제로 생긴 경우를 제외하고, 계정에서 이루어진 활동은 이용자가 책임집니다.",
          "계정이 다른 사람에게 사용되고 있음을 발견하면 가능한 한 빨리 운영자에게 알려 주세요. 처리를 도와드리겠습니다."
        ] }
      ] },
      { h: "4. AI 콘텐츠에 관하여", blocks: [
        { ul: [
          "캐릭터와 줄거리는 모두 허구이며, 실제 인물이나 사건, 또는 운영자의 입장을 나타내지 않습니다.",
          "AI는 틀린 말을 하거나, 앞뒤가 맞지 않거나, 부적절한 내용을 만들 수 있습니다. 의료, 법률, 재무, 정신 건강 등 전문적인 조언으로 받아들이지 마세요.",
          "위기에 처해 있거나 스스로를 해치려는 생각이 든다면, 주변의 믿을 수 있는 사람이나 전문 상담 기관에 직접 연락해 주세요."
        ] }
      ] },
      { h: "5. 직접 준비한 API Key", blocks: [
        { ul: [
          "직접 준비한 API Key를 사용할 때는 이용자와 해당 제공업체 사이에 별도의 약정이 있습니다. 요금, 사용량 한도, 콘텐츠 규정은 해당 제공업체의 약관에 따릅니다.",
          "직접 준비한 Key를 사용해 발생한 비용은 이용자가 부담합니다."
        ] }
      ] },
      { h: "6. 이용자의 콘텐츠", blocks: [
        { ul: [
          "이용자가 만들거나 업로드한 콘텐츠에 대해 원래 가지고 있던 권리는 본 서비스를 이용한다고 해서 운영자에게 넘어가지 않습니다. AI가 만든 글은 법적으로 반드시 저작권 보호를 받는 것은 아닙니다.",
          "저장, 동기화, AI에 전송해 답변 생성하기 등 기능이 정상적으로 동작하도록, 이용자는 운영자가 필요한 범위에서 이 콘텐츠를 처리하는 데 동의합니다. 다른 용도로는 사용하지 않습니다.",
          "이용자가 업로드하거나 입력한 콘텐츠는 타인의 권리를 침해해서는 안 됩니다. 다른 사람의 캐릭터 설정이나 이미지, 또는 실제 인물의 사진과 신원을 사용하기 전에, 사용할 권리가 있는지 또는 동의를 받았는지 먼저 확인해 주세요."
        ] }
      ] },
      { h: "7. 해서는 안 되는 일", blocks: [
        { ul: [
          "중화민국(대만)의 법률 또는 이용자가 거주하는 지역의 법률을 위반하는 행위",
          "미성년자와 관련된 성적 콘텐츠를 생성, 요구 또는 유포하는 행위",
          "실제 인물이나 기관을 사칭하거나, 동의 없이 타인의 개인정보를 유포하는 행위",
          "괴롭힘, 협박, 사기, 또는 폭력과 혐오를 선동하는 행위",
          "자해나 자살을 부추기는 행위",
          "타인의 저작권, 상표 또는 기타 권리를 침해하는 행위",
          "본 서비스를 공격하거나 방해하는 행위, 또는 프로그램으로 대량 접속하거나 사용량 제한을 우회하는 행위"
        ] }
      ] },
      { h: "8. 위반 처리와 이의 제기", blocks: [
        { p: "위반 사항을 발견하면 운영자는 경중에 따라 개선 요청, 내장 AI 기능 제한, 계정 일시 정지 또는 해지 중 하나의 조치를 취합니다. 사안이 중대하거나 법에 따라 즉시 처리해야 하는 경우가 아니라면, 먼저 메일로 사유를 알려드립니다. 아동·청소년 성착취 등 불법 콘텐츠는 법에 따라 관할 기관에 신고합니다." },
        { p: "처리가 잘못되었다고 생각하시면 통지를 받은 날부터 14일 이내에 " + MAIL + " 앞으로 메일을 보내 이의를 제기할 수 있으며, 운영자가 다시 검토하여 결과를 회신합니다. 계정이 일시 정지되거나 해지되어도 이용자의 기기에 있는 데이터는 영향을 받지 않습니다." }
      ] },
      { h: "9. 게임 내 아이템", blocks: [
        { p: "영혼의 결정, 카드 등 게임 내 아이템은 본 서비스 안에서만 사용할 수 있으며, 금전적 가치가 없고 현금으로 바꿀 수 없으며 양도할 수도 없습니다. 아이템의 내용, 획득 방법, 수치는 버전에 따라 조정될 수 있습니다." }
      ] },
      { h: "10. 지식재산권", blocks: [
        { p: "본 서비스의 프로그램 코드, 이름, 아이콘, 화면 디자인, 내장 캐릭터, 문구와 소재는 운영자 또는 그 라이선스 제공자에게 귀속되며, 모든 권리를 보유합니다. 운영자의 사전 서면 동의 없이 복제, 수정, 배포, 판매하거나 본 서비스를 바탕으로 2차적 저작물을 만들 수 없습니다. 일부 소재와 제3자 오픈소스 패키지는 각각의 라이선스 조건에 따라 사용하며, 자세한 내용은 앱 안의 '소재 라이선스 및 크레딧'을 확인해 주세요." }
      ] },
      { h: "11. 서비스 변경, 중단 및 종료", blocks: [
        { ul: [
          "운영자는 기능을 추가, 조정 또는 제거할 수 있으며, 점검이나 불가항력으로 서비스를 일시 중지할 수도 있습니다. 중대한 변경은 가능한 한 미리 공지합니다.",
          "서비스가 안정적으로 유지되도록 최선을 다하지만, 중단이 전혀 없거나 오류가 전혀 없을 것이라고는 보장할 수 없습니다.",
          "이용자의 데이터는 주로 이용자 본인의 기기에 저장되므로, 백업 기능을 정기적으로 사용하시기를 권합니다.",
          "본 서비스 운영을 중단하기로 결정하면 최소 30일 전에 앱 안에서 공지하여, 데이터를 백업할 시간을 드립니다.",
          "이용은 언제든지 중단할 수 있습니다. 계정 삭제 방법은 개인정보 처리방침을 확인해 주세요."
        ] }
      ] },
      { h: "12. 책임", blocks: [
        { p: "본 서비스는 현재 무료로 제공됩니다. 법이 허용하는 범위에서, 기기 고장, 브라우저 데이터 삭제, 제3자 서비스 중단, 또는 이용자가 직접 준비한 API Key를 사용하여 생긴 손해에 대해 운영자는 배상 책임을 지지 않습니다." },
        { p: "다만 운영자의 고의 또는 중대한 과실로 인한 손해와, 법에서 배제할 수 없다고 정한 책임에 대해서는 법에 따라 책임을 집니다." }
      ] },
      { h: "13. 약관 변경", blocks: [
        { p: "약관이 바뀌면 시행일을 수정합니다. 이용자의 권익에 중대한 영향을 주는 변경은 효력이 생기기 최소 7일 전에 앱 안에서 공지합니다. 새 약관에 동의하지 않으시면 이용을 중단하고 계정 삭제를 신청할 수 있으며, 효력이 생긴 뒤에도 계속 이용하시면 동의한 것으로 간주합니다." }
      ] },
      { h: "14. 준거법과 관할", blocks: [
        { p: "본 약관은 중화민국(대만)의 법률을 준거법으로 합니다. 본 서비스와 관련하여 생긴 분쟁은 대만 가오슝 지방법원(臺灣高雄地方法院)을 제1심 관할 법원으로 합니다. 이는 이용자가 「소비자보호법」 제47조에 따라 소비 관계가 발생한 곳의 법원에 소송을 제기할 권리에 영향을 주지 않습니다." }
      ] },
      { h: "15. 문의하기", blocks: [
        { p: "운영자: MaliPhone(개인 개발자 운영)<br>Email: " + MAIL }
      ] }
    ]
  };
})();
