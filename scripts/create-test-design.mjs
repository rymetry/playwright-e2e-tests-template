#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isConcreteNoneReason,
  VALID_EXPLORATION_MODES_BY_CHECK_MODE,
} from './test-design-contract.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TEMPLATE_ROOT = join(ROOT, 'test-designs', 'templates');
const PARENT_ID_PATTERN = /^(E2E|INT)-([A-Z]{2,6})-(\d{3})$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_TIERS = new Set(['SMOKE', 'REGRESSION', 'EXTENDED']);
const PLACEHOLDER_PATTERN = /{{[A-Z0-9_]+}}/g;
// PIDを読み取れない破損ロックだけを、同期的な生成処理として十分長い時間後に回収する。
const PARENT_LOCK_STALE_AFTER_MS = 60_000;

const MODE_CONFIG = new Map([
  ['PW', {
    executionMode: 'PLAYWRIGHT',
    template: 'pw-check-template.md',
    explorationPurpose: [
      '- 到達経路と状態遷移',
      '- 安定Locator候補',
      '- loading、polling、animationなどの待機条件',
      '- 外部依存、失敗しやすい操作、Assertion候補',
    ].join('\n'),
  }],
  ['API', {
    executionMode: 'API',
    template: 'api-check-template.md',
    explorationPurpose: [
      '- request、response、認証、永続状態、副作用の実挙動',
      '- 外部サービス連携と観測可能な完了条件',
      '- エラー形式、失敗しやすい操作、Assertion候補',
    ].join('\n'),
  }],
  ['CU', {
    executionMode: 'COMPUTER_USE',
    template: 'cu-check-template.md',
    explorationPurpose: [
      '- 到達経路、画面状態、操作の完了条件',
      '- 人の判断が必要な箇所の特定',
    ].join('\n'),
  }],
  ['MN', {
    executionMode: 'MANUAL',
    template: 'mn-check-template.md',
    explorationPurpose: [
      '- 到達経路と確認対象の特定',
      '- 判定基準の候補',
    ].join('\n'),
  }],
]);

const USAGE = `使い方:
  npm run create:test-design -- \\
    --parent-id E2E-AUTH-001 \\
    --title "ログイン成功" \\
    --slug login-success \\
    --check PW:SMOKE:PLAYWRIGHT_CLI

Check指定:
  --check <MODE>:<TIER>:<EXPLORATION_MODE>[:<NONEの具体的理由>]

同じMODEを複数指定するとCheck IDを01、02の順に採番します。
生成先は test-designs/<level>/<area>/<Parent Case ID>-<slug>.md です。
同じParent Case IDの既存Docはslugが異なっても上書き・再生成しません。`;

function replaceTokens(source, replacements) {
  let result = source;
  for (const [name, value] of Object.entries(replacements)) {
    result = result.split(`{{${name}}}`).join(value);
  }
  return result;
}

function assertSingleLine(label, value) {
  if (value.trim() === '' || /[\r\n|]/.test(value)) {
    throw new Error(`${label}は空でなく、改行と「|」を含まない値にしてください`);
  }
  if (/{{|}}/.test(value)) {
    throw new Error(`${label}にtemplate token形式の文字列は使用できません`);
  }
}

export function parseCheckArgument(value) {
  const [mode = '', tier = '', explorationMode = '', ...reasonParts] = value.split(':');
  const noneReason = reasonParts.join(':').trim();
  const modeConfig = MODE_CONFIG.get(mode);

  if (modeConfig === undefined) {
    throw new Error(`Check mode「${mode}」はPW/API/CU/MNのいずれかにしてください`);
  }
  if (!VALID_TIERS.has(tier)) {
    throw new Error(`Tier「${tier}」はSMOKE/REGRESSION/EXTENDEDのいずれかにしてください`);
  }
  if (!VALID_EXPLORATION_MODES_BY_CHECK_MODE.get(mode)?.has(explorationMode)) {
    throw new Error(
      `Exploration mode「${explorationMode}」はCheck mode=${mode}では使用できません`,
    );
  }
  if (explorationMode === 'NONE' && !isConcreteNoneReason(noneReason)) {
    throw new Error(`Check mode=${mode}でNONEを使う場合は具体的な探索不要理由が必要です`);
  }
  if (explorationMode !== 'NONE' && noneReason !== '') {
    throw new Error('探索不要理由はExploration mode=NONEの場合だけ指定できます');
  }
  if (noneReason !== '') {
    assertSingleLine('探索不要理由', noneReason);
  }

  return { mode, tier, explorationMode, noneReason };
}

