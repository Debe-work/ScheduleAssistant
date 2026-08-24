---
description: Gemini モデル catalog（shared/geminiModels.ts）と docs/gemini-models.md を最新化する
---

Schedule Assistant の Gemini モデル一覧を最新化してください。

## 参照先（必ず確認）

- モデル一覧: https://ai.google.dev/gemini-api/docs/models
- 料金・無料枠: https://ai.google.dev/gemini-api/docs/pricing
- レート制限: https://ai.google.dev/gemini-api/docs/rate-limits

## 更新対象

1. `shared/geminiModels.ts`
   - `GEMINI_MODEL_CATALOG` を更新
   - スケジュール生成で利用可能な Interactions API 向けモデルのみ含める
   - image / tts / live / embed / veo / imagen / robotics / translate 等は除外
   - Pricing で Input = Free of charge のモデルに `freeTier: true`、それ以外は `freeTier: false`
   - `DEFAULT_GEMINI_MODEL` は変更しない（変更が必要な場合のみ理由を明記）

2. `docs/gemini-models.md`
   - テーブル・選定ガイド・更新履歴を catalog と同期

## 触らないもの

- ユーザーの localStorage（`gemini-model:v1`）— マイグレーション不要
- フロント / Worker の選択 UI ロジック（catalog 更新だけで足りる）

## 検証

- `yarn test`
- `yarn worker:typecheck`
- `yarn lint`

## 完了後（必須）

変更内容を要約し、チャットで次を確認してください。ユーザーが明示的に選ぶまで、コミット・push・デプロイは行わないこと。

- **A)** 修正のみ（コミット・デプロイはしない）
- **B)** コミットまで
- **C)** コミット + 本番デプロイまで（Worker: `yarn worker:deploy`、フロント: 通常の build/deploy 手順）

## 補足

- モデル一覧は **静的定義**（`shared/geminiModels.ts`）。ランタイム API 取得は行いません。
- 無料枠情報も API からは取れないため、公式 Pricing を見て `freeTier` フラグを手動で更新します。
