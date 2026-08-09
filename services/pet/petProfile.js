export const PERSONALITY_IDS = Object.freeze(["clingy", "lively", "foodie", "lazy", "shy", "gentle", "mischievous"]);
export const GENDER_IDS = Object.freeze(["unspecified", "male", "female"]);

const LEGACY_PERSONALITIES = {
  黏人: "clingy", 活潑: "lively", 貪吃: "foodie", 慵懶: "lazy", 害羞: "shy", 溫柔: "gentle", 調皮: "mischievous",
};
const LEGACY_GENDERS = { 未設定: "unspecified", 男生: "male", 女生: "female" };
const PERSONALITY_LEGACY_NAMES = Object.fromEntries(Object.entries(LEGACY_PERSONALITIES).map(([label, id]) => [id, label]));
const GENDER_LEGACY_NAMES = Object.fromEntries(Object.entries(LEGACY_GENDERS).map(([label, id]) => [id, label]));

export function normalizePetProfile(profile = {}) {
  const primaryPersonality = LEGACY_PERSONALITIES[profile.primaryPersonality] || (PERSONALITY_IDS.includes(profile.primaryPersonality) ? profile.primaryPersonality : "clingy");
  const gender = LEGACY_GENDERS[profile.gender] || (GENDER_IDS.includes(profile.gender) ? profile.gender : "unspecified");
  return { ...profile, primaryPersonality, gender };
}

export const legacyPersonalityName = (value) => PERSONALITY_LEGACY_NAMES[value] || value || "黏人";
export const legacyGenderName = (value) => GENDER_LEGACY_NAMES[value] || value || "未設定";
