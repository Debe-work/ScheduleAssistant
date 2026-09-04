# Gemini API モデル選定メモ

Schedule Assistant で利用する Gemini モデルの調査メモ。  
公式情報は変わることがあるため、最終判断は [公式 Pricing](https://ai.google.dev/gemini-api/docs/pricing) と [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) を正とする。

**調査日**: 2026-09-04

---

## このアプリの現状

| 項目 | 値 |
|---|---|
| デフォルトモデル | `gemini-3.5-flash-lite` |
| ユーザー選択 | 設定画面で変更可能（localStorage `gemini-model:v1`） |
| 呼び出し経路 | フロント → Worker `POST /api/gemini/schedule` → Gemini Interactions API |
| catalog 定義 | [`shared/geminiModels.ts`](../shared/geminiModels.ts) |
| API キー | Worker secret `GEMINI_API_KEY`（フロントには公開しない） |

```ts
// shared/geminiModels.ts
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
```

---

## モデル一覧の更新手順

1. 公式 [Models](https://ai.google.dev/gemini-api/docs/models) / [Pricing](https://ai.google.dev/gemini-api/docs/pricing) を確認
2. [`shared/geminiModels.ts`](../shared/geminiModels.ts) の `GEMINI_MODEL_CATALOG` を更新
3. 本ファイル（調査メモ）のテーブル・更新履歴を同期
4. `yarn test && yarn worker:typecheck && yarn lint` を実行
5. Agent チャットで `/update-gemini-models` を実行（定義: [`.cursor/commands/update-gemini-models.md`](../.cursor/commands/update-gemini-models.md)）

---

## 呼び出し方式

Worker は `POST /v1beta/interactions` を使い、モデル名はリクエストごとに catalog から解決します。

- 入力: `input` にスケジュール生成プロンプトを渡す
- 構造化出力: `response_format` でスケジュールJSONのSchemaを指定
- 保存: `store: false` を指定し、Calendar／Todo情報をInteraction履歴に保存しない
- 応答: `steps` の `model_output` からテキストを取り出し、Worker側でもJSONと業務ルールを検証

Interactions API は将来のマルチターン会話、ツール呼び出し、バックグラウンド実行へ拡張しやすい一方、現在のスケジュール生成は一回完結の同期処理なので、`previous_interaction_id` と `background` は使用しません。

---

## 無料枠（Free Tier）があるモデル

[公式 Pricing](https://ai.google.dev/gemini-api/docs/pricing) で **Input price = Free of charge** と記載されているモデル。  
Standard モードを前提とする（Batch / Flex は無料枠なしのことが多い）。

### テキスト生成（スケジュール生成の候補）

| モデル | 無料枠 | 有料時の目安（入力 / 出力 per 1M tokens） | 備考 |
|---|---|---|---|
| **Gemini 3.8 Flash** | あり | $1.50 / $7.50 | 最新・最高性能 Flash（2026-09 GA） |
| **Gemini 3.7 Flash** | あり | $1.50 / $7.50 | 高速 Flash（2026-08 GA） |
| **Gemini 3.6 Flash** | あり | $1.50 / $7.50 | Flash 系 |
| **Gemini 3.5 Flash** | あり | $1.50 / $9.00 | GA。高性能 Flash |
| **Gemini 3.5 Flash-Lite** | あり | $0.30 / $2.50 | 安・高速寄り |
| **Gemini 3.1 Flash-Lite** | あり | $0.25 / $1.50 | |
| **Gemini 3 Flash Preview** | あり | $0.50 / $3.00 前後 | Preview |
| **Gemini 2.5 Pro** | あり | $1.25 / $10.00（≤200k tokens） | 推論強め。無料枠の RPD は厳しめ |
| **Gemini 2.5 Flash** | あり | $0.30 / $2.50 | **現行利用中**。バランス型 |
| **Gemini 2.5 Flash-Lite** | あり | $0.10 / $0.40 前後 | 最安クラス |

### その他（無料枠あり・本アプリ用途外）

| モデル | 用途 |
|---|---|
| Gemini 3.5 Live Translate | 翻訳 |
| Gemini 3.1 Flash Live Preview | Live API |
| Gemini 3.1 Flash TTS Preview | 音声合成 |
| Gemini 2.5 Flash Native Audio (Live API) | 音声 |
| Gemini 2.5 Flash Preview TTS | 音声合成 |
| Gemini Embedding / Gemini Embedding 2 | 埋め込み |
| Gemini Robotics-ER 1.6 Preview | ロボティクス |

---

## 無料枠なし（有料のみ）の主なモデル

| モデル | 備考 |
|---|---|
| `gemini-3.1-pro-preview` | 高推論。API 無料枠なし |
| Gemini Omni Flash Preview | |
| Gemini 3.1 Flash Image (Nano Banana 2) | 画像生成 |
| Gemini 3 Pro Image (Nano Banana Pro) | 画像生成 |
| Gemini 2.5 Flash Image (Nano Banana) | 画像生成 |
| Gemini 2.5 Computer Use Preview | エージェント系 |
| Imagen 4 / Veo 3 / Lyria 3 など | 画像・動画・音楽 |

---

## レート制限（参考）

無料枠は **トークン課金ゼロ** だが、**RPM（分あたりリクエスト）・RPD（日あたりリクエスト）・TPM（分あたりトークン）** の上限がある。  
数値はプロジェクト・モデル・時期で変わるため、以下で確認する。

| 確認先 | URL |
|---|---|
| 自分のプロジェクトの実効クォータ | https://aistudio.google.com/rate-limit |
| 公式 Rate limits ドキュメント | https://ai.google.dev/gemini-api/docs/rate-limits |

### レート制限の確認方法

モデル別の RPM・TPM・RPD は、プロジェクトの利用 tier と時点によって変動します。
公式ドキュメントは固定値を保証していないため、数値を catalog や本書に埋め込まず、
実効値は AI Studio の Rate limits 画面で確認してください。無料 tier では
入力・出力 token が無料でも、RPM・TPM・RPD の制限は適用されます。

---

## 無料枠の注意点

1. **データ利用**: 無料枠ではプロンプト・出力が Google の製品改善に使われる可能性がある（有料 tier では No）。
2. **SLA なし**: 無料枠はベストエフォート。本番 SLA は有料 tier。
3. **クレジットカード不要**: API キーは AI Studio から無料で発行可能。
4. **クォータはプロジェクト単位**: API キーではなく Google Cloud プロジェクトごとに適用。
5. **Preview モデル**: 仕様・提供終了日が変わりやすい。本番利用は GA モデルを優先。

---

## このアプリ向けの選定ガイド

1回のスケジュール生成は **カレンダー・タスク・テンプレートをまとめた JSON 出力** で、入力・出力ともそこそこ重い。

| 方針 | 候補 | 向いているケース |
|---|---|---|
| **品質優先** | `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash` | 複雑な制約・推論を増やしたい |
| **現状維持** | `gemini-2.5-flash` | 実績あり・バランス型 |
| **枠・コスト優先** | `gemini-2.5-flash-lite`, `gemini-3.1-flash-lite` | 個人利用・1日の生成回数を増やしたい |
| **推論・品質優先** | `gemini-2.5-pro` | 無料枠あり。複雑な制約・推論向け |
| **最高品質（有料覚悟）** | `gemini-3.1-pro-preview` | 無料枠なし。品質最優先 |

### おすすめの検討順

1. まず `gemini-3.5-flash-lite`（デフォルト）で品質・429 エラーを確認
2. 品質不足なら `gemini-3.8-flash` → `gemini-3.7-flash` → `gemini-3.5-flash` の順で試す
3. RPD / RPM に当たるなら `gemini-3.1-flash-lite` に下げる
4. それでも不足なら有料 tier または Pro 系

---

## モデル変更手順

1. [`shared/geminiModels.ts`](../shared/geminiModels.ts) の `GEMINI_MODEL_CATALOG` を更新（または設定画面でユーザーが選択）
2. Worker を再起動（`yarn worker:dev`）
3. スケジュール生成を実行し、JSON 形式・品質・429 の有無を確認
4. 本番デプロイ前に `yarn worker:typecheck` / `yarn test` を実行

catalog 自体を最新化する場合は Agent チャットで `/update-gemini-models` を実行（[`.cursor/commands/update-gemini-models.md`](../.cursor/commands/update-gemini-models.md)）。

---

## 公式リンク

| 内容 | URL |
|---|---|
| 料金・無料枠の有無 | https://ai.google.dev/gemini-api/docs/pricing |
| レート制限 | https://ai.google.dev/gemini-api/docs/rate-limits |
| モデル一覧 | https://ai.google.dev/gemini-api/docs/models |
| API キー発行（AI Studio） | https://aistudio.google.com/ |
| 自分のクォータ確認 | https://aistudio.google.com/rate-limit |
| Interactions API 概要 | https://ai.google.dev/gemini-api/docs/interactions-overview |
| Interactions API Structured Output | https://ai.google.dev/gemini-api/docs/interactions/structured-output |
| Quickstart | https://ai.google.dev/gemini-api/docs/quickstart |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| 2026-07-26 | 初版作成。現行 `gemini-2.5-flash` と無料枠モデル一覧を整理 |
| 2026-07-26 | 利用モデルを `gemini-3.5-flash-lite` に変更 |
| 2026-07-27 | 設定画面でのモデル選択対応。catalog を `shared/geminiModels.ts` に移行 |
| 2026-08-25 | Interactions APIへ移行。JSON Schema出力と`store: false`を採用 |
| 2026-08-25 | 公式 Models / Pricing / Rate limits と catalog を照合。Interactions API 対応のテキスト生成モデルのみ掲載し、料金・レート制限の記述を更新 |
| 2026-09-04 | `gemini-3.8-flash`（9/2 GA）と `gemini-3.7-flash`（8/13 GA）を無料枠付きで catalog に追加 |
