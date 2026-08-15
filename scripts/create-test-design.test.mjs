import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
  parentId: 'E2E-DEMO-002',
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

function pendingTransactionPath(root) {
  return join(
    root,
    '.playwright/test-design-transactions/E2E-DEMO-002.json',
  );
}

function markdownHash(markdown) {
  return createHash('sha256').update(markdown, 'utf8').digest('hex');
}

function writePendingTransaction(root, { slug, markdown, token = 'recovery-token' }) {
  const transactionPath = pendingTransactionPath(root);
  mkdirSync(dirname(transactionPath), { recursive: true });
  writeFileSync(transactionPath, JSON.stringify({
    version: 1,
    parentId: BASE_INPUT.parentId,
    outputFile: `${BASE_INPUT.parentId}-${slug}.md`,
    markdown,
    markdownHash: markdownHash(markdown),
    token,
    createdAt: '2026-08-15T00:00:00.000Z',
  }));
  return transactionPath;
}

function assertGeneratedDocIsStructurallyValid(markdown, expectedChecks) {
  const doc = parseDesignDocContent('/tmp/E2E-DEMO-002-login-success.md', markdown);
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

  assert.match(markdown, /^# E2E-DEMO-002 ログイン成功/m);
  assert.match(markdown, /E2E-DEMO-002-PW-01/);
  assert.match(markdown, /### 3\.1 E2E-DEMO-002-PW-01/);
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
    assert.match(markdown, new RegExp(`### 3\\.${index + 1} E2E-DEMO-002-${mode}-01`));
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

  assert.match(markdown, /E2E-DEMO-002-PW-01/);
  assert.match(markdown, /E2E-DEMO-002-PW-02/);
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
    '<strong>TBD</strong>',
    '_未定_',
    '[TODO](https://example.test/todo)',
    '[TBD](https://example.test/path_(v1))',
    '[TBD][pending]',
    '[TBD](https://example.test/path_(v1_(draft)))',
    '&nbsp;TBD&nbsp;',
    '&emsp;TBD&emsp;',
    'T&#8203;BD',
    '<span title="1 > 0">TBD</span>',
    'T<!-- -->BD',
    'TODO',
    'TODO later',
    '探索理由はTBDです',
    'TODO（探索後に記入）',
    '未記入',
    '未定',
    '未定です',
    'なし',
  ]) {
    assert.throws(
      () => check(`PW:SMOKE:NONE:${reason}`),
      /具体的な探索不要理由が必要/,
    );
  }

  assert.doesNotThrow(
    () => check('PW:SMOKE:NONE:TODO リスト画面は仕様上の対象外であるため'),
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

test('AreaレジストリにないParent Case IDを拒否する', () => {
  assert.throws(
    () => composeTestDesign({
      ...BASE_INPUT,
      parentId: 'E2E-AUTH-001',
      checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
    }),
    /Area「AUTH」はtest-designs\/areas\.jsonのAreaレジストリに登録されていません/,
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
    'test-designs/e2e/demo/E2E-DEMO-002-login-success.md',
  );
  assert.equal(outputPathFor(input, root), expected);
  assert.equal(writeTestDesign(input, root), expected);
  assert.match(readFileSync(expected, 'utf8'), /E2E-DEMO-002-PW-01/);
  assert.throws(
    () => writeTestDesign(input, root),
    /Parent Case ID「E2E-DEMO-002」は既存のDesign Docで使用されています/,
  );
  assert.throws(
    () => writeTestDesign({
      ...input,
      title: '別のタイトル',
      slug: 'different-slug',
      checks: [check('API:REGRESSION:API_INTEGRATION')],
    }, root),
    /E2E-DEMO-002-login-success\.md/,
  );
  assert.equal(
    readdirSync(dirname(pendingTransactionPath(root))).some((name) => name.endsWith('.json')),
    false,
  );
});

test('同じParent Case IDの複数並行生成は1件だけ成功する', async (t) => {
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
    runWriterProcess(root, {
      ...BASE_INPUT,
      slug: 'third',
      checks: [check('CU:EXTENDED:COMPUTER_USE')],
    }, startAt),
    runWriterProcess(root, {
      ...BASE_INPUT,
      slug: 'fourth',
      checks: [check('MN:REGRESSION:MANUAL')],
    }, startAt),
  ]);

  assert.deepEqual(results.map((result) => result.code).sort(), [0, 1, 1, 1]);
  const outputDirectory = join(root, 'test-designs/e2e/demo');
  const outputFiles = readdirSync(outputDirectory);
  assert.equal(outputFiles.filter((name) => name.endsWith('.md')).length, 1);
  assert.equal(
    readdirSync(dirname(pendingTransactionPath(root))).some((name) => name.endsWith('.json')),
    false,
  );
});

test('異常終了後の保留中生成をPIDや期限に依存せず完了する', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'test-design-composer-recovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const recoveredInput = {
    ...BASE_INPUT,
    slug: 'recovered',
    checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
  };
  const recoveredMarkdown = composeTestDesign(recoveredInput);
  const token = 'recovery-token';
  const transactionPath = writePendingTransaction(root, {
    slug: recoveredInput.slug,
    markdown: recoveredMarkdown,
    token,
  });
  const transactionDir = dirname(transactionPath);
  // stage完成後・final公開前、およびtransaction record公開前の異常終了を再現する。
  writeFileSync(
    join(transactionDir, `${BASE_INPUT.parentId}.${token}.previous-attempt.md.tmp`),
    recoveredMarkdown,
  );
  writeFileSync(
    join(transactionDir, `${BASE_INPUT.parentId}.orphan-token.json.tmp`),
    '{"partial":',
  );

  assert.throws(
    () => writeTestDesign({
      ...BASE_INPUT,
      slug: 'new-request',
      checks: [check('API:REGRESSION:API_INTEGRATION')],
    }, root),
    /E2E-DEMO-002-recovered\.md/,
  );
  const recoveredPath = join(
    root,
    'test-designs/e2e/demo/E2E-DEMO-002-recovered.md',
  );
  assert.equal(readFileSync(recoveredPath, 'utf8'), recoveredMarkdown);
  assert.throws(() => readFileSync(transactionPath, 'utf8'), /ENOENT/);
  assert.deepEqual(readdirSync(transactionDir), []);
});

