# Gemini API モデル選定メモ

Schedule Assistant で利用する Gemini モデルの調査メモ。  
公式情報は変わることがあるため、最終判断は [公式 Pricing](https://ai.google.dev/gemini-api/docs/pricing) と [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) を正とする。

**調査日**: 2026-07-26

---

## このアプリの現状

| 項目 | 値 |
|---|---|
| 利用モデル | `gemini-3.5-flash-lite` |
| 呼び出し経路 | フロント → Worker `POST /api/gemini/schedule` → Gemini API |
| 定義場所 | `worker/src/index.ts` の `GEMINI_GENERATE_URL` |
| API キー | Worker secret `GEMINI_API_KEY`（フロントには公開しない） |

```ts
// worker/src/index.ts
const GEMINI_GENERATE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
```

---

## 無料枠（Free Tier）があるモデル

[公式 Pricing](https://ai.google.dev/gemini-api/docs/pricing) で **Input price = Free of charge** と記載されているモデル。  
Standard モードを前提とする（Batch / Flex は無料枠なしのことが多い）。

### テキスト生成（スケジュール生成の候補）

| モデル | 無料枠 | 有料時の目安（入力 / 出力 per 1M tokens） | 備考 |
|---|---|---|---|
| **Gemini 3.6 Flash** | あり | $1.50 / $7.50 | 最新 Flash 系 |
| **Gemini 3.5 Flash** | あり | $1.50 / $9.00 | |
| **Gemini 3.5 Flash-Lite** | あり | $0.30 / $2.50 | 安・高速寄り |
| **Gemini 3.1 Flash-Lite** | あり | $0.25 / $1.50 | |
| **Gemini 3 Flash Preview** | あり | $0.50 / $3.00 前後 | Preview |
| **Gemini 2.5 Pro** | あり | $1.25 / $10.00（≤200k tokens） | 推論強め。無料枠の RPD は厳しめ |
| **Gemini 2.5 Flash** | あり | $0.30 / $2.50 | **現行利用中**。バランス型 |
| **Gemini 2.5 Flash-Lite** | あり | $0.10 / $0.40 前後 | 最安クラス |
| **Gemini 2.0 Flash** | あり | $0.10 / … | 旧世代 |
| **Gemini 2.0 Flash-Lite** | あり | $0.075 / … | 旧世代・最安寄り |
| **Gemma 4** | あり | 有料枠なし（Free only） | オープンモデル系 |

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
| Gemini 3.1 Pro Preview | 高推論。API 無料枠なし |
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

### 無料枠の目安（2026年7月時点の第三者・公式スナップショット）

| モデル | RPM | RPD | TPM |
|---|---|---|---|
| Gemini 2.5 / 3 Flash 系 | 10〜15 | 250〜1,500 | 250,000〜1,000,000 |
| Gemini 2.5 / 3.1 Flash-Lite 系 | 15〜30 | 1,000〜1,500 | 250,000〜1,000,000 |
| Gemini 2.5 Pro | 5 | 50〜100 | 250,000 |

※ 上記は参考値。必ず AI Studio の Rate limits 画面で確認すること。

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
| **品質優先** | `gemini-3.5-flash`, `gemini-3.6-flash` | 複雑な制約・推論を増やしたい |
| **現状維持** | `gemini-2.5-flash` | 実績あり・バランス型 |
| **枠・コスト優先** | `gemini-2.5-flash-lite`, `gemini-3.1-flash-lite` | 個人利用・1日の生成回数を増やしたい |
| **最高品質（有料覚悟）** | `gemini-2.5-pro`, `gemini-3.1-pro-preview` | 無料枠外。品質最優先 |

### おすすめの検討順

1. まず `gemini-2.5-flash` のまま品質・429 エラーを確認
2. 品質不足なら `gemini-3.5-flash` または `gemini-3.6-flash` を試す
3. RPD / RPM に当たるなら `*-flash-lite` に下げる
4. それでも不足なら有料 tier または Pro 系

---

## モデル変更手順

1. `worker/src/index.ts` の `GEMINI_GENERATE_URL` のモデル名を変更

```ts
// 例: Gemini 3.5 Flash に変更
const GEMINI_GENERATE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
```

2. Worker を再起動（`yarn worker:dev`）
3. スケジュール生成を実行し、JSON 形式・品質・429 の有無を確認
4. 本番デプロイ前に `yarn worker:typecheck` / `yarn test` を実行

---

## 公式リンク

| 内容 | URL |
|---|---|
| 料金・無料枠の有無 | https://ai.google.dev/gemini-api/docs/pricing |
| レート制限 | https://ai.google.dev/gemini-api/docs/rate-limits |
| モデル一覧 | https://ai.google.dev/gemini-api/docs/models |
| API キー発行（AI Studio） | https://aistudio.google.com/ |
| 自分のクォータ確認 | https://aistudio.google.com/rate-limit |
| Quickstart | https://ai.google.dev/gemini-api/docs/quickstart |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| 2026-07-26 | 初版作成。現行 `gemini-2.5-flash` と無料枠モデル一覧を整理 |
| 2026-07-26 | 利用モデルを `gemini-3.5-flash-lite` に変更 |
