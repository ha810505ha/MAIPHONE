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
      showToast?.(tr("照片讀取失敗", "Couldn't read the photo", "写真を読み込めませんでした", "사진을 불러오지 못했어요"));
    }
  };

  const toggleTag = (id) => {
    if (tags.includes(id)) return updateProfile({ tags: tags.filter((tag) => tag !== id) });
    if (tags.length >= MAX_TAGS) return showToast?.(tr(`最多選 ${MAX_TAGS} 個`, `You can pick up to ${MAX_TAGS}`, `最大${MAX_TAGS}個まで選べます`, `최대 ${MAX_TAGS}개까지 선택할 수 있어요`));
    return updateProfile({ tags: [...tags, id] });
  };

  return (
    <div className="dt-me">
      <div className="dt-me-head">
        <div className="dt-me-name">{playerName || tr("我", "Me", "わたし", "나")}</div>
        <div className="dt-me-hint">{tr(
          "這份資料只有信風用。配對到的人在聊天時會參考這裡，而不是玩家檔案。",
          "This profile is only for Tradewind. Your matches see this, not your player profile.",
          "このプロフィールは信風専用です。マッチした相手はプレイヤープロフィールではなく、ここを参考にします。",
          "이 프로필은 신풍 전용이에요. 매칭된 상대는 플레이어 프로필이 아니라 이곳을 참고해요.",
        )}</div>
      </div>

      <div className="dt-sg">
        <div className="dt-sg-t">{tr("照片", "Photos", "写真", "사진")}<span>{photos.length}/{MAX_PHOTOS}</span></div>
        <div className="dt-me-photos">
          {photos.map((photo, index) => (
            <div key={index} className="dt-me-photo">
              <img src={sanitizeUserImageUrl(photo) || ""} alt="" />
              <button type="button" onClick={() => updateProfile({ photos: photos.filter((_, i) => i !== index) })} aria-label={tr("刪除照片", "Remove photo", "写真を削除", "사진 삭제")}>✕</button>
              {index === 0 && <span className="dt-me-main">{tr("主照片", "Main", "メイン", "대표")}</span>}
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" className="dt-me-add" onClick={() => fileRef.current?.click()} aria-label={tr("新增照片", "Add photo", "写真を追加", "사진 추가")}>＋</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
      </div>

      <div className="dt-sg">
        <div className="dt-sg-t">{tr("自我介紹", "About me", "自己紹介", "자기소개")}</div>
        <textarea className="dt-me-bio" maxLength={500} value={profile.bio || ""} placeholder={tr(
          "寫給人看的，不是寫設定表。\n例如：假日大多在山上，平日大多在睡覺。",
          "Write for people, not a character sheet.\nE.g. Weekends in the mountains, weekdays mostly asleep.",
          "設定表ではなく、人に向けて書きましょう。\n例：休日はだいたい山、平日はだいたい寝ています。",
          "설정표가 아니라 사람에게 쓰는 글이에요.\n예: 주말엔 대부분 산에, 평일엔 대부분 자고 있어요.",
        )}
          onChange={(event) => updateProfile({ bio: event.target.value })} />
        <div className="dt-me-count">{(profile.bio || "").length}/500</div>
      </div>

      <div className="dt-sg">
        <div className="dt-sg-t">{tr("興趣", "Interests", "趣味", "관심사")}<span>{tags.length}/{MAX_TAGS}</span></div>
        <div className="dt-me-hint" style={{ marginBottom: 10 }}>{tr(
          "選到的標籤會影響配對成功率。有些人喜歡，也有些人不喜歡。",
          "Your tags affect your match rate. Some people love them, some don't.",
          "選んだタグはマッチ率に影響します。好きな人もいれば、苦手な人もいます。",
          "선택한 태그는 매칭 확률에 영향을 줘요. 좋아하는 사람도, 싫어하는 사람도 있어요.",
        )}</div>
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
