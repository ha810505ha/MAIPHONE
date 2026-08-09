// 寵物日常氣泡的基本語庫：依主要個性挑台詞（60% 機率用個性專屬句，其餘用通用句保持新鮮感）。
// 池：feed / play / clean / sleep / petting / scene-home / scene-park / scene-beach

import { legacyPersonalityName } from "./petProfile.js";
import { toSimplifiedChinese } from "../../utils/i18n.js";

const LINES = {
  feed: {
    default: ["好好吃！", "唔嗯～肚子暖暖的！"],
    黏人: ["主人餵的飯，比什麼都好吃！"],
    活潑: ["吃飽了！等等就有力氣衝刺了！"],
    貪吃: ["還有嗎？我還可以再吃三碗！", "這個味道……是我最喜歡的那種！"],
    慵懶: ["吃飽了……那接下來就是睡覺時間了吧。"],
    害羞: ["謝、謝謝主人……很好吃。"],
    溫柔: ["謝謝主人，你也要記得好好吃飯喔。"],
    調皮: ["吃飽飽，等等去哪裡搗蛋好呢～"],
  },
  play: {
    default: ["再玩一次！", "嘿嘿，抓到你了！"],
    黏人: ["只要是跟主人玩，玩什麼都開心！"],
    活潑: ["衝啊——！再來十回合！", "還不夠不夠！我還能跑！"],
    貪吃: ["玩完之後……會有點心嗎？"],
    慵懶: ["呼、呼……讓我喘口氣再繼續……"],
    害羞: ["剛剛……我玩得有點忘我了，害羞。"],
    溫柔: ["和主人一起玩的時間，最喜歡了。"],
    調皮: ["嘿嘿，剛剛偷藏了一個玩具，你找得到嗎？"],
  },
  clean: {
    default: ["香噴噴～", "毛都蓬蓬的了！"],
    黏人: ["洗完澡了，快聞聞我～快點快點！"],
    活潑: ["泡泡大戰，我贏了！"],
    貪吃: ["洗完澡好餓喔……這是正常的吧？"],
    慵懶: ["洗澡好累……需要睡三小時恢復。"],
    害羞: ["不、不要一直看我洗澡啦……"],
    溫柔: ["把自己弄乾淨，主人抱起來才舒服嘛。"],
    調皮: ["我剛剛把泡泡甩得到處都是，嘿嘿。"],
  },
  sleep: {
    default: ["晚安……", "呼嚕……呼嚕……"],
    黏人: ["主人也一起睡嘛……我幫你占好位置了。"],
    活潑: ["充電中……醒來又是一條活龍！"],
    貪吃: ["希望夢裡有吃不完的肉肉……"],
    慵懶: ["終於到我最擅長的環節了……"],
    害羞: ["那個……晚安。（小小聲）"],
    溫柔: ["主人辛苦了，也要早點休息喔。"],
    調皮: ["假裝睡著……嘿嘿，其實我在偷看。"],
  },
  petting: {
    default: ["嘿嘿，好喜歡你摸摸我～", "再摸一下下嘛～"],
    黏人: ["摸摸！最喜歡摸摸了！不要停～"],
    活潑: ["哇！摸得我全身充滿幹勁！"],
    貪吃: ["摸摸很好，但如果加點零食會更好喔？"],
    慵懶: ["嗯……就是這裡……力道剛剛好……"],
    害羞: ["咦！嚇、嚇我一跳……但、但可以繼續。"],
    溫柔: ["主人的手好溫暖，摸著摸著就安心了。"],
    調皮: ["嘿嘿，趁你摸我的時候，尾巴偷偷打了你一下！"],
  },
  "scene-home": {
    default: ["回到熟悉的小屋最安心了～", "今天也想窩在家裡陪著你！"],
    黏人: ["家裡最好了，因為離主人最近！"],
    慵懶: ["回家＝可以躺。完美。"],
    害羞: ["還是家裡自在……外面人好多。"],
    調皮: ["回家了！先檢查一下我藏的寶物還在不在。"],
  },
  "scene-park": {
    default: ["草地聞起來香香的，我們去跑跑吧！", "公園裡會不會有新朋友呢？"],
    黏人: ["去公園也要牽好我喔，我想一直走在主人旁邊。"],
    活潑: ["公園！放我下去，我要用全速跑三圈！"],
    貪吃: ["聽說公園有時候會有人掉食物……走！"],
    害羞: ["我會緊緊跟著主人的，不要走太快喔。"],
    調皮: ["那邊有鴿子……嘿嘿，看我的。"],
  },
  "scene-beach": {
    default: ["浪花追過來了！快跑快跑～", "沙子暖暖的，好想挖一個大洞！"],
    活潑: ["海！我要跟浪比賽誰跑得快！"],
    貪吃: ["海邊……聞起來有魚的味道！"],
    慵懶: ["找一塊曬得到太陽的沙子躺著，就很完美了。"],
    溫柔: ["海風吹起來好舒服，跟主人一起看海真好。"],
  },
};

