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
（5章）・運用フロー（6章）を読み、従う。テンプレートは
`test-designs/templates/test-design-doc-template.md`。

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
3. **配置**: テンプレートを
   `test-designs/<level小文字>/<area小文字>/<ID>-<slug>.md` へコピーする。
   **IDは大文字（例: `E2E-AUTH-001`）、ディレクトリ名は必ずASCII小文字
   （例: `test-designs/e2e/auth/`）**。大文字のディレクトリは整合チェッカーの
   走査対象外となり誤ってPASSするため厳禁。slugは英小文字ケバブケース
   （`--skeleton`時は仮slugでよい。DRAFTの間は変更可、IDは不変）。
4. **IDとplaceholderの全置換（`--skeleton`でも必須）**: テンプレート内の
   `XXX-AREA-000` を含む**すべての箇所**を実IDへ置換する。最低限の対象:
   - H1見出しとメタデータ表のParent Case ID
   - Check一覧の各行のCheck IDとCodeパス
   - 各Checkの節見出し（`### 3.x <Check ID>: ...`。未置換だと整合チェッカーが
     判定行を見つけられず失敗する）
   - 各Checkの判定根拠表の「判定」行（placeholderの選択肢表記を`DRAFT`へ）
   - TierとExploration modeは実値を1つ選んで記入する（`SMOKE／REGRESSION`の
     ような選択肢表記のまま残さない）。判断できない場合はユーザーに確認する。
     探索を予定するPW Checkは`PLAYWRIGHT_CLI`とする
   - テンプレート冒頭のHTMLコメントを削除する
5. **Execution modeの確定**: 使用するmodeはシナリオとユーザーの入力から判断し、
   判断できない場合は確認する。使用しないmodeのCheckブロック（3.x）と
   Check一覧の対応行を削除する。**APIを使用する場合**、テンプレート3.2は
   省略表現のため、3.1と同じ見出し・表構造（Test Status判定根拠表を含む）を
   API用の読み替え（Assertion対象、実行契約等）を適用して完全展開する。
6. **本文記入**:
   - 通常モード（パターン1）: ユーザーが提供した仕様・Issue・受入条件をもとに
     目的・品質リスク・シナリオ・Assertion案・テストデータ・前提条件を記入する。
     **根拠のない期待値を発明しない**。仕様から確認できない項目は
     「対象外・未確定」に残す。
   - `--skeleton`モード（パターン2）: メタデータ・Check一覧・探索目的だけを
     記入する。未記入の節は雛形の汎用文（実ケースの期待値に見える文）を
     残さず、本文を `未記入（探索後に本記入）` へ置換する。
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
