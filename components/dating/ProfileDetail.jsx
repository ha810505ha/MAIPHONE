import React from "react";
import { categoryLabel, groupTags, tagLabel } from "../../data/dating/interestTags";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { distanceLabel } from "./ProfileCard";

/**
 * 只展示公開資訊。dislikes 永遠不出現在這裡，玩家踩雷必須是意外。
 * 配對之後也是同一份——完整的角色卡要等加入聯絡人才有。
 * 沒有 onSwipe 就是純瀏覽（從聊天室進來看已配對的人），不顯示動作列。
 */
export default function ProfileDetail({ entry, onClose, onSwipe, superLikes, blocked, canReport, onToggleBlock, onReport, tr }) {
  if (!entry) return null;
  const photos = (entry.profile.photos || []).map(sanitizeUserImageUrl).filter(Boolean);
  const groups = groupTags(entry.profile.tags);
  return (
    <div className="dt-detail" onClick={onClose}>
      <div className="dt-detail-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="dt-detail-grab" />
        <div className="dt-detail-scroll">
          <div className="dt-detail-hero">
            {photos.length ? <img src={photos[0]} alt="" /> : <div className="dt-photo-ph">{entry.profile.name?.[0] || "?"}</div>}
          </div>
          <div className="dt-detail-name">{entry.profile.name}<span>{entry.profile.age}</span></div>
          <div className="dt-detail-meta">{entry.profile.job}・{distanceLabel(entry.profile.distance, tr)}</div>
          <div className="dt-detail-bio">{entry.profile.bio}</div>
          {groups.map((group) => (
            <div key={group.id} className="dt-detail-group">
              <div className="dt-detail-group-t">{categoryLabel(group.id, tr)}</div>
              <div className="dt-card-tags">{group.tags.map((tag) => <span key={tag} className="dt-tag">{tagLabel(tag, tr)}</span>)}</div>
            </div>
          ))}
          {photos.length > 1 && (
            <div className="dt-detail-photos">
              {photos.slice(1).map((photo, index) => <img key={index} src={photo} alt="" />)}
            </div>
          )}
          {onToggleBlock && (
            <div className="dt-detail-safety">
              <button type="button" onClick={() => onToggleBlock(!blocked)}>{blocked ? tr("解除封鎖", "Unblock", "ブロック解除", "차단 해제") : tr("封鎖這個人", "Block", "この人をブロック", "이 사람 차단하기")}</button>
              {/* 已交換聯絡方式就不能再檢舉：獎的是「你在受害前就發現了」 */}
              {canReport && <button type="button" className="danger" onClick={onReport}>{tr("檢舉", "Report", "通報", "신고")}</button>}
            </div>
          )}
        </div>
        {onSwipe && (
          <div className="dt-detail-actions">
            <button type="button" className="dt-act pass" onClick={() => onSwipe("pass")} aria-label={tr("跳過", "Pass", "スキップ", "넘기기")}>✕</button>
            <button type="button" className="dt-act super" disabled={superLikes <= 0} onClick={() => onSwipe("super")} aria-label="Super Like">★<span className="dt-act-count">{superLikes}</span></button>
            <button type="button" className="dt-act like" onClick={() => onSwipe("like")} aria-label={tr("喜歡", "Like", "いいね", "좋아요")}>♥</button>
          </div>
        )}
      </div>
    </div>
  );
}
