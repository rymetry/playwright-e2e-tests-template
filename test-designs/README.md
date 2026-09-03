# Test Design 管理ガイド

このディレクトリは、Integration／E2Eテストの設計文書（Test Design Doc）を管理する。
自動テスト（Playwright）だけでなく、Computer Useによる画面操作テスト、人による
Manualテストも同じ体系で設計・管理する。

本書はDocの書き方に留まらず、Status管理・Qualification・QUARANTINE運用・
スイート拡張方針・コード実装方針を含む、**テスト運用全体の管理ガイド**として
機能する。ルールの正はすべて本書に置き、他のドキュメントからは参照のみ行う。

想定する運用モデルは「AIエージェントがTest Design Docとテストを作成し、
人間が期待値をレビューして承認する」である。本書のレビュー関連の規則は、
AIの観測・生成物を無審査で正式な期待値にしないための関所として機能する。

**読み方マップ**（本書は規則集であり、順に読む必要はない）:

- 初めて触れる人は、先に [GUIDE.md](GUIDE.md)（入門ガイド。図と1つのCheckの一生）を読む
- Docを書く: 1.1（記述方針）、1.3（テスト条件・分類・技法）、6.0（生成）、9章（既定契約）
- 期待値をレビューする: 4.1（昇格条件）、5章（安全規則）、9章（何が省略されているか）
- 失敗に対応する: 6.1（修復フロー）
- スイートを広げる: 7章（拡張方針）、8章（コード実装方針）

## 1. 管理体系の全体像

```
Suite（機能領域 = Area）
└── Parent Case（1つのユースケース = 1つのTest Design Doc）
    └── Check（1つのシナリオ × 1つのExecution mode）
```

- **Parent Case**: 「何を保証するか」を定義する単位。1つのユースケースを、
  基本フロー（正常系）とその分岐（準正常系・異常系）のシナリオ束として扱う。
  品質リスクから導いたテスト条件の一覧（1.3）を持ち、各条件をどのCheckまたは
  下位レベルで担保するかを示す。1ファイル1ユースケース。
- **Check**: 1つのシナリオを1つのExecution modeで検証する実行単位。同じシナリオでも
  Playwright実行、Computer Use実行、Manual実行はそれぞれ別Checkとして設計し、
  同じ分類（1.3）を持つ。

テンプレートのソースは、Parent Case共通部とExecution mode別のCheck部品に分ける。
`npm run create:test-design`が必要な部品を組み立て、最終成果物は必ず上記の
**1 Parent Case 1ファイル**にする。テンプレート部品自体をDesign Docとして運用したり、
手作業でコピー・結合したりしない。

### 1.1 Test Design Docの記述方針

Test Design Docは、シナリオ、リスク、期待値、現在のStatusとその根拠を、人が
短時間で確認できるよう簡潔に書く。

- 各章、テンプレート、workflowが要求する必須項目と表の行は残す。本節を、
  削除や未記入を許可する指示として扱わない。ただし9.1の省略規則に従う省略は
  未記入ではなく、既定契約の採用宣言として扱う
- 同じ前提、承認内容、実行条件を複数箇所で繰り返さない
- 「Test Status判定根拠」は4.1の必須情報を残し、判定理由、コマンド、結果、
  環境、revision、証跡を必要最小限にまとめる
- 実行ログの時系列、過去実行の詳細、性能計測の内訳が既存のPR・Issue・
  実行レポート等にある場合は、Docに重複転載せず、Status判断に必要な要約を
  残したうえで参照する。Git管理外で消失しうる補助資料を唯一の根拠にしない
- 簡潔さのために、品質リスク、レビュー済み期待値、未確定事項、承認条件を省略しない

### 1.2 用語集

