# デイリータスクテンプレート

スキーマ定義: [daily-task_template_proto.md](../../daily-task_template_proto.md)

```yaml
schema_version: 1

tasks:
  - name: 起床
    condition: 呼び出し当日のタスク登録時
    category: DailyTask
    detail: 洗顔、飲水、水筒用意
    startTime: アプリを呼び出した時刻
    defaultComplete: true

  - name: 朝ジム
    condition: 登録日が月曜日以外
    category: DailyTask
    detail: ウォーキング5min, ランニング15min, 柔軟, プロテイン
    startTime: "6:30"
    endTime: 開始時間から1時間後

  - name: AM-HK
    category: DailyTask
    startTime: 月曜日は6:30, それ以外は7:30
    endTime: 開始時間から40分後
    children:
      - name: 天気・洗剤残量チェック
      - name: 洗濯開始
      - name: (朝-干物取り込み)
      - name: 体重測定
      - name: 朝食
        detail: ブラン40g(カップ~150ml), 味噌汁, 卵, 水多め
      - name: 簡易食器洗い
      - name: 物干し
      - name: 掃除機
      - name: 可燃・不燃・電池ごみ
        condition: 登録日が月曜日or金曜日
      - name: 缶、ビン、ペットボトル
        condition: 登録日が火曜日
      - name: 段ボール
        condition: 登録日が木曜日
      - name: 着替え
      - name: グルーミング

  - name: スケジューリング
    category: DailyTask
    detail: newsチェック(10min), lifeスケジュールfix, 業務スケジュールfix, 朝英語
    startTime: "8:10"
    endTime: 開始時間から20分後

  - name: 夜ジム
    condition: 登録日が月曜日以外
    category: DailyTask
    detail: ウォーキング5min, ランニング15min, 筋トレ30min, 柔軟, プロテイン
    startTime: 登録日が火曜日~金曜日であれば19:00, 土日であれば17:30
    endTime: 開始時間から1時間30分後

  - name: Shopping
    condition: 登録日が月曜日以外
    category: DailyTask
    detail: 卵野菜とか,他はTodoでチェック
    startTime: "20:30"
    endTime: 開始時間から30分後

  - name: 夕飯
    category: DailyTask
    detail: nosh
    startTime: 登録日が火曜日~金曜日であれば21:00, 土日月であれば19:30
    endTime: 開始時間から30分後

  - name: PM-HK
    category: DailyTask
    detail: nosh
    startTime: 月曜日は22:00, それ以外は23:00
    endTime: 月曜日は開始から1時間40分後、それ以外は40分後
    children:
      - name: 入浴
        condition: 登録日が月曜日
      - name: (夜-干物取り込み)
      - name: 着替え用意
      - name: 翌朝食準備
      - name: 食器洗い
      - name: 爪
      - name: 翌日スケジューリング
      - name: 歯磨き
      - name: 入眠準備

  - name: 就寝
    category: DailyTask
    startTime: "24:00"
```
