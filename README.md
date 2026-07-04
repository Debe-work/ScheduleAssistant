# Schedule Assistant

毎朝のデイリータスク割り振りを支援する個人用 PWA。

フロントエンドは GitHub Pages に配信し、Google OAuth の code exchange / refresh / session 管理だけを Cloudflare Workers に切り出す構成です。

## セットアップ

1. 依存関係をインストール

```bash
yarn install
```

2. フロントエンド用の公開設定をプロジェクト外に配置

```bash
mkdir -p ~/secrets
cp .env.example ~/secrets/schedule-assistant.env
# ~/secrets/schedule-assistant.env を編集
```

3. Worker 用のローカル秘密情報を作成

```bash
cp worker/.dev.vars.example worker/.dev.vars
# worker/.dev.vars を編集
```

4. direnv を設定（任意）

```bash
cp .envrc.example .envrc
direnv allow
```

5. 開発サーバー起動

```bash
yarn dev
yarn worker:dev
```

フロントは `http://localhost:5173`、Worker は `http://localhost:8787` で起動します。

## 環境変数

### フロントエンド (`~/secrets/schedule-assistant.env`)

| 変数 | 説明 |
|------|------|
| `VITE_GEMINI_API_KEY` | Gemini API Key |
| `VITE_TEMPLATE_SOURCE` | テンプレート取得元（`local`） |
| `VITE_WORKER_BASE_URL` | OAuth Worker のベース URL。ローカルは `http://localhost:8787` |

### Worker (`worker/.dev.vars` または Cloudflare Secrets)

| 変数 | 説明 |
|------|------|
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアント Secret |
| `SESSION_SECRET` | session cookie 署名用のランダム文字列 |
| `TOKEN_ENCRYPTION_KEY` | access token / refresh token 暗号化用のランダム文字列 |
| `APP_ORIGINS` | フロントエンドから Worker を呼ぶ許可 origin のカンマ区切り一覧 |

## Google Cloud Console

- OAuth 2.0 クライアント ID（ウェブアプリケーション）
- リダイレクト URI:
  - 開発: `http://localhost:8787/api/google/callback`
  - 本番: `https://<your-worker-subdomain>.workers.dev/api/google/callback` または独自ドメインの callback URL
- 有効化 API: Google Calendar API, Google Tasks API
- OAuth consent screen の Test users に利用アカウントを追加

## Cloudflare Worker の準備

1. Cloudflare に Worker を作成
2. 本番 secrets を設定

```bash
wrangler secret put GOOGLE_CLIENT_ID --config worker/wrangler.jsonc
wrangler secret put GOOGLE_CLIENT_SECRET --config worker/wrangler.jsonc
wrangler secret put SESSION_SECRET --config worker/wrangler.jsonc
wrangler secret put TOKEN_ENCRYPTION_KEY --config worker/wrangler.jsonc
```

3. `APP_ORIGINS` は `wrangler.jsonc` の environment 変数ではなく、Cloudflare dashboard か `wrangler secret put` 相当で設定してもよいです。少なくとも開発用の `http://localhost:5173` と、本番用の GitHub Pages origin を含めてください。

## デプロイ

### Frontend

GitHub Actions で GitHub Pages に自動デプロイします。

```bash
GITHUB_PAGES=true yarn build
```

必要な GitHub Actions secrets:

- `VITE_GEMINI_API_KEY`
- `VITE_WORKER_BASE_URL`

### Worker

`.github/workflows/deploy-worker.yml` で Cloudflare Workers へデプロイします。

必要な GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## テンプレート

- スキーマ: [daily-task_template_proto.md](daily-task_template_proto.md)
- 実データ: [templates/daily-tasks.md](templates/daily-tasks.md)
