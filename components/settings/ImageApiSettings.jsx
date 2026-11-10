import React, { useEffect, useState } from "react";
import { loadImageApiConfig, saveImageApiConfig, getImageQuota } from "../../services/images/galleryImageStorage";
import { testImageApi, fetchImageModels } from "../../services/images/imageGenService";

// 算圖 API 獨立成一區，跟聊天的 AI 連線、語音 API 分開，避免三組 Key 混在一起。
// 這個元件自己管狀態與存檔，不吃 MaliPhone 傳下來的 props。
export default function ImageApiSettings({ tr }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [connectionState, setConnectionState] = useState("idle");
  const [errorText, setErrorText] = useState("");
  const [quota, setQuota] = useState(null);
  const [models, setModels] = useState(null); // { imageModels, allModels }
  const [showAllModels, setShowAllModels] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);

  useEffect(() => {
    let alive = true;
    loadImageApiConfig().then((saved) => {
      if (alive) setConfig(saved);
    });
    getImageQuota().then((value) => {
      if (alive) setQuota(value);
    });
    return () => { alive = false; };
  }, []);

  if (!config) return null;

  const update = (patch) => setConfig((current) => ({ ...current, ...patch }));

  const onSave = async () => {
    const saved = await saveImageApiConfig(config);
    setConfig(saved);
    setQuota(await getImageQuota());
    setConnectionState("saved");
  };

  const onFetchModels = async () => {
    setFetchingModels(true);
    setErrorText("");
    try {
      const result = await fetchImageModels(config);
      setModels(result);
      // 名稱推測抓不到東西時直接攤開全部，不然玩家會看到空清單。
      if (!result.imageModels.length) setShowAllModels(true);
      setConnectionState("idle");
    } catch (error) {
      setErrorText(error?.message || String(error));
      setConnectionState("error");
    } finally {
      setFetchingModels(false);
    }
  };

  const modelOptions = models ? (showAllModels ? models.allModels : models.imageModels) : [];

  const onTest = async () => {
    setConnectionState("loading");
    setErrorText("");
    try {
      // 測試連線會實際產一張圖，等於花掉一次額度，所以按鈕文字要講清楚。
      await testImageApi(config);
      await saveImageApiConfig(config);
      setConnectionState("success");
    } catch (error) {
      setErrorText(error?.message || String(error));
      setConnectionState("error");
    }
  };

  return <div className="mp-sg">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }} onClick={() => setOpen((value) => !value)}>
      <div className="mp-sg-t" style={{ marginBottom: 0 }}>{tr("圖像 API", "Image API", "画像 API", "이미지 API")}</div>
      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--mp-pink-dk)" }}>{open ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
    </div>

    {open && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 }}>
      <div className="mp-lbl" style={{ marginBottom: 0 }}>{tr("啟用算圖", "Enable image generation", "画像生成を有効にする", "이미지 생성 사용")}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--mp-txt-l)", fontWeight: 600 }}>{config.enabled ? tr("已開啟", "On", "オン", "켜짐") : tr("已關閉", "Off", "オフ", "꺼짐")}</span>
        <button type="button" role="switch" aria-checked={!!config.enabled} className={`mp-switch ${config.enabled ? "active" : ""}`} onClick={() => update({ enabled: !config.enabled })}><span /></button>
      </div>
    </div>}

    {open && !config.enabled && <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.6, marginTop: 8 }}>{tr("算圖功能目前關閉，設定已保留。", "Image generation is off; your settings are retained.", "画像生成はオフです。設定は保持されます。", "이미지 생성이 꺼져 있으며 설정은 유지됩니다.")}</div>}

    {open && config.enabled && <div style={{ marginTop: 12 }}>
      <div className="mp-row">
        <div className="mp-lbl">{tr("圖像供應商", "Image provider", "画像プロバイダー", "이미지 제공업체")}</div>
        <select className="mp-ssel" value="gemini" disabled><option value="gemini">Gemini</option></select>
      </div>

      <div className="mp-row">
        <div className="mp-lbl">API Key</div>
        <input className="mp-sinp" type="password" value={config.apiKey || ""} onChange={(event) => update({ apiKey: event.target.value })} placeholder="AIza..." />
      </div>
      <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.6, marginBottom: 8 }}>{tr("與聊天用的 Key 分開儲存，可以填同一把。Key 只存在這台裝置。", "Stored separately from the chat key; the same key works. It stays on this device.", "チャット用 Key とは別に保存されます。同じ Key でも構いません。Key はこの端末にのみ保存されます。", "채팅용 Key와 별도로 저장됩니다. 같은 Key를 사용해도 됩니다. Key는 이 기기에만 저장됩니다.")}</div>

      <div className="mp-row">
        <div className="mp-lbl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>{tr("圖像模型", "Image model", "画像モデル", "이미지 모델")}</span>
          <button type="button" className="mp-ibtn" disabled={fetchingModels || !config.apiKey} onClick={onFetchModels}>{fetchingModels ? tr("讀取中...", "Loading...", "読み込み中...", "불러오는 중...") : tr("取得最新模型", "Fetch latest models", "最新モデルを取得", "최신 모델 가져오기")}</button>
        </div>
        {modelOptions.length > 0
          ? <select className="mp-ssel" value={config.model} onChange={(event) => update({ model: event.target.value })}>
              {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
              {!modelOptions.includes(config.model) && config.model ? <option value={config.model}>{config.model}</option> : null}
            </select>
          : <input className="mp-sinp" type="text" value={config.model || ""} onChange={(event) => update({ model: event.target.value })} placeholder="gemini-2.5-flash-image" />}
      </div>

      {models && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.6 }}>{showAllModels ? tr("顯示全部模型（含聊天模型，選錯不會出圖）", "Showing all models (chat models included; those return no image)", "全モデルを表示（チャットモデル含む。画像は返りません）", "모든 모델 표시 (채팅 모델 포함, 이미지 없음)") : `${tr("已篩選出可能的圖像模型", "Filtered to likely image models", "画像モデルの候補を絞り込み", "이미지 모델 후보만 표시")} (${models.imageModels.length})`}</span>
        <button type="button" className="mp-ibtn" onClick={() => setShowAllModels((value) => !value)}>{showAllModels ? tr("只看圖像", "Image only", "画像のみ", "이미지만") : tr("顯示全部", "Show all", "すべて表示", "전체 표시")}</button>
      </div>}

      <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.6, marginBottom: 8 }}>{tr("必須是「圖像生成」模型，一般聊天模型不會回傳圖片。Google 的模型清單無法辨識輸出型別，這裡的篩選是用名稱推測，抓不到時可直接手動輸入。", "Must be an image generation model; chat models return no image. Google's model list can't report output type, so this filter guesses from the name—type it manually if yours is missing.", "画像生成モデルである必要があります。チャットモデルは画像を返しません。Google のモデル一覧は出力形式を判別できないため、ここでは名前から推測しています。見つからない場合は手動入力してください。", "이미지 생성 모델이어야 합니다. 채팅 모델은 이미지를 반환하지 않습니다. Google 모델 목록은 출력 형식을 알 수 없어 이름으로 추측하며, 없으면 직접 입력하세요.")}</div>

      <div className="mp-row">
        <div className="mp-lbl">{tr("每日張數上限", "Daily image limit", "1日あたりの上限枚数", "일일 생성 제한")}</div>
        <input className="mp-sinp" type="number" min="0" value={config.dailyLimit ?? 20} onChange={(event) => update({ dailyLimit: Math.max(0, Number(event.target.value) || 0) })} />
      </div>
      <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.6, marginBottom: 8 }}>
        {tr("每張圖都會消耗你的 API 額度。設 0 表示不限制。", "Each image consumes your API quota. Set 0 for no limit.", "画像ごとに API 使用量を消費します。0 で無制限。", "이미지마다 API 사용량이 소모됩니다. 0이면 무제한.")}
        {quota && quota.limit > 0 ? ` ${tr("今日已用", "Used today", "本日の使用", "오늘 사용")} ${quota.used} / ${quota.limit}` : ""}
      </div>

      <button type="button" className="mp-save" disabled={!config.apiKey} style={{ background: "linear-gradient(135deg,#f8bbd0,#f06292)", marginBottom: 8 }} onClick={onSave}>{tr("儲存設定", "Save", "設定を保存", "설정 저장")}</button>
      <button type="button" className="mp-save" disabled={connectionState === "loading" || !config.apiKey || !config.model} style={{ background: "linear-gradient(135deg,#80cbc4,#26a69a)" }} onClick={onTest}>{connectionState === "loading" ? tr("測試中...", "Testing...", "テスト中...", "테스트 중...") : tr("測試連線（會產生 1 張圖）", "Test connection (generates 1 image)", "接続テスト（画像を 1 枚生成）", "연결 테스트 (이미지 1장 생성)")}</button>

      {connectionState === "saved" && <div style={{ fontSize: 10, color: "#43a047", marginTop: 7 }}>{tr("已儲存", "Saved", "保存しました", "저장되었습니다")}</div>}
      {connectionState === "success" && <div style={{ fontSize: 10, color: "#43a047", marginTop: 7 }}>{tr("圖像 API 連線成功", "Image API connected", "画像 API 接続成功", "이미지 API 연결 성공")}</div>}
      {connectionState === "error" && <div style={{ fontSize: 10, color: "#e57373", marginTop: 7, lineHeight: 1.6 }}>{errorText || tr("連線失敗，請檢查 Key 與模型名稱。", "Connection failed. Check the key and model name.", "接続に失敗しました。Key とモデル名を確認してください。", "연결에 실패했습니다. Key와 모델명을 확인해주세요.")}</div>}
    </div>}
  </div>;
}
