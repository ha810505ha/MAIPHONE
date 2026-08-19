import { toSimplifiedChinese } from "../utils/i18n.js";

const ZH_CHANGELOG = {
  "1.2.16": [
    "08/19 大型更新",
    "帳號與雲端同步｜整合 Email 註冊、Google 登入與手動文字資料同步。跨裝置同步時會保留本機圖片、相簿、語音快取與 API Key，並強化錢包及遊戲進度的合併處理，降低舊資料被覆蓋的風險。",
    "聊天操作｜新增手動生成回應，可先連續送出多個訊息氣泡，再讓角色一次回覆；現實聊天新增輸出長度設定，並改善 Gemini 2.5 Pro 的回覆穩定性與空白回覆提示。",
    "聊天截圖｜新增關鍵字遮蔽，可快速隱藏角色名稱、玩家名稱或自訂文字；遮蔽只會套用於輸出的圖片，不會修改原始對話內容。",
    "雲隱山莊｜入住角色可生成、查看及切換多個版本的生活對話句庫；新增戶外造景素材，並改善家園、地圖與 NPC 互動。",
    "備份與還原｜改善完整備份中的圖片與媒體資產保存，並調整 GitHub 備份清單排序，讓較新的備份優先顯示。",
    "雲端同步｜停用已淘汰的自架後端背景同步，避免純網頁版本發出無效請求；Supabase 登入與手動文字同步維持不變。",
    "介面與修正｜改善 Android 桌面滑動、App 圖示拖曳、API 來源切換，以及聊天輸入列與送出按鈕的對齊；修正被角色封鎖時無法手動生成回應、任務訊息長按操作無法收回等問題。",
  ],
  "1.2.15": [
    "08/18 更新",
    "帳號與雲端同步｜新增 Google 登入，可在不同裝置登入同一帳號後手動上傳或下載文字資料；若原本已使用相同 Gmail 的 Email 帳號註冊，Google 登入會連結至原本帳號，不會建立另一份雲端資料。為避免資料遭覆蓋，登入後不會自動上傳、下載或刪除資料，請先建立完整備份；圖片、相簿、語音快取與 API Key 仍只保留在本機。",
  ],
  "1.2.14": [
    "08/13 更新",
    "帳號與雲端同步｜新增信箱帳號註冊與登入功能。玩家可使用 Email 建立帳號，並在不同裝置登入同一帳號後，手動上傳或下載文字資料。\n\n為避免誤覆蓋資料，首次註冊、登入與登出時都會提醒先建立完整備份；資料不會在登入後自動上傳、下載或刪除。\n\n目前可同步角色與聊天文字、筆記、日曆、手機 App 文字內容、錢包、靈魂結晶、每日登入、雲隱山莊與系統信箱狀態。圖片、相簿、語音快取與 API Key 仍只保留在本機。",
  ],
  "1.2.13": [
    "08/10 緊急修正",
    "聊天室截圖｜修正夜色以外的主題儲存聊天 PNG 時，可能因色彩格式不相容而失敗的問題。\n\n現在所有主題都可正常建立聊天截圖。",
  ],
  "1.2.12": [
    "08/10 緊急修正",
    "修正 | 修正雲隱山莊在部分情況下無法開啟、導致畫面中斷的問題。\n\n現在可正常進入山莊與使用家園佈置功能。",
  ],
  "1.2.11": [
    "08/10 更新",
    "新增｜OpenRouter 現在可查看目前 API Key 的剩餘額度、已使用額度，以及帳戶總餘額。",
    "社群｜社群設定改為「設定」與「珍藏」分頁，查看與管理珍藏貼文更方便。\n\n修正部分模型產生角色貼文時，末尾可能出現「XX characters」的問題。",
  ],
  "1.2.10": [
    "08/10 多語言與穩定性更新",
    "新增｜解答之書、寵物小屋與雲隱山莊支援繁體中文、簡體中文、英文、日文與韓文。\n\n寵物日記與雲隱山莊 AI 內容會跟隨目前語系。\n\n補齊自訂 CSS 選擇器與多語言說明。",
    "修復｜修正群組聊天室可能無法開啟、傳送照片視窗出現在畫面底部，以及模擬語音長度固定顯示 2 秒的問題。\n\n修正雲隱山莊重複出口、NPC 名稱未翻譯、自動鎖定狀態與部分介面的語言殘留。\n\n改善安全性、資料載入與整體穩定性。",
  ],
  "1.2.9": [
    "08/09 更新",
    "聊天室｜新增【此刻】狀態欄。可記錄目前和角色的關係、所在場景、情緒、正在進行的事、未解伏筆與備註；每條聊天室與劇情分支都能擁有獨立設定，讓 AI 更自然地延續當下劇情。\n\n角色回覆可重新生成不同版本，從中選擇喜歡的回覆繼續對話；也可從目前進度或指定版本建立分支，探索不同走向。\n\n新增封存功能【時光抽屜】。暫時不想繼續的對話可收進時光抽屜保存，封存期間不會再產生互動或更新；解封後即可回到原有進度繼續聊天。\n\n新增可自訂的【劇情快捷抽屜】。常用的劇情指令可快速帶入輸入框，並可為不同聊天室與分支分別設定。\n\n支援顯示 AI 回覆中的思想內容【思考泡泡】；想保留神祕感時，也可在聊天室設定中隨時關閉。",
    "狀態｜長期記憶現在可以壓縮成較精簡的摘要；原始內容會收進【塵封書庫】保存，不會再被 AI 讀取或帶入對話，之後仍可查看或還原。",
  ],
  "1.2.8": [
    "07/30 緊急修正",
    "全域備份：修正超過 25MB 的全域備份可以匯出、卻無法再次匯入的問題。",
    "聯絡人：修正部分玩家開啟聯絡人時可能出現錯誤，導致頁面無法使用的問題。",
    "雲隱山莊：修正低倍率畫面下難以點擊靈田協助 NPC 的問題，改善所有縮放倍率的 NPC 點擊範圍，並避免 0.5 倍時下排靈田的種子選擇視窗偶爾閃退。",
    "雲隱山莊貨架：上架商品時可自行選擇數量，支援加減、直接輸入與全部上架，並會依背包持有量限制。",
    "社群：新增角色之間的互動開關與互動機率；角色會依人設與貼文內容自然留言，並以延遲顯示、近期去重及配對冷卻控制互動密度。",
    "社群操作：重新整理角色貼文時會立即顯示準備狀態，並開放選擇預設發文頻率與每日自動貼文上限。",
    "社群通知：角色的新留言現在會正確顯示 App 圖示紅點；延遲留言只會在實際出現後才列為未讀。",
    "社群通知頁：社群內新增通知鈴鐺，可查看角色回覆、合併短時間內的同篇互動，並直接跳到貼文與新留言；社群活動不再顯示於系統通知。",
    "社群留言：玩家可持續回覆角色留言，角色也會接續回應；留言維持固定縮排，且每次只由玩家操作觸發一則角色回覆。",
    "社群提示詞：貼文與留言改用精簡人設；對話範例不再注入社群，最近私聊只供貼文參考，玩家關係只在玩家參與時加入。",
    "社群用量保護：角色貼文與留言新增獨立輸入、輸出 token 上限；貼文約 4000／1000、留言約 3000／800，輸入估算已用 o200k 分詞器校準，輸出仍遵守社群與全域上限中較低的設定。",
    "玩家留言管理：點擊自己的社群留言即可編輯或刪除；有下層回覆時會保留刪除標記，角色留言維持不可修改。",
    "聊天約定：角色與玩家談定明確日期後會提出可編輯的日曆確認卡；加入後只讓約定角色知道，時間附近可稍後提醒、略過或由玩家主動開始劇情，不會自動消耗 AI Token。",
    "多聊天室：修正角色生成回覆期間切換聊天室時，回覆可能落到切換後聊天室的問題；一般回覆、錯誤提示、轉帳回應與自動心聲都會固定寫回發起請求的聊天室。",
    "聊天室體驗：進入角色聊天室時會可靠定位到最新訊息；若上一則玩家訊息因關閉 App 或生成中斷而沒有回覆，空白輸入框的送出鍵會改為重試，不必刪除重發。",
    "玩家人格：移除人格卡片的獨立改名入口；人格清單與聊天室切換選單會直接使用個人設定中的姓名，修改後立即同步。",
    "APK 穩定性：切換 App 時若延遲模組暫時載入失敗會自動重試及恢復；持續失敗時會顯示返回主畫面與重新載入選項，不再只剩空白畫面。",
    "錯誤診斷：錯誤頁可直接複製技術資訊；最近 10 筆紀錄會跨重開保留於「設定 → 關於」，不包含聊天內容與 API Key。",
    "穩定性：新增全域備份、聯絡人、裝置密鑰與雲隱山莊互動的回歸檢查。",
  ],
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
    "桌面瀏覽器｜修正使用滑鼠時「全部 App」按鈕可能被首頁手勢攔截而無法開啟的問題，並加大可點擊範圍。",
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
};

