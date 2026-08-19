import React from "react";
import { isLocalProvider, DEFAULT_LOCAL_BASE_URL } from "../../constants/appConstants";
import OpenRouterCreditStatus from "./OpenRouterCreditStatus";

// 模型選擇列：抓取按鈕 + 下拉/手動輸入。雲端與本地共用。
function ModelRow({ t, tr, config, setConfig, modelOptions, fetchingModels, onFetchModels, onModelCommit }) {
  const hasModelOptions = modelOptions?.length > 0;
  const isCustomModel = hasModelOptions && (config.model === "__custom" || !modelOptions.includes(config.model));
  const updateModel = (model, commit = false) => {
    setConfig((current) => ({ ...current, model }));
    if (commit && model && model !== "__custom") onModelCommit?.(model);
  };
  return (
    <>
      <div className="mp-row">
        <div className="mp-lbl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>{tr("模型", "Model", "モデル", "모델")}</span>
          <button type="button" className="mp-ibtn" disabled={fetchingModels} onClick={onFetchModels}>{fetchingModels ? t("loading") : tr("取得最新模型", "Fetch latest models", "最新モデルを取得", "최신 모델 가져오기")}</button>
        </div>
        {hasModelOptions
          ? <select className="mp-ssel" value={isCustomModel ? "__custom" : config.model} onChange={(event) => updateModel(event.target.value, true)}>{modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}<option value="__custom">{tr("自訂...", "Custom...", "カスタム...", "사용자 지정...")}</option></select>
          : <input className="mp-sinp" value={config.model} onChange={(event) => updateModel(event.target.value)} onBlur={(event) => onModelCommit?.(event.target.value.trim())} placeholder="model-name" />}
      </div>
      {isCustomModel && <div className="mp-row"><div className="mp-lbl">{tr("自訂模型名稱", "Custom model name", "カスタムモデル名", "사용자 지정 모델 이름")}</div><input className="mp-sinp" value={config.model === "__custom" ? "" : config.model} onChange={(event) => updateModel(event.target.value)} onBlur={(event) => onModelCommit?.(event.target.value.trim())} placeholder="model-name" /></div>}
    </>
  );
}

// Temperature 開關 + 滑桿。雲端與本地共用。
function TemperatureRow({ tr, config, setConfig }) {
  return (
    <div className="mp-row" style={{ display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div className="mp-lbl">{tr("自訂 Temperature", "Custom temperature", "Temperature を指定", "사용자 지정 Temperature")}</div><button type="button" role="switch" aria-checked={!!config.temperatureEnabled} className={`mp-switch ${config.temperatureEnabled ? "active" : ""}`} onClick={() => setConfig((current) => ({ ...current, temperatureEnabled: !current.temperatureEnabled }))}><span /></button></div>
      {config.temperatureEnabled && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}><input type="range" min="0" max="2" step="0.1" value={Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 1} onChange={(event) => setConfig((current) => ({ ...current, temperature: Math.max(0, Math.min(2, Number(event.target.value))) }))} style={{ flex: 1 }} /><input aria-label="Temperature value" type="number" min="0" max="2" step="0.1" value={Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 1} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) setConfig((current) => ({ ...current, temperature: Math.max(0, Math.min(2, value)) })); }} style={{ width: 62 }} /></div>}
      <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 4 }}>{tr("關閉時使用模型預設值；開啟後所有 AI 功能共用此數值（0～2）。", "When off, the model default is used. When on, all AI features share this value (0–2).", "オフではモデルの既定値、オンではすべての AI 機能で同じ値を使います（0～2）。", "끄면 모델 기본값을 사용하고, 켜면 모든 AI 기능이 같은 값을 사용합니다(0~2).")}</div>
    </div>
  );
}

