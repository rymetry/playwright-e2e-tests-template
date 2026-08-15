import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

function runWriterProcess(root, input, startAt) {
  const moduleUrl = new URL('./create-test-design.mjs', import.meta.url).href;
  const script = `
    import { writeTestDesign } from ${JSON.stringify(moduleUrl)};
    const [inputJson, root, startAt] = process.argv.slice(1);
    const waitMs = Number(startAt) - Date.now();
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    try {
      process.stdout.write(writeTestDesign(JSON.parse(inputJson), root));
    } catch (error) {
      process.stderr.write(error.message);
      process.exitCode = 1;
    }
  `;

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      '--input-type=module',
      '--eval',
      script,
      JSON.stringify(input),
      root,
      String(startAt),
    ]);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
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

test('NONEの理由に既知のplaceholderを使用できない', () => {
  for (const reason of [
    '理由',
    'TBD',
    '`TBD`',
    '**TBD**',
    '_未定_',
    '[TODO](https://example.test/todo)',
    'TODO',
    '未記入',
    '未定',
    'なし',
  ]) {
    assert.throws(
      () => check(`PW:SMOKE:NONE:${reason}`),
      /具体的な探索不要理由が必要/,
    );
  }
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

test('生成先をParent Caseから決定し、同じParent Case IDの再生成を拒否する', (t) => {
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
  assert.throws(
    () => writeTestDesign(input, root),
    /Parent Case ID「E2E-AUTH-001」は既存のDesign Docで使用されています/,
  );
  assert.throws(
    () => writeTestDesign({
      ...input,
      title: '別のタイトル',
      slug: 'different-slug',
      checks: [check('API:REGRESSION:API_INTEGRATION')],
    }, root),
    /E2E-AUTH-001-login-success\.md/,
  );
  assert.equal(
    readdirSync(dirname(expected)).some((name) => name.endsWith('.create.lock')),
    false,
  );
});

test('同じParent Case IDの並行生成は1件だけ成功する', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'test-design-composer-concurrent-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const startAt = Date.now() + 750;
  const results = await Promise.all([
    runWriterProcess(root, {
      ...BASE_INPUT,
      slug: 'first',
      checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
    }, startAt),
    runWriterProcess(root, {
      ...BASE_INPUT,
      slug: 'second',
      checks: [check('API:REGRESSION:API_INTEGRATION')],
    }, startAt),
  ]);

  assert.deepEqual(results.map((result) => result.code).sort(), [0, 1]);
  const outputDirectory = join(root, 'test-designs/e2e/auth');
  const outputFiles = readdirSync(outputDirectory);
  assert.equal(outputFiles.filter((name) => name.endsWith('.md')).length, 1);
  assert.equal(outputFiles.some((name) => name.endsWith('.create.lock')), false);
});
