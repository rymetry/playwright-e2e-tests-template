#!/usr/bin/env node
/**
 * Test Design DocとPlaywright specの整合チェッカー
 *
 * Design Doc（test-designs/）とspec（e2e/）は同じ情報を2箇所で持つため、
 * 時間の経過とともに乖離しうる。このスクリプトはその乖離を機械的に検出する。
 * 依存パッケージなし・Node標準モジュールのみで動作する。
 *
 * 実行方法: npm run check
 * 終了コード: 問題なし=0、問題あり=1
 *
 * 処理の流れ:
 *   Step 1. test-designs/e2e・test-designs/int 配下のDesign Docを収集しパースする
 *   Step 2. e2e配下の*.spec.tsを収集し、test()のタイトルとタグをパースする
 *   Step 3. DocとspecをルールNo.1〜10で突き合わせ、問題を収集する
 *   Step 4. 結果を出力し、問題が1件でもあればexit 1で終了する
 *
 * チェックルール一覧:
 *   No.1 Parent Case ID・Check IDが命名規則（<LEVEL>-<AREA>-<SEQ>[-<MODE>-<NN>]）に従っている
 *   No.2 Parent Case ID・Check IDが全Docを通して重複せず、Check一覧と詳細節が対応する
 *   No.3 Check一覧のExecution mode・Status・Tierが正しい値で、Docファイル名がParent Case IDで始まる
 *   No.4 Check一覧のStatusと、各Checkの「Test Status判定根拠」表の判定が一致する
 *   No.5 PW/API CheckはStatusに応じてspecが存在する（EVALUATING以上=必須、RETIRED=禁止）
 *   No.6 Status=QUARANTINEとテストの@quarantineタグが両方向で一致する
 *   No.7 Tier=SMOKEとテストの@smokeタグが両方向で一致する
 *   No.8 CU/MN CheckのIDがspecに存在しない（自動実行対象ではないため）
 *   No.9 specの全タイトルがCheck IDで始まり、そのIDがいずれかのDocに存在する
 *   No.10 各Checkの探索サマリが必須構造・mode・Statusごとの状態契約に従う
 *
 * タグ（No.6・No.7）は `{ tag: '@smoke' }` オプション（公式推奨）と
 * タイトル内埋め込みの両方を検出する。ただしtest()直下のみ対応し、
 * test.describe()単位の一括タグ付けは検出対象外（規約: タグはtest単位で付与する）。
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  containsContractPlaceholder,
  EXECUTION_MODE_BY_CHECK_MODE,
  isConcreteNoneReason,
  normalizeContractToken,
  parseAreaRegistryContent,
  VALID_EXPLORATION_MODES_BY_CHECK_MODE,
} from './test-design-contract.mjs';

// このスクリプトはscripts/直下に置かれる前提。親ディレクトリ=リポジトリルート
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const AREA_REGISTRY_PATH = join(ROOT, 'test-designs', 'areas.json');

// test-designs/README.md 2章の命名規則と対応する正規表現
const PARENT_ID_PATTERN = /^(E2E|INT)-([A-Z]{2,6})-\d{3}$/;
const CHECK_ID_PATTERN = /^(E2E|INT)-[A-Z]{2,6}-\d{3}-(PW|API|CU|MN)-\d{2}$/;
// 行内からCheck IDらしき文字列を拾うための緩い版（specタイトル検索用）
const CHECK_ID_LOOSE = /(E2E|INT)-[A-Z]{2,6}-\d{3}-(PW|API|CU|MN)-\d{2}/;

const VALID_STATUSES = new Set(['DRAFT', 'EVALUATING', 'ACTIVE', 'QUARANTINE', 'RETIRED']);
// test-designs/README.md 3章のTier。不正値（テンプレートの選択肢表記の残置等)は
// 「SMOKE以外」としてサイレントにsmoke suiteから漏れるため、列挙検証する
const VALID_TIERS = new Set(['SMOKE', 'REGRESSION', 'EXTENDED']);
// specの存在を要求するStatus（DRAFTは実装前でもよい）
const STATUSES_REQUIRING_SPEC = new Set(['EVALUATING', 'ACTIVE', 'QUARANTINE']);
// 自動実行されるExecution mode（specと突き合わせる対象）
const AUTOMATED_MODES = new Set(['PW', 'API']);
export { VALID_EXPLORATION_MODES_BY_CHECK_MODE };
const EXPLORATION_SUMMARY_FIELDS = [
  'Exploration mode',
  'Run / 観測環境',
  '観測サマリ',
  '実装候補（レビュー対象）',
  '観測上の疑問・要判断',
  'Artifacts',
];
const INCOMPLETE_EXPLORATION_VALUES = new Set([
  '',
  '未実施',
  '未記入（探索後に本記入）',
  'なし',
  'なし（探索不要）',
  'TBD',
  'TODO',
  '未定',
].map(normalizeContractToken));
const NONE_EXPLORATION_SUMMARY_VALUES = new Map([
  ['Run / 観測環境', 'なし（探索不要）'],
  ['観測サマリ', 'なし（探索不要）'],
  ['実装候補（レビュー対象）', 'なし'],
  ['観測上の疑問・要判断', 'なし'],
  ['Artifacts', 'なし'],
]);
const RUN_ENVIRONMENT_REQUIRED_FIELDS = [
  'Tool / version',
  'Browser / app',
  'Actor',
  'Session',
  'Observed at',
];
const RUN_ID_PATTERN = /^(\d{8}-\d{6}-\d{3})_((?:E2E|INT)-[A-Z]{2,6}-\d{3}-(?:PW|API|CU|MN)-\d{2})_([A-Za-z0-9]{8})$/;
const OBSERVED_AT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))(?:$|\s|（)/;

/** 検出した問題の蓄積先。{ file, message } の配列 */
const issues = [];

