import React from "react";

// 思想（思考鏈）顯示總開關。全域偏好，只控制是否顯示已攔截的思考，不影響生成。
export default function ThinkingChainSettings({ enabled, onToggle, tr }) {
  return (
    <div className="mp-cc">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("顯示思想", "Show thoughts", "思考を表示", "생각 표시")}</div>
          <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 3, lineHeight: 1.5 }}>
            {tr(
              "顯示角色在回覆前的思考（需模型輸出 <think> 之類的思考內容）。全站生效。",
              "Show the character's pre-reply thinking when the model outputs a <think> block. Applies everywhere.",
              "モデルが <think> などの思考を出力したとき、返信前の思考を表示します。全体に適用。",
              "모델이 <think> 같은 사고를 출력하면 답장 전 생각을 표시합니다. 전체 적용.",
            )}
          </div>
        </div>
        <button type="button" role="switch" aria-checked={enabled} className={`mp-switch ${enabled ? "active" : ""}`} onClick={onToggle}><span /></button>
      </div>
    </div>
  );
}