| 用語 | 意味 | 参照 | JSTQB／ISTQBの対応 |
|---|---|---|---|
| Suite／Area | 機能領域。Docとspecの配置単位 | 2.4 | — |
| Parent Case | 1つのユースケースを保証するTest Design Doc。品質リスクとテスト条件の一覧を持つ | 1、1.3 | テスト分析の単位（テスト条件の束） |
| Check | 1つのシナリオを1つのExecution modeで検証する実行単位 | 1、2.2 | 高位テストケース |
| Execution mode | Checkの実行手段。PLAYWRIGHT／API／COMPUTER_USE／MANUAL | 2.2 | — |
| Exploration mode | 実装前に対象を観測するかどうかと、その手段 | 6.0 | 探索的テスト（チャーター＝探索目的） |
| テスト条件 | 品質リスクから導く「何を確認するか」。Parent Caseの表で管理する | 1.3 | テスト条件 |
| 分類 | Checkが扱うシナリオの種別。正常系／準正常系／異常系 | 1.3 | main／extension／exception scenario |
| 技法 | テスト条件からカバレッジアイテムを導く方法 | 1.3 | テスト技法 |
| カバレッジアイテム | 技法を適用して選んだ代表値・状態・経路 | 1.3 | カバレッジアイテム |
| spec | Checkを実装したPlaywrightテスト | 2.3、8 | テストプロシージャー |
| Tier | 実行頻度・重要度の階層。SMOKE／REGRESSION／EXTENDED | 3 | — |
| Status | Checkの信頼度の状態。DRAFT→EVALUATING→ACTIVE⇄QUARANTINE→RETIRED | 4 | — |
| Qualification | ACTIVEへ昇格するための規定回数のclean pass | 4.1 | — |
| 再Qualification | spec・手順・期待値・環境が変わったときの再昇格 | 4.2 | 確認テスト／回帰テスト |
| QUARANTINE | 結果を信頼できないCheckの一時隔離 | 4.3 | — |
| 探索サマリ | 探索で観測した事実の記録。期待値ではない | 6.0 | テストセッションの記録 |
| レビュー済みの期待値 | 人間のレビューを経て確定した期待結果 | 6 | テストオラクル |
| ヒール | 失敗の分類と、テスト資産の劣化に限った修復 | 6.1 | — |
| 実行契約 | Checkの実行条件。既定は9章、Docには逸脱だけを書く | 9 | — |
| 既定契約・省略規則 | Docに書かない項目が採用する共通の既定 | 9 | — |
| Run ID | 探索・ヒールの1回の実行を識別するID | 6.0 | — |

### 1.3 テスト条件・分類・技法

Parent Caseは、品質リスクから導いた**テスト条件**を`## 2. 品質リスクとテスト条件`の
表で管理し、各条件をどこで担保するかを示す。Checkは、そのうち担当する条件を
カバレッジアイテム（選んだ代表値・状態・経路）として実現する。

| テスト条件 | 分類 | 技法 | 担当 |
|---|---|---|---|
| 確認する内容を1行で | 正常系／準正常系／異常系 | 下記の語彙から1つ | Check ID、`下位レベル（unit／INT）`、または`対象外` |

**分類**は、Check一覧の「分類」列に次の3値だけを使う（`npm run check`が検証する）。
分岐の原因で判断し、期待動作の有無では判断しない。

| 分類 | 定義 | 例 |
|---|---|---|
| 正常系 | 仕様の基本フロー（main scenario）。有効な入力と前提が揃い、期待どおり完了する | 正しい資格情報でログインできる |
| 準正常系 | 利用者の入力や状態に起因する想定内の分岐（extension scenario）。無効パーティション、権限なし、検索0件、重複など | 誤ったパスワードでエラーが表示される |
| 異常系 | 前提条件が崩れる、または外部要因（API 5xx、ネットワーク断、タイムアウト）で処理を継続できない状況（exception scenario）。データ非破壊、エラー表示、再試行導線などの安全側の挙動を確認する | 認証APIが5xxを返してもフォーム入力が失われない |

- 準正常系・異常系でも、期待動作はレビュー済みの期待値として確定する。仕様が
  沈黙している挙動は期待値を発明せず、「対象外・未確定」に残す
- 同じシナリオを別のExecution modeで実行するCheck間で分類は一致させる。分類の
  見直しはStatusの変更を伴わない

**技法**は次の語彙から選ぶ（機械検証はしない。JSTQB／ISTQBの訳語に合わせる）。

| 技法 | 使いどころ |
|---|---|
| 同値分割法 | 入力・状態を有効／無効のクラスに分け、クラスごとに代表値を1つ選ぶ |
| 境界値分析 | クラスの境界とその両隣の値を選ぶ |
| デシジョンテーブルテスト | 複数条件の組み合わせで結果が決まる業務ルール |
| 状態遷移テスト | 状態と遷移イベントを持つ機能（ワークフロー、ステータス） |
| シナリオベースドテスト | ユースケースのmain／extension／exceptionの各フローを1本ずつ辿る |
| 組み合わせテスト | パラメータの組み合わせが多い場合にペアワイズ等で絞る |
| エラー推測 | 過去の欠陥や経験から失敗しやすい操作を狙う |
| 探索的テスト | 仕様が不明確な領域を探索目的（チャーター）に沿って観測する |
| チェックリストベースドテスト | 定型の確認項目を人が順に確認する（主にMN Check） |

**レベル分担**（テストピラミッド）:

- E2Eは同値クラスごとに代表値を1つ選ぶ。境界値やデシジョンテーブルの網羅は
  unit／INTへ委ね、テスト条件表の担当を`下位レベル（unit／INT）`とする
- 異常系は原則INT（API）以下で持つ。E2Eで持つのは、UIの安全側の挙動そのものが
  品質リスクである場合に限る
