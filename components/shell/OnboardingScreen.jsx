import React, { useState } from "react";
import Icon from "../common/Icon";

// 初次開啟引導（MP-095）：浮在小手機上的一層，角落永遠有「略過」，玩家不可能被困在這裡。
// 新玩家 → 四頁教學（每頁都能跳過）；老玩家 → 開到「設定 → 資料」登入或匯入。
const overlayStyle = { position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(40,20,30,.42)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" };
const cardStyle = { width: "100%", maxWidth: 340, borderRadius: 22, padding: "22px 20px 18px", background: "var(--mp-surface, #fff)", color: "var(--mp-txt, #4a3540)", boxShadow: "0 18px 50px rgba(0,0,0,.25)", position: "relative" };
const skipStyle = { position: "absolute", top: 10, right: 12, border: 0, background: "transparent", color: "var(--mp-txt-l)", fontSize: 12, padding: "6px 8px", cursor: "pointer" };
const primaryStyle = { width: "100%", border: 0, borderRadius: 14, padding: "12px 14px", fontSize: 14, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,var(--mp-pink,#f48fb1),var(--mp-pink-dk,#e57399))", cursor: "pointer" };
const secondaryStyle = { ...primaryStyle, color: "var(--mp-txt)", background: "var(--mp-page-control-bg,var(--mp-card-bg,#f6f0f2))", border: "1px solid var(--mp-card-border, rgba(0,0,0,.08))" };

export function tutorialPages(tr) {
  return [
    {
      icon: "phone",
      title: tr("這是你的小手機", "This is your phone", "これがあなたのスマホ", "이것이 당신의 휴대폰"),
      body: tr("每個 App 都是一個小世界：聊天、社群、筆記、遊戲中心、雲隱山莊。從首頁點圖示就能進去，往上滑或按返回就能回來。", "Every app is its own little world: chats, social, notes, Game Center, Cloudveil Villa. Tap an icon on the home screen to enter; swipe up or go back to return.", "それぞれのアプリが小さな世界です：チャット、SNS、ノート、ゲームセンター、雲隠山荘。ホームのアイコンから入り、上スワイプか戻るで帰れます。", "각 앱은 작은 세계입니다: 채팅, 소셜, 노트, 게임 센터, 운은산장. 홈 화면 아이콘으로 들어가고 위로 밀거나 뒤로 가기로 돌아옵니다."),
    },
    {
      icon: "users",
      title: tr("先新增一位角色", "Add your first character", "まずキャラを追加", "먼저 캐릭터 추가"),
      body: tr("到「聯絡人」按「新增」建立角色或匯入角色卡。聊天要接上 AI：到「設定 → AI」填你自己的 API 金鑰，金鑰只留在這台裝置。", "Open Contacts and tap Add to create a character or import a character card. To chat, connect an AI under Settings → AI with your own API key; the key stays on this device only.", "「連絡先」で「追加」を押してキャラを作るか、キャラカードを取り込みます。チャットには AI が必要です：「設定 → AI」で自分の API キーを入れてください。キーはこの端末だけに保存されます。", "연락처에서 추가를 눌러 캐릭터를 만들거나 캐릭터 카드를 가져오세요. 채팅하려면 설정 → AI에서 본인의 API 키를 입력하세요. 키는 이 기기에만 저장됩니다."),
    },
    {
      icon: "refresh",
      title: tr("存檔會自動保護", "Your save is protected", "セーブは自動で守られます", "저장은 자동으로 보호됩니다"),
      body: tr("登入 Google 帳號後，進度會自動同步到雲端，換裝置登入就回來。沒登入也會每天提醒你備份，隨時可以匯出備份檔或存到 Google 雲端硬碟。", "Sign in with Google and your progress syncs to the cloud automatically; sign in on another device to get it back. Even without signing in, you get a daily backup reminder and can export a backup file or save to Google Drive anytime.", "Google でログインすると進行は自動でクラウドに同期され、別の端末でログインすれば戻ります。未ログインでも毎日バックアップをお知らせし、いつでも書き出しや Google ドライブ保存ができます。", "Google로 로그인하면 진행 상황이 자동으로 클라우드에 동기화되어 다른 기기에서 로그인하면 돌아옵니다. 로그인하지 않아도 매일 백업 알림을 받고 언제든 백업 파일을 내보내거나 Google 드라이브에 저장할 수 있습니다."),
    },
    {
      icon: "bell",
      title: tr("通知與設定", "Alerts and settings", "通知と設定", "알림과 설정"),
      body: tr("角色傳訊息、山莊田熟、登入獎勵都會像真手機一樣從上方滑下通知。「設定 → 通知」可以調整要收哪些；外觀、語言、字體也都在設定裡。", "Character messages, ripe villa crops and login rewards slide in from the top like a real phone. Choose what to receive under Settings → Alerts; theme, language and fonts are there too.", "キャラのメッセージ、山荘の収穫、ログイン報酬は本物のスマホのように上から通知が降りてきます。「設定 → 通知」で受け取る種類を選べ、外観・言語・フォントも設定にあります。", "캐릭터 메시지, 산장 수확, 로그인 보상이 실제 휴대폰처럼 위에서 알림으로 내려옵니다. 설정 → 알림에서 받을 항목을 고르고, 외관·언어·글꼴도 설정에 있습니다."),
    },
  ];
}

export default function OnboardingScreen({ tr, onNewPlayer, onReturningPlayer, onSkip }) {
  const [page, setPage] = useState(-1); // -1：選擇畫面；0..n-1：教學頁
  const pages = tutorialPages(tr);
  const skipLabel = tr("略過", "Skip", "スキップ", "건너뛰기");
  const finish = () => onNewPlayer?.();

  if (page < 0) {
    return (
      <div role="dialog" aria-modal="true" data-onboarding="choice" style={overlayStyle}>
        <div style={cardStyle}>
          <button type="button" style={skipStyle} onClick={onSkip}>{skipLabel}</button>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{tr("歡迎來到 MaliPhone", "Welcome to MaliPhone", "MaliPhone へようこそ", "MaliPhone에 오신 것을 환영합니다")}</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--mp-txt-l)", marginBottom: 16 }}>{tr("先告訴我們你是誰，之後隨時可以在設定裡重看。", "Tell us which one you are. You can revisit this from Settings anytime.", "どちらか教えてください。設定からいつでも見直せます。", "어느 쪽인지 알려주세요. 설정에서 언제든 다시 볼 수 있습니다.")}</div>
          <div style={{ display: "grid", gap: 10 }}>
            <button type="button" style={primaryStyle} onClick={() => setPage(0)}>{tr("我是新玩家，看一下教學", "I'm new, show me around", "初めてです。使い方を見る", "처음이에요, 사용법 보기")}</button>
            <button type="button" style={secondaryStyle} onClick={onReturningPlayer}>{tr("我玩過，要找回進度", "I've played before, restore my progress", "遊んだことがあります。進行を戻す", "해본 적 있어요, 진행 상황 복구")}</button>
          </div>
          <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.6, marginTop: 12 }}>{tr("找回進度：登入 Google 帳號會自動載入雲端存檔，或在同一頁匯入備份檔。", "Restoring: signing in with Google loads your cloud save automatically, or import a backup file on the same page.", "進行を戻す：Google でログインするとクラウドのセーブを自動で読み込みます。同じ画面でバックアップの取り込みもできます。", "복구: Google로 로그인하면 클라우드 저장을 자동으로 불러오고, 같은 페이지에서 백업 파일도 가져올 수 있습니다.")}</div>
        </div>
      </div>
    );
  }

  const current = pages[Math.min(page, pages.length - 1)];
  const last = page >= pages.length - 1;
  return (
    <div role="dialog" aria-modal="true" data-onboarding={`tutorial-${page + 1}`} style={overlayStyle}>
      <div style={cardStyle}>
        <button type="button" style={skipStyle} onClick={finish}>{skipLabel}</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ width: 40, height: 40, borderRadius: 14, display: "grid", placeItems: "center", background: "color-mix(in srgb,var(--mp-pink,#f48fb1) 18%,transparent)", color: "var(--mp-pink-dk,#e57399)" }}><Icon name={current.icon} size={22} /></span>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{current.title}</div>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.75, color: "var(--mp-txt)", minHeight: 96 }}>{current.body}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "12px 0" }}>
          {pages.map((_, index) => <span key={index} aria-hidden="true" style={{ width: index === page ? 18 : 6, height: 6, borderRadius: 3, background: index === page ? "var(--mp-pink-dk,#e57399)" : "var(--mp-card-border, rgba(0,0,0,.15))", transition: "width 160ms" }} />)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {page > 0 && <button type="button" style={{ ...secondaryStyle, width: "auto", flex: "0 0 auto", padding: "12px 16px" }} onClick={() => setPage(page - 1)}>{tr("上一步", "Back", "戻る", "이전")}</button>}
          <button type="button" style={{ ...primaryStyle, flex: 1 }} onClick={() => (last ? finish() : setPage(page + 1))}>{last ? tr("開始使用", "Get started", "はじめる", "시작하기") : tr("下一步", "Next", "次へ", "다음")}</button>
        </div>
      </div>
    </div>
  );
}
