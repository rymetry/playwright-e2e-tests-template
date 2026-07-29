# Test Design 管理ガイド

このディレクトリは、Integration／E2Eテストの設計文書（Test Design Doc）を管理する。
自動テスト（Playwright）だけでなく、Computer Useによる画面操作テスト、人による
Manualテストも同じ体系で設計・管理する。

想定する運用モデルは「AIエージェントがTest Design Docとテストを作成し、
人間が期待値をレビューして承認する」である。本書のレビュー関連の規則は、
AIの観測・生成物を無審査で正式な期待値にしないための関所として機能する。

## 1. 管理体系の全体像

```
Suite（機能領域 = Area）
└── Parent Case（1つのユーザーシナリオ = 1つのTest Design Doc）
    └── Check（実行単位のテスト。Execution modeごとに分かれる）
```

- **Parent Case**: 「何を保証するか」を定義する単位。1ファイル1シナリオ。
- **Check**: 「どう検証するか」の実行単位。同じシナリオでもPlaywright実行、
  Computer Use実行、Manual実行はそれぞれ別Checkとして設計する。

## 2. ID命名規則

### 2.1 Parent Case ID

```
<LEVEL>-<AREA>-<SEQ>
```

| 要素 | 規則 | 例 |
|---|---|---|
| LEVEL | `E2E`（E2Eテスト）または `INT`（Integrationテスト） | `E2E` |
| AREA | 2〜6文字の大文字英字。機能領域コード（2.4のレジストリに登録） | `AUTH` |
| SEQ | 3桁ゼロ埋め連番。同一LEVEL・AREAの組内で一意。欠番・RETIRED済みIDは再利用しない | `001` |

例: `E2E-AUTH-001`、`INT-ORDER-003`

### 2.2 Check ID

```
<Parent Case ID>-<MODE>-<NN>
```

| MODE | Execution mode | 主な用途 |
|---|---|---|
| `PW` | PLAYWRIGHT | ブラウザ経由のUI自動テスト |
| `API` | API | Playwright request等によるAPI／サービス層テスト（主にINT） |
| `CU` | COMPUTER_USE | Canvas、OS UI、拡張機能などPlaywrightで扱えない画面操作 |
| `MN` | MANUAL | 人の意味判断、感性的評価、物理操作が必要なテスト |

NNは2桁ゼロ埋め連番。例: `E2E-AUTH-001-PW-01`、`INT-ORDER-003-API-02`

### 2.3 ファイル命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| Test Design Doc | `test-designs/<level>/<area>/<Parent Case ID>-<slug>.md` | `test-designs/e2e/auth/E2E-AUTH-001-login-success.md` |
| Playwright spec | `e2e/<area>/<Parent Case ID>.spec.ts` | `e2e/auth/E2E-AUTH-001.spec.ts` |
| テストタイトル | Check IDで始める | `test('E2E-AUTH-001-PW-01: 正しい資格情報でログインできる', ...)` |

- slugは英小文字ケバブケース。シナリオ内容が推測できる短い名前にする。
- 1つのParent Caseに属するPW／API Checkは同じspecファイルにまとめ、
  `test()`のタイトルでCheck IDを識別する。
- INTのspecも本リポジトリのtestDir（`e2e/`）配下に置き、ファイル名の
  LEVELプレフィックス（`INT-`）で区別する。
- ID・タイトルの対応により `npm test -- --grep "E2E-AUTH-001"` で
  Parent Case単位、`npm test -- --grep "E2E-AUTH-"` でArea単位の実行ができる。
- 絞り込み実行は必ず`npm test -- --grep`経由で行う。`npx playwright test`の
  直接実行では`@quarantine`の除外が適用されない。

### 2.4 Areaレジストリ

新しいAreaコードはここに登録してから使用する。

| Area | 対象領域 | 備考 |
|---|---|---|
| DEMO | サンプル（playwright.devを対象にした完成例） | 実プロジェクトでは削除可 |
| （例）AUTH | 認証・ログイン・セッション | |
| （例）USER | ユーザー管理・プロフィール | |

## 3. Tier（実行階層）

| Tier | 目的 | 実行タイミングの目安 |
|---|---|---|
| SMOKE | サービスの最重要フローが生きていることの確認 | デプロイ直後、毎実行 |
| REGRESSION | 主要機能の回帰確認 | 日次または PR マージ時 |
| EXTENDED | 網羅性重視の低頻度確認（VRT全画面、周辺系など） | 週次またはリリース前 |

