import React, { useId } from "react";

export default function ChatReplyTimingSettings({ value = "instant", onChange, tr }) {
  const descriptionId = useId();
  const manualEnabled = value === "batch";
  const description = manualEnabled
    ? tr(
      "可連續送出多個訊息氣泡；按下「生成回應」後，角色才會一起閱讀並回覆。",
      "Send several message bubbles, then tap Generate reply when you want the character to read and respond.",
      "複数の吹き出しを続けて送り、「返信を生成」を押したときにキャラクターがまとめて読んで返信します。",
      "여러 말풍선을 연속으로 보낸 뒤 ‘답장 생성’을 누르면 캐릭터가 한꺼번에 읽고 답장합니다.",
    )
    : tr(
      "關閉時，送出訊息後角色會立即回覆。",
      "When off, the character replies immediately after each message.",
      "オフの場合、メッセージを送るとキャラクターがすぐに返信します。",
      "끄면 메시지를 보낼 때마다 캐릭터가 바로 답장합니다.",
    );

  return <div className="mp-cc mp-manual-reply-setting">
    <div className="mp-manual-reply-copy">
      <div className="mp-manual-reply-title">{tr("手動生成回應", "Generate replies manually", "返信を手動生成", "답장 수동 생성")}</div>
      <p id={descriptionId}>{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={manualEnabled}
      aria-describedby={descriptionId}
      aria-label={tr("手動生成回應", "Generate replies manually", "返信を手動生成", "답장 수동 생성")}
      className="mp-manual-reply-switch"
      onClick={() => onChange?.(manualEnabled ? "instant" : "batch")}
    >
      <span aria-hidden="true" />
    </button>
  </div>;
}
