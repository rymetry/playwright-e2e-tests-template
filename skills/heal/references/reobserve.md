# heal再観測手順

このfileはhealが必要時に読む非公開の参照手順であり、skill discovery対象でも
ユーザー向けの起動入口でもない。公開`explore` workflowを呼ばず、現在のheal起動内で
playwright-cli commandを直接実行する。browser／network操作は通常のpermission確認に従う。
本手順は公開`skills/explore/SKILL.md`のうち再観測にも適用する安全規則の要約である。
公開exploreの該当規則を変更した場合は、このfileにも反映する。

## 開始条件

- 対象はPW Checkだけ。Check ID、Test Design Doc、元の失敗証跡、Docの「探索目的」を
  確認する。探索目的が空または曖昧ならユーザーに確認し、healの会話内で続行する
- Git repository rootを取得し、以後のpathとcommandをそこへanchorする
- `.env`の`E2E_BASE_URL`と`E2E_ALLOWED_ORIGINS`を確認する。対象originがallowlist外、
  未設定、または本番環境でないと確認できない場合はbrowserを開かず停止する
- 認証情報の値をRead／cat／echoせず、terminal・画面・artifact・Docへ出力しない

## 認証

- `.env`にある2FAなしのテスト専用アカウントだけ、環境変数を1回のshell呼び出し内で
  展開し、`playwright-cli --raw fill`へ直接渡してよい。値の存在確認も値を出力しない
- 認証情報を入力した画面ではsnapshot／screenshotを取得しない。ログイン送信後、
  フォームを離れてから取得する
- 2FA、SSO、実ユーザー、または認証情報未設定では、Git管理外の認証済みstorage stateを
  ユーザーに準備してもらう。認証情報を取得・入力しない

## 再観測

1. Run IDを`YYYYMMDD-HHmmss-SSS_<Check ID>_<8文字の英数字一意suffix>`形式で生成し、
   `heal-<Run ID小文字>`を一意なsession名として対象URLを開く。以後すべて同じsessionを
   使い、並行するexplore／healとsession名やartifact pathを共有しない
2. open直後、redirect／navigation後、データ変更前に現在のoriginを確認する。
   allowlist外へ移ったら操作せずsessionを閉じる
3. 元の失敗を再現する最小経路だけを観測する。snapshot／find／evalでrole、accessible
   name、test ID、状態遷移、観測可能な完了条件を確認する。固定waitは使わない
4. データの作成・更新・削除は探索目的に必要で、一意なテストデータとして識別でき、
   cleanup可能な場合だけ行う。既存・共有データや対象不明なデータは変更しない
5. networkはmethod／origin／path／statusだけを記録する。headers、body、cookie、storage、
   query値、秘密を取得・記録しない
6. 再観測で生成したartifactはGit管理外の`.playwright/artifacts/<Run ID>/`へ保存し、
   activeなheal中は削除しない。目的のないartifactや秘密情報を含むartifactは生成しない。
   すべての正常終了、停止、error経路でsessionをcloseし、作成したテストデータをcleanupする

## healへ返す観測記録

`Run ID`、`Tool / version`、`Browser / app`、`Actor`、`Session`、`Observed at`を
`; `区切りのlabel形式で返す。加えてArtifacts、origin／build識別子（取得可能な場合）、
再現経路、Locator候補、完了条件、失敗原因に関係する観測事実を返す。
再観測中はspecやTest Design Docへ書き込まない。healは観測事実と修正案を再評価し、
「探索サマリ」節とExploration mode列の更新diffをProposalへ含める。探索サマリでは
再現経路と原因に関係する事実を「観測サマリ」、Locator・完了条件・データ準備の案を
「実装候補（レビュー対象）」、未解決の意図確認を「観測上の疑問・要判断」へ分ける。
承認・適用後は実装候補を`反映済み（Proposal IDと反映先）`または`なし`へ更新する。
レビュー済みの期待値、Assertion設計、シナリオ、対象外・未確定は変更しない。