test('破損したtransactionから空のDocを公開しない', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'test-design-composer-corrupt-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const transactionPath = pendingTransactionPath(root);
  mkdirSync(dirname(transactionPath), { recursive: true });
  writeFileSync(transactionPath, JSON.stringify({
    version: 1,
    parentId: BASE_INPUT.parentId,
    outputFile: `${BASE_INPUT.parentId}-corrupt.md`,
    markdown: '',
    markdownHash: markdownHash(''),
    token: 'corrupt-token',
    createdAt: '2026-08-15T00:00:00.000Z',
  }));

  assert.throws(
    () => writeTestDesign({
      ...BASE_INPUT,
      checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
    }, root),
    /保留中生成記録が不正です/,
  );
  assert.deepEqual(readdirSync(join(root, 'test-designs/e2e/demo')), []);
  assert.equal(readFileSync(transactionPath, 'utf8').includes('corrupt-token'), true);
});

test('final公開後に異常終了したtransactionを完了扱いで回収する', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'test-design-composer-linked-recovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const recoveredInput = {
    ...BASE_INPUT,
    slug: 'already-linked',
    checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
  };
  const recoveredMarkdown = composeTestDesign(recoveredInput);
  const token = 'already-linked-token';
  const transactionPath = writePendingTransaction(root, {
    slug: recoveredInput.slug,
    markdown: recoveredMarkdown,
    token,
  });
  const outputPath = join(
    root,
    'test-designs/e2e/demo/E2E-DEMO-002-already-linked.md',
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, recoveredMarkdown);
  writeFileSync(
    join(
      dirname(transactionPath),
      `${BASE_INPUT.parentId}.${token}.linked-before-cleanup.md.tmp`,
    ),
    recoveredMarkdown,
  );

  assert.throws(
    () => writeTestDesign({
      ...BASE_INPUT,
      slug: 'new-request',
      checks: [check('API:REGRESSION:API_INTEGRATION')],
    }, root),
    /E2E-DEMO-002-already-linked\.md/,
  );
  assert.equal(readFileSync(outputPath, 'utf8'), recoveredMarkdown);
  assert.deepEqual(readdirSync(dirname(transactionPath)), []);
});

test('pending削除後に残った一時ファイルを既存Doc判定時に回収する', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'test-design-composer-orphan-cleanup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = {
    ...BASE_INPUT,
    slug: 'existing',
    checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
  };
  const outputPath = join(
    root,
    'test-designs/e2e/demo/E2E-DEMO-002-existing.md',
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, composeTestDesign(input));
  const transactionDirectory = dirname(pendingTransactionPath(root));
  mkdirSync(transactionDirectory, { recursive: true });
  writeFileSync(
    join(transactionDirectory, `${BASE_INPUT.parentId}.orphan.json.tmp`),
    '{"partial":',
  );
  writeFileSync(
    join(transactionDirectory, `${BASE_INPUT.parentId}.orphan.md.tmp`),
    'partial markdown',
  );

  assert.throws(
    () => writeTestDesign({ ...input, slug: 'retry' }, root),
    /E2E-DEMO-002-existing\.md/,
  );
  assert.deepEqual(readdirSync(transactionDirectory), []);
});

test('保留中生成を複数プロセスが同時回復してもDocは1件だけ公開する', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'test-design-composer-recovery-race-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const recoveredInput = {
    ...BASE_INPUT,
    slug: 'recovered',
    checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
  };
  const recoveredMarkdown = composeTestDesign(recoveredInput);
  writePendingTransaction(root, {
    slug: recoveredInput.slug,
    markdown: recoveredMarkdown,
  });
  const startAt = Date.now() + 750;

  const results = await Promise.all([
    runWriterProcess(root, {
      ...BASE_INPUT,
      slug: 'first-retry',
      checks: [check('API:REGRESSION:API_INTEGRATION')],
    }, startAt),
    runWriterProcess(root, {
      ...BASE_INPUT,
      slug: 'second-retry',
      checks: [check('CU:EXTENDED:COMPUTER_USE')],
    }, startAt),
  ]);

  assert.deepEqual(results.map((result) => result.code), [1, 1]);
  const outputDirectory = join(root, 'test-designs/e2e/demo');
  assert.deepEqual(readdirSync(outputDirectory), ['E2E-DEMO-002-recovered.md']);
  assert.equal(
    readFileSync(join(outputDirectory, 'E2E-DEMO-002-recovered.md'), 'utf8'),
    recoveredMarkdown,
  );
  assert.deepEqual(readdirSync(dirname(pendingTransactionPath(root))), []);
});

test('最終Docは完成済み内容だけを公開しtransaction一時ファイルを残さない', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'test-design-composer-atomic-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = {
    ...BASE_INPUT,
    checks: [check('PW:SMOKE:PLAYWRIGHT_CLI')],
  };
  const expectedMarkdown = composeTestDesign(input);

  const outputPath = writeTestDesign(input, root);
  assert.equal(readFileSync(outputPath, 'utf8'), expectedMarkdown);
  assert.deepEqual(readdirSync(dirname(pendingTransactionPath(root))), []);
});
