// A*：4 方向、曼哈頓 heuristic。回傳不含起點的 [{x,y}...]；無路可走回傳 null。
export function astar(sx, sy, tx, ty, w, h, isBlocked) {
  if (sx === tx && sy === ty) return [];
  if (tx < 0 || ty < 0 || tx >= w || ty >= h || isBlocked(tx, ty)) return null;
  const key = (x, y) => y * w + x;
  const open = [{ x: sx, y: sy, g: 0, f: Math.abs(tx - sx) + Math.abs(ty - sy) }];
  const came = new Map();
  const gScore = new Map([[key(sx, sy), 0]]);
  const closed = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.x === tx && cur.y === ty) {
      const path = [];
      let k = ck;
      while (came.has(k)) { path.push({ x: k % w, y: Math.floor(k / w) }); k = came.get(k); }
      return path.reverse();
    }
    if (closed.has(ck)) continue;
    closed.add(ck);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || isBlocked(nx, ny)) continue;
      const nk = key(nx, ny), ng = cur.g + 1;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        came.set(nk, ck);
        open.push({ x: nx, y: ny, g: ng, f: ng + Math.abs(tx - nx) + Math.abs(ty - ny) });
      }
    }
  }
  return null;
}

// 目標格不可走時，找它四周最近的可走格（給「點建築/點水邊」用）
export function nearestWalkable(tx, ty, w, h, isBlocked) {
  if (tx >= 0 && ty >= 0 && tx < w && ty < h && !isBlocked(tx, ty)) return { x: tx, y: ty };
  for (let r = 1; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && !isBlocked(nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return null;
}
