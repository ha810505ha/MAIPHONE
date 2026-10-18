import React, { useState } from "react";
import { SCAM_GROUP_FAKE, getAntiFraudUrl } from "../../services/dating/scamScript.js";

/**
 * 詐騙角色貼的「群組邀請」：長得像一般網址預覽卡，點下去開的是反詐騙宣導網站。
 * 點過之後在卡片下方留一行提示，讓玩家知道剛才那是什麼。
 */
export default function ScamGroupLinkCard({ message, tr }) {
  const [revealed, setRevealed] = useState(!!message?.scamGroupLink?.revealedAt);
  const href = getAntiFraudUrl();
  const members = SCAM_GROUP_FAKE.members.toLocaleString();
  return (
    <div className="mp-msg-wrap mp-scam-link-wrap">
      <a className="mp-scam-link-card" href={href} target="_blank" rel="noopener noreferrer" onClick={() => setRevealed(true)}>
        <div className="mp-scam-link-url">{SCAM_GROUP_FAKE.displayUrl}</div>
        <div className="mp-scam-link-meta">{SCAM_GROUP_FAKE.title} · {tr(`${members} 位成員 · 群組邀請`, `${members} members · Group invite`, `${members} 人のメンバー · グループ招待`, `${members}명 참여 중 · 그룹 초대`)}</div>
      </a>
      {revealed && (
        <div className="mp-scam-link-note">
          {tr(
            "⚠ 這是詐騙手法示範。真實遇到「老師」「群組」「保證獲利」，請撥 165 或到反詐騙網站查證。",
            "⚠ This is a scam-awareness demo. If someone real pushes a “mentor”, a “group” or “guaranteed returns”, check with your local anti-fraud service.",
            "⚠ これは詐欺手口のデモです。実際に「先生」「グループ」「必ず儲かる」と言われたら、警察や公的な相談窓口で確認してください。",
            "⚠ 사기 수법 시연입니다. 실제로 ‘선생님’, ‘단톡방’, ‘수익 보장’ 이야기가 나오면 경찰이나 공식 사기 신고 기관에 확인하세요.",
          )}
        </div>
      )}
    </div>
  );
}
