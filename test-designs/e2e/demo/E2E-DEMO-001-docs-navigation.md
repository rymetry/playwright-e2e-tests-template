<!--
このファイルはテンプレート運用の完成例（サンプル）です。
playwright.devの公開ドキュメントを対象に、命名規則・タグ・Status管理・
Qualificationの記録方法を実演しています。実プロジェクトでは削除してください。
-->

# E2E-DEMO-001 ドキュメントナビゲーション

## メタデータ

| 項目 | 値 |
|---|---|
| Parent Case ID | E2E-DEMO-001 |
| テストレベル | E2E |
| 機能 | playwright.dev ドキュメントへの導線 |
| 対象環境 | `E2E_BASE_URL=https://playwright.dev`（公開サイト） |
| 最終確認 | 2026-07-29 / 本書「Test Status判定根拠」参照 |

## Check一覧

| Check ID | Execution mode | Exploration mode | Tier | Status | Code / 手順 |
|---|---|---|---|---|---|
| E2E-DEMO-001-PW-01 | PLAYWRIGHT | `NONE` | SMOKE | ACTIVE | `e2e/demo/E2E-DEMO-001.spec.ts` |

Status列は各Checkの「Test Status判定根拠」の判定と常に一致させる。

## 1. 目的

サイト訪問者が、トップページから主要導線（Get started）を通じて
インストールガイドへ到達できることを保証する。

## 2. 品質リスク

- トップページが表示されない
- 主要導線のリンクが機能せず、ドキュメントへ到達できない
- 遷移先が期待したガイドと異なる

## 3. Check設計

### 3.1 E2E-DEMO-001-PW-01: Get startedからインストールガイドへ到達できる

#### 前提条件

- `E2E_BASE_URL`のoriginが`E2E_ALLOWED_ORIGINS`に含まれる
  （`playwright.config.ts`が起動時に検証する）
- 認証不要の公開サイトのため、ケース固有の開始状態はなし

#### テストデータ

| 項目 | 値・生成方法 |
|---|---|
| 入力値 | なし |
| 動的データ | なし |
| 競合回避 | 対象外（読み取りのみ） |

#### Fixture

| Fixture | 用途 |
|---|---|
| なし | このCheckは事前準備済みデータに依存しない |

#### 前処理

- なし

#### シナリオ

Given:

- 利用者がトップページ（`/`）を表示している

When:

- 「Get started」リンクを選択する

Then:

- インストールガイド（`/docs/intro`）へ遷移する
- 「Installation」見出しを確認できる

#### Assertion設計

##### Functional

- ページタイトルに`Playwright`が含まれる
- 遷移後のURLが`/docs/intro`に一致する
- 「Installation」見出しが表示される

##### Accessibility

- 導線は`link`ロールと accessible name「Get started」で特定する
- 到達確認は`heading`ロールと accessible name「Installation」で行う

##### Visual

- 対象外（外部サイトのため表示は管理外。VRT基準を維持できない）

#### 後処理

| 結果 | 後処理 |
|---|---|
| PASS | なし（状態を変更しない） |
| FAIL | trace・screenshotを保持し、原因確認前に再実行しない |

#### 実行契約

| 項目 | 値 |
|---|---|
| Playwright Project | `chromium` |
| Tierタグ | `@smoke`（`{ tag: '@smoke' }`オプションで付与） |
| QUARANTINE時 | `{ tag: '@quarantine' }`を付与し、通常実行から除外する |
| 最大待機時間 | Playwright既定値 |
| ポーリング | 対象外 |
| retry | 通常実行はrepository設定に従い、qualificationでは`0` |
| 並列実行 | repository設定に従う |
| 失敗時証跡 | trace、screenshot、URL origin、実行日時、最後に成功した操作 |

ケース固有の制約:

- 外部公開サイトが対象のため、読み取り操作のみ行う

#### 探索目的

- 対象外（公開ドキュメントの構造が安定しており、既知の導線のみを扱うため）

#### 探索で確認した事実

| 項目 | 値 |
|---|---|
| Exploration mode | `NONE` |
| Tool / version | なし |
| Browser | なし |
| Session | なし |
| Artifacts | なし |
| 観測日時 | — |

#### レビュー済みの期待値

| 項目 | 値 |
|---|---|
| 根拠 | playwright.dev公開ドキュメントの構造（トップページ→Get started→Installation） |
| レビュー日 | 2026-07-29 |
| レビュー担当 | テンプレート作成者（サンプルのため） |
| 期待値 | タイトルに`Playwright`を含む。Get started選択後、URLが`/docs/intro`となり「Installation」見出しが表示される |

#### Test Status判定根拠

| 項目 | 値 |
|---|---|
| 判定 | ACTIVE |
| 判定日 | 2026-07-29 |
| 判定根拠 | URL Assertion厳格化とTierタグのtagオプション化（spec変更）に伴いREADME 4.2の再Qualificationを実施し、3回clean passした |
| Qualification command / procedure | `npm run test:qualify -- --grep "E2E-DEMO-001-PW-01" --project=chromium` |
| Qualification result | 3 passed / 3 runs（retry・skip・fixme・flaky・interruptedなし） |
| 実行条件 | origin `https://playwright.dev`、Playwright 1.62.0（同梱Chromium）、Project `chromium` |
| 対象revision | `759e5ed`＋最終レビュー修正の作業ツリー（コミット時にSHAへ更新する） |
| 証跡 | 本表の記録が一次証跡。補助: `qualification-reports/2026-07-29_12-19-21-234_E2E-DEMO-001-PW-01/`（2026-07-29 21:19 JST実行。フォルダ名はUTC、ローカル限定で消失しうる） |

#### 対象外・未確定

- ドキュメント本文の内容の正しさは保証しない
- Get started以外の導線（検索、ヘッダーメニュー等）は対象外

## 4. 関連仕様

- テンプレート運用ルール: `test-designs/README.md`
- Design Docテンプレート: `test-designs/templates/test-design-doc-template.md`
