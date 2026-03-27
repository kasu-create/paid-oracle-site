# 購入者限定アクセスの設定手順

> **重要:** 先に **Cloudflare Worker** を本ドキュメントどおり更新・デプロイしてから、`paid-oracle-site` を GitHub にプッシュしてください。順序が逆だと、ゲートでコード検証に失敗したり、`/paid-reading` が 404 になることがあります。

有料鑑定ページ（`/oracle/reading/`）を **アクセスコード入力後だけ** 利用できるようにする手順です。  
静的サイト（GitHub Pages）だけでは完全な秘匿はできないため、**鑑定API（GPT）もトークンなしでは呼べない**ように Cloudflare Worker を拡張します。

## 仕組み

1. 購入者は **STORES** の購入完了後に表示する **アクセスコード（パスワード）** を受け取る。
2. 鑑定の入り口は **`gate.html`**。コードを入力すると Worker が検証し、**短期トークン** を `sessionStorage` に保存。
3. **`index.html`**（`reading.js`）はトークンがない／期限切れなら `gate.html` にリダイレクト。
4. GPT 鑑定は **`/paid-reading`** にだけ POST し、**トークン付き**でないと Worker が OpenAI を呼ばない。

※ トークンを DevTools でコピーされた場合は共有されるため、**コードは定期的に変えられる**運用（Worker の環境変数を更新）を推奨します。

---

## A. Cloudflare Worker（既存 `tarot-api`）の更新

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers** → **`tarot-api`** を開く。
2. リポジトリ内の **`workers/tarot-api-with-paid-gate.js`** の内容を **すべてコピー**し、エディタの既存コードを **丸ごと置き換え**。
3. **Deploy** をクリック。

### 環境変数（Settings → Variables）

| 名前 | 説明 |
|------|------|
| `OPENAI_API_KEY` | 既存のまま |
| `PAID_READING_PASSWORD` | 購入者に渡す **アクセスコード**（STORES の「購入後メッセージ」に記載する文字列と同じ） |
| `PAID_READING_SIGNING_SECRET` | **推測されにくい長いランダム文字列**（パスワードとは別。トークン署名用。外部に書かない） |
| `PAID_ACCESS_TTL_SEC` | （任意）トークン有効秒。未設定時は **604800**（7日） |

4. 保存後、再度 **Deploy** が必要な場合は実行。

### 動作確認（PowerShell の例）

アクセスコードを `YOUR_CODE` に置き換え:

```powershell
$r = Invoke-RestMethod -Uri "https://tarot-api.tttttkasu.workers.dev/verify-paid-access" -Method POST -ContentType "application/json" -Body '{"password":"YOUR_CODE"}'
$r.token
```

`token` が返れば OK。

---

## B. GitHub（`paid-oracle-site`）のデプロイ

次のファイルをコミットして **Push** し、GitHub Pages を更新する。

- `oracle/reading/gate.html`（新規）
- `assets/js/reading.js`（ゲート＋`/paid-reading` 対応）
- `docs/PAID_ACCESS_SETUP.md`（本ファイル）

### 購入者に渡す URL

- **推奨（ゲート経由）:**  
  `https://kasu-create.github.io/paid-oracle-site/oracle/reading/gate.html`

`index.html` を直接ブックマークしても、トークンがないと自動で `gate.html` に飛びます。

---

## C. STORES での出品設定

1. 商品の **購入完了後に表示するメッセージ**（またはデジタルコンテンツの説明）に、次を記載する。

   - 鑑定ページのURL:  
     `https://kasu-create.github.io/paid-oracle-site/oracle/reading/gate.html`
   - **アクセスコード:** `PAID_READING_PASSWORD` に設定した文字列（商品ごとに変える場合は Worker 側のロジック拡張が必要）

2. **注意:** `oracle.example.com` などのダミーURLは使わない。

3. コードを変更したら、Cloudflare の **`PAID_READING_PASSWORD`** も同じ内容に更新し **Deploy**。

---

## 無料サイト（`continue_all_free.html`）について

Worker の **`POST /`**（ルート）は従来どおり **トークンなし**で動きます。  
購入者限定は **`POST /paid-reading`** のみです。

---

## トラブルシューティング

| 現象 | 確認 |
|------|------|
| コード正しいのに弾かれる | `PAID_READING_PASSWORD` のスペース・全角半角、Worker の Deploy |
| いつもフォールバック鑑定になる | ブラウザの開発者ツール → Network で `paid-reading` が 401 になっていないか |
| verify が 404 | Worker のコードが `verify-paid-access` ルート付きの版に更新されているか |
