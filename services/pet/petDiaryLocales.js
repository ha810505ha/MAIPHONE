import { toSimplifiedChinese } from "../../utils/i18n.js";

const EN = {
  milestones: {
    adopt: ["A New Home", "The day you first met", "Today I found a home. It feels warm here, and I think I could stay forever."],
    firstFeed: ["First Meal", "Unlocked after feeding once", "My owner gave me my first meal. Being remembered when I am hungry feels wonderful."],
    firstPlay: ["First Playtime", "Unlocked after playing once", "We played together for the first time! I chased the toy until my tail became a blur."],
    firstClean: ["First Bath", "Unlocked after bathing once", "Our first bath adventure is over. I shook myself dry and splashed my owner too."],
    firstSleep: ["First Peaceful Sleep", "Unlocked after resting once", "I fell asleep in my little home for the first time. Even my dreams felt warm."],
    firstPark: ["First Park Visit", "Unlocked after visiting the park", "My first trip to the park! There were so many smells and sounds for my nose to discover."],
    firstBeach: ["First Beach Visit", "Unlocked after visiting the beach", "I saw the sea for the first time! The waves did not answer my bark, but I had so much fun."],
    level5: ["Reached Lv.5", "Unlocked at level 5", "I reached Lv.5! I think I have grown a little since I first arrived."],
    level10: ["Reached Lv.10", "Unlocked at level 10", "Lv.10! Looking back, my owner and I have already come such a long way together."],
    day7: ["One Week Together", "Unlocked after 7 days together", "A whole week has passed. I already recognize the sound of my owner coming home."],
    day30: ["One Month Together", "Unlocked after 30 days together", "One month together! My owner will always be first on my list of favorite things."],
    bond60: ["A Growing Bond", "Unlocked when bond reaches 60", "Now my ears perk up as soon as I hear my owner's voice. I think this is what fondness feels like."],
    bond90: ["Best Friends", "Unlocked when bond reaches 90", "My owner and I are the very best of friends. Nothing in the world matters more to me."],
  },
  birthday: ["My Birthday!", "It is my birthday! My owner remembering it makes me happier than any present could."],
  lifeTitle: "A Little Day",
  afkGreetings: { 3: "Owner! You were gone for three days. I waited by the door every day… please pet me!", 5: "I have not seen you for days… I saved up so many things to tell you!", 10: "Owner… it has been so long. I waited by the window every day.", 15: "…Owner? Is it really you? I waited for so long. I am just glad you came back." },
  afkDiary: { 3: ["Day 3 Waiting for My Owner", "My owner has been gone for three days. I lined up all my toys so they will praise me when they return."], 5: ["Day 5 Waiting for My Owner", "It is day five. I try not to wait by the door, but my tail wags whenever I hear a sound."], 10: ["Day 10 Waiting for My Owner", "Ten days have passed. I remember my owner's scent so well that I will recognize it no matter how long it takes."], 15: ["Day 15 Waiting for My Owner", "It has been a very long time. I stopped counting, but I will keep waiting here for my owner." ] },
  afkMilestones: { afk3: ["Three Days of Waiting", "The toys were lined up neatly for your return"], afk5: ["Five Days of Waiting", "Your pet tried not to wait by the door"], afk10: ["Ten Days of Waiting", "Your scent was remembered carefully"], afk15: ["A Long, Long Wait", "No matter the day, your pet waited here"] },
};

