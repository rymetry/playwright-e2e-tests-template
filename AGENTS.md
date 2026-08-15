# AGENTS.md

AIエージェント（Codex等、Claude Code以外を含む）向けの作業ガイド。

## このリポジトリについて

Integration／E2Eテスト設計の汎用テンプレート。テストは必ずTest Design Docを
起点に作成する。運用モデルは「AIがDocとテストを作成し、人間が期待値を
レビューして承認する」。

## 必読ドキュメント

- [test-designs/README.md](test-designs/README.md) — ID命名規則、Status、
  Qualification、安全規則、運用フロー（2パターン＋失敗時の修復フロー）、
  Doc生成方法、スイート拡張方針、
  コード実装方針（インライン既定・POMはトリガー駆動）

## 定型手順

4 skillのhost中立な正本は `skills/<name>/` に置く。Claude Codeは
`.claude/skills/<name>`、Codexは `.agents/skills/<name>` の相対directory symlinkから
**同じ正本**を発見する。複製したミラーは作らず、変更は `skills/` だけに行う。
正本のYAML frontmatterにClaude Code拡張を、同じ正本配下の
`agents/openai.yaml` にOpenAI metadataを置き、本文はhost中立に保つ。

| Workflow / skill | Claude Code | Codex CLI／IDE／Desktop | ChatGPT（skill install／enable済み） |
|---|---|---|---|
| Test Design Doc作成 | `/test-design <AREA> <概要>` | `$test-design <AREA> <概要>`（または`/skills`から選択） | `@test-design <AREA> <概要>` |
| 探索 | `/explore <Check ID>` | `$explore <Check ID>`（または`/skills`から選択） | `@explore <Check ID>` |
| 失敗の分類・修復 | `/heal` | `$heal`（または`/skills`から選択） | `@heal` |
| browser操作 | `/playwright-cli` | `$playwright-cli`（または`/skills`から選択） | `@playwright-cli` |

Claude CodeとCodexはrepository checkoutからproject skillを発見する。ChatGPTでの
`@skill` 起動には、同じskill packageをChatGPT側へ別途install／enableしておく必要が
あり、checkoutだけでは登録されない。

- **Test Design Doc作成**: [skills/test-design/SKILL.md](skills/test-design/SKILL.md)
- **探索**: [skills/explore/SKILL.md](skills/explore/SKILL.md)
  （browser操作は [skills/playwright-cli/](skills/playwright-cli/) を使用）
- **失敗の分類・修復**: [skills/heal/SKILL.md](skills/heal/SKILL.md)
  （必要な再観測も同じ起動内で行う。修正の適用はProposal IDを指定した明示起動後のみ。
  禁止変更はREADME 6.1が正）

workflowは最初にGit repository rootを取得し、pathとcommandをそこへanchorする。
subdirectoryから起動してもよいが、Git管理外では開始しない。playwright-cliの
`references/test-generation.md` にある汎用plan／generate／healは使用せず、上記の
repository固有workflowと `test-designs/README.md` を優先する。

## skill構成の変更手順

- **skillの追加・削除**: `skills/<name>/` の正本と、`.claude/skills/<name>`・
  `.agents/skills/<name>` の相対directory symlinkを揃えたうえで、
  `scripts/check-skills.mjs` の `EXPECTED_SKILLS`（workflow skillの場合は
  `WORKFLOW_SKILLS` と正本配下の `agents/openai.yaml` も）を更新する。
  本書とREADMEの表も更新し、`npm run check:skills` で検証する。
- **healの許可コマンド変更**: `skills/heal/SKILL.md` frontmatterの
  `allowed-tools` と `scripts/check-skills.mjs` の `HEAL_ALLOWED_TOOLS` を
  同時に更新する（完全一致で検証される）。
- **playwright-cli skillのupstream更新**: `skills/playwright-cli/` は
  microsoft/playwright-cli 由来（Apache-2.0）の改変版。更新時は
  `skills/playwright-cli/LICENSE`、`THIRD_PARTY_NOTICES.md`、SKILL.md冒頭の
  改変注記を維持・更新する。

## 検証コマンド

- `npm run check` — Design Doc／spec整合、Design Docの契約・生成test、両hostのskill構造を検査
- `npm run check:skills` — skill構造だけを検査
- `npm run typecheck` — TypeScript型検査
- `npm test` — 通常実行（QUARANTINE除外）

## 厳守事項

- `E2E_ALLOWED_ORIGINS` にないoriginへアクセスしない。本番環境を対象にしない
- 探索・live UIの観測事実を無審査で期待値にしない。期待値の確定は人間のレビュー
- 認証情報の値を読まない・出力しない・記録しない（シェルの環境変数展開でのみ使用）
- 固定wait／sleep、skip、不安定なCSS／XPathをテストへ持ち込まない
