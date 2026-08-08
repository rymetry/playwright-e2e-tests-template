import { test, expect } from '@playwright/test';

/**
 * Test Design: test-designs/int/demo/INT-DEMO-001-docs-availability.md
 * 前提: E2E_BASE_URL=https://playwright.dev（.env.example参照）
 * API Checkの記入例。request fixtureのみを使用し、ブラウザは起動しない。
 */

test('INT-DEMO-001-API-01: インストールガイドがHTTPで配信されている', async ({ request }) => {
  // When: インストールガイドをHTTPで取得する
  const response = await request.get('/docs/intro');

  // Then: 成功応答としてHTMLが返り、ガイド本文を含む
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/html');
  expect(await response.text()).toContain('Installation');
});
