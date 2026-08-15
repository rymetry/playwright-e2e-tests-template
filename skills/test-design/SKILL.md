---
name: test-design
description: Test Design Docを命名規則に従って新規作成する（ID採番・テンプレート展開・整合チェックまで）
argument-hint: "<AREA> <シナリオ概要> [--level E2E|INT] [--skeleton]"
disable-model-invocation: true
---

Test Design Docを新規作成する。ユーザーがこのskillの起動時に指定した入力を、
以下の「入力」として扱う。ホスト別の明示起動方法は `AGENTS.md` を参照する。

## Repository root（必須）

最初に `git rev-parse --show-toplevel` でGit repository rootを取得する。取得できない
場合は開始せず停止する。以後、相対pathはすべてrepository root基準で解決し、
shell commandもrepository rootをworking directoryとして実行する。

## 前提

まず `test-designs/README.md` の命名規則（2章）・Status（4章）・共通の安全規則
（5章）・運用フローとDoc生成方法（6章）を読み、従う。テンプレート部品を
手作業でコピー・結合せず、`npm run create:test-design`で1シナリオ1ファイルの
Design Docを生成する。

入力の解釈:

- 第1引数: AREAコード（大文字英字2〜6文字）
- 第2引数以降: シナリオ概要
- `--level E2E|INT`: テストレベル。省略時は `E2E`
- `--skeleton`: 機能がわからない場合の骨格作成モード（運用フローのパターン2）。
  探索を先に行うためのDocを最小限の記入で用意する

## 手順

1. **Areaレジストリ確認**: README 2.4のレジストリに指定AREAがあるか確認する。
   未登録なら対象領域の説明を添えて登録を提案し、ユーザーの承認後に
   レジストリへ追記してから進める。
2. **ID採番**: 既存の全DocのCheck IDを走査し、同一LEVEL・AREA内で最大の
   SEQ+1を新しいParent Case IDとする。欠番・RETIRED済みIDは再利用しない。
   SEQが999に達している場合は採番せず、AREAの分割等をユーザーへ相談して
   停止する。
3. **生成条件の確定**: slug、Execution mode、Tier、Exploration modeを決める。
   判断できない場合はユーザーに確認する。slugは英小文字ケバブケース
   （`--skeleton`時は仮slugでよい。DRAFTの間は変更可、IDは不変）。探索を予定する
   PW Checkは`PLAYWRIGHT_CLI`、API Checkは`API_INTEGRATION`、CU Checkは
   `COMPUTER_USE`、MN Checkは`MANUAL`とする。探索不要なら`NONE`とし、
   「探索目的」へ記録する具体的理由も確定する。理由を推測で発明しない。
4. **Doc生成（`--skeleton`でも必須）**: README 6.0の形式で
   `npm run create:test-design`を実行する。各Checkは次の形式で指定する。
   - 探索あり: `--check PW:SMOKE:PLAYWRIGHT_CLI`
   - 探索なし: `--check API:REGRESSION:NONE:<具体的な探索不要理由>`
   - 同じExecution modeに複数Checkが必要なら`--check`を繰り返す

   生成処理がH1、メタデータ、Check一覧、Check ID、章番号、Codeパス、探索サマリ、
   判定`DRAFT`を一括構成する。生成先は
   `test-designs/<level小文字>/<area小文字>/<ID>-<slug>.md`であり、既存ファイルは
   上書きしない。生成後のMarkdownだけをDesign Docとして扱い、
   `test-designs/templates/`の部品は成果物として扱わない。
5. **生成結果の構造確認**: 指定したCheckだけがCheck一覧とCheck設計に同じ順序で
   生成され、Check ID、章番号、mode、Tier、探索サマリ初期値が一致することを確認する。
   mode別Checkは完全な構造で生成されるため、他modeの節を参照して補完しない。
6. **本文記入**:
   - 通常モード（パターン1）: ユーザーが提供した仕様・Issue・受入条件をもとに
     目的・品質リスク・シナリオ・Assertion案・テストデータ・前提条件を記入する。
     **根拠のない期待値を発明しない**。仕様から確認できない項目は
     「対象外・未確定」に残す。
   - `--skeleton`モード（パターン2）: メタデータ・Check一覧・探索目的だけを
     記入する。未記入の節は雛形の汎用文（実ケースの期待値に見える文）を
     残さず、本文を `未記入（探索後に本記入）` へ置換する。
   - 探索サマリの初期値は生成処理が確定する。本文記入時に探索modeと状態が変わらない
     限り、手作業で別の初期状態へ書き換えない
7. **検証**: `npm run check` を実行しPASSすることを確認する。
8. **報告**: 作成したID・ファイルパス・次のステップを提示する。
   探索が必要なら、対象Check IDを添えて `explore` workflowの明示起動をユーザーへ
   案内する。探索不要なら期待値レビューを依頼する。ホスト別の起動方法は
   `AGENTS.md` を参照する。

## 厳守事項

- 期待値は人間のレビューを経るまで正式ではない。「レビュー済みの期待値」欄は
  レビュー実施後にのみ記入する
- 探索やlive UIの観測結果を期待値として記入しない
- README 5章の安全規則に従う: 固定wait／sleep・skip・自己修復処理・不安定な
  CSS／XPathを設計へ持ち込まない。秘密情報（認証情報・トークン等）をDocに
  書かない
