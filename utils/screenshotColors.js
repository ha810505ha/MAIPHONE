// Let the browser convert modern CSS colors into sRGB for html2canvas.
// Replace only color functions so gradient stops, shadows and URLs stay intact.
export function normalizeScreenshotColors(value, convertColor) {
  return replaceColors(String(value), convertColor);
}

export function normalizeScreenshotTree(root) {
  const document = root.ownerDocument;
  // Cloning restarts CSS entrance animations; freeze them before measuring the
  // capture or the PNG can inherit an in-between scale/opacity.
  for (let node = root; node; node = node.parentElement) {
    node.style.setProperty("animation", "none", "important");
    node.style.setProperty("transition", "none", "important");
  }
  for (const node of root.querySelectorAll("*")) {
    node.style.setProperty("animation", "none", "important");
    node.style.setProperty("transition", "none", "important");
  }
  const normalize = createScreenshotColorNormalizer(document);
  const properties = ["color", "background-color", "background-image", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "outline-color", "box-shadow", "text-shadow", "text-decoration-color", "-webkit-text-stroke-color"];
  const changes = [];
  const pseudoRules = [];
  // Read before writing: changing a parent's color must not change the child's
  // computed currentColor while we are taking the snapshot.
  [root, ...root.querySelectorAll("*")].forEach((node, index) => {
    for (const pseudo of [null, "::before", "::after"]) {
      const computed = document.defaultView.getComputedStyle(node, pseudo);
      if (pseudo && (!computed.content || ["none", "normal"].includes(computed.content))) continue;
      const declarations = [];
      for (const property of properties) {
        const value = computed.getPropertyValue(property);
        const safe = normalize(value);
        if (safe !== value) declarations.push([property, safe]);
      }
      if (!declarations.length) continue;
      if (pseudo) {
        node.setAttribute("data-capture-color-id", String(index));
        pseudoRules.push(`[data-capture-color-id="${index}"]${pseudo}{${declarations.map(([key, value]) => `${key}:${value}!important;`).join("")}}`);
      } else changes.push([node, declarations]);
    }
  });
  for (const [node, declarations] of changes) {
    for (const [key, value] of declarations) node.style.setProperty(key, value, "important");
  }
  if (pseudoRules.length) {
    const style = document.createElement("style");
    style.textContent = pseudoRules.join("\n");
    document.head.appendChild(style);
  }
}

function replaceColors(value, convertColor) {
  const pattern = /url\((?:[^)"']|"[^"]*"|'[^']*')*\)|\b(?:oklab|oklch|lab|lch|color|color-mix)\(/gi;
  let result = "", cursor = 0, match;
  while ((match = pattern.exec(value))) {
    if (/^url\(/i.test(match[0])) continue;
    let end = pattern.lastIndex, depth = 1;
    while (end < value.length && depth) {
      if (value[end] === "(") depth += 1;
      if (value[end] === ")") depth -= 1;
      end += 1;
    }
    if (depth) break;
    result += value.slice(cursor, match.index) + convertColor(value.slice(match.index, end));
    cursor = end;
    pattern.lastIndex = end;
  }
  return result + value.slice(cursor);
}

export function createScreenshotColorNormalizer(document) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const cache = new Map();
  return (value) => normalizeScreenshotColors(value, (color) => {
    if (!cache.has(color)) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      cache.set(color, `rgba(${r},${g},${b},${a / 255})`);
    }
    return cache.get(color);
  });
}
