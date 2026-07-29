import { toSimplifiedChinese } from "../utils/i18n.js";

const ZH_CHANGELOG = {
  "1.2.7": [
    "07/30 大型更新",
    "玩家人格｜新增最多 8 組玩家人格，可保存不同姓名、性別與頭像；可在玩家 App、聊天列表及聊天室內快速切換，並持續顯示目前使用中的人格。",
    "人格資料｜切換人格時會同步切換聊天、AI 記憶與狀態、角色手機資料、手機錢包、社群、交友及情侶空間；水晶、登入帳本、抽卡物品、世界書、日記、寵物與山莊仍為共用。",
    "聊天室記憶｜聊天室設定新增長期記憶檢視，可直接查看目前聊天已生成的記憶。",
    "世界書｜全域頁面專注於匯入、編輯及刪除；是否使用改由各聊天室控制。AUTO 關鍵字與 PIN 常駐只在該世界書及條目啟用時生效。",
    "文字轉語音｜生成過的語音會儲存在裝置資料庫並重複使用，減少再次播放的等待時間；快取設有 200 筆／64 MB 自動清理上限。",
    "生活記帳｜新增獨立生活帳本、收支分類、每月預算、明細與統計，並跟隨目前使用中的玩家人格。",
    "多語言｜補齊玩家資料、聯絡人、登入獎勵、日曆、一起聽歌、情侶空間、App 名稱及聊天室設定的英文、日文與韓文介面。",
    "介面改善｜簡化人格清單操作以降低誤刪風險，並改善夜色主題的示意圖片、語音氣泡及錢包配色與文字清晰度。",
    "穩定性｜強化裝置資料庫寫入、功能資料切換、裝置密鑰、筆記、音樂與訊息狀態的安全性及穩定性。",
  ],
  "1.2.6": [
    "07/27 大型更新",
    "角色｜線上與現實模式可分別設定開場白；匯入角色卡時也能選擇套用方式。",
    "多聊天室｜同一位角色可建立多個獨立聊天室；角色狀態、戀人空間等內容會跟隨目前使用中的聊天室。",
    "聊天室｜新增模擬語音、示意圖片、聊天截圖與雙向封鎖。設定 TTS 後，角色語音可直接播放。",
    "雲隱山莊｜新增背包、玩家小屋、家具布置、房屋擴建、邀請同住，以及更多秘境探索。",
    "新 App｜新增日曆、一起聽歌與戀人空間。",
    "手機桌面｜可自由排列 App、建立資料夾，並從 App 資料庫選擇要放上桌面的功能。",
    "通知與信箱｜新增通知中心、鎖定畫面提醒及系統信箱，可接收通知與領取附件。",
  ],
  "1.2.5": [
    "07/14 更新",
    "聊天室調整自動回覆頻率：新增關閉、偶爾、一般、活躍、常駐等選項，並調整每日觸發上限與訊息間隔。",
    "調整社群發文設定：可以選擇哪些角色允許自動發文，並新增搜尋、頭像卡片與角色清單收合功能。未選擇角色時，預設所有角色皆可發文；完成選擇後，僅被選取的角色會發文。",
    "記憶顯示改善：長期記憶改為分頁顯示，每頁最多 5 則，方便查看與管理更多記憶。",
    "手機操作體驗改善：減少雙擊放大造成的操作干擾，並改善聊天室模式切換時的畫面定位。",
  ],
  "1.2.4": [
    "07/13 更新",
    "API 設定新增溫度調整功能，可依照使用需求控制 AI 回覆的穩定度與變化程度。",
    "外觀設定新增介面字體大小選項，支援正常、大、特大與超大四種尺寸。",
    "改善夜色主題的部分文字配色，提升遊戲中心與雲隱山莊視窗的閱讀清晰度。",
    "調整筆記介面與新增按鈕的位置，並改善空白頁提示及不同螢幕尺寸下的操作體驗。",
    "調整雲隱山莊 NPC 的出現位置與移動範圍，避免阻擋傳送點與農田，並讓農田助手的狀態更容易辨識。",
  ],
  "1.2.3": [
    "07/12 更新",
    "新增每日登入獎勵：可前往「遊戲中心 → 登入獎勵」領取。登入天數不需連續累積，每日於台灣時間早上 5:00 更新。",
    "「雲隱山莊」內容調整：重新調整靈田種植、作物售價、訂單、秘境與資源取得數值。秘境探索次數改為每日早上 5:00 重置。",
    "筆記功能正式開放：支援一般／私密筆記、自動儲存、文字格式、字體、字色、搜尋與釘選。",
    "聯絡人排序功能：可依照使用習慣自由調整角色順序，常用角色更容易找到。",
    "「寵物小屋」新增日記功能：可以留下並查看與寵物相處的生活紀錄。AI 日記功能預設開啟，可於寵物小屋設定中關閉。",
    "全域備份功能補強：備份現在會包含筆記、每日登入、雲隱山莊與寵物小屋資料，換裝置或還原備份時更加完整。",
  ],
  "1.2.2": [
    "07/10 更新",
    "「雲隱山莊」測試版開放！",
    "本次先開放農田、秘境、商店等玩法，玩家可以開始體驗資源收集與經營內容。",
    "人物角色調整功能目前暫未開放，會在後續版本繼續更新。",
    "調整手機 App 部分畫面顯示不完全的問題，改善相簿、音樂、商店、地圖、瀏覽器與使用紀錄等資訊呈現。",
    "錢包全面改版：新增角色往來篩選、每月收支統計、週別圖表與月結回顧",
    "聊天室版型與訊息顯示優化，手機輸入可正常換行，改為點擊發送按鈕才送出訊息",
    "統一各款主題的版型設計，新增蜜桃慕斯與主題動態效果開關，並改善特效呈現",
    "改善設定、自訂 CSS 與多個 App 的介面結構及操作穩定性",
    "調整角色手機 App：新增主題化桌面、相簿、音樂、地圖、商店、日記、瀏覽與使用紀錄，並改善聊天更新與玩家備註",
    "新增全站字體選擇功能，可依喜好切換介面字體",
  ],
  "1.2.0": [
    "07/04 更新",
    "新增寵物小屋，支援寵物照顧、自由活動、地圖互動、桌面小寵物與資料備份",
    "新增抹茶檸檬與海鹽汽水主題，統一主要操作按鈕的配色",
    "新增社群自動發文功能，角色會依設定自行分享近況",
    "新增聊天室角色主動訊息，可為每位角色設定開關與互動頻率",
  ],
  "1.1.9": [
    "06/29 更新",
    "新增角色心聲功能，支援自動生成、手動查看與心聲紀錄",
    "新增角色語音功能（測試版），支援 ElevenLabs 聲線設定、試聽與聊天室手動播放",
  ],
  "1.1.8": [
    "06/25 更新",
    "新增英文、日文、韓文介面語言，角色回應會根據 UI 語言設定回覆",
    "新增聊天室背景上傳功能",
    "調整現實模式的玩家對話框",
  ],
  "1.1.6": [
    "06/19 更新",
    "API 新增 DeepSeek",
    "聊天室新增群聊功能",
    "聊天室新增場景設定",
    "新增聊天室釘選功能",
  ],
  "1.1.5": [
    "06/13 更新",
    "API 新增 Vertex AI",
    "修正角色相關設定與 UI 顯示",
  ],
  "1.1.4": [
    "06/03 更新",
    "修正 Gemma / 角色相關設定與 UI 顯示",
  ],
  "1.1.3": [
    "06/02 更新",
    "加入角色狀態 / 設定 / 匯入 / 匯出",
    "修正角色與聊天顯示",
    "修正個人資料設定",
    "提升設定穩定性",
  ],
  "1.1.2": [
    "05/28 更新",
    "加入 AI / 對話 / 記憶 / 角色卡",
    "加入 AIRP 與聊天提示詞",
    "新增角色管理",
    "修正部分錯誤",
  ],
};

