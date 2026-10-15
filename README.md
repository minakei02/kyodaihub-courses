# kyodaihub-courses

京都大学が公表している「各授業の平均学生在籍数」から、京大ポケット用の授業データを作って GitHub Pages で配る。

- 配信ファイル: https://minakei02.github.io/kyodaihub-courses/courses.json
- 出典: 京都大学「各授業の平均学生在籍数」（2021〜2025年度）。URL は `src/config.ts`

## 仕組み

```
京大の PDF（年に1つ）
  │ npm run extract   … PDF を cache/ に保存し、表を data/raw/{年度}.csv に書き出す
  ▼
data/raw/*.csv ＋ data/fixes.csv（切れた名前などの手直し）
  │ npm run build     … 授業ごとにまとめて docs/courses.json を作る
  ▼
docs/courses.json     … main ブランチの docs/ を GitHub Pages で公開
```

対象は学部の授業と全学共通科目（国際高等教育院）。大学院の授業は入れていない。

## courses.json の形

```jsonc
{
  "version": 1,
  "source": { "title": "京都大学「各授業の平均学生在籍数」", "years": [2021, …], "urls": [ … ] },
  "courses": [
    {
      "id": "90663cd47b90",            // 部局＋名前から決まる。毎年同じ
      "name": "線形代数学(講義・演義)A",
      "department": "全学共通科目",
      "stats": [                       // 新しい年度が先
        {
          "year": 2025,
          "variants": [                // 同じ名前で単位数などが違う科目があると複数
            { "registered": 1871, "earned": 1706, "classes": 45 }
          ]
        }
      ]
    }
  ]
}
```

- `registered`: 履修登録者数、`earned`: 単位修得者数、`classes`: 授業数（2以上は複数クラスの合算）
- 単位修得率は `earned / registered` で求める（ファイルには入れていない）

## 使い方

```bash
npm install
npm test
npm run extract   # PDF から CSV を作る（PDF は初回だけダウンロード）
npm run build     # CSV から courses.json を作る
```

新しい年度の追加手順は `AGENTS.md` の「新しい年度が公表されたら」。
