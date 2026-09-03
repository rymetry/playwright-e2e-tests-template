### {{SECTION_NUMBER}} {{CHECK_ID}}: Check名

#### 前提・データ

- 開始状態: 認証状態、またはケース固有の開始状態
- 入力値と意味クラス: なし、または値と属する同値クラス（有効／無効、境界、権限など）
- 動的データ・競合回避: なし、または生成・識別・一意性の保証方法
- Fixture・前処理（該当時のみ）: 事前準備済みのデータ・状態、またはテスト自身が行う準備

#### シナリオ

カバレッジアイテム: テスト条件表の「条件」を、代表値「値」で確認する（選んだ理由）。

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

#### 実行契約

| 項目 | 値 |
|---|---|
| Playwright Project | `chromium` |
| 既定からの逸脱 | なし |
| 外部依存の模擬 | なし |
| 後処理 | 既定どおり（データを作成・変更するCheckは具体的に書く） |

#### 対象外・未確定

- このCheckでは保証しない内容
- 下位レベル（unit／INT）で担保する項目
- レビューまたは仕様責任者の判断を待つ内容

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
