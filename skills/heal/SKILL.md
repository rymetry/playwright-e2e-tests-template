---
name: heal
description: 失敗したテストを証跡ベースで分類し、テスト資産の劣化（Locator・待機条件・テストデータ）に限り修正を提案、承認後に適用して再Qualificationまで行う
argument-hint: "[Check ID...] [失敗状況] | --apply <Proposal ID>"
disable-model-invocation: true
allowed-tools: Bash(git status --short --branch) Bash(git rev-parse --show-toplevel) Bash(git rev-parse HEAD) Bash(git rev-parse --abbrev-ref HEAD) Bash(git diff --no-ext-diff) Bash(git diff --no-ext-diff --cached) Bash(npm run check) Bash(npm run typecheck)
---

テスト失敗の分類と修復を実行する。ユーザーがこのskillの起動時に指定した入力を、
以下の「入力」として扱う。ホスト別の明示起動方法は `AGENTS.md` を参照する。

## Repository root（必須）

最初に `git rev-parse --show-toplevel` でGit repository rootを取得する。取得できない
場合は開始せず停止する。以後、相対pathはすべてrepository root基準で解決し、
shell commandもrepository rootをworking directoryとして実行する。

## 原則（すべての手順に優先する不変条件）

1. **分類が先、修復は後。** 分類が確定するまでspec・Docを一切変更しない。
   再観測で作るGit管理外artifactは例外だが、Doc更新はProposalへ含める
2. **修正は必ず提案 → ユーザーの明示承認 → 適用の順で行う**（自己修復をしない）。
   承認前にspec・Docを変更しない
3. 自分で修正してよいのは **(a) Locator (b) 待機条件 (c) テストデータ準備**
   の3領域のみ。期待値・Assertion設計・シナリオ・3領域外のテスト実装に触れる
   変更は行わず、該当する既存フローを案内して停止する
4. **元の失敗をPASSに書き換えない。** activeなheal中は失敗の一次記録と補助証跡を
   上書き・削除しない（再現実行の前に必ず退避する。手順1）。PASSは修正適用後の新しい
   Qualification（README 4.1）でのみ成立する
5. **ブラウザでの再観測は、heal専用のhost中立な
   [再観測手順](references/reobserve.md)をこの起動内で読み、続けて実行する。**
   公開`explore` workflowを内部起動せず、ホスト固有のskill起動構文も使わない。
   playwright-cli commandは通常のpermission確認下で実行し、healの`allowed-tools`で
   browser／network操作をpre-approveしない
6. 分類に確信が持てない場合は修復せず、観測結果を報告して人間の判断を仰ぐ。
   プロダクトバグかテスト劣化か判別できない場合は**プロダクトバグ扱い（安全側）**
   とする
7. 禁止変更はREADME 6.1「ヒールの禁止変更リスト」に従う。提案・適用の前に
   リストとの照合を自己検証し、結果を報告に含める

## 対象の特定

- **入力なしを基本形**とし、直近のテスト実行の失敗全件を対象とする。
  Check IDが渡された場合はその部分集合に限定する
- `--apply <Proposal ID>` は手順4で明示承認された提案の適用専用とする。通常modeと
  apply modeは排他的で、IDの欠落・通常入力との混在がある場合は停止する。
  通常modeへ暗黙にfallbackしない
- Proposalの照合は会話履歴だけに依存しない。別の会話でapplyする場合は、ユーザーが
  Proposal全文を入力に添えればよい。ID、対象Check、対象scope、提示diffを復元できない
  場合は記録の提示を依頼し、適用しない
- 対象はPW／API Check（コード資産を持つCheck）のみ。CU／MN Checkの失敗が
  含まれる場合は、手順の改訂はDoc改訂＋期待値レビューのフローで行う旨を
  案内し、そのCheckは対象外として報告する
- **API Checkの修復は、観測を要しないテストデータ不備のみ**を対象とする。
  それ以外のヒール対象分類は、APIの再観測手順が未定義のため（explore skillは
  API Checkを対象外とする）修復せず報告に留める
- 対応するDesign Docが存在しないspecの失敗は修復対象から除外し、報告で
  指摘する（骨格先行ルール）。StatusがDRAFT／RETIREDのCheckも除外し、
  理由とともに報告する

## Preflight

1. すべてのmodeで、現在のbranch、HEAD SHA、`git status --short --branch` を記録する。
   既存変更があることだけでは停止しない。対象CheckのDoc／specと、影響するfixture・
   helper・設定を「対象scope」として分離し、それ以外の変更は並行作業として表示し、
   提案・適用対象へ混ぜない。対象scopeと重なる、共有資産への影響を分離できない、
   または変更の出所を確認できない場合は停止してユーザー判断を求める
