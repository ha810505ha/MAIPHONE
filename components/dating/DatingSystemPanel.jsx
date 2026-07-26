import React from "react";
import { findProfile } from "../../services/dating/datingMatching";
import { REPORT_REWARD_SUPER_LIKES } from "../../constants/dating";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

const name = (profileId) => findProfile(profileId)?.profile.name || profileId;
const when = (time) => (time ? new Date(time).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" }) : "");

/**
 * 帳號後台：SL 餘額、官方通知、封鎖名單、檢舉紀錄。
 * 封鎖與檢舉的「動作」刻意留在對方的檔案頁——那是形成判斷的地方；
 * 這裡只負責事後的查看與撤銷。
 */
export default function DatingSystemPanel({ state, onClaim, onUnblock }) {
  const { superLikes, superLikeLog = [], reports = [], blocked = {} } = state;
  const blockedIds = Object.keys(blocked).sort((a, b) => blocked[b] - blocked[a]);
  const reviewing = reports.filter((item) => item.status === "reviewing");
  const resolved = reports.filter((item) => item.status !== "reviewing");

  return (
    <div className="dt-me">
      <div className="dt-sg">
        <div className="dt-sg-t">Super Like</div>
        <div className="dt-sl-count"><span>{superLikes}</span> 個可用</div>
        <div className="dt-me-hint">Super Like 大幅提高配對成功率，對方也會知道你用了，回覆通常更快。協助檢舉違規帳號可以獲得更多。</div>
        {superLikeLog.length > 0 && (
          <div className="dt-sl-log">
            {superLikeLog.map((item) => {
              const status = item.status === "matched" ? "已配對" : item.status === "silent" ? "未回應" : "等待中";
              return (
                <div key={`${item.profileId}-${item.at}`} className="dt-slog">
                  <span>{name(item.profileId)}</span>
                  <span className={`dt-slog-s ${item.status}`}>{status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="dt-sg">
        <div className="dt-sg-t">官方通知{reports.length > 0 && <span>{reports.length}</span>}</div>
        {!reports.length && <div className="dt-me-hint">目前沒有訊息。</div>}
        {reviewing.map((item) => (
          <div key={item.profileId} className="dt-notice">
            <div className="dt-notice-t">檢舉審核中<span className="dt-notice-d">{when(item.at)}</span></div>
            <div className="dt-notice-b">我們已收到您對「{name(item.profileId)}」的檢舉，人工審核需要 1～2 個工作天，結果會另行通知。</div>
          </div>
        ))}
        {resolved.map((item) => {
          const ok = item.status === "confirmed";
          return (
            <div key={item.profileId} className={`dt-notice ${ok ? "ok" : ""}`}>
              <div className="dt-notice-t">{ok ? "檢舉成立" : "查無違規"}<span className="dt-notice-d">{when(item.resolvedAt || item.at)}</span></div>
              <div className="dt-notice-b">
                {ok
                  ? `經查證，「${name(item.profileId)}」確實違反社群守則，我們已停用該帳號。感謝您協助維護信風的社群安全，謹奉上一點心意。`
                  : `經查證，「${name(item.profileId)}」並未違反社群守則，我們不會對該帳號採取行動。您的封鎖設定仍然有效。`}
              </div>
              {ok && (item.claimed
                ? <div className="dt-notice-done">已領取 Super Like ×{REPORT_REWARD_SUPER_LIKES}</div>
                : <button type="button" className="dt-notice-claim" onClick={() => onClaim(item.profileId)}>領取 Super Like ×{REPORT_REWARD_SUPER_LIKES}</button>)}
            </div>
          );
        })}
      </div>

      <div className="dt-sg">
        <div className="dt-sg-t">封鎖名單{blockedIds.length > 0 && <span>{blockedIds.length}</span>}</div>
        {!blockedIds.length && <div className="dt-me-hint">還沒有封鎖任何人。封鎖後對方不會再出現在探索，也無法傳訊息給你。</div>}
        {blockedIds.map((profileId) => {
          const entry = findProfile(profileId);
          const photo = sanitizeUserImageUrl(entry?.profile.photos?.[0]);
          const reported = reports.find((item) => item.profileId === profileId);
          return (
            <div key={profileId} className="dt-block-row">
              <div className="dt-list-av" style={{ cursor: "default" }}>{photo ? <img src={photo} alt="" /> : name(profileId)[0]}</div>
              <div className="dt-list-body">
                <div className="dt-list-name">{name(profileId)}</div>
                <div className="dt-list-sub">{when(blocked[profileId])} 封鎖{reported ? "・已檢舉" : ""}</div>
              </div>
              {/* 檢舉成立的帳號已被平台停用，解封也回不來 */}
              {reported?.status === "confirmed"
                ? <span className="dt-block-gone">帳號已停用</span>
                : <button type="button" className="dt-block-undo" onClick={() => onUnblock(profileId)}>解除</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
