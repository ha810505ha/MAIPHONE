/* global window, location */
// 隱私權政策內容（五語系）。依 2026-10-15 實際資料流撰寫，並經 Codex 對照程式審閱。
// 資料流改變時（新增第三方、同步範圍、刪帳流程、AI 服務商）須同步更新本檔與 terms-content.js。
(function () {
  var MAIL = '<a href="mailto:support@maliphone.com">support@maliphone.com</a>';
  // 正式網域 maliphone.com 尚未公開（小舞 2026-10-19）：GitHub Pages 等其他網域不寫出網址，只說有網頁版。
  var OFFICIAL = /(^|\.)maliphone\.com$|^maliphone(-test)?\.pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
  var GPOLICY = '<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener">Google API Services User Data Policy</a>';
  var YT_TOS = '<a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">';
  var G_PRIV = '<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">';
  window.MALI_LEGAL = { doc: "privacy", content: {} };
  var C = window.MALI_LEGAL.content;

  C["zh-TW"] = {
    title: "MaliPhone 隱私權政策",
    updated: "生效日期：2026 年 10 月 15 日",
    intro: [
      (OFFICIAL ? "MaliPhone 是一支放在瀏覽器裡的小手機，你可以在這裡和 AI 角色聊天、經營生活、玩小遊戲。網頁版位於 maliphone.com，另有 Android 版。本服務由個人開發者營運，沒有成立公司。" : "MaliPhone 是一支放在瀏覽器裡的小手機，你可以在這裡和 AI 角色聊天、經營生活、玩小遊戲。有網頁版，另有 Android 版。本服務由個人開發者營運，沒有成立公司。"),
      "這份政策用白話說明：營運者會碰到哪些資料、為什麼需要、會交給誰，以及你可以怎麼管理。依台灣《個人資料保護法》應告知的事項，也都寫在下面。"
    ],
    summary: [
      "不登入也能使用大部分功能。角色、聊天與設定存在你自己的裝置上，營運者的伺服器不會保存。",
      "使用 AI 時，當次對話一定要送給模型服務商才能產生回覆，這點無論是否登入都一樣。",
      "登入與雲端同步是選用功能。上傳和下載都要你親手確認才會進行。",
      "營運者不販售資料、不放廣告、不裝分析追蹤工具，也不會拿你的聊天內容訓練模型。"
    ],
    sections: [
      { h: "一、存在你裝置上的資料", blocks: [
        { p: "角色、聊天紀錄、設定、照片、帳本與遊戲進度，預設存放在你使用的瀏覽器或手機裡，不會自動上傳到營運者的伺服器。" },
        { p: "請注意，本機資料也可能因為清除瀏覽器資料、移除 App 或更換裝置而消失，建議定期使用備份功能。使用 Android 版時，手機內建的系統備份可能依你的手機設定一併備份 App 資料，這部分由你的手機與 Google 帳號管理。" },
        { p: "你自己填入的 AI 服務 API Key 只存在裝置上，雲端同步與備份檔都會把它排除。" }
      ] },
      { h: "二、營運者處理哪些個人資料", blocks: [
        { table: { head: ["情境", "資料", "用途"], rows: [
          ["登入帳號（選用）", "Email、帳號識別碼、登入狀態；使用 Google 登入時另有名稱與頭像", "確認你的身分，把雲端資料綁定到你的帳號。登入狀態會保存在裝置上，直到你登出"],
          ["雲端同步（選用）", "你選擇上傳的資料，目前為文字資料", "讓你在不同裝置間取回自己的資料。打開帳號頁時會讀取雲端資料的狀態，但不會自動覆蓋本機"],
          ["使用內建 AI", "帳號識別碼、請求編號、時間、使用的功能與模型、服務商、字數與 token 數、處理時間、成功或錯誤代碼。內測名單另含 Email 與備註", "計算每日額度、防止濫用、排查錯誤。不包含對話內容"],
          ["寫信給客服", "你的 Email 與信件內容", "回覆問題與處理你的請求"]
        ] } },
        { p: "營運者不會讀取你的 Gmail、聯絡人、行事曆或其他 Google 帳號資料。" }
      ] },
      { h: "三、AI 對話會送到哪裡", blocks: [
        { ul: [
          "使用自己的 API Key：對話內容送到你選擇的服務商。部分服務會經過營運者的轉送伺服器，它只負責轉交請求與 Key，不會把對話內容或 Key 寫進資料庫。",
          "使用內建 AI：對話內容送到營運者串接的模型服務商，目前為 Google（Gemini）與 OpenRouter，以及 OpenRouter 轉接的模型商。營運者只保存上一節列出的用量資料。"
        ] },
        { p: "服務商收到內容後如何處理，包括是否用於訓練，依各服務商自己的政策。AI 產生的內容是虛構的，可能不正確，請不要當成事實或專業意見。" }
      ] },
      { h: "四、備份到你自己的雲端（選用）", blocks: [
        { ul: [
          "Google Drive：使用 drive.file 權限，只能存取本服務建立的檔案，或你在 App 中選擇開啟的檔案。授權只在你使用備份功能的期間存在於 App 內，不會傳送到營運者的伺服器。",
          "GitHub：GitHub 的 repo 權限可以讀寫你所有的儲存庫，但本服務只會讀寫你指定的備份儲存庫。授權過程會經過營運者的轉送伺服器，伺服器不保存你的權杖。"
        ] },
        { p: "備份檔存在你自己的帳號裡，營運者不會主動存取。本服務對 Google API 所取得資訊的使用與傳輸，遵守 " + GPOLICY + "，包括其中的「有限使用」規定。" }
      ] },
      { h: "五、第三方服務", blocks: [
        { p: "為了讓服務運作，資料會經過以下服務商，各自依其隱私權政策處理。營運者不會為了行銷或其他目的把資料交給別人。" },
        { table: { head: ["服務商", "用途", "何時接觸"], rows: [
          ["Cloudflare", "網站代管、轉送伺服器、雲端資料庫與圖片儲存", "每次使用"],
          ["Google Fonts", "載入介面字型，Google 會收到你的 IP 位址", "每次使用"],
          ["Supabase", "帳號登入", "登入時"],
          ["AI 模型服務商", "產生回覆", "使用 AI 時"],
          ["YouTube、Spotify", "嵌入式音樂播放器，這些平台可能設定自己的 Cookie", "使用音樂播放器時"],
          ["Google、GitHub", "登入與備份", "使用這些功能時"]
        ] } },
        { p: "YouTube 播放器屬於 YouTube API 服務，使用時也適用 " + YT_TOS + "YouTube 服務條款</a>與 " + G_PRIV + "Google 隱私權政策</a>。" },
        { p: "若法院或檢警依法調取，營運者可能必須提供必要的資料。" }
      ] },
      { h: "六、存放地點與跨境傳輸", blocks: [
        { p: "上述服務商多半在美國或全球多個地區設有機房。使用登入、同步、AI 或音樂功能時，你的資料會傳送到台灣以外的地區處理與存放。" }
      ] },
      { h: "七、保存多久", blocks: [
        { ul: [
          "裝置上的資料：保存在你的裝置上，直到你刪除，或因清除瀏覽器資料、移除 App 而消失。",
          "帳號、雲端資料與內建 AI 用量紀錄：保存到帳號刪除完成為止。",
          "客服信件：處理完畢後保存最多一年，以便後續追蹤同一問題。",
          "服務商的一般連線紀錄，例如 IP 位址與請求時間：依各服務商政策保存，用於安全防護。"
        ] }
      ] },
      { h: "八、你的權利與申請方式", blocks: [
        { p: "依個資法，你可以請求查詢或閱覽、製給複製本、補充或更正、停止蒐集處理或利用，以及刪除你的個人資料。" },
        { p: "請用帳號綁定的 Email 寫信到 " + MAIL + "，營運者會用這個 Email 回信確認是你本人。查詢、閱覽或複製本的請求會在 15 天內回覆，其他請求會在 30 天內回覆；需要延長時，會先告訴你原因。" },
        { p: "裝置上的資料，你可以隨時用「設定」裡的備份功能匯出，或自行清除。" },
        { p: "不提供資料的影響：不提供 Email，就無法使用登入、雲端同步與內建 AI；不同意把對話送給 AI 服務商，就無法使用 AI 回覆；不授權 Google 或 GitHub，就無法使用該備份方式。其他功能照常可用。" }
      ] },
      { h: "九、刪除帳號", blocks: [
        { p: "請寫信到 " + MAIL + " 申請。確認是本人後，營運者會在 30 天內刪除你的帳號、雲端資料與內建 AI 用量紀錄，完成後回信通知。刪除完成前，你可以來信撤回。刪除後無法復原。" },
        { p: "裝置上的資料不受影響，需要的話請自行清除。法律要求保存的紀錄，會依法定期間保存。" }
      ] },
      { h: "十、資料安全", blocks: [
        { p: "連線全程加密；雲端資料依帳號分開存放，存取需要你的登入憑證。營運者會盡力保護資料，但網路傳輸無法保證百分之百安全，請妥善保管你的帳號與 API Key。" }
      ] },
      { h: "十一、Cookie 與本機儲存", blocks: [
        { p: "營運者自己不使用廣告或分析追蹤 Cookie。本服務會使用瀏覽器的本機儲存空間保存你的資料與登入狀態，這是功能運作所必需的。嵌入的 YouTube 與 Spotify 播放器可能設定它們自己的 Cookie。" }
      ] },
      { h: "十二、年齡", blocks: [
        { p: "本服務含有戀愛、交友等題材，只提供給年滿 18 歲的使用者。營運者不會刻意蒐集未滿 18 歲者的資料；得知有這種情形時，會刪除相關帳號資料。" }
      ] },
      { h: "十三、政策更新", blocks: [
        { p: "本頁會保留目前版本供你隨時閱讀。內容更新時會修改生效日期；對你權益有重大影響的變更，會在生效至少 7 天前於 App 內公告。" }
      ] },
      { h: "十四、聯絡營運者", blocks: [
        { p: "蒐集者：MaliPhone（個人開發者營運）<br>Email：" + MAIL }
      ] }
    ]
  };

  C["zh-CN"] = {
    title: "MaliPhone 隐私政策",
    updated: "生效日期：2026 年 10 月 15 日",
    intro: [
      (OFFICIAL ? "MaliPhone 是一部放在浏览器里的小手机，你可以在这里和 AI 角色聊天、经营生活、玩小游戏。网页版位于 maliphone.com，另有 Android 版。本服务由个人开发者运营，没有成立公司。" : "MaliPhone 是一部放在浏览器里的小手机，你可以在这里和 AI 角色聊天、经营生活、玩小游戏。有网页版，另有 Android 版。本服务由个人开发者运营，没有成立公司。"),
      "这份政策用白话说明：运营者会接触哪些数据、为什么需要、会交给谁，以及你可以怎么管理。依台湾《个人资料保护法》应告知的事项，也都写在下面。"
    ],
    summary: [
      "不登录也能使用大部分功能。角色、聊天与设置保存在你自己的设备上，运营者的服务器不会保存。",
      "使用 AI 时，当次对话一定要发送给模型服务商才能生成回复，这一点无论是否登录都一样。",
      "登录与云端同步是可选功能。上传和下载都要你亲手确认才会进行。",
      "运营者不出售数据、不放广告、不安装分析追踪工具，也不会拿你的聊天内容训练模型。"
    ],
    sections: [
      { h: "一、保存在你设备上的数据", blocks: [
        { p: "角色、聊天记录、设置、照片、账本与游戏进度，默认保存在你使用的浏览器或手机里，不会自动上传到运营者的服务器。" },
        { p: "请注意，本机数据也可能因为清除浏览器数据、卸载 App 或更换设备而丢失，建议定期使用备份功能。使用 Android 版时，手机内置的系统备份可能依你的手机设置一并备份 App 数据，这部分由你的手机与 Google 账号管理。" },
        { p: "你自己填入的 AI 服务 API Key 只保存在设备上，云端同步与备份文件都会将它排除。" }
      ] },
      { h: "二、运营者处理哪些个人数据", blocks: [
        { table: { head: ["场景", "数据", "用途"], rows: [
          ["登录账号（可选）", "Email、账号标识、登录状态；使用 Google 登录时另有名称与头像", "确认你的身份，把云端数据绑定到你的账号。登录状态会保存在设备上，直到你退出登录"],
          ["云端同步（可选）", "你选择上传的数据，目前为文字数据", "让你在不同设备间取回自己的数据。打开账号页时会读取云端数据的状态，但不会自动覆盖本机"],
          ["使用内置 AI", "账号标识、请求编号、时间、使用的功能与模型、服务商、字数与 token 数、处理时间、成功或错误代码。内测名单另含 Email 与备注", "计算每日额度、防止滥用、排查错误。不包含对话内容"],
          ["写信给客服", "你的 Email 与邮件内容", "回复问题与处理你的请求"]
        ] } },
        { p: "运营者不会读取你的 Gmail、联系人、日历或其他 Google 账号数据。" }
      ] },
      { h: "三、AI 对话会发送到哪里", blocks: [
        { ul: [
          "使用自己的 API Key：对话内容发送到你选择的服务商。部分服务会经过运营者的转发服务器，它只负责转交请求与 Key，不会把对话内容或 Key 写入数据库。",
          "使用内置 AI：对话内容发送到运营者对接的模型服务商，目前为 Google（Gemini）与 OpenRouter，以及 OpenRouter 转接的模型商。运营者只保存上一节列出的用量数据。"
        ] },
        { p: "服务商收到内容后如何处理，包括是否用于训练，依各服务商自己的政策。AI 生成的内容是虚构的，可能不正确，请不要当成事实或专业意见。" }
      ] },
      { h: "四、备份到你自己的云端（可选）", blocks: [
        { ul: [
          "Google Drive：使用 drive.file 权限，只能访问本服务创建的文件，或你在 App 中选择打开的文件。授权只在你使用备份功能期间存在于 App 内，不会发送到运营者的服务器。",
          "GitHub：GitHub 的 repo 权限可以读写你所有的仓库，但本服务只会读写你指定的备份仓库。授权过程会经过运营者的转发服务器，服务器不保存你的令牌。"
        ] },
        { p: "备份文件存放在你自己的账号里，运营者不会主动访问。本服务对 Google API 所获取信息的使用与传输，遵守 " + GPOLICY + "，包括其中的“有限使用”规定。" }
      ] },
      { h: "五、第三方服务", blocks: [
        { p: "为了让服务运作，数据会经过以下服务商，各自依其隐私政策处理。运营者不会为了营销或其他目的把数据交给别人。" },
        { table: { head: ["服务商", "用途", "何时接触"], rows: [
          ["Cloudflare", "网站托管、转发服务器、云端数据库与图片存储", "每次使用"],
          ["Google Fonts", "加载界面字体，Google 会收到你的 IP 地址", "每次使用"],
          ["Supabase", "账号登录", "登录时"],
          ["AI 模型服务商", "生成回复", "使用 AI 时"],
          ["YouTube、Spotify", "嵌入式音乐播放器，这些平台可能设置自己的 Cookie", "使用音乐播放器时"],
          ["Google、GitHub", "登录与备份", "使用这些功能时"]
        ] } },
        { p: "YouTube 播放器属于 YouTube API 服务，使用时也适用 " + YT_TOS + "YouTube 服务条款</a>与 " + G_PRIV + "Google 隐私政策</a>。" },
        { p: "若法院或检警机关依法调取，运营者可能必须提供必要的数据。" }
      ] },
      { h: "六、存放地点与跨境传输", blocks: [
        { p: "上述服务商大多在美国或全球多个地区设有机房。使用登录、同步、AI 或音乐功能时，你的数据会传送到台湾以外的地区处理与存放。" }
      ] },
      { h: "七、保存多久", blocks: [
        { ul: [
          "设备上的数据：保存在你的设备上，直到你删除，或因清除浏览器数据、卸载 App 而消失。",
          "账号、云端数据与内置 AI 用量记录：保存到账号删除完成为止。",
          "客服邮件：处理完毕后最多保存一年，以便后续跟进同一问题。",
          "服务商的一般连接记录，例如 IP 地址与请求时间：依各服务商政策保存，用于安全防护。"
        ] }
      ] },
      { h: "八、你的权利与申请方式", blocks: [
        { p: "依个资法，你可以请求查询或阅览、制给复制本、补充或更正、停止收集处理或利用，以及删除你的个人数据。" },
        { p: "请用账号绑定的 Email 写信到 " + MAIL + "，运营者会用这个 Email 回信确认是你本人。查询、阅览或复制本的请求会在 15 天内回复，其他请求会在 30 天内回复；需要延长时，会先告诉你原因。" },
        { p: "设备上的数据，你可以随时用“设置”里的备份功能导出，或自行清除。" },
        { p: "不提供数据的影响：不提供 Email，就无法使用登录、云端同步与内置 AI；不同意把对话发送给 AI 服务商，就无法使用 AI 回复；不授权 Google 或 GitHub，就无法使用该备份方式。其他功能照常可用。" }
      ] },
      { h: "九、删除账号", blocks: [
        { p: "请写信到 " + MAIL + " 申请。确认是本人后，运营者会在 30 天内删除你的账号、云端数据与内置 AI 用量记录，完成后回信通知。删除完成前，你可以来信撤回。删除后无法恢复。" },
        { p: "设备上的数据不受影响，需要的话请自行清除。法律要求保存的记录，会依法定期限保存。" }
      ] },
      { h: "十、数据安全", blocks: [
        { p: "连接全程加密；云端数据按账号分开存放，访问需要你的登录凭证。运营者会尽力保护数据，但网络传输无法保证百分之百安全，请妥善保管你的账号与 API Key。" }
      ] },
      { h: "十一、Cookie 与本机存储", blocks: [
        { p: "运营者自己不使用广告或分析追踪 Cookie。本服务会使用浏览器的本机存储空间保存你的数据与登录状态，这是功能运作所必需的。嵌入的 YouTube 与 Spotify 播放器可能设置它们自己的 Cookie。" }
      ] },
      { h: "十二、年龄", blocks: [
        { p: "本服务含有恋爱、交友等题材，只提供给年满 18 岁的用户。运营者不会刻意收集未满 18 岁者的数据；得知有这种情况时，会删除相关账号数据。" }
      ] },
      { h: "十三、政策更新", blocks: [
        { p: "本页会保留当前版本供你随时阅读。内容更新时会修改生效日期；对你权益有重大影响的变更，会在生效至少 7 天前于 App 内公告。" }
      ] },
      { h: "十四、联系运营者", blocks: [
        { p: "收集者：MaliPhone（个人开发者运营）<br>Email：" + MAIL }
      ] }
    ]
  };

  C.en = {
    title: "MaliPhone Privacy Policy",
    updated: "Effective date: October 15, 2026",
    intro: [
      (OFFICIAL ? "MaliPhone is a little phone that lives in your browser. You can chat with AI characters, run your daily life, and play small games. The web version is at maliphone.com, and there is also an Android version. The service is run by an individual developer, not a company." : "MaliPhone is a little phone that lives in your browser. You can chat with AI characters, run your daily life, and play small games. There is a web version and an Android version. The service is run by an individual developer, not a company."),
      "This policy explains in plain language what data we touch, why we need it, who it goes to, and how you can manage it. The notices required under Taiwan's Personal Data Protection Act are also included below."
    ],
    summary: [
      "You can use most features without signing in. Your characters, chats and settings stay on your own device, and our servers do not keep them.",
      "When you use AI, the conversation for that request must be sent to the model provider to produce a reply. This is true whether or not you are signed in.",
      "Sign-in and cloud sync are optional. Nothing is uploaded or downloaded until you confirm it yourself.",
      "We do not sell data, show ads, or use analytics trackers, and we do not use your chats to train models."
    ],
    sections: [
      { h: "1. Data stored on your device", blocks: [
        { p: "Your characters, chat history, settings, photos, ledger and game progress are stored in the browser or phone you use by default. They are not uploaded to our servers automatically." },
        { p: "Please note that local data can also be lost if you clear your browser data, remove the app or change devices, so we recommend using the backup feature regularly. On the Android version, your phone's built-in system backup may also back up the app's data depending on your phone settings. That is managed by your phone and your Google account." },
        { p: "The AI service API Key you enter is stored only on your device. Cloud sync and backup files both exclude it." }
      ] },
      { h: "2. What personal data we handle", blocks: [
        { table: { head: ["Situation", "Data", "Purpose"], rows: [
          ["Signing in (optional)", "Email, account ID, sign-in status; plus your name and avatar if you use Google sign-in", "To confirm who you are and tie your cloud data to your account. Your sign-in status is kept on your device until you sign out"],
          ["Cloud sync (optional)", "The data you choose to upload, currently text data", "So you can get your own data back across different devices. When you open the account page, we read the status of your cloud data, but we never overwrite your local data automatically"],
          ["Using built-in AI", "Account ID, request ID, time, the feature and model used, provider, character count and token count, processing time, success or error code. The beta list also includes Email and notes", "To calculate daily quotas, prevent abuse and troubleshoot errors. Conversation content is not included"],
          ["Writing to support", "Your Email and the content of your message", "To reply to your questions and handle your requests"]
        ] } },
        { p: "We do not read your Gmail, contacts, calendar or any other Google account data." }
      ] },
      { h: "3. Where AI conversations go", blocks: [
        { ul: [
          "Using your own API Key: your conversation is sent to the provider you choose. Some services go through our relay server, which only passes on the request and the Key and does not write your conversation or Key to any database.",
          "Using built-in AI: your conversation is sent to the model providers we connect to, currently Google (Gemini) and OpenRouter, as well as the model companies that OpenRouter relays to. We only keep the usage data listed in the previous section."
        ] },
        { p: "How a provider handles content once it receives it, including whether it is used for training, depends on that provider's own policy. AI-generated content is fictional and may be inaccurate, so please do not treat it as fact or professional advice." }
      ] },
      { h: "4. Backing up to your own cloud (optional)", blocks: [
        { ul: [
          "Google Drive: uses the drive.file permission, so it can only access files created by this service or files you choose to open in the app. The authorization exists inside the app only while you use the backup feature and is not sent to our servers.",
          "GitHub: GitHub's repo permission can read and write all of your repositories, but this service only reads and writes the backup repository you specify. The authorization process goes through our relay server, which does not store your token."
        ] },
        { p: "Backup files are kept in your own account and we do not access them on our own. This service's use and transfer of information obtained from Google APIs follows the " + GPOLICY + ", including its Limited Use requirements." }
      ] },
      { h: "5. Third-party services", blocks: [
        { p: "To keep the service running, data passes through the providers below, each handling it under its own privacy policy. We do not hand data to anyone for marketing or other purposes." },
        { table: { head: ["Provider", "Purpose", "When it is involved"], rows: [
          ["Cloudflare", "Website hosting, relay server, cloud database and image storage", "Every use"],
          ["Google Fonts", "Loads interface fonts; Google receives your IP address", "Every use"],
          ["Supabase", "Account sign-in", "When signing in"],
          ["AI model providers", "Generating replies", "When using AI"],
          ["YouTube, Spotify", "Embedded music players; these platforms may set their own cookies", "When using the music player"],
          ["Google, GitHub", "Sign-in and backup", "When using these features"]
        ] } },
        { p: "The YouTube player is part of the YouTube API Services, so the " + YT_TOS + "YouTube Terms of Service</a> and the " + G_PRIV + "Google Privacy Policy</a> also apply when you use it." },
        { p: "If a court or law enforcement authority lawfully requires it, we may have to provide the necessary data." }
      ] },
      { h: "6. Storage location and cross-border transfer", blocks: [
        { p: "Most of the providers above run data centers in the United States or in several regions around the world. When you use sign-in, sync, AI or music features, your data is sent to regions outside Taiwan to be processed and stored." }
      ] },
      { h: "7. How long we keep data", blocks: [
        { ul: [
          "Data on your device: kept on your device until you delete it, or until it disappears because you cleared browser data or removed the app.",
          "Account, cloud data and built-in AI usage records: kept until your account deletion is complete.",
          "Support emails: kept for up to one year after they are handled, so that we can follow up on the same issue.",
          "Providers' general connection logs, such as IP addresses and request times: kept according to each provider's policy, for security protection."
        ] }
      ] },
      { h: "8. Your rights and how to make a request", blocks: [
        { p: "Under the Personal Data Protection Act, you may ask to inquire about or review your personal data, receive a copy, add to or correct it, stop its collection, processing or use, and have it deleted." },
        { p: "Please write to " + MAIL + " from the Email linked to your account, and we will reply to that Email to confirm it is you. We will respond to requests to inquire, review or obtain a copy within 15 days, and to other requests within 30 days. If we need more time, we will tell you why first." },
        { p: "For data on your device, you can export it at any time with the backup feature in \"Settings\", or clear it yourself." },
        { p: "What happens if you do not provide data: without an Email, you cannot use sign-in, cloud sync or built-in AI; if you do not agree to send your conversation to an AI provider, you cannot use AI replies; if you do not authorize Google or GitHub, you cannot use that backup method. Other features work as usual." }
      ] },
      { h: "9. Deleting your account", blocks: [
        { p: "Please write to " + MAIL + " to request it. After we confirm it is you, we will delete your account, cloud data and built-in AI usage records within 30 days and email you when it is done. Until the deletion is complete, you can write to us to withdraw the request. Deletion cannot be undone." },
        { p: "Data on your device is not affected; please clear it yourself if you want. Records that the law requires us to keep will be kept for the legally required period." }
      ] },
      { h: "10. Data security", blocks: [
        { p: "Connections are encrypted throughout. Cloud data is stored separately by account, and access requires your sign-in credentials. We do our best to protect your data, but no network transmission can be guaranteed to be 100% secure, so please keep your account and API Key safe." }
      ] },
      { h: "11. Cookies and local storage", blocks: [
        { p: "We do not use advertising or analytics tracking cookies ourselves. This service uses your browser's local storage to keep your data and sign-in status, which is necessary for it to work. The embedded YouTube and Spotify players may set their own cookies." }
      ] },
      { h: "12. Age", blocks: [
        { p: "This service includes themes such as romance and dating, and is available only to users aged 18 or older. We do not knowingly collect data from anyone under 18; if we learn of such a case, we will delete the related account data." }
      ] },
      { h: "13. Policy updates", blocks: [
        { p: "This page keeps the current version available for you to read at any time. When the content is updated, the effective date will be changed; for changes that significantly affect your rights, we will announce them in the app at least 7 days before they take effect." }
      ] },
      { h: "14. Contact us", blocks: [
        { p: "Collector: MaliPhone (run by an individual developer)<br>Email: " + MAIL }
      ] }
    ]
  };

  C.ja = {
    title: "MaliPhone プライバシーポリシー",
    updated: "施行日：2026年10月15日",
    intro: [
      (OFFICIAL ? "MaliPhone は、ブラウザの中にある小さなスマートフォンです。AI キャラクターとのチャット、生活の運営、ミニゲームなどを楽しめます。Web 版は maliphone.com にあり、Android 版もあります。本サービスは会社ではなく、個人開発者が運営しています。" : "MaliPhone は、ブラウザの中にある小さなスマートフォンです。AI キャラクターとのチャット、生活の運営、ミニゲームなどを楽しめます。Web 版と Android 版があります。本サービスは会社ではなく、個人開発者が運営しています。"),
      "このポリシーでは、どのようなデータを扱うのか、なぜ必要なのか、誰に渡すのか、そしてあなたがどう管理できるのかを、わかりやすい言葉で説明します。「個人情報保護法」（台湾）に基づいて通知すべき事項も、以下にすべて記載しています。"
    ],
    summary: [
      "ログインしなくても、ほとんどの機能を使えます。キャラクター、チャット、設定はあなたの端末に保存され、運営者のサーバーには保存されません。",
      "AI を使うときは、その回の会話をモデル提供元に送らないと返信を生成できません。これはログインの有無にかかわらず同じです。",
      "ログインとクラウド同期は任意の機能です。アップロードもダウンロードも、あなた自身が確認した場合にのみ行われます。",
      "運営者はデータを販売せず、広告も表示せず、分析用のトラッキングツールも使いません。チャット内容をモデルの学習に使うこともありません。"
    ],
    sections: [
      { h: "一、あなたの端末に保存されるデータ", blocks: [
        { p: "キャラクター、チャット履歴、設定、写真、家計簿、ゲームの進行状況は、初期設定ではお使いのブラウザやスマートフォンの中に保存され、運営者のサーバーへ自動的にアップロードされることはありません。" },
        { p: "ブラウザのデータを消去したり、アプリを削除したり、端末を変更したりすると、端末内のデータが失われることがあります。バックアップ機能を定期的にご利用ください。Android 版では、スマートフォンの設定によっては、端末標準のシステムバックアップがアプリのデータも一緒にバックアップする場合があります。この部分はお使いのスマートフォンと Google アカウントが管理します。" },
        { p: "あなたが入力した AI サービスの API Key は端末内にのみ保存され、クラウド同期とバックアップファイルのどちらからも除外されます。" }
      ] },
      { h: "二、運営者が扱う個人データ", blocks: [
        { table: { head: ["場面", "データ", "目的"], rows: [
          ["アカウントへのログイン（任意）", "メールアドレス、アカウント ID、ログイン状態。Google でログインする場合は名前とアイコンも含まれます", "本人確認を行い、クラウド上のデータをあなたのアカウントに紐づけるため。ログイン状態は、ログアウトするまで端末に保存されます"],
          ["クラウド同期（任意）", "あなたがアップロードを選んだデータ（現在はテキストデータ）", "異なる端末間で自分のデータを取り戻せるようにするため。アカウントページを開くとクラウド上のデータの状態を読み取りますが、端末内のデータが自動的に上書きされることはありません"],
          ["内蔵 AI の利用", "アカウント ID、リクエスト番号、日時、使用した機能とモデル、提供元、文字数とトークン数、処理時間、成功またはエラーコード。内部テスト名簿にはメールアドレスとメモも含まれます", "1日あたりの利用枠の計算、不正利用の防止、エラーの調査のため。会話の内容は含まれません"],
          ["サポートへのメール", "あなたのメールアドレスとメールの内容", "ご質問への返信とご要望への対応のため"]
        ] } },
        { p: "運営者が Gmail、連絡先、カレンダー、その他の Google アカウントのデータを読み取ることはありません。" }
      ] },
      { h: "三、AI との会話の送信先", blocks: [
        { ul: [
          "ご自身の API Key を使う場合：会話内容は、あなたが選んだ提供元に送信されます。一部のサービスでは運営者の中継サーバーを経由しますが、中継サーバーはリクエストと Key を受け渡すだけで、会話内容や Key をデータベースに書き込むことはありません。",
          "内蔵 AI を使う場合：会話内容は、運営者が連携しているモデル提供元（現在は Google（Gemini）と OpenRouter、および OpenRouter が中継するモデル事業者）に送信されます。運営者が保存するのは、前の項目に挙げた利用データのみです。"
        ] },
        { p: "提供元が受け取った内容をどのように扱うか（学習に使うかどうかを含む）は、各提供元のポリシーに従います。AI が生成する内容は架空のものであり、不正確な場合があります。事実や専門的な助言として受け取らないでください。" }
      ] },
      { h: "四、ご自身のクラウドへのバックアップ（任意）", blocks: [
        { ul: [
          "Google Drive：drive.file 権限を使用し、本サービスが作成したファイル、またはあなたがアプリ内で開くことを選んだファイルにのみアクセスできます。認可は、バックアップ機能をお使いの間だけアプリ内に存在し、運営者のサーバーには送信されません。",
          "GitHub：GitHub の repo 権限は、あなたのすべてのリポジトリを読み書きできる権限ですが、本サービスが読み書きするのは、あなたが指定したバックアップ用リポジトリのみです。認可の手続きは運営者の中継サーバーを経由しますが、サーバーはあなたのトークンを保存しません。"
        ] },
        { p: "バックアップファイルはあなた自身のアカウントに保存され、運営者から自発的にアクセスすることはありません。本サービスによる Google API から取得した情報の利用と転送は、「限定的な使用」の要件を含め、" + GPOLICY + " に従います。" }
      ] },
      { h: "五、第三者サービス", blocks: [
        { p: "サービスを動かすため、データは以下の提供元を経由し、それぞれのプライバシーポリシーに従って扱われます。運営者が、マーケティングなどの目的でデータを他者に渡すことはありません。" },
        { table: { head: ["提供元", "目的", "関わるタイミング"], rows: [
          ["Cloudflare", "Web サイトのホスティング、中継サーバー、クラウドデータベース、画像の保存", "利用のたび"],
          ["Google Fonts", "画面のフォントの読み込み。Google はあなたの IP アドレスを受け取ります", "利用のたび"],
          ["Supabase", "アカウントへのログイン", "ログイン時"],
          ["AI モデル提供元", "返信の生成", "AI の利用時"],
          ["YouTube、Spotify", "埋め込み型の音楽プレーヤー。これらのプラットフォームが独自の Cookie を設定する場合があります", "音楽プレーヤーの利用時"],
          ["Google、GitHub", "ログインとバックアップ", "これらの機能の利用時"]
        ] } },
        { p: "YouTube プレーヤーは YouTube API サービスに該当するため、ご利用の際は " + YT_TOS + "YouTube 利用規約</a>および " + G_PRIV + "Google プライバシーポリシー</a>も適用されます。" },
        { p: "裁判所や捜査機関から法令に基づく開示要請があった場合、必要なデータを提供することがあります。" }
      ] },
      { h: "六、保存場所と国外への送信", blocks: [
        { p: "上記の提供元の多くは、米国や世界各地にデータセンターを置いています。ログイン、同期、AI、音楽の機能をご利用になると、あなたのデータは台湾以外の地域に送信され、処理・保存されます。" }
      ] },
      { h: "七、保存期間", blocks: [
        { ul: [
          "端末内のデータ：あなたが削除するまで、またはブラウザのデータ消去やアプリの削除によって失われるまで、あなたの端末に保存されます。",
          "アカウント、クラウド上のデータ、内蔵 AI の利用記録：アカウントの削除が完了するまで保存されます。",
          "サポートへのメール：対応完了後、最長で1年間保存します。同じ問題への後続の対応に備えるためです。",
          "提供元の一般的な接続ログ（IP アドレスやリクエスト時刻など）：セキュリティ保護のため、各提供元のポリシーに従って保存されます。"
        ] }
      ] },
      { h: "八、あなたの権利と請求の方法", blocks: [
        { p: "個人情報保護法に基づき、あなたは、個人データの照会または閲覧、複製の交付、追加または訂正、収集・処理・利用の停止、および削除を請求できます。" },
        { p: "アカウントに紐づけたメールアドレスから " + MAIL + " 宛にご連絡ください。運営者は、そのメールアドレスに返信してご本人であることを確認します。照会、閲覧、複製に関する請求には15日以内に、その他の請求には30日以内に回答します。期間を延長する必要がある場合は、先にその理由をお伝えします。" },
        { p: "端末内のデータは、いつでも「設定」のバックアップ機能でエクスポートするか、ご自身で消去できます。" },
        { p: "データを提供しない場合の影響：メールアドレスを提供しない場合、ログイン、クラウド同期、内蔵 AI は使えません。会話を AI 提供元に送ることに同意しない場合、AI による返信は使えません。Google や GitHub を認可しない場合、そのバックアップ方法は使えません。それ以外の機能は通常どおり使えます。" }
      ] },
      { h: "九、アカウントの削除", blocks: [
        { p: MAIL + " 宛にご連絡のうえ、お申し込みください。ご本人であることを確認した後、30日以内にあなたのアカウント、クラウド上のデータ、内蔵 AI の利用記録を削除し、完了後にメールでお知らせします。削除が完了するまでは、ご連絡いただければ取り消すことができます。削除後は元に戻せません。" },
        { p: "端末内のデータには影響しません。必要に応じてご自身で消去してください。法令で保存が義務づけられている記録は、法定の期間保存されます。" }
      ] },
      { h: "十、データのセキュリティ", blocks: [
        { p: "通信は常に暗号化されます。クラウド上のデータはアカウントごとに分けて保存され、アクセスにはあなたのログイン情報が必要です。運営者はデータの保護に最善を尽くしますが、ネットワーク上の送信が100%安全であることは保証できません。アカウントと API Key は大切に管理してください。" }
      ] },
      { h: "十一、Cookie とローカルストレージ", blocks: [
        { p: "運営者自身は、広告や分析用のトラッキング Cookie を使用しません。本サービスは、データとログイン状態を保存するためにブラウザのローカルストレージを使用します。これは機能を動かすために必要です。埋め込まれた YouTube と Spotify のプレーヤーは、独自の Cookie を設定する場合があります。" }
      ] },
      { h: "十二、年齢", blocks: [
        { p: "本サービスには恋愛や出会いなどをテーマにした内容が含まれるため、18歳以上の方のみご利用いただけます。運営者が18歳未満の方のデータを意図的に収集することはありません。そのような事実を知った場合は、関連するアカウントデータを削除します。" }
      ] },
      { h: "十三、ポリシーの更新", blocks: [
        { p: "このページには、現在のバージョンをいつでもお読みいただけるよう掲載しています。内容を更新したときは施行日を変更します。あなたの権利に重大な影響を与える変更は、効力が生じる少なくとも7日前にアプリ内でお知らせします。" }
      ] },
      { h: "十四、お問い合わせ", blocks: [
        { p: "収集者：MaliPhone（個人開発者による運営）<br>Email：" + MAIL }
      ] }
    ]
  };

  C.ko = {
    title: "MaliPhone 개인정보 처리방침",
    updated: "시행일: 2026년 10월 15일",
    intro: [
      (OFFICIAL ? "MaliPhone은 브라우저 안에 있는 작은 휴대폰입니다. 여기에서 AI 캐릭터와 채팅하고, 생활을 꾸리고, 미니 게임을 즐길 수 있습니다. 웹 버전은 maliphone.com에 있으며 Android 버전도 있습니다. 본 서비스는 회사가 아닌 개인 개발자가 운영합니다." : "MaliPhone은 브라우저 안에 있는 작은 휴대폰입니다. 여기에서 AI 캐릭터와 채팅하고, 생활을 꾸리고, 미니 게임을 즐길 수 있습니다. 웹 버전과 Android 버전이 있습니다. 본 서비스는 회사가 아닌 개인 개발자가 운영합니다."),
      "이 방침은 어떤 데이터를 다루는지, 왜 필요한지, 누구에게 전달되는지, 그리고 이용자가 어떻게 관리할 수 있는지를 쉬운 말로 설명합니다. 「개인정보 보호법」(대만)에 따라 알려야 하는 사항도 아래에 모두 적었습니다."
    ],
    summary: [
      "로그인하지 않아도 대부분의 기능을 사용할 수 있습니다. 캐릭터, 채팅, 설정은 이용자의 기기에 저장되며 운영자 서버에는 저장되지 않습니다.",
      "AI를 사용할 때는 해당 대화를 모델 제공업체에 보내야 답변을 만들 수 있습니다. 이는 로그인 여부와 관계없이 같습니다.",
      "로그인과 클라우드 동기화는 선택 기능입니다. 업로드와 다운로드는 이용자가 직접 확인해야만 진행됩니다.",
      "운영자는 데이터를 판매하지 않고, 광고를 넣지 않으며, 분석용 추적 도구도 사용하지 않습니다. 채팅 내용을 모델 학습에 사용하지도 않습니다."
    ],
    sections: [
      { h: "1. 이용자 기기에 저장되는 데이터", blocks: [
        { p: "캐릭터, 채팅 기록, 설정, 사진, 가계부, 게임 진행 상황은 기본적으로 이용자가 사용하는 브라우저나 휴대폰에 저장되며, 운영자 서버로 자동 업로드되지 않습니다." },
        { p: "브라우저 데이터를 삭제하거나 앱을 제거하거나 기기를 바꾸면 기기 내 데이터가 사라질 수 있으니, 백업 기능을 정기적으로 사용하시기를 권합니다. Android 버전을 사용하는 경우, 휴대폰 설정에 따라 휴대폰에 내장된 시스템 백업이 앱 데이터를 함께 백업할 수 있습니다. 이 부분은 이용자의 휴대폰과 Google 계정이 관리합니다." },
        { p: "이용자가 직접 입력한 AI 서비스 API Key는 기기에만 저장되며, 클라우드 동기화와 백업 파일 모두에서 제외됩니다." }
      ] },
      { h: "2. 운영자가 처리하는 개인정보", blocks: [
        { table: { head: ["상황", "데이터", "목적"], rows: [
          ["계정 로그인(선택)", "이메일, 계정 식별자, 로그인 상태. Google로 로그인하는 경우 이름과 프로필 사진도 포함됩니다", "이용자의 신원을 확인하고 클라우드 데이터를 이용자의 계정에 연결하기 위해서입니다. 로그인 상태는 로그아웃할 때까지 기기에 저장됩니다"],
          ["클라우드 동기화(선택)", "이용자가 업로드하기로 선택한 데이터(현재는 텍스트 데이터)", "여러 기기에서 자신의 데이터를 다시 가져올 수 있게 하기 위해서입니다. 계정 페이지를 열면 클라우드 데이터의 상태를 읽어 오지만, 기기 내 데이터를 자동으로 덮어쓰지는 않습니다"],
          ["내장 AI 사용", "계정 식별자, 요청 번호, 시간, 사용한 기능과 모델, 제공업체, 글자 수와 토큰 수, 처리 시간, 성공 또는 오류 코드. 비공개 테스트 명단에는 이메일과 메모도 포함됩니다", "일일 사용량 계산, 남용 방지, 오류 확인을 위해서입니다. 대화 내용은 포함되지 않습니다"],
          ["고객 지원에 메일 보내기", "이용자의 이메일과 메일 내용", "문의에 답변하고 요청을 처리하기 위해서입니다"]
        ] } },
        { p: "운영자는 이용자의 Gmail, 연락처, 캘린더, 기타 Google 계정 데이터를 읽지 않습니다." }
      ] },
      { h: "3. AI 대화가 전달되는 곳", blocks: [
        { ul: [
          "직접 API Key를 사용하는 경우: 대화 내용이 이용자가 선택한 제공업체로 전송됩니다. 일부 서비스는 운영자 중계 서버를 거치는데, 중계 서버는 요청과 Key를 전달하기만 할 뿐 대화 내용이나 Key를 데이터베이스에 기록하지 않습니다.",
          "내장 AI를 사용하는 경우: 대화 내용이 운영자가 연동한 모델 제공업체, 즉 현재 Google(Gemini)과 OpenRouter, 그리고 OpenRouter가 연결하는 모델 업체로 전송됩니다. 운영자는 앞 항목에 적은 사용량 데이터만 저장합니다."
        ] },
        { p: "제공업체가 내용을 받은 뒤 어떻게 처리하는지(학습에 사용하는지 여부 포함)는 각 제공업체의 정책에 따릅니다. AI가 만든 내용은 허구이며 정확하지 않을 수 있으니, 사실이나 전문적인 조언으로 받아들이지 마세요." }
      ] },
      { h: "4. 이용자 본인의 클라우드에 백업(선택)", blocks: [
        { ul: [
          "Google Drive: drive.file 권한을 사용하므로, 본 서비스가 만든 파일이나 이용자가 앱에서 열기로 선택한 파일에만 접근할 수 있습니다. 승인은 백업 기능을 사용하는 동안에만 앱 안에 존재하며 운영자 서버로 전송되지 않습니다.",
          "GitHub: GitHub의 repo 권한은 이용자의 모든 저장소를 읽고 쓸 수 있는 권한이지만, 본 서비스는 이용자가 지정한 백업 저장소만 읽고 씁니다. 승인 과정은 운영자 중계 서버를 거치지만, 서버는 이용자의 토큰을 저장하지 않습니다."
        ] },
        { p: "백업 파일은 이용자 본인의 계정에 저장되며, 운영자가 임의로 접근하지 않습니다. 본 서비스가 Google API로 얻은 정보를 사용하고 전송하는 방식은 '제한적 사용' 요건을 포함하여 " + GPOLICY + "를 따릅니다." }
      ] },
      { h: "5. 제3자 서비스", blocks: [
        { p: "서비스가 동작하도록 데이터는 아래 제공업체를 거치며, 각 제공업체의 개인정보 처리방침에 따라 처리됩니다. 운영자는 마케팅이나 그 밖의 목적으로 데이터를 다른 사람에게 넘기지 않습니다." },
        { table: { head: ["제공업체", "목적", "관여하는 시점"], rows: [
          ["Cloudflare", "웹사이트 호스팅, 중계 서버, 클라우드 데이터베이스, 이미지 저장", "사용할 때마다"],
          ["Google Fonts", "화면 글꼴 불러오기. Google이 이용자의 IP 주소를 받습니다", "사용할 때마다"],
          ["Supabase", "계정 로그인", "로그인할 때"],
          ["AI 모델 제공업체", "답변 생성", "AI를 사용할 때"],
          ["YouTube, Spotify", "삽입형 음악 플레이어. 이 플랫폼들이 자체 쿠키를 설정할 수 있습니다", "음악 플레이어를 사용할 때"],
          ["Google, GitHub", "로그인과 백업", "해당 기능을 사용할 때"]
        ] } },
        { p: "YouTube 플레이어는 YouTube API 서비스에 해당하므로, 사용할 때 " + YT_TOS + "YouTube 서비스 약관</a>과 " + G_PRIV + "Google 개인정보 처리방침</a>도 함께 적용됩니다." },
        { p: "법원이나 수사기관이 법에 따라 열람을 요구하면, 필요한 데이터를 제공해야 할 수 있습니다." }
      ] },
      { h: "6. 저장 위치와 국외 전송", blocks: [
        { p: "위 제공업체의 대부분은 미국이나 전 세계 여러 지역에 데이터 센터를 두고 있습니다. 로그인, 동기화, AI, 음악 기능을 사용하면 이용자의 데이터가 대만 밖의 지역으로 전송되어 처리되고 저장됩니다." }
      ] },
      { h: "7. 보관 기간", blocks: [
        { ul: [
          "기기 내 데이터: 이용자가 삭제하거나, 브라우저 데이터 삭제나 앱 제거로 사라질 때까지 이용자의 기기에 저장됩니다.",
          "계정, 클라우드 데이터, 내장 AI 사용 기록: 계정 삭제가 완료될 때까지 보관됩니다.",
          "고객 지원 메일: 처리가 끝난 뒤 최대 1년간 보관하며, 같은 문제를 후속으로 확인하기 위해서입니다.",
          "제공업체의 일반 접속 기록(예: IP 주소와 요청 시간): 보안 보호를 위해 각 제공업체의 정책에 따라 보관됩니다."
        ] }
      ] },
      { h: "8. 이용자의 권리와 요청 방법", blocks: [
        { p: "개인정보 보호법에 따라 이용자는 개인정보의 조회 또는 열람, 사본 발급, 추가 또는 정정, 수집·처리·이용의 중단, 그리고 삭제를 요청할 수 있습니다." },
        { p: "계정에 연결된 이메일로 " + MAIL + " 앞으로 메일을 보내 주세요. 운영자는 그 이메일로 회신하여 본인임을 확인합니다. 조회, 열람, 사본 요청에는 15일 이내에, 그 밖의 요청에는 30일 이내에 답변드립니다. 기간을 연장해야 할 때는 먼저 그 이유를 알려드립니다." },
        { p: "기기 내 데이터는 언제든지 '설정'의 백업 기능으로 내보내거나 직접 삭제할 수 있습니다." },
        { p: "데이터를 제공하지 않을 때의 영향: 이메일을 제공하지 않으면 로그인, 클라우드 동기화, 내장 AI를 사용할 수 없습니다. 대화를 AI 제공업체에 보내는 데 동의하지 않으면 AI 답변을 사용할 수 없습니다. Google이나 GitHub를 승인하지 않으면 해당 백업 방식을 사용할 수 없습니다. 그 밖의 기능은 그대로 사용할 수 있습니다." }
      ] },
      { h: "9. 계정 삭제", blocks: [
        { p: MAIL + " 앞으로 메일을 보내 신청해 주세요. 본인임을 확인한 뒤 30일 이내에 이용자의 계정, 클라우드 데이터, 내장 AI 사용 기록을 삭제하고, 완료되면 메일로 알려드립니다. 삭제가 완료되기 전에는 메일로 신청을 철회할 수 있습니다. 삭제한 뒤에는 되돌릴 수 없습니다." },
        { p: "기기 내 데이터는 영향을 받지 않으니, 필요하면 직접 삭제해 주세요. 법령에서 보관하도록 요구하는 기록은 법정 기간 동안 보관됩니다." }
      ] },
      { h: "10. 데이터 보안", blocks: [
        { p: "연결은 처음부터 끝까지 암호화됩니다. 클라우드 데이터는 계정별로 나누어 저장되며, 접근하려면 이용자의 로그인 인증 정보가 필요합니다. 운영자는 데이터를 보호하기 위해 최선을 다하지만 네트워크 전송이 100% 안전하다고는 보장할 수 없으니, 계정과 API Key를 잘 관리해 주세요." }
      ] },
      { h: "11. 쿠키와 로컬 저장소", blocks: [
        { p: "운영자는 광고용이나 분석용 추적 쿠키를 직접 사용하지 않습니다. 본 서비스는 이용자의 데이터와 로그인 상태를 저장하기 위해 브라우저의 로컬 저장소를 사용하며, 이는 기능이 동작하는 데 꼭 필요합니다. 삽입된 YouTube와 Spotify 플레이어는 자체 쿠키를 설정할 수 있습니다." }
      ] },
      { h: "12. 연령", blocks: [
        { p: "본 서비스에는 연애, 만남 등을 소재로 한 내용이 있어 만 18세 이상의 이용자에게만 제공됩니다. 운영자는 만 18세 미만인 분의 데이터를 의도적으로 수집하지 않으며, 그런 경우를 알게 되면 관련 계정 데이터를 삭제합니다." }
      ] },
      { h: "13. 방침 변경", blocks: [
        { p: "이 페이지에는 현재 버전을 언제든지 읽으실 수 있도록 게시합니다. 내용이 바뀌면 시행일을 수정하며, 이용자의 권익에 중대한 영향을 주는 변경은 효력이 생기기 최소 7일 전에 앱 안에서 공지합니다." }
      ] },
      { h: "14. 문의하기", blocks: [
        { p: "수집자: MaliPhone(개인 개발자 운영)<br>Email: " + MAIL }
      ] }
    ]
  };
})();
