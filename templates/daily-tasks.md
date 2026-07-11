# デイリータスクテンプレート

スキーマ定義: [daily-task_template_proto.md](../daily-task_template_proto.md)

サンプル用の汎用テンプレートです。実運用では設定画面から自分の内容に置き換えてください。

```yaml
schema_version: 1

tasks:
  - name: 起床
    condition: 呼び出し当日のタスク登録時
    category: DailyTask
    detail: 身支度、水分補給
    startTime: アプリを呼び出した時刻
    defaultComplete: true

  - name: 朝の運動
    condition: 登録日が月曜日以外
    category: DailyTask
    detail: 軽い有酸素、ストレッチ
    startTime: "6:30"
    endTime: 開始時間から1時間後

  - name: AM-HK
    category: DailyTask
    startTime: 月曜日は6:30, それ以外は7:30
    endTime: 開始時間から40分後
    children:
      - name: 天気チェック
      - name: 洗濯開始
      - name: (干物取り込み)
      - name: 朝食
        detail: 簡単な朝食
      - name: 簡易食器洗い
      - name: 物干し
      - name: 掃除機
      - name: 可燃・不燃ごみ
        condition: 登録日が月曜日or金曜日
      - name: 資源ごみ
        condition: 登録日が火曜日
      - name: 段ボール
        condition: 登録日が木曜日
      - name: 着替え

  - name: スケジューリング
    category: DailyTask
    detail: ニュース確認, 当日スケジュールの整理
    startTime: "8:10"
    endTime: 開始時間から20分後

  - name: 夜の運動
    condition: 登録日が月曜日以外
    category: DailyTask
    detail: 有酸素、筋トレ、ストレッチ
    startTime: 登録日が火曜日~金曜日であれば19:00, 土日であれば17:30
    endTime: 開始時間から1時間30分後

  - name: Shopping
    condition: 登録日が月曜日以外
    category: DailyTask
    detail: 日用品・食材の買い出し
    startTime: "20:30"
    endTime: 開始時間から30分後

  - name: 夕飯
    category: DailyTask
    detail: 夕食
    startTime: 登録日が火曜日~金曜日であれば21:00, 土日月であれば19:30
    endTime: 開始時間から30分後

  - name: PM-HK
    category: DailyTask
    detail: 夜の家事
    startTime: 月曜日は22:00, それ以外は23:00
    endTime: 月曜日は開始から1時間40分後、それ以外は40分後
    children:
      - name: 入浴
        condition: 登録日が月曜日
      - name: (干物取り込み)
      - name: 着替え用意
      - name: 翌朝食準備
      - name: 食器洗い
      - name: 翌日スケジューリング
      - name: 入眠準備

  - name: 就寝
    category: DailyTask
    startTime: "24:00"
```