function report(file, message) {
  issues.push({ file, message });
}

/** 指定ディレクトリ以下を再帰的に走査し、拡張子が一致するファイルパスを返す */
function listFiles(dir, extension) {
  if (!existsSync(dir)) {
    return [];
  }

  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...listFiles(fullPath, extension));
    } else if (entry.endsWith(extension)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** リポジトリルートからの相対パス表記（出力用） */
function rel(filePath) {
  return filePath.slice(ROOT.length);
}

// ---------------------------------------------------------------------------
// Step 1. Design Docの収集とパース
// ---------------------------------------------------------------------------

/**
 * 1つのDesign Docから次を抽出する。
 * - Parent Case ID: メタデータ表の「Parent Case ID」行
 * - Check一覧の各行: 6列表のデータ行
 *   （列順はテンプレート固定: ID / Execution mode / Exploration mode / Tier / Status / Code）
 * - 各Checkの判定: 「### ... <Check ID>: ...」見出しの節にあるStatus判定表
 */
function parseDesignDoc(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return parseDesignDocContent(filePath, content);
}

function normalizeMarkdownCode(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^`([^`]*)`$/);
  return (match?.[1] ?? trimmed).trim();
}

function parseRunEnvironment(value) {
  const fields = new Map();
  const duplicates = new Set();
  for (const segment of value.split(/[;；]/)) {
    const match = segment.trim().match(/^([^:：]+?)\s*[:：]\s*(.*)$/s);
    if (match === null) {
      continue;
    }
    const [, label, fieldValue] = match;
    if (fields.has(label)) {
      duplicates.add(label);
    } else {
      fields.set(label, fieldValue.trim());
    }
  }
  return { fields, duplicates };
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidDateTimeParts(year, month, day, hour, minute, second) {
  const daysByMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year >= 1 &&
    month >= 1 && month <= 12 &&
    day >= 1 && day <= daysByMonth[month - 1] &&
    hour >= 0 && hour <= 23 &&
    minute >= 0 && minute <= 59 &&
    second >= 0 && second <= 59
  );
}

function parseObservedAt(value) {
  const match = value.match(OBSERVED_AT_PATTERN);
  if (match === null) {
    return undefined;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText,
    fraction = '', zone, sign, offsetHourText = '0', offsetMinuteText = '0'] = match;
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetHourText,
    offsetMinuteText,
  ].map(Number);
  if (
    !isValidDateTimeParts(year, month, day, hour, minute, second) ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return undefined;
  }

  const milliseconds = Number(fraction.padEnd(3, '0').slice(0, 3));
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, milliseconds);
  const offsetDirection = zone === 'Z' ? 0 : (sign === '+' ? 1 : -1);
  const offsetMilliseconds = offsetDirection * (offsetHour * 60 + offsetMinute) * 60_000;
  return { epochMilliseconds: date.getTime() - offsetMilliseconds };
}

function isValidRunIdTimestamp(value) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d{3})$/);
  if (match === null) {
    return false;
  }
  const [, year, month, day, hour, minute, second] = match.map(Number);
  return isValidDateTimeParts(year, month, day, hour, minute, second);
}

function containsRunEnvironmentPlaceholder(rawValue) {
  const { fields } = parseRunEnvironment(rawValue);
  if (fields.size === 0) {
    return containsContractPlaceholder(rawValue);
  }

  const runId = normalizeMarkdownCode(fields.get('Run ID') ?? '');
  const runIdIsStructured = RUN_ID_PATTERN.test(runId);
  let foundContractField = false;
  for (const field of ['Run ID', ...RUN_ENVIRONMENT_REQUIRED_FIELDS]) {
    const value = fields.get(field);
    if (value === undefined) {
      continue;
    }
    foundContractField = true;
    if (field === 'Run ID' && runIdIsStructured) {
      continue;
    }
    let placeholderCandidate = value;
    if (field === 'Session' && runIdIsStructured) {
      placeholderCandidate = value.replace(new RegExp(escapeRegExp(runId), 'gi'), '');
    }
    if (containsContractPlaceholder(placeholderCandidate)) {
      return true;
    }
  }
  return !foundContractField && containsContractPlaceholder(rawValue);
}

function artifactsReferenceRunId(artifacts, runId) {
  return artifacts.split(/[\s\/,;:()（）`'"\[\]]+/u).includes(runId);
}

