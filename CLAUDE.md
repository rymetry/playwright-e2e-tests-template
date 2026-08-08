# CLAUDE.md

@AGENTS.md

## Claude Code固有の補足

- Test Design Docの作成は `/test-design <AREA> <シナリオ概要>`、探索は
  `/explore <Check ID>`、テスト失敗の分類・修復は `/heal` のスキルを使う
  （`.claude/skills/<name>/SKILL.md`）。いずれも `disable-model-invocation: true`
  のため、ユーザーの明示的な起動でのみ実行される。
- スキルの手順書はAGENTS.mdからも同じファイルが参照される（ミラーなし・
  単一ソース）。frontmatterはClaude Code向けのメタデータで、本文は他の
  エージェントが単体で実行できる手順書として書く。
- browser操作には `.claude/skills/playwright-cli/` のskillを使用する。
