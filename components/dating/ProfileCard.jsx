import React, { useEffect, useState } from "react";
import { PHOTO_ROTATE_MS } from "../../constants/dating";
import { tagLabel } from "../../data/dating/interestTags";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

/**
 * 照片自動輪播。單獨做會被當成 bug，所以一定要配頂部的分段進度條——
 * 有進度條是設計，沒進度條是閃爍。
 * 拖曳中、資料頁展開、頁面隱藏、玩家手動點過之後都要停。
 */
function usePhotoRotation(count, paused) {
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState(false);
  useEffect(() => { setIndex(0); setManual(false); }, [count]);
  useEffect(() => {
    if (count < 2 || paused || manual || document.hidden) return undefined;
    const timer = setTimeout(() => setIndex((value) => (value + 1) % count), PHOTO_ROTATE_MS);
    return () => clearTimeout(timer);
  }, [count, paused, manual, index]);
  return {
    index,
    auto: count >= 2 && !paused && !manual,
    step: (delta) => { setManual(true); setIndex((value) => (value + delta + count) % count); },
  };
}

export default function ProfileCard({ entry, paused, dragX, dragY, onOpenDetail, tr }) {
  const photos = (entry.profile.photos || []).map(sanitizeUserImageUrl).filter(Boolean);
  const { index, auto, step } = usePhotoRotation(photos.length, paused);
  const likeOpacity = Math.min(1, Math.max(0, dragX / 70));
  const nopeOpacity = Math.min(1, Math.max(0, -dragX / 70));
  return (
    <div className="dt-card-inner">
      <div className="dt-photo">
        {photos.length ? <img src={photos[index]} alt="" /> : <div className="dt-photo-ph">{entry.profile.name?.[0] || "?"}</div>}
        {photos.length > 1 && (
          <div className="dt-photo-bars">
            {photos.map((_, i) => (
              <span key={i} className={`dt-photo-bar ${i < index ? "done" : ""} ${i === index ? "active" : ""}`}>
                <i style={i === index && auto ? { animationDuration: `${PHOTO_ROTATE_MS}ms` } : undefined} className={i === index && auto ? "fill" : ""} />
              </span>
            ))}
          </div>
        )}
        {photos.length > 1 && <>
          <button type="button" className="dt-photo-nav left" onClick={(event) => { event.stopPropagation(); step(-1); }} aria-label="上一張" />
          <button type="button" className="dt-photo-nav right" onClick={(event) => { event.stopPropagation(); step(1); }} aria-label="下一張" />
        </>}
        <div className="dt-stamp like" style={{ opacity: likeOpacity }}>LIKE</div>
        <div className="dt-stamp nope" style={{ opacity: nopeOpacity }}>NOPE</div>
        {dragY < -30 && <div className="dt-stamp info" style={{ opacity: Math.min(1, -dragY / 70) }}>資料</div>}
      </div>
      <div className="dt-card-info" onClick={onOpenDetail}>
        <div className="dt-card-name">{entry.profile.name}<span>{entry.profile.age}</span></div>
        <div className="dt-card-meta">{entry.profile.job}・{entry.profile.distance} 公里內</div>
        <div className="dt-card-tags">
          {(entry.profile.tags || []).slice(0, 4).map((tag) => <span key={tag} className="dt-tag">{tagLabel(tag, tr)}</span>)}
          {(entry.profile.tags || []).length > 4 && <span className="dt-tag ghost">+{entry.profile.tags.length - 4}</span>}
        </div>
        <div className="dt-card-more">↑ 上滑看完整資料</div>
      </div>
    </div>
  );
}
