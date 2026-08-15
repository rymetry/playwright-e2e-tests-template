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

const HTML_ENTITIES = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['gt', '>'],
  ['lt', '<'],
  ['nbsp', ' '],
  ['quot', '"'],
]);

function decodeHtmlEntities(value) {
  return value.replace(/&(?:#(x[0-9a-f]+|\d+)|([a-z]+));/gi, (match, numeric, named) => {
    if (numeric !== undefined) {
      const radix = numeric[0].toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? numeric.slice(1) : numeric;
      const codePoint = Number.parseInt(digits, radix);
      if (Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
      return match;
    }
    return HTML_ENTITIES.get(named.toLowerCase()) ?? match;
  });
}

export function normalizeContractToken(value) {
  let normalized = decodeHtmlEntities(value?.trim() ?? '');
  // 表示上の文字列を契約値として扱い、部分的なMarkdown装飾やlinkも除去する。
  normalized = normalized
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/!\[([^\]]*)\]\((?:[^()\\]|\\.|\([^()]*\))*\)/g, '$1')
    .replace(/\[([^\]]+)\]\((?:[^()\\]|\\.|\([^()]*\))*\)/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/[`*_~]/g, '')
    .trim();
  return normalized.replace(/\s+/g, ' ').toUpperCase();
}

export function containsContractPlaceholder(value) {
  const normalized = normalizeContractToken(value);
  return (
    normalized === '' ||
    NONE_REASON_PLACEHOLDERS.has(normalized) ||
    /^(?:TBD|TODO)(?=$|[\s:：。、,，.!！?？(（【\[])/.test(normalized) ||
    /^(?:未実施|未記入|未定)(?=$|[\s:：。、,，.!！?？(（【\[]|です|でした|である|の)/.test(normalized)
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
