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
4. [test-designs/README.md](test-designs/README.md) 2.4に従い、
   [test-designs/areas.json](test-designs/areas.json)へ自プロジェクトの機能領域を登録する
5. サンプル一式（`test-designs/e2e/demo/`、`test-designs/int/demo/`、
   `e2e/demo/`、`test-designs/areas.json`のDEMO entry）を削除する。
   書き方の参考として一式を残してもよい
6. CIを使う場合はGitHubのrepository variablesを設定する
   （`E2E_CI=true`・`E2E_BASE_URL`・`E2E_ALLOWED_ORIGINS`。「CI」の章を参照）
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

`chromium` Projectは `channel: 'chromium'` を既定とし、通常版Chromiumの
New Headlessを使用する。これにより、ブラウザ表示あり／なしで異なる実行ファイルを
使うことによる挙動差を抑える。Firefox／WebKitや、明示的に追加する
Google Chrome／Microsoft EdgeのProjectには、この設定は適用されない。

`.env` の `E2E_BASE_URL` と `E2E_ALLOWED_ORIGINS` を対象環境に合わせて設定する。
`E2E_BASE_URL` のoriginが `E2E_ALLOWED_ORIGINS` に含まれない場合、テストは
起動時に失敗する（本番環境への誤実行防止）。

### 認証情報と失敗時artifact

AIは認証情報の値を読み取らず、`.env`の環境変数から入力先へ直接渡す。値を
terminal、ログ、Test Design Docへ直接出力しない。