2. 再観測、Proposal提示、`--apply`の直前に対象scopeのdiffを確認する。branch／HEADや
   対象scope外の変更だけでは停止しない。対象scopeが変わっていれば現在の状態で分類と
   証跡を再評価し、必要なら再観測をやり直して新しいProposalを提示する。以前のProposalは
   適用しない
3. `--apply` modeでは、Proposalの対象Check、対象scope、提示diff、共有資産の影響範囲が
   現在も一致する場合だけ適用する。一致しなければ適用せず、手順2へ戻る

## 手順

### 1. 失敗の収集と証跡確保

- 直近の実行成果物（`test-results/` のtrace・screenshot・error context）から
  失敗Checkの一覧を復元する。成果物がない、または鮮度が不明な場合は
  再現実行する: `npm test`（全件）／`npm test -- --grep "<Check ID>"`（限定時）。
  `npx playwright test` の直接実行は使わない（`@quarantine`除外が外れる）。
  **QUARANTINE中のCheckの再現に限り**、`npm test`系では常に除外され実行できない
  ため、対象を限定した直接実行
  `npx playwright test --grep "<Check ID>" --project=<Project>` を診断用として
  使ってよい（通常実行の代替にはしない）
- **再現実行の前に、既存の `test-results/` を
  `.playwright/artifacts/<Run ID>/` へ退避する**（Run IDは
  `YYYYMMDD-HHmm_heal` 形式。同名ディレクトリが既にある場合は連番を付す。
  Playwrightは実行開始時に出力先をクリーンするため、退避しないと元の
  失敗証跡が失われる）
- 再現実行でpassしたCheckは「flaky疑い（原因未特定）」として分類へ引き継ぐ
- Checkごとに証跡を確保する: エラーメッセージ、trace、失敗時screenshot、
  最後に成功した操作、失敗時のURL origin、実行日時、対象revision（commit SHA）

### 2. クラスタリングと分類

- 全失敗を、根本原因が同一と推定される単位（クラスタ）へグループ化する。
  手がかり: 同一のエラー種別・失敗箇所・画面・Locator・origin、失敗の時系列
- **環境障害の短絡判定を最初に行う**: 同一originへの接続・認証など**同一の
  初期段階で同種のエラー**により失敗しているCheckを環境障害クラスタとし、
  テスト・Docを変更せず報告する。**該当しない失敗が1件でもあれば、その失敗の
  分析は継続する**（「大半が落ちているから」という理由だけで全体を停止しない）。
  環境障害と確定する際は、可能な範囲で独立した裏付け（対象環境への到達確認、
  同一originの他Checkの成否）を根拠に添える
- クラスタごとに、証跡とDocの「レビュー済みの期待値」「探索サマリ」
  「シナリオ」を突合して分類する。数値の確信度（confidence）は出力せず、
  根拠となった観測事実を列挙する。1クラスタ内で根拠が分かれた場合は
  クラスタを分割する（異なる分類を混在させない）
- 分類はDocの一次記録と現在の失敗証跡を正とし、完了済みworkflowで管理者が削除した
  過去の探索Artifact、元失敗証跡、Qualificationレポートの恒久保持を前提にしない

| 分類 | 主な手がかり | 扱い |
|---|---|---|
| プロダクト不具合 | 操作は成功しているが結果がレビュー済み期待値と不一致 | **修復禁止。** 欠陥候補として報告し、QUARANTINE化を提案して停止 |
| 仕様変更（意図された変更） | UI・挙動の変更を関連Issue・リリース情報・補足引数が示す | 修復せず停止。README 6章パターン1の2〜5を準用したDoc改訂→期待値レビュー→実装→再Qualificationを案内 |
| Locatorの陳腐化 | 同じ役割の要素は存在するがセレクタが解決しない | **ヒール対象** → 手順3へ |
| 待機条件の不備 | テストが観測可能な完了条件を待たずに先へ進んだ**因果証拠**（trace上の該当操作）がある | **ヒール対象**（観測可能な完了条件へ修正。タイムアウト延長で代替しない） |
| テストデータ不備 | 前提条件・fixtureのデータが存在しない／崩れている | **ヒール対象**（ケースの意味を保った準備・識別方法の修正） |
| テスト実装の不具合（3領域外） | assertionの配線ミス、helper・setup／teardownの誤り、Project・設定の不整合など、実装がDocと食い違う | 修復せず停止。通常の実装修正（修正→人間レビュー→再Qualification）を案内 |
| 環境障害 | 対象環境へ到達不能、認証基盤・依存サービスの障害 | テスト・Docを一切変更せず報告して停止 |
| シナリオ自体の誤り | Doc記載のシナリオ・前提が実際の仕様と食い違う | 修復せず停止。Doc改訂＋期待値レビューを案内 |
| flaky疑い（原因未特定） | timeout・再現実行で結果が揺れるが、待機条件の因果証拠がない | 修復せず、QUARANTINE化を提案して停止 |
| 判別不能 | 上記いずれとも確定できない | **プロダクトバグ扱い（安全側）**で報告して停止 |