const TRANSLATED_CHANGELOG = {
  "1.2.16": {
    en: [
      "08/19 Major Update",
      "Accounts & cloud sync | Integrated email registration, Google sign-in, and manual text-data sync. Cross-device sync keeps local images, Gallery content, voice cache, and API keys on the device, while safer wallet and game-progress merging reduces the risk of overwriting older data.",
      "Chat controls | Added manual reply generation: send several message bubbles first, then let the character respond once. Reality chat now has an output-length setting, with improved Gemini 2.5 Pro reliability and clearer empty-response messages.",
      "Chat screenshots | Added keyword redaction for quickly hiding character names, player names, or custom text. Redaction only affects the exported image and never changes the original conversation.",
      "Yunyin Villa | Residents can generate, review, and switch between multiple versions of their daily dialogue library. New outdoor decorations were added, alongside improvements to homes, maps, and NPC interactions.",
      "Backup & restore | Improved preservation of images and other media in full backups, and changed GitHub backup ordering so newer backups appear first.",
      "Cloud sync | Disabled the retired self-hosted background sync to prevent invalid requests on the web build. Supabase sign-in and manual text sync remain available.",
      "Interface & fixes | Improved Android home-screen swiping, app-icon dragging, API-source switching, and chat input/send-button alignment. Fixed manual generation while blocked by a character, task-message long-press controls that could not be dismissed, and other issues.",
    ],
    ja: [
      "08/19 大型アップデート",
      "アカウントとクラウド同期｜メール登録、Google ログイン、テキストデータの手動同期を統合しました。端末間同期でも画像、ギャラリー、音声キャッシュ、API Key は端末に保持され、ウォレットとゲーム進行の統合処理を強化して、古いデータを上書きする危険を減らしました。",
      "チャット操作｜複数のメッセージを続けて送信してから、キャラクターの返信を一度だけ生成できる手動返信機能を追加しました。現実チャットには出力長設定を追加し、Gemini 2.5 Pro の応答安定性と空応答時の案内も改善しました。",
      "チャット画像｜キャラクター名、プレイヤー名、任意の文字をすばやく隠せるキーワード非表示機能を追加しました。非表示処理は出力画像だけに適用され、元の会話は変更されません。",
      "雲隠山荘｜居住キャラクターの日常会話集を生成・確認し、複数バージョンから切り替えられるようになりました。屋外装飾を追加し、家、マップ、NPC とのやり取りも改善しました。",
      "バックアップと復元｜完全バックアップで画像などのメディアをより確実に保存できるよう改善し、GitHub バックアップ一覧は新しいものから表示するよう変更しました。",
      "クラウド同期｜廃止済みの自前バックエンド向けバックグラウンド同期を停止し、Web 版で無効なリクエストが発生しないようにしました。Supabase ログインと手動テキスト同期は引き続き利用できます。",
      "画面と不具合修正｜Android ホーム画面のスワイプ、アプリアイコンのドラッグ、API 接続元の切り替え、チャット入力欄と送信ボタンの配置を改善しました。キャラクターにブロックされた状態で手動返信を生成できない問題、タスクメッセージの長押し操作を解除できない問題などを修正しました。",
    ],
    ko: [
      "08/19 대규모 업데이트",
      "계정 및 클라우드 동기화 | 이메일 가입, Google 로그인, 텍스트 데이터 수동 동기화를 통합했습니다. 기기 간 동기화 시 이미지, 갤러리, 음성 캐시, API 키는 기기에 유지되며, 지갑과 게임 진행 데이터 병합을 강화해 기존 데이터가 덮어써질 위험을 줄였습니다.",
      "채팅 조작 | 여러 메시지 말풍선을 연속으로 보낸 뒤 캐릭터 답장을 한 번만 생성할 수 있는 수동 답장 기능을 추가했습니다. 현실 채팅에 출력 길이 설정을 추가하고 Gemini 2.5 Pro 응답 안정성과 빈 응답 안내를 개선했습니다.",
      "채팅 캡처 | 캐릭터 이름, 플레이어 이름 또는 사용자 지정 문구를 빠르게 숨길 수 있는 키워드 가림 기능을 추가했습니다. 가림 처리는 내보낸 이미지에만 적용되며 원본 대화는 변경하지 않습니다.",
      "운은산장 | 입주 캐릭터의 생활 대사 모음을 생성하고 확인하며 여러 버전 중에서 선택할 수 있습니다. 야외 장식 요소를 추가하고 집, 지도 및 NPC 상호작용을 개선했습니다.",
      "백업 및 복원 | 전체 백업에서 이미지와 기타 미디어를 더 안정적으로 보존하도록 개선했으며, GitHub 백업 목록에서 최신 백업이 먼저 표시되도록 정렬을 변경했습니다.",
      "클라우드 동기화 | 사용이 종료된 자체 호스팅 백엔드용 백그라운드 동기화를 비활성화해 웹 버전에서 잘못된 요청이 발생하지 않도록 했습니다. Supabase 로그인과 수동 텍스트 동기화는 그대로 사용할 수 있습니다.",
      "인터페이스 및 수정 | Android 홈 화면 스와이프, 앱 아이콘 드래그, API 소스 전환, 채팅 입력창과 전송 버튼 정렬을 개선했습니다. 캐릭터에게 차단된 상태에서 수동 답장을 생성할 수 없는 문제와 작업 메시지 길게 누르기 메뉴를 닫을 수 없는 문제 등을 수정했습니다.",
    ],
  },
  "1.2.15": {
    en: [
      "08/18 Update",
      "Account & cloud sync | Added Google sign-in. You can manually upload or download text data after signing in to the same account on another device; if you previously registered with the same Gmail address, Google sign-in links to your existing account instead of creating a second cloud profile. To avoid overwriting data, sign-in never automatically uploads, downloads, or deletes data, so make a full backup first. Images, Gallery, voice cache, and API keys remain on the device.",
    ],
    ja: [
      "08/18 更新",
      "アカウントとクラウド同期｜Google ログインを追加しました。同じアカウントで別の端末にログインした後、テキストデータを手動でアップロードまたはダウンロードできます。すでに同じ Gmail アドレスでメール登録している場合は、Google ログインで既存アカウントに連携され、別のクラウドデータは作成されません。データ上書きを防ぐため、ログイン後に自動でアップロード、ダウンロード、削除は行われません。先に完全バックアップを作成してください。画像、アルバム、音声キャッシュ、API キーは端末に残ります。",
    ],
    ko: [
      "08/18 업데이트",
      "계정 및 클라우드 동기화 | Google 로그인을 추가했습니다. 같은 계정으로 다른 기기에 로그인한 후 텍스트 데이터를 수동으로 업로드하거나 다운로드할 수 있습니다. 기존에 동일한 Gmail 주소로 이메일 가입했다면 Google 로그인은 기존 계정에 연결되며 별도의 클라우드 데이터가 생성되지 않습니다. 데이터 덮어쓰기를 방지하기 위해 로그인 후 자동 업로드, 다운로드 또는 삭제를 하지 않으므로 먼저 전체 백업을 만들어 주세요. 이미지, 갤러리, 음성 캐시 및 API 키는 기기에 남아 있습니다.",
    ],
  },
  "1.2.14": {
    en: [
      "08/13 Update",
      "Account & cloud sync | Added email account registration and sign-in. Players can create an account with email, then manually upload or download text data after signing in to the same account on another device.\n\nTo prevent accidental overwrites, registration, sign-in, and sign-out now remind players to make a full backup first. Data is never automatically uploaded, downloaded, or deleted after sign-in.\n\nSync currently includes character and chat text, notes, calendar, character phone app text, wallets, Soul Crystals, daily login progress, Yunyin Villa, and system mailbox status. Images, Gallery, voice cache, and API keys remain on the device.",
    ],
    ja: [
      "08/13 アップデート",
      "アカウントとクラウド同期｜メールアドレスでのアカウント登録・ログインを追加しました。同じアカウントで別の端末にログイン後、テキストデータを手動でアップロードまたはダウンロードできます。\n\n意図しない上書きを防ぐため、初回登録・ログイン・ログアウト時には完全バックアップを促します。ログイン後にデータが自動でアップロード、ダウンロード、削除されることはありません。\n\n現在同期できるのは、キャラクターとチャットのテキスト、メモ、カレンダー、キャラクター端末アプリのテキスト、ウォレット、ソウルクリスタル、毎日ログイン、雲隠山荘、システムメールの状態です。画像、ギャラリー、音声キャッシュ、API Keyは端末にのみ保存されます。",
    ],
    ko: [
      "08/13 업데이트",
      "계정 및 클라우드 동기화 | 이메일 계정 가입과 로그인을 추가했습니다. 같은 계정으로 다른 기기에 로그인한 뒤 텍스트 데이터를 직접 업로드하거나 다운로드할 수 있습니다.\n\n실수로 데이터를 덮어쓰지 않도록 첫 가입, 로그인, 로그아웃 시 전체 백업을 안내합니다. 로그인 후 데이터가 자동으로 업로드, 다운로드 또는 삭제되지는 않습니다.\n\n현재 동기화되는 항목은 캐릭터 및 채팅 텍스트, 메모, 캘린더, 캐릭터 휴대폰 앱 텍스트, 지갑, 영혼 크리스털, 일일 로그인, 운은산장, 시스템 우편 상태입니다. 이미지, 갤러리, 음성 캐시, API Key는 기기에만 남습니다.",
    ],
  },
  "1.2.13": {
    en: [
      "08/10 Hotfix",
      "Chat screenshots | Fixed chat PNG exports failing in themes other than Night because of an incompatible color format.\n\nChat screenshots now work in every theme.",
    ],
    ja: [
      "08/10 緊急修正",
      "チャットのスクリーンショット｜夜色以外のテーマで、色形式の互換性によりチャット PNG の保存に失敗することがある問題を修正しました。\n\nすべてのテーマでチャットのスクリーンショットを作成できます。",
    ],
    ko: [
      "08/10 긴급 수정",
      "채팅 스크린샷 | 야간 테마 이외의 테마에서 호환되지 않는 색상 형식으로 인해 채팅 PNG 저장이 실패할 수 있는 문제를 수정했습니다.\n\n이제 모든 테마에서 채팅 스크린샷을 만들 수 있습니다.",
    ],
  },
  "1.2.12": {
    en: [
      "08/10 Hotfix",
      "Fixes | Fixed an issue that could prevent Yunyin Villa from opening and interrupt the screen in certain situations.\n\nYou can now enter the villa and use Home Editor normally.",
    ],
    ja: [
      "08/10 緊急修正",
      "修正 | 一部の状況で雲隠山荘を開けず、画面が停止する問題を修正しました。\n\n山荘への入場と家園レイアウト機能を正常に利用できます。",
    ],
    ko: [
      "08/10 긴급 수정",
      "수정 | 일부 상황에서 운은산장에 들어갈 수 없고 화면이 중단되는 문제를 수정했습니다.\n\n이제 산장 입장과 집 꾸미기 기능을 정상적으로 이용할 수 있습니다.",
    ],
  },
  "1.2.11": {
    en: [
      "08/10 Update",
      "New | OpenRouter now shows the current API key's remaining and used quota, along with the account's total balance.",
      "Social | Social settings are now split into Settings and Saved tabs, making saved posts easier to browse and manage.\n\nFixed an issue where some models could append \"XX characters\" to character posts.",
    ],
    ja: [
      "08/10 更新",
      "追加｜OpenRouterで、現在のAPI Keyの残り利用枠・使用量と、アカウント全体の残高を確認できるようになりました。",
      "SNS｜SNS設定を「設定」と「保存」のタブに分け、保存済み投稿の確認・管理をしやすくしました。\n\n一部モデルがキャラクター投稿の末尾に「XX characters」と出力することがある問題を修正しました。",
    ],
    ko: [
      "08/10 업데이트",
      "추가｜OpenRouter에서 현재 API Key의 남은 한도·사용량과 계정 전체 잔액을 확인할 수 있습니다.",
      "소셜｜소셜 설정을 ‘설정’과 ‘저장’ 탭으로 나누어 저장한 게시물을 더 쉽게 확인하고 관리할 수 있습니다.\n\n일부 모델이 캐릭터 게시물 끝에 ‘XX characters’를 출력할 수 있는 문제를 수정했습니다.",
    ],
  },
  "1.2.10": {
    en: [
      "08/10 Language & Stability Update",
      "New | Answer Book, Pet Home, and Yunyin Villa now support Traditional Chinese, Simplified Chinese, English, Japanese, and Korean.\n\nPet diary and Yunyin Villa AI content now follow the current language.\n\nExpanded the Custom CSS selector guide and multilingual instructions.",
      "Fixes | Fixed group chats sometimes failing to open, the photo-send dialog appearing at the bottom of the screen, and simulated voice messages remaining at 2 seconds.\n\nFixed duplicate Yunyin Villa exits, untranslated NPC names, auto-lock status text, and remaining untranslated interface text.\n\nImproved security, data loading, and overall stability.",
    ],
    ja: [
      "08/10 多言語・安定性アップデート",
      "追加｜答えの書、ペットのおうち、雲隠山荘が繁体字中国語・簡体字中国語・英語・日本語・韓国語に対応しました。\n\nペット日記と雲隠山荘の AI コンテンツが現在の言語に従うようになりました。\n\nカスタム CSS のセレクターと多言語ガイドを拡充しました。",
      "修正｜グループチャットを開けない場合がある問題、写真送信ダイアログが画面下部に表示される問題、模擬音声の長さが2秒のままになる問題を修正しました。\n\n雲隠山荘の重複した出口、未翻訳の NPC 名、自動ロック状態、一部画面に残っていた未翻訳テキストを修正しました。\n\nセキュリティ、データ読み込み、全体的な安定性を改善しました。",
    ],
    ko: [
      "08/10 다국어 및 안정성 업데이트",
      "추가｜정답의 책, 펫 하우스, 운은산장이 번체 중국어, 간체 중국어, 영어, 일본어, 한국어를 지원합니다.\n\n펫 일기와 운은산장 AI 콘텐츠가 현재 언어를 따르도록 개선했습니다.\n\n사용자 CSS 선택자와 다국어 안내를 보강했습니다.",
      "수정｜그룹 채팅방이 열리지 않을 수 있는 문제, 사진 전송 창이 화면 아래에 표시되는 문제, 가상 음성 메시지 길이가 2초로 고정되는 문제를 수정했습니다.\n\n운은산장의 중복 출구, 번역되지 않은 NPC 이름, 자동 잠금 상태와 일부 화면에 남아 있던 미번역 문구를 수정했습니다.\n\n보안, 데이터 불러오기와 전반적인 안정성을 개선했습니다.",
    ],
  },
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
      "Desktop browser | Fixed an issue where the home gesture could intercept mouse clicks on All Apps, and enlarged the clickable target.",
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
      "デスクトップブラウザ｜ホーム画面のジェスチャーが「すべてのアプリ」へのマウスクリックを妨げる問題を修正し、クリック範囲を広げました。",
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
      "데스크톱 브라우저 | 홈 화면 제스처가 모든 앱 버튼의 마우스 클릭을 가로채 열리지 않던 문제를 수정하고 클릭 영역을 넓혔습니다.",
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
};

export function getChangelog(version, language = "zh-TW") {
  if (language === "zh-TW") return ZH_CHANGELOG[version] || [];
  if (language === "zh-CN") return (ZH_CHANGELOG[version] || []).map(toSimplifiedChinese);
  return TRANSLATED_CHANGELOG[version]?.[language] || ZH_CHANGELOG[version] || [];
}
