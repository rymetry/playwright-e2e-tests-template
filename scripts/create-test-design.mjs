#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXECUTION_MODE_BY_CHECK_MODE,
  isConcreteNoneReason,
  parseAreaRegistryContent,
  VALID_EXPLORATION_MODES_BY_CHECK_MODE,
} from './test-design-contract.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TEMPLATE_ROOT = join(ROOT, 'test-designs', 'templates');
const DEFAULT_AREA_REGISTRY = join(ROOT, 'test-designs', 'areas.json');
const PARENT_ID_PATTERN = /^(E2E|INT)-([A-Z]{2,6})-(\d{3})$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_TIERS = new Set(['SMOKE', 'REGRESSION', 'EXTENDED']);
const PLACEHOLDER_PATTERN = /{{[A-Z0-9_]+}}/g;
const TRANSACTION_VERSION = 1;

const MODE_CONFIG = new Map([
  ['PW', {
    template: 'pw-check-template.md',
    explorationPurpose: [
      '- 到達経路と状態遷移',
      '- 安定Locator候補',
      '- loading、polling、animationなどの待機条件',
      '- 外部依存、失敗しやすい操作、Assertion候補',
    ].join('\n'),
  }],
  ['API', {
    template: 'api-check-template.md',
    explorationPurpose: [
      '- request、response、認証、永続状態、副作用の実挙動',
      '- 外部サービス連携と観測可能な完了条件',
      '- エラー形式、失敗しやすい操作、Assertion候補',
    ].join('\n'),
  }],
  ['CU', {
    template: 'cu-check-template.md',
    explorationPurpose: [
      '- 到達経路、画面状態、操作の完了条件',
      '- 人の判断が必要な箇所の特定',
    ].join('\n'),
  }],
  ['MN', {
    template: 'mn-check-template.md',
    explorationPurpose: [
      '- 到達経路と確認対象の特定',
      '- 判定基準の候補',
    ].join('\n'),
  }],
]);

const USAGE = `使い方:
  npm run create:test-design -- \\
    --parent-id E2E-DEMO-002 \\
    --title "検索結果を確認する" \\
    --slug search-results \\
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

function loadRegisteredAreas(registryPath = DEFAULT_AREA_REGISTRY) {
  return parseAreaRegistryContent(readFileSync(registryPath, 'utf8'));
}

function validateInput({ parentId, title, slug, checks }, registeredAreas) {
  const parentMatch = parentId?.match(PARENT_ID_PATTERN);
  if (!parentMatch) {
    throw new Error('Parent Case IDは<LEVEL>-<AREA>-<3桁SEQ>形式にしてください');
  }
  const areaCode = parentMatch[2];
  if (!registeredAreas.has(areaCode)) {
    throw new Error(
      `Area「${areaCode}」はtest-designs/areas.jsonのAreaレジストリに登録されていません`,
    );
  }
  assertSingleLine('title', title ?? '');
  if (!SLUG_PATTERN.test(slug ?? '')) {
    throw new Error('slugは英小文字・数字のケバブケースにしてください');
  }
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error('--checkを1件以上指定してください');
  }
  return { level: parentMatch[1], area: areaCode.toLowerCase() };
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
  const registeredAreas = options.registeredAreas ?? loadRegisteredAreas(options.registryPath);
  const { level, area } = validateInput(input, registeredAreas);
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
      `| ${checkId} | ${EXECUTION_MODE_BY_CHECK_MODE.get(check.mode)} | ` +
      `\`${check.explorationMode}\` | ` +
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
  const { level, area } = validateInput(input, loadRegisteredAreas());
  return join(
    root,
    'test-designs',
    level.toLowerCase(),
    area,
    `${input.parentId}-${input.slug}.md`,
  );
}

function findExistingParentDoc(outputDirectory, parentId) {
  const existingFile = readdirSync(outputDirectory)
    .sort()
    .find((name) => name.startsWith(`${parentId}-`) && name.endsWith('.md'));
  return existingFile === undefined ? undefined : join(outputDirectory, existingFile);
}

function existingParentError(parentId, existingPath) {
  return new Error(
    `Parent Case ID「${parentId}」は既存のDesign Docで使用されています: ${existingPath}`,
  );
}

function transactionDirectory(root) {
  return join(root, '.playwright', 'test-design-transactions');
}

function pendingTransactionPath(root, parentId) {
  return join(transactionDirectory(root), `${parentId}.json`);
}

