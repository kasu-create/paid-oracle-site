/**
 * /oracle/reading/ — シャッフル → 3枚 → 再シャッフル → 5枚 → まとめ
 */

import { buildFullDeck, shuffleDeck } from "./tarot-deck.js";
import { SPREAD_THREE, SPREAD_FIVE } from "./spread-config.js";
import { getCardMeaning } from "./card-meanings.js";

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function showPhase(id) {
  document.querySelectorAll(".phase").forEach((el) => {
    const match = el.id === id;
    el.hidden = !match;
    el.classList.toggle("is-hidden", !match);
  });
}

const timelineEl = () => document.getElementById("gh-timeline");

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
    el.textContent = `token: ${token.slice(0, 6)}…（検証未接続）`;
  } else {
    el.textContent = "preview: no token（本番は購入者専用URL）";
  }
}

function fakeShuffleDelay(ms, statusEl, message, done) {
  if (statusEl) statusEl.textContent = message || "shuffling…";
  setTimeout(() => {
    if (statusEl) statusEl.textContent = "";
    done();
  }, ms);
}

function cardMeta(card) {
  if (card.arcana === "major") return "Major Arcana";
  return `${card.suitJa} · ${card.rank}`;
}

function renderCardElement(card) {
  const meaning = getCardMeaning(card.id);
  const gistHtml = meaning?.gist
    ? `<div class="tarot-card__gist" title="card-meanings.js">${escapeHtml(meaning.gist)}</div>`
    : "";
  const article = document.createElement("article");
  article.className = "tarot-card";
  article.setAttribute("data-arcana", card.arcana);
  if (card.suit) article.setAttribute("data-suit", card.suit);
  article.innerHTML = `
    <div class="tarot-card__glyph" aria-hidden="true">${card.glyph || "✦"}</div>
    <div class="tarot-card__name">${escapeHtml(card.nameJa)}</div>
    <div class="tarot-card__meta">${escapeHtml(cardMeta(card))}</div>
    ${gistHtml}
  `;
  return article;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
      <div class="spread-slot__label">${def.label}</div>
      <div class="spread-slot__hint">${def.hint}</div>
    `;
    wrap.appendChild(renderCardElement(card));
    container.appendChild(wrap);
  });
}

function summaryCardBlock(defLabel, card) {
  const m = getCardMeaning(card.id);
  const kw = m.keywords?.length ? `（キーワード: ${m.keywords.join("・")}）` : "";
  return [`- **${defLabel}**: ${card.nameJa}${kw}`, `  ${m.gist}`];
}

function buildSummary(concern, threeCards, fiveCards) {
  const lines = [];
  lines.push("# 鑑定メモ（自動下書き）");
  lines.push("");
  lines.push("> カード別の本文は `card-meanings.js`（大アルカナ個別／小アルカナは追記で上書き）");
  lines.push("");
  if (concern?.trim()) {
    lines.push("## 入力メモ");
    lines.push(concern.trim());
    lines.push("");
  }
  lines.push("## 3枚スプレッド");
  SPREAD_THREE.forEach((d, i) => {
    const c = threeCards[i];
    if (c) lines.push(...summaryCardBlock(d.label, c), "");
  });
  lines.push("## 5枚スプレッド");
  SPREAD_FIVE.forEach((d, i) => {
    const c = fiveCards[i];
    if (c) lines.push(...summaryCardBlock(d.label, c), "");
  });
  lines.push("---");
  lines.push("（ここにヘビー総合テンプレを後から接続）");
  return lines.join("\n");
}

const state = {
  pile: [],
  three: [],
  five: [],
};

function wireButtons() {
  const btnStart = document.getElementById("btn-start");
  const btnToFive = document.getElementById("btn-to-five");
  const btnFinish = document.getElementById("btn-finish");
  const statusIntro = document.getElementById("shuffle-intro");
  const statusFive = document.getElementById("shuffle-five");

  btnStart?.addEventListener("click", () => {
    btnStart.disabled = true;
    fakeShuffleDelay(500, statusIntro, "$ shuffle deck (78) …", () => {
      const deck = shuffleDeck(buildFullDeck());
      state.pile = deck;
      state.three = state.pile.splice(0, 3);
      state.five = [];
      renderSpread(document.getElementById("spread-three"), SPREAD_THREE, state.three);
      pushTimeline(`3-card pull · ${state.three.map((c) => c.nameJa).join(", ")}`);
      showPhase("phase-three");
    });
  });

  btnToFive?.addEventListener("click", () => {
    btnToFive.disabled = true;
    fakeShuffleDelay(550, statusFive, "$ shuffle remainder (" + state.pile.length + ") …", () => {
      state.pile = shuffleDeck(state.pile);
      state.five = state.pile.splice(0, 5);
      renderSpread(document.getElementById("spread-five"), SPREAD_FIVE, state.five);
      pushTimeline(`5-card pull · ${state.five.map((c) => c.nameJa).join(", ")}`);
      showPhase("phase-five");
    });
  });

  btnFinish?.addEventListener("click", () => {
    const concern = document.getElementById("concern")?.value || "";
    const text = buildSummary(concern, state.three, state.five);
    const box = document.getElementById("summary-body");
    if (box) box.textContent = text;
    pushTimeline("summary generated");
    showPhase("phase-summary");
  });
}

initTokenLine();
pushTimeline(
  "session started · deck " + buildFullDeck().length + " · meanings: card-meanings.js"
);
showPhase("phase-intro");
wireButtons();
