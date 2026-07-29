import React, { useState } from "react";
import { gid } from "../../utils/coreUtils";
import { useGacha } from "../../contexts/GachaContext";
import LifeLedgerView from "./LifeLedgerView.jsx";

export default function WalletLedgerView({ wallet, setWallet, characters, closeApp, openSettings, tr, formatMoney, displayWalletText, sanitizeUserImageUrl, showToast }) {
  const { crystals, crystalLedger, crystalLedgerReady } = useGacha();
  const [tab, setTab] = useState("ledger");
  const [filter, setFilter] = useState(null);
  const [crystalFilter, setCrystalFilter] = useState("all");
  const [monthOffset, setMonthOffset] = useState(0);
  const [visible, setVisible] = useState(80);
  const txCharId = (tx) => {
    if (tx?.charId) return tx.charId;
    const note = String(tx?.note || "");
    return [...characters].sort((a,b)=>(b.name||"").length-(a.name||"").length).find((c) => c.name && note.includes(c.name))?.id || null;
  };
  const txs = [...(wallet?.transactions || [])].filter((t) => !filter || txCharId(t) === filter).sort((a,b)=>(b.time||0)-(a.time||0));
  // wallet.balance/transactions 是劇情錢包（角色轉帳、商店…）；wallet.life 是玩家自己的生活記帳，兩者互不扣抵。
  const storyBalance = Number(wallet?.balance || 0);
  const lifeBalance = Number(wallet?.life?.balance || 0);
  const lifeTxCount = (wallet?.life?.transactions || []).length;
  // 生活記帳允許負餘額，負號要放在錢號前面。
  const money = (n) => `${n < 0 ? "-" : ""}$${formatMoney(Math.abs(n))}`;
  const crystalTransactions = [...(crystalLedger || [])].filter((entry) => crystalFilter === "all" || entry.type === crystalFilter);
  const crystalSourceIcon = { system: "💎", yunyin: "🏔️", couple: "💞", gacha: "🌸", furniture: "🪑", mailbox: "✉️", login: "🎁", other: "💎" };
  const dayKey = (time) => { const d=new Date(time); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const groups = txs.slice(0, visible).reduce((out,t) => { const key=dayKey(t.time); let g=out[out.length-1]; if(!g||g.key!==key){const d=new Date(t.time),now=new Date(); const label=key===dayKey(Date.now())?tr("今天","Today","今日","오늘"):key===dayKey(Date.now()-864e5)?tr("昨天","Yesterday","昨日","어제"):`${d.getMonth()+1}/${d.getDate()}`; g={key,label,items:[]};out.push(g);} g.items.push(t);return out; },[]);
  const now=new Date(), mDate=new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
  const monthTx=txs.filter((t)=>{const d=new Date(t.time);return d.getFullYear()===mDate.getFullYear()&&d.getMonth()===mDate.getMonth()&&t.source!=="manual";});
  const income=monthTx.filter(t=>t.type!=="expense").reduce((s,t)=>s+(Number(t.amount)||0),0), expense=monthTx.filter(t=>t.type==="expense").reduce((s,t)=>s+(Number(t.amount)||0),0);
  const weeks=[0,0,0,0,0]; monthTx.forEach(t=>weeks[Math.min(4,Math.floor((new Date(t.time).getDate()-1)/7))]+=Number(t.amount)||0); const maxWeek=Math.max(1,...weeks);
  const setBalance=()=>{const raw=window.prompt(tr("設定玩家錢包餘額","Set wallet balance","残高を設定","잔액 설정"),String(wallet?.balance||0));if(raw===null)return;const parsed=Number(raw);if(!Number.isFinite(parsed))return;const next=Math.max(0,Math.round(parsed));setWallet(w=>{const current=Math.max(0,Number(w?.balance)||0),diff=next-current;return {...w,balance:next,transactions:diff?[{id:gid(),type:diff<0?"expense":"income",amount:Math.abs(diff),note:tr("調整餘額","Balance adjusted","残高調整","잔액 조정"),time:Date.now(),source:"manual"},...(w?.transactions||[])].slice(0,1000):(w?.transactions||[])};});};
  const toggleMemorial=(tx)=>{const label=tx.memorial?null:prompt(tr("珍藏標籤","Saved label","保存ラベル","소장 라벨"),tr("珍藏","Saved","保存","소장"));if(label===null&&!tx.memorial)return;setWallet(w=>({...w,transactions:(w.transactions||[]).map(x=>x.id===tx.id?(tx.memorial?(({memorial,...rest})=>rest)(x):{...x,memorial:{label:label||tr("珍藏","Saved","保存","소장")}}):x)}));};
  const biggest=monthTx.reduce((m,t)=>!m||Number(t.amount)>Number(m.amount)?t:m,null);
  const weekOut=[0,0,0,0,0], weekIn=[0,0,0,0,0]; monthTx.forEach(t=>{const i=Math.min(4,Math.floor((new Date(t.time).getDate()-1)/7));(t.type==="expense"?weekOut:weekIn)[i]+=Number(t.amount)||0;});
  const monthMaxWeek=Math.max(1,...weekOut,...weekIn), memorials=monthTx.filter(t=>t.memorial), biggestWeek=biggest?Math.min(5,Math.floor((new Date(biggest.time).getDate()-1)/7)+1):0;
  const selectedName=filter?(characters.find(c=>c.id===filter)?.name||tr("角色","Character","キャラ","캐릭터")):tr("角色們","Characters","キャラたち","캐릭터들");
  const keywordTx=monthTx.find(t=>["生日","紅包","紀念","第一次"].some(k=>String(t.note||"").includes(k)));
  if(tab==="life") return <LifeLedgerView wallet={wallet} setWallet={setWallet} onBack={()=>setTab("ledger")} tr={tr} formatMoney={formatMoney} showToast={showToast} />;
  if(tab==="month") return <div className="mp-page mp-wallet-month"><div className="mp-hdr"><div className="mp-back" onClick={()=>setTab("ledger")}>←</div><div><div className="mp-htitle">{tr("月結","Monthly","月まとめ","월결산")}</div><div className="mp-wallet-month-sub">{tr("這個月的我們","This month together","今月のふたり","이번 달의 우리")}</div></div></div><div className="mp-cm mp-wallet-month-body">
    <div className="mp-wfilter"><button className={`mp-wchip ${!filter?"active":""}`} onClick={()=>setFilter(null)}>{tr("全部","All","すべて","전체")}</button>{characters.map(c=><button key={c.id} className={`mp-wchip ${filter===c.id?"active":""}`} onClick={()=>setFilter(c.id)}>{c.name}</button>)}</div>
    <div className="mp-wmonth-nav"><button onClick={()=>setMonthOffset(v=>v-1)}>‹</button><span>{mDate.getFullYear()} · {mDate.getMonth()+1}{tr("月","","月","월")}</span><button disabled={monthOffset>=0} onClick={()=>setMonthOffset(v=>v+1)}>›</button></div>
    <div className="mp-wcard mp-month-compare"><div className="mp-wcomp-row"><span>{tr("我 → ","Me → ","わたし → ","나 → ")}{selectedName}</span><b className="mp-month-out">${formatMoney(expense)}</b></div><div className="mp-wbar"><i style={{width:`${expense+income?expense/(expense+income)*100:0}%`}}/></div><div className="mp-wcomp-row"><span>{selectedName}{tr(" → 我"," → me"," → わたし"," → 나")}</span><b className="mp-month-in">${formatMoney(income)}</b></div><div className="mp-wbar gold"><i style={{width:`${expense+income?income/(expense+income)*100:0}%`}}/></div><div className="mp-wcomp-note">{monthTx.length?tr(`來往 ${monthTx.length} 筆，都記在心上 ♡`,`${monthTx.length} exchanges, kept close ♡`,`${monthTx.length} 回のやり取り、心に ♡`,`${monthTx.length}번의 왕래, 마음에 ♡`):tr("這個月還沒有往來","Nothing this month","今月はまだ","이번 달은 아직")}</div></div>
    <div className="mp-wcard"><div className="mp-month-card-title">{tr("每週往來","Weekly exchanges","毎週のやり取り","주별 왕래")}</div><div className="mp-wweeks mp-wweeks-dual">{weekOut.map((out,i)=><div className="mp-wweek" key={i}><div className="mp-week-bars"><i className="out" style={{height:`${out/monthMaxWeek*100}%`}}/><i className="in" style={{height:`${weekIn[i]/monthMaxWeek*100}%`}}/></div><small>W{i+1}</small></div>)}</div><div className="mp-week-legend"><span>● {tr("送出","Sent","送った","보냄")}</span><span>● {tr("收到","Received","もらった","받음")}</span></div></div>
    <div className="mp-wnote">{monthTx.length?<>{mDate.getMonth()+1}{tr("月小記：","月 note: ","月メモ：","월 메모: ")}{tr(`互相留下了 ${monthTx.length} 次往來。`,`There were ${monthTx.length} exchanges.`,`やり取りは ${monthTx.length} 回。`,`서로 ${monthTx.length}번 오갔어요.`)}<br/>{memorials.length?tr(`珍藏了 ${memorials.length} 個瞬間。`,`Saved ${memorials.length} moments.`,`${memorials.length} 個の瞬間を保存。`,`${memorials.length}개의 순간을 소장했어요.`):null}{keywordTx?<><br/>{displayWalletText(keywordTx.note)}</>:null}{biggest?<><br/>{tr(`最大一筆是 W${biggestWeek} 的 $${formatMoney(biggest.amount)}。`,`The biggest was $${formatMoney(biggest.amount)} in W${biggestWeek}.`,`最大は W${biggestWeek} の $${formatMoney(biggest.amount)}。`,`가장 큰 금액은 W${biggestWeek}의 $${formatMoney(biggest.amount)}예요.`)}</>:null}</>:tr("這個月還沒有金錢往來。","No transactions this month.","今月はまだやり取りがありません。","이번 달은 아직 거래가 없어요.")}</div>
    {memorials.length>0&&<div className="mp-wmem-shelf"><span>{tr("本月珍藏","Saved this month","今月の保存","이달의 소장")}</span>{memorials.map(t=><button key={t.id} className="mp-wmem-chip" onClick={()=>toggleMemorial(t)}>✦ {t.memorial.label}</button>)}</div>}
  </div></div>;
  return <div className="mp-page"><div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div><div className="mp-htitle">{tr("錢包","Wallet","ウォレット","지갑")}</div><div style={{font:"10px var(--mp-hand,var(--mp-font))",color:"var(--mp-txt-l)"}}>{tr("我們的小帳本","Our little ledger","ふたりの家計簿","우리의 가계부")}</div></div><button className="mp-ibtn" style={{marginLeft:"auto"}} onClick={openSettings}>⚙</button></div>
  <div className="mp-cm">
    <div className="mp-bank">
      <span className="mp-bank-label">{tr("總資產","Total assets","総資産","총자산")}</span>
      <div className="mp-bank-amt">{money(storyBalance+lifeBalance)}</div>
      <div className="mp-bank-sum">{tr("手機","Phone","スマホ","폰")} ${formatMoney(storyBalance)} ＋ {tr("生活","Life","生活","생활")} {money(lifeBalance)}</div>
    </div>
    {/* 兩本帳各自獨立：劇情扣款永遠不動生活帳戶，總資產只是顯示層加總。 */}
    <div className="mp-acct-row">
      <div className="mp-acct story">
        <div className="mp-acct-top"><span>📱 {tr("手機錢包","Phone wallet","スマホ財布","폰 지갑")}</span><button className="mp-bank-edit" onClick={setBalance}>✎</button></div>
        <b>${formatMoney(storyBalance)}</b>
        <small onClick={()=>setTab("month")}>{mDate.getMonth()+1}{tr("月","","月","월")}・{tr("送出","Sent","送った","보냄")} ${formatMoney(expense)} ↔ {tr("收到","Received","もらった","받음")} ${formatMoney(income)}</small>
      </div>
      <button type="button" className="mp-acct life" onClick={()=>setTab("life")}>
        <div className="mp-acct-top"><span>📒 {tr("生活記帳","Life ledger","生活家計簿","생활 가계부")}</span><span className="mp-crystal-link">›</span></div>
        <b>{money(lifeBalance)}</b>
        <small>{lifeTxCount?tr(`已記 ${lifeTxCount} 筆`,`${lifeTxCount} entries`,`${lifeTxCount} 件`,`${lifeTxCount}건`):tr("開始記帳","Start tracking","記帳を始める","기록 시작")}</small>
      </button>
    </div>
    <button type="button" className={`mp-crystal-account ${tab==="crystals"?"active":""}`} onClick={()=>setTab("crystals")}>
      <span className="mp-crystal-icon">💎</span>
      <span className="mp-crystal-copy"><small>{tr("靈魂結晶","Soul crystals","ソウルクリスタル","영혼 결정")}</small><b>{Number(crystals || 0).toLocaleString()}</b></span>
      <span className="mp-crystal-link">{tr("查看紀錄","View history","履歴を見る","기록 보기")} ›</span>
    </button>
    <div className="mp-wtabs" style={{margin:"11px 0 8px"}}>
      <button className={`mp-wtab ${tab==="ledger"?"active":""}`} onClick={()=>setTab("ledger")}>{tr("收支紀錄","Ledger","履歴","내역")}</button>
      <button className={`mp-wtab ${tab==="month"?"active":""}`} onClick={()=>setTab("month")}>{tr("月結","Monthly","月まとめ","월결산")}</button>
      <button className={`mp-wtab ${tab==="crystals"?"active":""}`} onClick={()=>setTab("crystals")}>{tr("結晶","Crystals","結晶","결정")}</button>
    </div>
    {tab === "ledger" && <div className="mp-wfilter" style={{marginBottom:10}}><button className={`mp-wchip ${!filter?"active":""}`} onClick={()=>setFilter(null)}>{tr("全部","All","すべて","전체")}</button>{characters.map(c=><button key={c.id} className={`mp-wchip ${filter===c.id?"active":""}`} onClick={()=>{setFilter(c.id);setVisible(80);}}>{c.name}</button>)}</div>}
    {tab === "crystals" && <div className="mp-wfilter mp-crystal-filter" style={{marginBottom:10}}>
      {[["all",tr("全部","All","すべて","전체")],["income",tr("獲得","Received","獲得","획득")],["expense",tr("消耗","Spent","使用","사용")]].map(([key,label])=><button key={key} className={`mp-wchip ${crystalFilter===key?"active":""}`} onClick={()=>setCrystalFilter(key)}>{label}</button>)}
      <span>{tr("最多保留 30 筆","Latest 30","最新30件","최근 30건")}</span>
    </div>}
    {tab === "ledger" ? (txs.length ? <>{groups.map(g=><div key={g.key}><div className="mp-wday">{g.label}</div>{g.items.map(t=>{const c=characters.find(x=>x.id===t.charId);return <div key={t.id} className={`mp-wrow ${t.memorial?"memorial":""}`}>{t.memorial&&<span className="mp-wmem-tag">✦ {t.memorial.label}</span>}<div className="mp-wrow-av">{c&&sanitizeUserImageUrl(c.avatar)?<img src={sanitizeUserImageUrl(c.avatar)} alt=""/>:"💼"}</div><div style={{flex:1,minWidth:0}}><div className="mp-wrow-note">{displayWalletText(t.note)}</div><div className="mp-wrow-meta">{new Date(t.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}{t.source==="chat"?` · ${tr("來自聊天室","from chat","チャットから","채팅에서")}`:""}</div></div><span className={`mp-wamt ${t.type==="expense"?"out":"in"}`}>{t.type==="expense"?"-":"+"}{formatMoney(t.amount)}</span><button className="mp-wmem-btn" onClick={()=>toggleMemorial(t)}>{t.memorial?"🔖":"♡"}</button></div>})}</div>)}{visible<txs.length&&<button className="mp-save" onClick={()=>setVisible(v=>v+80)}>{tr("載入更多","Load more","もっと見る","더 보기")}</button>}</> : <div className="mp-empty"><div className="mp-empty-i">🧾</div><div className="mp-empty-t">{tr("還沒有往來紀錄","No transactions yet","まだ記録がありません","아직 기록이 없어요")}</div></div>) : (
      crystalTransactions.length ? <div className="mp-crystal-ledger">{crystalTransactions.map((entry)=><div key={entry.id} className={`mp-wrow mp-crystal-row ${entry.type}`}>
        <div className="mp-wrow-av">{crystalSourceIcon[entry.source] || crystalSourceIcon.other}</div>
        <div style={{flex:1,minWidth:0}}><div className="mp-wrow-note">{entry.note}</div><div className="mp-wrow-meta">{new Date(entry.time).toLocaleString("zh-TW",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})} · {tr("餘額","Balance","残高","잔액")} {Number(entry.balanceAfter || 0).toLocaleString()}</div></div>
        <span className={`mp-wamt ${entry.type==="expense"?"out":"in"}`}>{entry.type==="initial"?tr("起始","Start","開始","시작"):`${entry.type==="expense"?"-":"+"}${Number(entry.amount || 0).toLocaleString()}`}</span>
      </div>)}</div> : <div className="mp-empty"><div className="mp-empty-i">💎</div><div className="mp-empty-t">{crystalLedgerReady ? tr("這個分類還沒有結晶紀錄","No crystal history in this category","この分類にはまだ記録がありません","이 분류에는 기록이 없어요") : tr("正在建立結晶帳本…","Preparing crystal history…","結晶履歴を準備中…","결정 기록 준비 중…")}</div></div>
    )}
  </div></div>;
}
