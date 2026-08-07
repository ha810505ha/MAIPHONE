import React from "react";
import {
  copyRuntimeDiagnostics,
  recordRuntimeDiagnostic,
} from "../../services/diagnostics/runtimeDiagnostics.js";
import { shouldAutoReloadAfterImportError } from "../../utils/lazyWithRetry.js";

export default class AppRuntimeBoundary extends React.Component {
  state = { error: null, recovering: false, copyState: "idle" };

  static getDerivedStateFromError(error) {
    return { error, recovering: false };
  }

  componentDidCatch(error, info) {
    const appId = this.props.appId || "home";
    recordRuntimeDiagnostic({
      kind: "react-render",
      appId,
      error,
      stack: `${error?.stack || ""}\n${info?.componentStack || ""}`.trim(),
    });
    console.error("[MaliPhone] App runtime error", { appId, error, componentStack: info?.componentStack });

    let sessionStorage = null;
    try { sessionStorage = globalThis.sessionStorage; } catch {}
    const shouldReload = shouldAutoReloadAfterImportError(error, sessionStorage, appId);
    if (!shouldReload || typeof globalThis.location?.reload !== "function") return;
    this.setState({ recovering: true }, () => {
      globalThis.setTimeout(() => globalThis.location.reload(), 60);
    });
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.appId !== this.props.appId) {
      this.setState({ error: null, recovering: false, copyState: "idle" });
    }
  }

  copyErrorReport = async () => {
    const copied = await copyRuntimeDiagnostics();
    this.setState({ copyState: copied ? "copied" : "failed" });
  };

  render() {
    const { error, recovering, copyState } = this.state;
    if (!error) return this.props.children;

    const tr = this.props.tr || ((zh) => zh);
    const canGoBack = Boolean(this.props.appId && this.props.onBack);
    const message = String(error?.message || error || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류")).slice(0, 300);

    return (
      <div className="mp-page" role="alert" style={{ background: "var(--mp-page-bg)", color: "var(--mp-txt)" }}>
        <div className="mp-hdr">
          {canGoBack && <button type="button" className="mp-back" onClick={this.props.onBack} aria-label={tr("返回主畫面", "Back to Home", "ホームに戻る", "홈으로 돌아가기")}>←</button>}
          <div className="mp-htitle">{tr("App 載入異常", "App loading issue", "アプリの読み込みエラー", "앱 로딩 오류")}</div>
        </div>
        <div className="mp-empty" style={{ flex: 1, padding: 24, textAlign: "center" }}>
          <div className="mp-empty-i">{recovering ? "↻" : "⚠️"}</div>
          <div className="mp-empty-t" style={{ lineHeight: 1.7 }}>
            {recovering
              ? tr("正在自動重新載入小手機⋯", "Reloading the phone automatically…", "スマホを自動で再読み込みしています…", "휴대폰을 자동으로 다시 불러오는 중…")
              : tr("這次畫面沒有成功開啟，資料仍然保留。可以返回主畫面，或直接重新載入小手機。", "This screen did not open successfully. Your data is still safe. Return Home or reload the phone.", "画面を開けませんでした。データは保持されています。ホームに戻るか、スマホを再読み込みしてください。", "화면을 열지 못했지만 데이터는 유지됩니다. 홈으로 돌아가거나 휴대폰을 다시 불러오세요.")}
          </div>
          {!recovering && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: "min(100%, 300px)", marginTop: 16 }}>
              {canGoBack && <button type="button" className="mp-ibtn-chat" style={{ flex: 1 }} onClick={this.props.onBack}>{tr("返回主畫面", "Back Home", "ホームへ", "홈으로")}</button>}
              <button type="button" className="mp-save" style={{ flex: 1 }} onClick={() => globalThis.location?.reload?.()}>{tr("重新載入", "Reload", "再読み込み", "다시 불러오기")}</button>
              <button type="button" className="mp-ibtn-chat" style={{ flex: "1 0 100%" }} onClick={this.copyErrorReport}>
                {copyState === "copied"
                  ? tr("✓ 已複製錯誤資訊", "✓ Error details copied", "✓ エラー情報をコピーしました", "✓ 오류 정보 복사됨")
                  : copyState === "failed"
                    ? tr("複製失敗，請到設定查看", "Copy failed — view it in Settings", "コピー失敗：設定で確認してください", "복사 실패 — 설정에서 확인하세요")
                    : tr("複製錯誤資訊", "Copy error details", "エラー情報をコピー", "오류 정보 복사")}
              </button>
            </div>
          )}
          {!recovering && (
            <details style={{ width: "min(100%, 300px)", marginTop: 16, color: "var(--mp-txt-l)", fontSize: 10, textAlign: "left" }}>
              <summary>{tr("錯誤資訊", "Error details", "エラー情報", "오류 정보")}</summary>
              <div style={{ marginTop: 6, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{message}</div>
            </details>
          )}
        </div>
      </div>
    );
  }
}