const TRANSLATED_CHANGELOG = {
  "1.2.7": {
    en: [
      "07/30 Major Update",
      "Player personas | Added up to 8 player personas with separate names, genders, and avatars. Switch quickly from the Player app, chat list, or chatroom while always seeing which persona is active.",
      "Persona data | Switching personas now switches chats, AI memories and status, character-phone data, phone wallet, social, dating, and couple space. Crystals, login ledger, gacha items, lorebooks, diary, pets, and the manor remain shared.",
      "Chat memories | Added long-term memory viewing to chat settings so generated memories can be reviewed without leaving the chatroom.",
      "Lorebooks | The global page now focuses on import, editing, and deletion, while usage is controlled per chatroom. AUTO keyword and PIN entries only work when both their lorebook and entry are enabled.",
      "Text to speech | Generated audio is stored in the device database and reused to reduce replay delays. The cache automatically cleans up beyond 200 entries or 64 MB.",
      "Life ledger | Added a separate life ledger with income and expense categories, monthly budgets, transaction details, and statistics tied to the active player persona.",
      "Languages | Expanded English, Japanese, and Korean support across Player Profile, Contacts, Login Rewards, Calendar, Listen Together, Couple Space, app names, and chat settings.",
      "Interface | Simplified persona-list actions to reduce accidental deletion, and improved the clarity of simulated images, voice bubbles, wallet colors, and text in the Night theme.",
      "Stability | Improved device-database writes, feature-data switching, device secrets, notes, music, and message-state safety.",
    ],
    ja: [
      "07/30 大型アップデート",
      "プレイヤー人格｜名前・性別・アバターを個別に保存できるプレイヤー人格を最大8件追加しました。プレイヤー App、チャット一覧、チャットルームから素早く切り替えられ、使用中の人格も常に確認できます。",
      "人格データ｜人格を切り替えると、チャット、AI の記憶と状態、キャラスマホのデータ、スマホ財布、SNS、出会い、カップルスペースも切り替わります。クリスタル、ログイン台帳、ガチャアイテム、世界観、日記、ペット、山荘は共通です。",
      "チャットの記憶｜チャット設定に長期記憶の表示を追加し、チャットルームを離れずに生成済みの記憶を確認できるようになりました。",
      "世界観｜全体ページはインポート・編集・削除に整理し、使用するかどうかはチャットルームごとに設定します。AUTO キーワードと PIN 常駐は、世界観と条目の両方が有効な場合のみ動作します。",
      "音声読み上げ｜生成済み音声を端末データベースに保存して再利用し、再生時の待ち時間を短縮しました。キャッシュは200件または64 MBを超えると自動整理されます。",
      "生活家計簿｜収支カテゴリ、月間予算、明細、統計を備えた生活家計簿を追加し、使用中のプレイヤー人格に連動するようにしました。",
      "多言語｜プレイヤー情報、連絡先、ログイン報酬、カレンダー、一緒に音楽、カップルスペース、App 名、チャット設定の英語・日本語・韓国語表示を拡充しました。",
      "画面改善｜誤削除を防ぐため人格一覧の操作を整理し、夜色テーマのイメージ画像、音声吹き出し、財布の配色と文字の見やすさを改善しました。",
      "安定性｜端末データベースへの書き込み、機能データの切り替え、端末シークレット、ノート、音楽、メッセージ状態の安全性と安定性を強化しました。",
    ],
    ko: [
      "07/30 대규모 업데이트",
      "플레이어 페르소나 | 이름, 성별, 아바타를 각각 저장할 수 있는 플레이어 페르소나를 최대 8개까지 추가했습니다. 플레이어 앱, 채팅 목록, 채팅방에서 빠르게 전환하고 현재 사용 중인 페르소나를 계속 확인할 수 있습니다.",
      "페르소나 데이터 | 페르소나를 전환하면 채팅, AI 기억과 상태, 캐릭터 폰 데이터, 폰 지갑, 소셜, 데이팅, 커플 공간도 함께 전환됩니다. 크리스탈, 로그인 장부, 뽑기 아이템, 월드북, 일기, 펫, 산장은 공용으로 유지됩니다.",
      "채팅 기억 | 채팅 설정에 장기 기억 보기를 추가하여 채팅방을 나가지 않고 생성된 기억을 확인할 수 있습니다.",
      "월드북 | 전체 페이지는 가져오기, 편집, 삭제에 집중하도록 정리하고 실제 사용 여부는 채팅방별로 설정합니다. AUTO 키워드와 PIN 상주는 월드북과 항목이 모두 활성화된 경우에만 작동합니다.",
      "텍스트 음성 변환 | 생성된 음성을 기기 데이터베이스에 저장하고 재사용하여 다시 재생할 때의 대기 시간을 줄였습니다. 캐시는 200개 또는 64 MB를 넘으면 자동으로 정리됩니다.",
      "생활 장부 | 수입·지출 분류, 월 예산, 내역, 통계를 제공하는 생활 장부를 추가하고 현재 플레이어 페르소나에 연결했습니다.",
      "다국어 | 플레이어 정보, 연락처, 로그인 보상, 달력, 함께 음악 듣기, 커플 공간, 앱 이름, 채팅 설정의 영어·일본어·한국어 지원을 보강했습니다.",
      "화면 개선 | 실수로 삭제하지 않도록 페르소나 목록 동작을 단순화하고, 야간 테마의 예시 이미지, 음성 말풍선, 지갑 색상과 글자 가독성을 개선했습니다.",
      "안정성 | 기기 데이터베이스 쓰기, 기능 데이터 전환, 기기 비밀정보, 노트, 음악, 메시지 상태의 안전성과 안정성을 강화했습니다.",
    ],
  },
  "1.2.2": {
    en: ["07/10 Update", "Yunyin Villa beta is now open!", "This release opens farming, expeditions, shops, and other systems so players can begin collecting resources and managing the villa.", "Character customization is not available yet and will continue to be updated in future versions.", "Adjusted several phone app screens where text or information could be cut off, improving display in Gallery, Music, Shop, Map, Browser, and Screen Time.", "Redesigned Wallet with character filters, monthly income and expense totals, weekly charts, and monthly recaps", "Improved chat layout and message display; Enter now creates a new line on mobile and messages are sent only with the Send button", "Unified layouts across themes, added Peach Mousse and a theme-effects toggle, and refined visual effects", "Improved Settings, Custom CSS, and overall app interface stability", "Expanded the character phone with themed apps and improved chat refresh and player contact notes", "Added a global interface font selector"],
    ja: ["07/10 更新", "「雲隠山荘」ベータ版を公開しました！", "今回は農場、秘境、ショップなどの遊びを先行公開し、資源収集と経営要素を体験できるようになりました。", "キャラクター調整機能は現在未公開で、今後のバージョンで引き続き更新予定です。", "スマホアプリの一部画面で情報が表示しきれない問題を調整し、アルバム、音楽、ショップ、地図、ブラウザ、使用履歴の表示を改善しました。", "キャラクター別フィルター、月間収支、週別グラフ、月次まとめを備えたウォレット画面に刷新", "チャットのレイアウトとメッセージ表示を改善し、モバイルでは Enter で改行、送信ボタンでのみ送信するよう変更", "各テーマのレイアウトを統一し、ピーチムースとテーマ演出スイッチを追加、エフェクト表示を改善", "設定、カスタム CSS、各アプリ画面の構成と安定性を改善", "テーマ対応アプリを備えたキャラクタースマホを拡張し、チャット更新とプレイヤー連絡先メモを改善", "全体のインターフェースフォント選択機能を追加"],
    ko: ["07/10 업데이트", "「운은산장」 베타가 열렸습니다!", "이번에는 농장, 비경, 상점 등의 콘텐츠를 먼저 열어 자원 수집과 경영 요소를 체험할 수 있습니다.", "캐릭터 조정 기능은 아직 제공되지 않으며 이후 버전에서 계속 업데이트될 예정입니다.", "휴대폰 앱 일부 화면에서 정보가 잘리는 문제를 조정해 앨범, 음악, 상점, 지도, 브라우저, 사용 기록 표시를 개선했습니다.", "캐릭터별 필터, 월간 수입·지출, 주간 차트와 월간 결산을 포함하도록 지갑 화면 개편", "채팅 레이아웃과 메시지 표시를 개선하고 모바일에서 Enter는 줄바꿈, 전송 버튼을 눌러야만 메시지가 전송되도록 변경", "모든 테마의 레이아웃을 통일하고 피치 무스와 테마 효과 스위치를 추가했으며 효과 표현 개선", "설정, 사용자 CSS 및 여러 앱 화면의 구조와 안정성 개선", "테마형 앱을 갖춘 캐릭터 휴대폰을 확장하고 채팅 새로고침과 플레이어 연락처 메모 개선", "전체 인터페이스 글꼴 선택 기능 추가"],
  },
  "1.2.0": {
    en: ["07/04 Update", "Added Pet Home with pet care, free roaming, map interactions, desktop pets, and data backup", "Added Matcha Lemon and Sea Salt Soda themes with unified primary-action colors", "Added automatic social posts so characters can share updates on their own", "Added proactive character messages with per-character controls and frequency settings"],
    ja: ["07/04 更新", "ペットのお世話、自由移動、マップ交流、デスクトップペット、データバックアップに対応したペットハウスを追加", "抹茶レモンとシーソルトソーダのテーマを追加し、主要操作ボタンの配色を統一", "キャラクターが自動で近況を投稿するSNS自動投稿機能を追加", "キャラクターごとにオン・オフと頻度を設定できる主動メッセージ機能を追加"],
    ko: ["07/04 업데이트", "펫 돌보기, 자유 이동, 지도 상호작용, 데스크톱 펫, 데이터 백업을 지원하는 펫 하우스 추가", "말차 레몬과 씨솔트 소다 테마를 추가하고 주요 동작 버튼 색상을 통일", "캐릭터가 스스로 근황을 공유하는 소셜 자동 게시 기능 추가", "캐릭터별 활성화와 빈도를 설정할 수 있는 선제 메시지 기능 추가"],
  },
  "1.1.9": {
    en: ["06/29 Update", "Added character inner thoughts with automatic generation, manual viewing, and thought history", "Added character voice support (beta), including ElevenLabs voice settings, previews, and manual playback in chat"],
    ja: ["06/29 更新", "キャラの心の声機能を追加し、自動生成・手動表示・履歴に対応", "キャラクター音声機能（テスト版）を追加し、ElevenLabs の音声設定・試聴・チャットでの手動再生に対応"],
    ko: ["06/29 업데이트", "캐릭터 속마음 기능을 추가하고 자동 생성, 수동 확인, 속마음 기록을 지원", "캐릭터 음성 기능(테스트 버전)을 추가하고 ElevenLabs 음성 설정, 미리듣기, 채팅 수동 재생을 지원"],
  },
  "1.1.8": {
    en: ["06/25 Update", "Added English, Japanese, and Korean UI languages; character replies now follow the selected UI language", "Added chatroom background image uploads", "Adjusted the player dialogue box in Reality mode"],
    ja: ["06/25 更新", "英語・日本語・韓国語の UI 言語を追加し、キャラの返信が選択中の UI 言語に合わせるようになりました", "チャットルーム背景画像のアップロード機能を追加", "現実モードのプレイヤー会話ボックスを調整"],
    ko: ["06/25 업데이트", "영어, 일본어, 한국어 UI 언어를 추가했으며 캐릭터 답변이 선택한 UI 언어를 따르도록 했습니다", "채팅방 배경 이미지 업로드 기능 추가", "현실 모드의 플레이어 대화 상자 조정"],
  },
  "1.1.6": {
    en: ["06/19 Update", "Added DeepSeek API", "Added group chat in chatrooms", "Added chatroom scene settings", "Added chatroom pinning"],
    ja: ["06/19 更新", "API に DeepSeek を追加", "チャットルームにグループチャットを追加", "チャットルームのシーン設定を追加", "チャットルームのピン留めを追加"],
    ko: ["06/19 업데이트", "API에 DeepSeek 추가", "채팅방에 그룹 채팅 기능 추가", "채팅방 장면 설정 추가", "채팅방 고정 기능 추가"],
  },
  "1.1.5": {
    en: ["06/13 Update", "Added Vertex AI API", "Fixed character settings and UI display"],
    ja: ["06/13 更新", "API に Vertex AI を追加", "キャラ関連設定と UI 表示を修正"],
    ko: ["06/13 업데이트", "API에 Vertex AI 추가", "캐릭터 관련 설정과 UI 표시 수정"],
  },
  "1.1.4": {
    en: ["06/03 Update", "Fixed Gemma / character settings and UI display"],
    ja: ["06/03 更新", "Gemma / キャラ関連設定と UI 表示を修正"],
    ko: ["06/03 업데이트", "Gemma / 캐릭터 관련 설정과 UI 표시 수정"],
  },
  "1.1.3": {
    en: ["06/02 Update", "Added character status / settings / import / export", "Fixed character and chat display", "Fixed player profile settings", "Improved settings stability"],
    ja: ["06/02 更新", "キャラのステータス / 設定 / インポート / エクスポートを追加", "キャラとチャット表示を修正", "プロフィール設定を修正", "設定の安定性を改善"],
    ko: ["06/02 업데이트", "캐릭터 상태 / 설정 / 가져오기 / 내보내기 추가", "캐릭터와 채팅 표시 수정", "프로필 설정 수정", "설정 안정성 개선"],
  },
  "1.1.2": {
    en: ["05/28 Update", "Added AI / chat / memory / character cards", "Added AIRP and chat prompts", "Added character management", "Fixed several bugs"],
    ja: ["05/28 更新", "AI / チャット / メモリ / キャラカードを追加", "AIRP とチャットプロンプトを追加", "キャラ管理を追加", "一部の不具合を修正"],
    ko: ["05/28 업데이트", "AI / 대화 / 기억 / 캐릭터 카드 추가", "AIRP 및 채팅 프롬프트 추가", "캐릭터 관리 추가", "일부 오류 수정"],
  },
};

export function getChangelog(version, language = "zh-TW") {
  if (language === "zh-TW") return ZH_CHANGELOG[version] || [];
  if (language === "zh-CN") return (ZH_CHANGELOG[version] || []).map(toSimplifiedChinese);
  return TRANSLATED_CHANGELOG[version]?.[language] || ZH_CHANGELOG[version] || [];
}
