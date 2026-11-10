import React from "react";
import { findProfile } from "../../services/dating/datingMatching";
import { REPORT_REWARD_SUPER_LIKES } from "../../constants/dating";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

const name = (profileId) => findProfile(profileId)?.profile.name || profileId;
const uiLocale = () => (typeof document !== "undefined" && document.documentElement.lang) || "zh-TW";
const when = (time) => (time ? new Date(time).toLocaleDateString(uiLocale(), { month: "numeric", day: "numeric" }) : "");

// superLikeLog 回補帳目的來源文案（MP-051）。新來源記得補這裡，否則顯示「系統補發」。
const GRANT_SOURCE_LABELS = {
  weekly: (tr) => tr("每週補滿", "Weekly refill", "週次補充", "주간 충전"),
  contact: (tr) => tr("交換聯絡方式", "Exchanged contacts", "連絡先交換", "연락처 교환"),
  report: (tr) => tr("檢舉成立", "Report upheld", "通報成立", "신고 승인"),
  shop: (tr) => tr("商店購買", "Store purchase", "ストア購入", "상점 구매"),
  loginStreak: (tr) => tr("連續登入第 7 天", "Day 7 login streak", "7日連続ログイン", "7일 연속 로그인"),
};

/**
 * 帳號後台：SL 餘額、官方通知、封鎖名單、檢舉紀錄。
 * 封鎖與檢舉的「動作」刻意留在對方的檔案頁——那是形成判斷的地方；
 * 這裡只負責事後的查看與撤銷。
 */