export function parseCliArguments(args) {
  const values = { checks: [], dryRun: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      values.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      values.help = true;
      continue;
    }

    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${arg}の値がありません`);
    }
    index += 1;

    switch (arg) {
      case '--parent-id':
        values.parentId = value;
        break;
      case '--title':
        values.title = value;
        break;
      case '--slug':
        values.slug = value;
        break;
      case '--check':
        values.checks.push(parseCheckArgument(value));
        break;
      default:
        throw new Error(`未対応の引数です: ${arg}`);
    }
  }
  return values;
}

function validateInput({ parentId, title, slug, checks }) {
  const parentMatch = parentId?.match(PARENT_ID_PATTERN);
  if (!parentMatch) {
    throw new Error('Parent Case IDは<LEVEL>-<AREA>-<3桁SEQ>形式にしてください');
  }
  assertSingleLine('title', title ?? '');
  if (!SLUG_PATTERN.test(slug ?? '')) {
    throw new Error('slugは英小文字・数字のケバブケースにしてください');
  }
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error('--checkを1件以上指定してください');
  }
  return { level: parentMatch[1], area: parentMatch[2].toLowerCase() };
}

function explorationValues(check, modeConfig) {
  if (check.explorationMode === 'NONE') {
    return {
      EXPLORATION_PURPOSE: `- 対象外（${check.noneReason}）`,
      EXPLORATION_RUN: 'なし（探索不要）',
      EXPLORATION_SUMMARY: 'なし（探索不要）',
      EXPLORATION_CANDIDATES: 'なし',
      EXPLORATION_QUESTIONS: 'なし',
    };
  }
  return {
    EXPLORATION_PURPOSE: modeConfig.explorationPurpose,
    EXPLORATION_RUN: '未実施',
    EXPLORATION_SUMMARY: '未記入（探索後に本記入）',
    EXPLORATION_CANDIDATES: '未記入（探索後に本記入）',
    EXPLORATION_QUESTIONS: '未記入（探索後に本記入）',
  };
}

function codeOrProcedure(mode, area, parentId, sectionNumber) {
  if (mode === 'PW' || mode === 'API') {
    return `\`e2e/${area}/${parentId}.spec.ts\``;
  }
  return `本書${sectionNumber}の手順`;
}

export function composeTestDesign(input, options = {}) {
  const { level, area } = validateInput(input);
  const templateRoot = options.templateRoot ?? DEFAULT_TEMPLATE_ROOT;
  const baseTemplate = readFileSync(join(templateRoot, 'test-design-doc-template.md'), 'utf8');
  const counters = new Map();
  const rows = [];
  const sections = [];

  for (const [index, check] of input.checks.entries()) {
    const modeConfig = MODE_CONFIG.get(check.mode);
    if (modeConfig === undefined) {
      throw new Error(`未対応のCheck modeです: ${check.mode}`);
    }
    if (
      !VALID_TIERS.has(check.tier) ||
      !VALID_EXPLORATION_MODES_BY_CHECK_MODE.get(check.mode)?.has(check.explorationMode)
    ) {
      throw new Error(`Check指定が不正です: ${JSON.stringify(check)}`);
    }
    if (check.explorationMode === 'NONE' && !isConcreteNoneReason(check.noneReason)) {
      throw new Error(`Check mode=${check.mode}でNONEを使う場合は具体的な探索不要理由が必要です`);
    }
    if (check.explorationMode === 'NONE') {
      assertSingleLine('探索不要理由', check.noneReason);
    } else if (check.noneReason?.trim()) {
      throw new Error('探索不要理由はExploration mode=NONEの場合だけ指定できます');
    }

    const sequence = (counters.get(check.mode) ?? 0) + 1;
    if (sequence > 99) {
      throw new Error(`Check mode=${check.mode}は1つのParent Caseに99件まで指定できます`);
    }
    counters.set(check.mode, sequence);
    const checkId = `${input.parentId}-${check.mode}-${String(sequence).padStart(2, '0')}`;
    const sectionNumber = `3.${index + 1}`;
    const code = codeOrProcedure(check.mode, area, input.parentId, sectionNumber);
    rows.push(
      `| ${checkId} | ${modeConfig.executionMode} | \`${check.explorationMode}\` | ` +
      `${check.tier} | DRAFT | ${code} |`,
    );

    const checkTemplate = readFileSync(
      join(templateRoot, 'checks', modeConfig.template),
      'utf8',
    );
    sections.push(replaceTokens(checkTemplate, {
      SECTION_NUMBER: sectionNumber,
      CHECK_ID: checkId,
      EXPLORATION_MODE: check.explorationMode,
      ...explorationValues(check, modeConfig),
    }).trim());
  }

  const markdown = replaceTokens(baseTemplate, {
    PARENT_CASE_ID: input.parentId,
    TITLE: input.title.trim(),
    LEVEL: level,
    CHECK_LIST_ROWS: rows.join('\n'),
    CHECK_SECTIONS: sections.join('\n\n'),
  }).trimEnd() + '\n';

  const unresolved = [...new Set(markdown.match(PLACEHOLDER_PATTERN) ?? [])];
  if (unresolved.length > 0) {
    throw new Error(`未置換のtemplate tokenがあります: ${unresolved.join(', ')}`);
  }
  return markdown;
}

