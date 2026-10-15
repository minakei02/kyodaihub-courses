# kyodaihub-courses — AI / 開発者向け概要

チャットや PC（Mac / Windows）が変わっても、意図と制約を引き継ぐための正本。コードを触る前に読む。仕組みと動かし方は `README.md`。

## これは何か

- 京都大学が毎年公表している「各授業の平均学生在籍数」（PDF）から、アプリ「京大ポケット」と Web 版が使う授業データ `docs/courses.json` を作る。
- `docs/` は GitHub Pages でそのまま公開される（`https://minakei02.github.io/kyodaihub-courses/courses.json`）。サーバーも Firebase も使わない。
- アプリ（`../kyodaihubMobile`）は授業タブを開いたときにこのファイルを1回読み、検索は端末の中で行う。

## 守ること

1. **数字は PDF のまま。** 足したり、推計したりしない。手で直してよいのは、PDF で切れた名前などの表記だけ（`data/fixes.csv`）。
2. **京大のサーバーに負担をかけない。** PDF は `cache/` に保存し、ある年度は取り直さない。シラバスのサイト（www.k.kyoto-u.ac.jp）は robots.txt で自動取得を断っているので、取りに行かない。
3. **サーバー代は0円のまま。** 有料のサービス・API・鍵を使わない。GitHub に支払い方法を登録しない前提。
4. **これは公開リポジトリ。** 鍵・トークン・個人のメールアドレスを入れない。コミットの名前とメールは GitHub の匿名アドレスにする。**clone した直後（新しい PC では必ず）、コミットする前に次を実行する。**
   - `git config user.name "minakei02"`
   - `git config user.email "136055793+minakei02@users.noreply.github.com"`
5. **授業 ID を変えない。** ID は「部局＋名前（表記をそろえたもの）」から決まる（`src/normalize.ts`）。作り方を変えると、あとからひも付けたデータが外れる。
6. **courses.json の形を変えるときは、アプリと Web の読み取り側も同時に直す。** 形を大きく変えるなら `version` を上げる。
7. 頼まれていない大きな変更・依存追加をしない。コミットと push は頼まれたときだけ。返答は日本語で。

## 新しい年度が公表されたら

1. `src/config.ts` の `SOURCES` に、その年度の PDF の URL を1行足す。
2. `npm run extract -- --year 2026` で `data/raw/2026.csv` を作る。「表の行として読めなかった」行が出たら中身を確かめる。
3. `npm run build` で `docs/courses.json` を作り直す。
4. `git diff --stat` で差分の量が妥当か見てから、コミットして push する（push すると数分で公開される）。

## 知っておくこと

- PDF には授業コード・担当教員・学期がない。複数クラスある授業は人数が合算されている（`classes` が2以上）。
- 同じ部局・同じ年度に同じ名前の行が複数あるのは、単位数などが違う別の科目（PDF の注）。`variants` に並べている。
- 大学院の授業は入れていない（`isTargetDepartment`）。入れるとファイルが約2倍になる。
- 古い年度の PDF は京大のサイトから消えるので、国立国会図書館のアーカイブ（WARP）の URL を使っている。

## Mac / Windows

どちらでも `npm install` → `npm test` → `npm run build`。Node.js 24 以上。改行は `.gitattributes` で LF に揃えてある。
