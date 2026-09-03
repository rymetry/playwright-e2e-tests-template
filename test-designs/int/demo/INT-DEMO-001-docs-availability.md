<!--
このファイルはAPI Checkの記入例（サンプル）です。mode別のAPI Checkテンプレートを
playwright.devの公開ドキュメント向けに本記入した完成形を示します。
実プロジェクトでは削除してください。
-->

# INT-DEMO-001 ドキュメント配信（API）

## メタデータ

| 項目 | 値 |
|---|---|
| Parent Case ID | INT-DEMO-001 |
| テストレベル | INT |
| 機能 | playwright.dev ドキュメントページのHTTP配信 |
| 対象環境 | `E2E_BASE_URL=https://playwright.dev`（公開サイト） |
| 最終確認 | 2026-08-08 / 本書「Test Status判定根拠」参照 |

## Check一覧

| Check ID | 分類 | Execution mode | Exploration mode | Tier | Status | Code / 手順 |
|---|---|---|---|---|---|---|
| INT-DEMO-001-API-01 | 正常系 | API | `NONE` | REGRESSION | ACTIVE | `e2e/demo/INT-DEMO-001.spec.ts` |

Status列は各Checkの「Test Status判定根拠」の判定と常に一致させる。

## 1. 目的

ドキュメントページ（インストールガイド）がブラウザを介さずHTTPレベルで
正常に配信されることを保証する。UI導線の保証（E2E-DEMO-001）とは分離した、
API Execution modeの記入例。

## 2. 品質リスクとテスト条件

- ドキュメントページがHTTPエラーを返し、UI以前の段階で閲覧できない
- HTML以外のレスポンスが返り、ページとして表示できない
- ガイド本文が配信内容から欠落する

| テスト条件 | 分類 | 技法 | 担当 |
|---|---|---|---|
| インストールガイドが200・HTMLで配信され本文を含む | 正常系 | シナリオベースドテスト | INT-DEMO-001-API-01 |
| 存在しないページへのrequestに対するエラー応答の形式 | 準正常系 | 同値分割法 | `対象外`（公開サイトのエラー応答は管理外） |

## 3. Check設計

### 3.1 INT-DEMO-001-API-01: インストールガイドがHTTPで配信されている

#### 前提・データ

- 開始状態: 認証不要の公開サイト。対象endpointは`GET /docs/intro`、依存する外部サービスはplaywright.dev本体のみ。外部公開サイトのため読み取り操作のみ行う
- request: `GET /docs/intro`（header・bodyなし。既知の有効URLの同値クラス）
- 動的データ・競合回避: なし（読み取りのみ）

#### シナリオ

カバレッジアイテム: テスト条件「インストールガイドが200・HTMLで配信され本文を含む」を、
既知の有効URL 1件（`/docs/intro`）で確認する。

Given:

- 対象環境のドキュメントが公開されている

When:

- インストールガイド（`/docs/intro`）をHTTP GETで取得する

Then:

- ステータス200で応答する
- HTMLとして配信され、本文に「Installation」を含む

#### Assertion設計

##### Functional

- HTTP statusが`200`である
- `content-type`ヘッダに`text/html`を含む
- レスポンス本文に`Installation`を含む
- 副作用: なし（読み取りのみ。永続状態・イベント・通知の確認は対象外）

#### 実行契約

| 項目 | 値 |
|---|---|
| Playwright Project / API client | `chromium`（`request` fixtureのみを使用し、ブラウザは起動しない。ブラウザ非依存の専用Projectは、スイート間で設定が分岐するまで導入しない〔README 7章〕） |
| 既定からの逸脱 | なし |
| 外部依存の模擬 | なし |
| 後処理 | 既定どおり（状態を変更しない） |

対象endpointと役割分担:

- 対象endpoint: `GET /docs/intro`。認証: 不要（公開サイト）。
  依存する外部サービス: playwright.dev本体のみ
- PW Check（`E2E-DEMO-001-PW-01`）との役割分担: PW側はトップページからの
  UI導線（リンク遷移と表示）を保証し、本CheckはHTTP配信のみを保証する。
  同じ保証を二重に持たない

#### 対象外・未確定

- ドキュメント本文の内容の正しさは保証しない
- `/docs/intro`以外のページの配信、およびエラー応答の形式は対象外
- リダイレクト・キャッシュ・CDNの挙動は対象外

#### 探索目的

- 対象外（公開ドキュメントの配信を既知のURLで確認するのみで、
  UI状態・待機条件の探索を要しないため）

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
| 根拠 | playwright.dev公開ドキュメントの構造（`/docs/intro`がインストールガイドをHTMLで配信する） |
| レビュー日 | 2026-08-08 |
| レビュー担当 | テンプレート作成者（サンプルのため） |
| 期待値 | `GET /docs/intro`がstatus 200・`text/html`で応答し、本文に`Installation`を含む |

#### Test Status判定根拠

| 項目 | 値 |
|---|---|
| 判定 | ACTIVE |
| 判定日 | 2026-08-08 |
| 判定根拠 | レビュー済みの期待値をspecとして実装し、README 4.1のQualificationで3回clean passした |
| Qualification command / procedure | `npm run test:qualify -- --grep "INT-DEMO-001-API-01" --project=chromium` |
| Qualification result | 3 passed / 3 runs（retry・skip・fixme・flaky・interruptedなし） |
| 実行条件 | origin `https://playwright.dev`、Playwright 1.62.0、Project `chromium`（ブラウザ非起動のrequest実行） |
| 対象revision | `4b4418e` に本Doc・specを追加した作業ツリーで実施（未commit時点。commit後もspec・configは同一内容） |
| 証跡 | 本表の記録が一次証跡。補助: `qualification-reports/2026-08-08_08-01-32-620_INT-DEMO-001-API-01/`（2026-08-08 17:01 JST実行。フォルダ名はUTC、ローカル限定で消失しうる） |

## 4. 関連仕様

- テンプレート運用ルール: `test-designs/README.md`
- Design Doc生成・記入規則: `test-designs/README.md` 6章、既定契約は9章
- 関連するTest Design: `test-designs/e2e/demo/E2E-DEMO-001-docs-navigation.md`
  （同じ対象へのUI導線の保証。役割分担は本書3.1の実行契約を参照）