- 外部依存の模擬（`page.route`等）は、SUTの境界の外（第三者API、network）だけに
  使い、SUT自身のendpointを差し替えない。模擬はテスト設計として導入し、実行契約の
  「外部依存の模擬」に宣言する（Doc改訂＋期待値レビュー）。ヒールが修復手段として
  導入することは6.1の禁止11で禁止されている
- 同じCheckで複数の代表値を確認する場合は、1つの`test()`の中で`test.step`ごとに
  分ける（Check IDに対応するテストは1件。No.2の整合チェック）。同じ分類・同じ経路で、
  先行する値の失敗が後続の判断を無効にしない場合に限る。分類が異なる値は別Checkにする

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
  直接実行では`@quarantine`の除外が適用されない。例外として、QUARANTINE中の
  Checkの診断・再現に限り、6.1の修復フローに従った対象限定の直接実行を
  許可する（通常実行の代替にはしない）。

### 2.4 Areaレジストリ

Areaの登録値は [areas.json](areas.json) を正本とする。新しいAreaコードは、対象領域を
示す`name`と任意の`note`を追加してから使用する。generatorとcheckerは同じファイルを
読み取るため、READMEとの二重管理は行わない。

追加例:

```json
{
  "AUTH": {
    "name": "認証・ログイン・セッション",
    "note": ""
  }
}
```

## 3. Tier（実行階層）

| Tier | 目的 | 実行タイミングの目安 |
|---|---|---|
| SMOKE | サービスの最重要フローが生きていることの確認 | デプロイ直後、毎実行 |
| REGRESSION | 主要機能の回帰確認 | 日次または PR マージ時 |
| EXTENDED | 網羅性重視の低頻度確認（VRT全画面、周辺系など） | 週次またはリリース前 |

Playwrightでは`{ tag: '@smoke' }`オプション（公式推奨の方式）でTierを表現し、
`--grep @smoke`で選別する。タグはtest単位で付与し、`test.describe`単位の
一括付与は使わない（整合チェッカーの検出対象外のため）。
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
- QUARANTINEへはACTIVEからだけでなくEVALUATINGからも変更できる（評価・修復中に
  結果を信頼できない理由が確定した場合。理由と証跡の記録は同様に必須）。
- Test Design DocのCheck一覧のStatus列と、各Checkの「Test Status判定根拠」は
  同時に更新し、常に一致させる。
- Docとspecの整合（Status・Tier・分類値の妥当性、Statusの2箇所一致、
  `@quarantine`／`@smoke`タグ、実装の有無、命名規則）は`npm run check`で
  機械的に検証できる。Statusの変更やspecの
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
  `--grep`（単一のCheck IDとの完全一致）と`--project`をそれぞれ1回だけ必須とする。
  repeat、retry、workersもaliasと重複指定を含めて1回だけ許可し、scriptの規定値から
  変更した場合はテスト開始前に失敗する。これらとPlaywrightの`test` subcommand以外の
  CLI引数はQualificationで使用できない。
  Qualificationの妥当性は、Design Docに記録した実行コマンド、
  3 passed / 3 runsの結果、対象revision、およびレビューで確認する。
- 誤入力、課金、副作用、外部サービス制限などにより3回実行自体が品質リスクを
  増やすCheckは、**オーナーが実行前に1回への短縮を承認した場合だけ**、次の
  owner-approved Qualificationを使用できる。

  ```bash
  E2E_QUALIFY_OWNER_APPROVAL_REF=<承認記録の識別子> \
    npm run test:qualify:owner-approved -- \
    --grep "<Check ID>" --project=<Project>
  ```

  `test:qualify:owner-approved`は1回実行・retry 0・workers 1を固定し、
  `E2E_QUALIFY_OWNER_APPROVAL_REF`が未設定、不正、またはplaceholderの場合は
  テスト開始前に失敗する。承認記録の識別子、承認者、承認日、短縮理由、承認回数、
  実行コマンド、1 passed / 1 runの結果を対象Checkの「Test Status判定根拠」へ
  記録する。承認は対象Checkだけに有効で、他のCheckや再Qualificationへ継承しない。
- clean passの定義: 規定回数のすべてがpassedであり、retry、skip、fixme、
  expected failure、flaky、interruptedを1件も含まない
- **一次証跡はDesign Docの「Test Status判定根拠」表のテキスト記録**とする。
  実行コマンド、Check IDとProject、結果、対象revision（commit等。未管理なら
  その旨）、対象origin、Playwrightとbrowserのversion、タイムゾーン付き
  実行日時を記録する
