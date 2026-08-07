import React, { useEffect, useMemo, useState } from "react";
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
import { useGacha } from "../../contexts/GachaContext";
import { taiwanDayKey } from "../../utils/taiwanDayKey";

const REWARDS = [50, 60, 70, 80, 90, 100, 200];
const DEFAULT = { cycle: 1, day: 0, claimedDates: [], lastClaimDate: "" };

export default function LoginRewardApp({ onBack, tr }) {
  const { changeCrystals } = useGacha();
  const [progress, setProgress] = useState(null);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const today = taiwanDayKey(now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let mounted = true;
    loadFeatureEntity("ent_loginReward", null).then((saved) => { if (mounted) setProgress({ ...DEFAULT, ...(saved || {}) }); }).catch(() => { if (mounted) setProgress({ ...DEFAULT }); });
    return () => { mounted = false; };
  }, []);
  const claimedToday = progress?.lastClaimDate === today;
  const nextDay = Math.min(7, (progress?.day || 0) + 1);
  const claim = async () => {
    if (!progress || claimedToday) return;
    const reward = REWARDS[nextDay - 1];
    const next = { ...progress, day: nextDay >= 7 ? 0 : nextDay, cycle: nextDay >= 7 ? progress.cycle + 1 : progress.cycle, lastClaimDate: today, claimedDates: [...(progress.claimedDates || []).slice(-20), today] };
    setProgress(next);
    changeCrystals(reward, { source: "login", note: tr(`登入獎勵・第 ${nextDay} 天`, `Login reward · Day ${nextDay}`, `ログイン報酬・${nextDay}日目`, `로그인 보상 · ${nextDay}일차`) });
    await saveFeatureEntity("ent_loginReward", next);
    setNotice(tr(`已領取第 ${nextDay} 天獎勵：💎 ${reward}`, `Day ${nextDay} reward claimed: 💎 ${reward}`, `${nextDay}日目の報酬を受け取りました：💎 ${reward}`, `${nextDay}일차 보상을 받았습니다: 💎 ${reward}`));
  };
  const currentDay = progress?.day || 0;
  const history = useMemo(() => Array.from({ length: 7 }, (_, index) => ({ day: index + 1, reward: REWARDS[index], done: index < currentDay || (currentDay === 0 && progress?.lastClaimDate) })), [currentDay, progress?.lastClaimDate]);
  return <div className="mp-page" data-mp-surface="light" style={{ background: "linear-gradient(180deg,#fffaf8,#fdecef)", color: "var(--mp-page-text)", overflowY: "auto" }}><div className="mp-hdr" style={{ background: "var(--mp-page-control-bg)" }}><div className="mp-back" onClick={onBack}>←</div><div className="mp-htitle">{tr("登入獎勵", "Login rewards", "ログイン報酬", "로그인 보상")}</div></div><style>{`.lr-page{padding:18px}.lr-card{border:1px solid var(--mp-page-border);border-radius:22px;background:var(--mp-page-surface);padding:18px;box-shadow:0 10px 24px #c77d9220}.lr-title{text-align:center;font:800 22px serif}.lr-sub{text-align:center;margin:6px 0 16px;color:var(--mp-page-text-muted);font-size:12px}.lr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.lr-day{padding:10px 4px;border-radius:14px;background:#fff4f6;text-align:center;border:1px solid #f3d9e0}.lr-day.done{background:#f4d4df;color:#a44f70}.lr-day:last-child{grid-column:span 2;background:linear-gradient(135deg,#fff0c9,#f7d8e5)}.lr-day b{display:block;font-size:11px}.lr-day span{display:block;margin-top:5px;font-size:17px}.lr-claim{width:100%;margin-top:16px;padding:12px;border:0;border-radius:15px;background:linear-gradient(135deg,#ec8eae,#d85e87);color:var(--mp-page-on-accent);font-weight:900;font-size:14px}.lr-claim:disabled{opacity:.45}.lr-notice{text-align:center;margin-top:12px;color:#bd5277;font-size:12px}`}</style>{progress ? <div className="lr-page"><div className="lr-card"><div className="lr-title">{tr("每日登入獎勵", "Daily login rewards", "毎日のログイン報酬", "일일 로그인 보상")}</div><div className="lr-sub">{tr(`已領取 ${currentDay}/7 天 · 下一次可領第 ${nextDay} 天`, `${currentDay}/7 days claimed · Next: Day ${nextDay}`, `${currentDay}/7日受取済み・次は${nextDay}日目`, `${currentDay}/7일 수령 · 다음은 ${nextDay}일차`)}</div><div className="lr-grid">{history.map((item) => <div key={item.day} className={`lr-day ${item.done ? "done" : ""}`}><b>{tr(`第 ${item.day} 天`, `Day ${item.day}`, `${item.day}日目`, `${item.day}일차`)}</b><span>💎</span><small>{item.reward}</small>{item.done && <div style={{ fontSize: 9, marginTop: 4 }}>{tr("已領取", "Claimed", "受取済み", "수령 완료")}</div>}</div>)}</div><button className="lr-claim" disabled={claimedToday} onClick={claim}>{claimedToday ? tr("今日已領取", "Claimed today", "本日は受取済み", "오늘 수령 완료") : tr(`領取第 ${nextDay} 天 · 💎 ${REWARDS[nextDay - 1]}`, `Claim Day ${nextDay} · 💎 ${REWARDS[nextDay - 1]}`, `${nextDay}日目を受け取る・💎 ${REWARDS[nextDay - 1]}`, `${nextDay}일차 받기 · 💎 ${REWARDS[nextDay - 1]}`)}</button>{notice && <div className="lr-notice">{notice}</div>}</div></div> : <div style={{ display: "grid", placeItems: "center", flex: 1 }}>{tr("正在讀取登入獎勵⋯", "Loading login rewards…", "ログイン報酬を読み込み中…", "로그인 보상 불러오는 중…")}</div>}</div>;
}
