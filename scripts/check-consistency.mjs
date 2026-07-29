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
 *   Step 3. DocとspecをルールNo.1〜9で突き合わせ、問題を収集する
 *   Step 4. 結果を出力し、問題が1件でもあればexit 1で終了する
 *
 * チェックルール一覧:
 *   No.1 Parent Case ID・Check IDが命名規則（<LEVEL>-<AREA>-<SEQ>[-<MODE>-<NN>]）に従っている
 *   No.2 Check IDが全Docを通して重複していない
 *   No.3 Check一覧のStatusが正しい値で、Docファイル名がParent Case IDで始まる
 *   No.4 Check一覧のStatusと、各Checkの「Test Status判定根拠」表の判定が一致する
 *   No.5 PW/API CheckはStatusに応じてspecが存在する（EVALUATING以上=必須、RETIRED=禁止）
 *   No.6 Status=QUARANTINEとテストの@quarantineタグが両方向で一致する
 *   No.7 Tier=SMOKEとテストの@smokeタグが両方向で一致する
 *   No.8 CU/MN CheckのIDがspecに存在しない（自動実行対象ではないため）
 *   No.9 specの全タイトルがCheck IDで始まり、そのIDがいずれかのDocに存在する
 *
 * タグ（No.6・No.7）は `{ tag: '@smoke' }` オプション（公式推奨）と
 * タイトル内埋め込みの両方を検出する。ただしtest()直下のみ対応し、
 * test.describe()単位の一括タグ付けは検出対象外（規約: タグはtest単位で付与する）。
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// このスクリプトはscripts/直下に置かれる前提。親ディレクトリ=リポジトリルート
const ROOT = fileURLToPath(new URL('..', import.meta.url));

// test-designs/README.md 2章の命名規則と対応する正規表現
const PARENT_ID_PATTERN = /^(E2E|INT)-[A-Z]{2,6}-\d{3}$/;
const CHECK_ID_PATTERN = /^(E2E|INT)-[A-Z]{2,6}-\d{3}-(PW|API|CU|MN)-\d{2}$/;
// 行内からCheck IDらしき文字列を拾うための緩い版（specタイトル検索用）
const CHECK_ID_LOOSE = /(E2E|INT)-[A-Z]{2,6}-\d{3}-(PW|API|CU|MN)-\d{2}/;

const VALID_STATUSES = new Set(['DRAFT', 'EVALUATING', 'ACTIVE', 'QUARANTINE', 'RETIRED']);
// specの存在を要求するStatus（DRAFTは実装前でもよい）
const STATUSES_REQUIRING_SPEC = new Set(['EVALUATING', 'ACTIVE', 'QUARANTINE']);
// 自動実行されるExecution mode（specと突き合わせる対象）
const AUTOMATED_MODES = new Set(['PW', 'API']);

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
 * - Parent Case ID: メタデータ表の「| Parent Case ID | ... |」行
 * - Check一覧の各行: 先頭セルがCheck ID形式の6列表行
 *   （列順はテンプレート固定: ID / Execution mode / Exploration mode / Tier / Status / Code）
 * - 各Checkの判定: 「### ... <Check ID>: ...」見出しの節にある「| 判定 | ... |」行
 */
function parseDesignDoc(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const parentMatch = content.match(/\|\s*Parent Case ID\s*\|\s*([^|]+)\|/);
  const parentCaseId = parentMatch?.[1].trim();

  const checks = [];
  for (const line of lines) {
    // 表行「| a | b | ... |」をセル配列へ分解（両端の空要素を除去）
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 8) {
      continue; // Check一覧は6列（分解すると8要素）。それ未満の表行は対象外
    }

    const id = cells[1] ?? '';
    if (!/^(E2E|INT)-/.test(id)) {
      continue; // 先頭セルがCheck IDで始まらない行（ヘッダ等）は対象外
    }

    checks.push({
      id,
      tier: cells[4] ?? '',
      status: cells[5] ?? '',
      // MODE部分（PW/API/CU/MN）。ID形式が不正な場合はundefined
      mode: id.match(CHECK_ID_PATTERN)?.[2],
      // このCheckの節にある「Test Status判定根拠」表の判定値
      judgement: extractJudgement(content, id),
    });
  }

  return { file: filePath, parentCaseId, checks };
}

/**
 * 「### 3.x <Check ID>: ...」見出しから次の同レベル見出しまでを切り出し、
 * その範囲内の「| 判定 | XXX |」行から判定値を取り出す。
 * 見出しまたは判定行が見つからない場合はundefinedを返す。
 */
function extractJudgement(content, checkId) {
  const lines = content.split('\n');
  const headingIndex = lines.findIndex(
    (line) => /^#{3,4}\s/.test(line) && line.includes(checkId)
  );
  if (headingIndex === -1) {
    return undefined;
  }

  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (/^###\s/.test(line)) {
      break; // 次のCheckの節に入ったら打ち切り
    }

    const judgementMatch = line.match(/^\|\s*判定\s*\|\s*([^|]+)\|/);
    if (judgementMatch) {
      return judgementMatch[1].trim();
    }
  }
  return undefined;
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
  // Step 1: Doc収集（templates/と_archive/は対象外のため、e2e/intディレクトリのみ走査）
  const docFiles = [
    ...listFiles(join(ROOT, 'test-designs', 'e2e'), '.md'),
    ...listFiles(join(ROOT, 'test-designs', 'int'), '.md'),
  ];
  const docs = docFiles.map(parseDesignDoc);

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
      report(docPath, 'メタデータ表にParent Case IDが見つかりません');
      continue;
    }

    // ルールNo.1（前半）: Parent Case ID自体の形式
    if (!PARENT_ID_PATTERN.test(doc.parentCaseId)) {
      report(docPath, `Parent Case ID「${doc.parentCaseId}」が命名規則に従っていません`);
      continue;
    }

    // ルールNo.3（後半）: ファイル名は「<Parent Case ID>-<slug>.md」形式
    if (!basename(doc.file).startsWith(`${doc.parentCaseId}-`)) {
      report(docPath, `ファイル名がParent Case ID「${doc.parentCaseId}」で始まっていません`);
    }

    if (doc.checks.length === 0) {
      report(docPath, 'Check一覧からCheckを1件も読み取れませんでした');
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

      // ルールNo.3（前半）: Status値
      if (!VALID_STATUSES.has(check.status)) {
        report(docPath, `「${check.id}」のStatus「${check.status}」は不正な値です`);
        continue; // Statusが読めない場合、以降のStatus依存チェックは行えない
      }

      // ルールNo.4: Check一覧のStatusと判定根拠表の判定の一致
      if (check.judgement === undefined) {
        report(docPath, `「${check.id}」のTest Status判定根拠（| 判定 | 行）が見つかりません`);
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

main();
