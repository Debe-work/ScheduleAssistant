# Schedule Assistant

毎朝のデイリータスク割り振りを支援する個人用 PWA。

## セットアップ

1. 依存関係をインストール

```bash
yarn install
```

2. 秘密情報をプロジェクト外に配置

```bash
mkdir -p ~/secrets
cp .env.example ~/secrets/schedule-assistant.env
# ~/secrets/schedule-assistant.env を編集
```

3. direnv を設定（任意）

```bash
cp .envrc.example .envrc
direnv allow
```

4. 開発サーバー起動

```bash
yarn dev
```

## 環境変数

| 変数 | 説明 |
|------|------|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth クライアント ID（PKCE） |
| `VITE_GEMINI_API_KEY` | Gemini API Key |
| `VITE_TEMPLATE_SOURCE` | テンプレート取得元（`local`） |

## Google Cloud Console

- OAuth 2.0 クライアント ID（ウェブアプリケーション）
- リダイレクト URI: `http://localhost:5173/`（開発）、GitHub Pages URL（本番）
- 有効化 API: Google Calendar API, Google Tasks API

## デプロイ

GitHub Actions で GitHub Pages に自動デプロイ。`VITE_GEMINI_API_KEY` は GitHub Actions Secrets から注入。

```bash
GITHUB_PAGES=true yarn build
```

## テンプレート

- スキーマ: [daily-task_template_proto.md](daily-task_template_proto.md)
- 実データ: [templates/daily-tasks.md](templates/daily-tasks.md)
