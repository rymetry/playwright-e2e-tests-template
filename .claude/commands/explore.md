---
description: playwright-cli skillで対象機能を探索し、結果をTest Design Docの「探索で確認した事実」へ記録する
argument-hint: <Check ID または Docパス> [探索対象の補足]
---

Test Design Docに基づく探索を実行する。引数: $ARGUMENTS

## 前提

- 対象のTest Design Docが存在すること（骨格先行ルール）。引数のCheck IDまたは
  パスからDocを特定できない場合は探索を開始せず、先に
  `/test-design <AREA> <概要> --skeleton` の実行を案内して停止する。
- 探索には playwright-cli skill を使用する（Skillを起動してから操作する）。
- 対象Docの「探索目的」を読み、探索のスコープとする。探索目的が空の場合は
  ユーザーに確認して記入してから開始する。

## Preflight（探索開始前・必須）

1. `.env` の `E2E_BASE_URL` と `E2E_ALLOWED_ORIGINS` を確認し、対象originが
   allowlistに含まれることを確認する
2. 対象が本番環境でないことを確認する。確認できない場合は探索を開始しない

## 探索の手順

1. 専用sessionを使う: `playwright-cli -s=explore-<check-id小文字> open <URL>`
   （session名に秘密情報を含めない）
2. 読み取り優先で探索する。データの作成・更新・削除は、探索目的に明記されて
   いる場合のみ行い、後処理まで実施する
3. 観測する内容（Docの「探索で確認した事実」の項目に対応）:
   - 通常の利用経路、URL originと状態遷移
   - `snapshot`／`find`／`eval` によるrole・accessible name・test ID
     （安定Locator候補）
   - loading・polling・animationなどの待機条件（観測可能な完了条件を特定する。
     固定waitで代替しない）
   - 必要な範囲の `console`／`requests` の事実
   - 失敗しやすい操作、動的な値
4. 生成物（screenshot等）は必要最小限とし、
   `.playwright/artifacts/<Run ID>/` へ保存する。
   Run IDは `YYYYMMDD-HHmm_<Check ID>` 形式。このディレクトリはGit管理外
5. 終了時に `playwright-cli close` でsessionを閉じる

## 記録のルール（最重要）

- 結果は対象Checkの「**探索で確認した事実**」節に**のみ**書き込む。
  表（Exploration mode／Tool・version／Browser／Session／Artifacts／観測日時TZ）
  と観測事実の箇条書きを埋める
- **「レビュー済みの期待値」「Assertion設計」「シナリオ」には書き込まない。**
  観測は事実であり、期待値ではない。期待値にしてよいかは人間が判断する
- 期待値の候補や疑問点は「対象外・未確定」節、または完了報告に記載して
  人間の判断を仰ぐ
- Artifacts欄にはRun IDと必要最小限の相対pathだけを記録する

## 禁止事項

- 本番originへのアクセス
- 固定wait／sleepを待機手段として記録すること
- 座標依存の操作記録（COMPUTER_USEで不可避な場合の条件はテンプレート3.3を参照）
- 生成コード・Locatorの無審査でのテストコード転記
- 秘密情報を画面キャプチャ・ログ・Docに残すこと

## 完了報告

観測のサマリ、Docの更新箇所、人間に判断してほしい点（観測した挙動を期待値と
してよいか、疑わしい挙動はないか）を提示する。
