import React, { useState } from "react";
import SwipeDeck from "../dating/SwipeDeck";
import ProfileDetail from "../dating/ProfileDetail";
import MatchCelebration from "../dating/MatchCelebration";
import DatingProfileEditor from "../dating/DatingProfileEditor";
import DatingChat from "../dating/DatingChat";
import DatingSystemPanel from "../dating/DatingSystemPanel";
import { canReport, findProfile } from "../../services/dating/datingMatching";
import { tagLabel } from "../../data/dating/interestTags";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

const relativeFuture = (at) => {
  const diff = at - Date.now();
  if (diff <= 0) return "隨時";
  const hours = Math.ceil(diff / 3600000);
  return hours > 1 ? `約 ${hours} 小時後` : "一小時內";
};

function EmptyDeck({ refreshAt }) {
  return (
    <div className="dt-empty">
      <div className="dt-empty-i">🌙</div>
      <div className="dt-empty-t">附近沒有人了</div>
      <div className="dt-empty-s">{refreshAt ? `${relativeFuture(refreshAt)}會有新的人出現` : "稍後再回來看看"}</div>
    </div>
  );
}

function MatchList({ matches, relations, blocked, onOpenChat, onOpenProfile }) {
  if (!matches.length) {
    return <div className="dt-empty"><div className="dt-empty-i">💬</div><div className="dt-empty-t">還沒有配對</div><div className="dt-empty-s">右滑喜歡的人，等對方回應</div></div>;
  }
  return (
    <div className="dt-list">
      {matches.map((match) => {
        const entry = findProfile(match.profileId);
        if (!entry) return null;
        const photo = sanitizeUserImageUrl(entry.profile.photos?.[0]);
        const relation = relations[match.profileId];
        const last = relation?.messages?.[relation.messages.length - 1];
        return (
          <div key={match.profileId} className="dt-list-row" onClick={() => onOpenChat(match.profileId)}>
            <button type="button" className="dt-list-av" onClick={(event) => { event.stopPropagation(); onOpenProfile(entry); }} aria-label={`${entry.profile.name} 的檔案`}>
              {photo ? <img src={photo} alt="" /> : entry.profile.name?.[0]}
            </button>
            <div className="dt-list-body">
              <div className="dt-list-name">
                {entry.profile.name}
                {match.superLike && <span className="dt-list-star">★</span>}
                {relation?.contactCharId && <span className="dt-list-tagged">已加入聯絡人</span>}
                {blocked[match.profileId] && <span className="dt-list-tagged blocked">已封鎖</span>}
              </div>
              <div className="dt-list-sub">
                {last?.content || (match.shared?.length ? `都喜歡 ${match.shared.slice(0, 2).map(tagLabel).join("、")}` : "開始聊聊吧")}
              </div>
            </div>
            {relation?.unread > 0 && <span className="dt-list-dot" />}
          </div>
        );
      })}
    </div>
  );
}

