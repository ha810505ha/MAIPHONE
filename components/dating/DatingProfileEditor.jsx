import React, { useRef } from "react";
import { categoryLabel, INTEREST_CATEGORIES, tagLabel, tagsByCategory } from "../../data/dating/interestTags";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

const MAX_PHOTOS = 6;
const MAX_TAGS = 12;
const MAX_EDGE = 720;

// 照片會進 IndexedDB，原圖直接存會把存檔撐爆，先縮到長邊 720 再轉 JPEG。
function downscale(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("decode failed"));
      image.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export default function DatingProfileEditor({ profile, updateProfile, playerName, showToast, tr }) {
  const fileRef = useRef(null);
  const tags = profile.tags || [];
  const photos = profile.photos || [];

  const onPick = async (event) => {
    const files = [...(event.target.files || [])].slice(0, MAX_PHOTOS - photos.length);
    event.target.value = "";
    if (!files.length) return;
    try {
      const next = await Promise.all(files.map(downscale));
      updateProfile({ photos: [...photos, ...next.filter(Boolean)].slice(0, MAX_PHOTOS) });
    } catch {
      showToast?.("照片讀取失敗");
    }
  };

  const toggleTag = (id) => {
    if (tags.includes(id)) return updateProfile({ tags: tags.filter((tag) => tag !== id) });
    if (tags.length >= MAX_TAGS) return showToast?.(`最多選 ${MAX_TAGS} 個`);
    return updateProfile({ tags: [...tags, id] });
  };

  return (
    <div className="dt-me">
      <div className="dt-me-head">
        <div className="dt-me-name">{playerName || "我"}</div>
        <div className="dt-me-hint">這份資料只有信風用。配對到的人在聊天時會參考這裡，而不是玩家檔案。</div>
      </div>

      <div className="dt-sg">
        <div className="dt-sg-t">照片<span>{photos.length}/{MAX_PHOTOS}</span></div>
        <div className="dt-me-photos">
          {photos.map((photo, index) => (
            <div key={index} className="dt-me-photo">
              <img src={sanitizeUserImageUrl(photo) || ""} alt="" />
              <button type="button" onClick={() => updateProfile({ photos: photos.filter((_, i) => i !== index) })}>✕</button>
              {index === 0 && <span className="dt-me-main">主照片</span>}
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" className="dt-me-add" onClick={() => fileRef.current?.click()}>＋</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
      </div>

      <div className="dt-sg">
        <div className="dt-sg-t">自我介紹</div>
        <textarea className="dt-me-bio" maxLength={500} value={profile.bio || ""} placeholder={"寫給人看的，不是寫設定表。\n例如：假日大多在山上，平日大多在睡覺。"}
          onChange={(event) => updateProfile({ bio: event.target.value })} />
        <div className="dt-me-count">{(profile.bio || "").length}/500</div>
      </div>

      <div className="dt-sg">
        <div className="dt-sg-t">興趣<span>{tags.length}/{MAX_TAGS}</span></div>
        <div className="dt-me-hint" style={{ marginBottom: 10 }}>選到的標籤會影響配對成功率。有些人喜歡，也有些人不喜歡。</div>
        {INTEREST_CATEGORIES.map((category) => (
          <div key={category.id} className="dt-me-cat">
            <div className="dt-me-cat-t">{categoryLabel(category.id, tr)}</div>
            <div className="dt-card-tags">
              {tagsByCategory(category.id).map((tag) => (
                <button key={tag.id} type="button" className={`dt-tag pick ${tags.includes(tag.id) ? "on" : ""}`} onClick={() => toggleTag(tag.id)}>{tagLabel(tag.id, tr)}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