export function outputPathFor(input, root = ROOT) {
  const { level, area } = validateInput(input);
  return join(
    root,
    'test-designs',
    level.toLowerCase(),
    area,
    `${input.parentId}-${input.slug}.md`,
  );
}

function isProcessAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

function readLockSnapshot(lockPath) {
  const stat = statSync(lockPath);
  let owner;
  try {
    owner = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    owner = undefined;
  }
  return { stat, owner };
}

function removeStaleParentLock(lockPath) {
  let snapshot;
  try {
    snapshot = readLockSnapshot(lockPath);
  } catch (error) {
    return error?.code === 'ENOENT';
  }

  const age = Date.now() - snapshot.stat.mtimeMs;
  const hasOwnerPid = Number.isSafeInteger(snapshot.owner?.pid) && snapshot.owner.pid > 0;
  const isStale = hasOwnerPid
    ? !isProcessAlive(snapshot.owner.pid)
    : age > PARENT_LOCK_STALE_AFTER_MS;
  if (!isStale) {
    return false;
  }

  try {
    const current = statSync(lockPath);
    if (
      current.dev !== snapshot.stat.dev ||
      current.ino !== snapshot.stat.ino ||
      current.mtimeMs !== snapshot.stat.mtimeMs ||
      current.size !== snapshot.stat.size
    ) {
      return false;
    }
    unlinkSync(lockPath);
    return true;
  } catch (error) {
    return error?.code === 'ENOENT';
  }
}

function acquireParentLock(lockPath, parentId) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = randomUUID();
    let fileDescriptor;
    try {
      fileDescriptor = openSync(lockPath, 'wx');
    } catch (error) {
      if (error?.code === 'EEXIST' && attempt === 0 && removeStaleParentLock(lockPath)) {
        continue;
      }
      if (error?.code === 'EEXIST') {
        throw new Error(`Parent Case ID「${parentId}」の生成処理が進行中です`);
      }
      throw error;
    }

    try {
      writeFileSync(fileDescriptor, JSON.stringify({
        pid: process.pid,
        token,
        createdAt: new Date().toISOString(),
      }));
    } catch (error) {
      try {
        closeSync(fileDescriptor);
      } finally {
        unlinkSync(lockPath);
      }
      throw error;
    }
    return { fileDescriptor, token };
  }
  throw new Error(`Parent Case ID「${parentId}」の生成ロックを取得できませんでした`);
}

function releaseParentLock(lockPath, lock) {
  try {
    closeSync(lock.fileDescriptor);
  } finally {
    let owner;
    try {
      owner = JSON.parse(readFileSync(lockPath, 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
    if (owner?.token === lock.token) {
      unlinkSync(lockPath);
    }
  }
}

export function writeTestDesign(input, root = ROOT) {
  const outputPath = outputPathFor(input, root);
  const outputDirectory = dirname(outputPath);
  const markdown = composeTestDesign(input);
  mkdirSync(outputDirectory, { recursive: true });

  const lockPath = join(outputDirectory, `.${input.parentId}.create.lock`);
  const lock = acquireParentLock(lockPath, input.parentId);

  try {
    const existingFile = readdirSync(outputDirectory)
      .sort()
      .find((name) => name.startsWith(`${input.parentId}-`) && name.endsWith('.md'));
    if (existingFile !== undefined) {
      throw new Error(
        `Parent Case ID「${input.parentId}」は既存のDesign Docで使用されています: ` +
        join(outputDirectory, existingFile),
      );
    }
    writeFileSync(outputPath, markdown, { encoding: 'utf8', flag: 'wx' });
    return outputPath;
  } finally {
    releaseParentLock(lockPath, lock);
  }
}

function main() {
  try {
    const input = parseCliArguments(process.argv.slice(2));
    if (input.help) {
      console.log(USAGE);
      return;
    }
    if (input.dryRun) {
      process.stdout.write(composeTestDesign(input));
      return;
    }
    const outputPath = writeTestDesign(input);
    console.log(`作成しました: ${outputPath.slice(ROOT.length + 1)}`);
  } catch (error) {
    console.error(`作成できませんでした: ${error.message}\n\n${USAGE}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
