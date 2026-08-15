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

export function isConcreteNoneReason(value) {
  const normalized = value?.trim() ?? '';
  if (normalized === '') {
    return false;
  }
  return !NONE_REASON_PLACEHOLDERS.has(normalized.replace(/\s+/g, ' ').toUpperCase());
}
