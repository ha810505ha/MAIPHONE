import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchMaliTestQuota,
  fetchMaliTestUsage,
  getMaliTestConfig,
  runMaliConnectionTest,
} from "../../services/cloud/maliTestService.js";
import { subscribeMaliTestUsage } from "../../services/cloud/maliTestRuntime.js";

const providerTitle = (provider, tr) => provider.family === "openrouter"
  ? tr("OpenRouter", "OpenRouter", "OpenRouter", "OpenRouter")
  : tr("Gemini", "Gemini", "Gemini", "Gemini");

export default function MaliTestModelSettings({ auth, tr, showToast, apiConfig, onSourceChange, onHostedModelChange }) {
  const [quota, setQuota] = useState(null);
  const [usageEntries, setUsageEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const configured = useMemo(() => getMaliTestConfig().configured, []);
  const session = auth?.session || null;
  const source = apiConfig?.aiSource === "hosted_test" ? "hosted_test" : "personal";
  const providerOptions = useMemo(() => {
    const providers = Array.isArray(quota?.providers) ? quota.providers : [];
    return Array.from(new Map(providers.map((provider) => [`${provider.family}:${provider.model}`, provider])).values());
  }, [quota?.providers]);

  const refresh = useCallback(async () => {
    if (!session?.access_token) {
      setQuota(null);
      setUsageEntries([]);
      return;
    }
    setLoading(true);
    try {
      const [nextQuota, nextUsage] = await Promise.all([
        fetchMaliTestQuota(session),
        fetchMaliTestUsage(session, undefined, 12).catch(() => ({ entries: [] })),
      ]);
      setQuota(nextQuota);
      setUsageEntries(Array.isArray(nextUsage?.entries) ? nextUsage.entries : []);
    } catch (error) {
      setQuota(null);
      setUsageEntries([]);
      if (error?.status !== 401 && error?.status !== 403) {
        showToast?.(error?.message || tr("無法讀取測試模型狀態", "Could not load test model status", "テストモデルの状態を読み込めません", "테스트 모델 상태를 불러오지 못했습니다"));
      }
    } finally {
      setLoading(false);
    }
  }, [session, showToast, tr]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeMaliTestUsage((update) => {
    const balance = update?.balance;
    if (balance) {
      setQuota((current) => current ? {
        ...current,
        grantedPoints: Number(balance.grantedPoints ?? current.grantedPoints ?? 0),
        usedPoints: Number(balance.usedPoints ?? current.usedPoints ?? 0),
        remainingPoints: Number(balance.remainingPoints ?? current.remainingPoints ?? 0),
        connectionTestCount: Number(balance.connectionTestCount ?? current.connectionTestCount ?? 0),
      } : current);
    }
    // Fetch the ledger as well. The immediate patch above keeps the visible
    // balance responsive even while this follow-up request is in flight.
    void refresh();
  }), [refresh]);

  useEffect(() => {
    const current = providerOptions.find((provider) => provider.family === selectedProvider && provider.model === selectedModel);
    const preferred = providerOptions.find((provider) => provider.family === apiConfig?.hostedTestProvider && provider.model === apiConfig?.hostedTestModel);
    const next = current || preferred || providerOptions[0];
    setSelectedProvider(next?.family || "");
    setSelectedModel(next?.model || "");
  }, [apiConfig?.hostedTestModel, apiConfig?.hostedTestProvider, providerOptions]);

  const selectedValue = selectedProvider && selectedModel ? `${selectedProvider}::${selectedModel}` : "";

  const testConnection = async () => {
    if (testing || !quota?.enabled || !selectedProvider || !selectedModel) return;
    setTesting(true);
    try {
      const result = await runMaliConnectionTest(session, undefined, selectedProvider, selectedModel);
      await refresh();
      const responseText = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text
        || result?.response?.choices?.[0]?.message?.content
        || "";
      const ok = /\bOK\b/i.test(String(responseText));
      showToast?.(ok
        ? tr("測試模型已連線", "Test model connected", "テストモデルに接続しました", "테스트 모델에 연결되었습니다")
        : tr("測試模型已回覆", "Test model replied", "テストモデルから応答がありました", "테스트 모델이 응답했습니다"));
    } catch (error) {
      showToast?.(`${tr("測試模型連線失敗", "Test model connection failed", "テストモデルの接続に失敗しました", "테스트 모델 연결에 실패했습니다")}: ${error?.message || "unknown error"}`);
    } finally {
      setTesting(false);
    }
  };

  const status = !configured
    ? tr("尚未設定 Worker", "Worker is not configured", "Worker が未設定です", "Worker가 설정되지 않았습니다")
    : !session?.access_token
      ? tr("請先登入", "Sign in first", "先にサインインしてください", "먼저 로그인하세요")
      : quota?.enabled
        ? tr("測試權限已啟用", "Test access enabled", "テストアクセスが有効です", "테스트 권한이 활성화되었습니다")
        : quota?.accountAssigned
          ? tr("帳號尚未啟用或測試模式關閉", "Account is not enabled or test mode is off", "アカウントが無効か、テストモードがオフです", "계정이 활성화되지 않았거나 테스트 모드가 꺼져 있습니다")
          : tr("此帳號不在測試名單", "This account is not on the test list", "このアカウントはテスト対象外です", "이 계정은 테스트 목록에 없습니다");

  return <div className="mp-sg">
    <div className="mp-sg-t">{tr("測試模型（文字）", "Test model (text)", "テストモデル（テキスト）", "테스트 모델(텍스트)")}</div>
    <div style={{ fontSize: 10, lineHeight: 1.6, color: "var(--mp-txt-l)", marginTop: 5 }}>
      {tr("僅限核准帳號使用；圖片與 TTS 不包含在測試內。點數由伺服器管理。", "Text-model tests are available only to approved accounts; images and TTS are excluded. Test points are server-managed.", "テキストモデルのテストは承認済みアカウントのみ利用できます。画像と TTS は対象外で、ポイントはサーバーで管理されます。", "텍스트 모델 테스트는 승인된 계정만 이용할 수 있으며 이미지와 TTS는 제외됩니다. 포인트는 서버에서 관리됩니다.")}
    </div>
    <div style={{ marginTop: 9, padding: "9px 10px", borderRadius: 12, background: "var(--mp-card-bg)", border: "1px solid var(--mp-card-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11 }}>
        <span>{tr("狀態", "Status", "状態", "상태")}</span>
        <b style={{ color: quota?.enabled ? "var(--mp-success)" : "var(--mp-page-text-muted,var(--mp-txt-l))" }}>{loading ? tr("載入中…", "Loading…", "読み込み中…", "로드 중…") : status}</b>
      </div>
      {quota?.enabled && <>
        {providerOptions.length > 0 && <div className="mp-row" style={{ marginTop: 9 }}>
          <div className="mp-lbl">{tr("測試模型", "Test model", "テストモデル", "테스트 모델")}</div>
          <select
            className="mp-ssel"
            value={selectedValue}
            onChange={(event) => {
              const [provider, ...modelParts] = event.target.value.split("::");
              const model = modelParts.join("::");
              setSelectedProvider(provider || "");
              setSelectedModel(model);
              onHostedModelChange?.(provider || "", model);
            }}
          >
            {providerOptions.map((provider) => <option key={`${provider.family}:${provider.model}`} value={`${provider.family}::${provider.model}`}>{providerTitle(provider, tr)} · {provider.model}</option>)}
          </select>
        </div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 9 }}>
          <div><div style={{ fontSize: 9, color: "var(--mp-page-text-muted,var(--mp-txt-l))" }}>{tr("剩餘點數", "Points left", "残りポイント", "남은 포인트")}</div><strong style={{ fontSize: 16 }}>{quota.remainingPoints}</strong></div>
          <div><div style={{ fontSize: 9, color: "var(--mp-page-text-muted,var(--mp-txt-l))" }}>{tr("已用點數", "Points used", "使用済みポイント", "사용한 포인트")}</div><strong style={{ fontSize: 16 }}>{quota.usedPoints}</strong></div>
          <div><div style={{ fontSize: 9, color: "var(--mp-page-text-muted,var(--mp-txt-l))" }}>{tr("連線測試", "Connection tests", "接続テスト", "연결 테스트")}</div><strong style={{ fontSize: 16 }}>{quota.connectionTestCount}</strong></div>
        </div>
        {usageEntries.length > 0 && <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--mp-card-border)" }}>
          <div className="mp-lbl" style={{ marginBottom: 5 }}>{tr("最近 AI 用量（不含內容）", "Recent AI usage (metadata only)", "最近の AI 使用量（内容なし）", "최근 AI 사용량 (내용 없음)")}</div>
          {usageEntries.slice(0, 6).map((entry) => {
            const timestamp = entry.created_at || entry.createdAt;
            const parsedTimestamp = timestamp ? new Date(timestamp) : null;
            const time = parsedTimestamp && Number.isFinite(parsedTimestamp.getTime())
              ? parsedTimestamp.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")
              : (timestamp || "—");
            const points = Number(entry.points_charged || 0);
            return <div key={entry.request_id || `${timestamp}-${entry.action}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, lineHeight: 1.5, padding: "3px 0", color: "var(--mp-page-text-muted,var(--mp-txt-l))" }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{time} · {entry.app || entry.feature}/{entry.action || "generate"}</span>
              <span style={{ flex: "0 0 auto" }}>{points ? `-${points}` : entry.status}</span>
            </div>;
          })}
        </div>}
      </>}
    </div>
    <div style={{ marginTop: 9, padding: "9px 10px", borderRadius: 12, background: "var(--mp-card-bg)", border: "1px solid var(--mp-card-border)" }}>
      <div className="mp-lbl" style={{ marginBottom: 7 }}>{tr("AI 使用來源", "AI source", "AI 使用來源", "AI 使用來源")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }} role="group" aria-label={tr("AI 使用來源", "AI source", "AI 使用來源", "AI 使用來源")}>
        <button
          type="button"
          className="mp-ibtn"
          aria-pressed={source === "personal"}
          style={{ opacity: source === "personal" ? 1 : .58, borderColor: source === "personal" ? "var(--mp-pink)" : undefined }}
          onClick={() => onSourceChange?.("personal")}
        >{tr("我的 API", "Personal API", "我的 API", "我的 API")}</button>
        <button
          type="button"
          className="mp-save"
          aria-pressed={source === "hosted_test"}
          disabled={!quota?.enabled || !selectedModel}
          style={{ opacity: source === "hosted_test" ? 1 : .58 }}
          onClick={() => onSourceChange?.("hosted_test", selectedProvider, selectedModel)}
        >{source === "hosted_test" ? tr("測試 LLM（使用中）", "Test LLM (active)", "測試 LLM（使用中）", "測試 LLM（使用中）") : tr("啟用測試 LLM", "Use test LLM", "啟用測試 LLM", "啟用測試 LLM")}</button>
      </div>
      <div style={{ fontSize: 10, lineHeight: 1.5, color: "var(--mp-txt-l)", marginTop: 6 }}>
        {source === "hosted_test"
          ? tr("目前所有文字 AI 請求都會走測試 Worker；個人 API 只保留設定，不會送出。", "All text AI requests use the hosted test Worker. Your personal API is kept but not sent.", "目前所有文字 AI 請求都會走測試 Worker；個人 API 只保留設定，不會送出。", "目前所有文字 AI 請求都會走測試 Worker；個人 API 只保留設定，不會送出。")
          : tr("目前使用上方個人 API。測試模型只會在你按下啟用後使用。", "Your personal API is active. The test model is used only after you enable it.", "目前使用上方個人 API。測試模型只會在你按下啟用後使用。", "目前使用上方個人 API。測試模型只會在你按下啟用後使用。")}
      </div>
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
      <button type="button" className="mp-ibtn" style={{ flex: 1 }} disabled={loading || !session?.access_token} onClick={() => void refresh()}>{tr("重新整理", "Refresh", "更新", "새로고침")}</button>
      <button type="button" className="mp-save" style={{ flex: 1, opacity: quota?.enabled ? 1 : .55 }} disabled={testing || !quota?.enabled || !selectedModel} onClick={() => void testConnection()}>{testing ? tr("測試中…", "Testing…", "テスト中…", "테스트 중…") : tr("測試模型連線（會套用限制）", "Test model connection (limits apply)", "テストモデル接続（制限が適用されます）", "테스트 모델 연결(제한 적용)")}</button>
    </div>
  </div>;
}
