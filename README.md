# Playwright E2E Tests Template

Integration／E2Eテストのための汎用テンプレートリポジトリ。
Playwrightによる自動テストに加え、Computer Use・Manualテストも同じ
Test Design Doc体系で設計・管理する。

## このテンプレートから新プロジェクトを始める

1. リポジトリをコピーし、`git init` でGit管理を開始する
   （Design Docを永続記録として運用するための前提）
2. `package.json` の `name` をプロジェクト名に変更し、`SECURITY.md` の
   報告先URLを自リポジトリのSecurity Advisoriesへ変更する
3. `cp .env.example .env` し、`E2E_BASE_URL` と `E2E_ALLOWED_ORIGINS` を
   対象環境に合わせる（本番環境をallowlistへ入れない）
4. [test-designs/README.md](test-designs/README.md) 2.4のAreaレジストリに
   自プロジェクトの機能領域を登録する
5. サンプル一式を削除する: `test-designs/e2e/demo/`、`e2e/demo/`、
   AreaレジストリのDEMO行（書き方の参考として残してもよい）
6. `test-designs/_archive/`（旧テンプレート）が残っていれば削除する
7. `npm run check` と `npm run typecheck` が通ることを確認する
   （`npm test` はサンプル削除直後はテスト0件で失敗するため、
   最初の実ケースを作成した後に確認する）

## セットアップ

前提: Node.js 20以上（Playwrightの要求バージョン）

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

`.env` の `E2E_BASE_URL` と `E2E_ALLOWED_ORIGINS` を対象環境に合わせて設定する。
`E2E_BASE_URL` のoriginが `E2E_ALLOWED_ORIGINS` に含まれない場合、テストは
起動時に失敗する（本番環境への誤実行防止）。

## スクリプト

| コマンド | 用途 |
|---|---|
| `npm test` | 全テスト実行（QUARANTINE除外） |
| `npm run test:smoke` | SMOKE Tierのみ実行（QUARANTINE除外） |
| `npm run test:qualify -- --grep "<Check ID>" --project=chromium` | Check単位のQualification（3回連続実行） |
| `npm run test:headed` | ブラウザ表示付き実行 |
| `npm run test:ui` | UIモード |
| `npm run test:report` | 直近のHTMLレポート表示 |
| `npm run typecheck` | TypeScript型検査 |
| `npm run check` | Design Doc／spec整合と両hostのskill構造を検査 |
| `npm run check:skills` | Claude Code／Codexのskill構造だけを検査 |

- `test:qualify` は `--grep`（Check ID）と `--project` の指定を必須とし、
  未指定の場合は起動時に失敗する。レポートは `qualification-reports/<実行日時>_<Check ID>/`
  （Git管理外）へ保存され、`npx playwright show-report qualification-reports/<dir>` で閲覧できる
- Check ID／Area単位の絞り込み実行は `npm test -- --grep "E2E-AUTH-"` のように
  `npm test` 経由で行う。`npx playwright test` の直接実行ではQUARANTINE除外が
  適用されない
- `test:ui` はデバッグ用の例外で、`@quarantine` を含むテストも表示・実行できる。
  通常suiteの実行には使用しない
- スクリプトはPOSIXシェル前提（macOS／Linux）。Windowsでは `cross-env` 等が必要
- Design Docを永続記録として運用するため、リポジトリはGit管理下に置くことを推奨

## テスト設計

テストは必ずTest Design Docを起点に作成する。4 skillのhost中立な正本は
[skills/](skills/) に置く。Claude Codeは [.claude/skills/](.claude/skills/)、
Codexは [.agents/skills/](.agents/skills/) の相対directory symlinkから同じ正本を
発見する。

| 用途 | Claude Code | Codex CLI／IDE／Desktop | ChatGPT（skill install／enable済み） |
|---|---|---|---|
| Doc作成 | `/test-design <AREA> <概要>` | `$test-design <AREA> <概要>` | `@test-design <AREA> <概要>` |
| 探索・観測記録 | `/explore <Check ID>` | `$explore <Check ID>` | `@explore <Check ID>` |
| 失敗の分類・修復 | `/heal` | `$heal` | `@heal` |
| browser操作 | `/playwright-cli` | `$playwright-cli` | `@playwright-cli` |

Codexでは`/skills`から明示選択することもできる。ChatGPTの`@skill`は、同じskill
packageをChatGPT側へinstall／enableした場合に使えるもので、repository checkout
だけでは登録されない。ホスト別metadataは正本内に置き、本文は共通とする。
詳細は [AGENTS.md](AGENTS.md) を参照する。

healは一度の明示起動で、必要な再観測からProposal提示まで続ける。公開exploreの追加起動は
不要で、公開exploreは単独探索用として残る。対象scopeの差分が変われば再評価し、以前の
Proposalは適用しない。対象scope外の並行変更は分離し、修正の適用はProposal IDを指定した
別の明示起動後だけ行う。

Claude Codeの公式仕様はproject skillのdirectory symlinkをサポートし、本構成は
Claude Code v2.1.207で認識を確認済み。相対symlinkを保持するGit clone／template copyでは
両host構造もそのまま移る。symlinkを通常fileへ変換するcheckout（Windows Gitの設定を
含む）や、symlinkを除去・dereferenceするarchive／copy手段を使った場合は
`npm run check:skills` が失敗するため、利用開始前に `npm run check` を実行する。

- 管理ルール（ID命名規則、Tier、Status、昇格条件、スイート拡張方針、
  コード実装方針〔インライン既定・POMはトリガー駆動〕）: [test-designs/README.md](test-designs/README.md)
- Design Docテンプレート: [test-designs/templates/test-design-doc-template.md](test-designs/templates/test-design-doc-template.md)
- 完成例: [test-designs/e2e/demo/E2E-DEMO-001-docs-navigation.md](test-designs/e2e/demo/E2E-DEMO-001-docs-navigation.md) と [e2e/demo/E2E-DEMO-001.spec.ts](e2e/demo/E2E-DEMO-001.spec.ts)

## ディレクトリ構成

```
test-designs/
  README.md              … 管理ルール（ID命名規則、Status、Qualification、拡張・実装方針）
  templates/             … Design Docテンプレート
  e2e/<area>/            … E2EレベルのDesign Doc
  int/<area>/            … IntegrationレベルのDesign Doc
e2e/<area>/              … Playwright spec（INTも同じtestDir配下）
skills/                  … 4 skillのhost中立な正本
.claude/skills/          … 正本への相対symlink（Claude Code discovery）
.agents/skills/          … 正本への相対symlink（Codex discovery）
scripts/                 … 整合チェッカー等の運用スクリプト
playwright-report/       … 通常実行のHTMLレポート（Git管理外、実行ごとに上書き）
qualification-reports/   … Qualificationのレポート（Git管理外、実行ごとに保存）
```
