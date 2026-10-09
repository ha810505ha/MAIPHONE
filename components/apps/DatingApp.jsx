import React, { useEffect, useState } from "react";
import SwipeDeck from "../dating/SwipeDeck";
import ProfileDetail from "../dating/ProfileDetail";
import MatchCelebration from "../dating/MatchCelebration";
import DatingProfileEditor from "../dating/DatingProfileEditor";
import DatingChat from "../dating/DatingChat";
import DatingSystemPanel from "../dating/DatingSystemPanel";
import { canReport, findProfile } from "../../services/dating/datingMatching";
import { tagLabel } from "../../data/dating/interestTags";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { confirmLocalized } from "../../utils/i18n";
import EmptyState from "../common/EmptyState";
import SegmentedControl from "../common/SegmentedControl";
import { LargeTitle, LargeTitleHeader, useLargeTitle } from "../shell/LargeTitle";

// 各語言語序不同，整句一起翻，不拼接片段。
const refreshHint = (at, tr) => {
  const diff = at - Date.now();
  if (diff <= 0) return tr("隨時會有新的人出現", "New people could show up any moment.", "まもなく新しい人が現れます", "곧 새로운 사람이 나타나요");
  const hours = Math.ceil(diff / 3600000);
  return hours > 1
    ? tr(`約 ${hours} 小時後會有新的人出現`, `New people in about ${hours} hours.`, `約${hours}時間後に新しい人が現れます`, `약 ${hours}시간 후 새로운 사람이 나타나요`)
    : tr("一小時內會有新的人出現", "New people within the hour.", "1時間以内に新しい人が現れます", "1시간 안에 새로운 사람이 나타나요");
};

function EmptyDeck({ refreshAt, tr }) {
  return (
    <div className="dt-empty">
      <EmptyState
        icon="heart"
        title={tr("附近沒有人了", "No one nearby right now", "近くにはもう誰もいません", "주변에 더 이상 사람이 없어요")}
        text={refreshAt ? refreshHint(refreshAt, tr) : tr("稍後再回來看看", "Check back later.", "また後で見に来てね", "나중에 다시 확인해 보세요")}
      />
    </div>
  );
}

