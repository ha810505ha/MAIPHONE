const ZH_CHANGELOG = {
  "1.2.1": [
    "07/06 更新",
    "錢包全面改版：新增角色往來篩選、每月收支統計、週別圖表與月結回顧",
    "聊天室版型與訊息顯示優化，手機輸入可正常換行，改為點擊發送按鈕才送出訊息",
    "統一各款主題的版型設計，新增蜜桃慕斯與主題動態效果開關，並改善特效呈現",
    "改善設定、自訂 CSS 與多個 App 的介面結構及操作穩定性",
    "調整角色手機 App：新增主題化桌面、相簿、音樂、地圖、商店、日記、瀏覽與使用紀錄，並改善聊天刷新與玩家備註",
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
  "1.2.1": {
    en: ["07/06 Update", "Redesigned Wallet with character filters, monthly income and expense totals, weekly charts, and monthly recaps", "Improved chat layout and message display; Enter now creates a new line on mobile and messages are sent only with the Send button", "Unified layouts across themes, added Peach Mousse and a theme-effects toggle, and refined visual effects", "Improved Settings, Custom CSS, and overall app interface stability", "Expanded the character phone with themed apps and improved chat refresh and player contact notes", "Added a global interface font selector"],
    ja: ["07/06 更新", "キャラクター別フィルター、月間収支、週別グラフ、月次まとめを備えたウォレット画面に刷新", "チャットのレイアウトとメッセージ表示を改善し、モバイルでは Enter で改行、送信ボタンでのみ送信するよう変更", "各テーマのレイアウトを統一し、ピーチムースとテーマ演出スイッチを追加、エフェクト表示を改善", "設定、カスタム CSS、各アプリ画面の構成と安定性を改善", "テーマ対応アプリを備えたキャラクタースマホを拡張し、チャット更新とプレイヤー連絡先メモを改善", "全体のインターフェースフォント選択機能を追加"],
    ko: ["07/06 업데이트", "캐릭터별 필터, 월간 수입·지출, 주간 차트와 월간 결산을 포함하도록 지갑 화면 개편", "채팅 레이아웃과 메시지 표시를 개선하고 모바일에서 Enter는 줄바꿈, 전송 버튼을 눌러야만 메시지가 전송되도록 변경", "모든 테마의 레이아웃을 통일하고 피치 무스와 테마 효과 스위치를 추가했으며 효과 표현 개선", "설정, 사용자 CSS 및 여러 앱 화면의 구조와 안정성 개선", "테마형 앱을 갖춘 캐릭터 휴대폰을 확장하고 채팅 새로고침과 플레이어 연락처 메모 개선", "전체 인터페이스 글꼴 선택 기능 추가"],
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
  return TRANSLATED_CHANGELOG[version]?.[language] || ZH_CHANGELOG[version] || [];
}
