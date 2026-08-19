import React, { useCallback, useEffect, useState } from "react";
import { fetchMaliTestQuota } from "../../services/cloud/maliTestService.js";
import { getMaliTestRuntime, subscribeMaliTestUsage } from "../../services/cloud/maliTestRuntime.js";

export default function MaliTestQuotaBar({ enabled, tr }) {
  const [quota, setQuota] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setQuota(null);
      return;
    }
    const session = getMaliTestRuntime().session;
    if (!session?.access_token) return;
    try {
      const next = await fetchMaliTestQuota(session);
      setQuota(next);
    } catch {
      // Do not interrupt chatting when the optional balance display is unavailable.
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeMaliTestUsage(() => {
    void refresh();
  }), [refresh]);

  if (!enabled || !quota?.enabled) return null;
  const used = Math.max(0, Number(quota.used) || 0);
  const limit = Math.max(0, Number(quota.limit) || 0);
  const remainingPoints = Math.max(0, Number(quota.remainingPoints) || 0);
  const isLow = quota.remaining === 0 || remainingPoints === 0 || (limit > 0 && used / limit >= 0.8);

  return (
    <div className={`mp-test-quota ${expanded ? "is-open" : ""} ${isLow ? "is-low" : ""}`}>
      <button
        type="button"
        className="mp-test-quota-toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="mp-test-quota-label">✦ {tr("測試 LLM", "Test LLM", "テスト LLM", "테스트 LLM")}</span>
        <span>{tr("今日", "Today", "今日", "오늘")} {used}/{limit || "—"}</span>
        <span>{tr("剩", "Left", "残り", "남음")} {remainingPoints} {tr("點", "pts", "pt", "점")}</span>
        <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </button>
      {expanded && <div className="mp-test-quota-detail">
        {tr(
          "線上聊天、心聲與其他功能每次 1 點；現實聊天每次 3 點。用量每日重置，測試點數由伺服器管理。",
          "Online chat, inner thoughts, and other features cost 1 point; reality chat costs 3 points. Daily usage resets, while test points are server-managed.",
          "オンラインチャット、心の声などは 1 ポイント、リアルチャットは 3 ポイントです。利用回数は毎日リセットされ、テストポイントはサーバーで管理されます。",
          "온라인 채팅, 속마음과 기타 기능은 1점, 현실 채팅은 3점입니다. 일일 사용량은 매일 초기화되고 테스트 포인트는 서버에서 관리됩니다."
        )}
      </div>}
    </div>
  );
}
