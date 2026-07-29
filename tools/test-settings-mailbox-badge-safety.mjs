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

assert(settings.includes('{ id: "data", label: t("data"), unread: mailboxUnreadCount > 0 }'), "the Data tab must derive its dot from mailbox unread state");
assert(settings.includes('data-settings-mailbox-dot="1"'), "the Data tab must render a stable unread-dot marker");
assert(settings.includes("有未讀信件"), "the unread Data tab must remain accessible to screen readers");
assert(mailbox.includes("countUnreadMails(mails)"), "the mailbox card and Data tab must share one unread-count rule");
assert(settingsSurface.includes("mailboxUnreadCount={countUnreadMails(mailboxMails)}"), "the settings tabs must receive live mailbox state");
assert(app.includes("mailboxMails={mailboxMails}"), "the settings surface must receive live mailbox state");
assert(app.includes("window.addEventListener(MAILBOX_CHANGED_EVENT, refreshMailbox)"), "reading a mail must refresh the Data-tab dot immediately");

console.log("ok: Settings Data tab follows the live system-mailbox unread state");
