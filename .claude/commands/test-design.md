---
description: Test Design Docを命名規則に従って新規作成する（ID採番・テンプレート展開・整合チェックまで）
argument-hint: <AREA> <シナリオ概要> [--level E2E|INT] [--skeleton]
---

Test Design Docを新規作成する。引数: $ARGUMENTS

## 前提

まず `test-designs/README.md` を読み、命名規則（2章）・Status（4章）・運用フロー
（6章）に従う。テンプレートは `test-designs/templates/test-design-doc-template.md`。

引数の解釈:

- 第1引数: AREAコード（大文字英字2〜6文字）
- 第2引数以降: シナリオ概要
- `--level E2E|INT`: テストレベル。省略時は `E2E`
- `--skeleton`: 機能がわからない場合の骨格作成モード（運用フローのパターン2）。
  探索を先に行うためのDocを最小限の記入で用意する

## 手順

1. **Areaレジストリ確認**: `test-designs/README.md` 2.4のレジストリに指定AREAが
   あるか確認する。未登録なら、対象領域の説明を添えて登録を提案し、ユーザーの
   承認後にレジストリへ追記してから進める。
2. **ID採番**: `test-designs/<level>/<area>/` の既存Docと全DocのCheck IDを走査し、
   同一LEVEL・AREA内で最大のSEQ+1を新しいParent Case IDとする。欠番・RETIRED済み
   IDは再利用しない。
3. **配置**: テンプレートを `test-designs/<level>/<area>/<ID>-<slug>.md` へコピー
   する。slugは英小文字ケバブケースでシナリオ内容を表す短い名前。`--skeleton`時は
   仮のslugでよい（DRAFTの間はファイル名変更可。IDは不変）。
4. **記入**:
   - 通常モード（パターン1）: ユーザーが提供した仕様・Issue・受入条件をもとに、
     目的・品質リスク・シナリオ・Assertion案・テストデータ・前提条件を記入する。
     **根拠のない期待値を発明しない**。仕様から確認できない項目は
     「対象外・未確定」に残す。
   - `--skeleton`モード（パターン2）: メタデータ・Check一覧・探索目的だけを
     記入し、他の節はテンプレートの雛形のまま残す。
   - 使用しないExecution modeのCheckブロック（3.x）とCheck一覧の対応行を削除する。
   - テンプレート冒頭のHTMLコメントを削除する。
   - StatusはすべてDRAFT（Check一覧と各Checkの判定根拠表の両方）。
5. **検証**: `npm run check` を実行しPASSすることを確認する。
6. **報告**: 作成したID・ファイルパス・次のステップを提示する。
   次のステップは、探索が必要なら `/explore <Check ID>`、探索不要なら
   期待値レビューの依頼。

## 厳守事項

- 期待値は人間のレビューを経るまで正式ではない。「レビュー済みの期待値」欄を
  勝手に埋めない（レビュー実施後にのみ記入する）
- 探索やlive UIの観測結果を期待値として記入しない
- 秘密情報（認証情報・トークン等）をDocに書かない