export default function DatingApp({ closeApp, dating, playerProfile, onPromoteToContact, onOpenContact, showToast }) {
  const [tab, setTab] = useState("deck");
  const [detail, setDetail] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const {
    state, deck, swipe, rewind, updateProfile, markMatchSeen, refreshAt, unseenMatches,
    typing, openChatId, setOpenChatId, openChat, sendMessage, promoteToContact,
    setBlocked, report, claimReportReward,
  } = dating;

  // 配對是延遲熟成的，所以慶祝畫面在玩家下次打開 App 時補放。
  const pendingCelebration = celebration || (tab === "deck" && unseenMatches[0]) || null;
  const celebrationEntry = pendingCelebration ? findProfile(pendingCelebration.profileId) : null;

  const doSwipe = (profileId, action) => {
    if (action === "super" && state.superLikes <= 0) return showToast?.("Super Like 用完了");
    setDetail(null);
    return swipe(profileId, action);
  };
  const lastSwiped = Object.entries(state.swiped).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0];

  const enterChat = (profileId) => { setCelebration(null); setTab("matches"); openChat(profileId); };
  // 有獎可領就在系統分頁掛紅點，否則玩家等了兩天回來根本不知道結果出了
  const claimable = state.reports.some((item) => item.status === "confirmed" && !item.claimed);

  // 檢舉一定連帶封鎖，所以送出前要講清楚——這是不可逆的。
  const safetyProps = (profileId) => ({
    blocked: !!state.blocked[profileId],
    canReport: canReport(state.relations[profileId]) && !state.reports.some((item) => item.profileId === profileId),
    onToggleBlock: (next) => {
      setBlocked(profileId, next);
      showToast?.(next ? "已封鎖，對方不會再出現也無法傳訊息" : "已解除封鎖");
    },
    onReport: () => {
      if (!window.confirm("提交檢舉會同時封鎖此用戶，且無法復原。\n審核需要 1～2 個工作天，結果會通知你。\n確定要檢舉嗎？")) return;
      report(profileId);
      setDetail(null);
      showToast?.("檢舉已送出，審核中");
    },
  });

  const openEntry = openChatId ? findProfile(openChatId) : null;
  if (openEntry) {
    return (
      <div className="mp-page dt-page">
        <DatingChat
          entry={openEntry} relation={state.relations[openChatId]} typing={typing === openChatId}
          blocked={!!state.blocked[openChatId]}
          onBack={() => setOpenChatId(null)}
          onSend={(text) => sendMessage(openChatId, text)}
          onOpenProfile={() => setDetail(openEntry)}
          onOpenContact={() => onOpenContact?.(state.relations[openChatId]?.contactCharId)}
          onPromote={() => {
            const charId = promoteToContact(openChatId, onPromoteToContact);
            showToast?.(charId ? `${openEntry.profile.name} 已加入聯絡人` : "加入失敗");
          }}
        />
        {/* 已配對的檔案是純瀏覽：不給動作列，完整角色卡要等加入聯絡人 */}
        {detail && <ProfileDetail entry={detail} onClose={() => setDetail(null)} {...safetyProps(detail.id)} />}
      </div>
    );
  }

  return (
    <div className="mp-page dt-page">
      <div className="mp-hdr">
        <div className="mp-back" onClick={closeApp}>←</div>
        <div className="mp-htitle">信風</div>
      </div>
      <div className="dt-tabs">
        {[["deck", "探索"], ["matches", "配對"], ["me", "個人資料"], ["system", "系統"]].map(([id, label]) => (
          <button key={id} type="button" className={`dt-tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
            {label}
            {id === "matches" && unseenMatches.length > 0 && <span className="dt-tab-dot" />}
            {id === "system" && claimable && <span className="dt-tab-dot" />}
          </button>
        ))}
      </div>
      <div className="dt-body">
        {tab === "deck" && (deck.length
          ? <SwipeDeck deck={deck} superLikes={state.superLikes} canRewind={!!lastSwiped} onSwipe={doSwipe}
              onRewind={() => rewind(lastSwiped[0])} onOpenDetail={setDetail} />
          : <EmptyDeck refreshAt={refreshAt} />)}
        {tab === "matches" && <MatchList matches={state.matches} relations={state.relations} blocked={state.blocked}
          onOpenChat={enterChat} onOpenProfile={setDetail} />}
        {tab === "me" && <DatingProfileEditor profile={state.profile} updateProfile={updateProfile} playerName={playerProfile?.name} showToast={showToast} />}
        {tab === "system" && <DatingSystemPanel state={state} onClaim={claimReportReward}
          onUnblock={(profileId) => { setBlocked(profileId, false); showToast?.("已解除封鎖"); }} />}
      </div>
      {/* 已配對的人只能瀏覽，不再給滑動按鈕 */}
      {detail && <ProfileDetail entry={detail} superLikes={state.superLikes} onClose={() => setDetail(null)} {...safetyProps(detail.id)}
        onSwipe={state.matches.some((item) => item.profileId === detail.id) ? null : (action) => doSwipe(detail.id, action)} />}
      {pendingCelebration && celebrationEntry && (
        <MatchCelebration match={pendingCelebration} entry={celebrationEntry}
          playerPhoto={state.profile.photos?.[0] || playerProfile?.avatar} playerName={playerProfile?.name}
          onOpenChat={() => enterChat(pendingCelebration.profileId)}
          onKeepSwiping={() => { markMatchSeen(pendingCelebration.profileId); setCelebration(null); }} />
      )}
    </div>
  );
}