function MatchList({ matches, relations, blocked, onOpenChat, onOpenProfile, tr }) {
  if (!matches.length) {
    return (
      <div className="dt-empty">
        <EmptyState
          icon="chat"
          title={tr("還沒有配對", "No matches yet", "まだマッチがありません", "아직 매칭이 없어요")}
          text={tr("右滑喜歡的人，等對方回應", "Swipe right on people you like and wait for them to respond.", "気になる人を右スワイプして、返事を待ちましょう", "마음에 드는 사람을 오른쪽으로 넘기고 답을 기다려 보세요")}
        />
      </div>
    );
  }
  const tagSeparator = tr("、", ", ", "、", ", ");
  // 最近有動靜的排最上面：最後一則訊息時間，沒聊過就用配對時間。
  const lastActivity = (match) => {
    const messages = relations[match.profileId]?.messages;
    return Number(messages?.[messages.length - 1]?.time) || Number(match.at) || 0;
  };
  const sorted = [...matches].sort((a, b) => lastActivity(b) - lastActivity(a));
  return (
    <div className="dt-list">
      {sorted.map((match) => {
        const entry = findProfile(match.profileId);
        if (!entry) return null;
        const photo = sanitizeUserImageUrl(entry.profile.photos?.[0]);
        const relation = relations[match.profileId];
        const last = relation?.messages?.[relation.messages.length - 1];
        return (
          <div key={match.profileId} className="dt-list-row" onClick={() => onOpenChat(match.profileId)}>
            <button type="button" className="dt-list-av" onClick={(event) => { event.stopPropagation(); onOpenProfile(entry); }} aria-label={tr(`${entry.profile.name} 的檔案`, `${entry.profile.name}'s profile`, `${entry.profile.name}のプロフィール`, `${entry.profile.name}의 프로필`)}>
              {photo ? <img src={photo} alt="" /> : entry.profile.name?.[0]}
            </button>
            <div className="dt-list-body">
              <div className="dt-list-name">
                {entry.profile.name}
                {match.superLike && <span className="dt-list-star">★</span>}
                {relation?.contactCharId && <span className="dt-list-tagged">{tr("已加入聯絡人", "In contacts", "連絡先に追加済み", "연락처에 추가됨")}</span>}
                {blocked[match.profileId] && <span className="dt-list-tagged blocked">{tr("已封鎖", "Blocked", "ブロック中", "차단됨")}</span>}
              </div>
              <div className="dt-list-sub">
                {last?.content || (match.shared?.length
                  ? (() => {
                    const shared = match.shared.slice(0, 2).map((tag) => tagLabel(tag, tr)).join(tagSeparator);
                    return tr(`都喜歡 ${shared}`, `You both like ${shared}`, `共通の好き：${shared}`, `둘 다 좋아하는 것: ${shared}`);
                  })()
                  : tr("開始聊聊吧", "Say hello!", "話しかけてみよう", "대화를 시작해 보세요"))}
              </div>
            </div>
            {relation?.unread > 0 && (
              <span className="dt-list-dot" aria-label={tr(`${relation.unread} 則未讀`, `${relation.unread} unread`, `未読 ${relation.unread} 件`, `읽지 않은 메시지 ${relation.unread}개`)}>
                {relation.unread > 99 ? "99+" : relation.unread}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DatingApp({ closeApp, dating, playerProfile, onPromoteToContact, onOpenContact, showToast, tr }) {
  const largeTitle = useLargeTitle(); // 必須在任何 early return（聊天室）之前
  const [tab, setTab] = useState("deck");
  // 換分頁時捲動容器會重建、回到頂端，大標題也要跟著展開，否則頂端會留一塊空白。
  const switchTab = (next) => {
    largeTitle.onScroll({ currentTarget: { scrollTop: 0 } });
    setTab(next);
  };
  const [detail, setDetail] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const {
    state, deck, swipe, rewind, updateProfile, markMatchSeen, refreshAt, unseenMatches,
    typingProfiles, openChatId, openChat, closeChat, clearOpenChat, sendMessage, retryReply, promoteToContact,
    setBlocked, report, claimReportReward, cancelAllReplies,
  } = dating;

  useEffect(() => () => { cancelAllReplies("Dating app left"); clearOpenChat(); }, [cancelAllReplies, clearOpenChat]);

  // 配對是延遲熟成的，所以慶祝畫面在玩家下次打開 App 時補放。
  const pendingCelebration = celebration || (tab === "deck" && unseenMatches[0]) || null;
  const celebrationEntry = pendingCelebration ? findProfile(pendingCelebration.profileId) : null;

  const doSwipe = (profileId, action) => {
    if (action === "super" && state.superLikes <= 0) return showToast?.(tr("Super Like 用完了", "You're out of Super Likes", "Super Likeを使い切りました", "Super Like를 모두 사용했어요"));
    setDetail(null);
    return swipe(profileId, action);
  };
  const lastSwiped = Object.entries(state.swiped).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0];
  // 只有最近一次是「跳過」才能回上一張；喜歡過的要等冷卻後自然回到牌堆。
  const canRewind = lastSwiped?.[1]?.action === "pass";

  const [chatDraft, setChatDraft] = useState("");
  const enterChat = (profileId, draft = "") => { setChatDraft(draft); setCelebration(null); switchTab("matches"); openChat(profileId); };
  // 有獎可領就在系統分頁掛紅點，否則玩家等了兩天回來根本不知道結果出了
  const claimable = state.reports.some((item) => item.status === "confirmed" && !item.claimed);

  const unblockedText = tr("已解除封鎖", "Unblocked", "ブロックを解除しました", "차단을 해제했어요");
  // 檢舉一定連帶封鎖，所以送出前要講清楚——這是不可逆的。
  const safetyProps = (profileId) => ({
    blocked: !!state.blocked[profileId],
    canReport: canReport(state.relations[profileId]) && !state.reports.some((item) => item.profileId === profileId),
    onToggleBlock: (next) => {
      setBlocked(profileId, next);
      showToast?.(next
        ? tr("已封鎖，對方不會再出現也無法傳訊息", "Blocked. They won't appear again or be able to message you.", "ブロックしました。相手は表示されず、メッセージも送れません。", "차단했어요. 상대는 다시 나타나지 않고 메시지도 보낼 수 없어요.")
        : unblockedText);
    },
    onReport: () => {
      if (!confirmLocalized(tr(
        "提交檢舉會同時封鎖此使用者，且無法復原。\n審核需要 1～2 個工作天，結果會通知你。\n確定要檢舉嗎？",
        "Reporting will also block this user and can't be undone.\nReview takes 1–2 business days, and we'll notify you of the result.\nReport this user?",
        "通報すると同時にこのユーザーをブロックし、元に戻せません。\n審査には1〜2営業日かかり、結果はお知らせします。\n通報しますか？",
        "신고하면 이 사용자도 함께 차단되며 되돌릴 수 없어요.\n검토에는 영업일 기준 1~2일이 걸리며 결과를 알려 드려요.\n신고할까요?",
      ))) return;
      report(profileId);
      setDetail(null);
      showToast?.(tr("檢舉已送出，審核中", "Report submitted. Under review.", "通報を送信しました。審査中です。", "신고가 접수되었어요. 검토 중이에요."));
    },
  });

  const appTitle = tr("信風", "Tradewind", "信風", "신풍");
  const openEntry = openChatId ? findProfile(openChatId) : null;
  if (openEntry) {
    return (
      <div className="mp-page dt-page">
        <DatingChat
          entry={openEntry} relation={state.relations[openChatId]} typing={typingProfiles.has(openChatId)}
          blocked={!!state.blocked[openChatId]}
          tr={tr}
          initialDraft={chatDraft}
          onBack={() => { setChatDraft(""); closeChat(openChatId); }}
          onSend={(text) => { setChatDraft(""); sendMessage(openChatId, text); }}
          onRetry={() => retryReply(openChatId)}
          onOpenProfile={() => setDetail(openEntry)}
          onOpenContact={() => onOpenContact?.(state.relations[openChatId]?.contactCharId)}
          onPromote={() => {
            const charId = promoteToContact(openChatId, onPromoteToContact);
            const name = openEntry.profile.name;
            showToast?.(charId
              ? tr(`${name} 已加入聯絡人`, `${name} added to contacts`, `${name}を連絡先に追加しました`, `${name}님을 연락처에 추가했어요`)
              : tr("加入失敗", "Couldn't add contact", "追加できませんでした", "추가하지 못했어요"));
          }}
        />
        {/* 已配對的檔案是純瀏覽：不給動作列，完整角色卡要等加入聯絡人 */}
        {detail && <ProfileDetail entry={detail} onClose={() => setDetail(null)} {...safetyProps(detail.id)} tr={tr} />}
      </div>
    );
  }

  return (
    <div className={`${largeTitle.pageClassName} dt-page`}>
      <LargeTitleHeader title={appTitle} onBack={closeApp} backLabel={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")} />
      {/* 探索頁固定不捲（牌堆要填滿剩餘高度）；其他分頁由 dt-body 整頁捲動，大標題才會收進頂欄。 */}
      <div key={tab} className={`dt-body ${tab === "deck" ? "" : "dt-body--scroll"}`} onScroll={tab === "deck" ? undefined : largeTitle.onScroll}>
        <LargeTitle title={appTitle} />
        <div className="dt-seg">
          <SegmentedControl
            items={[
              { id: "deck", label: tr("探索", "Discover", "さがす", "탐색") },
              { id: "matches", label: tr("配對", "Matches", "マッチ", "매칭"), badge: unseenMatches.length > 0 },
              { id: "me", label: tr("個人資料", "Profile", "プロフィール", "프로필") },
              { id: "system", label: tr("系統", "System", "システム", "시스템"), badge: claimable },
            ]}
            value={tab}
            onChange={switchTab}
            ariaLabel={tr("信風分頁", "Tradewind sections", "信風のセクション", "신풍 섹션")}
          />
        </div>
        {tab === "deck" && (deck.length
          ? <SwipeDeck deck={deck} superLikes={state.superLikes} canRewind={canRewind} onSwipe={doSwipe} tr={tr}
              onRewind={() => rewind(lastSwiped[0])} onOpenDetail={setDetail} />
          : <EmptyDeck refreshAt={refreshAt} tr={tr} />)}
        {tab === "matches" && <MatchList matches={state.matches} relations={state.relations} blocked={state.blocked}
          onOpenChat={enterChat} onOpenProfile={setDetail} tr={tr} />}
        {tab === "me" && <DatingProfileEditor profile={state.profile} updateProfile={updateProfile} playerName={playerProfile?.name} showToast={showToast} tr={tr} />}
        {tab === "system" && <DatingSystemPanel state={state} onClaim={claimReportReward} tr={tr}
          onUnblock={(profileId) => { setBlocked(profileId, false); showToast?.(unblockedText); }} />}
      </div>
      {/* 已配對的人只能瀏覽，不再給滑動按鈕 */}
      {detail && <ProfileDetail entry={detail} superLikes={state.superLikes} onClose={() => setDetail(null)} {...safetyProps(detail.id)} tr={tr}
        onSwipe={state.matches.some((item) => item.profileId === detail.id) ? null : (action) => doSwipe(detail.id, action)} />}
      {pendingCelebration && celebrationEntry && (
        <MatchCelebration match={pendingCelebration} entry={celebrationEntry} tr={tr}
          playerPhoto={state.profile.photos?.[0] || playerProfile?.avatar} playerName={playerProfile?.name}
          onOpenChat={(draft) => enterChat(pendingCelebration.profileId, draft)}
          onKeepSwiping={() => { markMatchSeen(pendingCelebration.profileId); setCelebration(null); }} />
      )}
    </div>
  );
}
