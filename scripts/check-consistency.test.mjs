import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findDuplicateParentCaseIds,
  findOrphanCheckSectionIds,
  parseDesignDocContent,
  validateExplorationSummary,
} from './check-consistency.mjs';

const FILE_PATH = '/tmp/E2E-TST-001-exploration-summary.md';
const FIELD_NAMES = [
  'Exploration mode',
  'Run / 観測環境',
  '観測サマリ',
  '実装候補（レビュー対象）',
  '観測上の疑問・要判断',
  'Artifacts',
];

function defaultSummary(explorationMode, status) {
  if (explorationMode === 'NONE') {
    return {
      'Exploration mode': '`NONE`',
      'Run / 観測環境': 'なし（探索不要）',
      観測サマリ: 'なし（探索不要）',
      '実装候補（レビュー対象）': 'なし',
      '観測上の疑問・要判断': 'なし',
      Artifacts: 'なし',
    };
  }

  if (status === 'DRAFT') {
    return {
      'Exploration mode': `\`${explorationMode}\``,
      'Run / 観測環境': '未実施',
      観測サマリ: '未記入（探索後に本記入）',
      '実装候補（レビュー対象）': '未記入（探索後に本記入）',
      '観測上の疑問・要判断': '未記入（探索後に本記入）',
      Artifacts: 'なし',
    };
  }

  return {
    'Exploration mode': `\`${explorationMode}\``,
    'Run / 観測環境': 'run-001 / playwright-cli 1.0 / Chromium / test actor / 2026-08-15T10:00:00+09:00',
    観測サマリ: '一覧から詳細へ遷移し、保存後に完了表示となる',
    '実装候補（レビュー対象）': '反映済み（Steps / Expected Results）',
    '観測上の疑問・要判断': 'なし',
    Artifacts: 'なし',
  };
}

function buildSummaryRows(values, { omit = [], duplicate = [] } = {}) {
  const rows = FIELD_NAMES
    .filter((field) => !omit.includes(field))
    .map((field) => `| ${field} | ${values[field]} |`);
  for (const field of duplicate) {
    rows.push(`| ${field} | ${values[field]} |`);
  }
  return rows.join('\n');
}

function buildCheck({
  id,
  checkMode,
  explorationMode,
  status = 'DRAFT',
  purpose,
  summary = {},
  summaryOptions,
  extraSummary = false,
}) {
  const values = { ...defaultSummary(explorationMode, status), ...summary };
  const resolvedPurpose = purpose ?? (
    explorationMode === 'NONE'
      ? '対象外（静的な仕様と既存契約から期待結果を確定できるため）'
      : '動的な状態遷移と安定した完了条件を確認する'
  );
  const summaryBlock = buildSummaryRows(values, summaryOptions);
  const duplicateBlock = extraSummary
    ? `\n\n#### 探索サマリ\n\n| 項目 | 値 |\n|---|---|\n${summaryBlock}`
    : '';

  return {
    row: `| ${id} | ${checkMode} | ${explorationMode} | REGRESSION | ${status} | 未実装 |`,
    section: `### 3.1 ${id}: テスト対象\n\n#### 探索目的\n\n${resolvedPurpose}\n\n#### 探索サマリ\n\n| 項目 | 値 |\n|---|---|\n${summaryBlock}${duplicateBlock}\n\n#### Test Status判定根拠\n\n| 項目 | 値 |\n|---|---|\n| 判定 | ${status} |`,
  };
}

function buildDoc(checks) {
  return `# Test Design Doc\n\n| 項目 | 値 |\n|---|---|\n| Parent Case ID | E2E-TST-001 |\n\n## 2. Check一覧\n\n| Check ID | Execution mode | Exploration mode | Tier | Status | Code |\n|---|---|---|---|---|---|\n${checks.map((check) => check.row).join('\n')}\n\n## 3. Check詳細\n\n${checks.map((check) => check.section).join('\n\n')}`;
}

function parseChecks(checks) {
  return parseDesignDocContent(FILE_PATH, buildDoc(checks)).checks;
}

function assertValid(checkConfig) {
  const [check] = parseChecks([buildCheck(checkConfig)]);
  assert.deepEqual(validateExplorationSummary(check), []);
}

