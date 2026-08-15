<!-- 生成・記入ルールはtest-designs/README.md 6章を参照。 -->

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

| Check ID | Execution mode | Exploration mode | Tier | Status | Code / 手順 |
|---|---|---|---|---|---|
{{CHECK_LIST_ROWS}}

## 1. 目的

このParent Caseが保証するユーザー価値・システム価値を記載する。

## 2. 品質リスク

このシナリオが壊れたときに何が起きるかを、ケース固有の内容で記載する。

- 対象操作が完了しない
- 誤った権限または利用者として操作できる
- 永続状態がレビュー済みの期待値と一致しない
- 利用者が重要な結果を確認できない

## 3. Check設計

{{CHECK_SECTIONS}}

## 4. 関連仕様

- 対象機能の仕様
- 関連Issue／PR
- 期待値レビュー記録
- 関連するTest Design
