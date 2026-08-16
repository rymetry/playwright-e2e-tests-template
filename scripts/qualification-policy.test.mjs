import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveQualificationPolicy } from './qualification-policy.mjs';

const standardArgs = [
  'test',
  '--repeat-each=3',
  '--retries=0',
  '--workers=1',
  '--grep',
  'E2E-DEMO-001-PW-01',
  '--project=chromium',
];

test('Qualification以外ではpolicyを適用しない', () => {
  assert.equal(resolveQualificationPolicy([], {}), undefined);
});

test('標準Qualificationは3回・retry 0・workers 1を受け入れる', () => {
  assert.deepEqual(
    resolveQualificationPolicy(standardArgs, {
      E2E_QUALIFY: '1',
      E2E_QUALIFY_MODE: 'standard',
    }),
    {
      checkId: 'E2E-DEMO-001-PW-01',
      project: 'chromium',
      mode: 'standard',
      runCount: 3,
      ownerApprovalRef: undefined,
    },
  );
});

test('分離形式とshort aliasを受け入れる', () => {
  assert.deepEqual(
    resolveQualificationPolicy([
      'test',
      '--repeat-each', '3',
      '--retries', '0',
      '-j', '1',
      '-g', 'E2E-DEMO-001-PW-01',
      '--project', 'chromium',
    ], {
      E2E_QUALIFY: '1',
      E2E_QUALIFY_MODE: 'standard',
    }),
    {
      checkId: 'E2E-DEMO-001-PW-01',
      project: 'chromium',
      mode: 'standard',
      runCount: 3,
      ownerApprovalRef: undefined,
    },
  );
});

test('標準Qualificationの1回上書きを拒否する', () => {
  assert.throws(
    () => resolveQualificationPolicy(
      standardArgs.map((arg) => arg === '--repeat-each=3' ? '--repeat-each=1' : arg),
      { E2E_QUALIFY: '1', E2E_QUALIFY_MODE: 'standard' },
    ),
    /--repeat-each=3/,
  );
});

test('後置した重複制御引数とworkers aliasによる上書きを拒否する', () => {
  for (const extraArgs of [
    ['--repeat-each=1'],
    ['--retries=1'],
    ['--workers=2'],
    ['-j2'],
  ]) {
    assert.throws(
      () => resolveQualificationPolicy([...standardArgs, ...extraArgs], {
        E2E_QUALIFY: '1',
        E2E_QUALIFY_MODE: 'standard',
      }),
      /指定が1回だけ必要/,
    );
  }
});

test('複数Checkを含むgrepとgrepの重複を拒否する', () => {
  const env = { E2E_QUALIFY: '1', E2E_QUALIFY_MODE: 'standard' };
  assert.throws(
    () => resolveQualificationPolicy(
      standardArgs.map(
        (arg) => arg === 'E2E-DEMO-001-PW-01'
          ? 'E2E-DEMO-001-PW-01|E2E-DEMO-002-PW-01'
          : arg,
      ),
      env,
    ),
    /完全一致/,
  );
  assert.throws(
    () => resolveQualificationPolicy(
      [...standardArgs, '-gE2E-DEMO-002-PW-01'],
      env,
    ),
    /指定が1回だけ必要/,
  );
});

test('projectの重複を拒否する', () => {
  assert.throws(
    () => resolveQualificationPolicy(
      [...standardArgs, '--project=firefox'],
      { E2E_QUALIFY: '1', E2E_QUALIFY_MODE: 'standard' },
    ),
    /指定が1回だけ必要/,
  );
});

test('projectのvariadic値と契約外の追加引数を拒否する', () => {
  const splitProjectArgs = standardArgs.flatMap(
    (arg) => arg === '--project=chromium'
      ? ['--project', 'chromium', 'firefox']
      : [arg],
  );
  const env = { E2E_QUALIFY: '1', E2E_QUALIFY_MODE: 'standard' };
  assert.throws(
    () => resolveQualificationPolicy(splitProjectArgs, env),
    /引数「firefox」を使用できません/,
  );
  assert.throws(
    () => resolveQualificationPolicy([...standardArgs, '--headed'], env),
    /引数「--headed」を使用できません/,
  );
});

test('owner-approved Qualificationは承認参照付きの1回だけを受け入れる', () => {
  const policy = resolveQualificationPolicy(
    standardArgs.map((arg) => arg === '--repeat-each=3' ? '--repeat-each=1' : arg),
    {
      E2E_QUALIFY: '1',
      E2E_QUALIFY_MODE: 'owner-approved',
      E2E_QUALIFY_OWNER_APPROVAL_REF: 'OWNER-APPROVAL-001',
    },
  );
  assert.equal(policy?.runCount, 1);
  assert.equal(policy?.ownerApprovalRef, 'OWNER-APPROVAL-001');
});

test('owner-approved Qualificationは承認参照の欠落とplaceholderを拒否する', () => {
  const ownerArgs = standardArgs.map(
    (arg) => arg === '--repeat-each=3' ? '--repeat-each=1' : arg,
  );
  for (const ownerApprovalRef of [undefined, '', 'TODO']) {
    assert.throws(
      () => resolveQualificationPolicy(ownerArgs, {
        E2E_QUALIFY: '1',
        E2E_QUALIFY_MODE: 'owner-approved',
        E2E_QUALIFY_OWNER_APPROVAL_REF: ownerApprovalRef,
      }),
      /E2E_QUALIFY_OWNER_APPROVAL_REF/,
    );
  }
});

test('owner-approved Qualificationでもretry・worker変更を拒否する', () => {
  const ownerEnv = {
    E2E_QUALIFY: '1',
    E2E_QUALIFY_MODE: 'owner-approved',
    E2E_QUALIFY_OWNER_APPROVAL_REF: 'OWNER-APPROVAL-001',
  };
  const ownerArgs = standardArgs.map(
    (arg) => arg === '--repeat-each=3' ? '--repeat-each=1' : arg,
  );
  assert.throws(
    () => resolveQualificationPolicy(
      ownerArgs.map((arg) => arg === '--retries=0' ? '--retries=1' : arg),
      ownerEnv,
    ),
    /--retries=0/,
  );
  assert.throws(
    () => resolveQualificationPolicy(
      ownerArgs.map((arg) => arg === '--workers=1' ? '--workers=2' : arg),
      ownerEnv,
    ),
    /--workers=1/,
  );
});