// 上下文長度滑桿。雲端與本地共用。
function ContextRow({ tr, config, setConfig }) {
  return (
    <div className="mp-row">
      <div className="mp-lbl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span>{tr("上下文長度", "Context length", "コンテキスト長", "컨텍스트 길이")}</span><span style={{ fontWeight: 800 }}>{(Number(config.contextTokens) || 40000).toLocaleString()} tokens</span></div>
      <input type="range" min={10000} max={40000} step={1000} value={Number(config.contextTokens) || 40000} onChange={(event) => setConfig((current) => ({ ...current, contextTokens: Number(event.target.value) }))} style={{ width: "100%" }} />
      <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 2 }}>{tr("角色每次回覆時可讀取的對話量上限，越長越耗費 API 用量", "How much conversation the character can read per reply; longer costs more API usage", "返信ごとにキャラが読める会話量の上限。長いほど API 使用量が増えます", "답장마다 캐릭터가 읽을 수 있는 대화량 상한. 길수록 API 사용량이 늘어납니다")}</div>
    </div>
  );
}

// 測試 / 儲存 / 儲存預設 按鈕列。
function ActionRow({ tr, testingConnection, onTest, onSave, onSavePreset }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button type="button" className="mp-save" disabled={testingConnection} style={{ flex: 1, background: "linear-gradient(135deg,#80cbc4,#26a69a)" }} onClick={onTest}>{testingConnection ? tr("測試中...", "Testing...", "テスト中...", "테스트 중...") : tr("測試連線", "Test connection", "接続テスト", "연결 테스트")}</button>
      <button className="mp-save" style={{ flex: 1 }} onClick={onSave}>{tr("儲存設定", "Save settings", "設定を保存", "설정 저장")}</button>
      {onSavePreset && <button type="button" className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#90caf9,#42a5f5)" }} onClick={onSavePreset}>{tr("儲存預設", "Save preset", "プリセット保存", "프리셋 저장")}</button>}
    </div>
  );
}

// 雲端設定面板：官方供應商 + API Key，Base URL 只有 custom 可編輯。
function CloudPanel({ t, tr, config, setConfig, cloudProviders, modelOptions, fetchingModels, onFetchModels, testingConnection, onTest, onSave, onSavePreset, onProviderChange, onModelCommit }) {
  return (
    <>
      <div className="mp-row"><div className="mp-lbl">{tr("API 供應商", "API provider", "API プロバイダー", "API 제공업체")}</div><select className="mp-ssel" value={config.provider} onChange={(event) => onProviderChange(event.target.value)}>{cloudProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></div>
      {config.provider === "custom" && <div className="mp-row"><div className="mp-lbl">Base URL</div><input className="mp-sinp" value={config.baseUrl} onChange={(event) => setConfig((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://..." /></div>}
      {config.provider === "vertex" && <div className="mp-row"><div className="mp-lbl">{tr("區域", "Region", "リージョン", "리전")}</div><input className="mp-sinp" value={config.location || "global"} onChange={(event) => setConfig((current) => ({ ...current, location: event.target.value }))} placeholder="global" /></div>}
      <div className="mp-row"><div className="mp-lbl">{tr("API 金鑰", "API key", "API キー", "API 키")}</div><input className="mp-sinp" type="password" value={config.apiKey} onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))} placeholder={config.provider === "vertex" ? "AIza..." : config.provider === "nvidia" ? "nvapi-..." : "sk-..."} /></div>
      {config.provider === "openrouter" && <>
        <OpenRouterCreditStatus apiKey={config.apiKey} tr={tr} type="key" />
        <div className="mp-row">
          <div className="mp-lbl">{tr({ "zh-TW": "帳戶餘額管理金鑰", "zh-CN": "账户余额管理密钥", en: "Account balance management key", ja: "残高確認用の管理キー", ko: "계정 잔액 관리 키" })}</div>
          <input className="mp-sinp" type="password" value={config.openRouterManagementKey || ""} onChange={(event) => setConfig((current) => ({ ...current, openRouterManagementKey: event.target.value }))} placeholder="sk-or-..." />
          <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 4, lineHeight: 1.5 }}>
            {tr({ "zh-TW": "聊天仍使用上方的一般 API 金鑰；此管理金鑰只用來讀取 OpenRouter 帳戶總餘額。", "zh-CN": "聊天仍使用上方的一般 API 密钥；此管理密钥只用于读取 OpenRouter 账户总余额。", en: "Chat continues to use the API key above. This management key is only used to read your OpenRouter account balance.", ja: "チャットには上の通常 API キーを使用します。この管理キーは OpenRouter アカウント残高の取得専用です。", ko: "채팅에는 위의 일반 API 키를 계속 사용합니다. 이 관리 키는 OpenRouter 계정 잔액 조회에만 사용됩니다。" })}
          </div>
        </div>
        <OpenRouterCreditStatus apiKey={config.openRouterManagementKey} tr={tr} type="account" />
      </>}
      <ModelRow t={t} tr={tr} config={config} setConfig={setConfig} modelOptions={modelOptions} fetchingModels={fetchingModels} onFetchModels={onFetchModels} onModelCommit={onModelCommit} />
      <TemperatureRow tr={tr} config={config} setConfig={setConfig} />
      <ContextRow tr={tr} config={config} setConfig={setConfig} />
      <ActionRow tr={tr} testingConnection={testingConnection} onTest={onTest} onSave={onSave} onSavePreset={onSavePreset} />
    </>
  );
}

