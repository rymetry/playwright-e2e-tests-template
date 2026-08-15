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
  ['emsp', ' '],
  ['ensp', ' '],
  ['gt', '>'],
  ['hairsp', ' '],
  ['lt', '<'],
  ['newline', ' '],
  ['nbsp', ' '],
  ['nobreak', ''],
  ['quot', '"'],
  ['tab', ' '],
  ['thinsp', ' '],
  ['zerowidthspace', ''],
  ['zwj', ''],
  ['zwnj', ''],
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

function stripHtmlMarkup(value) {
  let result = '';
  for (let index = 0; index < value.length;) {
    if (value.startsWith('<!--', index)) {
      const commentEnd = value.indexOf('-->', index + 4);
      index = commentEnd === -1 ? value.length : commentEnd + 3;
      continue;
    }

    const tagStart = value[index] === '<' && /^\/?[A-Za-z]/.test(value.slice(index + 1));
    if (!tagStart) {
      result += value[index];
      index += 1;
      continue;
    }

    let quote;
    let cursor = index + 1;
    for (; cursor < value.length; cursor += 1) {
      const character = value[cursor];
      if (quote !== undefined) {
        if (character === quote) {
          quote = undefined;
        }
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        break;
      }
    }
    if (cursor === value.length) {
      result += value[index];
      index += 1;
    } else {
      index = cursor + 1;
    }
  }
  return result;
}

function stripInlineLinkDestinations(value) {
  let result = '';
  for (let index = 0; index < value.length;) {
    if (value[index] !== ']' || value[index + 1] !== '(') {
      result += value[index];
      index += 1;
      continue;
    }

    let depth = 1;
    let cursor = index + 2;
    for (; cursor < value.length && depth > 0; cursor += 1) {
      if (value[cursor] === '\\') {
        cursor += 1;
      } else if (value[cursor] === '(') {
        depth += 1;
      } else if (value[cursor] === ')') {
        depth -= 1;
      }
    }
    if (depth !== 0) {
      result += value[index];
      index += 1;
      continue;
    }
    // 隣接するinline linkをreference linkと誤認しないため、後段で除去する境界を残す。
    result += ']\u0000';
    index = cursor;
  }
  return result;
}

function containsAsciiPlaceholder(value) {
  const pattern = /(^|[^A-Za-z0-9])(TBD|TODO)(?=$|[^A-Za-z])/gi;
  for (const match of value.matchAll(pattern)) {
    const markerStart = (match.index ?? 0) + match[1].length;
    const after = value.slice(markerStart + match[2].length).trimStart();
    const marker = match[2];
    if (marker.toUpperCase() === 'TODO') {
      // 大文字のTODOだけを作業マーカーとして扱う。Title Case／lowercaseのTodoは
      // product用語になりうるため許容し、既存の画面名「TODO List／TODO リスト」も除外する。
      if (marker !== 'TODO' || /^(?:LIST(?:$|[^A-Za-z0-9])|リスト)/i.test(after)) {
        continue;
      }
    }
    return true;
  }
  return false;
}

function containsJapanesePlaceholder(value) {
  for (const match of value.matchAll(/未実施|未記入|未定/g)) {
    const markerEnd = (match.index ?? 0) + match[0].length;
    const after = value.slice(markerEnd).trimStart();
    if (
      after === '' ||
      /^(?:です|でした|である|の(?:ため|まま|状態)|なので|[とに]なって|[-/_]|[\s:：。、,，.!！?？(（【\[])/.test(after)
    ) {
      return true;
    }
  }
  return false;
}

function normalizeContractDisplay(value) {
  let normalized = decodeHtmlEntities(value?.trim() ?? '').normalize('NFKC');
  normalized = stripHtmlMarkup(normalized);
  // 表示上の文字列を契約値として扱い、Markdownのlink先や装飾を除去する。
  normalized = stripInlineLinkDestinations(normalized)
    .replace(/!?\[([^\]\n]*)\]\[[^\]\n]*\]/g, '$1')
    .replace(/!?\[([^\]\n]*)\]/g, '$1')
    .replace(/[`*~]/g, '')
    // Markdown装飾のunderscoreだけを外し、ID内のunderscoreはmarker境界として保持する。
    .replace(/(^|[^A-Za-z0-9])_+/g, '$1')
    .replace(/_+(?=$|[^A-Za-z0-9])/g, '')
    .replace(/[\u0000\u200b-\u200d\u2060\ufeff]/g, '')
    .trim();
  return normalized.replace(/\s+/g, ' ');
}

export function normalizeContractToken(value) {
  return normalizeContractDisplay(value).toUpperCase();
}

export function containsContractPlaceholder(value) {
  const displayValue = normalizeContractDisplay(value);
  const normalized = displayValue.toUpperCase();
  return (
    normalized === '' ||
    NONE_REASON_PLACEHOLDERS.has(normalized) ||
    containsAsciiPlaceholder(displayValue) ||
    containsJapanesePlaceholder(displayValue)
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
