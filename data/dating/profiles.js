/**
 * 信風的內建角色池，對外唯一入口。
 *
 * 每筆資料刻意分成兩個身份：
 *   profile.name   — 信風上顯示的網名／暱稱，配對期間只認這個名字。
 *   character.name — 交換聯絡方式後建立角色卡時使用的本名。
 *
 * profile 是陌生人看得到的交友門面；character 是加入聯絡人後才解鎖的
 * 完整角色卡。信風聊天只讀公開資料與 character.personality 的淺層互動
 * 特質，不應提前洩漏本名、背景秘密或後期關係劇情。
 */
import { LOCAL_ONE_PROFILES } from "./profileGroups/localOne.js";
import { LOCAL_TWO_PROFILES } from "./profileGroups/localTwo.js";
import { INTERNATIONAL_PROFILES } from "./profileGroups/international.js";

/**
 * 信風只是一張公開展示板；這個 id 才是角色在小手機裡的永久身份。
 * 解鎖前角色卡留在內建 registry，解鎖後以同一 id 出現在聯絡人中。
 */
export const getDatingCharacterId = (profileId) => `dating-${String(profileId || "").trim()}`;

const attachCanonicalCharacterIdentity = (entry) => {
  const characterId = getDatingCharacterId(entry.id);
  return Object.freeze({
    ...entry,
    characterId,
    character: Object.freeze({
      ...entry.character,
      id: characterId,
      datingProfileId: entry.id,
    }),
  });
};

export const DATING_PROFILES = Object.freeze([
  ...LOCAL_ONE_PROFILES,
  ...LOCAL_TWO_PROFILES,
  ...INTERNATIONAL_PROFILES,
].map(attachCanonicalCharacterIdentity));