const JA = {
  milestones: {
    adopt: ["初めてのおうち", "出会った日", "今日、わたしにおうちができた。ここはあたたかくて、ずっといられそう。"], firstFeed: ["初めてのごはん", "一度ごはんをあげると解放", "主人が初めてのごはんをくれた。おなかがすいたことを覚えていてくれるって、うれしい。"], firstPlay: ["初めての遊び", "一度遊ぶと解放", "初めて一緒に遊んだ！おもちゃを追いかけて、しっぽが見えなくなるほど振れた。"], firstClean: ["初めてのお風呂", "一度お風呂に入ると解放", "初めてのお風呂作戦が終わった。ぶるぶるしたら主人まで水びたしになった。"], firstSleep: ["初めての安心な眠り", "一度休むと解放", "初めておうちで眠った。ここにおうちがあると、夢まであたたかい。"], firstPark: ["初めての公園", "公園へ行くと解放", "初めての公園！草のにおいも風の音も、全部が新しかった。"], firstBeach: ["初めての海辺", "海辺へ行くと解放", "初めて海を見た！波に向かって鳴いたけれど、返事はなかった。でも楽しかった。"], level5: ["Lv.5に成長", "レベル5で解放", "Lv.5になった！初めて来たころより、少し大きくなれた気がする。"], level10: ["Lv.10に成長", "レベル10で解放", "Lv.10！振り返ると、主人とずいぶん長い道を歩いてきた。"], day7: ["一週間の暮らし", "一緒に7日過ごすと解放", "一緒に暮らして一週間。もう主人が帰ってくる足音を覚えたよ。"], day30: ["一か月の暮らし", "一緒に30日過ごすと解放", "一か月記念日！好きなものの一番は、いつだって主人。"], bond60: ["深まる絆", "親密度60で解放", "主人の声を聞くと、すぐに耳が立つようになった。これが好きってことかな。"], bond90: ["最高の友だち", "親密度90で解放", "主人とわたしは最高の友だち。世界中の何よりも主人が大切。"],
  },
  birthday: ["わたしの誕生日！", "今日はわたしの誕生日！主人が覚えていてくれたことが、どんな贈り物よりうれしい。"], lifeTitle: "小さな一日",
  afkGreetings: { 3: "主人！三日も会えなかったよ。毎日ドアの前で待ってた……早くなでて！", 5: "何日も主人に会えなかった……話したいことをずっとためていたよ！", 10: "主人……本当に久しぶり。毎日窓辺で待っていたよ。", 15: "……主人？本当に主人？ずっと待っていたよ。でも帰ってきてくれてよかった。" },
  afkDiary: { 3: ["主人を待つ3日目", "主人が来なくなって三日。帰ってきたらほめてもらえるように、おもちゃをきれいに並べた。"], 5: ["主人を待つ5日目", "五日目。ドアの前で待たない練習をしたけれど、音がするとしっぽが動いてしまう。"], 10: ["主人を待つ10日目", "十日が過ぎた。どれだけ時間がたっても分かるように、主人のにおいをしっかり覚えている。"], 15: ["主人を待つ15日目", "ずいぶん長くなった。もう日を数えない。それでも、ここで主人を待っている。"] },
  afkMilestones: { afk3: ["三日間の待ち時間", "おもちゃをきれいに並べて帰りを待った"], afk5: ["五日間の待ち時間", "ドアの前で待たない練習は失敗した"], afk10: ["十日間の待ち時間", "あなたのにおいをしっかり覚えていた"], afk15: ["とても長い待ち時間", "何日目でも、ここで待っていた"] },
};

