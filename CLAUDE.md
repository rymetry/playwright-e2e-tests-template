# CLAUDE.md

@AGENTS.md

## Claude Code固有の補足

- Test Design Docの作成は `/test-design <AREA> <シナリオ概要>`、探索は
  `/explore <Check ID>`、テスト失敗の分類・修復は `/heal` のスキルを使う
  （正本は `skills/<name>/SKILL.md`）。いずれも `disable-model-invocation: true`
  のため、ユーザーの明示的な起動でのみ実行される。
- healが再観測を必要とする場合、Claudeは公開exploreを内部起動せず、heal専用の
  host中立な再観測手順を同じ起動内で続ける。その後Proposalを提示して停止し、
  修正案の適用は`/heal --apply <Proposal ID>` の明示起動後だけ行う。対象scopeが
  変わっていれば再評価して新しいProposalを提示し、以前のProposalは適用しない。
- healの`allowed-tools`は、明示起動したターンだけ、`git status`／`git rev-parse`／
  固定optionの`git diff`と`npm run check`／`npm run typecheck`を確認なしで許可する。
  pathを伴う動的diffは通常のpermission確認を残す。許可は次のユーザー
  メッセージで失効し、file書込み、git commit／push／reset、依存install、削除、
  test／browser／network操作はpre-approveしない。
- host中立な正本は `skills/` に置き、`.claude/skills/` と `.agents/skills/` は
  それぞれClaude Code／Codex discovery用の相対directory symlinkとする。本文は
  host中立に保ち、OpenAI固有policyは正本内の `agents/openai.yaml` に置く。
- 単独のbrowser操作には `skills/playwright-cli/` のskillを使用する。heal中の再観測だけは
  heal本文が参照する手順に従い、通常のpermission確認下でplaywright-cliを実行する。