- 「仕様変更かプロダクトバグか」を確定できない場合は両論を根拠付きで報告し、
  人間の判断を仰ぐ（勝手にどちらかへ倒さない）

### 3. 再観測と原因確定（ヒール対象クラスタのみ）

- 再観測が必要なら、対象Checkごとに[再観測手順](references/reobserve.md)を読み、
  同じheal起動内で続けて実行する。公開`explore` skillは単独探索用であり、healから
  起動・代行しない。この参照fileはskill discovery対象でもhost固有の起動入口でもない
- 再観測で得たRun ID、Tool/version、Browser、Session、Artifacts、観測日時、origin／build識別子
  （取得可能な場合）、観測事実を、元の失敗証跡と対象Checkへ照合する。
  allowlist、認証、session cleanup、証跡の鮮度に未解決事項がある場合は結果を使わず、
  Proposalへ進まない
- 複数Checkや並行するexplore／healは、Check IDと一意なsession／artifact path、対象path
  ごとに分離する。他作業の差分は表示するが、対象scopeへ混ぜない
- 観測後は現在のGit状態を再確認し、観測結果を踏まえて分類を再評価する。意味的契約が
  変わっていれば
  Locator修正へ進まず、「仕様変更」または「シナリオ誤り」へ分類し直して停止する
- テストデータ不備で観測が不要な場合はこの手順を省略できる
- API Checkはこの手順を実行できない（再観測手順はPW Check専用）。観測を要する
  API Checkの失敗は修復せず報告する（「対象の特定」参照）
- Locator修正の前提として**意味的契約**を確認する。1つでも崩れていれば
  「仕様変更」または「シナリオ誤り」へ分類し直して停止する:
  - 同じ役割の要素か（同じ業務上の操作を表すか）
  - 同じ画面・同じフロー上にあるか
  - 一意に特定できるか
  - シナリオの事前条件・事後条件が変わっていないか

### 4. 修正提案の提示と承認

- クラスタ単位の提案として次を提示し、Proposal IDを付けて停止する:
  分類、根拠（観測事実の列挙）、意味的契約の確認結果、対象Check一覧、
  修正diff、再観測で更新するDocの探索サマリdiff、禁止変更リストとの照合結果、
  再Qualificationの所要見込み、対象scopeと対象scope外の並行変更一覧。
  再観測を省略した場合は理由を記す
- 状態変化後の再評価、または再観測を行うたびに新しいProposal IDを発行する。
  再評価前の古いProposal、または別scopeのProposalを再利用しない
- **fixture・helper等の共有資産への変更が含まれる場合**、その資産を利用する
  すべてのCheck（失敗していないCheckを含む）を影響一覧として明示する。
  共有資産で結合しているクラスタは分離せず**一括承認**とする
- 複数クラスタは一覧で提示し、**クラスタごとの部分承認**を受け付ける。
  承認されなかったクラスタは何も変更せず、完了報告に記録する
- **承認は提示したdiffと対象revisionに紐づく。** 適用前に対象ファイルが
  変化していた場合は適用せず、差分を再提示して承認を取り直す。
  観測記録、Status、「Test Status判定根拠」、Qualification記録の更新は本手順書の
  規定に基づく事務的更新で、期待値の承認ではない。透明性のためexact diffを併記し、
  修正承認の対象はテスト資産（spec・fixture等）の変更とする
- ユーザーは承認するProposal IDを入力に指定してhealを明示起動する。再観測の実行は
  修正承認ではない。`--apply` modeではPreflight 3の対象scopeと提示diffを再照合し、
  対象scopeに変化があれば適用せず、現在の状態を
  再評価して新しいProposalを提示する

### 5. 適用とDoc整合（承認されたクラスタのみ）

- 修正は3領域に限定した最小diffとする。Locatorはrole・label・test ID等の
  セマンティックLocatorを優先し、待機条件は観測可能な完了条件で書く
- テストデータの修正は、権限・境界値・入力クラスなど**ケースの意味を
  保ったまま**、生成・識別・cleanupを改善する範囲に限る（意味を変える修正は
  README 6.1 禁止12）
