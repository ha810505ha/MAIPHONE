import React from "react";

export default function AiConnectionSettings({
  t, tr, open, setOpen, config, setConfig, providers, modelOptions,
  fetchingModels, onFetchModels, testingConnection, onTest, onSave, onSavePreset, onProviderChange,
}) {
  return <div className="mp-sg">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }} onClick={() => setOpen((value) => !value)}>
      <div className="mp-sg-t" style={{ marginBottom: 0 }}>{tr("AI 連線", "AI connection", "AI 接続", "AI 연결")}</div>
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {!open && <span style={{ fontSize: 10, color: "var(--mp-txt-l)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{config.provider || "-"} · {config.model || "-"}</span>}
        <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 800, color: "var(--mp-pink-dk)" }}>{open ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
      </span>
    </div>
    {open && <div style={{ marginTop: 12 }}>
      <div className="mp-row"><div className="mp-lbl">{tr("API 供應商", "API provider", "API プロバイダー", "API 제공업체")}</div><select className="mp-ssel" value={config.provider} onChange={(event) => onProviderChange(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></div>
      {config.provider === "custom" && <div className="mp-row"><div className="mp-lbl">Base URL</div><input className="mp-sinp" value={config.baseUrl} onChange={(event) => setConfig((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://..." /></div>}
      {config.provider === "vertex" && <div className="mp-row"><div className="mp-lbl">{tr("區域", "Region", "リージョン", "리전")}</div><input className="mp-sinp" value={config.location || "global"} onChange={(event) => setConfig((current) => ({ ...current, location: event.target.value }))} placeholder="global" /></div>}
      <div className="mp-row"><div className="mp-lbl">{tr("API 金鑰", "API key", "API キー", "API 키")}</div><input className="mp-sinp" type="password" value={config.apiKey} onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))} placeholder={config.provider === "vertex" ? "AIza..." : "sk-..."} /></div>
      <div className="mp-row">
        <div className="mp-lbl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span>{tr("模型", "Model", "モデル", "모델")}</span><button type="button" className="mp-ibtn" disabled={fetchingModels} onClick={onFetchModels}>{fetchingModels ? t("loading") : tr("取得最新模型", "Fetch latest models", "最新モデルを取得", "최신 모델 가져오기")}</button></div>
        {modelOptions?.length > 0 ? <select className="mp-ssel" value={config.model} onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))}>{modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}<option value="__custom">{tr("自訂...", "Custom...", "カスタム...", "사용자 지정...")}</option></select> : <input className="mp-sinp" value={config.model} onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))} placeholder="model-name" />}
      </div>
      <div className="mp-row" style={{ display: "block" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div className="mp-lbl">{tr("自訂 Temperature", "Custom temperature", "Temperature を指定", "사용자 지정 Temperature")}</div><button type="button" role="switch" aria-checked={!!config.temperatureEnabled} className={`mp-switch ${config.temperatureEnabled ? "active" : ""}`} onClick={() => setConfig((current) => ({ ...current, temperatureEnabled: !current.temperatureEnabled }))}><span /></button></div>
        {config.temperatureEnabled && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}><input type="range" min="0" max="2" step="0.1" value={Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 1} onChange={(event) => setConfig((current) => ({ ...current, temperature: Math.max(0, Math.min(2, Number(event.target.value))) }))} style={{ flex: 1 }} /><input aria-label="Temperature value" type="number" min="0" max="2" step="0.1" value={Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 1} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) setConfig((current) => ({ ...current, temperature: Math.max(0, Math.min(2, value)) })); }} style={{ width: 62 }} /></div>}
        <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 4 }}>{tr("關閉時使用模型預設值；開啟後所有 AI 功能共用此數值（0～2）。", "When off, the model default is used. When on, all AI features share this value (0–2).", "オフではモデルの既定値、オンではすべての AI 機能で同じ値を使います（0～2）。", "끄면 모델 기본값을 사용하고, 켜면 모든 AI 기능이 같은 값을 사용합니다(0~2).")}</div>
      </div>
      {config.model === "__custom" && <div className="mp-row"><div className="mp-lbl">{tr("自訂模型名稱", "Custom model name", "カスタムモデル名", "사용자 지정 모델 이름")}</div><input className="mp-sinp" onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))} placeholder="model-name" /></div>}
      <div className="mp-row">
        <div className="mp-lbl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span>{tr("上下文長度", "Context length", "コンテキスト長", "컨텍스트 길이")}</span><span style={{ fontWeight: 800 }}>{(Number(config.contextTokens) || 40000).toLocaleString()} tokens</span></div>
        <input type="range" min={10000} max={40000} step={1000} value={Number(config.contextTokens) || 40000} onChange={(event) => setConfig((current) => ({ ...current, contextTokens: Number(event.target.value) }))} style={{ width: "100%" }} />
        <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 2 }}>{tr("角色每次回覆時可讀取的對話量上限，越長越耗費 API 用量", "How much conversation the character can read per reply; longer costs more API usage", "返信ごとにキャラが読める会話量の上限。長いほど API 使用量が増えます", "답장마다 캐릭터가 읽을 수 있는 대화량 상한. 길수록 API 사용량이 늘어납니다")}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="mp-save" disabled={testingConnection} style={{ flex: 1, background: "linear-gradient(135deg,#80cbc4,#26a69a)" }} onClick={onTest}>{testingConnection ? tr("測試中...", "Testing...", "テスト中...", "테스트 중...") : tr("測試連線", "Test connection", "接続テスト", "연결 테스트")}</button>
        <button className="mp-save" style={{ flex: 1 }} onClick={onSave}>{tr("儲存設定", "Save settings", "設定を保存", "설정 저장")}</button>
        <button type="button" className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#90caf9,#42a5f5)" }} onClick={onSavePreset}>{tr("儲存預設", "Save preset", "プリセット保存", "프리셋 저장")}</button>
      </div>
    </div>}
  </div>;
}