- HTMLレポートは`qualification-reports/<実行日時>_<Check ID>/`へ保存され、
  実行ごとに別フォルダとなり上書きされない。Git管理外のローカル限定の
  補助資料（消失しうる）として扱い、閲覧は
  `npx playwright show-report qualification-reports/<dir>`で行う。
  Status判定と一次証跡の記録が完了するまでは削除せず、完了後は継続調査に
  不要であることを管理者が確認して手動削除してよい
- Qualification scriptはPOSIX形式の環境変数設定を使うため、macOS／Linuxを
  前提とする（Windowsでは`cross-env`等が必要）

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
- Checkの操作、assertion、実行結果へ影響するPlaywright設定、Project、
  browser／toolのmajor version
- 対象環境（origin、主要データ、権限構成）

Qualification profile、引数guard、reporter、report保存先など、Checkの操作、
assertion、実行結果に影響しない運用設定だけの変更は、既存ACTIVE Checkの
実行証跡を無効化しないため、再Qualificationの対象外とする。これらの運用実装は
対応する自動testとrepository checkで検証する。

### 4.3 QUARANTINEの実行除外と復帰

**PW／API Check:**

- CheckをQUARANTINEへ変更したら、対応するテストに`{ tag: '@quarantine' }`
  オプションでタグを付与する。skip、fixme、コメントアウトは使わない。
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
- CU Checkの操作は座標ではなく、利用者が識別できる画面要素と操作結果で記述する。
  座標依存操作が不可避な場合だけ、使用理由、解像度、表示倍率、ウィンドウ位置、
  基準画像またはアンカー要素、操作後の観測可能な完了条件を記録する。
- 認証情報をterminal、ログ、Test Design Docへ直接出力しない。AIが入力する場合は、
  値をRead／cat／echoせず、`.env`の環境変数から入力先へ直接渡す。
- 認証情報を含み得る失敗時のtrace、screenshot等は、本番以外の許可済み検証環境で
  テスト専用アカウントを使うテストに限定する。Git管理外の実行環境内だけに保存し、
  外部へ共有しない。調査完了後に不要であることを管理者が確認し、手動で削除する。

## 6. 運用フロー

Doc作成は `test-design`、探索は `explore` workflowで実行できる。ホスト別の
明示起動方法は [AGENTS.md](../AGENTS.md) を参照する。機能の理解度に応じて
2パターンを使い分ける。
**どちらもDoc（ID採番）が先**であり、探索結果のうち設計・実装・healに必要な
内容は「探索サマリ」へ着地する。探索中の全試行や全出力は保存対象としない。

### 6.0 Test Design Docの生成

テンプレートの構成は次のとおり。

```text
skills/test-design/assets/templates/
├── test-design-doc-template.md
└── checks/
    ├── pw-check-template.md
    ├── api-check-template.md
    ├── cu-check-template.md
    └── mn-check-template.md
```

- `test-design-doc-template.md`: メタデータ、Check一覧、目的、品質リスクとテスト条件、関連仕様の共通部
- `checks/*.md`: modeごとの完全なCheck構造。別のCheckテンプレートを参照して補完しない。
  節構成と、Docに書かない項目が採用する既定契約は9章
- `scripts/create-test-design.mjs`: Check一覧、Check ID、章番号、探索サマリ初期値を構成する

直接コピーする代わりに、次の生成コマンドを使用する。

```bash
npm run create:test-design -- \
  --parent-id E2E-DEMO-002 \
  --title "検索結果を確認する" \
  --slug search-results \
  --check PW:SMOKE:正常系:PLAYWRIGHT_CLI
```

`--check`は`<MODE>:<TIER>:<分類>:<EXPLORATION_MODE>`形式で複数指定できる。分類は
1.3の3値（正常系／準正常系／異常系）から選ぶ。同じMODEを複数指定した場合は`-01`、
`-02`の順に採番する。Exploration modeを`NONE`にする場合は、理由を推測で生成しない
よう、第5要素以降へ具体的理由を指定する（理由に`:`を含めてもよい）。`理由`、`TBD`、`TODO`、`未記入`、`未定`、
`なし`は具体的理由として扱わない。

```bash
--check API:REGRESSION:正常系:NONE:契約仕様だけで期待結果を確定できるため
```

生成先は命名規則から自動決定され、Parent CaseごとにMarkdownを1ファイルだけ作る。
同じParent Case IDの既存Docがある場合は、slugが異なっても生成を拒否する。生成後、
`test-design` workflowがケース固有の本文を記入し、`npm run check`で構造と整合性を
検証する。生成中に異常終了した場合は、次回実行がGit管理外の内部transactionから
完成済み内容だけを原子的に公開する。利用者や管理者によるlock管理は不要である。

Exploration modeはCheck modeごとに次の値だけを使用する。

