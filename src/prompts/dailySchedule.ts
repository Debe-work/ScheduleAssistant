import type { DailyTaskTemplate, GeneratedSchedule, ScheduleItem } from '../types';

export function buildSchedulePrompt(params: {
  date: string;
  invokedAt: string;
  calendarEvents: ScheduleItem[];
  tasks: ScheduleItem[];
  templates: DailyTaskTemplate[];
}): string {
  const { date, invokedAt, calendarEvents, tasks, templates } = params;

  return `あなたは個人のデイリースケジュール調整アシスタントです。
登録日 ${date} のデイリータスクを、既存予定とテンプレートに基づいてスケジュールしてください。

## 重要ルール

1. テンプレートの \`condition\` を登録日・曜日で評価し、該当するタスクのみ登録する
2. \`startTime\` は **他の予定・タスクがない場合のデフォルト配置時刻（目安）** である
3. 当日に既存の Calendar 予定や Todo がある場合、衝突を避け **空き時間にずらして** 配置する
4. \`endTime\` が相対指定（例: 開始から40分後）の場合、開始がずれても相対関係を維持する
5. 曜日分岐（例: 月曜は6:30, それ以外は7:30）は登録日からデフォルト時刻を決定してから、ずらしルールを適用
6. 親タスクの \`children\` は親の時間枠内で順序どおりに配置する
7. \`defaultComplete: true\` のタスクは status を completed にする
8. ずらした場合は summary に理由を記載する
9. 時刻は ISO 8601 形式（タイムゾーン: ${Intl.DateTimeFormat().resolvedOptions().timeZone}）で返す

## コンテキスト

- アプリ起動時刻: ${invokedAt}
- 登録日: ${date}

## 既存 Calendar 予定

${JSON.stringify(calendarEvents, null, 2)}

## 既存 Todo

${JSON.stringify(tasks, null, 2)}

## デイリータスクテンプレート

${JSON.stringify(templates, null, 2)}

## 出力形式

以下の JSON のみを返してください（マークダウン不要）:

{
  "date": "${date}",
  "items": [
    {
      "title": "タスク名",
      "detail": "詳細（任意）",
      "startTime": "ISO8601（任意）",
      "endTime": "ISO8601（任意）",
      "source": "daily",
      "category": "DailyTask",
      "parentName": "親タスク名（任意）",
      "status": "needsAction",
      "defaultComplete": false
    }
  ],
  "summary": "調整内容の説明"
}

既存の calendar / task は items に含めず、新規 daily タスクのみ返してください。
時間枠のない子タスクは startTime/endTime 省略可。親タスク（AM-HK, PM-HK 等）は時間枠を持たせてください。`;
}

export function parseGeneratedSchedule(text: string): GeneratedSchedule {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON が見つかりません');
  const parsed = JSON.parse(jsonMatch[0]) as GeneratedSchedule;
  if (!parsed.date || !Array.isArray(parsed.items)) {
    throw new Error('スキーマが不正です');
  }
  return parsed;
}
