#!/usr/bin/env node
/**
 * Claude Code / Codex のリポジトリ内skill構成を検証する。
 *
 * host中立な `skills/` を正本とし、`.claude/skills/` と `.agents/skills/` は
 * 正本を指す相対directory symlinkだけを許可する。依存パッケージを使わず、
 * 各hostのdiscovery・明示起動ポリシーと本文の可搬性をfail-closedで確認する。
 */

import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_SKILLS = ['test-design', 'explore', 'heal', 'playwright-cli'];
const WORKFLOW_SKILLS = new Set(['test-design', 'explore', 'heal']);
const HEAL_REOBSERVE = join(ROOT, 'skills', 'heal', 'references', 'reobserve.md');
const HEAL_ALLOWED_TOOLS = [
  'Bash(git status --short --branch)',
  'Bash(git rev-parse --show-toplevel)',
  'Bash(git rev-parse HEAD)',
  'Bash(git rev-parse --abbrev-ref HEAD)',
  'Bash(git diff --no-ext-diff)',
  'Bash(git diff --no-ext-diff --cached)',
  'Bash(npm run check)',
  'Bash(npm run typecheck)',
].join(' ');
const issues = [];

function displayPath(path) {
  return relative(ROOT, path) || '.';
}

function report(path, message) {
  issues.push({ file: displayPath(path), message });
}

function tryLstat(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return undefined;
    }
    report(path, `状態を確認できません: ${error.message}`);
    return undefined;
  }
}

function stripYamlComment(value) {
  const trimmed = value.trim();
  const commentIndex = trimmed.search(/\s+#/);
  return commentIndex === -1 ? trimmed : trimmed.slice(0, commentIndex).trimEnd();
}

function parseYamlScalar(path, lineNumber, rawValue) {
  const value = stripYamlComment(rawValue);
  if (value === '') {
    report(path, `frontmatter ${lineNumber}行目の値が空です`);
    return undefined;
  }

  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'string') {
        throw new TypeError('文字列ではありません');
      }
      return parsed;
    } catch (error) {
      report(path, `frontmatter ${lineNumber}行目のdouble-quoted値が不正です: ${error.message}`);
      return undefined;
    }
  }

  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) {
      report(path, `frontmatter ${lineNumber}行目のsingle-quoted値が閉じていません`);
      return undefined;
    }
    return value.slice(1, -1).replace(/''/g, "'");
  }

  if (/[:][ \t]/.test(value) || /[\[\]{}\t]/.test(value)) {
    report(path, `frontmatter ${lineNumber}行目は安全なplain scalarではありません: ${value}`);
    return undefined;
  }
  return value;
}

function parseFrontmatter(path, source) {
  const text = source.replace(/^\uFEFF/, '');
  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) {
    report(path, '先頭にYAML frontmatter（--- ... ---）がありません');
    return { fields: new Map(), body: text, bodyOffset: 0 };
  }

  const fields = new Map();
  for (const [index, line] of match[1].split(/\r?\n/).entries()) {
    const lineNumber = index + 2;
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      continue;
    }
    if (/^\s/.test(line)) {
      report(path, `frontmatter ${lineNumber}行目に未対応のindentがあります: ${line}`);
      continue;
    }

    const field = line.match(/^([a-zA-Z0-9-]+):(?:[ \t]*(.*))?$/);
    if (!field) {
      report(path, `frontmatter ${lineNumber}行目を解釈できません: ${line}`);
      continue;
    }

    const [, key, rawValue = ''] = field;
    if (fields.has(key)) {
      report(path, `frontmatterの「${key}」が重複しています`);
      continue;
    }
    const value = parseYamlScalar(path, lineNumber, rawValue);
    if (value !== undefined) {
      fields.set(key, value);
    }
  }

  return {
    fields,
    body: text.slice(match[0].length),
    bodyOffset: match[0].length,
  };
}

function hasDisabledImplicitInvocation(path) {
  const source = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  return /^policy:\n {2}allow_implicit_invocation: false\n?$/.test(source);
}

function lineNumberAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function checkPortableBody(path, source, body, bodyOffset) {
  const argumentsLines = [];
  for (const match of body.matchAll(/\$ARGUMENTS(?:\[[^\]]+\])?/g)) {
    argumentsLines.push(lineNumberAt(source, bodyOffset + match.index));
  }
  if (argumentsLines.length > 0) {
    report(
      path,
      `本文にClaude固有の$ARGUMENTSがあります（${argumentsLines.join(', ')}行）`,
    );
  }

  const slashCallLines = [];
  const slashCall = /(^|[^\w.])\/(test-design|explore|heal|playwright-cli)\b/gm;
  for (const match of body.matchAll(slashCall)) {
    const slashOffset = match.index + match[1].length;
    slashCallLines.push(lineNumberAt(source, bodyOffset + slashOffset));
  }
  if (slashCallLines.length > 0) {
    report(
      path,
      `本文にhost固有のslash skill呼出しがあります（${slashCallLines.join(', ')}行）`,
    );
  }

  const mentionCallLines = [];
  const mentionCall = /(^|[^\w])(?:\$|@)(test-design|explore|heal|playwright-cli)\b/gm;
  for (const match of body.matchAll(mentionCall)) {
    const mentionOffset = match.index + match[1].length;
    mentionCallLines.push(lineNumberAt(source, bodyOffset + mentionOffset));
  }
  if (mentionCallLines.length > 0) {
    report(
      path,
      `本文にhost固有のmention skill呼出しがあります（${mentionCallLines.join(', ')}行）`,
    );
  }
}

function checkHealContract(path, body) {
  if (/\.\.\/explore\/SKILL\.md|explore workflowを[^\n]*明示起動/.test(body)) {
    report(path, 'healから公開explore workflowを起動する記述は許可されません');
  }
}

function checkHealReobserveReference() {
  const stat = tryLstat(HEAL_REOBSERVE);
  if (!stat) {
    report(HEAL_REOBSERVE, 'heal専用の再観測参照fileがありません');
    return;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    report(HEAL_REOBSERVE, '再観測参照は正本内の通常fileである必要があります');
    return;
  }

  const source = readFileSync(HEAL_REOBSERVE, 'utf8');
  if (/^---[ \t]*\r?\n/.test(source)) {
    report(HEAL_REOBSERVE, '内部参照にskill frontmatterを置いてはいけません');
  }
  checkPortableBody(HEAL_REOBSERVE, source, source, 0);

  const requiredPhrases = [
    'skill discovery対象でも',
    'E2E_ALLOWED_ORIGINS',
    '本番環境',
    '認証情報',
    '通常のpermission確認',
    'playwright-cli',
    '再観測中はspecやTest Design Docへ書き込まない',
    'sessionをclose',
  ];
  for (const phrase of requiredPhrases) {
    if (!source.includes(phrase)) {
      report(HEAL_REOBSERVE, `再観測の安全契約に必要な記述がありません: ${phrase}`);
    }
  }
}

function checkExpectedDirectoryEntries(path, label) {
  const stat = tryLstat(path);
  if (!stat) {
    report(path, `${label} directoryがありません`);
    return;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    report(path, `${label}はsymlinkではないdirectoryである必要があります`);
    return;
  }

  const actual = readdirSync(path).filter((entry) => !entry.startsWith('.')).sort();
  const expected = [...EXPECTED_SKILLS].sort();
  if (actual.join('\0') !== expected.join('\0')) {
    report(
      path,
      `${label}のentryは「${expected.join(', ')}」だけである必要があります: ` +
        `${actual.join(', ') || '(空)'}`,
    );
  }
}