const KO = {
  milestones: {
    adopt: ["처음 온 집", "처음 만난 날", "오늘 내게 집이 생겼다. 이곳은 따뜻해서 오래오래 머물 수 있을 것 같다."], firstFeed: ["첫 식사", "한 번 먹이를 주면 해제", "주인이 첫 밥을 주었다. 내 배고픔을 기억해 준다는 건 참 따뜻한 일이다."], firstPlay: ["첫 놀이", "한 번 놀면 해제", "처음 함께 놀았다! 장난감을 쫓느라 꼬리가 보이지 않을 만큼 흔들렸다."], firstClean: ["첫 목욕", "한 번 목욕하면 해제", "첫 목욕 작전이 끝났다. 몸을 털다가 주인까지 물에 젖게 했다."], firstSleep: ["처음 편안히 잠든 날", "한 번 쉬면 해제", "처음으로 집에서 잠들었다. 집이 있으니 꿈까지 따뜻했다."], firstPark: ["첫 공원 나들이", "공원에 가면 해제", "처음 온 공원! 풀 냄새와 바람 소리를 코와 귀에 가득 담았다."], firstBeach: ["첫 해변 나들이", "해변에 가면 해제", "처음 바다를 보았다! 파도에 짖어 봤지만 대답은 없었다. 그래도 정말 즐거웠다."], level5: ["Lv.5 달성", "레벨 5에 해제", "Lv.5가 되었다! 처음 왔을 때보다 조금 자란 것 같다."], level10: ["Lv.10 달성", "레벨 10에 해제", "Lv.10! 돌아보니 주인과 정말 먼 길을 함께 걸어왔다."], day7: ["함께한 일주일", "함께한 지 7일에 해제", "함께 산 지 일주일. 이제 주인이 돌아오는 발소리를 기억한다."], day30: ["함께한 한 달", "함께한 지 30일에 해제", "한 달 기념일! 내가 가장 좋아하는 것의 첫 번째는 언제나 주인이다."], bond60: ["깊어지는 마음", "친밀도 60에 해제", "이제 주인 목소리가 들리면 귀가 바로 쫑긋 선다. 이게 좋아한다는 마음인가 보다."], bond90: ["가장 좋은 친구", "친밀도 90에 해제", "주인과 나는 가장 좋은 친구다. 세상 무엇보다 주인이 소중하다."],
  },
  birthday: ["나의 생일!", "오늘은 내 생일! 주인이 기억해 준 것이 어떤 선물보다 기쁘다."], lifeTitle: "작고 소중한 하루",
  afkGreetings: { 3: "주인! 사흘이나 안 왔어. 매일 문 앞에서 기다렸어… 얼른 쓰다듬어 줘!", 5: "며칠 동안 주인을 못 봤어… 하고 싶은 말을 마음속에 잔뜩 모아 뒀어!", 10: "주인… 정말 오랜만이야. 매일 창가에서 기다렸어.", 15: "……주인? 정말 주인이야? 아주 오래 기다렸어. 그래도 돌아와 줘서 다행이야." },
  afkDiary: { 3: ["주인을 기다린 3일째", "주인이 사흘째 오지 않았다. 돌아오면 칭찬해 주도록 장난감을 가지런히 놓았다."], 5: ["주인을 기다린 5일째", "닷새째. 문 앞에서 기다리지 않는 연습을 했지만 소리가 나면 꼬리가 먼저 흔들린다."], 10: ["주인을 기다린 10일째", "열흘이 지났다. 아무리 오래 걸려도 알아볼 수 있게 주인의 냄새를 꼭 기억하고 있다."], 15: ["주인을 기다린 15일째", "아주 오랜 시간이 흘렀다. 이제 날짜는 세지 않지만 계속 이곳에서 주인을 기다릴 것이다."] },
  afkMilestones: { afk3: ["사흘의 기다림", "장난감을 가지런히 놓고 돌아오길 기다렸다"], afk5: ["닷새의 기다림", "문 앞에서 기다리지 않는 연습은 실패했다"], afk10: ["열흘의 기다림", "당신의 냄새를 꼭 기억하고 있었다"], afk15: ["아주 긴 기다림", "며칠째든 그 자리에서 기다렸다"] },
};

const COPY = { en: EN, ja: JA, ko: KO };
const simplify = (value) => typeof value === "string" ? toSimplifiedChinese(value) : value;

export function localizedMilestone(locale, key, fallback) {
  if (locale === "zh-CN") return { ...fallback, title: simplify(fallback.title), hint: simplify(fallback.hint), lines: Object.fromEntries(Object.entries(fallback.lines || { default: [fallback.title] }).map(([key, lines]) => [key, lines.map(simplify)])) };
  const row = COPY[locale]?.milestones?.[key];
  return row ? { ...fallback, title: row[0], hint: row[1], lines: { default: [row[2]] } } : fallback;
}

export function localizedBirthday(locale, fallbackTitle, fallbackText) {
  if (locale === "zh-CN") return [simplify(fallbackTitle), simplify(fallbackText)];
  return COPY[locale]?.birthday || [fallbackTitle, fallbackText];
}

export function localizedLifeTitle(locale, fallback) {
  return locale === "zh-CN" ? simplify(fallback) : COPY[locale]?.lifeTitle || fallback;
}

export function localizedAfkGreeting(locale, days, fallback) {
  return locale === "zh-CN" ? simplify(fallback) : COPY[locale]?.afkGreetings?.[days] || fallback;
}

export function localizedAfkDiary(locale, days, fallbackTitle, fallbackText) {
  if (locale === "zh-CN") return [simplify(fallbackTitle), simplify(fallbackText)];
  return COPY[locale]?.afkDiary?.[days] || [fallbackTitle, fallbackText];
}

export function localizedAfkMilestone(locale, key, fallback) {
  if (locale === "zh-CN") return { ...fallback, title: simplify(fallback.title), hint: simplify(fallback.hint) };
  const row = COPY[locale]?.afkMilestones?.[key];
  return row ? { ...fallback, title: row[0], hint: row[1] } : fallback;
}