Playwrightではタグ（`@smoke` など）でTierを表現し、`--grep @smoke` で選別する。
CU／MN CheckのTierは実行計画（いつ誰が実行するか）の管理に使う。

## 4. Statusライフサイクル

```
DRAFT → EVALUATING → ACTIVE ⇄ QUARANTINE → RETIRED
```

| Status | 意味 |
|---|---|
| DRAFT | 設計、期待値レビュー、または実装が未完了 |
| EVALUATING | レビュー済みの期待値をテストまたは手順として実装済みで、結果を評価中 |
| ACTIVE | Execution modeごとの昇格条件を満たし、通常実行の対象 |
| QUARANTINE | 結果を信頼できない理由があり、通常実行から一時隔離。理由と証跡を必ず記録 |
| RETIRED | 対象機能の廃止等で恒久的に終了。IDは再利用しない |

- RETIREDへはACTIVE／QUARANTINEのどちらからも変更できる。
- Test Design DocのCheck一覧のStatus列と、各Checkの「Test Status判定根拠」は
  同時に更新し、常に一致させる。
- Docとspecの整合（Statusの2箇所一致、`@quarantine`／`@smoke`タグ、実装の有無、
  命名規則）は`npm run check`で機械的に検証できる。Statusの変更やspecの
  追加・削除を行ったら実行する。

### 4.1 ACTIVEへの昇格条件（Qualification）

**PW／API Check:**

- 期待値がレビュー済みである
- 実装がTest Design Docと一致する
- isolated context（APIの場合は独立したセッション・状態）、
  同一環境・同一設定で実行している
- 対象Checkに限定した次の形式のコマンドで、3回すべてclean passしている

  ```bash
  npm run test:qualify -- --grep "<Check ID>" --project=<Project>
  ```

  `test:qualify`は3回実行・retry 0・workers 1を標準条件として設定し、
  `--grep`（Check ID）と`--project`の指定漏れを起動時に検証する
  （未指定の場合はテストを開始せず失敗する）。このガードは誤操作防止を
  目的とし、追加CLI引数による意図的な条件変更は防止対象外とする。
  Qualificationの妥当性は、Design Docに記録した実行コマンド、
  3 passed / 3 runsの結果、対象revision、およびレビューで確認する。
- clean passの定義: 3回すべてpassedであり、retry、skip、fixme、
  expected failure、flaky、interruptedを1件も含まない
- **一次証跡はDesign Docの「Test Status判定根拠」表のテキスト記録**とする。
  実行コマンド、Check IDとProject、結果、対象revision（commit等。未管理なら
  その旨）、対象origin、Playwrightとbrowserのversion、タイムゾーン付き
  実行日時を記録する
- HTMLレポートは`qualification-reports/<実行日時>_<Check ID>/`へ保存され、
  実行ごとに別フォルダとなり上書きされない。Git管理外のローカル限定の
  補助資料（消失しうる）として扱い、閲覧は
  `npx playwright show-report qualification-reports/<dir>`で行う。
  判定に使用していない古いフォルダは削除してよい
- `test:qualify`はPOSIX形式の環境変数設定を使うため、macOS／Linuxを前提と
  する（Windowsでは`cross-env`等が必要）

**CU Check:**

- 期待値と操作手順がレビュー済みである
- 対象環境、使用ツール、実行エージェントを記録している
- レビュー済み手順による初回実行が成功し、証跡（screenshot等）を保存している

**MN Check:**

- 期待値、操作手順、判定基準がレビュー済みである
- 対象環境と実行者を記録している
- レビュー済み手順による初回実行が成功し、合否を再確認できる記録がある

### 4.2 再Qualification

ACTIVEのCheckでも、次のいずれかが変わった場合はEVALUATINGへ戻し、
Qualificationを再実施する。

- spec実装、操作手順、またはレビュー済みの期待値
- Playwright設定、Project、browser／toolのmajor version
- 対象環境（origin、主要データ、権限構成）

### 4.3 QUARANTINEの実行除外と復帰

**PW／API Check:**

- CheckをQUARANTINEへ変更したら、対応するテストのタイトルに`@quarantine`
  タグを付与する。skip、fixme、コメントアウトは使わない。
- 通常実行のscript（`test`、`test:smoke`など）は`--grep-invert @quarantine`で
  QUARANTINE Checkを自動的に除外する（`package.json`に設定済み）。
- `test:ui`は調査・デバッグ用の例外であり、Playwright設定で収集される
  PW／APIテストを`@quarantine`を含めて表示・実行できる。通常suiteの実行には
  使用せず、Run allを通常実行の代替にしない（`test:headed`は通常実行の
  可視化のため除外あり）。

