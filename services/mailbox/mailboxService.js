import { SYSTEM_MAILS } from "../../data/systemMails";
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
export { countUnreadMails } from "../../utils/mailboxUnread";

const MAILBOX_KEY = "ent_systemMailbox";
export const MAILBOX_CHANGED_EVENT = "maliphone:mailbox-changed";
const EMPTY_STATE = Object.freeze({ readMailIds: [], claimedGrantIds: [] });
const MAIL_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

const normalizeState = (value) => ({
  readMailIds: Array.isArray(value?.readMailIds) ? [...new Set(value.readMailIds.map(String))] : [],
  claimedGrantIds: Array.isArray(value?.claimedGrantIds) ? [...new Set(value.claimedGrantIds.map(String))] : [],
});

export async function loadMailbox(locale = "zh-TW") {
  const state = normalizeState(await loadFeatureEntity(MAILBOX_KEY, EMPTY_STATE));
  const now = Date.now();
  const mails = SYSTEM_MAILS
    .map((mail) => {
      const translation = mail.translations?.[locale];
      const attachments = (mail.attachments || []).map((item, index) => ({
        ...item,
        label: translation?.attachments?.[index]?.label || item.label,
      }));
      const createdAt = new Date(mail.createdAt).getTime();
      const expiresAt = mail.expiresAt
        ? new Date(mail.expiresAt).getTime()
        : createdAt + MAIL_RETENTION_MS;
      return {
        ...mail,
        ...(translation ? {
          sender: translation.sender || mail.sender,
          title: translation.title || mail.title,
          content: translation.content || mail.content,
        } : {}),
        attachments,
        expiresAt: new Date(expiresAt).toISOString(),
        expiresAtMs: expiresAt,
      };
    })
    .filter((mail) => Number.isFinite(mail.expiresAtMs) && mail.expiresAtMs > now)
    .map(({ expiresAtMs, ...mail }) => ({
      ...mail,
      read: state.readMailIds.includes(mail.id),
      claimed: (mail.attachments || []).every((item) => state.claimedGrantIds.includes(item.grantId)),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { state, mails };
}

export async function markMailRead(mailId) {
  const state = normalizeState(await loadFeatureEntity(MAILBOX_KEY, EMPTY_STATE));
  if (!state.readMailIds.includes(mailId)) state.readMailIds.push(mailId);
  await saveFeatureEntity(MAILBOX_KEY, state);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MAILBOX_CHANGED_EVENT));
  return state;
}

export async function claimMailAttachments(mailId) {
  const mail = SYSTEM_MAILS.find((item) => item.id === mailId);
  if (!mail) throw new Error("找不到這封系統信件");
  const createdAt = new Date(mail.createdAt).getTime();
  const expiresAt = mail.expiresAt ? new Date(mail.expiresAt).getTime() : createdAt + MAIL_RETENTION_MS;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error("這封系統信件已到期");
  const state = normalizeState(await loadFeatureEntity(MAILBOX_KEY, EMPTY_STATE));
  const grants = (mail.attachments || []).filter((item) => !state.claimedGrantIds.includes(item.grantId));
  if (!grants.length) return [];
  state.claimedGrantIds.push(...grants.map((item) => item.grantId));
  if (!state.readMailIds.includes(mailId)) state.readMailIds.push(mailId);
  await saveFeatureEntity(MAILBOX_KEY, normalizeState(state));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MAILBOX_CHANGED_EVENT));
  return grants;
}
