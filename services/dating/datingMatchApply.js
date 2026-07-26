/**
 * 「加入聯絡人」＝把交友檔案匯入真正的角色系統。
 *
 * 配對成功時刻意不建角色：characters 有三十幾個消費端（聯絡人、聊天列表、社群、
 * 群組成員、錢包⋯），靠旗標到處過濾遲早會漏。根本不建立才不會穿幫，
 * 也讓這個節點變成真的發生了一件事——這個人從此出現在你的手機裡。
 *
 * 交友 App 那條對話會保留而且還能繼續聊，但兩邊從此各走各的。
 * 搬一份歷史過來當起點，否則剛加好友的第一句會像失憶。
 */
export function promoteDatingContact({ entry, messages, addCharacter, setChatHistory, createId }) {
  const created = addCharacter({
    ...entry.character,
    avatar: entry.character.avatar || entry.profile.photos?.[0] || "",
    datingProfileId: entry.id,
  }, { silent: true });
  if (!created?.id) return null;

  const migrated = (messages || []).map((message) => ({
    id: createId(),
    role: message.role,
    content: message.content,
    time: message.time,
    fromDating: true,
  }));
  if (migrated.length) setChatHistory((history) => ({ ...history, [created.id]: migrated }));
  return created.id;
}
