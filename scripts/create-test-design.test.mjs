import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  composeTestDesign,
  outputPathFor,
  parseCheckArgument,
  writeTestDesign,
} from './create-test-design.mjs';
import {
  parseDesignDocContent,
  validateExplorationSummary,
} from './check-consistency.mjs';

const BASE_INPUT = {
  parentId: 'E2E-AUTH-001',
  title: 'ログイン成功',
  slug: 'login-success',
};

function check(value) {
  return parseCheckArgument(value);
}

function assertGeneratedDocIsStructurallyValid(markdown, expectedChecks) {
  const doc = parseDesignDocContent('/tmp/E2E-AUTH-001-login-success.md', markdown);
  assert.equal(doc.parentCaseId, BASE_INPUT.parentId);
  assert.equal(doc.checks.length, expectedChecks);
  for (const generatedCheck of doc.checks) {
    assert.deepEqual(validateExplorationSummary(generatedCheck), []);
  }
}

test('PW Checkだけを含む1つのTest Design Docを生成する', () => {
  const markdown = composeTestDesign({
    ...BASE_INPUT,
    checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
  });

  assert.match(markdown, /^# E2E-AUTH-001 ログイン成功/m);
  assert.match(markdown, /E2E-AUTH-001-PW-01/);
  assert.match(markdown, /### 3\.1 E2E-AUTH-001-PW-01/);
  assert.doesNotMatch(markdown, /{{[A-Z0-9_]+}}/);
  assertGeneratedDocIsStructurallyValid(markdown, 1);
});

test('4 modeを順番どおり1ファイルへ構成しAPI Checkを完全展開する', () => {
  const markdown = composeTestDesign({
    ...BASE_INPUT,
    checks: [
      check('PW:SMOKE:PLAYWRIGHT_CLI'),
      check('API:REGRESSION:API_INTEGRATION'),
      check('CU:EXTENDED:COMPUTER_USE'),
      check('MN:REGRESSION:MANUAL'),
    ],
  });

  for (const [index, mode] of ['PW', 'API', 'CU', 'MN'].entries()) {
    assert.match(markdown, new RegExp(`### 3\\.${index + 1} E2E-AUTH-001-${mode}-01`));
  }
  assert.match(markdown, /Playwright Project \/ API client/);
  assert.match(markdown, /HTTP status、response schema、header、エラー形式/);
  assertGeneratedDocIsStructurallyValid(markdown, 4);
});

test('各modeのCheckテンプレートが単独で必要な設計節を持つ', () => {
  const cases = [
    ['PW:REGRESSION:PLAYWRIGHT_CLI', [
      '#### シナリオ',
      '#### Assertion設計',
      '#### 実行契約',
    ]],
    ['API:REGRESSION:API_INTEGRATION', [
      '#### シナリオ',
      '#### Assertion設計',
      '対象endpointと役割分担:',
    ]],
    ['CU:REGRESSION:COMPUTER_USE', [
      '#### 自動化できない理由',
      '#### 操作手順',
      '#### 判定基準',
    ]],
    ['MN:REGRESSION:MANUAL', [
      '#### 手動で実行する理由',
      '#### 操作手順',
      '#### 判定基準',
    ]],
  ];
  const commonHeadings = [
    '#### 前提条件',
    '#### テストデータ',
    '#### Fixture',
    '#### 前処理',
    '#### 後処理',
    '#### 探索目的',
    '#### 探索サマリ',
    '#### レビュー済みの期待値',
    '#### Test Status判定根拠',
    '#### 対象外・未確定',
  ];

  for (const [checkArgument, modeHeadings] of cases) {
    const markdown = composeTestDesign({
      ...BASE_INPUT,
      checks: [check(checkArgument)],
    });
    for (const heading of [...commonHeadings, ...modeHeadings]) {
      assert.ok(markdown.includes(heading), `${checkArgument}: ${heading}`);
    }
    assert.doesNotMatch(markdown, /同じ構造|読み替え/);
  }
});

test('同じmodeを複数指定するとCheck IDを連番で採番する', () => {
  const markdown = composeTestDesign({
    ...BASE_INPUT,
    checks: [
      check('PW:SMOKE:PLAYWRIGHT_CLI'),
      check('PW:REGRESSION:PLAYWRIGHT_CLI'),
    ],
  });

  assert.match(markdown, /E2E-AUTH-001-PW-01/);
  assert.match(markdown, /E2E-AUTH-001-PW-02/);
  assertGeneratedDocIsStructurallyValid(markdown, 2);
});

test('NONEは理由を探索目的へ入れ、探索サマリを固定値にする', () => {
  const markdown = composeTestDesign({
    ...BASE_INPUT,
    checks: [check('API:REGRESSION:NONE:契約仕様だけで期待結果を確定できるため')],
  });

  assert.match(markdown, /対象外（契約仕様だけで期待結果を確定できるため）/);
  assert.match(markdown, /\| Run \/ 観測環境 \| なし（探索不要） \|/);
  assertGeneratedDocIsStructurallyValid(markdown, 1);
});

test('NONEの理由欠落とmode別の不正なExploration modeを拒否する', () => {
  assert.throws(
    () => check('PW:SMOKE:NONE'),
    /具体的な探索不要理由が必要/,
  );
  assert.throws(
    () => check('API:REGRESSION:PLAYWRIGHT_CLI'),
    /Check mode=APIでは使用できません/,
  );
});

test('構造を壊すtemplate token形式の入力を拒否する', () => {
  assert.throws(
    () => composeTestDesign({
      ...BASE_INPUT,
      title: '{{CHECK_SECTIONS}}',
      checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
    }),
    /template token形式/,
  );
  assert.throws(
    () => check('API:REGRESSION:NONE:{{EXPLORATION_RUN}}'),
    /template token形式/,
  );
});

test('生成先をParent Caseから決定し、既存ファイルを上書きしない', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'test-design-composer-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = {
    ...BASE_INPUT,
    checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
  };

  const expected = join(
    root,
    'test-designs/e2e/auth/E2E-AUTH-001-login-success.md',
  );
  assert.equal(outputPathFor(input, root), expected);
  assert.equal(writeTestDesign(input, root), expected);
  assert.match(readFileSync(expected, 'utf8'), /E2E-AUTH-001-PW-01/);
  assert.throws(() => writeTestDesign(input, root), /既存ファイルは上書きしません/);
});