const LOCALIZED_LINES = {
  en: {
    feed: { default: ["Yum!", "My tummy feels warm and happy!"], clingy: ["Food from you tastes better than anything!"], lively: ["All full! Now I can zoom around!"], foodie: ["Is there more? I can eat three more bowls!", "This is my favorite kind of flavor!"], lazy: ["All full… so now it is nap time, right?"], shy: ["Th-thank you… it is really good."], gentle: ["Thank you. Please remember to eat well too."], mischievous: ["Now that I am full, where should I cause trouble next?" ] },
    play: { default: ["Again, again!", "Hehe, I caught you!"], clingy: ["As long as I am playing with you, anything is fun!"], lively: ["Charge! Ten more rounds!", "Not enough! I can still run!"], foodie: ["After playing… will there be a snack?"], lazy: ["Phew… let me catch my breath first…"], shy: ["I got a little carried away… how embarrassing."], gentle: ["Playing together is my favorite time."], mischievous: ["Hehe, I hid a toy. Can you find it?" ] },
    clean: { default: ["So fresh!", "My fur is all fluffy now!"], clingy: ["Bath time is over—come smell me, quick!"], lively: ["I won the bubble battle!"], foodie: ["Baths make me hungry… that is normal, right?"], lazy: ["Bathing is tiring… I need a three-hour nap."], shy: ["D-don't keep watching me bathe…"], gentle: ["When I am clean, your hugs feel even nicer."], mischievous: ["I shook bubbles everywhere. Hehe." ] },
    sleep: { default: ["Good night…", "Purr… purr…"], clingy: ["Sleep with me too… I saved you a spot."], lively: ["Recharging… I will be full of energy again!"], foodie: ["I hope my dreams have endless treats…"], lazy: ["Finally, my best activity…"], shy: ["Um… good night. (very quietly)"], gentle: ["You worked hard today. Rest early too."], mischievous: ["Pretending to sleep… hehe, I am secretly watching." ] },
    petting: { default: ["Hehe, I love your pets!", "Just a little more, please!"], clingy: ["Pets! My favorite! Don't stop!"], lively: ["Wow! Your pats filled me with energy!"], foodie: ["Pets are great, but a snack would make them even better?"], lazy: ["Mm… right there… perfect pressure…"], shy: ["Eek! You startled me… b-but you can keep going."], gentle: ["Your hand is so warm. I feel safe like this."], mischievous: ["Hehe, while you petted me, my tail secretly bonked you!" ] },
    "scene-home": { default: ["Coming home always feels safest!", "I want to stay home with you today too!"], clingy: ["Home is best because it is closest to you!"], lazy: ["Home means lying down. Perfect."], shy: ["Home is more comfortable… outside is so busy."], mischievous: ["We are home! First, I need to check my treasures." ] },
    "scene-park": { default: ["The grass smells wonderful. Let's run!", "Will there be new friends at the park?"], clingy: ["Hold my leash tight. I want to stay beside you."], lively: ["The park! Let me run three full-speed laps!"], foodie: ["I hear people sometimes drop food here… let's go!"], shy: ["I will stay close to you. Please do not walk too fast."], mischievous: ["Pigeons over there… hehe, watch this." ] },
    "scene-beach": { default: ["The waves are chasing us! Run!", "The sand is warm. I want to dig a big hole!"], lively: ["The sea! I will race the waves!"], foodie: ["The beach… smells like fish!"], lazy: ["A sunny patch of sand is all I need."], gentle: ["The sea breeze feels lovely. Watching the sea with you is nice." ] },
  },
  ja: {
    feed: { default: ["おいしい！", "おなかがぽかぽかする！"], clingy: ["主人がくれるごはんが、いちばんおいしい！"], lively: ["おなかいっぱい！これで全力疾走できる！"], foodie: ["まだある？あと三杯はいけるよ！", "この味……いちばん好きなやつ！"], lazy: ["おなかいっぱい……次はお昼寝の時間だよね。"], shy: ["あ、ありがとう……すごくおいしい。"], gentle: ["ありがとう。主人もちゃんとごはんを食べてね。"], mischievous: ["満腹になったし、次はどこでいたずらしようかな～" ] },
    play: { default: ["もう一回！", "えへへ、つかまえた！"], clingy: ["主人と一緒なら、何をしても楽しい！"], lively: ["いくぞー！あと十回！", "まだまだ！もっと走れる！"], foodie: ["遊んだあと……おやつはある？"], lazy: ["はぁ、はぁ……少し休んでからね……"], shy: ["さっきは……夢中になりすぎた。はずかしい。"], gentle: ["主人と遊ぶ時間が、いちばん好き。"], mischievous: ["へへ、さっきおもちゃを一つ隠したよ。見つけられる？" ] },
    clean: { default: ["いいにおい～", "毛がふわふわになった！"], clingy: ["お風呂おわり！早くにおいをかいで～！"], lively: ["泡あわバトル、ぼくの勝ち！"], foodie: ["お風呂のあとっておなかすくよね……普通だよね？"], lazy: ["お風呂は疲れる……三時間寝て回復する。"], shy: ["ず、ずっと見ないでよ……"], gentle: ["きれいにしておくと、主人に抱っこされるのも気持ちいいよ。"], mischievous: ["泡をあちこちに飛ばしちゃった。えへへ。" ] },
    sleep: { default: ["おやすみ……", "すやすや……"], clingy: ["主人も一緒に寝よう……場所を取っておいたよ。"], lively: ["充電中……起きたらまた元気いっぱい！"], foodie: ["夢の中には食べきれないおやつがありますように……"], lazy: ["やっと、いちばん得意な時間だ……"], shy: ["あの……おやすみ。（小声）"], gentle: ["主人もおつかれさま。早く休んでね。"], mischievous: ["寝たふり……へへ、実は見てるよ。" ] },
    petting: { default: ["えへへ、なでなで大好き！", "もう少しだけ、なでて～"], clingy: ["なでなで！いちばん好き！止めないで～"], lively: ["わあ！なでられたら元気がいっぱい！"], foodie: ["なでなでもいいけど、おやつもあればもっといいよ？"], lazy: ["うん……そこ……ちょうどいい……"], shy: ["わっ！び、びっくりした……でも、続けてもいいよ。"], gentle: ["主人の手はあたたかいね。安心する。"], mischievous: ["へへ、なでている間にしっぽでこっそりぺしってしたよ！" ] },
    "scene-home": { default: ["慣れたおうちがいちばん安心！", "今日もおうちで主人と一緒にいたい！"], clingy: ["おうちがいちばん。主人のすぐそばだから！"], lazy: ["おうち＝ごろごろ。完璧。"], shy: ["やっぱりおうちが落ち着く……外は人が多いから。"], mischievous: ["ただいま！隠した宝物を先に確認しよう。" ] },
    "scene-park": { default: ["草のにおいがする！走ろう！", "公園で新しい友だちに会えるかな？"], clingy: ["公園でも離れないでね。ずっと隣を歩きたい。"], lively: ["公園！全速力で三周する！"], foodie: ["公園には食べ物が落ちていることもあるらしい……行こう！"], shy: ["主人のそばにぴったりいるね。早く歩かないで。"], mischievous: ["あそこにハトが……へへ、見てて。" ] },
    "scene-beach": { default: ["波が追いかけてくる！走って！", "砂があったかい。大きな穴を掘りたい！"], lively: ["海！波とどっちが速いか競争だ！"], foodie: ["海辺……魚のにおいがする！"], lazy: ["日なたの砂で寝転べば完璧。"], gentle: ["海風が気持ちいいね。主人と海を見るの、好き。" ] },
  },
  ko: {
    feed: { default: ["맛있어!", "배가 따뜻하고 든든해!"], clingy: ["주인이 주는 밥이 제일 맛있어!"], lively: ["배부르다! 이제 전력질주할 수 있어!"], foodie: ["더 있어? 세 그릇은 더 먹을 수 있어!", "이 맛… 내가 제일 좋아하는 맛이야!"], lazy: ["배불러… 이제 낮잠 시간이겠지?"], shy: ["고, 고마워… 정말 맛있어."], gentle: ["고마워. 주인도 밥 잘 챙겨 먹어."], mischievous: ["배부르니 다음엔 어디서 장난칠까~" ] },
    play: { default: ["한 번 더!", "헤헤, 잡았다!"], clingy: ["주인이랑 놀면 뭐든 즐거워!"], lively: ["돌진! 열 번 더!", "아직 부족해! 더 달릴 수 있어!"], foodie: ["놀고 나면… 간식 있어?"], lazy: ["후우… 잠깐 숨 돌리고 계속하자…"], shy: ["방금은… 너무 신나 버렸어. 부끄러워."], gentle: ["주인과 노는 시간이 제일 좋아."], mischievous: ["헤헤, 장난감 하나 숨겼어. 찾을 수 있어?" ] },
    clean: { default: ["향긋해~", "털이 보송보송해졌어!"], clingy: ["목욕 끝! 얼른 냄새 맡아 봐!"], lively: ["거품 전쟁은 내가 이겼어!"], foodie: ["목욕하고 나면 배고픈 게 정상이겠지…?"], lazy: ["목욕은 피곤해… 세 시간 자야 해."], shy: ["계, 계속 보지 마…"], gentle: ["깨끗해야 주인이 안아 주기에도 편하잖아."], mischievous: ["거품을 여기저기 날렸어. 헤헤." ] },
    sleep: { default: ["잘 자…", "새근새근…"], clingy: ["주인도 같이 자자… 자리 맡아 뒀어."], lively: ["충전 중… 일어나면 또 쌩쌩할 거야!"], foodie: ["꿈에는 끝없는 간식이 나오면 좋겠다…"], lazy: ["드디어 내가 제일 잘하는 시간이야…"], shy: ["저기… 잘 자. (작은 목소리)"], gentle: ["주인도 수고했어. 일찍 쉬어."], mischievous: ["자는 척… 헤헤, 사실 보고 있어." ] },
    petting: { default: ["헤헤, 쓰다듬어 주는 거 좋아해!", "조금만 더 쓰다듬어 줘~"], clingy: ["쓰담쓰담! 제일 좋아! 멈추지 마~"], lively: ["와! 쓰다듬어 주니 힘이 솟아!"], foodie: ["쓰다듬기도 좋지만 간식까지 있으면 더 좋지 않을까?"], lazy: ["음… 거기… 딱 좋아…"], shy: ["앗! 노, 놀랐어… 그래도 계속해도 돼."], gentle: ["주인 손은 따뜻해. 마음이 놓여."], mischievous: ["헤헤, 쓰다듬는 동안 꼬리로 살짝 톡 쳤어!" ] },
    "scene-home": { default: ["익숙한 집이 제일 편안해!", "오늘도 집에서 주인과 함께 있고 싶어!"], clingy: ["집이 제일 좋아. 주인과 가장 가까우니까!"], lazy: ["집 = 뒹굴뒹굴. 완벽해."], shy: ["역시 집이 편해… 밖은 사람이 너무 많아."], mischievous: ["집이다! 먼저 숨겨 둔 보물부터 확인해야지." ] },
    "scene-park": { default: ["풀 냄새가 좋아! 달리자!", "공원에 새 친구가 있을까?"], clingy: ["공원에서도 꼭 잡아 줘. 주인 옆에 있고 싶어."], lively: ["공원! 전력으로 세 바퀴 달릴래!"], foodie: ["공원에는 가끔 먹을 게 떨어져 있대… 가자!"], shy: ["주인 곁에 꼭 붙어 있을게. 너무 빨리 걷지 마."], mischievous: ["저기 비둘기… 헤헤, 봐 봐." ] },
    "scene-beach": { default: ["파도가 따라온다! 뛰어!", "모래가 따뜻해. 큰 구멍을 파고 싶어!"], lively: ["바다! 파도랑 누가 빠른지 겨뤄 볼래!"], foodie: ["해변… 물고기 냄새가 나!"], lazy: ["햇볕 드는 모래에 누우면 완벽해."], gentle: ["바닷바람이 참 좋아. 주인과 바다 보는 게 좋아." ] },
  },
};

const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];

export function petLine(pool, profile, locale = "zh-TW") {
  const languageLines = LOCALIZED_LINES[locale] || LINES;
  const set = languageLines[pool] || LINES[pool];
  if (!set) return "";
  const personal = profile?.primaryPersonality && set[legacyPersonalityName(profile.primaryPersonality)];
  const chosen = personal && Math.random() < 0.6 ? personal : set.default;
  const line = pick(chosen);
  return locale === "zh-CN" ? toSimplifiedChinese(line) : line;
}
