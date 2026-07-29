import { defineConfig, devices } from '@playwright/test';

/**
 * ファイルから環境変数を読み込む場合の設定。
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
dotenv.config({ path: new URL('.env', import.meta.url) });

/**
 * E2E_BASE_URLのoriginがE2E_ALLOWED_ORIGINS（カンマ区切りの許可済みorigin一覧）に
 * 含まれることを起動時に検証する。本番環境などallowlist外への誤実行を
 * テスト開始前に停止する（test-designs/README.md 5章）。
 */
function validateBaseUrl(baseUrl: string | undefined): string | undefined {
  if (baseUrl === undefined || baseUrl === '') {
    return undefined;
  }

  const allowedOrigins = (process.env.E2E_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (allowedOrigins.length === 0) {
    throw new Error(
      'E2E_ALLOWED_ORIGINS が未設定です。E2E_BASE_URL を使用する場合は、' +
        '許可するoriginをカンマ区切りで設定してください（.env.example参照）。'
    );
  }

  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    throw new Error(`E2E_BASE_URL が不正なURLです: ${baseUrl}`);
  }

  if (!allowedOrigins.includes(origin)) {
    throw new Error(
      `E2E_BASE_URL のorigin（${origin}）が E2E_ALLOWED_ORIGINS に含まれていません。` +
        `許可済み: ${allowedOrigins.join(', ')}`
    );
  }

  return baseUrl;
}

/**
 * Qualification実行（E2E_QUALIFY=1、test:qualify経由）の制御。
 * - 対象を1 Checkに限定するため、--grep（Check ID）と--projectの指定を必須とし、
 *   未指定の場合はテスト開始前に失敗する
 * - HTMLレポートを上書きされないqualification-reports/配下へ保存する
 * （test-designs/README.md 4.1章）
 */
const CHECK_ID_PATTERN = /(E2E|INT)-[A-Z]{2,6}-\d{3}-(PW|API)-\d{2}/;

function findArgValue(args: readonly string[], name: string): string | undefined {
  const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index === -1) {
    return undefined;
  }

  const arg = args[index];
  if (arg === undefined) {
    return undefined;
  }

  if (arg.includes('=')) {
    return arg.slice(arg.indexOf('=') + 1);
  }

  return args[index + 1];
}

function resolveQualifyReportDir(): string | undefined {
  if (process.env.E2E_QUALIFY !== '1') {
    return undefined;
  }

  // worker processはCLI引数を持たない別プロセスとしてconfigを再評価するため、
  // 検証とレポート設定は主プロセスでのみ行う（レポーターは主プロセスだけが使う）
  if (process.env.TEST_WORKER_INDEX !== undefined) {
    return undefined;
  }

  const args = process.argv.slice(2);
  const grep = findArgValue(args, '--grep') ?? findArgValue(args, '-g');
  const project = findArgValue(args, '--project');

  const checkId = grep?.match(CHECK_ID_PATTERN)?.[0];
  if (checkId === undefined) {
    throw new Error(
      'Qualificationには --grep "<Check ID>" の指定が必要です' +
        '（例: --grep "E2E-DEMO-001-PW-01"）。'
    );
  }

  if (project === undefined || project === '') {
    throw new Error(
      'Qualificationには --project の指定が必要です（例: --project=chromium）。'
    );
  }

  // ミリ秒まで含め、同一秒内の実行によるフォルダ名衝突の可能性を低減する
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 23);
  const reportDir = `qualification-reports/${timestamp}_${checkId}`;

  console.log(`Qualification report: ${reportDir}`);
  return reportDir;
}

const qualifyReportDir = resolveQualifyReportDir();

/**
 * 設定の詳細: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  /* ファイル内のテストも並列実行する */
  fullyParallel: true,
  /* test.onlyの消し忘れがある場合はCIを失敗させる */
  forbidOnly: true,
  /* CIでのみ再試行する process.env.CI ? 2:0 */
  retries: 0,
  /* CIでは並列実行を無効にする process.env.CI ? 1 : 2*/
  workers: 1,
  /* 使用するレポーター。詳細: https://playwright.dev/docs/test-reporters
     Qualification実行時のみ、上書きされない専用フォルダへ保存する */
  reporter: [
    [
      'html',
      qualifyReportDir === undefined
        ? { open: 'on-failure' }
        : { outputFolder: qualifyReportDir, open: 'never' },
    ],
  ],
  /* 以下のすべてのプロジェクトで共有する設定。詳細: https://playwright.dev/docs/api/class-testoptions */
  use: {
    /* await page.goto('') などで使用するベースURL。許可済みorigin一覧と照合する */
    baseURL: validateBaseUrl(process.env.E2E_BASE_URL),
    screenshot: 'only-on-failure',
    /* 失敗したテストの再試行時にトレースを収集する。詳細: https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    video: 'off'
  },

  /* 主要ブラウザ向けのプロジェクト設定 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* モバイルのviewportでテストする場合の設定 */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* ブランド版ブラウザでテストする場合の設定 */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* テスト前にローカル開発サーバーを起動する場合の設定 */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
