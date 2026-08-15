export const VALID_EXPLORATION_MODES_BY_CHECK_MODE = new Map([
  ['PW', new Set(['NONE', 'PLAYWRIGHT_CLI'])],
  ['API', new Set(['NONE', 'API_INTEGRATION'])],
  ['CU', new Set(['NONE', 'COMPUTER_USE'])],
  ['MN', new Set(['NONE', 'MANUAL'])],
]);

export const EXECUTION_MODE_BY_CHECK_MODE = new Map([
  ['PW', 'PLAYWRIGHT'],
  ['API', 'API'],
  ['CU', 'COMPUTER_USE'],
  ['MN', 'MANUAL'],
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
  // Markdown内で有効なinline HTMLも、装飾の有無で契約値が変わらないよう除去する。
  normalized = normalized.replace(/<\/?[A-Za-z][^>]*>/g, '').trim();
  return normalized.replace(/\s+/g, ' ').toUpperCase();
}

export function containsContractPlaceholder(value) {
  const normalized = normalizeContractToken(value);
  return (
    normalized === '' ||
    NONE_REASON_PLACEHOLDERS.has(normalized) ||
    /(?:^|\b)(?:TBD|TODO)(?:\b|$)/.test(normalized) ||
    /未実施|未記入|未定/.test(normalized)
  );
}

export function parseAreaRegistryContent(content) {
  let registry;
  try {
    registry = JSON.parse(content);
  } catch (error) {
    throw new Error(`Areaレジストリが有効なJSONではありません: ${error.message}`);
  }
  if (registry === null || Array.isArray(registry) || typeof registry !== 'object') {
    throw new Error('AreaレジストリはAreaコードをkeyに持つobjectにしてください');
  }

  const areas = new Set();
  for (const [area, metadata] of Object.entries(registry)) {
    if (!/^[A-Z]{2,6}$/.test(area)) {
      throw new Error(`Areaレジストリのkey「${area}」は2〜6文字の大文字英字にしてください`);
    }
    if (
      metadata === null ||
      Array.isArray(metadata) ||
      typeof metadata !== 'object' ||
      typeof metadata.name !== 'string' ||
      metadata.name.trim() === ''
    ) {
      throw new Error(`Area「${area}」には空でないnameを設定してください`);
    }
    areas.add(area);
  }
  if (areas.size === 0) {
    throw new Error('Areaレジストリには1件以上のAreaを登録してください');
  }
  return areas;
}

export function isConcreteNoneReason(value) {
  return !containsContractPlaceholder(value);
}
