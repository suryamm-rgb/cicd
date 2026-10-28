import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/about' },
  { name: 'projects', path: '/projects' },
  { name: 'contact', path: '/contact' },
  { name: '404', path: '/no-such-page' },
] as const;

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`accessibility (${colorScheme} mode)`, () => {
    test.use({ colorScheme });

    for (const { name, path } of pages) {
      test(`${name} page has no serious or critical violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();

        const blocking = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(
          blocking.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.map((n) => n.target),
          })),
        ).toEqual([]);
      });
    }

    test('contact page with validation errors has no serious or critical violations', async ({
      page,
    }) => {
      await page.goto('/contact');
      await page.getByRole('button', { name: 'Send message' }).click();
      await expect(page.getByRole('alert')).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(
        results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
      ).toEqual([]);
    });
  });
}
