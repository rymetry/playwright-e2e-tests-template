---
name: explore
description: playwright-cli skillで対象のPW Checkを探索し、必要な結果をTest Design Docの「探索サマリ」へ記録する
argument-hint: "<Check ID> [探索対象の補足]"
disable-model-invocation: true
---

Test Design Docに基づく探索を実行する。ユーザーがこのskillの起動時に指定した
入力を、以下の「入力」として扱う。ホスト別の明示起動方法は `AGENTS.md` を
参照する。

## Repository root（必須）

最初に `git rev-parse --show-toplevel` でGit repository rootを取得する。取得できない
場合は開始せず停止する。以後、相対pathはすべてrepository root基準で解決し、
shell commandもrepository rootをworking directoryとして実行する。

## 対象の特定

- 入力は**PW CheckのCheck IDを原則とする**。Docパスが渡された場合、そのDocの
  PW Checkが1件だけならそれを対象とし、複数あれば一覧を提示して選択を求め、
  選択されるまで探索を開始しない
- 対象のDocが存在しない場合は開始せず、AREA・概要・`--skeleton`を入力として
  `test-design` workflowをユーザーが明示起動するよう案内して停止する
  （骨格先行ルール。ホスト別の起動方法は `AGENTS.md` を参照する）
- API／CU／MN Checkが指定された場合は、このコマンドの対象外である旨と代替
  （APIはAPIクライアントによる探索、CUはCOMPUTER_USE探索、MNは人間による確認）
  を報告して停止する
- 対象Docの「探索目的」を読み、探索のスコープとする。空の場合はユーザーに
  確認して記入してから開始する
- 探索には playwright-cli skill を使用する（Skillを起動してから操作する）
- このrepositoryでは、playwright-cli skillの
  `references/test-generation.md` にある汎用plan／generate／heal workflowは
  使用しない。Test Design Docを起点とする本skillと `test-designs/README.md` の
  安全規則を優先する
- 以下の安全規則を変更し、healの再観測にも影響する場合は
  `../heal/references/reobserve.md` にも反映する

## Preflight（探索開始前・必須）

1. `.env` の `E2E_BASE_URL` と `E2E_ALLOWED_ORIGINS` を確認し、探索対象の
   originがallowlistに含まれることを確認する。いずれかが未設定、または対象
   originがallowlistにない場合は探索を開始せず、設定をユーザーに依頼する
2. 対象が本番環境でないことを確認する。確認できない場合は探索を開始しない
3. 認証の扱い（次節）を確定してから開始する

## 認証

- **テスト専用アカウント（認証情報が`.env`の環境変数にあり、2FAなし）**:
  AIがログイン操作を実行してよい。ただし次を厳守する。
  1. 存在確認は値を出力しない方法で行う:
     `grep -q "^E2E_TEST_USER_PASSWORD=" .env && echo set || echo unset`
  2. 入力は**1回のシェル呼び出し内で`.env`を読み込み、必ず`--raw`付き**で行う
     （`--raw`なしの通常出力は、入力値を生成コードとしてterminalへ再掲する。
     実測確認済み）:
     `set -a && source .env && set +a && playwright-cli -s=<session> --raw fill <ref> "$E2E_TEST_USER_PASSWORD" --submit`
  3. **認証情報が入力された状態の画面でsnapshot・screenshotを取らない**
     （snapshotは入力欄の値を表示する。実測確認済み）。取得はログイン送信後、
     フォームを離れてから行う
  4. `.env`の値の行をRead・cat・echoしない。値をDoc・報告・ログへ書かない
- **2FA・SSO・実ユーザーアカウント、または認証情報が未設定の場合**:
  認証済みstorage stateの準備をユーザーに依頼し、探索開始時に
  `playwright-cli -s=<session> state-load <path>` で読み込む。
  AIが認証情報を入力・取得することは禁止
- storage stateを保存する場合はGit管理外のパス（`playwright/.auth/`等）に置く

## 探索の手順

1. 専用sessionを使う: `playwright-cli -s=explore-<check-id小文字> open <URL>`。
   **以後のすべてのplaywright-cliコマンドに同じ`-s=`を付ける**
2. **originの再確認**: open直後、redirect・navigationが起きるたび、および
   データを変更する操作の直前に、現在のURL origin（コマンド出力のPage URL、
   または`eval "location.origin"`）がallowlist内であることを確認する。
   allowlist外へ遷移していた場合は、以後の操作を行わずsessionを閉じて停止する
