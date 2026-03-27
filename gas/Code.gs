/**
 * れんの恋愛タロット — GAS バックエンド
 * 
 * 機能:
 * 1. フロントエンドから悩み・カード情報を受け取る
 * 2. GPT API で個別鑑定文を生成
 * 3. JSON で結果を返す
 * 
 * デプロイ手順:
 * 1. Google Apps Script でプロジェクト作成
 * 2. このコードを貼り付け
 * 3. スクリプトプロパティに OPENAI_API_KEY を設定
 * 4. ウェブアプリとしてデプロイ（全員がアクセス可能）
 */

const OPENAI_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 2000;

/**
 * POST リクエストを処理
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const result = generateReading(data);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * CORS 対応の GET（プリフライト用）
 */
function doGet(e) {
  return jsonResponse({ status: "ok", message: "れんの恋愛タロット API" });
}

/**
 * JSON レスポンスを返す
 */
function jsonResponse(data, code = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * GPT で鑑定文を生成
 */
function generateReading(data) {
  const { concern, selfBirth, partnerBirth, threeCards, fiveCards } = data;
  
  if (!concern || !threeCards || !fiveCards) {
    throw new Error("必須パラメータが不足しています");
  }
  
  const prompt = buildPrompt(concern, selfBirth, partnerBirth, threeCards, fiveCards);
  const readingText = callOpenAI(prompt);
  
  return {
    success: true,
    reading: readingText,
    generatedAt: new Date().toISOString()
  };
}

/**
 * プロンプトを構築
 */
function buildPrompt(concern, selfBirth, partnerBirth, threeCards, fiveCards) {
  const threeDesc = threeCards.map((c, i) => {
    const positions = ["現状", "障害・課題", "乗り越えるヒント"];
    return `${positions[i]}：${c.nameJa}（${c.arcana === "major" ? "大アルカナ" : c.suitJa}）`;
  }).join("\n");
  
  const fiveDesc = fiveCards.map((c, i) => {
    const positions = ["核心", "見えにくい要素", "近い動き", "取るとよい態度", "全体のまとめ"];
    return `${positions[i]}：${c.nameJa}（${c.arcana === "major" ? "大アルカナ" : c.suitJa}）`;
  }).join("\n");
  
  const ageInfo = selfBirth ? `相談者の生年月日：${selfBirth}` : "";
  const partnerInfo = partnerBirth ? `相手の生年月日：${partnerBirth}` : "相手の情報：なし";
  
  return `あなたは「れん」という名前の恋愛タロット占い師です。
親しみやすく、でも的確なアドバイスをする20代女性のキャラクターです。
一人称は「れん」、語尾は「〜だよ」「〜してね」など柔らかい口調で。

【相談内容】
${concern}

【相談者情報】
${ageInfo}
${partnerInfo}

【3枚スプレッド】
${threeDesc}

【5枚スプレッド】
${fiveDesc}

---

以下の構成で鑑定文を書いてください：

## 1. 最初の共感（2〜3文）
相談内容を読んで「わかるよ」「つらいよね」など共感から入る。

## 2. 3枚の解説（各カード3〜4文）
それぞれのカードが「この悩みに対して」何を示しているか具体的に。
抽象的な説明ではなく、相談内容に直接答える形で。

## 3. 5枚の解説（各カード2〜3文）
より深い層を掘り下げる。特に「核心」と「見えにくい要素」は具体的に。

## 4. 総合アドバイス（5〜6文）
8枚を踏まえて、今すぐやるべきこと1つを明確に伝える。
「連絡を控える」「自分磨きに集中」「素直に気持ちを伝える」など具体的な行動。

## 5. れんからのひとこと（2〜3文）
「応援してるよ」で締める。

---

注意:
- マークダウンの見出し（##）は使わず、自然な段落で区切る
- 各セクションの間に空行を入れて読みやすく
- カードの一般的な意味の説明は最小限に、「この悩みにどう関係するか」を中心に
- 相手がいる場合は、相手の気持ちや動きについても言及する
- 「当たってる」と感じさせる具体的な描写を入れる（例：「連絡したい衝動を抑えてない？」）
`;
}

/**
 * OpenAI API を呼び出す
 */
function callOpenAI(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY が設定されていません");
  }
  
  const url = "https://api.openai.com/v1/chat/completions";
  
  const payload = {
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: "あなたは親しみやすい恋愛タロット占い師「れん」です。" },
      { role: "user", content: prompt }
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0.8
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  
  if (json.error) {
    throw new Error("OpenAI API エラー: " + json.error.message);
  }
  
  return json.choices[0].message.content;
}

/**
 * テスト用関数
 */
function testGenerateReading() {
  const testData = {
    concern: "先週別れた彼女と復縁したい。まだ好きなのに、向こうから別れを切り出された。連絡していいのかわからない。",
    selfBirth: "1998-05-15",
    partnerBirth: "1999-03-22",
    threeCards: [
      { id: "swords_knight", nameJa: "ソードのナイト", arcana: "minor", suitJa: "ソード" },
      { id: "cups_02", nameJa: "カップの2", arcana: "minor", suitJa: "カップ" },
      { id: "swords_05", nameJa: "ソードの5", arcana: "minor", suitJa: "ソード" }
    ],
    fiveCards: [
      { id: "swords_08", nameJa: "ソードの8", arcana: "minor", suitJa: "ソード" },
      { id: "cups_08", nameJa: "カップの8", arcana: "minor", suitJa: "カップ" },
      { id: "wands_queen", nameJa: "ワンドのクイーン", arcana: "minor", suitJa: "ワンド" },
      { id: "wands_10", nameJa: "ワンドの10", arcana: "minor", suitJa: "ワンド" },
      { id: "wands_king", nameJa: "ワンドのキング", arcana: "minor", suitJa: "ワンド" }
    ]
  };
  
  const result = generateReading(testData);
  console.log(result);
}
