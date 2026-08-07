import React from "react";

export default function AiConnectionSettings({
  t,
  tr,
  open,
  setOpen,
  config,
  setConfig,
  providers,
  modelOptions,
  fetchingModels,
  onFetchModels,
  testingConnection,
  onTest,
  onSave,
  onSavePreset,
  onProviderChange,
  disabled = false,
}) {
  const hasModelOptions = modelOptions?.length > 0;
  const isCustomModel = hasModelOptions && (
    config.model === "__custom" || !modelOptions.includes(config.model)
  );
  const update = (patch) => setConfig((current) => ({ ...current, ...patch }));

  return (
    <div className="mp-sg" style={disabled ? { opacity: 0.52 } : undefined} aria-disabled={disabled}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: disabled ? "default" : "pointer" }}
        onClick={() => { if (!disabled) setOpen((value) => !value); }}
      >
        <div className="mp-sg-t" style={{ marginBottom: 0 }}>{tr("AI 連線", "AI connection", "AI 連線", "AI 連線")}</div>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {!open && <span style={{ fontSize: 10, color: "var(--mp-txt-l)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{config.provider || "-"} · {config.model || "-"}</span>}
          {disabled
            ? <span style={{ flex: "0 0 auto", fontSize: 10, fontWeight: 800, color: "var(--mp-txt-l)" }}>{tr("已停用（測試 LLM 使用中）", "Inactive while test LLM is active", "已停用（測試 LLM 使用中）", "已停用（測試 LLM 使用中）")}</span>
            : <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 800, color: "var(--mp-pink-dk)" }}>{open ? tr("收合", "Collapse", "收合", "收合") : tr("展開", "Expand", "展開", "展開")}</span>}
        </span>
      </div>
      {open && <div style={{ marginTop: 12 }}>
        <div className="mp-row">
          <div className="mp-lbl">{tr("API 供應商", "API provider", "API 供應商", "API 供應商")}</div>
          <select disabled={disabled} className="mp-ssel" value={config.provider} onChange={(event) => onProviderChange(event.target.value)}>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
        </div>
        {config.provider === "custom" && <div className="mp-row"><div className="mp-lbl">Base URL</div><input disabled={disabled} className="mp-sinp" value={config.baseUrl} onChange={(event) => update({ baseUrl: event.target.value })} placeholder="https://..." /></div>}
        {config.provider === "vertex" && <div className="mp-row"><div className="mp-lbl">{tr("區域", "Region", "區域", "區域")}</div><input disabled={disabled} className="mp-sinp" value={config.location || "global"} onChange={(event) => update({ location: event.target.value })} placeholder="global" /></div>}
        <div className="mp-row"><div className="mp-lbl">{tr("API Key", "API key", "API Key", "API Key")}</div><input disabled={disabled} className="mp-sinp" type="password" value={config.apiKey} onChange={(event) => update({ apiKey: event.target.value })} placeholder={config.provider === "vertex" ? "AIza..." : config.provider === "nvidia" ? "nvapi-..." : "sk-..."} /></div>
        <div className="mp-row">
          <div className="mp-lbl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span>{tr("模型", "Model", "模型", "模型")}</span>
            <button type="button" className="mp-ibtn" disabled={disabled || fetchingModels} onClick={onFetchModels}>{fetchingModels ? t("loading") : tr("取得最新模型", "Fetch latest models", "取得最新模型", "取得最新模型")}</button>
          </div>
          {hasModelOptions
            ? <select disabled={disabled} className="mp-ssel" value={isCustomModel ? "__custom" : config.model} onChange={(event) => update({ model: event.target.value })}>{modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}<option value="__custom">{tr("自訂…", "Custom…", "自訂…", "自訂…")}</option></select>
            : <input disabled={disabled} className="mp-sinp" value={config.model} onChange={(event) => update({ model: event.target.value })} placeholder="model-name" />}
        </div>
        {isCustomModel && <div className="mp-row"><div className="mp-lbl">{tr("自訂模型名稱", "Custom model name", "自訂模型名稱", "自訂模型名稱")}</div><input disabled={disabled} className="mp-sinp" value={config.model === "__custom" ? "" : config.model} onChange={(event) => update({ model: event.target.value })} placeholder="model-name" /></div>}
        <div className="mp-row" style={{ display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div className="mp-lbl">{tr("自訂 Temperature", "Custom temperature", "自訂 Temperature", "自訂 Temperature")}</div><button disabled={disabled} type="button" role="switch" aria-checked={!!config.temperatureEnabled} className={`mp-switch ${config.temperatureEnabled ? "active" : ""}`} onClick={() => update({ temperatureEnabled: !config.temperatureEnabled })}><span /></button></div>
          {config.temperatureEnabled && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}><input disabled={disabled} type="range" min="0" max="2" step="0.1" value={Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 1} onChange={(event) => update({ temperature: Math.max(0, Math.min(2, Number(event.target.value))) })} style={{ flex: 1 }} /><input disabled={disabled} aria-label="Temperature value" type="number" min="0" max="2" step="0.1" value={Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 1} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) update({ temperature: Math.max(0, Math.min(2, value)) }); }} style={{ width: 62 }} /></div>}
        </div>
        <div className="mp-row">
          <div className="mp-lbl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span>{tr("上下文長度", "Context length", "上下文長度", "上下文長度")}</span><span style={{ fontWeight: 800 }}>{(Number(config.contextTokens) || 40000).toLocaleString()} tokens</span></div>
          <input disabled={disabled} type="range" min={10000} max={40000} step={1000} value={Number(config.contextTokens) || 40000} onChange={(event) => update({ contextTokens: Number(event.target.value) })} style={{ width: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="mp-save" disabled={disabled || testingConnection} style={{ flex: 1 }} onClick={onTest}>{testingConnection ? tr("測試中…", "Testing…", "測試中…", "測試中…") : tr("測試連線", "Test connection", "測試連線", "測試連線")}</button>
          <button disabled={disabled} className="mp-save" style={{ flex: 1 }} onClick={onSave}>{tr("儲存設定", "Save settings", "儲存設定", "儲存設定")}</button>
          <button disabled={disabled} type="button" className="mp-save" style={{ flex: 1 }} onClick={onSavePreset}>{tr("儲存預設", "Save preset", "儲存預設", "儲存預設")}</button>
        </div>
      </div>}
    </div>
  );
}