**CU／MANUAL Check:**

- 通常実行計画・チェックリストには、実行開始時点でCheck一覧のStatusが
  ACTIVEであるCheckだけを含める。計画作成時だけでなく、実行直前にも
  Statusを再確認する。
- EVALUATINGの初回Qualification、およびQUARANTINE中の原因調査・
  再Qualificationは通常実行に含めず、対象Check・目的・環境を明記した
  個別計画として実施する。DRAFT／RETIREDは実行しない。

**復帰（全mode共通）:**

- QUARANTINEからACTIVEへ戻すには、原因と対処を記録したうえで
  4.1のQualificationを再実施する。

## 5. 共通の安全規則

- live UIの観測結果、Locator候補、生成コードを無審査で期待値にしない。
  期待値は仕様・受入条件の責任者によるレビューを経て確定する。
- 固定wait／sleep、skip、自己修復処理、不安定なCSS／XPath、秘密情報を
  Test Designやテストコードへ持ち込まない。
- `E2E_BASE_URL`のoriginは`E2E_ALLOWED_ORIGINS`（カンマ区切りの許可済み
  origin一覧）に含まれていなければならない。`playwright.config.ts`が起動時に
  検証し、不一致の場合はテストを開始せず失敗する。本番環境をallowlistへ
  入れない。
- この検証は`E2E_BASE_URL`が設定されている場合のみ機能し、テストコード内の
  絶対URLへの遷移までは防がない。specでは`page.goto('/')`のように
  baseURL相対のパスだけを使い、絶対URLをハードコードしない。
- CU／MANUAL Checkでは、操作開始前に表示中のURL originが許可済み環境と
  一致することを確認し、結果を証跡へ残す。
- 認証情報をterminal、artifact、Test Design Docへ出力しない。

## 6. 運用フロー

1. `templates/test-design-doc-template.md` を
   `test-designs/<level>/<area>/<ID>-<slug>.md` へコピーする
2. ID・機能名・Checkを記入し、使わないExecution modeのCheckブロックを削除する
3. 必要なら探索（Playwright CLI／Computer Use／Manual）を行い、観測事実を記録する
4. 期待値レビューを受け、レビュー済みの期待値を確定する
5. テストまたは手順を実装し、StatusをEVALUATINGへ変更する
6. Qualificationを実施し、条件を満たしたらACTIVEへ変更する

完成例として、`test-designs/e2e/demo/E2E-DEMO-001-docs-navigation.md` と
対応する `e2e/demo/E2E-DEMO-001.spec.ts` を参照できる。

## 7. スイート拡張の方針

スイートやタグを増やすときは、次の2原則に従う。

1. **軸を混ぜない。** タグ体系には役割の異なる軸があり、それぞれ表現手段が
   決まっている。
   - Tier（実行頻度・重要度）: タグ。1テストにちょうど1つ
   - 運用状態: `@quarantine`の有無
   - 機能領域: タグを作らず、Check IDでgrepする
     （例: `npm test -- --grep "E2E-AUTH-"`で領域スイート、
     `npm test -- --grep "E2E-AUTH-001"`でParent Case単位。
     `npm test`経由にすることで`@quarantine`除外が維持される）。
     領域タグはIDとの二重管理になるため禁止
2. **タグには必ず消費者を置く。** そのタグでgrepするscriptまたはCIジョブが
   存在しないタグは作らない。

拡張は事前に作り込まず、次のトリガーが実際に発生したときに行う。

| トリガー | 対応 |
|---|---|
| REGRESSION／EXTENDEDを分けて実行したくなった | `@regression`／`@extended`タグを追加し、累積構造はgrep式で表現する（例: regression実行=`--grep "@smoke|@regression"`）。整合チェッカーのTierチェックを全Tier両方向へ拡張する |
| タグが4種を超えた | READMEにタグレジストリ（タグ名／意味／消費するscript）を追加し、以後は登録制にする |
| スイート間でブラウザ・baseURL・認証状態等の設定が分岐した | npm scriptsのgrepからPlaywright Projectsへ移行する |
| CU／MANUAL Checkが増えた | 整合チェッカーのDocパース処理を再利用し、実行計画（Status=ACTIVEかつ対象TierのCheckリスト）を生成するスクリプトを追加する |

現状（`@smoke`と`@quarantine`のみ、`npm test`が事実上のregression）は
この方針に対して不足のない状態であり、上記トリガーの発生までは何も追加しない。
