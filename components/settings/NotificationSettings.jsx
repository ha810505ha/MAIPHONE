import React from "react";

const Switch = ({ checked, onChange, disabled }) => (
  <button type="button" role="switch" aria-checked={!!checked} disabled={disabled}
    className={`mp-switch ${checked ? "active" : ""}`} style={disabled ? { opacity: .4, cursor: "default" } : undefined}
    onClick={() => onChange(!checked)}><span /></button>
);

const Row = ({ label, hint, children }) => (
  <div className="mp-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
    <div style={{ minWidth: 0 }}>
      <div className="mp-lbl">{label}</div>
      {hint && <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.55, marginTop: 2 }}>{hint}</div>}
    </div>
    {children}
  </div>
);

export default function NotificationSettings({ tr, settings, updateSettings }) {
  const patchSection = (section, key, value) => updateSettings({ [section]: { ...settings[section], [key]: value } });
  const off = !settings.enabled;
  const typeLabels = [
    ["message", tr("角色訊息", "Character messages", "キャラのメッセージ", "캐릭터 메시지")],
    ["match", tr("信風配對", "Matches", "マッチング", "매칭")],
    ["like", tr("有人喜歡你", "New likes", "いいね", "좋아요")],
    ["social", tr("社群動態", "Social updates", "ソーシャル", "소셜")],
    ["wallet", tr("錢包入帳", "Wallet", "ウォレット", "지갑")],
    ["mailbox", tr("系統信箱", "System mailbox", "システムメール", "시스템 우편함")],
  ];
  const surfaceLabels = [
    ["banner", tr("App 內橫幅", "In-app banner", "アプリ内バナー", "앱 내 배너"), tr("使用其他 App 時從上方滑入", "Slides in from the top while using other apps", "他のアプリ利用中に上部から表示", "다른 앱 사용 중 상단에서 표시")],
    ["lockScreen", tr("鎖定畫面", "Lock screen", "ロック画面", "잠금 화면"), tr("解鎖前就能看到並直接點入", "Visible and tappable before unlocking", "ロック解除前に確認できます", "잠금 해제 전에 확인 가능")],
    ["badge", tr("圖示紅點", "Icon badge", "アイコンバッジ", "아이콘 배지"), tr("桌面 App 圖示右上角的小圓點", "A dot on the home screen app icon", "ホーム画面アイコンの右上に表示", "홈 화면 아이콘 우측 상단 점")],
  ];
  return <>
    <div className="mp-sg">
      <Row label={tr("接收通知", "Notifications", "通知を受け取る", "알림 받기")}
        hint={tr("關閉後仍會累積未讀，只是不再提醒你。", "Unread items still accumulate; you just stop being alerted.", "オフにしても未読は蓄積されます。通知されなくなるだけです。", "꺼도 읽지 않은 항목은 계속 쌓이며, 알림만 오지 않습니다.")}>
        <Switch checked={settings.enabled} onChange={(value) => updateSettings({ enabled: value })} />
      </Row>
    </div>

    <div className="mp-sg">
      <div className="mp-sg-t">{tr("通知方式", "Where to show", "表示場所", "표시 위치")}</div>
      {surfaceLabels.map(([key, label, hint]) => (
        <Row key={key} label={label} hint={hint}>
          <Switch checked={settings.surfaces[key]} disabled={off} onChange={(value) => patchSection("surfaces", key, value)} />
        </Row>
      ))}
    </div>

    <div className="mp-sg">
      <div className="mp-sg-t">{tr("通知類型", "Types", "通知の種類", "알림 종류")}</div>
      {typeLabels.map(([key, label]) => (
        <Row key={key} label={label}>
          <Switch checked={settings.types[key]} disabled={off} onChange={(value) => patchSection("types", key, value)} />
        </Row>
      ))}
    </div>

    <div className="mp-sg">
      <Row label={tr("勿擾時段", "Quiet hours", "おやすみ時間", "방해 금지 시간")}
        hint={tr("這段時間內不跳橫幅，未讀改由紅點與鎖定畫面承接。", "No banners during this window; unread items fall back to the badge and lock screen.", "この時間帯はバナーを表示せず、バッジとロック画面で確認します。", "이 시간에는 배너를 표시하지 않고 배지와 잠금 화면으로 확인합니다.")}>
        <Switch checked={settings.quietHours.enabled} disabled={off} onChange={(value) => patchSection("quietHours", "enabled", value)} />
      </Row>
      {settings.quietHours.enabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input type="time" className="mp-ssel" style={{ flex: 1 }} value={settings.quietHours.start}
            onChange={(event) => patchSection("quietHours", "start", event.target.value)} />
          <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>→</span>
          <input type="time" className="mp-ssel" style={{ flex: 1 }} value={settings.quietHours.end}
            onChange={(event) => patchSection("quietHours", "end", event.target.value)} />
        </div>
      )}
    </div>

    <div className="mp-sg">
      <Row label={tr("暫停角色主動傳訊息", "Pause proactive messages", "キャラからの自動送信を停止", "캐릭터 자동 메시지 중지")}
        hint={tr("這個開關省的是 API 額度，不是打擾：角色不會再自動生成訊息。", "This one saves API quota rather than attention: characters stop generating messages on their own.", "これは通知ではなく API の消費を抑える設定です。キャラが自動でメッセージを生成しなくなります。", "이 설정은 알림이 아니라 API 사용량을 줄입니다. 캐릭터가 스스로 메시지를 생성하지 않습니다.")}>
        <Switch checked={settings.pauseProactive} onChange={(value) => updateSettings({ pauseProactive: value })} />
      </Row>
    </div>
  </>;
}
