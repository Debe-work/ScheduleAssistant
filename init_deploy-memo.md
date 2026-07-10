本番は **フロント = GitHub Pages**、**API/OAuth/Gemini = Cloudflare Workers** の2系統です。AWS で言うと「S3+CloudFront 静的配信」と「Lambda（エッジ）」に近いです。リポジトリは `Debe-work/ScheduleAssistant` なので、本番フロント URL は次になります。

`https://Debe-work.github.io/ScheduleAssistant/`

---

## 全体像（何をどこに置くか）

| 役割 | サービス | 本番の置き場 |
|------|----------|--------------|
| React PWA | [GitHub Pages](https://docs.github.com/ja/pages) | `https://Debe-work.github.io/ScheduleAssistant/` |
| OAuth / session / Gemini | [Cloudflare Workers](https://developers.cloudflare.com/workers/) | `https://schedule-assistant-oauth.<あなたのsubdomain>.workers.dev` |
| セッション永続化 | [Durable Objects](https://developers.cloudflare.com/durable-objects/)（Worker 内） | Worker デプロイ時に自動作成 |
| 秘密情報 | Cloudflare Secrets / GitHub Actions secrets | リポジトリには入れない |

**Cloudflare Workers** は、世界中のエッジで動くサーバーレス関数です。AWS Lambda + API Gateway に近いですが、HTTP エントリポイントとデプロイ単位が Worker 1本にまとまっています。

**Durable Objects** は Worker に紐づく「状態を持つ小さなサーバー」です。このアプリでは OAuth セッションと PKCE を `AuthStore` に保存します（ローカル DB はありません）。

**Wrangler**（`yarn worker:deploy` が使う CLI）は、Cloudflare 向けのデプロイツールです。AWS の SAM/CDK CLI に相当します。

デプロイはどちらも **手動実行（`workflow_dispatch`）** です。push では走りません。

推奨順は次です。

1. Cloudflare 準備 → Worker 初回デプロイ（URL 確定）  
2. Google OAuth / Worker secrets を本番向けに更新  
3. GitHub Pages + Actions secrets  
4. フロントデプロイ → 動作確認  

---

## Step 0: 手元で用意しておくもの

開発で使っている値をそのまま流用してよいもの:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`（同じ OAuth クライアントに本番 redirect を追加する）
- `GEMINI_API_KEY`

本番用に新規生成を推奨するもの:

```bash
openssl rand -hex 32   # SESSION_SECRET
openssl rand -hex 32   # TOKEN_ENCRYPTION_KEY
```

開発用と分けた方が、ローカルと本番のセッションが混ざりません。

確定しておく URL:

| 用途 | 値 |
|------|-----|
| フロント origin（`APP_ORIGINS` 用） | `https://Debe-work.github.io`（パスは含めない） |
| フロント本番 URL | `https://Debe-work.github.io/ScheduleAssistant/` |
| Worker URL | 初回デプロイ後に確定 |
| Google redirect | `https://<Workerのホスト>/api/google/callback` |

---

## Step 1: Cloudflare アカウントとログイン

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/sign-up) でアカウント作成（無料プランで可）
2. ログイン後、左メニュー **Workers & Pages** を開く  
   → Worker の一覧・ログ・設定の画面です（AWS の Lambda コンソールに近い）
3. ローカルで Cloudflare にログイン:

```bash
cd /Users/watanabemakoto/Documents/ScheduleAssistant
yarn wrangler login
# または: npx wrangler login
```

ブラウザが開くので許可します。成功確認:

```bash
yarn wrangler whoami
```

ここに **Account ID** が出ます。後で GitHub Actions の `CLOUDFLARE_ACCOUNT_ID` に使います。  
ダッシュボード右サイドバーや Workers 概要にも Account ID があります。  
参考: [Find account and zone IDs](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)

---

## Step 2: Worker の本番 secrets を設定

Cloudflare の **Secrets** は、Worker にだけ見える暗号化環境変数です。AWS の Secrets Manager / SSM を Lambda にバインドするイメージに近いです。値はダッシュボード上でも再表示されません。

```bash
cd /Users/watanabemakoto/Documents/ScheduleAssistant

yarn wrangler secret put GOOGLE_CLIENT_ID --config worker/wrangler.jsonc
yarn wrangler secret put GOOGLE_CLIENT_SECRET --config worker/wrangler.jsonc
yarn wrangler secret put SESSION_SECRET --config worker/wrangler.jsonc
yarn wrangler secret put TOKEN_ENCRYPTION_KEY --config worker/wrangler.jsonc
yarn wrangler secret put GEMINI_API_KEY --config worker/wrangler.jsonc
yarn wrangler secret put APP_ORIGINS --config worker/wrangler.jsonc
```

`APP_ORIGINS` の例（カンマ区切り、末尾スラッシュなし）:

```text
http://localhost:5173,http://127.0.0.1:5173,https://Debe-work.github.io
```

- CORS と OAuth の `returnTo` 許可に使われます
- **origin のみ**（`/ScheduleAssistant` は付けない）
- ローカル開発を続けるなら localhost も残す

初回は Worker 未デプロイでも `secret put` できることが多いですが、失敗したら Step 3 のデプロイ後に再実行してください。

---

## Step 3: Worker を初回デプロイ（URL を確定）

```bash
yarn worker:deploy
```

成功すると、だいたい次のような URL が表示されます。

```text
https://schedule-assistant-oauth.<subdomain>.workers.dev
```

Worker 名は `worker/wrangler.jsonc` の `"name": "schedule-assistant-oauth"` です。  
`workers_dev: true` なので、独自ドメインなしで `*.workers.dev` が付きます。

確認:

```bash
curl https://schedule-assistant-oauth.<subdomain>.workers.dev/api/google/health
# => {"ok":true}
```

ダッシュボードでも確認できます:  
[Workers & Pages](https://dash.cloudflare.com/) → `schedule-assistant-oauth` → **Deployments** / **Logs**（Observability 有効）

---

## Step 4: Google Cloud Console の OAuth 設定を更新

[Google Cloud Console → 認証情報](https://console.cloud.google.com/apis/credentials) で、使っている OAuth クライアントを開きます。

**承認済みのリダイレクト URI** に本番を追加（開発用は残してよい）:

```text
http://localhost:8787/api/google/callback
https://schedule-assistant-oauth.<subdomain>.workers.dev/api/google/callback
```

あわせて確認:

- Google Calendar API / Google Tasks API が有効
- OAuth 同意画面が Testing なら、使う Google アカウントが Test users に入っている

---

## Step 5: GitHub Actions 用の secrets を設定

リポジトリ:  
[Settings → Secrets and variables → Actions](https://github.com/Debe-work/ScheduleAssistant/settings/secrets/actions)

### 5-1. フロント用

| Name | Value |
|------|--------|
| `VITE_WORKER_BASE_URL` | `https://schedule-assistant-oauth.<subdomain>.workers.dev`（末尾スラッシュなし） |

ビルド時にフロントへ埋め込まれる Worker のベース URL です。

### 5-2. Worker 再デプロイ用（CI）

ローカルの `yarn worker:deploy` だけでも運用できますが、ワークフロー用に次を入れます。

1. [API Tokens 作成画面](https://dash.cloudflare.com/profile/api-tokens) を開く  
2. **Create Token** → テンプレート **Edit Cloudflare Workers** を使う  
   （Workers のデプロイ権限付きトークン。IAM ユーザーのアクセスキーに近い）  
3. Account リソースを自分のアカウントに絞る  
4. トークン文字列をコピー（再表示不可）

| Name | Value |
|------|--------|
| `CLOUDFLARE_API_TOKEN` | 上で作ったトークン |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler whoami` の Account ID |

参考: [GitHub Actions で Workers をデプロイ](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)

---

## Step 6: GitHub Pages を有効化

1. [Settings → Pages](https://github.com/Debe-work/ScheduleAssistant/settings/pages)
2. **Source** を **GitHub Actions** にする  
   （`deploy.yml` が artifact を Pages に載せる方式）

初回はまだサイトが無いので、次のワークフロー実行で公開されます。

---

## Step 7: 本番デプロイを実行

どちらも **Actions タブから手動実行** です。

### 7-1. Worker（任意だが推奨）

1. [Actions → Deploy OAuth Worker](https://github.com/Debe-work/ScheduleAssistant/actions/workflows/deploy-worker.yml)
2. **Run workflow** → `master` で実行

ローカルで `yarn worker:deploy` 済みなら、この時点ではスキップしても構いません。以降の更新用です。

### 7-2. Frontend（必須）

1. [Actions → Deploy to GitHub Pages](https://github.com/Debe-work/ScheduleAssistant/actions/workflows/deploy.yml)
2. **Run workflow** → `master` で実行

`GITHUB_PAGES=true` で base path `/ScheduleAssistant/` 付きビルド → Pages へ公開されます。

完了後の URL:

`https://Debe-work.github.io/ScheduleAssistant/`

---

## Step 8: 動作確認チェックリスト

1. フロントが開く  
2. ブラウザ DevTools → Network で Worker（`VITE_WORKER_BASE_URL`）へリクエストが飛ぶ  
3. `GET .../api/google/session` が `{"authenticated":false}` など正常応答  
4. 「Google でログイン」→ 同意画面 → コールバック後にアプリへ戻る  
5. 設定ページ `/settings` でテンプレートが表示される  
6. （認証後）スケジュール生成が動く

よくある失敗:

| 症状 | 原因の目安 |
|------|------------|
| CORS エラー | `APP_ORIGINS` に `https://Debe-work.github.io` が無い / 末尾スラッシュ付き |
| OAuth redirect_uri_mismatch | Google Console の callback が Worker 本番 URL と不一致 |
| ログイン後すぐ未ログイン | `APP_ORIGINS` 不一致、または cookie（本番は `SameSite=None; Secure` でクロスオリジン対応済み） |
| フロントが Worker の localhost を叩く | GitHub secret `VITE_WORKER_BASE_URL` 未設定 or 古い値のまま再ビルドしていない |
| 404 on assets | Pages の base path。必ず Actions 経由（`GITHUB_PAGES=true`）でビルドする |

---

## 運用メモ（初回以降）

- **フロント更新**: Actions の Deploy to GitHub Pages を再実行  
- **Worker 更新**: ローカル `yarn worker:deploy`、または Deploy OAuth Worker  
- **secret 変更**: 再度 `wrangler secret put ...`（値の読み出しはできないので、手元の `~/secrets/` を正とする）  
- 独自ドメインは不要。必要になったら Workers の Custom Domains / Pages のカスタムドメインを後から足せます

---

## 最短手順サマリ

1. `wrangler login` → `secret put` ×6 → `yarn worker:deploy` で Worker URL 確定  
2. Google に本番 callback を追加  
3. GitHub secrets: `VITE_WORKER_BASE_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`  
4. Pages の Source を GitHub Actions に  
5. Deploy OAuth Worker（任意）→ Deploy to GitHub Pages（必須）  
6. `https://Debe-work.github.io/ScheduleAssistant/` でログインまで確認  

特定の Step（Cloudflare トークン作成や Google Console 画面など）で詰まったら、その画面の状態を共有してもらえれば次の操作を具体化します。