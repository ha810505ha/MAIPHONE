// 錯誤白話對照表：用狀態碼與訊息比對「確定看得出原因」的錯誤，回傳給玩家看的說明。
// 比對不到就回傳 null，畫面維持原樣（錯誤診斷會提示複製回報）。
// 聊天室錯誤訊息與設定 → 錯誤診斷共用這份規則；新增錯誤類型時只要加一條規則。

const TONE = Object.freeze({ fix: "fix", service: "service", bug: "bug", unknown: "unknown" });

const statusFrom = ({ status, message, details }) => {
  const direct = Number(status ?? details?.status);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const match = String(message || "").match(/\bHTTP (\d{3})\b/);
  return match ? Number(match[1]) : 0;
};

const BUG_KINDS = new Set(["blank-screen", "react-render", "window-error", "unhandled-rejection"]);

/**
 * @param {{status?: number, message?: string, kind?: string, details?: object}} input
 * @param {Function} tr 介面翻譯函式 tr(zh, en, ja, ko)
 * @returns {{id: string, tone: string, tag: string, title: string, hint: string} | null}
 */
export function explainError(input, tr) {
  const message = String(input?.message || "");
  const kind = String(input?.kind || "");
  const status = statusFrom(input || {});
  const has = (pattern) => pattern.test(message);
  const tags = {
    settings: tr("API 設定", "API settings", "API 設定", "API 설정"),
    credit: tr("額度", "Credits", "クレジット", "크레딧"),
    network: tr("網路", "Network", "ネットワーク", "네트워크"),
    length: tr("對話長度", "Chat length", "会話の長さ", "대화 길이"),
    safety: tr("內容審查", "Content filter", "コンテンツ審査", "콘텐츠 심사"),
    update: tr("版本更新", "App update", "アップデート", "업데이트"),
    storage: tr("儲存空間", "Storage", "ストレージ", "저장 공간"),
    service: tr("服務商問題", "Provider issue", "提供元の問題", "제공업체 문제"),
    bug: tr("請回報", "Please report", "報告してください", "제보해 주세요"),
  };
  const make = (id, tone, tag, title, hint) => ({ id, tone, tag, title, hint });

  if (kind === "storage-load") {
    const name = String(input?.details?.name || "");
    if (name === "VersionError") return make("storage-version", TONE.fix, tags.update,
      tr("🔄 資料是新版本存的", "🔄 Data was saved by a newer version", "🔄 新しいバージョンで保存されたデータです", "🔄 새 버전으로 저장된 데이터입니다"),
      tr("請更新到最新版（網頁版重新整理即可），資料都還在。", "Update to the latest version (refresh the web page). Your data is still there.", "最新版に更新してください（ウェブ版は再読み込み）。データは残っています。", "최신 버전으로 업데이트해 주세요(웹은 새로고침). 데이터는 그대로 있습니다."));
    if (name === "QuotaExceededError" || /quota|space|disk|backing store/i.test(message)) return make("storage-space", TONE.fix, tags.storage,
      tr("💾 手機空間可能不足", "💾 Device storage may be full", "💾 空き容量が不足している可能性があります", "💾 저장 공간이 부족할 수 있습니다"),
      tr("清出一些空間後，完全關閉再重新開啟。", "Free up some space, then fully close and reopen.", "空きを作ってから、完全に閉じて開き直してください。", "공간을 확보한 뒤 완전히 종료하고 다시 열어 주세요."));
    return make("storage-load", TONE.bug, tags.bug,
      tr("💾 讀取存檔失敗", "💾 Couldn't read saved data", "💾 セーブデータを読み込めませんでした", "💾 저장 데이터를 읽지 못했습니다"),
      tr("資料沒有被覆蓋。請先不要清除資料或重裝，並複製錯誤資訊回報。", "Your data wasn't overwritten. Don't clear data or reinstall; please copy the details and report them.", "データは上書きされていません。データ消去や再インストールはせず、エラー情報をコピーして報告してください。", "데이터는 덮어써지지 않았습니다. 데이터 삭제나 재설치를 하지 말고 오류 정보를 복사해 알려 주세요."));
  }

  if (has(/dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported/i)) {
    return make("chunk-load", TONE.fix, tags.update,
      tr("🔄 網站剛更新了版本", "🔄 The app was just updated", "🔄 アプリが更新されました", "🔄 앱이 방금 업데이트되었습니다"),
      tr("重新整理頁面（或完全關閉再開啟）就會載入新版。", "Refresh the page (or fully close and reopen) to load the new version.", "ページを再読み込み（または完全に閉じて開き直す）すると新しい版が読み込まれます。", "페이지를 새로고침(또는 완전히 종료 후 다시 열기)하면 새 버전이 로드됩니다."));
  }

  if (has(/請先設定 API Key|请先设定 API Key/)) {
    return make("no-key", TONE.fix, tags.settings,
      tr("🔑 還沒設定 API Key", "🔑 No API key yet", "🔑 API キーが未設定です", "🔑 API 키가 설정되지 않았습니다"),
      tr("請到設定 → AI 選擇服務商並貼上金鑰，或改用不需要金鑰的本地模型。", "Go to Settings → AI, choose a provider and paste your key, or use a local model that doesn't need one.", "設定 → AI で提供元を選んでキーを貼り付けるか、キー不要のローカルモデルを使ってください。", "설정 → AI에서 제공업체를 선택하고 키를 붙여 넣거나, 키가 필요 없는 로컬 모델을 사용해 주세요."));
  }

  if (status === 401 || status === 403
    || has(/invalid[ _-]?api[ _-]?key|incorrect api key|api key not valid|unauthori[sz]ed|no auth credentials|authentication|permission denied/i)) {
    return make("auth", TONE.fix, tags.settings,
      tr("🔑 API Key 無效或過期", "🔑 API key is invalid or expired", "🔑 API キーが無効か期限切れです", "🔑 API 키가 유효하지 않거나 만료되었습니다"),
      tr("請到設定 → AI 重新貼上金鑰；剛換過服務商的話，金鑰也要換成那一家的。", "Paste your key again in Settings → AI. If you switched providers, use that provider's key.", "設定 → AI でキーを貼り直してください。提供元を変えた場合は、その提供元のキーにしてください。", "설정 → AI에서 키를 다시 붙여 넣어 주세요. 제공업체를 바꿨다면 해당 업체의 키를 사용해야 합니다."));
  }

  if (status === 402 || has(/insufficient[_ ](credits|balance|quota|funds)|credit balance|payment required|billing|more credits/i)) {
    return make("credits", TONE.fix, tags.credit,
      tr("💳 帳戶額度不足", "💳 Not enough credits", "💳 クレジットが不足しています", "💳 크레딧이 부족합니다"),
      tr("服務商帳戶的餘額用完了，需要到服務商網站儲值，或改用免費模型。", "Your provider account is out of balance. Top up on the provider's site or switch to a free model.", "提供元アカウントの残高がありません。提供元のサイトでチャージするか、無料モデルに切り替えてください。", "제공업체 계정 잔액이 없습니다. 제공업체 사이트에서 충전하거나 무료 모델로 바꿔 주세요."));
  }

  if (status === 404 && has(/:free\b/i)) {
    return make("free-model-gone", TONE.fix, tags.settings,
      tr("🚫 免費模型已停用", "🚫 Free model no longer available", "🚫 無料モデルは終了しました", "🚫 무료 모델이 종료되었습니다"),
      tr("這個免費模型被下架或改成付費了。到設定 → AI 重新整理模型清單，換一個結尾是 :free 的模型。", "This free model was removed or made paid. Refresh the model list in Settings → AI and pick another one ending in :free.", "この無料モデルは終了または有料化されました。設定 → AI でモデル一覧を更新し、末尾が :free の別モデルを選んでください。", "이 무료 모델은 종료되었거나 유료로 바뀌었습니다. 설정 → AI에서 모델 목록을 새로고침하고 :free로 끝나는 다른 모델을 선택해 주세요."));
  }

  if (status === 404 || has(/model.{0,40}(not found|does not exist|not exist)|no endpoints found|unknown model/i)) {
    return make("model-not-found", TONE.fix, tags.settings,
      tr("🔍 找不到這個模型", "🔍 Model not found", "🔍 モデルが見つかりません", "🔍 모델을 찾을 수 없습니다"),
      tr("模型名稱或 API 網址可能不對。到設定 → AI 重新整理模型清單後重新選擇。", "The model name or API URL may be wrong. Refresh the model list in Settings → AI and choose again.", "モデル名か API の URL が正しくない可能性があります。設定 → AI でモデル一覧を更新して選び直してください。", "모델 이름이나 API 주소가 잘못되었을 수 있습니다. 설정 → AI에서 모델 목록을 새로고침하고 다시 선택해 주세요."));
  }

  if (status === 429 || has(/rate[ _-]?limit|too many requests|resource has been exhausted|quota exceeded/i)) {
    if (has(/per[ _-]?day|daily/i)) {
      return make("free-daily-limit", TONE.fix, tags.credit,
        tr("⏳ 免費額度今天用完了", "⏳ Today's free quota is used up", "⏳ 今日の無料枠を使い切りました", "⏳ 오늘 무료 한도를 모두 사용했습니다"),
        tr("免費模型每天有次數上限。可以明天再試、換別的模型，或在服務商儲值解鎖更多次數。", "Free models have a daily limit. Try again tomorrow, switch models, or add credits with your provider.", "無料モデルには1日の上限があります。明日再試行するか、別モデルに切り替えるか、提供元でチャージしてください。", "무료 모델은 하루 사용 한도가 있습니다. 내일 다시 시도하거나 다른 모델로 바꾸거나 제공업체에서 충전해 주세요."));
    }
    return make("rate-limit", TONE.fix, tags.credit,
      tr("⏳ 請求太頻繁", "⏳ Too many requests", "⏳ リクエストが多すぎます", "⏳ 요청이 너무 많습니다"),
      tr("短時間內送出太多次，或免費模型很多人在用。等一兩分鐘再重新生成，或換別的模型。", "Too many requests in a short time, or the free model is busy. Wait a minute or two, or switch models.", "短時間に送信しすぎたか、無料モデルが混雑しています。1〜2分待つか、別モデルに切り替えてください。", "짧은 시간에 너무 많이 보냈거나 무료 모델이 혼잡합니다. 1~2분 기다리거나 다른 모델로 바꿔 주세요."));
  }

  if (has(/context[ _-]?length|maximum context|too many tokens|prompt is too long|token limit|context window/i)) {
    return make("context-length", TONE.fix, tags.length,
      tr("📏 對話太長了", "📏 The conversation is too long", "📏 会話が長すぎます", "📏 대화가 너무 깁니다"),
      tr("內容超過這個模型能讀的長度。可以到狀態壓縮記憶、減少世界書條目，或換上下文較大的模型。", "The content exceeds what this model can read. Compress memories in Status, reduce lorebook entries, or use a model with a larger context.", "このモデルが読める長さを超えています。ステータスで記憶を圧縮するか、ワールドブックの項目を減らすか、文脈の大きいモデルに切り替えてください。", "이 모델이 읽을 수 있는 길이를 넘었습니다. 상태에서 기억을 압축하거나 세계관 항목을 줄이거나 컨텍스트가 큰 모델로 바꿔 주세요."));
  }

  if (has(/content[ _-]?policy|safety|moderation|flagged|PROHIBITED_CONTENT|blocked by|responsible ai/i)) {
    return make("safety", TONE.fix, tags.safety,
      tr("🛡️ 被服務商的內容審查擋下", "🛡️ Blocked by the provider's content filter", "🛡️ 提供元のコンテンツ審査でブロックされました", "🛡️ 제공업체의 콘텐츠 심사에 막혔습니다"),
      tr("這次的內容觸發了服務商的安全規則。可以調整劇情或用詞後重新生成，或換別的模型。", "This content triggered the provider's safety rules. Adjust the story or wording and regenerate, or switch models.", "今回の内容が提供元の安全ルールに引っかかりました。展開や言い回しを変えて再生成するか、別モデルに切り替えてください。", "이번 내용이 제공업체의 안전 규칙에 걸렸습니다. 전개나 표현을 바꿔 다시 생성하거나 다른 모델로 바꿔 주세요."));
  }

  if (has(/不支援圖片|support image input|image input|does not support images?/i)) {
    return make("no-vision", TONE.fix, tags.settings,
      tr("🖼️ 這個模型看不了圖片", "🖼️ This model can't read images", "🖼️ このモデルは画像を読めません", "🖼️ 이 모델은 이미지를 읽을 수 없습니다"),
      tr("傳圖片時請換成支援圖片（視覺）的模型。", "Switch to a model that supports images (vision) when sending pictures.", "画像を送るときは、画像（ビジョン）対応のモデルに切り替えてください。", "이미지를 보낼 때는 이미지(비전)를 지원하는 모델로 바꿔 주세요."));
  }

  if (status >= 500 || has(/overloaded|bad gateway|service unavailable|internal server error|upstream|provider returned error|server error/i)) {
    return make("provider-down", TONE.service, tags.service,
      tr("☁️ AI 服務暫時故障", "☁️ The AI service is temporarily down", "☁️ AI サービスが一時的に不調です", "☁️ AI 서비스에 일시적인 문제가 있습니다"),
      tr("不是你的設定問題，等幾分鐘再按重新生成就好。", "It's not your settings. Wait a few minutes and regenerate.", "設定の問題ではありません。数分待ってから再生成してください。", "설정 문제가 아닙니다. 몇 분 후 다시 생성해 주세요."));
  }

  if (has(/timed? ?out|timeout|逾時/i)) {
    return make("timeout", TONE.service, tags.network,
      tr("⌛ 等太久沒有回應", "⌛ No response in time", "⌛ 応答がありませんでした", "⌛ 응답이 너무 오래 걸렸습니다"),
      tr("網路不穩或服務商太忙。稍後再重新生成；一直發生的話可以換模型。", "The network is unstable or the provider is busy. Regenerate later, or switch models if it keeps happening.", "ネットワークが不安定か、提供元が混雑しています。後で再生成し、続く場合はモデルを切り替えてください。", "네트워크가 불안정하거나 제공업체가 바쁩니다. 나중에 다시 생성하고, 계속되면 모델을 바꿔 주세요."));
  }

  if (kind === "network-error" || has(/failed to fetch|networkerror|load failed|network request failed|net::err_|CORS|跨來源/i)) {
    return make("network", TONE.fix, tags.network,
      tr("📡 連不上 AI 服務", "📡 Couldn't reach the AI service", "📡 AI サービスに接続できません", "📡 AI 서비스에 연결할 수 없습니다"),
      tr("請確認網路連線與 API 網址。用本地模型（如 Ollama）的話，確認它有開著、也允許這個網站連線。", "Check your connection and the API URL. For local models (like Ollama), make sure it's running and allows this site.", "接続と API の URL を確認してください。ローカルモデル（Ollama など）の場合は、起動していてこのサイトからの接続を許可しているか確認してください。", "네트워크와 API 주소를 확인해 주세요. 로컬 모델(Ollama 등)은 실행 중이고 이 사이트의 연결을 허용하는지 확인해 주세요."));
  }

  if (BUG_KINDS.has(kind)) {
    return make("app-bug", TONE.bug, tags.bug,
      tr("🐞 程式出現錯誤", "🐞 Something went wrong in the app", "🐞 アプリでエラーが発生しました", "🐞 앱에서 오류가 발생했습니다"),
      tr("看起來是 MaliPhone 本身的問題，請按下方「複製全部錯誤」傳給我們。", "This looks like a MaliPhone issue. Tap \"Copy all errors\" below and send it to us.", "MaliPhone 自体の問題のようです。下の「すべてコピー」を押して送ってください。", "MaliPhone 자체 문제로 보입니다. 아래 \"모든 오류 복사\"를 눌러 보내 주세요."));
  }

  return null;
}

export const ERROR_TONES = TONE;
