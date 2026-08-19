import React from "react";
import { tagLabel } from "../../data/dating/interestTags";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

const Avatar = ({ src, fallback, className, label }) => {
  const safe = sanitizeUserImageUrl(src);
  return (
    <div className={`dt-match-portrait ${className}`}>
      <div className="dt-match-av">{safe ? <img src={safe} alt="" /> : (fallback || "?")}</div>
      <span>{label}</span>
    </div>
  );
};

/**
 * 整個 App 的高潮。共同點一定要顯示——延遲配對讓玩家很難察覺喜好有影響，
 * 這行字是他意識到「原來我的檔案有用」的唯一機會。
 */
export default function MatchCelebration({ match, entry, playerPhoto, playerName, onOpenChat, onKeepSwiping, tr }) {
  if (!match || !entry) return null;
  const text = (zhTW, en, ja, ko) => (typeof tr === "function" ? tr(zhTW, en, ja, ko) : zhTW);
  const playerLabel = playerName || text("你", "You", "あなた", "나");
  return (
    <div className="dt-match" role="dialog" aria-modal="true" aria-label={text("配對成功", "It's a match", "マッチしました", "매치 성공")}>
      <div className="dt-match-glow" aria-hidden="true" />
      <div className="dt-match-inner">
        <div className="dt-match-sheet">
          {match.superLike && <div className="dt-match-super">★ {text("你的 Super Like 有回應了", "Your Super Like got a response", "Super Like に応答がありました", "Super Like에 응답이 왔어요")}</div>}
          <div className="dt-match-kicker">{text("信風為你們捎來一封信", "Tradewind brought you a note", "信風がふたりに便りを届けました", "신풍이 두 사람에게 편지를 전했어요")}</div>
          <div className="dt-match-title">{text("配對成功", "It's a match", "マッチしました", "매치 성공")}</div>
          <div className="dt-match-avs">
            <Avatar src={playerPhoto} fallback={playerLabel[0]} className="left" label={playerLabel} />
            <div className="dt-match-seal" aria-hidden="true">♥</div>
            <Avatar src={entry.profile.photos?.[0]} fallback={entry.profile.name?.[0]} className="right" label={entry.profile.name} />
          </div>
          <div className="dt-match-name">{text(`你和 ${entry.profile.name} 互相喜歡`, `You and ${entry.profile.name} like each other`, `${entry.profile.name}さんと気が合いました`, `${entry.profile.name}님과 서로 마음이 통했어요`)}</div>
          <div className="dt-match-note">{text("就從一句話開始吧。", "Start with one small hello.", "まずはひとことから。", "짧은 인사부터 시작해 볼까요?")}</div>
          {match.shared?.length > 0 && (
            <div className="dt-match-shared">
              <span>{text("你們的共同興趣", "Your shared interests", "ふたりの共通の趣味", "두 사람의 공통 관심사")}</span>
              <div className="dt-card-tags">{match.shared.map((tag) => <span key={tag} className="dt-tag light">{tagLabel(tag, tr)}</span>)}</div>
            </div>
          )}
          <div className="dt-match-actions">
            <button type="button" className="dt-match-btn primary" onClick={onOpenChat}>{text("傳訊息", "Send a message", "メッセージする", "메시지 보내기")}</button>
            <button type="button" className="dt-match-btn ghost" onClick={onKeepSwiping}>{text("繼續探索", "Keep exploring", "探索を続ける", "もっと探す")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
