import React, { useState } from "react";
import { parseChangelogItem } from "../../utils/changelog.js";
import {
  clearRuntimeDiagnostics,
  copyRuntimeDiagnostics,
  copyTextForDiagnostics,
  getRuntimeDiagnostics,
} from "../../services/diagnostics/runtimeDiagnostics.js";
import { explainError } from "../../services/diagnostics/errorExplain.js";
import { normalizeUiLanguage } from "../../utils/i18n.js";
import { canShowOfficialContact, getPrivacyUrl, getTermsUrl } from "../../utils/privacyUrl.js";
import { BUILD_ID } from "../../utils/buildVersion";

export const SUPPORT_EMAIL = "support@maliphone.com";

const detectPlatform = () => {
  try {
    const capacitor = globalThis.Capacitor;
    if (capacitor?.isNativePlatform?.()) return capacitor.getPlatform?.() || "native";
  } catch {
    // 取不到平台時視為網頁版。
  }
  return "web";
};

// 主旨與內文預先帶入版本、語系、平台，方便玩家回報、客服辨識；不帶任何聊天內容或帳號資料。
export function buildSupportMailto({ tr, version, locale, platform }) {
  const subject = tr("MaliPhone 問題回報", "MaliPhone support request", "MaliPhone お問い合わせ", "MaliPhone 문의");
  const body = [
    tr("請描述遇到的問題（可附截圖或貼上「複製全部錯誤」的內容）：", "Please describe the issue (screenshots or pasted \"Copy all errors\" output are welcome):", "発生した問題を記入してください（スクリーンショットや「すべてコピー」の内容を貼り付けても構いません）：", "겪은 문제를 적어 주세요 (스크린샷이나 \"모든 오류 복사\" 내용을 붙여 넣어도 됩니다):"),
    "",
    "",
    "----",
    `${tr("版本", "Version", "バージョン", "버전")}: ${version}`,
    `${tr("語系", "Language", "言語", "언어")}: ${locale}`,
    `${tr("平台", "Platform", "プラットフォーム", "플랫폼")}: ${platform}`,
  ].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function AboutInfoSettings({ tr, version, currentChangelogTitle, currentChangelog, versionOpen, setVersionOpen, disclaimerOpen, setDisclaimerOpen }) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState(() => getRuntimeDiagnostics());
  const [copyState, setCopyState] = useState("idle");
  const [emailCopyState, setEmailCopyState] = useState("idle");
  const supportMailto = buildSupportMailto({
    tr,
    version,
    locale: normalizeUiLanguage(typeof document !== "undefined" ? document.documentElement.lang : ""),
    platform: detectPlatform(),
  });
  const copySupportEmail = async () => {
    const copied = await copyTextForDiagnostics(SUPPORT_EMAIL);
    setEmailCopyState(copied ? "copied" : "failed");
  };
  const refreshDiagnostics = () => {
    const records = getRuntimeDiagnostics();
    setDiagnostics(records);
    return records;
  };
  const copyDiagnostics = async () => {
    const records = refreshDiagnostics();
    const copied = await copyRuntimeDiagnostics(records);
    setCopyState(copied ? "copied" : "failed");
  };
  const clearDiagnostics = () => {
    clearRuntimeDiagnostics();
    setDiagnostics([]);
    setCopyState("idle");
  };
  return <>
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("版本資訊", "Version info", "バージョン情報", "버전 정보")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7,marginBottom:8}}>
                  <strong>MaliPhone</strong> v{version} <span style={{ opacity: .6, fontSize: "0.85em" }}>({BUILD_ID})</span><br/>{tr("AI 角色互動小手機介面", "AI character companion phone", "AIキャラクターと交流するスマホ", "AI 캐릭터 교류 스마트폰")}
                </div>
                <div className="mp-version-row" onClick={() => setVersionOpen((v) => !v)}>
                  <span>{currentChangelogTitle}　{tr("版本", "Version", "バージョン", "버전")}：{version}</span>
                  <span>{versionOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
                </div>
                {versionOpen && (
                  <ol className="mp-version-list">
                    {(currentChangelog.length ? currentChangelog : [tr("這個版本沒有填寫更新內容。", "No update notes were added for this version.", "このバージョンの更新内容は未記入です。", "이 버전의 업데이트 내용이 없습니다.")]).map((item, idx) => {
                      const { title, detail } = parseChangelogItem(item);
                      return <li key={idx}>{title && <strong>{title}</strong>}<span style={{ whiteSpace: "pre-line" }}>{detail}</span></li>;
                    })}
                  </ol>
                )}
              </div>
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("錯誤診斷", "Error diagnostics", "エラー診断", "오류 진단")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7,marginBottom:8}}>
                  {tr(
                    "發生錯誤時，這裡會先說明原因與處理方式；看不出原因的，請按「複製全部錯誤」回報。紀錄只存在這台裝置，只包含版本、App 路徑與錯誤資訊，不包含聊天內容或 API Key。",
                    "When something goes wrong, this explains the cause and what to do. If the cause is unclear, tap \"Copy all errors\" to report it. Logs stay on this device and include only version, app route, and error details—not chats or API keys.",
                    "エラーが起きると、ここで原因と対処法を説明します。原因が分からない場合は「すべてコピー」で報告してください。記録はこの端末にのみ保存され、バージョン、アプリ経路、エラー情報だけを含み、会話や API キーは含みません。",
                    "오류가 발생하면 여기에서 원인과 해결 방법을 먼저 알려 드립니다. 원인을 알 수 없으면 \"모든 오류 복사\"로 알려 주세요. 기록은 이 기기에만 저장되며 버전, 앱 경로, 오류 정보만 포함하고 채팅 내용이나 API 키는 포함하지 않습니다.",
                  )}
                </div>
                <div className="mp-version-row" onClick={() => {
                  if (!diagnosticsOpen) refreshDiagnostics();
                  setDiagnosticsOpen((value) => !value);
                  setCopyState("idle");
                }}>
                  <span>{tr(`最近錯誤紀錄：${diagnostics.length} 筆`, `${diagnostics.length} recent error(s)`, `最近のエラー：${diagnostics.length}件`, `최근 오류 기록: ${diagnostics.length}개`)}</span>
                  <span>{diagnosticsOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("查看", "View", "表示", "보기")}</span>
                </div>
                {diagnosticsOpen && (
                  <div style={{padding:"10px 2px 2px"}}>
                    {diagnostics.length === 0 ? (
                      <div style={{fontSize:11,color:"var(--mp-txt-l)",padding:"4px 2px 10px"}}>{tr("目前沒有錯誤紀錄。", "No error records yet.", "エラー記録はありません。", "오류 기록이 없습니다.")}</div>
                    ) : diagnostics.map((record) => {
                      const explained = explainError(record, tr);
                      const tone = explained?.tone || "unknown";
                      return (
                        <div key={record.id} className="mp-diag-rec">
                          <div className="mp-diag-meta">
                            <span className={`mp-diag-tag mp-diag-tag--${tone}`}>{explained?.tag || tr("未分類", "Unclassified", "未分類", "미분류")}</span>
                            <span>{new Date(record.at).toLocaleString()} · {record.appId || "unknown"}</span>
                          </div>
                          <div className="mp-diag-title">{explained?.title || tr("看不出原因的錯誤", "Unrecognized error", "原因不明のエラー", "원인을 알 수 없는 오류")}</div>
                          <div className="mp-diag-hint">{explained?.hint || tr("偶爾一次可以先不用理會；一直發生的話，請按「複製全部錯誤」回報。", "If it happened once, you can ignore it. If it keeps happening, tap \"Copy all errors\" to report it.", "一度だけなら気にしなくて大丈夫です。繰り返す場合は「すべてコピー」で報告してください。", "한 번이면 무시해도 됩니다. 계속되면 \"모든 오류 복사\"로 알려 주세요.")}</div>
                          <details className="mp-diag-details">
                            <summary>{tr("技術細節", "Technical details", "技術的な詳細", "기술 세부 정보")}</summary>
                            <div className="mp-diag-raw">
                              <b>{record.kind || "runtime"}{record.details?.status ? ` · ${record.details.status}` : ""}</b><br />
                              {record.message || "Unknown error"}
                              {record.recentApps?.length ? <><br />{tr("操作路徑", "App path", "アプリ経路", "앱 경로")}：{record.recentApps.join(" → ")}</> : null}
                              {record.stack ? <><br /><br />{record.stack}</> : null}
                            </div>
                          </details>
                        </div>
                      );
                    })}
                    <div style={{display:"flex",gap:8,marginTop:8}}>
                      <button type="button" className="mp-save" style={{flex:1}} disabled={!diagnostics.length} onClick={copyDiagnostics}>
                        {copyState === "copied"
                          ? tr("✓ 已複製", "✓ Copied", "✓ コピー済み", "✓ 복사됨")
                          : copyState === "failed"
                            ? tr("複製失敗", "Copy failed", "コピー失敗", "복사 실패")
                            : tr("複製全部錯誤", "Copy all errors", "すべてコピー", "모든 오류 복사")}
                      </button>
                      <button type="button" className="mp-ibtn" style={{flex:1}} disabled={!diagnostics.length} onClick={clearDiagnostics}>{tr("清除紀錄", "Clear logs", "記録を消去", "기록 삭제")}</button>
                    </div>
                  </div>
                )}
              </div>
              {canShowOfficialContact() && (
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("聯絡客服", "Contact support", "お問い合わせ", "고객 지원")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7,marginBottom:8}}>
                  {tr(
                    "遇到問題或有建議，歡迎寫信給我們。點下方按鈕會開啟郵件 App，並自動附上版本與語系；若沒有反應，請複製信箱自行寄信。",
                    "Questions or suggestions are welcome. The button below opens your mail app with the version and language filled in. If nothing happens, copy the address and send an email yourself.",
                    "問題やご意見があればお気軽にご連絡ください。下のボタンでメールアプリが開き、バージョンと言語が自動で入ります。反応がない場合はアドレスをコピーしてご自身で送信してください。",
                    "문제나 의견이 있으면 메일을 보내 주세요. 아래 버튼을 누르면 메일 앱이 열리고 버전과 언어가 자동으로 입력됩니다. 반응이 없으면 주소를 복사해 직접 보내 주세요.",
                  )}
                </div>
                <div style={{fontSize:13,color:"var(--mp-txt)",fontWeight:600,marginBottom:8,wordBreak:"break-all"}}>{SUPPORT_EMAIL}</div>
                <div style={{display:"flex",gap:8}}>
                  <a className="mp-save" style={{flex:1,textAlign:"center",textDecoration:"none"}} href={supportMailto}>
                    {tr("寫信給客服", "Email support", "メールで問い合わせ", "메일 보내기")}
                  </a>
                  <button type="button" className="mp-ibtn" style={{flex:1}} onClick={copySupportEmail}>
                    {emailCopyState === "copied"
                      ? tr("✓ 已複製", "✓ Copied", "✓ コピー済み", "✓ 복사됨")
                      : emailCopyState === "failed"
                        ? tr("複製失敗", "Copy failed", "コピー失敗", "복사 실패")
                        : tr("複製信箱", "Copy address", "アドレスをコピー", "주소 복사")}
                  </button>
                </div>
              </div>
              )}
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("服務條款與免責聲明", "Terms and disclaimer", "利用規約と免責事項", "이용약관 및 면책")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7,marginBottom:8}}>
                  {tr("最後更新：2026年6月2日", "Last updated: June 2, 2026", "最終更新: 2026年6月2日", "마지막 업데이트: 2026년 6월 2일")}
                </div>
                <a className="mp-version-row" href={getTermsUrl()} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",color:"inherit"}}>
                  <span>{tr("查看完整條款", "View full terms", "利用規約を表示", "전체 약관 보기")}</span>
                  <span>{tr("開啟", "Open", "開く", "열기")}</span>
                </a>
                <a className="mp-version-row" href={getPrivacyUrl()} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",color:"inherit",marginTop:10}}>
                  <span>{tr("隱私權政策", "Privacy Policy", "プライバシーポリシー", "개인정보 처리방침")}</span>
                  <span>{tr("開啟", "Open", "開く", "열기")}</span>
                </a>
              </div>
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("素材授權與致謝", "Asset credits and licenses", "素材ライセンスとクレジット", "소재 라이선스 및 크레딧")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.8}}>
                  <div>{tr("雲隱山莊的像素美術素材來自 LimeZu（limezu.itch.io），使用以下素材包：", "Yunyin Villa pixel art assets are by LimeZu (limezu.itch.io), from these packs:", "雲隠山荘のピクセルアート素材は LimeZu（limezu.itch.io）の以下の素材パックを使用しています：", "운은산장의 픽셀 아트 소재는 LimeZu(limezu.itch.io)의 다음 소재 팩을 사용합니다:")}</div>
                  <ul style={{margin:"4px 0 6px",paddingLeft:18}}>
                    <li>Modern Interiors</li>
                    <li>Modern Exteriors</li>
                    <li>Modern Farm</li>
                    <li>{tr("Character Generator 2.0（隨 Modern Interiors 附贈）", "Character Generator 2.0 (bundled with Modern Interiors)", "Character Generator 2.0（Modern Interiors 付属）", "Character Generator 2.0 (Modern Interiors 포함)")}</li>
                  </ul>
                  <div>{tr("授權摘要：已購買正式授權，可用於商業與非商業專案；不可轉售或散佈素材本體，素材著作權歸原作者所有。", "License summary: used under purchased licenses for commercial and non-commercial projects; asset files may not be resold or redistributed, and copyright remains with the original author.", "ライセンス概要：購入済みの正式ライセンスに基づき商用・非商用で使用しています。素材ファイル自体の再販売・再配布は禁止で、著作権は原作者に帰属します。", "라이선스 요약: 구매한 정식 라이선스에 따라 상업 및 비상업 프로젝트에 사용하며, 소재 파일 자체의 재판매 또는 재배포는 금지되고 저작권은 원작자에게 있습니다.")}</div>
                  <div><a href="https://limezu.itch.io/" target="_blank" rel="noreferrer">limezu.itch.io</a></div>
                </div>
              </div>
  </>;
}
