<!-- 生成・記入ルールはtest-designs/README.md 6章、節構成と既定契約は9章を参照。 -->

# {{PARENT_CASE_ID}} {{TITLE}}

## メタデータ

| 項目 | 値 |
|---|---|
| Parent Case ID | {{PARENT_CASE_ID}} |
| テストレベル | {{LEVEL}} |
| 機能 | {{TITLE}} |
| 対象環境 | `E2E_BASE_URL`で指定する環境の説明 |
| 最終確認 | YYYY-MM-DD / 実行証跡 |

## Check一覧

{{CHECK_LIST_TABLE}}

## 1. 目的

このParent Caseが保証するユーザー価値・システム価値を記載する。

## 2. 品質リスクとテスト条件

このユースケースが壊れたときに何が起きるかを、ケース固有の内容で記載する。

- 対象操作が完了しない
- 誤った権限または利用者として操作できる
- 永続状態がレビュー済みの期待値と一致しない
- 利用者が重要な結果を確認できない

リスクから導いたテスト条件と、その担保先（README 1.3）:

| テスト条件 | 分類 | 技法 | 担当 |
|---|---|---|---|
| 確認する内容を1行で | 正常系 | シナリオベースドテスト | Check ID、`下位レベル（unit／INT）`、または`対象外` |

## 3. Check設計

各Checkで記載のない項目はREADME 9章の既定契約に従う。Accessibility／Visualは
既定で対象外で、対象にする場合だけAssertion設計に`##### Accessibility`／`##### Visual`を
追加する。

{{CHECK_SECTIONS}}

## 4. 関連仕様

- 対象機能の仕様
- 関連Issue／PR
- 期待値レビュー記録
- 関連するTest Design
