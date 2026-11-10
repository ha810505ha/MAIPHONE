import React, { useCallback, useEffect, useState } from "react";
import { fetchOpenRouterCredits } from "../../services/openRouterCredits.js";

const copy = (tr, key) => tr({
  titleKey: { "zh-TW": "目前聊天 API Key 額度", "zh-CN": "当前聊天 API Key 额度", en: "Current chat API key", ja: "現在のチャット API キー", ko: "현재 채팅 API 키" },
  titleAccount: { "zh-TW": "OpenRouter 帳戶總額", "zh-CN": "OpenRouter 账户总额", en: "OpenRouter account total", ja: "OpenRouter アカウント残高", ko: "OpenRouter 계정 총액" },
  refresh: { "zh-TW": "更新", "zh-CN": "刷新", en: "Refresh", ja: "更新", ko: "새로고침" },
  loading: { "zh-TW": "讀取即時額度中…", "zh-CN": "正在读取实时额度…", en: "Loading live credits…", ja: "リアルタイムの残高を取得中…", ko: "실시간 크레딧을 불러오는 중…" },
  accountRemaining: { "zh-TW": "帳戶剩餘", "zh-CN": "账户剩余", en: "Account remaining", ja: "アカウント残高", ko: "계정 잔여" },
  keyRemaining: { "zh-TW": "此 API 金鑰剩餘", "zh-CN": "此 API 密钥剩余", en: "This API key remaining", ja: "この API キーの残高", ko: "이 API 키의 잔여" },
  total: { "zh-TW": "總額", "zh-CN": "总额", en: "Total", ja: "合計", ko: "총액" },
  keyLimit: { "zh-TW": "此金鑰限額", "zh-CN": "此密钥限额", en: "Key limit", ja: "このキーの上限", ko: "이 키 한도" },
  used: { "zh-TW": "已用", "zh-CN": "已用", en: "Used", ja: "使用済み", ko: "사용됨" },
  reset: { "zh-TW": "重設週期", "zh-CN": "重置周期", en: "Resets", ja: "リセット", ko: "재설정" },
  noLimit: { "zh-TW": "此金鑰未設定消費上限；只能顯示累計用量。若要看到剩餘額度，請在 OpenRouter 為此金鑰設定限額，或使用管理金鑰。", "zh-CN": "此密钥未设置消费上限；只能显示累计用量。若要查看剩余额度，请在 OpenRouter 为此密钥设置限额，或使用管理密钥。", en: "This key has no spend limit, so only its usage can be shown. Set a key limit in OpenRouter, or use a management key to view remaining credits.", ja: "このキーには利用上限がないため、累計使用量のみ表示できます。残高を表示するには OpenRouter でキーの上限を設定するか、管理キーを使用してください。", ko: "이 키에는 지출 한도가 없어 누적 사용량만 표시할 수 있습니다. 잔여 크레딧을 보려면 OpenRouter에서 키 한도를 설정하거나 관리 키를 사용하세요." },
  error: { "zh-TW": "目前無法讀取額度。請確認這是有效的 OpenRouter API 金鑰。", "zh-CN": "目前无法读取额度。请确认这是有效的 OpenRouter API 密钥。", en: "Credits are unavailable. Check that this is a valid OpenRouter API key.", ja: "クレジットを取得できません。この OpenRouter API キーが有効か確認してください。", ko: "크레딧을 불러올 수 없습니다. 유효한 OpenRouter API 키인지 확인하세요." },
}[key]);

const formatUsd = (value) => {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(amount)
    : "—";
};

export default function OpenRouterCreditStatus({ apiKey, tr, type = "key" }) {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    if (!String(apiKey || "").trim()) {
      setCredits(null);
      setFailed(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      setCredits(await fetchOpenRouterCredits(apiKey));
    } catch (_) {
      setCredits(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 600);
    return () => clearTimeout(timer);
  }, [refresh]);

  if (!String(apiKey || "").trim()) return null;
  const isAccount = credits?.scope === "account";
  const canShowRemaining = credits?.remaining != null;

  return (
    <div className="mp-row" style={{ padding: "10px 11px", marginTop: -2, marginBottom: 12, borderRadius: 10, background: "color-mix(in srgb,var(--mp-pink) 7%,var(--mp-surface))", border: "1px solid color-mix(in srgb,var(--mp-pink) 20%,transparent)" }} aria-live="polite">
      <div className="mp-lbl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{copy(tr, type === "account" ? "titleAccount" : "titleKey")}</span>
        <button type="button" className="mp-ibtn" disabled={loading} onClick={() => void refresh()}>{copy(tr, "refresh")}</button>
      </div>
      {loading && <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 4 }}>{copy(tr, "loading")}</div>}
      {!loading && failed && <div style={{ fontSize: 10, color: "var(--mp-danger)", marginTop: 4 }}>{copy(tr, "error")}</div>}
      {!loading && credits && <>
        {canShowRemaining && <div style={{ fontSize: 18, fontWeight: 900, color: "var(--mp-pink-dk)", marginTop: 4 }}>
          {isAccount ? copy(tr, "accountRemaining") : copy(tr, "keyRemaining")}: {formatUsd(credits.remaining)}
        </div>}
        <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 3, lineHeight: 1.5 }}>
          {isAccount
            ? `${copy(tr, "total")} ${formatUsd(credits.total)} · ${copy(tr, "used")} ${formatUsd(credits.used)}`
            : <>{copy(tr, "keyLimit")} {formatUsd(credits.limit)} · {copy(tr, "used")} {formatUsd(credits.used)}{credits.reset ? ` · ${copy(tr, "reset")} ${credits.reset}` : ""}</>}
        </div>
        {!canShowRemaining && <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 4, lineHeight: 1.5 }}>{copy(tr, "noLimit")}</div>}
      </>}
    </div>
  );
}
