import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findDuplicateParentCaseIds,
  findOrphanCheckSectionIds,
  parseDesignDocContent,
  validateParentCaseArea,
  validateExplorationSummary,
} from './check-consistency.mjs';
import {
  EXECUTION_MODE_BY_CHECK_MODE,
  parseAreaRegistryContent,
} from './test-design-contract.mjs';

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
  executionMode = EXECUTION_MODE_BY_CHECK_MODE.get(checkMode),
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
    row: `| ${id} | ${executionMode} | ${explorationMode} | REGRESSION | ${status} | 未実装 |`,
    section: `### 3.1 ${id}: テスト対象\n\n#### 探索目的\n\n${resolvedPurpose}\n\n#### 探索サマリ\n\n| 項目 | 値 |\n|---|---|\n${summaryBlock}${duplicateBlock}\n\n#### Test Status判定根拠\n\n| 項目 | 値 |\n|---|---|\n| 判定 | ${status} |`,
  };
}

function buildDoc(checks) {
  return `# Test Design Doc\n\n| 項目 | 値 |\n|---|---|\n| Parent Case ID | E2E-TST-001 |\n\n## 2. Check一覧\n\n| Check ID | Execution mode | Exploration mode | Tier | Status | Code / 手順 |\n|---|---|---|---|---|---|\n${checks.map((check) => check.row).join('\n')}\n\n## 3. Check詳細\n\n${checks.map((check) => check.section).join('\n\n')}`;
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

test('Check modeとExecution modeの不一致を拒否する', () => {
  const [check] = parseChecks([buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    executionMode: 'API',
    explorationMode: 'PLAYWRIGHT_CLI',
  })]);
  assert.match(validateExplorationSummary(check).join('\n'), /Execution modeが不一致/);
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
    '<strong>TBD</strong>',
    '_未定_',
    '[TODO](https://example.test/todo)',
    '未**定**',
    '**T**B**D**',
    '[T](https://example.test/t)[B](https://example.test/b)[D](https://example.test/d)',
    '&#84;&#66;&#68;',
    '&nbsp;TBD&nbsp;',
    '[TBD](https://example.test/path_(v1))',
    '[TBD][pending]',
    '[TBD](https://example.test/path_(v1_(draft)))',
    '&emsp;TBD&emsp;',
    'T&#8203;BD',
    '<span title="1 > 0">TBD</span>',
    'T<!-- -->BD',
    '探索理由はTBDです',
    '未定です',
    'TODO later',
    'TODO（探索後に記入）',
    '未定。',
    'TODO。',
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
    '<strong>未実施</strong>',
    '<em>TODO</em>',
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

test('EVALUATING以降では候補とArtifacts内のplaceholderを拒否する', () => {
  const [check] = parseChecks([buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
    status: 'ACTIVE',
    summary: {
      '実装候補（レビュー対象）': '反映済み（TBD）',
      Artifacts: '<strong>TODO</strong>',
    },
  })]);
  const problems = validateExplorationSummary(check).join('\n');
  assert.match(problems, /実装候補が「反映済み（反映先）」または「なし」ではありません/);
  assert.match(problems, /探索サマリ「Artifacts」が未完了です/);
});

test('部分装飾とHTML entityのplaceholderを表示値として拒否する', async (t) => {
  for (const value of [
    '未**定**',
    '**T**B**D**',
    '[T](https://example.test/t)[B](https://example.test/b)[D](https://example.test/d)',
    '&#84;&#66;&#68;',
    '&nbsp;TBD&nbsp;',
    '[TBD](https://example.test/path_(v1))',
    '[TBD][pending]',
    '[TBD](https://example.test/path_(v1_(draft)))',
    '&emsp;TBD&emsp;',
    'T&#8203;BD',
    '<span title="1 > 0">TBD</span>',
    'T<!-- -->BD',
    'Run ID: TBD',
    '観測結果 TBD later',
    '観測結果は未定です',
    '反映先: TODO',
    'Artifacts: TBD',
    '未実施です',
    '未記入です',
    'TODO later',
    'TODO（探索後に記入）',
    '未実施。',
    'TODO。',
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
          '実装候補（レビュー対象）': `反映済み（${value}）`,
          Artifacts: value,
        },
      })]);
      const problems = validateExplorationSummary(check).join('\n');
      assert.match(problems, /探索サマリ「Run \/ 観測環境」が未完了です/);
      assert.match(problems, /探索サマリ「観測サマリ」が未完了です/);
      assert.match(problems, /実装候補が「反映済み（反映先）」または「なし」ではありません/);
      assert.match(problems, /探索サマリ「Artifacts」が未完了です/);
    });
  }
});

test('placeholderを部分文字列に持つ正当な観測内容とArtifact pathを受け入れる', () => {
  assertValid({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
    status: 'ACTIVE',
    summary: {
      'Run / 観測環境': '未実施のジョブ件数は0だった / run-001 / 2026-08-15T10:00:00+09:00',
      観測サマリ: '未定義値はnullとして返り、TODO リスト画面は正常に表示された',
      '実装候補（レビュー対象）': '反映済み（Assertion設計の未定義値ケース）',
      Artifacts: 'run-001/artifacts/todo-list/result.png',
    },
  });
});

