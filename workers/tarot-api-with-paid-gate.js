/**
 * Cloudflare Worker: タロット鑑定API + 有料鑑定用ゲート
 *
 * ルート:
 *   POST /                    … 既存（無料サイト用・トークン不要）
 *   POST /verify-paid-access … アクセスコード検証 → 短期トークン発行
 *   POST /paid-reading       … トークン必須で GPT 鑑定（有料ページ用）
 *
 * 環境変数:
 *   OPENAI_API_KEY
 *   PAID_READING_PASSWORD        … 購入者に渡すコード（STORES と一致）
 *   PAID_READING_SIGNING_SECRET  … トークン署名用（長いランダム文字列）
 *   PAID_ACCESS_TTL_SEC          … 任意。既定 604800（7日）
 */

const SYSTEM_PROMPT = `あなたは恋愛・復縁専門の、優しくて頼れるタロット占い師「れん」です。
相談者の不安や迷いに寄り添いながら、前向きで現実的、そして実践しやすいアドバイスを届けてください。

# 基本キャラクター
- 口調：やわらかく、親しみやすく、カジュアルで優しい
- 雰囲気：共感的、安心感がある、前向き、丁寧
- スタンス：相談者の味方として寄り添う

# 出力ルール
- 相談者の気持ちを受け止める
- 厳しいカードでも傷つける言い方をしない
- 不安を煽らない
- 断定せず「こう見える」「こういう傾向がある」と柔らかく表現
- 最後は必ず前向きで実践可能なアドバイスにつなげる`;

const MAJOR_ARCANA = [
  { name: "愚者", meaning: "新しい始まり、自然体、軽やかな恋、可能性" },
  { name: "魔術師", meaning: "魅力の発揮、主導権、関係を動かす力" },
  { name: "女教皇", meaning: "秘めた想い、直感、慎重さ、言葉にしない感情" },
  { name: "女帝", meaning: "愛され力、包容力、魅力の開花、満たされる愛" },
  { name: "皇帝", meaning: "安定、責任感、現実的な愛、主導する力" },
  { name: "教皇", meaning: "誠実さ、信頼、正式な関係、価値観の一致" },
  { name: "恋人", meaning: "強い好意、惹かれ合い、選択、深い結びつき" },
  { name: "戦車", meaning: "前進、進展、積極性、関係を動かす勢い" },
  { name: "力", meaning: "思いやり、粘り強さ、感情のコントロール、関係修復" },
  { name: "隠者", meaning: "距離、慎重さ、内省、一人で考える時間" },
  { name: "運命の輪", meaning: "流れの変化、チャンス、再会、好転" },
  { name: "正義", meaning: "誠実な判断、バランス、関係の見直し" },
  { name: "吊るされた男", meaning: "停滞、我慢、見方を変える必要、待機" },
  { name: "死神", meaning: "終わりと再生、区切り、新しい形への変化" },
  { name: "節制", meaning: "歩み寄り、穏やかな回復、復縁への調整、調和" },
  { name: "悪魔", meaning: "執着、依存、離れがたさ、強い引力" },
  { name: "塔", meaning: "衝撃、突然の変化、崩壊と再構築、本音の露出" },
  { name: "星", meaning: "希望、癒し、憧れ、素直な願い、未来への光" },
  { name: "月", meaning: "不安、曖昧さ、誤解、見えない本音、揺れる感情" },
  { name: "太陽", meaning: "両思い、喜び、安心感、オープンな愛、明るい進展" },
  { name: "審判", meaning: "復活、再スタート、気持ちの再確認、関係の見直し" },
  { name: "世界", meaning: "成就、完成、安定、満たされる関係" },
];

const SUITS = ["ワンド", "カップ", "ソード", "ペンタクル"];
const NUMBERS = ["エース", "2", "3", "4", "5", "6", "7", "8", "9", "10", "ペイジ", "ナイト", "クイーン", "キング"];

function getMinorArcana() {
  const cards = [];
  for (const suit of SUITS) {
    for (const num of NUMBERS) {
      cards.push({ name: suit + "の" + num, meaning: suit + "のエネルギー、" + num + "の段階" });
    }
  }
  return cards;
}

function getAllCards() {
  return [...MAJOR_ARCANA, ...getMinorArcana()];
}

