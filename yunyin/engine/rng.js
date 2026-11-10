// 種子亂數：hash(seed + salt) → 確定性 [0,1)。秘境擲骰、NPC 外觀生成共用。
export function hashStr(s) {
  let h = 1779033703;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function mulberry32(a) {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// 單發：同一 seed+salt 永遠同一個值
export const roll = (seed, salt) => mulberry32(hashStr(`${seed}:${salt}`));

// 連發：從 seed 建一個可連續取值的產生器
export const rngOf = (seed) => {
  let state = hashStr(seed);
  return () => { state = (state + 0x6D2B79F5) | 0; return mulberry32(state); };
};
