<!--
このファイルはテンプレート運用の完成例（サンプル）です。
playwright.devの公開ドキュメントを対象に、命名規則・分類・Status管理・
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
| 最終確認 | 2026-08-16 / 本書「Test Status判定根拠」参照 |

## Check一覧

| Check ID | 分類 | Execution mode | Exploration mode | Tier | Status | Code / 手順 |
|---|---|---|---|---|---|---|
| E2E-DEMO-001-PW-01 | 正常系 | PLAYWRIGHT | `NONE` | SMOKE | ACTIVE | `e2e/demo/E2E-DEMO-001.spec.ts` |

Status列は各Checkの「Test Status判定根拠」の判定と常に一致させる。

## 1. 目的

サイト訪問者が、トップページから主要導線（Get started）を通じて
インストールガイドへ到達できることを保証する。

## 2. 品質リスクとテスト条件

- トップページが表示されない
- 主要導線のリンクが機能せず、ドキュメントへ到達できない
- 遷移先が期待したガイドと異なる

| テスト条件 | 分類 | 技法 | 担当 |
|---|---|---|---|
| トップページからGet started導線でインストールガイドへ到達できる | 正常系 | シナリオベースドテスト | E2E-DEMO-001-PW-01 |
| 検索・ヘッダーメニューなど他の導線からの到達 | 正常系 | シナリオベースドテスト | `対象外`（最重要導線1本を代表とする） |

## 3. Check設計

### 3.1 E2E-DEMO-001-PW-01: Get startedからインストールガイドへ到達できる

#### 前提・データ

- 開始状態: 認証不要の公開サイト。ケース固有の開始状態はなし。外部公開サイトのため読み取り操作のみ行う
- 入力値と意味クラス: なし
- 動的データ・競合回避: なし（読み取りのみ）

#### シナリオ

カバレッジアイテム: テスト条件「トップページからGet started導線でインストールガイドへ
到達できる」を、Get startedリンク1本で確認する（最重要導線を代表とする）。

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

Visualは対象外（外部サイトのためVRT基準を維持できない）。

#### 実行契約

| 項目 | 値 |
|---|---|
| Playwright Project | `chromium` |
| 既定からの逸脱 | なし |
| 外部依存の模擬 | なし |
| 後処理 | 既定どおり（状態を変更しない） |

#### 対象外・未確定

- ドキュメント本文の内容の正しさは保証しない
- Get started以外の導線（検索、ヘッダーメニュー等）は対象外

#### 探索目的

- 対象外（公開ドキュメントの構造が安定しており、既知の導線のみを扱うため）

#### 探索サマリ

| 項目 | 値 |
|---|---|
| Exploration mode | `NONE` |
| Run / 観測環境 | なし（探索不要） |
| 観測サマリ | なし（探索不要） |
| 実装候補（レビュー対象） | なし |
| 観測上の疑問・要判断 | なし |
| Artifacts | なし |

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
| 判定日 | 2026-08-16 |
| 判定根拠 | `chromium` Projectを通常版ChromiumのNew Headlessへ変更したためREADME 4.2の再Qualificationを実施し、3回clean passした |
| Qualification command / procedure | `npm run test:qualify -- --grep "E2E-DEMO-001-PW-01" --project=chromium` |
| Qualification result | 3 passed / 3 runs（retry・skip・fixme・flaky・interruptedなし） |
| 実行条件 | origin `https://playwright.dev`、Playwright 1.62.0、Project `chromium`（`channel: 'chromium'`） |
| 対象revision | `3e904f5`（Qualification実行時のspec・configは本commitの内容と同一） |
| 証跡 | 本表の記録が一次証跡。補助: `qualification-reports/2026-08-16_14-50-16-595_E2E-DEMO-001-PW-01/`（2026-08-16 23:50 JST実行。フォルダ名はUTC、ローカル限定で消失しうる） |

## 4. 関連仕様

- テンプレート運用ルール: `test-designs/README.md`
- Design Doc生成・記入規則: `test-designs/README.md` 6章、既定契約は9章