- healが更新してよいDoc節は「Test Status判定根拠」と**Check一覧のStatus列のみ**。
  再観測を実行した場合に限り、Proposalへ含めたexact diffどおりに対象Checkの
  「探索サマリ」節とCheck一覧の**Exploration mode列**も更新してよい。承認済み修正を
  適用したら「実装候補（レビュー対象）」を`反映済み（Proposal IDと反映先）`または
  `なし`へ更新し、解消した「観測上の疑問・要判断」は`なし`とする。
  「レビュー済みの期待値」「Assertion設計」「シナリオ」は変更しない。修正により
  「テストデータ」「前処理」「Fixture」等の節と乖離が生じる場合は提案にその旨を
  含め、当該節の改訂は通常のDoc改訂フロー（人間レビュー）へ回す
- 「Test Status判定根拠」には、ヒールによる修正である旨、分類、
  元の失敗の証跡参照を記録する
- Status遷移は失敗前のStatusで分岐する:
  - **ACTIVEだったCheck**: README 4.2に従いEVALUATINGへ戻す
  - **QUARANTINE中だったCheck**: Statusと`@quarantine`タグを維持したまま
    修復・Qualificationを行い、3回clean pass後にタグ除去とACTIVE復帰を
    同時に行う（README 4.3。EVALUATINGを経由しない）

### 6. 検証と完了報告

- 修正したCheckごとに次をすべて実行する:
  - `npm run typecheck`
  - `npm run check`
  - `npm run test:qualify -- --grep "<Check ID>" --project=<Project>`
    （**Checkごとにコマンドを1回起動**する。`--repeat-each=3`により内部で
    3 runsが実行される。コマンドを3回起動しない。複数Check IDのOR結合grepで
    まとめない）
- **共有資産（fixture・helper等）を変更した場合は、その資産を利用する全Check
  （失敗していなかったCheckを含む）を再Qualification対象とする**。
  このうち失敗していなかったACTIVE Checkもspec実装の変更にあたるため、
  README 4.2に従いEVALUATINGへ戻してから再Qualificationする。
  **今回の修復と無関係な理由でQUARANTINE中のCheckは復帰処理の対象にしない**:
  共有資産の変更が及んだ事実を「Test Status判定根拠」へ記録するにとどめ、
  Status・タグを維持する（復帰はREADME 4.3の通常フローによる）。
  タグ除去とACTIVE復帰を行ってよいのは、記録済みの隔離原因が今回の
  承認済み修正で解消されたCheckのみ
- 3回clean passし、他の昇格条件（README 4.1）が既存のまま有効なら
  ACTIVEへ復帰させ、「Test Status判定根拠」へQualification記録を追記する。
  QUARANTINE中だったCheckは`@quarantine`タグ除去を同時に行い、
  `npm run check` で整合を確認する
- 失敗した場合は**起点別に停止**して報告する: ACTIVE起点のCheckは
  EVALUATINGのまま、QUARANTINE起点のCheckはStatus・タグを維持したまま
  停止する。**再修正のループは1回まで**（手順3へ戻れるのは1回。
  再修正案も承認ゲートを通す）。それでも通らない場合、ACTIVE起点は
  QUARANTINE提案とともにエスカレーションし（EVALUATINGからのQUARANTINE化は
  README 4章の注記に従い、理由と証跡を記録する）、QUARANTINE起点は
  隔離を維持したまま調査結果を報告する

## QUARANTINE化（ユーザー承認後のみ実施）

specへの `{ tag: '@quarantine' }` 付与、Check一覧のStatus更新、
「Test Status判定根拠」への理由と証跡の記録、`npm run check` での整合確認を
1セットで行う（skip・fixme・コメントアウトは使わない）。

## 完了報告（すべての終了経路で必須）

1. **全失敗の処置マトリクス**: 失敗Check × クラスタ × 分類 × 処置（修復済み／
   承認待ち／報告のみ／対象外）。すべての失敗がいずれかの処置に漏れなく
   対応していることを示す（サイレントな取りこぼしを作らない）
2. クラスタごとの分類と根拠（観測事実の列挙）
3. 変更の有無とdiffの要約（変更なしのクラスタは「変更なし」と明示）
4. CheckごとのStatus遷移とDoc更新箇所
5. 人間に判断してほしい点（プロダクトバグ疑いの内容、仕様変更の確認先、
   QUARANTINE提案の採否など）
6. 元の失敗の証跡参照（退避先を含む。activeなheal中に消していないことの明示）

## 禁止事項

- README 6.1「ヒールの禁止変更リスト」に挙げるすべての変更
- ユーザー承認前のspec・Doc変更
- [再観測手順](references/reobserve.md)の範囲外でplaywright-cliを直接操作すること
- 退避せずに再現実行して元の証跡を失わせること
- 一次記録の上書き・削除、およびactiveなheal／Qualification中の補助証跡の
  上書き・削除。完了後の管理者による補助証跡の手動削除はREADME 6章に従い許可する