function checkSkill(name) {
  const canonicalDir = join(ROOT, 'skills', name);
  const canonicalStat = tryLstat(canonicalDir);
  let canonicalRealpath;

  if (!canonicalStat) {
    report(canonicalDir, 'host中立な正本directoryがありません');
  } else if (!canonicalStat.isDirectory() || canonicalStat.isSymbolicLink()) {
    report(canonicalDir, '正本はsymlinkではないdirectoryである必要があります');
  } else {
    canonicalRealpath = realpathSync(canonicalDir);
  }

  // Git symlinkのcontentはOSに依存しないPOSIX形式で固定する。
  const expectedTarget = `../../skills/${name}`;
  const hostEntries = [
    { host: 'Claude Code', path: join(ROOT, '.claude', 'skills', name) },
    { host: 'Codex', path: join(ROOT, '.agents', 'skills', name) },
  ];
  const hostRealpaths = [];

  for (const entry of hostEntries) {
    const entryStat = tryLstat(entry.path);
    if (!entryStat) {
      report(entry.path, `${entry.host} discovery向けsymlinkがありません`);
      continue;
    }
    if (!entryStat.isSymbolicLink()) {
      report(entry.path, `${entry.host}側entryはdirectory symlinkである必要があります`);
      continue;
    }

    const target = readlinkSync(entry.path);
    if (isAbsolute(target)) {
      report(entry.path, `symlink targetは相対pathである必要があります: ${target}`);
    } else if (target !== expectedTarget) {
      report(
        entry.path,
        `symlink targetは「${expectedTarget}」である必要があります: ${target}`,
      );
    }

    try {
      if (!statSync(entry.path).isDirectory()) {
        report(entry.path, 'symlink targetがdirectoryではありません');
        continue;
      }

      const entryRealpath = realpathSync(entry.path);
      hostRealpaths.push({ ...entry, realpath: entryRealpath });
      if (canonicalRealpath && entryRealpath !== canonicalRealpath) {
        report(entry.path, `正本と異なるtargetを指しています: ${target}`);
      }
    } catch (error) {
      report(entry.path, `symlink targetを解決できません: ${error.message}`);
    }
  }

  if (
    hostRealpaths.length === hostEntries.length &&
    hostRealpaths[0].realpath !== hostRealpaths[1].realpath
  ) {
    report(
      hostRealpaths[1].path,
      `${hostRealpaths[0].host}側と${hostRealpaths[1].host}側のrealpathが一致しません`,
    );
  }

  const skillFile = join(canonicalDir, 'SKILL.md');
  const skillStat = tryLstat(skillFile);
  if (!skillStat) {
    report(skillFile, 'SKILL.mdがありません');
    return;
  }
  if (!skillStat.isFile() || skillStat.isSymbolicLink()) {
    report(skillFile, 'SKILL.mdは正本directory内の通常fileである必要があります');
    return;
  }

  const source = readFileSync(skillFile, 'utf8');
  const { fields, body, bodyOffset } = parseFrontmatter(skillFile, source);
  if (fields.get('name') !== name) {
    report(skillFile, `frontmatter nameはdirectory名「${name}」と一致する必要があります`);
  }
  const frontmatterName = fields.get('name') ?? '';
  if (
    frontmatterName.length === 0 ||
    frontmatterName.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frontmatterName)
  ) {
    report(skillFile, 'frontmatter nameがAgent Skillsの命名規則に従っていません');
  }

  const description = fields.get('description') ?? '';
  if (description.length === 0 || description.length > 1024) {
    report(skillFile, 'frontmatter descriptionは1〜1024文字である必要があります');
  }

  const allowedFields = new Set([
    'name',
    'description',
    'license',
    'compatibility',
    'metadata',
    'allowed-tools',
    'argument-hint',
    'disable-model-invocation',
  ]);
  for (const field of fields.keys()) {
    if (!allowedFields.has(field)) {
      report(skillFile, `未検証のfrontmatter field「${field}」があります`);
    }
  }

  if (WORKFLOW_SKILLS.has(name)) {
    if (fields.get('disable-model-invocation') !== 'true') {
      report(skillFile, 'disable-model-invocation: true が必要です');
    }
    if (!fields.get('argument-hint')) {
      report(skillFile, 'Claude Code向けargument-hintが必要です');
    }

    const openaiMetadata = join(canonicalDir, 'agents', 'openai.yaml');
    const metadataStat = tryLstat(openaiMetadata);
    if (!metadataStat?.isFile()) {
      report(openaiMetadata, 'Codex向けagents/openai.yamlがありません');
    } else if (!hasDisabledImplicitInvocation(openaiMetadata)) {
      report(openaiMetadata, 'policy.allow_implicit_invocation: false が必要です');
    }

    if (name === 'heal') {
      if (fields.get('allowed-tools') !== HEAL_ALLOWED_TOOLS) {
        report(
          skillFile,
          'healのallowed-toolsはGit状態確認とlocal静的検証だけに限定する必要があります',
        );
      }
      checkHealContract(skillFile, body);
    } else if (fields.has('allowed-tools')) {
      report(skillFile, `${name} workflowはtoolをpre-approveできません`);
    }
  } else if (name === 'playwright-cli') {
    if (fields.has('disable-model-invocation')) {
      report(skillFile, 'exploreから利用するsupport skillはmodel invocationを無効化できません');
    }
    if (fields.get('allowed-tools') !== 'Bash(playwright-cli:*)') {
      report(skillFile, 'allowed-toolsはplaywright-cliだけに限定する必要があります');
    }
  }

  checkPortableBody(skillFile, source, body, bodyOffset);
}

