/**
 * /oracle/reading/ — プロフィール → シャッフル → 3枚 → 再シャッフル → 5枚 → 長文鑑定
 */

import { buildFullDeck, shuffleDeck } from "./tarot-deck.js";
import { SPREAD_THREE, SPREAD_FIVE } from "./spread-config.js";
import { getCardMeaning } from "./card-meanings.js";
import { resolveCardImageUrl, CARD_IMAGE_EXTENSIONS } from "./card-images.js";

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function phaseToStep(phaseId) {
  const map = {
    "phase-intro": 1,
    "phase-three": 2,
    "phase-five": 3,
    "phase-summary": 4,
  };
  return map[phaseId] ?? 1;
}

function setProgressStep(step) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById("step-" + i);
    if (el) el.classList.toggle("is-active", i === step);
  }
}

function showPhase(id) {
  document.querySelectorAll(".phase").forEach((el) => {
    const match = el.id === id;
    el.hidden = !match;
    el.classList.toggle("is-hidden", !match);
  });
  setProgressStep(phaseToStep(id));
}

const timelineEl = () => document.getElementById("reading-log");

function pushTimeline(message) {
  const ul = timelineEl();
  if (!ul) return;
  ul.querySelectorAll(".is-latest").forEach((li) => li.classList.remove("is-latest"));
  const li = document.createElement("li");
  li.textContent = message;
  li.classList.add("is-latest");
  ul.appendChild(li);
}

function initTokenLine() {
  const el = document.getElementById("token-line");
  const token = getQueryParam("token");
  if (!el) return;
  if (token) {
    el.textContent = `ご利用ID: ${token.slice(0, 6)}…（確認用）`;
  } else {
    el.textContent = "プレビュー表示（購入者専用URLではトークンが付きます）";
  }
}

function fakeShuffleDelay(ms, statusEl, message, done) {
  if (statusEl) statusEl.textContent = message || "シャッフル中…";
  setTimeout(() => {
    if (statusEl) statusEl.textContent = "";
    done();
  }, ms);
}

