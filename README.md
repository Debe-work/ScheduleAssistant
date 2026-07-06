# Schedule Assistant

毎朝のデイリータスク割り振りを支援する個人用 PWA。

フロントエンドは GitHub Pages に配信し、Google OAuth の code exchange / refresh / session 管理と Gemini API 呼び出しを Cloudflare Workers に切り出す構成です。

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

Vite は起動時・ビルド時に `~/secrets/schedule-assistant.env` を自動読み込みします。`direnv` がなくても構いません。

3. Worker 用のローカル秘密情報をプロジェクト外に配置

```bash
mkdir -p ~/secrets
cp worker/.dev.vars.example ~/secrets/schedule-assistant-worker.env
# ~/secrets/schedule-assistant-worker.env を編集
```

以前の `worker/.dev.vars` が残っている場合は、値を移し替えた後に削除してください。

4. direnv を設定（任意、フロントエンド公開設定のみ）

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
| `VITE_WORKER_BASE_URL` | Worker のベース URL。ローカルは `http://localhost:8787` |

### Worker (`~/secrets/schedule-assistant-worker.env` または Cloudflare Secrets)

| 変数 | 説明 |
|------|------|
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアント Secret |
| `SESSION_SECRET` | session cookie 署名用のランダム文字列 |
| `TOKEN_ENCRYPTION_KEY` | access token / refresh token 暗号化用のランダム文字列 |
| `GEMINI_API_KEY` | Gemini API Key。フロントエンドには公開しません |
| `APP_ORIGINS` | フロントエンドから Worker を呼ぶ許可 origin のカンマ区切り一覧 |

`yarn worker:dev` は `~/secrets/schedule-assistant-worker.env` を専用スクリプト経由で読み込みます。秘密情報をシェル全体に export したくないため、`direnv` では Worker secrets を読み込みません。

## Google Cloud Console

- OAuth 2.0 クライアント ID（ウェブアプリケーション）
- リダイレクト URI:
  - 開発: `http://localhost:8787/api/google/callback`
  - 本番: `https://<your-worker-subdomain>.workers.dev/api/google/callback` または独自ドメインの callback URL
- 有効化 API: Google Calendar API, Google Tasks API
- OAuth consent screen の Test users に利用アカウントを追加

## Gemini API

Gemini API Key は Worker secret の `GEMINI_API_KEY` として保持します。フロントエンドのビルド成果物には含めません。

Google AI Studio で API Key を作成し、Cloudflare Worker へ設定してください。

## Cloudflare Worker の準備

Worker 定義は `worker/wrangler.jsonc` にあり、Durable Object (`AuthStore`) で OAuth セッションと PKCE トランザクションを保持します。

1. 本番 secrets を設定

```bash
wrangler secret put GOOGLE_CLIENT_ID --config worker/wrangler.jsonc
wrangler secret put GOOGLE_CLIENT_SECRET --config worker/wrangler.jsonc
wrangler secret put SESSION_SECRET --config worker/wrangler.jsonc
wrangler secret put TOKEN_ENCRYPTION_KEY --config worker/wrangler.jsonc
wrangler secret put GEMINI_API_KEY --config worker/wrangler.jsonc
```

2. `APP_ORIGINS` を設定

```bash
wrangler secret put APP_ORIGINS --config worker/wrangler.jsonc
```

値には、少なくとも開発用の `http://localhost:5173` と、本番用の GitHub Pages origin（例: `https://<your-github-user>.github.io`）をカンマ区切りで含めてください。

3. 初回デプロイ

```bash
yarn worker:deploy
```

GitHub Actions からデプロイする場合は、必要な secrets を設定した後に `.github/workflows/deploy-worker.yml` を手動実行してください（デプロイ前に `yarn worker:typecheck` を実行）。

## デプロイ

### Frontend

GitHub Actions（`.github/workflows/deploy.yml`）で GitHub Pages にデプロイします。push では実行されないため、必要な GitHub Actions secrets を設定した後に手動実行してください。

`GITHUB_PAGES=true` ビルド時の base path は `/ScheduleAssistant/` です。本番 URL は `https://<your-github-user>.github.io/ScheduleAssistant/` になります。

```bash
GITHUB_PAGES=true yarn build
```

必要な GitHub Actions secrets:

- `VITE_WORKER_BASE_URL`

### Worker

`.github/workflows/deploy-worker.yml` で Cloudflare Workers へデプロイします。

必要な GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## テンプレート

テンプレートは **現時点ではリポジトリ内に同梱しているだけ** です。将来は GitHub の特定リポジトリや Google Drive など、別の場所から取得する構成に切り替える可能性があります。

- スキーマ: [daily-task_template_proto.md](daily-task_template_proto.md)
- 編集元（暫定）: [templates/daily-tasks.md](templates/daily-tasks.md)

現実装では、アプリは実行時に `public/templates/daily-tasks.md` を fetch します（`src/services/templateLoader.ts`）。`yarn build` の prebuild で `templates/daily-tasks.md` から自動コピーされます。開発中に `templates/` を編集した場合は、同ファイルを `public/templates/` にコピーするか `yarn prebuild` を実行してください。
