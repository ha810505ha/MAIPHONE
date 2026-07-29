import React, { useEffect, useRef, useState } from "react";
import { useMusicPlayer } from "../../contexts/MusicPlayerContext";
import { generateMusicReaction, generateSongPick } from "../../services/music/musicReactionService";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

const GLASS = { background: "var(--mp-card-bg)", border: "1px solid var(--mp-card-border)" };
const SOURCE_LABELS = { sp: "Spotify", yt: "YouTube" };

export default function MusicApp({ closeApp, apiConfig, characters = [], playerProfile, tr }) {
  const mp = useMusicPlayer();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [charId, setCharId] = useState(null);
  const reactTimer = useRef(null);
  const reactedPairsRef = useRef(new Set());
  const reactionRequestRef = useRef(0);
  const activeChar = characters.find((c) => String(c.id) === String(charId)) || null;

  // 歌曲切換 → 角色即時反應（去抖 15 秒，快速跳歌不會轟炸 AI）
  useEffect(() => {
    clearTimeout(reactTimer.current);
    const requestId = ++reactionRequestRef.current;
    if (!mp.track || !activeChar) return;
    const reactionKey = `${mp.track.id}::${activeChar.id}`;
    if (reactedPairsRef.current.has(reactionKey)) return;
    const trackAtSchedule = mp.track;
    const characterAtSchedule = activeChar;
    reactTimer.current = setTimeout(async () => {
      reactedPairsRef.current.add(reactionKey);
      const text = await generateMusicReaction({ track: trackAtSchedule, character: characterAtSchedule, playerProfile, apiConfig });
      if (text && reactionRequestRef.current === requestId) {
        mp.setCharReaction({ text, characterName: characterAtSchedule.name, ts: Date.now() });
      }
    }, 15000);
    return () => clearTimeout(reactTimer.current);
  }, [mp.track?.id, charId]);

  const chooseListener = (nextCharId) => {
    reactionRequestRef.current += 1;
    clearTimeout(reactTimer.current);
    mp.setCharReaction(null);
    setCharId(nextCharId);
  };

  const requestRecommendation = async (request = "") => {
    if (busy) return;
    if (!activeChar) {
      setError(tr("請先選一位一起聽歌的角色，再請角色推薦歌曲", "Choose a character to listen with before asking for a recommendation.", "一緒に聴くキャラを選んでから、おすすめを頼んでください。", "함께 들을 캐릭터를 먼저 선택한 뒤 추천을 요청하세요."));
      return;
    }
    setError("");
    setBusy(true);
    try {
      const pick = await generateSongPick({
        request: request.trim() || tr("依照你現在的心情和品味，推薦一首想和玩家一起聽的歌", "Based on your current mood and taste, recommend a song you want to hear with the player.", "今の気分と好みに合わせて、プレイヤーと一緒に聴きたい曲を1曲おすすめして。", "지금 기분과 취향에 맞춰 플레이어와 함께 듣고 싶은 노래 한 곡을 추천해 줘."),
        character: activeChar,
        playerProfile,
        apiConfig,
      });
      mp.setCharPicks((items) => [{ ...pick, characterName: activeChar.name, ts: Date.now() }, ...items].slice(0, 8));
      setInput("");
    } catch (reason) {
      setError(reason?.message || tr("推薦歌曲失敗，請稍後再試", "Could not recommend a song. Please try again later.", "曲をおすすめできませんでした。しばらくしてからもう一度お試しください。", "노래를 추천하지 못했습니다. 잠시 후 다시 시도하세요."));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setError("");
    setInput("");
    if (/https?:\/\//.test(text) || /youtu\.?be|open\.spotify\.com/.test(text)) {
      setBusy(true);
      try {
        const played = await mp.play(text);
        if (!played) setError(tr("看不懂這個連結，目前支援 YouTube 與 Spotify", "This link isn't supported. YouTube and Spotify links are currently accepted.", "このリンクには対応していません。現在はYouTubeとSpotifyに対応しています。", "지원하지 않는 링크입니다. 현재 YouTube와 Spotify 링크를 지원합니다."));
      } catch (reason) {
        setError(reason?.message || tr("播放失敗，請確認連結", "Playback failed. Please check the link.", "再生できませんでした。リンクを確認してください。", "재생하지 못했습니다. 링크를 확인하세요."));
      } finally { setBusy(false); }
      return;
    }
    await requestRecommendation(text);
  };

  const openPickSearch = (pick) => {
    const query = encodeURIComponent(`${pick.title} ${pick.artist || ""}`.trim());
    window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank", "noopener");
  };

  const seekFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mp.seek((event.clientX - rect.left) / rect.width);
  };

  return (
    <div className="mp-page music-app-page" style={{ "--music-accent": "var(--mp-accent)", "--music-accent-soft": "var(--mp-accent-soft)", background: "var(--mp-page-bg)", padding: "var(--mp-space-md) var(--mp-space-md) var(--mp-space-lg)", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="mp-back" onClick={closeApp}>←</div>
        <div className="music-app-title" style={{ fontSize: 15, fontWeight: 900, color: "var(--mp-txt)" }}>🎧 {tr("一起聽歌", "Listen together", "一緒に音楽を聴く", "함께 음악 듣기")}</div>
        {mp.track && (
          <div style={{ ...GLASS, marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, borderRadius: 99, padding: "4px 10px" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: mp.isPlaying ? "var(--mp-success)" : "var(--mp-muted)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--mp-txt)" }}>{mp.isPlaying ? tr("播放中", "Playing", "再生中", "재생 중") : tr("已暫停", "Paused", "一時停止", "일시 정지")}</span>
          </div>
        )}
      </div>

      {/* 預設自己聽；選中的角色展開成膠囊，其他只留頭像 */}
      {
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, overflowX: "auto", scrollbarWidth: "none", padding: "3px 2px" }}
          onWheel={(event) => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY; }}>
          <button type="button" title={tr("不和角色一起聽", "Listen without a character", "キャラと一緒に聴かない", "캐릭터 없이 듣기")} onClick={() => chooseListener(null)}
            style={!activeChar
              ? { flex: "0 0 auto", border: 0, borderRadius: 99, padding: "7px 12px", background: "linear-gradient(135deg,var(--mp-bubble),var(--music-accent))", color: "var(--mp-on-accent)", fontSize: 11, fontWeight: 800, boxShadow: "var(--mp-shadow)" }
              : { flex: "0 0 auto", border: "1px solid var(--mp-card-border)", borderRadius: 99, padding: "7px 12px", background: "var(--mp-glass)", color: "var(--mp-muted)", fontSize: 11, fontWeight: 800 }}>
            🎧 {tr("自己聽", "Listen alone", "ひとりで聴く", "혼자 듣기")}
          </button>
          {characters.length > 0 && <span style={{ flex: "0 0 auto", fontSize: 10, fontWeight: 800, color: "var(--mp-muted)", letterSpacing: ".06em" }}>{tr("或和", "or with", "または", "또는")}</span>}
          {characters.map((c) => {
            const selected = String(c.id) === String(activeChar?.id);
            const avatar = sanitizeUserImageUrl(c.avatar);
            const face = (
              <span style={{ width: selected ? 24 : 30, height: selected ? 24 : 30, borderRadius: "50%", overflow: "hidden", flex: "0 0 auto",
                  background: "var(--mp-card-bg)", display: "grid", placeItems: "center", fontSize: selected ? 11 : 13,
                  border: selected ? 0 : "1.5px solid var(--mp-card-border)", boxShadow: selected ? "none" : "var(--mp-shadow)", transition: "all .18s" }}>
                {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (c.name?.[0] || "🙂")}
              </span>
            );
            return (
              <button key={c.id} type="button" title={c.name} onClick={() => chooseListener(c.id)}
                style={selected
                  ? { flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,var(--mp-bubble),var(--music-accent))", color: "var(--mp-on-accent)", border: 0, borderRadius: 99, padding: "3px 12px 3px 4px", fontSize: 11, fontWeight: 800, boxShadow: "var(--mp-shadow)", transition: "all .18s" }
                  : { flex: "0 0 auto", display: "grid", placeItems: "center", background: "transparent", border: 0, padding: 0, opacity: .78, transition: "all .18s" }}>
                {face}
                {selected && <span style={{ whiteSpace: "nowrap" }}>{c.name}</span>}
              </button>
            );
          })}
          {characters.length > 0 && <span style={{ flex: "0 0 auto", fontSize: 10, fontWeight: 800, color: "var(--mp-muted)", letterSpacing: ".06em" }}>{tr("一起聽", "listen together", "と一緒に聴く", "함께 듣기")}</span>}
        </div>
      }

      <button type="button" disabled={busy || !activeChar} onClick={() => requestRecommendation(input)}
        style={{ width: "100%", marginTop: 10, border: 0, borderRadius: 14, padding: "10px 14px", background: activeChar ? "linear-gradient(135deg,var(--mp-bubble),var(--music-accent))" : "var(--mp-line)", color: activeChar ? "var(--mp-on-accent)" : "var(--mp-muted)", fontSize: 11.5, fontWeight: 900, boxShadow: activeChar ? "var(--mp-shadow)" : "none" }}>
        {busy
          ? tr("正在請角色選歌…", "Asking for a song…", "キャラが曲を選んでいます…", "캐릭터에게 노래를 부탁하는 중…")
          : activeChar
            ? tr(`讓 ${activeChar.name} 推薦一首歌`, `Ask ${activeChar.name} for a song`, `${activeChar.name}に曲をおすすめしてもらう`, `${activeChar.name}에게 노래 추천받기`)
            : tr("先選擇一起聽歌的角色", "Choose a character to listen with", "一緒に聴くキャラを選択", "함께 들을 캐릭터 선택")}
      </button>

      {/* 正在播放 */}
      <div style={{ ...GLASS, borderRadius: 18, padding: 16, textAlign: "center", marginTop: 10 }}>
        <div className="music-app-artwork" style={{ width: 120, height: 120, margin: "0 auto", borderRadius: 14, overflow: "hidden", background: "linear-gradient(150deg,color-mix(in srgb,var(--music-accent) 28%,transparent),color-mix(in srgb,var(--music-accent) 7%,transparent))", display: "grid", placeItems: "center", fontSize: 40 }}>
          {mp.track?.artworkUrl ? <img src={mp.track.artworkUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🎵"}
        </div>
        <div className="music-app-track-title" style={{ fontSize: 16, fontWeight: 900, color: "var(--mp-txt)", marginTop: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mp.track?.title || tr("還沒放歌", "Nothing playing yet", "まだ再生していません", "아직 재생 중인 노래가 없습니다")}</div>
        <div style={{ fontSize: 11, color: "var(--mp-muted)", marginTop: 2 }}>{mp.track ? [mp.track.artist, SOURCE_LABELS[mp.track.source]].filter(Boolean).join(" · ") : activeChar ? tr(`貼個連結播放；也能請 ${activeChar.name} 推薦歌曲`, `Paste a link to play, or ask ${activeChar.name} for a recommendation.`, `リンクを貼って再生するか、${activeChar.name}におすすめを頼めます。`, `링크를 붙여넣어 재생하거나 ${activeChar.name}에게 추천을 받을 수 있습니다.`) : tr("貼個連結播放；選擇角色後也能請對方推薦歌曲", "Paste a link to play. Choose a character to ask for recommendations.", "リンクを貼って再生できます。キャラを選ぶとおすすめも頼めます。", "링크를 붙여넣어 재생하세요. 캐릭터를 선택하면 추천도 받을 수 있습니다.")}</div>
        <div className="music-app-progress" style={{ height: 3, borderRadius: 99, background: "var(--mp-line)", marginTop: 14, cursor: "pointer" }} onClick={seekFromEvent}>
          <div style={{ width: `${Math.round(mp.progress * 100)}%`, height: "100%", borderRadius: 99, background: "var(--music-accent)" }} />
        </div>
        <div className="music-app-controls" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 26, fontSize: 18, color: "var(--mp-txt)", marginTop: 10 }}>
          <button type="button" title={{ off: tr("循環：關", "Loop: off", "リピート：オフ", "반복: 끔"), list: tr("列表循環", "Repeat queue", "リストをリピート", "목록 반복"), single: tr("單曲循環", "Repeat one", "1曲リピート", "한 곡 반복") }[mp.loopMode]} onClick={mp.cycleLoop}
            style={{ border: 0, background: "transparent", fontSize: 15, color: mp.loopMode === "off" ? "var(--mp-txt)" : "var(--music-accent)", opacity: mp.loopMode === "off" ? .35 : 1, fontWeight: 800 }}>
            {mp.loopMode === "single" ? "🔂" : "🔁"}
          </button>
          <button type="button" style={{ border: 0, background: "transparent", fontSize: 18, color: "var(--mp-txt)", opacity: mp.queue.length || mp.track?.playlistId ? 1 : .35 }} onClick={mp.next}>⏭</button>
          <button type="button" style={{ border: 0, background: "transparent", fontSize: 22, color: "var(--mp-txt)" }} disabled={!mp.track} onClick={mp.toggle}>{mp.isPlaying ? "⏸" : "▶"}</button>
          <button type="button" style={{ border: 0, background: "transparent", fontSize: 15, color: "var(--mp-txt)", opacity: mp.track ? 1 : .35 }} onClick={mp.stop}>⏹</button>
        </div>
      </div>

      {/* 角色即時反應 */}
      {mp.charReaction && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12 }}>
          <div style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", overflow: "hidden", background: "var(--music-accent)", color: "var(--mp-on-accent)", fontSize: 13, fontWeight: 700, display: "grid", placeItems: "center" }}>
            {(() => { const c = characters.find((x) => x.name === mp.charReaction.characterName); const a = sanitizeUserImageUrl(c?.avatar); return a ? <img src={a} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (mp.charReaction.characterName?.[0] || "♪"); })()}
          </div>
          <div className="music-app-reaction" style={{ background: "linear-gradient(135deg,var(--mp-bubble),var(--music-accent))", color: "var(--mp-on-accent)", fontSize: 12, lineHeight: 1.6, padding: "9px 12px", borderRadius: "4px 14px 14px 14px" }}>{mp.charReaction.text}</div>
        </div>
      )}

      {/* 角色推薦歌單 */}
      {mp.charPicks.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--mp-muted)", letterSpacing: ".1em", margin: "0 2px 6px" }}>{tr("推薦歌單 · 點一下開搜尋", "Recommendations · Tap to search", "おすすめ曲・タップして検索", "추천 목록 · 눌러서 검색")}</div>
          {mp.charPicks.map((pick, index) => (
            <button key={pick.ts || index} type="button" onClick={() => openPickSearch(pick)}
              style={{ width: "100%", border: "1px solid rgba(255,255,255,.12)", background: "rgba(30,22,40,.92)", color: "#fff", borderRadius: 15, padding: "9px 12px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", columnGap: 9, rowGap: 3, marginTop: index ? 8 : 0, textAlign: "left", boxShadow: "0 5px 14px rgba(10,6,16,.16)" }}>
              <span style={{ gridRow: "1 / span 2", alignSelf: "center", width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: 12 }}>🎵</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <b style={{ flex: "0 0 auto", borderRadius: 99, padding: "2px 7px", background: "rgba(244,143,177,.2)", color: "#ffd6e4", fontSize: 9 }}>{pick.characterName || tr("角色", "Character", "キャラ", "캐릭터")}</b>
                <strong style={{ color: "#fff", fontSize: 11.5, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pick.title}{pick.artist ? ` — ${pick.artist}` : ""}</strong>
              </span>
              <span style={{ color: "rgba(255,255,255,.72)", fontSize: 9.5, lineHeight: 1.45, minWidth: 0 }}>{pick.reason || tr("想和你一起聽這首歌。", "I want to listen to this with you.", "この曲を一緒に聴きたい。", "이 노래를 너와 함께 듣고 싶어.")}</span>
            </button>
          ))}
        </div>
      )}

      {error && <button type="button" onClick={() => setError("")} style={{ margin: "12px auto 0", display: "block", border: "1px solid color-mix(in srgb,var(--mp-danger) 45%,transparent)", borderRadius: 12, padding: "7px 12px", background: "color-mix(in srgb,var(--mp-danger) 9%,var(--mp-card-bg))", color: "var(--mp-danger)", fontSize: 11 }}>{error}</button>}

      {/* 點歌輸入 */}
      <div style={{ marginTop: "auto", paddingTop: 14 }}>
        <input value={input} disabled={busy} onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) submit(); }}
          placeholder={busy ? tr("處理中…", "Working…", "処理中…", "처리 중…") : tr("貼 YouTube／Spotify 連結，或輸入心情、曲風後請角色推薦", "Paste a YouTube/Spotify link, or enter a mood or genre for a recommendation", "YouTube／Spotifyのリンクを貼るか、気分やジャンルを入力しておすすめを頼む", "YouTube/Spotify 링크를 붙여넣거나 기분·장르를 입력해 추천받기")}
          className="music-app-input" style={{ ...GLASS, width: "100%", boxSizing: "border-box", borderRadius: 99, padding: "11px 16px", fontSize: 12, color: "var(--mp-txt)", outline: "none" }} />
      </div>
    </div>
  );
}
