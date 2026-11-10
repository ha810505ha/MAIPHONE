import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { countUnreadMails } from "../utils/mailboxUnread.js";

assert.equal(countUnreadMails(null), 0);
assert.equal(countUnreadMails([]), 0);
assert.equal(countUnreadMails([{ id: "read", read: true }, { id: "unread", read: false }, { id: "legacy" }]), 2);

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [settings, mailbox, settingsSurface, app] = await Promise.all([
  source("components/settings/SettingsApp.jsx"),
  source("components/settings/SystemMailboxSettings.jsx"),
  source("components/settings/MaliPhoneSettingsSurface.jsx"),
  source("MaliPhone.jsx"),
]);

// MP-012：信箱固定在設定頁分頁上方（任何分頁都看得到未讀數），不再藏在「資料」分頁。
const mailboxAt = settings.indexOf("<SystemMailboxSettings");
assert(mailboxAt > 0 && mailboxAt < settings.indexOf("<SegmentedControl"), "the mailbox card must sit above the settings tabs");
assert(settings.includes("refreshKey={mailboxUnreadCount}"), "the mailbox card must refresh when the live unread count changes");
assert(mailbox.includes("[locale, refreshKey]"), "the mailbox card must reload mail when refreshKey changes");
assert(mailbox.includes("countUnreadMails(mails)"), "the mailbox card must use the shared unread-count rule");
assert(settingsSurface.includes("mailboxUnreadCount={countUnreadMails(mailboxMails)}"), "the settings page must receive live mailbox state");
assert(app.includes("mailboxMails={mailboxMails}"), "the settings surface must receive live mailbox state");
assert(app.includes("window.addEventListener(MAILBOX_CHANGED_EVENT, refreshMailbox)"), "reading a mail must refresh the unread count immediately");

console.log("ok: Settings mailbox card follows the live system-mailbox unread state");