function containsArtifactPlaceholder(artifacts, rawRunEnvironment) {
  const { fields } = parseRunEnvironment(rawRunEnvironment);
  const runId = normalizeMarkdownCode(fields.get('Run ID') ?? '');
  const placeholderCandidate = RUN_ID_PATTERN.test(runId)
    ? artifacts.replaceAll(runId, '')
    : artifacts;
  return containsContractPlaceholder(placeholderCandidate);
}

function validateRunEnvironment(check, rawValue, artifacts) {
  const problems = [];
  const { fields, duplicates } = parseRunEnvironment(rawValue);

  if (!fields.has('Run ID')) {
    problems.push('の探索サマリ「Run / 観測環境」に「Run ID」がありません');
  }
  for (const field of RUN_ENVIRONMENT_REQUIRED_FIELDS) {
    if (!fields.has(field) || fields.get(field) === '') {
      problems.push(`の探索サマリ「Run / 観測環境」に「${field}」がありません`);
    }
  }
  for (const field of duplicates) {
    problems.push(`の探索サマリ「Run / 観測環境」の「${field}」が重複しています`);
  }
  if (containsRunEnvironmentPlaceholder(rawValue)) {
    problems.push('の探索サマリ「Run / 観測環境」にplaceholderが残っています');
  }

  const observedAt = fields.get('Observed at') ?? '';
  if (parseObservedAt(observedAt) === undefined) {
    problems.push('の探索サマリ「Observed at」はタイムゾーン付きISO日時にしてください');
  }

  if (!fields.has('Run ID')) {
    return problems;
  }
  const runId = normalizeMarkdownCode(fields.get('Run ID') ?? '');
  const runIdMatch = runId.match(RUN_ID_PATTERN);
  if (runIdMatch === null) {
    problems.push('の探索サマリ「Run ID」が規定形式ではありません');
    return problems;
  }
  if (!isValidRunIdTimestamp(runIdMatch[1])) {
    problems.push('の探索サマリ「Run ID」の日時が成立しません');
  }
  if (runIdMatch[2] !== check.id) {
    problems.push(`の探索サマリ「Run ID」のCheck IDが対象と一致しません（${runIdMatch[2]}）`);
  }

  if (check.explorationMode === 'PLAYWRIGHT_CLI') {
    const session = normalizeMarkdownCode(fields.get('Session') ?? '');
    const runIdLower = runId.toLowerCase();
    if (session !== `explore-${runIdLower}` && session !== `heal-${runIdLower}`) {
      problems.push('の探索サマリ「Session」が同じRun IDの規定session名ではありません');
    }
  }
  if (artifacts !== 'なし' && !artifactsReferenceRunId(artifacts, runId)) {
    problems.push('の探索サマリ「Artifacts」に同じRun IDのpath segmentがありません');
  }
  return problems;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function preserveOnlyNewlines(value) {
  return value.replace(/[^\n]/g, '');
}

function stripNonRenderedMarkdown(content) {
  const withoutComments = content.replace(
    /<!--[\s\S]*?(?:-->|$)/g,
    (comment) => preserveOnlyNewlines(comment),
  );
  const lines = withoutComments.split('\n');
  let activeFence;

  return lines.map((line) => {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (activeFence === undefined) {
      if (fence === null) {
        return line;
      }
      activeFence = { character: fence[1][0], length: fence[1].length };
      return '';
    }

    const closingPattern = new RegExp(
      `^\\s{0,3}${escapeRegExp(activeFence.character)}{${activeFence.length},}\\s*$`,
    );
    if (closingPattern.test(line)) {
      activeFence = undefined;
    }
    return '';
  }).join('\n');
}

function extractAtxHeadingText(line, level) {
  const marker = '#'.repeat(level);
  const match = line.match(
    new RegExp(`^ {0,3}${marker}(?!#)[\\t ]+(.+?)[\\t ]*#*[\\t ]*$`),
  );
  return match?.[1];
}

function extractH2Sections(content, heading) {
  const lines = content.split('\n');
  const headingIndexes = [];
  const expectedHeading = normalizeContractToken(heading);
  for (const [index, line] of lines.entries()) {
    const renderedHeading = extractAtxHeadingText(line, 2);
    const normalizedHeading = normalizeContractToken(renderedHeading)
      .replace(/^\d+\.\s*/, '');
    if (normalizedHeading === expectedHeading) {
      headingIndexes.push(index);
    }
  }

  return headingIndexes.map((headingIndex) => {
    let endIndex = lines.length;
    for (let index = headingIndex + 1; index < lines.length; index += 1) {
      if (extractAtxHeadingText(lines[index] ?? '', 2) !== undefined) {
        endIndex = index;
        break;
      }
    }
    return lines.slice(headingIndex + 1, endIndex).join('\n');
  });
}

function extractH2Section(content, heading) {
  const sections = extractH2Sections(content, heading);
  return sections.length === 1 ? sections[0] : '';
}

function extractCheckList(content) {
  return extractH2Section(content, 'Check一覧');
}

function extractMetadata(content) {
  return extractH2Section(content, 'メタデータ');
}

function extractCheckSections(content, checkId) {
  const lines = content.split('\n');
  const headingPattern = new RegExp(
    `^###\\s+\\d+\\.\\d+\\s+${escapeRegExp(checkId)}\\s*:`,
  );
  const headingIndexes = [];
  for (const [index, line] of lines.entries()) {
    if (headingPattern.test(line)) {
      headingIndexes.push(index);
    }
  }

  return headingIndexes.map((headingIndex) => {
    let endIndex = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i += 1) {
      if (/^###\s/.test(lines[i] ?? '')) {
        endIndex = i;
        break;
      }
    }
    return lines.slice(headingIndex, endIndex).join('\n');
  });
}

