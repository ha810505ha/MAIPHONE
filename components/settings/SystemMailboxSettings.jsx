import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useGacha } from "../../contexts/GachaContext";
import { claimMailAttachments, countUnreadMails, loadMailbox, markMailRead } from "../../services/mailbox/mailboxService";

export default function SystemMailboxSettings() {
  const { changeCrystals } = useGacha();
  const [open, setOpen] = useState(false);
  const [mails, setMails] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    const result = await loadMailbox();
    setMails(result.mails);
    setLoading(false);
  };
  useEffect(() => { refresh().catch(() => setLoading(false)); }, []);
  const selected = mails.find((mail) => mail.id === selectedId) || null;
  const unreadCount = useMemo(() => countUnreadMails(mails), [mails]);
  const claimableCount = useMemo(() => mails.filter((mail) => !mail.claimed && mail.attachments?.length).length, [mails]);

  const openMail = async (mail) => {
    setSelectedId(mail.id);
    setNotice("");
    if (!mail.read) {
      await markMailRead(mail.id);
      await refresh();
    }
  };
  const claim = async () => {
    if (!selected || selected.claimed) return;
    const grants = await claimMailAttachments(selected.id);
    for (const grant of grants) {
      if (grant.type === "crystals") {
        changeCrystals(Math.max(0, Number(grant.amount) || 0), {
          source: "mailbox",
          note: `系統信箱・${selected.title}`,
        });
      }
    }
    setNotice(grants.length ? "附件已加入現有資產" : "附件已領取");
    await refresh();
  };

  return <div className="mp-sg sm-box">
    <style>{`.sm-head{display:flex;align-items:center;gap:11px;cursor:pointer}.sm-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-surface));font-size:21px}.sm-copy{min-width:0;flex:1}.sm-copy small{display:block;margin-top:3px;color:var(--mp-txt-l);font-size:10px}.sm-badge{min-width:22px;height:22px;padding:0 7px;display:grid;place-items:center;border-radius:12px;background:var(--mp-pink-dk);color:#fff;font-size:10px;font-weight:900}.sm-overlay{z-index:120}.sm-modal{width:min(90%,430px);max-height:82vh;display:flex;flex-direction:column;padding:16px;overflow:hidden}.sm-modal-head{display:flex;align-items:center;gap:8px;margin-bottom:12px}.sm-modal-head h3{flex:1;margin:0}.sm-modal-head button{width:34px;height:34px;border:0;border-radius:50%;background:var(--mp-pink-lt);color:var(--mp-txt);font-size:18px}.sm-list{display:grid;gap:8px;overflow-y:auto}.sm-row{width:100%;display:flex;align-items:center;gap:10px;border:1px solid var(--mp-line);border-radius:14px;background:var(--mp-surface);color:var(--mp-txt);padding:11px;text-align:left}.sm-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:var(--mp-pink-dk)}.sm-dot.read{background:transparent;border:1px solid var(--mp-line)}.sm-row-copy{min-width:0;flex:1}.sm-row-copy b,.sm-row-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sm-row-copy small{margin-top:3px;color:var(--mp-txt-l);font-size:10px}.sm-attachment{font-size:10px;color:var(--mp-pink-dk);font-weight:800}.sm-detail{overflow-y:auto;padding:2px}.sm-detail h3{margin:0 0 4px}.sm-sender{color:var(--mp-txt-l);font-size:10px}.sm-body{margin:13px 0;white-space:pre-wrap;font-size:12px;line-height:1.75}.sm-grant{display:flex;align-items:center;justify-content:space-between;padding:10px 11px;border-radius:12px;background:var(--mp-pink-lt);font-size:12px}.sm-claim{width:100%;margin-top:10px;min-height:42px;border:0;border-radius:13px;background:linear-gradient(135deg,var(--mp-pink),var(--mp-pink-dk));color:#fff;font-weight:900}.sm-claim:disabled{opacity:.45}.sm-notice{text-align:center;margin-top:8px;color:var(--mp-pink-dk);font-size:11px}`}</style>
    <div className="sm-head" onClick={() => { setSelectedId(null); setOpen(true); }}><div className="sm-icon">✉️</div><div className="sm-copy"><div className="mp-sg-t" style={{ margin: 0 }}>系統信箱</div><small>{claimableCount ? `${claimableCount} 封信件有附件可領取` : "接收官方通知、獎勵與補償"}</small></div>{unreadCount > 0 && <span className="sm-badge">{unreadCount}</span>}<span>›</span></div>
    {open && createPortal(<div className="mp-overlay sm-overlay" onClick={() => setOpen(false)}><div className="mp-modal sm-modal" onClick={(event) => event.stopPropagation()}><div className="sm-modal-head">{selected && <button type="button" aria-label="返回信件列表" onClick={() => { setSelectedId(null); setNotice(""); }}>←</button>}<h3>{selected ? "信件內容" : "系統信箱"}</h3><button type="button" aria-label="關閉信箱" onClick={() => setOpen(false)}>×</button></div>{selected ? <div className="sm-detail"><h3>{selected.title}</h3><div className="sm-sender">來自 {selected.sender} · {new Date(selected.createdAt).toLocaleDateString("zh-TW")}</div><div className="sm-body">{selected.content}</div>{selected.attachments?.map((item) => <div className="sm-grant" key={item.grantId}><span>💎 {item.label}</span><b>× {Number(item.amount).toLocaleString()}</b></div>)}<button type="button" className="sm-claim" disabled={selected.claimed || !selected.attachments?.length} onClick={claim}>{selected.claimed ? "附件已領取" : "領取全部附件"}</button>{notice && <div className="sm-notice">{notice}</div>}</div> : <div className="sm-list">{loading ? <div style={{ color: "var(--mp-txt-l)", fontSize: 11 }}>正在讀取信件…</div> : mails.length ? mails.map((mail) => <button key={mail.id} type="button" className="sm-row" onClick={() => openMail(mail)}><span className={`sm-dot ${mail.read ? "read" : ""}`} /><span className="sm-row-copy"><b>{mail.title}</b><small>{mail.sender}</small></span>{mail.attachments?.length > 0 && <span className="sm-attachment">{mail.claimed ? "已領取" : "有附件"}</span>}</button>) : <div style={{ color: "var(--mp-txt-l)", fontSize: 11 }}>目前沒有系統信件</div>}</div>}</div></div>, document.querySelector(".mp-phone") || document.body)}
  </div>;
}
