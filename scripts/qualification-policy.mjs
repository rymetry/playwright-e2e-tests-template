const CHECK_ID_PATTERN = /^(E2E|INT)-[A-Z]{2,6}-\d{3}-(PW|API)-\d{2}$/;
const OWNER_APPROVAL_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const PLACEHOLDER_APPROVAL_REFS = new Set([
  'TBD',
  'TODO',
  'UNSET',
  'NONE',
  'PLACEHOLDER',
  'CHANGEME',
  'EXAMPLE',
  'SAMPLE',
]);
const ARG_OPTIONS = [
  { key: 'grep', names: ['--grep', '-g'] },
  { key: 'project', names: ['--project'] },
  { key: 'repeatEach', names: ['--repeat-each'] },
  { key: 'retries', names: ['--retries'] },
  { key: 'workers', names: ['--workers', '-j'] },
];

function parseQualificationArgs(args) {
  const parsed = new Map(ARG_OPTIONS.map(({ key }) => [key, []]));
  let index = 1;
  while (index < args.length) {
    const arg = args[index];
    if (arg === undefined) {
      break;
    }
    let matched = false;
    for (const { key, names } of ARG_OPTIONS) {
      for (const name of names) {
        let value;
        let consumed = 1;
        if (arg === name) {
          value = args[index + 1];
          consumed = 2;
        } else if (arg.startsWith(`${name}=`)) {
          value = arg.slice(name.length + 1);
        } else if (
          name.startsWith('-') &&
          !name.startsWith('--') &&
          arg.startsWith(name) &&
          arg.length > name.length
        ) {
          value = arg.slice(name.length);
        } else {
          continue;
        }
        if (value === undefined || value === '' || value.startsWith('-')) {
          throw new Error(`Qualificationの ${name} に値がありません。`);
        }
        parsed.get(key).push(value);
        index += consumed;
        matched = true;
        break;
      }
      if (matched) {
        break;
      }
    }
    if (!matched) {
      throw new Error(`Qualificationでは引数「${arg}」を使用できません。`);
    }
  }
  return parsed;
}

function requireSingleArgValue(parsed, key, label) {
  const values = parsed.get(key);
  const value = values[0];
  if (values.length !== 1 || value === undefined) {
    throw new Error(`Qualificationには ${label} の指定が1回だけ必要です。`);
  }
  return value;
}

function requireExactArg(parsed, key, label, expected) {
  const actual = requireSingleArgValue(parsed, key, label);
  if (actual !== expected) {
    throw new Error(`Qualificationには ${label}=${expected} が必要です（現在: ${actual}）。`);
  }
}

export function resolveQualificationPolicy(args, env) {
  if (env.E2E_QUALIFY !== '1') {
    return undefined;
  }

  // Playwright workerはCLI引数を持たない別プロセスとしてconfigを再評価する。
  // user-controlledなTEST_WORKER_INDEXではなく、主プロセス固有のsubcommandで判別する。
  if (args[0] !== 'test') {
    return undefined;
  }

  const parsed = parseQualificationArgs(args);
  const grep = requireSingleArgValue(parsed, 'grep', '--grep "<Check ID>"');
  const project = requireSingleArgValue(parsed, 'project', '--project');
  if (!CHECK_ID_PATTERN.test(grep)) {
    throw new Error(
      'Qualificationの --grep は1件のCheck IDとの完全一致が必要です' +
        '（例: --grep "E2E-DEMO-001-PW-01"）。',
    );
  }
  const checkId = grep;

  const mode = env.E2E_QUALIFY_MODE ?? 'standard';
  if (mode !== 'standard' && mode !== 'owner-approved') {
    throw new Error(`E2E_QUALIFY_MODE「${mode}」は使用できません。`);
  }

  const runCount = mode === 'owner-approved' ? 1 : 3;
  requireExactArg(parsed, 'repeatEach', '--repeat-each', String(runCount));
  requireExactArg(parsed, 'retries', '--retries', '0');
  requireExactArg(parsed, 'workers', '--workers', '1');

  let ownerApprovalRef;
  if (mode === 'owner-approved') {
    ownerApprovalRef = env.E2E_QUALIFY_OWNER_APPROVAL_REF?.trim();
    if (
      ownerApprovalRef === undefined ||
      !OWNER_APPROVAL_REF_PATTERN.test(ownerApprovalRef) ||
      PLACEHOLDER_APPROVAL_REFS.has(
        ownerApprovalRef.toUpperCase().replace(/[._:-]/g, ''),
      )
    ) {
      throw new Error(
        'owner-approved Qualificationには、記録済み承認を指す' +
          ' E2E_QUALIFY_OWNER_APPROVAL_REF が必要です。',
      );
    }
  }

  return { checkId, project, mode, runCount, ownerApprovalRef };
}