| Check mode | Exploration mode | 意味 |
|---|---|---|
| PW | `NONE` / `PLAYWRIGHT_CLI` | 探索不要、またはPlaywright CLIによるbrowser探索 |
| API | `NONE` / `API_INTEGRATION` | 探索不要、またはAPI／サービス層の統合挙動の直接探索 |
| CU | `NONE` / `COMPUTER_USE` | 探索不要、またはComputer Useによる画面探索 |
| MN | `NONE` / `MANUAL` | 探索不要、または人による確認 |

`API_INTEGRATION`は、API／サービス層のrequest、response、認証、永続状態、副作用、
外部サービス連携を直接探索するmodeとする。使用したAPIクライアントやtoolはmode名へ
含めず、探索サマリの「Run / 観測環境」へ記録する。

各Checkの探索サマリは次の6項目を持つ。

| 項目 | 役割 |
|---|---|
| Exploration mode | Check一覧と同じmode |
| Run / 観測環境 | Run ID、tool/version、browser/app/actor、session、観測日時（下記のlabel形式） |
| 観測サマリ | 経路、状態遷移、動的値、外部依存、失敗しやすい操作 |
| 実装候補（レビュー対象） | Locator、完了条件、データ準備等の未確定候補 |
| 観測上の疑問・要判断 | 意図確認や仕様判断が必要な内容 |
| Artifacts | なし、または必要最小限のRun IDと相対path |

- `NONE`: Run / 観測環境と観測サマリは`なし（探索不要）`、その他は`なし`とする。
  探索不要の具体的な理由は「探索目的」だけに記録する
- 未探索のDRAFT: Run / 観測環境は`未実施`、観測サマリ・実装候補・疑問は
  `未記入（探索後に本記入）`、Artifactsは`なし`とする
- 探索直後: 実装候補と疑問を記録できるが、正式な設計・期待値とは扱わない
- レビュー準備完了: 実装候補は`反映済み（反映先）`または`なし`、疑問は`なし`とする

完了した非`NONE`探索のRun / 観測環境は、次のlabelを`; `区切りで記録する。
`Run ID`、`Tool / version`、`Browser / app`、`Actor`、`Session`、`Observed at`。
browserやsessionを使用しないmodeでもlabelは省略せず、`対象外（理由）`と記録する。

```text
Run ID: 20260815-101530-123_E2E-DEMO-001-PW-01_a1b2c3d4; Tool / version: playwright-cli 0.1.17; Browser / app: Chromium / target app; Actor: AI; Session: explore-20260815-101530-123_e2e-demo-001-pw-01_a1b2c3d4; Observed at: 2026-08-15T10:15:30+09:00
```

探索後は、候補をCheck modeに応じてシナリオ、Assertion設計、前提・データ、
実行契約、操作手順、判定基準等へ反映する。反映しない候補は除去し、疑問を
解消してからDoc全体と期待値を人間がレビューし、その後に実装へ進む。

探索は全Checkの必須工程ではない。仕様や既存契約から期待結果と実装条件を確定できる
場合は`NONE`を選び、具体的な探索不要理由を記録して探索工程を省略する。非`NONE`を
選んだCheckはDRAFT中の未実施を許可するが、EVALUATINGへ進める前に探索を完了し、
Runと観測結果を探索サマリへ記録する。

**パターン1: 機能・仕様がわかっている場合**

1. Doc作成（目的・シナリオ・期待値案まで記入。根拠のない期待値は書かない）
2. 必要な場合だけ、探索で到達経路・Locator候補・待機条件を確認し、探索サマリを記録する
3. 探索した場合は、観測を踏まえ実装候補を正式な設計項目へ反映し、疑問を解消する
4. 期待値レビュー（人間）: Doc全体と仕様の突合。根拠欄に仕様・Issue等を記録する
5. 実装しStatusをEVALUATINGへ → Qualification → ACTIVE

**パターン2: 機能がわからない場合**

1. Doc骨格作成（ID採番＋機能名＋探索目的のみ。DRAFT中はslug変更可、IDは不変）
2. 探索し、探索サマリを記録する
3. 観測をもとにDocを本記入し、実装候補を正式な設計項目へ反映する
4. 期待値レビュー（人間）: **観測された挙動が意図された挙動かを確認する**。
   観測をそのまま期待値にすると、バグまで仕様として固定されるため、
   このパターンではレビューの重要度が上がる。根拠欄に「観測＋意図確認」の旨を
   記録する
5. 実装しStatusをEVALUATINGへ → Qualification → ACTIVE

**探索と補助証跡の保存先・削除規約**

- 探索・healで生成した補助証跡は `.playwright/artifacts/<Run ID>/` へ保存する
  （Git管理外）。`exploration.md`を作成した場合もこのフォルダへ保存するが、作成は
  必須ではない。目的のない補助証跡や秘密情報を含む補助証跡は生成しない