// 本地設定面板：Base URL 可編輯、免 API Key（受保護端點可選填），並附上架設提示。
function LocalPanel({ t, tr, config, setConfig, localProviders, modelOptions, fetchingModels, onFetchModels, testingConnection, onTest, onSave, onProviderChange, onModelCommit }) {
  return (
    <>
      <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--mp-txt-l)", background: "rgba(128,203,196,.12)", border: "1px solid rgba(38,166,154,.25)", borderRadius: 10, padding: "8px 10px", marginBottom: 10 }}>
        {tr(
          "連接你自己跑的模型（Ollama、LM Studio、llama.cpp 等）。先在裝置上開好 OpenAI 相容的伺服器，再把它的網址填在下面。免 API 金鑰。",
          "Connect a model you run yourself (Ollama, LM Studio, llama.cpp…). Start an OpenAI-compatible server on your device, then paste its URL below. No API key needed.",
          "自分で動かすモデル（Ollama、LM Studio、llama.cpp など）に接続します。OpenAI 互換サーバーを起動し、その URL を下に入力してください。API キーは不要です。",
          "직접 실행하는 모델(Ollama, LM Studio, llama.cpp 등)에 연결합니다. OpenAI 호환 서버를 켜고 아래에 주소를 입력하세요. API 키가 필요 없습니다.",
        )}
        <div style={{ marginTop: 4, opacity: 0.85 }}>
          {tr(
            "※ 網頁版僅能連本機（localhost），連同網路的電腦會被瀏覽器阻擋。",
            "※ The web version can only reach this device (localhost); a computer on the same network is blocked by the browser.",
            "※ Web 版は本機（localhost）のみ接続可。同一ネットワークの PC はブラウザにブロックされます。",
            "※ 웹 버전은 본 기기(localhost)만 연결 가능하며, 같은 네트워크의 PC는 브라우저가 차단합니다.",
          )}
        </div>
      </div>
      {localProviders.length > 1 && <div className="mp-row"><div className="mp-lbl">{tr("接頭", "Adapter", "アダプター", "어댑터")}</div><select className="mp-ssel" value={config.provider} onChange={(event) => onProviderChange(event.target.value)}>{localProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></div>}
      <div className="mp-row"><div className="mp-lbl">Base URL</div><input className="mp-sinp" value={config.baseUrl} onChange={(event) => setConfig((current) => ({ ...current, baseUrl: event.target.value }))} placeholder={DEFAULT_LOCAL_BASE_URL} /></div>
      <div className="mp-row"><div className="mp-lbl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span>{tr("API 金鑰", "API key", "API キー", "API 키")}</span><span style={{ fontSize: 10, fontWeight: 700, color: "var(--mp-txt-l)" }}>{tr("選填", "Optional", "任意", "선택")}</span></div><input className="mp-sinp" type="password" value={config.apiKey} onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))} placeholder={tr("多數本地伺服器免填", "Usually blank for local servers", "ローカルは通常不要", "로컬은 보통 비워둡니다")} /></div>
      <ModelRow t={t} tr={tr} config={config} setConfig={setConfig} modelOptions={modelOptions} fetchingModels={fetchingModels} onFetchModels={onFetchModels} onModelCommit={onModelCommit} />
      <TemperatureRow tr={tr} config={config} setConfig={setConfig} />
      <ContextRow tr={tr} config={config} setConfig={setConfig} />
      <ActionRow tr={tr} testingConnection={testingConnection} onTest={onTest} onSave={onSave} onSavePreset={null} />
    </>
  );
}