function cardMeta(card) {
  if (card.arcana === "major") return "大アルカナ";
  return `${card.suitJa} · ${card.rank}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCardElement(card) {
  const meaning = getCardMeaning(card.id);
  const article = document.createElement("article");
  article.className = "tarot-card";
  article.setAttribute("data-arcana", card.arcana);
  if (card.suit) article.setAttribute("data-suit", card.suit);

  const face = document.createElement("div");
  face.className = "tarot-card__face";

  const img = document.createElement("img");
  img.className = "tarot-card__img is-hidden";
  img.alt = `${card.nameJa}のカード`;
  img.loading = "lazy";
  img.decoding = "async";

  const glyphDiv = document.createElement("div");
  glyphDiv.className = "tarot-card__glyph";
  glyphDiv.setAttribute("aria-hidden", "true");
  glyphDiv.textContent = card.glyph || "✦";

  let extIndex = 0;
  img.addEventListener("load", () => {
    img.classList.remove("is-hidden");
    glyphDiv.classList.add("is-behind-image");
  });
  img.addEventListener("error", () => {
    extIndex += 1;
    if (extIndex >= CARD_IMAGE_EXTENSIONS.length) {
      img.remove();
      return;
    }
    img.src = resolveCardImageUrl(card.id, CARD_IMAGE_EXTENSIONS[extIndex]);
  });
  img.src = resolveCardImageUrl(card.id, CARD_IMAGE_EXTENSIONS[0]);

  face.appendChild(img);
  face.appendChild(glyphDiv);

  const nameEl = document.createElement("div");
  nameEl.className = "tarot-card__name";
  nameEl.textContent = card.nameJa;

  const metaEl = document.createElement("div");
  metaEl.className = "tarot-card__meta";
  metaEl.textContent = cardMeta(card);

  article.appendChild(face);
  article.appendChild(nameEl);
  article.appendChild(metaEl);

  if (meaning?.gist) {
    const g = document.createElement("div");
    g.className = "tarot-card__gist";
    g.title = "card-meanings.js";
    g.textContent = meaning.gist;
    article.appendChild(g);
  }

  return article;
}

function renderSpread(container, definitions, cards) {
  if (!container) return;
  container.innerHTML = "";
  definitions.forEach((def, i) => {
    const card = cards[i];
    if (!card) return;
    const wrap = document.createElement("div");
    wrap.className = "spread-slot";
    wrap.setAttribute("role", "listitem");
    wrap.innerHTML = `
      <div class="spread-slot__label">${escapeHtml(def.label)}</div>
      <div class="spread-slot__hint">${escapeHtml(def.hint)}</div>
    `;
    wrap.appendChild(renderCardElement(card));
    container.appendChild(wrap);
  });
}

/** @returns {Date|null} */
function parseISODate(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function ageFromBirth(iso) {
  const b = parseISODate(iso);
  if (!b) return null;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return Math.max(0, a);
}

function ageBracketLabel(age) {
  if (age == null) return "（年齢未設定）";
  if (age < 22) return "20代前半より若い／学生〜社会人初期のような立ち上がりの時期";
  if (age < 30) return "20代後半〜30代手前：選択と試行が重なりやすい時期";
  if (age < 40) return "30代：責任と役割が具体化しやすい時期";
  if (age < 55) return "40〜50代：軸の再定義と長期設計が前面に出やすい時期";
  return "55歳以降：経験を資産に変え、取捨選択が円熟しやすい時期";
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function addDays(base, n) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function formatJapaneseDate(d) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * カード＋入力から決定的な「目安日付」を3つ
 * @param {string} seedStr
 */
function deriveMilestoneDates(seedStr) {
  const h = hashString(seedStr);
  const base = new Date();
  const offsets = [
    12 + (h % 38),
    40 + ((h >> 5) % 45),
    88 + ((h >> 10) % 70),
  ];
  const labels = [
    "気持ちや状況が「動き出しやすい」最初の窓",
    "対話・調整・決断が乗りやすい中盤の波",
    "区切りや新しい型が決まりやすい後半の節目",
  ];
  return offsets.map((off, i) => ({
    label: labels[i],
    dateStr: formatJapaneseDate(addDays(base, off)),
  }));
}

function cardArcanaPhrase(card) {
  return card.arcana === "major"
    ? "人生全体のテーマとして強く効いてくる大アルカナ"
    : "日常の感情・出来事・人間関係の機微を映す小アルカナ";
}

/**
 * @param {{ label: string, hint: string }} def
 * @param {import("./tarot-deck.js").TarotCard} card
 */
function expandedCardParagraph(def, card, profile) {
  const m = getCardMeaning(card.id);
  const kw = (m.keywords || []).length ? m.keywords.join("、") : "静かな推移、内面的な調整";
  const concernSnippet = profile.concern.trim().slice(0, 120);
  const p1 = `${def.label}の位置に「${card.nameJa}」が現れました。キーワードの雰囲気は「${kw}」です。`;
  const p2 = m.gist;
  const p3 = `このカードは${cardArcanaPhrase(card)}で、あなたが書いてくださった悩み（${concernSnippet}${profile.concern.length > 120 ? "…" : ""}）に対して、「${def.hint}」という観点からメッセージを補強しています。`;
  const p4 = `年齢帯のニュアンス（${ageBracketLabel(profile.age)}）を踏まえると、同じカードでも「焦らず土台を作くる」より「選択を狭めて集中する」など、優先すべき態度が変わります。いまの段階では、${def.label}を過度に完璧にしようとせず、小さな一歩で反応を見ながら整えるのが安全側です。`;
  return `<p>${escapeHtml(p1)}</p><p>${escapeHtml(p2)}</p><p>${escapeHtml(p3)}</p><p>${escapeHtml(p4)}</p>`;
}

function partnerSection(profile) {
  if (!profile.partnerBirth || !profile.selfBirth) return "";
  const a = parseISODate(profile.selfBirth);
  const b = parseISODate(profile.partnerBirth);
  if (!a || !b) return "";
  const diffYears = Math.abs(a.getFullYear() - b.getFullYear());
  const diffMonths = Math.abs((a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth()));
  let relationHint =
    "お二人の生年月日の差から、ペースの取り方にズレが出やすい／逆に補い合いやすい、という両面があります。";
  if (diffYears >= 8) {
    relationHint +=
      " 年齢や立場のステップ差が大きいほど、「期待の言語化」と「待つ期限の合意」が鍵になりやすいです。";
  } else if (diffYears <= 2) {
    relationHint +=
      " 近い世代同士は価値観の共鳴が出やすい一方、競争や比較が燃えやすいので、役割分担の明文化が有効です。";
  } else {
    relationHint +=
      " 中程度の差は、学び合いと刺激のバランスが取りやすい帯です。対話の頻度より「質（安心できる短時間）」を優先してください。";
  }
  return `<section class="pr-sec"><h3>ふたりの関係性のニュアンス</h3><p>${escapeHtml(
    relationHint
  )}</p><p>（生年月日の差・約${diffMonths}ヶ月単位のズレを参考にした読みです。絶対的な運命ではなく、コミュニケーション設計のヒントとしてお使いください。）</p></section>`;
}

function synthesisSection(profile, threeCards, fiveCards) {
  const s0 = threeCards[0];
  const s1 = threeCards[1];
  const s2 = threeCards[2];
  const f0 = fiveCards[0];
  const f2 = fiveCards[2];
  const f3 = fiveCards[3];
  const f4 = fiveCards[4];
  const names = (c) => (c ? c.nameJa : "—");
  const concern = profile.concern.trim();
  const lead = `いまのあなたは、${concern.slice(0, 200)}${concern.length > 200 ? "…" : ""}というテーマを抱えながら、内側では「${names(
    s0
  )}」のエネルギー（現状）、外側の壁として「${names(s1)}」、そして突破口として「${names(
    s2
  )}」が重なっています。`;
  const deep = `深い層では核心に「${names(
    f0
  )}」が立ち、近い未来の動きに「${names(
    f2
  )}」が重なります。全体のまとめの示唆は「${names(
    f4
  )}」です。つまり、感情の揺れを否定せず、まずは${SPREAD_THREE[1].label}で示された課題を小さく分解し、${SPREAD_FIVE[3].label}として「${names(
    f3
  )}」の立ち位置を意識すると、流れが噛み合いやすくなります。`;
  const action = `具体的には、(1) 週に一度だけ「事実」と「感情」を分けて書き出す、(2) 相手がいる場合は要望ではなく「してほしいこと1つ」に絞って伝える、(3) 決断を急がず、次に示す目安日の前後で様子を見る、の3点が有効です。`;
  const partnerExtra = profile.partnerBirth
    ? "相手の生年月日を入れているので、「一方通行の努力」になりやすい箇所を、対話のテーマとして先に持ち出すと改善が早いです。"
    : "相手の日付が未入力のため、主にあなた自身の内面と行動面から読み解いています。";
  return `<section class="pr-sec"><h3>深読み — あなた（たち）に合わせた指針</h3><p>${escapeHtml(lead)}</p><p>${escapeHtml(deep)}</p><p>${escapeHtml(action + partnerExtra)}</p></section>`;
}

function datesSection(milestones) {
  const items = milestones
    .map(
      (m) =>
        `<li><strong>${escapeHtml(m.dateStr)}</strong> — ${escapeHtml(m.label)}。この前後1週間を「様子を見て微調整する期間」としてください。</li>`
    )
    .join("");
  return `<section class="pr-sec"><h3>流れが来やすい時期の目安（具体日付）</h3><p>以下は、カードの並びとご入力内容から算出した<strong>娯楽・内省用の目安</strong>です。確約の予言ではありません。</p><ul class="pr-date-list">${items}</ul></section>`;
}

/**
 * @param {import("./tarot-deck.js").TarotCard[]} threeCards
 * @param {import("./tarot-deck.js").TarotCard[]} fiveCards
 */
function buildReadingHtml(profile, threeCards, fiveCards) {
  const seedStr = [
    profile.concern,
    profile.selfBirth,
    profile.partnerBirth || "",
    ...threeCards.map((c) => c.id),
    ...fiveCards.map((c) => c.id),
  ].join("|");

  const milestones = deriveMilestoneDates(seedStr);

  let cardsHtml = '<section class="pr-sec"><h3>カードの意味（位置ごとの解説）</h3>';
  SPREAD_THREE.forEach((def, i) => {
    const card = threeCards[i];
    if (!card) return;
    cardsHtml += `<div class="pr-card-block"><div class="pr-card-block__title">3枚：${escapeHtml(def.label)} — ${escapeHtml(card.nameJa)}</div><div class="pr-card-block__sub">${escapeHtml(def.hint)}</div>${expandedCardParagraph(def, card, profile)}</div>`;
  });
  SPREAD_FIVE.forEach((def, i) => {
    const card = fiveCards[i];
    if (!card) return;
    cardsHtml += `<div class="pr-card-block"><div class="pr-card-block__title">5枚：${escapeHtml(def.label)} — ${escapeHtml(card.nameJa)}</div><div class="pr-card-block__sub">${escapeHtml(def.hint)}</div>${expandedCardParagraph(def, card, profile)}</div>`;
  });
  cardsHtml += "</section>";

  const inputBlock = `<section class="pr-sec"><h3>ご入力内容の要約</h3><p><strong>悩み・質問：</strong>${escapeHtml(profile.concern.trim())}</p><p><strong>あなたの生年月日：</strong>${escapeHtml(
    profile.selfBirth || "（未入力）"
  )}（年齢目安: ${profile.age != null ? escapeHtml(String(profile.age)) + "歳" : "—"}）</p>${
    profile.partnerBirth
      ? `<p><strong>相手の生年月日：</strong>${escapeHtml(profile.partnerBirth)}</p>`
      : "<p><strong>相手の生年月日：</strong>未入力（一人称中心の読み）</p>"
  }</section>`;

  const html =
    `<div class="pr-reading-root">` +
    inputBlock +
    cardsHtml +
    partnerSection(profile) +
    synthesisSection(profile, threeCards, fiveCards) +
    datesSection(milestones) +
    `<p class="pr-disclaimer">本鑑定はエンターテインメントです。医療・法律・投資などの決定は専門家へご相談ください。日付はアルゴリズムによる目安であり、結果を保証するものではありません。</p></div>`;

  return html;
}

function readProfileFromDom() {
  const concern = document.getElementById("concern")?.value || "";
  const selfBirth = document.getElementById("self-birth")?.value || "";
  const usePartner = document.getElementById("use-partner")?.checked;
  const partnerBirth = usePartner ? document.getElementById("partner-birth")?.value || "" : "";
  return {
    concern,
    selfBirth,
    partnerBirth,
    age: ageFromBirth(selfBirth),
  };
}

function validateIntro(profile, setError) {
  if (!profile.concern.trim()) {
    setError("悩み・聞きたいことを入力してください。");
    return false;
  }
  if (profile.concern.trim().length < 8) {
    setError("もう少しだけ具体的に書いてください（8文字以上）。");
    return false;
  }
  if (!profile.selfBirth) {
    setError("あなたの生年月日を選んでください。");
    return false;
  }
  if (!parseISODate(profile.selfBirth)) {
    setError("生年月日の形式が正しくありません。");
    return false;
  }
  const usePartner = document.getElementById("use-partner")?.checked;
  if (usePartner) {
    if (!profile.partnerBirth) {
      setError("相手の生年月日を入力する場合は、日付を選んでください。");
      return false;
    }
    if (!parseISODate(profile.partnerBirth)) {
      setError("相手の生年月日の形式が正しくありません。");
      return false;
    }
  }
  setError("");
  return true;
}

const state = {
  pile: [],
  three: [],
  five: [],
  profile: null,
};

function wirePartnerToggle() {
  const cb = document.getElementById("use-partner");
  const fields = document.getElementById("partner-fields");
  const input = document.getElementById("partner-birth");
  if (!cb || !fields) return;
  const sync = () => {
    fields.hidden = !cb.checked;
    if (!cb.checked && input) input.value = "";
  };
  cb.addEventListener("change", sync);
  sync();
}

function wireButtons() {
  const btnStart = document.getElementById("btn-start");
  const btnToFive = document.getElementById("btn-to-five");
  const btnFinish = document.getElementById("btn-finish");
  const statusIntro = document.getElementById("shuffle-intro");
  const statusFive = document.getElementById("shuffle-five");
  const errEl = document.getElementById("form-error");

  const setError = (msg) => {
    if (errEl) errEl.textContent = msg;
  };

  btnStart?.addEventListener("click", () => {
    const profile = readProfileFromDom();
    if (!validateIntro(profile, setError)) return;
    state.profile = profile;
    btnStart.disabled = true;
    fakeShuffleDelay(520, statusIntro, "デッキをシャッフルしています…", () => {
      const deck = shuffleDeck(buildFullDeck());
      state.pile = deck;
      state.three = state.pile.splice(0, 3);
      state.five = [];
      renderSpread(document.getElementById("spread-three"), SPREAD_THREE, state.three);
      pushTimeline(`3枚を引きました · ${state.three.map((c) => c.nameJa).join("、")}`);
      showPhase("phase-three");
    });
  });

  btnToFive?.addEventListener("click", () => {
    btnToFive.disabled = true;
    fakeShuffleDelay(560, statusFive, "残りのカードをシャッフルしています…", () => {
      state.pile = shuffleDeck(state.pile);
      state.five = state.pile.splice(0, 5);
      renderSpread(document.getElementById("spread-five"), SPREAD_FIVE, state.five);
      pushTimeline(`5枚を引きました · ${state.five.map((c) => c.nameJa).join("、")}`);
      showPhase("phase-five");
    });
  });

  btnFinish?.addEventListener("click", () => {
    const profile = state.profile || readProfileFromDom();
    const html = buildReadingHtml(profile, state.three, state.five);
    const box = document.getElementById("summary-body");
    if (box) box.innerHTML = html;
    pushTimeline("鑑定文を表示しました");
    showPhase("phase-summary");
  });
}

initTokenLine();
wirePartnerToggle();
pushTimeline("セッション開始 · フルデッキ " + buildFullDeck().length + " 枚");
showPhase("phase-intro");
wireButtons();