function unlinkIfExists(filePath) {
  try {
    unlinkSync(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

function writeDurableStagingFile(filePath, content, mode = 0o600) {
  const fileDescriptor = openSync(filePath, 'wx', mode);
  let completed = false;
  try {
    writeFileSync(fileDescriptor, content, 'utf8');
    fsyncSync(fileDescriptor);
    completed = true;
  } finally {
    try {
      closeSync(fileDescriptor);
    } finally {
      if (!completed) {
        unlinkIfExists(filePath);
      }
    }
  }
}

function hashMarkdown(markdown) {
  return createHash('sha256').update(markdown, 'utf8').digest('hex');
}

function cleanupTransactionTemporaryFiles(root, parentId) {
  const directory = transactionDirectory(root);
  let names;
  try {
    names = readdirSync(directory);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  const prefix = `${parentId}.`;
  for (const name of names) {
    if (name.startsWith(prefix) && name.endsWith('.tmp')) {
      unlinkIfExists(join(directory, name));
    }
  }
}

function validateTransaction(transaction, parentId, root) {
  if (
    transaction?.version !== TRANSACTION_VERSION ||
    transaction.parentId !== parentId ||
    typeof transaction.token !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(transaction.token) ||
    typeof transaction.outputFile !== 'string' ||
    typeof transaction.markdown !== 'string' ||
    transaction.markdown.trim() === '' ||
    typeof transaction.markdownHash !== 'string' ||
    transaction.markdownHash !== hashMarkdown(transaction.markdown)
  ) {
    throw new Error(`Parent Case ID「${parentId}」の保留中生成記録が不正です`);
  }

  const parentMatch = parentId.match(PARENT_ID_PATTERN);
  const outputFilePattern = new RegExp(
    `^${parentId}-[a-z0-9]+(?:-[a-z0-9]+)*\\.md$`,
  );
  if (
    parentMatch === null ||
    basename(transaction.outputFile) !== transaction.outputFile ||
    !outputFilePattern.test(transaction.outputFile) ||
    !new RegExp(`^# ${parentId} `, 'm').test(transaction.markdown) ||
    !transaction.markdown.includes(`| Parent Case ID | ${parentId} |`)
  ) {
    throw new Error(`Parent Case ID「${parentId}」の保留中生成記録が不正です`);
  }

  return {
    ...transaction,
    outputPath: join(
      root,
      'test-designs',
      parentMatch[1].toLowerCase(),
      parentMatch[2].toLowerCase(),
      transaction.outputFile,
    ),
  };
}

function readPendingTransaction(root, parentId) {
  const transactionPath = pendingTransactionPath(root, parentId);
  let content;
  try {
    content = readFileSync(transactionPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }

  let transaction;
  try {
    transaction = JSON.parse(content);
  } catch {
    throw new Error(`Parent Case ID「${parentId}」の保留中生成記録が不正です`);
  }
  return validateTransaction(transaction, parentId, root);
}

function removePendingTransaction(root, transaction) {
  const transactionPath = pendingTransactionPath(root, transaction.parentId);
  let current;
  try {
    current = JSON.parse(readFileSync(transactionPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return;
    }
    throw error;
  }
  if (current?.token === transaction.token) {
    unlinkIfExists(transactionPath);
  }
}

function publishTransaction(root, transaction) {
  const outputDirectory = dirname(transaction.outputPath);
  mkdirSync(outputDirectory, { recursive: true });
  const existingPath = findExistingParentDoc(outputDirectory, transaction.parentId);
  if (existingPath !== undefined) {
    if (
      existingPath === transaction.outputPath &&
      readFileSync(existingPath, 'utf8') === transaction.markdown
    ) {
      removePendingTransaction(root, transaction);
      cleanupTransactionTemporaryFiles(root, transaction.parentId);
      return existingPath;
    }
    throw existingParentError(transaction.parentId, existingPath);
  }

  const stagingDirectory = transactionDirectory(root);
  mkdirSync(stagingDirectory, { recursive: true });
  const stagedDocPath = join(
    stagingDirectory,
    `${transaction.parentId}.${transaction.token}.${randomUUID()}.md.tmp`,
  );
  writeDurableStagingFile(stagedDocPath, transaction.markdown, 0o644);
  try {
    try {
      // 完成済みinodeだけを最終pathへlinkし、空・途中書きのDocを公開しない。
      linkSync(stagedDocPath, transaction.outputPath);
    } catch (error) {
      if (
        !['EEXIST', 'ENOENT'].includes(error?.code) ||
        !existsSync(transaction.outputPath) ||
        readFileSync(transaction.outputPath, 'utf8') !== transaction.markdown
      ) {
        throw error;
      }
    }
  } finally {
    unlinkIfExists(stagedDocPath);
  }
  removePendingTransaction(root, transaction);
  cleanupTransactionTemporaryFiles(root, transaction.parentId);
  return transaction.outputPath;
}

function createPendingTransaction(root, transaction) {
  const directory = transactionDirectory(root);
  mkdirSync(directory, { recursive: true });
  const stagedTransactionPath = join(
    directory,
    `${transaction.parentId}.${transaction.token}.json.tmp`,
  );
  const transactionPath = pendingTransactionPath(root, transaction.parentId);
  writeDurableStagingFile(stagedTransactionPath, JSON.stringify(transaction));
  try {
    try {
      // hard linkの作成は既存pathを上書きせず原子的。完全な記録だけを公開する。
      linkSync(stagedTransactionPath, transactionPath);
      return true;
    } catch (error) {
      if (error?.code === 'EEXIST' || error?.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  } finally {
    unlinkIfExists(stagedTransactionPath);
  }
}

export function writeTestDesign(input, root = ROOT) {
  const outputPath = outputPathFor(input, root);
  const outputDirectory = dirname(outputPath);
  const markdown = composeTestDesign(input);
  mkdirSync(outputDirectory, { recursive: true });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const pending = readPendingTransaction(root, input.parentId);
    if (pending !== undefined) {
      const recoveredPath = publishTransaction(root, pending);
      throw existingParentError(input.parentId, recoveredPath);
    }

    const existingPath = findExistingParentDoc(outputDirectory, input.parentId);
    if (existingPath !== undefined) {
      throw existingParentError(input.parentId, existingPath);
    }

    const transaction = validateTransaction({
      version: TRANSACTION_VERSION,
      parentId: input.parentId,
      outputFile: basename(outputPath),
      markdown,
      markdownHash: hashMarkdown(markdown),
      token: randomUUID(),
      createdAt: new Date().toISOString(),
    }, input.parentId, root);
    if (!createPendingTransaction(root, transaction)) {
      continue;
    }
    return publishTransaction(root, transaction);
  }
  throw new Error(`Parent Case ID「${input.parentId}」の生成処理を完了できませんでした`);
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