test('有効な探索サマリを受け入れる', async (t) => {
  const cases = [
    {
      name: 'NONE',
      config: {
        id: 'E2E-TST-001-PW-01',
        checkMode: 'PW',
        explorationMode: 'NONE',
        status: 'ACTIVE',
      },
    },
    {
      name: '未探索PW skeleton',
      config: {
        id: 'E2E-TST-001-PW-01',
        checkMode: 'PW',
        explorationMode: 'PLAYWRIGHT_CLI',
      },
    },
    {
      name: '探索直後のDRAFT',
      config: {
        id: 'E2E-TST-001-PW-01',
        checkMode: 'PW',
        explorationMode: 'PLAYWRIGHT_CLI',
        summary: {
          'Run / 観測環境': 'run-draft / playwright-cli / Chromium / test actor / 2026-08-15',
          観測サマリ: '保存後に非同期で完了表示となる',
          '実装候補（レビュー対象）': 'role=button と完了通知を候補とする',
          '観測上の疑問・要判断': '完了通知の文言が仕様か要確認',
        },
      },
    },
    {
      name: 'レビュー準備済みEVALUATING',
      config: {
        id: 'E2E-TST-001-PW-01',
        checkMode: 'PW',
        explorationMode: 'PLAYWRIGHT_CLI',
        status: 'EVALUATING',
      },
    },
    {
      name: 'レビュー準備済みACTIVE',
      config: {
        id: 'E2E-TST-001-PW-01',
        checkMode: 'PW',
        explorationMode: 'PLAYWRIGHT_CLI',
        status: 'ACTIVE',
      },
    },
    ...[
      ['API', 'API_INTEGRATION'],
      ['CU', 'COMPUTER_USE'],
      ['MN', 'MANUAL'],
    ].map(([checkMode, explorationMode]) => ({
      name: explorationMode,
      config: {
        id: `E2E-TST-001-${checkMode}-01`,
        checkMode,
        explorationMode,
        status: 'ACTIVE',
      },
    })),
  ];

  for (const { name, config } of cases) {
    await t.test(name, () => assertValid(config));
  }
});

test('旧API mode値を拒否する', async (t) => {
  const oldModes = [
    ['API', 'CLIENT'].join('_'),
    ['API', 'EXPLORATION'].join('_'),
  ];
  for (const explorationMode of oldModes) {
    await t.test(explorationMode, () => {
      const [check] = parseChecks([buildCheck({
        id: 'E2E-TST-001-API-01',
        checkMode: 'API',
        explorationMode,
      })]);
      assert.match(
        validateExplorationSummary(check).join('\n'),
        /Check mode=APIでは使用できません/
      );
    });
  }
});

test('Check一覧と探索サマリのmode不一致を拒否する', () => {
  const config = buildCheck({
    id: 'E2E-TST-001-API-01',
    checkMode: 'API',
    explorationMode: 'API_INTEGRATION',
    summary: { 'Exploration mode': '`NONE`' },
  });
  const [check] = parseChecks([config]);
  assert.match(validateExplorationSummary(check).join('\n'), /Exploration modeが不一致/);
});

test('必須行の欠落と重複を拒否する', () => {
  const [check] = parseChecks([buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
    summaryOptions: {
      omit: ['Artifacts'],
      duplicate: ['観測サマリ'],
    },
  })]);
  const problems = validateExplorationSummary(check).join('\n');
  assert.match(problems, /「Artifacts」行がありません/);
  assert.match(problems, /「観測サマリ」行が重複しています/);
});

test('探索サマリが複数あるCheckを拒否する', () => {
  const [check] = parseChecks([buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
    extraSummary: true,
  })]);
  assert.match(validateExplorationSummary(check).join('\n'), /「探索サマリ」は1件必要です/);
});

test('NONEの具体的理由がない場合を拒否する', () => {
  const [check] = parseChecks([buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'NONE',
    purpose: '対象外',
  })]);
  assert.match(validateExplorationSummary(check).join('\n'), /具体的な対象外理由がありません/);
});

test('NONEの具体的理由はMarkdown上の改行を含んでも受け入れる', () => {
  assertValid({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'NONE',
    purpose: '対象外（仕様と既存契約から期待結果を確定でき、\n追加の探索を要しないため）',
  });
});

test('NONEの理由に既知のplaceholderを使用できない', async (t) => {
  for (const reason of [
    '理由',
    'TBD',
    '`TBD`',
    '**TBD**',
    '_未定_',
    '[TODO](https://example.test/todo)',
    '未記入',
    '未定',
    'なし',
  ]) {
    await t.test(reason, () => {
      const [check] = parseChecks([buildCheck({
        id: 'E2E-TST-001-PW-01',
        checkMode: 'PW',
        explorationMode: 'NONE',
        purpose: `対象外（${reason}）`,
      })]);
      assert.match(
        validateExplorationSummary(check).join('\n'),
        /具体的な対象外理由がありません/,
      );
    });
  }
});

test('NONEの固定値と異なる探索サマリを拒否する', () => {
  const [check] = parseChecks([buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'NONE',
    summary: {
      'Run / 観測環境': '未実施',
      Artifacts: 'run-001/screenshot.png',
    },
  })]);
  const problems = validateExplorationSummary(check).join('\n');
  assert.match(problems, /「Run \/ 観測環境」が「なし（探索不要）」ではありません/);
  assert.match(problems, /「Artifacts」が「なし」ではありません/);
});