export default function DatingSystemPanel({ state, onClaim, onUnblock, tr = (zhTW) => zhTW }) {
  const { superLikes, superLikeLog = [], reports = [], blocked = {} } = state;
  const blockedIds = Object.keys(blocked).sort((a, b) => blocked[b] - blocked[a]);
  const reviewing = reports.filter((item) => item.status === "reviewing");
  const resolved = reports.filter((item) => item.status !== "reviewing");

  return (
    <div className="dt-me">
      <div className="dt-sg">
        <div className="dt-sg-t">Super Like</div>
        <div className="dt-sl-count"><span>{superLikes}</span> {tr("個可用", "available", "個使用可能", "개 사용 가능")}</div>
        <div className="dt-me-hint">{tr(
          "Super Like 大幅提高配對成功率，對方也會知道你用了，回覆通常更快。每週一補滿到 3、交換聯絡方式 +1、檢舉成立 +2，商店也可購買。",
          "Super Likes greatly boost your match rate. They'll know you used one, and usually reply faster. Refilled to 3 every Monday, +1 for exchanging contacts, +2 for an upheld report, and available in the Store.",
          "Super Likeを使うとマッチ率が大きく上がり、相手にも伝わるので返信も早くなりがちです。毎週月曜に3個まで補充、連絡先交換で+1、通報成立で+2、ストアでも購入できます。",
          "Super Like는 매칭 확률을 크게 높여 줘요. 상대도 알게 되어 보통 답장이 더 빨라요. 매주 월요일 3개까지 충전, 연락처 교환 +1, 신고 승인 +2, 상점에서도 구매할 수 있어요.",
        )}</div>
        {superLikeLog.length > 0 && (
          <div className="dt-sl-log">
            {superLikeLog.map((item) => {
              // 回補帳目（status "granted"）沒有對象，左欄改顯示來源，右欄顯示 +N。
              if (item.status === "granted") {
                const sourceLabel = GRANT_SOURCE_LABELS[item.source]
                  ? GRANT_SOURCE_LABELS[item.source](tr)
                  : tr("系統補發", "System grant", "システム付与", "시스템 지급");
                return (
                  <div key={`granted-${item.source}-${item.at}`} className="dt-slog">
                    <span>{sourceLabel}{item.at ? ` · ${when(item.at)}` : ""}</span>
                    <span className="dt-slog-s granted">+{Math.max(1, Number(item.count) || 1)}</span>
                  </div>
                );
              }
              const status = item.status === "matched" ? tr("已配對", "Matched", "マッチ済み", "매칭됨")
                : item.status === "silent" ? tr("未回應", "No response", "反応なし", "응답 없음")
                  : tr("等待中", "Waiting", "待機中", "대기 중");
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
        <div className="dt-sg-t">{tr("官方通知", "Notices", "お知らせ", "공지")}{reports.length > 0 && <span>{reports.length}</span>}</div>
        {!reports.length && <div className="dt-me-hint">{tr("目前沒有訊息。", "No messages yet.", "お知らせはありません。", "아직 메시지가 없어요.")}</div>}
        {reviewing.map((item) => (
          <div key={item.profileId} className="dt-notice">
            <div className="dt-notice-t">{tr("檢舉審核中", "Report under review", "通報を審査中", "신고 검토 중")}<span className="dt-notice-d">{when(item.at)}</span></div>
            <div className="dt-notice-b">{tr(
              `我們已收到您對「${name(item.profileId)}」的檢舉，人工審核需要 1～2 個工作天，結果會另行通知。`,
              `We've received your report about "${name(item.profileId)}". Manual review takes 1–2 business days, and we'll let you know the result.`,
              `「${name(item.profileId)}」に関する通報を受け付けました。審査には1〜2営業日かかります。結果は別途お知らせします。`,
              `「${name(item.profileId)}」에 대한 신고를 접수했어요. 검토에는 영업일 기준 1~2일이 걸리며, 결과는 따로 알려 드릴게요.`,
            )}</div>
          </div>
        ))}
        {resolved.map((item) => {
          const ok = item.status === "confirmed";
          return (
            <div key={item.profileId} className={`dt-notice ${ok ? "ok" : ""}`}>
              <div className="dt-notice-t">{ok ? tr("檢舉成立", "Report upheld", "通報が認められました", "신고가 승인되었어요") : tr("查無違規", "No violation found", "違反は見つかりませんでした", "위반 사항 없음")}<span className="dt-notice-d">{when(item.resolvedAt || item.at)}</span></div>
              <div className="dt-notice-b">
                {ok
                  ? tr(
                    `經查證，「${name(item.profileId)}」確實違反社群守則，我們已停用該帳號。感謝您協助維護信風的社群安全，謹奉上一點心意。`,
                    `After review, "${name(item.profileId)}" was found to violate our community guidelines and the account has been disabled. Thank you for helping keep Tradewind safe. Here's a small token of thanks.`,
                    `審査の結果、「${name(item.profileId)}」はコミュニティガイドラインに違反していたため、アカウントを停止しました。信風の安全へのご協力に感謝し、ささやかなお礼をお贈りします。`,
                    `검토 결과 「${name(item.profileId)}」은(는) 커뮤니티 가이드라인을 위반해 계정을 정지했어요. 신풍을 안전하게 지켜 주셔서 감사드리며, 작은 감사의 선물을 드려요.`,
                  )
                  : tr(
                    `經查證，「${name(item.profileId)}」並未違反社群守則，我們不會對該帳號採取行動。您的封鎖設定仍然有效。`,
                    `After review, "${name(item.profileId)}" did not violate our community guidelines, so we won't take action. Your block remains in place.`,
                    `審査の結果、「${name(item.profileId)}」にガイドライン違反は見られなかったため、対応は行いません。ブロック設定はそのまま有効です。`,
                    `검토 결과 「${name(item.profileId)}」은(는) 커뮤니티 가이드라인을 위반하지 않아 별도 조치는 하지 않아요. 차단 설정은 그대로 유지돼요.`,
                  )}
              </div>
              {ok && (item.claimed
                ? <div className="dt-notice-done">{tr(`已領取 Super Like ×${REPORT_REWARD_SUPER_LIKES}`, `Claimed Super Like ×${REPORT_REWARD_SUPER_LIKES}`, `Super Like ×${REPORT_REWARD_SUPER_LIKES} 受け取り済み`, `Super Like ×${REPORT_REWARD_SUPER_LIKES} 받음`)}</div>
                : <button type="button" className="dt-notice-claim" onClick={() => onClaim(item.profileId)}>{tr(`領取 Super Like ×${REPORT_REWARD_SUPER_LIKES}`, `Claim Super Like ×${REPORT_REWARD_SUPER_LIKES}`, `Super Like ×${REPORT_REWARD_SUPER_LIKES} を受け取る`, `Super Like ×${REPORT_REWARD_SUPER_LIKES} 받기`)}</button>)}
            </div>
          );
        })}
      </div>

      <div className="dt-sg">
        <div className="dt-sg-t">{tr("封鎖名單", "Blocked", "ブロックリスト", "차단 목록")}{blockedIds.length > 0 && <span>{blockedIds.length}</span>}</div>
        {!blockedIds.length && <div className="dt-me-hint">{tr(
          "還沒有封鎖任何人。封鎖後對方不會再出現在探索，也無法傳訊息給你。",
          "You haven't blocked anyone. Blocked people won't appear in Discover or be able to message you.",
          "まだ誰もブロックしていません。ブロックした相手はさがすに表示されず、メッセージも送れません。",
          "아직 차단한 사람이 없어요. 차단하면 탐색에 나타나지 않고 메시지도 보낼 수 없어요.",
        )}</div>}
        {blockedIds.map((profileId) => {
          const entry = findProfile(profileId);
          const photo = sanitizeUserImageUrl(entry?.profile.photos?.[0]);
          const reported = reports.find((item) => item.profileId === profileId);
          return (
            <div key={profileId} className="dt-block-row">
              <div className="dt-list-av" style={{ cursor: "default" }}>{photo ? <img src={photo} alt="" /> : name(profileId)[0]}</div>
              <div className="dt-list-body">
                <div className="dt-list-name">{name(profileId)}</div>
                <div className="dt-list-sub">
                  {tr(`${when(blocked[profileId])} 封鎖`, `Blocked ${when(blocked[profileId])}`, `${when(blocked[profileId])} ブロック`, `${when(blocked[profileId])} 차단`)}
                  {reported ? tr("・已檢舉", " · Reported", "・通報済み", " · 신고함") : ""}
                </div>
              </div>
              {/* 檢舉成立的帳號已被平台停用，解封也回不來 */}
              {reported?.status === "confirmed"
                ? <span className="dt-block-gone">{tr("帳號已停用", "Account disabled", "アカウント停止済み", "계정 정지됨")}</span>
                : <button type="button" className="dt-block-undo" onClick={() => onUnblock(profileId)}>{tr("解除", "Unblock", "解除", "해제")}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
