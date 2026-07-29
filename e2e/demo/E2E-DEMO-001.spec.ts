import { test, expect } from '@playwright/test';

/**
 * Test Design: test-designs/e2e/demo/E2E-DEMO-001-docs-navigation.md
 * 前提: E2E_BASE_URL=https://playwright.dev（.env.example参照）
 */

test(
  'E2E-DEMO-001-PW-01: トップページからGet startedでインストールガイドへ到達できる',
  { tag: '@smoke' },
  async ({ page }) => {
    // Given: トップページを表示している
    await page.goto('/');
    await expect(page).toHaveTitle(/Playwright/);

    // When: Get startedリンクからドキュメントへ遷移する
    await page.getByRole('link', { name: 'Get started' }).click();

    // Then: インストールガイドが表示される
    await expect(page).toHaveURL(/\/docs\/intro$/);
    await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
  }
);