- 探索Run IDは `YYYYMMDD-HHmmss-SSS_<Check ID>_<8文字の英数字suffix>` 形式とし、
  sessionにも同じRun IDを使用する。時刻だけに依存せず、同じCheckの再実行・並行探索で
  Artifactフォルダとsessionが衝突しないようにする。例外として、ヒール（6.1）の
  証跡退避は複数Checkを一括で扱うため `YYYYMMDD-HHmm_heal` 形式
  （同名がある場合は連番を付す）を使う
- DocのArtifacts欄にはRun IDと必要最小限の相対pathだけを記録する
- 探索結果は「探索サマリ」節にのみ書き、期待値欄には書かない
- 一次記録はDocのTest Status判定根拠、レビュー済み期待値、Status、原因・対処の
  テキスト記録とする。探索Artifact、healで退避した元失敗証跡、Qualificationレポートは
  Git管理外のローカル補助証跡（消失しうる）として扱い、実在をDocの有効条件にしない
- workflowは補助証跡を自動削除しない。探索ArtifactはDoc反映と人間レビュー、healの
  補助証跡は分類・処置・Status決定・必要な再Qualification・完了報告、Qualification
  レポートは一次記録とStatus判定が完了するまで削除しない。完了後は、継続調査に
  不要であることを管理者が確認し、Run IDまたはQualificationレポートのフォルダ単位で
  手動削除してよい。一律の保存期限は設けない

完成例として、`test-designs/e2e/demo/E2E-DEMO-001-docs-navigation.md` と
対応する `e2e/demo/E2E-DEMO-001.spec.ts`（PW Check）、
`test-designs/int/demo/INT-DEMO-001-docs-availability.md` と
`e2e/demo/INT-DEMO-001.spec.ts`（API Check）を参照できる。

### 6.1 失敗時の修復フロー（ヒール）

テスト失敗の調査と修復は
[heal skill](../skills/heal/SKILL.md) で行う。
ヒールは実行時の自己修復ではなく**保守時のワークフロー**であり、次の順で進む。

1. 失敗の収集（直近実行の全失敗）と証跡確保。activeなheal中は元の失敗記録と
   補助証跡を上書き・削除しない（再現実行の前に既存の実行成果物を退避する）
2. 根本原因クラスタへのグループ化と、証跡ベースの分類
3. ルーティング: ヒールが修正してよいのは**Locator・待機条件・テストデータ準備**
   の3領域のみ。プロダクト不具合の疑いは修復せず報告（QUARANTINE化を提案）、
   仕様変更・シナリオ誤りは本章パターン1の2〜5を準用したDoc改訂＋
   人間レビューへ、3領域外のテスト実装の不具合は実装修正＋人間レビュー→
   再Qualificationへ、環境障害はテストを変更せず報告する。
   判別不能はプロダクトバグ扱い（安全側）
4. ヒールは必要なら同じ明示起動内でPW Checkを再観測し、証跡と分類を再評価して
   **Proposal**を提示する。公開`explore` workflowの追加起動は不要。対象scopeが
   変わっていれば再評価して新しいProposalを提示し、以前のProposalは適用しない。
   対象scope外の並行変更は提案へ混ぜない。
   **適用はProposal IDを指定した明示起動後のみ**
5. 適用したCheckのうちACTIVEだったものはEVALUATINGへ戻し（4.2）、Check単位で
   4.1のQualificationを再実施してACTIVEへ復帰する。QUARANTINE中だったものは
   Status・`@quarantine`タグを維持したまま再Qualificationし、成功後にタグ除去と
   ACTIVE復帰を同時に行う（4.3）

API Checkの修復は、観測を要しないテストデータ不備のみを対象とする
（`explore` はAPI Checkを対象外とするため。APIの再観測手順を定義した時点で
対象を拡張する）。

**ヒールの禁止変更リスト（ルールの正）**

ヒールは分類によらず次の変更を行わない。

1. `expect`・期待値の削除・緩和・現状動作への追認
2. Docの「レビュー済みの期待値」「Assertion設計」「シナリオ」「対象外・未確定」
   「前提・データ」節、共通部のテスト条件表、Check一覧の分類列の変更
   （必要な場合は該当フローへ案内して停止する）
3. `skip`・`fixme`・コメントアウトによる無効化（隔離は`@quarantine`タグのみ）
4. タイムアウト・リトライの引き上げによる症状の隠蔽
5. 固定wait／sleepの追加
6. `force: true`、`nth()`、不安定なCSS／XPathなど実行契約の趣旨に反する
   Locatorへの置換
7. シナリオのステップ省略、別経路で最終状態だけ合わせる変更
8. プロダクト不具合をテスト変更で吸収すること
9. 一次記録の書き換え・削除、およびactiveなheal／Qualification中の補助証跡の
   上書き・削除（完了後の管理者による補助証跡の手動削除は6章の規約に従い許可する）
