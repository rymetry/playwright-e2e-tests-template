# Third-Party Notices

本リポジトリはMIT License（ルートの [LICENSE](LICENSE)）で公開している。ただし、
以下のサードパーティ由来の部分は、それぞれの元ライセンスに従う。

## skills/playwright-cli/

- **出典**: [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) の
  `skills/playwright-cli/`
- **ライセンス**: Apache License 2.0（Copyright (c) Microsoft Corporation.）。
  全文は [skills/playwright-cli/LICENSE](skills/playwright-cli/LICENSE) に同梱
- **照合したupstream revision**: upstream main `72735e570555`
  （`skills/playwright-cli/` の最終更新commit、2026-07-09）。2026-08-08に照合し、
  下記の機能上の改変と、ライセンス表示の追加（`SKILL.md` frontmatterの
  `license` fieldと冒頭の改変告知コメント）を除き同一であることを確認済み。
  upstreamにNOTICEファイルはない
- **本リポジトリでの機能上の改変**（Apache-2.0 §4(b)の変更告知。`SKILL.md` 冒頭の注記にも記載）:
  - `SKILL.md` frontmatterの `allowed-tools` を `Bash(playwright-cli:*)` のみに限定
    （upstreamは `npx`／`npm` も許可）
  - `SKILL.md` のInstallation節を、repositoryに固定されたlocal versionの利用
    （`npx --no-install`）と、パッケージの自動インストール禁止の方針へ変更
  - `references/` 配下の9ファイルは無改変
- 本skillはMicrosoft公式版そのものではなく、**公式skillをベースにした
  本リポジトリ固有の改変版**である