認証情報を含み得る失敗時のtrace、screenshot等は、本番以外の許可済み検証環境で
テスト専用アカウントを使うテストに限定する。Git管理外の実行環境内だけに保存し、
外部へ共有しない。調査完了後に不要であることを管理者が確認し、手動で削除する。詳細は
[test-designs/README.md 5章](test-designs/README.md#5-共通の安全規則)を参照する。

## スクリプト

| コマンド | 用途 |
|---|---|
| `npm test` | 全テスト実行（QUARANTINE除外） |
| `npm run test:smoke` | SMOKE Tierのみ実行（QUARANTINE除外） |
| `npm run test:qualify -- --grep "<Check ID>" --project=chromium` | Check単位のQualification（3回連続実行） |
| `E2E_QUALIFY_OWNER_APPROVAL_REF=<ref> npm run test:qualify:owner-approved -- --grep "<Check ID>" --project=chromium` | オーナー承認を記録したCheck単位の短縮Qualification（1回実行） |
| `npm run test:headed` | ブラウザ表示付き実行 |
| `npm run test:ui` | UIモード |
| `npm run test:report` | 直近のHTMLレポート表示 |
| `npm run create:test-design -- ...` | [管理ガイド6.0](test-designs/README.md#60-test-design-docの生成)に従い、1シナリオ1ファイルのDesign Docを生成 |
| `npm run typecheck` | TypeScript型検査 |
| `npm run check` | Design Doc／spec整合、Design Docの契約・生成test、両hostのskill構造を検査 |
| `npm run check:skills` | Claude Code／Codexのskill構造だけを検査 |

- `test:qualify` と `test:qualify:owner-approved` は `--grep`（Check ID）と
  `--project` の指定を必須とし、
  未指定の場合は起動時に失敗する。レポートは `qualification-reports/<実行日時>_<Check ID>/`
  （Git管理外）へ保存され、`npx playwright show-report qualification-reports/<dir>` で閲覧できる
- 短縮Qualificationは、Test Design Docへオーナー承認を記録した後だけ使用する。
  `E2E_QUALIFY_OWNER_APPROVAL_REF`にはその記録を識別する非placeholder値を指定する
- Qualificationでは、`test` subcommand、単一Check ID、単一Project、規定の
  repeat／retry／workers以外のCLI引数を使用できない
- Check ID／Area単位の絞り込み実行は `npm test -- --grep "E2E-AUTH-"` のように
  `npm test` 経由で行う。`npx playwright test` の直接実行ではQUARANTINE除外が
  適用されない
- `test:ui` はデバッグ用の例外で、`@quarantine` を含むテストも表示・実行できる。
  通常suiteの実行には使用しない
- スクリプトはPOSIXシェル前提（macOS／Linux）。Windowsでは `cross-env` 等が必要
- Design Docを永続記録として運用するため、リポジトリはGit管理下に置くことを推奨

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) がpush／pull request時に
`npm run check` と `npm run typecheck` を実行する（skill symlinkの整合も
ここで検証される）。

E2Eテストの実行（`npm test`）は、GitHubのrepository variablesを設定した場合のみ
有効になる:

| Variable | 値 |
|---|---|
| `E2E_CI` | `true`（未設定ならE2E jobをskipする） |
| `E2E_BASE_URL` | 対象環境のURL |
| `E2E_ALLOWED_ORIGINS` | 許可済みoriginのカンマ区切り一覧（本番環境を入れない） |

テンプレート直後・サンプル削除直後はテスト0件で失敗するため、既定では無効に
してある。最初の実ケースをACTIVEにした後に有効化する。

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

healの運用ルール（同一起動内での再観測、Proposalの承認と適用の分離、禁止変更）の
正は [test-designs/README.md](test-designs/README.md) 6.1にあり、
[skills/heal/SKILL.md](skills/heal/SKILL.md) はそれに従う実行手順である。
本書では重複記述しない。

Claude Codeの公式仕様はproject skillのdirectory symlinkをサポートし、本構成は
Claude Code v2.1.207で認識を確認済み。相対symlinkを保持するGit clone／template copyでは
両host構造もそのまま移る。symlinkを通常fileへ変換するcheckout（Windows Gitの設定を
含む）や、symlinkを除去・dereferenceするarchive／copy手段を使った場合は
`npm run check:skills` が失敗するため、利用開始前に `npm run check` を実行する。

- 管理ルール（ID命名規則、Tier、Status、昇格条件、スイート拡張方針、
  コード実装方針〔インライン既定・POMはトリガー駆動〕）: [test-designs/README.md](test-designs/README.md)
- Design Doc生成方法とテンプレート構成: [test-designs/README.md](test-designs/README.md#60-test-design-docの生成)
- 完成例（PW Check）: [test-designs/e2e/demo/E2E-DEMO-001-docs-navigation.md](test-designs/e2e/demo/E2E-DEMO-001-docs-navigation.md) と [e2e/demo/E2E-DEMO-001.spec.ts](e2e/demo/E2E-DEMO-001.spec.ts)
- 完成例（API Check）: [test-designs/int/demo/INT-DEMO-001-docs-availability.md](test-designs/int/demo/INT-DEMO-001-docs-availability.md) と [e2e/demo/INT-DEMO-001.spec.ts](e2e/demo/INT-DEMO-001.spec.ts)

## ディレクトリ構成

```
test-designs/
  README.md              … 管理ルール（ID命名規則、Status、Qualification、拡張・実装方針）
  areas.json             … generator／checkerが参照するAreaレジストリの正本
  templates/             … 共通部とmode別Checkの生成用テンプレート
  e2e/<area>/            … E2EレベルのDesign Doc
  int/<area>/            … IntegrationレベルのDesign Doc
e2e/<area>/              … Playwright spec（INTも同じtestDir配下）
skills/                  … 4 skillのhost中立な正本
.claude/skills/          … 正本への相対symlink（Claude Code discovery）
.agents/skills/          … 正本への相対symlink（Codex discovery）
scripts/                 … Design Doc生成・整合チェッカー等の運用スクリプト
.github/workflows/       … CI（check／typecheckは常時、E2Eはrepository variablesで有効化）
playwright-report/       … 通常実行のHTMLレポート（Git管理外、実行ごとに上書き）
qualification-reports/   … Qualificationのレポート（Git管理外、実行ごとに保存）
```

## ライセンス

MIT License（[LICENSE](LICENSE)）。ただし [skills/playwright-cli/](skills/playwright-cli/) は
[microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) 由来の
Apache License 2.0（改変版）であり、出所・改変内容は
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照する。