function extractCheckSectionIds(content) {
  const headingPattern =
    /^###\s+\d+\.\d+\s+((?:E2E|INT)-[A-Z]{2,6}-\d{3}-(?:PW|API|CU|MN)-\d{2})\s*:/;
  const ids = [];
  for (const line of content.split('\n')) {
    const match = line.match(headingPattern);
    if (match !== null) {
      ids.push(match[1]);
    }
  }
  return ids;
}

function extractSubsections(section, heading) {
  const lines = section.split('\n');
  const headingIndexes = [];
  const expectedHeading = normalizeContractToken(heading);
  for (const [index, line] of lines.entries()) {
    const renderedHeading = extractAtxHeadingText(line, 4);
    if (normalizeContractToken(renderedHeading) === expectedHeading) {
      headingIndexes.push(index);
    }
  }

  return headingIndexes.map((headingIndex) => {
    let endIndex = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i += 1) {
      if (extractAtxHeadingText(lines[i] ?? '', 4) !== undefined) {
        endIndex = i;
        break;
      }
    }
    return lines.slice(headingIndex + 1, endIndex).join('\n');
  });
}

function parseMarkdownTableRow(line) {
  let indentWidth = 0;
  for (const character of line) {
    if (character === ' ') {
      indentWidth += 1;
    } else if (character === '\t') {
      indentWidth += 4 - (indentWidth % 4);
    } else {
      break;
    }
  }
  if (indentWidth >= 4) {
    return undefined; // Markdown上はindented code blockとなる
  }

  const trimmed = line.trim();
  const delimiters = [];
  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] !== '|') {
      continue;
    }
    let precedingBackslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && trimmed[cursor] === '\\'; cursor -= 1) {
      precedingBackslashes += 1;
    }
    if (precedingBackslashes % 2 === 0) {
      delimiters.push(index);
    }
  }
  if (trimmed === '') {
    return undefined;
  }
  if (delimiters.length === 0) {
    // GFMではtable直後の空行まで、pipeのない行も不足セルを持つdata rowとなる。
    return [trimmed];
  }

  const cells = [];
  let cellStart = 0;
  for (const delimiter of delimiters) {
    cells.push(trimmed.slice(cellStart, delimiter).trim());
    cellStart = delimiter + 1;
  }
  cells.push(trimmed.slice(cellStart).trim());
  if (delimiters[0] === 0) {
    cells.shift();
  }
  if (delimiters.at(-1) === trimmed.length - 1) {
    cells.pop();
  }
  return cells;
}

