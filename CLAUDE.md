# CLAUDE.md

@AGENTS.md

## Claude Code固有の補足

- Test Design Docの作成は `/test-design <AREA> <シナリオ概要>`、探索は
  `/explore <Check ID>`、テスト失敗の分類・修復は `/heal` のスキルを使う
  （正本は `skills/<name>/SKILL.md`）。いずれも `disable-model-invocation: true`
  のため、ユーザーの明示的な起動でのみ実行される。
- healが再観測を必要とする場合、Claudeはexploreを内部起動しない。提示された
  Handoff IDに従ってユーザーが `/explore` をCheckごとに起動し、その後
  `/heal --resume <Handoff ID>` を起動する。修正案の適用も
  `/heal --apply <Proposal ID>` で明示起動する。`--resume` までは同じ会話を維持し、
  commitやbranch変更を行わない。変更した場合は新しいhandoffから再観測する。
- host中立な正本は `skills/` に置き、`.claude/skills/` と `.agents/skills/` は
  それぞれClaude Code／Codex discovery用の相対directory symlinkとする。本文は
  host中立に保ち、OpenAI固有policyは正本内の `agents/openai.yaml` に置く。
- browser操作には `skills/playwright-cli/` のskillを使用する。
