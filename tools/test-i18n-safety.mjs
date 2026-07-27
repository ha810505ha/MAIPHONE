import assert from "node:assert/strict";
import { getChangelog } from "../constants/changelog.js";
import { UI_TEXT } from "../constants/uiText.js";
import {
  loadSimplifiedChineseConverter,
  normalizeUiLanguage,
  SUPPORTED_UI_LANGUAGES,
  toSimplifiedChinese,
  translate,
} from "../utils/i18n.js";

await loadSimplifiedChineseConverter();

assert.ok(SUPPORTED_UI_LANGUAGES.includes("zh-CN"), "zh-CN must be a supported UI language");
assert.equal(normalizeUiLanguage("zh-CN"), "zh-CN");
assert.equal(normalizeUiLanguage("unknown"), "zh-TW");

assert.equal(
  toSimplifiedChinese("使用者可以重新整理、儲存設定與匯出資料"),
  "用户可以刷新、保存设置与导出数据",
);
assert.equal(toSimplifiedChinese("目前帳號使用系統信箱"), "当前账号使用系统邮箱");

assert.equal(
  translate("zh-CN", "儲存設定", "Save settings", "設定を保存", "설정 저장"),
  "保存设置",
);
assert.equal(
  translate("zh-CN", "預設文字", "Default", "既定", "기본", "简中覆写"),
  "简中覆写",
);
assert.equal(
  translate("zh-CN", { "zh-TW": "聯絡人", "zh-CN": "联系人（覆写）", en: "Contacts" }),
  "联系人（覆写）",
);

assert.equal(UI_TEXT["zh-CN"].settings, "设置");
assert.equal(UI_TEXT["zh-CN"].refresh, "刷新");
assert.equal(UI_TEXT["zh-TW"].generate, "生成");
assert.equal(UI_TEXT["zh-TW"].backToList, "返回列表");

const simplifiedChangelog = getChangelog("1.2.6", "zh-CN");
assert.ok(simplifiedChangelog.length > 0);
assert.ok(simplifiedChangelog.some((line) => line.includes("聊天室")));
assert.ok(simplifiedChangelog.some((line) => line.includes("系统邮箱")));

console.log("ok: zh-CN conversion, overrides, UI text, and changelog fallback stay connected");
