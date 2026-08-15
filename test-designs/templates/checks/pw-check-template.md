### {{SECTION_NUMBER}} {{CHECK_ID}}: Check名

#### 前提条件

テスト開始前から成立していなければならない条件を記載する。不一致の場合は
推測で修復せず、対象操作を開始する前に停止する。

- `E2E_BASE_URL`のoriginが`E2E_ALLOWED_ORIGINS`に含まれる
  （`playwright.config.ts`が起動時に検証する）
- 認証状態またはケース固有の開始状態が成立している
- 利用するアカウント、権限、データの識別条件が成立している

#### テストデータ

| 項目 | 値・生成方法 |
|---|---|
| 入力値 | なし、またはケース固有の値 |
| 動的データ | なし、または生成・識別方法 |
| 競合回避 | 対象外、または一意性を保証する方法 |

#### Fixture

| Fixture | 用途 |
|---|---|
| なし | このCheckは事前準備済みデータに依存しない |

Check開始前から存在するアカウント、認証状態、データ、ファイル、外部状態だけを
記載する。再利用が必要になった時点で共通Fixtureへ分離する。

#### 前処理

テスト自身がシナリオ実行前に行う準備を記載する。期待結果とは分離する。

- なし
- または、開始画面への移動やテストデータの準備

#### シナリオ

Given:

- 利用者が宣言済みの開始状態にいる

When:

- 利用者が対象操作を行う

Then:

- レビュー済みの期待結果を確認できる
- 必要な永続状態が再読み込み後も維持される

#### Assertion設計

##### Functional

- 操作結果
- URL、表示、保存状態
- 再読み込み後の状態

##### Accessibility

- 主要要素のroleとaccessible name
- 状態を表すARIA属性
- 対象外の場合は理由

##### Visual

- VRT対象、または対象外の理由
- mask、対象領域、安定化条件

#### 後処理

| 結果 | 後処理 |
|---|---|
| PASS | なし、または作成データを安全に削除する |
| FAIL | 必要最小限の証跡を保持し、原因確認前に再実行しない |

#### 実行契約

| 項目 | 値 |
|---|---|
| Playwright Project | `chromium`、またはプロジェクト固有の値 |
| Tierタグ | SMOKEは`{ tag: '@smoke' }`オプションで付与。非SMOKEは現状タグなし（README 7章のトリガー発生まで`@regression`等は導入しない） |
| QUARANTINE時 | `{ tag: '@quarantine' }`を付与し、通常実行から除外する |
| 最大待機時間 | Playwright既定値、またはケース固有の上限 |
| ポーリング | 対象外、または完了条件と間隔 |
| retry | 通常実行はrepository設定に従い、qualificationでは`0` |
| 並列実行 | repository設定に従う。ケース固有の制約があれば記載 |
| 失敗時証跡 | trace、screenshot、URL origin、実行日時、最後に成功した操作 |

ケース固有の制約:

- 固定時間待機を使わず、観測可能な完了条件で判定する
- retryやskipで期待値との不一致を隠さない
- 更新操作より前に対象環境とoriginの一致を確認する
- Locatorはrole、label、test IDなど安定したセマンティクスを優先する

#### 探索目的

{{EXPLORATION_PURPOSE}}

#### 探索サマリ

| 項目 | 値 |
|---|---|
| Exploration mode | `{{EXPLORATION_MODE}}` |
| Run / 観測環境 | {{EXPLORATION_RUN}} |
| 観測サマリ | {{EXPLORATION_SUMMARY}} |
| 実装候補（レビュー対象） | {{EXPLORATION_CANDIDATES}} |
| 観測上の疑問・要判断 | {{EXPLORATION_QUESTIONS}} |
| Artifacts | なし |

#### レビュー済みの期待値

| 項目 | 値 |
|---|---|
| 根拠 | 仕様、Issue、受入条件、またはレビュー記録 |
| レビュー日 | YYYY-MM-DD |
| レビュー担当 | 担当者または役割 |
| 期待値 | 正式なAssertionとして実装する内容の要約 |

#### Test Status判定根拠

| 項目 | 値 |
|---|---|
| 判定 | DRAFT |
| 判定日 | YYYY-MM-DD |
| 判定根拠 | 現在のStatusにした理由 |
| Qualification command / procedure | 未実施 |
| Qualification result | 未実施 |
| 実行条件 | 対象環境／origin、Playwrightとbrowserのversion、主要な設定 |
| 対象revision | commit SHA等。Git未管理の場合はその旨を記載 |
| 証跡 | 本表の記録を一次証跡とする。補助として`qualification-reports/`のパス、trace、Issue／PR等への参照 |

昇格条件はREADME 4.1に従う。1回でも失敗、skip、設定変更がある場合は
EVALUATINGを維持し、原因を記録する。

#### 対象外・未確定

- このCheckでは保証しない内容
- レビューまたは仕様責任者の判断を待つ内容
