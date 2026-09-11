import assert from "node:assert/strict";
import { formatResourceNumber as format } from "../yunyin/ui/resourceNumber.js";

assert.equal(format(31100, "zh-TW", true), "3.11萬");
assert.equal(format(123000000, "zh-TW", true), "1.23億");
for (const locale of ["zh-TW", "zh-CN", "en", "ja", "ko"]) {
  for (const amount of [0, 9999, 10000, 99999, 1e8, Number.MAX_SAFE_INTEGER]) {
    assert.equal(format(amount, locale), amount.toLocaleString(locale));
    assert.ok(format(amount, locale, true).length <= 8);
    assert.ok(!format(amount, locale, true).includes("…"));
  }
  for (const invalid of [-5, undefined, NaN, Infinity]) assert.equal(format(invalid, locale), "0");
}
console.log("Yunyin resource number tests passed");