10. assertionを条件分岐・早期return・例外の握り潰しなどで実行されない経路へ
    置く変更、および未await化・`test.fail()`・`test.fixme()`などによる
    結果の無効化
11. 修復手段としてmock・stub・network interception・直接の状態注入を導入し、
    期待結果を作り出す変更（テスト設計としての導入はDoc改訂＋期待値レビューを
    経由する）
12. 権限・tenant・所有関係・feature flag・境界値・入力クラスなど、ケースを
    特徴づけるテストデータの意味を変える変更（データ修正は同じ意味クラスを
    保った生成・識別・cleanupの改善に限る）

## 7. スイート拡張の方針

スイートやタグを増やすときは、次の2原則に従う。

1. **軸を混ぜない。** タグ体系には役割の異なる軸があり、それぞれ表現手段が
   決まっている。
   - Tier（実行頻度・重要度）: タグ。1テストにちょうど1つ
     （`@regression`／`@extended`導入後の契約。現状は`@smoke`のみを
     タグ付けし、非SMOKEは無タグとする）
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
| `test.describe`単位のタグ付けが必要になった | チェッカーのspec自前パースをやめ、`PLAYWRIGHT_JSON_OUTPUT_NAME=<file> npx playwright test --list --reporter=json` が返す実効タグ（describe継承の解決済み。`@`なし表記、stdoutはdotenvの出力で汚れるためファイル出力を使う）の読み取りへ切り替える。静的チェックでなくなる点に留意 |

現状（`@smoke`と`@quarantine`のみ、`npm test`が事実上のregression）は
この方針に対して不足のない状態であり、上記トリガーの発生までは何も追加しない。

## 8. コード実装方針（POM・再利用機構）

specは**インライン実装を既定**とする。セマンティックLocator（role・label・
test ID）を実行契約で必須化しているため、Page Object Model（POM）が歴史的に
解決してきたセレクタ一元管理の必要性は小さい。また、インラインのspecは
Design Docとの突合（人間のレビュー）を1ファイルで完結させる。

再利用機構は、次のトリガーが実際に発生した時点で導入する。

| トリガー | 導入するもの |
|---|---|
| 2本目のspecが同じ認証・セットアップを必要とした | Playwright fixtures（ログイン済みpage等。公式がhookより推奨する再利用機構） |
| 同じ画面操作のコードが3箇所に現れた | `e2e/<area>/helpers.ts` のプレーン関数（クラス化しない） |
| 1つの画面に対するCheckが5件を超えた、またはその画面のhelperが肥大した | **その画面だけ**POMクラス化する。POMはスイート全体の方針ではなく画面単位の意思決定とし、単純な画面はインラインのままでよい |

移行の安全網: POM化・helper抽出はspec変更にあたるため、4.2の再Qualification
と`npm run check`が自動的に適用される。移行作業はAIが実施できるため、
「後からのリファクタリングは実行されない」という初日POM導入の伝統的な論拠は
この運用モデルでは成立しない。

参考: Playwright公式はPOMを「大規模スイートの構造化手法」として条件付きで
紹介しており（必須ではない）、Best Practicesの柱はuser-facing属性のLocatorと
テスト独立性である。fixturesとPOMは補完関係（fixtureでPage Objectを供給する
統合例が公式にある）。

## 9. Checkの既定契約と省略規則

Check設計の節には、ケース固有の事実と既定からの逸脱だけを書く。repository共通の
実行条件は本章に1箇所で定義し、Docへ複写しない。

### 9.1 省略規則（省略は既定を意味する）

- Check設計の節に項目を書かないことは、本章の既定をそのまま採用する宣言である。
  レビューは本章の既定を前提に行い、省略を「未検討」とは扱わない
- 既定と異なる値を採る場合だけ、該当節または実行契約の「既定からの逸脱」に
  明示する。逸脱がない場合も「既定からの逸脱: なし」は肯定的に書き、書き忘れと
  区別できるようにする
- 「忘れ」と区別がつかない項目は肯定的に書く。PW／API Checkでは実行契約の表の
  4行（Playwright Project、既定からの逸脱、外部依存の模擬、後処理）を既定どおりでも
  省略せず、CU／MN Checkでは実行契約の表の全行（証跡・記録方法と後処理を含む）を
  既定どおりでも省略しない。データを作成・
  変更するCheckの後処理は具体的に書く
- 本章は安定・最小に保つ。既定を変更した場合は、既定に依存する全ACTIVE Checkに
  ついて4.2の再Qualificationの該当有無を確認する
- 1.1の「必須項目と表の行は残す」は、本章に従う省略を未記入として扱わない

### 9.2 PW／API Checkの既定

