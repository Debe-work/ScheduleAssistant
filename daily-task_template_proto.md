# 本ファイルの概要
タスクのテンプレートを記述するファイル。
以下の形式の沿って記述する。
```
- condition // 登録条件。この条件に合致しない場合はタスク登録しない。また省略されている場合は常に登録する。
- name // task名
- category // GoogleTodoに登録する場合のカテゴリ名
- detail // タスク詳細内容 (そのままタスク詳細として登録する)
- startTime  // 開始時間目安 (ex: アプリ起動時, 12:00, タスクhogeのxx分後)
- endTime // 終了時間目安 (ex: 開始時間のxx分後)
- defaultComplete // trueの場合は登録時点でステータスを完了にしておく
- children // 子タスク。内容は親タスクにcategory, childrenが含まれないものを配列化した形
```

# タスク一覧
## 起床
condition: 呼び出し当日のタスク登録時
name: 起床 
category: DailyTask
detail: 洗顔、飲水、水筒用意
startTime: アプリを呼び出した時刻。
defaultComplete: true

## 朝ジム
condition: 登録日が月曜日以外
name: 朝ジム
category: DailyTask
detail: ウォーキング5min, ランニング15min, 柔軟, プロテイン
startTime: 6:30
endTime: 開始時間から1時間後

## AM-HK
name: AM-HK
category: DailyTask
startTime: 月曜日は6:30, それ以外は7:30
endTime: 開始時間から40分後
children: [
        { name: 天気・洗剤残量チェック },
        { name: 洗濯開始 },
        { name: (干物取り込み) },
        {
            name: 朝食
            detail: ブラン40g(カップ~150ml), 味噌汁, 卵, 水多め
        },
        { name: 簡易食器洗い },
        { name: 物干し },
        { name: 掃除機 }
        {
            condition: 登録日が月曜日or金曜日
            name: 可燃・不燃・電池ごみ
        },
        {
            condition: 登録日が火曜日
            name: 缶、ビン、ペットボトル
        },
        {
            condition: 登録日が木曜日
            name: 段ボール
        },
        { name: 着替え },
        { name: グルーミング },
    ]

## ニュースチェック & スケジューリング
name: スケジューリング
category: DailyTask
detail: newsチェック(10min), lifeスケジュールfix, 業務スケジュールfix, 朝英語
startTime: 8:10
endTime: 開始時間から20分後

## 夜ジム
condition: 登録日が月曜日以外
name: 夜ジム
category: DailyTask
detail: ウォーキング5min, ランニング15min, 筋トレ30min, 柔軟, プロテイン
startTime: 登録日が火曜日~金曜日であれば19:00, 土日であれば17:30
endTime: 開始時間から1時間30分後

## Shopping
condition: 登録日が月曜日以外
name: Shopping
category: DailyTask
detail: 卵野菜とか,他はTodoでチェック
startTime: 20:30
endTime: 開始時間から30分後

## 夕飯
name: 夕飯
category: DailyTask
detail: nosh
startTime: 登録日が火曜日~金曜日であれば21:00, 土日月であれば19:30
endTime: 開始時間から30分後

## PM-HK
name: PM-HK
category: DailyTask
detail: nosh
startTime: 月曜日は22:00, それ以外は23:00
endTime: 月曜日は開始から1時間40分後、それ以外は40分後
children: [
        {
            condition: 登録日が月曜日
            name: 入浴
        },
        { name: (干物取り込み) },
        { name: 着替え用意 },
        { name: 翌朝食準備 },
        { name: 食器洗い },
        { name: 爪 },
        { name: 翌日スケジューリング },
        { name: 入眠準備 },
        { name: グルーミング },
    ]

## 就寝
name: 就寝
category: DailyTask
detail: nosh
startTime: 月曜日は24:00