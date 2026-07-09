import React from "react";
import { Eye, LoaderCircle, Pause, RefreshCw, Volume2 } from "lucide-react";

export function CharacterVoiceAction({ visible, collapseWhenHidden, status, onToggle, tr }) {
  return (
    <button
      type="button"
      className={`mp-voice-action ${visible ? "" : (collapseWhenHidden ? "mp-voice-action-collapsed" : "mp-voice-action-hidden")} ${status === "playing" ? "mp-voice-action-playing" : ""}`}
      disabled={status === "loading"}
      title={status === "playing" ? tr("暫停語音", "Pause voice", "音声を一時停止", "음성 일시정지") : tr("播放角色語音", "Play character voice", "キャラクター音声を再生", "캐릭터 음성 재생")}
      aria-label={status === "playing" ? tr("暫停語音", "Pause voice", "音声を一時停止", "음성 일시정지") : tr("播放角色語音", "Play character voice", "キャラクター音声を再生", "캐릭터 음성 재생")}
      onClick={(event) => { event.stopPropagation(); onToggle(); }}
    >
      {status === "loading" ? <LoaderCircle size={14} className="mp-voice-spinner" aria-hidden="true" /> : status === "playing" ? <Pause size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
    </button>
  );
}

export function InnerThoughtPanel({ thought, expanded, loading, unseen, onToggle, onRegenerate, tr }) {
  return (
    <div className={`mp-thought ${expanded && thought ? "expanded" : ""}`} onClick={(event) => event.stopPropagation()}>
      <div className="mp-thought-bar">
        <button
          type="button"
          className="mp-thought-peek"
          disabled={loading}
          title={thought ? tr("顯示或收起心聲", "Show or hide inner thought", "心の声を表示・非表示", "속마음 표시 또는 숨기기") : tr("窺探心聲", "Peek at inner thought", "心の声をのぞく", "속마음 엿보기")}
          onClick={onToggle}
        >
          <span className={unseen ? "mp-thought-unseen-icon" : ""} aria-hidden="true"><Eye size={12} strokeWidth={2.1} /></span>
          <span>{loading
            ? tr("讀取中...", "Reading...", "読込中...", "읽는 중...")
            : !thought
              ? tr("窺探心聲", "Peek at inner thought", "心の声をのぞく", "속마음 엿보기")
              : unseen
                ? tr("心聲（未讀）", "Inner thought (new)", "心の声（未読）", "속마음 (새로움)")
                : tr("心聲", "Inner thought", "心の声", "속마음")}</span>
        </button>
        {thought && (
          <button type="button" className="mp-thought-refresh" disabled={loading} title={tr("重新生成心聲", "Regenerate inner thought", "心の声を再生成", "속마음 다시 생성")} aria-label={tr("重新生成心聲", "Regenerate inner thought", "心の声を再生成", "속마음 다시 생성")} onClick={onRegenerate}>
            <RefreshCw size={13} strokeWidth={2.1} aria-hidden="true" />
          </button>
        )}
      </div>
      {thought && expanded && <div className="mp-thought-content">{thought}</div>}
    </div>
  );
}

export function SceneBar({ title, scene, editor, onStartEditing, onChange, onSave, tr }) {
  const label = [scene.location, scene.note].filter(Boolean).join(" · ");
  return (
    <div style={{ margin: "0 14px 6px", padding: "0 2px" }}>
      {!editor ? (
        <div style={{ fontSize: 11, color: "var(--mp-txt-l)", cursor: "pointer", lineHeight: 1.35, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} onClick={onStartEditing}>
          <span style={{ flexShrink: 0 }}>⌁</span>
          <span style={{ fontWeight: 800, color: "var(--mp-txt)", flexShrink: 0 }}>{title}：</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label || tr("點擊設定", "Tap to set", "タップして設定", "탭하여 설정")}</span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <input className="mp-sinp" value={editor.location} onChange={(event) => onChange({ ...editor, location: event.target.value.slice(0, 15) })} maxLength={15} placeholder={tr("地點（15字內）", "Location (up to 15 chars)", "場所（15文字以内）", "장소(15자 이내)")} />
          <input className="mp-sinp" value={editor.note} onChange={(event) => onChange({ ...editor, note: event.target.value.slice(0, 50) })} maxLength={50} placeholder={tr("小備註（50字內）", "Note (up to 50 chars)", "メモ（50文字以内）", "메모(50자 이내)")} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
            <button className="mp-ibtn" style={{ padding: "3px 9px", minHeight: 24, fontSize: 10 }} onClick={onSave}>{tr("完成", "Done", "完了", "완료")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function renderRealityInline(text) {
  const raw = String(text || "");
  const nodes = [];
  const pattern = /(\*\*[^*\n]{1,500}\*\*|__[^_\n]{1,500}__|「[^」]{1,500}」|"[^"\n]{1,500}"|\*[^*\n]{1,500}\*|_[^_\n]{1,500}_)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(raw))) {
    if (match.index > last) nodes.push(raw.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**") || token.startsWith("__")) nodes.push(<strong key={`b-${match.index}`} className="mp-reality-strong">{token.slice(2, -2)}</strong>);
    else if (token.startsWith("「") || token.startsWith('"')) nodes.push(<span key={`d-${match.index}`} className="mp-reality-dialogue">{token}</span>);
    else nodes.push(<span key={`t-${match.index}`} className="mp-reality-thought">{token.slice(1, -1)}</span>);
    last = match.index + token.length;
  }
  if (last < raw.length) nodes.push(raw.slice(last));
  return nodes.map((node, index) => typeof node === "string" ? <React.Fragment key={`s-${index}`}>{node}</React.Fragment> : node);
}

export function RealityMessageText({ text }) {
  return String(text || "").split(/\n{2,}/).map((paragraph, index) => (
    <p key={index} className="mp-reality-p">
      {paragraph.split("\n").map((line, lineIndex) => <React.Fragment key={lineIndex}>{lineIndex > 0 && <br />}{renderRealityInline(line)}</React.Fragment>)}
    </p>
  ));
}