export default function AiConnectionSettings({
  t, tr, open, setOpen, config, setConfig, providers, modelOptions,
  fetchingModels, onFetchModels, testingConnection, onTest, onSave, onSavePreset, onProviderChange, onModeChange, onModelCommit,
  disabled = false,
}) {
  const mode = isLocalProvider(config.provider) ? "local" : "cloud";
  const cloudProviders = (providers || []).filter((provider) => !isLocalProvider(provider.id));
  const localProviders = (providers || []).filter((provider) => isLocalProvider(provider.id));

  const modeButtonStyle = (active) => ({
    flex: 1,
    padding: "8px 6px",
    fontWeight: 800,
    borderRadius: 10,
    cursor: "pointer",
    border: active ? "1px solid var(--mp-pink-dk)" : "1px solid rgba(160,176,186,.3)",
    background: active ? "linear-gradient(135deg,#f6a5c0,#ec7fa9)" : "var(--mp-surface)",
    color: active ? "#fff" : "var(--mp-txt)",
  });

  return <div className="mp-sg" style={disabled ? { opacity: 0.52 } : undefined} aria-disabled={disabled}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: disabled ? "default" : "pointer" }} onClick={() => { if (!disabled) setOpen((value) => !value); }}>
      <div className="mp-sg-t" style={{ marginBottom: 0 }}>{tr("AI 連線", "AI connection", "AI 接続", "AI 연결")}</div>
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {!open && <span style={{ fontSize: 10, color: "var(--mp-txt-l)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mode === "local" ? tr("本地", "Local", "ローカル", "로컬") : tr("雲端", "Cloud", "クラウド", "클라우드")} · {config.model || "-"}</span>}
        {disabled
          ? <span style={{ flex: "0 0 auto", fontSize: 10, fontWeight: 800, color: "var(--mp-txt-l)" }}>{tr("已停用（測試 LLM 使用中）", "Inactive while test LLM is active", "テスト LLM 使用中は無効", "테스트 LLM 사용 중에는 비활성")}</span>
          : <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 800, color: "var(--mp-pink-dk)" }}>{open ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>}
      </span>
    </div>
    {/* 測試 LLM 啟用時整段設定唯讀：用 pointerEvents 一次擋掉分頁與兩個面板的互動。 */}
    {open && <div style={{ marginTop: 12, ...(disabled ? { pointerEvents: "none" } : null) }}>
      <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" role="tab" aria-selected={mode === "local"} style={modeButtonStyle(mode === "local")} onClick={() => onModeChange?.("local")}>{tr("本地", "Local", "ローカル", "로컬")}</button>
        <button type="button" role="tab" aria-selected={mode === "cloud"} style={modeButtonStyle(mode === "cloud")} onClick={() => onModeChange?.("cloud")}>{tr("雲端", "Cloud", "クラウド", "클라우드")}</button>
      </div>
      {mode === "local"
        ? <LocalPanel t={t} tr={tr} config={config} setConfig={setConfig} localProviders={localProviders} modelOptions={modelOptions} fetchingModels={fetchingModels} onFetchModels={onFetchModels} testingConnection={testingConnection} onTest={onTest} onSave={onSave} onProviderChange={onProviderChange} onModelCommit={onModelCommit} />
        : <CloudPanel t={t} tr={tr} config={config} setConfig={setConfig} cloudProviders={cloudProviders} modelOptions={modelOptions} fetchingModels={fetchingModels} onFetchModels={onFetchModels} testingConnection={testingConnection} onTest={onTest} onSave={onSave} onSavePreset={onSavePreset} onProviderChange={onProviderChange} onModelCommit={onModelCommit} />}
    </div>}
  </div>;
}