| 項目 | 既定 | 逸脱の書き先 |
|---|---|---|
| 対象環境・前提 | `E2E_BASE_URL`のoriginが`E2E_ALLOWED_ORIGINS`に含まれる（`playwright.config.ts`が起動時に検証。5章）。更新操作の前に対象環境とoriginの一致を確認する。認証状態やデータの識別条件などの前提が不一致なら、推測で修復せず対象操作を開始する前に停止する | 前提・データ |
| Fixture・前処理 | なし。Check開始前から存在する状態に依存せず、テスト自身の準備もない | 前提・データ |
| Playwright Project | `chromium`。API Checkは`request` fixtureのみを使用しブラウザを起動しない | 実行契約 |
| Tierタグ | SMOKEは`{ tag: '@smoke' }`で付与し、非SMOKEはタグなし（7章） | なし（3章の規則） |
| QUARANTINE時 | `{ tag: '@quarantine' }`を付与し通常実行から除外する（4.3） | なし（4.3の規則） |
| 最大待機時間・ポーリング | Playwright既定値。固定時間待機を使わず、観測可能な完了条件で判定する | 実行契約「既定からの逸脱」 |
| retry・並列実行 | repository設定に従う（通常実行はretry 0、Qualificationはretry 0・workers 1）。retryやskipで期待値との不一致を隠さない（5章、6.1禁止3・4） | 実行契約「既定からの逸脱」 |
| Locator | role、label、test IDなど安定したセマンティクスを優先する | 実行契約「既定からの逸脱」 |
| Accessibility | 対象外。Locatorをrole／accessible nameで特定することによる暗黙の確認のみで、ARIA状態のassertionは行わない | Assertion設計に`##### Accessibility`を追加 |
| Visual | 対象外。VRTを行うCheckだけ対象領域、mask、安定化条件を宣言する | Assertion設計に`##### Visual`を追加 |
| 外部依存の模擬 | なし（実環境に対して実行する）。模擬する場合は1.3の範囲で、対象と方法を宣言する。模擬しない外部依存（第三者API等）を含むCheckは、観測可能な完了条件と失敗時の切り分け方法を前提・データに書く | 実行契約「外部依存の模擬」、前提・データ |
| 後処理 | PASS時はなし。FAIL時は必要最小限の証跡を保持し、原因確認前に再実行しない。データを作成・変更するCheckはPASS時の削除方法を必ず書く | 実行契約「後処理」 |
| 失敗時証跡 | PW: trace、screenshot、URL origin、実行日時、最後に成功した操作（`trace: 'retain-on-failure'`、`screenshot: 'only-on-failure'`）。API: request識別情報、response status、秘密情報を除いたresponse要約、実行日時 | 実行契約「既定からの逸脱」 |
| 昇格・維持 | 4.1に従う。1回でも失敗、skip、設定変更がある場合はEVALUATINGを維持し、原因を記録する | Test Status判定根拠 |

### 9.3 CU／MN Checkの既定

| 項目 | 既定 | 逸脱の書き先 |
|---|---|---|
| 対象環境 | 操作開始前に、表示中のURL originまたは対象環境が許可済み環境と一致することを確認し、証跡に残す（5章） | 前提・データ |
| Fixture・前処理 | なし | 前提・データ |
| 操作の記述 | 座標ではなく、利用者が識別できる画面要素と操作結果で記述する。座標依存が不可避な場合の記録条件は5章 | 操作手順 |
| 後処理 | 9.2と同じ | 実行契約「後処理」 |
| 証跡 | screenshot、記入済み結果表など、合否を再確認できる必要最小限のもの | 実行契約「証跡」「記録方法」 |
| 昇格・維持 | 4.1のCU／MN条件に従う | Test Status判定根拠 |

### 9.4 旧形式Docの移行

「分類」列導入前のDocは、`npm run check`がCheck一覧を読み取れず、期待するヘッダと
実際のヘッダを添えて報告する（一覧が読めないため、各Check節についても「Check一覧に
ありません」が付随して報告される）。移行の必須作業は次の1点だけとし、それ以外は次回の
Doc改訂時に任意で行う。

- 必須: Check一覧のCheck IDの直後に「分類」列を追加し、各行に1.3の3値を記入する
- 任意: 前提条件・テストデータ・Fixture・前処理を「前提・データ」へ統合する、
  後処理を実行契約の行へ移す、本章の既定と同じ行を削除する、共通部に
  テスト条件表を追加する

旧形式の実行契約表（Tierタグ、最大待機時間などの行）は、9.2の既定と同じ内容として
読む。9.1の「省略せず肯定的に書く」は、新テンプレートで生成または改訂したDocに
適用する。spec、操作手順、レビュー済みの期待値を変えない限り、この移行は4.2の
再Qualificationの対象外であり、判定・判定日はそのまま維持する。