test('EVALUATING以降のplaceholderと未解決疑問を拒否する', () => {
  const [check] = parseChecks([buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
    status: 'EVALUATING',
    summary: {
      'Run / 観測環境': '未実施',
      観測サマリ: '未記入（探索後に本記入）',
      '実装候補（レビュー対象）': '未記入（探索後に本記入）',
      '観測上の疑問・要判断': '仕様オーナーの判断待ち',
    },
  })]);
  const problems = validateExplorationSummary(check).join('\n');
  assert.match(problems, /探索サマリ「Run \/ 観測環境」が未完了です/);
  assert.match(problems, /実装候補が「反映済み（反映先）」または「なし」ではありません/);
  assert.match(problems, /観測上の疑問・要判断が解消されていません/);
});

test('EVALUATING以降の非NONEでは探索なしを示す値を拒否する', async (t) => {
  for (const value of [
    'なし',
    '`なし`',
    '**TBD**',
    '**未実施**',
    '_なし_',
    '[TODO](https://example.test/todo)',
    'なし（探索不要）',
    'TBD',
    'TODO',
    '未定',
  ]) {
    await t.test(value, () => {
      const [check] = parseChecks([buildCheck({
        id: 'E2E-TST-001-PW-01',
        checkMode: 'PW',
        explorationMode: 'PLAYWRIGHT_CLI',
        status: 'ACTIVE',
        summary: {
          'Run / 観測環境': value,
          観測サマリ: value,
        },
      })]);
      const problems = validateExplorationSummary(check).join('\n');
      assert.match(problems, /探索サマリ「Run \/ 観測環境」が未完了です/);
      assert.match(problems, /探索サマリ「観測サマリ」が未完了です/);
    });
  }
});

test('探索サマリの値にescaped pipeを含む有効なMarkdown表を受け入れる', () => {
  assertValid({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
    summary: {
      '実装候補（レビュー対象）': '`getByRole("button", { name: /Save\\|保存/ })`',
    },
  });
});

test('複数Checkの探索サマリをそれぞれの節だけから読む', () => {
  const checks = parseChecks([
    buildCheck({
      id: 'E2E-TST-001-PW-01',
      checkMode: 'PW',
      explorationMode: 'NONE',
      status: 'ACTIVE',
    }),
    buildCheck({
      id: 'E2E-TST-001-API-01',
      checkMode: 'API',
      explorationMode: 'API_INTEGRATION',
      summaryOptions: { omit: ['Artifacts'] },
    }),
  ]);
  assert.deepEqual(validateExplorationSummary(checks[0]), []);
  assert.match(validateExplorationSummary(checks[1]).join('\n'), /「Artifacts」行がありません/);
});

test('Check名に含まれる別のCheck IDを節見出しとして扱わない', () => {
  const targetId = 'E2E-TST-001-PW-01';
  const decoy = buildCheck({
    id: 'E2E-TST-001-PW-02',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
  });
  decoy.section = decoy.section.replace(
    ': テスト対象',
    `: ${targetId}との連携を確認する`,
  );
  const target = buildCheck({
    id: targetId,
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
    summaryOptions: { omit: ['Artifacts'] },
  });
  const checks = parseDesignDocContent(FILE_PATH, buildDoc([decoy, target])).checks;
  const parsedTarget = checks.find((check) => check.id === targetId);
  assert.ok(parsedTarget);
  assert.match(
    validateExplorationSummary(parsedTarget).join('\n'),
    /「Artifacts」行がありません/,
  );
});

test('同じCheck IDの詳細節が複数ある場合を拒否する', () => {
  const config = buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
  });
  const content = `${buildDoc([config])}\n\n${config.section}`;
  const [check] = parseDesignDocContent(FILE_PATH, content).checks;
  assert.match(validateExplorationSummary(check).join('\n'), /Check節は1件必要です（現在: 2件）/);
});

test('Check一覧にない孤立したCheck詳細節を検出する', () => {
  const pw = buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
  });
  const api = buildCheck({
    id: 'E2E-TST-001-API-01',
    checkMode: 'API',
    explorationMode: 'API_INTEGRATION',
  });
  const content = buildDoc([pw, api]).replace(api.row, '');
  const doc = parseDesignDocContent(FILE_PATH, content);

  assert.deepEqual(doc.checks.map((check) => check.id), ['E2E-TST-001-PW-01']);
  assert.deepEqual(findOrphanCheckSectionIds(doc), ['E2E-TST-001-API-01']);
});

test('Parent Case IDが異なるslugのDocで重複する場合を検出する', () => {
  const first = parseDesignDocContent(
    '/tmp/E2E-TST-001-first.md',
    buildDoc([buildCheck({
      id: 'E2E-TST-001-PW-01',
      checkMode: 'PW',
      explorationMode: 'NONE',
    })]),
  );
  const second = parseDesignDocContent(
    '/tmp/E2E-TST-001-second.md',
    buildDoc([buildCheck({
      id: 'E2E-TST-001-API-01',
      checkMode: 'API',
      explorationMode: 'NONE',
    })]),
  );

  assert.deepEqual(findDuplicateParentCaseIds([first, second]), [{
    parentCaseId: 'E2E-TST-001',
    file: second.file,
    firstFile: first.file,
  }]);
});