3. 読み取り優先で探索する。データの作成・更新・削除は、探索目的に明記され、
   かつ**専用のテストデータとして一意に識別できる対象に限る**。既存・共有
   データの変更、対象を一意に特定できない場合、後処理の見込みが立たない
   場合はmutationを行わず停止して報告する。作成したデータは終了時に削除する
4. 観測する内容:
   - 通常の利用経路、URL originと状態遷移
   - `snapshot`／`find`／`eval` によるrole・accessible name・test ID
     （安定Locator候補）
   - loading・polling・animationなどの待機条件（観測可能な完了条件を特定する。
     固定waitで代替しない）
   - networkは`requests`の**method・origin・path・statusのみ**を記録する。
     headers・body・cookie・storageの取得（`request <n>`・`cookie-get`・
     `localstorage-get`等）は行わない。query文字列の値は記録前に除去する。
     `console`は秘密情報を含まないと確認できる範囲でのみ記録する
   - 失敗しやすい操作、動的な値
5. 探索で生成した補助証跡（screenshot等）は
   `.playwright/artifacts/<Run ID>/` へ保存する。`exploration.md`を作成した場合も
   同じフォルダへ保存するが、作成は必須ではない。目的のない補助証跡や秘密情報を
   含む補助証跡は生成しない。Run IDは `YYYYMMDD-HHmm_<Check ID>` 形式。
   このディレクトリはGit管理外で、workflowは削除しない
6. 対象がPlaywright CLIで十分に観測できない場合（Canvas描画、OS UI、
   ブラウザ拡張機能等）は、無理に続けず、観測できた範囲とCOMPUTER_USE探索が
   必要である旨を報告して終了する
7. 正常終了・停止・エラーの**すべての終了経路**で
   `playwright-cli -s=<session> close` を実行する

## 記録のルール（最重要）

- Docへの書き込みは次の**2箇所のみ**とする（唯一の例外は「対象の特定」で
  定めた開始前の探索目的の記入。ユーザーに確認した内容に限る）。
  1. 対象Checkの「**探索サマリ**」節。表の行名はテンプレートと完全一致させる
     （`Exploration mode`／`Run / 観測環境`／`観測サマリ`／
     `実装候補（レビュー対象）`／`観測上の疑問・要判断`／`Artifacts`）。
     Run / 観測環境にはRun ID、`playwright-cli --version`等の実測値、Browser／対象app／
     実行actor、秘密情報を含まないSession、タイムゾーン付き観測日時を記録する
  2. Check一覧の対象Check行の**Exploration mode列**（実際に使用した値へ更新）
- 「レビュー済みの期待値」「Assertion設計」「シナリオ」「対象外・未確定」を
  含む上記以外の節には書き込まない。観測は事実であり、期待値ではない
- 観測サマリには設計・実装・healに必要な事実だけを書く。全試行、全Locator候補、
  全network／console出力は保存しない
- Locator、完了条件、データ準備等は「実装候補（レビュー対象）」へ書き、
  正式な設計や採用済みの内容として扱わない。観測した挙動の意図や仕様上の疑問は
  「観測上の疑問・要判断」と完了報告の両方へ記載する。期待値案は発明しない
- Artifacts欄にはRun IDと必要最小限の相対pathだけを記録する

## 禁止事項

- 本番originへのアクセス、allowlist外originでの操作継続
- 固定wait／sleepを待機手段として記録すること
- 座標依存の操作記録（COMPUTER_USEで不可避な場合の条件はテンプレート3.3を参照）
- 生成コード・Locatorの無審査でのテストコード転記
- 秘密情報をterminal・画面キャプチャ・ログ・Docへ出力・記録すること

## 完了報告

次を必ず含める。

1. 観測のサマリとDocの更新箇所
2. 人間に判断してほしい点（観測した挙動を期待値としてよいか、疑わしい挙動は
   ないか）
3. 次工程の明示: パターン1（仕様起点）では「観測を踏まえたDocの修正」、
   パターン2（探索起点）では「Docの本記入」。いずれも、その後に期待値レビューへ
   進む。実装候補を正式な設計項目へ反映し、反映しない候補を除去し、疑問を
   解消した時点で、実装候補を`反映済み（反映先）`または`なし`、疑問を`なし`へ
   更新する
