import React from "react";

export default function VoiceApiSettings({ tr, open, setOpen, config, setConfig, activeConfig, updateConfig, voices, connectionState, onLoadVoices, onPreview }) {
  return <div className="mp-sg">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }} onClick={() => setOpen((value) => !value)}>
      <div className="mp-sg-t" style={{ marginBottom: 0 }}>{tr("語音 API", "Voice API", "音声 API", "음성 API")}</div>
      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--mp-pink-dk)" }}>{open ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
    </div>
    {open && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 }}>
      <div className="mp-lbl" style={{ marginBottom: 0 }}>{tr("啟用語音", "Enable voice", "音声を有効にする", "음성 사용")}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 11, color: "var(--mp-txt-l)", fontWeight: 600 }}>{config.enabled ? tr("已開啟", "On", "オン", "켜짐") : tr("已關閉", "Off", "オフ", "꺼짐")}</span><button type="button" role="switch" aria-checked={!!config.enabled} className={`mp-switch ${config.enabled ? "active" : ""}`} onClick={() => setConfig((current) => ({ ...current, enabled: !current.enabled }))}><span /></button></div>
    </div>}
    {open && !config.enabled && <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.6, marginTop: 8 }}>{tr("語音功能目前關閉，設定已保留。", "Voice is off; your settings are retained.", "音声機能はオフです。設定は保持されます。", "음성 기능이 꺼져 있으며 설정은 유지됩니다.")}</div>}
    {open && config.enabled && <div style={{ marginTop: 12 }}>
      <div className="mp-row"><div className="mp-lbl">{tr("全域語音供應商", "Global voice provider", "共通音声プロバイダー", "전역 음성 제공업체")}</div><select className="mp-ssel" value="elevenlabs" disabled><option value="elevenlabs">ElevenLabs</option></select></div>
      <div className="mp-row"><div className="mp-lbl">API Key</div><input className="mp-sinp" type="password" value={activeConfig.apiKey || ""} onChange={(event) => updateConfig({ apiKey: event.target.value, availableVoices: [] })} placeholder="xi-api-key" /></div>
      <div className="mp-row"><div className="mp-lbl">{tr("語音模型", "Voice model", "音声モデル", "음성 모델")}</div><select className="mp-ssel" value={activeConfig.model || "eleven_flash_v2_5"} onChange={(event) => updateConfig({ model: event.target.value })}><option value="eleven_flash_v2_5">eleven_flash_v2_5</option><option value="eleven_multilingual_v2">eleven_multilingual_v2</option><option value="eleven_v3">eleven_v3</option></select></div>
      <div className="mp-row"><div className="mp-lbl">{tr("ElevenLabs 可用聲音", "ElevenLabs available voices", "ElevenLabs 利用可能な音声", "ElevenLabs 사용 가능 음성")}</div><select className="mp-ssel" value={activeConfig.defaultVoiceId || "JBFqnCBsd6RMkjVDRZzb"} onChange={(event) => updateConfig({ defaultVoiceId: event.target.value })}>{voices.length ? voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}{voice.category ? ` · ${voice.category}` : ""}</option>) : <option value={activeConfig.defaultVoiceId || "JBFqnCBsd6RMkjVDRZzb"}>{tr("George（說明文件範例）", "George (documentation example)", "George（ドキュメント例）", "George (문서 예시)")}</option>}</select></div>
      <button type="button" className="mp-save" disabled={connectionState === "loading" || !activeConfig.apiKey} style={{ background: "linear-gradient(135deg,#80cbc4,#26a69a)", marginBottom: 8 }} onClick={onLoadVoices}>{connectionState === "loading" ? tr("連線中...", "Connecting...", "接続中...", "연결 중...") : tr("測試連線並載入可用聲音", "Test connection and load voices", "接続テストと音声の読み込み", "연결 테스트 및 음성 불러오기")}</button>
      <button type="button" className="mp-save" disabled={connectionState === "previewing" || !activeConfig.apiKey || !activeConfig.defaultVoiceId} style={{ background: "linear-gradient(135deg,#90caf9,#42a5f5)" }} onClick={onPreview}>{connectionState === "previewing" ? tr("生成測試語音中...", "Generating test voice...", "テスト音声を生成中...", "테스트 음성 생성 중...") : tr("試聽預設聲音", "Preview default voice", "デフォルト音声を試聴", "기본 음성 미리듣기")}</button>
      {connectionState === "success" && <div style={{ fontSize: 10, color: "#43a047", marginTop: 7 }}>{tr("API 連線成功", "API connected", "API 接続成功", "API 연결 성공")}</div>}
      {connectionState === "error" && <div style={{ fontSize: 10, color: "#e57373", marginTop: 7 }}>{tr("連線或測試失敗，請檢查 Key 與權限。", "Connection or test failed. Check the key and permissions.", "接続またはテストに失敗しました。Key と権限を確認してください。", "연결 또는 테스트에 실패했습니다. Key와 권한을 확인해주세요.")}</div>}
    </div>}
  </div>;
}
