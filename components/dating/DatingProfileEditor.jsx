import React, { useRef, useState } from "react";
import { categoryLabel, INTEREST_CATEGORIES, tagLabel, tagsByCategory } from "../../data/dating/interestTags";
import { DATING_NICKNAME_MAX } from "../../constants/dating";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import EmptyState from "../common/EmptyState";
import Icon from "../common/Icon";
import ProfileCard from "./ProfileCard";

const MAX_PHOTOS = 6;
const MAX_TAGS = 12;
const MAX_EDGE = 720;
const BIO_MAX = 500;
// 自介少於這個字數時提示再多寫一點：配對後的 AI 開場白會參考自介，太短很難開口。
const BIO_SUGGESTED_MIN = 30;
// 暱稱剩這麼多字可打時，計數變色提醒。
const NICKNAME_WARN_REMAIN = 3;
// 分類小卡的圖示（Icon.jsx 既有名稱）。
const CATEGORY_ICON = { life: "sparkle", hobby: "book", sport: "refresh", food: "receipt", travel: "share", pet: "doll", personality: "users", values: "heart" };

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

/** 把第 index 張移到最前面：photos[0] 就是主照片（配對卡第一張、配對成功畫面用的那張）。 */
export function promotePhoto(photos, index) {
  if (!Array.isArray(photos) || index <= 0 || index >= photos.length) return photos;
  return [photos[index], ...photos.filter((_, i) => i !== index)];
}