function isTableInterruptingBlock(line) {
  let indentWidth = 0;
  let contentStart = 0;
  for (const [index, character] of [...line].entries()) {
    if (character === ' ') {
      indentWidth += 1;
    } else if (character === '\t') {
      indentWidth += 4 - (indentWidth % 4);
    } else {
      contentStart = index;
      break;
    }
  }
  if (indentWidth >= 4) {
    return true;
  }

  const content = line.slice(contentStart).trimEnd();
  return (
    /^(?:>|#{1,6}(?:\s|$)|`{3,}|~{3,}|(?:[-+*]|\d+[.)])\s+)/.test(content) ||
    /^(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(content) ||
    /^<(?:address|article|aside|blockquote|details|dialog|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|ul)(?:\s|\/?>)/i.test(content)
  );
}

function parseStrictMarkdownTable(content, expectedHeader) {
  const lines = content.split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() !== '');
  if (headerIndex === -1) {
    return { valid: false, rows: [] };
  }
  const delimiterIndex = headerIndex + 1;
  const header = parseMarkdownTableRow(lines[headerIndex] ?? '');
  const delimiter = parseMarkdownTableRow(lines[delimiterIndex] ?? '');
  const valid =
    header?.length === expectedHeader.length &&
    header.every((cell, index) => cell === expectedHeader[index]) &&
    delimiter?.length === expectedHeader.length &&
    delimiter.every((cell) => /^:?-{3,}:?$/.test(cell));

  if (!valid) {
    return { valid: false, rows: [] };
  }

  const rows = [];
  for (const line of lines.slice(delimiterIndex + 1)) {
    if (line.trim() === '' || isTableInterruptingBlock(line)) {
      break;
    }
    const cells = parseMarkdownTableRow(line);
    if (cells === undefined) {
      break;
    }
    if (cells.length !== expectedHeader.length) {
      return { valid: false, rows: [] };
    }
    rows.push(cells);
  }
  return { valid: true, rows };
}

function extractSingletonKeyValue(table, expectedKey) {
  const normalizedExpectedKey = normalizeContractToken(expectedKey);
  if (
    !table.valid ||
    table.rows.some(([key]) => (
      normalizeContractToken(key) === normalizeContractToken('項目') ||
      /^:?-{3,}:?$/.test(key)
    ))
  ) {
    return undefined;
  }
  const matchingRows = table.rows.filter(
    ([key]) => normalizeContractToken(key) === normalizedExpectedKey,
  );
  return matchingRows.length === 1 ? matchingRows[0][1].trim() : undefined;
}

function parseExplorationSummary(section) {
  const bodies = extractSubsections(section, '探索サマリ');
  const headingCount = bodies.length;
  const body = bodies[0];
  const fields = new Map();
  const duplicates = new Set();
  const unknownFields = new Set();
  let tableValid = false;

  if (body !== undefined) {
    const table = parseStrictMarkdownTable(body, ['項目', '値']);
    tableValid = table.valid;
    for (const cells of table.rows) {
      const [key, value] = cells;
      if (!EXPLORATION_SUMMARY_FIELDS.includes(key)) {
        unknownFields.add(key);
        continue;
      }
      if (fields.has(key)) {
        duplicates.add(key);
      } else {
        fields.set(key, value);
      }
    }
  }

  return { headingCount, fields, duplicates, unknownFields, tableValid };
}

export function parseDesignDocContent(filePath, content) {
  const renderedContent = stripNonRenderedMarkdown(content);
  const checkListTable = parseStrictMarkdownTable(
    extractCheckList(renderedContent),
    ['Check ID', 'Execution mode', 'Exploration mode', 'Tier', 'Status', 'Code / 手順'],
  );

  const metadataTable = parseStrictMarkdownTable(
    extractMetadata(renderedContent),
    ['項目', '値'],
  );
  const parentCaseId = extractSingletonKeyValue(metadataTable, 'Parent Case ID');

  const checks = [];
  for (const cells of checkListTable.rows) {
    const id = cells[0] ?? '';
    const sections = extractCheckSections(renderedContent, id);
    const section = sections[0];
    checks.push({
      id,
      executionMode: normalizeMarkdownCode(cells[1] ?? ''),
      explorationMode: normalizeMarkdownCode(cells[2] ?? ''),
      tier: cells[3] ?? '',
      status: cells[4] ?? '',
      // MODE部分（PW/API/CU/MN）。ID形式が不正な場合はundefined
      mode: id.match(CHECK_ID_PATTERN)?.[2],
      // このCheckの節にある「Test Status判定根拠」表の判定値
      judgement: extractJudgement(section),
      section,
      sectionCount: sections.length,
    });
  }

  return {
    file: filePath,
    parentCaseId,
    checks,
    checkSectionIds: extractCheckSectionIds(renderedContent),
  };
}

export function findOrphanCheckSectionIds(doc) {
  const listedCheckIds = new Set(doc.checks.map((check) => check.id));
  return [...new Set(
    (doc.checkSectionIds ?? []).filter((checkId) => !listedCheckIds.has(checkId)),
  )];
}

export function findDuplicateParentCaseIds(docs) {
  const firstFileByParentId = new Map();
  const duplicates = [];
  for (const doc of docs) {
    if (doc.parentCaseId === undefined) {
      continue;
    }
    const firstFile = firstFileByParentId.get(doc.parentCaseId);
    if (firstFile === undefined) {
      firstFileByParentId.set(doc.parentCaseId, doc.file);
      continue;
    }
    duplicates.push({
      parentCaseId: doc.parentCaseId,
      file: doc.file,
      firstFile,
    });
  }
  return duplicates;
}

export function validateParentCaseArea(parentCaseId, registeredAreas) {
  const area = parentCaseId?.match(PARENT_ID_PATTERN)?.[2];
  if (area === undefined || registeredAreas.has(area)) {
    return [];
  }
  return [`Parent Case ID「${parentCaseId}」のArea「${area}」がAreaレジストリにありません`];
}

/**
 * 「### 3.x <Check ID>: ...」見出しから次の同レベル見出しまでを切り出し、
 * その範囲内の「Test Status判定根拠」表から判定値を取り出す。
 * 見出しまたは判定行が見つからない場合はundefinedを返す。
 */
function extractJudgement(section) {
  if (section === undefined) {
    return undefined;
  }
  const bodies = extractSubsections(section, 'Test Status判定根拠');
  if (bodies.length !== 1) {
    return undefined;
  }
  const table = parseStrictMarkdownTable(bodies[0], ['項目', '値']);
  return extractSingletonKeyValue(table, '判定');
}

export function validateExplorationSummary(check) {
  const problems = [];
  const expectedExecutionMode = EXECUTION_MODE_BY_CHECK_MODE.get(check.mode);
  if (
    expectedExecutionMode !== undefined &&
    check.executionMode !== expectedExecutionMode
  ) {
    problems.push(
      `のExecution modeが不一致です（Check mode=${check.mode}では` +
      `${expectedExecutionMode}が必要ですが、${check.executionMode}です）`,
    );
  }
  const sectionCount = check.sectionCount ?? (check.section === undefined ? 0 : 1);
  if (sectionCount !== 1) {
    problems.push(`のCheck節は1件必要です（現在: ${sectionCount}件）`);
  }
  if (check.section === undefined) {
    return problems;
  }

  const summary = parseExplorationSummary(check.section);
  if (summary.headingCount !== 1) {
    problems.push(`の「探索サマリ」は1件必要です（現在: ${summary.headingCount}件）`);
  }
  if (!summary.tableValid) {
    problems.push('の探索サマリ表は「項目」「値」の2列とdelimiter行が必要です');
  }
  for (const field of EXPLORATION_SUMMARY_FIELDS) {
    if (!summary.fields.has(field)) {
      problems.push(`の探索サマリに「${field}」行がありません`);
    } else if ((summary.fields.get(field) ?? '').trim() === '') {
      problems.push(`の探索サマリ「${field}」が空です`);
    }
  }
  for (const field of summary.duplicates) {
    problems.push(`の探索サマリ「${field}」行が重複しています`);
  }
  for (const field of summary.unknownFields) {
    problems.push(`の探索サマリに定義外の「${field}」行があります`);
  }

  const summaryModeValue = summary.fields.get('Exploration mode');
  if (summaryModeValue === undefined) {
    return problems;
  }
  const summaryMode = normalizeMarkdownCode(summaryModeValue);
  if (summaryMode !== check.explorationMode) {
    problems.push(
      `のExploration modeが不一致です（Check一覧: ${check.explorationMode} / ` +
      `探索サマリ: ${summaryMode}）`
    );
  }

  const allowedModes = VALID_EXPLORATION_MODES_BY_CHECK_MODE.get(check.mode);
  if (allowedModes !== undefined && !allowedModes.has(check.explorationMode)) {
    problems.push(
      `のExploration mode「${check.explorationMode}」はCheck mode=${check.mode}では使用できません`
    );
  }

  if (check.explorationMode === 'NONE') {
    for (const [field, expected] of NONE_EXPLORATION_SUMMARY_VALUES) {
      const actual = summary.fields.get(field);
      if (actual !== undefined && actual !== expected) {
        problems.push(
          `はExploration mode=NONEですが、探索サマリ「${field}」が「${expected}」ではありません`
        );
      }
    }
    const purposeSections = extractSubsections(check.section, '探索目的');
    if (purposeSections.length !== 1) {
      problems.push(`の「探索目的」は1件必要です（現在: ${purposeSections.length}件）`);
    }
    const purpose = purposeSections.length === 1 ? purposeSections[0] : '';
    const reason = purpose.match(/対象外（([^）]+)）/s)?.[1].trim();
    if (!isConcreteNoneReason(reason)) {
      problems.push('はExploration mode=NONEですが、「探索目的」に具体的な対象外理由がありません');
    }
  }

  const runEnvironment = summary.fields.get('Run / 観測環境') ?? '';
  const normalizedRunEnvironment = normalizeContractToken(runEnvironment);
  const runEnvironmentIsComplete =
    check.explorationMode !== 'NONE' &&
    !INCOMPLETE_EXPLORATION_VALUES.has(normalizedRunEnvironment);
  if (runEnvironmentIsComplete) {
    const artifacts = summary.fields.get('Artifacts') ?? '';
    problems.push(...validateRunEnvironment(check, runEnvironment, artifacts));
  }

  if (check.explorationMode !== 'NONE' && check.status !== 'DRAFT') {
    for (const field of ['Run / 観測環境', '観測サマリ']) {
      const rawValue = summary.fields.get(field) ?? '';
      const value = normalizeContractToken(rawValue);
      const hasPlaceholder = field === 'Run / 観測環境'
        ? containsRunEnvironmentPlaceholder(rawValue)
        : containsContractPlaceholder(rawValue);
      if (
        INCOMPLETE_EXPLORATION_VALUES.has(value) ||
        hasPlaceholder
      ) {
        problems.push(`はStatus=${check.status}ですが、探索サマリ「${field}」が未完了です`);
      }
    }

    const candidate = summary.fields.get('実装候補（レビュー対象）') ?? '';
    const reflectedTarget = candidate.match(/^反映済み（(.+)）$/)?.[1];
    if (
      candidate !== 'なし' &&
      (reflectedTarget === undefined || containsContractPlaceholder(reflectedTarget))
    ) {
      problems.push(
        `はStatus=${check.status}ですが、実装候補が「反映済み（反映先）」または「なし」ではありません`
      );
    }
    const question = summary.fields.get('観測上の疑問・要判断') ?? '';
    if (question !== 'なし') {
      problems.push(`はStatus=${check.status}ですが、観測上の疑問・要判断が解消されていません`);
    }
    const artifacts = summary.fields.get('Artifacts') ?? '';
    if (
      artifacts !== 'なし' &&
      containsArtifactPlaceholder(artifacts, runEnvironment)
    ) {
      problems.push(`はStatus=${check.status}ですが、探索サマリ「Artifacts」が未完了です`);
    }
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Step 2. specの収集とパース
// ---------------------------------------------------------------------------

/**
 * 1つのspecファイルからtest()のタイトルを抽出する。
 * test.describe()は対象外とし、modifier付き（test.fixme等）は検出対象に含める
 * （fixme/skipは運用ルール上禁止のため、存在すればタイトル経由で気付ける）。
 */
function parseSpecTitles(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const titles = [];

  // タイトルに続くtest details object（{ tag: '@smoke' } 等）も任意で取り込む。
  // - タイトル部はエスケープされた引用符（\'等）を終端と誤認しない
  // - details objectは入れ子1段（{ annotation: { ... }, tag: '@smoke' } 等）まで
  //   対応する。プロパティの記述順に依存しない
  const testCallPattern =
    /\btest(?:\.(?:only|fixme|fail|skip|slow))?\s*\(\s*(['"`])((?:\\[\s\S]|(?!\1)[^\\])*)\1\s*(?:,\s*(\{(?:[^{}]|\{[^{}]*\})*\}))?/g;
  // タグ名は完全なトークンで抽出する（@smoke-fastから@smokeを誤抽出しない）
  const TAG_TOKEN = /@[a-z][a-z0-9-]*/g;
  for (const match of content.matchAll(testCallPattern)) {
    const title = match[2] ?? '';
    const details = match[3] ?? '';
    // tagオプションの値は文字列（'@smoke'）と配列（['@a', '@b']）の両形式に対応
    const tagOption = details.match(/\btag\s*:\s*(\[[^\]]*\]|(['"`])@[^'"`]+\2)/)?.[1] ?? '';
    titles.push({
      file: filePath,
      title,
      checkId: title.match(CHECK_ID_LOOSE)?.[0], // タイトル内のCheck ID（なければundefined）
      // tagオプションとタイトル埋め込みの両方から@smoke、@quarantine等を集約
      tags: new Set([
        ...(title.match(TAG_TOKEN) ?? []),
        ...(tagOption.match(TAG_TOKEN) ?? []),
      ]),
    });
  }
  return titles;
}

// ---------------------------------------------------------------------------
// Step 3. 突き合わせチェック
// ---------------------------------------------------------------------------

function main() {
  const registeredAreas = parseAreaRegistryContent(readFileSync(AREA_REGISTRY_PATH, 'utf8'));
  // Step 1: Doc収集（templates/と_archive/は対象外のため、e2e/intディレクトリのみ走査）
  const docFiles = [
    ...listFiles(join(ROOT, 'test-designs', 'e2e'), '.md'),
    ...listFiles(join(ROOT, 'test-designs', 'int'), '.md'),
  ];
  const docs = docFiles.map(parseDesignDoc);

  for (const duplicate of findDuplicateParentCaseIds(docs)) {
    report(
      rel(duplicate.file),
      `Parent Case ID「${duplicate.parentCaseId}」が複数のDocで定義されています` +
      `（最初のDoc: ${rel(duplicate.firstFile)}）`,
    );
  }

  // Step 2: spec収集
  const specTitles = listFiles(join(ROOT, 'e2e'), '.spec.ts').flatMap(parseSpecTitles);

  // 突き合わせ用の索引を作る
  // - specIndex: Check ID → タイトル情報（重複実装はここで検出）
  const specIndex = new Map();
  for (const entry of specTitles) {
    if (entry.checkId === undefined) {
      continue; // Check IDなしのタイトルはルールNo.9で個別に報告する
    }
    if (specIndex.has(entry.checkId)) {
      report(entry.file, `Check ID「${entry.checkId}」のテストが複数存在します`);
      continue;
    }
    specIndex.set(entry.checkId, entry);
  }
  // - docCheckIds: Doc側に定義された全Check ID（specの孤児検出に使う）
  const docCheckIds = new Set();

  // --- Doc側を起点としたチェック（ルールNo.1〜8） ---
  for (const doc of docs) {
    const docPath = rel(doc.file);

    if (doc.parentCaseId === undefined) {
      report(docPath, 'メタデータ表に一意なParent Case IDが見つかりません');
      continue;
    }

    // ルールNo.1（前半）: Parent Case ID自体の形式
    if (!PARENT_ID_PATTERN.test(doc.parentCaseId)) {
      report(docPath, `Parent Case ID「${doc.parentCaseId}」が命名規則に従っていません`);
      continue;
    }

    for (const problem of validateParentCaseArea(doc.parentCaseId, registeredAreas)) {
      report(docPath, problem);
    }

    // ルールNo.3（後半）: ファイル名は「<Parent Case ID>-<slug>.md」形式
    if (!basename(doc.file).startsWith(`${doc.parentCaseId}-`)) {
      report(docPath, `ファイル名がParent Case ID「${doc.parentCaseId}」で始まっていません`);
    }

    if (doc.checks.length === 0) {
      report(docPath, 'Check一覧からCheckを1件も読み取れませんでした');
    }

    for (const checkId of findOrphanCheckSectionIds(doc)) {
      report(docPath, `Check節「${checkId}」がCheck一覧にありません`);
    }

    for (const check of doc.checks) {
      // ルールNo.1: ID形式
      if (!CHECK_ID_PATTERN.test(check.id)) {
        report(docPath, `Check ID「${check.id}」が命名規則に従っていません`);
        continue; // 形式不正のIDは以降のチェック対象にしない
      }

      // Check IDは自Docの Parent Case ID + MODE + 連番 で構成される
      if (!check.id.startsWith(`${doc.parentCaseId}-`)) {
        report(docPath, `Check ID「${check.id}」がParent Case ID「${doc.parentCaseId}」に属していません`);
      }

      // ルールNo.2: 全Doc横断の重複
      if (docCheckIds.has(check.id)) {
        report(docPath, `Check ID「${check.id}」が複数のDocで定義されています`);
      }
      docCheckIds.add(check.id);

      // ルールNo.3: Tier値
      if (!VALID_TIERS.has(check.tier)) {
        report(docPath, `「${check.id}」のTier「${check.tier}」は不正な値です（SMOKE/REGRESSION/EXTENDEDのいずれか）`);
      }

      // ルールNo.3（前半）: Status値
      if (!VALID_STATUSES.has(check.status)) {
        report(docPath, `「${check.id}」のStatus「${check.status}」は不正な値です`);
        continue; // Statusが読めない場合、以降のStatus依存チェックは行えない
      }

      // ルールNo.10: 探索サマリの構造・mode・Statusごとの状態契約
      for (const problem of validateExplorationSummary(check)) {
        report(docPath, `「${check.id}」${problem}`);
      }

      // ルールNo.4: Check一覧のStatusと判定根拠表の判定の一致
      if (check.judgement === undefined) {
        report(docPath, `「${check.id}」のTest Status判定根拠に一意な「判定」行が見つかりません`);
      } else if (check.judgement !== check.status) {
        report(
          docPath,
          `「${check.id}」のStatusが不一致です（Check一覧: ${check.status} / 判定根拠: ${check.judgement}）`
        );
      }

      const spec = specIndex.get(check.id);

      // ルールNo.8: CU/MNは自動実行対象外のため、specに存在してはならない
      if (!AUTOMATED_MODES.has(check.mode)) {
        if (spec !== undefined) {
          report(rel(spec.file), `CU/MN Check「${check.id}」のテストがspecに存在します`);
        }
        continue; // CU/MNにはspec前提のルールNo.5〜7を適用しない
      }

      // ルールNo.5: Statusとspec実装の存在の対応
      if (spec === undefined) {
        if (STATUSES_REQUIRING_SPEC.has(check.status)) {
          report(docPath, `「${check.id}」はStatus=${check.status}ですが、対応するテストがspecにありません`);
        }
        continue; // spec未実装（DRAFT等）ならタグのチェックは行えない
      }
      if (check.status === 'RETIRED') {
        report(rel(spec.file), `RETIREDの「${check.id}」のテストがspecに残っています`);
      }

      // ルールNo.6: QUARANTINEと@quarantineタグの両方向一致
      if (check.status === 'QUARANTINE' && !spec.tags.has('@quarantine')) {
        report(rel(spec.file), `QUARANTINE中の「${check.id}」のテストに@quarantineタグがありません`);
      }
      if (check.status !== 'QUARANTINE' && spec.tags.has('@quarantine')) {
        report(rel(spec.file), `「${check.id}」に@quarantineタグがありますが、DocのStatusは${check.status}です`);
      }

      // ルールNo.7: SMOKE Tierと@smokeタグの両方向一致
      if (check.tier === 'SMOKE' && !spec.tags.has('@smoke')) {
        report(rel(spec.file), `SMOKE Tierの「${check.id}」のテストに@smokeタグがありません`);
      }
      if (check.tier !== 'SMOKE' && spec.tags.has('@smoke')) {
        report(rel(spec.file), `「${check.id}」に@smokeタグがありますが、DocのTierは${check.tier}です`);
      }
    }
  }

  // --- spec側を起点としたチェック（ルールNo.9） ---
  for (const entry of specTitles) {
    const specPath = rel(entry.file);

    if (entry.checkId === undefined) {
      report(specPath, `タイトル「${entry.title}」にCheck IDが含まれていません`);
      continue;
    }
    if (!entry.title.startsWith(entry.checkId)) {
      report(specPath, `タイトル「${entry.title}」がCheck IDで始まっていません`);
    }
    if (!docCheckIds.has(entry.checkId)) {
      report(specPath, `「${entry.checkId}」のテストに対応するDesign Docが存在しません`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 4. 結果出力
  // -------------------------------------------------------------------------
  const summary =
    `Doc: ${docs.length}件 / Check: ${docCheckIds.size}件 / ` +
    `specタイトル: ${specTitles.length}件`;

  if (issues.length === 0) {
    console.log(`✔ 整合チェック: 問題なし（${summary}）`);
    return;
  }

  console.error(`✖ 整合チェック: ${issues.length}件の問題（${summary}）\n`);
  for (const issue of issues) {
    console.error(`  - ${issue.file}: ${issue.message}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
