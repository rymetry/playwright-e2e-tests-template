# AGENTS.md

AIエージェント（Codex等、Claude Code以外を含む）向けの作業ガイド。

## このリポジトリについて

Integration／E2Eテスト設計の汎用テンプレート。テストは必ずTest Design Docを
起点に作成する。運用モデルは「AIがDocとテストを作成し、人間が期待値を
レビューして承認する」。

## 必読ドキュメント

- [test-designs/README.md](test-designs/README.md) — ID命名規則、Status、
  Qualification、安全規則、運用フロー（2パターン）
- [test-designs/templates/test-design-doc-template.md](test-designs/templates/test-design-doc-template.md) — Docテンプレート

## 定型手順

Claude Codeではスラッシュコマンド、他のエージェントでは手順書として同じ
ファイルに従う。

- **Test Design Doc作成**: [.agents/commands/test-design.md](.agents/commands/test-design.md) の手順に従う
- **探索**: [.agents/commands/explore.md](.agents/commands/explore.md) の手順に従う
  （browser操作は `.agents/skills/playwright-cli/` のskillを使用）

## 検証コマンド

- `npm run check` — Design Docとspecの整合チェック（Status・タグ・命名規則）
- `npm run typecheck` — TypeScript型検査
- `npm test` — 通常実行（QUARANTINE除外）

## 厳守事項

- `E2E_ALLOWED_ORIGINS` にないoriginへアクセスしない。本番環境を対象にしない
- 探索・live UIの観測事実を無審査で期待値にしない。期待値の確定は人間のレビュー
- 認証情報の値を読まない・出力しない・記録しない（シェルの環境変数展開でのみ使用）
- 固定wait／sleep、skip、不安定なCSS／XPathをテストへ持ち込まない