test('Check一覧は正規のheaderとdelimiterを持つ6列表だけを受け入れる', async (t) => {
  const config = buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
  });
  const validContent = buildDoc([config]);
  const cases = [
    {
      name: 'headerなし',
      content: validContent.replace(
        '| Check ID | Execution mode | Exploration mode | Tier | Status | Code / 手順 |\n',
        '',
      ),
    },
    {
      name: 'delimiterなし',
      content: validContent.replace('|---|---|---|---|---|---|\n', ''),
    },
    {
      name: '7列',
      content: validContent
        .replace(
          '| Check ID | Execution mode | Exploration mode | Tier | Status | Code / 手順 |',
          '| Check ID | Execution mode | Exploration mode | Tier | Status | Code / 手順 | Extra |',
        )
        .replace('|---|---|---|---|---|---|', '|---|---|---|---|---|---|---|')
        .replace(config.row, config.row.replace(/\|$/, '| extra |')),
    },
  ];

  for (const { name, content } of cases) {
    await t.test(name, () => {
      const doc = parseDesignDocContent(FILE_PATH, content);
      assert.deepEqual(doc.checks, []);
      assert.deepEqual(findOrphanCheckSectionIds(doc), ['E2E-TST-001-PW-01']);
    });
  }
});

test('Check一覧のCode列にescaped pipeを含む有効な6列表を受け入れる', () => {
  const config = buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
  });
  config.row = config.row.replace('未実装', '手順A\\|手順B');
  const doc = parseDesignDocContent(FILE_PATH, buildDoc([config]));

  assert.equal(doc.checks.length, 1);
  assert.deepEqual(validateExplorationSummary(doc.checks[0]), []);
});

test('探索サマリは正規のheaderとdelimiterを持つ2列表だけを受け入れる', async (t) => {
  const config = buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
  });
  const cases = [
    {
      name: 'headerなし',
      section: config.section.replace(
        '#### 探索サマリ\n\n| 項目 | 値 |\n|---|---|\n',
        '#### 探索サマリ\n\n',
      ),
    },
    {
      name: 'delimiterなし',
      section: config.section.replace(
        '#### 探索サマリ\n\n| 項目 | 値 |\n|---|---|\n',
        '#### 探索サマリ\n\n| 項目 | 値 |\n',
      ),
    },
    {
      name: '3列',
      section: config.section.replace(
        '#### 探索サマリ\n\n| 項目 | 値 |\n|---|---|\n',
        '#### 探索サマリ\n\n| 項目 | 値 | Extra |\n|---|---|---|\n',
      ),
    },
  ];

  for (const { name, section } of cases) {
    await t.test(name, () => {
      const malformed = { ...config, section };
      const [check] = parseDesignDocContent(FILE_PATH, buildDoc([malformed])).checks;
      assert.match(
        validateExplorationSummary(check).join('\n'),
        /探索サマリ表は「項目」「値」の2列とdelimiter行が必要です/,
      );
    });
  }
});

test('Areaレジストリを単一のJSON定義から読み取る', () => {
  const registeredAreas = parseAreaRegistryContent(JSON.stringify({
    DEMO: { name: 'サンプル' },
    AUTH: { name: '認証' },
  }));
  assert.deepEqual(registeredAreas, new Set(['DEMO', 'AUTH']));
  assert.deepEqual(validateParentCaseArea('E2E-DEMO-001', registeredAreas), []);
  assert.match(
    validateParentCaseArea('E2E-ORDER-001', registeredAreas).join('\n'),
    /Area「ORDER」がAreaレジストリにありません/,
  );
  assert.throws(
    () => parseAreaRegistryContent('{"invalid": {"name": "不正"}}'),
    /2〜6文字の大文字英字/,
  );
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

test('code fenceとHTMLコメント内のCheck構造を解析対象にしない', () => {
  const real = buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
  });
  real.section += `\n\n\`\`\`md\n#### 探索サマリ\n\n| 項目 | 値 |\n|---|---|\n| Artifacts | TODO |\n\`\`\``;
  const decoy = buildCheck({
    id: 'E2E-TST-001-API-01',
    checkMode: 'API',
    explorationMode: 'API_INTEGRATION',
  });
  const content = `${buildDoc([real])}\n\n\`\`\`md\n${decoy.row}\n${decoy.section}\n\`\`\`\n\n<!--\n${decoy.row}\n${decoy.section}\n-->`;
  const doc = parseDesignDocContent(FILE_PATH, content);

  assert.deepEqual(doc.checks.map((check) => check.id), ['E2E-TST-001-PW-01']);
  assert.deepEqual(doc.checkSectionIds, ['E2E-TST-001-PW-01']);
  assert.deepEqual(validateExplorationSummary(doc.checks[0]), []);
});

test('閉じていないHTMLコメント内のDoc構造を解析対象にしない', () => {
  const hidden = buildDoc([buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
  })]);
  const doc = parseDesignDocContent(FILE_PATH, `<!--\n${hidden}`);

  assert.equal(doc.parentCaseId, undefined);
  assert.deepEqual(doc.checks, []);
  assert.deepEqual(doc.checkSectionIds, []);
});

test('Check一覧節の外にあるCheck表行を一覧として扱わない', () => {
  const config = buildCheck({
    id: 'E2E-TST-001-PW-01',
    checkMode: 'PW',
    explorationMode: 'PLAYWRIGHT_CLI',
  });
  const content = buildDoc([config]).replace('## 2. Check一覧', '## 2. 参考情報');
  const doc = parseDesignDocContent(FILE_PATH, content);

  assert.deepEqual(doc.checks, []);
  assert.deepEqual(findOrphanCheckSectionIds(doc), ['E2E-TST-001-PW-01']);
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
