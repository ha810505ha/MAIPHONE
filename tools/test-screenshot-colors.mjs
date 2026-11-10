import assert from "node:assert/strict";
import { normalizeScreenshotColors } from "../utils/screenshotColors.js";

const seen = [];
const convert = color => { seen.push(color); return "rgba(10,20,30,0.5)"; };
assert.equal(normalizeScreenshotColors("linear-gradient(90deg,oklab(.5 .1 .1) 0%,color(display-p3 1 0 0) 100%)", convert), "linear-gradient(90deg,rgba(10,20,30,0.5) 0%,rgba(10,20,30,0.5) 100%)");
assert.equal(seen.length, 2);
seen.length = 0;
assert.equal(normalizeScreenshotColors("0 2px 8px color-mix(in srgb, rgb(10,20,30) 40%, oklch(.6 .2 150))", convert), "0 2px 8px rgba(10,20,30,0.5)");
assert.equal(seen.length, 1, "nested color functions must convert as one color");
const image = 'url("data:image/svg+xml,<svg fill=\'oklab(.5 .1 .1)\'></svg>")';
assert.equal(normalizeScreenshotColors(image, convert), image, "background images must remain untouched");
assert.equal(normalizeScreenshotColors("linear-gradient(90deg,#abc,rgba(1,2,3,.4))", convert), "linear-gradient(90deg,#abc,rgba(1,2,3,.4))");
assert.equal(normalizeScreenshotColors("", convert), "");
console.log("screenshot color conversion tests passed");
