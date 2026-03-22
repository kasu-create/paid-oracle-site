/**
 * カード別の鑑定文案（デッキ構造は tarot-deck.js のみ）
 *
 * - 大アルカナ: 個別に gist を定義
 * - 小アルカナ: CARD_MEANINGS に id を足すと上書き。未登録は defaultMinorGist()
 *
 * @typedef {{ gist: string, keywords?: string[] }} CardMeaning
 */

/** @type {Record<string, CardMeaning>} */
export const CARD_MEANINGS = {
  m00: {
    keywords: ["始まり", "自由", "可能性"],
    gist: "ゼロからの一歩。未確定さの中に、まっさらな可能性が開いています。",
  },
  m01: {
    keywords: ["集中", "実現", "技"],
    gist: "思いを形にする段階。道具と意志が揃い、チャンスを自分で動かせる示唆です。",
  },
  m02: {
    keywords: ["内省", "直感", "静けさ"],
    gist: "外より内を見るとき。言葉にしにくい感覚や、静かな知恵を信じる流れです。",
  },
  m03: {
    keywords: ["豊かさ", "母性", "育み"],
    gist: "育つ・満たすテーマ。環境を整え、自分と他者を慈しむ余白が鍵になります。",
  },
  m04: {
    keywords: ["秩序", "責任", "軸"],
    gist: "ルールと軸を定めるとき。感情よりも「守るべき構造」が前面に出やすいです。",
  },
  m05: {
    keywords: ["学び", "伝統", "指針"],
    gist: "先人や規範から学ぶ段階。信頼できる導き・儀式・価値観の確認がテーマです。",
  },
  m06: {
    keywords: ["選択", "結び", "価値観"],
    gist: "二者択一や関係性の分岐。自分が何を大切にするかが問われています。",
  },
  m07: {
    keywords: ["前進", "勝利", "統制"],
    gist: "障害を突き進む勢い。方向が定まれば、スピードと集中が味方になります。",
  },
  m08: {
    keywords: ["忍耐", "内なる強さ", "調和"],
    gist: "力ずくではなく、根気と優しさで状況を整える時期。自制が成果に変わります。",
  },
  m09: {
    keywords: ["孤独", "洞察", "灯り"],
    gist: "一人になる時間が必要。騒音を減らし、本質だけを見つめる示唆です。",
  },
  m10: {
    keywords: ["転換", "運気", "サイクル"],
    gist: "流れが変わる節目。好転も一時的な波も「次の局面」への入り口です。",
  },
  m11: {
    keywords: ["公平", "因果", "バランス"],
    gist: "物事の天秤を取り直すとき。事実ベースで整えると筋が通りやすいです。",
  },
  m12: {
    keywords: ["停止", "視点転換", "委ねる"],
    gist: "動かないように見えても、見方を変えるための宙吊り。抵抗より受容が鍵です。",
  },
  m13: {
    keywords: ["終わり", "再生", "手放し"],
    gist: "一段落と次の形への移行。失うものより、空いた場所に何を置くかがテーマです。",
  },
  m14: {
    keywords: ["調整", "中庸", "混合"],
    gist: "極端を避け、混ぜ合わせる知恵。ペースと量のコントロールが効いてきます。",
  },
  m15: {
    keywords: ["執着", "依存", "誘惑"],
    gist: "縛りに気づくサイン。快楽や恐怖に名前を付けると、選択の自由が戻ります。",
  },
  m16: {
    keywords: ["崩壊", "覚醒", "真実"],
    gist: "建て前が崩れる瞬間。痛みと同時に、本当に必要な土台だけが残ります。",
  },
  m17: {
    keywords: ["希望", "癒し", "靈感"],
    gist: "暗闇のあとの光。小さな希望を信じると、道標が見えやすくなります。",
  },
  m18: {
    keywords: ["不安", "幻想", "潜在意識"],
    gist: "輪郭の曖昧さ。怖れと想像の区別をつけ、確かな事実に足を着けたい時期です。",
  },
  m19: {
    keywords: ["喜び", "成功", "生命力"],
    gist: "素直な満足と活力。成果を認め、周囲と分かち合うと輪が広がります。",
  },
  m20: {
    keywords: ["呼び声", "再生", "決断"],
    gist: "過去の総決算。本当の自分に合う生き方へ、再スタートを促す流れです。",
  },
  m21: {
    keywords: ["完成", "一体感", "旅の到達"],
    gist: "ひとつの章の完成。集大成として、次の世界へ持っていく学びがまとまります。",
  },
};

const SUIT_JA = {
  wands: "ワンド",
  cups: "カップ",
  swords: "ソード",
  pentacles: "ペンタクル",
};

/**
 * 小アルカナのフォールバック（個別文案は CARD_MEANINGS に { id: { gist } } で追加）
 * @param {string} id 例: wands_ace, cups_king
 */
function defaultMinorGist(id) {
  const i = id.indexOf("_");
  if (i < 0) return "（文案未設定）";
  const suit = id.slice(0, i);
  const rank = id.slice(i + 1);
  const suitJa = SUIT_JA[/** @type {keyof typeof SUIT_JA} */ (suit)] || suit;
  return `【${suitJa}】具体場面でのエネルギーの出方（${rank}）。個別の深い文案は CARD_MEANINGS["${id}"] に追記。`;
}

/**
 * @param {string} cardId
 * @returns {CardMeaning}
 */
export function getCardMeaning(cardId) {
  const direct = CARD_MEANINGS[cardId];
  if (direct) return direct;
  if (cardId.startsWith("m")) {
    return { gist: "（大アルカナの文案が未登録です）", keywords: [] };
  }
  return { gist: defaultMinorGist(cardId), keywords: [] };
}
