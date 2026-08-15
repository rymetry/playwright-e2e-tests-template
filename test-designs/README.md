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
  直接実行では`@quarantine`の除外が適用されない。例外として、QUARANTINE中の
  Checkの診断・再現に限り、6.1の修復フローに従った対象限定の直接実行を
  許可する（通常実行の代替にはしない）。

### 2.4 Areaレジストリ

新しいAreaコードはここに登録してから使用する。

| Area | 対象領域 | 備考 |
|---|---|---|
| DEMO | サンプル（playwright.devを対象にした完成例） | 実プロジェクトでは削除可 |

記入例（**未登録**。使用するには上の表へ正式な行として追加する）:
`| AUTH | 認証・ログイン・セッション | |`

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
- Docとspecの整合（Status・Tier値の妥当性、Statusの2箇所一致、
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
  Status判定と一次証跡の記録が完了するまでは削除せず、完了後は継続調査に
  不要であることを管理者が確認して手動削除してよい
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
- 認証情報をterminal、artifact、Test Design Docへ出力しない。

## 6. 運用フロー

Doc作成は `test-design`、探索は `explore` workflowで実行できる。ホスト別の
明示起動方法は [AGENTS.md](../AGENTS.md) を参照する。機能の理解度に応じて
2パターンを使い分ける。
**どちらもDoc（ID採番）が先**であり、探索結果のうち設計・実装・healに必要な
内容は「探索サマリ」へ着地する。探索中の全試行や全出力は保存対象としない。

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
| Run / 観測環境 | Run ID、tool/version、browser/app/actor、session、観測日時 |
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

探索後は、候補をCheck modeに応じてシナリオ、Assertion設計、テストデータ、Fixture、
前処理、実行契約、操作手順、判定基準等へ反映する。反映しない候補は除去し、疑問を
解消してからDoc全体と期待値を人間がレビューし、その後に実装へ進む。

**パターン1: 機能・仕様がわかっている場合**

1. Doc作成（目的・シナリオ・期待値案まで記入。根拠のない期待値は書かない）
2. 探索で到達経路・Locator候補・待機条件を確認し、探索サマリを記録する
3. 観測を踏まえ実装候補を正式な設計項目へ反映し、疑問を解消する
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
- Run IDは `YYYYMMDD-HHmm_<Check ID>` 形式。例外として、ヒール（6.1）の
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
   節の変更（必要な場合は該当フローへ案内して停止する）
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