function drawCards(count) {
  const allCards = getAllCards();
  const shuffled = allCards.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function callOpenAI(apiKey, prompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error("OpenAI API error: " + response.status);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function buildPrompt(theme, relation, concern, mainCard, subCards) {
  return (
    "【鑑定依頼】\nテーマ: " +
    theme +
    "\n関係性: " +
    relation +
    "\nいま気になること: " +
    (concern || "特になし") +
    "\n\n【本鑑定カード】\n" +
    mainCard.name +
    "（" +
    mainCard.meaning +
    "）\n\n【流れを見るカード（過去・現在・未来）】\n- 過去: " +
    subCards[0].name +
    "\n- 現在: " +
    subCards[1].name +
    "\n- 未来: " +
    subCards[2].name +
    "\n\n以下の形式で鑑定結果を書いてください：\n\n## 🔮 本鑑定結果\n\n### 引いたカード\n**" +
    mainCard.name +
    "**\n\n### あなたの気持ち 💭\n[200〜300文字で相談者の気持ちを整理]\n\n### お相手の気持ち 💕\n[200〜300文字で相手の気持ちを読み解く]\n\n### アドバイス ✨\n[150〜250文字で実践的なアドバイス]\n\n## 🎁 おまけ鑑定\n\n### 過去 - " +
    subCards[0].name +
    "\n[50〜100文字]\n\n### 現在 - " +
    subCards[1].name +
    "\n[50〜100文字]\n\n### 未来 - " +
    subCards[2].name +
    "\n[50〜100文字で希望を持てる形で]\n\n---\n最後に心が軽くなる一言で締めてください。"
  );
}

async function runTarotReading(env, body) {
  const { theme, relation, concern } = body;
  if (!theme) {
    return jsonResponse({ error: "theme is required" }, 400);
  }
  const mainCard = drawCards(1)[0];
  const subCards = drawCards(3);
  const prompt = buildPrompt(theme, relation || "不明", concern, mainCard, subCards);
  const reading = await callOpenAI(env.OPENAI_API_KEY, prompt);
  return jsonResponse({
    success: true,
    mainCard,
    subCards,
    reading,
  });
}

function jsonResponse(obj, status) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Paid-Reading-Token",
  };
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function corsOnly() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Paid-Reading-Token",
    },
  });
}

function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function hmacSha256B64Url(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createPaidAccessToken(env) {
  const ttl = Number(env.PAID_ACCESS_TTL_SEC || 604800);
  const exp = Math.floor(Date.now() / 1000) + (Number.isFinite(ttl) && ttl > 60 ? ttl : 604800);
  const secret = env.PAID_READING_SIGNING_SECRET || "";
  if (!secret) {
    throw new Error("PAID_READING_SIGNING_SECRET not set");
  }
  const msg = "pr|" + exp;
  const sig = await hmacSha256B64Url(secret, msg);
  return exp + "." + sig;
}

async function verifyPaidAccessToken(token, env) {
  if (!token || typeof token !== "string") {
    return false;
  }
  const dot = token.indexOf(".");
  if (dot <= 0) {
    return false;
  }
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) {
    return false;
  }
  const secret = env.PAID_READING_SIGNING_SECRET || "";
  if (!secret) {
    return false;
  }
  const msg = "pr|" + exp;
  const expected = await hmacSha256B64Url(secret, msg);
  return timingSafeEqualString(sig, expected);
}

function extractBearerToken(request) {
  const h = request.headers.get("Authorization") || "";
  if (h.startsWith("Bearer ")) {
    return h.slice(7).trim();
  }
  return (request.headers.get("X-Paid-Reading-Token") || "").trim();
}

function normalizePath(pathname) {
  if (!pathname) {
    return "/";
  }
  const p = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return p || "/";
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return corsOnly();
    }

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    try {
      if (path === "/verify-paid-access") {
        if (request.method !== "POST") {
          return jsonResponse({ error: "Method not allowed" }, 405);
        }
        const pwd = env.PAID_READING_PASSWORD;
        const signSecret = env.PAID_READING_SIGNING_SECRET;
        if (!pwd || !signSecret) {
          return jsonResponse({ error: "Paid access not configured" }, 503);
        }
        const body = await request.json();
        const password = (body && body.password) || "";
        if (!timingSafeEqualString(String(password), String(pwd))) {
          return jsonResponse({ error: "Invalid password" }, 401);
        }
        const token = await createPaidAccessToken(env);
        return jsonResponse({ ok: true, token });
      }

      if (path === "/paid-reading") {
        if (request.method !== "POST") {
          return jsonResponse({ error: "Method not allowed" }, 405);
        }
        const token = extractBearerToken(request);
        const ok = await verifyPaidAccessToken(token, env);
        if (!ok) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const body = await request.json();
        return await runTarotReading(env, body);
      }

      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const body = await request.json();
      return await runTarotReading(env, body);
    } catch (error) {
      return jsonResponse({ error: error.message || String(error) }, 500);
    }
  },
};
