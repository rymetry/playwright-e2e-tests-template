# CLAUDE.md

@AGENTS.md

## Claude Code固有の補足

- Test Design Docの作成は `/test-design <AREA> <シナリオ概要>`、探索は
  `/explore <Check ID>`、テスト失敗の分類・修復は `/heal` のスラッシュコマンドを
  使う（`.claude/commands/`）。
  AGENTS.mdが参照する `.agents/commands/` の手順書と同一内容である。
- コマンドを修正する場合は、`.claude/commands/` と `.agents/commands/` の
  両方を必ず同期する。
- browser操作には `.claude/skills/playwright-cli/` のskillを使用する。
