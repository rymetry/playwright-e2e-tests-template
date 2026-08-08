# CLAUDE.md

@AGENTS.md

## Claude Code固有の補足

- Test Design Docの作成は `/test-design <AREA> <シナリオ概要>`、探索は
  `/explore <Check ID>`、テスト失敗の分類・修復は `/heal`、承認済み修正の適用は
  `/heal --apply <Proposal ID>` で起動する（正本は `skills/<name>/SKILL.md`）。
  いずれも `disable-model-invocation: true` のため、ユーザーの明示的な起動で
  のみ実行される。運用ルールの正は `test-designs/README.md`（healは6.1）にあり、
  各SKILL.mdはそれに従う実行手順。本書では重複記述しない。
- healの`allowed-tools`は、明示起動したターンだけ、`git status`／`git rev-parse`／
  固定optionの`git diff`と`npm run check`／`npm run typecheck`を確認なしで許可する。
  pathを伴う動的diffは通常のpermission確認を残す。許可は次のユーザー
  メッセージで失効し、file書込み、git commit／push／reset、依存install、削除、
  test／browser／network操作はpre-approveしない。
