export const VALID_EXPLORATION_MODES_BY_CHECK_MODE = new Map([
  ['PW', new Set(['NONE', 'PLAYWRIGHT_CLI'])],
  ['API', new Set(['NONE', 'API_INTEGRATION'])],
  ['CU', new Set(['NONE', 'COMPUTER_USE'])],
  ['MN', new Set(['NONE', 'MANUAL'])],
]);

const NONE_REASON_PLACEHOLDERS = new Set([
  '理由',
  'TBD',
  'TODO',
  '未記入',
  '未定',
  'なし',
]);

const MARKDOWN_WRAPPERS = [
  /^(`+)([\s\S]*)\1$/,
  /^\*\*([\s\S]*)\*\*$/,
  /^__([\s\S]*)__$/,
  /^~~([\s\S]*)~~$/,
  /^\*([\s\S]*)\*$/,
  /^_([\s\S]*)_$/,
  /^\[([\s\S]*)\]\([^)]*\)$/,
];

export function normalizeContractToken(value) {
  let normalized = value?.trim() ?? '';
  let changed = true;
  while (changed && normalized !== '') {
    changed = false;
    for (const pattern of MARKDOWN_WRAPPERS) {
      const match = normalized.match(pattern);
      if (match === null) {
        continue;
      }
      normalized = (match[2] ?? match[1] ?? '').trim();
      changed = true;
      break;
    }
  }
  return normalized.replace(/\s+/g, ' ').toUpperCase();
}

export function isConcreteNoneReason(value) {
  const normalized = normalizeContractToken(value);
  if (normalized === '') {
    return false;
  }
  return !NONE_REASON_PLACEHOLDERS.has(normalized);
}
