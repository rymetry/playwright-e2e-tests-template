### {{SECTION_NUMBER}} {{CHECK_ID}}: Check名

#### 前提条件

- `E2E_BASE_URL`のoriginが`E2E_ALLOWED_ORIGINS`に含まれる
  （`playwright.config.ts`が起動時に検証する）
- 認証状態またはケース固有の開始状態が成立している
- 対象endpoint、認証方式、依存する外部サービスを特定している
- 秘密情報の値をDoc、ログ、Artifactへ記録しない

#### テストデータ

| 項目 | 値・生成方法 |
|---|---|
| request | method、path、header、bodyのケース固有値 |
| 動的データ | なし、または生成・識別方法 |
| 競合回避 | 対象外、または一意性を保証する方法 |

#### Fixture

| Fixture | 用途 |
|---|---|
| なし | このCheckは事前準備済みデータに依存しない |

Check開始前から存在する認証状態、データ、ファイル、外部状態だけを記載する。

#### 前処理

- なし
- または、request前のテストデータ・認証状態の準備

#### シナリオ

Given:

- 対象APIの宣言済み開始状態が成立している

When:

- 対象endpointへrequestを送信する

Then:

- レビュー済みのresponse契約を満たす
- 必要な永続状態、副作用、外部サービス連携を確認できる

#### Assertion設計

##### Functional

- HTTP status、response schema、header、エラー形式
- 永続状態、イベント、通知などの副作用
- 認証・認可の結果
- 外部サービス連携の観測可能な結果

##### Accessibility

- 対象外（API Checkのため）

##### Visual

- 対象外（API Checkのため）

#### 後処理

| 結果 | 後処理 |
|---|---|
| PASS | なし、または作成データを安全に削除する |
| FAIL | responseと副作用の必要最小限の証跡を保持し、原因確認前に再実行しない |

#### 実行契約

| 項目 | 値 |
|---|---|
| Playwright Project / API client | `api`等のブラウザ非依存Project、または使用するAPIクライアント設定 |
| Tierタグ | SMOKEは`{ tag: '@smoke' }`オプションで付与。非SMOKEは現状タグなし（README 7章のトリガー発生まで`@regression`等は導入しない） |
| QUARANTINE時 | `{ tag: '@quarantine' }`を付与し、通常実行から除外する |
| 最大待機時間 | Playwright既定値、またはケース固有の上限 |
| ポーリング | 対象外、または完了条件と間隔 |
| retry | 通常実行はrepository設定に従い、qualificationでは`0` |
| 並列実行 | repository設定に従う。ケース固有の制約があれば記載 |
| 失敗時証跡 | request識別情報、response status、秘密情報を除いたresponse要約、実行日時 |

対象endpointと役割分担:

- 対象endpoint、認証方式（秘密情報は書かない）、依存する外部サービス
- PW Checkとの役割分担。同じ保証を二重に持たない

ケース固有の制約:

- 更新操作より前に対象環境とoriginの一致を確認する
- retryやskipで期待値との不一致を隠さない
- 外部依存を含む場合は、観測可能な完了条件と失敗時の切り分け方法を記載する

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
| 期待値 | 正式なAssertionとして実装するresponse・副作用の要約 |

#### Test Status判定根拠

| 項目 | 値 |
|---|---|
| 判定 | DRAFT |
| 判定日 | YYYY-MM-DD |
| 判定根拠 | 現在のStatusにした理由 |
| Qualification command / procedure | 未実施 |
| Qualification result | 未実施 |
| 実行条件 | 対象環境／origin、APIクライアントと主要な設定 |
| 対象revision | commit SHA等。Git未管理の場合はその旨を記載 |
| 証跡 | 本表の記録を一次証跡とする。補助として`qualification-reports/`のパス、response要約、Issue／PR等への参照 |

昇格条件はREADME 4.1に従う。1回でも失敗、skip、設定変更がある場合は
EVALUATINGを維持し、原因を記録する。

#### 対象外・未確定

- このCheckでは保証しない内容
- レビューまたは仕様責任者の判断を待つ内容
