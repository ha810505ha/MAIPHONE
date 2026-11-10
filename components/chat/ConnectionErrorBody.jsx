import React, { useState } from "react";
import { explainError } from "../../services/diagnostics/errorExplain";
import { CONNECTION_ERROR_PREFIX_RE } from "../../utils/chatMessageUtils";

/**
 * 聊天室的 AI 失敗提示：看得出原因時先顯示白話說明，原文收在「詳細」；
 * 看不出原因時維持原本的原文顯示。
 */
export default function ConnectionErrorBody({ message, isTyping, onRetry, tr }) {
  const [rawOpen, setRawOpen] = useState(false);
  const content = String(message?.content || "");
  const raw = content.replace(CONNECTION_ERROR_PREFIX_RE, "");
  const explained = explainError({ status: message?.errorStatus, message: raw }, tr);
  const retryButton = (
    <button className="mp-retry-btn" disabled={isTyping} onClick={(event) => { event.stopPropagation(); onRetry(); }}>
      {tr("重新生成", "Regenerate", "再生成", "다시 생성")}
    </button>
  );
  if (!explained) return <div><div>{content}</div>{retryButton}</div>;
  return (
    <div>
      <div className="mp-err-title">{explained.title}</div>
      <div>{explained.hint}</div>
      {rawOpen && <div className="mp-err-raw">{raw}</div>}
      <div className="mp-err-actions">
        {retryButton}
        <button type="button" className="mp-err-more" aria-expanded={rawOpen} onClick={(event) => { event.stopPropagation(); setRawOpen((open) => !open); }}>
          {rawOpen ? tr("收合", "Hide", "閉じる", "접기") : tr("詳細", "Details", "詳細", "자세히")}
        </button>
      </div>
    </div>
  );
}