function repositoryFiles() {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '-co', '--exclude-standard', '-z'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    return [...new Set(output.split('\0').filter(Boolean))];
  } catch (error) {
    report(ROOT, `旧参照の走査対象を取得できません: ${error.message}`);
    return [];
  }
}

function checkPublicSkillSurface() {
  const actual = repositoryFiles()
    .filter((path) => /^skills\/.+\/SKILL\.md$/.test(path))
    .sort();
  const expected = EXPECTED_SKILLS.map((name) => `skills/${name}/SKILL.md`).sort();
  if (actual.join('\0') !== expected.join('\0')) {
    report(
      join(ROOT, 'skills'),
      `公開SKILL.mdは${expected.join(', ')}だけである必要があります: ` +
        `${actual.join(', ') || '(空)'}`,
    );
  }
}

function checkLegacyReferences() {
  const legacyPatterns = [
    { label: '.claude/commands', pattern: /\.claude\/commands(?:\/|\b)/g },
    { label: '.agents/commands', pattern: /\.agents\/commands(?:\/|\b)/g },
    { label: 'explore.md', pattern: /(^|[^\w./\\-])explore\.md\b/gm },
    { label: 'Handoff ID', pattern: /Handoff ID/g },
    { label: '--resume', pattern: /--resume\b/g },
    { label: '--confirm-state', pattern: /--confirm-state\b|State Review ID/g },
    { label: '再観測handoff', pattern: /再観測(?:用)?handoff/g },
  ];

  for (const repoPath of repositoryFiles()) {
    if (repoPath === 'scripts/check-skills.mjs') {
      continue;
    }

    const path = join(ROOT, repoPath);
    const stat = tryLstat(path);
    if (!stat?.isFile() || stat.isSymbolicLink()) {
      continue;
    }

    let source;
    try {
      const buffer = readFileSync(path);
      if (buffer.includes(0)) {
        continue;
      }
      source = buffer.toString('utf8');
    } catch (error) {
      report(path, `旧参照を走査できません: ${error.message}`);
      continue;
    }

    for (const { label, pattern } of legacyPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(source);
      if (match) {
        const offset = label === 'explore.md' ? match.index + match[1].length : match.index;
        report(path, `旧参照「${label}」が残っています（${lineNumberAt(source, offset)}行）`);
      }
    }
  }
}

checkExpectedDirectoryEntries(join(ROOT, 'skills'), 'host中立な正本');
checkExpectedDirectoryEntries(join(ROOT, '.claude', 'skills'), 'Claude Code discovery');
checkExpectedDirectoryEntries(join(ROOT, '.agents', 'skills'), 'Codex discovery');
checkPublicSkillSurface();
checkHealReobserveReference();

for (const skill of EXPECTED_SKILLS) {
  checkSkill(skill);
}
checkLegacyReferences();

if (issues.length === 0) {
  console.log(
    `✔ Skillチェック: 問題なし（中立正本: ${EXPECTED_SKILLS.length}件 / ` +
      `Claude symlink: ${EXPECTED_SKILLS.length}件 / ` +
      `Codex symlink: ${EXPECTED_SKILLS.length}件）`,
  );
} else {
  console.error(`✖ Skillチェック: ${issues.length}件の問題\n`);
  for (const issue of issues) {
    console.error(`  - ${issue.file}: ${issue.message}`);
  }
  process.exitCode = 1;
}
