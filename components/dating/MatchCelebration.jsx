import React from "react";
import { tagLabel } from "../../data/dating/interestTags";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

const Avatar = ({ src, fallback, className }) => {
  const safe = sanitizeUserImageUrl(src);
  return <div className={`dt-match-av ${className}`}>{safe ? <img src={safe} alt="" /> : (fallback || "?")}</div>;
};

/**
 * 整個 App 的高潮。共同點一定要顯示——延遲配對讓玩家很難察覺喜好有影響，
 * 這行字是他意識到「原來我的檔案有用」的唯一機會。
 */
export default function MatchCelebration({ match, entry, playerPhoto, playerName, onOpenChat, onKeepSwiping }) {
  if (!match || !entry) return null;
  return (
    <div className="dt-match">
      <div className="dt-match-inner">
        {match.superLike && <div className="dt-match-super">★ 你的 Super Like 有回應了</div>}
        <div className="dt-match-title">配對成功</div>
        <div className="dt-match-avs">
          <Avatar src={playerPhoto} fallback={playerName?.[0] || "我"} className="left" />
          <Avatar src={entry.profile.photos?.[0]} fallback={entry.profile.name?.[0]} className="right" />
        </div>
        <div className="dt-match-name">你和 {entry.profile.name} 互相喜歡</div>
        {match.shared?.length > 0 && (
          <div className="dt-match-shared">
            你們都喜歡
            <div className="dt-card-tags">{match.shared.map((tag) => <span key={tag} className="dt-tag light">{tagLabel(tag)}</span>)}</div>
          </div>
        )}
        <button type="button" className="dt-match-btn primary" onClick={onOpenChat}>傳訊息</button>
        <button type="button" className="dt-match-btn ghost" onClick={onKeepSwiping}>繼續滑</button>
      </div>
    </div>
  );
}
