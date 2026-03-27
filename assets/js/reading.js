/**
 * /oracle/reading/ — プロフィール → シャッフル → 3枚 → 再シャッフル → 5枚 → GPT鑑定
 */

import { buildFullDeck, shuffleDeck } from "./tarot-deck.js";
import { SPREAD_THREE, SPREAD_FIVE } from "./spread-config.js";
import { resolveCardImageUrl, CARD_IMAGE_EXTENSIONS } from "./card-images.js";

// ========================================
// 設定
// ========================================

// GAS ウェブアプリの URL（デプロイ後に書き換える）
const GAS_API_URL = "";

// ========================================
// ユーティリティ
// ========================================

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

function fakeShuffleDelay(ms, statusEl, message, done) {
  if (statusEl) statusEl.textContent = message || "シャッフル中…";
  setTimeout(() => {
    if (statusEl) statusEl.textContent = "";
    done();
  }, ms);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cardMeta(card) {
  if (card.arcana === "major") return "大アルカナ";
  return `${card.suitJa} · ${card.rank}`;
}

/** @returns {Date|null} */
function parseISODate(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

// ========================================
// カード表示
// ========================================

function renderCardElement(card, showLabel = false, label = "") {
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

  article.appendChild(face);
  article.appendChild(nameEl);

  if (showLabel && label) {
    const labelEl = document.createElement("div");
    labelEl.className = "tarot-card__label";
    labelEl.textContent = label;
    article.appendChild(labelEl);
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

/**
 * 最終鑑定画面用のカード一覧を表示
 */
function renderSummaryCards(container, threeCards, fiveCards) {
  if (!container) return;
  container.innerHTML = "";

  // 3枚セクション
  const threeSection = document.createElement("div");
  threeSection.className = "summary-cards__section";
  threeSection.innerHTML = `<h4 class="summary-cards__title">3枚スプレッド</h4>`;
  const threeRow = document.createElement("div");
  threeRow.className = "summary-cards__row";
  SPREAD_THREE.forEach((def, i) => {
    const card = threeCards[i];
    if (card) threeRow.appendChild(renderCardElement(card, true, def.label));
  });
  threeSection.appendChild(threeRow);
  container.appendChild(threeSection);

  // 5枚セクション
  const fiveSection = document.createElement("div");
  fiveSection.className = "summary-cards__section";
  fiveSection.innerHTML = `<h4 class="summary-cards__title">5枚スプレッド</h4>`;
  const fiveRow = document.createElement("div");
  fiveRow.className = "summary-cards__row";
  SPREAD_FIVE.forEach((def, i) => {
    const card = fiveCards[i];
    if (card) fiveRow.appendChild(renderCardElement(card, true, def.label));
  });
  fiveSection.appendChild(fiveRow);
  container.appendChild(fiveSection);
}

// ========================================
// GPT API 呼び出し
// ========================================

async function callGptReading(profile, threeCards, fiveCards) {
  if (!GAS_API_URL) {
    // API URL 未設定時はフォールバック（テスト用）
    return generateFallbackReading(profile, threeCards, fiveCards);
  }

  const payload = {
    concern: profile.concern,
    selfBirth: profile.selfBirth,
    partnerBirth: profile.partnerBirth || null,
    threeCards: threeCards.map((c) => ({
      id: c.id,
      nameJa: c.nameJa,
      arcana: c.arcana,
      suitJa: c.suitJa || null,
    })),
    fiveCards: fiveCards.map((c) => ({
      id: c.id,
      nameJa: c.nameJa,
      arcana: c.arcana,
      suitJa: c.suitJa || null,
    })),
  };

  try {
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`API エラー: ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }

    return data.reading;
  } catch (err) {
    console.error("GPT API 呼び出し失敗:", err);
    // エラー時はフォールバック
    return generateFallbackReading(profile, threeCards, fiveCards);
  }
}

/**
 * API 未設定 or エラー時のフォールバック鑑定文
 */
function generateFallbackReading(profile, threeCards, fiveCards) {
  const concern = profile.concern.trim();
  const t0 = threeCards[0]?.nameJa || "—";
  const t1 = threeCards[1]?.nameJa || "—";
  const t2 = threeCards[2]?.nameJa || "—";
  const f0 = fiveCards[0]?.nameJa || "—";
  const f1 = fiveCards[1]?.nameJa || "—";
  const f2 = fiveCards[2]?.nameJa || "—";
  const f3 = fiveCards[3]?.nameJa || "—";
  const f4 = fiveCards[4]?.nameJa || "—";

  return `「${concern.slice(0, 100)}${concern.length > 100 ? "…" : ""}」という悩みを持ってきてくれたんだね。

まず3枚のカードを見てみるね。

現状には「${t0}」が出ているよ。今のあなたの状態をそのまま映し出しているカードだね。

障害・課題の位置には「${t1}」。これが今、あなたの前に立ちはだかっているものを表しているよ。

乗り越えるヒントとして「${t2}」が出た。このカードが示す方向に意識を向けてみて。

次に5枚でもっと深く見ていくね。

核心にあるのは「${f0}」。この悩みの本当の根っこにある感情やパターンがここに出ているよ。

見えにくい要素として「${f1}」が浮かび上がった。無意識に避けていること、まだ気づいていない大切なことがここにあるかもしれない。

近い動きとして「${f2}」が出ている。これからの変化の兆しだね。

取るとよい態度は「${f3}」。このカードが示す姿勢を意識してみて。

全体のまとめとして「${f4}」が現れた。これが今回の鑑定で一番伝えたいメッセージの核だよ。

焦らなくて大丈夫。小さな一歩から始めてみてね。れんは応援してるよ。`;
}

// ========================================
// 鑑定文 HTML 生成
// ========================================

function buildReadingHtml(readingText) {
  // GPT の出力をパラグラフに分割して HTML 化
  const paragraphs = readingText
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => {
      // 改行を <br> に変換
      const lines = p.split(/\n/).map((line) => escapeHtml(line.trim())).filter(Boolean);
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");

  return `<div class="pr-reading-root">
    <section class="pr-sec pr-sec--reading">
      ${paragraphs}
    </section>
  </div>`;
}

// ========================================
// フォーム処理
// ========================================

function readProfileFromDom() {
  const concern = document.getElementById("concern")?.value || "";
  const selfBirth = document.getElementById("self-birth")?.value || "";
  const partnerBirth = document.getElementById("partner-birth")?.value || "";
  return {
    concern,
    selfBirth,
    partnerBirth,
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
  setError("");
  return true;
}

// ========================================
// 状態管理
// ========================================

const state = {
  pile: [],
  three: [],
  five: [],
  profile: null,
};

// ========================================
// イベント
// ========================================

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
      renderSpread(
        document.getElementById("spread-three"),
        SPREAD_THREE,
        state.three
      );
      showPhase("phase-three");
    });
  });

  btnToFive?.addEventListener("click", () => {
    btnToFive.disabled = true;
    fakeShuffleDelay(560, statusFive, "残りのカードをシャッフルしています…", () => {
      state.pile = shuffleDeck(state.pile);
      state.five = state.pile.splice(0, 5);
      renderSpread(
        document.getElementById("spread-five"),
        SPREAD_FIVE,
        state.five
      );
      showPhase("phase-five");
    });
  });

  btnFinish?.addEventListener("click", async () => {
    const profile = state.profile || readProfileFromDom();
    const box = document.getElementById("summary-body");
    const cardsContainer = document.getElementById("summary-cards");
    
    // カード表示
    renderSummaryCards(cardsContainer, state.three, state.five);
    
    // ローディング表示
    if (box) {
      box.innerHTML = `
        <div class="pr-loading">
          <div class="pr-loading__spinner"></div>
          <p class="pr-loading__text">れんが鑑定中…少し待っててね</p>
        </div>
      `;
    }
    
    showPhase("phase-summary");
    btnFinish.disabled = true;

    // GPT で鑑定文生成
    const readingText = await callGptReading(profile, state.three, state.five);
    const html = buildReadingHtml(readingText);
    
    if (box) box.innerHTML = html;
  });
}

// ========================================
// 初期化
// ========================================

showPhase("phase-intro");
wireButtons();
