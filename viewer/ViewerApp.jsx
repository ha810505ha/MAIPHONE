import React, { useCallback, useEffect, useMemo, useState } from "react";
import { loadSimplifiedChineseConverter, normalizeUiLanguage, translate } from "../utils/i18n.js";
import { readBackupForViewing } from "../utils/backupInspect.js";
import { buildViewModel, imageSrcOf, messageBody, messageTime } from "./viewModel.js";

const WIDE_QUERY = "(min-width: 820px)";
const PAGE_SIZE = 200;

const detectLanguage = () => {
  const lang = String(globalThis.navigator?.language || "").toLowerCase();
  if (lang.startsWith("zh")) return /cn|hans|sg/.test(lang) ? "zh-CN" : "zh-TW";
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("ko")) return "ko";
  if (lang.startsWith("en")) return "en";
  return "zh-TW";
};

const formatDateTime = (time) => {
  if (!time) return "";
  try { return new Date(time).toLocaleString(undefined, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
};
const formatShort = (time) => {
  if (!time) return "";
  try { return new Date(time).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
};
const formatDay = (time) => {
  try { return new Date(time).toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric", weekday: "short" }); } catch { return ""; }
};

function useWideScreen() {
  const [wide, setWide] = useState(() => globalThis.matchMedia?.(WIDE_QUERY).matches ?? false);
  useEffect(() => {
    const query = globalThis.matchMedia?.(WIDE_QUERY);
    if (!query) return undefined;
    const update = () => setWide(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return wide;
}

const Avatar = ({ src, name }) => (src ? <img className="v-av" src={src} alt="" /> : <div className="v-av" aria-hidden="true">{String(name || "?").slice(0, 1)}</div>);

function MessageList({ messages, playerName, tr, group = false }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const sorted = useMemo(() => [...messages].sort((a, b) => messageTime(a) - messageTime(b)), [messages]);
  const visible = sorted.slice(Math.max(0, sorted.length - shown));
  let lastDay = "";
  return (
    <div className="v-msgs">
      {sorted.length > shown && (
        <button type="button" className="v-link v-more" onClick={() => setShown((count) => count + PAGE_SIZE)}>
          {tr(`顯示更早的訊息（還有 ${sorted.length - shown} 則）`, `Show earlier messages (${sorted.length - shown} more)`, `以前のメッセージを表示（残り ${sorted.length - shown} 件）`, `이전 메시지 보기 (${sorted.length - shown}개 더)`)}
        </button>
      )}
      {visible.map((message, index) => {
        const time = messageTime(message);
        const day = time ? formatDay(time) : "";
        const dayLine = day && day !== lastDay ? <div className="v-day">{day}</div> : null;
        if (day) lastDay = day;
        const body = messageBody(message, tr);
        const key = message?.id || `${time}-${index}`;
        if (message?.role === "system_notice" || message?.role === "system") {
          return <React.Fragment key={key}>{dayLine}<div className="v-note">{body}</div></React.Fragment>;
        }
        const mine = message?.role === "user";
        const image = imageSrcOf(message?.image, message?.imageMime);
        const speaker = group && !mine ? message?.speakerName || message?.name : "";
        return (
          <React.Fragment key={key}>
            {dayLine}
            <div className={`v-b ${mine ? "me" : "ai"}`}>
              {speaker && <span className="who">{speaker}</span>}
              {image && <img src={image} alt="" />}
              {body || (!image ? tr("（空白訊息）", "(Empty message)", "（空のメッセージ）", "(빈 메시지)") : "")}
              {time ? <span className="tm">{new Date(time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span> : null}
            </div>
          </React.Fragment>
        );
      })}
      {!sorted.length && <div className="v-empty">{tr("沒有訊息", "No messages", "メッセージはありません", "메시지가 없습니다")}</div>}
    </div>
  );
}

// 各 App 的定義：有清單的（hasList）先選一筆再看內容；其餘直接顯示內容。
const SECTIONS = [
  { key: "chats", icon: "💬", hasList: true, label: (tr) => tr("聊天", "Chats", "チャット", "채팅") },
  { key: "groups", icon: "👥", hasList: true, label: (tr) => tr("群組", "Groups", "グループ", "그룹") },
  { key: "social", icon: "📷", hasList: false, label: (tr) => tr("社群", "Social", "SNS", "소셜") },
  { key: "contacts", icon: "📇", hasList: true, label: (tr) => tr("聯絡人", "Contacts", "連絡先", "연락처") },
  { key: "notes", icon: "📒", hasList: true, label: (tr) => tr("筆記", "Notes", "ノート", "노트") },
  { key: "lorebooks", icon: "📚", hasList: true, label: (tr) => tr("世界書", "Lorebooks", "ワールドブック", "월드북") },
  { key: "memories", icon: "🧠", hasList: true, label: (tr) => tr("記憶", "Memories", "記憶", "기억") },
  { key: "wallet", icon: "💰", hasList: false, label: (tr) => tr("錢包", "Wallet", "ウォレット", "지갑") },
  { key: "calendar", icon: "📅", hasList: false, label: (tr) => tr("日曆", "Calendar", "カレンダー", "캘린더") },
  { key: "yunyin", icon: "🏯", hasList: false, label: (tr) => tr("雲隱山莊", "Yunyin Villa", "雲隠山荘", "운은산장") },
];

const sectionCount = (model, key) => {
  if (!model) return 0;
  if (key === "chats") return model.chats.length;
  if (key === "groups") return model.groups.length;
  if (key === "social") return model.posts.length;
  if (key === "contacts") return model.contacts.length;
  if (key === "notes") return model.notes.length;
  if (key === "lorebooks") return model.lorebooks.length;
  if (key === "memories") return model.memories.length;
  if (key === "wallet") return model.wallet ? 1 : 0;
  if (key === "calendar") return model.calendarEvents.length;
  if (key === "yunyin") return model.yunyin ? 1 : 0;
  return 0;
};

function listItems(model, key, tr) {
  if (key === "chats") return model.chats.map((chat) => ({ id: chat.id, title: chat.name, sub: chat.lastText, time: chat.lastAt, avatar: chat.avatar }));
  if (key === "groups") return model.groups.map((group) => ({ id: group.id, title: group.name, sub: group.lastText, time: group.lastAt }));
  if (key === "contacts") return model.contacts.map((contact) => ({ id: contact.id, title: contact.name, sub: contact.status || contact.profile.slice(0, 40), avatar: contact.avatar }));
  if (key === "notes") return model.notes.map((note) => ({ id: note.id, title: note.title, sub: note.content.replace(/\s+/g, " ").slice(0, 50), time: note.time }));
  if (key === "lorebooks") return model.lorebooks.map((book) => ({ id: book.id, title: book.name, sub: tr(`${book.entries.length} 個條目`, `${book.entries.length} entries`, `${book.entries.length} 件`, `${book.entries.length}개 항목`) }));
  if (key === "memories") return model.memories.map((entry) => ({ id: entry.id, title: entry.name, sub: tr(`${entry.items.length} 則記憶`, `${entry.items.length} memories`, `記憶 ${entry.items.length} 件`, `기억 ${entry.items.length}개`), avatar: entry.avatar }));
  return [];
}

function ItemList({ items, selectedId, onSelect, tr }) {
  if (!items.length) return <div className="v-empty">{tr("這個檔案裡沒有資料", "Nothing in this file", "このファイルにはデータがありません", "이 파일에 데이터가 없습니다")}</div>;
  return (
    <div className="v-list">
      {items.map((item) => (
        <button type="button" key={item.id} className={`v-item ${item.id === selectedId ? "on" : ""}`} onClick={() => onSelect(item.id)}>
          {item.avatar !== undefined && <Avatar src={item.avatar} name={item.title} />}
          <div><div className="n">{item.title}</div>{item.sub && <div className="p">{item.sub}</div>}</div>
          {item.time ? <div className="t">{formatShort(item.time)}</div> : null}
        </button>
      ))}
    </div>
  );
}

function ChatDetail({ chat, model, tr }) {
  const [roomId, setRoomId] = useState(chat.rooms[0]?.id);
  useEffect(() => { setRoomId(chat.rooms[0]?.id); }, [chat]);
  const room = chat.rooms.find((item) => item.id === roomId) || chat.rooms[0];
  return (
    <>
      {chat.rooms.length > 1 && (
        <div className="v-rooms">
          {chat.rooms.map((item) => <button type="button" key={item.id} className={`v-room ${item.id === room?.id ? "on" : ""}`} onClick={() => setRoomId(item.id)}>{item.title} · {item.messages.length}</button>)}
        </div>
      )}
      {room && <MessageList key={room.id} messages={room.messages} playerName={model.playerName} tr={tr} />}
    </>
  );
}

function SectionDetail({ model, sectionKey, itemId, tr }) {
  if (sectionKey === "chats") {
    const chat = model.chats.find((item) => item.id === itemId);
    return chat ? <ChatDetail chat={chat} model={model} tr={tr} /> : null;
  }
  if (sectionKey === "groups") {
    const group = model.groups.find((item) => item.id === itemId);
    return group ? <MessageList messages={group.messages} playerName={model.playerName} tr={tr} group /> : null;
  }
  if (sectionKey === "contacts") {
    const contact = model.contacts.find((item) => item.id === itemId);
    if (!contact) return null;
    return <div className="v-card"><h4>{contact.name}</h4>{contact.status && <div className="meta">{contact.status}</div>}<div className="body">{contact.profile || tr("沒有角色介紹", "No profile", "プロフィールなし", "프로필 없음")}</div></div>;
  }
  if (sectionKey === "notes") {
    const note = model.notes.find((item) => item.id === itemId);
    return note ? <div className="v-card"><h4>{note.title}</h4>{note.time ? <div className="meta">{formatDateTime(note.time)}</div> : null}<div className="body">{note.content}</div></div> : null;
  }
  if (sectionKey === "lorebooks") {
    const book = model.lorebooks.find((item) => item.id === itemId);
    if (!book) return null;
    return book.entries.length ? book.entries.map((entry, index) => (
      <div className="v-card" key={index}><h4>{entry.title || tr("（無標題）", "(Untitled)", "（無題）", "(제목 없음)")}</h4>{entry.keys.length ? <div className="meta">{entry.keys.join("、")}</div> : null}<div className="body">{entry.content}</div></div>
    )) : <div className="v-empty">{tr("沒有條目", "No entries", "項目はありません", "항목이 없습니다")}</div>;
  }
  if (sectionKey === "memories") {
    const entry = model.memories.find((item) => item.id === itemId);
    return entry ? entry.items.map((memory, index) => (
      <div className="v-card" key={index}>{memory.time ? <div className="meta">{formatDateTime(memory.time)}{memory.archived ? ` · ${tr("已封存", "Archived", "アーカイブ", "보관됨")}` : ""}</div> : null}<div className="body">{memory.text}</div></div>
    )) : null;
  }
  if (sectionKey === "social") {
    if (!model.posts.length) return <div className="v-empty">{tr("沒有貼文", "No posts", "投稿はありません", "게시물이 없습니다")}</div>;
    return model.posts.map((post) => (
      <div className="v-card" key={post.id}>
        <h4>{post.author}</h4>
        <div className="meta">{formatDateTime(post.time)}{post.likes ? ` · ♥ ${post.likes}` : ""}</div>
        {post.image && <img src={post.image} alt="" style={{ maxWidth: "100%", borderRadius: 10, marginTop: 6 }} />}
        <div className="body">{post.content}</div>
        {post.comments.length > 0 && <div className="sub">{post.comments.map((comment, index) => <div key={index}><b>{comment.author}</b>：{comment.content}</div>)}</div>}
      </div>
    ));
  }
  if (sectionKey === "wallet") {
    if (!model.wallet) return null;
    return (
      <>
        <div className="v-card"><div className="v-kv"><span>{tr("餘額", "Balance", "残高", "잔액")}</span><b>${model.wallet.balance.toLocaleString()}</b></div></div>
        {model.wallet.transactions.slice(0, 300).map((item, index) => (
          <div className="v-card" key={index}><div className="v-kv"><span>{item.label || tr("交易", "Transaction", "取引", "거래")}</span><b>{item.amount >= 0 ? "+" : ""}{item.amount.toLocaleString()}</b></div>{item.time ? <div className="meta">{formatDateTime(item.time)}</div> : null}</div>
        ))}
      </>
    );
  }
  if (sectionKey === "calendar") {
    if (!model.calendarEvents.length) return <div className="v-empty">{tr("沒有行程", "No events", "予定はありません", "일정이 없습니다")}</div>;
    return model.calendarEvents.map((event, index) => (
      <div className="v-card" key={index}><h4>{event.title}</h4><div className="meta">{[event.when, event.time, event.with].filter(Boolean).join(" · ")}</div>{event.note && <div className="body">{event.note}</div>}</div>
    ));
  }
  if (sectionKey === "yunyin") {
    const save = model.yunyin;
    if (!save) return null;
    return (
      <div className="v-card">
        <div className="v-kv"><span>{tr("靈石", "Spirit stones", "霊石", "영석")}</span><b>{save.coins.toLocaleString()}</b></div>
        <div className="v-kv"><span>{tr("境界階段", "Realm stage", "境地の段階", "경지 단계")}</span><b>{save.realm + 1}</b></div>
        <div className="v-kv"><span>{tr("靈田種植中", "Fields planted", "栽培中の畑", "재배 중인 밭")}</span><b>{save.planted} / {save.plots}</b></div>
        <div className="v-kv"><span>{tr("背包物品", "Items", "持ち物", "소지품")}</span><b>{save.items.toLocaleString()}</b></div>
        {save.createdAt ? <div className="v-kv"><span>{tr("開始遊玩", "Started", "開始日", "시작일")}</span><span>{formatDateTime(save.createdAt)}</span></div> : null}
        {save.lastSeenAt ? <div className="v-kv"><span>{tr("最後遊玩", "Last played", "最終プレイ", "마지막 플레이")}</span><span>{formatDateTime(save.lastSeenAt)}</span></div> : null}
      </div>
    );
  }
  return null;
}

const detailTitle = (model, sectionKey, itemId) => {
  const list = { chats: model.chats, groups: model.groups, contacts: model.contacts, notes: model.notes, lorebooks: model.lorebooks, memories: model.memories }[sectionKey] || [];
  const item = list.find((entry) => entry.id === itemId);
  return item?.name || item?.title || "";
};

const detailSubtitle = (model, sectionKey, itemId, tr) => {
  if (sectionKey === "chats") {
    const chat = model.chats.find((item) => item.id === itemId);
    return chat ? tr(`共 ${chat.count.toLocaleString()} 則`, `${chat.count.toLocaleString()} messages`, `全 ${chat.count.toLocaleString()} 件`, `총 ${chat.count.toLocaleString()}개`) : "";
  }
  if (sectionKey === "groups") {
    const group = model.groups.find((item) => item.id === itemId);
    return group ? [group.memberNames.join("、"), tr(`${group.count.toLocaleString()} 則`, `${group.count.toLocaleString()} messages`, `${group.count.toLocaleString()} 件`, `${group.count.toLocaleString()}개`)].filter(Boolean).join(" · ") : "";
  }
  return "";
};

function OpenScreen({ tr, error, onFile, homeUrl }) {
  const [over, setOver] = useState(false);
  return (
    <div className="v-open">
      <h1>{tr("MaliPhone 檔案檢視", "MaliPhone file viewer", "MaliPhone ファイルビューア", "MaliPhone 파일 뷰어")}</h1>
      <p>{tr("打開救援檔或「匯出全域資料」的備份檔，確認裡面是不是你的遊玩內容。", "Open a rescue file or a global backup to check that it contains your play data.", "救出ファイルまたは全体バックアップを開いて、自分のプレイ内容か確認できます。", "복구 파일이나 전체 백업 파일을 열어 내 플레이 내용인지 확인할 수 있습니다.")}</p>
      <div className="v-safe">👁 {tr("唯讀檢視：這個頁面不會讀取或修改你小手機裡的資料，檔案內容只在這次瀏覽時顯示，關掉頁面就消失。", "Read-only: this page never reads or changes the data in your MaliPhone. The file is only shown while this page is open.", "読み取り専用：このページは MaliPhone のデータを読み込んだり変更したりしません。ファイルの内容はこのページを開いている間だけ表示されます。", "읽기 전용: 이 페이지는 MaliPhone의 데이터를 읽거나 바꾸지 않습니다. 파일 내용은 이 페이지를 연 동안에만 표시됩니다.")}</div>
      <div
        className={`v-drop ${over ? "over" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => { event.preventDefault(); setOver(false); const file = event.dataTransfer?.files?.[0]; if (file) onFile(file); }}
      >
        <label className="v-btn">
          {tr("選擇檔案", "Choose file", "ファイルを選択", "파일 선택")}
          <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }} />
        </label>
        <span>{tr("或把檔案拖到這裡", "or drop the file here", "またはここにドロップ", "또는 여기에 파일을 끌어다 놓기")}</span>
      </div>
      {error && <div className="v-error" role="alert">{error}</div>}
      <a className="v-link" href={homeUrl}>‹ {tr("回到小手機", "Back to MaliPhone", "MaliPhone に戻る", "MaliPhone로 돌아가기")}</a>
    </div>
  );
}

export default function ViewerApp() {
  const [lang, setLang] = useState(detectLanguage);
  const [, setConverterReady] = useState(0);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState(null);
  const [itemId, setItemId] = useState(null);
  const [layoutPref, setLayoutPref] = useState("auto");
  const wide = useWideScreen();
  const layout = layoutPref === "auto" ? (wide ? "desk" : "phone") : layoutPref;
  const tr = useCallback((...args) => translate(lang, ...args), [lang]);
  const homeUrl = useMemo(() => new URL("./", document.baseURI).href, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh-TW" ? "zh-Hant" : lang === "zh-CN" ? "zh-Hans" : lang;
    if (lang === "zh-CN") loadSimplifiedChineseConverter().then(() => setConverterReady((value) => value + 1)).catch(() => {});
  }, [lang]);

  const model = useMemo(() => (file ? buildViewModel(file.state, tr) : null), [file, tr]);

  const openFile = async (picked) => {
    setLoading(true);
    setError("");
    try {
      const raw = JSON.parse(await picked.text());
      const result = readBackupForViewing(raw);
      setFile({ ...result, name: picked.name, size: picked.size });
      setLang((current) => normalizeUiLanguage(result.state?.uiLanguage, current));
      setSection(null);
      setItemId(null);
    } catch {
      setError(tr("這個檔案打不開：不是 MaliPhone 的備份檔或救援檔，或是檔案已經損壞。", "This file can't be opened: it isn't a MaliPhone backup or rescue file, or it's damaged.", "このファイルは開けません。MaliPhone のバックアップか救出ファイルではないか、破損しています。", "이 파일을 열 수 없습니다. MaliPhone 백업이나 복구 파일이 아니거나 손상되었습니다."));
    } finally {
      setLoading(false);
    }
  };

  const closeFile = () => { setFile(null); setSection(null); setItemId(null); };

  // 寬版預設選第一個有資料的 App 與第一筆。
  useEffect(() => {
    if (!model || layout !== "desk") return;
    const currentSection = section && sectionCount(model, section) ? section : SECTIONS.find((item) => sectionCount(model, item.key))?.key;
    if (currentSection !== section) setSection(currentSection || null);
    const meta = SECTIONS.find((item) => item.key === currentSection);
    if (meta?.hasList && !listItems(model, currentSection, tr).some((item) => item.id === itemId)) {
      setItemId(listItems(model, currentSection, tr)[0]?.id || null);
    }
  }, [model, layout, section, itemId, tr]);

  if (!file) {
    return <OpenScreen tr={tr} error={loading ? "" : error} onFile={openFile} homeUrl={homeUrl} />;
  }

  const kindLabel = file.partial
    ? tr("不完整救援檔", "Incomplete rescue file", "不完全な救出ファイル", "불완전한 복구 파일")
    : file.kind === "rescue"
    ? tr("救援檔", "Rescue file", "救出ファイル", "복구 파일")
    : tr("全域備份", "Global backup", "全体バックアップ", "전체 백업");
  const fileSummary = [
    kindLabel,
    file.exportedAt ? tr(`匯出於 ${formatDateTime(Date.parse(file.exportedAt))}`, `exported ${formatDateTime(Date.parse(file.exportedAt))}`, `${formatDateTime(Date.parse(file.exportedAt))} 書き出し`, `${formatDateTime(Date.parse(file.exportedAt))} 내보냄`) : "",
    file.kind === "rescue" ? tr("不含圖片", "no images", "画像なし", "이미지 없음") : "",
    file.skipped ? tr(`${file.skipped} 筆讀不到`, `${file.skipped} unreadable`, `${file.skipped} 件読み込み不可`, `${file.skipped}건 읽기 불가`) : "",
  ].filter(Boolean).join(" · ");
  const layoutToggle = (
    <button type="button" className="v-link" onClick={() => setLayoutPref(layout === "desk" ? "phone" : "desk")}>
      {layout === "desk" ? tr("切換成小手機外觀", "Phone layout", "スマホ表示に切替", "휴대폰 화면으로") : tr("切換成檔案瀏覽", "Browser layout", "一覧表示に切替", "목록 화면으로")}
    </button>
  );
  const currentMeta = SECTIONS.find((item) => item.key === section);
  const partialWarning = file.partial && <div role="status" className="v-safe v-partial">{tr(
    "核心資料缺失：這裡只顯示仍能讀到的內容，可能缺少角色、聊天或進度。這份檔案不能直接還原成完整存檔；請保留原始救援檔。",
    "Core data is missing. Only readable content is shown; characters, chats or progress may be missing. This file can't be restored as a complete save. Keep the original rescue file.",
    "コアデータがありません。読み込める内容のみを表示し、キャラ・チャット・進行が欠けている可能性があります。完全なセーブとして復元はできません。元の救出ファイルを保管してください。",
    "핵심 데이터가 없습니다. 읽을 수 있는 내용만 표시하며 캐릭터, 채팅 또는 진행이 누락될 수 있습니다. 완전한 저장 데이터로 복원할 수 없으니 원본 복구 파일을 보관하세요.",
  )}</div>;

  if (layout === "desk") {
    const items = currentMeta?.hasList ? listItems(model, section, tr) : [];
    return (
      <div className="v-desk">
        <div className="v-top">
          <b>{tr("MaliPhone 檔案檢視", "MaliPhone file viewer", "MaliPhone ファイルビューア", "MaliPhone 파일 뷰어")}</b>
          <span className="v-pill">👁 {tr("唯讀 · 不會儲存", "Read-only · nothing is saved", "読み取り専用・保存しません", "읽기 전용 · 저장 안 함")}</span>
          <span className="f">{file.name} · {fileSummary}<button type="button" className="v-link" onClick={closeFile}>{tr("換檔案", "Change file", "ファイル変更", "파일 바꾸기")}</button>{layoutToggle}<a className="v-link" href={homeUrl}>{tr("回到小手機", "Back to MaliPhone", "MaliPhone に戻る", "MaliPhone로 돌아가기")}</a></span>
        </div>
        {partialWarning}
        <div className="v-tabs" role="tablist">
          {SECTIONS.map((item) => {
            const count = sectionCount(model, item.key);
            return <button type="button" role="tab" aria-selected={section === item.key} key={item.key} className={`v-tab ${section === item.key ? "on" : ""}`} disabled={!count} onClick={() => { setSection(item.key); setItemId(null); }}>{item.icon} {item.label(tr)}{item.hasList || item.key === "social" || item.key === "calendar" ? ` ${count}` : ""}</button>;
          })}
        </div>
        <div className={`v-cols ${currentMeta?.hasList ? "" : "single"}`}>
          {currentMeta?.hasList && <div className="v-side"><ItemList items={items} selectedId={itemId} onSelect={setItemId} tr={tr} /></div>}
          <div className="v-main">
            {currentMeta?.hasList && itemId && <div className="v-hdr"><div className="grow">{detailTitle(model, section, itemId)}<small>{detailSubtitle(model, section, itemId, tr)}</small></div></div>}
            {section && <SectionDetail key={`${section}-${itemId}`} model={model} sectionKey={section} itemId={itemId} tr={tr} />}
          </div>
        </div>
      </div>
    );
  }

  // B1：小手機外觀
  const goBack = () => { if (itemId && currentMeta?.hasList) setItemId(null); else setSection(null); };
  let screen;
  if (!section) {
    screen = (
      <>
        <div className="v-clock">MaliPhone<small>{fileSummary}</small></div>
        <div className="v-grid">
          {SECTIONS.map((item) => {
            const count = sectionCount(model, item.key);
            return (
              <button type="button" key={item.key} className="v-app" disabled={!count} onClick={() => { setSection(item.key); setItemId(null); }}>
                <div className="v-ic" aria-hidden="true">{item.icon}</div>
                {item.label(tr)}
                {count && (item.hasList || item.key === "social") ? <span className="v-badge">{count > 99 ? "99+" : count}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="v-filebar">
          <b>{file.name}</b><br />
          {tr(`${model.contacts.length} 位角色 · ${(model.chats.reduce((sum, chat) => sum + chat.count, 0) + model.groups.reduce((sum, group) => sum + group.count, 0)).toLocaleString()} 則訊息`, `${model.contacts.length} characters · ${(model.chats.reduce((sum, chat) => sum + chat.count, 0) + model.groups.reduce((sum, group) => sum + group.count, 0)).toLocaleString()} messages`, `キャラ ${model.contacts.length} 人 · メッセージ ${(model.chats.reduce((sum, chat) => sum + chat.count, 0) + model.groups.reduce((sum, group) => sum + group.count, 0)).toLocaleString()} 件`, `캐릭터 ${model.contacts.length}명 · 메시지 ${(model.chats.reduce((sum, chat) => sum + chat.count, 0) + model.groups.reduce((sum, group) => sum + group.count, 0)).toLocaleString()}개`)}<br />
          <button type="button" className="v-link" onClick={closeFile}>{tr("換一個檔案", "Open another file", "別のファイルを開く", "다른 파일 열기")}</button>
          {layoutToggle}
          <a className="v-link" href={homeUrl}>{tr("回到小手機", "Back to MaliPhone", "MaliPhone に戻る", "MaliPhone로 돌아가기")}</a>
        </div>
      </>
    );
  } else if (currentMeta?.hasList && !itemId) {
    screen = (
      <>
        <div className="v-hdr"><button type="button" className="v-back" aria-label={tr("返回", "Back", "戻る", "뒤로")} onClick={goBack}>‹</button><div className="grow">{currentMeta.label(tr)}</div></div>
        <ItemList items={listItems(model, section, tr)} selectedId={null} onSelect={setItemId} tr={tr} />
      </>
    );
  } else {
    const title = currentMeta?.hasList ? detailTitle(model, section, itemId) : currentMeta?.label(tr);
    screen = (
      <>
        <div className="v-hdr"><button type="button" className="v-back" aria-label={tr("返回", "Back", "戻る", "뒤로")} onClick={goBack}>‹</button><div className="grow">{title}<small>{detailSubtitle(model, section, itemId, tr)}</small></div></div>
        <SectionDetail key={`${section}-${itemId}`} model={model} sectionKey={section} itemId={itemId} tr={tr} />
        {(section === "chats" || section === "groups") && <div className="v-noinput">{tr("唯讀檢視中，無法傳送訊息", "Read-only view: messages can't be sent", "読み取り専用のため送信できません", "읽기 전용이라 메시지를 보낼 수 없습니다")}</div>}
      </>
    );
  }
  return (
    <div className="v-phone">
      <div className="v-ro">👁 {tr("唯讀檢視 · 不會儲存、不影響你的小手機", "Read-only · nothing is saved or changed", "読み取り専用・保存も変更もしません", "읽기 전용 · 저장하거나 바꾸지 않음")}</div>
      {partialWarning}
      <div className="v-scroll">{screen}</div>
    </div>
  );
}