export default function DatingProfileEditor({ profile, updateProfile, playerName, showToast, tr }) {
  const fileRef = useRef(null);
  // replaceRef 記住「更換」要覆蓋哪一張；null 代表新增。
  const replaceRef = useRef(null);
  const [openCategory, setOpenCategory] = useState(null);
  const [preview, setPreview] = useState(false);
  const tags = profile.tags || [];
  const photos = profile.photos || [];
  const name = profile.name || "";
  const bio = profile.bio || "";
  const displayName = name || playerName || tr("我", "Me", "わたし", "나");
  const nicknameRemain = DATING_NICKNAME_MAX - name.length;

  const pickPhotos = (replaceIndex = null) => {
    replaceRef.current = replaceIndex;
    fileRef.current?.click();
  };

  const onPick = async (event) => {
    const replaceIndex = replaceRef.current;
    replaceRef.current = null;
    const limit = replaceIndex === null ? MAX_PHOTOS - photos.length : 1;
    const files = [...(event.target.files || [])].slice(0, limit);
    event.target.value = "";
    if (!files.length) return;
    try {
      const next = (await Promise.all(files.map(downscale))).filter(Boolean);
      if (!next.length) return;
      if (replaceIndex !== null && photos[replaceIndex]) {
        updateProfile({ photos: photos.map((photo, i) => (i === replaceIndex ? next[0] : photo)) });
      } else {
        updateProfile({ photos: [...photos, ...next].slice(0, MAX_PHOTOS) });
      }
    } catch {
      showToast?.(tr("照片讀取失敗", "Couldn't read the photo", "写真を読み込めませんでした", "사진을 불러오지 못했어요"));
    }
  };

  const toggleTag = (id) => {
    if (tags.includes(id)) return updateProfile({ tags: tags.filter((tag) => tag !== id) });
    if (tags.length >= MAX_TAGS) return showToast?.(tr(`最多選 ${MAX_TAGS} 個`, `You can pick up to ${MAX_TAGS}`, `最大${MAX_TAGS}個まで選べます`, `최대 ${MAX_TAGS}개까지 선택할 수 있어요`));
    return updateProfile({ tags: [...tags, id] });
  };
  const countInCategory = (categoryId) => tagsByCategory(categoryId).filter((tag) => tags.includes(tag.id)).length;

  const addPhotoLabel = tr("新增照片", "Add photo", "写真を追加", "사진 추가");
  const previewEntry = {
    id: "me",
    profile: { name: displayName, age: "", job: tr("這是你", "This is you", "あなたです", "당신이에요"), distance: 0, photos, tags, bio },
  };

  return (
    <div className="dt-me">
      <div className="dt-me-head">
        <div className="dt-me-name">{displayName}</div>
        <div className="dt-me-hint">{tr(
          "這份資料只有信風用。配對到的人在聊天時會參考這裡，而不是玩家檔案。",
          "This profile is only for Tradewind. Your matches see this, not your player profile.",
          "このプロフィールは信風専用です。マッチした相手はプレイヤープロフィールではなく、ここを参考にします。",
          "이 프로필은 신풍 전용이에요. 매칭된 상대는 플레이어 프로필이 아니라 이곳을 참고해요.",
        )}</div>
      </div>

      {/* 1 照片：大圖＋縮圖列，photos[0] 永遠是主照片 */}
      <div className="dt-sg">
        <div className="dt-sg-t">{tr("照片", "Photos", "写真", "사진")}<span>{photos.length}/{MAX_PHOTOS}{photos.length > 1 ? tr("・點縮圖換主照片", " · Tap a thumbnail to set main", "・サムネイルでメインを変更", " · 썸네일을 눌러 대표 변경") : ""}</span></div>
        {photos.length ? (
          <div className="dt-me-hero">
            <img src={sanitizeUserImageUrl(photos[0]) || ""} alt="" />
            <span className="dt-me-hero-badge">{tr("主照片", "Main photo", "メイン写真", "대표 사진")}</span>
            <div className="dt-me-hero-act">
              <button type="button" onClick={() => updateProfile({ photos: photos.slice(1) })}>{tr("刪除", "Remove", "削除", "삭제")}</button>
              <button type="button" onClick={() => pickPhotos(0)}>{tr("更換", "Replace", "変更", "변경")}</button>
            </div>
          </div>
        ) : (
          <EmptyState compact icon="camera"
            title={tr("還沒有照片", "No photos yet", "まだ写真がありません", "아직 사진이 없어요")}
            text={tr("至少放一張，配對率會差很多。", "Add at least one. It changes your match rate a lot.", "1枚でも入れるとマッチ率が大きく変わります。", "한 장이라도 올리면 매칭률이 크게 달라져요.")}
            actionLabel={addPhotoLabel} onAction={() => pickPhotos()} />
        )}
        {photos.length > 0 && (
          <div className="dt-me-thumbs">
            {photos.map((photo, index) => (
              <button key={index} type="button" className={`dt-me-thumb ${index === 0 ? "on" : ""}`}
                onClick={() => index > 0 && updateProfile({ photos: promotePhoto(photos, index) })}
                aria-label={tr(`第 ${index + 1} 張，設為主照片`, `Photo ${index + 1}, set as main`, `${index + 1}枚目をメインにする`, `${index + 1}번째 사진을 대표로`)}
                aria-pressed={index === 0}>
                <img src={sanitizeUserImageUrl(photo) || ""} alt="" />
              </button>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" className="dt-me-thumb add" onClick={() => pickPhotos()} aria-label={addPhotoLabel}><Icon name="plus" size={18} /></button>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
      </div>

      {/* 2 暱稱：信風專用，可與玩家名不同 */}
      <div className="dt-sg">
        <div className="dt-sg-t">{tr("暱稱", "Nickname", "ニックネーム", "닉네임")}<span>{tr("配對對象看到的名字", "What your matches see", "マッチ相手に表示される名前", "매칭 상대에게 보이는 이름")}</span></div>
        <input className="dt-me-input" type="text" maxLength={DATING_NICKNAME_MAX} value={name}
          placeholder={playerName || tr("想被怎麼叫", "What should they call you?", "なんて呼ばれたい？", "어떻게 불리고 싶나요?")}
          onChange={(event) => updateProfile({ name: event.target.value.slice(0, DATING_NICKNAME_MAX) })} />
        <div className={`dt-me-meter ${nicknameRemain <= NICKNAME_WARN_REMAIN ? "warn" : ""}`}>
          <span>{nicknameRemain <= NICKNAME_WARN_REMAIN
            ? tr("快到上限了", "Almost at the limit", "もうすぐ上限です", "거의 다 찼어요")
            : tr("留空就用玩家名稱", "Leave blank to use your player name", "空欄ならプレイヤー名を使います", "비워 두면 플레이어 이름을 써요")}</span>
          <span>{name.length}/{DATING_NICKNAME_MAX}</span>
        </div>
      </div>

      {/* 3 自介 */}
      <div className="dt-sg">
        <div className="dt-sg-t">{tr("自我介紹", "About me", "自己紹介", "자기소개")}<span>{tr("寫給人看的，不是設定表", "Write for people, not a character sheet", "設定表ではなく人に向けて", "설정표가 아니라 사람에게")}</span></div>
        <textarea className="dt-me-bio" maxLength={BIO_MAX} value={bio} placeholder={tr(
          "例如：假日大多在山上，平日大多在睡覺。",
          "E.g. Weekends in the mountains, weekdays mostly asleep.",
          "例：休日はだいたい山、平日はだいたい寝ています。",
          "예: 주말엔 대부분 산에, 평일엔 대부분 자고 있어요.",
        )}
          onChange={(event) => updateProfile({ bio: event.target.value })} />
        <div className="dt-me-meter">
          <span>{bio.length < BIO_SUGGESTED_MIN
            ? tr(`再多寫一點，${BIO_SUGGESTED_MIN} 字以上配對更容易開口`, `A bit more: ${BIO_SUGGESTED_MIN}+ characters makes it easier for matches to say hi`, `もう少し：${BIO_SUGGESTED_MIN}文字以上だと相手が話しかけやすくなります`, `조금 더: ${BIO_SUGGESTED_MIN}자 이상이면 상대가 말 걸기 쉬워요`)
            : tr("剛剛好", "Just right", "ちょうどいい", "딱 좋아요")}</span>
          <span>{bio.length}/{BIO_MAX}</span>
        </div>
      </div>

      {/* 4 興趣：已選列＋分類卡收合展開 */}
      <div className="dt-sg">
        <div className="dt-sg-t">{tr("興趣", "Interests", "趣味", "관심사")}<span>{tags.length}/{MAX_TAGS}</span></div>
        {tags.length ? (
          <div className="dt-me-picked">
            {tags.map((id) => (
              <button key={id} type="button" className="mp-chip active" onClick={() => toggleTag(id)}
                aria-label={tr(`移除 ${tagLabel(id, tr)}`, `Remove ${tagLabel(id, tr)}`, `${tagLabel(id, tr)}を外す`, `${tagLabel(id, tr)} 제거`)}>
                {tagLabel(id, tr)}<i aria-hidden="true">×</i>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState compact icon="sparkle"
            title={tr("還沒選興趣", "No interests yet", "まだ趣味を選んでいません", "아직 관심사를 고르지 않았어요")}
            text={tr("點下面的分類挑幾個，配對會看這裡。", "Pick a few from the categories below. Matching looks here.", "下のカテゴリからいくつか選んでください。マッチングはここを見ます。", "아래 분류에서 몇 개 골라 보세요. 매칭은 여기를 봐요.")} />
        )}
        <div className="dt-me-cats">
          {INTEREST_CATEGORIES.map((category) => {
            const picked = countInCategory(category.id);
            const open = openCategory === category.id;
            return (
              <button key={category.id} type="button" className={`dt-me-cat ${open ? "open" : ""}`} aria-expanded={open}
                onClick={() => setOpenCategory(open ? null : category.id)}>
                <span className="dt-me-cat-ic"><Icon name={CATEGORY_ICON[category.id] || "sparkle"} size={16} /></span>
                <span className="dt-me-cat-body">
                  <span className="dt-me-cat-t">{categoryLabel(category.id, tr)}</span>
                  <span className={`dt-me-cat-n ${picked ? "has" : ""}`}>{picked
                    ? tr(`已選 ${picked}`, `${picked} picked`, `${picked}個選択中`, `${picked}개 선택`)
                    : tr(`${tagsByCategory(category.id).length} 個標籤`, `${tagsByCategory(category.id).length} tags`, `${tagsByCategory(category.id).length}個のタグ`, `태그 ${tagsByCategory(category.id).length}개`)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {openCategory && (
          <div className="dt-me-panel">
            <div className="dt-me-panel-t">
              <span>{categoryLabel(openCategory, tr)}{tr("・點選加入", " · Tap to add", "・タップで追加", " · 눌러서 추가")}</span>
              <button type="button" onClick={() => setOpenCategory(null)}>{tr("收起", "Collapse", "閉じる", "접기")}</button>
            </div>
            <div className="dt-me-panel-tags">
              {tagsByCategory(openCategory).map((tag) => (
                <button key={tag.id} type="button" className={`mp-chip ${tags.includes(tag.id) ? "active" : ""}`} aria-pressed={tags.includes(tag.id)} onClick={() => toggleTag(tag.id)}>{tagLabel(tag.id, tr)}</button>
              ))}
            </div>
            {tags.length >= MAX_TAGS && <div className="dt-me-hint">{tr(`已經選滿 ${MAX_TAGS} 個，先拿掉一個再加。`, `You've picked ${MAX_TAGS}. Remove one to add another.`, `${MAX_TAGS}個選び終えています。1つ外してから追加してください。`, `${MAX_TAGS}개를 모두 골랐어요. 하나 빼고 추가하세요.`)}</div>}
          </div>
        )}
        <div className="dt-me-hint" style={{ marginTop: 8 }}>{tr(
          "選到的標籤會影響配對成功率。有些人喜歡，也有些人不喜歡。",
          "Your tags affect your match rate. Some people love them, some don't.",
          "選んだタグはマッチ率に影響します。好きな人もいれば、苦手な人もいます。",
          "선택한 태그는 매칭 확률에 영향을 줘요. 좋아하는 사람도, 싫어하는 사람도 있어요.",
        )}</div>
      </div>

      {/* 5 預覽別人看到的我：直接用正式 ProfileCard */}
      <button type="button" className="dt-btn" onClick={() => setPreview(true)}>{tr("預覽別人看到的我", "Preview how others see me", "相手から見た自分をプレビュー", "상대에게 보이는 나 미리보기")}</button>
      {preview && (
        <div className="dt-me-preview" onClick={() => setPreview(false)} role="dialog" aria-label={tr("預覽別人看到的我", "Preview how others see me", "相手から見た自分をプレビュー", "상대에게 보이는 나 미리보기")}>
          <div className="dt-me-preview-card" onClick={(event) => event.stopPropagation()}>
            <div className="dt-card">
              <ProfileCard entry={previewEntry} paused dragX={0} dragY={0} onOpenDetail={() => {}} tr={tr} />
            </div>
          </div>
          <button type="button" className="dt-btn ghost" onClick={() => setPreview(false)}>{tr("回到編輯", "Back to editing", "編集に戻る", "편집으로 돌아가기")}</button>
        </div>
      )}
    </div>
  );
}
